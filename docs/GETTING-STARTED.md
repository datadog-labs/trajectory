# Getting Started

This page installs Trajectory for one user. For a managed fleet, use the
[managed deployment guide](MANAGED-ENDPOINTS.md).

## Install

You need:

- a Datadog site and API key
- a [supported coding agent](SUPPORTED-CLIENTS.md)
- permission to install a binary in your user account

Run the installer:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.sh)
```

From a clone of `datadog-labs/trajectory`, run `bash install.sh` instead.

The installer puts the latest release at `~/.trajectory/bin/trajectory` and
runs `trajectory setup`. Setup asks for your Datadog settings and connects the
coding agents it finds. To capture only on your computer, leave the API key
prompt blank, or pass `--local-only` to the installer.

### Windows

Run this in PowerShell:

```powershell
irm https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.ps1 | iex
```

To pass options, such as `-LocalOnly`, `-NonInteractive`, `-Site`, `-MlApp`,
or `-Clients`, run it as a script block:

```powershell
& ([scriptblock]::Create((irm https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.ps1))) -LocalOnly
```

The Windows installer checks the download against the release's
`checksums.sha256`, installs `%USERPROFILE%\.trajectory\bin\trajectory.exe`,
and adds that folder to your user PATH. Open a new terminal to use
`trajectory` by name. To leave your PATH unchanged, pass `-SkipPath` or set
`TRAJECTORY_INSTALL_SKIP_PATH=1`. If you use the Claude desktop app without
the Claude Code CLI, setup finds the app's own copy of the CLI. On Windows, Trajectory does not start its capture server in the
background yet, so run `trajectory serve` to export metrics or watch Claude
desktop Cowork sessions.

## Check the Install

1. Run `trajectory setup check`. It refreshes the list of coding agents, shows
   which are ready, and prints the next steps. It changes no hooks and no
   Datadog settings.
2. Finish one normal task in a coding agent.
3. Run `trajectory status` and `trajectory publish validate`.

At session start, the agent's hooks start the capture server on
`127.0.0.1`. Claude Code hooks post to
`http://127.0.0.1:19222/capture/<Event>`, and other clients to
`/capture/<client>/<event>`. The port is `TRAJECTORY_PORT`, then
`server.port`, then 19222.

If something looks wrong, run `trajectory doctor`. It checks the install,
capture, local data, settings, credentials, and publish queues. It lists what
needs action, worst first, and exits 1 if a check fails. The full report goes
to `~/.trajectory/doctor-report.txt`. `--verbose` prints every check.

## View Sessions

- `trajectory view` opens the built-in session viewer in your browser. The
  viewer only reads your data.
- `trajectory status` shows a terminal dashboard of the latest session.
  `trajectory status --session <id> --json` prints one session as JSON.
- `trajectory local-ui` starts the local API that the viewers read, on port
  8888. Without `--port`, it reuses a running one or takes the next free
  port. `--port 0` picks a free port. `--no-open` prints the URL instead of
  opening a browser.

The viewers show the sessions captured on this computer. Child sessions, such
as OpenCode and Kilo subagents, stay out of the top list, so open one by its
ID. Its detail shows the parent, the root, the other ancestors, and up to 100
children. The viewer hides the sessions Trajectory starts itself, such as
classifier and reviewer runs. **Show Trajectory tasks** shows them, and
changes no capture or publishing.

The **Oversight** tab shows automated reviews per 100 turns, outcome rates,
p50 and p95 added latency, tokens, and cost, with no reviewed content. Its
provider role and provider feature filters are local only, and add no tags to
published metrics.

## Connect Datadog

Setup asks for the API key with hidden input, checks it, and saves it in the
keychain as `dd_api_key`. It never asks for an application key.

If you skipped the key, run `trajectory publish destination configure`. It
checks the key, saves it in the keychain, and sets the `export.*` settings,
with standard traces unless you pass `--traces`. Then run
`trajectory config reload --yes`. Connecting, reloading, and validating never
change the destinations your organization requires.

In a script, pipe the key in. Never pass it as an argument:

```bash
printf '%s' "$DD_API_KEY" | trajectory publish destination configure \
  --non-interactive --api-key-stdin \
  --site datadoghq.com --ml-app coding-agents --traces standard --metrics
```

To run setup again with a key from the environment:

```bash
DD_API_KEY=... trajectory setup --site datadoghq.com --ml-app coding-agents \
  --clients codex --non-interactive
```

## Incognito

To keep one session's content out of Datadog, type `/incognito` in the coding
agent, or `/trajectory:incognito` in Claude Code. You can also ask in plain
words, such as "go incognito". `/incognito off` ends it. The
[privacy guide](PRIVACY.md#incognito)
explains what it stops.

## Import Past Sessions

Backfill imports the sessions an agent saved before you installed Trajectory,
and refreshes the local viewer. Metrics do not need it. To check metrics, run
`trajectory doctor metrics canary`. To import Claude Code transcripts and
refresh the viewer:

```bash
trajectory session import claude && trajectory session refresh-local
```

`trajectory session refresh-local` alone sends the cached sessions to the
viewer again.

## Update

`trajectory update` installs the release your ring names, set by
`deployment.ring` and `stable` by default. It installs it only when it is
newer and not below `deployment.minimum_version`, then restarts the capture
server. If the server does not answer on the new release, update puts back
the previous binary and starts it. Update never installs an older release and
keeps no record between runs. A failed run leaves the binary unchanged.
Running the installer again also upgrades an install from the public
repository.

## Uninstall

If your organization installed Trajectory through MDM, an administrator
removes it.

`trajectory uninstall` stops the capture service and removes the agent
integrations, the binary, and `~/.trajectory`. It keeps only the records that
stop a later install from sending your history again.
`trajectory user-guide install` lists them.

- `--dry-run` lists what it would remove and keep, and changes nothing.
- `--purge` also removes the kept records, so a later install sends your
  history again.

Uninstall also removes Agent Security from each client, except project
installs. A failing client CLI only causes a warning. If uninstall cannot
stop the capture server or remove an integration, it stops before removing
the binary, so you can run it again. It names what is left in `left` and
`clients_left`. It exits 0 when only kept records remain, 1 when something
stays, and 2 on a usage error. A second run reports `already_removed`.

`trajectory uninstrument <client>`, or `all`, removes what setup installed
for those clients: hooks, plugins, MCP entries, skills, command shims,
marketplaces, and module dispatchers. For Claude Code, it points the plugin
registration and local marketplace at an empty plugin. It keeps Agent
Security and your other settings, and is safe to repeat. It also turns off
the client's capture settings and stops automatic setup from reinstalling it.
`trajectory setup --clients <client>` restores both. A preview client first
needs `trajectory config set clients.<client>.enabled true`.

`bash ~/.trajectory/uninstall.sh` removes the integrations, stops the server,
then removes the binary and the rest of `~/.trajectory`. It keeps the same
publish records as `trajectory uninstall`, and stops if client cleanup fails.
`--dry-run` previews. `--purge` removes the whole home and every keychain
entry. `--skip-clients` leaves the integrations, and `-y` or
`--non-interactive` skips the prompt.

## Common Problems

If you see no data, check that the hooks exist, the capture server answers,
and `trajectory status` lists sessions. Then run `trajectory doctor`,
`trajectory config show`, `trajectory publish status`, and
`trajectory doctor logs --grep capture`.

`trajectory doctor logs` shows the last 50 lines of the capture server log.
`--follow` keeps printing, `--lines N` sets the count, and `--grep TEXT`
filters.

If your shell cannot find `trajectory`, run `~/.trajectory/bin/trajectory`, or
link it into `~/.local/bin`, as setup and doctor suggest.

If a client disabled its Trajectory plugin, `trajectory doctor` prints the
client's command to turn it back on. It marks the fixes only an administrator
can make.

If no API key is found, run `trajectory config set-secret dd_api_key`, set
`auth.key_command`, or set `DD_API_KEY` for every app that starts Trajectory.
A background capture server keeps the `DD_API_KEY` it started with and misses
later exports, so prefer `set-secret`. In an agent sandbox,
`trajectory publish validate` and `trajectory doctor` can fail with the key
present. Run doctor outside the sandbox.

Doctor's "Sessions finalized" check fails when a client ended a session but
the local JSONL has no `session_end`. `trajectory doctor --repair-session-end`
offers repairs and asks first. To repair one session:

1. Run `trajectory doctor publish --session <id>` to see what it captured.
2. Check the repair:
   `trajectory publish session-end repair --session <id> --dry-run`.
3. Repair it with `--apply`. Confirm, or add `--yes`.
4. Add `--publish` to retry the final publish.

Repair adds a `session_end` only after a strong end marker. If the client's
records hold only a weak one, such as `Stop`, a turn end, or `task_complete`,
repair refuses, exits 1, and names the marker. It also refuses a session with
a heartbeat from the last 3 minutes, unless you add `--allow-active`.

For support, run `trajectory flare`. It writes a redacted ZIP in
`~/.trajectory/` with doctor output, processes, metric diagnostics, settings,
managed defaults, logs, versions, and pricing.

- `--cpu-profile 30s` (at most 60s) and `--goroutine-dump` add capture server
  diagnostics without session content. `--pid` picks the server, including
  one that handed off to another.
- `--heap-profile` adds a running server's heap profile, up to 8 MiB. It can
  hold application data.
- `--privileged --session <id>` adds one session's raw data.

Review the ZIP before you share it.

## Command Summary

| Command | What it does |
| --- | --- |
| `trajectory --help` | Lists the commands. |
| `trajectory version` | Prints the Trajectory version. |
| `trajectory serve` | Runs the capture server in the foreground. |
| `trajectory user-guide [<topic>]` | Prints the built-in guides, paged in a terminal. `--format md` prints Markdown. |
| `trajectory user-guide mcp` | Prints the MCP tool catalog with safe query examples. It wins over any other list. |
