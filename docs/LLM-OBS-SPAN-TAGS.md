# Datadog LLM Obs Span Tags

This document defines the tag contract for Trajectory spans emitted through the
Datadog LLM Observability transport and for local-ui/Lapdog spans that mirror
that transport.

## Base Tags

Every LLM Obs span should carry these base tags when the corresponding source
field is available. Identity tags always emit with fallbacks; context tags stay
conditional so missing source data does not invent false attribution.

| Tag | Presence | Source | Notes |
| --- | --- | --- | --- |
| `ml_app` | Required | Destination config or default | Defaults to `coding-agents`. |
| `service` | Required | Destination config or default | Defaults to `coding-agents`. |
| `trajectory.version` | Required | Trajectory binary version | Falls back to `dev`. |
| `host` | Required | Publish engine host lookup | Falls back to `unknown`. This is a tag only, not a Datadog host resource. |
| `trajectory.format_version` | Optional | `session_start.format_version` | Present when capture records a format version. |
| `gen_ai.request.model` | Optional | Captured model or publish metadata | Raw model label used for query and metric parity. |
| `trajectory.client_source` | Optional | `session_start.client_source` | Examples: `codex`, `claude-code`, `gemini`, `agy`, `goose`. |
| `trajectory.client_version` | Optional | Captured client or harness version | Coding-agent version when the client reports one. |
| `project_dir` | Optional | Captured or cached project directory | Basename only; full paths stay out of tags. |
| `trajectory.capture_level` | Optional | Capture/export level | Examples: `minimal`, `standard`, `full`. |
| `env` | Optional | Destination config or local-ui default | Local-ui synthesized spans use `prod`. |
| `trajectory.user` | Optional | Resolved local user | Applied when identity resolution succeeds. |
| `trajectory.user_email` | Optional | Resolved local user email | Applied when available. |
| `git.email` | Optional | Resolved Git email identity | Applied when available. |
| `github.username` | Optional | Resolved GitHub identity | Applied when available. |
| `trajectory.provider` | Conditional | Captured cost-overlap evidence | Currently emitted for Claude Code Anthropic route classification. |
| `trajectory.provider_route` | Conditional | Captured cost-overlap evidence | Values include `direct`, `llm_gateway`, `bedrock`, `vertex`, `foundry`, `unknown`, and `mixed`. |
| `trajectory.provider_cost_visibility` | Conditional | Captured cost-overlap evidence | Where overlapping provider, gateway, or cloud billing analytics would likely see the same spend. |
| `trajectory.cost_overlap_risk` | Conditional | Captured cost-overlap evidence | Values include `possible`, `aggregate_only`, `unknown`, and `mixed`. |
| `trajectory.cost_overlap_signal` | Conditional | Captured cost-overlap evidence | Non-sensitive signal source such as `session_env`, `claude_settings`, `none`, or `mixed`. |
| `trajectory.cost_role` | Conditional | Captured cost-overlap evidence | Trajectory span metadata uses `attribution`; proxied native client metrics use `client_telemetry`. |
| `trajectory.cost_dedupe_group` | Conditional | Captured cost-overlap evidence | Stable provider/route bucket such as `anthropic:direct`, `anthropic:llm_gateway`, or `anthropic:mixed`. |
| `trajectory.cost_dedupe_confidence` | Conditional | Captured cost-overlap evidence | Values include `high`, `medium`, `low`, and `mixed`. |
| `trajectory.token_source` | Conditional | Captured turn token provenance | For Cursor native turns, values distinguish `cursor_hook_turn_ended` from `cursoragent_watcher`; missing provenance is not inferred. |
| `trajectory.token_fidelity` | Conditional | Captured turn token provenance | Cursor native terminal aggregates use `native_turn_aggregate`; watcher fallback remains `transcript_fallback`. |
| `trajectory.token_correlation` | Conditional | Captured turn token provenance | `exact_generation_id` means model and token quartet were correlated to the same Cursor generation. |
| `trajectory.token_usage_provenance` | Conditional | Captured turn token provenance | Distinguishes `provider_native` from lower-fidelity fallback observations. |
| `trajectory.cost_status` | Conditional | Explicit `cost_attribution` decision | `priced`, `unpriced`, `unavailable`, or `invalid`; an unpriced decision never becomes numeric zero. |
| `trajectory.pricing_source` | Conditional | Explicit `cost_attribution` decision | Bounded provider, organization, local, public, client-telemetry, or turn-ledger source. |
| `trajectory.cost_method` | Conditional | Explicit `cost_attribution` decision | For Cursor token pricing this is `four_component_token_rate_card`. |
| `trajectory.cost_fidelity` | Conditional | Explicit `cost_attribution` decision | Includes `token_derived` and `unpriced`; this is independent of token fidelity. |
| `trajectory.cost_basis` | Conditional | Explicit `cost_attribution` decision | Economic interpretation such as `gross_model_cost` or `usage_economic_cost`; it is not invoice fidelity. |
| `trajectory.pricing_unit` | Conditional | Explicit `cost_attribution` decision | Cursor native rate cards use `tokens`. |
| `trajectory.pricing_version` | Conditional | Explicit `cost_attribution` decision | Metric-safe bounded value; exact custom version remains in span metadata. |

Publish destinations may also add configured global tags and destination tags.
Those tags are destination-specific and are not part of the transport base
contract.

Cost-overlap tags are base metadata because they describe how captured cost
should be interpreted across transports. They are not raw provider URLs,
headers, helper commands, API keys, account IDs, or org IDs. When historical
Claude Code spans do not have captured route evidence, Trajectory emits bounded
`unknown` fallback values rather than inventing a direct or gateway route.
For dashboard consumption guidance, see
[COST-OVERLAP-CONSUMER-GUIDE.md](COST-OVERLAP-CONSUMER-GUIDE.md).

## Trace Tags

Trajectory publishes four trace types. `trajectory.trace_type` identifies the
trace topology and must not be inferred from parent-child shape alone.

| Trace | Spans | Required trace tags |
| --- | --- | --- |
| Turn | Turn root plus inference/tool/LLM children | `trajectory.trace_type:turn`, `trajectory.session_id:<session_id>` |
| Task | One standalone task span | `trajectory.trace_type:task`, `trajectory.session_id:<session_id>`, `task_id:<task_id>`, `trajectory.task.turn_start:<n>`, `trajectory.task.turn_end:<n>` |
| Automated oversight | One summary span, plus an optional separate reviewer trace in `full` mode | `trajectory.trace_type:oversight`, `trajectory.oversight.kind:<kind>`, `trajectory.oversight.outcome:<outcome>`, `trajectory.oversight.linked:<bool>` |
| Session | One standalone session span | `trajectory.trace_type:session`, `trajectory.trace_correlation.session_id:<session_id>` |

Turn traces and full automated-oversight reviewer traces may have real child
spans. Oversight summary, task, and session traces link to lower-level or
correlated traces with span links and must not duplicate those spans.

## Span-Specific Tags

| Span class | Required/additional tags | Notes |
| --- | --- | --- |
| Turn root | `trajectory.semantic_type:turn`, `trajectory.session_id:<session_id>` | Root of a turn trace. |
| Agent message / inference | `trajectory.semantic_type:agent_message`, `trajectory.session_id:<session_id>` | Display names may be `inference-0`, `inference-1`, etc. |
| Tool | `trajectory.session_id:<session_id>` | Parent is the claiming agent-message span when known, otherwise the turn root. |
| Real LLM call | `trajectory.session_id:<session_id>`, `trajectory.llm_call:true` | Used for captured Trajectory-owned LLM calls. |
| Synthetic LLM cost span | `trajectory.session_id:<session_id>` | May also carry `trajectory.cost_source:turn_metrics` when derived from turn totals. |
| Task | `trajectory.semantic_type:task`, `trajectory.session_id:<session_id>`, `task_id:<task_id>`, `task_type:<type>`, `outcome_label:<label>` | Standalone span. The privacy-reduced task-insights family omits turn links when `export.turn_traces` is false and carries Work Insights Level 1/Level 2 tags when available. |
| Session | `trajectory.semantic_type:session`, `trajectory.trace_correlation.session_id:<session_id>` | Standalone span with task or turn span links. |
| Compaction/correlation | `trajectory.semantic_type:compaction`, `trajectory.trace_correlation.session_id:<session_id>` | Used for compaction or cross-session correlation spans. |

When a span has a semantic event name, it may also carry
`trajectory.semantic_name:<name>`.

Privacy-reduced task-insight roots use the validated task label as the span
name and retain the closed Work Insights taxonomy, task scores, opaque
session/task identity, and exact start/end turns. They exclude the raw task
goal, evidence, transcript, project path, host identity, user/email identity,
provider route, and cost-deduplication identity.

Completed turn roots with one unambiguous durable PR-work assignment carry
`change_host`, `owner`, `repo`, `change_number`, `context_source`,
`work_context_mode`, `identity_confidence`, and `local_range_status`. These
fields come from local command evidence and bounded Git state; they exclude
commands, paths, refs, URLs, and object IDs. They are root-only: child LLM,
inference, and tool spans do not duplicate the assignment.

Turn roots with eligible production ownership also carry up to five repeated
`trajectory.codeowner:<normalized-owner>` values plus
`trajectory.codeowner_scope:turn`, `trajectory.codeowner_source`,
`trajectory.codeowner_status`, and `trajectory.codeowner_truncated`. Owner IDs
do not include a leading `@`. Root metadata carries exact eligible, retained,
dropped, matched-file, unowned-file, and ignored-email counts under the
`trajectory.codeowner_*` keys. Child inference, LLM, and tool spans do not
inherit the turn-root union. Task and session standalone roots use their own
bounded summaries; Trajectory does not copy a session owner union onto every
PR or turn.

Production ownership is limited to successful writes and eligible exact files
from immutable session-produced commit evidence. Entry baselines, downloaded
or imported changes, and merge or cherry-pick alone do not add owner tags.
Resolution is local and uses no provider API or user credentials; paths,
patterns, commands, refs, object IDs, diffs, source content, email owners, and
raw evidence are absent from the span contract.

Retroactive PR creation can finalize an earlier `creation_window` context and
sets `retroactive_membership:true` on that context's managed
`pr_attribution` v2 record. It does not mutate or republish cloud turn-root
spans that were accepted before PR identity was known. The finalized record
and metrics are the durable retroactive surfaces.

## Local-UI Parity

Local-ui/Lapdog has two span sources:

- Live local EVP forwarding uses LLM Obs span payloads mapped with the same
  base metadata options as published spans.
- SQLite-synthesized spans should preserve the same stable identity and trace
  tags where the cache schema has the source fields. Optional fields such as
  `trajectory.client_version` and `project_dir` appear only when materialized
  local data contains them. Cost-overlap tags prefer turn-level cache columns,
  fall back to session-level columns, and finally use bounded Claude Code
  `unknown` fallback values for older caches without route evidence.
- Durable PR-work dimensions are applied identically to cloud-published, live
  local-EVP, and SQLite-reconstructed completed turn roots. Lapdog list, trace,
  fetch, filter, group, facet, and cardinality views therefore expose the same
  assignment, while child spans remain untagged.
- CODEOWNER turn-root arrays and exact overflow metadata use the same durable
  turn summary in cloud, live local-EVP, and SQLite reconstruction. Public
  owner values are normalized without `@`; local legacy fixtures do not define
  the current publish contract.

For fields visible in both Datadog and local-ui, prefer this document over
ad-hoc per-surface behavior. If a new common tag is useful on published spans,
it should generally be added to the base tag builder and then backfilled by
publish or mirrored by local-ui synthesis when those surfaces have equivalent
source data.
