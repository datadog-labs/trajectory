#!/bin/bash
# ensure-serve.sh - Restart trajectory capture server if it is down.
#
# Used by capture-with-serve.sh before prompt capture. If down, spawns
# a rescue serve process tied to the coding agent's lifecycle via PPID
# monitoring.
#
# Concurrency: uses lock-based leader election (flock on Linux, atomic
# mkdir on macOS) so that when many agents fire hooks simultaneously
# after a crash, exactly one process wins the restart lock. Losers
# sleep briefly and exit - no stampede.
#
# Lifecycle: watchdog resolves which ancestor PID is the long-lived
# agent process (vs ephemeral shell wrapper) using a timing heuristic,
# then monitors it. When the agent exits, watchdog kills serve -
# matching MCP server lifecycle behavior.
set -e

PORT="${TRAJECTORY_PORT:-19222}"
BINARY="${TRAJECTORY_BINARY:-${HOME}/.trajectory/bin/trajectory}"
EXPECTED_HOME="${TRAJECTORY_HOME:-${HOME}/.trajectory}"
STATE_DIR="${TRAJECTORY_HOME:-${HOME}/.trajectory}/state"
HEALTH_CONNECT_TIMEOUT="${TRAJECTORY_HEALTH_CONNECT_TIMEOUT:-0.2}"
HEALTH_MAX_TIME="${TRAJECTORY_HEALTH_MAX_TIME:-0.3}"
RESTART_WAIT_SECONDS="${TRAJECTORY_SERVE_RESTART_WAIT_SECONDS:-4}"

health_check() {
    local body actual_home
    body="$(curl -sf --connect-timeout "$HEALTH_CONNECT_TIMEOUT" --max-time "$HEALTH_MAX_TIME" "http://localhost:${PORT}/health" 2>/dev/null)" || return 1
    case "$body" in
        *'"status":"ok"'*|*'"status": "ok"'*)
            ;;
        *)
            return 1
            ;;
    esac
    if command -v jq >/dev/null 2>&1; then
        actual_home="$(printf '%s' "$body" | jq -r '.trajectory_home // empty' 2>/dev/null || true)"
    else
        actual_home="$(printf '%s' "$body" | sed -n 's/.*"trajectory_home"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
    fi
    [ -n "$actual_home" ] || return 1
    [ "$actual_home" = "$EXPECTED_HOME" ]
}

is_valid_pid() {
    case "${1:-}" in
        ''|*[!0-9]*)
            return 1
            ;;
    esac
    [ "$1" -gt 1 ] 2>/dev/null
}

atomic_write_file() {
    local target="$1"
    local dir base tmp
    dir="$(dirname "$target")" || return 1
    base="$(basename "$target")" || return 1
    mkdir -p "$dir" || return 1
    tmp="$(mktemp "${dir}/.${base}.tmp.XXXXXX")" || return 1
    if cat >"$tmp" && mv -f "$tmp" "$target"; then
        return 0
    fi
    rm -f "$tmp"
    return 1
}

# Quick health check - if server is healthy, nothing to do.
if health_check; then
    exit 0
fi

# No binary means trajectory is not installed - cannot restart, do not block.
if [ ! -x "$BINARY" ]; then
    # Warn once per session (keyed on PPID) so the user knows why capture is inactive.
    WARN_STAMP="${STATE_DIR}/no-binary-warned.${PPID}"
    if [ ! -f "$WARN_STAMP" ]; then
        : | atomic_write_file "$WARN_STAMP" || true
        echo '[trajectory] Binary not found at ~/.trajectory/bin/trajectory. Run ~/.trajectory/bin/trajectory doctor after reinstalling.' >&2
    fi
    exit 0
fi

# Serve is down. Use lock-based leader election so exactly one hook
# invocation restarts serve when many agents fire hooks concurrently.
# mkdir is atomic on POSIX - exactly one process succeeds, others get EEXIST.
LOCKDIR="${STATE_DIR}/.serve-restart.lock"
mkdir -p "$STATE_DIR"

# Acquire lock. On Linux flock(1) is available; fall back to mkdir lock.
_lock_acquired=0
if command -v flock >/dev/null 2>&1; then
    exec 9>"${LOCKDIR}.flock"
    if flock -n 9; then
        _lock_acquired=1
    fi
else
    # mkdir-based lock with staleness detection (30s timeout).
    if mkdir "$LOCKDIR" 2>/dev/null; then
        _lock_acquired=1
        # Ensure lock is cleaned up on exit (normal or error).
        trap 'rm -rf "$LOCKDIR"' EXIT
        printf '%s\n' "$$" | atomic_write_file "$LOCKDIR/pid"
    else
        # Check for stale lock - if the holder died, reclaim it.
        LOCK_PID=$(cat "$LOCKDIR/pid" 2>/dev/null)
        if ! is_valid_pid "$LOCK_PID" || ! kill -0 "$LOCK_PID" 2>/dev/null; then
            rm -rf "$LOCKDIR"
            if mkdir "$LOCKDIR" 2>/dev/null; then
                _lock_acquired=1
                trap 'rm -rf "$LOCKDIR"' EXIT
                printf '%s\n' "$$" | atomic_write_file "$LOCKDIR/pid"
            fi
        fi
    fi
fi

if [ "$_lock_acquired" -ne 1 ]; then
    # Another process is already restarting. Wait briefly for it to finish.
    sleep 2
    exit 0
fi

# We hold the lock. Double-check health - another process may have restarted
# serve between our initial check and acquiring the lock.
if health_check; then
    exit 0
fi

# Clean up any stale pidfile from a previous crash.
PIDFILE="${STATE_DIR}/rescue-serve.pid"
if [ -f "$PIDFILE" ]; then
    OLD_PID=$(cat "$PIDFILE" 2>/dev/null)
    if ! is_valid_pid "$OLD_PID" || ! kill -0 "$OLD_PID" 2>/dev/null; then
        rm -f "$PIDFILE"
    fi
fi

# Capture both candidate PIDs for lifecycle binding.
# Hook execution varies by how CC spawns hooks:
#   Case A: CC execs directly -> $PPID = CC (long-lived)
#   Case B: CC -> sh -c wrapper -> $PPID = sh (ephemeral), grandparent = CC
# The watchdog uses a timing heuristic to pick the right one.
PPID_PID="$PPID"
GRANDPARENT_PID=$(ps -p "$PPID" -o ppid= 2>/dev/null | tr -d ' ')

# Spawn serve + lifecycle watchdog in a detached subshell.
(
    RESCUE_LOG="${TRAJECTORY_HOME:-${HOME}/.trajectory}/logs/rescue-serve.log"
    mkdir -p "$(dirname "$RESCUE_LOG")"
    echo "[ensure-serve] $(date): starting serve on port $PORT, binary=$BINARY" >>"$RESCUE_LOG"
    unset CLAUDE_SESSION_ID GEMINI_SESSION_ID TRAJECTORY_SESSION_ID TRAJECTORY_CLIENT_SOURCE
    TRAJECTORY_DISABLE_CLIENT_WATCHERS=1 TRAJECTORY_SERVE_START_SOURCE=rescue_hook "$BINARY" serve --port "$PORT" >>"$RESCUE_LOG" 2>&1 &
    SERVE_PID=$!
    if ! printf '%s\n' "$SERVE_PID" | atomic_write_file "$PIDFILE"; then
        kill "$SERVE_PID" 2>/dev/null || true
        wait "$SERVE_PID" 2>/dev/null || true
        exit 0
    fi

    # Timing heuristic: wait 5s for the hook to finish. If $PPID is still
    # alive, it is the long-lived agent process (case A). If it died, it
    # was the ephemeral sh wrapper and we fall back to grandparent (case B).
    sleep 5
    if is_valid_pid "$PPID_PID" && kill -0 "$PPID_PID" 2>/dev/null; then
        AGENT_PID="$PPID_PID"
    elif is_valid_pid "$GRANDPARENT_PID" && kill -0 "$GRANDPARENT_PID" 2>/dev/null; then
        AGENT_PID="$GRANDPARENT_PID"
    else
        # Cannot determine agent PID - serve will rely on inactivity timeout.
        exit 0
    fi

    # Poll agent PID every 5s. When gone, wait for pending hooks (SessionEnd)
    # to drain, then SIGTERM serve for graceful shutdown.
    while kill -0 "$AGENT_PID" 2>/dev/null; do
        sleep 5
    done
    # Grace period: SessionEnd fires after agent exit. Give it time to reach serve.
    sleep 10
    kill "$SERVE_PID" 2>/dev/null
    wait "$SERVE_PID" 2>/dev/null
    rm -f "$PIDFILE"
) &
disown

# Wait briefly for health to come up. Each probe has a short per-curl timeout
# so a half-open localhost socket cannot stretch this hook into a long wait.
# Lock auto-releases: flock via fd 9 close, mkdir via EXIT trap.
_wait_start=$SECONDS
while [ $((SECONDS - _wait_start)) -lt "$RESTART_WAIT_SECONDS" ]; do
    if health_check; then
        RESTARTED_PID=$(cat "$PIDFILE" 2>/dev/null || true)
        if ! is_valid_pid "$RESTARTED_PID"; then
            RESTARTED_PID="unknown"
        fi
        echo "[trajectory] serve restarted (PID $RESTARTED_PID)" >&2
        exit 0
    fi
    sleep 0.25
done

# Server did not come up in time - do not block the prompt.
echo "[trajectory] WARNING: serve restart may have failed" >&2
exit 0
