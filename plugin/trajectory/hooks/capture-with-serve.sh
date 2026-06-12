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

exec "$BINARY" capture-hook --wait-notify "$WAIT_NOTIFY" "$EVENT_TYPE"
