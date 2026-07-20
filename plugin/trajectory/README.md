# Trajectory Plugin

Capture plugin for AI coding agents. Registers lifecycle hooks that post session events to the Trajectory capture server, primarily over HTTP with command shims for startup and shutdown.

## Install

```bash
trajectory setup --clients cc
```

Setup writes a local Claude Code marketplace under `~/.trajectory/claude-marketplace` without invoking Claude or changing Claude-owned settings. Claude administrators can register, enable, and auto-update that staged directory through managed settings; users can also adopt it through Claude's plugin interface. Existing user-scope installations are refreshed through Trajectory-owned registry and cache entries.

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
