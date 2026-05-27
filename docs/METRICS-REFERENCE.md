# Metrics Reference

This page catalogs the metric surface emitted by the current Trajectory binary.
Metric names, types, and tags are treated as part of the public distribution
contract.

For marker syntax and dashboard examples, see [MARKERS.md](MARKERS.md). For
configuration and destination trust, see [USER-GUIDE.md](USER-GUIDE.md).

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
| `trajectory.version` | Trajectory binary version | `dev` |
| `host` | Local hostname | `unknown` |
| `os.type` | Operating system family | Runtime OS |
| `os.version` | OS version string, when available | Omitted |
| `ml_app` | Destination ML app | Omitted |
| `gen_ai.request.model` | Model name | Omitted |
| `trajectory.client_version` | Client or harness version | Omitted |
| `project_dir` | Project directory basename | Omitted |
| `trajectory.trace_type` | Metric grain: `turn`, `session`, `task`, `commit`, or `pr` | Set by emitter |

Destination tags and repo-derived tags such as `repo`, `owner`, and
`git_remote_host` may also be present. Keep custom tags low-cardinality and
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
| `trajectory.session.cost.usd.total` | distribution | USD | Completed-session cost sample |
| `trajectory.session.compactions.total` | distribution | compaction | Completed-session compaction sample |
| `trajectory.session.lines_changed` | gauge | line | Added plus removed lines when known |

## Task Metrics

Task metrics come from closed task segments. They are emitted with
`trajectory.trace_type:task` and the dimensions `task_type`, `outcome_label`,
and `task_id`.

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
| `trajectory.session.force_pushes` | gauge | session | Setup-default force-push count |
| `trajectory.session.ci_iterations` | gauge | session | Setup-default CI feedback ranges |
| `trajectory.session.code_added` | gauge | session | Setup-default code-change count |
| `trajectory.session.files_modified` | gauge | session | Setup-default files-touched count |
| `trajectory.session.tasks` | gauge | session | Task segment count when task metrics publish is enabled |
| `trajectory.session.task_outcome_mean` | gauge | session | Mean task outcome score |
| `trajectory.session.task_autonomy_mean` | gauge | session | Mean task autonomy score |
| `trajectory.session.high_risk_tasks` | gauge | session | Tasks with high risk score |

Commit and PR attribution metrics are distribution samples:

| Metric | Type | Scope | Notes |
|---|---|---|---|
| `trajectory.commit.cost.usd.total` | distribution | commit | Cost attributed to turns since the previous commit; may carry `branch` |
| `trajectory.commit.attributed_turns.total` | distribution | commit | Turns attributed to the commit |
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
| `trajectory.serve.sensitivity.classifier_unavailable` | count | `client_source`, `reason` | No classifier path was available; rate-limited |
| `trajectory.serve.sensitivity.classifier_backend_error` | count | `backend`, `error_class` | One classifier backend failed before fallback |
| `trajectory.serve.sensitivity.watermark_write_error` | count | `error_class` | Sensitivity watermark write failed |
| `trajectory.serve.sensitivity.watermark_parse_error` | count | `error_class` | Sensitivity watermark read/parse failed |
| `trajectory.serve.sensitivity.sensitivity_held_at_session_end` | count | `reason` | Session ended while sensitivity was still held |

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

Use `sum:` for count-like gauges such as `trajectory.session.commits` only when
each session contributes one final value. For running gauges such as
`trajectory.session.turns.elapsed`, use last-value or max-style views instead
of summing repeated updates for the same session.

Use `trajectory.session.last_seen.unix` for recency-sorted tables. Enable
Historical Metrics Ingestion before replaying points older than one hour.
