#!/usr/bin/env bash
# install.sh - Download and install Trajectory (agent observability for AI coding assistants).
#
# Usage:
#   bash install.sh                           # interactive
#   bash install.sh --site datadoghq.com --ml-app my-agents --api-key $KEY \
#                   --clients cc --non-interactive
#   bash install.sh --security --app-key $DD_APP_KEY   # with Datadog Security
#
# Setup flags (--site, --ml-app, --api-key, --clients, --non-interactive) are
# passed through to `trajectory setup`. Run `trajectory setup --help` for the
# full flag reference.
#
# Install-only flags (not passed through to `trajectory setup`):
#   --security   After baseline setup, enable the Datadog Security product
#                plugin for the coding agents this installer detected that
#                support it (Claude Code, Codex, Cursor).
#
#                Defaults to ENFORCE mode, which can block agent actions that
#                violate policy. Passing --security is the explicit intent
#                behind the CLI's required `--yes` confirmation.
#
#   --security-mode <enforce|observe>
#                Mode used when enabling Datadog Security. Defaults to
#                'enforce'. Use 'observe' to record local security decisions
#                without blocking agent actions. Implies --security.
#
#   --security-privacy <coding_agent|unredacted>
#                Privacy mode for the ai_guard evaluator. Omitted, the product
#                plugin's default (coding_agent) applies and message content is
#                redacted before it reaches Datadog. 'unredacted' sends full
#                prompt and tool content instead. Implies --security.
#
#   --app-key    Datadog application key. Datadog Security authenticates with
#                both keys: the API key, handled by `trajectory setup`, and
#                this application key, which Agent Security result readback
#                requires. Stored in the OS keychain as dd_app_key via
#                `trajectory config set-secret dd_app_key --stdin`.
#
#                It belongs to the security activation workflow, so it is only
#                stored when security is enabled, and it is never passed to
#                `trajectory setup` or to the security command itself.
#
# Enabling security also creates the 'ai-guard-apm' required destination in
# config.defaults.yaml, which publishes agent-security module spans and enables
# app-key readback. It must live in the managed defaults file: publish reads
# required_destinations only from that layer, never from user config.yaml. Its
# site and ml_app follow --site/--ml-app. The step is idempotent and never
# modifies a destination that already carries that name.
#
# Both keys fall back to the environment when their flag is omitted:
#   --api-key    DD_API_KEY, DATADOG_API_KEY
#   --app-key    DD_APP_KEY, DD_APPLICATION_KEY, DATADOG_APP_KEY,
#                DATADOG_APPLICATION_KEY
# An explicit flag always wins over the environment.
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
ENABLE_SECURITY=0
# --security activates Datadog Security in enforce mode, which can block agent
# actions. --security-mode observe selects non-blocking recording instead.
SECURITY_MODE="enforce"
# Privacy mode for the ai_guard evaluator. Empty means "leave the product
# plugin's own default (coding_agent) in place". `unredacted` sends full
# message content to Datadog instead of redacted content.
SECURITY_PRIVACY_MODE=""
# Datadog application key. Install-only: `trajectory setup` does not accept it
# and it is never passed to the security activation. It is stored in the OS
# keychain as dd_app_key, which Agent Security needs for result readback.
APP_KEY=""
API_KEY_PROVIDED=0
# Required destination created for Agent Security module spans. Site and ML app
# follow --site/--ml-app so the destination is correct on every Datadog site,
# and fall back to the same defaults `trajectory setup` uses.
SECURITY_DESTINATION_NAME="ai-guard-apm"
SECURITY_DESTINATION_SERVICE="coding-agents"
SITE=""
ML_APP=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        --non-interactive)
            NON_INTERACTIVE=1
            SETUP_ARGS+=("$1")
            shift
            ;;
        --security)
            # Install-only flag. `trajectory setup` does not accept it; the
            # security product plugin is activated separately after setup.
            ENABLE_SECURITY=1
            shift
            ;;
        --security-mode|--security-mode=*)
            # Install-only flag. Selecting a mode implies --security so the
            # request cannot silently do nothing.
            case "$1" in
                --security-mode=*)
                    SECURITY_MODE="${1#--security-mode=}"
                    shift
                    ;;
                *)
                    if [ "$#" -lt 2 ]; then
                        fail "$1 requires a value (enforce or observe)"
                    fi
                    SECURITY_MODE="$2"
                    shift 2
                    ;;
            esac
            SECURITY_MODE="$(echo "$SECURITY_MODE" | tr '[:upper:]' '[:lower:]')"
            case "$SECURITY_MODE" in
                enforce|observe) ;;
                *) fail "--security-mode must be 'enforce' or 'observe' (got '$SECURITY_MODE')" ;;
            esac
            ENABLE_SECURITY=1
            ;;
        --security-privacy|--security-privacy=*)
            # Install-only flag. Like --security-mode, naming a privacy mode
            # implies --security so the request cannot silently do nothing.
            case "$1" in
                --security-privacy=*)
                    SECURITY_PRIVACY_MODE="${1#--security-privacy=}"
                    shift
                    ;;
                *)
                    if [ "$#" -lt 2 ]; then
                        fail "$1 requires a value (coding_agent or unredacted)"
                    fi
                    SECURITY_PRIVACY_MODE="$2"
                    shift 2
                    ;;
            esac
            SECURITY_PRIVACY_MODE="$(echo "$SECURITY_PRIVACY_MODE" | tr '[:upper:]' '[:lower:]')"
            case "$SECURITY_PRIVACY_MODE" in
                coding_agent|unredacted) ;;
                *) fail "--security-privacy must be 'coding_agent' or 'unredacted' (got '$SECURITY_PRIVACY_MODE')" ;;
            esac
            ENABLE_SECURITY=1
            ;;
        --api-key)
            if [ "$#" -lt 2 ]; then
                fail "$1 requires a value"
            fi
            API_KEY_PROVIDED=1
            SETUP_ARGS+=("$1" "$2")
            shift 2
            ;;
        --api-key=*)
            API_KEY_PROVIDED=1
            SETUP_ARGS+=("$1")
            shift
            ;;
        --app-key)
            # Install-only flag; deliberately not added to SETUP_ARGS.
            if [ "$#" -lt 2 ]; then
                fail "$1 requires a value"
            fi
            APP_KEY="$2"
            shift 2
            ;;
        --app-key=*)
            APP_KEY="${1#--app-key=}"
            shift
            ;;
        --add-to-path)
            # Reserved for parity with the older install-trajectory.sh flag.
            shift
            ;;
        --site|--ml-app|--clients)
            if [ "$#" -lt 2 ]; then
                fail "$1 requires a value"
            fi
            case "$1" in
                --site)   SITE="$2" ;;
                --ml-app) ML_APP="$2" ;;
            esac
            SETUP_ARGS+=("$1" "$2")
            shift 2
            ;;
        --site=*|--ml-app=*|--clients=*)
            case "$1" in
                --site=*)   SITE="${1#--site=}" ;;
                --ml-app=*) ML_APP="${1#--ml-app=}" ;;
            esac
            SETUP_ARGS+=("$1")
            shift
            ;;
        *)
            SETUP_ARGS+=("$1")
            shift
            ;;
    esac
done

# Both Datadog keys fall back to the standard environment variable names that
# `trajectory` itself recognizes (trajectory/config/secrets.go). An explicit
# flag always wins over the environment.
if [ "$API_KEY_PROVIDED" = "0" ]; then
    _ENV_API_KEY="${DD_API_KEY:-${DATADOG_API_KEY:-}}"
    if [ -n "$_ENV_API_KEY" ]; then
        SETUP_ARGS+=("--api-key" "$_ENV_API_KEY")
    fi
    unset _ENV_API_KEY
fi
if [ -z "$APP_KEY" ]; then
    APP_KEY="${DD_APP_KEY:-${DD_APPLICATION_KEY:-${DATADOG_APP_KEY:-${DATADOG_APPLICATION_KEY:-}}}}"
fi

# Store the Datadog application key so Agent Security result readback can
# authenticate. Called only from the security activation workflow. The value is
# piped over stdin so it never appears in argv or in `ps` output. Keychain
# writes can legitimately fail in headless environments, so this warns instead
# of aborting the install.
store_app_key() {
    local output
    if [ -z "$APP_KEY" ]; then
        info "      No Datadog application key supplied (--app-key or DD_APP_KEY)."
        info "      Agent Security result readback needs one; store it later with:"
        info "        $BINARY config set-secret dd_app_key --stdin"
        return 0
    fi
    if output=$(printf '%s' "$APP_KEY" | "$BINARY" config set-secret dd_app_key --stdin 2>&1); then
        info "      Stored Datadog application key as dd_app_key in the OS keychain."
        return 0
    fi
    warn "Could not store the Datadog application key as dd_app_key."
    if [ -n "$output" ]; then printf '%s\n' "$output" >&2; fi
    warn "      Retry manually: $BINARY config set-secret dd_app_key --stdin"
    warn "      Or export DD_APP_KEY in the environment."
}

# Set the ai_guard evaluator's privacy mode. Runs after activation because the
# activation is what writes the module and evaluator config this updates.
# Without the flag the product plugin's own default (coding_agent, redacted)
# stays in place, so this is a no-op.
apply_security_privacy_mode() {
    local output
    if [ -z "$SECURITY_PRIVACY_MODE" ]; then
        return 0
    fi
    if output=$("$BINARY" modules evaluator configure agent-security ai_guard \
        --privacy-mode "$SECURITY_PRIVACY_MODE" 2>&1); then
        if [ "$SECURITY_PRIVACY_MODE" = "unredacted" ]; then
            warn "Agent Security privacy mode is UNREDACTED: full prompt and tool"
            warn "      content evaluated by AI Guard is sent to Datadog without redaction."
            warn "      Switch back with:"
            warn "        $BINARY modules evaluator configure agent-security ai_guard --privacy-mode coding_agent"
        else
            info "      Agent Security privacy mode set to $SECURITY_PRIVACY_MODE (content is redacted)."
        fi
        return 0
    fi
    warn "Could not set the Agent Security privacy mode to $SECURITY_PRIVACY_MODE."
    if [ -n "$output" ]; then printf '%s\n' "$output" >&2; fi
    warn "      Retry manually: $BINARY modules evaluator configure agent-security ai_guard --privacy-mode $SECURITY_PRIVACY_MODE"
}

# Create the required destination that publishes agent-security module spans.
# Called only from the security activation workflow.
#
# This must be config.defaults.yaml, not config.yaml. Publish resolves
# required_destinations exclusively from the managed defaults layer
# (mainconfig.LoadDefaultsIfPresent in trajectory/publish/cmd.go); the same key
# in user config.yaml is never read, so a destination written there is silently
# inert. `trajectory security destination add` can only amend a destination that
# already exists and no CLI command creates one, so the installer writes it.
# Idempotent: an existing destination with this name is left untouched.
ensure_security_destination() {
    local config_file="$INSTALL_DIR/config.defaults.yaml" site ml_app

    # A personal install has no managed defaults layer, so this file is created
    # here. If one already exists it belongs to a managed deployment: leave it
    # alone rather than overwriting policy this installer does not own.
    if [ -f "$config_file" ]; then
        if grep -q "$SECURITY_DESTINATION_NAME" "$config_file"; then
            info "      Destination $SECURITY_DESTINATION_NAME already present - left unchanged."
        else
            warn "$config_file already exists, so the $SECURITY_DESTINATION_NAME destination was not added."
            warn "      That file is managed configuration this installer does not own."
            warn "      Add the destination there manually to publish agent-security module spans."
        fi
        return 0
    fi

    site="${SITE:-datadoghq.com}"
    ml_app="${ML_APP:-coding-agents}"
    if ! cat > "$config_file" <<EOF
required_destinations:
  - name: ${SECURITY_DESTINATION_NAME}
    type: datadog
    site: ${site}
    service: ${SECURITY_DESTINATION_SERVICE}
    ml_app: ${ml_app}
    level: "off"
    api_key_ref: dd_api_key
    app_key_ref: dd_app_key
    module_spans:
      enabled: true
      modules:
        - agent-security
      native_composite_attributes:
        - agent-security
EOF
    then
        warn "Could not write $config_file; $SECURITY_DESTINATION_NAME was not added."
        return 0
    fi
    chmod 0644 "$config_file" 2>/dev/null || true
    info "      Wrote $config_file with the $SECURITY_DESTINATION_NAME destination"
    info "      (site=$site, ml_app=$ml_app) for agent-security module spans."
}

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

# Enable the Datadog Security product plugin for the coding agents the main
# install already detected. SECURITY_CLIENTS is populated by the per-client
# detection blocks below, so detection happens exactly once and security can
# never target a client the installer did not see.
#
# Runs only when --security is passed; security is never enabled by binary
# presence or by baseline setup alone. --security defaults to enforce mode,
# which can block agent actions, so the installer passes the CLI's required
# --yes confirmation on the user's behalf. --security-mode observe records
# local security decisions without blocking instead.
enable_security_modules() {
    local clients=() client_list mode_args=() confirm=""
    local client enabled=() failed=() enabled_list failed_list
    clients=(${SECURITY_CLIENTS[@]+"${SECURITY_CLIENTS[@]}"})

    if [ "$SECURITY_MODE" = "enforce" ]; then
        # The CLI requires --yes for enforce because it can block agent
        # actions. --security is that explicit intent.
        mode_args=(--mode enforce --yes)
        confirm=" --yes"
    else
        mode_args=(--mode observe)
    fi

    info ""
    if [ "${#clients[@]}" -eq 0 ]; then
        warn "--security was requested, but none of the security-supported clients were detected."
        warn "      Datadog Security supports Claude Code, Codex, and Cursor."
        warn "      Enable it later for an explicit client list:"
        warn "        $BINARY security setup --mode $SECURITY_MODE --clients cc,codex,cursor$confirm"
        return 0
    fi

    client_list="$(IFS=,; echo "${clients[*]}")"
    # Agent Security authenticates with both keys: the API key handled by setup
    # and the application key stored here.
    store_app_key
    ensure_security_destination

    # Activate one client at a time. A client whose hooks cannot be installed
    # (missing marketplace, unwritable client config, an unsupported CLI build)
    # must not stop the remaining detected clients from being protected.
    info "      Enabling Datadog Security ($SECURITY_MODE mode) for: $client_list"
    for client in "${clients[@]}"; do
        if "$BINARY" security setup "${mode_args[@]}" --clients "$client"; then
            enabled+=("$client")
            info "      - $client: enabled"
        else
            failed+=("$client")
            warn "      - $client: could not enable Datadog Security (continuing with the other clients)."
        fi
    done

    apply_security_privacy_mode

    if [ "${#enabled[@]}" -gt 0 ]; then
        enabled_list="$(IFS=,; echo "${enabled[*]}")"
        if [ "$SECURITY_MODE" = "enforce" ]; then
            info "      Datadog Security enabled in ENFORCE mode for $enabled_list - it can"
            info "      block agent actions that violate policy."
            info "      To fall back to non-blocking observation:"
            info "        $BINARY security setup --mode observe --clients $enabled_list"
        else
            info "      Datadog Security enabled in observe mode for $enabled_list - it records"
            info "      local security decisions and does not block agent actions."
            info "      To switch to blocking enforcement:"
            info "        $BINARY security setup --mode enforce --clients $enabled_list --yes"
        fi
        info "      To check status:  $BINARY security status"
        info "      To turn it off:   $BINARY security disable --clients $enabled_list --remove-hooks"
    fi

    if [ "${#failed[@]}" -gt 0 ]; then
        failed_list="$(IFS=,; echo "${failed[*]}")"
        warn "Datadog Security could not be enabled for: $failed_list"
        warn "      Baseline observability capture is unaffected for those clients."
        warn "      Retry manually: $BINARY security setup --mode $SECURITY_MODE --clients $failed_list$confirm"
    fi
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
# Coding agents detected below that the Datadog Security product plugin
# supports. Consumed by enable_security_modules when --security is passed, so
# detection happens once and security never targets an undetected client.
SECURITY_CLIENTS=()

# Claude Code plugin
CC_PLUGIN_DIR="$SCRIPT_DIR/plugin/trajectory"
if command -v claude >/dev/null 2>&1; then
    SECURITY_CLIENTS+=("cc")
    if [ -d "$CC_PLUGIN_DIR" ]; then
        if [ -f "$HOME/.claude/plugins/installed_plugins.json" ] && grep -q "trajectory@trajectory" "$HOME/.claude/plugins/installed_plugins.json"; then
            info "[5/5] Claude Code plugin is installed; setup reconciled its Trajectory-owned payload without changing Claude settings."
            PLUGIN_INSTALLED=1
        else
            warn "[5/5] Claude Code plugin is not installed. Trajectory staged its marketplace but did not change Claude settings."
            warn "      Install trajectory@trajectory through Claude's plugin administration path."
        fi
    fi
else
    info "[5/5] Claude Code CLI not detected - skipping Claude Code plugin."
fi

# Codex plugin (marketplace-based)
if command -v codex >/dev/null 2>&1; then
    SECURITY_CLIENTS+=("codex")
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
    SECURITY_CLIENTS+=("cursor")
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

# Kiro CLI configuration (handled by setup wizard)
if command -v kiro-cli >/dev/null 2>&1 || command -v kiro >/dev/null 2>&1; then
    info "      Kiro CLI detected - configuration is handled by the setup wizard."
    info "      To refresh Kiro CLI wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients kiro"
    PLUGIN_INSTALLED=1
else
    info "      Kiro CLI not detected - skipping Kiro CLI configuration guidance."
fi

# Devin CLI preview guidance (explicit opt-in; installer does not enable or mutate it)
if command -v devin >/dev/null 2>&1; then
    info "      Devin CLI detected - preview instrumentation is disabled by default."
    info "      Enable Devin explicitly, then run setup:"
    info "        1. ~/.trajectory/bin/trajectory features enable devin_cli_instrumentation"
    info "        2. ~/.trajectory/bin/trajectory setup --clients devin"
    PLUGIN_INSTALLED=1
else
    info "      Devin CLI not detected - skipping Devin CLI preview guidance."
fi

# Qoder CLI preview guidance (explicit opt-in; installer does not enable or mutate it)
if command -v qodercli >/dev/null 2>&1; then
    info "      Qoder CLI detected - preview instrumentation is disabled by default."
    info "      Enable Qoder explicitly, then run setup:"
    info "        1. ~/.trajectory/bin/trajectory features enable qoder_cli_instrumentation"
    info "        2. ~/.trajectory/bin/trajectory setup --clients qoder"
    PLUGIN_INSTALLED=1
else
    info "      Qoder CLI not detected - skipping Qoder CLI preview guidance."
fi

# CommandCode preview guidance (explicit opt-in; never probe the generic `cmd` alias)
if command -v command-code >/dev/null 2>&1 || command -v commandcode >/dev/null 2>&1 || command -v cmdc >/dev/null 2>&1 || [ -d "$HOME/.commandcode/projects" ]; then
    info "      CommandCode detected - preview instrumentation is disabled by default."
    info "      Enable CommandCode explicitly, then run setup:"
    info "        1. ~/.trajectory/bin/trajectory features enable commandcode_instrumentation"
    info "        2. ~/.trajectory/bin/trajectory setup --clients commandcode"
    PLUGIN_INSTALLED=1
else
    info "      CommandCode not detected - skipping CommandCode preview guidance."
fi

# Zed preview guidance (explicit opt-in; installer does not enable or mutate it)
if command -v zed >/dev/null 2>&1 || [ -f "$HOME/Library/Application Support/Zed/threads/threads.db" ] || [ -f "${XDG_DATA_HOME:-$HOME/.local/share}/zed/threads/threads.db" ]; then
    info "      Zed detected - passive-history preview instrumentation is disabled by default."
    info "      Enable Zed explicitly, then run setup:"
    info "        1. ~/.trajectory/bin/trajectory features enable zed_passive_history"
    info "        2. ~/.trajectory/bin/trajectory setup --clients zed"
    PLUGIN_INSTALLED=1
else
    info "      Zed not detected - skipping Zed preview guidance."
fi

# Kimi Code CLI preview guidance (explicit opt-in; installer does not mutate it)
if command -v kimi >/dev/null 2>&1; then
    info "      Kimi Code CLI detected - preview instrumentation is disabled by default."
    info "      Enable Kimi explicitly, then run setup:"
    info "        1. ~/.trajectory/bin/trajectory features enable kimi_cli_instrumentation"
    info "        2. ~/.trajectory/bin/trajectory setup --clients kimi"
    PLUGIN_INSTALLED=1
else
    info "      Kimi Code CLI not detected - skipping Kimi preview guidance."
fi

# VS Code Copilot Chat preview guidance. Installation never mutates VS Code;
# setup does so only after the explicit default-off feature is enabled.
if command -v code >/dev/null 2>&1 || command -v code-insiders >/dev/null 2>&1 || command -v codium >/dev/null 2>&1; then
    info "      VS Code Copilot Chat detected - preview instrumentation is disabled by default."
    info "        1. ~/.trajectory/bin/trajectory features enable vscode_copilot_instrumentation"
    info "        2. ~/.trajectory/bin/trajectory setup --clients vscode-copilot"
fi

# Warp/Oz CLI preview guidance (explicit opt-in; installer does not enable or mutate it)
if command -v oz >/dev/null 2>&1 || command -v oz-preview >/dev/null 2>&1 || command -v warp-cli >/dev/null 2>&1; then
    info "      Warp/Oz CLI detected - preview instrumentation is disabled by default."
    info "      Enable Warp/Oz explicitly, then run setup:"
    info "        1. ~/.trajectory/bin/trajectory features enable warp_oz_instrumentation"
    info "        2. ~/.trajectory/bin/trajectory setup --clients warp"
    PLUGIN_INSTALLED=1
else
    info "      Warp/Oz CLI not detected - skipping Warp/Oz preview guidance."
fi

# Windsurf preview guidance (explicit opt-in; installer does not mutate it)
if command -v windsurf >/dev/null 2>&1 || [ -d "$HOME/.windsurf" ] || [ -d "$HOME/.codeium/windsurf" ]; then
    info "      Windsurf detected - preview instrumentation is disabled by default."
    info "        1. ~/.trajectory/bin/trajectory features enable windsurf_instrumentation"
    info "        2. ~/.trajectory/bin/trajectory setup --clients windsurf"
    PLUGIN_INSTALLED=1
else
    info "      Windsurf not detected - skipping Windsurf preview guidance."
fi

# OpenHands configuration (handled by setup wizard)
if command -v openhands >/dev/null 2>&1; then
    info "      OpenHands detected - configuration is handled by the setup wizard."
    info "      To refresh OpenHands wiring later without Datadog prompts: ~/.trajectory/bin/trajectory setup --clients openhands"
    PLUGIN_INSTALLED=1
else
    info "      OpenHands CLI not detected - skipping OpenHands configuration guidance."
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
    info "    Claude Code: ~/.trajectory/bin/trajectory setup --clients cc (stages assets; Claude managed policy owns registration)"
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
    info "    Kiro CLI:    ~/.trajectory/bin/trajectory setup --clients kiro"
    info "    Devin preview (explicit opt-in):"
    info "      1. ~/.trajectory/bin/trajectory features enable devin_cli_instrumentation"
    info "      2. ~/.trajectory/bin/trajectory setup --clients devin"
    info "    Qoder preview (explicit opt-in):"
    info "      1. ~/.trajectory/bin/trajectory features enable qoder_cli_instrumentation"
    info "      2. ~/.trajectory/bin/trajectory setup --clients qoder"
    info "    CommandCode preview (explicit opt-in):"
    info "      1. ~/.trajectory/bin/trajectory features enable commandcode_instrumentation"
    info "      2. ~/.trajectory/bin/trajectory setup --clients commandcode"
    info "    Zed passive-history preview (explicit opt-in):"
    info "      1. ~/.trajectory/bin/trajectory features enable zed_passive_history"
    info "      2. ~/.trajectory/bin/trajectory setup --clients zed"
    info "    Kimi preview (explicit opt-in):"
    info "      1. ~/.trajectory/bin/trajectory features enable kimi_cli_instrumentation"
    info "      2. ~/.trajectory/bin/trajectory setup --clients kimi"
    info "    Warp/Oz preview (explicit opt-in):"
    info "      1. ~/.trajectory/bin/trajectory features enable warp_oz_instrumentation"
    info "      2. ~/.trajectory/bin/trajectory setup --clients warp"
    info "    Windsurf preview (explicit opt-in):"
    info "      1. ~/.trajectory/bin/trajectory features enable windsurf_instrumentation"
    info "      2. ~/.trajectory/bin/trajectory setup --clients windsurf"
    info "    OpenHands:   ~/.trajectory/bin/trajectory setup --clients openhands"
    info "    Kiro CLI:    ~/.trajectory/bin/trajectory setup --clients kiro"
    info "    OpenCode:    ~/.trajectory/bin/trajectory setup --clients opencode"
    info "    Kilo Code:   ~/.trajectory/bin/trajectory setup --clients kilo"
    info "    Pi:          ~/.trajectory/bin/trajectory setup --clients pi"
fi

if [ "$ENABLE_SECURITY" = "1" ]; then
    enable_security_modules
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
if [ "$ENABLE_SECURITY" = "1" ]; then
    info "  To check Datadog Security status:"
    info "    $BINARY security status"
fi
info ""
info "  To uninstall:"
info "    bash $INSTALL_DIR/uninstall.sh"
info "========================================="
