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
```

## Quick Reference

| Client | Install | Min Version | Capture |
|--------|---------|-------------|---------|
| Claude Code | `trajectory setup --clients cc` | 2.0+ | HTTP hooks + MCP |
| Codex CLI | `trajectory setup --clients codex` | 0.128.0 | Command hooks (primary) + rollout watcher (fallback) |
| GitHub Copilot CLI | `trajectory setup --clients copilot` | Beta | Copilot plugin command hooks + MCP |
| Gemini CLI | `trajectory setup --clients gemini` | 0.30.0+ | Managed command hooks + MCP |
| Cursor Desktop | `trajectory setup --clients cursor` | 1.0+ | Command hooks that POST to capture |
| cursor-agent CLI | Automatic when `cursor-agent` is on PATH | Beta | Transcript watcher |
| Factory Droid | `trajectory setup --clients droid` | Beta | Factory plugin command hooks + MCP |
| Pi | `trajectory setup --clients pi` | Beta | TypeScript extension + MCP |
| OpenCode | `trajectory setup --clients opencode` | Beta | Plugin SDK events + MCP |
| OpenClaw | OpenClaw plugin package + optional-client binary | Beta | Plugin SDK hooks + runtime binary resolver |

## Feature Coverage Matrix

| Client | Live capture | Tool/model events | Token/cost usage | Incognito or MCP | Backfill | Resume |
|--------|--------------|-------------------|------------------|------------------|----------|--------|
| Claude Code | Yes, HTTP hooks | Yes | Yes | Yes | Transcript backfill | Yes |
| Codex CLI | Yes, command hooks plus rollout watcher fallback | Yes | Yes | Yes | Codex rollout backfill | Yes |
| Gemini CLI | Yes, managed command hooks | Yes | Yes | Yes | Gemini transcript backfill | Yes |
| Cursor Desktop | Yes, command hooks | Yes | Cursor DB dependent | Yes | Cursor chat backfill | Yes |
| cursor-agent CLI | Yes, transcript watcher | Tool and turn events | Not exposed by current transcripts | No | Same transcript source | No setup-managed resume |
| Pi | Yes, TypeScript extension | Yes | Yes | Native tool plus MCP | Pi/OMP session backfill | Yes |
| OpenCode | Yes, plugin SDK events | Yes | Yes | Yes | SQLite backfill | Yes |
| OpenClaw | Capture beta, plugin SDK hooks | Yes, with conversation access for prompts/responses | Token usage when OpenClaw hook payloads expose it; cost is estimated downstream or passed through when present | Not yet | Not yet | Not in scope |

OpenClaw support in this repository is intentionally scoped to live capture for
now. The server-side endpoint is excluded from default Trajectory binaries and
compiled only with the neutral `optionalclients` build tag. It adds a
Trajectory `/capture/openclaw` endpoint and a plugin package that maps OpenClaw
hooks into canonical Trajectory events; it does not add OpenClaw historical
import, setup-managed install, or resume support.

## Recommended vs Manual Installs

`trajectory setup --clients ...` is the recommended path for normal installs because it wires the plugin together with the companion config each client expects: hooks, MCP entries, skills, commands, local binaries, and local marketplace metadata.

Direct or local plugin installs remain supported for development and manual recovery. When using a manual path, copy or install the plugin from a stable local location and mirror the companion config that setup would have written. A plugin-only install may load the extension but miss MCP tools, incognito controls, command assets, or the capture hooks needed for complete telemetry.

OpenClaw is the current exception: its plugin package plus a Trajectory binary
built with `-tags optionalclients` is the supported beta install surface for
live capture until setup-managed install is added.

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

1. **Command hooks (primary)** - the plugin's `hooks.json` registers 12 lifecycle hooks that use `curl` to POST stdin to the trajectory capture server. Codex accepts `type: "command"` hook entries; it does not accept Claude-style `type: "http"` hook entries.

2. **Rollout watcher (fallback)** - the trajectory binary tails `~/.codex/sessions/` for rollout JSONL files. This captures sessions that started before the plugin was installed, or if hooks aren't firing.

A file-based sentinel system (`~/.trajectory/state/codex-hook-active/`) prevents the watcher from duplicating events that hooks are already capturing. If the hook process dies, the sentinel goes stale (>30s) and the watcher takes over automatically.

The watcher's quiescence timeout (how long to wait after last activity before declaring a session ended) defaults to 7 days, configurable via `CODEX_WATCHER_QUIESCENCE_TIMEOUT`.

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

Setup writes a local Claude Code marketplace under `~/.trajectory/claude-marketplace`, registers that local path with Claude, refreshes the marketplace, then installs the plugin at user scope. If `trajectory@trajectory` is already installed, setup refreshes the marketplace and runs `claude plugin update trajectory@trajectory --scope user` so an existing install moves to the bundled plugin version without requiring GitHub SSH or HTTPS credentials.

Manual fallback after setup has staged the local marketplace:

```bash
claude plugin marketplace add ~/.trajectory/claude-marketplace
claude plugin marketplace update trajectory
claude plugin install trajectory@trajectory --scope user
```

From a source checkout, use the checkout root instead of `~/.trajectory/claude-marketplace`.

The plugin registers 12 lifecycle hooks, primarily HTTP, with command shims for startup, shutdown, and serve lifecycle handling.

## Gemini CLI

**Minimum version: 0.30.0+** (settings, hooks, and commands support)

Install with setup:

```bash
trajectory setup --clients gemini
```

Setup writes `~/.gemini/settings.json`, `~/.gemini/hooks/hooks.json`, `~/.gemini/skills/incognito/SKILL.md`, and `~/.gemini/commands/incognito.toml`. The settings file registers Trajectory MCP, and the hooks file uses command hooks with `curl` to post session events to the local capture server.

The repository still includes `hooks/hooks.json` as a legacy extension command-hook template for older manual installs. Manual extension installs remain supported for development and recovery, but they must match Gemini's hook format and wire MCP, skills, and commands separately. Current setup-managed installs should use `trajectory setup --clients gemini`.

The Gemini skill uses `trajectory_incognito` when MCP is available, and falls back to the `/session/incognito` HTTP endpoint.

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

Setup writes `~/.pi/agent/extensions/trajectory/` and points `~/.pi/agent/mcp.json` at the extension-local `bin/trajectory mcp` command. Pi uses a TypeScript extension API (`pi.on("event", handler)`) that subscribes to lifecycle events (session_start, turn_end, tool_call, tool_result, etc.) and POSTs them to the capture server. Pi also writes key lifecycle events through `capture-hook` for robustness and emits `PostCompact`. Pi supports multiple LLM providers - use any provider API key for testing.

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

## OpenClaw

**Status: Capture beta** (live capture path: OpenClaw plugin hooks)

OpenClaw uses a plugin SDK with typed lifecycle, model, tool, compaction, and
session hooks. The Trajectory plugin lives in `plugin/trajectory-openclaw` and
maps those hooks into `/capture/openclaw/...` so events are attributed as
`client_source=openclaw`.

The npm or ClawHub package installs the JavaScript plugin; the Go `trajectory`
binary remains a separate executable and must include the optional-client build
tag. At runtime, the plugin prefers a configured `captureUrl`, then a
configured or existing binary, then `~/.trajectory/bin/trajectory`, then
`trajectory` on `PATH`. `binaryInstallMode=auto` is explicit opt-in and should
only target a release channel that publishes optional-client binaries.

For full prompt, response, token, and cost capture, external OpenClaw installs
must opt in to raw conversation hooks:

```json
{
  "plugins": {
    "entries": {
      "trajectory-openclaw": {
        "hooks": {
          "allowConversationAccess": true
        }
      }
    }
  }
}
```

Backfill and resume are intentionally out of scope for this plugin. The
OpenClaw plugin is scoped to live capture; historical OpenClaw session import,
sidecar import, and any future resume adapter should be implemented under
Trajectory CLI packages rather than hidden in plugin startup.

## Version Check

To verify your client version:

```bash
claude --version          # Claude Code
codex --version           # Codex CLI
copilot version           # GitHub Copilot CLI
gemini --version          # Gemini CLI
cursor --version          # Cursor (desktop) / cursor-agent --version (CLI)
droid --version           # Factory Droid
pi --version              # Pi
opencode --version        # OpenCode (note: takes cwd as argument)
openclaw --version        # OpenClaw
```
