# Cost Tracking

Trajectory estimates what your coding-agent sessions cost from the tokens it
captures. Local USD values estimate captured activity. They are not invoices.
Codex credits show separately, and `*` marks provisional values. This page
covers pricing, price sources, attribution, double counting, and how to check
the numbers.

For deeper questions, the binary has these guides:
`trajectory user-guide cost-attribution` for dashboards,
`trajectory user-guide cost-reconciliation` before you compare with bills, and
`trajectory user-guide cursor-cost`.

## How costs are estimated

Trajectory prices each request with the rate of the client that produced it,
at the time it ran (`observed_at`). It does this at capture and at repair, so
aliases stay per client and old turns keep their rates. A missing price is
never $0: an unpriced turn sends no USD
and shows as unavailable, and a true zero price sends 0.

### Tokens

- Reasoning tokens are priced once, as output. Where output already includes
  them, as in OpenAI, xAI Responses, Codex, and Pi, they are never counted
  twice.
- Cache writes with no price for their lifetime are priced at the shortest
  lifetime, 5 minutes, or 30 minutes for OpenAI. That gives a lower bound,
  tagged `cache_creation_ttl_assumed_5m` or `cache_creation_ttl_assumed_30m`.
- If cache-write buckets add up to more than the total, the tokens stay
  unpriced (`cache_creation_ttl_breakdown_inconsistent`).
- Long-context rates apply per request. The input multiplier applies to input
  and cache, and the output multiplier to output. Session sums that cross the
  threshold stay unpriced.
- Gemini tool-use prompt tokens count as input. Grounded search bills per
  query from Gemini 3, and per grounded prompt before it.
- Given only a provider's total, Trajectory splits it across components by
  model and tokens. It keeps the total and labels it native.
- Each WebSearch costs the calling model's rate per search at call time, such
  as $0.01 for Claude or $0.035 for Gemini 2.5. Searches by unpriced or
  unknown models, or in unpriced turns, send counts without cost. They also
  block the session's search cost gauge.
- Claude Code, Pi, and OpenCode usage comes from client files, once per
  response. Their turns settle two minutes after they close.

### Service tiers

Requests are priced at the tier their usage states. That is `service_tier`
or `speed` for Claude Code, and `fast`, `priority`, `flex`, or `ultrafast`
for Codex. OpenAI `default` is standard. A rate card prices `fast` (alias
`priority`) as one multiple of the model's standard prices, and the multiple
differs by model. `flex` and `ultrafast` set a multiple for each price.

- A missing or unknown tier is priced at standard. If the model has tiers, it
  is a lower bound (`service_tier_unstated`). Copilot and Cursor always are.
- Fast without a tier price is a lower bound at standard price
  (`service_tier_unpriced`). Flex or batch without one stays unpriced
  (`service_tier_rate_missing`).
- Fast and long-context multipliers combine only where the provider documents
  it. Otherwise the request is unpriced (`fast_tier_long_context_unsupported`).
- Calls captured through `trajectory codex` or `trajectory opencode` record
  the service tier and cache-write lifetime.

### Lower bounds

A lower-bound cost carries `trajectory.cost_bound:lower` and a
`trajectory.cost_bound_reason` joined by `/`. The reasons are `long_context`,
`cache_write_lifetime`, `service_tier_unstated`, `service_tier_unpriced`,
`auxiliary_usage_unknown`, and `sub_agent_cost_unknown`. In Datadog, only
`trajectory.turn.cost.usd.additive` points priced from a client's own usage
file carry these tags, with the `auxiliary_usage_unknown` reason. Other cost
metrics never do. A session is a lower bound if any turn, call, or subagent is.
Bad pricing data loses only that part.

GitHub Copilot and Cursor costs are floors, because calls go through their
backends and the tier and cache lifetimes go unrecorded.

### Claude Code

- Claude Code's background requests, such as titles, summaries, and
  suggestions, skip session files. Native metrics send them as
  `query_source:auxiliary`, without duplicate retries.
- Calls missing from the transcript, such as titles, carry
  `trajectory.cost_component:captured_call`. They add to local and published
  session cost. An unknown cost marks the session incomplete.
- Auxiliary dollars are Claude Code's own. Organization rate cards only decide
  whether they count. Models without a rate give tokens and no dollars.
- Without native metrics, Claude Code counts from files carry
  `trajectory.usage_bound:lower` and `trajectory.cost_bound:lower`. Backfilled
  sessions always do, and they are below live counts.
- Subagent output without closing entries is
  `trajectory.output_bound:lower`. Extra native output is
  `trajectory.output_source:native` when native and file counts match.
- A session stays a lower bound if `OTEL_METRICS_INCLUDE_SESSION_ID` is false,
  `query_source` is missing, or temporality is cumulative.
- Setup leaves Claude native metrics off. Use `trajectory claude`, managed
  settings, or `CLAUDE_CODE_ENABLE_TELEMETRY=1` with OTLP `http/json` to
  `http://127.0.0.1:19222/v1/metrics`. If you changed `server.port`, use that
  port. A managed Claude metrics route wins and leaves Trajectory no native
  metrics.

### Codex

- Codex shows tokens, API-equivalent USD, and ChatGPT credits apart. Never add
  them. Credits stay local and never go to Datadog.
- Sessions on ChatGPT credits are priced in USD at standard rates in any tier.
  GPT-5.6 fast bills 2.5x credits, and cache writes cost input credits.
- Codex `input_tokens` includes cache reads and writes. Each is split out once.
  Writes are priced at the cache-write rate, or else at input.
- Missing, invalid, or inconsistent token data, such as cache writes above
  uncached input, leaves a turn unpriced (`tokens_status: partial`).
- Codex model IDs use the base model's rates (`gpt-5.4-codex` uses `gpt-5.4`)
  and count in `trajectory.turn.cost.usd.additive`. Unknown models stay
  unpriced.
- Session cost adds up accepted turn costs. It never prices total session
  tokens at one rate.
- Codex rollouts record no cache-write lifetime. Turn cost is a lower bound
  unless you start Codex with `trajectory codex`.

### Codex auto-review

Codex auto-review on a ChatGPT sign-in (`codex-auto-review`) has no price.
Trajectory estimates it at `gpt-5.4` before 2026-07-30 and `gpt-5.6-luna`
after. Since 2026-10-06 auto-review is free for ChatGPT sign-ins, so later
reviews show 0 credits but keep API-equivalent USD. An auto-review reviewer on
an API key names a listed model, such as `gpt-5.6-luna`, and is priced
normally.

Estimates carry `fidelity: proxy` and `proxy_estimate:codex_auto_review`, and
show as provisional in `trajectory cost`. Datadog gets only the oversight
cost.

### Provisional pricing

Provisional pricing is off by default. When on, it prices unpriced token rows
when a report runs. It never changes stored cost, publishes, or converts
credits. Rates come from the organization card, then the installed version's
bundled provider card, through approved aliases. Other rows stay unpriced.
Provisional USD joins totals with a `*`, and one footnote gives the amount and
a command for details.

Subscription usage keeps API-equivalent USD. Label it included usage, not
billed. A ChatGPT sign-in alone is not a paid plan.

## Pricing sources

`trajectory.pricing_source` names the rate source, such as
`organization_rate_card`, `local_rate_card`, `public_rate_card`,
`provider_reported`, or `unbilled_model`.

The default card is built in, or comes from
`~/.trajectory/org/provider-pricing.yaml` through full organization sync. It
holds dated public prices with cache, fast, and long-context rules. Rows in
the organization copy override the built-in card. The exception is a row that
repeats a built-in `card_id` and `version`. Built-in models keep their name
rules.

`~/.trajectory/org/model-equivalence.yaml`, also from full organization
sync, maps client model names to provider models. It keeps thinking, speed,
billing, and context modes apart.

Model names:

- Names ending in `-low`, `-medium`, `-high`, or `-xhigh` use the base model's
  built-in card. This does not apply to Claude names, `-max`, `-fast`,
  `-none`, or `-minimal`. Since 2026-10-08, organization pricing files price
  an effort name from its base row. A name whose base `org/pricing.yaml` does
  not list stays unpriced. Without a base row in `provider-pricing.yaml`, the
  built-in card prices it. Earlier releases leave such names unpriced.
- The built-in card strips gateway prefixes and suffixes, such as
  `baseten/zai-org/glm-5.2` and `:latest`. It accepts dotted Claude and
  hyphenated GLM versions. Other names need aliases. For models the built-in
  card lacks, organization files and the custom card retry the lookup
  without the prefix, path, or suffix.
- A guessed or `candidate` model match shows only in diagnostics. The turn
  stays unpriced until organization config adds the exact mapping.
- With no rate, tokens are recorded without cost (`rate_missing`), unless
  organization `pricing.unbilled_model_suffixes` marks the model as a known $0.
  Such a model costs $0, priced, with
  `trajectory.pricing_source:unbilled_model`, even for clients with explicit
  prices. User `config.yaml` cannot set the suffixes.

Organization sync installs pricing files and the custom card only after
strict validation: no unknown fields, bad entries, repeats, or overlaps. At
runtime an unreadable catalog keeps the last copy or the built-in rates.
Invalid cards are dropped, and an overlap drops only that model. Releases
without custom card support ignore `custom-pricing.yaml`. Keep `pricing.yaml`,
`provider-pricing.yaml`, and `model-equivalence.yaml` in organization config
for them. Releases that read the custom card turn merged default rows back
into replaced rates, so merged files and the card can coexist.

### Custom rate card

`~/.trajectory/org/custom-pricing.yaml` downloads only if the managed profile
names it. A failed check keeps the last valid copy. Never edit an entry. Add
one with a new `id` and window. Requests that no entry matches keep their
default prices.

```yaml
schema_version: trajectory.custom_pricing.v1
entries:
  - id: cursor-token-rate-2026-10-15
    client_source: cursor
    all_default_models: true
    effective_from: 2026-10-15T00:00:00Z
    source: https://cursor.com/docs/models-and-pricing.md
    reason: Token rate on third-party models.
    modify:
      fee_usd_per_million_tokens: 0.25
```

An entry (`trajectory.custom_pricing.v1`) takes an `id`, an optional
`client_source`, a model scope, `effective_from`, an optional exclusive
`effective_until`, `source`, `reason`, and one action:

- `override` replaces the default rate's listed fields. Input and output must
  stay above 0, and `web_search_usd_per_request: 0` makes search free.
- `add` prices a model the default card lacks.
- `modify` sets `multiplier`, which scales token rates,
  `fee_usd_per_million_tokens`, which is never multiplied, or both. Only
  `modify` can use `all_default_models: true` instead of `models`.

Entries match client and model after equivalence. A client-specific entry wins
over one for all clients. One `override` or `add` and one `modify` can apply.
Cursor needs entries that name it. An `override` or `modify` without a default
rate leaves the request unpriced (`custom_rate_base_missing`). Names the
organization copy refuses need `add`.

Custom prices report `organization_rate_card`, the card `custom-pricing`, and
the basis `usage_economic_cost`. Their pricing version joins the entry IDs
with `+`. Fees show as `total_token_surcharge`.

### Cursor pricing

- `pricing.cursor.mode`: `off` sends no Cursor USD, `shadow` checks the lookup
  without USD, and `emit`, the default, sends USD. Accept each model's card
  first.
- `pricing.cursor.source`: `org_file`, the default, needs a valid,
  effective-dated `~/.trajectory/org/pricing.yaml`, which full organization
  sync can supply. Otherwise Cursor stays unpriced.
  `datadog_reference_table` is not built yet. It reports
  `pricing_source_unavailable`, sends no USD, and leaves Cursor turns
  unpriced. An empty value turns pricing off.
- A managed `pricing.cursor` block replaces yours. It must set the mode and
  source, or pricing turns off, and it never uses fallback cards.
- Cursor USD applies from when pricing starts. Managed history sync can
  republish eligible saved cost under the live metric names, with original
  timestamps.

## Cost attribution

`trajectory.turn.cost.usd.additive` sends only for priced turns, tagged
`trajectory.cost_contract:v2`, `trajectory.cost_role:attribution`, and
`trajectory.cost_source:turn_metrics`.
Token metrics always send. Published `trajectory.cost_source` names the stream,
such as `turn_metrics` or `claude_native_otlp`. The local `cost_source` in
reports is different.

- `trajectory.cost_contract:v2` marks current cost. Only live points that pass
  current usage checks get it. Legacy and replayed samples lack it, so never
  widen totals to untagged points. Generic historical replay sends no live
  cost metrics.
- Every v2 USD point in a total records its price source, method, fidelity,
  basis, unit, version, and card, or it is rejected.
- Cursor cost carries `trajectory.cost_basis` and `trajectory.pricing_version`.
  From the native rate card it also carries
  `trajectory.cost_method:four_component_token_rate_card` and
  `trajectory.cost_fidelity:token_derived`.

### Subagents

Session cost includes the subagents it started. A window counts a subagent
when its starting turn is in the window. Subagents recorded as their own
sessions, as in Codex, show separately, and the parent adds only the rest, so
each counts once. Claude subagent cost is one `agent_role:child` point per
child model.

### Pull requests

`trajectory.pr.work.cost.usd.additive` splits each priced, completed turn's
cost across the PRs with evidence on that turn. A turn's shares add up to one,
so ungrouped `.as_count()` totals match the cost of PR-assigned turns. Turns
with no PR share add nothing, so the PR total can be lower than the turn
total. Only cost and fractional turns split, not tokens or duration.

- Weights are 8 for an explicit PR action and 4 for a branch checkout, push,
  or link. Work before the create weighs 2, and a PR URL in the prompt 1.
- Attribution needs GitHub or GitLab change IDs, on any host, in local
  output. Reading a PR alone earns no share.
- An unpriced turn, or one without a completed `turn_end`, gets no PR share
  and reverses earlier shares. It never sends zero.
- Shares sent mid-session use cached turn cost. A signed correction at session
  end aligns them with the final `trajectory.turn.cost.usd.additive`.
- PR work rows carry confidence and allocation reason tags, plus their turns'
  `trajectory.cost_role:attribution`, `trajectory.cost_source:turn_metrics`, and
  route and overlap values, or `mixed`.
- Cost per PR is PR-assigned cost over distinct PRs. In Datadog, divide
  `trajectory.pr.work.cost.usd.additive` by the distinct PRs in
  `trajectory.pr.observations.total`.

Trajectory decides locally which work a user produced: successful writes and
eligible commits. Baselines, downloaded PRs, pulls, rebases, resets, merges,
and cherry-picks never count.

### Automated oversight

Oversight cost counts only with a model, a finite amount of zero or more,
`cost_attribution_status:priced`, and `oversight_cost_inclusion:independent`.
`parent_included` reviews send no oversight token metrics and no second
charge, because the parent turn already includes them. The local dashboard
adds all priced oversight cost. `trajectory.oversight.cost.usd.additive` adds
only independent reviews, so the totals can differ.

## Overlap and double counting

A dashboard faces two separate overlaps. Several systems can report the same
spend (source overlap). Turn, session, and PR views describe the same usage
(grain overlap).

Grain: turn, session, and PR cost metrics describe the same usage. Never add
them. PR work cost regroups turn cost.

Source: Trajectory cost is attribution with local context, such as user,
project, and session. Billing data may sit closer to invoices. Decide each
view's role.

- Each total uses one source: Trajectory attribution, native client
  telemetry, or provider, gateway, or cloud billing. Label each widget.
  Comparison views never add sources.
- `trajectory.cost_role:attribution` is Trajectory's attribution, for
  breakdowns, with `trajectory.cost_contract:v2`.
  `trajectory.cost_role:client_telemetry` is forwarded native telemetry, such as
  uncorrected Claude native OTLP with
  `trajectory.cost_source:claude_native_otlp`. Use it to cross-check, never to
  add. File-work indicators use `indicator`.
- Never add across `trajectory.cost_role`. If both attribution and client
  telemetry exist, count one. With one trusted source, use only that one.
- Claude Code cost also appears as `anthropic.user_cost.amount`,
  `claude_code.cost.usage`, and older `claude_code.*` series. Each total uses
  one of them.
- Never add Trajectory Cursor cost to Cursor Admin API cost, or to the
  integration's `total_cents`, `charged_cents`, or `spending.spend_cents`.
  Never add those together either.
- Cursor's share of the total holds only new turns priced in managed `emit`
  mode. Show Cursor's organization ledger separately.

Trajectory dedupes only its own points. Each cost point has a stable ID for
each turn or session, so restarts and replays never resend it. No source
shares a request ID today, so totals across sources are never exact. Matches
by email, model, time, or provider session ID are guesses. Keep such sources
side by side and labeled, and never dedupe them. Before you compare with
provider, gateway, cloud, or Cursor data, align the account, route, product,
currency, policy, window, and late data. Attribution and billing differ in
cardinality, timing, and coverage, so a difference alone does not mean a
pricing error.

Audit or activity streams without cost fields give activity coverage only.
Never build cost series or zero fallbacks from them. Series without cost role,
source, or overlap tags are legacy or external. Show them as unverified, and
keep them out of totals and dedupe.

### Overlap tags

Overlap tags appear on `trajectory.turn.cost.usd.additive`, web search additive
cost, session `.accumulated` gauges, cost distributions, and spans. They mark
likely overlap, not bad data. Among metrics, only cost metrics carry them, so
overlap filters on token, tool, duration, marker, or serve metrics give
incomplete results. Do not use overlap tags in place of sensitive route
configuration.

- `trajectory.provider_route`: `direct`, `llm_gateway`, `bedrock`, `vertex`,
  `foundry`, `unknown`, or `mixed`. `trajectory.provider:anthropic` alone is
  not evidence of overlap.
- `trajectory.provider_cost_visibility` names the outside billing system that
  can hold the same spend.
- `trajectory.cost_dedupe_group` is a stable route bucket, such as
  `anthropic:direct`, `anthropic:llm_gateway`, or `anthropic:mixed`. Groups can
  overlap. Dedupe by it, never by model, service, or span name. It never
  identifies a request.
- `trajectory.cost_dedupe_confidence` (`high`, `medium`, `low`, or `mixed`)
  rates how sure the route is. It does not rate whether two points are one
  charge.
- `trajectory.cost_overlap_risk` says whether another billing source likely
  sees the same spend. It is the main signal for automatic dedupe:
  - `possible`: Anthropic sees the spend. If you connected Anthropic
    analytics, total with it and break down with Trajectory. Otherwise total
    with Trajectory.
  - `aggregate_only`: gateway or cloud billing sees the total. Use it for
    billed totals, and Trajectory for allocation and trends.
  - `mixed`: one aggregate holds several routes. Split by
    `trajectory.cost_dedupe_group` before you dedupe, and show the review
    state.
  - `unknown`: too little route evidence. Keep the data visible with a review
    badge and a confidence filter. Never hide it.

## Check costs

`trajectory cost` shows local tokens and estimated cost by day, agent, and
session. It never queries Datadog. Its commands default to `--since 7d`, and
also take `24h`, `30d`, `all`, or a date. `--limit` trims rows, never totals,
and every command takes `--json`.

- `trajectory cost`: a stacked chart of seven periods, in the default window
  only, and the daily average and peak. Then tables by period, agent, and top
  session, with Coverage notes.
- `trajectory cost top`: the costliest sessions with complete cost data. A
  note counts the incomplete ones left out. JSON has
  `incomplete_ranking_sessions` and `incomplete_cost_sessions`. Guardian
  sessions rank if every turn has an estimate. Text adds one note, and JSON
  shows the fidelity details.
- `trajectory cost inspect --session <full ID>`: each turn's cost, model,
  tokens, tools, and cost source. Totals include subagents.
- `trajectory cost observations --session <id>`: local facts, such as the
  top-cost turn, the subagent share, the model, the source mix, and failed
  tools. It names no root causes.
- `trajectory cost pricing --since 7d`: provisional and unresolved pricing
  decisions, up to 50 groups. Combined equals verified plus provisional.
- `trajectory cost hotspots`: the project files agents edit and read most, with
  folder totals.
- `trajectory cost validate`: checks Claude Code, Codex, the Codex app, Gemini,
  Pi, OpenCode, Cursor, Hermes, Amp, Qwen, Kilo, and Mistral Vibe.
- `trajectory cost publish`: resends cost metrics a destination missed, from
  kept history, with original timestamps. Without `--yes` it only previews.

`cost`, `cost top`, `cost inspect`, `cost observations`, and
`trajectory summary` show the same session total when the window covers the
session. `cost inspect` and `cost observations` show recorded cost only. They
can differ from summaries and rankings that use provisional prices.

### Windows and history

A window selects turns by when they happened. A session wholly inside it may
use its total. Turns with an unclear time show as unavailable. An aged-out
session counts whole, at its stored cost, in the window that holds its end.
`cost inspect` marks it `Summary only`.

`cost` and `cost top` first import sessions idle for two minutes from Claude
Code, Codex, the Codex app, Cursor, Pi, and OpenCode history, and repair them.
This import is local: it uses no remote credentials, queues no metrics, and
publishes nothing. It skips active files, and `--db` skips it. Interactive
cost and patterns commands print progress, with Codex repair counts, to
standard error only. JSON and redirected output stay clean.

Codex pricing changes mark sessions stale. A stale session leaves the local
totals only, until daily repair or `trajectory backfill local --apply`, which
the CLI suggests, derives it again. `trajectory session import codex --force`
also derives and republishes it. If its rollout is gone or its billing lane
cannot be checked, the session stays stale, and `trajectory cost` keeps its
stored cost. After repair, fast sessions on API keys keep priority pricing. API
key and `unknown` lanes get no credit estimate, and sessions without a mode
stay standard.

### Coverage and completeness

A session is incomplete if a turn, or a subagent that used tokens, lacks a
price. It then shows the known subtotal. JSON counts `priced_items` and
`unavailable_items`. Any unpriced turn blocks a complete session USD.

The Coverage section counts sessions on disk, in the cache, and with
incomplete or unpriced cost. JSON `local_history` adds the result for each
source. Claude Code and Cursor `session_end` report `cost_complete`, priced
and unpriced turns, and the known subtotal. `session_cost_usd` appears only
when every turn with tokens is priced.

In Datadog, check pricing coverage with `trajectory.pricing.lookup.total`, one
point per Cursor generation, else per turn. Its `status` and `reason` tags say
why a lookup found no price. Also check
`trajectory.capture.gap{reason:usage_missing}`.

### Turn details and JSON

Turn rows show `cost_source`, such as `token_derived:materialized`,
`token_source`, and `tokens_status`: `real`, `corrected`, `estimated`, or
`unavailable`. Fidelity columns are in JSON only.

- `cost inspect --json` has `schema_version: 1`. Read `session.token_usage`.
  Use its components only if `component_status` is `complete`. Flat token
  fields are legacy.
- Agent and breakdown rows include subagent cost. JSON `subagent_cost_usd`,
  or `cost.subagent_usd` in the summary, gives that part. It is absent when
  there is none.
- Summary JSON adds `verified_cost_usd`, `provisional_cost_usd`, and
  `contains_provisional_cost`. Incomplete data gives `cost_state: partial`
  with a lower-bound `known_subtotal_usd`.
- Classification cost has its own `user-driven-segmentation` table, failed
  attempts included. It never enters the headline, agent rows, agent-work
  cost, or the ranking.

### Hotspots

`trajectory cost hotspots` takes `--project PATH`, `--group-by file|directory`
(default `file`), `--depth N` (default 1), and `--sort cost|interactions`
(default `cost`). It labels heavily edited files `review-churn`, and agent
setup files such as `AGENTS.md`, `CLAUDE.md`, skills, and config
`expected-context`. Its USD splits priced turn cost across files by payload
size. It shows where work went. It does not measure spend on a file.
Coverage shows the share of usable cost.

### Validate

`cost validate` statuses are `ok`, `gap` (no priced turns), `mixed` (tokens but
zero cost), `stale`, `no-data`, `session-aggregate`, and `estimated` (Guardian
provisional). It exits 1 on any `gap` or `stale` row. `--strict` also fails
`mixed` and `no-data`.

To recompute each session's turns, tool calls, tokens, and cost, and check
the totals, run `trajectory session audit --source-data --db <cache.db>`.
