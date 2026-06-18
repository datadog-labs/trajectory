# Trajectory User Guide

Trajectory captures sessions from AI coding agents and exports them to Datadog LLM Observability. This guide covers the CLI commands you'll use day-to-day.

## Check status

```bash
trajectory status                    # Terminal dashboard with session metrics
trajectory cost                      # Local cost summary and top sessions
trajectory view                      # Open the local browser viewer
trajectory doctor                    # Diagnose issues (binary, config, hooks, data)
trajectory diagnose publish          # Explain capture, local mapping, and publish expectations
trajectory logs [-f] [--grep PAT]   # View capture server logs
trajectory version                   # Print version
```

`trajectory doctor` is the first thing to run if something isn't working. It checks the binary, config, capture server, local-ui/Lapdog contract, database, credentials, and hook registration.

Use `trajectory view --session <id>` to inspect one captured session in the local browser viewer. If local-ui is not already running, `view` starts it and opens the session deep link. Use `trajectory user-guide local-ui` for cache repair and Lapdog-compatible local inspection.

Use `trajectory diagnose publish --session <id>` when Datadog data is missing or surprising. It compares local capture and local JSONL-to-span mapping against the transcript, then adds a metric publish plan from the local SQLite cache: expected metric counts, durable outbox row counts, missing expected rows, and the exact readback follow-up command. It does not query Datadog readback.

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

Most users edit `~/.trajectory/config.yaml` through `trajectory config set`. Installers or administrators may provide `~/.trajectory/config.defaults.yaml` to seed managed defaults, and environment variables can override specific values for the current shell or launched process.

See [CONFIGURATION.md](CONFIGURATION.md) for the full config file model, examples, `config.defaults.yaml` behavior, environment overrides, and common settings.

Common settings:

```bash
trajectory config set export.site datadoghq.com
trajectory config set export.traces standard       # off | minimal | standard | full
trajectory config set export.metrics true
trajectory config set export.placeholder_llm_span false  # omit synthetic cost-only LLM spans
trajectory config set local_ui.auto_start false    # disable automatic local-ui startup
trajectory config set-secret dd-api-key             # prompts for the key securely
```

For metrics-only Datadog export, keep `export.traces` off and set
`export.metrics` true:

```yaml
export:
  site: datadoghq.com
  ml_app: coding-agents
  traces: off
  metrics: true
```

### Forward finished sessions to a local sink

To stream finished sessions to a local HTTP endpoint instead of, or in addition
to, Datadog, set a forward URL:

```bash
trajectory setup --clients cc --forward-url http://localhost:4997/api/v1/sessions/ingest
# or, on an existing install:
trajectory config set export.local_forward_url http://localhost:4997/api/v1/sessions/ingest
```

When `export.local_forward_url` is set, `trajectory serve` POSTs each finished
session's complete event stream as NDJSON (one canonical JSONL event per line -
the same schema written to `session.jsonl`) to that URL at session end. This is
independent of the Datadog publish path and requires no Datadog credentials, so
it works in capture-only setups. Delivery is best-effort: a sink that is down
simply drops the delivery (the durable `session.jsonl` remains on disk). Leave
it empty to disable forwarding.

Do not add `type` under `export:` in normal `~/.trajectory/config.yaml`.
Trajectory creates the built-in `_config_datadog` destination from the
`export.*` fields. Destination `type` is only used in explicit `destinations:`
or managed `required_destinations:` lists.

These controls are separate: destination `type` chooses the backend/transport,
`export.traces` or destination `level` controls LLM Observability trace spans,
and `export.metrics` plus destination metric settings control metrics. Use
`type: datadog` for direct Datadog destinations, `type: datadog_agent` for
Agent-managed publishing, or `type: otlp` for OpenTelemetry collectors in new
explicit configs. OTLP destinations set a base collector `endpoint`; Trajectory
derives `/v1/traces`, `/v1/metrics`, and `/v1/logs` from it. Legacy
`type: dd_llmobs` still works.

Trace export is off by default. Set `export.traces` explicitly when you want
sessions published to LLM Observability. Rerunning `trajectory setup` preserves
an existing non-off trace setting and prints the effective level. If the
existing setting is `full`, interactive setup asks before preserving it; the
safe default is to switch back to `off`. Non-interactive setup cannot prompt, so
it warns loudly when it preserves `full`.

Secret writes are defensive: `trajectory setup` and `trajectory config
set-secret` snapshot an existing keychain value before updating it and attempt
to restore the old value if the write fails. Recover a missing Datadog key with
`trajectory config set-secret dd-api-key` or a temporary `DD_API_KEY` /
`DATADOG_API_KEY`.

Environment variables are process-local. If a long-running `trajectory serve`
process was started before `DD_API_KEY` was exported, that process cannot see
the later shell variable. Setup-managed Codex hooks invoke the installed
`trajectory capture-hook --client codex --ensure-serve` binary path so they can
verify or start a matching local capture server, but stored credentials are
still the durable option for agent sessions. Store the key once with
`trajectory config set-secret dd-api-key`, configure `auth.key_command`, or
rerun setup with `DD_API_KEY` present.

Standard Datadog credential resolution uses `auto`: env var for the
`api_key_ref`, `DD_API_KEY`, `DATADOG_API_KEY`, the configured credential-provider
command from `auth.key_command`, keychain, then destination `api_key_command`.
For standard Datadog API-key resolution, `dd-api-key` and `dd_api_key` are
accepted aliases for the same default key. Managed keychain deployments use
exact refs only and do not alias, read env vars, or run key commands.
If an env var is a secret-manager ID rather than the Datadog key, `auto` reports
it and real Datadog publish destinations continue to later sources. Pin the
intended source when you want that source to fail closed:

```bash
trajectory config set auth.credential_source keychain  # auto | env | key_provider | keychain | api_key_command
trajectory doctor
```

Managed `auth.mode: managed_keychain` policy uses exact keychain refs only.
`trajectory serve` logs an early warning when `auto` sees a malformed Datadog
env var, before the first publish attempt.

Set `export.placeholder_llm_span: false` in `~/.trajectory/config.yaml`, or `placeholder_llm_span: false` on a managed/trusted `publish.trajectory.yaml` destination, to stop publishing Trajectory's synthetic LLM child span for turn-level token/cost enrichment. The turn span still carries `metrics.estimated_total_cost` plus cost fallback metadata and the `trajectory.cost_source:turn_metrics` tag, so cost remains queryable without the placeholder child span. Project configs may disable this for a trusted destination, but cannot re-enable it if the trusted or managed destination disabled it.

For managed local-ui auto-start rollback, deploy `local_ui.auto_start: false` in `~/.trajectory/config.defaults.yaml`. A managed false value disables automatic local-ui startup and cannot be overridden from user `config.yaml`; explicit `trajectory local-ui` and `trajectory view` commands still work.

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
trajectory status --session <id> --json
trajectory cost inspect --session <id>
trajectory cost observations --session <id>
trajectory cost validate
trajectory view --session <id>
trajectory user-guide query          # Local data and safe MCP query workflow
trajectory user-guide costs          # Cost tracking commands and fidelity checks
```

The current OSS binary does not expose a general-purpose `trajectory query`
CLI. Use `trajectory status`, `trajectory view`, `get_session_trajectory`, and
the `trajectory_schema` / `trajectory_query` tools for local inspection. Pi
registers those as native extension tools; setup-managed MCP clients get the
same schema-first workflow through `trajectory mcp`. The embedded query guide
documents schema-first inspection and `TRAJECTORY_CACHE_DB` handling.

Use `trajectory cost` for local cost tracking. It reads the local SQLite cache
in read-only mode, shows recent cost totals, inspects turn-level cost evidence,
reports objective cost observations without causal claims, and validates recent
cost fidelity for supported clients. See [COSTS.md](COSTS.md).

## MCP tools

Setup-managed clients launch `trajectory mcp` automatically to expose local
agent introspection tools and resources. The MCP server covers status, active
sessions, JSONL-derived session data, marker evaluation, incognito, and guarded
read-only SQLite access.

| Surface | Names |
|---------|-------|
| Tools | `trajectory_status`, `list_active_sessions`, `get_session_trajectory`, `evaluate_markers`, `trajectory_incognito`, `trajectory_schema`, `trajectory_query` |
| Resources | `trajectory://status`, `trajectory://config`, `trajectory://sqlite/schema` |

For SQLite queries, call `trajectory_schema` first so the agent uses the live
database path and schema before calling `trajectory_query`.

`trajectory_incognito` can be called with only `enable` when the MCP server can
resolve the active session from environment variables or the active-session
registry. Responses include `resolved_session_id` and `resolution_source`. If
resolution fails, call `list_active_sessions` and retry with an explicit
`session_id`.

```bash
trajectory user-guide mcp
```

## Setup and client registration

```bash
trajectory setup                     # Interactive setup (site, API key, agents)
trajectory setup --clients codex     # Add or refresh one client integration
trajectory setup --clients copilot   # Add or refresh GitHub Copilot CLI beta live capture
trajectory setup --clients droid     # Add or refresh Factory Droid beta live capture
trajectory setup --clients all       # Add or refresh all setup-managed clients
trajectory setup --clients cc --forward-url URL  # Also forward finished sessions to a local sink
trajectory setup --uninstall codex   # Remove one client integration
```

`trajectory setup --clients ...` updates only client wiring. It skips Datadog
site, service name, and API key prompts, and leaves existing export config
unchanged. If no config file exists yet, it creates a capture-only config so
local session capture can start; run `trajectory setup` later to configure
Datadog export.

`--forward-url <url>` records `export.local_forward_url`, making `trajectory
serve` POST each finished session as NDJSON to that local endpoint at session
end with no Datadog credentials required. See "Forward finished sessions to a
local sink" above.

### Feature coverage matrix

| Client | Live capture | Tool/model events | Token/cost usage | Incognito or MCP | Backfill | Resume |
|--------|--------------|-------------------|------------------|------------------|----------|--------|
| Claude Code | HTTP hooks | Yes | Yes | Yes | Transcript backfill | Yes |
| Codex CLI | Command hooks plus rollout watcher fallback | Yes | Yes | Yes | Codex rollout backfill | Yes |
| GitHub Copilot CLI | Beta Copilot plugin command hooks | Command-level events | Not yet | MCP config and incognito skill | Not yet | Not yet |
| Gemini CLI | Managed command hooks | Yes | Yes | Yes | Gemini transcript backfill | Yes |
| Cursor Desktop | Command hooks | Yes | Cursor DB dependent | Yes | Cursor chat backfill | Yes |
| cursor-agent CLI | Transcript watcher | Tool and turn events | Not exposed by current transcripts | No | Same transcript source | No setup-managed resume |
| Factory Droid | Beta Factory plugin command hooks | Command-level events | Not yet | MCP config and incognito skill | Not yet | Not yet |
| Pi | TypeScript extension | Yes | Yes | Native tool plus MCP | Pi/OMP session backfill | Yes |
| OpenCode | Plugin SDK events | Yes | Yes | Yes | SQLite backfill | Yes |

## Publishing and export

```bash
trajectory publish validate          # Verify publish config and credentials
trajectory publish status            # Show effective mode and active sessions
trajectory publish preview           # Preview what would be published
trajectory diagnose publish          # Explain whether traces/metrics should publish
trajectory publish metrics audit --latest
                                    # Audit expected metrics from local cache
```

`trajectory publish validate` checks configuration, trust policy, and credentials, including credential source and non-secret value-shape diagnostics. `trajectory publish status` shows the effective mode, including metrics-only and trace-off states. Neither command verifies Datadog intake or readback.

For the publish operations runbook covering validate/status/preview, missing
Datadog data, `publish sync`, and publish ledger repair:

```bash
trajectory user-guide publish
```

`trajectory diagnose publish --session <id>` includes a compact metric publish
plan for that session. Use it first when one session is missing data: it shows
whether the local cache expects metric points, whether the durable metric
outbox has matching rows, and what readback command to run next.

`trajectory publish metrics audit --latest` is the deeper read-only metric
audit. It reconstructs the Datadog metric points Trajectory should publish from
the local SQLite cache and correlates those expected points with the durable
metric outbox when session-end publish has run, showing recorded, pending,
sent, failed, and dropped rows for the selected session and destination.
Outbox matches use a semantic payload identity: transport, metric kind,
normalized value, and stable tag hash. They intentionally do not compare point
timestamps, and they ignore volatile diagnostic tags such as version,
repository, owner, and user. Metric-specific dimensions such as source and
language remain part of the semantic identity. Add `--builtin-details` to
account for every built-in metric and show whether each one is `observed`,
`not_observed`, or `out_of_scope` for the selected local data. To query Datadog
for the stable dashboard mirrors, run:

```bash
trajectory config set-secret dd-app-key --stdin
trajectory publish metrics audit --latest --readback
```

The app key must belong to the destination Datadog org and include Metrics
query permission (`timeseries_query`). Managed destinations can set
`required_destinations[].app_key_ref` so readback uses the same destination
identity as publish. You can also pass it for one command with `DD_APP_KEY=...`
or use `--readback-app-key-ref <secret-name>` for a custom Trajectory keychain
secret. Application-key lookup is shared by readback and sync: explicit
command ref, destination `app_key_ref`, then `dd-app-key`, `dd_app_key`, or
`DD_APP_KEY`. Managed keychain mode uses the same order but reads each ref
exactly from the keychain.

`trajectory publish sync` creates log-based metric definitions through the
Datadog Logs configuration API. That path needs the Datadog API key used for
publish plus a Datadog application key. `publish validate` can accept the API
key while sync still fails if `DD_APP_KEY` / `dd-app-key` / `dd_app_key` is
missing or lacks log configuration write permission. Store the app key with:

```bash
trajectory config set-secret dd-app-key --stdin
```

For full built-in publish fidelity across spoofed coding-agent sources, use the
synthetic canary:

```bash
trajectory publish metrics canary --clients all --runs-per-client 2 --submit --readback
```

The canary generates one expected point for every session-auditable built-in
metric, tags each run with `trajectory.canary_run`, submits through the same
MetricRecord-to-Datadog path, and polls Datadog Metrics until every expected
metric group reads back exactly. Use `--destination <name>` when multiple
Datadog metric destinations are configured.

For marker-metric readback, use `trajectory markers canary --keep-home`. It runs an isolated synthetic session, validates local marker/cost/token/assistant-message invariants, and prints Datadog queries for metric destination verification.

`trajectory audit --deep` adds an interpretation block for local capture fidelity, config-driven trace-off states, missing model/cost attribution, and the 24-hour LLMO trace intake backfill limit.

`trajectory audit --source-data` checks the local SQLite cache contracts used by local-ui, including completed-session finalization, session/turn aggregate consistency, tool-call parentage, model/cost attribution, sparse turn IDs, and contentless active turns. Use `--json` for machine-readable output or `--db <path>` to inspect a non-default cache.

For a cleaner troubleshooting flow across doctor, diagnose, audit, validate-spans, and support bundles:

```bash
trajectory user-guide diagnostics
```

For the full metric catalog, see [METRICS-REFERENCE.md](METRICS-REFERENCE.md).

## Local UI and resume

Open the local viewer:

```bash
trajectory view
trajectory view --session <id>
```

Run local-ui manually when you need a stable port or Lapdog-compatible local
inspection:

```bash
trajectory local-ui --port 8890
trajectory local-ui --lapdog
```

Reconstruct a captured session into another supported client:

```bash
trajectory resume --list-targets
trajectory resume --session <id> --target codex --dry-run
trajectory resume --session <id> --target codex
```

Read the embedded guides for details:

```bash
trajectory user-guide local-ui
trajectory user-guide resume
```

## Datadog dashboards

Trajectory ships embedded Datadog dashboards for enterprise, developer, and operations views.

```bash
trajectory dashboard export --type operations --output trajectory-operations.json
trajectory dashboard export --type operations --format mcp --output trajectory-operations-mcp.json
```

Use the default `raw` format for Datadog dashboard API workflows. Use `--format mcp` when importing through the Datadog MCP `upsert_datadog_dashboard` tool. The MCP format keeps the payload to the tool's expected fields (`title`, `description`, `tags`, `template_variables`, and `widgets`), converts template variable `default` values to `defaults`, and keeps only `team:` dashboard tags because the MCP dashboard tool accepts only team tags.

## Privacy Controls

Use `/incognito` when the current session should not publish to ordinary Datadog observability destinations. Local JSONL capture continues, publish to non-exempt Datadog destinations is suppressed, active-session sensitivity scans are skipped, and the toggle resets when the session ends. Org-managed destinations configured with `incognito_exempt: true` may still receive events for approved security or audit use cases.

Use `<sensitive>...</sensitive>` blocks as an explicit signal to the agent and to human readers:

```text
<sensitive>
Customer details, HR/legal content, credentials, or private investigation notes.
</sensitive>
```

These tags are a convention, not a redaction boundary. Trajectory may capture the tags and enclosed text locally. If ordinary publish should be suppressed, enable `/incognito` before sharing the content, and keep sensitive values out of metric tags and marker dimensions.

The embedded `privacy` topic gives the managed-install and sensitivity-scanning version of this guidance:

```bash
trajectory user-guide privacy
```

## Backfill

Use backfill when you need to import historical sessions, refresh the local UI
cache, or repair historical dashboard metrics.

```bash
trajectory backfill --from-claude-code --republish-local  # Claude Code transcripts + local UI
trajectory backfill --republish-local                  # Refresh local UI from cached sessions
trajectory backfill --from-codex-sessions --limit 100  # Codex rollout files, newest first
trajectory backfill-my-metrics                         # Dry-run historical dashboard metrics
```

Read the full embedded guide for modes, local UI repair, historical metric
readback, and structured record backfill:

```bash
trajectory user-guide backfill
```

## Viewing logs

```bash
trajectory logs                      # Last 50 lines of serve log
trajectory logs -f                   # Follow (tail -f style)
trajectory logs -n 100               # Last 100 lines
trajectory logs --grep publish       # Filter by keyword
trajectory logs -f --grep error      # Follow errors only
```

## Markers

Markers are YAML-defined behavioral signals that Trajectory evaluates against captured sessions. They produce points, multi-turn ranges, and measures that can be exported to Datadog as `trajectory.<scope>.<concept>` metrics (where `<scope>` is one of `turn`, `session`, `task`, `commit`, or `pr`). LLM Observability marker evaluations are separate and stay off unless a destination explicitly sets `markers.evaluations: true`.

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
trajectory user-guide llm-capacity   # LLM capacity and expense controls
trajectory user-guide backfill       # Historical import, local UI repair, and metric backfill
trajectory user-guide local-ui       # Browser viewer, local-ui, and cache repair
trajectory user-guide publish        # Per-repo publish config
trajectory user-guide dashboards     # Datadog dashboard export and MCP import
trajectory user-guide markers        # Marker authoring and metrics
trajectory user-guide metrics        # Metric gates, names, tags, and queries
trajectory user-guide mcp            # MCP tools, resources, and SQL query workflow
trajectory user-guide query          # Local cache data and guarded MCP SQL workflow
trajectory user-guide privacy        # Incognito, sensitive tags, and sensitivity scanning
trajectory user-guide diagnostics    # Doctor, diagnose, audit, validate-spans, support bundles
trajectory user-guide resume         # Reconstruct captured sessions into other clients
trajectory user-guide clients        # All supported clients
trajectory user-guide clients/claude-code # Claude Code-specific details
trajectory user-guide clients/codex  # Codex-specific details
trajectory user-guide clients/copilot # GitHub Copilot CLI beta details
trajectory user-guide clients/cursor # Cursor-specific details
trajectory user-guide clients/droid  # Factory Droid beta details
trajectory user-guide clients/gemini # Gemini-specific details
trajectory user-guide clients/pi     # Pi-specific details
trajectory user-guide clients/opencode # OpenCode-specific details
trajectory user-guide install        # Installation methods
```

## Filtering by user

Every span and metric emitted by trajectory carries a `trajectory.user` tag set to your Unix username. Override it with the `TRAJECTORY_USER` environment variable.

Trajectory can also emit `trajectory.user_email` when configured. Resolution uses the first successful value: `TRAJECTORY_USER_EMAIL`, then `identity.user_email`, then `identity.user_email_command`, then `identity.user_email_suffix` appended to `trajectory.user`. Config values follow normal layering first (`config.defaults.yaml`, then `config.yaml`). If both command and suffix are set, the command wins when it returns a valid email; otherwise Trajectory falls through to the suffix.

```bash
trajectory config set identity.user_email_suffix datadoghq.com
```

GitHub identity tags are optional. `github.email` resolves from `TRAJECTORY_GITHUB_EMAIL`, then `identity.github_email`, then `identity.github_email_command`, then repo-local `git config user.email`, then global `git config user.email`. `github.username` resolves from `TRAJECTORY_GITHUB_USERNAME`, then `identity.github_username`, then `identity.github_username_command`, then repo-local `git config github.user` or `github.username`, then global Git config. Repo-local values win over global values, and commands win over Git config when they return valid values.

Use these tags to filter in LLM Obs and Metrics Explorer:

- **LLM Obs**: filter traces by `@trajectory.user:<your-name>`
- **Metrics Explorer**: scope dashboards with `trajectory.user:<your-name>`
- **GitHub identity**: filter with `github.username:<your-gh-login>` or `github.email:<your-gh-email>` when configured or resolved from Git config

This is useful on shared machines or CI where multiple users generate sessions.

## Custom publish tags

Add a top-level `tags:` map to `~/.trajectory/config.yaml` or managed
`~/.trajectory/config.defaults.yaml` when every published Datadog coding-agent
signal from that machine should carry the same low-cardinality deployment tags:

```yaml
tags:
  team: platform
  environment: development
  workspace: cloud
```

These tags are applied at publish time to Datadog LLM Observability spans and
Trajectory Datadog metric series for base, marker, heartbeat, and task metrics.
They are not written to local JSONL, and they are not added to OTLP exports,
Claude native OTLP proxy metrics, or process-level health/privacy counters.

User and managed `tags:` maps are additive. When the same key appears in both,
the managed `config.defaults.yaml` value wins. Destination-level `tags:` in
trusted destinations or `publish.trajectory.yaml` remain destination-scoped, but
managed top-level tags are reapplied for shared keys.

Keep custom tags stable and non-sensitive. Avoid prompts, paths, URLs,
arbitrary emails, SHAs, random IDs, and secrets. Use `identity.*` settings for
user/email/GitHub attribution instead of custom keys.

## Repo tags on metrics

Trajectory automatically tags every DD metric with repository metadata extracted from the git remote:

- `repo` - repository name (e.g., `trajectory`)
- `owner` - org or user (e.g., `DataDog`)
- `git_remote_host` - host (e.g., `github.com`)

These tags appear on all metric series, so you can filter and group by
repository in Metrics Explorer without any configuration. When a remote origin
is unavailable, Trajectory falls back to the project directory basename for
`repo` when possible and uses `unknown` for unavailable owner or host values.

## Completed-sample distributions

Trajectory publishes distribution metrics for completed samples that are useful as populations in Metrics Explorer. Use percentile aggregators such as `p95:` on these names after Datadog percentile aggregations are enabled for the metric:

- `trajectory.turn.tool_uses.total` - total tool calls in a completed turn. This is intentionally separate from the `trajectory.turn.tool_uses` gauge, which is split by `tool_name` for per-tool breakdowns.
- `trajectory.turn.cost.usd.total` - estimated USD cost of a completed turn.
- `trajectory.turn.web_search.requests.total` and `trajectory.turn.web_search.cost.usd.total` - completed-turn WebSearch request and cost samples.
- `trajectory.turn.duration_ms.total` - duration of a completed turn when the client provides or Trajectory can derive it.
- `trajectory.turn.permission_wait_ms.total` - estimated human approval wait inside a completed turn, emitted when Trajectory can derive a permission wait interval.
- `trajectory.turn.duration_ms.excluding_permission_wait.total` - completed-turn duration minus derivable permission wait, useful when you want agent elapsed time with approval waits removed.
- `trajectory.session.turns.total`, `trajectory.session.tool_uses.total`, `trajectory.session.cost.usd.total`, `trajectory.session.web_search.requests.total`, `trajectory.session.web_search.cost.usd.total`, and `trajectory.session.compactions.total` - completed-session samples.
- `trajectory.session.web_search.requests` and `trajectory.session.web_search.cost.usd.accumulated` - running and final observed WebSearch request and cost gauges.
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

PR attribution metrics remain aggregate-only. Trajectory emits `trajectory.pr.cost.usd.attributed.total` for the cost attributed to turns that contributed to a PR, `trajectory.pr.attributed_turns.total` for the number of attributed turns, and `trajectory.pr.containing_session.cost.usd.total` for the total cost of sessions that contained PR activity. Managed installs may separately enable `pr_attribution` structured records for PR/MR drilldown; repo configs and security destinations cannot enable those records.
