#!/usr/bin/env bash
# Unless explicitly stated otherwise all files in this repository are licensed under the Apache-2.0 License.
# This product includes software developed at Datadog (https://www.datadoghq.com/) Copyright 2026 Datadog, Inc.

# install.sh - Download and install Trajectory (agent observability for AI coding assistants).
#
# Usage:
#   bash install.sh                           # interactive
#   bash install.sh --site datadoghq.com --ml-app my-agents --api-key $KEY \
#                   --clients cc --non-interactive
#
# Setup flags (--site, --ml-app, --api-key, --clients, --non-interactive) are
# passed through to `trajectory setup`. Run `trajectory setup --help` for the
# full flag reference.
#
# Env vars:
#   TRAJECTORY_SKIP_DOWNLOAD=1   Skip the binary download step (use existing
#                                binary at $HOME/.trajectory/bin/trajectory).
#                                Useful in CI when the binary is pre-staged.
#                                Auto-enabled when --non-interactive is passed
#                                and the binary is already present.
#
# Optional: set GH_TOKEN or GITHUB_TOKEN for higher GitHub API rate limits.
# Public installs require only curl and python3.
set -e

INSTALL_DIR="$HOME/.trajectory"
BIN_DIR="$INSTALL_DIR/bin"
# BINARY and BINARY_SUFFIX are finalised after detect_platform() runs - they
# become trajectory.exe on Windows (Git Bash / MSYS / Cygwin) and trajectory
# on darwin/linux.
BINARY="$BIN_DIR/trajectory"
BINARY_SUFFIX=""
REPO="datadog-labs/trajectory"

info()  { echo "[trajectory]  $1"; }
warn()  { echo "[trajectory]  WARNING: $1" >&2; }
fail()  { echo "[trajectory]  ERROR: $1" >&2; exit 1; }

# Collect args that pass through to `trajectory setup`. Recognized flags:
# --site, --ml-app, --api-key, --clients (all take a value), --non-interactive,
# --add-to-path. Unknown args are forwarded so setup can validate them.
SETUP_ARGS=()
NON_INTERACTIVE=0
while [ "$#" -gt 0 ]; do
    case "$1" in
        --non-interactive)
            NON_INTERACTIVE=1
            SETUP_ARGS+=("$1")
            shift
            ;;
        --add-to-path)
            # Reserved for parity with the legacy install-trajectory.sh flag.
            # The setup command writes PATH on its own; we just accept and skip.
            shift
            ;;
        --site|--ml-app|--api-key|--clients)
            if [ "$#" -lt 2 ]; then
                fail "$1 requires a value"
            fi
            SETUP_ARGS+=("$1" "$2")
            shift 2
            ;;
        --site=*|--ml-app=*|--api-key=*|--clients=*)
            SETUP_ARGS+=("$1")
            shift
            ;;
        *)
            SETUP_ARGS+=("$1")
            shift
            ;;
    esac
done

cleanup() {
    if [ -n "${_PARTIAL_INSTALL:-}" ] && [ -f "$BINARY" ]; then
        rm -f "$BINARY"
        info "Cleaned up partial install."
    fi
}
trap cleanup EXIT

detect_platform() {
    local os arch
    os="$(uname -s | tr '[:upper:]' '[:lower:]')"
    arch="$(uname -m)"
    case "$os" in
        darwin) ;;
        linux)  ;;
        mingw*|msys*|cygwin*)
            # Git Bash, MSYS2, Cygwin all run on Windows and emit uname output
            # like "mingw64_nt-10.0-26100" or "msys_nt-10.0" or "cygwin_nt-10.0".
            # Map them all to the windows binary which ships with a .exe suffix.
            os="windows"
            ;;
        *)      fail "Unsupported OS: $os (only darwin, linux, and windows are supported)" ;;
    esac
    case "$arch" in
        x86_64)         arch="amd64" ;;
        aarch64|arm64)  arch="arm64" ;;
        *)              fail "Unsupported architecture: $arch" ;;
    esac
    echo "${os}-${arch}"
}

# Resolve an optional GitHub token for authenticated API/download requests.
resolve_github_token() {
    if [ -n "${GH_TOKEN:-}" ]; then echo "$GH_TOKEN"; return; fi
    if [ -n "${GITHUB_TOKEN:-}" ]; then echo "$GITHUB_TOKEN"; return; fi
    return 1
}

curl_github_api() {
    local url="$1"
    local token
    if token=$(resolve_github_token 2>/dev/null) && [ -n "$token" ]; then
        curl -sfL \
            -H "Authorization: Bearer $token" \
            -H "Accept: application/vnd.github+json" \
            "$url"
    else
        curl -sfL \
            -H "Accept: application/vnd.github+json" \
            "$url"
    fi
}

# Resolve the tag of the newest release (includes pre-releases).
resolve_release_tag() {
    local tag
    tag=$(curl -sfL \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/$REPO/releases?per_page=1" \
        | python3 -c "import sys,json; r=json.load(sys.stdin); print(r[0]['tag_name'] if r else '')" 2>/dev/null) || true
    if [ -n "$tag" ]; then echo "$tag"; return 0; fi

    tag=$(curl_github_api "https://api.github.com/repos/$REPO/releases?per_page=1" \
        | python3 -c "import sys,json; r=json.load(sys.stdin); print(r[0]['tag_name'] if r else '')" 2>/dev/null) || true
    if [ -n "$tag" ]; then echo "$tag"; return 0; fi

    return 1
}

# Download release asset by explicit tag using curl.
download_binary() {
    local tag="$1" asset="$2" dest="$3"

    info "      Downloading via public GitHub release URL..."
    if curl -fSL --progress-bar \
        -o "$dest" "https://github.com/$REPO/releases/download/$tag/$asset"; then
        return 0
    fi

    # Optional authenticated API fallback for environments that require API asset URLs.
    local token
    if token=$(resolve_github_token 2>/dev/null) && [ -n "$token" ]; then
        info "      Downloading via GitHub API (token auth)..."
        local api_asset_url
        api_asset_url=$(curl_github_api "https://api.github.com/repos/$REPO/releases/tags/$tag" \
            | python3 -c "import sys,json; assets=json.load(sys.stdin).get('assets',[]); [print(a['url']) for a in assets if a['name']=='$asset']" 2>/dev/null \
            | head -1) || true

        if [ -n "$api_asset_url" ]; then
            if curl -fSL --progress-bar \
                -H "Authorization: Bearer $token" \
                -H "Accept: application/octet-stream" \
                -o "$dest" "$api_asset_url"; then
                return 0
            fi
        fi
    fi

    fail "Download failed. Check the release tag, asset name, network connection, or optional GH_TOKEN/GITHUB_TOKEN for authenticated GitHub requests."
}

write_selfupdate_policy() {
    cat > "$INSTALL_DIR/selfupdate.conf" <<EOF
TRAJECTORY_INSTALL_OWNER=datadog-labs
TRAJECTORY_SELF_UPDATE=disabled
TRAJECTORY_SELF_UPDATE_URL=https://raw.githubusercontent.com/datadog-labs/trajectory/main/RELEASES.json
EOF
}

info ""
info "=== Trajectory Installer ==="
info ""

PLATFORM="$(detect_platform)"
case "$PLATFORM" in
    windows-*) BINARY_SUFFIX=".exe" ;;
    *)         BINARY_SUFFIX="" ;;
esac
BINARY="${BIN_DIR}/trajectory${BINARY_SUFFIX}"
ASSET="trajectory-${PLATFORM}${BINARY_SUFFIX}"
info "[1/5] Detected platform: $PLATFORM"

mkdir -p "$BIN_DIR"

# Skip the download step when the binary is already in place. The CI e2e
# harness pre-stages the freshly built artifact at $BINARY; downloading the
# latest GH Release on top would test the wrong artifact. Honour an explicit
# opt-in env var or auto-detect a usable binary in non-interactive mode.
SKIP_DOWNLOAD=0
if [ "${TRAJECTORY_SKIP_DOWNLOAD:-0}" = "1" ]; then
    SKIP_DOWNLOAD=1
elif [ "$NON_INTERACTIVE" = "1" ] && [ -x "$BINARY" ]; then
    SKIP_DOWNLOAD=1
fi

if [ "$SKIP_DOWNLOAD" = "1" ]; then
    info "[2/5] Skipping download - using existing binary at $BINARY"
    info "[3/5] Codesign skipped (binary pre-staged)"
else
    info "[2/5] Resolving latest release..."

    RELEASE_TAG="$(resolve_release_tag)" || fail "Could not find any release on $REPO. Check network access or optional GH_TOKEN/GITHUB_TOKEN for authenticated GitHub requests."
    info "      Release: $RELEASE_TAG"

    _PARTIAL_INSTALL=1

    if ! download_binary "$RELEASE_TAG" "$ASSET" "$BINARY"; then
        fail "Download failed. Check your network connection and that a release exists for $PLATFORM."
    fi

    chmod +x "$BINARY"

    if [ "$(uname -s)" = "Darwin" ] && command -v codesign >/dev/null 2>&1; then
        info "[3/5] Codesigning binary (macOS)..."
        codesign -f -s - "$BINARY"
    else
        info "[3/5] Codesign skipped (not macOS or codesign not available)"
    fi

    _PARTIAL_INSTALL=""
fi

write_selfupdate_policy

if [ "$NON_INTERACTIVE" = "1" ]; then
    info "[4/5] Running setup (non-interactive)..."
else
    info "[4/5] Running setup wizard..."
    info ""
    info "      The setup wizard will ask for:"
    info "        - Datadog site (e.g., datadoghq.com, us5.datadoghq.com)"
    info "        - Datadog API key"
    info "        - Service name for your traces"
    info "        - Which AI coding agents to instrument"
    info ""
fi

"$BINARY" setup "${SETUP_ARGS[@]+"${SETUP_ARGS[@]}"}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLUGIN_INSTALLED=0

# Claude Code plugin
CC_PLUGIN_DIR="$SCRIPT_DIR/plugin/trajectory"
if command -v claude >/dev/null 2>&1; then
    if [ -d "$CC_PLUGIN_DIR" ]; then
        info "[5/5] Installing Claude Code plugin..."
        claude plugin marketplace add "$SCRIPT_DIR" 2>/dev/null && claude plugin install trajectory@trajectory --scope user || {
            warn "Claude Code plugin install failed. Install manually:"
            warn "  claude plugin marketplace add /path/to/trajectory && claude plugin install trajectory@trajectory --scope user"
        }
        PLUGIN_INSTALLED=1
    fi
else
    info "[5/5] Claude Code CLI not detected - skipping Claude Code plugin."
fi

# Codex plugin (marketplace-based)
if command -v codex >/dev/null 2>&1; then
    CODEX_MARKETPLACE_DIR="$INSTALL_DIR/codex-marketplace"
    if [ -d "$CODEX_MARKETPLACE_DIR/.agents" ]; then
        info "      Installing Codex marketplace plugin..."
        codex plugin marketplace add "$CODEX_MARKETPLACE_DIR" || {
            warn "Codex marketplace install failed. Install manually:"
            warn "  ~/.trajectory/bin/trajectory setup --clients codex"
        }
        PLUGIN_INSTALLED=1
    else
        info "      Codex CLI detected, but Codex setup was not selected - skipping Codex plugin."
        info "      To install later: ~/.trajectory/bin/trajectory setup --clients codex"
        PLUGIN_INSTALLED=1
    fi
else
    info "      Codex CLI not detected - skipping Codex plugin."
fi

# Gemini CLI extension
if command -v gemini >/dev/null 2>&1; then
    info "      Installing Gemini CLI extension..."
    yes | gemini extensions install "$SCRIPT_DIR" --consent --skip-settings || {
        warn "Gemini extension install failed. Install manually:"
            warn "  gemini extensions install datadog-labs/trajectory"
    }
    PLUGIN_INSTALLED=1
else
    info "      Gemini CLI not detected - skipping Gemini extension."
fi

# Cursor configuration (handled by setup wizard)
if command -v cursor >/dev/null 2>&1 || command -v cursor-agent >/dev/null 2>&1; then
    info "      Cursor detected - configuration is handled by the setup wizard."
    info "      To re-run Cursor setup later: ~/.trajectory/bin/trajectory setup --clients cursor"
    PLUGIN_INSTALLED=1
else
    info "      Cursor CLI not detected - skipping Cursor configuration guidance."
fi

# OpenCode plugin
OPENCODE_PLUGIN_DIR="$SCRIPT_DIR/plugin/trajectory-opencode"
if command -v opencode >/dev/null 2>&1; then
    if [ -d "$OPENCODE_PLUGIN_DIR" ]; then
        info "      Installing OpenCode plugin..."
        opencode plugin "$OPENCODE_PLUGIN_DIR" || {
            warn "OpenCode plugin install failed. Install manually:"
            warn "  opencode plugin /path/to/trajectory/plugin/trajectory-opencode"
            warn "  or run: ~/.trajectory/bin/trajectory setup --clients opencode"
        }
    else
        warn "OpenCode CLI detected, but local plugin directory not found: $OPENCODE_PLUGIN_DIR"
        warn "Run OpenCode setup later: ~/.trajectory/bin/trajectory setup --clients opencode"
    fi
    PLUGIN_INSTALLED=1
else
    info "      OpenCode CLI not detected - skipping OpenCode plugin."
fi

# Pi extension
PI_PLUGIN_DIR="$SCRIPT_DIR/plugin/trajectory-pi"
if command -v pi >/dev/null 2>&1; then
    if [ -d "$PI_PLUGIN_DIR" ]; then
        info "      Installing Pi extension..."
        pi install "$PI_PLUGIN_DIR" || {
            warn "Pi extension install failed. Install manually:"
            warn "  pi install /path/to/trajectory/plugin/trajectory-pi"
            warn "  or run: ~/.trajectory/bin/trajectory setup --clients pi"
        }
    else
        warn "Pi CLI detected, but local plugin directory not found: $PI_PLUGIN_DIR"
        warn "Run Pi setup later: ~/.trajectory/bin/trajectory setup --clients pi"
    fi
    PLUGIN_INSTALLED=1
else
    info "      Pi CLI not detected - skipping Pi plugin."
fi

if [ "$PLUGIN_INSTALLED" = "0" ]; then
    info ""
    info "  No coding assistant CLIs detected. Install plugins later:"
    info "    Claude Code: claude plugin marketplace add https://github.com/datadog-labs/trajectory.git && claude plugin install trajectory@trajectory --scope user"
    info "    Codex:       ~/.trajectory/bin/trajectory setup --clients codex"
    info "    Gemini:      gemini extensions install datadog-labs/trajectory"
    info "    Cursor:      ~/.trajectory/bin/trajectory setup --clients cursor"
    info "    OpenCode:    ~/.trajectory/bin/trajectory setup --clients opencode"
    info "    Pi:          ~/.trajectory/bin/trajectory setup --clients pi"
fi

info ""
info "========================================="
info "Trajectory installed successfully!"
info ""
info "  Binary:  $BINARY"
info "  Config:  $INSTALL_DIR/config.yaml"
info "  Traces:  $INSTALL_DIR/trajectories/"
info ""
info "  To start the capture server:"
info "    $BINARY serve"
info ""
info "  To check status:"
info "    $BINARY doctor"
info ""
info "  To uninstall, remove the install directory:"
info "    $INSTALL_DIR"
info "========================================="
