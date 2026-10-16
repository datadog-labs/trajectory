# Cost Overlap Consumer Guide

Use this guide to show Trajectory cost in Agent Console and other dashboards
without counting the same spend twice. It explains how to use the
cost-overlap tags. The Metrics Reference lists the tags under
[Cost Overlap Tags](metrics/common-tags.md#cost-overlap-tags).

## Product Intent

Trajectory cost is an attribution stream. Its value is the local agent context
that it carries, such as user, project, session, turn, and model. Provider,
gateway, cloud, and native client metrics can be closer to the billed total.
They often carry less detail about who or what used the spend.

Do not hide Trajectory cost in the UI. Instead, decide three things for each
view:

- where Trajectory cost counts toward a total
- where it shows as a breakdown of attributed cost
- where another billing stream probably covers the same spend already

Provider activity integrations are a separate topic. An audit webhook can fill
gaps in web-agent sessions and actions, but it is not a cost source. The UI
must keep those activity records. It joins them into the sessions a user sees
when the provider sends a correlation ID. It never creates billed cost from
missing cost fields.

## Core Rule

By default, never add cost series from different roles.

This guide covers overlap between telemetry and billing source families. For
grains, coverage, and dashboard recipes, see
[Cost Attribution and Dashboarding](COST-ATTRIBUTION.md).

Split cost first by `trajectory.cost_role`:

| Role | Meaning | Default UI treatment |
|---|---|---|
| `attribution` | Local cost attribution from Trajectory | Use for breakdowns by user, project, session, turn, and model. |
| `client_telemetry` | Native client telemetry that Trajectory forwards | Show as a separate source or as a check on other sources. |
| Missing | Legacy series, or series without overlap tags | Show only in a view for legacy or unverified data. Leave out of spend totals. |

Current Trajectory cost metrics derived from turns always have
`trajectory.cost_role:attribution` and `trajectory.cost_source:turn_metrics`.
So a series without a role or source comes from legacy data, an external
system, or another source. Never add it to Trajectory totals.

A total-spend card must use one source family. Do not add Trajectory
attribution to totals from client telemetry, provider analytics, gateway
analytics, or cloud billing. The only exception is a comparison without
deduplication that the user asks for.

## Important Tags

| Tag | Use in UI decisions |
|---|---|
| `trajectory.cost_role` | First split: attribution or native client telemetry. |
| `trajectory.cost_contract` | Integrity contract. Trajectory spend totals require `v2`. Backfill of live metrics carries it. Older historical metrics and provider history replay do not. |
| `trajectory.cost_dedupe_group` | Stable key for groups that can overlap, such as `anthropic:direct`. |
| `trajectory.cost_overlap_risk` | Main signal for automatic deduplication. |
| `trajectory.provider_cost_visibility` | Names the external billing system that can contain the same spend. |
| `trajectory.provider_route` | Route label for filters and badges. |
| `trajectory.cost_dedupe_confidence` | Says whether automatic behavior is safe or needs a review. |
| `trajectory.cost_source` | Source family of a cost stream. Native Claude telemetry that Trajectory forwards uses `claude_native_otlp`. |

To deduplicate, group by `trajectory.cost_dedupe_group`. Do not group by raw
model, service, or provider text. Model names can change within the same
billing route. The dedupe group stays stable and has few values.

The dedupe group names a route bucket. It does not identify a single event.
In the same way, `trajectory.cost_dedupe_confidence` measures confidence in the
route classification. It does not measure confidence that two metric points
are the same charge.

Exact deduplication of records needs a stable request or event ID that the
sources share. The aggregate metrics available today have no such shared ID.
This applies to Trajectory, Claude native OTel, Anthropic analytics, and the
Cursor Admin API.

DD Harness (Datadog's multi-agent coding tool) is an intentional, permanent
exception, not a pending one. Its pi-wrapped sessions carry a separate,
metadata-priced `dd_harness_pi_metadata_cost_usd` field (see
[Cost Attribution](COST-ATTRIBUTION.md#dd-harness-cost-coverage)).
Claude's native OTLP telemetry proxies a real, separate OTLP metrics
stream Claude's own process already exports, tagged
`trajectory.cost_source:claude_native_otlp`. DD Harness emits no metrics
stream of its own for Trajectory to proxy. This field stays an
event-level diagnostic field only. It is never turned into a Datadog
metric, and so never carries a `trajectory.cost_role`/`trajectory.cost_source`
tag. Do not query or badge it as `cost_role:client_telemetry`. It is not
classified into the metric-tag taxonomy at all. That classification is by
design. It is not a gap awaiting tagging work.

DD Harness's own `llm_call` *attribution* cost (Trajectory's own
token-derived estimate, separate from this field) does get the standard
`trajectory.cost_role:attribution`/`trajectory.cost_source:turn_metrics`
tags automatically. Every other client's turn-derived cost metric gets
the same tags.

PR work cost metrics are views of Trajectory attribution. They are not new
billing sources. They use the same `trajectory.cost_role:attribution` and
`trajectory.cost_source:turn_metrics` tags as the turn cost they come from.
They also use the same route and overlap values. When those turns have
different values, the PR value is `mixed`.

## Source Selection Versus Reconciliation

Agent Console must keep these four steps separate:

1. **Availability:** Does this source have data for this agent, signal, scope,
   and time window?
2. **Selection:** Which one source answers the product question?
3. **Comparison:** How do sources with separate labels differ after you align
   their scopes?
4. **Deduplication:** Can you match records by a shared stable ID before you
   aggregate them?

Cost views must support availability, selection of one source, and comparison
side by side. They must not claim that records are deduplicated. A match by
email, model, and timestamp alone is a guess. Never use it for spend totals.

Activity correlation and cost reconciliation are different steps. A provider
session ID can join a query, an answer, and an agent action. That ID can still
be too coarse to show which model request or charge overlaps a turn that the
client observed.

Before you use provider, gateway, cloud, or Cursor organization data as a
total, align these scopes:

- account or workspace
- route and product
- currency
- policy for included, BYOK, and failed usage
- event time window and time zone
- handling of late and replayed data

A difference in coverage does not by itself mean a pricing error.

Customers collect upstream data in different ways. Use these rules:

- If exactly one trusted cost source is available, use only that source.
- If several sources share a stable request or event ID, reconcile at that ID
  before you aggregate. Report the coverage that does not match.
- If sources overlap only by route, time, user, or model, keep them side by
  side. Label the comparison as a guess. Never add them or deduplicate them
  automatically.
- If BYOK, included usage, failed requests, currency, workspace, event time,
  late data, or replay policy differ, align those scopes before you compare.
- If required provenance is missing, show an unverified or coverage state.
  Never show zero, "deduplicated," or a combined spend total.

## Agent Console Source Registry

A list of metric names is not something you can add up. Describe each source
in a registry, and choose sources with a policy for each signal. Do not reuse
the widget query field named `data_source`. Name the provenance field
`telemetrySource`.

```ts
type TelemetrySourceId =
  | 'trajectory'
  | 'claude_otel'
  | 'anthropic_usage'
  | 'claude_code_integration'
  | 'cursor_usage'
  | 'perplexity_audit'
  | 'perplexity_computer_analytics';

type ValueSemantics =
  | 'completed_sample'
  | 'cumulative_counter'
  | 'latest_gauge'
  | 'event_count';

type SourceDefinition = {
  id: TelemetrySourceId;
  label: string;
  availabilityProbe: { metric: string; filter?: string; strategy: 'has_points' };
  sourceCapabilities: {
    activity: boolean;
    usage: boolean;
    cost: boolean;
  };
  identity: {
    userTag?: string;
    modelTag?: string;
    repoTag?: string;
    sessionTag?: string;
    turnTag?: string;
    eventIdTag?: string;
  };
};

type MetricBinding = {
  metric: string;
  telemetrySource: TelemetrySourceId;
  signal: 'cost_usd' | 'credits' | 'input_tokens' | 'output_tokens' |
    'sessions' | 'commits' | 'pull_requests' | 'llm_requests' | 'tool_uses' |
    'web_search_requests' | 'queries' | 'answers' | 'agent_actions';
  filter?: string;
  userTag?: string;
  modelTag?: string;
  repoTag?: string;
  sessionTag?: string;
  turnTag?: string;
  eventIdTag?: string;
  unit: 'usd' | 'cent' | 'credit' | 'token' | 'count';
  unitScale?: number;
  aggregation: 'sum' | 'count' | 'latest';
  valueSemantics: ValueSemantics;
  overlapGroup: string;
  composition: 'exclusive' | 'additive_component';
  compositionGroup?: string;
  componentId?: string;
};

type SignalSourcePolicy = {
  signal: MetricBinding['signal'];
  strategy: 'exclusive_source' | 'set_union' | 'compare_only';
  preferredSources: TelemetrySourceId[];
};
```

The signal policy decides which source wins. No single producer wins for every
signal. For example, provider analytics can win for cost while Claude OTel or
Trajectory wins for session activity.

Every binding must declare its source, signal, unit, value semantics, and
overlap group. Remove bare string metric bindings, or convert them with a
helper for each source. A missing provenance field must never fall back to an
`integrations` bucket without notice.

A source that reports only activity or only usage must not register a
`cost_usd` binding. Missing cost means the signal is unavailable. It never
means a cost of zero.

## Record And Matching Contract

> **Potential option, not implemented.** Today Trajectory tags overlapping cost metrics with overlap and dedupe groups. Nothing matches cost records across sources one record at a time.

Future exact reconciliation should happen on records before metrics are
aggregated. Keep at least these fields:

| Field | Purpose |
|---|---|
| Source, account or workspace scope, and `sourceRecordId` | Ingest the same upstream record only once |
| `sourceRevision` and `sourceObservedAt` | Order replacements for corrected events or refreshed snapshots |
| `sourceIngestedAt` | Diagnose delivery lag and replay. Never use it as the event time. |
| Standard user ID and source user ID | Map identities without using a raw email as a record key |
| Session or conversation ID, and parent action ID | Correlate activity |
| Shared request or charge ID, when the sources really share one | Match cost exactly across sources |
| Signal, value, unit, currency, and value semantics | Keep counts, gauges, deltas, distributions, and snapshots apart |
| Cost role, authority, scope, and overlap group | Pick one answer for a product question and keep useful attribution |
| Coverage window and time zone | Align aggregates and revised reports |

Use the strongest matching rule that the records support:

1. **Source replay:** The same source, account scope, and source record ID mean
   one record. Keep the newest documented revision.
2. **Exact match across sources:** A shared request or charge ID can select
   one cost authority. It also needs compatible signal semantics and aligned
   account and product scope. Keep the other record for provenance.
3. **Aggregate selection:** Aligned account, product, currency, dimensions,
   and half-open time window can select one source for the total. They cannot
   remove single records as duplicates.
4. **Heuristic comparison:** User, model, and time can explain coverage or
   differences only. Never use them to deduplicate records.

For cost views, name the cost authority. Examples are `provider_billed`,
`provider_rated`, `client_reported`, `local_exact_rate`, `local_estimate`, and
`none`. These values have no single ranking for all questions. Provider
billing can own an organization total while local exact-rate attribution owns
the session breakdown. The resolver chooses one authority for each signal,
scope, grain, and view.

### Revised aggregates

Provider APIs and scheduled SaaS reports often restate an earlier window. A
later record can have the same source, account, product, currency, window,
dimensions, and snapshot key. Treat it as a replacement. Never add it as a new
event. Keep the earlier version for audit history, but leave it out of the
current total. If the provider does not document its revision or watermark
behavior, mark the window provisional. Keep it provisional until you know its
settlement policy.

## Resolver Contract

Before you build the value query, resolve one plan for each agent, signal,
view, and time window:

```ts
type SourcePlan = {
  agentId: string;
  signal: MetricBinding['signal'];
  mode: 'auto' | 'explicit' | 'compare';
  selectedSources: TelemetrySourceId[];
  bindings: MetricBinding[];
  reason: 'configured' | 'preferred_available' | 'fallback_available';
};
```

The resolver must apply these rules:

1. `auto` chooses the first available source in the signal policy.
2. `explicit` uses exactly the requested source. If that source is
   unavailable, return an unavailable state. Never return zero, and never fall
   back without notice.
3. `compare` keeps one formula or column for each source, each with its own
   label. It never produces one combined total.
4. Bindings from different sources in the same `overlapGroup` exclude each
   other.
5. Add `additive_component` bindings only when they share both a telemetry
   source and a `compositionGroup`.
6. A valid zero is data. It never triggers a fallback.
7. Resolve availability before the value query. Neither
   `default_zero(primary) + fallback` nor `max(primary, fallback)` selects a
   source safely.
8. Count active users from one source, or as a set union of standard user IDs.
   Never add active-user counts from different sources.
9. A list of model options can merge and deduplicate names. Model Usage values
   still follow the resolved cost source.

Resolve the plan once for each page. Every part of the page must use the same
plan: totals, model usage, user analytics, agent details, and user or team side
panels. They must not query all metric bindings on their own.

## Agent Console Metric Mappings

### Claude Code

| Source | Cost metric | Identity tags | Recommended role |
|---|---|---|---|
| `anthropic_usage` | `anthropic.user_cost.amount` | `user_email`, `model` | Preferred provider cost view, after you check its scope |
| `claude_otel` | `claude_code.cost.usage` | `user.email`, `model`, and `session.id` when present | Native client telemetry and activity |
| `trajectory` | `trajectory.turn.cost.usd.additive` filtered to `trajectory.client_source:claude-code` | `trajectory.user_email`, `gen_ai.request.model`, `session_id`, `trajectory.turn_id` | Local attribution and drilldown |
| `claude_code_integration` | Legacy `claude_code.*` cost series | `actor_email`, `model`, `repo` | Legacy fallback only |

Suggested source order for each signal:

```text
cost_usd: anthropic_usage -> claude_otel -> trajectory -> claude_code_integration
sessions/commits/pull_requests/activity: claude_otel -> trajectory -> claude_code_integration
input/output/cache tokens: anthropic_usage -> trajectory
```

An attribution view can put Trajectory first. A cost total must always use
only one source.

```text
# Provider aggregate
sum:anthropic.user_cost.amount{product:claude_code} by {user_email,model}.as_count()

# Native client telemetry
sum:claude_code.cost.usage{*} by {user.email,model}.as_count()

# Trajectory completed-turn attribution
sum:trajectory.turn.cost.usd.additive{trajectory.cost_contract:v2,trajectory.cost_role:attribution,trajectory.client_source:claude-code,trajectory.cost_source:turn_metrics}.as_count()
  by {trajectory.user_email,gen_ai.request.model}
```

Each point of `trajectory.turn.cost.usd.additive` holds the value of one
completed turn. It does not hold a running total. If one series reports `$1`,
`$2`, and `$3`, the three turns sum to `$6`. The metric never adds earlier
turns again.

### Cursor

| Source | Metric | Semantics | Treatment |
|---|---|---|---|
| `cursor_usage` | `cursor.usage_events.total_cents` | Gross model usage value | Sum the events. Do not label the result as billed cash. |
| `cursor_usage` | `cursor.usage_events.charged_cents` | Event debit rated by the provider | Candidate for a provider-rated usage view |
| `cursor_usage` | `cursor.usage_events.cursor_token_fee` | Fee that `charged_cents` already includes | Never add to `charged_cents` |
| `cursor_usage` | `cursor.spending.spend_cents` | Gauge of on-demand spend in the current cycle | Use the latest value for one cycle. Never sum it over time. |
| `trajectory` | `trajectory.turn.cost.usd.additive` filtered to `trajectory.client_source:cursor` | Local token-based attribution for observed turns, when complete and exactly priced | Attribution ledger. Never add to Cursor organization cost. |

No event ID is shared today between the Cursor Admin API and a Trajectory turn.
A comparison by user, model, and time bucket calibrates aggregates. It does
not deduplicate single turns.

```text
# Cursor gross model economic usage
sum:cursor.usage_events.total_cents{*} by {user_email,model}.as_count()

# Trajectory local observed-turn attribution
sum:trajectory.turn.cost.usd.additive{trajectory.cost_contract:v2,trajectory.cost_role:attribution,trajectory.client_source:cursor,trajectory.cost_source:turn_metrics}.as_count()
  by {trajectory.user_email,gen_ai.request.model}
```

For the formula, the source of the public rates, the organization card
override, and the shadow gates, run `trajectory user-guide cursor-cost`.

Cursor request counts, tool uses, and web searches are three different
signals. The Cursor API reports them under one shared request field. Do not
reuse one metric array for all three.

## SaaS Activity Streams

Give a provider audit stream its own source definition and signal bindings. It
can take part in source selection for activity. It never becomes a cost
fallback.

For a webhook like the Perplexity audit webhook:

- Use the provider event UUID to deliver each event only once.
- Use the provider session ID to correlate query, answer, and agent-action
  events.
- Count each distinct event by its event type.
- Keep model metadata as activity context.
- Do not create a `cost_usd` binding when tokens, price, currency, and billing
  semantics are missing.
- Do not hide a cost attributed by the client only because both sources refer
  to the same session.

If the provider adds a separate usage or cost export later, register it as a
separate source with its real unit and semantics.

Perplexity Computer Analytics reports full UTC hour or day buckets. The buckets
hold credits and activity categories, plus daily credit usage for each member.
The source syncs from time to time, so a recent zero can mean "not synced
yet."

Register these credits as a provider consumption signal. Do not register them
as `cost_usd`. The `paid` and `promo` values name where credits came from.
They are not a currency or a cash amount. A bucket has no documented request
or audit-event ID. So it supports provider credit totals and aggregate
comparison. It cannot match audit events or client turns exactly.

A provider can later add usage or billing in a currency. Prefer it for
provider-rated or billed totals only after you check these properties:

- account and product
- currency and inclusion
- time window and refresh
- settlement

Without a shared request or charge ID, keep local session attribution and
provider totals at their own grains.

### SaaS integration contract gate

Before a dashboard uses a new SaaS source, document these properties:

- source capabilities: activity, provider usage, cost, or a stated combination
- the supported signals and the exact grain of each value
- account, workspace, product, route, and user scope
- stable event IDs, links between sessions and requests, and parent-child
  rules
- delivery retry, order, replay, backfill, and retention behavior
- event time, ingestion time, source time zone, and bucket boundaries
- correction, revision, snapshot, watermark, and settlement behavior
- cost authority, currency, and policy for included, free, failed, and BYOK
  usage
- whether the value is gross, charged, estimated, or billed
- schema versions, payload validation, privacy class, and content collection
  that the customer controls
- a canary with two sources that shows source selection, unmatched coverage,
  and zero compared with unavailable, before default totals change

Unknown answers are allowed during discovery. They must lead to a provisional
or review-required state. Never infer a dedupe rule from an unknown answer.

## Customer Configuration Variants

Support all of these variants. None of them changes the resolver rules.

- **Static product defaults:** The dashboard product ships a fixed registry
  and source order. This works as a start, but it cannot describe how one
  organization instruments its agents.
- **Organization policy:** Configuration sets preferred sources for each agent
  and signal. It can reorder sources. It cannot make overlapping sources
  additive.
- **Backend-resolved policy:** This is the preferred long-term option. One
  endpoint returns the selected source, the available candidates, coverage,
  and a reason. It does this for every agent, signal, and window, and all views
  use it.
- **Upstream records:** Future exact deduplication of records needs them.
  Before aggregation, each record needs its standard and source event IDs. It
  also needs the standard user, agent, session, turn, request, model,
  timestamp, signal, value, unit, source, and ingestion time.

An organization policy can look like this:

```json
{
  "version": 1,
  "agents": {
    "claude-code": {
      "signals": {
        "cost_usd": {"preferred_sources": ["anthropic_usage", "claude_otel", "trajectory"]},
        "sessions": {"preferred_sources": ["claude_otel", "trajectory"]}
      }
    },
    "cursor": {
      "signals": {
        "cost_usd": {"preferred_sources": ["cursor_usage", "trajectory"]}
      }
    }
  }
}
```

## Default Total Logic

For each cost panel, first decide the product source:

1. `Attributed cost`: Trajectory attribution with `trajectory.cost_contract:v2` only.
2. `Native client telemetry`: Claude Code native telemetry that Trajectory
   forwards, and nothing else.
3. `Provider or gateway billed cost`: External provider, gateway, or cloud
   billing analytics, when available.

Then apply this table inside each `trajectory.cost_dedupe_group`:

| Available data | Risk | Recommended default |
|---|---|---|
| Only Trajectory attribution | Any | Count Trajectory attribution. |
| Trajectory attribution and client telemetry | `possible`, `aggregate_only`, or `unknown` | Count one role only. Agent Console uses attribution for breakdowns by default and shows client telemetry as a separate source. |
| Trajectory attribution and direct Anthropic analytics | `possible` | Use provider analytics for billed totals. Keep Trajectory attribution for breakdowns by user, project, and session. |
| Trajectory attribution and gateway or cloud billing analytics | `aggregate_only` | Use gateway or cloud billing for billed totals. Keep Trajectory attribution for allocation and drilldown. |
| Several routes in one aggregate | `mixed` | Do not hide data automatically. Split by `trajectory.cost_dedupe_group` and show a review state. |
| Provider audit or activity stream with no cost fields | N/A | Use only for activity coverage. Do not create a cost series or use the stream as a zero-cost fallback. |
| Historical or incomplete evidence | `unknown` | Do not hide data automatically. Keep it visible with an unknown-overlap badge. |
| Missing overlap tags | Missing | Treat as uncategorized. Keep visible and leave out of automatic dedupe rules. |

The table is cautious on purpose. If you hide attribution on `unknown`,
`mixed`, or missing tags, you can lose detail that no other source has.

## Suggested Agent Console UX

Use a source selector for totals:

- `Attributed cost`
- `Native client telemetry`
- `Provider/gateway billed cost`
- `Compare sources`

Use route and risk controls for analysis views:

- Route filter:
  `direct`, `llm_gateway`, `bedrock`, `vertex`, `foundry`, `unknown`, `mixed`
- Risk filter:
  `possible`, `aggregate_only`, `unknown`, `mixed`
- Confidence filter:
  `high`, `medium`, `low`, `mixed`
- Group by:
  `trajectory.cost_dedupe_group`

Use these defaults for drilldowns:

- Total cards never sum across roles.
- Breakdowns by user, project, session, and turn prefer
  `trajectory.cost_contract:v2,trajectory.cost_role:attribution`.
- Provider or gateway billing panels do not add Trajectory attribution when the
  same `trajectory.cost_dedupe_group` probably overlaps.
- Compare views can show several roles side by side. Label each one as a
  separate source. Never present their sum as total spend.

## Badges And Labels

Use short labels that explain the risk. Do not suggest that a label is exact
billing data.

| Condition | Suggested label | Detail text |
|---|---|---|
| `provider_route:direct` and `cost_overlap_risk:possible` | Provider overlap possible | Direct provider analytics can contain the same spend. |
| `cost_overlap_risk:aggregate_only` | Covered by aggregate billing | Gateway or cloud billing can already include this spend. |
| `cost_overlap_risk:unknown` | Overlap unknown | Trajectory has too little route evidence to deduplicate automatically. |
| `cost_overlap_risk:mixed` | Multiple routes | Split by route before you choose a total source. |
| `cost_role:client_telemetry` | Native client telemetry | Usage or cost stream from the native client, separate from Trajectory attribution. |
| Missing overlap tags | Uncategorized | Legacy series, or series without overlap tags. Not hidden automatically. |

Avoid labels such as `duplicate`, `wrong`, or `excluded`, unless the UI shows
the result of an explicit query. The tags show likely overlap. They do not
show that one stream is invalid.

## Query Patterns

Use these filters as clauses in a query builder. They do not form one query
that fits every case.

| Intent | Required filters |
|---|---|
| Trajectory attribution totals | `trajectory.cost_contract:v2`, `trajectory.cost_role:attribution` |
| Native client telemetry totals | `trajectory.cost_role:client_telemetry` |
| Direct Anthropic attribution | `trajectory.cost_role:attribution`, `trajectory.provider_route:direct` |
| Attribution routed through a gateway | `trajectory.cost_role:attribution`, `trajectory.provider_route:llm_gateway` |
| Attribution routed through a cloud provider | `trajectory.cost_role:attribution`, `trajectory.provider_route:bedrock` or `vertex` or `foundry` |
| Likely overlap with aggregate billing | `trajectory.cost_overlap_risk:aggregate_only` |
| Overlap that needs review | `trajectory.cost_overlap_risk:unknown` or `mixed`, missing `trajectory.cost_role`, or missing `trajectory.cost_contract` |
| Stable source comparison | Group by `trajectory.cost_dedupe_group` and `trajectory.cost_role` |

For Trajectory cost metrics, start with the cost metric names in the
[Metrics Reference](METRICS-REFERENCE.md). Token, tool, duration, marker,
and serve metrics do not have overlap tags. So cost-overlap filters on those
metrics return incomplete results.

## Spans Versus Metrics

Use metrics for cost totals. Spans carry the same overlap tags as trace
context. With them, the UI can explain the route and dedupe status while the
user looks at a session or turn.

Recommended span behavior:

- Show route and overlap badges on session, turn, inference, and synthetic LLM
  cost spans when the tags are present.
- Use span tags to explain why a cost metric was counted, split, or left out of
  a total.
- Never compute dashboard-wide cost totals by adding up spans.
- If a trace has `mixed` route tags, use the turn-level span context for the
  turn on screen. Do not apply the session-level route to every turn.

The local UI (Lapdog) and published spans must show the same tags for the same
captured evidence. If one view shows a different route or dedupe status for
the same turn, report it as a bug.

## Edge Cases

### `possible`

`possible` usually means that Anthropic can see the spend directly. Agent
Console can also have Anthropic analytics for the same organization and
product. Then do not add that billed cost to Trajectory attribution. If no
provider analytics source is connected, Trajectory attribution can still be
the total on screen.

### `aggregate_only`

`aggregate_only` means that a gateway or cloud billing system can see total
spend. It can lack local attribution by user or session. When aggregate
billing is available, use it for total spend. Use Trajectory attribution for
allocation, breakdowns, investigation, and trends.

### `unknown`

Never hide data because it is `unknown`. The value means that Trajectory had
too little evidence to classify the route. Keep the data visible, show a
review badge, and let users split or filter by confidence.

### `mixed`

`mixed` means that one aggregate or query window contains several route
classifications. Split by `trajectory.cost_dedupe_group` before you apply
dedupe logic. Avoid one total-source decision for a mixed bucket.

### Missing Tags

Tags can be missing for legacy data, for clients that are not Claude
clients, or for metrics that are not cost metrics. Keep these series visible as
uncategorized. Never fill in a direct or gateway route for them in the UI.

## Implementation Checklist

Before a dashboard shows overlap-aware cost, check these items:

- Every metric binding declares its telemetry source, signal, overlap group,
  value semantics, and unit. No bare string falls back to a default source.
- Every source declares whether it supplies activity, provider usage, cost, or
  a stated combination. Sources without cost have no cost binding.
- A spend total resolves to at most one source for each agent and signal.
- A zero value does not trigger a fallback. An unavailable explicit source
  gives an unavailable state.
- Additive components share one telemetry source and composition group.
- By default, total-spend widgets never add `attribution` and
  `client_telemetry`.
- Provider or gateway billing totals do not add Trajectory attribution for the
  same `trajectory.cost_dedupe_group` when the risk is `possible` or
  `aggregate_only`.
- Unknown, mixed, and missing-tag series stay visible.
- Drilldowns by user, project, session, and turn still use Trajectory
  attribution, even when billed-total widgets prefer provider or gateway
  totals.
- Compare views label each source family separately. They never present a sum
  across roles as deduplicated total spend.
- Totals, model usage, user analytics, details, and side panels on one page
  use the same source plan.
- Claude cost snapshots use only one of these sources: Anthropic, Claude OTel,
  Trajectory, or the legacy integration.
- Cursor cost snapshots never add `total_cents`, `charged_cents`, the token
  fee, the spend gauge, and Trajectory attribution, because their semantics
  differ.
- Trajectory spend uses `trajectory.turn.cost.usd.additive` and never the
  latest gauge. It requires `trajectory.cost_contract:v2` and
  `trajectory.cost_role:attribution`.
- Grouped queries use the real user and model tags of each binding. They do
  not invent an `N/A` group.
- Active-user totals come from one source or a set union by standard user. They
  are never added up.
- Trace and span views show route and overlap context. They do not compute
  totals from spans.
- Tests cover direct, gateway, cloud provider, unknown, mixed, missing-tag, and
  client telemetry cases.
- Tests cover source event replay, corrected snapshots, providers with only
  activity, unavailable cost, and a provider session with several distinct
  actions.

## Anti-Patterns

- Do not deduplicate by model name.
- Do not deduplicate by span name, such as `inference-0`.
- Do not deduplicate cost by provider session ID or conversation ID alone.
- Do not turn a missing cost field into `$0`.
- Do not add two revisions of the same provider snapshot.
- Do not treat `trajectory.provider:anthropic` alone as evidence of overlap.
- Do not hide `unknown`, `mixed`, or missing-tag data automatically.
- Do not use cost-overlap tags in place of sensitive route configuration.
- Do not assume that Trajectory attribution and provider billing have the same
  cardinality or timing.
