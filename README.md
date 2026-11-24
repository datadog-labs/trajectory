# Trajectory

Trajectory shows how people use AI coding agents and what that work produces.

Coding agents run in local CLIs, IDEs, and desktop apps that application
telemetry mostly misses. Trajectory turns their sessions into local timelines,
Datadog LLM Observability traces, operational metrics, and marker results.
You see which agents people use and where, their work, its cost and results,
their failures, and adoption.

## What It Is

A client is a coding agent. A session is one conversation with it. A turn is
one prompt and the agent's work on it.

Trajectory captures sessions, turns, tool calls, tokens, cost, repository
context, and outcomes. If a client exposes them, it also captures commands,
file edits, tests, permissions, commits, pull requests, compaction, and
subagents. It links agent use to people, repositories, tools, commits, pull
requests, and completed-session samples in one Datadog format.

One local binary serves many clients through their hooks, plugins, or session
files. It captures locally first, and developers keep their tools. Trajectory
covers the agent's side of the work, next to APM, logs, infrastructure, and
security monitoring.

- **Export**: LLM Observability traces, and metrics for tokens, cost,
  duration, tool use, capture health, and attribution.
- **Work Insights**: adoption, outcomes, task mix, complexity, agent-work
  cost, pull request attribution, stable JSON, and local pull request
  evidence.
- **Investigation**: `trajectory status`, `trajectory view`, diagnostics,
  support bundles, MCP tools, and backfill.
- **Privacy**: incognito, local-only capture, trace detail, a capture off
  switch, and controls for Trajectory's own LLM calls.

## Install

Follow [Getting started](docs/GETTING-STARTED.md) to install Trajectory and
connect your coding agents.

To turn on Datadog Security for detected Claude Code, Codex, GitHub Copilot
CLI, Cursor, and Kiro CLI, add `--security` to the installer. Pass `--app-key`,
or set `DD_APP_KEY`. Security can block agent actions.
`--security-mode observe` only records them.

## For IT Admins

For a managed fleet (MDM or UEM), start with the
[managed deployment guide](docs/MANAGED-ENDPOINTS.md). It covers
preparation, policy, client selection, and verification. Your MDM tool deploys
the binaries and a policy that a job applies for each user, and owns updates.

Each release has these assets:

- `trajectory-darwin-amd64`, `trajectory-darwin-arm64`,
  `trajectory-darwin-universal`
- `trajectory-linux-amd64`, `trajectory-linux-arm64`
- `trajectory-windows-amd64.exe`, and the same binary as
  `trajectory-windows-amd64`
- a `trajectory-mdm-*` administrator helper for each platform, with
  `trajectory-mdm-windows-amd64.exe` for Windows
- `checksums.sha256`

## Supported Clients

[Supported clients](docs/SUPPORTED-CLIENTS.md) lists every client. Clients
marked (preview) are preview integrations.

## Documentation

- Start: [Getting started](docs/GETTING-STARTED.md),
  [user guide](docs/USER-GUIDE.md)
- Settings: [configuration](docs/CONFIGURATION.md),
  [privacy](docs/PRIVACY.md)
- Sending data: [publishing](docs/PUBLISH.md),
  [traces](docs/TRACES.md),
  [security event stream](docs/SECURITY-EVENT-STREAM.md),
  [skill observability](docs/SKILL-OBSERVABILITY.md),
  [AI Gateway](docs/AI-GATEWAY.md)
- Cost, markers, and reports: [costs](docs/COSTS.md),
  [markers](docs/MARKERS.md),
  [reports](docs/REPORTS.md)
- Metrics: [metrics reference](docs/METRICS.md),
  [metrics consistency audit](docs/METRICS.md)
- Managed fleets: [deployment guide](docs/MANAGED-ENDPOINTS.md),
  [setup](docs/MANAGED-SETUP.md),
  [decisions](docs/MANAGED-SETUP-DECISIONS.md),
  [what goes where](docs/MANAGED-WHAT-GOES-WHERE.md),
  [settings](docs/MANAGED-ENDPOINT-SETTINGS.md)
- Agent Security: [Agent Security](docs/AGENT-SECURITY.md),
  [security plugin](plugin/trajectory-security/README.md)

## License

Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE),
and [LICENSE-3rdparty.csv](LICENSE-3rdparty.csv).
