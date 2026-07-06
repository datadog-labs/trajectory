
# Feature Flags

Trajectory feature flags gate risky or rollout-sensitive behavior. Use them for
new behavior that mutates durable user state, changes client startup, introduces
wrapper/interposer behavior, depends on managed settings, or changes outbound
network shape.

## Decision Checklist

For feature-oriented work, agents must tell the user the feature-flag decision
before implementation starts:

```text
Feature flag decision: needed/not needed - <reason>.
```

Use a flag when the change mutates durable user or admin config, changes setup
or client registration, changes wrapper/interposer behavior, changes environment
injection or OTLP/network shape, changes publish/export behavior, depends on
managed-settings precedence, introduces a new user-visible workflow, or needs a
fast kill switch for narrow rollout.

Do not use a flag for docs-only changes, tests-only changes, logging-only
visibility, internal refactors with no behavior change, or bug fixes that restore
documented behavior for everyone. Privacy and security fixes should not be made
optional unless a temporary rollout-safety kill switch is required.

## Commands

Inspect effective flags:

```bash
trajectory features list
trajectory features status claude_native_otlp_interposer
```

Persist a user override in `~/.trajectory/config.yaml`:

```bash
trajectory features enable claude_native_otlp_interposer
trajectory features disable claude_native_otlp_interposer
trajectory features clear claude_native_otlp_interposer
```

The same lists are visible through the config surface:

```bash
trajectory config get features.enabled
trajectory config get features.disabled
trajectory config set features.disabled claude_native_otlp_interposer
```

After changing a flag for long-running `trajectory serve` processes, run:

```bash
trajectory config reload --yes
```

## Runtime Overrides

Use process-local environment overrides for tests, emergency kill switches, or
one launched process:

```bash
TRAJECTORY_ENABLE_FEATURES=flag_a,flag_b trajectory ...
TRAJECTORY_DISABLE_FEATURES=flag_a,flag_b trajectory ...
```

Disabled wins when a flag appears in both enabled and disabled lists. A managed
`config.defaults.yaml` disable also wins over user config, so users cannot
locally re-enable an admin-disabled feature.

## Rollout Rules

- Default risky features off unless the user action is already an explicit
  opt-in boundary, such as running `trajectory claude`.
- Put the feature check at the entrypoint and at the mutation or side-effect
  boundary when practical.
- Add tests for default behavior, enabled behavior, disabled behavior, managed
  disabled behavior, and env-disabled kill switch behavior.
- Do not use feature flags as permission to mutate broad user settings. Feature
  flags gate behavior; setup still must use the least invasive supported client
  integration surface.

## Registered Flags

| Flag | Default | Purpose |
| --- | --- | --- |
| `claude_native_otlp_interposer` | on | Allows `trajectory claude` to route Claude Code native OTLP through local `trajectory serve` for that launched process. Setup does not write Claude settings files. Disable this flag to keep `trajectory claude` from injecting native OTLP env vars. |
