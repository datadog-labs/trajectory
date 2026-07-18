# Trajectory Codex Plugin

Codex marketplace plugin for trajectory agent observability.

## What It Does

- **10 supported lifecycle hooks** provide the full compatibility surface. Setup enables `SessionStart`, `UserPromptSubmit`, and `Stop` plus Bash-only paired `PreToolUse` and `PostToolUse` by default, derives canonical detail and terminal completion from the rollout, and uses the paired hooks only for immediate PR-work evidence; `codex_boundary_capture` can restore all ten.
- **MCP server** provides introspection tools (status, sessions, queries, incognito, flush, markers)
- **`/incognito` skill** toggles publish suppression for the current session while local JSONL capture continues

Codex capture is intentionally hybrid. Three lifecycle/turn hooks plus paired
Bash-only evidence hooks provide ordered boundaries and immediate before/after
Git snapshots, while Codex rollout JSONL under
`~/.codex/sessions/` supplies tool phases, assistant messages, reasoning,
permissions, compaction, subagent activity, model/token metadata, and
`shutdown_complete`. Current Codex has no `SessionEnd` hook; the watcher emits
the terminal event. Trajectory merges those sources in `trajectory serve`
before writing normalized session JSONL under `~/.trajectory/trajectories/`.

The built-in Codex watcher (rollout file tailing) serves as a fallback for
sessions started before the plugin was installed or when hooks cannot notify
the local server. Codex hooks therefore use the `trajectory capture-hook`
command path instead of direct `curl` or raw JSONL append: the server merge path
owns checkpoint reconciliation, duplicate suppression, rollout cursor
advancement, and token/model enrichment.
Boundary mode drains every complete rollout record and commits its source
cursor only after canonical persistence succeeds. Setup and update retain all
ten hooks while an old, different-home, or ambiguous capture owner is running;
updated-owner startup self-repairs to paired boundary mode after proving same-home support.

`codex exec --ephemeral` writes no rollout, so default boundary mode cannot
derive its per-tool detail. Disable `codex_boundary_capture` before a new
ephemeral run when full direct-hook fidelity is required. Manual plugin installs
do not receive setup-managed per-hook state and therefore use the full ten-hook
compatibility surface.

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
