# Trajectory Codex Plugin

`trajectory setup --clients codex` installs this plugin.
[Supported clients](../../docs/SUPPORTED-CLIENTS.md#codex-cli) says what it
captures. Install the Trajectory binary first, with the installer:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.sh)
```

The plugin's MCP server offers `trajectory_status`, `get_session_trajectory`,
`trajectory_schema`, `trajectory_query`, `trajectory_search`, and
`trajectory_incognito`, which only turns incognito on.

## Manual Install

For development or recovery, point the plugin hooks, the bundled `.mcp.json`,
and the skills at the installed Trajectory binary. Then run:

```bash
codex plugin marketplace add /path/to/local/codex-marketplace
codex mcp add trajectory -- /absolute/path/to/trajectory mcp
```

A manual install gets no hook state from setup, so all eleven hooks run.
