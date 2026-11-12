# Trajectory Plugin

This is the Trajectory capture plugin for Claude Code. Tool events and
streamed assistant messages use native HTTP hooks. Lifecycle and permission
events use command hooks, because they may need to start the local capture
server.

## Install

```bash
trajectory setup --clients cc
```

Setup writes a local Claude Code marketplace under
`~/.trajectory/claude-marketplace`. Setup does not run Claude. It does not
change Claude settings, plugin metadata, or the plugin cache.

- Claude administrators can register, enable, and auto-update that directory
  through managed settings.
- Users can also add it through Claude's plugin interface.

Claude Code caches installed plugins by version. Setup writes the local
marketplace and plugin manifest with the bundled Claude plugin version. Claude's
managed auto-update or its plugin interface then loads that version into the
cache.

The package includes `bin/README.md`. Claude Code adds the `bin/` directory of
every loaded plugin to `PATH`. Trajectory does not ship an executable inside
the plugin. The README file keeps the `bin/` directory present without adding
an unsupported launcher.

### Manual Install

After setup creates the local marketplace, you can also install the plugin
manually for recovery:

```bash
claude plugin marketplace add ~/.trajectory/claude-marketplace
claude plugin marketplace update trajectory
claude plugin install trajectory@trajectory --scope user
```

From a source checkout, use the checkout root instead of
`~/.trajectory/claude-marketplace`.

Use setup for regular installs. It keeps the plugin, hooks, MCP entry, and
skills matched to the installed Trajectory binary. It also needs no GitHub SSH
or HTTPS credentials.

## What It Does

- The plugin has 17 hooks. They cover lifecycle, prompts, streamed assistant
  messages, tools, permissions, MCP elicitation, compaction, and subagents.
- `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, and `MessageDisplay` send
  events over native loopback HTTP. These frequent events never start a
  process.
- Lifecycle and permission command hooks run `trajectory capture-hook`. On
  macOS and Linux, setup writes hooks that Claude Code starts with no shell.
  The hook's `command` is the Trajectory binary, and its `args` are the
  `capture-hook` command line, so a hook starts one process. On Windows, and
  in this folder's `hooks/hooks.json`, the hooks run `capture-with-serve.sh`
  through a shell.
- When the `claude_direct_hook_start` feature flag is off, a hook that Claude
  Code started with no shell runs `capture-with-serve.sh` in its own place. It
  first writes a `result=handed_to_script` line to the log described below.
- A command hook tries one POST to a running capture server, for at most
  250 ms. If that fails, it saves the hook input and hands it to a detached
  capture worker. The hook returns within its timeout.
- The worker keeps one delivery ID while it starts or retries the capture
  server. The server uses that ID to drop duplicates, including while an old
  server shuts down.
- If the capture binary fails, optional capture commands exit silently with
  success. Diagnostics that you run yourself still report errors.
- Each command hook first writes one line to
  `~/.trajectory/logs/capture-hook-start.log`. A hook whose helper script or
  binary is missing writes `result=missing_script` or `result=missing_binary`
  there instead of capturing. A hook that Claude Code started without its
  arguments, and that finds none in its plugin folder, writes
  `result=missing_entry`. `trajectory doctor` reports those lines.
- Command hooks pin the same capture port as the HTTP hooks, so every event of
  a session reaches the same capture server.
- On HUP, INT, or TERM, a command hook stops its capture process group. This
  includes a worker that started during the handoff. When the hook finishes
  normally, the detached worker keeps running.
- Trajectory reads the Claude transcript to repair stored content and
  turn-completion facts. It never adds a permission request that it did not
  capture live.
- Claude Code loads the standard `hooks/hooks.json` file automatically. The
  plugin manifest has no `hooks` entry, so Claude Code does not load the hooks
  twice.
- `bin/` holds no executables. It exists only because Claude Code adds each
  plugin's `bin/` directory to `PATH`.

For CLI usage, run `trajectory user-guide` or see `docs/USER-GUIDE.md`.
