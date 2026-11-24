# Trajectory Security Marketplace Plugin

This plugin adds Agent Security to the Trajectory marketplace, next to the
core `trajectory` plugin. It covers Claude Code, Codex, and Cursor. Its
commands and skill check status, turn Agent Security on and off, and add a
destination for its results.

To install it, run:

```bash
trajectory plugins security setup --mode observe --clients cc,codex,cursor
```

For modes, commands, keys, and the limits of each client, see
[Agent Security](../../docs/AGENT-SECURITY.md).
