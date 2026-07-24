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

Provider activity integrations are a separate axis. An audit webhook can fill
web-agent session and action gaps without being a cost source. The UI should
retain those activity records, join them into user-visible sessions when the
provider supplies a correlation ID, and refuse to synthesize billed cost from
missing cost fields.

## Core Rule

Never sum cost series across roles by default.

This guide addresses overlap between telemetry and billing source families. It
does not deduplicate CODEOWNER groups. `trajectory.cost_dedupe_group` cannot
turn overlapping owner associations into mutually exclusive allocations. For
owner additivity, coverage, and dashboard recipes, use
[Cost Attribution and Dashboarding](COST-ATTRIBUTION.md).

Use `trajectory.cost_role` as the first partition:

| Role | Meaning | Default UI treatment |
|---|---|---|
| `attribution` | Trajectory-derived local cost attribution | Use for user, project, session, turn, and model breakdowns. |
| `client_telemetry` | Native client telemetry proxied through Trajectory | Show as a separate source or validation stream. |
| Missing | Legacy or non-overlap-aware series | Keep visible only in a legacy/unverified investigation view; exclude from authoritative totals. |

Trajectory turn-derived cost metrics from current publishers always carry
`trajectory.cost_role:attribution` and
`trajectory.cost_source:turn_metrics`. Missing roles or sources therefore
identify legacy/external or separately sourced series, not another Trajectory
stream that should be added to totals.

For total-spend cards, choose one source family for the card. Do not add
Trajectory attribution to client telemetry, provider analytics, gateway
analytics, or cloud billing totals unless the user explicitly requests an
un-deduped comparison.

## Important Tags

| Tag | Use in UI decisions |
|---|---|
| `trajectory.cost_role` | Primary partition for attribution vs native client telemetry. |
| `trajectory.cost_contract` | Positive integrity contract. Authoritative Trajectory totals require `v2`; generic backfill and legacy history omit it. |
| `trajectory.cost_dedupe_group` | Stable grouping key for possible overlap buckets, for example `anthropic:direct`. |
| `trajectory.cost_overlap_risk` | Main automatic dedupe signal. |
| `trajectory.provider_cost_visibility` | Tells which external billing surface may contain the same spend. |
| `trajectory.provider_route` | Route label for filters and badges. |
| `trajectory.cost_dedupe_confidence` | Controls whether automatic behavior is safe or should be review-only. |
| `trajectory.cost_source` | Source-family label for overlapping cost streams; native Claude telemetry proxied by Trajectory uses `claude_native_otlp`. |

Use `trajectory.cost_dedupe_group` rather than raw model, service, or provider
text for dedupe grouping. Model names can change within the same billing route;
the dedupe group is intentionally stable and low-cardinality.

The group is a route bucket, not an event identity. Likewise,
`trajectory.cost_dedupe_confidence` is confidence in route classification, not
confidence that two metric points are the same charge. Exact record-level
deduplication requires a stable request/event identity shared by the sources.
The currently available aggregate metrics do not provide that identity across
Trajectory, Claude native OTel, Anthropic analytics, and Cursor Admin.

PR-work and owner-production cost metrics are derived projections of
Trajectory attribution, not new billing sources. They use the same
`trajectory.cost_role:attribution`, `trajectory.cost_source:turn_metrics`, and
bounded route/overlap vocabulary as their contributing turn cost. A mixed contributing
set reduces to the documented `mixed` values. These source-overlap tags do not
make owner groups additive.

## Source Selection Versus Reconciliation

Agent Console must keep these operations separate:

1. **Availability:** Does this source have data for this agent, signal, scope,
   and time window?
2. **Selection:** Which one source answers the requested product question?
3. **Comparison:** How do separately labeled sources differ after their scopes
   are aligned?
4. **Deduplication:** Can records be matched by a shared stable identity before
   aggregation?

Current Agent Console cost views should implement availability, exclusive
selection, and side-by-side comparison. They must not claim record-level
deduplication. Matching only by email, model, and timestamp is heuristic and is
not safe for authoritative spend.

Activity correlation and cost reconciliation are different operations. A
provider session ID can join a query, answer, and agent action while still
being too coarse to prove which model request or economic charge overlaps a
client-observed turn.

The managed Trajectory cost-fidelity heartbeat does not change this rule. Its
three leg metrics validate native-to-capture, capture-to-outbox, and delivery
separately for a privacy-eligible local cohort. They do not mint a shared
request identity across Trajectory, gateway, provider, native-client, and cloud
billing sources, and they must not be used as an employee-spend total.

Before using provider, gateway, cloud, or Cursor organization data as a total,
align account/workspace, route, product, currency, included/BYOK/failed usage
policy, event-time window, time zone, and late/replayed data behavior. A
difference in coverage is not automatically a pricing error.

For customers with different upstream collection:

- if exactly one authoritative cost source is available, select it exclusively;
- if multiple sources share a stable request/event identity, reconcile at that
  identity before aggregation and report unmatched coverage;
- if sources have only route/time/user/model overlap, keep them side by side and
  label the comparison heuristic-do not add or auto-deduplicate them;
- if BYOK, included usage, failed requests, currency, workspace, event time,
  late-arrival, or replay policy differs, align those scopes before comparing;
- if required provenance is absent, show an unverified/coverage state rather
  than zero, “deduplicated,” or an authoritative combined total.

## Agent Console Source Registry

Agent Console currently treats an array of metric names as additive. Replace
that implicit behavior with an explicit registry and per-signal policy. Do not
reuse the widget query field named `data_source`; call the provenance field
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

Authority belongs to a signal policy, not globally to one producer. Provider
analytics may be preferred for cost while Claude OTel or Trajectory is
preferred for session activity.

Every binding must declare source, signal, unit, value semantics, and overlap
group. Remove bare string metric bindings or normalize them through an
explicit source-specific helper. A missing provenance field must not silently
default to an `integrations` bucket.

An activity-only or usage-only source must not register a `cost_usd` binding.
Missing cost is an unavailable signal, not a zero-valued cost point.

## Canonical Record And Matching Contract

Future exact reconciliation should happen on canonical records before metrics
are aggregated. At minimum, preserve:

| Field | Purpose |
|---|---|
| Source, account/workspace scope, and `sourceRecordId` | Idempotent ingestion of the same upstream record |
| `sourceRevision` and `sourceObservedAt` | Replacement ordering for corrected events or refreshed snapshots |
| `sourceIngestedAt` | Delivery-lag and replay diagnostics; never a substitute for event time |
| Canonical and source user IDs | Explicit identity mapping without treating raw email as a record key |
| Session/conversation and parent-action IDs | Activity correlation |
| Canonical request/charge ID, when actually shared | Exact cross-source cost matching |
| Signal, value, unit, currency, and value semantics | Prevent counts, gauges, deltas, distributions, and snapshots from being combined |
| Cost role, authority, scope, and overlap group | Select one answer for a product question without deleting useful attribution |
| Coverage window and time zone | Align aggregates and revisioned reports |

Use the strongest matching rule supported by the records:

1. **Source replay:** same source, account scope, and source record ID means one
   record. Keep the newest documented revision.
2. **Exact cross-source match:** a shared canonical request or charge ID,
   compatible signal semantics, and aligned account/product scope can select
   one cost authority while retaining the other record for provenance.
3. **Aggregate selection:** aligned account, product, currency, dimensions,
   and half-open time window can select one source for the total, but cannot
   remove individual records as duplicates.
4. **Heuristic comparison:** user, model, and time proximity can explain
   coverage or variance only. It cannot drive an authoritative dedupe.

For cost views, classify authority explicitly, for example:
`provider_billed`, `provider_rated`, `client_reported`,
`local_exact_rate`, `local_estimate`, or `none`. This is not a universal
ranking across all questions. Provider billing can own an organization total
while local exact-rate attribution owns the session breakdown. The resolver
chooses one authority for each signal, scope, grain, and view.

### Revisioned aggregates

Provider APIs and scheduled SaaS reports often restate an earlier window.
Treat a later record as a replacement, not an additive event, when it has the
same source, account, product, currency, window, dimensions, and snapshot key.
Keep the previous version for audit history but exclude it from the current
total. If the provider does not document revision or watermark behavior, mark
the window provisional until its settlement policy is known.

## Resolver Contract

Resolve one plan per agent, signal, view, and time window before constructing
the value query:

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

The resolver must enforce:

1. `auto` chooses the first available source in the signal policy.
2. `explicit` uses exactly the requested source. If it is unavailable, return
   an unavailable state instead of zero or a silent fallback.
3. `compare` keeps one separately labeled formula/column per source. It never
   produces a combined scalar total.
4. Bindings from different sources in the same `overlapGroup` are mutually
   exclusive.
5. `additive_component` bindings may be added only when they share both a
   telemetry source and `compositionGroup`.
6. A valid zero is data and never triggers fallback.
7. Resolve availability before the value query. Neither
   `default_zero(primary) + fallback` nor `max(primary, fallback)` selects a
   source safely.
8. Active-user counts use one source or a set union over canonical user IDs;
   never add source-level active-user counts.
9. Model option lists may union and deduplicate names, but Model Usage values
   still follow the resolved cost source.

Resolve the plan once at the Agent Console page boundary. Dashboard totals,
Model Usage, User Analytics, agent details, and user/team side panels must
receive the same effective plan rather than independently querying all metric
bindings.

## Agent Console Metric Mappings

### Claude Code

| Source | Cost metric | Identity tags | Recommended role |
|---|---|---|---|
| `anthropic_usage` | `anthropic.user_cost.amount` | `user_email`, `model` | Preferred provider-cost view after scope validation |
| `claude_otel` | `claude_code.cost.usage` | `user.email`, `model`, and `session.id` when present | Native client telemetry and activity |
| `trajectory` | `trajectory.turn.cost.usd.additive` filtered to `trajectory.client_source:claude-code` | `trajectory.user_email`, `gen_ai.request.model`, `session_id`, `trajectory.turn_id` | Local attribution and drilldown |
| `claude_code_integration` | Legacy `claude_code.*` cost series | `actor_email`, `model`, `repo` | Legacy fallback only |

Suggested source priority is per signal:

```text
cost_usd: anthropic_usage -> claude_otel -> trajectory -> claude_code_integration
sessions/commits/pull_requests/activity: claude_otel -> trajectory -> claude_code_integration
input/output/cache tokens: anthropic_usage -> trajectory
```

The product owner may choose Trajectory first for an attribution view. The key
invariant is that only one source appears in an authoritative cost request.

```text
# Provider aggregate
sum:anthropic.user_cost.amount{product:claude_code} by {user_email,model}.as_count()

# Native client telemetry
sum:claude_code.cost.usage{*} by {user.email,model}.as_count()

# Trajectory completed-turn attribution
sum:trajectory.turn.cost.usd.additive{trajectory.cost_contract:v2,trajectory.cost_role:attribution,trajectory.client_source:claude-code,trajectory.cost_source:turn_metrics}.as_count()
  by {trajectory.user_email,gen_ai.request.model}
```

Do not query `trajectory.turn.cost.usd` for spend totals. It is a latest-value
gauge. `.total` is one non-cumulative completed-turn sample and is the additive
time-window metric. If one series reports `$1`, `$2`, and `$3`, the latest
gauge is `$3`; the three completed-turn samples sum to `$6`. `.total` is not a
running session total and therefore does not re-add earlier turns.

### Cursor

| Source | Metric | Semantics | Treatment |
|---|---|---|---|
| `cursor_usage` | `cursor.usage_events.total_cents` | Gross model economic usage | Sum events; do not label billed cash |
| `cursor_usage` | `cursor.usage_events.charged_cents` | Provider-rated event debit | Candidate provider-rated usage view |
| `cursor_usage` | `cursor.usage_events.cursor_token_fee` | Fee component already represented in `charged_cents` | Never add to `charged_cents` |
| `cursor_usage` | `cursor.spending.spend_cents` | Current-cycle on-demand-spend gauge | Latest value for one cycle; never sum over time |
| `trajectory` | `trajectory.turn.cost.usd.additive` filtered to `trajectory.client_source:cursor` | Local observed-turn token-derived attribution when complete and exactly priced | Attribution ledger; never add to Cursor organization cost |

There is no current event ID shared by Cursor Admin and a Trajectory turn.
User/model/time-bucket comparison is aggregate calibration, not per-turn
deduplication.

```text
# Cursor gross model economic usage
sum:cursor.usage_events.total_cents{*} by {user_email,model}.as_count()

# Trajectory local observed-turn attribution
sum:trajectory.turn.cost.usd.additive{trajectory.cost_contract:v2,trajectory.cost_role:attribution,trajectory.client_source:cursor,trajectory.cost_source:turn_metrics}.as_count()
  by {trajectory.user_email,gen_ai.request.model}
```

The formula, public-rate provenance, organization-card override, and shadow
gates are documented in `trajectory user-guide cursor-cost`.

Cursor request counts, tool uses, and web searches are different signals. Do
not reuse one metric array for all three because they currently appear under a
shared API-request field.

## Agent Console Change Locations

The implementation should update these Agent Console responsibilities:

| Location | Required change |
|---|---|
| `lib/agent/agent.types.ts` | Require `telemetrySource`, signal, semantics, unit, overlap, and composition metadata; remove implicit bare-string provenance. |
| `toolkit/user-panel/agents/claude-code-agent.ts` | Replace additive cost bindings with per-signal source policies and use Trajectory `.total`. |
| `toolkit/user-panel/agents/cursor-agent.ts` | Separate gross, charged, fee, spend-gauge, and Trajectory bindings; never add source families. |
| `AgentConsolePageV2.heavy.tsx` | Resolve one page-level source plan before passing agents/data to dashboard and analytics views. |
| `get-total-spend.scalar-request.ts` | Build the scalar from the selected source/composition group only. |
| `get-model-usage.tile-def.ts` | Use the same resolved cost plan as Total Spend; do not add model groups across sources. |

Current source filtering only affects User Analytics. The dashboard, Model
Usage, detail pages, and side panels must inherit the same plan for the fix to
be complete.

## SaaS Activity Streams

A provider audit stream should have its own source definition and signal
bindings. It can participate in activity source selection without becoming a
cost fallback.

For a Perplexity-style webhook:

- use the provider event UUID for delivery idempotency;
- use the provider session ID to correlate query, answer, and agent-action
  events;
- count each distinct event according to its event type;
- preserve model metadata as activity context;
- emit no `cost_usd` binding when tokens, price, currency, and billing
  semantics are absent; and
- do not suppress a client-attributed cost merely because both sources refer
  to the same visible session.

If a separate provider usage/cost export is added later, register it as a
separate source with its real unit and semantics.

Perplexity Computer Analytics currently supplies complete UTC hour or day
buckets for credits and activity categories, plus per-member daily credit
usage. The source is periodically synchronized and a recent zero can mean "not
synced yet." Register credits as a provider consumption signal, not
`cost_usd`; `paid` and `promo` are credit-source dimensions, not a currency or
cash amount. Its bucket has no documented request or audit-event ID, so it
supports provider-credit totals and aggregate comparison, not exact matching
to audit events or client turns.

If a provider later adds currency-denominated usage or billing, prefer it for
provider-rated or billed total views only after validating its account,
product, currency, inclusion, window, refresh, and settlement semantics.
Without a shared request or charge ID, keep local session attribution and
provider totals at their respective grains.

### SaaS integration contract gate

Before an Agent Console source is enabled, its discovery and implementation
must document:

- source capabilities: activity, provider usage, cost, or any explicit
  combination;
- supported signals and the exact grain of each value;
- account, workspace, product, route, and user scope;
- stable event IDs, session/request relationships, and parent-child semantics;
- delivery retry, ordering, replay, backfill, and retention behavior;
- event time, ingestion time, source time zone, and bucket boundaries;
- correction, revision, snapshot, watermark, and settlement behavior;
- cost authority, currency, included/free/failed/BYOK policy, and whether the
  value is gross, charged, estimated, or billed;
- schema versioning, payload validation, privacy classification, and
  customer-controlled content collection; and
- a dual-source canary that proves source selection, unmatched coverage, and
  zero-vs-unavailable behavior before default totals change.

Unknown answers are allowed during discovery, but they must produce an
explicit provisional or review-required state rather than an inferred dedupe
rule.

## Customer Configuration Variants

Support all of these without changing the resolver invariants:

- **Static product defaults:** registry and source priorities live in web-ui.
  This is acceptable initially but cannot express organization-specific
  instrumentation.
- **Organization policy:** configuration supplies preferred sources per
  agent/signal. It may reorder sources but cannot make overlapping sources
  additive.
- **Backend-resolved policy:** preferred long-term; one endpoint returns the
  effective source, available candidates, coverage, and reason for every
  agent/signal/window, and all views consume it.
- **Canonical upstream records:** required for future exact record-level
  deduplication. Records need canonical and source event IDs, canonical user,
  agent, session/turn/request, model, timestamp, signal, value, unit, source,
  and ingestion time before aggregation.

An organization policy can look like:

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
| Provider audit/activity stream with no cost fields | N/A | Use for activity coverage only; do not create a cost series or use it as a zero-cost fallback. |
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
  `trajectory.cost_contract:v2,trajectory.cost_role:attribution`.
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
| Trajectory attribution totals | `trajectory.cost_contract:v2`, `trajectory.cost_role:attribution` |
| Native client telemetry totals | `trajectory.cost_role:client_telemetry` |
| Direct Anthropic attribution | `trajectory.cost_role:attribution`, `trajectory.provider_route:direct` |
| Gateway-routed attribution | `trajectory.cost_role:attribution`, `trajectory.provider_route:llm_gateway` |
| Cloud-provider-routed attribution | `trajectory.cost_role:attribution`, `trajectory.provider_route:bedrock` or `vertex` or `foundry` |
| Likely aggregate-billing overlap | `trajectory.cost_overlap_risk:aggregate_only` |
| Review-needed overlap | `trajectory.cost_overlap_risk:unknown` or `mixed`, missing `trajectory.cost_role`, or missing `trajectory.cost_contract` |
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

### Verifying Claude Cost Fidelity

Use `trajectory user-guide claude-cost` for the user-facing workflow. Use the
read-only CLI verifier before changing dashboard dedupe behavior for a Claude
cohort:

```bash
trajectory verify claude-cost route
trajectory verify claude-cost transcript --session <session-id>
trajectory verify claude-cost artifacts --dir <native-otel-artifact-dir>
```

Interpret the modes separately:

- `route` reports whether current Claude configuration evidence points at a
  direct Anthropic route, gateway/cloud route, or an ambiguous route. Managed
  settings are reported as blocking only when route evidence indicates gateway
  or non-local telemetry behavior; managed-settings log lines alone are not a
  native-cost failure.
- `transcript` compares Claude transcript-derived tokens and estimated cost to
  captured Trajectory JSONL and local cache rows. This validates Trajectory
  capture fidelity, but it is not an independent native Claude billing oracle.
- `artifacts` reads native OTel canary output such as
  `claude-native-otel-normalized.json`. A `direct_comparable` /
  `native_comparison:pass` result is the equality check against
  `claude_code.cost.usage`.

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
- Dashboard, Model Usage, User Analytics, details, and side panels receive the
  same resolved source plan.
- Claude cost snapshots contain only one of Anthropic, Claude OTel,
  Trajectory, or the legacy integration.
- Cursor cost snapshots never add `total_cents`, `charged_cents`, token fee,
  spend gauge, and Trajectory attribution across incompatible semantics.
- Trajectory spend uses `trajectory.turn.cost.usd.additive`, never the latest
  gauge, and requires `trajectory.cost_contract:v2` plus
  `trajectory.cost_role:attribution`.
- Grouped queries use each binding's real user/model tags and do not invent an
  `N/A` grouping dimension.
- Active-user totals are source-exclusive or set-unioned by canonical user,
  never numerically added.
- Trace/span views display route and overlap context without trying to compute
  totals from spans.
- Tests cover direct, gateway, cloud-provider, unknown, mixed, missing-tag, and
  client-telemetry cases.
- Tests cover source-event replay, corrected snapshots, activity-only
  providers, unavailable cost, and a provider session containing multiple
  distinct actions.

## Anti-Patterns

- Do not dedupe by model name.
- Do not dedupe by span name such as `inference-0`.
- Do not dedupe cost by provider session or conversation ID alone.
- Do not convert a missing cost field into `$0`.
- Do not sum two revisions of the same provider snapshot.
- Do not treat `trajectory.provider:anthropic` alone as overlap evidence.
- Do not hide `unknown`, `mixed`, or missing-tag data automatically.
- Do not use cost-overlap tags as a proxy for sensitive route configuration.
- Do not assume Trajectory attribution and provider billing have the same
  cardinality or timing semantics.
