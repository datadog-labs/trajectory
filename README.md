# Trajectory

Trajectory is Datadog's observability layer for AI coding agents. It turns local
agent sessions into inspectable timelines, behavioral signals, operational
metrics, and Datadog LLM Observability traces so teams can understand what their
agents are doing, how much they cost, where they get stuck, and which workflows
are working.

Trajectory instruments coding-agent workflows at the client boundary: hooks,
watchers, plugin runtimes, and MCP surfaces capture session lifecycle, turns,
tool calls, model usage, token and cost signals, repository context, and
attribution metadata. You get a local record first, then optional Datadog export
when configured.

## Why Trajectory

AI coding agents are becoming part of the software delivery loop, but their work
is often hard to inspect after the terminal scrolls away. Trajectory gives that
work an observability model:

- What did the agent do during the session?
- Which tools, files, repositories, commits, and pull requests were involved?
- How much did the session cost, and where did time go?
- Did the workflow show signs of retries, confusion, repeated failures, or
  successful task completion?
- Which behavior patterns are improving or regressing across users and teams?

## Feature Highlights

- **Markers**: a flagship YAML-based signal layer for detecting workflow
  patterns across turns, sessions, tasks, commits, and pull requests. Marker
  results can be inspected locally and exported as Datadog metrics, making
  qualitative agent behavior measurable over time.
- **Multi-client instrumentation**: capture from Claude Code, Codex CLI, Gemini
  CLI, Cursor, Pi, OpenCode, GitHub Copilot CLI beta, and Factory Droid beta
  with client-specific hooks, watchers, plugins, and backfill paths.
- **Datadog-native export**: publish configurable LLM Observability traces and
  operational metrics for tokens, cost, duration, tool use, capture health,
  marker results, and attribution workflows.
- **Local investigation loop**: inspect sessions with `trajectory status`,
  `trajectory view`, diagnostics, support bundles, MCP tools, and historical
  backfill before deciding what to export.
- **Privacy and capacity controls**: use `/incognito`, local-only capture,
  sensitivity scanning, configurable trace detail, and controls for
  Trajectory-owned LLM calls.
- **Workflow attribution**: connect agent activity to repositories, commits,
  pull requests, and completed-session samples so agent impact can be explored
  alongside delivery outcomes.

## Install

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.sh)
```

The installer downloads the latest Trajectory release asset for your platform, installs it under `~/.trajectory/bin/trajectory`, stages the Claude wrapper intercept runtime, runs `trajectory setup`, and registers detected coding-agent plugins.

To upgrade an install from this repository, rerun the installer.

Release assets use this naming convention:

```text
trajectory-darwin-amd64
trajectory-darwin-arm64
trajectory-darwin-universal
trajectory-linux-amd64
trajectory-linux-arm64
trajectory-windows-amd64.exe
```

## Supported Clients

Trajectory supports:

- Claude Code
- Codex CLI
- GitHub Copilot CLI beta
- Gemini CLI
- Cursor Desktop and cursor-agent
- Factory Droid beta
- Pi
- OpenCode

See [docs/SUPPORTED-CLIENTS.md](docs/SUPPORTED-CLIENTS.md) for version
requirements and [docs/CLIENT-INSTRUMENTATION.md](docs/CLIENT-INSTRUMENTATION.md)
for the per-client hook, MCP, watcher, and backfill surfaces.

## Repository Contents

```text
.agents/plugins/          Codex marketplace metadata
.claude-plugin/           Claude marketplace metadata
commands/                 Gemini command assets
docs/                     Public user documentation
plugin/trajectory/        Claude Code plugin
plugin/trajectory-codex/  Codex plugin
plugin/trajectory-gemini/ Gemini context assets
plugin/trajectory-pi/     Pi extension
plugin/trajectory-opencode/ OpenCode plugin
intercepts/               Claude wrapper intercept runtime
skills/                   Shared skill assets
RELEASES.json             Release-channel selector
install.sh                Installer
```

## Development

This repository accepts changes to public docs, marketplace metadata, plugin assets, installer scaffolding, and release metadata.

## Reference

- [docs/USER-GUIDE.md](docs/USER-GUIDE.md): CLI workflows and day-to-day operation
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md): config files, managed defaults, environment overrides, and common settings
- [docs/SUPPORTED-CLIENTS.md](docs/SUPPORTED-CLIENTS.md): supported coding-agent clients and version requirements
- [docs/CLIENT-INSTRUMENTATION.md](docs/CLIENT-INSTRUMENTATION.md): per-client hook, watcher, MCP, and backfill surfaces
- [docs/PRIVACY.md](docs/PRIVACY.md): incognito, sensitive tags, and sensitivity scanning
- [docs/LLM-CAPACITY.md](docs/LLM-CAPACITY.md): which features use additional LLM capacity and how to control them
- [docs/METRICS-REFERENCE.md](docs/METRICS-REFERENCE.md): emitted metric names, types, tags, and query guidance
- [docs/MARKERS.md](docs/MARKERS.md): marker authoring and marker-derived metrics

## License

Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [LICENSE-3rdparty.csv](LICENSE-3rdparty.csv).
