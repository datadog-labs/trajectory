# Trajectory Pi Plugin

Beta: distributed via GitHub Release tarballs today. Future: publish to npm as `@datadog/trajectory-pi`.

## Install

Managed setup installs the extension, MCP config, and extension-local binary path:

```bash
trajectory setup --clients pi
```

Copy this folder into your Pi extensions directory, for example:

```bash
mkdir -p ~/.pi/agent/extensions
cp -R /path/to/trajectory/plugin/trajectory-pi ~/.pi/agent/extensions/trajectory
```

Then point `~/.pi/agent/mcp.json` at `~/.pi/agent/extensions/trajectory/bin/trajectory mcp`.

## Tools

The extension registers `trajectory_status`, `trajectory_flush`, and `trajectory_incognito`. `trajectory_incognito` toggles publish suppression for the current Pi session while local JSONL capture continues.
