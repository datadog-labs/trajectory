# Supported Clients

Trajectory instruments AI coding agents via hooks that capture session events to a local server. Each client has its own plugin/extension format and minimum version requirements.

For the lower-level install artifacts, hook surfaces, watcher behavior, and
backfill boundaries per client, see
[CLIENT-INSTRUMENTATION.md](CLIENT-INSTRUMENTATION.md).

For the shared MCP tool and resource catalog, run `trajectory user-guide mcp`.
For the built-in client overview and per-client guides, run:

```bash
trajectory user-guide clients
trajectory user-guide clients/codex
trajectory user-guide clients/agy
trajectory user-guide clients/goose
trajectory user-guide clients/cline
trajectory user-guide clients/aider
trajectory user-guide clients/continue
trajectory user-guide clients/mistral-vibe
trajectory user-guide clients/codebuff
trajectory user-guide clients/hermes
trajectory user-guide clients/amp
trajectory user-guide clients/qwen
trajectory user-guide clients/openhands
trajectory user-guide clients/kilo
trajectory user-guide clients/kiro
```

## Quick Reference

| Client | Install | Min Version | Capture |
|--------|---------|-------------|---------|
| Claude Code | `trajectory setup --clients cc` | 2.0+ | HTTP hooks + MCP |
| Codex CLI | `trajectory setup --clients codex` | 0.128.0 | Command hooks (primary) + rollout watcher (fallback) |
| GitHub Copilot CLI | `trajectory setup --clients copilot` | Beta | Copilot plugin command hooks + MCP |
| Gemini CLI | `trajectory setup --clients gemini` | 0.30.0+ | Managed command hooks + MCP |
| Antigravity CLI (`agy`) | `trajectory setup --clients agy` | 1.0.0+ | Antigravity plugin command hooks + MCP |
| Goose | `trajectory setup --clients goose` | 1.39.0 tested | Open Plugins command hooks |
| Cline CLI | `trajectory setup --clients cline` | 3.0.34 tested | File hooks + MCP |
| Aider | `trajectory setup --clients aider --install-client-shims` | Current CLI tested | Opt-in command shim + analytics/history sidecars |
| Continue CLI | `trajectory setup --clients continue --install-client-shims` | 1.5.47 tested | Opt-in `cn` command shim + session JSON readback |
| Mistral Vibe | `trajectory setup --clients mistral-vibe --install-client-shims` | 2.18.3 inspected | Opt-in command shim + native tool hooks |
| Codebuff | `trajectory setup --clients codebuff --install-client-shims` | 1.0.682 inspected | Opt-in command shims + chat-history import |
| Cursor Desktop | `trajectory setup --clients cursor` | 1.0+ | Command hooks that POST to capture |
| cursor-agent CLI | Automatic when `cursor-agent` is on PATH | Beta | Transcript watcher |
| Factory Droid | `trajectory setup --clients droid` | Beta | Factory plugin command hooks + MCP |
| Hermes Agent | `trajectory setup --clients hermes` | Beta | Observer plugin hooks + MCP |
| Amp Code | `trajectory setup --clients amp` | Beta | System TypeScript plugin events + MCP |
| Qwen Code | `trajectory setup --clients qwen` | 0.19.2 tested | Native HTTP hooks + MCP |
| OpenHands | `trajectory setup --clients openhands` | V1 CLI tested | Command hooks + MCP |
| Pi | `trajectory setup --clients pi` | Beta | TypeScript extension + MCP |
| OpenCode | `trajectory setup --clients opencode` | Beta | Plugin SDK events + MCP |
| Kilo Code | `trajectory setup --clients kilo` | Beta | Plugin SDK events + MCP |
| Kiro CLI | `trajectory setup --clients kiro` | Beta | Agent command hooks + MCP |

## Feature Coverage Matrix

| Client | Live capture | Tool/model events | Token/cost usage | Incognito or MCP | Backfill | Resume |
|--------|--------------|-------------------|------------------|------------------|----------|--------|
| Claude Code | Yes, HTTP hooks | Yes | Yes | Yes | Transcript backfill | Yes |
| Codex CLI | Yes, command hooks plus rollout watcher fallback | Yes | Yes | Yes | Codex rollout backfill | Yes |
| GitHub Copilot CLI | Yes, beta plugin command hooks | Command-level events | Not yet | MCP config and incognito skill | Not yet | Not yet |
| Gemini CLI | Yes, managed command hooks | Yes | Yes | Yes | Gemini transcript backfill | Yes |
| Antigravity CLI (`agy`) | Yes, plugin command hooks | Yes, via Gemini-compatible hook schema | Yes, via Gemini-compatible token fields | Yes | Not yet | No setup-managed resume |
| Goose | Yes, Open Plugins command hooks | Session, prompt, tool, shell/file, and assistant-message hooks | Usage when hook payloads expose it | Not yet | Not yet | No setup-managed resume |
| Cline CLI | Yes, file hooks | Lifecycle, prompt, tool, assistant-message, turn, and session-end events | Not exposed by current hook payloads | Yes | Not yet | No setup-managed resume |
| Aider | Yes, opt-in command shim | Prompt, assistant-message, and turn events | Yes, from Aider analytics rows when present | Command shim | Not yet | No setup-managed resume |
| Continue CLI | Yes, opt-in `cn` command shim | Prompt, assistant-message, and turn events | Yes, from Continue session usage metadata when present | Command shim | Not yet | No setup-managed resume |
| Mistral Vibe | Yes, opt-in command shim plus native tool hooks | Prompt, tool, assistant-message, and turn events | Yes, from Vibe session metadata when present | Command shim | Not yet | No setup-managed resume |
| Codebuff | Yes, opt-in command shims and chat-history import | Prompt, assistant-message, turn, and chat-history-derived model events | Yes, from Codebuff chat metadata | Command shim | Codebuff chat history backfill | No setup-managed resume |
| Cursor Desktop | Yes, command hooks | Yes | Cursor DB dependent | Yes | Cursor chat backfill | Yes |
| cursor-agent CLI | Yes, transcript watcher | Tool and turn events | Not exposed by current transcripts | No | Same transcript source | No setup-managed resume |
| Factory Droid | Yes, beta Factory plugin command hooks | Command-level events | Not yet | MCP config and incognito skill | Not yet | Not yet |
| Hermes Agent | Yes, observer plugin hooks | Yes | Usage payloads when present | Yes | Not yet | No setup-managed resume |
| Amp Code | Yes, setup-managed system plugin | Yes | When Amp plugin events expose usage | MCP | Not yet | No setup-managed resume |
| Qwen Code | Yes, native HTTP hooks | Yes | Yes, from usage metadata and transcript fallback | Yes | Not yet | No setup-managed resume |
| OpenHands | Yes, command hooks | Lifecycle, prompt, and tool events | Not exposed by command hook payloads | Yes | Not yet | No setup-managed resume |
| Pi | Yes, TypeScript extension | Yes | Yes | Native tool plus MCP | Pi/OMP session backfill | Yes |
| OpenCode | Yes, plugin SDK events | Yes | Yes | Yes | SQLite backfill | Yes |
| Kilo Code | Yes, plugin SDK events | Yes | Native OTLP traces/logs plus SDK payloads when exposed | Yes | Not yet | No setup-managed resume |
| Kiro CLI | Yes, agent command hooks | Prompt, tool, and assistant-response events | Not exposed by current hook payloads | Yes | Not yet | No setup-managed resume |

For local cost readback and supported-agent fidelity checks, run `trajectory
cost`, `trajectory cost inspect --session <id>`, and `trajectory cost
validate`. The validation command reports recent cost coverage for supported
clients, including token-positive turns that recorded zero cost.

## Recommended vs Manual Installs

`trajectory setup --clients ...` is the recommended path for normal installs
and refreshes because it wires the plugin together with the companion config
each client expects: hooks, MCP entries, skills, commands, local binaries, and
local marketplace metadata. It skips Datadog site, service name, and API key
prompts, so it is also the right path when you only want to add, repair, or
update one client integration.

Direct or local plugin installs remain supported for development and manual recovery. When using a manual path, copy or install the plugin from a stable local location and mirror the companion config that setup would have written. A plugin-only install may load the extension but miss MCP tools, incognito controls, command assets, opt-in command shims, or the capture hooks needed for complete telemetry.

## Codex CLI

**Minimum version: 0.128.0** (latest stable recommended)

Codex 0.128.0 is the first version where plugin-bundled hooks work end-to-end:

- **0.118.0** - Plugin system and hook notifications introduced
- **0.120.0** - SessionStart hooks can distinguish session types; live Stop-hook prompts
- **0.121.0** - `codex plugin marketplace add` command for installing plugin marketplaces
- **0.128.0** - Hooks bundled with marketplace plugins are discovered and fired automatically

Earlier versions may have partial support (marketplace without hook discovery, or hooks without marketplace). For reliable instrumentation, use 0.128.0 or later.

### Codex dual-path capture

Codex uses two capture mechanisms:

1. **Command hooks (primary)** - the plugin's `hooks.json` registers 12 lifecycle hooks using Codex's documented PascalCase hook keys, and each hook invokes the installed `trajectory capture-hook --client codex --ensure-serve` binary path with the same event name. The hook command verifies or starts the matching local capture server before forwarding stdin. For Codex, it also ensures a watcher-capable rescue `serve` process is present, overrides Codex watcher-disable variables for that rescue process, and suppresses unrelated client watchers so the rollout watcher fallback stays available. `TRAJECTORY_DISABLED=1` remains the all-capture suppression switch. Codex accepts `type: "command"` hook entries; it does not accept Claude-style `type: "http"` hook entries.

2. **Rollout watcher (fallback)** - the trajectory binary tails `~/.codex/sessions/` for rollout JSONL files. This captures sessions that started before the plugin was installed, or if hooks aren't firing.

A file-based sentinel system (`~/.trajectory/state/codex-hook-active/`) prevents the watcher from duplicating events that hooks are already capturing. Because Codex command hooks are one-shot processes, the sentinel stays fresh for the serve inactivity window (10 minutes by default, minimum 30 seconds) before the watcher is allowed to take over.

The watcher's quiescence timeout (how long to wait after last activity before declaring a session ended) defaults to 7 days, configurable via `CODEX_WATCHER_QUIESCENCE_TIMEOUT`.

For local development validation, start capture with `trajectory dev serve`. It writes a dev override sentinel so older non-dev serve processes yield the Codex watcher lock, ensuring the rebuilt binary under test owns rollout capture.

`codex exec --ephemeral` disables Codex's session rollout files. Trajectory can still capture those sessions when Codex command hooks are firing, but the rollout watcher fallback cannot recover an ephemeral exec session after the fact.

The Codex marketplace plugin also ships the `/incognito` skill. It uses the `trajectory_incognito` MCP tool to suppress publish to non-exempt Datadog destinations for the current session while local JSONL capture continues.

`trajectory setup --clients codex` writes a local marketplace under `~/.trajectory/codex-marketplace` and registers that local path with Codex. A direct GitHub marketplace registration can still work, but it is not the recommended path for regular installs because Codex refreshes git marketplaces during startup, which can block the first screen on network or GitHub latency.

Setup discovers Codex from `PATH`, common user install directories, Volta, nvm, fnm, npm, pnpm, yarn, asdf, and mise/rtx. For npm-style installs, setup also checks for the vendored native Codex binary before falling back to the node launcher. Each candidate must pass `codex --version`; setup skips broken candidates and uses the first working launcher.

If setup reports that every `codex --version` candidate failed with `ENOENT` under an npm, nvm, fnm, or Volta path, the Codex launcher is present but its bundled native binary is missing. Repair or reinstall the Codex CLI first, or install the standalone/Homebrew Codex binary, then rerun `trajectory setup --clients codex`.

## GitHub Copilot CLI

**Status: Beta, fixture-tested only**

Install the Copilot CLI plugin with setup:

```bash
trajectory setup --clients copilot
```

Setup writes a local Copilot marketplace under `~/.trajectory/copilot-marketplace`, registers it with `copilot plugin marketplace add`, and installs `trajectory@trajectory`. The plugin includes `hooks.json`, `.mcp.json`, and an incognito skill. Copilot launches `trajectory mcp` from the plugin's MCP config; that MCP process starts Trajectory's embedded local capture server, matching the same setup-managed lifecycle path used by other local agents. The hooks are Copilot command hooks that `curl` POST the hook JSON from stdin to `/capture/copilot/<event>`.

Manual fallback from a checkout:

```bash
copilot plugin marketplace add /path/to/trajectory
copilot plugin install trajectory@trajectory
```

Capture is live local CLI capture only. There is no Copilot historical backfill, transcript watcher, cloud-agent capture path, or session import path. The implementation is based on GitHub's public Copilot CLI plugin, MCP, skills, and hooks documentation and is tested with local fixtures that match the documented hook payloads; it has not been validated against a live Copilot CLI install in CI.

Registered documented events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `permissionRequest`, `notification`, `Stop`, `subagentStart`, `SubagentStop`, `ErrorOccurred`, `PreCompact`, and `SessionEnd`. The plugin uses command hooks, not Copilot HTTP hooks, because Copilot requires HTTPS for HTTP hooks that can affect permissions.

## Claude Code

**Minimum version: 2.0+** (plugin marketplace support)

Install with setup:

```bash
trajectory setup --clients cc
```

Setup writes a local Claude Code marketplace under `~/.trajectory/claude-marketplace`, registers that local path with Claude, refreshes the marketplace, then installs the plugin at user scope. If `trajectory@trajectory` is already installed, setup refreshes the marketplace and runs `claude plugin update trajectory@trajectory --scope user` so an existing install moves to the bundled plugin version without requiring GitHub SSH or HTTPS credentials. Claude Code caches installed plugins by version, so the setup-generated marketplace and plugin manifest use Trajectory's bundled Claude plugin version. `trajectory update` also checks installed Claude plugin metadata and refreshes the plugin when the cached version is stale.

Manual fallback after setup has staged the local marketplace:

```bash
claude plugin marketplace add ~/.trajectory/claude-marketplace
claude plugin marketplace update trajectory
claude plugin install trajectory@trajectory --scope user
```

From a source checkout, use the checkout root instead of `~/.trajectory/claude-marketplace`.

The plugin ships the standard Claude `hooks/hooks.json` file with 12 lifecycle
hooks, primarily HTTP, with command shims for startup, shutdown, and serve
lifecycle handling. Claude Code loads that standard hook file automatically; the
plugin manifest intentionally does not list `hooks/hooks.json`, because doing so
would load the same file twice.

Claude `--print` sessions omit `transcript_path`, so Trajectory marks them as
headless. Headless coding-agent sessions are collected and published by default
when export is configured, while sensitivity/classification and segmentation
always skip headless sessions. To opt out for headless agent sessions:

```bash
trajectory config set capture.include_headless_agents false
```

Trajectory-owned classifier and segmenter subprocesses remain suppressed.

## Gemini CLI

**Minimum version: 0.30.0+** (settings, hooks, and commands support)

Install with setup:

```bash
trajectory setup --clients gemini
```

Setup writes `~/.gemini/settings.json`, `~/.gemini/hooks/hooks.json`, `~/.gemini/skills/incognito/SKILL.md`, and `~/.gemini/commands/incognito.toml`. The settings file registers Trajectory MCP, and the hooks file uses command hooks with `curl` to post session events to the local capture server.

The repository still includes `hooks/hooks.json` as a legacy extension command-hook template for older manual installs. Manual extension installs remain supported for development and recovery, but they must match Gemini's hook format and wire MCP, skills, and commands separately. Current setup-managed installs should use `trajectory setup --clients gemini`.

The Gemini skill uses `trajectory_incognito` when MCP is available, and falls back to the `/session/incognito` HTTP endpoint.

## Antigravity CLI (`agy`)

**Minimum version: 1.0.0+** (Antigravity CLI plugin manager and migrated Gemini hook support)

Install with setup:

```bash
trajectory setup --clients agy
```

Setup writes `~/.gemini/antigravity-cli/settings.json` for the Trajectory MCP server and stages a Trajectory plugin under `~/.gemini/config/plugins/trajectory`. The plugin includes `hooks/hooks.json`, `skills/incognito/SKILL.md`, and `commands/incognito.toml`.

The Antigravity hooks use Gemini-compatible event names (`SessionStart`, `BeforeAgent`, `AfterModel`, `BeforeTool`, `AfterTool`, `AfterAgent`, `PreCompress`, `Notification`, and `SessionEnd`) but post to `/capture/agy/<Event>`. The capture server reuses Gemini parsing and token/cost logic while emitting `client_source=agy`.

Manual validation:

```bash
agy plugin validate plugin/trajectory-antigravity
```

Current limitations: no historical Antigravity backfill or setup-managed resume target yet.

## Goose

**Minimum version: 1.39.0 tested** (Open Plugins support)

Install with setup:

```bash
trajectory setup --clients goose
```

Setup writes a Goose Open Plugins package under `~/.agents/plugins/trajectory`
and registers it with Goose. The plugin defines command hooks that post Open
Plugins context JSON to `/capture/goose/<event>`.

Goose live capture covers session start/end, prompts, tool calls, shell and
file events, and assistant-message checkpoints. Historical Goose backfill is
not implemented yet.

## Cline CLI

**Minimum version: 3.0.34 tested** (file hooks and MCP)

Install with setup:

```bash
trajectory setup --clients cline
```

Setup writes Trajectory-owned file hooks under `~/.cline/hooks` or
`$CLINE_DIR/hooks` and registers Trajectory MCP in Cline settings. Existing
user hook files are preserved; setup chooses a supported alternate suffix when
needed. Current Cline hooks expose lifecycle, prompt, tool, assistant summary,
and shutdown payloads, but not stable token or cost usage.

## Aider

**Status: Beta**

Install with setup:

```bash
trajectory setup --clients aider --install-client-shims
```

Aider capture uses an opt-in command shim. Setup writes a managed `aider` shim
under `~/.trajectory/bin`, links it into an existing home bin directory when
possible, and records wrapper metadata under `~/.trajectory/state/aider/`.
The shim passes user arguments through, adds analytics and history sidecars when
not already supplied, and records prompts, assistant messages, token usage, and
cost from Aider's sidecar files when present.

## Continue CLI

**Minimum version: 1.5.47 tested**

Install with setup:

```bash
trajectory setup --clients continue --install-client-shims
```

Continue capture uses an opt-in `cn` command shim. The shim starts or reuses
`trajectory serve`, passes user arguments through, and reads Continue session
JSON after the real CLI exits. Prompt text, assistant text, model, token, and
cost fields are derived from Continue session history when those fields are
present.

## Mistral Vibe

**Status: Beta**

Install with setup:

```bash
trajectory setup --clients mistral-vibe --install-client-shims
```

Mistral Vibe capture uses an opt-in `vibe` command shim plus native
`before_tool` and `after_tool` hook entries in Vibe's hook config. Tool events
come from the native hooks; prompt, assistant-message, token, and cost fields
come from Vibe session metadata when session logging is enabled.

## Codebuff

**Minimum version: 1.0.682 inspected**

Install with setup:

```bash
trajectory setup --clients codebuff --install-client-shims
```

Codebuff capture uses opt-in `codebuff` and `cb` command shims. After the real
CLI exits, Trajectory imports Codebuff `chat-messages.json` rows for the current
project and records prompt, assistant-message, turn, and provider-call events
when usage metadata is present. `trajectory backfill --from-codebuff-chats`
uses the same history import path.

## Cursor

Cursor has two separate products with different capture paths:

### Cursor Desktop (IDE)

**Minimum version: 1.0+** (hooks.json support)

The trajectory setup wizard writes hooks and MCP config directly:

```bash
trajectory setup --clients cursor
```

This creates `~/.cursor/hooks.json` and `~/.cursor/mcp.json`. Capture uses Cursor's supported command hooks to `curl` POST payloads to the Trajectory capture server. Cursor does not currently accept every Claude Code lifecycle hook name; setup registers the supported Cursor event names and omits unsupported lifecycle hooks. When Claude Code is installed, Cursor uses the Claude Code Trajectory skill path for `/incognito`; otherwise setup installs a native Cursor fallback at `~/.cursor/skills/incognito/SKILL.md`. The `incognito` skill uses the shared `trajectory_incognito` MCP tool to suppress publish to non-exempt Datadog destinations for the active Cursor session while local JSONL capture continues.

CI validates this Desktop install surface on macOS by running setup in an isolated home, checking the Cursor MCP/hooks files and incognito skill routing, replaying Cursor Desktop hook payloads into `/capture/cursor`, and verifying the `/session/incognito` sentinel lifecycle. That coverage is separate from the Docker `cursor-agent` test below. Cursor Desktop metrics include tool, turn, session, duration, and per-request cost values; token usage metrics are emitted when Cursor's `state.vscdb` exposes non-zero real token counts.

### cursor-agent (CLI)

cursor-agent is a standalone CLI (`cursor-agent --print` for headless mode). It does NOT support hooks.json. Capture uses a **transcript file watcher** that tails nested transcript files under `~/.cursor/projects/*/agent-transcripts/<session>/*.jsonl`, similar to the Codex rollout watcher.

The watcher starts automatically when `cursor-agent` is on PATH. No manual setup needed - the trajectory binary detects cursor-agent and watches for transcripts. Because the current headless transcript format does not expose token or cost fields, cursor-agent metrics are limited to tool, turn, and session counts until Cursor adds those fields.

Install cursor-agent: `curl -fsSL https://cursor.com/install | bash`

## Pi

**Status: Supported** (headless mode: `pi -p`)

Install the trajectory extension with setup:

```bash
trajectory setup --clients pi
```

Manual fallback from the repo:

```bash
mkdir -p ~/.pi/agent/extensions
cp -R /path/to/trajectory/plugin/trajectory-pi ~/.pi/agent/extensions/trajectory
```

Then point `~/.pi/agent/mcp.json` at `~/.pi/agent/extensions/trajectory/bin/trajectory mcp`.

Setup writes `~/.pi/agent/extensions/trajectory/` and points `~/.pi/agent/mcp.json` at the extension-local `bin/trajectory mcp` command. Pi uses a TypeScript extension API (`pi.on("event", handler)`) that subscribes to lifecycle events (session_start, turn_end, tool_call, tool_result, etc.) and POSTs them to the capture server. Pi also writes key lifecycle events through `capture-hook` for robustness and emits `PostCompact`. The native extension registers `trajectory_status`, `trajectory_flush`, `trajectory_incognito`, `trajectory_schema`, and `trajectory_query`; MCP exposes the shared cross-client tool surface in environments where Pi routes MCP tools. Pi supports multiple LLM providers - use any provider API key for testing.

Pi does not currently consume the Codex/Claude-style `skills/` plugin directory. The Trajectory Pi extension vends incognito through its native `trajectory_incognito` tool; environments that expose MCP can also use the shared `trajectory_incognito` MCP tool.

## Factory Droid

**Status: Beta, fixture-tested only**

Install the Factory Droid plugin with setup:

```bash
trajectory setup --clients droid
```

Setup writes a local Factory marketplace under `~/.trajectory/factory-marketplace`, registers it with `droid plugin marketplace add`, and installs `trajectory@trajectory` at user scope. The plugin includes `hooks/hooks.json`, `mcp.json`, and an incognito skill. Droid launches `trajectory mcp` from the plugin's `mcp.json`; that MCP process starts Trajectory's embedded local capture server, matching the same lifecycle path used by the other setup-managed clients. The hooks themselves stay simple Factory command hooks that `curl` POST the hook JSON from stdin to `/capture/droid/<event>`.

Manual fallback from the repo:

```bash
droid plugin marketplace add /path/to/trajectory
droid plugin install trajectory@trajectory --scope user
```

Capture is live only. There is no Factory/Droid historical backfill, transcript watcher, or session import path. The implementation is based on Factory's public plugin, hook, skills, and MCP documentation and is tested with local fixtures that match the documented hook payloads; it has not been validated against a live Droid install in CI.

Registered documented events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SubagentStop`, `PreCompact`, and `SessionEnd`. Factory's public docs do not currently document `PostToolUseFailure`, `PermissionRequest`, `SubagentStart`, or `PostCompact` for Droid; the server accepts those Claude-compatible names as best-effort future compatibility, but the packaged Droid plugin does not register them.

## Hermes Agent

**Status: Beta, fixture-tested against the public Hermes observer-hook contract**

Install with setup:

```bash
trajectory setup --clients hermes
```

Setup writes a Hermes observer plugin, plugin config, and MCP server entry. The
observer plugin captures lifecycle events such as session start, turn start,
message send, post-model request, tool execution, and session end, then posts
them to `/capture/hermes/<event>`.

Hermes `post_api_request` payloads can include usage fields. Trajectory records
those on the canonical turn events and uses them for tokens and cost when
available. Historical Hermes backfill is not implemented yet.

## Amp Code

**Status: Beta, fixture-tested**

Install with setup:

```bash
trajectory setup --clients amp
```

Setup writes a system TypeScript plugin and MCP entry. Amp plugin lifecycle
events include session start, agent start, tool calls, tool results, and
assistant messages. Trajectory posts them to `/capture/amp/<event>` and stamps
`client_source=amp`.

Amp does not expose a session-end plugin event today, so live sessions end on
Trajectory's idle lifecycle handling. Historical Amp backfill is not
implemented yet.

## Qwen Code

**Minimum version: 0.19.2 tested** (native HTTP hooks and MCP)

Install with setup:

```bash
trajectory setup --clients qwen
```

Setup writes Qwen Code settings, registers Trajectory MCP, and installs native
HTTP hooks. Capture uses Qwen's HTTP hook transport to post events to
`/capture/qwen/<event>`.

Qwen Code supports OpenAI-compatible providers. Trajectory records
`usageMetadata` when Qwen exposes it and can use the current chat JSONL
transcript as a fallback for stop payloads that omit usage. Historical Qwen
backfill is not implemented yet.

## OpenHands

**Status: Beta**

Install with setup:

```bash
trajectory setup --clients openhands
```

Setup writes command hooks to `~/.openhands/hooks.json` and a Trajectory MCP
entry to `~/.openhands/mcp.json`. The hooks use `trajectory capture-hook --client
openhands --ensure-serve` because OpenHands sends hook payload JSON on stdin.
Current OpenHands command hooks cover session start, prompts, tools, stop, and
session end. They do not expose assistant messages or token usage today.

## OpenCode

**Status: Supported** (headless mode: `opencode run`)

Install the trajectory plugin with setup:

```bash
trajectory setup --clients opencode
```

OpenCode uses a plugin SDK (`@opencode-ai/plugin`) with a `server` entrypoint that returns hook handlers for `chat.message`, `tool.execute.before`, `tool.execute.after`, and `event`. The plugin fires capture events via fetch to the trajectory serve endpoint. OpenCode supports multiple LLM providers.

OpenCode supports native agent skills from `.opencode/skills/<name>/SKILL.md`, the configured OpenCode user skills directory, `.agents/skills/<name>/SKILL.md`, and Claude-compatible skills paths. `trajectory setup --clients opencode` installs the Trajectory OpenCode plugin under the resolved OpenCode config directory (`OPENCODE_CONFIG_DIR`, then `XDG_CONFIG_HOME/opencode`, then `~/.config/opencode`), merges that plugin path plus a `trajectory` MCP entry into `opencode.json`, and writes the incognito skill into the global OpenCode skills directory. The skill uses `trajectory_incognito` when MCP is available, and falls back to the `/session/incognito` HTTP endpoint.

Manual fallback: copy `plugin/trajectory-opencode` to `~/.config/opencode/plugins/trajectory` and add that local path to the `plugins` array plus a `trajectory` MCP entry in `~/.config/opencode/opencode.json`.

**Source:** [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)

## Kilo Code

**Status: Beta**

Install with setup:

```bash
trajectory setup --clients kilo
```

Kilo Code is OpenCode-compatible at the plugin surface. Setup installs the
Trajectory Kilo plugin under the resolved Kilo config directory
(`KILO_CONFIG_DIR`, `XDG_CONFIG_HOME/kilo`, then `~/.config/kilo`), adds the
plugin path plus a `trajectory` MCP entry to `opencode.json`, and writes the
incognito skill into the global Kilo skills directory.

The plugin uses SDK events for chat messages, tool execution before/after
events, and lifecycle events. Kilo can also export native OpenTelemetry traces
and logs to Trajectory's local OTLP relay at `http://localhost:4318`.

Manual fallback: copy `plugin/trajectory-kilo` to
`~/.config/kilo/plugins/trajectory` and add that local path to the `plugin`
array plus a `trajectory` MCP entry.

**Source:** [github.com/Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode),
[Kilo CLI docs](https://kilo.ai/docs/code-with-ai/platforms/cli)

## Kiro CLI

**Status: Beta**

Install with setup:

```bash
trajectory setup --clients kiro
```

Setup writes Trajectory-owned Kiro agent configuration under `~/.kiro/agents/`
and merges a Trajectory MCP server into Kiro settings. Kiro command hooks send
payload JSON on stdin for agent spawn, user prompt, tool events, and stop.
Stop payloads include assistant response text, but current documented hook
payloads do not expose stable token or cost usage.

## Version Check

To verify your client version:

```bash
claude --version          # Claude Code
codex --version           # Codex CLI
copilot version           # GitHub Copilot CLI
gemini --version          # Gemini CLI
cursor --version          # Cursor (desktop) / cursor-agent --version (CLI)
goose --version           # Goose
cline --version           # Cline CLI
aider --version           # Aider
cn --version              # Continue CLI
vibe --version            # Mistral Vibe
codebuff --version        # Codebuff
hermes --version          # Hermes Agent
amp --version             # Amp Code
qwen --version            # Qwen Code
openhands --version       # OpenHands
kiro --version            # Kiro CLI
droid --version           # Factory Droid
pi --version              # Pi
opencode --version        # OpenCode (note: takes cwd as argument)
kilo --version            # Kilo Code
```
