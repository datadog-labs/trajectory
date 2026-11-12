# Trajectory Kilo Code Plugin

Beta: Trajectory ships this plugin in GitHub Release tarballs today. We plan to
publish it to npm as `@datadog/trajectory-kilo`.

## Install

`trajectory setup --clients kilo` does three things:

- It installs this plugin under the Kilo Code config directory. Setup picks the
  directory in this order: `KILO_CONFIG_DIR`, then
  `XDG_CONFIG_HOME/kilo`, then `~/.config/kilo`.
- It adds the plugin path to `opencode.json`.
- It writes a `trajectory` MCP entry.

### Manual Install

To install manually, copy this plugin to a stable local path. Then add the
plugin path and the MCP entry to `opencode.json`:

```json
{
  "plugin": [
    "/absolute/path/to/trajectory"
  ],
  "mcp": {
    "trajectory": {
      "type": "local",
      "command": ["/absolute/path/to/trajectory-binary", "mcp"],
      "enabled": true
    }
  }
}
```

You can also copy this folder to `~/.config/kilo/plugins/trajectory`. Then
reference that absolute path from the `plugin` array.

Manual local installs are still supported for development and recovery. Use
setup for regular installs. Setup copies the plugin, writes the MCP entry, and
installs the global incognito skill in one step.

## Skill

Kilo Code loads native agent skills from
`~/.config/kilo/skills/<name>/SKILL.md`. It also loads skills from the
compatible paths `.agents/skills/<name>/SKILL.md` and
`.claude/skills/<name>/SKILL.md`.

This plugin ships an incognito skill at `skills/incognito/SKILL.md`. To install
it globally, run:

```bash
mkdir -p ~/.config/kilo/skills
cp -R plugin/trajectory-kilo/skills/incognito ~/.config/kilo/skills/incognito
```

`trajectory setup --clients kilo` also writes this skill into the global
Kilo Code skills directory.

## Capture failure isolation

Kilo Code uses the same capture queue and retained-state limits as
[OpenCode](../trajectory-opencode/README.md#capture-failure-isolation). It uses
Kilo provenance and Kilo endpoints.

- When native callbacks are overloaded, they decline optional capture. They
  leave native payloads unchanged.
- Kilo Code marks incomplete turn snapshots.
- Home selection follows the same rules, including limited retries after a
  failure.
- When callback preparation is full, end-of-turn cleanup uses the same small
  session record as OpenCode.
- A rejected child creation turns off inferred Task matching for that parent.
- Dropped turn snapshots reach the stored `turn_end` event with
  `completed: false`.

For loss reporting and resource limits, see the
[shared capture contract](../trajectory-opencode/README.md#capture-failure-isolation).
