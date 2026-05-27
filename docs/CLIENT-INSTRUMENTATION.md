# Client Instrumentation Reference

Trajectory instruments each supported coding agent through that agent's native
plugin, hook, MCP, or transcript surface. All live capture paths normalize into
canonical JSONL under `~/.trajectory/trajectories/` and route through the local
capture server on `localhost:19222` when live HTTP capture is available.

For installation status and version support, see
[SUPPORTED-CLIENTS.md](SUPPORTED-CLIENTS.md).

## Summary

| Client | Setup path | Live capture surface | Backfill |
|---|---|---|---|
| Claude Code | `trajectory setup --clients cc` | Marketplace plugin hooks plus MCP | Transcript backfill |
| Codex CLI | `trajectory setup --clients codex` | Plugin HTTP hooks plus rollout watcher fallback | Codex rollout backfill |
| Gemini CLI | `trajectory setup --clients gemini` | Managed command hooks plus MCP | Gemini transcript backfill |
| Cursor Desktop | `trajectory setup --clients cursor` | Cursor command hooks plus MCP | Cursor chat backfill |
| cursor-agent CLI | Automatic when `cursor-agent` is on PATH | Transcript watcher | Same transcript source |
| Pi | `trajectory setup --clients pi` | TypeScript extension plus eager MCP | Pi/OMP session backfill |
| OpenCode | `trajectory setup --clients opencode` | OpenCode plugin SDK hooks plus MCP | SQLite backfill |

## Feature Coverage Matrix

| Client | Live capture | Tool/model events | Token/cost usage | Incognito or MCP | Backfill | Resume |
|---|---|---|---|---|---|---|
| Claude Code | HTTP hooks | Yes | Yes | Yes | Transcript backfill | Yes |
| Codex CLI | HTTP hooks plus rollout watcher fallback | Yes | Yes | Yes | Codex rollout backfill | Yes |
| Gemini CLI | Managed hooks | Yes | Yes | Yes | Gemini transcript backfill | Yes |
| Cursor Desktop | Command hooks | Yes | Cursor DB dependent | Yes | Cursor chat backfill | Yes |
| cursor-agent CLI | Transcript watcher | Tool and turn events | Not exposed by current transcripts | No | Same transcript source | No setup-managed resume |
| Pi | TypeScript extension | Yes | Yes | Native tool plus MCP | Pi/OMP session backfill | Yes |
| OpenCode | Plugin SDK hooks | Yes | Yes | Yes | SQLite backfill | Yes |

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

- MCP entries that expose Trajectory tools such as status, sessions, markers,
  and incognito.
- Agent skills or slash commands where the client supports them.
- Local marketplace metadata for plugin-based clients.
- An installed or extension-local `trajectory` binary path where the client
  expects one.

Plugin-only manual installs can miss these companion pieces. Use
`trajectory setup --clients <client>` for normal installs.

## Claude Code

Setup writes a local Claude Code marketplace under
`~/.trajectory/claude-marketplace`, registers it, refreshes it, and installs or
updates `trajectory@trajectory` at user scope. If the plugin is already
installed, setup updates it from the local marketplace instead of requiring a
remote marketplace refresh.

The plugin registers Claude lifecycle hooks that post to the local capture
server. The plugin also carries MCP configuration and skills, including
`/incognito`.

Verify:

```bash
claude plugin list
trajectory doctor
```

## Codex CLI

Setup writes a local Codex marketplace under `~/.trajectory/codex-marketplace`
and registers it with Codex. The local marketplace avoids remote startup sync in
normal use and contains the hook plugin plus bundled skills.

The plugin provides HTTP hooks, MCP configuration, and the `/incognito` skill.
Codex also has a rollout watcher fallback that tails `~/.codex/sessions/`.
Hook-active sentinels under `~/.trajectory/state/codex-hook-active/` prevent
the watcher from duplicating events while live hooks are firing.

Setup discovers Codex from `PATH`, common user install directories, Volta, nvm,
fnm, npm, pnpm, yarn, asdf, and mise/rtx. For npm-style installs, setup also
checks for the vendored native Codex binary before falling back to the node
launcher. Each candidate must pass `codex --version`; setup skips broken
candidates and uses the first working launcher.

Verify:

```bash
codex mcp list
trajectory doctor
```

## Gemini CLI

Setup writes:

```text
~/.gemini/settings.json
~/.gemini/hooks/hooks.json
~/.gemini/skills/incognito/SKILL.md
~/.gemini/commands/incognito.toml
```

`settings.json` registers Trajectory MCP. `hooks.json` posts supported Gemini
events to the capture server. The skill and command expose `/incognito` with an
MCP path and HTTP fallback.

## Cursor

Cursor has two distinct capture paths.

Cursor Desktop uses setup-managed `~/.cursor/hooks.json` and
`~/.cursor/mcp.json`. Hooks post Cursor payloads to `/capture/cursor/...`.
Cursor does not accept every Claude lifecycle hook name, so setup writes only
the supported Cursor event set. If Claude Code is not installed, setup also
writes `~/.cursor/skills/incognito/SKILL.md`.

Cursor Desktop metrics include tool, turn, session, duration, and per-request
cost values. Token usage metrics are emitted when Cursor's `state.vscdb`
exposes non-zero real token counts.

cursor-agent CLI does not support `hooks.json`. Trajectory watches nested
transcript files under `~/.cursor/projects/*/agent-transcripts/` when
`cursor-agent` is present on `PATH`. Current cursor-agent transcripts do not
expose token or cost fields, so metrics are limited to activity that can be
derived from transcript structure.

## Pi

Setup writes `~/.pi/agent/extensions/trajectory/` and points
`~/.pi/agent/mcp.json` at the extension-local `bin/trajectory mcp` command.

The Pi TypeScript extension subscribes to lifecycle events such as session
start, message end, tool call, tool result, turn end, compaction, model change,
fork, and session shutdown. Key events also write through `trajectory
capture-hook` for robustness when a short-lived `pi --print` process exits
before async HTTP posting completes.

Pi exposes `trajectory_status`, `trajectory_flush`, and
`trajectory_incognito` as native tools.

## OpenCode

Setup installs the OpenCode plugin under the resolved OpenCode config
directory, merges the plugin path plus a `trajectory` MCP entry into
`opencode.json`, and writes the incognito skill into the OpenCode skills
directory.

The plugin SDK hooks cover chat messages, tool execution before/after events,
and lifecycle events. Historical import uses OpenCode SQLite databases.

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
