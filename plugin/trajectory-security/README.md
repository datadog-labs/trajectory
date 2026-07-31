# Trajectory Security Marketplace Plugin

This is the independently installable Agent Security plugin in the existing Trajectory marketplace, alongside the core `trajectory` plugin. It includes Claude Code, Codex, and Cursor surfaces for the `agent-security` module. Installing it does not require the core plugin; it requires only the Trajectory binary at `~/.trajectory/bin/trajectory` (or `TRAJECTORY_BINARY`).

`trajectory security setup --mode observe --clients cc,codex,cursor`
idempotently installs this plugin for Claude Code and Codex, synchronizes
Cursor's native hooks, and enables Datadog Security. The first client session
also runs `trajectory security setup --marketplace --clients <client>` as a
bootstrap. That bootstrap preserves an existing enforce mode and respects an
explicitly disabled module.

Use the bundled command/skill surface for status, enable, disable, and destination configuration. To publish Agent Security result spans and read results back with an application key:

```bash
trajectory security destination add --destination <existing-destination> --app-key-ref <secret-ref>
```

Store the secret separately with `trajectory config set-secret <secret-ref> --stdin`; never place a key value in a manifest or command argument.

AI Guard uses the standard Trajectory secret references `dd_api_key` and
`dd_app_key` by default, so an installer only needs to store both references
and run the security setup command.
