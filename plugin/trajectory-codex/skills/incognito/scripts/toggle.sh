#!/bin/bash
# Toggle incognito mode for the current session through the capture server.
# When enabled: local capture continues, non-exempt Datadog publish is suppressed.
# Resets on session end.
set -e

ACTION="${1:-on}"
TRAJECTORY_HOME_DIR="${TRAJECTORY_HOME:-${HOME}/.trajectory}"
STATE_DIR="${TRAJECTORY_HOME_DIR}/state"
PORT="${TRAJECTORY_PORT:-19222}"
CLIENT_HINT="${TRAJECTORY_CLIENT_HINT:-${TRAJECTORY_INCOGNITO_CLIENT:-claude-code}}"
PROJECT_HINT="${TRAJECTORY_PROJECT_ROOT:-${CODEX_PROJECT_DIR:-${PWD}}}"
RESOLVE_ATTEMPTS="${TRAJECTORY_INCOGNITO_RESOLVE_ATTEMPTS:-10}"
RESOLVE_SLEEP="${TRAJECTORY_INCOGNITO_RESOLVE_SLEEP:-0.5}"

RESOLUTION_SOURCE=""

is_safe_session_id() {
    local sid="${1:-}"
    [ -n "$sid" ] || return 1
    [ "$sid" != "unknown" ] || return 1
    [ "${#sid}" -le 128 ] || return 1
    case "$sid" in
        *[!A-Za-z0-9_-]*)
            return 1
            ;;
    esac
    return 0
}

normalize_client() {
    local client
    client="$(printf '%s' "${1:-}" | tr '[:upper:]_' '[:lower:]-')"
    case "$client" in
        claude|cc|claude-code)
            printf 'claude-code\n'
            ;;
        codex|codex-cli)
            printf 'codex\n'
            ;;
        gemini|gemini-cli)
            printf 'gemini\n'
            ;;
        opencode|open-code)
            printf 'opencode\n'
            ;;
        cursor|cursor-agent|cursor-desktop)
            printf 'cursor\n'
            ;;
        copilot|github-copilot)
            printf 'copilot\n'
            ;;
        factory|factory-droid|droid)
            printf 'droid\n'
            ;;
        *)
            printf '%s\n' "$client"
            ;;
    esac
}

canonical_path() {
    local path="${1:-}"
    [ -n "$path" ] || return 1
    if [ -d "$path" ]; then
        (cd "$path" 2>/dev/null && pwd -P) || printf '%s\n' "$path"
        return 0
    fi
    local dir
    dir="$(dirname "$path")" || return 1
    (cd "$dir" 2>/dev/null && printf '%s/%s\n' "$(pwd -P)" "$(basename "$path")") || printf '%s\n' "$path"
}

find_project_root() {
    local dir parent
    dir="$(canonical_path "${1:-$PWD}" 2>/dev/null || true)"
    [ -n "$dir" ] || return 1
    [ -d "$dir" ] || dir="$(dirname "$dir")"
    while [ -n "$dir" ]; do
        if [ -d "$dir/.trajectory" ]; then
            printf '%s\n' "$dir"
            return 0
        fi
        parent="$(dirname "$dir")"
        [ "$parent" != "$dir" ] || break
        dir="$parent"
    done
    return 1
}

same_workspace_path() {
    local a b
    a="$(canonical_path "${1:-}" 2>/dev/null || true)"
    b="$(canonical_path "${2:-}" 2>/dev/null || true)"
    [ -n "$a" ] && [ -n "$b" ] || return 1
    case "$a" in
        "$b"|"$b"/*)
            return 0
            ;;
    esac
    case "$b" in
        "$a"|"$a"/*)
            return 0
            ;;
    esac
    return 1
}

json_field() {
    local file="$1"
    local field="$2"
    if command -v jq >/dev/null 2>&1; then
        jq -r --arg field "$field" '.[$field] // empty' "$file" 2>/dev/null || true
        return 0
    fi
    sed -n 's/.*"'"$field"'"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$file" 2>/dev/null | head -1
}

session_id_from_env() {
    local name value
    for name in TRAJECTORY_SESSION_ID CODEX_SESSION_ID GEMINI_SESSION_ID CLAUDE_SESSION_ID OPENCODE_SESSION_ID PI_SESSION_ID DROID_SESSION_ID COPILOT_SESSION_ID; do
        eval "value=\${$name:-}"
        [ -n "$value" ] || continue
        [ "$value" != "unknown" ] || continue
        if ! is_safe_session_id "$value"; then
            echo "Incognito mode could not be changed: unsafe session id in ${name}." >&2
            return 2
        fi
        RESOLUTION_SOURCE="env:${name}"
        printf '%s\n' "$value"
        return 0
    done
    return 1
}

active_dirs() {
    local root project_root
    project_root="$(find_project_root "$PROJECT_HINT" 2>/dev/null || true)"
    for root in "${TRAJECTORY_PROJECT_ROOT:-}" "$project_root" "$PWD"; do
        [ -n "$root" ] || continue
        printf '%s\n' "$root/.trajectory/.state/active"
    done
    printf '%s\n' "${TRAJECTORY_HOME_DIR}/trajectories/.state/active"
    printf '%s\n' "${TRAJECTORY_HOME_DIR}/.state/active"
}

reset_candidates() {
    MATCH_COUNT=0
    BEST_SESSION_ID=""
    BEST_TS=""
    SEEN_SUMMARY=""
}

candidate_matches_mode() {
    local mode="$1"
    local client="$2"
    local project_dir="$3"
    local client_hint project_hint
    client_hint="$(normalize_client "$CLIENT_HINT")"
    project_hint="$(canonical_path "$PROJECT_HINT" 2>/dev/null || true)"

    case "$mode" in
        client_project)
            [ -n "$client_hint" ] && [ "$(normalize_client "$client")" = "$client_hint" ] || return 1
            same_workspace_path "$project_dir" "$project_hint"
            ;;
        client)
            [ -n "$client_hint" ] && [ "$(normalize_client "$client")" = "$client_hint" ]
            ;;
        project)
            same_workspace_path "$project_dir" "$project_hint"
            ;;
        any)
            return 0
            ;;
        *)
            return 1
            ;;
    esac
}

consider_candidate() {
    local mode="$1"
    local session_id="$2"
    local client="$3"
    local project_dir="$4"
    local last_event="$5"
    local started="$6"
    local ts

    is_safe_session_id "$session_id" || return 0
    candidate_matches_mode "$mode" "$client" "$project_dir" || return 0

    MATCH_COUNT=$((MATCH_COUNT + 1))
    ts="${last_event:-$started}"
    if [ "$MATCH_COUNT" -le 8 ]; then
        SEEN_SUMMARY="${SEEN_SUMMARY}${SEEN_SUMMARY:+; }${session_id} client=${client:-unknown} project_dir=${project_dir:-unknown} last_event=${last_event:-unknown}"
    fi
    if [ -z "$BEST_SESSION_ID" ] || [ "$ts" \> "$BEST_TS" ]; then
        BEST_SESSION_ID="$session_id"
        BEST_TS="$ts"
    fi
}

discover_from_active_files() {
    local mode="$1"
    local active_dir file session_id client project_dir last_event started seen_dirs
    reset_candidates
    seen_dirs=":"
    while IFS= read -r active_dir; do
        [ -n "$active_dir" ] || continue
        case "$seen_dirs" in
            *:"$active_dir":*)
                continue
                ;;
        esac
        seen_dirs="${seen_dirs}${active_dir}:"
        [ -d "$active_dir" ] || continue
        for file in "$active_dir"/*.json; do
            [ -f "$file" ] || continue
            session_id="$(json_field "$file" session_id)"
            client="$(json_field "$file" client)"
            project_dir="$(json_field "$file" project_dir)"
            last_event="$(json_field "$file" last_event)"
            started="$(json_field "$file" started)"
            consider_candidate "$mode" "$session_id" "$client" "$project_dir" "$last_event" "$started"
        done
    done <<EOF
$(active_dirs)
EOF

    [ -n "$BEST_SESSION_ID" ] || return 1
    if [ "$mode" = "any" ] && [ "$MATCH_COUNT" -ne 1 ]; then
        return 1
    fi
    printf '%s\n' "$BEST_SESSION_ID"
}

trajectory_binary() {
    if [ -n "${TRAJECTORY_BINARY:-}" ] && [ -x "$TRAJECTORY_BINARY" ]; then
        printf '%s\n' "$TRAJECTORY_BINARY"
        return 0
    fi
    if [ -x "${HOME}/.trajectory/bin/trajectory" ]; then
        printf '%s\n' "${HOME}/.trajectory/bin/trajectory"
        return 0
    fi
    command -v trajectory 2>/dev/null || return 1
}

discover_from_cli() {
    local mode="$1"
    local bin output run_dir session_id client project_dir last_event started
    command -v jq >/dev/null 2>&1 || return 1
    bin="$(trajectory_binary 2>/dev/null || true)"
    [ -n "$bin" ] || return 1
    run_dir="$(find_project_root "$PROJECT_HINT" 2>/dev/null || canonical_path "$PROJECT_HINT" 2>/dev/null || pwd)"
    output="$( (cd "$run_dir" 2>/dev/null && "$bin" mcp sessions --active --json) 2>/dev/null || true)"
    [ -n "$output" ] || return 1

    reset_candidates
    while IFS="$(printf '\t')" read -r session_id client project_dir last_event started; do
        [ -n "$session_id" ] || continue
        consider_candidate "$mode" "$session_id" "$client" "$project_dir" "$last_event" "$started"
    done < <(printf '%s\n' "$output" | jq -r '.[] | select((.active // false) == true) | [.session_id // "", .client // "", .project_dir // "", .last_event // "", .started // ""] | @tsv' 2>/dev/null || true)

    [ -n "$BEST_SESSION_ID" ] || return 1
    if [ "$mode" = "any" ] && [ "$MATCH_COUNT" -ne 1 ]; then
        return 1
    fi
    printf '%s\n' "$BEST_SESSION_ID"
}

discover_from_heartbeat() {
    local mode="$1"
    local dir file session_id client last_event
    dir="${TRAJECTORY_HOME_DIR}/telemetry/sentinels/heartbeat"
    [ -d "$dir" ] || return 1
    reset_candidates
    for file in "$dir"/*.json; do
        [ -f "$file" ] || continue
        session_id="$(json_field "$file" session_id)"
        client="$(json_field "$file" client_source)"
        last_event="$(json_field "$file" ts)"
        consider_candidate "$mode" "$session_id" "$client" "" "$last_event" "$last_event"
    done
    [ -n "$BEST_SESSION_ID" ] || return 1
    if [ "$mode" = "any" ] && [ "$MATCH_COUNT" -ne 1 ]; then
        return 1
    fi
    printf '%s\n' "$BEST_SESSION_ID"
}

discover_from_sentinel() {
    local file name session_id count best
    [ -d "$STATE_DIR" ] || return 1
    count=0
    best=""
    for file in "$STATE_DIR"/incognito-*; do
        [ -f "$file" ] || continue
        name="${file##*/}"
        session_id="${name#incognito-}"
        is_safe_session_id "$session_id" || continue
        count=$((count + 1))
        best="$session_id"
    done
    [ "$count" -eq 1 ] || return 1
    printf '%s\n' "$best"
}

active_session_summary() {
    local active_dir file session_id client project_dir last_event count seen_dirs
    count=0
    seen_dirs=":"
    while IFS= read -r active_dir; do
        [ -n "$active_dir" ] || continue
        case "$seen_dirs" in
            *:"$active_dir":*)
                continue
                ;;
        esac
        seen_dirs="${seen_dirs}${active_dir}:"
        [ -d "$active_dir" ] || continue
        for file in "$active_dir"/*.json; do
            [ -f "$file" ] || continue
            session_id="$(json_field "$file" session_id)"
            is_safe_session_id "$session_id" || continue
            client="$(json_field "$file" client)"
            project_dir="$(json_field "$file" project_dir)"
            last_event="$(json_field "$file" last_event)"
            count=$((count + 1))
            [ "$count" -le 8 ] || continue
            printf '%s%s client=%s project_dir=%s last_event=%s' "${count:+; }" "$session_id" "${client:-unknown}" "${project_dir:-unknown}" "${last_event:-unknown}"
        done
    done <<EOF
$(active_dirs)
EOF
}

resolve_session_id() {
    local id rc attempt mode source
    if id="$(session_id_from_env)"; then
        printf '%s\n' "$id"
        return 0
    else
        rc=$?
        [ "$rc" -ne 2 ] || return 2
    fi

    attempt=1
    while [ "$attempt" -le "$RESOLVE_ATTEMPTS" ]; do
        for mode in client_project client project any; do
            if id="$(discover_from_active_files "$mode")"; then
                RESOLUTION_SOURCE="active_registry:${mode}"
                printf '%s\n' "$id"
                return 0
            fi
            if id="$(discover_from_cli "$mode")"; then
                RESOLUTION_SOURCE="mcp_sessions_cli:${mode}"
                printf '%s\n' "$id"
                return 0
            fi
        done
        for mode in client any; do
            if id="$(discover_from_heartbeat "$mode")"; then
                RESOLUTION_SOURCE="heartbeat:${mode}"
                printf '%s\n' "$id"
                return 0
            fi
        done
        case "$ACTION" in
            off|disable|disabled|resume|"resume publish"|toggle)
                if id="$(discover_from_sentinel)"; then
                    RESOLUTION_SOURCE="existing_sentinel"
                    printf '%s\n' "$id"
                    return 0
                fi
                ;;
        esac
        [ "$attempt" -ge "$RESOLVE_ATTEMPTS" ] && break
        sleep "$RESOLVE_SLEEP" 2>/dev/null || sleep 1
        attempt=$((attempt + 1))
    done
    return 1
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

case "$ACTION" in
    off|disable|disabled|resume|"resume publish")
        ENABLE="false"
        ;;
    toggle)
        ENABLE="toggle"
        ;;
    ""|on|enable|enabled|private|"pause capture"|*)
        ENABLE="true"
        ;;
esac

if SESSION_ID="$(resolve_session_id)"; then
    :
else
    resolve_rc=$?
    if [ "$resolve_rc" -eq 2 ]; then
        exit 1
    fi
    SUMMARY="$(active_session_summary 2>/dev/null || true)"
    if [ -n "$SUMMARY" ]; then
        echo "Incognito mode could not be changed: no active session matched client=${CLIENT_HINT:-unknown} project_dir=${PROJECT_HINT:-unknown}. Active sessions seen: ${SUMMARY}" >&2
    else
        echo "Incognito mode could not be changed: no active session id was available after ${RESOLVE_ATTEMPTS} attempts. Set TRAJECTORY_SESSION_ID or run 'trajectory mcp sessions --active --json' from the workspace." >&2
    fi
    exit 1
fi

if ! is_safe_session_id "$SESSION_ID"; then
    echo "Incognito mode could not be changed: unsafe session id." >&2
    exit 1
fi

SENTINEL="$STATE_DIR/incognito-${SESSION_ID}"
if [ "$ENABLE" = "toggle" ]; then
    if [ -f "$SENTINEL" ]; then
        ENABLE="false"
    else
        ENABLE="true"
    fi
fi

if command -v curl >/dev/null 2>&1; then
    if curl -fsS -X POST "http://localhost:${PORT}/session/incognito?session_id=${SESSION_ID}&enable=${ENABLE}" >/dev/null 2>&1; then
        if [ "$ENABLE" = "true" ]; then
            echo "Incognito mode ENABLED -- Datadog publish suppressed for session ${SESSION_ID}; local JSONL capture continues (${RESOLUTION_SOURCE:-resolved})"
        else
            echo "Incognito mode DISABLED -- Datadog publish resumed for session ${SESSION_ID} (${RESOLUTION_SOURCE:-resolved})"
        fi
        exit 0
    fi
fi

mkdir -p "$STATE_DIR"
if [ "$ENABLE" = "true" ]; then
    printf 'incognito\n' | atomic_write_file "$SENTINEL"
    echo "Incognito mode ENABLED via local sentinel -- Datadog publish suppressed for session ${SESSION_ID}; local JSONL capture continues (${RESOLUTION_SOURCE:-resolved})"
else
    rm -f "$SENTINEL"
    echo "Incognito mode DISABLED via local sentinel -- Datadog publish resumed for session ${SESSION_ID} (${RESOLUTION_SOURCE:-resolved})"
fi
