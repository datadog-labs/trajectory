# Trajectory Security

Trajectory Security adds AI Guard and AI-EDR controls to supported coding
agents without coupling those controls to the core observability plugin.

The `trajectory-security` package is an independently installable plugin for
Claude Code, Codex, and Cursor. It requires the Trajectory binary at
`~/.trajectory/bin/trajectory` or the path selected by `TRAJECTORY_BINARY`.

## Set Up Security

Enable observe mode for selected clients:

```bash
trajectory security setup --mode observe --clients cc,codex,cursor
```

The command installs the standalone marketplace plugin for Claude Code and
Codex, synchronizes Cursor's native hooks, and enables Agent Security. It is
safe to run again when clients or configuration change.

Observe mode records decisions without blocking agent actions. Enforce mode
can block actions and therefore requires explicit confirmation:

```bash
trajectory security setup --mode enforce --clients cc --yes
```

Inspect or disable the active configuration with:

```bash
trajectory security status
trajectory security disable
trajectory security disable --clients cc,codex,cursor --remove-hooks
```

`--remove-hooks` removes the selected standalone plugin surfaces while
preserving Trajectory's baseline observability hooks.

## Configure A Destination

Agent Security results can use an existing Datadog destination with an
application-key secret reference:

```bash
trajectory security destination add \
  --destination <existing-destination> \
  --app-key-ref <secret-ref>
```

Store secret values through Trajectory's OS-keychain-backed secret interface.
Do not place API or application keys in YAML or command arguments:

```bash
trajectory config set-secret dd_api_key --stdin
trajectory config set-secret dd_app_key --stdin
```

The built-in AI Guard configuration uses `dd_api_key` and `dd_app_key` by
default. Existing `DD_API_KEY` and `DD_APP_KEY` environment values remain
compatible with the same credential resolver.

## Plugin Ownership

The core `trajectory` plugin owns session capture. The standalone
`trajectory-security` plugin owns Security decision hooks and dispatches them
through `hook-dispatch --product-plugin datadog-security`. Installing or
removing one package does not transfer ownership to the other.

Security event-stream logs are a separate managed destination capability. See
[SECURITY-EVENT-STREAM.md](SECURITY-EVENT-STREAM.md) for that contract.
