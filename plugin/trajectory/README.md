# Trajectory Plugin

Capture plugin for AI coding agents. Registers lifecycle hooks that post session events to the Trajectory capture server, primarily over HTTP with command shims for startup and shutdown.

## Install

```bash
trajectory setup --clients cc
```

Setup adds and refreshes the Claude Code marketplace, then installs `trajectory@trajectory` at user scope.

Manual fallback:

```bash
claude plugin marketplace add https://github.com/datadog-labs/trajectory.git
claude plugin marketplace update trajectory
claude plugin install trajectory@trajectory --scope user
```

This manual path remains supported for development and recovery. Setup is still preferred for regular installs because it keeps the plugin, hooks, MCP entry, and skills aligned with the installed Trajectory binary.

## What It Does

- 12 lifecycle hooks capture every session event (tool calls, prompts, compaction, subagents)
- Events POST to the Trajectory capture server at localhost:19222, with command hooks for startup/shutdown paths that need local process handling

For CLI usage, run `trajectory user-guide` or see the repository user guide at `../../docs/USER-GUIDE.md`.
