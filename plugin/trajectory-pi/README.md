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

The package manifest declares the Pi extension entrypoint:

```json
{
  "pi": {
    "extensions": ["./src/index.ts"]
  }
}
```

Pi discovers the extension from `~/.pi/agent/extensions/trajectory/package.json`;
you do not need to add `src/index.ts` to `~/.pi/agent/settings.json`.
The root `index.ts` file is a shim that re-exports `./src/index.ts` for Pi
versions or workflows that scan package-root extension entrypoints.

Then point `~/.pi/agent/mcp.json` at `~/.pi/agent/extensions/trajectory/bin/trajectory mcp`.

Current Pi reports fork and new-session transitions through `session_start`.
The extension records the exact provider session and parent IDs when the new
header confirms the provider's previous-session file. OhMyPi uses a different
CLI, configuration root, extension manifest, and package namespace; this Pi
extension is not an OhMyPi live-capture package.

## Tools

The extension registers `trajectory_status`, `trajectory_flush`, and `trajectory_incognito`. `trajectory_incognito` toggles publish suppression for the current Pi session while local JSONL capture continues.
