#!/bin/bash
# Hand the hook payload to a detached capture worker and return. The worker owns
# bounded serve recovery and delivery, so a slow or absent serve never holds the
# Claude Code callback past its timeout.
set -e

EVENT_TYPE="${1:-}"
WAIT_NOTIFY="${2:-2s}"
BINARY="${TRAJECTORY_BINARY:-${HOME}/.trajectory/bin/trajectory}"
export TRAJECTORY_SERVE_RESTART_WAIT="${TRAJECTORY_SERVE_RESTART_WAIT:-5s}"

case "$EVENT_TYPE" in
    ''|*[!A-Za-z0-9_:-]*)
        exit 0
        ;;
esac

# Record that the hook ran before anything that can fail quietly, with the
# serve port it targets. capture-hook.log only shows hooks that reached the
# binary, so a missing binary or a hook killed during start-up left no trace.
# The line carries no session or payload content.
hook_start() {
    local dir="${TRAJECTORY_HOME:-${HOME}/.trajectory}/logs"
    { [ -d "$dir" ] || mkdir -p "$dir"; } 2>/dev/null || return 0
    # Every hook runs this, and each process it starts adds to the wait a turn
    # sees. Bash 4.2 and later format the time themselves. The bash that ships
    # with macOS is older and rejects the format, so it still runs date.
    local now=""
    TZ=UTC printf -v now '%(%Y-%m-%dT%H:%M:%SZ)T' -1 2>/dev/null || now="$(date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null)"
    printf '[capture-hook-start:%s] %s event=%s plugin_root=%s port=%s result=%s\n' \
        "$$" "$now" "$EVENT_TYPE" "${CLAUDE_PLUGIN_ROOT##*/}" \
        "${TRAJECTORY_HOOK_PORT:-${TRAJECTORY_PORT:-default}}" "$1" >>"$dir/capture-hook-start.log" 2>/dev/null || true
}

if [ ! -x "$BINARY" ]; then
    hook_start missing_binary
    exit 0
fi
hook_start started

# Give capture its own process group, including any worker started at handoff.
# The client may signal only the callback PID. Normal completion keeps the
# durable handoff; cancellation stops the group and reaps the foreground child.
capture_pid=""
cancel_capture() {
    local child="${capture_pid:-$!}"
    if [ -n "$child" ]; then
        kill -KILL -- "-$child" 2>/dev/null || kill -KILL "$child" 2>/dev/null || true
        wait "$child" 2>/dev/null || true
    fi
    exit 0
}
trap cancel_capture HUP INT TERM

# Preserve the session lifecycle flags used by the direct command hooks.
set -m
case "$EVENT_TYPE" in
    SessionStart|SessionEnd)
        "$BINARY" capture-hook --background-after-read --ensure-serve --ensure-serve-wait 2s --wait-notify "$WAIT_NOTIFY" "$EVENT_TYPE" <&0 >/dev/null 2>&1 &
        ;;
    *)
        "$BINARY" capture-hook --client cc --background-after-read --ensure-serve --wait-notify "$WAIT_NOTIFY" "$EVENT_TYPE" <&0 >/dev/null 2>&1 &
        ;;
esac
capture_pid=$!
set +m
# Redirect wait as well, including the shell's diagnostics for a crashed child.
wait "$capture_pid" >/dev/null 2>&1 || true
trap - HUP INT TERM
exit 0
