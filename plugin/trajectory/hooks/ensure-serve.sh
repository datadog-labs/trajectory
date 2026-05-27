#!/bin/bash
# Unless explicitly stated otherwise all files in this repository are licensed under the Apache-2.0 License.
# This product includes software developed at Datadog (https://www.datadoghq.com/) Copyright 2026 Datadog, Inc.

# ensure-serve.sh - Restart trajectory capture server if it is down.
#
# UserPromptSubmit hook: fires before HTTP capture hooks to ensure
# the server is alive. If down, spawns a rescue serve process tied
# to the coding agent's lifecycle via PPID monitoring.
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
BINARY="${HOME}/.trajectory/bin/trajectory"
STATE_DIR="${TRAJECTORY_HOME:-${HOME}/.trajectory}/state"
HEALTH_CONNECT_TIMEOUT="${TRAJECTORY_HEALTH_CONNECT_TIMEOUT:-0.2}"
HEALTH_MAX_TIME="${TRAJECTORY_HEALTH_MAX_TIME:-0.3}"
RESTART_WAIT_SECONDS="${TRAJECTORY_SERVE_RESTART_WAIT_SECONDS:-4}"

health_check() {
    curl -sf --connect-timeout "$HEALTH_CONNECT_TIMEOUT" --max-time "$HEALTH_MAX_TIME" "http://localhost:${PORT}/health" >/dev/null 2>&1
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
        mkdir -p "$STATE_DIR"
        touch "$WARN_STAMP"
        echo '[trajectory] Binary not found. Reload your shell or run: export PATH="$HOME/.trajectory/bin:$PATH"' >&2
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
        echo $$ > "$LOCKDIR/pid"
        # Ensure lock is cleaned up on exit (normal or error).
        trap 'rm -rf "$LOCKDIR"' EXIT
    else
        # Check for stale lock - if the holder died, reclaim it.
        LOCK_PID=$(cat "$LOCKDIR/pid" 2>/dev/null)
        if [ -n "$LOCK_PID" ] && ! kill -0 "$LOCK_PID" 2>/dev/null; then
            rm -rf "$LOCKDIR"
            if mkdir "$LOCKDIR" 2>/dev/null; then
                _lock_acquired=1
                echo $$ > "$LOCKDIR/pid"
                trap 'rm -rf "$LOCKDIR"' EXIT
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
    if [ -n "$OLD_PID" ] && ! kill -0 "$OLD_PID" 2>/dev/null; then
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
    "$BINARY" serve --port "$PORT" >>"$RESCUE_LOG" 2>&1 &
    SERVE_PID=$!
    echo "$SERVE_PID" > "$PIDFILE"

    # Timing heuristic: wait 5s for the hook to finish. If $PPID is still
    # alive, it is the long-lived agent process (case A). If it died, it
    # was the ephemeral sh wrapper and we fall back to grandparent (case B).
    sleep 5
    if kill -0 "$PPID_PID" 2>/dev/null; then
        AGENT_PID="$PPID_PID"
    elif [ -n "$GRANDPARENT_PID" ] && [ "$GRANDPARENT_PID" -gt 1 ] 2>/dev/null && kill -0 "$GRANDPARENT_PID" 2>/dev/null; then
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
        echo "[trajectory] serve restarted (PID $(cat "$PIDFILE" 2>/dev/null))" >&2
        exit 0
    fi
    sleep 0.25
done

# Server did not come up in time - do not block the prompt.
echo "[trajectory] WARNING: serve restart may have failed" >&2
exit 0
