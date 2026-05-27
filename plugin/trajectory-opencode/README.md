# Trajectory OpenCode Plugin

Beta: distributed via GitHub Release tarballs today. Future: publish to npm as `@datadog/trajectory-opencode`.

## Install

`trajectory setup --clients opencode` installs this plugin under the resolved
OpenCode config directory (`OPENCODE_CONFIG_DIR`, then
`XDG_CONFIG_HOME/opencode`, then `~/.config/opencode`), adds that plugin path to
`opencode.json`, and writes a `trajectory` MCP entry.

Manual install option: copy this plugin to a stable local path and add both the
plugin path and MCP entry in `opencode.json`:

```json
{
  "plugins": [
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

You can also copy this folder to `~/.config/opencode/plugins/trajectory` and
reference that absolute path from the `plugins` array.

Manual local installs remain supported for development and recovery. Setup is
preferred for regular installs because it copies the plugin, writes the MCP
entry, and installs the global incognito skill together.

## Skill

OpenCode supports native agent skills from `~/.config/opencode/skills/<name>/SKILL.md` and compatible `.agents/skills/<name>/SKILL.md` / `.claude/skills/<name>/SKILL.md` paths. This plugin vends an incognito skill at `skills/incognito/SKILL.md`; install it globally with:

```bash
mkdir -p ~/.config/opencode/skills
cp -R plugin/trajectory-opencode/skills/incognito ~/.config/opencode/skills/incognito
```

`trajectory setup --clients opencode` also writes this skill into the global OpenCode skills directory.
