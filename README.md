# Trajectory

Trajectory records what AI coding agents do on your computer and sends that
data to Datadog.

You install one binary and run one setup command. Trajectory then captures
each session from the coding agents you use. In these docs, a coding agent is
called a *client*. Claude Code and Codex are examples.

## Install

Pick the method that matches who manages the computer:

- **Managed fleets (MDM/UEM):** Follow the
  [Managed Endpoint Administrator Guide](docs/MANAGED-ENDPOINTS.md).
  It shows how to deploy the package and policy, choose the clients, and check
  the install.
- **Individual developers:** Run the personal installer below. It installs
  Trajectory for your user account.

```bash
git clone --depth=1 https://github.com/datadog-labs/trajectory.git /tmp/traj && bash /tmp/traj/install.sh
```

The installer does these steps:

1. It downloads the latest binary.
2. It sets up the clients that it finds on your computer.
3. It starts interactive setup.

Setup asks for your Datadog site, a service name, and your Datadog API key.
Then it registers hooks for each client.

### Try Trajectory without Datadog

If you do not have a Datadog API key yet, leave the API key prompt blank. You
can also pass `--local-only` to the installer. Trajectory then captures
sessions and keeps them on your computer.

When you are ready to send data, set up your Datadog destination. The
destination is the site, service name, and API key that Trajectory sends to:

```bash
trajectory publish destination configure
```

### Check the install

Run this command after you install:

```bash
trajectory setup check
```

It shows which clients are ready and prints the next commands to run. To
browse your sessions, run `trajectory local-ui --lapdog`.

### Add or refresh a client

To set up one client again later, run its setup command from the list below.
You do not need to enter your Datadog settings again.

The command refreshes everything Trajectory installs for that client. This
includes hooks, MCP entries, skills, commands, command shims, and local
marketplace files. A *command shim* is an optional launcher with the same name
as the client's command. With a shim, a normal launch of the client runs
through Trajectory.

- **Claude Code**: `trajectory setup --clients cc`
- **Cline CLI**: `trajectory setup --clients cline`
- **Codex**: `trajectory setup --clients codex` (local marketplace under `~/.trajectory/codex-marketplace`)
- **GitHub Copilot CLI**: `trajectory setup --clients copilot` (beta, live capture only)
- **Antigravity CLI**: `trajectory setup --clients agy`
- **Goose**: `trajectory setup --clients goose`
- **Cursor Desktop**: `trajectory setup --clients cursor` (registers hooks)
- **cursor-agent CLI**: no setup needed. Trajectory watches its transcripts.
- **Factory Droid**: `trajectory setup --clients droid` (beta, live capture only)
- **Hermes Agent**: `trajectory setup --clients hermes` (beta observer plugin hooks)
- **OpenHands**: `trajectory setup --clients openhands`
- **Aider**: `trajectory setup --clients aider --install-client-shims` (opt-in command shim)
- **Continue CLI**: `trajectory setup --clients continue --install-client-shims` (opt-in command shim)
- **Mistral Vibe**: `trajectory setup --clients mistral-vibe --install-client-shims` (opt-in command shim and tool hooks)
- **Codebuff**: `trajectory setup --clients codebuff --install-client-shims` (opt-in command shims)
- **Amp Code**: `trajectory setup --clients amp`
- **Qwen Code**: `trajectory setup --clients qwen`
- **Pi**: `trajectory setup --clients pi`
- **OpenCode**: `trajectory setup --clients opencode`
- **Kilo Code**: `trajectory setup --clients kilo`
- **Kiro CLI**: `trajectory setup --clients kiro`
- **Preview clients**: enable the feature flag, then run the setup command. The
  [supported-client matrix](docs/SUPPORTED-CLIENTS.md) lists both for each
  client. Preview clients include Devin, Qoder, Kimi Code, Warp/Oz, VS Code
  Copilot Chat, Windsurf, Zed, gptme, CodeWhale, ForgeCode, and CommandCode.
- **OpenClaw**: released builds do not capture OpenClaw live. To import the
  history that OpenClaw saves on disk, run
  `trajectory config features enable openclaw_durable_history`. Then run
  `trajectory session import openclaw`.

Aider and Mistral Vibe can also import the history that they save on disk:

- For Aider, run `trajectory config features enable aider_durable_history`.
  Then run `trajectory session import aider`. You must tell Trajectory where
  the Aider history is.
- For Mistral Vibe, run
  `trajectory config features enable mistral_vibe_durable_history`. Then run
  `trajectory session import mistral-vibe`.

To repair a client's plugin or hooks, run its `trajectory setup --clients ...`
command again.

### How setup changes your computer

For Claude Code, setup uses Claude's own plugin manager. It registers
Trajectory's local marketplace and installs the `trajectory@trajectory` plugin
at user scope. If that step changes or removes one of your settings, setup puts
the original settings back. Background repair never starts Claude. It changes
only Trajectory's own plugin entry and its own cache folder.

Setup makes the `trajectory` command available without client shims:

- If a bin folder in your home directory is already on your `PATH`, setup
  links `trajectory` into it.
- Setup does not add `~/.trajectory/bin` to your shell startup files.
- Setup installs client command shims only if you select them during
  interactive setup or pass `--install-client-shims`.

### Change Datadog settings

To change the Datadog site, service name, or API key, run
`trajectory publish destination configure`. To change client integrations or
run the full setup wizard again, run `trajectory setup`.

Setup checks the API key before it saves it. If saving a new key fails, setup
keeps your old key in the OS keychain. To add a missing key yourself, run
`trajectory config set-secret dd_api_key`. You can also set `DD_API_KEY` and
then run `trajectory publish validate`.

For how Trajectory stores, finds, and rotates API and application keys, see
[docs/API-APP-KEY-MANAGEMENT.md](docs/API-APP-KEY-MANAGEMENT.md). It also
covers managed installs.

## Uninstall

To uninstall a personal install, run:

```bash
bash ~/.trajectory/uninstall.sh
```

The script first stops capture and shuts down the running Trajectory process.
It does this even when you pass `--skip-clients`. Then it removes the binary,
the helper files, and every client integration that setup installed. It keeps
your config and your captured session data.

Caution: `--purge` deletes your config and your captured session data. It
removes the whole Trajectory home folder. It also deletes every OS keychain
entry that Trajectory saved through its secret commands. To remove everything,
run:

```bash
bash ~/.trajectory/uninstall.sh --purge
```

To remove one client integration and keep Trajectory installed, run the
command with the client's setup ID:

```bash
trajectory uninstrument codex
```

To remove every client integration, run `trajectory uninstrument all`.

`trajectory uninstrument` also does these things:

- It records that you removed the client. Managed auto-instrument then does
  not install the client again for your user.
- It turns off the client's passive and runtime capture flags.
- It keeps shared skill and command files unless it can confirm that
  Trajectory owns them.
- For Codex, it leaves a marker file. If you later go back to an older
  Trajectory binary, the marker makes that binary stop capture. The older
  binary does not start passive capture again.

If a client needs a preview feature flag, enable the flag again before you run
`trajectory setup --clients <client>` later.

For minimum client versions, see
[docs/SUPPORTED-CLIENTS.md](docs/SUPPORTED-CLIENTS.md). For how Trajectory
connects to each client through hooks, MCP, file watchers, and backfill, see
[docs/CLIENT-INSTRUMENTATION.md](docs/CLIENT-INSTRUMENTATION.md).

## What It Does

Trajectory captures structured data from clients and sends it to Datadog LLM
Observability:

- **Session capture:** Trajectory records every tool call, prompt, compaction,
  and subagent event.
- **Metrics:** Trajectory sends more than 300 built-in
  [Datadog metrics](docs/METRICS-REFERENCE.md). They cover cost, tokens, tool
  use, duration, commits, PRs, markers, and Trajectory's own health.
  Trajectory sends them straight to Datadog over OTLP, so you do not need a
  Datadog Agent. To check them, run an audit or a canary, or read them back
  from Datadog.
- **Local browsing:** Lapdog is a viewer for the sessions on your computer. It
  reads from a local Trajectory server.
- **Behavioral markers:** Markers are YAML rules that find patterns in agent
  sessions. See the [marker guide](docs/MARKERS.md).
- **Many clients:** One binary works with all major AI coding agents.
- **Session resume:** `trajectory session resume` continues a session in a
  different client.

## CLI Quick Reference

| Task | Command |
| --- | --- |
| Check the install and print next steps | `trajectory setup check` |
| Show a terminal dashboard | `trajectory status` |
| Show this month's usage and cost | `trajectory summary` |
| Show yield, cost per commit, and cost per PR | `trajectory patterns outcomes` |
| Show the work mix, outcomes, cost, and deliverables | `trajectory patterns` |
| Show the tasks and turn costs of one session | `trajectory patterns session ID` |
| Find and explain problems | `trajectory doctor` |
| View server logs | `trajectory doctor logs [-f] [--grep PAT]` |
| Stop all capture for your user | `trajectory config capture disable` |
| Start capture again for your user | `trajectory config capture enable` |
| View your configuration | `trajectory config show` |
| Set up your Datadog destination | `trajectory publish destination configure` |
| Check publish settings and credentials | `trajectory publish validate` |
| Send test metrics and read them back from Datadog | `trajectory doctor metrics canary --publish --readback` |
| Preview metrics locally | `trajectory doctor metrics session --latest` |
| Check published metrics against local data | `trajectory publish metrics audit --latest` |
| Show the publish mode and destinations | `trajectory publish status` |
| Explain what should publish and why | `trajectory doctor publish` |
| Import Aider history (turn on `aider_durable_history` first) | `trajectory session import aider` |
| Import Kilo history (turn on `kilo_durable_history` first) | `trajectory session import kilo` |
| Import OpenClaw history (turn on `openclaw_durable_history` first) | `trajectory session import openclaw` |
| Import Qwen history (turn on `qwen_durable_history` first) | `trajectory session import qwen` |
| Read the built-in documentation | `trajectory user-guide [topic]` |

For more detail, see these guides:

- [docs/USER-GUIDE.md](docs/USER-GUIDE.md): the user guide. Run
  `trajectory user-guide [topic]` for the same topics in the terminal.
- [docs/MARKERS.md](docs/MARKERS.md): how to write markers.
- [docs/REPO-MARKERS.md](docs/REPO-MARKERS.md): how to set up markers for a
  repository with `publish.trajectory.yaml`.
- [docs/METRICS-REFERENCE.md](docs/METRICS-REFERENCE.md): metric names, types,
  tags, and how to query them.
- [docs/COST-ATTRIBUTION.md](docs/COST-ATTRIBUTION.md): how to get cost totals
  that add up, and safe dashboard patterns.

## Key References

- [docs/SUPPORTED-CLIENTS.md](docs/SUPPORTED-CLIENTS.md): supported clients,
  versions, setup commands, and the signals that each client provides.
- [docs/CLIENT-INSTRUMENTATION.md](docs/CLIENT-INSTRUMENTATION.md): the hooks,
  MCP entries, file watchers, wrappers, and backfill for each client.
- [docs/METRICS-REFERENCE.md](docs/METRICS-REFERENCE.md): every metric name,
  type, and tag, with query guidance.

To contribute, see [CONTRIBUTING.md](CONTRIBUTING.md).

## License

Trajectory is licensed under the Apache License, Version 2.0. See
[LICENSE](LICENSE).
