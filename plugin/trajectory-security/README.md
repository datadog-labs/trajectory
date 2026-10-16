# Trajectory Security Marketplace Plugin

This plugin adds Agent Security to the existing Trajectory marketplace, next to
the core `trajectory` plugin. You can install it on its own. It supports the
`agent-security` module in Claude Code, Codex, and Cursor.

The plugin does not need the core plugin. It needs only the Trajectory binary
at `~/.trajectory/bin/trajectory`, or at the path in `TRAJECTORY_BINARY`.

## Install

Run this command:

```bash
trajectory plugins security setup --mode observe --clients cc,codex,cursor
```

The command does three things:

- It installs this plugin for Claude Code and Codex.
- It syncs Cursor's native hooks.
- It enables Datadog Security.

You can run the command again safely. It gives the same result.

The first session in each client also runs
`trajectory plugins security setup --marketplace --clients <client>` to finish
setup. This step keeps an existing enforce mode. It does not enable a module
that was explicitly disabled.

## Commands and Destinations

Use the bundled commands and skill to check status, enable, disable, and
configure a destination.

To publish Agent Security result spans and read results back with an
application key, run:

```bash
trajectory plugins security destination add --destination <existing-destination> --app-key-ref <secret-ref>
```

Store the secret separately with
`trajectory config set-secret <secret-ref> --stdin`. Never put a key value in a
manifest or a command argument.

By default, AI Guard uses the standard Trajectory secret references
`dd_api_key` and `dd_app_key`. An installer only needs to store both secrets
and run the security setup command.

## Codex Hook Deadlines

Codex gives each security hook process 3 seconds.

- Trajectory keeps 500 ms of that time for the provider and for startup.
- Foreground evaluation gets the rest of the internal deadline.
- When both AI EDR and AI Guard are enabled, they run at the same time.
- Evaluator `timeout_ms` settings are upper limits. They cannot extend the
  Codex hook deadline.
- Under overload, Trajectory does not queue a foreground operation. It lets the
  operation continue at once and records the degraded evaluator outcome.
