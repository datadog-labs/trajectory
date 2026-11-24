# Trajectory Plugin

This plugin captures Claude Code sessions.
[Supported clients](../../docs/SUPPORTED-CLIENTS.md#claude-code) says what it
captures. `trajectory setup --clients cc` writes its own copy, with the
Trajectory home and capture port in its hooks. This page covers the copy in
this folder.

## Manual Install

For recovery, after setup creates the local marketplace:

```bash
claude plugin marketplace add ~/.trajectory/claude-marketplace
claude plugin marketplace update trajectory
claude plugin install trajectory@trajectory --scope user
```

From a source checkout, use the checkout root as the marketplace.

## Hooks

- HTTP hooks send `X-Trajectory-Home` from `TRAJECTORY_HOME`. An empty header
  means the capture server's own home. The server refuses another home with
  HTTP 409.
- These hooks post to the default capture port. A custom port needs
  `trajectory setup`, and `trajectory doctor` warns when one is set.
- On macOS and Linux, setup's command hooks start the binary with no shell.
  On Windows, and in this copy, they run `capture-with-serve.sh` in a shell.
