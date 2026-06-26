#!/usr/bin/env bash
# uninstall.sh - Remove a personal Trajectory install.
set -e

TRAJECTORY_HOME="${TRAJECTORY_HOME:-${HOME}/.trajectory}"
DRY_RUN="${TRAJECTORY_DRY_RUN:-0}"
NON_INTERACTIVE=0
REMOVE_CONFIG=0
REMOVE_DATA=0
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
      --skip-clients     Do not run trajectory setup --uninstall for clients
      --remove-config    Also remove ~/.trajectory/config.yaml
      --remove-data      Also remove ~/.trajectory/trajectories/ and logs
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

uninstall_clients() {
    local binary client

    if [ "$UNINSTALL_CLIENTS" != "1" ]; then
        info "Skipping client integration cleanup."
        return
    fi

    if ! binary="$(find_trajectory_binary 2>/dev/null)"; then
        warn "Trajectory binary not found; skipping setup-managed client cleanup."
        return
    fi

    for client in cc codex copilot cursor droid gemini agy pi opencode; do
        if [ "$DRY_RUN" = "1" ]; then
            info "Would run: $binary setup --uninstall $client --non-interactive"
            continue
        fi
        if "$binary" setup --uninstall "$client" --non-interactive >/dev/null 2>&1; then
            info "Removed $client integration."
        else
            warn "Could not remove $client integration; continuing."
        fi
    done
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
remove_installed_files

info ""
info "Trajectory uninstall complete."
