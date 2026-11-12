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
- Built-in Codex public pricing has the version `codex-rollout-cost-v17`.
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

- `trajectory.instrumentation.capture.gap{client_source:cursor,reason:usage_missing}`, for Cursor
  turns and generations without final token usage
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

`trajectory.session.cost.usd.total` is the whole session: the owner's turns,
their sub-agents and the client's background requests. A sub-agent with a
session of its own, as in Codex, sends its own sample and isn't in its parent's.
So no sample counts it twice, and a parent's sample can read below its whole
tree of sessions. `trajectory.turn.cost.usd.total` and
`trajectory.session.cost.usd.accumulated` hold the owner's cost only.

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
A read of a PR, such as `gh pr view`, counts only when the session also acted
on that PR. Creating, pushing to or merging it are such acts.
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

A PR point goes out once. For Datadog destinations, its time is when Trajectory
handles it. Datadog keeps one value per series and second. It also drops a point
over about 3 hours old unless Historical Metrics Ingestion is on for that name.
PR totals are exact, but a point can land on a later day than the work. Other
OTLP collectors accept any time, so they keep the turn's time.

This applies to new work: a turn that ended after the destination first ran a
release with this behavior. Older turns are not sent again, so an upgrade never
puts months of work on one day.

A point stays open for about an hour after Trajectory first handles its turn.
Inside that hour a changed share goes out as a signed change at its own second.
After it the turn is settled. A changed share sends nothing, and neither does a
PR a later release finds on that turn. Each counts as a
`pr_settled_no_correction` drop, so a turn's shares never sum past 100%. New
detection therefore applies to new work.
The USD value comes from the stored source cost, including any richer pricing
data. Missing pricing never becomes a zero-cost observation.

### DD Harness cost coverage

DD Harness wraps the real pi agent, so the DD Harness capture mapper
computes its own `llm_call` cost from the `model_request_ended` observation's
tokens. `ModelRequestEndedEvent` prices them with `capturecost.AmbientPricer`,
as every other client does. It uses the organization rate card first, then
the verified public card, at the time of the request. The result is a formal
`costattribution.Attribution`. The `llm_call` then
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
  writes. OpenAI's rate card says "Codex credit billing has no separate
  cache-write charge."

If a rollout has no cache-write field, Trajectory keeps the split into two
parts. The cache-write value can be malformed, or larger than the uncached
input that it comes from. Then the input of the turn is unverified. Its
observed parts stay visible, but the turn is unpriced and has
`tokens_status: partial`.

### Codex credit rates

Trajectory reports ChatGPT Codex credits at the rate in effect when it observed
the usage. These figures are separate from USD, and no USD amount is derived
from them. Credits appear only in `trajectory cost`, the local viewer, and the
`sessionstream` SDK. No Datadog metric carries them.

The rates come from [OpenAI's pricing page](https://learn.chatgpt.com/docs/pricing).
They are per million input, cached input, and output tokens:

| Model | Until | Credits | From | Credits |
| --- | --- | ---: | --- | ---: |
| `gpt-5.6-sol` | 2026-08-21 | 125 / 12.5 / 750 | 2026-08-21 | 100 / 10 / 500 |
| `gpt-5.6-terra` | 2026-07-30 | 62.5 / 6.25 / 375 | 2026-07-30 | 50 / 5 / 300 |
| `gpt-5.6-luna` | 2026-07-30 | 25 / 2.5 / 150 | 2026-07-30 | 5 / 0.5 / 30 |

OpenAI announced the change dates for its API prices and said the same cuts
apply to Codex usage. It gives no separate date for the credit rate card.

### Codex auto-review

Codex reviews some actions in a separate reviewer session, which it calls
Guardian or auto-review. A reviewer signed in with an API key names a model on
the price list, such as `gpt-5.6-luna`. Trajectory prices it as any turn of that
model. A reviewer signed in with ChatGPT names `codex-auto-review`. OpenAI's
price list has no such model, and rollouts do not name the model that served
the request. Trajectory estimates these turns at the list price of the model
OpenAI said reviews ran on then:

| Requests observed | Model | Evidence |
| --- | --- | --- |
| Before 2026-07-30 | `gpt-5.4` | ["Auto-review uses GPT-5.4 Thinking (low reasoning)."](https://alignment.openai.com/auto-review/) |
| From 2026-07-30 | `gpt-5.6-luna` | "We're also upgrading Auto-review in the ChatGPT app and Codex CLI from GPT-5.4 to GPT-5.6 Luna." (OpenAI on X) |

The Codex source supports the second row: it requests `gpt-5.6-luna` for a
reviewer signed in with an API key.

The turn's attribution has `fidelity: proxy`. Its cost source is
`proxy_estimate:codex_auto_review`. These keep the estimate apart from a price
the list states for the requested model. `trajectory cost` labels it the same
way. OpenAI has not confirmed the billing identity of `codex-auto-review`.

The USD amount is API-equivalent, as it is for any Codex turn on a ChatGPT
plan. OpenAI said on 2026-10-06 that "This Auto-review feature is now free and
does not draw usage from your plan." So a turn on or after that day has 0 Codex
credits and keeps its API-equivalent USD. It may cost you nothing.

In Datadog, a reviewer's cost goes out only as oversight cost. It never enters
ordinary turn or session metrics, or the cost of the session it reviewed. See
[automated oversight metrics](metrics/automated-oversight-metrics.md).
`trajectory cost` includes it in its total and marks it as provisional.

### Codex cost repair

The token split is part of the Codex cost derivation, `codex-rollout-cost-v17`.
When the derivation version changes, saved Codex sessions become stale. Two
paths derive them again from their saved rollouts, and the one publish engine
republishes them:

- the Codex cost repair in the serve process, once a day
- `trajectory backfill local --apply` (and `trajectory backfill
  --from-codex-sessions`), on demand

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

#### Service tiers

A provider can charge a request by the service tier that served it. The rate
card states what each tier costs for a model. The fast tier is `fast`, or
`priority`, its other name. Its price is one multiple of the standard prices.
The `flex` and `ultrafast` tiers have a multiple for each price: input, cache
read, cache write and output. So a tier can keep one price at the standard
price. A request's tier comes from its usage, such as Claude Code's
`service_tier` or `speed` and Codex's `service_tier` setting. Trajectory
reads Codex's `fast`, `priority`, `flex` and `ultrafast` settings. OpenAI's
`default` is the standard tier. OpenCode can store the tier the provider
applied to an OpenAI or xAI request made through the Responses API.
Trajectory reads it when it is there. OpenCode 1.19 and earlier store none,
and OpenCode stores none for other providers, such as Anthropic and Google.
Those requests are priced as requests that state no tier. When OpenCode
reports the request's cost itself, Trajectory keeps that cost, and the tier
does not change it. A call captured through `trajectory opencode` states the
tier and cache-write lifetimes from the provider's response. Trajectory then
prices OpenCode's record of the call at them from the rate card, in place of
OpenCode's cost
([the launcher](CLIENT-INSTRUMENTATION.md#opencode-launcher)).

- A request that states its tier is priced at that tier's price.
- A request that states no tier, or one Trajectory does not know, is priced at
  the standard tier. When the model has a price for another tier too, the cost
  is a lower bound with the reason `service_tier_unstated`. A cheaper tier,
  such as flex, is one a request asks for. The provider reports it, so a
  request that states no tier did not use it.
- The model may have no price for a fast or ultrafast request. Then the
  request is priced at the standard tier as a lower bound, with the reason
  `service_tier_unpriced`. An organization card's fast model without a fast
  multiplier stays unpriced, as before.
- The model may have no price for a flex or batch request. Then the request
  is unpriced, with the reason `service_tier_rate_missing`. The standard
  price would be too high.
- Codex's ChatGPT credit lane prices its API-equivalent USD at the standard
  tier, whatever the tier. So the tier makes no cost there a lower bound.

#### Lower bounds

A cost that rests on one of these assumptions is the least the usage can have
cost. Its attribution lists why in `lower_bound_reasons`: `long_context`,
`cache_write_lifetime`, `service_tier_unstated` and `service_tier_unpriced`.
A turn's cost is a lower bound when one of its requests' costs is. A
session's cost is a lower bound when one of its priced turns' costs is. Each
keeps every reason of its parts. The turn and session cost distributions,
`trajectory.turn.cost.usd.total` and `trajectory.session.cost.usd.total`,
carry `trajectory.cost_bound:lower` and `trajectory.cost_bound_reason`
([common tags](metrics/common-tags.md)). The additive and
accumulated cost metrics do not, so a correction keeps them in one series.
The session SDK carries the reasons on each turn's `CostAttribution` and on
the session.

A session cost sample has one more reason, `sub_agent_cost_unknown`, when a
sub-agent has no known cost. The sample then holds what is known. It also takes
`auxiliary_usage_unknown` from any turn with that reason, and a sub-agent's own
reasons, since its cost is part of the sample.

A Claude Code session counted from its client files has one more reason,
`auxiliary_usage_unknown`. Its background requests never reach those files, and
only its native metrics report them. Those requests go out as
`query_source:auxiliary` when the metrics reach Trajectory. Without them the turn's
additive and total cost points carry `trajectory.cost_bound:lower` with this
reason. These turns take no corrections, so the mark can't split a series. The dollars on `query_source:auxiliary` points are the ones Claude Code
reported, so an organization rate card sets whether they count but not their amount.
See [its background requests](metrics/per-turn-metrics.md#claude-codes-background-requests).

Some clients never record the tier or the lifetimes, so their costs are
floors:

- GitHub Copilot and Cursor call the provider through their own backends.
  Their users pay their plan's prices, not the provider's tier rates.
- Grok Build has no cost at all: its history keeps two session-wide counters.
- OpenCode records the tier only for some OpenAI and xAI calls, and no
  lifetime. The cost OpenCode reports assumes the standard tier and 5-minute
  writes, and is not tagged as a lower bound.
- Codex records no lifetime, so its writes are priced at the 30-minute rate.

A call captured from the provider's response, through `trajectory codex` or
`trajectory opencode`, states both. The
[client instrumentation reference](CLIENT-INSTRUMENTATION.md#service-tier-and-cache-write-lifetime)
says why each client cannot.

If pricing data is incomplete or invalid, Trajectory loses cost only for the
affected part or model:

- Cache-creation tokens can lack a split into 5-minute and 1-hour buckets, or
  the split can cover only some of them. Trajectory then prices them at the
  5-minute rate. That rate is the client default and gives a lower bound. The
  lookup reason is `cache_creation_ttl_assumed_5m`. Some models are priced
  by other lifetimes, such as OpenAI's 30-minute and 12-hour writes. They
  price writes of no stated lifetime at their shortest lifetime the same way,
  with the reason `cache_creation_ttl_assumed_30m`. Writes of a lifetime the
  model's rate does not price are priced as writes of no stated lifetime.
- If the buckets of a split add up to more than the total, the split is
  inconsistent. The tokens stay unpriced, with the reason
  `cache_creation_ttl_breakdown_inconsistent`.
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

### The custom rate card

Trajectory prices with two rate cards. The default card holds provider list
prices: the card built into the binary, or your organization's copy of it in
`~/.trajectory/org/provider-pricing.yaml`. The custom card holds your
organization's own prices, such as a client's settlement fee, rates fitted
from gateway costs, gateway-only models, and estimates. It lives only in your
organization config as `~/.trajectory/org/custom-pricing.yaml`, and organization
sync installs it only when the managed profile names it.

A row of your organization's copy takes precedence over the built-in card,
unless it repeats a built-in row. Such a row has the `card_id` and `version`
of a card built into the binary, and that card lists its model. The copy's
format cannot state every built-in rate, such as a fast request's rate above
a long-context threshold. So Trajectory prices that model from the built-in
card, also when a client reports it by an alias or an effort name. Earlier
releases price from the copy.

The custom card is a list of dated entries. Never change an entry: to change
a price, add an entry with a new `id` and its own window.

```yaml
schema_version: trajectory.custom_pricing.v1
entries:
  - id: cursor-token-rate-2026-10-15
    client_source: cursor
    all_default_models: true
    effective_from: 2026-10-15T00:00:00Z
    source: https://cursor.com/docs/models-and-pricing.md
    reason: Cursor's token rate on third-party models.
    modify:
      fee_usd_per_million_tokens: 0.25
  - id: cursor-grok-4-5-2026-10-15
    client_source: cursor
    models: [grok-4.5]
    effective_from: 2026-10-15T00:00:00Z
    source: https://cursor.com/docs/models-and-pricing.md
    reason: Cursor's Grok 4.5 cache-read rate and no token rate.
    override:
      cache_read_usd_per_million: 0.5
  - id: cursor-grok-4-5-fee-2026-10-15
    client_source: cursor
    models: [grok-4.5]
    effective_from: 2026-10-15T00:00:00Z
    source: https://cursor.com/docs/models-and-pricing.md
    reason: Cursor exempts its own models from the token rate.
    modify:
      fee_usd_per_million_tokens: 0
```

Each entry has an `id`, an optional `client_source`, and a model scope. It has
an `effective_from` and an optional, exclusive `effective_until`. It names a
`source` and a `reason`, and it makes exactly one change:

- `override` replaces the fields it lists on the default rate and keeps the
  rest, such as the fast multiplier and the long-context tier. Input and
  output prices must stay above 0. Setting `web_search_usd_per_request` to 0
  makes web search free. Otherwise web search keeps the shared charge.
- `add` prices a model the default card lacks. It lists the full rate.
- `modify` sets `fee_usd_per_million_tokens`, `multiplier`, or both. The
  multiplier scales every token rate of the default rate. The fee is charged
  on every token: input, output, cache reads and cache writes. The fast and
  long-context multipliers never scale the fee.

The model scope is either `models` or `all_default_models: true`. `models`
lists model names as the default card spells them. `all_default_models`
covers every model the default card prices at that time.
Only a `modify` entry can use `all_default_models`. An `add` model is never
on the default card, so `all_default_models` does not reach it.

Trajectory matches an entry by client and model. Model equivalence turns the
name a client reports into the default card's name, including aliases scoped
to that client. A name the custom card lists exactly also matches.
These rules decide which entries apply:

- An entry for one client wins over an entry for every client. A `modify`
  that lists the model wins over one for all default models.
- At most one `override` or `add`, and at most one `modify`, apply. The
  `modify` applies over the rate the `override` or `add` sets.
- An `override` or `modify` needs a default rate in effect. Without one, the
  request is unpriced with the reason `custom_rate_base_missing`.
- When your organization's copy refuses a rate for the reported name, only an
  `add` can price it. The copy refuses when the name's row there has expired.
  It also refuses when your equivalence maps the name to a model with no
  current rate in the copy. The request keeps the copy's reason, and the
  built-in card never supplies the rate.
- Clients that must be priced explicitly, such as Cursor, use only entries
  that name them. An entry for every client never prices them.
- A request that no entry matches keeps its default price unchanged.

A custom price has the source `organization_rate_card`, the card ID
`custom-pricing`, and the basis `usage_economic_cost`. Its pricing version
names the entries that set it, such as
`cursor-grok-4-5-2026-10-15+cursor-grok-4-5-fee-2026-10-15`. Its effective
window covers only the time in which those same entries apply. So it starts or
ends where another entry takes over, including one that expires and hands the
price back. A fee appears as the `total_token_surcharge` cost component. All the usage rules above still
apply.

Organization sync installs the file only if the strict loader accepts it.
That loader rejects unknown fields, an invalid entry, a repeated `id`, and two
entries that could both set one model's price at the same time. At runtime,
Trajectory skips an entry it cannot use and keeps pricing with the others. If
the file cannot be read, the process keeps the last copy it loaded.

#### Cursor and the custom card

When the custom card is present, Cursor turns use it instead of the Cursor
token card in `pricing.yaml`. Cursor turns then follow the rules for all
clients:

- A Cursor turn is priced only when a Cursor entry covers its model.
- Model equivalence aliases scoped to `cursor` name Cursor's models.
- A turn can span several model calls. So when its total input crosses a
  long-context threshold, it is priced at the standard rate as a lower bound.
- A fast model name needs a fast multiplier on the rate. Without one, the turn
  is unpriced.

As before, Trajectory fixes a turn's rate when its prompt starts, so a card
change during the turn does not change its price.

#### Releases that cannot read the custom card

Earlier releases ignore `custom-pricing.yaml`. Keep `pricing.yaml`,
`provider-pricing.yaml` and `model-equivalence.yaml` in your organization
config for them. Generate those files from the custom card with the
`ratecard-export` tool in the Trajectory source:

- `-kind cursor-pricing` writes `pricing.yaml`, the Cursor token card, with
  the fee written out as the total token rate. It lists each exact name the
  custom card prices for Cursor.
- `-kind merged-provider` and `-kind merged-equivalence` write the default
  card and model equivalence with your `override` and `add` entries for every
  client merged in. Entries for one client, `modify` entries, and fields only
  the built-in card may set cannot be written in that format exactly. The tool
  leaves them out and names them. `-unscoped <entry-id>` writes an entry for
  one client as an entry for every client instead. The model equivalence still lists every
  model an `add` prices, with your aliases for it, so the custom card can
  price them.
- `-releases <your RELEASES.json>` compares the default card with the oldest
  release your rings pin. The files then list only the models that release
  prices differently, and the models your aliases and entries name. That
  release prices every other model with its own built-in card. Pass your
  current `model-equivalence.yaml` with `-org-equivalence` too. The tool fails
  when it has no frozen copy of that release's built-in card. Without
  `-releases`, the files list every model.
- `-keep <model>` lists a model that release prices alike anyway, with its
  rows and aliases, for hosts on an older release whose built-in card lacks
  it. Repeat it for each such model. The tool names each row it keeps.
- A row without a fast multiplier is written with `fast_multiplier: 1`, the
  rate the built-in card uses. The tool still writes a row the format cannot
  state exactly. It names the requests that row leaves unpriced, such as fast
  requests above a long-context threshold.

A release that reads the custom card turns the merged rows back into the
default rates they replaced, then applies the entries itself. So both files
can be installed together. A merged row has its entry's `id` as its card ID,
covers a model the entry lists, and falls inside the entry's window. A row
that does not meet all three keeps its own rate, even when a card of yours
shares an entry's `id`. Generate the merged copy from the built-in card, as
the commands above do by default. A merged row does not record the rate it
replaced, so the built-in card supplies the fields an `override` set.

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
these cards. Codex API-key sessions use the selected API tier. Sessions signed
in with ChatGPT keep the standard USD estimate at API rates. Their credit
estimate uses the rate on OpenAI's Codex rate card.

### Built-in rate cards for GitHub Copilot models

These built-in cards cover models in the GitHub Copilot model picker. Each row
uses the published API rate of the model provider, checked on 2026-10-08. The
rates are in USD per million tokens.

| Model | Input | Output | Cache read | Cache write | Source |
| --- | ---: | ---: | ---: | ---: | --- |
| `gpt-5-mini` | $0.25 | $2 | $0.025 | none | [OpenAI](https://developers.openai.com/api/docs/pricing) |
| `gpt-5.4-mini` | $0.75 | $4.50 | $0.075 | none | [OpenAI](https://developers.openai.com/api/docs/pricing) |
| `gpt-6.1-sol` | $2 | $10 | $0.10 | $2.50 | [OpenAI](https://developers.openai.com/api/docs/pricing) |
| `gemini-3.6-flash`, `gemini-3.7-flash`, `gemini-3.8-flash` | $0.75 | $3.75 | $0.075 | none | [Google](https://ai.google.dev/gemini-api/docs/pricing) |
| `grok-4.5` | $2 | $6 | $0.30 | none | [xAI](https://docs.x.ai/docs/models) |
| `grok-4.6`, `grok-4.7` | $2 | $6 | $0.50 | none | [xAI](https://docs.x.ai/docs/models) |

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
- `mai-code-1.1-flash` has no built-in card, because Microsoft publishes no
  API price for it. An organization can price it on its
  [custom rate card](#the-custom-rate-card).

### How GitHub Copilot CLI turns are priced

On GitHub Copilot CLI 1.0.94 and later, the capture server reads each turn's
requests from Copilot's session log when the turn ends. It writes one
`llm_call` per request with that request's model and tokens. Trajectory
prices each request at its own model's card, because auto mode can send one
prompt's requests to several models.

- A turn is priced only when every request in it is priced. A turn with a
  `mai-code-1.1-flash` request is unpriced with reason `rate_missing`, never
  priced at 0. It counts in `trajectory.session.cost.unpriced_turns`.
- A session with an unpriced turn sends no session USD, as for Cursor. Its
  `session_end` keeps the priced turns' amount as `cost_known_subtotal_usd`.
- A priced turn is a lower bound, with reason `service_tier_unstated`.
  Copilot does not report the service tier, and its users pay their plan's
  prices.
- A request made with your own provider key (BYOK) reports no Copilot
  credits. Its tokens are still priced at the model's card.

Each `llm_call` also keeps Copilot's own billing units. They are not USD, and
Trajectory never converts them:

| Field | What it holds |
| --- | --- |
| `provider_nano_aiu` | Copilot's AI credits for the request, in billionths. |
| `provider_request_cost_units` | The premium-request units Copilot reports for the request. |
| `provider_premium_requests` | The units of a request you started, and 0 for a request the agent started on its own. Only your requests count against your plan, so these add up to the `totalPremiumRequests` Copilot reports when the session ends. The field is left out when Copilot does not say who started the request. |

Native OpenTelemetry (`copilot_cli_native_otel`) writes the same fields on
its `llm_call` rows. You can turn the session log read off with
`trajectory config features disable copilot_cli_stop_read`. A turn then gets
tokens only from native OpenTelemetry or the history watcher, when either is
on.

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
- If `org/pricing.yaml` lists neither the name nor its base, the name stays
  unpriced.
- If `org/provider-pricing.yaml` and `model-equivalence.yaml` have no row or
  alias of their own for the base model, the built-in card prices the name.
  The name then costs what it costs without organization cards. For example,
  `gpt-6-sol-high` uses the built-in `gpt-6-sol` card when your card has no
  `gpt-6-sol` row. Earlier releases leave such a name unpriced.

On the custom card, an entry for a base model also covers its effort names.

### Unbilled models

Managed configuration can list model ID suffixes in
`pricing.unbilled_model_suffixes`. A model whose ID ends in a listed suffix costs
$0, whatever the rate cards say. That is a known price, so its turns count as
priced, with `trajectory.pricing_source:unbilled_model`, and its session keeps a
complete cost. That includes clients that must otherwise carry their own price,
such as Antigravity, and Cursor whichever card its policy selects. With no list, a
model with no rate stays unpriced with `rate_missing`. A user's own `config.yaml` can't set the list, because it would
hide that user's spend. Attributions recorded before the list applied keep the
status they were recorded with.

### Model names with a gateway prefix

A gateway can report a model name with a provider prefix, a path, or a
suffix, such as `baseten/zai-org/glm-5.2` or `gpt-5.6-sol:latest`. The
built-in card removes them and matches the rest in lowercase.

Your organization's `org/provider-pricing.yaml` and `model-equivalence.yaml`
do the same for a model the built-in card does not price. If they do not list
the name as the client reports it, Trajectory looks it up again without the
prefix, path, or suffix. So `baseten/zai-org/glm-5.2` uses your `glm-5.2` row,
or your alias for it. The custom card matches a model it lists the same way.

A gateway can also write a GLM version with a hyphen instead of a dot, such
as `glm-5-3` or `zai/glm-5-3-flash`. Trajectory looks such a name up as
`glm-5.3` or `glm-5.3-flash`, so it uses your row or alias for the dotted
name. Earlier releases price the hyphenated name only through an alias, such
as `glm-5-3` with `canonical_model: glm-5.3` in your `model-equivalence.yaml`.

A model on the built-in card keeps the built-in card's name rules, which
reject some spellings. Your organization card prices only the names it lists
and their effort names. The built-in card prices the other spellings it
accepts.

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
