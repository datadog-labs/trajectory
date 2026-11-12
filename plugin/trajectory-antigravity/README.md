# Trajectory Antigravity Plugin

This is the Trajectory capture plugin for Antigravity CLI (`agy`). It does
the following:

- It registers the current native command hooks at the plugin root:
  `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, and `Stop`.
- It sends their payloads through Trajectory's `capture-hook` command.
- It keeps `modelName` as a model label only. Trajectory does not treat that
  label as the confirmed model.
- It includes the Trajectory incognito skill.

Install the plugin through setup:

```bash
trajectory setup --clients agy
```

To validate the plugin manually with Antigravity CLI, run:

```bash
agy plugin validate plugin/trajectory-antigravity
```

The validation output must report `hooks: 1 processed`.
