# Trajectory Plugin

Capture plugin for AI coding agents. Registers lifecycle command hooks that invoke Trajectory's receipt-backed `capture-hook` helper for every session event.

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
- Every hook invokes `capture-with-serve.sh`, which uses one delivery ID across bounded owner ensure/retry and duplicate suppression during retirement
- Claude Code loads the standard `hooks/hooks.json` file automatically, so the plugin manifest intentionally omits a `hooks` entry to avoid duplicate hook loading

For CLI usage, run `trajectory user-guide` or see `docs/USER-GUIDE.md`.
