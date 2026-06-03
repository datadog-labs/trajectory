# Metrics Reference

This page catalogs the metric surface emitted by the current Trajectory binary. Metric names, types, and tags are treated as part of the public distribution contract.

For marker syntax and dashboard examples, see [MARKERS.md](MARKERS.md). For
configuration and destination trust, see [USER-GUIDE.md](USER-GUIDE.md).
For the built-in metric guide, run:

```bash
trajectory user-guide metrics
```

## Naming Model

Trajectory metric names follow this shape:

```text
trajectory.<scope>.<concept>[.<measurement>]
```

The common scopes are `turn`, `session`, `task`, `commit`, `pr`, `publish`,
and `serve`. `gen_ai.usage.*` metrics use the OpenTelemetry GenAI naming
convention for token counts.

Lifecycle suffixes are meaningful:

| Suffix | Meaning |
|---|---|
| `.elapsed` | Running session-to-date gauge emitted while a session is active |
| `.accumulated` | Running money/cost gauge emitted while a session is active and at session end |
| `.total` | Completed-sample value, usually a distribution sample for percentile queries |
| `.count` | Additive counter-style delta |

Metric type is part of the contract. A metric name should not be reused as both
a gauge and a distribution. Completed samples use distinct names from live
gauges for that reason.

## Emission Gates

Base telemetry is emitted when `export.metrics: true` is enabled for an active
Datadog or OTLP destination. Trace export can still be off; metrics-only mode is
valid and common.

Marker-derived metrics require both marker evaluation and destination marker
metrics:

```yaml
markers:
  enabled: true
  metrics: true
```

If a destination sets `markers.metrics: false`, marker-derived metrics are
suppressed for that destination. Project `publish.trajectory.yaml` files can add
metrics-only destinations only when `level: off`, marker metrics are enabled,
and marker logs are disabled.

Serve-side operational counters such as incognito and sensitivity health are
best-effort Datadog Metrics API submissions. They are not tied to trace export.

## Common Tags

Publish-engine metrics receive the canonical tag set below when the source
context is available. Identity tags use fallbacks so metrics are not silently
unattributed.

| Tag | Meaning | Fallback |
|---|---|---|
| `gen_ai.conversation.id` | Session ID | `unknown` |
| `session_id` | Compatibility alias for session ID | `unknown` |
| `trajectory.client_source` | Client source, such as `claude-code`, `codex`, `gemini`, `cursor`, `pi`, or `opencode` | `unknown` |
| `trajectory.user` | Resolved user | `unknown` |
| `trajectory.user_email` | Optional resolved user email from `TRAJECTORY_USER_EMAIL`, `identity.user_email`, `identity.user_email_command`, or `identity.user_email_suffix` | Omitted |
| `github.email` | Optional resolved GitHub email from `TRAJECTORY_GITHUB_EMAIL`, `identity.github_email`, `identity.github_email_command`, repo-local Git config, or global Git config | Omitted |
| `github.username` | Optional resolved GitHub username from `TRAJECTORY_GITHUB_USERNAME`, `identity.github_username`, `identity.github_username_command`, repo-local Git config, or global Git config | Omitted |
| `trajectory.version` | Trajectory binary version | `dev` |
| `host` | Local hostname | `unknown` |
| `os.type` | Operating system family | Runtime OS |
| `os.version` | OS version string, when available | Omitted |
| `ml_app` | Destination ML app | Omitted |
| `gen_ai.request.model` | Model name | Omitted |
| `trajectory.client_version` | Client or harness version | Omitted |
| `repo` | Git repository name from the remote origin, or project directory basename when the origin is unavailable | `unknown` |
| `owner` | Git repository owner from the remote origin | `unknown` |
| `git_remote_host` | Git remote host from the remote origin | `unknown` |
| `project_dir` | Project directory basename | Omitted |
| `trajectory.trace_type` | Metric grain: `turn`, `session`, `task`, `commit`, or `pr` | Set by emitter |

Destination tags may also be present. Keep custom tags low-cardinality and
non-sensitive.

## Per-Turn Metrics

Per-turn metrics are emitted on completed turn events.

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `gen_ai.usage.input_tokens` | count | token | Emitted when input tokens are greater than zero |
| `gen_ai.usage.output_tokens` | count | token | Emitted when output tokens are greater than zero |
| `gen_ai.usage.cache_creation_tokens` | count | token | Emitted when cache creation tokens are greater than zero |
| `gen_ai.usage.cache_read_tokens` | count | token | Emitted when cache read tokens are greater than zero |
| `trajectory.turn.number` | gauge | turn | One-indexed turn number when known |
| `trajectory.turn.cost.usd` | gauge | USD | Point-in-time turn cost; zero is valid |
| `trajectory.turn.cost.usd.total` | distribution | USD | Completed-turn cost sample; use `p95:`/`avg:` queries |
| `trajectory.turn.duration_ms` | gauge | ms | Point-in-time completed-turn duration when derivable |
| `trajectory.turn.duration_ms.total` | distribution | ms | Completed-turn duration sample |
| `trajectory.turn.permission_wait_ms.total` | distribution | ms | Derivable human approval wait inside the turn |
| `trajectory.turn.duration_ms.excluding_permission_wait.total` | distribution | ms | Completed-turn duration minus derivable approval wait |
| `trajectory.turn.thinking_tokens` | count | token | Reasoning/thinking token count when present |
| `trajectory.turn.cache_efficiency` | gauge | ratio | Cache read share of cache read plus cache creation |
| `trajectory.turn.files_modified` | gauge | file | Edit/write-style tool activity in the turn |
| `trajectory.turn.files_read` | gauge | file | Read tool activity in the turn |
| `trajectory.turn.subagent_invocations` | gauge | invocation | Subagent starts observed in the turn |
| `trajectory.turn.compactions` | gauge | compaction | Compactions observed in the turn |
| `trajectory.turn.lines_of_code.count` | count | line | Tagged with `type:added` or `type:removed` |

Grouped per-turn metrics emit one data point per dimension value:

| Metric | Type | Dimension |
|---|---|---|
| `trajectory.turn.tool_uses` | gauge | `tool_name` |
| `trajectory.turn.tool_uses.total` | distribution | No `tool_name`; total tools in the completed turn |
| `trajectory.turn.permission_prompts` | gauge | `decision` |
| `trajectory.turn.tool_decision` | count | `tool_name`, `decision`, `source` |
| `trajectory.turn.code_edit_tool.decision` | count | `tool_name`, `decision`, `source`, `language` |
| `trajectory.turn.errors` | gauge | `category` |

For dashboard percentile queries, prefer the `.total` distributions. For
per-tool breakdowns, use `trajectory.turn.tool_uses` grouped by `tool_name`.

## Per-Session Metrics

Running session gauges:

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.session.turns.elapsed` | gauge | turn | Running turn count, refreshed on turn end |
| `trajectory.session.tool_uses.elapsed` | gauge | call | Running tool-use count, refreshed on turn end |
| `trajectory.session.cost.usd.accumulated` | gauge | USD | Running and final observed session cost |
| `trajectory.session.compactions.elapsed` | gauge | compaction | Running compaction count |
| `trajectory.session.last_seen.unix` | gauge | second | Latest observed source event timestamp as Unix seconds |

Session-end metrics:

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.session.duration_ms` | gauge | ms | Session duration when derivable |
| `trajectory.session.turns.total` | distribution | turn | Completed-session turn count |
| `trajectory.session.tool_uses.total` | distribution | call | Completed-session tool-use count |
| `trajectory.session.cost.usd.total` | distribution | USD | Completed-session cost sample; not an active-session coverage metric |
| `trajectory.session.compactions.total` | distribution | compaction | Completed-session compaction sample |
| `trajectory.session.lines_changed` | gauge | line | Added plus removed lines when known |
| `trajectory.session.yield_commit_count` | gauge | commit | Real git commits found in the session window by the yield tracker |
| `trajectory.session.yield_commit_count.completed_count` | count | commit | Completed-session mirror for dashboard totals; prefer this for sums |
| `trajectory.session.yield_main_commit_count` | gauge | commit | Yield commits reachable from the resolved main branch |
| `trajectory.session.yield_main_commit_count.completed_count` | count | commit | Completed-session mirror for dashboard totals; prefer this for sums |
| `trajectory.session.yield_revert_count` | gauge | commit | Revert commits among yielded main-branch commits |
| `trajectory.session.yield_revert_count.completed_count` | count | commit | Completed-session mirror for dashboard totals; prefer this for sums |

## Task Metrics

Task metrics come from closed task segments. They are emitted with
`trajectory.trace_type:task` and the dimensions `task_type`, `outcome_label`,
and `task_id` when `segmentation.publish_metrics` is enabled. The legacy
`segmentation.publish_traces` gate also enables these metrics for existing
trace-publish opt-ins. Destinations can suppress all task-segmentation-derived
publish outputs with `segmentation.enabled: false`.

| Metric | Type | Unit |
|---|---|---|
| `trajectory.task.outcome_score` | gauge | score |
| `trajectory.task.autonomy_score` | gauge | score |
| `trajectory.task.complexity_score` | gauge | score |
| `trajectory.task.risk_score` | gauge | score |

## Built-In Marker Metrics

Marker metrics are resolved from the active marker catalog at publish time.
Built-in and setup-default metrics include:

| Metric | Type | Scope | Source |
|---|---|---|---|
| `trajectory.session.user_frustrations` | gauge | session | User frustration points |
| `trajectory.session.commits` | gauge | session | Git commit points |
| `trajectory.session.prs` | gauge | session | PR/MR creation points |
| `trajectory.session.pushes` | gauge | session | Git push points |
| `trajectory.session.test_fix_cycles` | gauge | session | Completed test-fix ranges |
| `trajectory.session.user_interruptions` | gauge | session | User interruption points |
| `trajectory.session.tool_errors` | gauge | session | Tool-error points, often grouped by `category` |
| `trajectory.session.permissions_denied` | gauge | session | Permission denial points |
| `trajectory.session.language_activity` | gauge | session | Tool activity grouped by `language` |
| `trajectory.session.skill_invocations` | gauge | session | Skill activity grouped by `skill_name` |
| `trajectory.session.subagents` | gauge | session | Setup-default subagent count |
| `trajectory.session.tests_written` | gauge | session | Setup-default new-test count |
| `trajectory.session.test_success_rate` | gauge | session | Setup-default test retry success ratio |
| `trajectory.session.force_pushes` | gauge | session | Setup-default force-push count |
| `trajectory.session.ci_iterations` | gauge | session | Setup-default CI feedback ranges |
| `trajectory.session.code_added` | gauge | session | Setup-default code-change count |
| `trajectory.session.files_modified` | gauge | session | Setup-default files-touched count |
| `trajectory.session.tasks` | gauge | session | Task segment count when `segmentation.publish_metrics` or `segmentation.publish_traces` is enabled and destination segmentation is enabled |
| `trajectory.session.task_outcome_mean` | gauge | session | Mean task outcome score when task-segmentation publish is enabled for the destination |
| `trajectory.session.task_autonomy_mean` | gauge | session | Mean task autonomy score when task-segmentation publish is enabled for the destination |
| `trajectory.session.high_risk_tasks` | gauge | session | Tasks with high risk score when task-segmentation publish is enabled for the destination |

Count-like session gauges that represent one final value per completed session
also publish a `.completed_count` mirror, for example
`trajectory.session.force_pushes.completed_count`,
`trajectory.session.language_activity.completed_count`, and
`trajectory.session.prs.completed_count`. Datadog gauge rollups can repeat final values
across dashboard buckets, so dashboards that ask "how many?" should sum the
`.completed_count` mirror rather than summing the gauge.

Commit and PR attribution metrics are distribution samples:

| Metric | Type | Scope | Notes |
|---|---|---|---|
| `trajectory.commit.cost.usd.total` | distribution | commit | Cost attributed to turns since the previous commit; yield-derived samples carry `branch` and are preferred over transcript-derived commit markers |
| `trajectory.commit.attributed_turns.total` | distribution | commit | Turns attributed to the commit; yield-derived samples carry `branch` and are preferred over transcript-derived commit markers |
| `trajectory.pr.cost.usd.attributed.total` | distribution | pr | Cost attributed to the PR/MR creation tail |
| `trajectory.pr.attributed_turns.total` | distribution | pr | Turns attributed to the PR/MR creation tail |
| `trajectory.pr.containing_session.cost.usd.total` | distribution | pr | Containing-session cost sampled once per PR/MR; do not sum |

Custom measures can publish under any valid `trajectory.*` or `gen_ai.*` metric
name. If a measure omits `metric:`, Trajectory derives
`trajectory.<scope>.<name>` with hyphens converted to underscores.

## Publish and Serve Health Metrics

Operational counters are best-effort and primarily support rollout health and
privacy/publish diagnostics.

| Metric | Type | Tags | Notes |
|---|---|---|---|
| `trajectory.publish.active_destinations` | gauge | Canonical tags plus destination tags | Number of active destinations seen for a session |
| `trajectory.publish.turns` | count | OTLP publish path tags | Internal publish turn counter |
| `trajectory.serve.incognito.enabled` | count | `client_source` | User or tool enabled incognito; intentionally not tagged by session ID |
| `trajectory.serve.publish.sensitivity_suppressed` | count | `client_source`, `destination`, `category`, `label` | Sensitive spans dropped for a destination |
| `trajectory.serve.publish.sensitivity_held` | count | `client_source`, `destination`, `reason` | Spans held while classification is pending or unresolved |
| `trajectory.serve.publish.spans_suppressed_total` | count | `client_source`, `destination`, `category`, `label` | Number of spans suppressed by sensitivity policy |
| `trajectory.serve.publish.spans_held_total` | count | `client_source`, `destination` | Number of spans held pending sensitivity classification |
| `trajectory.serve.llm_capacity.calls.total` | count | `feature`, `backend`, `gen_ai.request.model`, `pass`, `cost_source` | Successful Trajectory-owned background LLM calls for segmentation or sensitivity classification |
| `trajectory.serve.llm_capacity.cost.usd.total` | count | `feature`, `backend`, `gen_ai.request.model`, `pass`, `cost_source` | Estimated USD cost for priced Trajectory-owned background LLM calls |
| `trajectory.serve.sensitivity.classifier_unavailable` | count | `client_source`, `reason` | No classifier path was available; rate-limited |
| `trajectory.serve.sensitivity.classifier_backend_error` | count | `backend`, `error_class` | One classifier backend failed before fallback |
| `trajectory.serve.sensitivity.watermark_write_error` | count | `error_class` | Sensitivity watermark write failed |
| `trajectory.serve.sensitivity.watermark_parse_error` | count | `error_class` | Sensitivity watermark read/parse failed |
| `trajectory.serve.sensitivity.sensitivity_held_at_session_end` | count | `reason` | Session ended while sensitivity was still held |

LLM-capacity cost is estimated from prompt/output size and the existing model
pricing table. It is useful for directional spend dashboards, not provider
invoice reconciliation. Calls whose model is not visible or priced still emit
the call count with `cost_source:pricing_unknown`.

## Companion Metrics

When the Claude Code companion metrics proxy is enabled, Trajectory forwards
Claude Code's native OTLP usage metrics after adding session context. The
companion also emits bounded diagnostic counters through its OTel meter.

| Metric | Type | Notes |
|---|---|---|
| `claude_code.token.usage` | sum | Forwarded Claude Code token usage, enriched with session tags |
| `claude_code.cost.usage` | sum/gauge | Forwarded Claude Code cost usage, sanitized and corrected from token totals when possible |
| `trajectory.companion.usage_data_missing` | count | Proxied usage data was missing, invalid, or inconsistent |
| `trajectory.companion.unknown_model` | count | Cost correction saw an unknown normalized model |

## Instrumentation Health Metrics

Instrumentation-health metrics use bounded, content-free tags and are emitted
only by code paths that explicitly create health records.

| Metric | Type |
|---|---|
| `trajectory.instrumentation.publish.attempt` | count |
| `trajectory.instrumentation.publish.failure` | count |
| `trajectory.instrumentation.publish.latency_ms` | distribution |
| `trajectory.instrumentation.capture.hook_event` | count |
| `trajectory.instrumentation.capture.gap` | count |
| `trajectory.instrumentation.capture.write_latency_ms` | distribution |
| `trajectory.instrumentation.fidelity.drift` | count |
| `trajectory.instrumentation.fidelity.token_delta` | distribution |
| `trajectory.instrumentation.fidelity.cost_delta_usd` | distribution |
| `trajectory.instrumentation.fidelity.turn_delta` | distribution |
| `trajectory.instrumentation.derivation.fallback` | count |
| `trajectory.instrumentation.derivation.correction` | count |
| `trajectory.instrumentation.privacy.gate` | count |
| `trajectory.instrumentation.privacy.sensitivity_lag_ms` | distribution |
| `trajectory.instrumentation.marker.evaluation` | count |
| `trajectory.instrumentation.marker.evaluation_latency_ms` | distribution |
| `trajectory.instrumentation.local_ui.forward_attempt` | count |
| `trajectory.instrumentation.local_ui.forward_latency_ms` | distribution |
| `trajectory.instrumentation.local_ui.query_failure` | count |
| `trajectory.instrumentation.watchdog.gap_detected` | count |
| `trajectory.instrumentation.backfill.replay` | count |
| `trajectory.instrumentation.backfill.lag_ms` | distribution |
| `trajectory.instrumentation.health.spool_depth` | gauge |
| `trajectory.instrumentation.health.emit_dropped` | count |

## Heartbeat Metric Definitions

Trajectory also ships log-query metric definitions for marker evaluation
heartbeats:

| Metric | Type | Meaning |
|---|---|---|
| `trajectory.session.evaluated` | gauge | Constant `1` when a session reaches marker evaluation |
| `trajectory.markers.evaluated_count` | gauge | Number of markers evaluated |
| `trajectory.markers.org_pinned_count` | gauge | Number of evaluated enforced org markers |

These definitions are useful for absence-based monitoring. They are separate
from publish-engine base telemetry.

## Query Guidance

Use `p95:` or `avg:` on distribution metrics such as
`trajectory.turn.duration_ms.total`, `trajectory.session.cost.usd.total`, and
`trajectory.commit.cost.usd.total`. Enable Datadog distribution percentiles for
those metrics before relying on percentile queries.

For live cost and cohort usage over a recent window, use
`sum:trajectory.turn.cost.usd.total{...}`. `trajectory.session.cost.usd.total`
is a completed-session final sample and should be used for final-session
percentiles or averages, not for counting active sessions or estimating
in-progress spend.

Use `.completed_count` mirrors for count-like session markers such as
`trajectory.session.commits.completed_count` and
`trajectory.session.force_pushes.completed_count`. The unsuffixed gauges remain available
for latest-value inspection, but Datadog gauge rollups can repeat final session
values across buckets and are not trustworthy for dashboard totals. For running
gauges such as `trajectory.session.turns.elapsed`, use last-value or max-style
views instead of summing repeated updates for the same session.

For active users and recent activity, do not use
`trajectory.session.evaluated`. That metric is a marker-evaluation heartbeat
for absence monitoring and can be sparse when marker evaluation or marker
metric publishing is not enabled for a user. Use
`max:trajectory.session.last_seen.unix{...} by {trajectory.user}` with
`count_nonzero(query1)` for active-user counts, and use
`trajectory.session.turns.total` grouped by `session_id` when counting
completed sessions.

Treat `gen_ai.request.model` as optional. A dashboard template variable with a
default `*` expands to a model-presence filter and drops otherwise valid
non-token metrics when the model tag is absent. Prefer model as a grouping on
`gen_ai.usage.*` token widgets, or apply a model filter only on widgets that
intentionally require model-tagged data.

Use max-style queries for `trajectory.publish.active_destinations` when asking
"how many destinations were active?" It is a per-session gauge; averaging it
can produce fractional destination counts that are not meaningful.

Serve-side counters are not uniformly tagged with the canonical tag set.
`trajectory.serve.incognito.enabled` and `trajectory.serve.publish.*` use the
bare `client_source` tag. When sharing a dashboard variable whose prefix is
`trajectory.client_source`, query these counters with
`client_source:$client_source.value` instead of `$client_source`.

Use `trajectory.session.last_seen.unix` for recency-sorted tables. Enable
Historical Metrics Ingestion before replaying points older than one hour.
