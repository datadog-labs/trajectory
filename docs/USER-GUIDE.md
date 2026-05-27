# Trajectory User Guide

Trajectory captures sessions from AI coding agents and exports them to Datadog LLM Observability. This guide covers the CLI commands you'll use day-to-day.

## Check status

```bash
trajectory status                    # Terminal dashboard with session metrics
trajectory doctor                    # Diagnose issues (binary, config, hooks, data)
trajectory diagnose publish          # Explain capture, local mapping, and publish expectations
trajectory logs [-f] [--grep PAT]   # View capture server logs
trajectory version                   # Print version
```

`trajectory doctor` is the first thing to run if something isn't working. It checks the binary, config, capture server, database, credentials, and hook registration.

Use `trajectory diagnose publish --session <id>` when Datadog data is missing or surprising. It compares local capture and local JSONL-to-span mapping against the transcript, then explains whether traces or metrics are expected from the current config. It does not query Datadog readback.

Use `trajectory doctor --support-bundle` to write a redacted JSON support bundle under `~/.trajectory/` with doctor output, publish diagnosis, recent publish-related serve logs, and pricing status.

For slow Codex launch or exit reports, the default doctor output includes recent Trajectory MCP lifecycle timing and any existing Codex startup traces. If attribution is unclear, run `trajectory doctor --codex-startup` to launch a bounded Codex startup probe. The probe records whether Codex is delayed before `thread_spawn`, before Trajectory MCP is launched, or inside Trajectory itself.

For repeated Codex turns or malformed LLM Obs spans, check the capture and publish guardrail signals:

- `codex.session_id_change_ignored`: serve diagnostic event. A replayed Codex rollout tried to change `session_id` after the first `session_start`; Trajectory kept the original child session ID and ignored inherited parent context.
- `trajectory.instrumentation.capture.gap` with `client_source:codex`, `signal:jsonl`, and `reason:duplicate_event`: instrumentation-health metric. Normalized Codex JSONL contained more than one `session_start` for the same session.
- `incompatible duplicate span identity`: publish error. Two spans in one export batch shared `(trace_id, span_id)` with different payloads, so export failed closed.
- `skipping incomplete turn ... (incremental)`: publish log. A turn batch had no `turn_end`, so Trajectory waited instead of publishing a partial turn span.

## Configuration

```bash
trajectory config show               # View merged runtime config
trajectory config set <key> <value>  # Set a config value
trajectory config set-secret <name>  # Store a secret in the OS keychain
trajectory config get <key>          # Read a single value
```

Common settings:

```bash
trajectory config set export.site datadoghq.com
trajectory config set export.traces standard       # off | minimal | standard | full
trajectory config set export.metrics true
trajectory config set-secret dd-api-key             # prompts for the key securely
```

Trace export is off by default. Set `export.traces` explicitly when you want sessions published to LLM Observability.

## Capture server

The capture server receives hook events from your coding agent on port 19222.

```bash
trajectory serve                     # Start capture server (foreground)
trajectory dev serve                 # Start in dev mode (auto-restart on binary change)
```

The server starts automatically when your agent launches a session (via plugin hooks). You rarely need to start it manually.

## Querying sessions

```bash
trajectory status                    # Overview of recent sessions
trajectory query --schema            # Show database tables
trajectory query "SELECT * FROM sessions ORDER BY start_time DESC LIMIT 5"
trajectory query --named list_named_queries   # List built-in queries
```

## Setup and client registration

```bash
trajectory setup                     # Interactive setup (site, API key, agents)
trajectory setup --clients codex     # Register one client integration
trajectory setup --clients all       # Register all detected clients
trajectory setup --uninstall codex   # Remove one client integration
```

## Publishing and export

```bash
trajectory publish validate          # Verify publish config and credentials
trajectory publish status            # Show effective mode and active sessions
trajectory publish preview           # Preview what would be published
trajectory diagnose publish          # Explain whether traces/metrics should publish
```

`trajectory publish validate` checks configuration, trust policy, and credentials. `trajectory publish status` shows the effective mode, including metrics-only and trace-off states. Neither command verifies Datadog intake or readback.

`trajectory audit --deep` adds an interpretation block for local capture fidelity, config-driven trace-off states, missing model/cost attribution, and the 24-hour LLMO trace intake backfill limit.

For the full metric catalog, see [METRICS-REFERENCE.md](METRICS-REFERENCE.md).

## Datadog dashboards

Trajectory ships embedded Datadog dashboards for enterprise, developer, and operations views.

```bash
trajectory dashboard export --type operations --output trajectory-operations.json
trajectory dashboard export --type operations --format mcp --output trajectory-operations-mcp.json
```

Use the default `raw` format for Datadog dashboard API workflows. Use `--format mcp` when importing through the Datadog MCP `upsert_datadog_dashboard` tool. The MCP format keeps the payload to the tool's expected fields (`title`, `description`, `tags`, `template_variables`, and `widgets`), converts template variable `default` values to `defaults`, and keeps only `team:` dashboard tags because the MCP dashboard tool accepts only team tags.

## Privacy Controls

Use `/incognito` when the current session should not publish to ordinary Datadog observability destinations. Local JSONL capture continues, publish to non-exempt Datadog destinations is suppressed, and the toggle resets when the session ends. Org-managed destinations configured with `incognito_exempt: true` may still receive events for approved security or audit use cases.

Use `<sensitive>...</sensitive>` blocks as an explicit signal to the agent and to human readers:

```text
<sensitive>
Customer details, HR/legal content, credentials, or private investigation notes.
</sensitive>
```

These tags are a convention, not a redaction boundary. Trajectory may capture the tags and enclosed text locally. If ordinary publish should be suppressed, enable `/incognito` before sharing the content, and keep sensitive values out of metric tags and marker dimensions.

For the full privacy-controls guide, see [PRIVACY.md](PRIVACY.md).

## Backfill

Import sessions from before trajectory was installed:

```bash
trajectory backfill --from-transcripts                 # Claude Code transcripts
trajectory backfill --from-codex-sessions --limit 100  # Codex rollout files, newest first
trajectory backfill --from-codex-sessions --continue   # Continue the previous Codex page
trajectory backfill --index-local --limit 100          # Index trajectory JSONL into local-ui cache
trajectory backfill --status                           # Show saved paged backfill status
```

Paged backfills are manual maintenance commands. They do not run during agent startup. Codex rollout repair and local-ui cache indexing process newest files first and skip active files whose modification time is less than 2 minutes old. Rerun the same command after active sessions are quiet if doctor still reports missing data.

`trajectory doctor` detects recent Codex rollout files that have not been converted and recent trajectory JSONL files that are missing from the local-ui cache. It prints the matching `trajectory backfill ...` command instead of running repair automatically.

Re-publish historical dashboard and marker metrics from local records:

```bash
trajectory backfill-metrics --dry-run
trajectory backfill-metrics --since YYYY-MM-DD --destination NAME
```

This reconstructs the known dashboard metric suite from the local SQLite cache, including session, turn, cost, tool-call, and marker metrics. Use `--since YYYY-MM-DD`, `--until YYYY-MM-DD`, or `--destination NAME` when you need a narrower repair.

Historical metric backfill only works when Datadog Historical Metrics Ingestion is enabled for the destination org and metric types. Without that Datadog-side setting, old points may be dropped even when `backfill-metrics` submits successfully. LLMO trace intake is stricter: historical trace backfill is only accepted for recent data, so sessions older than 24 hours should be treated as local-fidelity evidence rather than a promise that missing LLMO traces can be repaired.

## Viewing logs

```bash
trajectory logs                      # Last 50 lines of serve log
trajectory logs -f                   # Follow (tail -f style)
trajectory logs -n 100               # Last 100 lines
trajectory logs --grep publish       # Filter by keyword
trajectory logs -f --grep error      # Follow errors only
```

## Markers

Markers are YAML-defined behavioral signals that Trajectory evaluates against captured sessions. They produce points, multi-turn ranges, and measures that can be exported to Datadog as `trajectory.<scope>.<concept>` metrics (where `<scope>` is one of `turn`, `session`, `task`, `commit`, `pr`).

Read the full guide in [MARKERS.md](MARKERS.md), or from the binary:

```bash
trajectory user-guide markers
```

Trajectory layers embedded built-ins, org markers, user add-ons in `~/.trajectory/markers.d/*.yaml`, user markers in `~/.trajectory/markers.yaml`, and project markers in `.trajectory/markers.yaml`. To opt in to the optional security catalog:

```bash
trajectory markers enable-security
```

This writes `~/.trajectory/markers.d/security.yaml`; delete that file to disable the add-on. Use `--output PATH` to write the template somewhere else, or `--force` to overwrite an existing output file.

## Built-in help

The binary includes a full user guide with detailed topics:

```bash
trajectory user-guide                # List all topics
trajectory user-guide config         # Configuration deep-dive
trajectory user-guide publish        # Per-repo publish config
trajectory user-guide dashboards     # Datadog dashboard export and MCP import
trajectory user-guide markers        # Marker authoring and metrics
trajectory user-guide metrics        # Metric gates, names, tags, and queries
trajectory user-guide privacy        # Incognito, sensitive tags, and sensitivity scanning
trajectory user-guide clients        # All supported clients
trajectory user-guide clients/codex  # Codex-specific details
trajectory user-guide install        # Installation methods
```

## Filtering by user

Every span and metric emitted by trajectory carries a `trajectory.user` tag set to your Unix username. Override it with the `TRAJECTORY_USER` environment variable.

Use this tag to filter in LLM Obs and Metrics Explorer:

- **LLM Obs**: filter traces by `@trajectory.user:<your-name>`
- **Metrics Explorer**: scope dashboards with `trajectory.user:<your-name>`

This is useful on shared machines or CI where multiple users generate sessions.

## Repo tags on metrics

Trajectory automatically tags every DD metric with repository metadata extracted from the git remote:

- `repo` - repository name (e.g., `example-service`)
- `owner` - org or user (e.g., `example-org`)
- `git_remote_host` - host (e.g., `github.com`)

These tags appear on all metric series, so you can filter and group by repository in Metrics Explorer without any configuration.

## Completed-sample distributions

Trajectory publishes distribution metrics for completed samples that are useful as populations in Metrics Explorer. Use percentile aggregators such as `p95:` on these names after Datadog percentile aggregations are enabled for the metric:

- `trajectory.turn.tool_uses.total` - total tool calls in a completed turn. This is intentionally separate from the `trajectory.turn.tool_uses` gauge, which is split by `tool_name` for per-tool breakdowns.
- `trajectory.turn.cost.usd.total` - estimated USD cost of a completed turn.
- `trajectory.turn.duration_ms.total` - duration of a completed turn when the client provides or Trajectory can derive it.
- `trajectory.turn.permission_wait_ms.total` - estimated human approval wait inside a completed turn, emitted when Trajectory can derive a permission wait interval.
- `trajectory.turn.duration_ms.excluding_permission_wait.total` - completed-turn duration minus derivable permission wait, useful when you want agent elapsed time with approval waits removed.
- `trajectory.session.turns.total`, `trajectory.session.tool_uses.total`, `trajectory.session.cost.usd.total`, and `trajectory.session.compactions.total` - completed-session samples.
- `trajectory.pr.cost.usd.attributed.total`, `trajectory.pr.attributed_turns.total`, and `trajectory.pr.containing_session.cost.usd.total` - completed-PR samples for PR cost attribution dashboards.
- `trajectory.session.last_seen.unix` - latest observed session event time as Unix seconds, useful for recency-sorted session tables. Enable Historical Metrics Ingestion for this gauge before replaying sessions older than one hour.

For Claude Code comparisons, treat these as the qualified active-time breakout:
`trajectory.turn.duration_ms.total` is total agent turn elapsed time,
`trajectory.turn.permission_wait_ms.total` is derivable human approval wait, and
`trajectory.turn.duration_ms.excluding_permission_wait.total` is elapsed time
with that derivable approval wait removed. They are comparable operational
signals, not an exact replacement for native `claude_code.active_time.total`
foreground/idle-excluded activity.

## Per-commit and PR cost attribution

Marker compute blocks (`sum` and `count` over turn windows) enable per-commit cost attribution. When a session contains multiple commits, trajectory can attribute token spend and tool call counts to the turns that produced each commit.

This powers the `trajectory.commit.cost.usd.total` and `trajectory.commit.attributed_turns.total` distribution metrics, letting you answer "how much did this commit cost?" and percentile questions such as p95 cost per commit in Metrics Explorer, optionally split by the `branch` tag.

PR attribution uses metrics only. Trajectory emits `trajectory.pr.cost.usd.attributed.total` for the cost attributed to turns that contributed to a PR, `trajectory.pr.attributed_turns.total` for the number of attributed turns, and `trajectory.pr.containing_session.cost.usd.total` for the total cost of sessions that contained PR activity. These power aggregate dashboards and Metrics Explorer queries without publishing PR URL tables or record/log payloads.
