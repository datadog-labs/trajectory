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

Trajectory publishes three trace types. `trajectory.trace_type` identifies the
trace topology and must not be inferred from parent-child shape alone.

| Trace | Spans | Required trace tags |
| --- | --- | --- |
| Turn | Turn root plus inference/tool/LLM children | `trajectory.trace_type:turn`, `trajectory.session_id:<session_id>` |
| Task | One standalone task span | `trajectory.trace_type:task`, `trajectory.session_id:<session_id>`, `trajectory.task.turn_start:<n>`, `trajectory.task.turn_end:<n>` |
| Session | One standalone session span | `trajectory.trace_type:session`, `trajectory.trace_correlation.session_id:<session_id>` |

Turn traces are the only traces with real child spans. Task and session traces
link to lower-level traces with span links and must not duplicate lower-level
spans.

## Span-Specific Tags

| Span class | Required/additional tags | Notes |
| --- | --- | --- |
| Turn root | `trajectory.semantic_type:turn`, `trajectory.session_id:<session_id>` | Root of a turn trace. |
| Agent message / inference | `trajectory.semantic_type:agent_message`, `trajectory.session_id:<session_id>` | Display names may be `inference-0`, `inference-1`, etc. |
| Tool | `trajectory.session_id:<session_id>` | Parent is the claiming agent-message span when known, otherwise the turn root. |
| Real LLM call | `trajectory.session_id:<session_id>`, `trajectory.llm_call:true` | Used for captured Trajectory-owned LLM calls. |
| Synthetic LLM cost span | `trajectory.session_id:<session_id>` | May also carry `trajectory.cost_source:turn_metrics` when derived from turn totals. |
| Task | `trajectory.semantic_type:task`, `trajectory.session_id:<session_id>`, `task_type:<type>`, `outcome_label:<label>` | Standalone span with turn span links. |
| Session | `trajectory.semantic_type:session`, `trajectory.trace_correlation.session_id:<session_id>` | Standalone span with task or turn span links. |
| Compaction/correlation | `trajectory.semantic_type:compaction`, `trajectory.trace_correlation.session_id:<session_id>` | Used for compaction or cross-session correlation spans. |

When a span has a semantic event name, it may also carry
`trajectory.semantic_name:<name>`.

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

For fields visible in both Datadog and local-ui, prefer this document over
ad-hoc per-surface behavior. If a new common tag is useful on published spans,
it should generally be added to the base tag builder and then backfilled by
publish or mirrored by local-ui synthesis when those surfaces have equivalent
source data.
