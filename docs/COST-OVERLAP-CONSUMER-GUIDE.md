# Cost Overlap Consumer Guide

This guide explains how dashboards and product UIs should use Trajectory cost-overlap tags. The span tag contract lives in [LLM-OBS-SPAN-TAGS.md](LLM-OBS-SPAN-TAGS.md), and the metric tag surface is summarized in [METRICS-REFERENCE.md](METRICS-REFERENCE.md).

## Product Intent

Trajectory cost is an attribution stream. It is useful because it has local
agent context such as user, project, session, turn, and model. Provider,
gateway, cloud, or native client metrics may be closer to billed totals, but
they often have coarser attribution.

The UI should not suppress Trajectory cost. It should decide where Trajectory
cost is counted as a total, where it is shown as an attribution breakdown, and
where another billing stream is likely already covering the same spend.

## Core Rule

Never sum cost series across roles by default.

Use `trajectory.cost_role` as the first partition:

| Role | Meaning | Default UI treatment |
|---|---|---|
| `attribution` | Trajectory-derived local cost attribution | Use for user, project, session, turn, and model breakdowns. |
| `client_telemetry` | Native client telemetry proxied through Trajectory | Show as a separate source or validation stream. |
| Missing | Legacy or non-overlap-aware series | Keep visible; do not auto-hide. |

For total-spend cards, choose one source family for the card. Do not add
Trajectory attribution to client telemetry, provider analytics, gateway
analytics, or cloud billing totals unless the user explicitly requests an
un-deduped comparison.

## Important Tags

| Tag | Use in UI decisions |
|---|---|
| `trajectory.cost_role` | Primary partition for attribution vs native client telemetry. |
| `trajectory.cost_dedupe_group` | Stable grouping key for possible overlap buckets, for example `anthropic:direct`. |
| `trajectory.cost_overlap_risk` | Main automatic dedupe signal. |
| `trajectory.provider_cost_visibility` | Tells which external billing surface may contain the same spend. |
| `trajectory.provider_route` | Route label for filters and badges. |
| `trajectory.cost_dedupe_confidence` | Controls whether automatic behavior is safe or should be review-only. |
| `trajectory.cost_source` | Source-family label for overlapping cost streams; native Claude telemetry proxied by Trajectory uses `claude_native_otlp`. |

Use `trajectory.cost_dedupe_group` rather than raw model, service, or provider
text for dedupe grouping. Model names can change within the same billing route;
the dedupe group is intentionally stable and low-cardinality.

## Default Total Logic

For each cost panel, first decide the product source:

1. `Attributed cost`: Trajectory attribution only.
2. `Native client telemetry`: proxied Claude Code native telemetry only.
3. `Provider or gateway billed cost`: external provider, gateway, or cloud
   billing analytics when available.

Then apply this decision table within each `trajectory.cost_dedupe_group`:

| Available data | Risk | Recommended default |
|---|---|---|
| Only Trajectory attribution | Any | Count Trajectory attribution. |
| Trajectory attribution plus client telemetry | `possible`, `aggregate_only`, or `unknown` | Count one role only; default dashboard UI to attribution for breakdowns, and expose client telemetry as a separate source. |
| Trajectory attribution plus direct Anthropic analytics | `possible` | Use provider analytics for billed totals; keep Trajectory attribution for user/project/session breakdowns. |
| Trajectory attribution plus gateway or cloud billing analytics | `aggregate_only` | Use gateway/cloud billing for billed totals; keep Trajectory attribution for allocation and drilldown. |
| Multiple routes in one aggregate | `mixed` | Do not auto-hide. Split by `trajectory.cost_dedupe_group` and show a review state. |
| Historical or incomplete evidence | `unknown` | Do not auto-hide. Keep visible with an unknown-overlap badge. |
| Missing overlap tags | Missing | Treat as uncategorized. Keep visible and exclude from automatic dedupe rules. |

This table is intentionally conservative. Hiding attribution on `unknown`,
`mixed`, or missing tags risks losing fidelity.

## Suggested dashboard UI UX

Use a source selector for totals:

- `Attributed cost`
- `Native client telemetry`
- `Provider/gateway billed cost`
- `Compare sources`

Use route/risk controls for analysis views:

- Route filter:
  `direct`, `llm_gateway`, `bedrock`, `vertex`, `foundry`, `unknown`, `mixed`
- Risk filter:
  `possible`, `aggregate_only`, `unknown`, `mixed`
- Confidence filter:
  `high`, `medium`, `low`, `mixed`
- Group by:
  `trajectory.cost_dedupe_group`

Default drilldown behavior:

- Total cards should not sum across roles.
- User, project, session, and turn breakdowns should prefer
  `trajectory.cost_role:attribution`.
- Provider/gateway billing panels should not add Trajectory attribution when
  the same `trajectory.cost_dedupe_group` has likely overlap.
- Compare views may show multiple roles side by side, but should label them as
  separate sources rather than presenting the sum as total spend.

## Badges And Labels

Use concise labels that explain the risk without implying exact billing
authority:

| Condition | Suggested label | Detail text |
|---|---|---|
| `provider_route:direct` and `cost_overlap_risk:possible` | Provider overlap possible | Direct provider analytics may contain the same spend. |
| `cost_overlap_risk:aggregate_only` | Covered by aggregate billing | Gateway or cloud billing may already include this spend. |
| `cost_overlap_risk:unknown` | Overlap unknown | Trajectory lacks enough route evidence to dedupe automatically. |
| `cost_overlap_risk:mixed` | Multiple routes | Split by route before choosing a total source. |
| `cost_role:client_telemetry` | Native client telemetry | Client-native usage/cost stream, separate from Trajectory attribution. |
| Missing overlap tags | Uncategorized | Legacy or non-overlap-aware series; not hidden automatically. |

Avoid labels such as `duplicate`, `wrong`, or `excluded` unless the UI is
showing an explicit query state. The tags indicate likely overlap, not proof
that one stream is invalid.

## Query Patterns

Adapt these as query-builder clauses rather than copying them as one universal
Datadog query.

| Intent | Required filters |
|---|---|
| Trajectory attribution totals | `trajectory.cost_role:attribution` |
| Native client telemetry totals | `trajectory.cost_role:client_telemetry` |
| Direct Anthropic attribution | `trajectory.cost_role:attribution`, `trajectory.provider_route:direct` |
| Gateway-routed attribution | `trajectory.cost_role:attribution`, `trajectory.provider_route:llm_gateway` |
| Cloud-provider-routed attribution | `trajectory.cost_role:attribution`, `trajectory.provider_route:bedrock` or `vertex` or `foundry` |
| Likely aggregate-billing overlap | `trajectory.cost_overlap_risk:aggregate_only` |
| Review-needed overlap | `trajectory.cost_overlap_risk:unknown` or `mixed`, or missing `trajectory.cost_role` |
| Stable source comparison | Group by `trajectory.cost_dedupe_group` and `trajectory.cost_role` |

For Trajectory cost metrics, start with the cost-bearing metric names listed in
[METRICS-REFERENCE.md](METRICS-REFERENCE.md). Do not apply
cost-overlap filters to token, tool, duration, marker, or serve metrics and
expect complete results; those metrics intentionally do not carry overlap tags.

## Spans Versus Metrics

Metrics are the source for cost totals. Spans carry the same overlap vocabulary
as trace context so the UI can explain route and dedupe status while the user
is looking at a session or turn.

Recommended span behavior:

- Show route and overlap badges on session, turn, inference, and synthetic LLM
  cost spans when tags are present.
- Use span tags to explain why a cost metric was counted, split, or excluded
  from a total.
- Do not compute dashboard-wide cost totals by summing spans.
- If a trace has `mixed` route tags, prefer turn-level span context for the
  currently viewed turn instead of using the session-level route as a blanket
  decision.

Local-ui/Lapdog and published spans should expose equivalent tags for the same
captured evidence. If one surface shows different route/dedupe status for the
same turn, treat that as a parity bug.

## Edge Cases

### `possible`

`possible` usually means direct Anthropic visibility. If dashboard UI also has
Anthropic analytics for the same org/product context, avoid summing that billed
cost with Trajectory attribution. If no provider analytics source is connected,
Trajectory attribution can still be the displayed total.

### `aggregate_only`

`aggregate_only` means a gateway or cloud billing system can see aggregate
spend, but may not have local user/session attribution. Use aggregate billing
for total spend when available. Use Trajectory attribution for allocation,
breakdowns, investigation, and trend shape.

### `unknown`

`unknown` is not a hide signal. It means Trajectory could not classify the
route with enough evidence. Keep the data visible, show a review badge, and let
users split or filter by confidence.

### `mixed`

`mixed` means multiple route classifications were observed inside one aggregate
or query window. Split by `trajectory.cost_dedupe_group` before applying dedupe
logic. Avoid a single total-source decision for a mixed bucket.

### Missing Tags

Missing tags can happen for legacy data, non-Claude clients, or non-cost
metrics. Keep these series visible as uncategorized. Do not backfill a direct
or gateway assumption in the UI.

## Implementation Checklist

Before enabling dashboard UI overlap rendering, verify:

- Total-spend widgets never sum `attribution` and `client_telemetry` by
  default.
- Provider/gateway billing totals do not add Trajectory attribution for the
  same `trajectory.cost_dedupe_group` when risk is `possible` or
  `aggregate_only`.
- Unknown, mixed, and missing-tag series remain visible.
- User/project/session/turn drilldowns still use Trajectory attribution even
  when billed-total widgets prefer provider or gateway totals.
- Compare views label each source family separately and avoid presenting a
  multi-role sum as deduped total spend.
- Trace/span views display route and overlap context without trying to compute
  totals from spans.
- Tests cover direct, gateway, cloud-provider, unknown, mixed, missing-tag, and
  client-telemetry cases.

## Anti-Patterns

- Do not dedupe by model name.
- Do not dedupe by span name such as `inference-0`.
- Do not treat `trajectory.provider:anthropic` alone as overlap evidence.
- Do not hide `unknown`, `mixed`, or missing-tag data automatically.
- Do not use cost-overlap tags as a proxy for sensitive route configuration.
- Do not assume Trajectory attribution and provider billing have the same
  cardinality or timing semantics.
