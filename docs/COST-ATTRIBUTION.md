# Cost Attribution and Dashboarding

This guide explains which Trajectory cost metrics are additive, which are
overlapping associations, and how to build Datadog dashboards without inflating
spend. For the concise built-in workflow, run:

```bash
trajectory user-guide cost-attribution
```

## The Two Independent Overlap Problems

Trajectory dashboards must handle two different forms of overlap. Solving one
does not solve the other.

### Source overlap

Trajectory attribution, native client telemetry, provider analytics, gateway
analytics, and cloud billing may describe the same underlying model usage.
Choose one source family for a total. Use `trajectory.cost_role`,
`trajectory.cost_dedupe_group`, and the other cost-overlap tags described in
[Cost Overlap Consumer Guide](COST-OVERLAP-CONSUMER-GUIDE.md).

Trajectory's metric outbox provides local delivery idempotency for
authoritative v2 additive `.total` cost points: one logical point per canonical
turn/session grain across restart, retry, destination rename, transport change,
and timestamp drift. It does not deduplicate provider billing, gateway, native
client, or other provider and platform sources against one another. Cross-source exact
deduplication still requires a shared request/event identity; otherwise use the
reconciliation levels below and fail closed on an authoritative combined total.

Do not overload stream source with pricing source. Current Trajectory
turn-derived cost uses `trajectory.cost_source:turn_metrics` regardless of the
rate-card owner. The independent `trajectory.pricing_source` tag identifies
`organization_rate_card`, `local_rate_card`, `public_rate_card`,
`provider_reported`, or another bounded pricing authority. Cursor native rate
cards also carry `trajectory.cost_method:four_component_token_rate_card`,
`trajectory.cost_fidelity:token_derived`, the selected economic
`trajectory.cost_basis`, and a bounded `trajectory.pricing_version`.

An explicit unpriced Cursor decision emits no turn USD sample. A partially
priced Cursor session emits no complete session USD metric, and a legitimate
priced zero remains a priced numeric sample. Use
`trajectory.cursor.token_capture.turns_total`,
`trajectory.pricing.lookup.total`, and the session priced/unpriced turn gauges
for coverage; do not replace missing USD with zero. The lookup metric separates
exact observed aliases from approved canonical models and carries bounded
thinking, speed, billing, and context dimensions. A heuristic equivalence
candidate remains unpriced until org config adds an exact mapping and rate.

### Owner association overlap

A file, turn, commit, or PR can involve multiple CODEOWNERS. Trajectory creates
one association with every retained owner; it does not invent a fractional
allocation. A turn involving three owners can therefore appear in all three
owner groups.

Owner-grouped values answer:

> How much observed work involved this owned area?

They do not answer:

> What mutually exclusive share of the bill belongs to this owner?

Datadog formulas operate on the metric series returned by queries. Once one
unit of work is represented in multiple owner series, no dashboard formula can
reconstruct a unique total without a separate exclusive key or allocation
policy. “Deduplicating” an owner dashboard therefore means using the canonical
ungrouped metric for totals, not summing owner groups.

There is no honest formula for mutually exclusive owner allocation in the
current data. `sum`, `max`, `avg`, distinct owner counts, and equal division all
either double-count work or silently invent an allocation policy. A dashboard
must state this plainly anywhere owner-associated cost is shown.

## Metric Classes

### Canonical additive totals

Use an ungrouped canonical metric for totals, budgets, denominators, and alert
thresholds. Choose one grain and source family for each widget.

Current general cost examples:

```text
trajectory.turn.cost.usd.additive
trajectory.session.cost.usd.total
```

Do not add turn and session cost metrics together; they are different views of
the same sessions. For a turn-based spend total, use only the additive COUNT
metric. For completed-session percentiles, use the session distribution.

Trajectory emits this canonical PR-work total:

```text
trajectory.pr.work.cost.usd.total
```

It is the non-duplicated sum of completed turns with one primary PR assignment.
The same projection emits assigned duration and token totals plus explicit PR
interaction counts; see [Metrics Reference](METRICS-REFERENCE.md).

It is canonical only inside the PR-work projection. PR work cost reuses base
turn cost; it is not incremental spend. Never add it to turn cost, session
cost, or the legacy creation-tail PR cost metrics.

### Client cost coverage and Codex

Under the v2 usage-integrity contract, the monetary cost metrics
(`trajectory.turn.cost.usd*`, `trajectory.session.cost.usd*`) emit only for
turns that carry an explicit priced cost attribution
(`trajectory.cost_role:attribution`, `trajectory.cost_contract:v2`). Token and
session-count metrics are pricing-independent and always emit. A model with no
known price therefore shows tokens and sessions but an empty cost tile - the
metric is suppressed rather than reported as a misleading zero.

Codex cost is token-derived from the published OpenAI rate card. Codex model
IDs price at the base model's rates, including `-codex` variants - e.g.
`gpt-5.4-codex` prices as `gpt-5.4` - provided the base model is in the rate
card. A model absent from the card (for example a new flagship before its rate
lands) is fail-closed unpriced and emits no cost metric. Codex turns attach an
explicit priced token-derived attribution, so priced Codex cost enters the
authoritative attribution lane above rather than only the legacy untagged
`trajectory.turn.cost.usd.total`.

The `trajectory cost` warning `N Codex sessions use a stale cost derivation and
are excluded` is a **local display** exclusion: a session whose stored
`cost_derivation_version` predates the current Codex derivation is left out of
the local total until `trajectory backfill --from-codex-sessions --force`
re-derives and re-publishes it. Staleness gates the local summary, not metric
emission - already-published cost metrics are unaffected.

### Exclusive coverage partitions

Coverage metrics partition canonical PR work exactly once per qualifying turn.
Trajectory emits four attributed/unattributed pairs:

```text
trajectory.pr.work.codeowner_attributed_turns.total
trajectory.pr.work.codeowner_unattributed_turns.total
trajectory.pr.work.codeowner_attributed_cost.usd.total
trajectory.pr.work.codeowner_unattributed_cost.usd.total
trajectory.pr.work.codeowner_attributed_input_tokens.total
trajectory.pr.work.codeowner_unattributed_input_tokens.total
trajectory.pr.work.codeowner_attributed_output_tokens.total
trajectory.pr.work.codeowner_unattributed_output_tokens.total
```

These may be added together because one turn contributes to exactly one side.
They are appropriate for coverage percentages and data-quality widgets, not
owner allocation. Under identical filters and time windows, each pair sums to
its canonical PR-work measurement: turns, cost, input tokens, or output tokens.

`Unattributed` means no eligible current-session production-owner evidence was
available for the turn. It does not necessarily mean the repository has no
CODEOWNERS file. The five-owner cap can make an owner ranking incomplete while
coverage still correctly counts the turn as attributed: coverage tests the
complete eligible owner set before the cap, not only the five retained owners.

### Owner association metrics

General owner relationship metrics include:

```text
trajectory.codeowner.associations.total
trajectory.codeowner.files.total
```

They count relationships and owned-file involvement. The current PR-production
family adds spend and token involvement:

```text
trajectory.codeowner.pr.production.turns.total
trajectory.codeowner.pr.production.cost.usd.total
trajectory.codeowner.pr.production.input_tokens.total
trajectory.codeowner.pr.production.output_tokens.total
trajectory.codeowner.pr.production.cache_read_tokens.total
trajectory.codeowner.pr.production.cache_creation_tokens.total
```

Each metric emits one scalar `trajectory.codeowner` per retained owner and
finalized PR context. The values are intentionally non-exclusive: a co-owned
turn contributes its full value to every involved retained owner. Filter or
rank these series, but never sum owner groups to produce global cost, budgets,
chargeback, allocation, or coverage denominators.

All owner-production and coverage series carry `source:prwork`, normalized PR
identity (`change_host`, Git repository `owner`, `repo`, `change_number`),
`context_source`, `work_context_mode`, `identity_confidence`,
`signal_confidence`, `local_range_status`, `trajectory.codeowner_scope:pr`,
`trajectory.codeowner_source`, `trajectory.codeowner_status`, and
`trajectory.codeowner_truncated`. Owner-production series additionally carry
`trajectory.codeowner` and `trajectory.codeowner_kind`. Cost/token series carry
`trajectory.cost_role:attribution` and the bounded provider/overlap tags when
available; the two turns metrics intentionally do not.

## Datadog Dashboard Recipes

Datadog dashboard metric queries support tag filtering, grouping, arithmetic,
and formulas. Use formulas for ratios between exclusive queries; do not use
them to claim uniqueness across overlapping owner groups. See Datadog's
[dashboard querying guide](https://docs.datadoghq.com/dashboards/querying/)
for query and formula mechanics.

### Start from the packaged dashboard

Export the dashboard templates that ship with the current binary, then import
the raw JSON through Datadog or use the MCP-shaped payload with the Datadog MCP
dashboard tool:

```bash
trajectory dashboard export --type enterprise --output trajectory-enterprise.json
trajectory dashboard export --type developer --output developer-dashboard.json
trajectory dashboard export --type data-fidelity --format mcp --output trajectory-data-fidelity-mcp.json
```

Run `trajectory user-guide dashboards` for the complete export and import
workflow. The enterprise dashboard includes the `PR Work & CODEOWNER
Attribution` panel, the developer dashboard uses canonical PR work plus a
non-additive owner-involvement view, and the data-fidelity dashboard includes
the `PR CODEOWNER Fidelity` coverage, reconciliation, status, truncation, and
dropped-owner diagnostics. Whether you use a packaged template or a custom
dashboard, the canonical/owner/coverage rules below are the same. Templates
visualize metrics; they do not enable collection or create missing historical
points.

### Total attributed coding-agent cost

Use a Query Value or Timeseries widget with one source family and one grain:

```text
sum:trajectory.turn.cost.usd.additive{trajectory.cost_contract:v2,trajectory.cost_role:attribution}.as_count()
```

Managed historical correction uses the separate COUNT namespace
`trajectory.historical.turn.cost.usd.additive`. Always filter it to one
authoritative `campaign_id`, `trajectory.cost_contract:v2`, and
`trajectory.cost_role:attribution`, then use `.as_count()`. Do not blend it with
the live additive metric over overlapping timestamps. Historical gauge and
distribution points are not rewritten; successor campaigns replace the
dashboard campaign filter instead of attempting in-place correction.

This metric name is Trajectory's turn-cost attribution stream. Do not add
client-native metrics, provider billing, or the completed-session metric to
this query. The positive `trajectory.cost_contract:v2` selection is the
authoritative cutover: old legacy samples remain untagged, while current generic
backfill and provider-history replay emit no attribution token/cost samples.
Both therefore stay out of the total. Create separate legacy/unverified or provider
comparison widgets when those sources are useful; do not broaden the
authoritative query to include missing contract or role tags.

For Cursor, this query contains only newly captured turns that reached an
explicit priced decision in managed `emit` mode. It does not contain
workspace/cloud activity or historical replay. Show the Cursor organization
ledger and local capture/pricing coverage separately rather than adding them
to the local attribution stream.

### CODEOWNER involvement

For general owner relationship data, use a flat Top List:

```text
sum:trajectory.codeowner.associations.total{trajectory.codeowner_scope:pr}
  by {trajectory.codeowner}.as_count()
```

Suggested title:

> PR scopes involving each CODEOWNER - non-additive

For current PR-production cost involvement, use a separate flat Top List:

```text
sum:trajectory.codeowner.pr.production.cost.usd.total{source:prwork}
  by {trajectory.codeowner}
```

Suggested title:

> Production cost involving each CODEOWNER - overlapping, do not sum

Use a flat Top List only. Do not use a stacked timeseries, stacked bar, pie,
sunburst, query value that sums the groups, or a table with a total row: each
would visually or numerically imply an additive whole. A Top List ranks the
overlapping groups without inventing one. See the Datadog
[Top List widget guide](https://docs.datadoghq.com/dashboards/widgets/top_list/).

### CODEOWNER coverage

Using the same `source:prwork` filter in every query, define:

```text
a = sum:trajectory.pr.work.codeowner_attributed_cost.usd.total{source:prwork}
u = sum:trajectory.pr.work.codeowner_unattributed_cost.usd.total{source:prwork}
c = sum:trajectory.pr.work.cost.usd.total{source:prwork}
```

Then show:

```text
100 * a / (a + u)
```

Widget title:

> Percent of PR work cost with production CODEOWNER evidence

Description:

> Exclusive coverage partition. Attributed means at least one eligible
> current-session production CODEOWNER before the five-owner display cap.

The denominator is exclusive because it is `attributed + unattributed`; it is
not a sum across owners. Add a Query Value using `a + u - c` titled
`PR work CODEOWNER coverage reconciliation (expected 0)`. A non-zero result
means the filters, time aggregation, or rollup differ. The same invariant holds
for turns, input tokens, and output tokens by substituting the matching three
metric names.

Recommended widgets:

| Widget | Query/formula | Required description |
| --- | --- | --- |
| Canonical PR work cost | `sum:trajectory.pr.work.cost.usd.total{source:prwork}` | `Canonical ungrouped PR-work projection; do not add to turn/session/creation-tail cost.` |
| CODEOWNER production involvement | `sum:trajectory.codeowner.pr.production.cost.usd.total{source:prwork} by {trajectory.codeowner}` | `Overlapping owner association; flat Top List only; never sum groups.` |
| Production coverage | `100 * a / (a + u)` | `Exclusive attributed/unattributed partition; eligible owner evidence is evaluated before cap.` |
| Coverage reconciliation | `a + u - c` | `Expected 0 under identical filters and time aggregation.` |

### Cap and overflow diagnostics

Every scope computes the complete eligible owner set, retains the top five in
deterministic rank order, and persists exact eligible, retained, dropped, and
truncated values. Use these diagnostics at PR grain:

```text
sum:trajectory.codeowner.truncated.total{trajectory.codeowner_scope:pr}.as_count()
sum:trajectory.codeowner.owners.dropped{trajectory.codeowner_scope:pr}
```

`trajectory.codeowner_truncated:true` on a production/coverage point means the
PR summary had more than five eligible owners. Truncation changes which owner
series are visible; it does not move the turn to the unattributed coverage
bucket. A turn with six eligible owners remains attributed even though only
five owners are retained for public grouping.

### Privacy-safe evidence diagnostics

Diagnose missing ownership with bounded status and source dimensions, not raw
repository evidence. For example:

```text
sum:trajectory.codeowner.scopes.total{trajectory.codeowner_scope:pr}
  by {trajectory.codeowner_status,trajectory.codeowner_source}.as_count()

sum:trajectory.codeowner.truncated.total{trajectory.codeowner_scope:pr}
  by {trajectory.codeowner_source}.as_count()
```

PR-production and coverage points also expose bounded context diagnostics such
as `context_source`, `work_context_mode`, `identity_confidence`,
`signal_confidence`, and `local_range_status`. These dimensions describe the
derivation state. They never contain a command, path, ref, object ID, diff,
CODEOWNERS pattern, or source content. Do not create custom tags from those raw
local values to make a dashboard more detailed.

At session end, `trajectory.codeowner.resolution_failures.total` counts
resolution failures by `trajectory.codeowner_scope`, bounded
`trajectory.codeowner_failure_reason` (`missing`, `parse_error`,
`snapshot_store_error`, or `change_files_unavailable`), and bounded
`trajectory.codeowner_snapshot_source` (`session_head`, `persisted_snapshot`,
or `pr_turn_range`). These are categorical diagnostics only. Locally,
`trajectory audit --source-data` reports the same failure categories and
counts; it does not display paths, Git object IDs, CODEOWNERS contents, or
source content.

### Owner filtering without false totals

A dashboard template variable for `trajectory.codeowner` can filter the
association widget and related trace links. Keep the global total widget on the
canonical ungrouped metric. Filtering the owner widget to one team answers
“work involving this team”; it does not establish that the displayed amount
belongs only to that team.

## Required Widget Labels

Every owner-cost widget must include one of these statements in its title or
description:

- `Overlapping owner association; do not sum across owners.`
- `Involvement, not mutually exclusive allocation.`
- `Global total uses the canonical ungrouped PR work metric.`

Avoid these labels unless a future allocation policy exists:

- `team spend total`
- `allocated cost`
- `chargeback`
- `share of bill`
- `deduplicated owner cost`

## Dashboard Review Checklist

Before publishing a Trajectory cost dashboard:

- Select exactly one cost source family for each total.
- Follow the source registry, upstream configuration, and reconciliation-level
  contract in [Cost Overlap Consumer Guide](COST-OVERLAP-CONSUMER-GUIDE.md)
  or `trajectory user-guide cost-reconciliation`.
- Select exactly one grain for each total; do not add turn, session, and PR
  views of the same usage.
- Use canonical ungrouped metrics for totals, budgets, denominators, and alerts.
- Use owner association metrics only for filtering, ranking, comparison, and
  “involves this owner” analysis.
- Use a flat Top List only for owner cost; never stack or sum owner groups.
- Build coverage from exclusive attributed/unattributed metrics, not owner
  groups.
- State whether a widget shows attributed cost or provider-billed cost.
- Add a note explaining the five-owner cap and expose truncation diagnostics.
- Diagnose gaps with bounded source/status tags; never promote paths, commands,
  refs, object IDs, patterns, or source text into dashboard tags.

## Evidence and privacy boundary

Production ownership is derived locally from successful writes and exact files
in eligible immutable commit evidence produced during the session. Entry
baselines, downloaded PR contents, fetch/pull/switch/rebase/reset imports, and
merge or cherry-pick operations alone do not become this user's production.
Trajectory resolves the stored CODEOWNERS snapshot locally and publishes only
bounded owner identities and counters. It does not call a provider API, reuse
GitHub/GitLab credentials, or publish source content, CODEOWNERS patterns,
commands, paths, refs, object IDs, diffs, or email owners.

Read/search attribution remains a later, separately labeled investigation
contract. It must not be mixed into these production metrics.

## Managed `pr_attribution` v2 records

Managed record-enabled destinations receive one schema-v2 record per finalized
durable context. The public repository namespace is `repo_owner`; Git
repository `owner` and CODEOWNER identity are never overloaded. The parallel
`codeowners` and `codeowner_kinds` arrays contain at most five normalized
identities without leading `@`, while eligible, retained, dropped, and
truncated fields preserve the exact cap state. Emission requires finalized
spend and CODEOWNER projection version 2.

The record ID is deterministically derived from session, generation, context,
and schema version, so live retry and backfill use stable dedup identity.
`retroactive_membership:true` means only that record's `creation_window`
context includes bounded earlier primary turns. It does not rewrite turn-root
spans already accepted by the cloud before PR identity was known.

## No Allocation Policy Yet

Trajectory does not currently divide one turn's cost among co-owners. Equal
splits, file-count weighting, line-count weighting, and “primary owner” rules
would each encode a policy choice that CODEOWNERS itself does not provide.

If a mutually exclusive allocation is required in the future, it needs a
separate product contract, an explicit allocation method, and metrics emitted
with that method. It cannot be derived honestly from the current association
series alone.
