# Trajectory Kilo Code Plugin

`trajectory setup --clients kilo` installs this plugin from a copy built into
the Trajectory binary. [Supported clients](../../docs/SUPPORTED-CLIENTS.md#kilo-code)
says what it captures.

## Manual Install

For development or recovery:

1. Copy this folder to a stable path, such as
   `~/.config/kilo/plugins/trajectory`.
2. Add that path to the `plugin` array in `~/.config/kilo/opencode.json`.
3. Add the MCP entry:

```json
{
  "plugin": ["/absolute/path/to/trajectory"],
  "mcp": {
    "trajectory": {
      "type": "local",
      "command": ["/absolute/path/to/trajectory-binary", "mcp"],
      "enabled": true
    }
  }
}
```

To install the incognito skill by hand, copy
`plugin/trajectory-kilo/skills/incognito` to `~/.config/kilo/skills/incognito`.

## Capture Failure Isolation

Kilo Code follows the same rules as the
[OpenCode plugin](../trajectory-opencode/README.md#capture-failure-isolation),
with Kilo endpoints.
