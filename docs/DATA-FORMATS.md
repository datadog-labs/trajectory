# Data Formats

## Materialized Session JSON

Materialized session documents use `format_version: 1`.

### Session Fields

| Field | Type | Description |
| --- | --- | --- |
| `parent_session_id` | string, optional | Parent session ID copied from `session_start.parent_session_id`, `session_start.forked_from_session_id`, or `session_start.forked_from_id` when present. Used to preserve canonical child-session linkage without requiring transcript paths. |

### Turn Viewer Fields

The local viewer may add compact, read-optimized fields to each materialized
turn. These fields are derived from the turn's own tool calls and from marker
annotations or the local DB marker table; they do not replace the raw
`tool_calls`, `permissions`, `sub_agents`, or top-level `annotations.markers`
records.

| Field | Type | Description |
| --- | --- | --- |
| `tool_summary` | object, optional | Per-turn tool counts. Contains `total`, `by_tool[]` entries with `tool` and `count`, plus `failures` and `denied` counts. Sub-agent tool calls already nested under `sub_agents[]` are excluded from the parent turn summary. |
| `file_touches` | array of objects, optional | Structured file touch summaries derived from file-oriented tools. Each entry contains `path`, `operation`, `tool`, `count`, and optional `bytes` and `lines` estimates for write/edit content. `operation` is one of `read`, `write`, or `edit`. |
| `markers` | array of marker objects, optional | Markers directly attached to this turn for viewer rendering. The viewer attaches markers from materialized `annotations.markers` and, when reading an existing materialized trace, merges marker records from the local DB at read time. |
| `marker_ids` | array of strings, optional | Stable IDs for the markers attached to this turn. IDs are deduplicated and correspond to the objects in `markers` and/or top-level `annotations.markers`. |

### Turn Sub-Agent Fields

Each turn can include `sub_agents[]` records for delegated child sessions.

| Field | Type | Description |
| --- | --- | --- |
| `trace` | object, optional | Materialized child session loaded from a sibling canonical `session-{child_session_id}.jsonl` file when the parent sub-agent record has no interleaved nested content. The parent session's aggregate tool counts do not include tools from this nested trace. The local viewer may populate this field at read time for older materialized parent traces. |

## LLM Observability Turn Cost Fields

Turn spans keep token and cost aggregates on the span itself. When turn metrics include an estimated total cost, the span includes `metrics.estimated_total_cost` in nanodollars, `meta.metadata.estimated_total_cost_nanodollars`, `meta.metadata.estimated_total_cost_usd`, and the low-cardinality tag `trajectory.cost_source:turn_metrics`.

The user config setting `export.placeholder_llm_span: false`, or publish destination setting `placeholder_llm_span: false`, disables Trajectory's synthetic LLM child span for turn-cost enrichment. It does not remove real LLM spans, and it does not remove the turn-level cost metric or fallback metadata above.

Subagent spans default to `export.subagent_span_mode: semantic`: synchronous subagents attach under the launching Agent/Task tool span, while async background subagents attach under the task-notification join turn. The child session trace is still preserved through span links and child trace metadata. Set `export.subagent_span_mode: links_only`, or destination `subagent_span_mode: links_only`, to suppress the extra parent-side subagent task span and keep only links on the nearest existing parent span. See [Subagent Trace Model](SUBAGENT-TRACE-MODEL.md) for the client-by-client validation matrix.

The Datadog LLM Observability span tag contract is tracked in
[LLM Obs Span Tags](LLM-OBS-SPAN-TAGS.md).
