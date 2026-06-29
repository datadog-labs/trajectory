# Trajectory Codex Plugin

Codex marketplace plugin for trajectory agent observability.

## What It Does

- **12 lifecycle hooks** capture every session event (tool calls, prompts, compaction, subagents) with foreground command hooks that invoke the installed `trajectory capture-hook --client codex --ensure-serve` binary path
- **MCP server** provides introspection tools (status, sessions, queries, incognito, flush, markers)
- **`/incognito` skill** toggles publish suppression for the current session while local JSONL capture continues

Codex capture is intentionally hybrid. Command hooks provide ordered lifecycle
edges that Codex waits on, while Codex rollout JSONL under `~/.codex/sessions/`
contains checkpoint-only details such as assistant messages, reasoning,
permissions, non-shell tools, model metadata, and token snapshots. Trajectory
merges those sources in `trajectory serve` before writing its normalized session
JSONL under `~/.trajectory/trajectories/`.

The built-in Codex watcher (rollout file tailing) serves as a fallback for
sessions started before the plugin was installed or when hooks cannot notify
the local server. Codex hooks therefore use the `trajectory capture-hook`
command path instead of direct `curl` or raw JSONL append: the server merge path
owns checkpoint reconciliation, duplicate suppression, rollout cursor
advancement, and token/model enrichment.

For CLI usage, run `trajectory user-guide` or see `docs/USER-GUIDE.md`.

## Prerequisites

Install the trajectory binary before using this plugin:

```bash
bash install.sh
```

Or from the GitHub repo:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.sh)
```

## Install

Recommended setup-managed install:

```bash
trajectory setup --clients codex
```

Setup writes a local Codex marketplace under `~/.trajectory/codex-marketplace`, registers that local path, and makes the trajectory MCP tools available in Codex sessions.

Manual local marketplace installs remain supported for development and recovery. Use a stable local marketplace path with the same shape as setup's `~/.trajectory/codex-marketplace`, and keep the plugin hooks, bundled `.mcp.json`, skills, and Codex MCP registration pointed at the installed trajectory binary:

```bash
codex plugin marketplace add /path/to/local/codex-marketplace
codex mcp add trajectory -- /absolute/path/to/trajectory mcp
```

Remote GitHub marketplace registrations can still work, but setup's local marketplace is preferred for regular installs because Codex refreshes git marketplaces during startup, which can add network or GitHub latency to the first screen.
