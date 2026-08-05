# Trajectory

Observe AI coding agents like production systems.

See the whole run. Measure the behavior. Improve the workflow.

Trajectory captures coding-agent sessions across Claude Code, Claude Desktop,
Cline CLI, Codex, Gemini, Antigravity, Goose, Aider, Continue CLI, Mistral
Vibe, Codebuff, Hermes Agent, Amp Code, Qwen Code, OpenHands, Kiro CLI, Kilo
Code, Cursor, Pi, OpenCode, GitHub Copilot CLI, and Factory Droid, then turns them
into local timelines, Datadog LLM Observability traces, operational metrics,
and Markers.

## What It Answers

- What happened in this session?
- Where did time, tokens, and cost go?
- What kinds of work are agents doing, and what are they delivering?
- Which repos, files, commits, and pull requests were involved?
- Did the agent make progress, loop, retry, or stall?
- Which agent workflows are improving across users and teams?

## Markers

Markers are Trajectory's signature feature: YAML-defined measurements for agent
behavior. Write a rule once, then evaluate it across turns, sessions, tasks,
commits, and pull requests.

Example: add this to `.trajectory/markers.yaml` in a repo to turn an agent
force-push into a measurable signal.

```yaml
version: 2

points:
  - name: force-push
    description: Agent force-pushed to a remote
    severity: warn
    confidence: high
    emit: metric
    scope: session
    match:
      tool: [Bash, Shell, exec_command, run_shell]
      command: '(?i)^git\s+push\b.*--force'
      not_input: '--force-with-lease'

measures:
  - name: force-pushes
    scope: session
    count:
      point: force-push
```

How it works:

- `points` define behavior to detect. This point watches shell-like tool calls
  for `git push --force`.
- `not_input` excludes the safer `--force-with-lease` path.
- `emit: metric` makes the point eligible for marker metric export.
- `scope: session` says the signal describes the session, not just one turn.
- `measures` turns point hits into a count named `force-pushes`.

When the command appears in a captured session, Trajectory records a
`force-push` marker and can publish `trajectory.session.force_pushes` plus a
completed-session count metric. Raw behavior becomes something you can query by
repo, team, environment, or release workflow.

Use Markers to detect patterns such as:

- retry loops
- repeated failures
- tool thrash
- context churn
- approval friction
- cost spikes
- task progress
- pull-request attribution

Marker results are available locally and can be exported as Datadog metrics, so
agent behavior becomes something you can graph, alert on, compare, and improve.

## Core Capabilities

- **Multi-client instrumentation** for Claude Code, Cline CLI, Codex CLI,
  Gemini CLI, Antigravity CLI, Goose, Aider, Continue CLI, Mistral Vibe,
  Codebuff, Hermes Agent, Amp Code, Qwen Code, OpenHands, Kiro CLI, Kilo Code,
  Cursor, Pi, OpenCode, GitHub Copilot CLI beta, and Factory Droid beta.
- **Local-first timelines** for session lifecycle, turns, tool calls, model
  usage, cost signals, and repository context.
- **Work Insights and reports** for adoption, outcomes, task mix, complexity,
  agent-work cost, pull-request attribution, and evidence-backed deliverables.
- **Datadog-native export** for configurable LLM Observability traces and
  operational metrics for tokens, cost, duration, tool use, capture health, and
  attribution workflows.
- **Agent Security controls** through the independently installable
  `trajectory-security` plugin for Claude Code, Codex, and Cursor.
- **Investigation tools** including `trajectory status`, `trajectory view`,
  diagnostics, support bundles, MCP tools, and historical backfill.
- **Privacy and capacity controls** including `/incognito`, local-only capture,
  durable `trajectory config capture disable` / `trajectory config capture enable`
  capture control,
  sensitivity scanning, configurable trace detail, and controls for
  Trajectory-owned LLM calls.
- **Workflow attribution** across repositories, commits, pull requests, and
  completed-session samples, including CODEOWNER-aware production analysis.
- **Preview integrations** for CommandCode, Devin CLI, ForgeCode, gptme, Grok
  Build, Kimi Code CLI, Oh My Pi, Qoder CLI, VS Code Copilot Chat, Warp,
  Windsurf, ZCode, and Zed.

## Install

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.sh)
```

The installer downloads the latest Trajectory release asset for your platform, installs it under `~/.trajectory/bin/trajectory`, stages the Claude wrapper intercept runtime, runs `trajectory setup`, and registers detected coding-agent integrations. Agent command shims are opt-in and can be installed with `--install-client-shims` where supported.

Add `--security` to enable Datadog Security for detected Claude Code, Codex,
and Cursor installations. Security defaults to enforce mode; use
`--security-mode observe` for non-blocking recording. Pass `--app-key` or set
`DD_APP_KEY` when enabling security so result readback can authenticate.

To upgrade an install from this repository, rerun the installer.

Release assets use this naming convention:

```text
trajectory-darwin-amd64
trajectory-darwin-arm64
trajectory-darwin-universal
trajectory-linux-amd64
trajectory-linux-arm64
trajectory-windows-amd64.exe
trajectory-windows-amd64

trajectory-mdm-darwin-amd64
trajectory-mdm-darwin-arm64
trajectory-mdm-darwin-universal
trajectory-mdm-linux-amd64
trajectory-mdm-linux-arm64
trajectory-mdm-windows-amd64.exe
```

The `trajectory-mdm-*` assets are administrator tools for preparing and
verifying managed endpoint deployment kits. They are not installed on employee
endpoints.

## Supported Clients

Trajectory supports:

- Claude Code
- Claude Desktop (macOS)
- Cline CLI
- Codex CLI
- GitHub Copilot CLI beta
- Gemini CLI
- Antigravity CLI (`agy`)
- Aider
- Continue CLI
- Mistral Vibe
- Codebuff
- Goose
- Hermes Agent
- Amp Code
- Qwen Code
- OpenHands
- Kiro CLI
- Kilo Code
- Cursor Desktop and cursor-agent
- Factory Droid beta
- Pi
- OpenCode
- CommandCode (preview)
- Devin CLI (preview)
- ForgeCode (preview)
- gptme (preview)
- Grok Build (preview)
- Kimi Code CLI (preview)
- Oh My Pi (preview)
- Qoder CLI (preview)
- VS Code Copilot Chat (preview)
- Warp/Oz CLI (preview)
- Windsurf (preview)
- ZCode (preview)
- Zed (preview)

See [docs/SUPPORTED-CLIENTS.md](docs/SUPPORTED-CLIENTS.md) for version
requirements and [docs/CLIENT-INSTRUMENTATION.md](docs/CLIENT-INSTRUMENTATION.md)
for the per-client hook, MCP, watcher, and backfill surfaces.

## Reports

Turn local agent activity into an operational view:

```bash
trajectory summary                   # Usage, tokens, cost, agents, and projects
trajectory outcomes                  # Yield, cost per commit, and cost per PR
trajectory patterns                  # Work mix, outcomes, cost, and deliverables
trajectory patterns session ID       # Task spans and turn-level cost drivers
```

Reports support bounded time windows, stable JSON, local-only PR evidence, and
optional GitHub reconciliation. Historical classification is explicit:
`trajectory patterns estimate` makes no model calls, and
`trajectory patterns analyze --yes` is the spending boundary.

See [docs/REPORTS.md](docs/REPORTS.md) for report semantics and
[docs/WHY-TRAJECTORY.md](docs/WHY-TRAJECTORY.md) for how Trajectory fits into
the broader observability stack.

## Repository Contents

```text
.agents/plugins/          Codex marketplace metadata
.claude-plugin/           Claude marketplace metadata
commands/                 Gemini command assets
docs/                     Public user documentation
plugin/trajectory/        Claude Code plugin
plugin/trajectory-security/ Standalone Agent Security plugin
plugin/trajectory-codex/  Codex plugin
plugin/trajectory-gemini/ Gemini context assets
plugin/trajectory-antigravity/ Antigravity CLI plugin
plugin/trajectory-pi/     Pi extension
plugin/trajectory-opencode/ OpenCode plugin
plugin/trajectory-kilo/   Kilo Code plugin
intercepts/               Claude wrapper intercept runtime
skills/                   Shared skill assets
RELEASES.json             Release-channel selector
install.sh                Installer
```

## Development

This repository accepts changes to public docs, marketplace metadata, plugin assets, installer scaffolding, and release metadata.

## Reference

- [docs/USER-GUIDE.md](docs/USER-GUIDE.md): CLI workflows and day-to-day operation
- [docs/WHY-TRAJECTORY.md](docs/WHY-TRAJECTORY.md): product scope and how Trajectory complements the rest of the observability stack
- [docs/REPORTS.md](docs/REPORTS.md): summary, outcomes, Patterns, historical analysis, and session drilldown
- [docs/CONFIGURATION.md](docs/CONFIGURATION.md): config files, managed defaults, environment overrides, and common settings
- [docs/API-APP-KEY-MANAGEMENT.md](docs/API-APP-KEY-MANAGEMENT.md): Datadog API/application key storage, resolution, permissions, and rotation
- [docs/SECURITY.md](docs/SECURITY.md): standalone Agent Security plugin setup, modes, destinations, and secret handling
- [docs/MANAGED-ENDPOINTS.md](docs/MANAGED-ENDPOINTS.md): managed endpoint bundle preparation and endpoint verification
- [docs/FEATURE-FLAGS.md](docs/FEATURE-FLAGS.md): feature-flag commands, runtime overrides, and registered flags
- [docs/SUPPORTED-CLIENTS.md](docs/SUPPORTED-CLIENTS.md): supported coding-agent clients and version requirements
- [docs/CLIENT-INSTRUMENTATION.md](docs/CLIENT-INSTRUMENTATION.md): per-client hook, watcher, MCP, and backfill surfaces
- [docs/CURSOR-CAPTURE-TRUST.md](docs/CURSOR-CAPTURE-TRUST.md): trustworthy Cursor tokens, cost, surface, and subagent signals
- [docs/COSTS.md](docs/COSTS.md): local cost summaries, turn evidence, objective observations, and fidelity checks
- [docs/COST-ATTRIBUTION.md](docs/COST-ATTRIBUTION.md): additive cost totals, overlapping CODEOWNER associations, and safe dashboard patterns
- [docs/PRIVACY.md](docs/PRIVACY.md): incognito, sensitive tags, and sensitivity scanning
- [docs/SECURITY-EVENT-STREAM.md](docs/SECURITY-EVENT-STREAM.md): managed security event log projection
- [docs/LLM-CAPACITY.md](docs/LLM-CAPACITY.md): which features use additional LLM capacity and how to control them
- [docs/METRICS-REFERENCE.md](docs/METRICS-REFERENCE.md): emitted metric names, types, tags, and query guidance
- [docs/MARKERS.md](docs/MARKERS.md): marker authoring and marker-derived metrics
- [docs/REPO-MARKERS.md](docs/REPO-MARKERS.md): repo-level marker files and publish overlays
- [docs/SKILL-OBSERVABILITY.md](docs/SKILL-OBSERVABILITY.md): skill usage, attribution, and dashboard guidance
- [docs/DATA-FORMATS.md](docs/DATA-FORMATS.md): materialized session fields and LLM Observability export fields
- [docs/SUBAGENT-TRACE-MODEL.md](docs/SUBAGENT-TRACE-MODEL.md): semantic subagent trace rendering and span-link behavior
- [docs/LLM-OBS-SPAN-TAGS.md](docs/LLM-OBS-SPAN-TAGS.md): Datadog LLM Observability span tag contract
- [docs/COST-OVERLAP-CONSUMER-GUIDE.md](docs/COST-OVERLAP-CONSUMER-GUIDE.md): cost-overlap dashboard guidance
- [docs/LOCAL-UI-DATA-SOURCES.md](docs/LOCAL-UI-DATA-SOURCES.md): local-ui datastore provenance fields

## License

Apache-2.0. See [LICENSE](LICENSE), [NOTICE](NOTICE), and [LICENSE-3rdparty.csv](LICENSE-3rdparty.csv).
