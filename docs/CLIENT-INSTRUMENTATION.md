# Client Instrumentation Reference

Trajectory instruments each supported coding agent through that agent's native
plugin, hook, MCP, or transcript surface. All live capture paths normalize into
canonical JSONL under `~/.trajectory/trajectories/` and route through the local
capture server on `localhost:19222` through the transport each client supports.

For installation status and version support, see
[SUPPORTED-CLIENTS.md](SUPPORTED-CLIENTS.md).

## Summary

| Client | Setup path | Live capture surface | Backfill |
|---|---|---|---|
| Claude Code | `trajectory setup --clients cc` | Marketplace plugin hooks plus MCP | Transcript backfill |
| Codex CLI | `trajectory setup --clients codex` | Plugin command hooks plus rollout watcher fallback | Codex rollout backfill |
| GitHub Copilot CLI | `trajectory setup --clients copilot` | Beta plugin command hooks plus MCP | None |
| Gemini CLI | `trajectory setup --clients gemini` | Managed command hooks plus MCP | Gemini transcript backfill |
| Cursor Desktop | `trajectory setup --clients cursor` | Cursor command hooks plus MCP | Cursor chat backfill |
| cursor-agent CLI | Automatic when `cursor-agent` is on PATH | Transcript watcher | Same transcript source |
| Factory Droid | `trajectory setup --clients droid` | Beta Factory command hooks plus MCP | None |
| Pi | `trajectory setup --clients pi` | TypeScript extension plus eager MCP | Pi/OMP session backfill |
| OpenCode | `trajectory setup --clients opencode` | OpenCode plugin SDK events plus MCP | SQLite backfill |

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
- An installed or extension-local `trajectory` binary path where the client
  expects one.

Plugin-only manual installs can miss these companion pieces. Use
`trajectory setup --clients <client>` for normal installs.

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
updates `trajectory@trajectory` at user scope.

The plugin registers Claude lifecycle hooks that post to the local capture
server. Claude Code supports native HTTP hook entries, so most lifecycle events
use HTTP hooks. The plugin also carries MCP configuration and skills, including
`/incognito`.

Verify:

```bash
claude plugin list
trajectory doctor
```

## Codex CLI

Setup writes a local Codex marketplace under `~/.trajectory/codex-marketplace`
and registers it with Codex. The plugin provides command hooks that use `curl`
to post to the local capture server, MCP configuration, and the `/incognito`
skill. Codex hook configs must use `type: "command"`; `type: "http"` is not a
supported Codex hook variant.

Codex also has a rollout watcher fallback that tails `~/.codex/sessions/`.
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
`trajectory@trajectory`. The plugin includes command hooks, MCP config, and an
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
`trajectory@trajectory`. The plugin includes command hooks, MCP config, and an
incognito skill.

Capture is beta live CLI capture only. There is no Factory Droid historical
backfill or transcript import path.

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
