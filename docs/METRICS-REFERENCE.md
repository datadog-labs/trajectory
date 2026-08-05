# Metrics Reference

This page catalogs the metric surface emitted by the current Trajectory
release.

For marker syntax and dashboard examples, see [MARKERS.md](MARKERS.md). For
configuration and destination trust, see [USER-GUIDE.md](USER-GUIDE.md).
For Agent Console and dashboard consumption guidance, see
[`COST-OVERLAP-CONSUMER-GUIDE.md`](COST-OVERLAP-CONSUMER-GUIDE.md).
For additive totals, CODEOWNER associations, coverage, and dashboard query
patterns, see [Cost Attribution and Dashboarding](COST-ATTRIBUTION.md).
For the built-in metric guide, run:

```bash
trajectory user-guide metrics
```

## Naming Model

Trajectory metric names follow this shape:

```text
trajectory.<scope>.<concept>[.<measurement>]
```

The common scopes are `turn`, `session`, `task`, `oversight`, `commit`, `pr`,
`publish`, and `serve`. `gen_ai.usage.*` metrics use the OpenTelemetry GenAI naming
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

The `.total` suffix means "completed sample," not "safe to add across every
dimension." Additivity still depends on the metric's grain and association
semantics. Do not add turn, session, PR, or owner projections merely because
each name ends in `.total`.

## Emission Gates

Base telemetry is emitted when `export.metrics: true` is enabled for an active
Datadog or OTLP destination. For normal `~/.trajectory/config.yaml` Datadog
config, `export.site` plus `export.metrics: true` creates the built-in
`_config_datadog` destination even when `export.traces: off`. In that mode
metrics publish and LLM Obs trace spans do not.

Destination `type` selects the backend, not the metrics switch. For
`type: datadog_agentless`, metrics use agentless OTLP by default. Trusted config can set
`metrics_transport: dd_metrics_v2` for the deprecation-window fallback. Legacy
`type: datadog` and `type: dd_llmobs` remain aliases for
`datadog_agentless`.

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
marker logs are disabled, and LLM Obs marker evaluations are disabled.

LLM Obs marker evaluations are a separate experimental output path. They are not
enabled by `markers.enabled` or `markers.metrics`; a Datadog destination must set
`markers.evaluations: true` explicitly before Trajectory submits marker results
to the LLM Obs evaluation intake.

Serve-side operational counters emitted through the publish engine are
best-effort submissions through each eligible destination's selected Datadog
metrics transport: agentless OTLP by default, with Metrics v2 as a trusted
fallback. Two early privacy/health signals,
`trajectory.serve.incognito.enabled` and
`trajectory.serve.sensitivity.classifier_unavailable`, submit directly through
agentless OTLP and do not follow the Metrics v2 selector. These counters are not
tied to trace export.

## Common Tags

Publish-engine metrics receive the canonical tag set below when the source
context is available. Identity tags use fallbacks so metrics are not silently
unattributed.

For the Datadog LLM Obs span tag contract, see
[LLM-OBS-SPAN-TAGS.md](LLM-OBS-SPAN-TAGS.md).

| Tag | Meaning | Fallback |
|---|---|---|
| `gen_ai.conversation.id` | Session ID | `unknown` |
| `session_id` | Compatibility alias for session ID | `unknown` |
| `trajectory.client_source` | Client source, such as `claude-code`, `codex`, `gemini`, `agy`, `goose`, `cursor`, `pi`, or `opencode` | `unknown` |
| `trajectory.user` | Resolved user | `unknown` |
| `trajectory.user_email` | Optional resolved user email from `TRAJECTORY_USER_EMAIL`, `identity.user_email`, `identity.user_email_command`, or `identity.user_email_suffix` | Omitted |
| `git.email` | Optional resolved Git email from `TRAJECTORY_GITHUB_EMAIL`, `identity.github_email`, `identity.github_email_command`, repo-local Git config, or global Git config | Omitted |
| `github.username` | Optional resolved GitHub username from `TRAJECTORY_GITHUB_USERNAME`, `identity.github_username`, `identity.github_username_command`, repo-local Git config, or global Git config | Omitted |
| `trajectory.version` | Trajectory binary version | `dev` |
| `host` | Local hostname | `unknown` |
| `os.type` | Operating system family | Runtime OS |
| `os.version` | OS version string, when available | Omitted |
| `ml_app` | Destination ML app | Omitted |
| `gen_ai.request.model` | Model name | Omitted |
| `trajectory.client_version` | Client or harness version from capture or cache | Omitted when unavailable |
| `trajectory.turn_id` | Stable turn ordinal on turn-scoped metrics; prevents same-second turn samples from collapsing into one Datadog point | Omitted when the turn cannot be resolved |
| `project_dir` | Project directory basename | Omitted |
| `repo` | Git repository name from the selected remote, or project directory basename when remote attribution is unavailable | `unknown` when project directory is unavailable |
| `owner` | Git repository owner from the selected remote | `unknown` when remote attribution is unavailable |
| `git_remote_host` | Selected Git remote host | `unknown` when remote attribution is unavailable |
| `trajectory.repo_source` | Provenance for `repo`, `owner`, and `git_remote_host`: `git_origin`, `git_remote`, `git_origin_unparsed`, `project_dir`, `configured`, or `unknown` | `unknown` |
| `trajectory.trace_type` | Metric grain: `turn`, `session`, `task`, `oversight`, `commit`, `pr`, or `serve` | Set by emitter |
| `trajectory.metric_lifecycle` | Metric catalog lifecycle: `current`, `legacy`, `debug`, or `unknown` | Set by metric catalog classification |
| `trajectory.metric_provenance` | Bounded data provenance for the metric, such as `captured_session`, `activity_classifier`, `context_budget_estimator`, `waste_evaluator`, `skill_attribution`, `marker_evaluation`, `repository_metadata`, `serve_process`, or `instrumentation_health` | Set by metric catalog classification |
| `trajectory.metric_signal` | Intended use tier, such as `authoritative_usage`, `derived_behavior`, `operational`, `diagnostic`, or `investigate` | Set by metric catalog classification |
| `trajectory.metric_family` | Current catalog family for built-in metrics | Omitted for legacy/debug/unknown classifications |

Top-level config `tags:` are included on Trajectory-published Datadog metric
series for DD LLM Obs destinations, including base, marker, heartbeat, and task
metrics. User and managed tag maps are additive; managed `config.defaults.yaml`
values win on key conflicts. They are not written to local JSONL, and they are
not added to OTLP exports, Claude native OTLP proxy metrics, or process-level
health/privacy counters. Destination tags and marker dimensions may also be
present where those publish paths support them. Keep custom tags low-cardinality
and non-sensitive.

## Live In-Turn Metrics

Live in-turn metrics are default-off behind `live_in_turn_metrics`. They are
provisional progress signals emitted from bounded hook evidence, active
durable-source tails, and optional `/llm-call` evidence through the durable
metric outbox. The current source tails are scoped to exact active-session
files: Claude transcript JSONL for assistant usage and canonical session JSONL
for already-normalized usage, tool, MCP, skill, subagent, file, and LOC
records. Codex and Cursor watcher paths wake the canonical source after durable
canonical writes. Hook requests do not submit to Datadog, scan provider roots,
evaluate markers, or run privacy classifiers.
Completed-turn `trajectory.turn.*` and `gen_ai.usage.*` metrics remain
authoritative for attribution.

Live gauges are latest accumulated values for an open turn or session. Query
them with last-value or max-style rollups and do not sum them across time. Live
additive counts are emitted only when Trajectory has a stable event identity in
the local live-progress ledger.

Common live tags include `session_id`, `gen_ai.conversation.id`,
`trajectory.client_source`, `trajectory.turn_id`, `trajectory.live_scope`,
`trajectory.live_source`, `trajectory.live_status`, and
`trajectory.trace_type`. Cost and token live metrics also carry bounded
provenance tags such as `trajectory.cost_role:live_progress`,
`trajectory.cost_source`, `trajectory.cost_precision`,
`trajectory.token_source`, `trajectory.token_precision`, and
`gen_ai.request.model` when known. Live metrics never add raw prompt, command,
tool argument, tool output, path, or child transcript tags.

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.live.turn.last_seen.unix` | gauge | second | Last hook, durable-source, or LLM-call activity time observed for the open turn |
| `trajectory.live.turn.age_ms` | gauge | ms | Elapsed wall time since Trajectory first observed the live turn |
| `trajectory.live.session.last_seen.unix` | gauge | second | Last observed live activity for the active session |
| `trajectory.live.session.turns.active` | gauge | turn | Active live turns for the session; normally 0 or 1 |
| `trajectory.live.turn.llm_calls.elapsed` | gauge | call | Cumulative LLM calls observed so far in the turn |
| `trajectory.live.turn.llm_calls.additive` | count | call | One deduped LLM-call delta tagged with `llm_call_status` |
| `trajectory.live.turn.cost.usd.accumulated` | gauge | USD | Cumulative live cost observed so far; provisional |
| `trajectory.live.session.cost.usd.accumulated` | gauge | USD | Cumulative live cost observed so far for the session |
| `trajectory.live.turn.cost.usd.additive` | count | USD | One deduped request-cost delta when live source evidence carries cost or enough provider-native usage for a bounded estimate |
| `trajectory.live.turn.tokens.input.additive` | count | token | Deduped input-token delta |
| `trajectory.live.turn.tokens.output.additive` | count | token | Deduped output-token delta |
| `trajectory.live.turn.tokens.cache_read.additive` | count | token | Deduped cache-read token delta |
| `trajectory.live.turn.tokens.cache_creation.additive` | count | token | Deduped cache-write token delta |
| `trajectory.live.turn.tokens.reasoning.additive` | count | token | Deduped reasoning-token delta |
| `trajectory.live.turn.tool_uses.elapsed` | gauge | tool | Cumulative tool requests observed so far |
| `trajectory.live.session.tool_uses.elapsed` | gauge | tool | Cumulative session tool requests observed so far |
| `trajectory.live.turn.tool_uses.additive` | count | tool | Deduped tool request/result/failure delta |
| `trajectory.live.turn.mcp.tool_uses.elapsed` | gauge | tool | Cumulative MCP tool requests when bounded MCP identity is known |
| `trajectory.live.session.mcp.tool_uses.elapsed` | gauge | tool | Cumulative session MCP tool requests when bounded MCP identity is known |
| `trajectory.live.turn.mcp.tool_uses.additive` | count | tool | Deduped MCP request/result/failure delta |
| `trajectory.live.turn.skill_invocations.elapsed` | gauge | skill | Cumulative skill activations observed so far |
| `trajectory.live.session.skill_invocations.elapsed` | gauge | skill | Cumulative session skill activations observed so far |
| `trajectory.live.turn.skill_invocations.additive` | count | skill | Deduped skill activation delta |
| `trajectory.live.turn.subagent_invocations.elapsed` | gauge | subagent | Cumulative subagent starts observed in the turn |
| `trajectory.live.turn.subagent_invocations.additive` | count | subagent | Deduped subagent start delta |
| `trajectory.live.turn.subagents.active` | gauge | subagent | Active subagents attributable to the live turn |
| `trajectory.live.session.subagents.active` | gauge | subagent | Active subagents observed across live session turns |
| `trajectory.live.turn.subagents.completed.additive` | count | subagent | Deduped subagent stop/completion delta |
| `trajectory.live.turn.files_read.elapsed` | gauge | file | Distinct files read so far, deduped by local path hash and tagged only with bounded file provenance |
| `trajectory.live.turn.files_modified.elapsed` | gauge | file | Distinct files modified so far, deduped by local path hash and tagged only with bounded file provenance |
| `trajectory.live.session.files_modified.elapsed` | gauge | file | Distinct files modified in the active session so far |
| `trajectory.live.turn.lines_of_code.additive` | count | line | Deduped live line delta tagged with `type:added` or `type:removed` |
| `trajectory.live.watcher.wake_total` | count | wake | Live watcher wakes processed, tagged by wake source and outcome |
| `trajectory.live.watcher.read_bytes` | count | byte | Bytes read from exact durable live sources |
| `trajectory.live.watcher.records_drained` | count | record | Durable records processed or skipped by the live source reader |
| `trajectory.live.watcher.pass_duration_ms` | distribution | ms | Duration of one bounded live watcher pass |
| `trajectory.live.watcher.backlog` | gauge | item | Pending live wake backlog after the current pass starts |
| `trajectory.live.watcher.dropped_total` | count | item | Live wakes or facts dropped by queue/fact bounds |
| `trajectory.live.watcher.dedupe_conflict_total` | count | event | Stable additive event identity was reused with conflicting metric value or tags |

### CODEOWNERS Attribution Tags

When a repository has a GitHub-compatible `CODEOWNERS` file, Trajectory
attributes successful file modifications and eligible immutable commit
membership to the owning users or teams. Durable PR production joins those
rows only through exact assigned `pr_work_turns`; local branch composition is
not production.
Attribution is enabled by default. It is derived
from an immutable session snapshot and is projected onto eligible turn, task,
and session metric records without cloning a metric point once per owner.
Commit and PR attribution is published by the dedicated scope metrics below.

| Tag | Meaning |
|---|---|
| `trajectory.codeowner` | Normalized owner identity without a leading `@`. Existing base metrics include it for single-owner scopes; dedicated association metrics include one value per retained owner. LLM Obs and local-ui roots preserve up to five repeated values in deterministic rank order. |
| `trajectory.codeowner_scope` | Attribution grain: `turn`, `task`, `commit`, `pr`, or `session` |
| `trajectory.codeowner_source` | Bounded evidence source such as `write`, `commit`, `pr_turn_range`, `pr_local_branch_range`, `task_turn_range`, `session_union`, or `mixed` |
| `trajectory.codeowner_status` | `owned`, `partially_owned`, or `unowned` |
| `trajectory.codeowner_truncated` | `true` when more than five eligible owners existed for the scope |
| `trajectory.codeowner_kind` | `user` or `team`; present on per-owner association metrics |

Turn and session LLM Obs roots carry the same repeated owner values and scope,
source, status, and truncation tags. Their metadata also carries exact bounded
diagnostic counts under `trajectory.codeowner_total`,
`trajectory.codeowner_retained`, `trajectory.codeowner_dropped`,
`trajectory.codeowner_matched_files`, `trajectory.codeowner_unowned_files`, and
`trajectory.codeowner_email_owners_ignored`. Local UI/Lapdog exposes the same
root contract.

Datadog Metrics cannot independently index multiple values for one tag key on
one metric point. For multi-owner scopes, query
`trajectory.codeowner.associations.total` or
`trajectory.codeowner.files.total` by `trajectory.codeowner`; existing base
metrics keep their original cardinality and totals and omit the ambiguous owner
tag. Base metrics still carry the scope, source, status, and truncation tags.

Owner identities are normalized GitHub user/team identifiers. Trajectory never
publishes source file paths, CODEOWNERS patterns, email owners, snapshot
digests, or commit SHAs as part of this attribution. Email-only owners are
excluded and counted. Configured tags cannot override derived
`trajectory.codeowner*` values.

`pr_local_branch_range` describes local composition only. It never enters the
durable PR-production, coverage, session-production, or cost projections.

### Cost Overlap Tags

Trajectory cost metrics carry bounded tags that let dashboards avoid summing
Trajectory attribution cost with provider, gateway, cloud billing, or native
client telemetry cost. These tags are non-sensitive route classifications, not
raw URLs, headers, credentials, helper commands, account IDs, or org IDs.

| Tag | Values |
|---|---|
| `trajectory.provider` | `anthropic` |
| `trajectory.provider_route` | `direct`, `llm_gateway`, `bedrock`, `vertex`, `foundry`, `unknown`, `mixed` |
| `trajectory.provider_cost_visibility` | `anthropic_api`, `gateway_aggregate`, `cloud_provider_billing`, `unknown`, `mixed` |
| `trajectory.cost_overlap_risk` | `possible`, `aggregate_only`, `unknown`, `mixed` |
| `trajectory.cost_overlap_signal` | `session_env`, `claude_settings`, `none`, `mixed` |
| `trajectory.cost_role` | `attribution`, `client_telemetry` |
| `trajectory.cost_contract` | `v2` on eligible live Trajectory cost samples that satisfy the current usage-integrity contract; historical imports/replays emit no Trajectory attribution cost samples |
| `trajectory.cost_dedupe_group` | Provider/route bucket such as `anthropic:direct`, `anthropic:llm_gateway`, or `anthropic:mixed` |
| `trajectory.cost_dedupe_confidence` | `high`, `medium`, `low`, `mixed` |
| `trajectory.cost_source` | Source of the cost stream when different metric families can overlap; Trajectory turn-derived attribution uses `turn_metrics`, while native Claude telemetry proxied by Trajectory uses `claude_native_otlp` |
| `trajectory.cost_status` | `priced`, `unpriced`, `unavailable`, `invalid`, or `other` |
| `trajectory.cost_reason` | Bounded attribution reason such as `model_missing`, `model_mismatch`, `rate_missing`, `pricing_source_unavailable`, or `other`; omitted when no reason applies |
| `trajectory.pricing_source` | `provider_reported`, `organization_rate_card`, `local_rate_card`, `public_rate_card`, `client_telemetry`, `turn_attributions`, or `other` |
| `trajectory.cost_method` | `provider_reported`, `four_component_token_rate_card`, `token_rate_card`, `request_rate`, `credit_rate`, `sum_of_turn_attributions`, or `other` |
| `trajectory.cost_fidelity` | `native`, `token_derived`, `proxy`, `unpriced`, `aggregate`, or `other` |
| `trajectory.cost_basis` | `gross_model_cost`, `usage_economic_cost`, `provider_rated_usage`, `amortized_seat`, or `other` |
| `trajectory.pricing_unit` | `provider_amount`, `tokens`, `requests`, `credits`, or `other` |
| `trajectory.pricing_version` | Shipped allowlisted version, bounded aggregate version, or `custom` for organization/local cards; exact custom versions stay in events and spans |

Local-ui/Lapdog spans additionally expose `trajectory.cost_state` with the
customer-facing `available`, `partial`, or `unavailable` state and
`trajectory.cost_reason_category` with a bounded operator category. Exact
reasons, card IDs, catalog state, and severity stay in span metadata rather
than metric tags. Unavailable cost never emits a monetary metric sample; an
explicitly priced zero remains a present zero sample.

The tags are applied to these Trajectory-owned cost-bearing base metrics:
`trajectory.turn.cost.usd`, `trajectory.turn.cost.usd.additive`,
`trajectory.turn.cost.usd.total`, `trajectory.turn.web_search.cost.usd`,
`trajectory.turn.web_search.cost.usd.additive`,
`trajectory.turn.web_search.cost.usd.total`,
`trajectory.session.cost.usd.accumulated`,
`trajectory.session.web_search.cost.usd.accumulated`,
`trajectory.session.cost.usd.total`, and
`trajectory.session.web_search.cost.usd.total`.

The same `attribution` / `turn_metrics` identity is applied at serialization
to turn-derived commit, PR, PR-work, and CODEOWNER cost projections:
`trajectory.commit.cost.usd.total`,
`trajectory.pr.cost.usd.attributed.total`,
`trajectory.pr.interaction.cost.usd.additive`,
`trajectory.pr.containing_session.cost.usd.total`,
`trajectory.pr.work.cost.usd.total`,
`trajectory.codeowner.pr.production.cost.usd.total`, and the exclusive
attributed/unattributed PR-work cost coverage metrics. These are projections of
the same turn cost, not additional spend. The separate
`trajectory.serve.llm_capacity.cost.usd.total` process-cost metric does not use
`turn_metrics`.

Claude Code native OTLP metrics proxied by Trajectory use
`trajectory.cost_role:client_telemetry` and
`trajectory.cost_source:claude_native_otlp` when that proxy path enriches the
payload. Trajectory turn-derived cost metrics use
`trajectory.cost_role:attribution` and
`trajectory.cost_source:turn_metrics`.

`trajectory.cost_dedupe_group` identifies a low-cardinality provider/route
bucket; it is not a request/event key. `trajectory.cost_dedupe_confidence`
describes route-classification confidence, not record-match confidence.
Historical points and already queued payloads may lack `trajectory.cost_source`
because adding the tag creates a new metric-series identity. Keep those points
visible as legacy/uncategorized and do not infer a source in the query layer.
Authoritative cost totals must additionally require
`trajectory.cost_contract:v2`. Untagged samples are legacy/unverified history;
they remain queryable for investigation but must not be added to a v2 total.
Generic historical backfill and unapproved provider-history replay emit no
Trajectory token or live cost attribution metrics. They may still materialize
local sessions, publish eligible traces/session data, and emit non-attribution
operational metrics. The `trajectory repair metrics` command is a local audit
preview by default; its legacy `backfill-metrics` aliases remain accepted.
An explicit user-driven Codex repair, or an explicitly confirmed managed
`turn_cost_additive` campaign, may instead publish the isolated
`trajectory.historical.turn.cost.usd.additive` COUNT namespace through
`trajectory backfill-my-metrics --yes` (optionally with `--campaign <id>`).
Legacy points already present in Datadog remain outside the v2 contract and are
not rewritten.

Trajectory's durable metric outbox assigns each authoritative additive v2 cost
sample a logical turn/session identity that excludes delivery timestamp,
destination display name, and metrics transport. Exact local replays are
skipped across restarts and config churn; a changed value for an existing
identity fails closed. Once an HTTP submit begins, only an explicit 429 is
automatically retryable. Network, timeout, 5xx, crash, or post-submit ledger
ambiguity is terminal `ambiguous_delivery` to avoid a second additive point.
This is Trajectory delivery idempotency, not cross-source provider/native cost
deduplication.

## Per-Turn Metrics

Per-turn metrics are emitted on completed turn events.

### Turn/session aggregation contract

Every built-in turn metric carries executable `turn_aggregation`,
`rollup_target`, and `rollup_validator` entries in the canonical metric
catalog. The contract is explicit per metric rather than inferred from its
type. Additive metrics either reconcile to a named session metric, the
completed-turn ledger, or a deliberately bounded subset ledger. Observations
describe an ordinal, latest value, ratio, or population sample and must not be
added to produce a session total. The catalog test fails when a new turn
metric lacks any part of this contract.

This distinction matters even for COUNT metrics. For example,
`trajectory.turn.pr_contexts` counts bounded context observations, while
`trajectory.pr.contexts.total` counts durable context ranges; they are related
but are not equal totals. File edit operations and the number of turns that
touched files are similarly different grains.

The local source-data gate independently recomputes completed-session turn
count, tool calls, input tokens, output tokens, cache-aware total tokens, and
cost from `turns`, then compares them with `sessions`. Input and output are
checked separately so compensating component drift cannot hide behind a
matching combined token total. Run the same deterministic check used by agents
and CI with:

```bash
trajectory audit --source-data --db <cache.db>
```

Require `session_turn_aggregate_drift` to pass. The base rollup contract test
executes every base turn `MetricRecord` emitter and reconciles additive values
at their complete bounded-tag grain. Marker count pairs are derived from the
same persisted point/range rows by the marker evaluator; the marker contract
test requires every claimed pair to share its source, outcome, and grouping
grain, and the publish test feeds every catalogued marker turn point through
the production iterator. Their completed-session `.completed_count` mirrors
are transport-safe COUNT views of
that final value. Additive publish companions (`*.additive`) remain the
canonical long-window sum and intentionally do not emit a second duplicate
session COUNT point.
Marker-derived `trajectory.turn.*` metrics follow the same lifecycle: Trajectory
evaluates them after the completed turn is materialized, publishes only the
current turn's points, and reconciles late-discovered turn count points during
the normal session-end metric cycle. Datadog's durable semantic outbox drops
records already published at turn end, so reconciliation adds only missing
points. Their `trajectory.session.*` rollups remain session-end metrics.

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `gen_ai.usage.input_tokens` | count | token | Emitted when input tokens are greater than zero; complete strict request records preserve `gen_ai.request.model` and `query_source` |
| `gen_ai.usage.output_tokens` | count | token | Emitted when output tokens are greater than zero; complete strict request records preserve `gen_ai.request.model` and `query_source` |
| `gen_ai.usage.cache_creation_tokens` | count | token | Emitted when cache creation tokens are greater than zero; complete strict request records preserve `gen_ai.request.model` and `query_source` |
| `gen_ai.usage.cache_creation_5m_tokens` | count | token | Cache writes billed at the 5-minute TTL rate. Emitted when the value is greater than zero, the client reported the TTL breakdown, and `cache_creation_ttl_metrics` is enabled |
| `gen_ai.usage.cache_creation_1h_tokens` | count | token | Cache writes billed at the 1-hour TTL rate. Emitted when the value is greater than zero, the client reported the TTL breakdown, and `cache_creation_ttl_metrics` is enabled |
| `gen_ai.usage.cache_read_tokens` | count | token | Emitted when cache read tokens are greater than zero; complete strict request records preserve `gen_ai.request.model` and `query_source` |
| `trajectory.turn.number` | gauge | turn | One-indexed turn number when known |
| `trajectory.turn.cost.usd` | gauge | USD | Latest-value compatibility view of a completed turn's cost; zero is valid; do not use for spend totals |
| `trajectory.turn.cost.usd.additive` | count | USD | Authoritative additive completed-turn cost stream; when every strict request has native cost and reconciles to the turn total, request groups preserve `gen_ai.request.model` and `query_source`; use `sum:...as_count()` for spend totals with the v2 attribution filters |
| `trajectory.turn.cost.usd.total` | distribution | USD | One completed-turn cost observation; use for `p95:`/`avg:` population analysis, not authoritative spend totals |
| `trajectory.turn.web_search.requests` | gauge | request | WebSearch requests in the completed turn |
| `trajectory.turn.web_search.requests.additive` | count | request | Additive WebSearch request stream |
| `trajectory.turn.web_search.requests.total` | distribution | request | Completed-turn WebSearch request sample |
| `trajectory.turn.web_search.cost.usd` | gauge | USD | WebSearch cost in the completed turn at $0.01 per request |
| `trajectory.turn.web_search.cost.usd.additive` | count | USD | Additive WebSearch cost stream |
| `trajectory.turn.web_search.cost.usd.total` | distribution | USD | Completed-turn WebSearch cost sample |
| `trajectory.turn.duration_ms` | gauge | ms | Point-in-time completed-turn duration when derivable |
| `trajectory.turn.duration_ms.total` | distribution | ms | Completed-turn duration sample |
| `trajectory.turn.permission_wait_ms.total` | distribution | ms | Derivable human approval wait inside the turn |
| `trajectory.turn.duration_ms.excluding_permission_wait.total` | distribution | ms | Completed-turn duration minus derivable approval wait |
| `trajectory.turn.thinking_tokens` | count | token | Reasoning/thinking token count when present |
| `trajectory.turn.cache_efficiency` | gauge | ratio | Cache read share of cache read plus cache creation |
| `trajectory.turn.files_modified` | gauge | file | Edit/write-style tool activity in the turn |
| `trajectory.turn.files_modified.additive` | count | file | Additive edit/write operation stream; this is not a global distinct-file count |
| `trajectory.turn.files_read` | gauge | file | Read tool activity in the turn |
| `trajectory.turn.files_read.additive` | count | file | Additive read operation stream; this is not a global distinct-file count |
| `trajectory.turn.subagent_invocations` | gauge | invocation | Distinct source-backed subagent launches in the completed turn; zero is valid and emitted. Claude Code, Codex, Cursor, GitHub Copilot CLI, and OpenCode share this canonical counting contract; unsupported or ambiguous source shapes fail closed. |
| `trajectory.turn.subagent_invocations.additive` | count | invocation | Authoritative positive-only launch stream; use `sum:...as_count()` grouped by `session_id` for session totals |
| `trajectory.subagent_usage_status` | count | subagent stop | Child usage-evidence count, tagged `trajectory.subagent_usage_status:complete|partial|unavailable`; later child-usage amendments replace an unavailable stop projection once. This is a fidelity signal, not a cost metric. |
| `trajectory.turn.compactions` | gauge | compaction | Compactions observed in the turn |
| `trajectory.turn.compactions.additive` | count | compaction | Additive completed-turn compaction stream |
| `trajectory.turn.lines_of_code.count` | count | line | Per-turn added/removed line deltas; tagged with `type:added` or `type:removed` |

Live hook integrations derive line deltas only from exact evidence. Edit and
patch tools use their retained old/new or patch payloads. When
`cross_process_loc_snapshots` is enabled, bounded full-file replacements for
agy, GitHub Copilot CLI, OpenCode, and Pi compare the safe in-project file at
pre-hook time with the requested replacement and persist only added/removed
counts. The private receipt is keyed by session and tool-use identity, so a
post-hook in another process and a retried post-hook recover the same result
without double counting. Unsafe paths, symlinks, oversized files, missing
identities, failed tools, and provider-history-only rows emit no inferred LOC.

### Cache-Write TTL Breakdown

Providers price cache writes by time-to-live: a 5-minute write and a 1-hour
write bill at different multiples of the input rate. `gen_ai.usage.cache_creation_5m_tokens`
and `gen_ai.usage.cache_creation_1h_tokens` expose that split so cache writes
can be priced from metrics.

These counters are additive companions. `gen_ai.usage.cache_creation_tokens`
is unchanged: same name, same `count` type, same collapsed total. Nothing about
the existing series moves.

The TTL series exist only where the client reported the breakdown. Absence is
not zero. A turn whose client collapsed the counter emits no TTL point at all
rather than a false `0`, so a missing 1-hour series means "not reported," not
"no 1-hour writes."

Coverage begins when a client build that forwards the breakdown starts writing
sessions; for Claude Code that is Trajectory's 2026-07-20 capture change, and
earlier sessions carry only the collapsed counter. Consequently
`sum(5m) + sum(1h)` equals `sum(collapsed)` only inside the covered window.
Over any window that spans the start of coverage the TTL series are a strict
subset, so do not treat them as a complete decomposition or derive an implied
1-hour total by subtracting the 5-minute series from the collapsed counter.
Historical sessions are not backfilled.

Operators can stop new TTL points with the default-on
`cache_creation_ttl_metrics` feature flag through user config, managed config,
or `TRAJECTORY_DISABLE_FEATURES=cache_creation_ttl_metrics`. Disabling it never
affects the collapsed counter.

Grouped per-turn metrics emit one data point per dimension value:

| Metric | Type | Dimension |
|---|---|---|
| `gen_ai.usage.{input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens}` | count | `gen_ai.request.model`, `query_source` when strict request usage reconciles to the completed-turn total; otherwise the existing single turn point is retained |
| `trajectory.turn.cost.usd.additive` | count | `gen_ai.request.model`, `query_source` only when every strict request has native cost and the grouped sum reconciles to the completed-turn total; otherwise the existing single turn point is retained |
| `trajectory.turn.tool_uses` | gauge | `tool_name`, `tool_type`; MCP calls also carry `mcp_server`, `mcp_tool`, and `mcp_source_scope` when derivable |
| `trajectory.turn.tool_uses.additive` | count | Same dimensions as `trajectory.turn.tool_uses`; authoritative long-window tool-use totals |
| `trajectory.turn.tool_uses.total` | distribution | No `tool_name`; total tools in the completed turn |
| `trajectory.turn.permission_prompts` | gauge | `decision`, `permission_mode`, `approval_path` |
| `trajectory.turn.permission_prompts.additive` | count | Same dimensions as `trajectory.turn.permission_prompts`; authoritative long-window prompt totals |
| `trajectory.turn.tool_decision` | count | `tool_name`, `decision`, `source`, `permission_mode`, `approval_path`; legacy inferred accepts use `permission_mode:not_captured` instead of pretending a mode was observed |
| `trajectory.turn.code_edit_tool.decision` | count | `tool_name`, `decision`, `source`, `permission_mode`, `approval_path`, `language`; legacy inferred accepts use `permission_mode:not_captured` instead of pretending a mode was observed |
| `trajectory.turn.errors` | gauge | `category`; per-turn failed tool results. Uses explicit `turn_end.tool_error_categories` when an adapter supplies it, otherwise derives categories from completed `tool_use` events with `success:false`. This is not a Trajectory publish/tool-call transport failure metric. |
| `trajectory.turn.errors.additive` | count | Same `category` dimension as `trajectory.turn.errors`; authoritative long-window error totals |

For dashboard total queries, prefer `.additive` counts with `.as_count()`.
For percentile queries, prefer the `.total` distributions. For
per-tool breakdowns, use `trajectory.turn.tool_uses` grouped by `tool_name` or
the cross-client `tool_type`. Common coding-agent tools use the
`trajectory-spec` canonical `tool_name` and input-key registry (for example,
`read` becomes `Read`, `path` becomes `file_path`, and `exec_command` becomes
`Bash`). `native_tool_name` retains a changed source name on canonical JSONL
and Event Stream records. Specialized extension tools preserve their identity.
`tool_type` falls back to `unknown`. MCP dimensions are derived from sanitized
explicit or native MCP provenance, then from the canonical
`mcp__<server>__<tool>` naming convention. They never include tool arguments,
input, or output content. Publish-time reconstruction canonicalizes registered
aliases in historical records; older metric points already stored in Datadog
retain their original dimensions. Do not interpret an absent `mcp_server` as
proof that the call was not MCP.
Turn-scoped gauges are completed-turn samples. Do not sum long-window gauge
rollups as literal event counts unless the dashboard explicitly chooses a
single point per turn; use `.total` distributions, `.count` metrics, or
`.completed_count` mirrors where those exist.

## Automated Oversight Metrics

Automated oversight is a model-backed operation invoked automatically to judge
another action or output. Its metrics use
`trajectory.trace_type:oversight`; they are not turn or session metrics for the
reviewer container.

| Metric | Type | Unit | Emission rule |
|---|---|---|---|
| `trajectory.oversight.operations.total` | count | operation | One point per normalized `oversight_result` |
| `trajectory.oversight.duration_ms.total` | distribution | ms | One non-cumulative operation duration when positive and derivable |
| `trajectory.oversight.cost.usd.total` | distribution | USD | One authoritative operation cost when independently attributable |
| `gen_ai.usage.input_tokens` | count | token | Oversight-scoped when native operation input usage is available |
| `gen_ai.usage.output_tokens` | count | token | Oversight-scoped when native operation output usage is available |
| `gen_ai.usage.cache_creation_tokens` | count | token | Oversight-scoped when native cache-write usage is available |
| `gen_ai.usage.cache_read_tokens` | count | token | Oversight-scoped when native cache-read usage is available |

Every operation metric includes `trajectory.oversight.kind` (`approval`,
`safety`, or `quality`) and `trajectory.oversight.outcome` (`passed`, `blocked`,
`flagged`, `failed`, or `unknown`) when known. Provider role and feature names
remain trace diagnostics rather than metric dimensions. Permission-decision
metrics still describe the reviewed action; oversight metrics describe the
model-backed judgment, so the two are not duplicates. `off` publish mode
suppresses oversight spans and metrics for that destination.

`trajectory view` provides a local content-free Automated Oversight dashboard
over the durable operation records. It derives operations per 100 ordinary
turns, outcome rates, p50/p95 added latency, oversight-only tokens, and the sum
of costs whose attribution status is `priced`. Its provider-role and
provider-feature filters are local diagnostics only; they do not extend the
public metric dimension contract above.

## Per-Session Metrics

Session lifecycle counters:

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.session.count` | count | session start | One replay-safe live lifecycle start, grouped by Claude-compatible `start_type:fresh|resume|continue|agents_view`; passive discovery and historical backfill starts do not emit |

Running session gauges:

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.session.turns.elapsed` | gauge | turn | Running turn count, refreshed on turn end |
| `trajectory.session.tool_uses.elapsed` | gauge | call | Running tool-use count, refreshed on turn end |
| `trajectory.session.cost.usd.accumulated` | gauge | USD | Running and final observed session cost |
| `trajectory.session.web_search.requests` | gauge | request | Running and final observed WebSearch request count when present |
| `trajectory.session.web_search.cost.usd.accumulated` | gauge | USD | Running and final observed WebSearch cost at $0.01 per request |
| `trajectory.session.compactions.elapsed` | gauge | compaction | Running compaction count |
| `trajectory.session.last_seen.unix` | gauge | second | Latest observed source event timestamp as Unix seconds |

Session-end metrics:

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.session.duration_ms` | gauge | ms | Session duration when derivable |
| `trajectory.session.turns.total` | distribution | turn | Completed-session turn count |
| `trajectory.session.tool_uses.total` | distribution | call | Completed-session tool-use count |
| `trajectory.session.cost.usd.total` | distribution | USD | Completed-session cost sample; not an active-session coverage metric |
| `trajectory.session.web_search.requests.total` | distribution | request | Completed-session WebSearch request sample |
| `trajectory.session.web_search.cost.usd.total` | distribution | USD | Completed-session WebSearch cost sample |
| `trajectory.session.compactions.total` | distribution | compaction | Completed-session compaction sample |
| `trajectory.session.lines_changed` | gauge | line | Added plus removed lines when known |
| `trajectory.repo.resolution.total` | count | session | One live-only, privacy-bounded repository-attribution diagnostic per completed session; grouped by `trajectory.repo_resolution` and not reconstructable by historical local-session audit |
| `trajectory.session.yield_commit_count` | gauge | commit | Real git commits found in the session window by the yield tracker |
| `trajectory.session.yield_commit_count.completed_count` | count | commit | Completed-session mirror for dashboard totals; prefer this for sums |
| `trajectory.session.yield_main_commit_count` | gauge | commit | Yield commits reachable from the resolved main branch |
| `trajectory.session.yield_main_commit_count.completed_count` | count | commit | Completed-session mirror for dashboard totals; prefer this for sums |
| `trajectory.session.yield_revert_count` | gauge | commit | Revert commits among yielded main-branch commits |
| `trajectory.session.yield_revert_count.completed_count` | count | commit | Completed-session mirror for dashboard totals; prefer this for sums |

Cost completeness and Cursor rollout diagnostics:

| Metric | Type | Unit | Dimensions | Notes |
|---|---|---|---|---|
| `trajectory.session.cost.priced_turns` | gauge | turn | Cost-attribution tags | Number of explicitly priced turns seen for the session |
| `trajectory.session.cost.unpriced_turns` | gauge | turn | Cost-attribution tags, including `trajectory.cost_reason` | Number of explicit unpriced, unavailable, or invalid turns; nonzero suppresses the complete session USD metrics. A present but unrecognized model uses `trajectory.cost_reason:model_mismatch`; an absent model uses `trajectory.cost_reason:model_missing`. |
| `trajectory.cursor.token_capture.turns_total` | count | turn | `status`, `source`, `client_surface`, `trajectory.client_surface` plus canonical session tags | Eligible Cursor generations grouped at session end. Missing terminal generations use `source:unobserved`; full generation IDs are never metric tags. |
| `trajectory.pricing.lookup.total` | count | lookup | `status`, `reason`, `client_surface`, `trajectory.client_surface`, `gen_ai.request.model`, `trajectory.model.canonical`, `trajectory.model.equivalence_status`, `trajectory.model.thinking_mode`, `trajectory.model.speed_mode`, `trajectory.model.billing_mode`, `trajectory.model.context_mode` plus cost-attribution/session tags | One aggregated denominator count per bounded live pricing decision tuple. Cursor uses exact generation denominators in `shadow` or `emit` mode; other clients aggregate completed turns. A `candidate` equivalence is diagnostic only and remains unpriced until an exact managed mapping is approved. Historical Cursor records do not emit it. |

An explicitly unpriced Cursor turn emits no `trajectory.turn.cost.usd*` point.
A partially priced Cursor session emits no complete session USD gauge or
distribution. A legitimate priced zero remains a present USD sample with
`trajectory.cost_status:priced`.

When captured, `trajectory.client_surface` is the agent-neutral bounded
execution surface (`desktop`, `cli`, `cloud`, `workspace`, `web`, or
`unknown`). It is applied to canonical token and cost series as well as the
Cursor rollout diagnostics. The diagnostic-only `client_surface` dimension is
retained for query compatibility.

Derived session behavior metrics:

| Metric | Type | Unit | Provenance | Notes |
|---|---|---|---|---|
| `trajectory.session.one_shot_rate` | gauge | ratio | `activity_classifier` | Activity-classifier estimate of non-retried execution |
| `trajectory.session.total_retries` | gauge | retry | `activity_classifier` | Retry count derived from activity classification |
| `trajectory.session.plan_to_one_shot` | gauge | ratio | `activity_classifier` | Plan-to-execution one-shot score; `-1` means no plan phase was detected |
| `trajectory.session.context_budget_pct` | gauge | percent | `context_budget_estimator` | Estimated context budget usage percentage |
| `trajectory.session.context_budget_tokens` | gauge | token | `context_budget_estimator` | Estimated total context budget tokens |
| `trajectory.session.context_budget_claude_md_tokens` | gauge | token | `context_budget_estimator` | Estimated CLAUDE.md contribution to context budget |
| `trajectory.session.context_budget_mcp_tokens` | gauge | token | `context_budget_estimator` | Estimated MCP contribution to context budget |
| `trajectory.session.context_budget_skills_tokens` | gauge | token | `context_budget_estimator` | Estimated skill-file contribution to context budget |
| `trajectory.session.waste_score` | gauge | score | `waste_evaluator` | Waste evaluator score; higher is cleaner |
| `trajectory.session.waste_junk_reads_count` | gauge | finding | `waste_evaluator` | Junk-read findings |
| `trajectory.session.waste_duplicate_reads_count` | gauge | finding | `waste_evaluator` | Duplicate-read findings |
| `trajectory.session.waste_low_read_edit_ratio_count` | gauge | finding | `waste_evaluator` | Low read/edit ratio findings |
| `trajectory.session.waste_retry_loops_count` | gauge | finding | `waste_evaluator` | Retry-loop findings |
| `trajectory.session.waste_unused_tools_count` | gauge | finding | `waste_evaluator` | Unused-tool findings |

These metrics carry `trajectory.metric_signal:derived_behavior` and the
corresponding `trajectory.metric_family` value (`activity`, `context_budget`,
or `waste`). They should not be mixed with authoritative usage/cost totals
without keeping the provenance dimension visible.

## Efficiency Shadow Metrics

The deterministic efficiency observer records content-free local findings when
`efficiency_shadow_observer` is enabled. External metrics are independently
default-off: only managed `config.defaults.yaml` or assigned cohort policy may
set `efficiency_observer.export.enabled: true` and name required
`destination_refs`, and a named managed cohort must be assigned. User and
project configuration cannot authorize export.
Disabling the local feature, revoking managed policy, incognito, or destination
sensitivity suppression stops external delivery.

Detection and cost metrics:

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.efficiency.detector.evaluations.total` | count | evaluation | Eligible deterministic detector evaluations |
| `trajectory.efficiency.detector.candidates.total` | count | candidate | Candidate no-progress sequences created |
| `trajectory.efficiency.findings.total` | count | finding | Findings first opened |
| `trajectory.efficiency.findings.closed.total` | count | finding | Findings closed |
| `trajectory.efficiency.no_progress.generations.total` | distribution | generation | Distinct no-progress generations after the establishing generation |
| `trajectory.efficiency.no_progress.operations.total` | distribution | operation | Matching operations after the establishing observation |
| `trajectory.efficiency.no_progress.duration_ms.total` | distribution | ms | Closed no-progress window duration |
| `trajectory.efficiency.no_progress.input_tokens.total` | distribution | token | Known non-overlapping input tokens |
| `trajectory.efficiency.no_progress.output_tokens.total` | distribution | token | Known non-overlapping output tokens |
| `trajectory.efficiency.no_progress.cache_read_tokens.total` | distribution | token | Known non-overlapping cache-read tokens |
| `trajectory.efficiency.no_progress.cache_creation_tokens.total` | distribution | token | Known non-overlapping cache-creation tokens |
| `trajectory.efficiency.no_progress.cost.usd.total` | distribution | USD | Complete authoritative cost observation for one closed finding |
| `trajectory.efficiency.no_progress.cost.usd.additive` | count | USD | Replay-safe additive companion for the same complete finding |
| `trajectory.efficiency.no_progress.cost.lower_bound.usd.total` | distribution | USD | Known priced subtotal when cost evidence is incomplete; never additive |

Exact cost distribution and additive points are emitted together or not at all.
The lower-bound distribution is mutually exclusive with them for one finding
version. These values reattribute cost already represented by canonical
turn/session metrics; they are diagnostic projections, not additional spend.
Do not add them to canonical billing, provider, PR, CODEOWNER, turn, or session
cost totals. Across different detector families, finding windows may overlap.

Observer health and rollout metrics:

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.ops.efficiency.observations.total` | count | observation | Accepted observations, grouped by bounded type |
| `trajectory.ops.efficiency.observations.skipped.total` | count | observation | Skips grouped by bounded reason |
| `trajectory.ops.efficiency.detector.duration_ms` | distribution | ms | Detector execution time |
| `trajectory.ops.efficiency.detector.errors.total` | count | error | Bounded detector error class |
| `trajectory.ops.efficiency.queue.depth` | gauge | observation | Pending observer backlog; zero for the synchronous V1 observer |
| `trajectory.ops.efficiency.queue.lag_ms` | gauge | ms | Oldest pending age; zero for the synchronous V1 observer |
| `trajectory.ops.efficiency.state.entries` | gauge | entry | Current bounded detector state |
| `trajectory.ops.efficiency.state.evictions.total` | count | entry | Expired bounded detector state |
| `trajectory.ops.efficiency.finding.persist.duration_ms` | distribution | ms | Local finding persistence latency |
| `trajectory.ops.efficiency.metric.enqueue.total` | count | metric | Domain metrics durably accepted by managed shadow export |

V1 runs after durable capture and uses no per-tool hook, model call, remote
request, subprocess, or filesystem scan. Its model/API cost is therefore zero;
the operational metrics above measure its local resource overhead. Exported
tags use only bounded detector, finding, evidence, completeness, client, cost,
result, and managed rollout vocabularies. Every exported point includes
`managed:true` and its assigned `cohort`. Session, finding, turn, generation,
tool-use, process, job, resource, repository, host, user, command, path, URL,
and content identifiers are never metric tags.

## Task Metrics

Task metrics come from closed task segments. They are emitted with
`trajectory.trace_type:task` and the dimensions `task_type`, `outcome_label`,
`task_id`, `trajectory.task.turn_start`, and `trajectory.task.turn_end` when
`segmentation.publish_metrics`, legacy `segmentation.publish_traces`, or
`segmentation.task_insights.publish` is effectively enabled. The start and end
tags are the authoritative inclusive turn IDs; `trajectory.task.turns` is
their exact durable-member count. With the
default-on `task_segmentation_metrics_v2` feature, leaf points also carry
`task_level:task` and an optional `meta_task_id`. When the separate default-off
`task_meta_segmentation` feature is enabled, meta-task cost points also carry
`task_level:meta_task`, `meta_task_id`, and `task_count`. When Work Insights v1
is stored, leaf task points additionally carry
`work_insights_taxonomy_version`, `work_insights_level_1`, and
`work_insights_level_2`; these identify the broad outcome taxonomy separately
from the coding-specific `task_type`. V2 task metrics emit
once during final session publication, after final task segmentation and any
explicitly enabled meta-task pass; this keeps complete cost stable. The legacy
`segmentation.publish_traces` gate also enables these metrics for existing
trace-publish opt-ins. The default-off
`segmentation.task_insights.publish` gate also enables them alongside its
privacy-reduced task trace/evaluation family. Destinations can suppress all
task-segmentation-derived publish outputs with `segmentation.enabled: false`.
The privacy-reduced free-form task label is intentionally absent from metric
tags.

| Metric | Type | Unit |
|---|---|---|
| `trajectory.task.outcome_score` | gauge | score |
| `trajectory.task.autonomy_score` | gauge | score |
| `trajectory.task.complexity_score` | gauge | score |
| `trajectory.task.risk_score` | gauge | score |
| `trajectory.task.turns` | gauge | count |
| `trajectory.task.cost.usd.total` | distribution | USD |

Task cost is the sum of persisted `turns.estimated_cost_usd` for every turn in
the task. It fails closed when any member turn is unpriced; an explicitly
priced zero remains a valid sample. When `task_meta_segmentation` is enabled,
meta-task cost uses the exact union of its member task ranges, not the enclosing
minimum/maximum range. Leaf and meta-task costs overlap by design, so select
exactly one `task_level` before computing counts, totals, averages, or
percentiles.

Incognito and internal segmentation sessions do not run task segmentation and
therefore emit neither task metrics nor segmentation operational telemetry.

## CODEOWNERS Attribution Metrics

These metrics are emitted from durable scope summaries. During turn publish,
only the current turn summary is emitted. Finalized task, commit, PR, and
session summaries are emitted at session end. The common
`trajectory.codeowner_scope`, `trajectory.codeowner_source`,
`trajectory.codeowner_status`, and `trajectory.codeowner_truncated` tags state
which scope each sample represents.

| Metric | Type | Value | Additivity |
|---|---|---|---|
| `trajectory.codeowner.scopes.total` | count | `1` per evaluated scope | Additive across distinct scopes at the same grain; do not combine grains |
| `trajectory.codeowner.owners.total` | distribution | Exact eligible owner count before the five-owner cap | Diagnostic distribution, not a unique owner total across scopes |
| `trajectory.codeowner.owners.retained` | distribution | Retained owner count after the cap | Diagnostic distribution |
| `trajectory.codeowner.owners.dropped` | distribution | Owner count omitted by the cap | Additive dropped-association volume when summed at one grain |
| `trajectory.codeowner.truncated.total` | count | `1` for each scope whose owner set was truncated | Additive across distinct scopes at one grain |
| `trajectory.codeowner.email_owners_ignored.total` | count | Email owner identities excluded from the scope | Additive diagnostic volume |
| `trajectory.codeowner.resolution_failures.total` | count | Resolution failures emitted at session end; carries bounded scope, reason, and snapshot-source tags | Additive diagnostic volume by one identical tag set |
| `trajectory.codeowner.associations.total` | count | `1` per retained owner and scope; carries `trajectory.codeowner` and `trajectory.codeowner_kind` | Non-exclusive across owners |
| `trajectory.codeowner.files.total` | distribution | Distinct associated files for one retained owner and scope | Non-exclusive across owners |

`trajectory.codeowner.associations.total` is intentionally non-exclusive: one
co-owned file contributes an association to each retained owner. Do not sum it
as a global file count. Use `trajectory.codeowner.owners.dropped` and
`trajectory.codeowner.truncated.total` to measure how often the five-owner cap
loses owner dimensions.

`trajectory.codeowner.resolution_failures.total` carries exactly these
diagnostic dimensions:

- `trajectory.codeowner_scope`;
- `trajectory.codeowner_failure_reason`: `missing`, `parse_error`,
  `snapshot_store_error`, or `change_files_unavailable`; and
- `trajectory.codeowner_snapshot_source`: `session_head`,
  `persisted_snapshot`, or `pr_turn_range`.

The metric is emitted at session end and contains categorical counts only. It
never carries paths, Git object IDs, CODEOWNERS contents, or source content.
Use `trajectory audit --source-data` for the matching local categorical
summary.

### PR production owner metrics

These distribution samples are emitted once per retained owner and finalized
PR context. They carry one scalar `trajectory.codeowner`, its
`trajectory.codeowner_kind`, the common CODEOWNER tags above, and the durable
PR-work identity/context tags listed below. Co-owned turns contribute their
full values to every involved retained owner, so every row is non-exclusive.

| Metric | Value | Additivity |
|---|---|---|
| `trajectory.codeowner.pr.production.turns.total` | Assigned completed turns whose eligible production involved the retained owner | Additive for one selected owner across mutually exclusive contexts; never sum across owners |
| `trajectory.codeowner.pr.production.cost.usd.total` | Full completed-turn cost involving the retained owner | Overlaps across owners; never use as a global total, allocation, or chargeback |
| `trajectory.codeowner.pr.production.input_tokens.total` | Full input-token count involving the retained owner | Overlaps across owners |
| `trajectory.codeowner.pr.production.output_tokens.total` | Full output-token count involving the retained owner | Overlaps across owners |
| `trajectory.codeowner.pr.production.cache_read_tokens.total` | Full cache-read-token count involving the retained owner | Overlaps across owners |
| `trajectory.codeowner.pr.production.cache_creation_tokens.total` | Full cache-creation-token count involving the retained owner | Overlaps across owners |

Use a flat Top List grouped by `trajectory.codeowner`. Never stack these
groups, sum them into a total, or describe them as spend allocation. There is
no honest formula that derives mutually exclusive per-owner allocation from
these overlapping series. Use `trajectory.pr.work.cost.usd.total` for the
canonical ungrouped PR-work total.

### Exclusive PR production coverage

Coverage omits `trajectory.codeowner`. Each completed assigned turn goes to
exactly one side according to whether its turn summary had at least one
eligible production owner before the five-owner cap.

| Metric | Value | Additivity |
|---|---|---|
| `trajectory.pr.work.codeowner_attributed_turns.total` | Assigned turns with at least one eligible production owner | Add with the matching unattributed metric |
| `trajectory.pr.work.codeowner_unattributed_turns.total` | Assigned turns with no eligible production owner | Add with the matching attributed metric |
| `trajectory.pr.work.codeowner_attributed_cost.usd.total` | Cost in attributed turns | Add with the matching unattributed metric |
| `trajectory.pr.work.codeowner_unattributed_cost.usd.total` | Cost in unattributed turns | Add with the matching attributed metric |
| `trajectory.pr.work.codeowner_attributed_input_tokens.total` | Input tokens in attributed turns | Add with the matching unattributed metric |
| `trajectory.pr.work.codeowner_unattributed_input_tokens.total` | Input tokens in unattributed turns | Add with the matching attributed metric |
| `trajectory.pr.work.codeowner_attributed_output_tokens.total` | Output tokens in attributed turns | Add with the matching unattributed metric |
| `trajectory.pr.work.codeowner_unattributed_output_tokens.total` | Output tokens in unattributed turns | Add with the matching attributed metric |

Under identical filters, time windows, and aggregation, each attributed plus
unattributed pair equals its exact canonical metric:

- turns: `trajectory.pr.work_turns.total`;
- cost: `trajectory.pr.work.cost.usd.total`;
- input: `trajectory.pr.work.input_tokens.total`; and
- output: `trajectory.pr.work.output_tokens.total`.

Coverage uses eligible-before-cap, so a truncated six-owner turn is still
attributed.

All fourteen PR CODEOWNER metrics carry `source:prwork`, `change_host`, Git
repository `owner`, `repo`, `change_number`, `context_source`,
`work_context_mode`, `identity_confidence`, `signal_confidence`,
`local_range_status`, `trajectory.codeowner_scope:pr`,
`trajectory.codeowner_source`, `trajectory.codeowner_status`, and
`trajectory.codeowner_truncated`. Cost/token metrics additionally carry
`trajectory.cost_role:attribution` and bounded provider/overlap tags when
available. Turns metrics do not carry cost-overlap tags.

These fourteen names are current emitted metrics, not reserved or planned
names. Their metric-catalog lifecycle is `current`. The bounded diagnostic
dimensions above describe derivation state without exposing commands, paths,
refs, object IDs, diffs, CODEOWNERS patterns, or source content. Read/search
ownership is not part of this production family; a future read/search contract
must use separately labeled metrics and semantics.

For exact additive-total, owner-involvement, coverage, reconciliation, and
dashboard-label rules, see [Cost Attribution and Dashboarding](COST-ATTRIBUTION.md).

## Built-In Marker Metrics

Marker metrics are resolved from the active marker catalog at publish time.
Built-in and setup-default metrics include:

For trusted skill usage reports, prefer `trajectory.turn.skill_invocations` with
`sum by {skill_name,detected_from,source_scope,signal_confidence}`. When native
or explicit source metadata is unavailable, `source_scope` may be recovered by
matching a generic skill-tool invocation against local project/user skill files.
These metric series also carry the normal Trajectory session tags, including
`trajectory.client_source`, `trajectory.client_version`, `trajectory.user`, and
repo tags when available. Use `trajectory.client_version` when checking whether
Claude skill attribution coverage changed across Claude Code releases.
`trajectory.session.skill_invocations` and its automatic `.completed_count`
mirror remain available for completed-session rollups, but only
high-confidence activation signals are counted there. Use
`trajectory.turn.skill_observations` or `trajectory.session.skill_observations`
for weaker breadcrumbs such as a client reading `SKILL.md` without an explicit
activation signal.

Claude Code skill activation can arrive from two high-confidence native
surfaces:

- native OTLP `skill_activated` logs accepted on the local `trajectory serve`
  `/v1/logs` endpoint and converted into sanitized `Skill` tool activation
  records tagged `detected_from:claude_native_otel`;
- native transcript assistant messages with `attributionSkill`, stamped onto
  the Trajectory `turn_end` event and converted into `skill-invoked` markers
  tagged `detected_from:claude_native_transcript`.

When multiple high-confidence surfaces describe the same skill in the same
turn, Trajectory emits one invocation. Native Claude OTel or transcript
attribution takes precedence over generic `Skill` tool evidence. When both
Claude-native surfaces are present, completed transcript attribution supplies
the invocation's `detected_from` tag.

Codex skill activation is recovered from either the structured `<skill>`
envelope in the native rollout, tagged `detected_from:codex_skill_prompt`, or a
runtime-managed `exec` wrapper whose nested `tools.exec_command` performs a
read-only load of `SKILL.md`, tagged `detected_from:codex_skill_read`. These
signals are deduplicated when both describe the same skill in one turn.
cursor-agent loads an activated project or user skill through its Read tool;
reads under the native `.cursor/skills/<name>/SKILL.md` path are tagged
`detected_from:cursor_skill_read`. Other direct `SKILL.md` reads remain
lower-confidence observations.

Setup enables Claude log detail locally so skill names are available when
Claude exposes them.

When a turn has a high-confidence skill invocation marker, Trajectory also emits
skill complexity metrics. Claude native OTLP trace spans are preferred when
available. Tool spans with native skill attributes publish as
`skill_attribution:span_tool_attribute`; otherwise a single high-confidence
skill signal can be correlated with same-turn Claude tool spans as
`skill_attribution:span_temporal`. If no usable native trace window exists,
Trajectory falls back to same-turn materialized tool rows tagged
`skill_attribution:turn_assisted`. The fallback is useful for broad trends but
does not imply exact active-skill parentage.

All skill complexity series carry `skill_name`, `detected_from`,
`source_scope`, `signal_confidence`, and `skill_attribution`.

| Metric | Type | Scope | Source |
|---|---|---|---|
| `trajectory.turn.skill_tool_uses` | gauge | turn | Same-turn tool-use count tagged by `skill_name`, `tool_name`, `tool_type`, and signal dimensions |
| `trajectory.turn.skill_tool_uses.additive` | count | turn | Additive same-turn tool-use stream with the same skill and tool dimensions |
| `trajectory.turn.skill_tool_uses.total` | distribution | turn | Total non-skill tool calls in the skill-assisted turn |
| `trajectory.turn.skill_distinct_tools.total` | distribution | turn | Distinct non-skill tool names in the skill-assisted turn |
| `trajectory.turn.skill_duration_ms.total` | distribution | turn | Skill-assisted turn duration when turn timestamps are available |

Count-like marker session gauges also have turn-level count samples for
turn-native reporting. Permission reports should use
`trajectory.turn.permissions_denied` grouped by `tool`, `category`, and `source`
when turn visibility matters.

These marker-derived turn samples publish at turn end. For example,
`trajectory.turn.skill_invocations` becomes available after the invoking turn
completes; deleting or otherwise ending the coding-agent session is not part of
its publication contract.

| Metric | Type | Scope | Source |
|---|---|---|---|
| `trajectory.session.user_frustrations` | gauge | session | User frustration points |
| `trajectory.turn.user_frustrations` | count | turn | Per-turn user frustration points |
| `trajectory.session.commits` | gauge | session | Git commit points |
| `trajectory.turn.commits` | count | turn | Per-turn git commit points |
| `trajectory.session.prs` | gauge | session | PR/MR creation points |
| `trajectory.turn.prs` | count | turn | PR/MR creation point for the originating turn, tagged by `change_host`, `owner`, `repo`, and `change_number` |
| `trajectory.turn.pr_contexts` | count | turn | PR/MR context observation point for prompts or PR/MR CLI output, tagged by `change_host`, `owner`, `repo`, `change_number`, `context_source`, and `signal_confidence` when available |
| `trajectory.session.pushes` | gauge | session | Git push points |
| `trajectory.turn.pushes` | count | turn | Per-turn git push points |
| `trajectory.session.test_fix_cycles` | gauge | session | Completed test-fix ranges |
| `trajectory.turn.test_fix_cycles` | count | turn | Per-turn completed test-fix ranges |
| `trajectory.session.user_interruptions` | gauge | session | User interruption points |
| `trajectory.turn.user_interruptions` | count | turn | Per-turn user interruption points |
| `trajectory.session.tool_errors` | gauge | session | Tool-error points, often grouped by `category` |
| `trajectory.turn.tool_errors` | count | turn | Per-turn tool-error points tagged by `category` |
| `trajectory.session.permissions_denied` | gauge | session | Permission denial points |
| `trajectory.turn.permissions_denied` | count | turn | Per-turn permission denial points tagged by `tool`, `category`, and `source` |
| `trajectory.session.language_activity` | gauge | session | Tool activity grouped by `language` |
| `trajectory.turn.language_activity` | count | turn | Per-turn language activity tagged by `language` |
| `trajectory.session.skill_invocations` | gauge | session | High-confidence skill invocations grouped by `skill_name` |
| `trajectory.turn.skill_invocations` | count | turn | High-confidence skill invocation events tagged by `skill_name`, `detected_from`, `source_scope`, and `signal_confidence` |
| `trajectory.session.skill_observations` | gauge | session | Lower-confidence skill observations grouped by `skill_name` |
| `trajectory.turn.skill_observations` | count | turn | Lower-confidence skill observations tagged by `skill_name`, `detected_from`, `source_scope`, and `signal_confidence` |
| `trajectory.session.cli_tool_count` | gauge | session | Recognized shell command-line tool invocations grouped by normalized `tool`; use the `.completed_count` mirror for toplists |
| `trajectory.turn.cli_tool_count` | count | turn | Per-turn recognized shell command-line tool invocations tagged by normalized `tool` |
| `trajectory.session.subagents` | gauge | session | Deprecated compatibility marker for the built-in `Agent`-tool signal; do not combine it with source-backed launch lifecycle metrics. |
| `trajectory.turn.subagents` | count | turn | Deprecated compatibility marker; use `trajectory.turn.subagent_invocations.additive` for authoritative cross-client launch totals. |
| `trajectory.session.tests_written` | gauge | session | Built-in new-test count |
| `trajectory.turn.tests_written` | count | turn | Per-turn new-test points |
| `trajectory.session.force_pushes` | gauge | session | Built-in force-push count |
| `trajectory.turn.force_pushes` | count | turn | Per-turn force-push points |
| `trajectory.session.ci_iterations` | gauge | session | Setup-default CI feedback ranges |
| `trajectory.turn.ci_iterations` | count | turn | Per-turn completed CI feedback ranges |
| `trajectory.session.code_added` | gauge | session | Setup-default code-change count |
| `trajectory.turn.lines_of_code.count` | count | turn | Base line-delta telemetry tagged with `type:added` or `type:removed`; use `type:added` for turn-level code-added reports |
| `trajectory.session.files_modified` | gauge | session | Built-in files-touched count |
| `trajectory.turn.files_touched` | count | turn | Per-turn files-touched marker points; `trajectory.turn.files_modified` remains the base edit-count gauge |
| `trajectory.session.tasks` | gauge | session | Task segment count when `segmentation.publish_metrics`, `segmentation.publish_traces`, or `segmentation.task_insights.publish` is enabled and destination segmentation is enabled |
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

For command-line usage toplists, query
`sum:trajectory.session.cli_tool_count.completed_count by {tool}`. The `tool`
tag is normalized from an allowlist of command families such as `git`, `gh`,
`go`, `pytest`, `npm`, `docker`, and `kubectl`; unknown command names
are skipped instead of being emitted as raw tag values.

Commit and PR attribution metrics include additive deltas and distribution samples:

| Metric | Type | Scope | Notes |
|---|---|---|---|
| `trajectory.commit.cost.usd.total` | distribution | commit | Cost attributed to turns since the previous commit; yield-derived samples carry `branch` and are preferred over transcript-derived commit markers |
| `trajectory.commit.attributed_turns.total` | distribution | commit | Turns attributed to the commit; yield-derived samples carry `branch` and are preferred over transcript-derived commit markers |
| `trajectory.pr.cost.usd.attributed.total` | distribution | pr | Cost attributed to the PR/MR creation tail; carries `change_host`, `owner`, `repo`, and `change_number` when extracted |
| `trajectory.pr.attributed_turns.total` | distribution | pr | Turns attributed to the PR/MR creation tail; carries `change_host`, `owner`, `repo`, and `change_number` when extracted |
| `trajectory.pr.containing_session.cost.usd.total` | distribution | pr | Containing-session cost sampled once per PR/MR; carries `change_host`, `owner`, `repo`, and `change_number` when extracted; do not sum |
| `trajectory.pr.interaction.cost.usd.additive` | count | turn | Additive priced-turn cost paired with one unambiguous PR interaction identity; ambiguous multi-PR and unpriced turns emit no delta |
| `trajectory.pr.contexts.total` | distribution | pr | One sample per finalized workspace/creation PR work context; durable projection rows carry `source:prwork` plus bounded identity and range tags |
| `trajectory.pr.interactions.total` | count | pr | One point per deduplicated explicit PR interaction turn; carries `trajectory.turn_id` and does not create a second spend assignment when another workspace is primary |
| `trajectory.pr.work.evidence.total` | count | pr | Privacy-bounded diagnostic count of local PR/MR evidence by `reason`, `coverage_state`, and `projection_state`; use it to explain absent PR-work spend or interaction metrics, not as an all-SCM PR denominator |
| `trajectory.pr.work_turns.total` | distribution | pr | Completed turns assigned to one finalized PR work context |
| `trajectory.pr.work_duration_ms.total` | distribution | pr | Sum of completed assigned-turn duration for one finalized PR work context, not wall-clock time across gaps |
| `trajectory.pr.work.cost.usd.total` | distribution | pr | Canonical PR-work cost from completed turns with one primary PR assignment; do not add to turn/session or creation-tail cost |
| `trajectory.pr.work.input_tokens.total` | distribution | pr | Input tokens from completed turns assigned to one primary PR context |
| `trajectory.pr.work.output_tokens.total` | distribution | pr | Output tokens from completed turns assigned to one primary PR context |
| `trajectory.pr.work.cache_read_tokens.total` | distribution | pr | Cache-read tokens from completed turns assigned to one primary PR context |
| `trajectory.pr.work.cache_creation_tokens.total` | distribution | pr | Cache-creation tokens from completed turns assigned to one primary PR context |
| `trajectory.session.pr_attribution.total` | gauge | session | Distinct deterministic PR interactions in the session; equivalent to `.interacted` |
| `trajectory.session.pr_attribution.interacted` | gauge | session | Distinct PRs with successful deterministic create, checkout, inspect, collaborate, merge, or close evidence |
| `trajectory.session.pr_attribution.created` | gauge | session | Distinct PRs created by the session |
| `trajectory.session.pr_attribution.attributed` | gauge | session | Interacted PRs with either full-context or exact creation-turn priced work |
| `trajectory.session.pr_attribution.context` | gauge | session | Interacted PRs with durable full-context spend attribution |
| `trajectory.session.pr_attribution.direct_only` | gauge | session | PR deliverables attributed only to the exact priced creation turn |
| `trajectory.session.pr_attribution.unattributed` | gauge | session | Interacted PRs without trustworthy priced work attribution |
| `trajectory.session.pr_attribution.coverage` | gauge | session | Attributed PRs divided by interacted PRs |
| `trajectory.codeowner.pr.production.{turns,cost.usd,input_tokens,output_tokens,cache_read_tokens,cache_creation_tokens}.total` | distribution | pr | Per-retained-owner production involvement; six overlapping metrics, never additive across `trajectory.codeowner` |
| `trajectory.pr.work.codeowner_{attributed,unattributed}_{turns,cost.usd,input_tokens,output_tokens}.total` | distribution | pr | Eight exclusive coverage metrics; each attributed/unattributed pair reconciles to the matching canonical PR-work measurement under identical filters |

Cost per PR means cost per distinct PR/MR with AI interaction, not cost per PR
creation. Sum the paired interaction-cost stream and divide it by the distinct
normalized PR identities represented by that same stream under identical
filters and time bounds. The distinct key is
`(change_host, owner, repo, change_number)` and requires DDSQL or another query
surface that can count grouped metric rows.

```text
cost = sum:trajectory.pr.interaction.cost.usd.additive{...}.as_count()
prs  = count rows from max:trajectory.pr.interaction.cost.usd.additive{...}
       by {change_host,owner,repo,change_number}
cost / prs
```

This ratio covers distinct PRs with at least one priced, unambiguous
interaction turn. A turn that resolves to multiple PR identities is excluded
from both the cost numerator and the matched denominator so its cost is never
duplicated. Use `trajectory.turn.pr_contexts` separately to monitor broader
interaction-identity coverage.

Do not use `trajectory.pr.cost.usd.attributed.total` or
`trajectory.session.prs.completed_count`; both describe PR creation. Do not
divide the all-turn historical cost metric by historical PR observations:
`trajectory.historical.turn.cost.usd.additive` includes turns without PR
attribution. The historical observation campaign is useful for validating
interaction coverage and distinct-PR scale, but the current historical metric
set cannot produce an accurate historical cost-per-interacted-PR ratio.

Durable PR-work rows carry `source:prwork`, `change_host`, `owner`, `repo`,
`change_number`, `context_source`, `work_context_mode`,
`identity_confidence`, `signal_confidence`, and `local_range_status` when
available. Cost- and token-bearing PR-work rows also carry
`trajectory.cost_role:attribution` plus the bounded provider-route and
cost-overlap tags derived from their assigned turns.

Managed historical replay uses separate campaign-scoped contracts:

These metrics do not inherit the Common Tags or metric-catalog classification
tags. Their published tag maps are the fixed campaign allowlists described
below; this prevents late transport enrichment from expanding campaign
cardinality or its metadata-only privacy boundary.

| Metric | Type | Scope | Notes |
|---|---|---|---|
| `trajectory.historical.pr.ai_assisted.observed` | gauge | historical | Value `1` at the first eligible interaction on each campaign-local activity day. Carries normalized PR identity plus `campaign_id`, extractor, user, version, client, host, and OS provenance. It never carries session, turn, project, model, email, or provider-user identity. Use a `max` reducer grouped by PR identity before counting distinct PRs; never sum raw points. |
| `trajectory.historical.turn.cost.usd.additive` | count | historical | One trustworthy completed-turn USD delta for an explicit user-driven Codex repair or managed `turn_cost_additive` campaign. Effective-dated managed reruns resolve a checksum-pinned card at the original completed-turn time and fill only previously unpriced cells. Sum only with `.as_count()` and an authoritative repair/campaign identity. It carries the authoritative `trajectory.cost_contract:v2` label plus bounded user, client, model, host, extractor, and cost-attribution tags, but no session or turn identity. Never overlap it with the live additive namespace in one time range. |
| `trajectory.turn.lines_of_code.count` | count | historical turn repair | A managed `turn_loc_additive` campaign may restore missing Codex `type:added` and `type:removed` points into the existing live metric, so dashboards need no query change. The campaign window must end before corrected live capture begins. Points carry campaign, extractor, user, client, model, host, and OS provenance but no session or turn identity. |
| `trajectory.historical.replay.completed` | gauge | historical | Current completion signal for one user-driven repair or managed campaign and laptop provenance. |
| `trajectory.historical.replay.source_coverage_days` | gauge | historical | Readable in-window source span by client; it does not claim activity on every day. |
| `trajectory.historical.replay.sessions_scanned` | gauge | historical | Canonical sessions scanned by client during materialization. |
| `trajectory.historical.replay.sources_failed` | gauge | historical | Provider or canonical-source gaps retained with the materialized receipt. |
| `trajectory.historical.replay.observation_points` | gauge | historical | Sparse observation rows projected before destination fanout. |
| `trajectory.historical.replay.turns_priced` | gauge | historical | In-window completed turns accepted by the cost projector, by client source. |
| `trajectory.historical.replay.turns_unpriced` | gauge | historical | In-window completed turns rejected for missing, unknown, proxy, or invalid cost evidence, by client source. |

Managed historical replay metrics require managed campaign config and managed
required destinations. The user-driven Codex cost path instead requires the
explicit `--yes` confirmation, a bounded window, Codex source scope, and a
resolved Datadog metric destination. User trace, marker, cost, incognito, and
sensitivity settings do not suppress this metadata-only namespace. Imported
provider events remain `_metric_ineligible` for every ordinary metric family.
Both paths use the native Metrics v2 intake so backdated points follow the
Datadog Historical Metrics Ingestion contract.

A managed `metric_projection` campaign is the explicit exception to ordinary
metric ineligibility. It projects a frozen manifest of reconstructable gauges
and counts into their existing live metric names. The available administrator
slices are `model_consumption`, `spend`, `adoption`, `engineering_output`,
`agent_workflow`, and `outcomes`; `all` selects their union. Exact
`include_metrics` and `exclude_metrics` refine that selection, while the
required `metric_manifest` freezes the fully resolved names. The runner rejects
manifest drift, distributions, replay-only remote tags, and a campaign whose
`end_at` is after `live_cutover_at`.

The existing-namespace acknowledgement accepts the residual risk that another
producer may already have written one of the selected cells. Idempotency relies
on the complete Datadog cell identity: metric name, type, second timestamp, and
full tag set. Campaign identity is retained only in the local ledger and never
added as a metric tag. Same-cell count observations are coalesced before the
native Metrics v2 outbox is written.

The initial projector retains the managed replay framework's current macOS
scope and Claude Code, Codex, Cursor, Pi, and OpenCode source allowlist. A
selected name is a projection capability, not a promise that every source
retains the evidence needed to emit it.

`engineering_output` covers reconstructable files/LOC plus built-in commit,
PR, push, test, build-retry, and language-activity measures. It is
capability-dependent: missing tool, file, diff, Git, or provider evidence is
omitted rather than reported as zero, and managed config must acknowledge that
limitation. `agent_workflow` similarly includes built-in CLI-tool, permission,
subagent, tool-error, and interruption measures when their source facts exist.
`outcomes` runs the pinned marker
definitions against retained content and requires both a matching
`outcomes_definition_hash` and an evaluation-cost acknowledgement. The current
in-memory marker projector makes no provider call itself, but the acknowledgement
is mandatory because outcome policies may depend on separately paid historical
classification. Use the campaign receipt's selected/projected counts and source
failures to distinguish coverage gaps from true zero activity.

`trajectory markers validate` prints the resolved `config_hash` used for
`outcomes_definition_hash`. The `metric_manifest` is intentionally explicit:
operators review and copy the resolved gauge/count names into managed policy
rather than authorizing a moving `all` target.

```yaml
historical_replay:
  campaigns:
    - id: customer-onboarding-2026-07
      kind: metric_projection
      enabled: true
      historical_metrics_ingestion_confirmed: true
      start_at: "2026-04-18T04:00:00Z"
      end_at: "2026-07-17T04:00:00Z"
      live_cutover_at: "2026-07-17T04:00:00Z"
      window_timezone: America/New_York
      claim_deadline: "2026-09-01T04:00:00Z"
      extractor_version: 1
      platforms: [darwin]
      cohort: all
      sources: [claude_code, codex, cursor, pi, opencode]
      metric_slices: [model_consumption, spend, adoption]
      include_metrics: [trajectory.turn.lines_of_code.count]
      exclude_metrics: [trajectory.turn.number]
      metric_manifest:
        - gen_ai.usage.input_tokens
        - gen_ai.usage.output_tokens
        - gen_ai.usage.cache_creation_tokens
        - gen_ai.usage.cache_read_tokens
        - trajectory.turn.cost.usd.additive
        - trajectory.session.turns.elapsed
        - trajectory.turn.duration_ms
        - trajectory.session.last_seen.unix
        - trajectory.turn.lines_of_code.count
      acknowledge_existing_namespace_replay: true
```

Selecting `engineering_output` additionally requires
`acknowledge_engineering_output_limitations: true`. Selecting `outcomes` (also
selected by `all`) additionally requires
`acknowledge_outcomes_evaluation_cost: true` and the exact
`outcomes_definition_hash`.

The first cost campaign materializes 90 complete Eastern days through EOD July
16, 2026, while its initial product view defaults to the most recent 60 days.
Token-derived amounts are recomputed with the campaign extractor's verified
public rate card; trustworthy native/provider amounts are retained; Cursor
proxy history fails closed as unpriced. Campaigns have immutable bounds,
an attribution allowlist, explicit coverage semantics, and successor rules.

`trajectory.pr.work.cost.usd.total` is additive across its mutually exclusive
primary PR assignments, but it reuses base completed-turn cost. Never add it to
`trajectory.turn.cost.usd.additive`, `trajectory.turn.cost.usd.total`,
`trajectory.session.cost.usd.total`, or the
legacy creation-tail PR cost metrics. CODEOWNER association metrics can overlap
and are not a mutually exclusive allocation. Do not derive mutually exclusive
owner spend from them. Use the current exclusive coverage pairs and dashboard
formulas in [Cost Attribution and Dashboarding](COST-ATTRIBUTION.md).

CODEOWNER production uses only successful current-session writes and eligible
immutable session-produced commits. Entry baselines, downloaded changes,
fetch/pull/switch/rebase/reset imports, and merge or cherry-pick alone are
excluded. Resolution is local and uses no provider API or user credentials;
paths, patterns, commands, refs, object IDs, diffs, source content, and email
owners are not metric tags. Read/search ownership is reserved for a later,
separately labeled investigation surface.

PR-specific marker point metrics carry the canonical `session_id` tag, and rows
with a source turn also carry `trajectory.turn_id`. Use PR identity tags only on
PR-specific metrics; broad token, duration, tool, permission, and skill metrics
intentionally do not add PR numbers.

Custom measures can publish under any valid `trajectory.*` or `gen_ai.*` metric
name. If a measure omits `metric:`, Trajectory derives
`trajectory.<scope>.<name>` with hyphens converted to underscores.

## Publish and Serve Health Metrics

Operational counters are best-effort and primarily support rollout health and
privacy/publish diagnostics.

| Metric | Type | Tags | Notes |
|---|---|---|---|
| `trajectory.ops.install.current_state` | gauge | Canonical serve tags plus `managed`, `role`, `outcome`, `reason`, `setup_binary_status`, `setup_binary_version` | Managed setup summary. Current state emits `1`; prior state series are emitted as `0` when the setup state changes so dashboards can filter on the latest active state. |
| `trajectory.ops.install.agent_state` | gauge | Canonical serve tags plus `client_source`, `trajectory.client_source`, `agent_status`, `setup_outcome`, `setup_stage`, `setup_component`, `setup_capture_path`, `setup_next_step`, `reason`, `setup_binary_status`, `setup_binary_version` | Per-integration setup state for every selected client. Distinguishes registration failures from verification failures and degraded fallback paths such as MCP watcher fallback. |
| `trajectory.ops.install.auto_instrument_state` | gauge | Canonical serve tags plus `install_owner`, `managed`, `auto_instrument_enabled`, `apply_enabled`, `allow_clients_configured`, `clients_hooked`, `publish_configured`, `reason` | Managed-host observed auto-instrument readiness. Emits `1` only when the latest durable reconciliation receipt proves at least one detected allowed client is configured, and `0` for a publish-on/instrument-off gap. `ready_with_drift` remains value `1` with an actionable partial-repair warning. |
| `trajectory.ops.agent.present` | gauge | Canonical serve tags plus `client_source`, `trajectory.client_source` | Daily local inventory signal for every supported public coding-agent installation surface. Emits `1` when the client is detected and `0` when absent. Aliases such as `cc` are reported as `claude-code`, while Cursor Desktop and `cursor-agent` share `cursor`. |
| `trajectory.ops.agent.version` | gauge | Canonical serve tags plus `client_source`, `trajectory.client_source`, `client_version`, `trajectory.client_version`, `version_source` | Daily installed-agent freshness signal. Emits `1` for each detected client. `client_version` is the exact CLI-probed semantic version when available and `unknown` otherwise; `version_source` distinguishes a successful probe, missing CLI, failed probe, and unsupported probe. |
| `trajectory.ops.agent.active_sessions` | gauge | Canonical serve tags plus `client_source`, `trajectory.client_source` | Hourly count of fresh active sessions by canonical client source, deduped across concurrent `trajectory serve` processes using per-PID heartbeat sentinels. Emits `0` for known clients with no fresh active sessions. |
| `trajectory.ops.agent.active_session_version` | gauge | Canonical serve tags plus `client_source`, `trajectory.client_source`, `client_version`, `trajectory.client_version`, `version_source` | Hourly active-session count by client version, using captured session-start state from heartbeat sentinels. Missing versions are reported as `client_version:unknown`. |
| `trajectory.ops.cli.command.started` | count | `trajectory.command`, `trajectory.command_class`, `trajectory.invocation_mode`, `trajectory.distribution`, `trajectory.version`, `host`, `os.type`, and metric-catalog tags | One durable count recorded immediately before central CLI dispatch. Export is default-on to managed required Datadog destinations; managed policy can narrow or revoke it. Arguments, paths, session identity, prompts, errors, and arbitrary user tags are never included. |
| `trajectory.ops.mcp.tool.started` | count | `trajectory.mcp_tool`, `trajectory.mcp_tool_class`, `trajectory.mcp_transport`, `trajectory.version`, `host`, `os.type`, and metric-catalog tags | One durable count recorded before a centrally registered MCP tool handler runs. |
| `trajectory.ops.mcp.tool.completed` | count | MCP tool tags plus `trajectory.mcp_outcome` | One durable terminal count classified as `success`, `tool_error`, `handler_error`, `canceled`, or `panic`. |
| `trajectory.ops.mcp.tool.duration_ms` | distribution | MCP tool tags plus `trajectory.mcp_outcome` | Registered handler duration. Completion telemetry preserves the original result, error, cancellation, or panic. MCP lifecycle export is default-on to managed required Datadog destinations; managed policy can narrow or revoke it. Arguments, results, queries, paths, session identity, prompts, errors, credentials, and arbitrary user tags are never included. |
| `trajectory.publish.active_destinations` | gauge | Canonical tags plus top-level and destination tags on DD destinations | Number of active destinations seen for a session |
| `trajectory.ops.required_destination.health` | gauge | Canonical serve tags plus `destination`, `incognito_exempt`, `destination_state` | Three-valued required-destination health: `1` active, `0` a proven gap, and `-1` not provable. Group by destination and state; alert on `0`, not values below `1`. |
| `trajectory.ops.org_sync.success_age_seconds` | gauge | Canonical serve and fleet heartbeat tags plus `verified`, `sync_status`, `failure_reason`, `failure_scope`, `failure_streak` | Seconds since the last observed successful managed-sync pass. `-1` means no observed success. `sync_status` distinguishes healthy, degraded, failing, never, and unverified states; failure tags are bounded and contain no raw errors or paths. |
| `trajectory.publish.turns` | count | OTLP publish path tags | Publish turn counter |
| `trajectory.serve.incognito.enabled` | count | `client_source` | User or tool enabled incognito; intentionally not tagged by session ID; direct agentless OTLP submission |
| `trajectory.serve.process.start_total` | count | `start_source` | Capture server listener started; `start_source:rescue_hook` identifies hook-driven recovery after a dead listener |
| `trajectory.serve.process.exit_total` | count | `exit_reason`, optional `signal` | Capture server observed a graceful or error exit path before publish shutdown; hard kills are inferred from later rescue starts |
| `trajectory.serve.capture.request_error_total` | count | `client`, `event_type`, `error_kind`, `http_status_class` | Capture HTTP request returned 4xx/5xx or hit a handler error |
| `trajectory.serve.operational_log.dropped_total` | count | `reason:queue_full` plus canonical serve tags | Operational events dropped before durable enqueue because the bounded process-local queue was full; emitted on the next owner maintenance pass |
| `trajectory.serve.goroutine.panic_recovered_total` | count | `goroutine`, `action` | Serve background goroutine panic was recovered; `action` is `restart` or `give_up` |
| `trajectory.serve.local_state.live_session_files` | gauge | Canonical serve tags plus `stage`, `warning`, `scan_error` | Count of non-lock live-session projection files found during the local-state health scan |
| `trajectory.serve.local_state.heartbeat_files` | gauge | Canonical serve tags plus `stage`, `warning`, `scan_error` | Count of active-session heartbeat sentinel files found during the local-state health scan |
| `trajectory.serve.local_state.instrumentation_health_records` | gauge | Canonical serve tags plus `stage`, `warning`, `scan_error` | Count of records retained in the rolling local instrumentation-health diagnostic buffer during the local-state health scan |
| `trajectory.serve.local_state.serve_log_bytes` | gauge | Canonical serve tags plus `stage`, `warning`, `scan_error` | Current `trajectory-serve.log` size in bytes at the local-state health scan |
| `trajectory.serve.local_state.serve_diag_bytes` | gauge | Canonical serve tags plus `stage`, `warning`, `scan_error` | Current `serve-diag.ndjson` size in bytes at the local-state health scan |
| `trajectory.serve.local_state.publish_ledger_held_claims` | gauge | Canonical serve tags plus `artifact_scope` | Exact count of publish-ledger claims held past a plausible live publish. `artifact_scope:final_session` is the operator-actionable orphan count; recover with `trajectory publish ledger status` and `trajectory publish ledger repair`. |
| `trajectory.serve.local_state.publish_ledger_held_claims_detail` | gauge | Canonical serve tags plus `artifact_type`, `claim_scope`, `age_bucket`, `hold_reason` | Exact bounded partitions of held claims. Session, claim, destination, and path identities are never tags. |
| `trajectory.serve.terminal_recovery.pending` | gauge | Canonical serve tags plus `feature` | Exact terminal projections still awaiting complete finalization. `feature` is `finalization`, `sensitivity`, or `segmentation`; healthy zero series are emitted. |
| `trajectory.serve.terminal_recovery.pending_detail` | gauge | Canonical serve tags plus `feature`, `reason`, `retry_state` | Actionable bounded partitions of pending terminal recovery. `retry_state` is `ready`, `backoff`, or `exhausted`; session and receipt identities are never tags. |
| `trajectory.serve.terminal_recovery.oldest_age_seconds` | gauge | Canonical serve tags plus `feature` | Age of the oldest pending terminal projection in each feature class. Healthy classes emit `0`. |
| `trajectory.serve.terminal_recovery.attempt_total` | count | Canonical serve tags plus `feature`, `outcome` | A durable same-process terminal recovery attempt, classified as `success` or `failure`. |
| `trajectory.serve.terminal_recovery.success_age_seconds` | gauge | Canonical serve tags plus `feature` | Seconds since the last successful bounded repair. `-1` means the host has not observed a successful automatic repair. |
| `trajectory.serve.historical_replay.failure_total` | count | Canonical serve tags plus `stage`, `reason` | A managed historical replay or repricing step failed, using bounded stage and reason values without raw errors or paths. |
| `trajectory.serve.publish.sensitivity_suppressed` | count | `client_source`, `destination`, `category`, `label` | Sensitive spans dropped for a destination |
| `trajectory.serve.publish.sensitivity_held` | count | `client_source`, `destination`, `reason` | Spans held while classification is pending or unresolved |
| `trajectory.serve.publish.spans_suppressed_total` | count | `client_source`, `destination`, `category`, `label` | Number of spans suppressed by sensitivity policy |
| `trajectory.serve.publish.spans_held_total` | count | `client_source`, `destination` | Number of spans held pending sensitivity classification |
| `trajectory.serve.llm_capacity.calls.total` | count | `feature`, `backend`, `gen_ai.request.model`, `pass`, `cost_source` | Trajectory-owned classifier invocations; `feature` includes `segmentation`, `work_insights_classification`, `sensitivity`, and explicit `user_driven_segmentation` backfill |
| `trajectory.serve.llm_capacity.cost.usd.total` | count | `feature`, `backend`, `gen_ai.request.model`, `pass`, `cost_source` | Estimated USD cost for priced Trajectory-owned background LLM calls |
| `trajectory.serve.llm_capacity.failures.total` | count | `feature`, `pass`, `error_class`, `reason` | Failed Trajectory-owned classifier operations, including durable historical-analysis attempts |
| `trajectory.serve.llm_capacity.format_errors.total` | count | `feature`, `pass`, `error_class`, `reason` | Classifier responses rejected for malformed JSON, schema, or closed-taxonomy validation |
| `trajectory.serve.sensitivity.classifier_unavailable` | count | `client_source`, `reason` | No classifier path was available; rate-limited direct agentless OTLP submission |
| `trajectory.serve.sensitivity.classifier_backend_error` | count | `backend`, `error_class`, `reason`, optional `classifier_agent` | One classifier backend failed before fallback. Tags use bounded remediation categories without paths, models, stderr, or raw errors. |
| `trajectory.serve.segmentation.failure_total` | count | `stage`, `error_class`, `reason` | An incremental, final, or explicitly enabled meta-task segmentation pass failed. `reason` is a bounded remediation category; raw provider errors are never tags. |
| `trajectory.serve.sensitivity.watermark_write_error` | count | `error_class` | Sensitivity watermark write failed |
| `trajectory.serve.sensitivity.watermark_parse_error` | count | `error_class` | Sensitivity watermark read/parse failed |
| `trajectory.serve.sensitivity.sensitivity_held_at_session_end` | count | `reason` | Session ended while sensitivity was still held |

LLM-capacity cost is estimated from prompt/output size and the existing model
pricing table. It is useful for directional spend dashboards, not provider
invoice reconciliation. Calls whose model is not visible or priced still emit
the call count with `cost_source:pricing_unknown`.

Managed setup state uses low-cardinality reason and remediation tags. Use
`setup_stage:registration` when the client setup command failed before writing
or registering assets, `setup_stage:verification` when setup completed but the
installed config is not usable, `setup_stage:fallback` when capture is expected
through a lower-fidelity fallback, and `setup_stage:configured` for a fully
verified integration. `setup_component` identifies the failed surface, such as
`mcp_config`, `hooks_config`, `plugin_marketplace`, `plugin_install`,
`wrapper_metadata`, `client_runtime`, or `sdk_extension`. `setup_next_step`
contains a bounded remediation code such as `rerun_setup_client`,
`install_client_then_rerun_setup`, `fix_permissions_then_rerun_setup`,
`install_node_or_reinstall_client`, or
`ensure_trajectory_bin_first_on_path`.

## Claude Native OTLP Metrics

`trajectory serve` accepts Claude Code native OTLP metrics on `/v1/metrics`.
When `server.otlp_proxy.endpoint` is configured, it decorates metric datapoints
with canonical Trajectory identity tags plus
`trajectory.cost_role:client_telemetry`,
`trajectory.cost_source:claude_native_otlp`, and the bounded cost-overlap
vocabulary above before forwarding to the upstream collector. It returns
success to Claude even if enrichment or the upstream request fails; when
enrichment fails, the original payload is forwarded unchanged.

The serve-level forwarder preserves native client metric values while adding
bounded identity and cost-overlap tags. It does not correct or drop native
datapoints, infer usage completeness from arbitrary OTLP batches, or turn
missing/unknown model evidence into session-scoped proxy counters. Usage and
model fidelity are owned by the durable capture, ingest, and cost-attribution
paths described below.

Datadog validation for Trajectory-owned metrics should use
`trajectory publish metrics audit --readback` or `--readback-all`. Native
client telemetry forwarded through `server.otlp_proxy` is not reconstructed
from the local metric outbox; validate it in Datadog by filtering or grouping
on `trajectory.cost_role:client_telemetry`,
`trajectory.cost_source:claude_native_otlp`, and
`trajectory.cost_dedupe_group`.
For local pre-Datadog evidence, set `server.otlp_proxy.capture_enabled: true`
or `TRAJECTORY_OTLP_PROXY_CAPTURE_ENABLED=1` and run:

```bash
trajectory otlp metrics compare --session <session-id>
```

That command reads normalized records from
`~/.trajectory/state/otlp-proxy/metrics/` and reports whether inbound native
OTLP datapoint values were preserved after Trajectory enrichment, which tags
were added, and which cost stream should be displayed for attribution versus
client-telemetry comparison.

| Metric | Type | Notes |
|---|---|---|
| `claude_code.token.usage` | sum | Forwarded Claude Code token usage, enriched with session tags |
| `claude_code.cost.usage` | sum/gauge | Forwarded Claude Code cost usage with its native datapoint value preserved and Trajectory source-selection tags added |

The legacy session-proxy counters
`trajectory.companion.usage_data_missing` and
`trajectory.companion.unknown_model` are retired. Their useful diagnostic
cases now have bounded owners in the canonical pipeline:

- a present but unrecognized cost model contributes to
  `trajectory.session.cost.unpriced_turns{trajectory.cost_reason:model_mismatch}`;
  an absent model uses `trajectory.cost_reason:model_missing`;
- Claude transcript usage that is still absent after the reconciliation window
  emits `trajectory.instrumentation.derivation.fallback{reason:transcript_usage_missing}`;
- a turn that reaches the final content-estimation fallback emits
  `trajectory.instrumentation.derivation.fallback{reason:estimated_last_resort}`;
- a completed turn whose usage remains absent after reconciliation and
  estimation emits
  `trajectory.instrumentation.capture.gap{reason:usage_missing}` and is stored
  with `tokens_status=missing`;
- a provider rollout observed by a scoped watcher but rejected by its project
  filter emits `trajectory.instrumentation.capture.gap{component:serve,client_source:codex,signal:jsonl,reason:scope_filtered}`;
- if that excluded rollout later contains a native `token_count` record,
  Trajectory emits the same metric with `reason:usage_unregistered`. This is
  source evidence that provider usage existed without a canonical registration;
  it is a bounded gap count, not a token or cost value.
- eligible Cursor generations without terminal token usage contribute to
  `trajectory.cursor.token_capture.turns_total{status:missing}`.

The missing-usage signals describe a failed expected derivation path. They do
not fire for an explicit zero or for clients and events that do not promise
provider usage. In live `trajectory serve`, the last-resort fallback is routed
through the publish engine; standalone ingest retains the bounded local
instrumentation-health record.

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
| `trajectory.instrumentation.derivation.fallback` | count |
| `trajectory.instrumentation.derivation.correction` | count |
| `trajectory.instrumentation.privacy.gate` | count |
| `trajectory.instrumentation.marker.evaluation` | count |
| `trajectory.instrumentation.marker.evaluation_latency_ms` | distribution |
| `trajectory.instrumentation.watchdog.gap_detected` | count |
| `trajectory.instrumentation.health.spool_depth` | gauge |
| `trajectory.instrumentation.health.emit_dropped` | count |
| `trajectory.instrumentation.runtime_reconcile.attempt` | count |
| `trajectory.instrumentation.runtime_reconcile.duration_ms` | distribution |
| `trajectory.instrumentation.lifecycle.incident` | count |

The catalog lists production-backed metrics. Earlier placeholders without a
production producer are not part of the current inventory.

On 0.5.31 and later, marker evaluation distinguishes missing tables, missing
columns, other schema mismatches, unavailable local storage, canceled contexts,
invalid marker configuration, and internal evaluator fallback. Publish failures
likewise distinguish cancellation, serialization failure, and internal publish
failure. These are bounded reason values; raw errors, responses, paths, and
content are excluded from tags.

### Managed cost-fidelity heartbeat

The following metrics are emitted only when both the managed-only
`cost_fidelity_heartbeat` feature and its separate managed aggregate-export
policy are enabled for a named cohort:

| Metric | Type | Bounded tags |
|---|---|---|
| `trajectory.instrumentation.fidelity.cost_audit.run` | count | `outcome`, `reason` |
| `trajectory.instrumentation.fidelity.cost_audit.native_to_capture.session` | count | `client_source`, `outcome`, `reason` |
| `trajectory.instrumentation.fidelity.cost_audit.capture_to_outbox.session` | count | `client_source`, `outcome`, `reason` |
| `trajectory.instrumentation.fidelity.cost_audit.delivery.session` | count | `client_source`, `outcome`, `reason` |

These are reconciliation counts, not usage or cost. Never add the three leg
metrics together as a session denominator. Compute coverage and fidelity for
one leg at a time. The payload contains no user, email, session, model,
repository, project, path, prompt, response, diff, binary version, host, or USD
value. `client_source`, `outcome`, and `reason` use fixed catalogs; unknowns
collapse to `other`. A local day with fewer than 10 eligible sessions emits
only `cost_audit.run{outcome:skipped,reason:insufficient_cohort}`. Sparse split
cells are collapsed and then suppressed if they remain below 10.

The heartbeat covers only the immediately previous fully closed UTC day after
activation, with settle lag and installation-local jitter. It never publishes
historical metrics, catches up missed days, or reads a full transcript corpus.
It accepts only terminal compatible-v2 attribution rows, explicit public or
internal sensitivity watermarks, non-incognito/non-estimated/non-control-plane
receipts, and direct per-session indexes. Missing evidence is ineligible.
Only managed required destinations participate; project destinations are not
audited or exported. Local export is write-only and does not resolve an
application key. The centrally operated dashboard contract owns readback and
query conformance.

Every day is frozen as one immutable local snapshot before network submission,
including its complete bounded cell set and all managed export destinations.
Generic metric-outbox drains exclude heartbeat rows; retry requires the exact
period identity. Trajectory reloads managed authorization before freezing and
before each destination. If authorization is revoked, unsent rows are dropped.
If a destination is partial, the day remains incomplete and only its frozen
rows may retry; evidence from a later audit cannot be added. Unsent older-day
rows are dropped at rollover and never publish after re-enable.

Candidate and evidence reads are indexed and bounded by session count, total
bytes, per-session bytes, and outbox rows. All receipt, watermark, sidecar,
session, native, and selected outbox evidence counts toward those budgets.
Budget exhaustion emits only the bounded `budget_exceeded` run metric when
export remains authorized. Missing or stale sensitivity watermarks exclude the
affected sessions; when that leaves fewer than 10 eligible sessions, the only
export is the `insufficient_cohort` run metric. With managed export disabled,
there is no remote heartbeat.

`trajectory.instrumentation.health.spool_depth` is emitted as a remote-only
gauge with bounded `component`, `signal`, and `reason` tags. The legacy metric
name reports occupancy of the rolling local diagnostic buffer; reaching its
bounded capacity is normal because producers compact the oldest half and keep
the newest records. The gauge intentionally does not append to that buffer.
When a health record cannot be sanitized or the rolling-buffer write fails,
`trajectory.instrumentation.health.emit_dropped` emits a remote-only count with
bounded `component`, `signal`, `error_class`, and `reason` tags.

Autonomous managed-post-install, MCP-startup, serve-owner-startup, and
background-update repair attempts emit
`trajectory.instrumentation.runtime_reconcile.attempt` and
`trajectory.instrumentation.runtime_reconcile.duration_ms`. Their tags are the
finite `trigger`, top-level `result_status`, `process_status`, `outcome`, and
`reason` catalogs plus fixed component/signal values. They contain no path,
PID, session identity, plugin output, or error text. An active owner reports
`process_status:active_sessions_deferred`; a later automatic retry reports the
eventual replacement outcome separately.

When a reconcile attempt identifies a lifecycle failure or safe deferral,
`trajectory.instrumentation.lifecycle.incident` emits one count. Its bounded
`reason`, `component`, `signal`, `trigger`, and `outcome` tags support fleet
diagnosis without host-local paths, PIDs, session identity, raw errors, or user
content. Counts represent incidents or attempts, not unique affected users.

### Fleet update heartbeat

The elected serve owner emits these gauges no more than once per hour through
the normal metrics-enabled Datadog destination path:

| Metric | Value | Bounded tags |
|---|---|---|
| `trajectory.ops.process.heartbeat` | Fresh running Trajectory process count for the version on this host | `role`, `owner`, `managed`, `cohort`, `version` |
| `trajectory.ops.binary.heartbeat` | Fresh running count, or `1` for the installed/desired state | `role`, `owner`, `managed`, `cohort`, `binary_state`, `version` |
| `trajectory.ops.convergence.heartbeat` | `1` for the current host convergence state | `role`, `owner`, `managed`, `cohort`, `convergence_status`, `manifest_status`, `running_version`, `installed_version`, `desired_version`, `deployment_generation`, `deployment_action` |

`convergence_status` is `converged`, `binary_pending`, `activation_pending`,
`paused`, `manifest_invalid`, `unmanaged`, or `unknown`. `manifest_status`
distinguishes an absent managed policy from a present or invalid one, so a bad
org-config deployment cannot look like an unmanaged host. Version values are sanitized and bounded; the
metrics contain no PID, session, path, user, or rollout-episode identity. Use
gauge queries with an hourly `max` rollup over at least four hours. Do not use
`.as_count()`, which turns repeated gauge samples into false population growth.


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

For authoritative live cost and cohort usage after the v2 cutover, use:

```text
sum:trajectory.turn.cost.usd.additive{trajectory.cost_contract:v2,trajectory.cost_role:attribution,...}.as_count()
```

The positive contract filter excludes polluted legacy series without trying to
rewrite them. The `.additive` COUNT series is the correction and backfill
surface; any historical publish must come from a reconciled, explicitly
approved correction set. Datadog historical-metrics correction does not replace
distribution samples, so old distribution points remain legacy/unverified and
must not be mixed into totals. `trajectory.session.cost.usd.total`
is a completed-session final sample and should be used for final-session
percentiles or averages, not for counting active sessions or estimating
in-progress spend.

For three turns costing `$2`, `$3`, and `$1`, the additive stream receives
three deltas and `sum:...as_count()` returns `$6`; the distribution receives
the same three observations for percentile analysis. The cumulative session values would be
`[$2, $5, $6]`; those belong to
`trajectory.session.cost.usd.accumulated` and must not be summed across time.
The unsuffixed turn-cost gauge exists for latest-value inspection and backwards
compatibility. It does not add a second source of cost and should not be added to
either the additive total or the distribution.

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

Treat `repo` as a grouping label, not proof of Git identity. Repository
attribution first uses a bounded absolute Git command so global includes and
`url.*.insteadOf` rewrites retain canonical Git semantics. If Git is missing or
refuses the directory, Trajectory reads bounded local `.git` metadata without
requiring Git on `PATH`. It selects `origin`, then the current branch's upstream
remote, then a sole unambiguous remote. Normal repositories, nested working
directories, gitdir files, linked worktrees, submodules, and bare repositories
are supported. Project publish trust remains separately command-backed and
fail-closed on Git ownership/safe-directory checks; successful metadata
attribution alone never activates a project publish configuration.

For repository dashboards that should only include parsed remotes, filter
`trajectory.repo_source:git_origin`. Use `trajectory.repo_source:project_dir`
to audit fallback coverage, `trajectory.repo_source:configured` for custom
config tags, and `trajectory.repo_source:unknown` when no usable project
directory or remote was available. `git_origin_unparsed` means Trajectory found
a Git origin host and path, but could not split the path into both owner and
repo. `git_remote` means attribution came from the current branch upstream or
the sole unambiguous non-origin remote.

`trajectory.repo.resolution.total` emits once per completed session and is the
only metric carrying `trajectory.repo_resolution`; the dimension is never
copied onto normal base metrics. Success values are `metadata_origin`,
`metadata_upstream`, `metadata_sole_remote`, `command_origin`,
`command_upstream`, or `command_sole_remote`. `cache_fallback` covers a missing
in-memory session attribution cache. Failure values are bounded to
project-directory, metadata, command, missing, ambiguous, or unparseable
categories. Paths, remote names, URLs, credentials, and raw errors are never
emitted.

The session-end retry can improve final session metrics when a repository or
remote is created after session start. It does not rewrite already-emitted turn
points or historical Datadog series. Existing backfill/dedup behavior is
unchanged. Historical metric backfill does not retroactively recompute or repair
repository-owner attribution in this change; backfill parity requires separate
deduplication design so corrected labels do not create duplicate historical
series.

Dashboard templates should default `repo_source` filters to `*` while a fleet is
rolling forward to a binary that emits `trajectory.repo_source`; otherwise the
filter can hide valid recent data whose older series do not yet carry the tag.
Use a dedicated provenance widget to watch `trajectory.repo_source` coverage,
then apply `git_origin` filters only on widgets that explicitly need Git remote
identity.

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
