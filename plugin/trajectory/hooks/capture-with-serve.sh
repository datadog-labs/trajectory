#!/bin/bash
# capture-with-serve.sh - Sequentially recover serve, then capture one hook.
#
# Claude Code runs matching hook handlers in parallel. Keep recovery and capture
# in one command when capture depends on a freshly started local server.
set -e

EVENT_TYPE="${1:-}"
WAIT_NOTIFY="${2:-2s}"
BINARY="${TRAJECTORY_BINARY:-${HOME}/.trajectory/bin/trajectory}"
HOOK_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENSURE_SERVE="${HOOK_DIR}/ensure-serve.sh"

case "$EVENT_TYPE" in
    ''|*[!A-Za-z0-9_:-]*)
        exit 0
        ;;
esac

if [ -x "$ENSURE_SERVE" ]; then
    TRAJECTORY_BINARY="$BINARY" bash "$ENSURE_SERVE" || true
fi

if [ ! -x "$BINARY" ]; then
    exit 0
fi

# The shared serve daemon can be busy for tens of seconds on other work (batch
# repairs, marker evaluation, publish retries). Without a bound here, Claude
# Code's own hook timeout eventually SIGKILLs this process and discards the
# hook's output. Fail open before that happens instead.
CAPTURE_TIMEOUT="${TRAJECTORY_CAPTURE_HOOK_TIMEOUT_SECONDS:-5}"
case "$CAPTURE_TIMEOUT" in
    ''|*[!0-9]*) CAPTURE_TIMEOUT=5 ;;
esac

TIMEOUT_BIN=""
for candidate in timeout gtimeout; do
    if command -v "$candidate" >/dev/null 2>&1; then
        TIMEOUT_BIN="$candidate"
        break
    fi
done

if [ -n "$TIMEOUT_BIN" ]; then
    "$TIMEOUT_BIN" "$CAPTURE_TIMEOUT" "$BINARY" capture-hook --wait-notify "$WAIT_NOTIFY" "$EVENT_TYPE" || exit 0
else
    exec "$BINARY" capture-hook --wait-notify "$WAIT_NOTIFY" "$EVENT_TYPE"
fi
