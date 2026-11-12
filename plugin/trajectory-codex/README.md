# Trajectory Codex Plugin

This is the Codex marketplace plugin for Trajectory agent observability.

## What It Does

- **Hooks.** The compatible hook set covers 11 supported lifecycle events.
  Setup generates a local plugin with 13 stable handlers. `PreToolUse` and
  `PostToolUse` each get a permanent Bash-only handler and an all-tools
  handler.
- **Boundary mode.** Boundary mode enables `SessionStart`, `UserPromptSubmit`,
  `Stop`, and `SessionEnd`, plus the paired Bash-only tool hooks. It takes
  event detail and turn completion from the Codex rollout file. It uses the
  paired hooks only to take Git snapshots right away for PR work.
- **MCP server.** The server provides introspection tools for status,
  sessions, queries, incognito, flush, and markers.
- **`/incognito` skill.** The skill stops sending the current session's trace
  and log content to Datadog destinations, except exempt ones. Trajectory still
  records events locally to JSONL. It still sends accounting and activity
  metrics, without model and repository names by default.

## How Capture Works

Codex capture uses two sources:

- **Hooks.** Four lifecycle and turn hooks, plus the paired Bash-only tool
  hooks, mark the order of events. The tool hooks take Git snapshots right
  before and after each command.
- **Rollout files.** Codex writes rollout JSONL under `~/.codex/sessions/`.
  It supplies tool phases, assistant messages, reasoning, permissions,
  compaction, subagent activity, model and token metadata, and
  `shutdown_complete`.

`trajectory serve` merges the two sources. It then writes normalized session
JSONL under `~/.trajectory/trajectories/`.

The `SessionEnd` hook and the watcher's `shutdown_complete` record both lead
to the same session-end step. That step runs once the session is quiet.

Codex gives each hook at most three seconds. Every hook leaves spare time
inside that limit. Slow fallback work or automatic-update work continues in a
detached process after the hook returns. Trajectory can still repair the end
of a session from `shutdown_complete`. It retries a pending automatic update
later.

The built-in Codex watcher tails rollout files. It is a fallback in two cases:

- the session started before you installed the plugin
- hooks cannot notify the local server

Codex hooks use the `trajectory capture-hook` command. They do not call `curl`
directly or append raw JSONL. The server merge step handles checkpoint
reconciliation, duplicate suppression, the rollout read position, and token
and model enrichment.

Boundary mode reads every complete rollout record. It saves its read position
only after Trajectory has stored the record.

Setup and update keep all eleven hooks while one of these capture servers is
running:

- an older server
- a server that uses a different Trajectory home
- a server that Trajectory cannot identify

An updated server switches to paired boundary mode by itself. It does this
after it confirms that it supports the same home.

`codex exec --ephemeral` writes no rollout, so boundary mode cannot get its
per-tool detail. Manual plugin installs do not get per-hook state from setup.
They use the full set of eleven hooks.

For CLI usage, run `trajectory user-guide` or see `docs/USER-GUIDE.md`.

## Prerequisites

Install the Trajectory binary before you use this plugin:

```bash
bash install.sh
```

Or install it from the GitHub repository:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.sh)
```

## Install

Use setup to install the plugin:

```bash
trajectory setup --clients codex
```

Setup writes a local Codex marketplace under `~/.trajectory/codex-marketplace`
and registers that local path. It also makes the Trajectory MCP tools available
in Codex sessions.

### Manual Install

You can still install from a local marketplace for development and recovery.

1. Use a stable local marketplace path with the same layout as
   `~/.trajectory/codex-marketplace`.
2. Point the plugin hooks, the bundled `.mcp.json`, the skills, and the Codex
   MCP registration at the installed Trajectory binary.

```bash
codex plugin marketplace add /path/to/local/codex-marketplace
codex mcp add trajectory -- /absolute/path/to/trajectory mcp
```

A remote GitHub marketplace registration can still work. For regular installs,
use the local marketplace from setup instead. Codex refreshes git marketplaces
at startup. That refresh can add network or GitHub delay before the first
screen appears.
