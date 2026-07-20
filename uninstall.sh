#!/usr/bin/env bash
# uninstall.sh - Remove a personal Trajectory install.
set -e

TRAJECTORY_HOME="${TRAJECTORY_HOME:-${HOME}/.trajectory}"
DRY_RUN="${TRAJECTORY_DRY_RUN:-0}"
NON_INTERACTIVE=0
REMOVE_CONFIG=0
REMOVE_DATA=0
REMOVE_SECRETS=0
PURGE=0
UNINSTALL_CLIENTS=1

info()  { echo "[trajectory]  $1"; }
warn()  { echo "[trajectory]  WARNING: $1" >&2; }
fail()  { echo "[trajectory]  ERROR: $1" >&2; exit 1; }

usage() {
    cat <<'EOF'
Usage: bash uninstall.sh [options]

Remove the Trajectory binary, installed helper assets, and setup-managed client
integrations. User config and captured session data are preserved by default.

Options:
  -y, --non-interactive  Do not prompt before uninstalling
      --dry-run          Show what would be removed without changing files
      --skip-clients     Leave coding-agent integrations in place
      --remove-config    Also remove ~/.trajectory/config.yaml
      --remove-data      Also remove ~/.trajectory/trajectories/ and logs
      --purge            Leave no trace: remove all Trajectory files and keychain entries
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
        --remove-config)
            REMOVE_CONFIG=1
            shift
            ;;
        --remove-data)
            REMOVE_DATA=1
            shift
            ;;
        --purge)
            PURGE=1
            REMOVE_CONFIG=1
            REMOVE_DATA=1
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

    printf '[trajectory]  Remove Trajectory runtime files from %s? [y/N] ' "$TRAJECTORY_HOME"
    read -r response
    case "$response" in
        y|Y|yes|YES) ;;
        *) info "Cancelled."; exit 0 ;;
    esac
}

find_trajectory_binary() {
    if [ -x "$TRAJECTORY_HOME/bin/trajectory" ]; then
        printf '%s\n' "$TRAJECTORY_HOME/bin/trajectory"
        return 0
    fi
    if [ -x "$TRAJECTORY_HOME/bin/trajectory.exe" ]; then
        printf '%s\n' "$TRAJECTORY_HOME/bin/trajectory.exe"
        return 0
    fi
    if command -v trajectory >/dev/null 2>&1; then
        command -v trajectory
        return 0
    fi
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

uninstall_clients() {
    local binary client failed

    if ! binary="$(find_trajectory_binary 2>/dev/null)"; then
        fail "Trajectory binary not found; cannot fence capture or verify cleanup. Restore the binary before uninstalling."
    fi

    if [ "$DRY_RUN" = "1" ]; then
        if [ "$UNINSTALL_CLIENTS" = "1" ]; then
            info "Would run: $binary uninstrument all --non-interactive --for-uninstall"
        else
            info "Would run: $binary uninstrument --non-interactive --for-uninstall --runtime-only"
        fi
        return
    fi
    if "$binary" uninstrument --help >/dev/null 2>&1; then
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
    local binary

    if [ "$REMOVE_SECRETS" != "1" ]; then
        return
    fi
    if ! binary="$(find_trajectory_binary 2>/dev/null)"; then
        fail "Trajectory binary not found; cannot purge OS-keychain entries. Restore the binary and retry."
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

remove_installed_files() {
    if [ "$PURGE" = "1" ]; then
        remove_path "$TRAJECTORY_HOME"
        return
    fi

    remove_path "$TRAJECTORY_HOME/bin/trajectory"
    remove_path "$TRAJECTORY_HOME/bin/trajectory.exe"
    remove_empty_dir "$TRAJECTORY_HOME/bin"

    remove_path "$TRAJECTORY_HOME/intercepts"
    remove_path "$TRAJECTORY_HOME/claude-marketplace"
    remove_path "$TRAJECTORY_HOME/codex-marketplace"
    remove_path "$TRAJECTORY_HOME/copilot-marketplace"
    remove_path "$TRAJECTORY_HOME/factory-marketplace"
    remove_path "$TRAJECTORY_HOME/state"
    remove_path "$TRAJECTORY_HOME/.state"
    remove_path "$TRAJECTORY_HOME/capture.disabled"
    remove_path "$TRAJECTORY_HOME/selfupdate.conf"
    remove_path "$TRAJECTORY_HOME/uninstall.sh"

    if [ "$REMOVE_CONFIG" = "1" ]; then
        remove_path "$TRAJECTORY_HOME/config.yaml"
    else
        info "Preserving $TRAJECTORY_HOME/config.yaml"
    fi

    if [ "$REMOVE_DATA" = "1" ]; then
        remove_path "$TRAJECTORY_HOME/trajectories"
        remove_path "$TRAJECTORY_HOME/logs"
        remove_path "$TRAJECTORY_HOME/live-sessions"
    else
        info "Preserving $TRAJECTORY_HOME/trajectories/"
        info "Preserving $TRAJECTORY_HOME/logs/"
    fi

    remove_empty_dir "$TRAJECTORY_HOME"
}

ensure_safe_home

info ""
info "=== Trajectory Uninstaller ==="
info "Install directory: $TRAJECTORY_HOME"
info ""

confirm
uninstall_clients
purge_secrets
remove_installed_files

info ""
info "Trajectory uninstall complete."
