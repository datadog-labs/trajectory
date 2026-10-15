# Datadog LLM Obs Span Tags

This page lists the tags on the spans that Trajectory sends through Datadog LLM
Observability. Local-ui and Lapdog spans copy that transport and use the same
tags.

## Base Tags

Every LLM Obs span carries these base tags when Trajectory has the source
field. Identity tags always appear, with a fallback value when needed. Context
tags appear only when the source data exists. Trajectory does not invent them.

| Tag | Presence | Source | Notes |
| --- | --- | --- | --- |
| `ml_app` | Required | Destination config or default | Defaults to `coding-agents`. |
| `service` | Required | Destination config or default | Defaults to `coding-agents`. |
| `trajectory.version` | Required | Trajectory binary version | Falls back to `dev`. |
| `host` | Required | Host lookup in the publish engine | Falls back to `unknown`. It is only a tag. It does not create a Datadog host resource. |
| `trajectory.format_version` | Optional | `session_start.format_version` | Present when capture records a format version. |
| `gen_ai.request.model` | Optional | Captured model or publish metadata | The raw model label. It matches the label on metrics, so queries line up. |
| `trajectory.client_source` | Optional | `session_start.client_source` | Examples: `codex`, `claude-code`, `gemini`, `agy`, `goose`. |
| `trajectory.account_billing_mode` | Conditional | Local client account metadata | `subscription`, `usage_based`, or `free`. It describes the kind of account. It does not turn API-equivalent cost into billed spend. |
| `trajectory.account_plan_type` | Conditional | Local client account metadata | A plan label from a fixed list, such as `max`, `pro`, or `enterprise`. Unknown values are left out. |
| `trajectory.account_billing_source` | Conditional | Local client account metadata | `claude_oauth_account`, `codex_auth_mode`, `codex_rate_limits`, or `cursor_membership_cache`. ChatGPT sign-in alone does not count as a paid plan. Trajectory reads no credentials or account identity into telemetry. |
| `trajectory.client_version` | Optional | Captured client or harness version | The coding agent's version, when the client reports one. |
| `trajectory.app_version` | Optional | Captured version of the desktop app around the client | Present for desktop sessions that Trajectory can match to an app. Left out for CLI and SDK sessions and for app bundles it cannot identify. |
| `project_dir` | Optional | Captured or cached project directory | Base name only. Full paths stay out of tags. |
| `trajectory.capture_level` | Optional | Capture or export level | Examples: `minimal`, `standard`, `full`. |
| `env` | Optional | Destination config or local-ui default | Spans that local-ui builds use `prod`. |
| `trajectory.user` | Optional | Resolved local user | Added when Trajectory resolves the user. |
| `trajectory.user_email` | Optional | Resolved local user email | Added when available. |
| `git.email` | Optional | Resolved Git email | Added when available. |
| `github.username` | Optional | Resolved GitHub identity | Added when available. |
| `trajectory.provider` | Conditional | Captured cost-overlap data | Sent when Trajectory classifies the Anthropic route for Claude Code, and for Codex sessions Trajectory launched through its AI gateway or Frontier. |
| `trajectory.provider_route` | Conditional | Captured cost-overlap data | Values include `direct`, `llm_gateway`, `bedrock`, `vertex`, `foundry`, `unknown`, and `mixed`. |
| `trajectory.provider_cost_visibility` | Conditional | Captured cost-overlap data | Where provider, gateway, or cloud billing tools would likely see the same spend. |
| `trajectory.cost_overlap_risk` | Conditional | Captured cost-overlap data | Values include `possible`, `aggregate_only`, `unknown`, and `mixed`. |
| `trajectory.cost_overlap_signal` | Conditional | Captured cost-overlap data | Where the signal came from, with no sensitive data. Examples: `trajectory_launch`, `session_env`, `claude_settings`, `none`, or `mixed`. |
| `trajectory.cost_role` | Conditional | Captured cost-overlap data | Trajectory span metadata uses `attribution`. Native client metrics that pass through the proxy use `client_telemetry`. |
| `trajectory.cost_dedupe_group` | Conditional | Captured cost-overlap data | A stable provider and route group, such as `anthropic:direct`, `anthropic:llm_gateway`, or `anthropic:mixed`. |
| `trajectory.cost_dedupe_confidence` | Conditional | Captured cost-overlap data | Values include `high`, `medium`, `low`, and `mixed`. |
| `trajectory.token_source` | Conditional | Where the turn's token counts came from | For Cursor native turns, the values are `cursor_hook_turn_ended` or `cursoragent_watcher`. Trajectory does not guess a missing source. |
| `trajectory.token_fidelity` | Conditional | Where the turn's token counts came from | Cursor native final totals use `native_turn_aggregate`. The watcher fallback uses `transcript_fallback`. |
| `trajectory.token_correlation` | Conditional | Where the turn's token counts came from | `exact_generation_id` means the model and the four token counts all match the same Cursor generation. |
| `token_usage_provenance` (metadata) | Conditional | Where the turn's token counts came from | A span metadata key, not a tag. The source sets the value. Examples: `provider_native`, `provider_reported`, `native_session_aggregate`, or `provider_session_aggregate_unattributed`. |
| `trajectory.cost_status` | Conditional | `cost_attribution` decision | `priced`, `unpriced`, `unavailable`, or `invalid`. An unpriced decision never becomes a zero cost. |
| `trajectory.pricing_source` | Conditional | `cost_attribution` decision | One source from a fixed list: provider, organization, local, public, client telemetry, or turn ledger. |
| `trajectory.cost_method` | Conditional | `cost_attribution` decision | For Cursor token pricing, the value is `four_component_token_rate_card`. |
| `trajectory.cost_fidelity` | Conditional | `cost_attribution` decision | Includes `token_derived` and `unpriced`. It is separate from token fidelity. |
| `trajectory.cost_basis` | Conditional | `cost_attribution` decision | What the cost means, such as `gross_model_cost` or `usage_economic_cost`. It does not say how closely the cost matches an invoice. |
| `trajectory.pricing_unit` | Conditional | `cost_attribution` decision | Cursor native rate cards use `tokens`. |
| `trajectory.pricing_version` | Conditional | `cost_attribution` decision | A short value that is safe for metrics. The full custom version stays in span metadata. |

Publish destinations can also add global tags and destination tags from
config. Those tags belong to each destination. They are not part of the base
tags.

Cost-overlap tags are base tags because they say how to read captured cost in
every transport. They never hold raw provider URLs, headers, helper commands,
API keys, account IDs, or org IDs. Older Claude Code spans can lack captured
route data. For them, Trajectory sends `unknown` as the fallback value. It
does not invent a direct or gateway route.

Account-billing tags are separate. Usage on a subscription keeps the same
API-equivalent USD cost. Dashboards can then label it as included usage or
avoided spend. They should not show it as an amount billed to the user. For
guidance on using these tags in Agent Console and dashboards, see
[`COST-OVERLAP-CONSUMER-GUIDE.md`](COST-OVERLAP-CONSUMER-GUIDE.md).

Span metadata also keeps detailed Cursor cost data under `cost_attribution.*`.
It includes the rate card, version, checksum, and effective dates. It also
includes the quantity and rate for each of the four token types. Generation
IDs, rates, and checksums are never metric tags.

## Trace Tags

Trajectory publishes two trace types: turn traces and automated oversight
traces. `trajectory.trace_type` names the trace type. Do not infer the type
from the parent and child structure alone.

| Trace | Spans | Required trace tags |
| --- | --- | --- |
| Turn | Turn root, plus inference, tool, and LLM children | `trajectory.trace_type:turn`, `trajectory.session_id:<session_id>` |
| Automated oversight | One summary span. In `full` mode, also a separate reviewer trace. | `trajectory.trace_type:oversight`, `trajectory.oversight.kind:<kind>`, `trajectory.oversight.outcome:<outcome>`, `trajectory.oversight.linked:<bool>` |

Turn traces and full reviewer traces can have real child spans. An oversight
summary trace links to the related traces. It must not copy their spans.
Trajectory no longer sends client-side task traces or session-index traces.

## Span-Specific Tags

| Span type | Required and extra tags | Notes |
| --- | --- | --- |
| Turn root | `trajectory.semantic_type:turn`, `trajectory.session_id:<session_id>`, optional `gen_ai.request.reasoning_effort:<effort>` | The root of a turn trace. Trajectory reads the reasoning effort from the provider record, including known Cursor model suffixes. It is left out when not available. A completed turn with one stored primary PR assignment also carries the PR-work fields listed below. |
| Agent message or inference | `trajectory.semantic_type:agent_message`, `trajectory.session_id:<session_id>` | Display names can be `inference-0`, `inference-1`, and so on. |
| Tool | `trajectory.session_id:<session_id>` | The parent is the agent-message span that made the call, when known. Otherwise the parent is the turn root. |
| Real LLM call | `trajectory.session_id:<session_id>`, `trajectory.llm_call:true`, optional `trajectory.cost_source:<source>` | Used for captured LLM calls that Trajectory owns. When known, the cost source tells native totals apart from rate-card prices. |
| Synthetic LLM span for turn usage | `trajectory.session_id:<session_id>`, `trajectory.placeholder_llm_span:true`, `trajectory.llm_span_role:turn_usage_carrier` | Carries the turn's token and cost totals when no real provider call span exists. At `standard` and `full`, its input and output repeat the parent turn's content, marked as a total. At `minimal`, it has no content. It does not stand for a separate provider request. |
| Compaction or correlation | `trajectory.semantic_type:compaction`, `trajectory.trace_correlation.session_id:<session_id>` | Used for compaction spans and spans that link sessions. |
| Claude tool with native permission timing | `permission_decision:<accept\|reject\|...>`, `permission_source:<user\|config\|hook\|...>` | Added to the tool span only when Claude recorded a permission decision. Metadata adds `permission_wait_ms`, `execution_ms`, `native_trace_id`, and `native_span_id`. When present, it also adds `permission_source_detail`, for example `user_permanent`. That value never becomes a tag. |
| Permission wait | `trajectory.semantic_type:permission_wait`, `trajectory.session_id:<session_id>`, and the two permission tags | A `task` child of its tool span, named `permission-wait`. It has no metrics and no input. |

A captured call with no turn ID is exported only when its request start time
falls in one observed turn. A call with missing timing, or with a time of zero
or less, stays local. The older interceptor's clock has an uncertainty of one
millisecond on each side of the inferred start. The whole range must fit in
the same turn. Proxy epoch times keep their exact start.

For resumed turns, Trajectory compares turn IDs as strings or numbers. It also
checks separately that numeric IDs only move forward. The time a call arrives
in capture, and the current turn counter, do not show which turn sent the
request.

Trajectory builds a real call's span ID from these values:

- the session identity
- the turn
- the call's position after sorting, starting at zero
- the request start time in nanoseconds

Calls are sorted by start time, then by sequence number when one exists. Ties
keep their input order. So adding an earlier call can change the IDs of later
calls.

A span with a semantic event name can also carry
`trajectory.semantic_name:<name>`.

Trajectory keeps Claude assistant text up to a byte limit and never splits a
UTF-8 character. An agent-message step whose text reached that limit carries
`output_truncated:true`. When that message supplies the turn output, the turn
root and the synthetic turn-usage span repeat the marker. A matching, longer
`turn_end` response can restore more of the same output. The marker stays
set. A transcript correction that differs from the live text takes priority.

Local task-insight rows keep their checked labels and Work Insights
categories for metrics and local analysis. Trajectory does not send them as
task traces or session-index traces.

A completed turn root can have exactly one clear PR-work assignment stored in
the local database. Then it carries these fields:

- `change_host`
- `owner`
- `repo`
- `change_number`
- `context_source`
- `work_context_mode`
- `identity_confidence`
- `local_range_status`

These fields come from local command data and limited Git state. They leave
out commands, paths, refs, URLs, and object IDs. They appear only on the root.
Child LLM, inference, and tool spans do not repeat the assignment.

A PR can be created after the work it covers. Trajectory can then finalize an
earlier `creation_window` context. It sets `retroactive_membership:true` on the
managed `pr_attribution` v2 record for that context. It does not change or
resend turn-root spans that Datadog accepted before the PR was known. To see
work added to a PR after the fact, use the finalized record and the metrics.

## Tags and Metadata Below `standard`

A destination at `level: minimal` gets only structural tags, metadata keys,
and span-link attributes. Trajectory keeps an item only when it is on the
structural list and its value passes the check listed with it.

Structural values are identifiers, numbers, times, states, and the names that
a `minimal` span keeps. A name is one token. A model or provider name is the
exception. It can be a display name of a few words, such as `Claude Opus 4.7`
or `Amazon Bedrock`.

Captured text is never kept. Captured text includes a prompt, a result, an
error message, or a title. Tags set in configuration are also kept. Trajectory
drops everything else before the span reaches the destination's exporter. So
a new tag or metadata key is not sent at `minimal` until it is on the list.

At `minimal`, Trajectory keeps the `project_dir` metadata value only in these
forms:

- an absolute path
- a path under the home directory (`~` or `~/...`)
- a UNC path, such as `\\server\share\repo`

A value such as `~name` or `~name/src` is dropped. The `project_dir` tag is
kept when it is a single path segment. So a base name such as `~name` is still
sent.

The [trace levels](PUBLISH.md#trace-levels)
section of the user guide says what a `minimal` span carries.

## Local-UI Parity

Local-ui and Lapdog get spans from two sources:

- **Live local EVP forwarding** maps spans to LLM Obs payloads with the same
  base metadata options as published spans. If an accepted live span already
  sets its identity, Trajectory keeps it. The `ml_app` of the configured
  Trajectory destination must not relabel an application that has its own
  instrumentation.
- **Spans built from SQLite** keep the same stable identity and trace tags
  when the cache has the source fields. Optional fields, such as
  `trajectory.client_version` and `project_dir`, appear only when the local
  materialized data has them. Cost-overlap tags use turn-level cache columns
  first, then session-level columns. Older caches without route data use the
  `unknown` fallback values for Claude Code.
- **Stored PR-work fields** apply the same way to completed turn roots in all
  three paths: cloud publishing, live local EVP, and spans rebuilt from SQLite.
  So the Lapdog list, trace, fetch, filter, group, facet, and cardinality views
  show the same assignment. Child spans stay without these tags.

This page is the reference for fields that appear in both Datadog and
local-ui. Published spans and local-ui spans carry the same common tags when
both have the source data.
