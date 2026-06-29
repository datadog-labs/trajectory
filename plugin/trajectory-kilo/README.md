# Trajectory Kilo Code Plugin

Beta: distributed via GitHub Release tarballs today. Future: publish to npm as `@datadog/trajectory-kilo`.

## Install

`trajectory setup --clients kilo` installs this plugin under the resolved
Kilo Code config directory (`KILO_CONFIG_DIR`, then
`XDG_CONFIG_HOME/kilo`, then `~/.config/kilo`), adds that plugin path to
`opencode.json`, and writes a `trajectory` MCP entry.

Manual install option: copy this plugin to a stable local path and add both the
plugin path and MCP entry in `opencode.json`:

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

You can also copy this folder to `~/.config/kilo/plugins/trajectory` and
reference that absolute path from the `plugin` array.

Manual local installs remain supported for development and recovery. Setup is
preferred for regular installs because it copies the plugin, writes the MCP
entry, and installs the global incognito skill together.

## Skill

Kilo Code supports native agent skills from `~/.config/kilo/skills/<name>/SKILL.md` and compatible `.agents/skills/<name>/SKILL.md` / `.claude/skills/<name>/SKILL.md` paths. This plugin vends an incognito skill at `skills/incognito/SKILL.md`; install it globally with:

```bash
mkdir -p ~/.config/kilo/skills
cp -R plugin/trajectory-kilo/skills/incognito ~/.config/kilo/skills/incognito
```

`trajectory setup --clients kilo` also writes this skill into the global Kilo Code skills directory.
