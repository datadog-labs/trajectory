# Trajectory Plugin

Capture plugin for AI coding agents. Registers lifecycle hooks that post session events to the Trajectory capture server, primarily over HTTP with command shims for startup and shutdown.

## Install

```bash
trajectory setup --clients cc
```

Setup writes a local Claude Code marketplace under `~/.trajectory/claude-marketplace`, registers that local path, refreshes it, then installs `trajectory@trajectory` at user scope. Existing installs are updated with `claude plugin update trajectory@trajectory --scope user` after the local marketplace is refreshed.

Manual fallback:

```bash
claude plugin marketplace add ~/.trajectory/claude-marketplace
claude plugin marketplace update trajectory
claude plugin install trajectory@trajectory --scope user
```

This manual path remains supported for recovery after setup has staged the local marketplace. From a checkout, use the checkout root instead of `~/.trajectory/claude-marketplace`. Setup is still preferred for regular installs because it keeps the plugin, hooks, MCP entry, and skills aligned with the installed Trajectory binary without requiring GitHub SSH or HTTPS credentials.

## What It Does

- 12 lifecycle hooks capture every session event (tool calls, prompts, compaction, subagents)
- Events POST to the Trajectory capture server at localhost:19222, with command hooks for startup/shutdown paths that need local process handling

For CLI usage, run `trajectory user-guide` or see `docs/USER-GUIDE.md`.
