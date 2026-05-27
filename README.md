# Trajectory

Trajectory is Datadog's observability tooling for AI coding agents.

This repository contains:

- install and release metadata
- Claude Code, Codex, Gemini, Pi, and OpenCode plugin assets
- public skills and commands such as incognito mode
- setup, client, marker, and troubleshooting docs

## Install

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.sh)
```

The installer downloads the latest Trajectory release asset for your platform, installs it under `~/.trajectory/bin/trajectory`, runs `trajectory setup`, and registers detected coding-agent plugins.

To upgrade an install from this repository, rerun the installer.

Release assets are expected to use this naming convention:

```text
trajectory-darwin-amd64
trajectory-darwin-arm64
trajectory-darwin-universal
trajectory-linux-amd64
trajectory-linux-arm64
trajectory-windows-amd64.exe
trajectory-windows-arm64.exe
```

## Supported Clients

Trajectory supports:

- Claude Code
- Codex CLI
- Gemini CLI
- Cursor Desktop and cursor-agent
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
skills/                   Shared skill assets
RELEASES.json             Release-channel selector
install.sh                Installer
```

## Development

This repository accepts changes to public docs, marketplace metadata, plugin assets, and installer scaffolding.

Run the scaffold validation before opening a PR:

```bash
bash scripts/validate-scaffold.sh
```

## Reference

- [docs/USER-GUIDE.md](docs/USER-GUIDE.md): CLI workflows and day-to-day operation
- [docs/PRIVACY.md](docs/PRIVACY.md): incognito, sensitive tags, and sensitivity scanning
- [docs/METRICS-REFERENCE.md](docs/METRICS-REFERENCE.md): emitted metric names, types, tags, and query guidance
- [docs/MARKERS.md](docs/MARKERS.md): marker authoring and marker-derived metrics

## License

Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [LICENSE-3rdparty.csv](LICENSE-3rdparty.csv).
