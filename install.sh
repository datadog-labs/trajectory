#!/usr/bin/env bash
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
# Public installs require only curl.
set -e

INSTALL_DIR="$HOME/.trajectory"
BIN_DIR="$INSTALL_DIR/bin"
INTERCEPT_DIR="$INSTALL_DIR/intercepts"
# BINARY and BINARY_SUFFIX are finalised after detect_platform() runs - they
# become trajectory.exe on Windows (Git Bash / MSYS / Cygwin) and trajectory
# on darwin/linux.
BINARY="$BIN_DIR/trajectory"
BINARY_SUFFIX=""
REPO="datadog-labs/trajectory"

info()  { echo "[trajectory]  $1"; }
warn()  { echo "[trajectory]  WARNING: $1" >&2; }
fail()  { echo "[trajectory]  ERROR: $1" >&2; exit 1; }

# Collect args that pass through to `trajectory setup`. Recognized setup flags:
# --site, --ml-app, --api-key, --clients (all take a value),
# --install-client-shims, --no-client-shims, and --non-interactive.
# The legacy install-only --add-to-path flag is accepted as a no-op for older
# scripts. install.sh and `trajectory setup` do not edit shell rc files.
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
            # Reserved for parity with the older install-trajectory.sh flag.
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

codex_marketplace_add() {
    local output status marketplace_dir
    marketplace_dir="$1"
    if output=$(codex plugin marketplace add "$marketplace_dir" 2>&1); then
        if [ -n "$output" ]; then printf '%s\n' "$output"; fi
        return 0
    fi
    status=$?
    case "$output" in
        *"unexpected argument"*"marketplace"*|*"unrecognized subcommand"*"marketplace"*|*"unknown command"*"marketplace"*|*"invalid command"*"marketplace"*)
            warn "Codex CLI does not support plugin marketplace; MCP-only setup was handled by trajectory setup. Upgrade Codex to enable live plugin hooks."
            return 0
            ;;
    esac
    if [ -n "$output" ]; then printf '%s\n' "$output" >&2; fi
    return "$status"
}

copilot_plugin_command() {
    local output status prompt
    if output=$(copilot "$@" 2>&1); then
        if [ -n "$output" ]; then printf '%s\n' "$output"; fi
        return 0
    fi
    status=$?
    if [ -n "$output" ]; then printf '%s\n' "$output" >&2; fi
    case "$output" in
        *"Invalid command format"*|*"Did you mean: copilot -p"*|*"use the -p"*|*"unexpected argument"*)
            prompt="$*"
            copilot -p "$prompt"
            return $?
            ;;
    esac
    return "$status"
}

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

# Download the latest stable public release without using the rate-limited API.
download_latest_binary() {
    local asset="$1" dest="$2" url attempt
    url="https://github.com/$REPO/releases/latest/download/$asset"

    for attempt in 1 2 3; do
        if curl -fL --connect-timeout 15 --max-time 600 --progress-bar \
            -o "$dest" "$url"; then
            return 0
        fi

        rm -f "$dest"
        if [ "$attempt" -lt 3 ]; then
            warn "Download attempt $attempt of 3 failed; retrying in 1 second..."
            sleep 1
        fi
    done

    fail "Could not download $asset from the latest public GitHub release after 3 attempts. Check https://github.com/$REPO/releases/latest and your network connection."
}

install_intercept_assets() {
    local asset src dest tmp
    mkdir -p "$INTERCEPT_DIR"

    for asset in intercept-shared.mjs bun-llm-intercept.mjs node-llm-spy.cjs; do
        src="$SCRIPT_DIR/intercepts/$asset"
        dest="$INTERCEPT_DIR/$asset"
        if [ -f "$src" ]; then
            cp "$src" "$dest"
        else
            tmp="${dest}.tmp.$$"
            if ! curl -sfL -o "$tmp" "https://raw.githubusercontent.com/$REPO/main/intercepts/$asset"; then
                rm -f "$tmp"
                fail "Could not install Claude intercept asset: $asset"
            fi
            mv "$tmp" "$dest"
        fi
        chmod 0644 "$dest" 2>/dev/null || true
    done
}

install_uninstaller() {
    local src dest tmp
    src="$SCRIPT_DIR/uninstall.sh"
    dest="$INSTALL_DIR/uninstall.sh"

    if [ -f "$src" ]; then
        cp "$src" "$dest"
    else
        tmp="${dest}.tmp.$$"
        if ! curl -sfL -o "$tmp" "https://raw.githubusercontent.com/$REPO/main/uninstall.sh"; then
            rm -f "$tmp"
            warn "Could not install uninstall helper. You can remove $INSTALL_DIR manually if needed."
            return 0
        fi
        mv "$tmp" "$dest"
    fi
    chmod +x "$dest" 2>/dev/null || true
}

write_install_metadata() {
    local metadata="$INSTALL_DIR/selfupdate.conf"
    mkdir -p "$INSTALL_DIR"

    if ! cat > "$metadata" <<EOF
# Installer metadata
TRAJECTORY_INSTALL_OWNER=datadog-labs
TRAJECTORY_SELF_UPDATE=enabled
TRAJECTORY_SELF_UPDATE_REPO=$REPO
EOF
    then
        warn "Could not write install metadata to $metadata"
        return 0
    fi
    chmod 0644 "$metadata" 2>/dev/null || true
}

info ""
info "=== Trajectory Installer ==="
info ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

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
    info "[2/5] Downloading latest release..."

    _PARTIAL_INSTALL=1
    download_latest_binary "$ASSET" "$BINARY"

    chmod +x "$BINARY"

    if [ "$(uname -s)" = "Darwin" ] && command -v codesign >/dev/null 2>&1; then
        info "[3/5] Codesigning binary (macOS)..."
        codesign -f -s - "$BINARY"
    else
        info "[3/5] Codesign skipped (not macOS or codesign not available)"
    fi

    _PARTIAL_INSTALL=""
fi

install_intercept_assets
install_uninstaller
write_install_metadata

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

PLUGIN_INSTALLED=0

# Claude Code plugin
CC_PLUGIN_DIR="$SCRIPT_DIR/plugin/trajectory"
if command -v claude >/dev/null 2>&1; then
    if [ -d "$CC_PLUGIN_DIR" ]; then
        info "[5/5] Installing Claude Code plugin..."
        claude plugin marketplace add "$SCRIPT_DIR" 2>/dev/null
        if claude plugin list 2>/dev/null | grep -qE "trajectory@trajectory"; then
            info "      Plugin already installed - running update..."
            claude plugin update trajectory@trajectory --scope user || {
                warn "Claude Code plugin update failed. Update manually:"
                warn "  claude plugin update trajectory@trajectory --scope user"
            }
        else
            claude plugin install trajectory@trajectory --scope user || {
                warn "Claude Code plugin install failed. Install manually:"
                warn "  claude plugin marketplace add /path/to/trajectory && claude plugin install trajectory@trajectory --scope user"
            }
        fi
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
        codex_marketplace_add "$CODEX_MARKETPLACE_DIR" || {
            warn "Codex marketplace install failed. Install manually:"
            warn "  ~/.trajectory/bin/trajectory setup --clients codex"
        }
        PLUGIN_INSTALLED=1
    else
        info "      Codex CLI detected, but Codex setup was not selected - skipping Codex plugin."
        info "      To refresh client wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients codex"
        PLUGIN_INSTALLED=1
    fi
else
    info "      Codex CLI not detected - skipping Codex plugin."
fi

# GitHub Copilot CLI plugin (marketplace-based, beta)
if command -v copilot >/dev/null 2>&1; then
    COPILOT_MARKETPLACE_DIR="$INSTALL_DIR/copilot-marketplace"
    if [ -d "$COPILOT_MARKETPLACE_DIR/.github/plugin" ]; then
        info "      Installing GitHub Copilot CLI plugin (beta)..."
        copilot_plugin_command plugin marketplace add "$COPILOT_MARKETPLACE_DIR" && copilot_plugin_command plugin install trajectory@trajectory || {
            warn "GitHub Copilot CLI plugin install failed. Install manually:"
            warn "  ~/.trajectory/bin/trajectory setup --clients copilot"
        }
        PLUGIN_INSTALLED=1
    else
        info "      GitHub Copilot CLI detected, but Copilot setup was not selected - skipping Copilot plugin."
        info "      To refresh client wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients copilot"
        PLUGIN_INSTALLED=1
    fi
else
    info "      GitHub Copilot CLI not detected - skipping Copilot plugin."
fi

# Factory Droid plugin (marketplace-based, beta)
if command -v droid >/dev/null 2>&1; then
    DROID_MARKETPLACE_DIR="$INSTALL_DIR/factory-marketplace"
    if [ -d "$DROID_MARKETPLACE_DIR/.factory-plugin" ]; then
        info "      Installing Factory Droid plugin (beta)..."
        droid plugin marketplace add "$DROID_MARKETPLACE_DIR" && droid plugin install trajectory@trajectory --scope user || {
            warn "Factory Droid plugin install failed. Install manually:"
            warn "  ~/.trajectory/bin/trajectory setup --clients droid"
        }
        PLUGIN_INSTALLED=1
    else
        info "      Factory Droid CLI detected, but Droid setup was not selected - skipping Droid plugin."
        info "      To refresh client wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients droid"
        PLUGIN_INSTALLED=1
    fi
else
    info "      Factory Droid CLI not detected - skipping Droid plugin."
fi

# Gemini CLI configuration (handled by setup wizard)
if command -v gemini >/dev/null 2>&1; then
    info "      Gemini CLI detected - configuration is handled by the setup wizard."
    info "      To refresh Gemini wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients gemini"
    PLUGIN_INSTALLED=1
else
    info "      Gemini CLI not detected - skipping Gemini configuration guidance."
fi

# Antigravity CLI configuration (handled by setup wizard)
if command -v agy >/dev/null 2>&1; then
    info "      Antigravity CLI detected - configuration is handled by the setup wizard."
    info "      To refresh Antigravity wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients agy"
    PLUGIN_INSTALLED=1
else
    info "      Antigravity CLI not detected - skipping Antigravity configuration guidance."
fi

# Goose configuration (handled by setup wizard)
if command -v goose >/dev/null 2>&1; then
    info "      Goose detected - configuration is handled by the setup wizard."
    info "      To refresh Goose wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients goose"
    PLUGIN_INSTALLED=1
else
    info "      Goose CLI not detected - skipping Goose configuration guidance."
fi

# Cline CLI configuration (handled by setup wizard)
if command -v cline >/dev/null 2>&1; then
    info "      Cline CLI detected - configuration is handled by the setup wizard."
    info "      To refresh Cline wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients cline"
    PLUGIN_INSTALLED=1
else
    info "      Cline CLI not detected - skipping Cline configuration guidance."
fi

# Aider configuration (opt-in command shim handled by setup wizard)
if command -v aider >/dev/null 2>&1; then
    info "      Aider detected - opt-in command shim configuration is handled by the setup wizard."
    info "      To refresh Aider shim wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients aider --install-client-shims"
    PLUGIN_INSTALLED=1
else
    info "      Aider CLI not detected - skipping Aider configuration guidance."
fi

# Continue CLI configuration (opt-in command shim handled by setup wizard)
if command -v cn >/dev/null 2>&1; then
    info "      Continue CLI detected - opt-in command shim configuration is handled by the setup wizard."
    info "      To refresh Continue CLI shim wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients continue --install-client-shims"
    PLUGIN_INSTALLED=1
else
    info "      Continue CLI not detected - skipping Continue CLI configuration guidance."
fi

# Mistral Vibe configuration (opt-in command shim handled by setup wizard)
if command -v vibe >/dev/null 2>&1; then
    info "      Mistral Vibe detected - opt-in command shim and hooks configuration is handled by the setup wizard."
    info "      To refresh Mistral Vibe shim wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients mistral-vibe --install-client-shims"
    PLUGIN_INSTALLED=1
else
    info "      Mistral Vibe CLI not detected - skipping Mistral Vibe configuration guidance."
fi

# Codebuff configuration (opt-in command shim handled by setup wizard)
if command -v codebuff >/dev/null 2>&1 || command -v cb >/dev/null 2>&1; then
    info "      Codebuff detected - opt-in command shim configuration is handled by the setup wizard."
    info "      To refresh Codebuff shim wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients codebuff --install-client-shims"
    PLUGIN_INSTALLED=1
else
    info "      Codebuff CLI not detected - skipping Codebuff configuration guidance."
fi

# Cursor configuration (handled by setup wizard)
if command -v cursor >/dev/null 2>&1 || command -v cursor-agent >/dev/null 2>&1; then
    info "      Cursor detected - configuration is handled by the setup wizard."
    info "      To refresh Cursor wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients cursor"
    PLUGIN_INSTALLED=1
else
    info "      Cursor CLI not detected - skipping Cursor configuration guidance."
fi

# Hermes Agent configuration (handled by setup wizard)
if command -v hermes >/dev/null 2>&1; then
    info "      Hermes Agent detected - configuration is handled by the setup wizard."
    info "      To refresh Hermes wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients hermes"
    PLUGIN_INSTALLED=1
else
    info "      Hermes Agent CLI not detected - skipping Hermes configuration guidance."
fi

# Amp Code configuration (handled by setup wizard)
if command -v amp >/dev/null 2>&1; then
    info "      Amp Code detected - configuration is handled by the setup wizard."
    info "      To refresh Amp Code wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients amp"
    PLUGIN_INSTALLED=1
else
    info "      Amp Code CLI not detected - skipping Amp Code configuration guidance."
fi

# Qwen Code configuration (handled by setup wizard)
if command -v qwen >/dev/null 2>&1; then
    info "      Qwen Code detected - configuration is handled by the setup wizard."
    info "      To refresh Qwen Code wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients qwen"
    PLUGIN_INSTALLED=1
else
    info "      Qwen Code CLI not detected - skipping Qwen Code configuration guidance."
fi

# OpenHands configuration (handled by setup wizard)
if command -v openhands >/dev/null 2>&1; then
    info "      OpenHands detected - configuration is handled by the setup wizard."
    info "      To refresh OpenHands wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients openhands"
    PLUGIN_INSTALLED=1
else
    info "      OpenHands CLI not detected - skipping OpenHands configuration guidance."
fi

# Kiro CLI configuration (handled by setup wizard)
if command -v kiro-cli >/dev/null 2>&1 || command -v kiro >/dev/null 2>&1; then
    info "      Kiro CLI detected - configuration is handled by the setup wizard."
    info "      To refresh Kiro CLI wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients kiro"
    PLUGIN_INSTALLED=1
else
    info "      Kiro CLI not detected - skipping Kiro CLI configuration guidance."
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
        warn "Refresh OpenCode wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients opencode"
    fi
    PLUGIN_INSTALLED=1
else
    info "      OpenCode CLI not detected - skipping OpenCode plugin."
fi

# Kilo Code plugin
KILO_PLUGIN_DIR="$SCRIPT_DIR/plugin/trajectory-kilo"
KILO_CLI=""
if command -v kilo >/dev/null 2>&1; then
    KILO_CLI="kilo"
elif command -v kilocode >/dev/null 2>&1; then
    KILO_CLI="kilocode"
fi
if [ -n "$KILO_CLI" ]; then
    if [ -d "$KILO_PLUGIN_DIR" ]; then
        info "      Installing Kilo Code plugin..."
        "$KILO_CLI" plugin "$KILO_PLUGIN_DIR" || {
            warn "Kilo Code plugin install failed. Install manually:"
            warn "  kilo plugin /path/to/trajectory/plugin/trajectory-kilo"
            warn "  or run: ~/.trajectory/bin/trajectory setup --clients kilo"
        }
    else
        warn "Kilo Code CLI detected, but local plugin directory not found: $KILO_PLUGIN_DIR"
        warn "Refresh Kilo Code wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients kilo"
    fi
    PLUGIN_INSTALLED=1
else
    info "      Kilo Code CLI not detected - skipping Kilo Code plugin."
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
        warn "Refresh Pi wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients pi"
    fi
    PLUGIN_INSTALLED=1
else
    info "      Pi CLI not detected - skipping Pi plugin."
fi

if [ "$PLUGIN_INSTALLED" = "0" ]; then
    info ""
    info "  No coding assistant CLIs detected. Refresh client wiring later without Datadog prompts:"
    info "    Claude Code: claude plugin marketplace add https://github.com/datadog-labs/trajectory.git && claude plugin install trajectory@trajectory --scope user"
    info "    Codex:       ~/.trajectory/bin/trajectory setup --clients codex"
    info "    Copilot beta: ~/.trajectory/bin/trajectory setup --clients copilot"
    info "    Droid beta:  ~/.trajectory/bin/trajectory setup --clients droid"
    info "    Gemini:      ~/.trajectory/bin/trajectory setup --clients gemini"
    info "    Antigravity: ~/.trajectory/bin/trajectory setup --clients agy"
    info "    Goose:       ~/.trajectory/bin/trajectory setup --clients goose"
    info "    Cline CLI:   ~/.trajectory/bin/trajectory setup --clients cline"
    info "    Aider:       ~/.trajectory/bin/trajectory setup --clients aider --install-client-shims"
    info "    Continue CLI: ~/.trajectory/bin/trajectory setup --clients continue --install-client-shims"
    info "    Mistral Vibe: ~/.trajectory/bin/trajectory setup --clients mistral-vibe --install-client-shims"
    info "    Codebuff:    ~/.trajectory/bin/trajectory setup --clients codebuff --install-client-shims"
    info "    Cursor:      ~/.trajectory/bin/trajectory setup --clients cursor"
    info "    Hermes:      ~/.trajectory/bin/trajectory setup --clients hermes"
    info "    Amp Code:    ~/.trajectory/bin/trajectory setup --clients amp"
    info "    Qwen Code:   ~/.trajectory/bin/trajectory setup --clients qwen"
    info "    OpenHands:   ~/.trajectory/bin/trajectory setup --clients openhands"
    info "    Kiro CLI:    ~/.trajectory/bin/trajectory setup --clients kiro"
    info "    OpenCode:    ~/.trajectory/bin/trajectory setup --clients opencode"
    info "    Kilo Code:   ~/.trajectory/bin/trajectory setup --clients kilo"
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
info "  To uninstall:"
info "    bash $INSTALL_DIR/uninstall.sh"
info "========================================="
