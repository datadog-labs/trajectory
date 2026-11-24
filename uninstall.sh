#!/usr/bin/env bash
# uninstall.sh - Remove a personal Trajectory install.
set -e

TRAJECTORY_HOME="${TRAJECTORY_HOME:-${HOME}/.trajectory}"
DRY_RUN="${TRAJECTORY_DRY_RUN:-0}"
NON_INTERACTIVE=0
REMOVE_SECRETS=0
PURGE=0
UNINSTALL_CLIENTS=1
BINARY=""
PROBE_HOME=""

# What `trajectory uninstall` keeps, so that a later install does not send the
# same history to Datadog again: the records publish and backfill read before
# they send. TestScriptKeepsWhatUninstallKeeps checks that they match the
# command's list.
KEPT_HOME_ENTRIES="layout.json standard-publish.disabled"
KEPT_STATE_DATABASES="delivery-outbox.sqlite metric-publish-outbox.sqlite publish-dedup-ledger.sqlite trace-publish-outbox.sqlite operational-log-outbox.sqlite"
KEPT_STATE_ENTRIES="published-session-ends capture-off-windows.json capture-disabled-sessions"
KEPT_STATE_PREFIXES="incognito- provider-incognito- ended-incognito-"

info()  { echo "[trajectory]  $1"; }
warn()  { echo "[trajectory]  WARNING: $1" >&2; }
fail()  { echo "[trajectory]  ERROR: $1" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: bash uninstall.sh [options]

Remove Trajectory from this user account: the client integrations setup
added, the binary, and the rest of ~/.trajectory, including settings, sessions
and logs. Only the publish records that stop a later install from sending the
same history to Datadog again stay. When the installed binary has
`trajectory uninstall`, the script runs it.

Options:
  -y, --non-interactive  Do not prompt before uninstalling
      --dry-run          Show what would be removed without changing files
      --skip-clients     Leave coding-agent integrations in place
      --purge            Leave no trace: also remove the kept publish records
                         and keychain entries
      --remove-config    No effect; uninstall removes config.yaml
      --remove-data      No effect; uninstall removes sessions and logs
  -h, --help             Show this help
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        -y|--non-interactive)
            NON_INTERACTIVE=1
            shift
            ;;
        --dry-run)
            DRY_RUN=1
            shift
            ;;
        --skip-clients)
            UNINSTALL_CLIENTS=0
            shift
            ;;
        --remove-config|--remove-data)
            shift
            ;;
        --purge)
            PURGE=1
            REMOVE_SECRETS=1
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            fail "Unknown option: $1"
            ;;
    esac
done

ensure_safe_home() {
    if [ -z "${TRAJECTORY_HOME:-}" ] || [ "$TRAJECTORY_HOME" = "/" ]; then
        fail "Refusing to uninstall from unsafe TRAJECTORY_HOME=$TRAJECTORY_HOME"
    fi
    if [ -n "${HOME:-}" ] && [ "$TRAJECTORY_HOME" = "$HOME" ]; then
        fail "Refusing to uninstall from HOME. Set TRAJECTORY_HOME to the install directory."
    fi
    case "$TRAJECTORY_HOME" in
        /*) ;;
        *) fail "TRAJECTORY_HOME must be an absolute path: $TRAJECTORY_HOME" ;;
    esac

    local canonical_home canonical_parent canonical_target target_parent target_name
    canonical_home="$(cd -P "$HOME" 2>/dev/null && pwd -P)" || fail "Cannot resolve HOME safely: $HOME"
    if [ -d "$TRAJECTORY_HOME" ]; then
        canonical_target="$(cd -P "$TRAJECTORY_HOME" 2>/dev/null && pwd -P)" || fail "Cannot resolve TRAJECTORY_HOME safely: $TRAJECTORY_HOME"
    else
        target_parent="$(dirname "$TRAJECTORY_HOME")"
        target_name="$(basename "$TRAJECTORY_HOME")"
        [ -d "$target_parent" ] || fail "Cannot resolve parent of TRAJECTORY_HOME safely: $target_parent"
        canonical_parent="$(cd -P "$target_parent" 2>/dev/null && pwd -P)" || fail "Cannot resolve parent of TRAJECTORY_HOME safely: $target_parent"
        canonical_target="$canonical_parent/$target_name"
    fi
    if [ "$canonical_target" = "/" ] || [ "$canonical_target" = "$canonical_home" ]; then
        fail "Refusing to uninstall from unsafe canonical TRAJECTORY_HOME=$canonical_target"
    fi
    case "$canonical_home/" in
        "$canonical_target/"*) fail "Refusing to uninstall from a parent of HOME: $canonical_target" ;;
    esac
    TRAJECTORY_HOME="$canonical_target"
}

confirm() {
    if [ "$DRY_RUN" = "1" ]; then
        info "Dry run only. No files will be removed."
        return
    fi
    if [ "$NON_INTERACTIVE" = "1" ]; then
        return
    fi
    if [ ! -t 0 ]; then
        fail "Refusing to uninstall from a non-interactive shell without --non-interactive."
    fi

    printf '[trajectory]  Remove Trajectory from %s? [y/N] ' "$TRAJECTORY_HOME"
    read -r response
    case "$response" in
        y|Y|yes|YES) ;;
        *) info "Cancelled."; exit 0 ;;
    esac
}

# binary_answers reports whether a binary, run with the given arguments,
# succeeds. It runs against a throwaway home: a release that lacks the command
# starts up as it does for any command, and that can write in its home.
binary_answers() {
    local binary="$1"
    shift
    if [ -z "$PROBE_HOME" ]; then
        PROBE_HOME="$(mktemp -d "${TMPDIR:-/tmp}/trajectory-uninstall.XXXXXX")" || return 1
        trap 'rm -rf "$PROBE_HOME"' EXIT
    fi
    TRAJECTORY_HOME="$PROBE_HOME" TRAJECTORY_ROOT="$PROBE_HOME" TRAJECTORY_CACHE_DB="$PROBE_HOME/cache.db" \
        "$binary" "$@" >/dev/null 2>&1
}

find_trajectory_binary() {
    local candidate
    for candidate in "$TRAJECTORY_HOME/bin/trajectory" "$TRAJECTORY_HOME/bin/trajectory.exe" "$(command -v trajectory 2>/dev/null || true)"; do
        if [ -n "$candidate" ] && [ -x "$candidate" ] && binary_answers "$candidate" --version; then
            printf '%s\n' "$candidate"
            return 0
        fi
    done
    return 1
}

# `trajectory uninstall` runs on macOS and Linux, and always removes the client
# integrations.
binary_uninstalls() {
    if [ -z "$BINARY" ] || [ "$UNINSTALL_CLIENTS" != "1" ]; then
        return 1
    fi
    case "$(uname -s 2>/dev/null)" in
        Darwin|Linux) ;;
        *) return 1 ;;
    esac
    binary_answers "$BINARY" uninstall --help
}

# run_binary_uninstall removes Trajectory with `trajectory uninstall`, which
# decides what goes and what stays. That command leaves keychain entries, and
# purge-secrets reads the settings it removes. So --purge removes the keychain
# entries in between: once a dry run shows the command will go ahead, and the
# client integrations and capture are gone, so a failed run keeps its keys.
run_binary_uninstall() {
    local args=() preview
    if [ "$DRY_RUN" = "1" ]; then
        args+=(--dry-run)
    fi
    if [ "$PURGE" = "1" ]; then
        args+=(--purge)
        if [ "$DRY_RUN" != "1" ]; then
            if ! preview="$("$BINARY" uninstall --dry-run --purge)"; then
                printf '%s\n' "$preview"
                fail "Trajectory cannot be uninstalled yet, so nothing was removed. Fix what the result names and run this script again."
            fi
            if ! "$BINARY" uninstrument all --non-interactive --for-uninstall; then
                fail "Client cleanup or runtime retirement was incomplete. The Trajectory binary, files and keychain entries were preserved so cleanup can be retried. If the uninstrument_command feature flag is off, turn it on with 'trajectory config features clear uninstrument_command', or run this script without --purge."
            fi
        fi
        purge_secrets
    fi
    if ! "$BINARY" uninstall "${args[@]}"; then
        fail "trajectory uninstall did not finish. Fix what the result names and run this script again."
    fi
}

# capture_off_open reports whether capture is off in the home. The marker and
# the client fence hold that period open. Only `trajectory uninstall` records
# it before they go, so that a later install leaves out the client history
# written meanwhile.
capture_off_open() {
    local path
    for path in "$TRAJECTORY_HOME/capture.disabled" "$TRAJECTORY_HOME/state/legacy-client-capture-fence.json"; do
        if [ -e "$path" ] || [ -L "$path" ]; then
            return 0
        fi
    done
    return 1
}

legacy_live_serve_present() {
    local status pid
    for status in "$TRAJECTORY_HOME"/state/health/serve-*.json "$TRAJECTORY_HOME"/state/health.json; do
        [ -e "$status" ] || [ -L "$status" ] || continue
        if [ -L "$status" ] || [ ! -f "$status" ]; then
            return 0
        fi
        if ! pid="$(sed -n 's/.*"pid"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' "$status" | head -n 1)"; then
            return 0
        fi
        if [ -z "$pid" ]; then
            return 0
        fi
        if [ -n "$pid" ] && ps -p "$pid" >/dev/null 2>&1; then
            return 0
        fi
    done
    return 1
}

# Without a binary that runs, nothing runs Trajectory's hooks, so the
# integrations can stay, unless a serve process may still be live.
uninstall_clients() {
    local binary="$BINARY" client failed

    if [ -z "$binary" ]; then
        if legacy_live_serve_present; then
            fail "No working Trajectory binary was found to stop a live Trajectory serve process. Stop it first; the files were preserved."
        fi
        warn "No working Trajectory binary was found, so coding-agent integrations stay in place. To remove them, install Trajectory again and run 'trajectory uninstall'."
        return
    fi

    if [ "$DRY_RUN" = "1" ]; then
        if [ "$UNINSTALL_CLIENTS" = "1" ]; then
            info "Would run: $binary uninstrument all --non-interactive --for-uninstall"
        else
            info "Would run: $binary uninstrument --non-interactive --for-uninstall --runtime-only"
        fi
        return
    fi
    if binary_answers "$binary" uninstrument --help; then
        if [ "$UNINSTALL_CLIENTS" = "1" ]; then
            if ! "$binary" uninstrument all --non-interactive --for-uninstall; then
                fail "Client cleanup or runtime retirement was incomplete. The Trajectory binary was preserved so cleanup can be retried."
            fi
        elif ! "$binary" uninstrument --non-interactive --for-uninstall --runtime-only; then
            fail "Runtime retirement was incomplete. The Trajectory binary was preserved so cleanup can be retried."
        fi
        return
    fi

    warn "Installed Trajectory predates the uninstrument command; using its compatible per-client cleanup API."
    if legacy_live_serve_present; then
        fail "A live Trajectory serve process cannot be safely retired by this older binary. Stop it first; the binary and files were preserved."
    fi
    if [ "$UNINSTALL_CLIENTS" != "1" ]; then
        info "Skipping client integration cleanup after verifying no legacy serve process is live."
        return
    fi
    failed=0
    for client in cc cline cursor gemini agy goose codex copilot droid hermes openhands aider continue codebuff amp pi omp opencode kilo kiro qwen mistral-vibe grok devin qoder kimi warp vscode-copilot windsurf zed gptme codewhale forgecode commandcode claude-desktop; do
        if ! "$binary" setup --uninstall "$client" --non-interactive; then
            warn "Could not fully remove $client instrumentation."
            failed=1
        fi
    done
    if [ "$failed" = "1" ]; then
        fail "Client cleanup was incomplete through the legacy API. The Trajectory binary was preserved so cleanup can be retried."
    fi
}

purge_secrets() {
    local binary="$BINARY"

    if [ "$REMOVE_SECRETS" != "1" ]; then
        return
    fi
    if [ -z "$binary" ]; then
        warn "No working Trajectory binary was found, so Trajectory's OS-keychain entries stay. To remove them, install Trajectory again and run this script with --purge."
        return
    fi
    if [ "$DRY_RUN" = "1" ]; then
        info "Would run: $binary config purge-secrets --yes"
        return
    fi
    if ! "$binary" config purge-secrets --yes; then
        fail "OS-keychain cleanup was incomplete. The Trajectory binary and files were preserved so cleanup can be retried."
    fi
}

remove_path() {
    local path="$1"
    if [ ! -e "$path" ] && [ ! -L "$path" ]; then
        return
    fi
    if [ "$DRY_RUN" = "1" ]; then
        info "Would remove $path"
        return
    fi
    rm -rf "$path"
    info "Removed $path"
}

remove_empty_dir() {
    local path="$1"
    if [ "$DRY_RUN" = "1" ]; then
        return
    fi
    if [ -d "$path" ]; then
        rmdir "$path" 2>/dev/null || true
    fi
}

kept_home_entry() {
    local kept
    for kept in $KEPT_HOME_ENTRIES; do
        if [ "$1" = "$kept" ]; then
            return 0
        fi
    done
    return 1
}

# A kept database keeps its journal files, which hold rows that may not be in
# it yet. A folder named like an incognito record is not one.
kept_state_entry() {
    local name="$1" path="$2" kept
    for kept in $KEPT_STATE_DATABASES; do
        case "$name" in
            "$kept"|"$kept-wal"|"$kept-shm"|"$kept-journal") return 0 ;;
        esac
    done
    for kept in $KEPT_STATE_ENTRIES; do
        if [ "$name" = "$kept" ]; then
            return 0
        fi
    done
    if [ -d "$path" ] && [ ! -L "$path" ]; then
        return 1
    fi
    for kept in $KEPT_STATE_PREFIXES; do
        case "$name" in
            "$kept"*) return 0 ;;
        esac
    done
    return 1
}

remove_state() {
    local state="$1" entry
    for entry in "$state"/* "$state"/.[!.]* "$state"/..?*; do
        [ -e "$entry" ] || [ -L "$entry" ] || continue
        if kept_state_entry "${entry##*/}" "$entry"; then
            # An empty kept folder holds no record.
            remove_empty_dir "$entry"
            if [ -e "$entry" ] || [ -L "$entry" ]; then
                info "Keeping $entry"
            fi
            continue
        fi
        remove_path "$entry"
    done
    remove_empty_dir "$state"
}

remove_installed_files() {
    local entry name
    if [ "$PURGE" = "1" ]; then
        remove_path "$TRAJECTORY_HOME"
        return
    fi
    for entry in "$TRAJECTORY_HOME"/* "$TRAJECTORY_HOME"/.[!.]* "$TRAJECTORY_HOME"/..?*; do
        [ -e "$entry" ] || [ -L "$entry" ] || continue
        name="${entry##*/}"
        # A state/ that is a link stays whole: removing the link would hide
        # the kept files from a new install, and what it points at is not
        # the home's to remove.
        if kept_home_entry "$name" || { [ "$name" = "state" ] && [ -L "$entry" ]; }; then
            info "Keeping $entry"
        elif [ "$name" = "state" ] && [ -d "$entry" ]; then
            remove_state "$entry"
        else
            remove_path "$entry"
        fi
    done
    remove_empty_dir "$TRAJECTORY_HOME"
}

ensure_safe_home

info ""
info "=== Trajectory Uninstaller ==="
info "Install directory: $TRAJECTORY_HOME"
info ""

confirm
BINARY="$(find_trajectory_binary)" || BINARY=""
if binary_uninstalls; then
    run_binary_uninstall
else
    if [ "$PURGE" != "1" ] && capture_off_open; then
        fail "Capture is off, and only \`trajectory uninstall\` can record that period so that a later install does not send what was written meanwhile. Run this script with a current Trajectory binary and without --skip-clients, or add --purge. Nothing was removed."
    fi
    uninstall_clients
    purge_secrets
    remove_installed_files
fi

info ""
info "Trajectory uninstall complete."
