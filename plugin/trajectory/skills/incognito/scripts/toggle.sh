#!/bin/bash
# Toggle incognito mode for the current session through the capture server.
# When enabled: local capture continues, non-exempt Datadog publish is suppressed.
# Resets on session end.
set -e

ACTION="${1:-on}"
SESSION_ID="${TRAJECTORY_SESSION_ID:-${CLAUDE_SESSION_ID:-}}"
STATE_DIR="${TRAJECTORY_HOME:-${HOME}/.trajectory}/state"
PORT="${TRAJECTORY_PORT:-19222}"

discover_active_session_id() {
    local active_dir file session_id
    for active_dir in \
        "${TRAJECTORY_PROJECT_ROOT:-}/.trajectory/.state/active" \
        "${PWD}/.trajectory/.state/active"; do
        [ -n "$active_dir" ] || continue
        [ -d "$active_dir" ] || continue
        for file in "$active_dir"/*.json; do
            [ -f "$file" ] || continue
            if command -v jq >/dev/null 2>&1; then
                session_id="$(jq -r '.session_id // empty' "$file" 2>/dev/null || true)"
            else
                session_id="$(sed -n 's/.*"session_id"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$file" 2>/dev/null | head -1)"
            fi
            if [ -n "$session_id" ]; then
                printf '%s\n' "$session_id"
                return 0
            fi
        done
    done
    return 1
}

case "$ACTION" in
    off|disable|disabled|resume|"resume publish")
        ENABLE="false"
        ;;
    toggle)
        if [ -n "$SESSION_ID" ] && [ -f "$STATE_DIR/incognito-${SESSION_ID}" ]; then
            ENABLE="false"
        else
            ENABLE="true"
        fi
        ;;
    ""|on|enable|enabled|private|"pause capture"|*)
        ENABLE="true"
        ;;
esac

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "unknown" ]; then
    SESSION_ID="$(discover_active_session_id || true)"
fi

if [ -z "$SESSION_ID" ]; then
    echo "Incognito mode could not be changed: no active Claude session id was available." >&2
    exit 1
fi

if command -v curl >/dev/null 2>&1; then
    if curl -fsS -X POST "http://localhost:${PORT}/session/incognito?session_id=${SESSION_ID}&enable=${ENABLE}" >/dev/null 2>&1; then
        if [ "$ENABLE" = "true" ]; then
            echo "Incognito mode ENABLED -- non-exempt Datadog publish suppressed for session ${SESSION_ID}; local JSONL capture continues"
        else
            echo "Incognito mode DISABLED -- non-exempt Datadog publish resumed for session ${SESSION_ID}"
        fi
        exit 0
    fi
fi

mkdir -p "$STATE_DIR"
if [ "$ENABLE" = "true" ]; then
    echo "incognito" > "$STATE_DIR/incognito-${SESSION_ID}"
    echo "Incognito mode ENABLED via local sentinel -- non-exempt Datadog publish suppressed for session ${SESSION_ID}; local JSONL capture continues"
else
    rm -f "$STATE_DIR/incognito-${SESSION_ID}"
    echo "Incognito mode DISABLED via local sentinel -- non-exempt Datadog publish resumed for session ${SESSION_ID}"
fi
