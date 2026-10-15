# Cost Attribution and Dashboarding

Use this guide to build Datadog cost dashboards from Trajectory metrics. It
shows which cost metrics you can add up and which queries to use. Follow it so
that a dashboard does not count the same spend twice. For a short version that
is built into the binary, run:

```bash
trajectory user-guide cost-attribution
```

## The Two Independent Overlap Problems

A cost dashboard must handle two kinds of overlap: source overlap and grain
overlap. A fix for one kind does not fix the other.

### Source overlap

Several sources can report the same model usage:

- Trajectory attribution
- native client telemetry
- provider analytics
- gateway analytics
- cloud billing

Choose one source family for each total. To tell the sources apart, use
`trajectory.cost_role`, `trajectory.cost_dedupe_group`, and the other
cost-overlap tags. The
[Cost Overlap Consumer Guide](COST-OVERLAP-CONSUMER-GUIDE.md)
explains them.

The metric outbox is the local queue of metric points that wait to go to
Datadog. It keeps one v2 cost point for each turn or session. A restart, a
retry, a renamed destination, a transport change, or clock drift does not add
a second point.

The outbox does not guarantee delivery. A point can arrive late or not at all
when a send fails. The same can happen when Trajectory cannot tell whether
Datadog accepted the point. To see points that wait or that failed, run
`trajectory publish queue --kind metrics`.

The outbox removes duplicates only inside Trajectory. It does not remove
duplicates between Trajectory and provider billing, gateways, native clients,
or other upstream sources. Exact deduplication across sources needs a request
or event ID that the sources share. If they share none, use the levels in
[Source Selection Versus Reconciliation](COST-OVERLAP-CONSUMER-GUIDE.md#source-selection-versus-reconciliation).
In that case, never present a combined total of the sources as exact.

Trajectory uses separate tags for the stream source and the pricing source:

- All cost that Trajectory derives from turns has
  `trajectory.cost_source:turn_metrics`, whoever owns the rate card.
- The `trajectory.pricing_source` tag names the source of the rate. Its values
  come from a fixed set, such as `organization_rate_card`, `local_rate_card`,
  `public_rate_card`, or `provider_reported`.
- Cost from a Cursor native rate card also has
  `trajectory.cost_method:four_component_token_rate_card` and
  `trajectory.cost_fidelity:token_derived`.
- Cursor cost also has the selected `trajectory.cost_basis` and a
  `trajectory.pricing_version` from a fixed set.
- Built-in Codex public pricing has the version `codex-rollout-cost-v6`.
  Trajectory does not replace it with `other`.

Each priced attribution must name its source, method, fidelity, basis, unit,
version, and card. When Trajectory builds the base metrics, it rejects an
attribution that is missing one of these. So every v2 USD point that counts
toward a total records where its price came from.

Trajectory follows these rules for Cursor cost:

- If Trajectory decides that a Cursor turn has no price, it sends no USD sample
  for that turn.
- If only some turns in a Cursor session have a price, Trajectory sends no
  session USD metric.
- If the correct price of a turn is zero, Trajectory sends a priced sample with
  the value 0.

To measure pricing coverage, use these metrics:

- `trajectory.cursor.token_capture.turns_total`
- `trajectory.pricing.lookup.total`
- `trajectory.session.cost.priced_turns` and
  `trajectory.session.cost.unpriced_turns`

Never replace a missing USD value with zero. The lookup metric puts the
observed model name and the approved standard model in separate tags:
`gen_ai.request.model` and `trajectory.model.canonical`. Its thinking, speed,
billing, and context tags each have a fixed set of values. Sometimes
Trajectory only guesses that a model matches a priced model. The model then
stays unpriced until the organization config adds an exact mapping and a rate.

### Grain overlap

The turn, session, and PR views of cost describe the same usage at different
grains. A session cost is the sum of its turns. A PR work cost reuses the cost
of the turns assigned to that PR. Select one grain for each total. Never add
the turn, session, and PR views of the same usage.

## Metric Classes

### Additive totals

Use an ungrouped additive metric for totals, budgets, denominators, and alert
thresholds. For each widget, choose one grain (turn, session, or PR) and one
source family.

The general cost metric is:

```text
trajectory.turn.cost.usd.additive
```

Use only this additive COUNT metric for spend totals.

`trajectory.turn.cost.usd.total` and `trajectory.session.cost.usd.total` are
optional distribution samples for percentile analysis. Trajectory cannot
correct or backfill them, so never use them for totals.

To get the exact average cost of a completed session, select the completed
sessions. Then sum only the turns in those sessions. This needs a session-grain
view or a join. You can divide a window of turn cost by
`trajectory.session.completed`, but the result is only an approximation. The
two series take their timestamps at different points in the session.

### PR work totals

Trajectory sends this additive total for PR work:

```text
trajectory.pr.work.cost.usd.additive
```

Every supported PR candidate uses this one metric name. Trajectory divides the
cost of each eligible turn between the candidates with fixed evidence weights.
The shares for a turn always add up to exactly one. The confidence and the
allocation reason are tags.

`trajectory.pr.observations.total` is the matching denominator. It counts each
PR that Trajectory observed, including PRs with no price. Trajectory uses the
same shares to divide duration, the four token counters, and the fractional
counts of completed turns. Counts of explicit PR interactions keep their
meaning. See the [Metrics Reference](METRICS-REFERENCE.md).

Use `trajectory.pr.work.cost.usd.additive` only for PR views. PR work cost
reuses the base turn cost, so it is not extra spend. Never add it to turn cost,
session cost, or older PR creation cost metrics.

Trajectory sets the PR work cost of each turn as follows:

- At session end and during correction recovery, the PR work cost of a turn is
  the final value of `trajectory.turn.cost.usd.additive` for that turn.
- If that metric leaves a turn unpriced, the turn has no PR cost.
- A turn without a completed `turn_end` never reports a cost, so it has no PR
  cost.
- During a session, PR work cost uses the turn cost in the local cache. At
  session end, a signed correction replaces any difference.
- PR work never counts an estimate from content length (characters divided by
  4) as spend.
- PR work never counts a stored zero for an unpriced turn as spend.

Do not use the retired PR work distributions, either alone or with the
`.additive` series. Their old points came only from finished sessions, so they
under-report open and abandoned sessions.

Trajectory no longer publishes commit attribution metrics.

A PR correction keeps the timestamp of the completed turn. A cell is one
timestamp and tag set. The correction ledger first reverses the old value of a
cell. Then it applies the new value.

For Datadog destinations, Trajectory sends signed corrections through OTLP only
within one hour after the source turn completes. Other OTLP collectors accept
corrections of any age. Older rows stay in the queue with the reason
`unsupported_pr_source_history`. A correction's reversal and its new value are
held together, so a held correction leaves the value Datadog already has.
Datadog Historical Metrics Ingestion replaces cells, so it cannot carry signed
changes. Corrections therefore cover only
this one-hour window. The USD value comes from the stored source cost,
including any richer pricing data. Missing pricing never becomes a zero-cost
observation.

### DD Harness cost coverage

DD Harness wraps the real pi agent, so the DD Harness capture mapper
computes its own `llm_call` cost from the `model_request_ended` observation's
tokens. For a model the verified public rate card can represent, a formal
`costattribution.Attribution` is built from the standard four token
components (input/output/cache-read/cache-creation).
`ModelRequestEndedEvent` builds it explicitly the same way other generic
token-rate-card clients do. It uses
`capturecost.GenericPublicTokenRateCardForClientAt` with the request's own
observation time, plus `costattribution.PriceTokens`. The `llm_call` then
carries a real `cost_attribution` object instead of only the legacy flat
`cost_nanodollars`/`cost_source` fields.

`publish/metric_catalog_tags.go`'s existing, client-agnostic tagging then
applies `trajectory.cost_role:attribution` /
`trajectory.cost_source:turn_metrics` to the derived turn/session cost
metrics automatically. Every other client gets the same treatment, so no
DD Harness-specific metric tagging code is needed for that part.

Most of DD Harness's real-world traffic (current Claude models) has a
fifth pricing dimension: a distinct 1-hour cache-write rate. The
four-component card cannot represent it yet. This limitation of
`costattribution` predates DD Harness (Claude Code's native capture path
has the same gap). Rather than regress a real, working cost to
"unavailable" for the common case, `ModelRequestEndedEvent` detects this
and falls back to the legacy token-derived estimate. That estimate comes
from `llmcall.BuildObservedEvent`'s own internal computation, the path
Trajectory already used for every DD Harness model before this. Those
events carry no formal `cost_attribution`. Extending
`costattribution.TokenRateCard`
to a fifth component is a larger, shared package change affecting every
four-component client, not a DD Harness-scoped fix.

pi's own self-reported, metadata-priced usage
(`model_request_ended.usage.cost`) is carried as a clearly separate,
namespaced diagnostic field
(`dd_harness_pi_metadata_cost_usd`/`_role:client_telemetry`/`_source`).
It is never summed into or confused with Trajectory's own attribution
cost, and it is not given a `trajectory.cost_role`/`trajectory.cost_source`
metric tag. It never becomes a Datadog metric at all. It stays an
event-level diagnostic field. This differs from the Claude-native-OTLP
precedent below, which proxies a real, separate OTLP metrics stream
Claude's own telemetry already exports. DD Harness emits no such separate
metrics stream of its own to proxy. DD Harness's own
Datadog-sourced UI cost is a third, independent number that Trajectory never
ingests or republishes at all.

### Client cost coverage and Codex

Trajectory sends the cost metrics (`trajectory.turn.cost.usd*` and
`trajectory.session.cost.usd*`) only for turns with a priced cost attribution.
Those turns have the tags `trajectory.cost_role:attribution` and
`trajectory.cost_contract:v2`. Token and session-count metrics do not depend on
pricing, so Trajectory always sends them. For a model with no known price, a
dashboard shows tokens and sessions but an empty cost tile. Trajectory does
not report a cost of zero, because zero would be wrong.

Trajectory calculates Codex cost from token counts and the published OpenAI
rate card:

- A Codex model ID uses the rates of its base model, if the rate card has the
  base model. This includes `-codex` variants. For example, `gpt-5.4-codex`
  uses the `gpt-5.4` rates.
- A model that is not in the card stays unpriced, and Trajectory sends no cost
  metric for it. An example is a new model before its rate is added.
- Each priced Codex turn has a token-derived attribution. So
  `trajectory.turn.cost.usd.additive` includes priced Codex cost.
- `trajectory.turn.cost.usd.total` is an optional distribution sample for
  percentile analysis. The `metric_samples_turn_cost` selection controls it.
  Use the additive metric for totals.

### Codex cache tokens

In Codex `token_count` records, `input_tokens` is the total prompt. This total
includes `cached_input_tokens`, which are cache reads. Recent Codex CLI
releases also include `cache_write_input_tokens`, which are prompt-cache
writes. Trajectory first saw this in release 0.149.0. Trajectory subtracts
each of them once:

- `input_tokens` is the uncached remainder.
- `cache_read_tokens` is the cached input.
- `cache_creation_tokens` is the cache-write count.

Trajectory prices cache writes at the cache-write rate of the model. On the
GPT-5.6 and GPT-6 cards, this rate is 1.25 times the uncached input rate.
Some cards have no cache-write rate:

- On a card with no cache-write rate, Trajectory bills cache writes at the
  uncached input rate. OpenAI bills them as ordinary input on those models.
- ChatGPT Codex credit estimates also use the input credit rate for cache
  writes, because the credit card lists no cache-write rate.
- The provisional Guardian `codex-auto-review` proxy also has no cache-write
  rate. A turn with cache writes on this proxy stays unpriced, because the
  proxy has no validated billing basis.

If a rollout has no cache-write field, Trajectory keeps the split into two
parts. The cache-write value can be malformed, or larger than the uncached
input that it comes from. Then the input of the turn is unverified. Its
observed parts stay visible, but the turn is unpriced and has
`tokens_status: partial`.

### Codex cost repair

The token split is part of the Codex cost derivation `codex-rollout-cost-v6`.
When the derivation version changes, saved Codex sessions become stale. Two
repair paths derive them again from their saved rollouts:

- the Codex cost repair in the serve process
- the automatic repair in `trajectory cost`

If Trajectory no longer has the rollout of a session, the session stays stale.
[Stale Codex sessions](#stale-codex-sessions) describes the effect.

Repair keeps the billing lane of the session. The billing lane is how Codex
billed the session. The rollout does not record how Codex authenticated. Only
the session JSONL that Trajectory writes has the billing mode and the first
service tier from the live watcher:

- `session_start` and every `turn_end` have `codex_billing_mode`. Its value is
  `api`, `chatgpt_credits`, or `unknown`.
- `session_start` also has `codex_initial_service_tier`. This is the tier that
  the watcher started with, before any rollout setting applied.
- Every `turn_end` has its `service_tier`.

Both repair paths read the billing lane from the session JSONL. They rebuild
the session the same way that the live watcher builds it. Then they replay the
tier changes from the rollout `thread_settings_applied` records. This includes
a change in the middle of the first turn. As a result:

- Repair prices an API-key fast session at the API priority rate. Live capture
  recorded the same amount.
- API-key and `unknown` lanes get no Codex credit estimate.
- A session JSONL that recorded no mode is a legacy session. It keeps standard
  pricing.

Some sessions were captured before `codex_initial_service_tier` existed. For
those, repair takes the first tier from the first `turn_end`. That value
already includes any tier change that Codex made during the first turn. So
repair prices a request made before such a change at the changed tier.

If repair cannot find the billing lane, it does not price the session at the
standard rate. This happens when the session JSONL has one of these problems:

- It is missing or cannot be parsed.
- It has no `session_start`.
- It records the API-key lane, but has no first-tier record and no completed
  turn.
- It records two different billing modes.
- It names another session.

The two repair paths handle this case differently:

- `trajectory cost` automatic repair skips the session. It keeps the stored
  cost and derivation marker, so the session stays stale. It reports the
  session as `unverified_billing_lane`, or `kept (billing lane unverified)` in
  text output.
- Repair in the serve process keeps the existing session file and reports an
  inspect error. If the recorded lane of a file changes after conversion
  starts, this repair keeps the file and tries again later.

An earlier release repaired some sessions before this rule existed. That
repair rewrote the session file without the billing mode. Repair cannot get
those modes back, because neither the rollout nor the local index records
them.

### Pricing rules for all clients

For every token-based estimate, Trajectory looks up model equivalence and
provider pricing with two inputs. They are the client that produced the usage
and the time Trajectory observed it. It does this when capture writes the request or turn. It
does this again when it rebuilds or repairs a saved session. So an alias for
one client cannot use the rate of another client. An older turn cannot use
the current rate card.

Claude Code records the transcript usage time as `observed_at` on each
completed turn. Session totals use this time even when capture finishes after
a rate change.

Trajectory applies long-context price increases per request, and only when it
has token counts for each request. Sometimes a fallback has only the token sum
for a session with several requests. If that sum crosses the threshold,
Trajectory leaves the total unpriced. It does not assume that one request
crossed the threshold.

The long-context input multiplier applies to these rates:

- uncached input
- cache reads
- the 5-minute cache-creation rate
- the 1-hour cache-creation rate

The long-context output multiplier applies to output tokens.

If pricing data is incomplete or invalid, Trajectory loses cost only for the
affected part or model:

- Cache-creation tokens can lack a split into 5-minute and 1-hour buckets, or
  the split can cover only some of them. Trajectory then prices them at the
  5-minute rate. That rate is the client default and gives a lower bound. The
  lookup reason is `cache_creation_ttl_assumed_5m`.
- If the buckets of a split add up to more than the total, the split is
  inconsistent. The tokens stay unpriced, with the reason
  `cache_creation_ttl_breakdown_inconsistent`.
- Cost reconciliation treats lower-bound turns as unavailable, so it compares
  only exact results.
- At runtime, Trajectory drops an invalid rate card from the managed provider
  catalog and keeps the others.
- If two overlapping cards claim the same model, Trajectory drops only that
  model.
- If Trajectory cannot read the catalog, the process keeps the last copy that
  it loaded. If the catalog cannot be used, Trajectory uses the verified
  built-in rates.
- Organization sync still validates the whole file before it installs the
  file.
- Like Cursor, Claude Code `session_end` reports `cost_complete`,
  `cost_priced_turns`, `cost_unpriced_turns`, and `cost_known_subtotal_usd`.
- `session_cost_usd` is always a complete total. Trajectory leaves it out
  while any turn with tokens has no price.
- The two final token counts of a Cursor turn can disagree. Trajectory then
  records the turn with its response and turn number, but without tokens or
  cost. The token coverage of the session becomes partial. It does not become
  invalid.

### Built-in OpenAI GPT-6 rate cards

The built-in `gpt-6-astra`, `gpt-6-sol`, and `gpt-6-luna` cards use OpenAI's
[published API pricing](https://developers.openai.com/api/docs/pricing). The
Astra rates below are in USD per million tokens. They were checked against
that page on 2026-09-25.

These rules apply to all three cards:

- If a request has more than 272K total prompt tokens, the full request uses
  the long-context rates. Those are 2 times the input and cache rates, and 1.5
  times the output rate.
- Fast or priority mode doubles every rate that applies. This includes cache
  reads, cache writes, and the long-context rates.

| Mode | Input | Output | Cache read | Cache write |
| --- | ---: | ---: | ---: | ---: |
| Standard, up to 272K | $10 | $50 | $1 | $12.50 |
| Standard, above 272K | $20 | $75 | $2 | $25 |
| Fast / Priority, up to 272K | $20 | $100 | $2 | $25 |
| Fast / Priority, above 272K | $40 | $150 | $4 | $50 |

Sol and Luna use the same long-context and fast rules, applied to their own
standard rates:

| Model | Input | Output | Cache read | Cache write |
| --- | ---: | ---: | ---: | ---: |
| `gpt-6-sol` | $2 | $10 | $0.20 | $2.50 |
| `gpt-6-luna` | $0.10 | $0.50 | $0.01 | $0.125 |

OpenAI publishes no effective date and no separate 1-hour cache-write rate for
these cards. Trajectory does not infer a Codex product-credit rate for any of
them. Codex API-key sessions use the selected API tier. Sessions signed in
with ChatGPT keep the standard USD estimate at API rates and get no credit
estimate.

### Built-in rate cards for GitHub Copilot models

These built-in cards cover models in the GitHub Copilot model picker. Each row
uses the published API rate of the model provider, checked on 2026-10-08. The
rates are in USD per million tokens. `mai-code-1.1-flash` is the one exception.

| Model | Input | Output | Cache read | Cache write | Source |
| --- | ---: | ---: | ---: | ---: | --- |
| `gpt-5-mini` | $0.25 | $2 | $0.025 | none | [OpenAI](https://developers.openai.com/api/docs/pricing) |
| `gpt-5.4-mini` | $0.75 | $4.50 | $0.075 | none | [OpenAI](https://developers.openai.com/api/docs/pricing) |
| `gpt-6.1-sol` | $2 | $10 | $0.10 | $2.50 | [OpenAI](https://developers.openai.com/api/docs/pricing) |
| `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.8-flash` | $0.75 | $3.75 | $0.075 | none | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| `grok-4.5` | $2 | $6 | $0.30 | none | [xAI](https://docs.x.ai/docs/models) |
| `grok-4.6`, `grok-4.7` | $2 | $6 | $0.50 | none | [xAI](https://docs.x.ai/docs/models) |
| `mai-code-1.1-flash` | $0.20 | $1.20 | $0.02 | none | [GitHub Copilot](https://docs.github.com/en/enterprise-cloud@latest/copilot/reference/copilot-billing/models-and-pricing) |

- The Gemini rates are a Google promotion that ends on 2026-12-31. From
  2027-01-01, they are $1.50, $7.50, and $0.15.
- Trajectory uses the rate in effect when it observed the usage. Google
  publishes no start date for the Gemini 3.6 Flash promotion. So every 3.6
  Flash observation before 2027 uses the promotional rate.
- `gpt-6.1-sol` follows the GPT-6 Sol long-context and fast rules above.
- Fast mode is 1.8 times the rate for `gpt-5-mini` and 2 times the rate for
  `gpt-5.4-mini`. Neither mini model has a long-context rate.
- If the prompt of a Grok request reaches 200K tokens, the whole request costs
  2 times every rate.
- `mai-code-1.1-flash` uses the published GitHub Copilot price, because
  Microsoft publishes no API price for it. It is the only built-in row that
  does not use the API rate of the model provider.

### Model names with an effort level

Some model names end in a reasoning effort level: `-low`, `-medium`, `-high`,
or `-xhigh`. Such a name uses the built-in card of its base model. OpenAI,
Google, and xAI charge the same rate per token at every effort. For example,
`gpt-5.6-luna-low` uses the `gpt-5.6-luna` card.

The rule does not apply to Claude model names. It also does not apply to
`-max`, `-fast`, `-none`, and `-minimal`.

Since 2026-10-08, organization rate cards follow the same rule. These cards are
`org/pricing.yaml`, which prices Cursor, and `org/provider-pricing.yaml`:

- An effort name uses the base row from the same organization catalog. An
  organization no longer needs one row for each effort.
- An effort name never falls back to the built-in card.
- If an organization provider card is installed but lists neither the name nor
  its base, the name stays unpriced.

### Stale Codex sessions

`trajectory cost` can show the warning `N Codex sessions use a stale cost
derivation and are excluded`. This warning is about the **local display**
only. A session is stale when its stored `cost_derivation_version` is older
than the current Codex derivation. The local total then leaves out that
session.

To derive the session again and publish it, run
`trajectory session import codex --force`. A stale session changes only the
local summary. It does not change metric sending. Cost metrics that Trajectory
already published do not change.

## Datadog Dashboard Recipes

Datadog dashboard queries support tag filters, grouping, arithmetic, and
formulas. Use formulas for ratios between queries that do not overlap. Never
use a formula to make overlapping grains look unique. For query and formula
details, see the Datadog
[dashboard querying guide](https://docs.datadoghq.com/dashboards/querying/).

The rules below apply to every dashboard that you maintain yourself. Queries
and formulas only show metrics. They do not turn on collection, and they
cannot create missing historical points.

### Total attributed coding-agent cost

Use a Query Value or Timeseries widget with one source family and one grain:

```text
sum:trajectory.turn.cost.usd.additive{trajectory.cost_contract:v2,trajectory.cost_role:attribution}.as_count()
```

Backfill sends the live metric again with the original turn timestamps and the
same `trajectory.cost_contract:v2` tag. So query only the live metric for both
current and backfilled cost.

This metric is the Trajectory stream of turn cost attribution. Do not add
client-native metrics, provider billing, or the completed-session metric to
this query.

The `trajectory.cost_contract:v2` filter selects only data from after the
change to the v2 contract:

- Old legacy samples have no contract tag, so they stay out of the total.
- Older historical metrics and provider history replay send no attribution
  token or cost samples, so they also stay out.
- To see legacy data, unverified data, or provider data, create separate
  widgets.
- Never widen this total query to include samples that have no contract tag
  or role tag.

For Cursor, this query contains only newly captured turns that got a priced
result in managed `emit` mode. It does not contain workspace activity, cloud
activity, or historical replay. Show the Cursor organization ledger and the
local capture and pricing coverage in separate widgets. Do not add them to the
local attribution stream.

### PR work cost

Use the PR work metric for PR cost:

```text
sum:trajectory.pr.work.cost.usd.additive{source:facts}.as_count()
```

This metric reuses the base turn cost. Do not add it to turn cost, session
cost, or PR creation cost.

## Dashboard Review Checklist

Before you publish a Trajectory cost dashboard, check these items:

- Each total uses exactly one cost source family.
- The dashboard follows the source registry, upstream configuration, and
  reconciliation levels in the
  [Cost Overlap Consumer Guide](COST-OVERLAP-CONSUMER-GUIDE.md) or
  `trajectory user-guide cost-reconciliation`.
- Each total uses exactly one grain. No total adds the turn, session, and PR
  views of the same usage.
- Totals, budgets, denominators, and alerts use ungrouped additive metrics.
- Each widget says whether it shows attributed cost or provider-billed cost.
- Gaps are diagnosed with source and status tags that have a fixed set of
  values.
- No paths, commands, refs, object IDs, patterns, or source text become
  dashboard tags.

## Ownership and Privacy

Trajectory decides on the local machine which work a user produced. It uses
successful writes, and the files in eligible commits made during the session.
These things alone never count as work the user produced:

- the entry baseline, which is the state of the repository when the session
  started
- downloaded PR contents
- changes brought in by fetch, pull, switch, rebase, or reset
- merge or cherry-pick operations
