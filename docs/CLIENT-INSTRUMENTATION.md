# Client Instrumentation Reference

Trajectory instruments each supported coding agent through that agent's native
plugin, hook, MCP, or transcript surface. All live capture paths normalize into
canonical JSONL under `~/.trajectory/trajectories/` and route through the local
capture server on `localhost:19222` through the transport each client supports.

For installation status and version support, see
[SUPPORTED-CLIENTS.md](SUPPORTED-CLIENTS.md).
For the built-in user-facing client guides, run:

```bash
trajectory user-guide clients
```

## Summary

| Client | Setup path | Live capture surface | Backfill |
|---|---|---|---|
| Claude Code | `trajectory setup --clients cc` | Marketplace plugin hooks plus MCP | Transcript backfill |
| Codex CLI | `trajectory setup --clients codex` | Plugin command hooks plus rollout watcher fallback | Codex rollout backfill |
| GitHub Copilot CLI | `trajectory setup --clients copilot` | Beta plugin command hooks plus MCP | None |
| Gemini CLI | `trajectory setup --clients gemini` | Managed command hooks plus MCP | Gemini transcript backfill |
| Antigravity CLI (`agy`) | `trajectory setup --clients agy` | Antigravity plugin command hooks plus MCP | None |
| Goose | `trajectory setup --clients goose` | Open Plugins command hooks | None |
| Cline CLI | `trajectory setup --clients cline` | File hooks plus MCP | None |
| Aider | `trajectory setup --clients aider --install-client-shims` | Opt-in command shim plus analytics/history sidecars | None |
| Continue CLI | `trajectory setup --clients continue --install-client-shims` | Opt-in `cn` shim plus session JSON readback | None |
| Mistral Vibe | `trajectory setup --clients mistral-vibe --install-client-shims` | Opt-in command shim plus native tool hooks | None |
| Codebuff | `trajectory setup --clients codebuff --install-client-shims` | Opt-in command shims plus chat-history import | Codebuff chat history |
| Cursor Desktop | `trajectory setup --clients cursor` | Cursor command hooks plus MCP | Cursor chat backfill |
| cursor-agent CLI | Automatic when `cursor-agent` is on PATH | Transcript watcher | Same transcript source |
| Factory Droid | `trajectory setup --clients droid` | Beta Factory command hooks plus MCP | None |
| Hermes Agent | `trajectory setup --clients hermes` | Observer Python plugin plus MCP | None |
| Amp Code | `trajectory setup --clients amp` | System TypeScript plugin plus MCP | None |
| Qwen Code | `trajectory setup --clients qwen` | Native HTTP hooks plus MCP | None |
| OpenHands | `trajectory setup --clients openhands` | Command hooks plus MCP | None |
| Pi | `trajectory setup --clients pi` | TypeScript extension plus eager MCP | Pi/OMP session backfill |
| OpenCode | `trajectory setup --clients opencode` | OpenCode plugin SDK events plus MCP | SQLite backfill |
| Kilo Code | `trajectory setup --clients kilo` | Plugin SDK events plus MCP | None |
| Kiro CLI | `trajectory setup --clients kiro` | Agent command hooks plus MCP | None |

## Shared Local Flow

Live hook integrations post payloads to:

```text
http://localhost:19222/capture/<client>/<event>
```

or to a client-specific capture endpoint that maps native events to canonical
Trajectory events. The capture server writes JSONL locally first. Publish,
markers, metrics, diagnosis, and local UI indexing derive from local capture.

The setup-managed clients also install or register the companion pieces needed
for the client:

- MCP entries that expose Trajectory tools and resources for local
  introspection.
- Agent skills or slash commands where the client supports them.
- Local marketplace metadata for plugin-based clients.
- Opt-in command shims for clients that do not expose native hooks.
- An installed or extension-local `trajectory` binary path where the client
  expects one.

Plugin-only manual installs can miss these companion pieces. Use
`trajectory setup --clients <client>` for normal installs and refreshes. That
client-only path updates hooks, MCP entries, skills, commands, opt-in command
shims, local binaries, and local marketplace files without prompting for
Datadog site, service name, or API key values. Run `trajectory setup` without
`--clients` when you want to change export settings.

The authoritative MCP catalog, including safe query examples, is embedded in
the binary:

```bash
trajectory user-guide mcp
```

Compact MCP surface:

| Surface | Names |
|---|---|
| Session/status tools | `trajectory_status`, `list_active_sessions`, `get_session_trajectory` |
| Evaluation/privacy tools | `evaluate_markers`, `trajectory_incognito` |
| SQLite tools | `trajectory_schema`, `trajectory_query` |
| Resources | `trajectory://status`, `trajectory://config`, `trajectory://sqlite/schema` |

Agents should call `trajectory_schema` before `trajectory_query` so SQL matches
the live local-ui database selected by `TRAJECTORY_CACHE_DB` or the default
cache path.

## Claude Code

Setup writes a local Claude Code marketplace under
`~/.trajectory/claude-marketplace`, registers it, refreshes it, and installs or
updates `trajectory@trajectory` at user scope. Claude Code caches installed
plugins by plugin version, so setup generates the local marketplace and plugin
manifest with Trajectory's bundled Claude plugin version. `trajectory update`
can also refresh an already installed Claude plugin after the binary is current
when it detects stale cached plugin metadata.

The plugin ships Claude `hooks/hooks.json`, which Claude Code loads
automatically from that standard path. Those lifecycle hooks post to the local
capture server. The registered permission hooks include `PermissionRequest`
and `PermissionDenied`; `PermissionDenied` records auto-mode classifier denials
without relying on latency inference. Claude Code supports native HTTP hook entries, so most lifecycle
events use HTTP hooks. The plugin manifest intentionally omits a `hooks` entry
for `hooks/hooks.json` to avoid duplicate hook-file loading. The plugin also
carries MCP configuration and skills, including `/incognito`.

Claude `--print` sessions omit `transcript_path`, so Trajectory marks them as
headless. Headless coding-agent sessions are collected and published by default
when export is configured, while sensitivity/classification and segmentation
always skip headless sessions. To opt out for headless agent sessions:

```bash
trajectory config set capture.include_headless_agents false
```

Trajectory-owned classifier and segmenter subprocesses remain suppressed.

Verify:

```bash
claude plugin list
trajectory doctor
```

## Codex CLI

Setup writes a local Codex marketplace under `~/.trajectory/codex-marketplace`
and registers it with Codex. The plugin provides command hooks that invoke the
installed `trajectory capture-hook --client codex --ensure-serve` binary path,
MCP configuration, and the `/incognito` skill. Codex hook configs must use
`type: "command"`; `type: "http"` is not a supported Codex hook variant.

Codex also has a rollout watcher fallback that tails `~/.codex/sessions/`.
When `capture-hook --ensure-serve` runs for Codex, it ensures a
watcher-capable rescue `serve` process is present so the rollout fallback stays
available. For that rescue process only, it overrides Codex watcher-disable
environment variables and suppresses unrelated client watchers;
`TRAJECTORY_DISABLED=1` still suppresses all capture.
Hook-active sentinels under `~/.trajectory/state/codex-hook-active/` prevent
the watcher from duplicating events while live hooks are firing.

Verify:

```bash
codex mcp list
trajectory doctor
```

## GitHub Copilot CLI

Setup writes a local Copilot marketplace under
`~/.trajectory/copilot-marketplace`, registers it, and installs
`trajectory@trajectory`. The plugin includes command hooks, `.mcp.json`, and an
incognito skill.

Capture is beta live CLI capture only. There is no Copilot historical backfill
or transcript import path.

## Gemini CLI

Setup writes:

```text
~/.gemini/settings.json
~/.gemini/hooks/hooks.json
~/.gemini/skills/incognito/SKILL.md
~/.gemini/commands/incognito.toml
```

`settings.json` registers Trajectory MCP. `hooks.json` uses command hooks with
`curl` to post supported Gemini events to the capture server. The skill and
command expose `/incognito` with an MCP path and HTTP fallback.

## Antigravity CLI

Setup writes:

```text
~/.gemini/antigravity-cli/settings.json
~/.gemini/config/plugins/trajectory/plugin.json
~/.gemini/config/plugins/trajectory/hooks/hooks.json
~/.gemini/config/plugins/trajectory/skills/incognito/SKILL.md
~/.gemini/config/plugins/trajectory/commands/incognito.toml
```

`settings.json` registers Trajectory MCP. The plugin hooks use Antigravity's
Gemini-compatible hook events and post to `/capture/agy/...`. The server reuses
Gemini parsing and token/cost handling, but stamps `client_source=agy`.
Historical Antigravity backfill is not implemented yet.

## Goose

Setup writes a Goose Open Plugins package under
`~/.agents/plugins/trajectory/` and registers command hooks for session,
prompt, tool, shell, file, and assistant-message events. The hooks post
Goose's Open Plugins context JSON to `/capture/goose/...` through the local
Trajectory server.

Goose sessions are live capture only for now. Provider usage is recorded when
Goose exposes it through hook payloads; historical import from Goose's local
SQLite history is not implemented yet.

Verify:

```bash
goose plugin list
trajectory doctor
```

## Cline CLI

Setup writes Trajectory-owned file hooks under `~/.cline/hooks` or
`$CLINE_DIR/hooks`, plus Trajectory MCP settings. Existing user hook files are
preserved. The hook scripts invoke `trajectory capture-hook --client cline
--ensure-serve` and send stdin payloads to `/capture/cline/<event>`.

Captured rows use `client_source=cline`. Current Cline hooks expose lifecycle,
prompt, tool, assistant summary, and shutdown payloads, but not stable token or
cost usage.

## Aider

Aider capture uses an opt-in command shim. Setup writes a managed `aider` shim
under `~/.trajectory/bin` and wrapper metadata under
`~/.trajectory/state/aider/`. The shim invokes the real Aider binary, starts or
reuses `trajectory serve`, and adds analytics and history sidecars when the
user has not already supplied them.

The shim posts session, prompt, assistant-message, turn, and session-end events.
Token and cost fields come from Aider analytics rows when present.

## Continue CLI

Continue capture uses an opt-in `cn` command shim. Setup writes wrapper metadata
under `~/.trajectory/state/continue/`. The shim invokes the real Continue CLI,
sets a Trajectory session id for new sessions, and reads Continue session JSON
after the real process exits.

Prompt text, assistant text, model, tokens, and cost are derived from Continue
session history when those fields are present.

## Mistral Vibe

Mistral Vibe capture uses an opt-in `vibe` command shim plus native
`before_tool` and `after_tool` hook entries. The shim starts or reuses
`trajectory serve`, enables Vibe experimental hooks for the wrapped process,
and reads Vibe session logs after the run.

Trajectory records prompt, tool, assistant-message, turn, and session-end events
with `client_source=mistral-vibe`. Token and cost fields come from Vibe session
metadata when session logging is enabled.

## Codebuff

Codebuff capture uses opt-in `codebuff` and `cb` command shims. The shim invokes
the real Codebuff binary unchanged, then imports any Codebuff
`chat-messages.json` rows written for the current project. `CODEBUFF_DATA_DIR`
can override the default Codebuff history roots.

The shim and `trajectory backfill --from-codebuff-chats` emit session, prompt,
assistant-message, turn, and session-end events. When Codebuff history contains
provider usage metadata, Trajectory normalizes token usage and emits
provider-call rows.

## Cursor

Cursor has two distinct capture paths.

Cursor Desktop uses setup-managed `~/.cursor/hooks.json` and
`~/.cursor/mcp.json`. Command hooks post Cursor payloads to `/capture/cursor/...`.
Cursor does not accept every Claude lifecycle hook name, so setup writes only
the supported Cursor event set. If Claude Code is not installed, setup also
writes `~/.cursor/skills/incognito/SKILL.md`.

cursor-agent CLI does not support `hooks.json`. Trajectory watches nested
transcript files under `~/.cursor/projects/*/agent-transcripts/` when
`cursor-agent` is present on `PATH`. Current cursor-agent transcripts do not
expose token or cost fields, so metrics are limited to activity that can be
derived from transcript structure.

## Factory Droid

Setup writes a local Factory marketplace under
`~/.trajectory/factory-marketplace`, registers it with Droid, and installs
`trajectory@trajectory`. The plugin includes command hooks, `mcp.json`, and an
incognito skill.

Capture is beta live CLI capture only. There is no Factory/Droid historical
backfill or transcript import path.

## Hermes Agent

Setup writes a Hermes observer plugin and config entry so Hermes can notify
Trajectory about session, model, tool, and API-request lifecycle events.
Hermes discovers the plugin from its configured plugin roots, and the plugin
posts observer payloads to the local capture server without blocking normal
Hermes behavior.

The Go capture runtime records `client_source=hermes`, preserves Hermes
observer turn identifiers, and uses native Hermes `usage` payloads for token
and cost values when present. Historical Hermes import is not implemented yet.

## Amp Code

Setup writes a system TypeScript plugin plus MCP configuration for Amp Code.
Amp lifecycle events such as session start, agent start, tool calls, tool
results, and assistant messages are normalized as `client_source=amp` events.
Token and cost fields are preserved when Amp exposes them.

Amp does not expose a session-end plugin event today, so live sessions end on
Trajectory's idle lifecycle handling. Historical Amp thread import is not
implemented yet.

## Qwen Code

Setup writes Qwen Code settings for Trajectory MCP plus native HTTP hooks.
Capture uses Qwen's hook transport directly rather than command-line curl
shims, and Qwen payloads are normalized as `client_source=qwen` events.

Qwen Code supports OpenAI-compatible providers. Trajectory records Qwen
`usageMetadata` when present and can read the current chat JSONL transcript as
a fallback for stop payloads that omit usage. Historical Qwen import is not
implemented yet.

## OpenHands

Setup writes command hooks to `~/.openhands/hooks.json` and a Trajectory MCP
server entry to `~/.openhands/mcp.json`. The hooks invoke `trajectory
capture-hook --client openhands --ensure-serve` because OpenHands sends hook
payload JSON on stdin.

Current OpenHands command hooks cover session start, prompts, tools, stop, and
session end. They do not expose assistant messages or token usage today.

## Pi

Setup writes `~/.pi/agent/extensions/trajectory/` and points
`~/.pi/agent/mcp.json` at the extension-local `bin/trajectory mcp` command.

The Pi TypeScript extension subscribes to lifecycle events such as session
start, message end, tool call, tool result, turn end, compaction, model change,
fork, and session shutdown. Key events also write through `trajectory
capture-hook` for robustness when a short-lived `pi --print` process exits
before async HTTP posting completes.

Pi exposes native Trajectory tools through the extension and can use the shared
MCP catalog when the environment supports MCP. It does not install a
`hooks.json` file.

## OpenCode

Setup installs the OpenCode plugin under the resolved OpenCode config
directory, merges the plugin path plus a `trajectory` MCP entry into
`opencode.json`, and writes the incognito skill into the OpenCode skills
directory.

The plugin SDK events cover chat messages, tool execution before/after events,
and lifecycle events. Historical import uses OpenCode SQLite databases. OpenCode
does not install a `hooks.json` file.

## Kilo Code

Setup installs the Kilo Code plugin under the resolved Kilo config directory
(`KILO_CONFIG_DIR`, then `XDG_CONFIG_HOME/kilo`, then `~/.config/kilo`), adds
the plugin path to `opencode.json`, writes a `trajectory` MCP entry, and
installs the global incognito skill.

Kilo Code is OpenCode-compatible at the plugin surface. The Trajectory plugin
uses SDK events for chat messages, tool execution before/after events, and
lifecycle events. It also supports native OpenTelemetry export: point Kilo's
OTLP endpoint at `http://localhost:4318` to relay native traces and logs
through the local Trajectory OTLP relay.

Manual fallback: copy `plugin/trajectory-kilo` to
`~/.config/kilo/plugins/trajectory` and add that absolute path to Kilo's
`plugin` array plus a `trajectory` MCP entry.

## Kiro CLI

Setup writes Trajectory-owned Kiro agent configuration under `~/.kiro/agents/`
and merges a Trajectory MCP server into Kiro settings. Kiro command hooks pass
payload JSON on stdin for agent spawn, user prompt, tool events, and stop.

Captured rows use `client_source=kiro`. Stop payloads include assistant response
text, but current documented hook payloads do not expose stable token or cost
usage.

## Troubleshooting

Start with:

```bash
trajectory doctor
trajectory config show
trajectory publish status
trajectory logs --grep capture
```

If no data appears, verify that the client-specific plugin or hooks exist, the
capture server is reachable on the configured port, and `trajectory status`
shows recent local sessions before investigating Datadog publish.
