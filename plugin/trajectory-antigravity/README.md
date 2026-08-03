# Trajectory Antigravity Plugin

Capture plugin for Antigravity CLI (`agy`). Registers the current native
`PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, and `Stop`
command hooks at the plugin root, sends their payloads through Trajectory's
receipt-backed `capture-hook`, preserves `modelName` as a non-authoritative model label, and
includes the Trajectory incognito skill.

Install through setup:

```bash
trajectory setup --clients agy
```

For manual validation with Antigravity CLI:

```bash
agy plugin validate plugin/trajectory-antigravity
```

Validation must report `hooks: 1 processed`.
