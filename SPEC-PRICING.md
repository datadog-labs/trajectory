# Pricing: Rate Cards and Cost Calculation

**Version:** 0.1.0
**Status:** Normative for implementations that write `cost_source: "calculated"` using a rate card of this format. A producer that only relays a `reported` cost does not need this document.

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted as described in RFC 2119.

## 1. Purpose

The core specification lets a producer or an analysis pipeline state a cost on `llm_call`, `turn_end`, and `subagent_stop`. A cost that was computed from token usage and a price list carries `cost_source: "calculated"` and names the price list in `cost_rate_card` as `"{id}@{version}"` (see SPEC.md, Cost computation). This document defines:

- the **rate card**, a JSON document that holds prices as data (`opentrajectory.rate_card/1`);
- the optional **model aliases** document (`opentrajectory.model_aliases/1`), and the rules that turn a model name as a producer sent it into one **canonical name**;
- the **calculation**: one fixed algorithm with integer arithmetic, so that two implementations given the same card and the same usage return the same amount, to the nano-dollar, for the usage of one request and for one point of a usage metric;
- the **result**, including a closed list of reasons for refusing to price;
- the **choice among cards**, when a caller holds several cards or several versions of one;
- the **provenance** a card can state: the sources that back each price, the decision rule that settled a price the sources did not, and the announcement a version's start date comes from (Section 3.6);
- the **price evidence** documents that the tools building a card from several sources read: single prices observed on a page, and the prices people decided (Section 12);
- the conformance corpus under `conformance/pricing/`.

A new price, a new model, or a new tier boundary is a change to a card. It needs no new engine release. A pricing structure that the component types below cannot express needs a new component type and a new engine release; an engine that meets a component type it does not know refuses to price.

## 2. Non-goals

- This repository ships no maintained rate card and no list prices. The cards in the conformance corpus are synthetic. Publishing and maintaining a card is the job of whoever calculates costs.
- There is no expression language. Prices are combined only through the component types and the quantity expressions defined here.
- Costs that are not a function of per-request usage (seats, credits, commitments, minimum spend) are out of scope. When the billing party reports an amount, `reported` is the better source.
- The engine never guesses. It does not pick a "similar" model unless the aliases document states the rule and the caller allows the named assumption (Section 7.4), does not clamp a negative count to zero, and does not assume a request attribute the card did not tell it to assume.

## 3. The rate card document

A rate card is one JSON object. JSON Schema: `schema/rate-card.schema.json`. A member that this document does not define makes the card invalid, at every level of the document: an engine that ignored it could compute a price the card's author did not intend. There are two exceptions, both for a card that is newer than the engine, and both confine the damage to one model entry (Section 4.6): a component whose `type` the engine does not know, and a member of a model entry that the engine does not know.

```json
{
  "schema": "opentrajectory.rate_card/1",
  "card": {
    "id": "synthetic-basic",
    "version": "1",
    "snapshot_date": "2026-01-01",
    "currency": "USD",
    "effective_from": "2026-01-01T00:00:00Z"
  },
  "models": [
    {
      "match": { "provider": "exampleai", "ids": ["ex-large-1"] },
      "components": [
        { "id": "input", "type": "per_unit", "quantity": "uncached_input", "price": "3", "per": "1000000" },
        { "id": "cache_read", "type": "per_unit", "quantity": "cache_read_input_tokens", "price": "0.30", "per": "1000000", "if_absent": "skip" },
        { "id": "output", "type": "per_unit", "quantity": "billable_output", "price": "15", "per": "1000000" }
      ]
    }
  ]
}
```

### 3.1 `card`

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | REQUIRED | Identifier of the card, in the [identifier grammar](#card-identifier-grammar). |
| `version` | string | REQUIRED | Version of the card, in the same grammar. A card whose prices change MUST change `version`. |
| `source_url` | string | OPTIONAL | The page where the provider publishes the prices, such as its pricing page. |
| `snapshot_date` | string | REQUIRED | `YYYY-MM-DD`, the day the prices were read from their sources. |
| `currency` | string | REQUIRED | MUST be `"USD"` in this version. |
| `effective_from` | string | OPTIONAL | RFC 3339 UTC instant. The card does not apply to a request observed before it. |
| `effective_until` | string | OPTIONAL | RFC 3339 UTC instant, exclusive. The card does not apply to a request observed at or after it. A version that a later version replaces need not state it (Section 8.7). |
| `corrects` | string | OPTIONAL | The `version` of another version of this card whose prices were wrong, in the identifier grammar. This version takes its place, and the corrected version prices nothing (Section 8.7). A card whose `corrects` is its own `version` is invalid. An engine that does not know the member refuses the card as `card_invalid`, which is never a wrong price. |
| `sources` | object | OPTIONAL | The sources that back the card's prices, by source id (Section 3.6). |
| `effective_from_evidence` | object | OPTIONAL | The provider's announcement that `effective_from` comes from (Section 3.6). |

`card` has no member `publisher`, `source` or `official`. A card that states one of them is invalid, as for any member this document does not define. `sources` records where the prices came from, price by price.

When a card or a model entry states both, `effective_from` MUST be before `effective_until`, compared as instants. A window that is empty or inverted makes the card invalid, and so does a value that is not a valid RFC 3339 instant, such as a month of 13 or a day past the end of its month.

<a id="card-identifier-grammar"></a>

**Identifier grammar.** `id` and `version` are each 1 to 64 characters. The first character is a lower-case ASCII letter or a digit. Every other character is a lower-case ASCII letter, a digit, `.`, `_` or `-`. A card whose `id` or `version` is outside this grammar is invalid (`card_invalid`).

The grammar is this narrow because the two values travel. They are joined into one wire value, and that value becomes a metric attribute and, in a binding, a tag. A binding may lower-case a tag value and may replace characters it does not keep. With this grammar no binding changes either part, two cards cannot differ only by letter case, and the separator cannot occur inside a part. This is the one statement of the grammar, and the metric contract refers to it. The session event validators check only the shape of a recorded `cost_rate_card` (a non-empty identifier, an `@`, a non-empty version), because an event records what a producer wrote; a recorded value outside this grammar names no valid card.

The wire value `cost_rate_card` is `"{card.id}@{card.version}"`. It has exactly one `@` and at most 129 characters.

An invalid card has no identity. An engine reports no `id`, no `version` and no `cost_rate_card` value for it, in a result (Section 8) or by any other means, whichever members it read before it found the defect. What an engine reports for a card MUST NOT depend on the order of the card's members or on how far its reader got.

### 3.2 `assume`

OPTIONAL object. Default values for request attributes the caller did not supply, for example `{ "service_tier": "standard", "batch": false }`. Values are strings or booleans.

A default is the card author's statement of what a request most likely was. It is not something the request said. So the engine uses a default only when the caller allows the `attribute_defaulted` assumption (Section 8.3). Every default the engine actually used is echoed in the result (`assumed`), and that result is an estimate. Without the allowance, or without an entry in `assume`, a missing attribute that a condition needs is a refusal (`missing_request_attribute`). A default can be wrong in either direction. A model entry can name instead the value whose price is the least such a request can have cost (Section 4.8).

### 3.3 `quantities` and `checks`

`quantities` is an OPTIONAL object of derived quantities, name to expression, added to the standard prelude (Section 5). A name MUST NOT redefine a prelude name or a base quantity. An expression is one of:

| Form | Meaning |
|---|---|
| `"name"` | The quantity `name`. |
| `{ "ref": "name", "default": "0" }` | The quantity `name`; when it is absent, the non-negative integer in `default`. `default` is OPTIONAL. |
| `{ "add": [expr, ...] }` | Sum. At least one operand. |
| `{ "sub": [expr, expr, ...] }` | The first operand minus every following operand. At least two operands. |

An expression over an absent operand (with no `default`) is absent. A `sub` whose result is negative is a refusal (`usage_inconsistent`); the engine MUST NOT clamp it. Expressions MAY reference other derived quantities; a cycle makes the card invalid.

`checks` is an OPTIONAL array of `{ "requires_sum_to": "total_name", "parts": ["a", "b"] }`. When the total and every part are present and the parts do not sum to the total, the engine refuses with `usage_inconsistent`. When the total or any part is absent the check is skipped.

### 3.4 `adjustments`

OPTIONAL array of `{ "id": "contract", "factor": "0.72", "applies_to": ["input", "output"] }`. `factor` is a non-negative decimal string. `applies_to` is OPTIONAL; when absent the adjustment applies to every component of every model entry. Every adjustment's `id` is unique within the card: a card that gives two adjustments the same `id` is invalid (`card_invalid`), since a result names the adjustments applied to a component by `id`. Adjustments express a negotiated discount or uplift over list prices. They are applied exactly, before rounding (Section 6), and are echoed per component in the result.

### 3.5 `models`

Array of model entries. Each entry:

| Field | Type | Required | Description |
|---|---|---|---|
| `match.provider` | string | OPTIONAL | When present, the entry applies only to a request whose provider equals it. |
| `match.ids` | string[] | REQUIRED unless `patterns` | Exact model identifiers. |
| `match.patterns` | string[] | OPTIONAL | Patterns. `*` matches any run of characters, including none; every other character matches itself; the pattern covers the whole identifier. |
| `match.precedence` | integer | OPTIONAL | Default 0. Higher wins among several matching entries of the same kind. An integer from -(2^53-1) to 2^53-1, a JSON number read the way Section 5 reads a count given as a number, so `5.0` is 5. A value outside that range, one that is not integer valued, and one of any other type make the card invalid. |
| `effective_from`, `effective_until` | string | OPTIONAL | Same meaning as on `card`, for this entry only. |
| `cache_write_lifetimes` | string[] | OPTIONAL | The cache-write lifetimes this entry prices apart (Section 4.7). Absent is `["5m", "1h"]`. |
| `cache_write_lifetime` | object | OPTIONAL | What to do with cache-write tokens whose lifetime was not reported (Section 4.7). |
| `attribute_values` | object | OPTIONAL | The values of a request attribute this entry has a price for (Section 4.5). |
| `attribute_lower_bounds` | object | OPTIONAL | For a request attribute the request does not state, the value whose price is the least the request can have cost (Section 4.8). |
| `components` | array | REQUIRED | At least one component (Section 4). |

Model resolution is Section 7.

A rate card nests at most 128 JSON containers, objects and arrays, one inside another, counting the card object itself as the first. A card that nests deeper is invalid. The `all` condition (Section 4.5) can be nested without end and an engine evaluates it by descending, so without a bound the work of reading a card, and whether a reader can read it at all, would differ from one engine to the next. The bound is on the whole document, so it holds for a member an engine does not know (Section 4.6) as it does for a condition.

### 3.6 Provenance

A card can say where each of its prices came from: the sources that state it, the rule that settled a price the sources did not agree on, and the announcement that a version's start comes from. Provenance changes no amount. An engine prices a card that states it exactly as it prices the same card without it. It is still part of the card, so an engine checks it as it checks every other member, and a card whose provenance breaks a rule of this section is invalid (`card_invalid`).

Provenance is all or nothing. A card that states `sources` states `backed_by` on every component whose `type` is `per_unit`, `tiered_per_request` or `per_call`. A card that states no `sources` states no `backed_by`, no `decision` and no `effective_from_evidence`. A multiplier states a factor, not a price, so it states neither `backed_by` nor `decision`. The members of a component whose `type` the engine does not know are not read (Section 4.6).

**`sources`.** An object from source id to source. It is empty when no source states any price of the card. A source id follows the [identifier grammar](#card-identifier-grammar). A source is an object:

| Field | Type | Required | Description |
|---|---|---|---|
| `kind` | string | REQUIRED | `"provider_page"`: a page on the provider's own site, such as its pricing page or a deprecation notice. `"price_list"`: a public list of many providers' prices, read whole, such as one JSON file. `"announcement"`: the provider's statement of when a price change takes effect. |
| `name` | string | REQUIRED | A short name for people, 1 to 200 characters on one line. |
| `url` | string | REQUIRED | The absolute `https` URL that was read. |
| `retrieved_at` | string | REQUIRED | When it was read: an RFC 3339 UTC instant, written as `effective_from` is (Section 3.1). |
| `sha256` | string | REQUIRED for a `price_list`, absent otherwise | The lowercase hex SHA-256 of the bytes read, so the list as it was read can be told from any later copy of it. |

Every source is named by at least one `backed_by`, `decision.source` or `effective_from_evidence.source` of the card. A card lists only the sources that back something on it.

**`backed_by`.** A list of source ids on a component, each in `sources`, each at most once, sorted as Section 8 sorts names: the sources that state exactly the component's price for the entry's model. An empty list says that no source states it. An announcement states no price, so `backed_by` names only sources whose `kind` is `"provider_page"` or `"price_list"`. A source **states exactly** a price when all of these hold:

- It names the same model and provider. Both names are compared as canonical names, made with the same aliases document (Section 7.2). For an entry that states no `match.provider`, the provider is the model's maker (Section 7.3).
- It states the price for the same request set: the service tier and the batch flag that the component's `when` selects, or the standard request when the component has no `when`.
- Its value equals the component's once both are written per one unit and compared as exact decimals, `price` divided by `per`. A token is the unit of a token quantity, one search the unit of `web_search_requests`, and one request the unit of a `per_call` component. So `$3 / MTok`, `"3"` per `"1000000"` and `"0.000003"` per `"1"` are one price.
- For a `tiered_per_request` component, it states the base price and the price of every tier, each above the same threshold.

A page on the provider's own site that states the price counts as a source, as a price list does. A value that someone computed from another price, such as a ratio to the input price, is stated by no source.

**`decision`.** An object on a component whose price an agreement of sources did not settle. It names the rule that settled the price and quotes what the rule rests on. A component has one decision, so on a `tiered_per_request` component it speaks for the base price and every tier.

| Field | Type | Required | Description |
|---|---|---|---|
| `rule` | string | REQUIRED | `"R1"` or `"R3"`, from the table below. |
| `why` | string | REQUIRED | Why the rule applied: one of the values the table gives the rule. |
| `source` | string | REQUIRED | The id of the source the rule decided by. Its `kind` is `"provider_page"`. For `R1`, the component's `backed_by` names it too, since that page states the price. |
| `reason` | string | REQUIRED | One sentence for people, 1 to 500 characters on one line. A publisher writes it from one fixed sentence for each pair of `rule` and `why`, never in words of its own for one price. |
| `evidence` | string | REQUIRED | The exact text read on the source that the decision rests on, 1 to 500 characters on one line, as a `quote` is in Section 12. |
| `decided_on` | string | REQUIRED | `YYYY-MM-DD`, the day the evidence was read. |

| `rule` | `why` | The rule |
|---|---|---|
| `R1` | `disputed`, `single_source`, `large_change` | The provider's page decides. The sources state different values (`disputed`), only one source states the price (`single_source`), or the price moves by more than half, either way, from the version before (`large_change`): the new value is more than one and a half times the old one or less than half of it, or the old one was zero and the new one is not. The value on the provider's own pricing page is the price, and `evidence` quotes the page. |
| `R3` | `deprecated` | The provider has retired or deprecated the model. The card keeps the last price it had, and `evidence` quotes the provider's notice. |

A price that two or more sources state alike needs no decision, and a price that no rule settled has none. A publisher that settles prices by rules publishes them with its cards.

**`effective_from_evidence`.** An object on `card`, stated only with `effective_from`. `source` is the id of a source whose `kind` is `"announcement"`, and `quote` is the exact text of the announcement that says when the prices take effect, 1 to 500 characters on one line. It says that `effective_from` is the moment the provider announced, and not a day chosen after the prices were read.

```json
{
  "schema": "opentrajectory.rate_card/1",
  "card": {
    "id": "example-public",
    "version": "2026-03-01.1",
    "snapshot_date": "2026-02-20",
    "currency": "USD",
    "effective_from": "2026-03-01T00:00:00Z",
    "effective_from_evidence": { "source": "announcement-2026-03-01", "quote": "New prices apply from March 1, 2026." },
    "sources": {
      "announcement-2026-03-01": { "kind": "announcement", "name": "ExampleAI's announcement of the prices from 2026-03-01", "url": "https://exampleai.example/news/prices", "retrieved_at": "2026-02-20T09:05:00Z" },
      "list-a": { "kind": "price_list", "name": "List A", "url": "https://list-a.example/prices.json", "retrieved_at": "2026-02-20T06:00:00Z", "sha256": "5b3c4e6f0d1a2b3c4d5e6f708192a3b4c5d6e7f8091a2b3c4d5e6f708192a3b4" },
      "provider": { "kind": "provider_page", "name": "ExampleAI's pricing page", "url": "https://exampleai.example/pricing", "retrieved_at": "2026-02-20T09:00:00Z" }
    }
  },
  "models": [
    {
      "match": { "ids": ["ex-large-1"] },
      "components": [
        { "id": "input", "type": "per_unit", "quantity": "uncached_input", "price": "3", "per": "1000000", "backed_by": ["list-a", "provider"] },
        { "id": "output", "type": "per_unit", "quantity": "billable_output", "price": "15", "per": "1000000", "backed_by": ["provider"],
          "decision": { "rule": "R1", "why": "disputed", "source": "provider", "reason": "The sources disagree on this price, so ExampleAI's own pricing page decides it (rule R1).",
            "evidence": "Ex Large 1 | $3 / MTok | $15 / MTok", "decided_on": "2026-02-20" } }
      ]
    }
  ]
}
```

## 4. Components

Every component has an `id` (unique within its model entry), a `type`, and an OPTIONAL `when` (Section 4.5). A component whose `when` is false contributes nothing and is listed in the result under `skipped` with `"why": "when"`. A component of the types `per_unit`, `tiered_per_request` and `per_call` MAY also state `backed_by` and `decision` (Section 3.6); they change no amount.

Prices are decimal strings in the card currency, such as `"3"`, `"0.30"`, `"0.0000025"`. A price MUST be non-negative, MUST NOT use an exponent, and MUST have at most 12 decimal places. `per` is a positive integer string: the price is for `per` units. Counts and thresholds are non-negative integer strings.

A number written as a string has at most 64 characters, the decimal point counted, and the card schema states that length for every such member of a card. That holds for a price, `per`, a count, a threshold and a factor in a card, for a count in a usage record and for `request_count` (Section 8), and for the numbers given to `allocate` (Section 8.1). A longer string is not a number: in a card it makes the card invalid, in a usage record or as `request_count` it is `usage_inconsistent`, and in `allocate` it is `invalid_input`. No price or count that exists comes near 64 characters, and the bound keeps the exact arithmetic of Section 6 from costing more than a short input can.

### 4.1 `per_unit`

`{ "id", "type": "per_unit", "quantity", "price", "per", "if_absent" }`

Amount = quantity x price / per. `if_absent` is OPTIONAL: `"refuse"` (default) or `"skip"`. When the quantity is absent, `"refuse"` makes the engine refuse with `quantity_missing`, and `"skip"` drops the component and lists it under `skipped` with `"why": "absent"`. Use `"skip"` for counts that a provider reports only when they are non-zero.

### 4.2 `tiered_per_request`

`{ "id", "type": "tiered_per_request", "quantity", "tier_quantity", "mode", "price", "per", "tiers": [{ "above": "200000", "price": "6" }], "if_absent" }`

`price` is the base price. `tiers` lists higher bands in strictly ascending order of `above`. A band applies when the tier quantity is strictly greater than `above`; a tier quantity equal to `above` is still in the band below.

- `mode: "whole_request"`: the single price of the highest band the tier quantity reaches applies to the whole `quantity`. `tier_quantity` is REQUIRED and MAY differ from `quantity` (for example output tokens priced by prompt size).
- `mode: "marginal"`: `tier_quantity` MUST be absent or equal to `quantity`. Units up to the first `above` are priced at `price`, units above it and up to the next `above` at that band's price, and so on. The band amounts are added exactly and rounded once, as one component.

Tiers describe one request. See Section 8 for aggregated usage.

### 4.3 `per_call`

`{ "id", "type": "per_call", "price" }`

A fixed amount per priced request. For aggregated usage the amount is `price` x `request_count` (Section 8). A fee per tool invocation, such as a web search fee, is a `per_unit` component over the count of invocations, not a `per_call` component.

### 4.4 `multiplier`

`{ "id", "type": "multiplier", "factor", "applies_to": ["input", "output"], "when", "exclusive_with": ["other_multiplier_id"] }`

Multiplies the amounts of the listed components of the same model entry by the decimal `factor`, exactly, before rounding. `applies_to` is REQUIRED and names component ids; a name that is not a non-multiplier component of the entry makes the card invalid. `when` is REQUIRED for a multiplier. `exclusive_with` is OPTIONAL and names other multipliers of the same entry; any other name makes the card invalid. Several active multipliers on the same component multiply together. When a multiplier is active and a multiplier named in its `exclusive_with` is also active, the engine refuses with `exclusive_components`: the card says that the combination has no defined price. A multiplier produces no amount of its own; the result lists the multipliers applied to each component.

### 4.5 `when`

A condition is an object with exactly one of:

| Form | True when |
|---|---|
| `{ "attribute": "service_tier", "eq": "priority" }` | The request attribute equals the string or boolean. |
| `{ "attribute": "service_tier", "in": ["priority", "fast"] }` | The request attribute equals one of the values. |
| `{ "quantity": "prompt_size", "gt": "200000" }` | The quantity is strictly greater than the integer. |
| `{ "quantity": "prompt_size", "lte": "200000" }` | The quantity is less than or equal to the integer. |
| `{ "time_utc": { "from": "16:30", "until": "00:30" } }` | The UTC time of day of `observed_at`, to the minute, is at or after `from` and before `until`. When `from` is later than `until` the window wraps past midnight. `from` equal to `until` makes the card invalid. |
| `{ "all": [condition, ...] }` | Every listed condition is true. |

The vocabulary is closed. An unknown condition form makes the card invalid. A condition on an attribute that the request does not carry, and that neither the entry's lower-bound value (Section 4.8) nor `assume` supplies with the caller's allowance, is a refusal (`missing_request_attribute`). A condition on an absent quantity is a refusal (`quantity_missing`). A request attribute's value is a string or a boolean. A `null` value was not supplied, and `assume` applies to it (Section 8). A value of any other type is `invalid_input` (Section 8, wrong types), whether or not a condition reads the attribute and whether or not `assume` defaults it. A card states no type for an attribute, so a string or a boolean that equals none of the values a condition names makes that condition false: the string `"true"` does not equal the boolean `true`. The engine evaluates every condition of the matched entry in card order, every member of an `all` included, before it reads any component quantity, so the outcome does not depend on which components turn out to matter.

**The values an entry prices.** A condition that names `priority` is false for `fast`, and the request would then take the price of no condition at all: a tier the entry has no price for would be priced as the standard one, and nothing in the result would say so. So a model entry states the values it prices in `attribute_values`, an object from attribute name to a list of at least one value, each a string or a boolean:

```json
{ "match": { "ids": ["ex-tier-1"] }, "attribute_values": { "service_tier": ["standard", "priority"] }, "components": [] }
```

For every attribute the member names, the engine takes the request's value. When the request supplies none, it takes the entry's lower-bound value, if the entry states one (Section 4.8) and the caller allows `attribute_lower_bound`, or else the `assume` default, if the caller allows `attribute_defaulted` (Section 8.3). It echoes a value it took in `assumed`. A value that equals none of the listed ones is a refusal (`attribute_value_unpriced`, status `unpriced`), and the result names the attribute and the value in `attribute`. The comparison is the one a condition makes: the string `"false"` is not the boolean `false`. When several attributes are outside their lists the result names the first by attribute name. An attribute that is neither supplied nor given a value by Section 4.8 or `assume`, or whose value the caller did not allow, has no value to compare; a condition that needs it still refuses with `missing_request_attribute`. An attribute name that is not a valid name, a list that is empty, and a value that is neither a string nor a boolean make the card invalid.

**An entry lists every attribute it reads.** An entry that names an attribute in a condition of any of its components, at any depth of `all`, MUST list that attribute in `attribute_values`. A card with an entry that does not is invalid (`card_invalid`), whichever entry a request resolves to and whatever the component's `type`. The rule is about the name. It does not require a value a condition names to be in the list: a condition on a value the list leaves out is never true, and the entry prices only the listed values.

A boolean attribute is listed like any other, by the values the entry prices. An entry with a batch price and a price for a request that is not a batch states `"batch": [false, true]`. An entry with no batch price states `"batch": [false]`, and a batch request is then refused. An entry that does not name `batch` prices a batch request like any other, and the result lists `batch` in `unread_attributes`. There is no shorter form: the list is what tells a value the entry has no price for from one it prices under no condition.

`assume` (Section 3.2) does not list an attribute. A default belongs to the card, and an entry takes it only for an attribute the entry lists. An entry whose condition names an attribute that `assume` defaults still lists it. An attribute that `assume` defaults and the matched entry does not list has no effect on that entry: the default is not taken, and it is not echoed in `assumed`.

An entry that does not list an attribute does not read it. So that a supplied attribute nothing read is never silent, a priced result lists in `unread_attributes` every attribute the request supplied that the matched entry does not list in `attribute_values`. A `null` attribute was not supplied and is not listed.

Request attributes defined by the core specification are `service_tier` (string, from `llm_call.service_tier`) and `batch` (boolean, from `llm_call.batch`; an `llm_call` that omits `batch` was not a batch request, so callers pass `false`). A card MAY condition on other attributes; the caller supplies them.

### 4.6 Unknown component types and unknown entry members

A component whose `type` is none of the four above is not an error in the card. The engine refuses with `unknown_component_type` and status `unpriced`: the card is newer than the engine.

The same forward rule holds for a model entry. A member directly on a model entry that this document does not define is not an error in the card. An engine that meets one refuses every request that resolves to that entry, with `unknown_entry_member` and status `unpriced`, and prices the card's other entries as usual. A later version of this document can therefore add an entry member, and an engine that predates it refuses only the entries that use it. Such a refusal is never a wrong price, so adding an entry member does not change the card schema identifier `opentrajectory.rate_card/1`. The rule covers the entry object itself. An undefined member anywhere else, including inside `match` or inside a component, still makes the card invalid. The card schema follows the rule: it allows undefined members on a model entry and nowhere else.

### 4.7 Cache-write lifetimes

A provider can price a cache write by how long the entry lives. A
**lifetime** is a whole number from 1 to 9999, written with no leading zero,
followed by `m` for minutes, `h` for hours or `d` for days: `5m`, `30m`, `1h`
and `12h` are lifetimes. The cache writes of one lifetime are the usage
quantity `cache_write_{lifetime}_input_tokens`, a key of
`token_usage.additional`, such as `cache_write_30m_input_tokens`. Each is a
part of `cache_write_input_tokens` (Section 5.1). A lifetime is a name: `60m`
and `1h` are two lifetimes, and usage names a lifetime as the provider does.

A card prices the writes of each lifetime with a component over its quantity.
A model entry lists the lifetimes it prices apart in `cache_write_lifetimes`,
at least one, each at most once. An entry that does not state the member
lists `5m` and `1h`. A string that is not a lifetime and a lifetime listed
twice make the card invalid. An engine that does not know the member refuses
an entry that states it with `unknown_entry_member` (Section 4.6), which is
never a wrong price.

The **lifetime parts** of an entry are the quantities of the lifetimes it
lists. Usage does not always carry them: a response may report only
`cache_write_input_tokens`, only some of the parts, or a part of a lifetime
the entry does not list. The **unspecified remainder** is
`cache_write_input_tokens` minus the entry's lifetime parts, where an absent
part counts as zero. Those tokens were written, and the usage does not say at
which of the entry's prices: their lifetime was not reported, or the entry
has no price of its own for it.

A model entry states what the engine does with them in `cache_write_lifetime`,
which has one of two forms:

| Form | Effect when the remainder is above zero |
|---|---|
| `{ "if_unspecified": "refuse" }` | The engine refuses with `cache_write_lifetime_unknown`. |
| `{ "if_unspecified": "lower_bound", "component": "<id>" }` | When the caller allows the `cache_write_lifetime_lower_bound` assumption (Section 8.3), the remainder is added to the units of the named component, and the result carries `lower_bound`. Without the allowance the engine refuses with `cache_write_lifetime_unknown`. |

The card says how a remainder can be priced. The caller says whether it may be. With `"refuse"` the allowance changes nothing: the card's author has said that no price can be defended.

`component` is REQUIRED with `lower_bound` and names a `per_unit` component of
the same entry; any other name makes the card invalid, as does `component`
with `refuse`. The card's author names the component with the lowest price a
cache write can have, which is usually the shortest lifetime's, so the total
is the least the request can have cost. The engine does not check that the
price is the lowest.

Rules:

- The names of the remainder are read as quantities, by name, the way a
  component reads them (Section 5). A derived quantity that a card defines
  under the name of a lifetime part takes precedence over the usage key of
  that name.
- A `lower_bound` component whose `type` the engine does not know is not a
  `per_unit` component, so the card is invalid; Section 4.6 does not apply
  to the member.
- When `cache_write_input_tokens` is absent there is no remainder and the
  member has no effect.
- A remainder below zero is a refusal (`usage_inconsistent`).
- With `lower_bound`, the named component's units are its own quantity, or
  zero when that quantity is absent, plus the remainder. It is then never
  skipped as absent. If its `when` is false, the remainder has no price and
  the engine refuses with `cache_write_lifetime_unknown`.
- The absent parts counted as zero here are not listed in
  `defaulted_quantities`; the result's `lower_bound` states what was done.
- In an entry that states `cache_write_lifetime`, a component whose quantity
  adds the quantity of a lifetime the entry does not list, by its name or
  through the derived quantities it names (Section 5.1, rule 1), makes the
  card invalid. Those writes are in the remainder, so the component would
  price them a second time.

An entry that prices cache writes by lifetime SHOULD state the member. Without
it the remainder is priced only if a component or a derived quantity of the
card covers it, and the result carries no label.

### 4.8 Request attributes a request does not state

A request that states no service tier was served at one, and an entry with a
price for each tier cannot tell which. A default of `assume` (Section 3.2)
names the tier the request most likely had, and a total priced with it can
be wrong in either direction. A model entry can name instead, for an
attribute, the value whose price is the least that a request that does not
state the attribute can have cost. It does so in `attribute_lower_bounds`, an
object from attribute name to that value:

```json
{
  "match": { "ids": ["ex-tier-3"] },
  "attribute_values": { "service_tier": ["standard", "flex", "priority"] },
  "attribute_lower_bounds": { "service_tier": "standard" },
  "components": []
}
```

When the request does not supply an attribute that the member names, and the
caller allows the `attribute_lower_bound` assumption (Section 8.3), the engine
takes the named value, for the values the entry prices (Section 4.5) and for
every condition. It echoes the value in `assumed`. The assumption is a lower
bound, so a result whose other assumptions are lower bounds too carries
`"bound": "lower"`. Without the allowance the member has no effect, and a
default of `assume` applies as Section 3.2 says.

The card's author names the value, and the engine does not check that its
price is the lowest the entry states. The value is the lowest price among the
values a request that states none can have had. A cheaper value that a
request has to ask for, and that every request that used it states, is not
among them: a flex tier that the provider reports on every response it
serves is one. A request that states no tier did not use it.

Rules:

- Each attribute the member names is listed in `attribute_values`, and its
  value is one of the listed values. A value that is not a string or a
  boolean, an attribute the entry does not list, and a value the list leaves
  out make the card invalid.
- The member applies only to an attribute the request does not supply, or
  supplies as `null`. A supplied value is priced as supplied, and a value the
  entry does not list is still `attribute_value_unpriced`. An attribute the
  model's name sets (Section 7.5) is supplied.
- When the caller allows both `attribute_lower_bound` and
  `attribute_defaulted`, and `assume` also has a value for the attribute, the
  member's value is taken, and `attribute_defaulted` is not applied for that
  attribute.
- An engine that does not know the member refuses an entry that states it
  with `unknown_entry_member` (Section 4.6), which is never a wrong price.

### 4.9 Service tiers

A service tier is a request attribute, `service_tier`, and a card prices each
tier with the forms above. The entry lists the tiers it prices in
`attribute_values`, so a tier it has no price for is refused, never priced as
another (Section 4.5). A tier whose prices are one factor of the standard
prices is a `multiplier` whose `when` names the tier. A factor can be less
than one, as for a flex tier at half the standard prices. A tier that scales
only some components names those in `applies_to`, and the others keep their
standard price. A tier whose prices are not a factor of the standard prices
states its own components under a `when`. This entry has a flex tier at half
the standard prices that keeps cache reads at the standard price, and a
priority tier at 1.8 times every price:

```json
{
  "match": { "ids": ["ex-tier-3"] },
  "attribute_values": { "service_tier": ["standard", "flex", "priority"] },
  "attribute_lower_bounds": { "service_tier": "standard" },
  "components": [
    { "id": "input", "type": "per_unit", "quantity": "uncached_input", "price": "2", "per": "1000000" },
    { "id": "cache_read", "type": "per_unit", "quantity": "cache_read_input_tokens", "price": "0.2", "per": "1000000", "if_absent": "skip" },
    { "id": "output", "type": "per_unit", "quantity": "billable_output", "price": "12", "per": "1000000" },
    { "id": "flex", "type": "multiplier", "factor": "0.5", "applies_to": ["input", "output"], "when": { "attribute": "service_tier", "eq": "flex" } },
    { "id": "priority", "type": "multiplier", "factor": "1.8", "applies_to": ["input", "cache_read", "output"], "when": { "attribute": "service_tier", "eq": "priority" } }
  ]
}
```

A provider that gives one tier two names, such as `fast` and `priority`,
lists both, and the tier's `when` names both with `in`.

## 5. Quantities and the standard prelude

**Base quantities** come from the usage object of the core token model, by field name: `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_write_input_tokens`, `reasoning_output_tokens`, and every key of `token_usage.additional` under its own name, including the well-known keys `cache_write_{lifetime}_input_tokens` for every lifetime (Section 4.7), such as `cache_write_5m_input_tokens` and `cache_write_1h_input_tokens`, and `web_search_requests`. `request_count` is a base quantity supplied by the caller for aggregated usage. A field the usage object omits, or states as `null` (Section 8), is absent; it is not zero.

A count MUST be a non-negative integer, given as a JSON number or as a decimal integer string. A JSON number is read the way most JSON readers read it, as an IEEE 754 double: it MUST be integer valued and at most 2^53-1 (so `1000.0` is the count 1000, and `9007199254740993` is refused whether or not the reader kept its digits). A larger count travels as a string. A negative count, a non-integer, a value of any other type but `null`, a count stated twice (flat and under `additional`), and an `additional` that is neither an object nor `null` are refusals (`usage_inconsistent`). A `null` count states nothing, so it does not make a name stated twice. A derived quantity name takes precedence over a usage key of the same name.

The core token model is inclusive: `input_tokens` counts every input token including cached ones, and `output_tokens` includes reasoning tokens. The **standard prelude** states the consequences once, as data every engine builds in:

| Name | Definition |
|---|---|
| `uncached_input` | `{ "sub": ["input_tokens", { "ref": "cache_read_input_tokens", "default": "0" }, { "ref": "cache_write_input_tokens", "default": "0" }] }` |
| `prompt_size` | `"input_tokens"` |
| `billable_output` | `"output_tokens"` |

`reasoning_output_tokens` is part of `output_tokens`. A card MUST NOT add it to the output quantity; a card that prices reasoning differently subtracts it in a derived quantity. Cache counts larger than `input_tokens` make `uncached_input` negative, which is a refusal (`usage_inconsistent`). Every `default` the engine used is echoed in the result (`defaulted_quantities`).

### 5.1 Reported quantities that nothing priced

A card prices the quantities its components name. A count that the usage reports and no component prices adds nothing to the total, and the total alone does not say so. A web search count against an entry with no search fee is one case. Cache reads that an entry subtracts from its input and has no component for are another. A priced result names such quantities in `unpriced_quantities`, so that the total is never read as the price of usage it left out. The member changes no amount.

The engine looks at every base quantity the usage reports with a value above zero, except `request_count`. A quantity is **priced** when one of these holds, and is listed when none does:

1. A contributing component counts it. Once every derived quantity is replaced by its definition, a component's quantity is base quantities added and subtracted; a `default` plays no part. The component counts every base quantity that it adds, and takes away one that it subtracts and nowhere adds. The component that receives the unspecified cache-write remainder (Section 4.7) also adds `cache_write_input_tokens` and subtracts each of its entry's lifetime parts, because that is the remainder.
2. A contributing component prices the quantity it is part of, by rule 1 or by this rule, and does not take the part away. The parts are those of the core token model: `reasoning_output_tokens` is part of `output_tokens`; `cache_read_input_tokens` and `cache_write_input_tokens` are parts of `input_tokens`; `cache_write_{lifetime}_input_tokens`, for every lifetime (Section 4.7), is part of `cache_write_input_tokens`. So a component over `input_tokens` prices the cached tokens in it. A component over `uncached_input` takes them away, and they need components of their own.
3. The parts of it that the usage reports add up to it, and each of them that is above zero is priced. Nothing of it is left over.

A usage key that a derived quantity of the same name hides (Section 5) is never read, so nothing counts it. A contributing component is one listed in `components`. A skipped component, a multiplier and a `per_call` component count nothing. A tier quantity and the quantity of a condition are read to choose a price, and count nothing either. A component whose price is zero still counts its quantity: the card states that price.

## 6. Arithmetic

Money never passes through binary floating point. An implementation MUST follow these steps with arbitrary-precision integers or exact rationals.

1. A price is converted to an integer number of pico-dollars (10^-12 USD). A price with more than 12 decimal places makes the card invalid.
2. The exact amount of a component is a rational number of pico-dollars: units x price / per, times every active multiplier `factor`, times every applicable adjustment `factor`. For `marginal` tiers the band amounts are added before the factors apply.
3. Each component amount is rounded half up to a whole nano-dollar (10^-9 USD): `nano = floor((2 x numerator + denominator x 1000) / (2 x denominator x 1000))` for a pico amount `numerator / denominator`.
4. The total is the sum of the rounded component amounts. It is not a rounding of the exact sum.
5. A total greater than 9223372036854775807 nano-dollars (2^63-1) is a refusal (`overflow`). Every total up to that limit is a result.

This limit is the engine's, and it is wider than what one metric point carries. The metric contract holds one cost increment to 9007199254740991 nano-dollars (2^53-1, about 9 million USD), so that every JSON reader holds it exactly. A total above that is still a valid result of this contract: it is returned exactly, as strings. It cannot be one metric increment, and the metric contract records no cost point for it (Section 10). Nothing rounds it, clamps it or splits it.

Amounts in the result are strings: `amount_nano` and `total_nano` are integer strings, and `total` is the same value as a decimal string with exactly nine decimal places.

`cost_usd` on the wire is a JSON number. A producer writes the decimal `total` as the number; consumers that need exact sums across many events recompute from usage and the named card.

## 7. Model names and resolution

Producers name one model in many ways: the maker's identifier, a dated version, a gateway's prefix, a cloud platform's identifier, a route name an operator chose. The engine first turns the name it is given into a **canonical name**, then finds the card entry that prices it. Both steps are part of the contract, so that two products given the same name report the same model and the same cost.

### 7.1 Canonical names

A canonical name has two parts.

- The **canonical provider** is the party that served the call and bills for it. Its values are the provider names this specification uses for `gen_ai.provider.name` (portable metrics). A model served through a cloud platform has that platform as its provider.
- The **canonical model** is the identifier the model's maker gives the model, whoever served it. The same model has the same canonical model on every provider, so cost groups by model across providers. Its price can still differ by provider, because a card entry matches on both parts.

| Question | Rule | Why |
|---|---|---|
| A dated version, or the family? | The canonical model is the most specific identifier the maker publishes for what was served: the dated version, where there is one. The aliases document MAY also name the **family** a canonical model belongs to (Section 9), and a result then carries both. | Prices attach to a version, and people group by family. Carrying both loses neither. |
| A name that moves, such as one ending `-latest` | An alias entry with an effective window (Section 9). The name resolves to the entry in effect at `observed_at`. | What the name stands for changes on a date, and a cost must be recomputable with the meaning the name had then. |
| A fine-tuned model | Its canonical model is the maker's name for the tuned variant of the base model, without the parts that identify one customer's tuning job. A structural rule removes those parts. Pricing it as its base model is a fallback (Section 7.4), never a default. | The customer's parts are unbounded and price nothing. The variant can be priced differently from its base. |
| A deployment or route name an operator chose | It is not a model name. It resolves only through an alias entry. | Only whoever chose the name knows what it stands for. |
| A model released today | An identifier is canonical as soon as a card has an entry for it. Nothing in an aliases document has to change first. | A model can be priced on the day its price is published. |

### 7.2 Canonicalization

Input: the `model` received (its `id` and OPTIONAL `provider`), `observed_at`, the OPTIONAL `client_source`, and the OPTIONAL aliases document (Section 9). The card is not read: the canonical name of a model does not depend on which card is loaded.

Without an aliases document the name is canonical as received, and the step is `exact`. With one:

1. **Provider.** When an entry of `providers` lists the received provider among its `names`, the provider is replaced by the entry's `canonical`. Every later comparison uses the provider after this step.
2. **Alias.** An alias entry applies when its `ids` contain the identifier, its `provider`, when stated, equals the provider, and its `client_sources`, when stated, contain the input's `client_source`. An entry that states `client_sources` never applies to an input that states no `client_source`. An entry with an effective window applies only when `observed_at` is inside the window. When an entry with a window lists the identifier, passes the two checks before it, and `observed_at` is absent or malformed, the result is a refusal (`missing_request_attribute`). When an entry that states `client_sources` applies, the entries that state none do not: an alias written for one client takes precedence over the alias for every client. An entry's **target** is its `canonical`, the provider it leaves, and the `attributes` it sets. Entries that apply with different targets are a refusal (`ambiguous_model`); two entries whose `attributes` differ have different targets, even when one states none. Otherwise the identifier is replaced by the entry's `canonical`, the provider by its `canonical_provider` when it states one, and the entry's `attributes` are the attributes the name sets (Section 7.5). The step is `alias`. An alias resolves once: the canonical value is not looked up again, and no rule applies to it.
3. **Named as canonical.** When no alias applied and the document itself names the identifier as canonical, as the `canonical` of any alias entry or among the `models` of a family, the identifier is canonical as received and no rule applies to it. The step is `exact`.
4. **Structural rules.** Otherwise each rule of `rules` is tried once, in document order, against the current identifier and provider. A rule applies when its `provider`, if stated, equals the current provider, the current provider is not one of its `except_providers`, the current identifier matches none of its `except_names`, and one of its `forms` matches the identifier (Section 9). The first form that matches, in the order written, is the one used. The rule removes the matched text, and its `set_provider`, when stated, replaces the provider. A rule whose match would leave an empty identifier does not apply. Later rules see the rewritten identifier and provider. When at least one rule applied, step 2 runs once on the rewritten name, because what is left may be an alias. The step is `rule`, and the result lists the rules that applied, in order.
5. Otherwise the name is canonical as received. The step is `exact`.

A structural rule removes or rewrites wrapping and does not change which model is meant. So steps 1 to 5 never change whether a cost is calculated or estimated.

**A name that says who served it.** Some names carry the provider: a gateway's prefix for a platform, a platform's identifier form, a platform's version suffix. A rule that removes such a form states `set_provider`, so the name is priced at that provider's entry (Section 7.3) whether or not the producer sent a provider. A rule limited to the provider whose identifiers have a shape, such as one that removes a vendor prefix `{seg}.`, comes after the rule that recognises the provider, since rules run in document order.

When a family lists the canonical model, the result carries the family.

### 7.3 Finding the entry

Input: the canonical provider and model, and `observed_at`.

1. **Exact.** Entries whose `match.provider` is absent or equal to the provider, and whose `match.ids` contains the model, are candidates. When a candidate states `match.provider`, the candidates that state none are removed: the provider's own entry takes precedence over the default, whatever the `precedence` of either and whatever their windows. Entries not effective at `observed_at` are then removed. Among the rest the highest `precedence` wins; a tie is a refusal (`ambiguous_model`).
2. **Pattern.** Only when step 1 had no candidate at all: the same procedure over `match.patterns`.
3. No candidate in either step is a refusal (`unknown_model`), unless a fallback applies (Section 7.4). Candidates that were all removed for their effective window are a refusal (`card_not_effective`).

The result states how the entry was found in `model_match.via`: `"exact"` or `"pattern"`, with the prefix `alias_` (`"alias_exact"`, `"alias_pattern"`) when an alias entry replaced the identifier. An exact match always beats a pattern, whatever the precedence, because wrong prices come from patterns that match too much.

**The default provider.** An entry that states no `match.provider` is the default for its model. A request that names no provider, and whose name no rule gives one, is priced only by such entries: an entry that states a provider never applies to it. A card that holds a maker's own list prices writes them this way, so that a request with no provider is priced at the maker's list price. An entry that states a provider holds the price of a party that serves the maker's model at its own price: a cloud platform or an inference host, such as `amazon-bedrock`, `google-vertex`, `azure`, `fireworks` or `baseten` in a card of public prices. It applies when the canonical provider is known and equal to it, received or set by a rule (Section 7.2), and it takes precedence over the default. A request whose provider has no entry of its own is priced at the default. When the provider's entries for the model are all outside their windows, the request is refused with `card_not_effective`, and the default is not used in their place: the card has a price of its own for that provider, though not for that time.

### 7.4 Fallback

A fallback rule names a related model: a dated version priced as its base model, a tuned variant priced as the model it was tuned from. It changes which model is priced, so it is never applied silently.

Fallback rules are read only when Section 7.3 found no candidate at all. Each rule of `fallbacks` is tried once, in document order, against the canonical name, by the matching of Section 7.2 step 4. After each rule that applies, step 2 of Section 7.2 runs once on the rewritten name and Section 7.3 looks it up. Rules accumulate: a later rule sees what the earlier ones left. The first lookup that chooses an entry ends the search; a lookup that ends in any refusal does not, and the next rule is tried.

- When a lookup chose an entry and the caller allows the `model_fallback` assumption (Section 8.3), that entry prices the request, and the result is an estimate whose `assumptions` name `model_fallback`. `model_match.step` is `fallback`. `model_match.canonical` stays the canonical model of Section 7.2, which is the model that was served, and `model_match.priced_as` names the provider and model whose prices were used. `model_match.rules` lists the structural rules and then the fallback rules that applied.
- When a lookup chose an entry and the caller does not allow the assumption, the result is the refusal `unknown_model`, and it carries `fallback`: the rules, and the provider and model that would have been priced. A caller can count the names that resolve only by fallback; each is an alias someone has yet to review.
- When no lookup chose an entry, the result is `unknown_model` with no `fallback` member.

### 7.5 Attributes a name sets

A client can name one model several ways for several ways of serving it: a name with a suffix for a faster tier, or for a larger context window. Such a name stands for the model and for a request attribute. An alias entry states the attributes in `attributes` (Section 9), for example `{ "service_tier": "fast" }` for a name that means the fast tier.

- **Where they come from.** The attributes a name sets are those of the alias entry that applied in step 2 of Section 7.2. When a fallback lookup (Section 7.4) applies an alias entry that sets attributes, they are added to those the name set. A lookup whose alias sets an attribute the name already set to another value chooses nothing, and the next rule is tried.
- **They are supplied attributes.** `price` and `price_point` read them as if the request supplied them: for the values an entry prices (Section 4.5), for conditions, and for `unread_attributes`. A default of `assume` is never taken for an attribute a name sets. An attribute a name sets is not an assumption: the result can be `"calculated"`.
- **Precedence and conflicts.** A request attribute that is absent or `null` takes the value the name sets. A request attribute equal to it changes nothing. A request attribute with another value is a refusal, `attribute_conflict`, with status `unpriced`: the name and the request disagree about the price, and the engine picks neither. The result's `attribute` names the attribute and the value the request states, and `model_match.attributes` holds what the name set. When several attributes conflict, the first by attribute name is named.
- **On the result.** `model_match.attributes` (Section 8) and the `attributes` of `canonicalize` (Section 8.5) list the attributes the name set, as an object. They are absent when it set none.

A structural rule sets no attribute. It removes wrapping and leaves the request as it was (Section 7.2).

## 8. The contract

`price(usage, request, model, observed_at, card, aliases?, allow?, producer_cost?) -> result`

Input object (the shape the conformance vectors use):

| Field | Required | Description |
|---|---|---|
| `model` | REQUIRED | An object, `{ "provider": "...", "id": "..." }`, whose two members are strings; `provider` OPTIONAL. The name as the producer sent it. Where a response names the model that served the call, that is the name to send; otherwise the model the request asked for. A route or deployment name is not a model and resolves only through an alias (Section 7.1). |
| `client_source` | OPTIONAL | A string that names the client that produced the usage, such as an editor or a command-line agent. Only an alias entry that states `client_sources` reads it (Section 7.2). |
| `observed_at` | REQUIRED when the card uses time | RFC 3339 instant of the request with a `Z` or `+00:00` offset; any number of fractional digits; compared as an instant. A card uses time when it or any of its entries states an effective window, or any condition uses `time_utc`. For such a card an absent or malformed `observed_at` is a refusal (`missing_request_attribute`). A card that does not use time never reads it. An aliases document reads it only to choose among alias entries that state a window (Section 7.2). |
| `usage` | REQUIRED | The core `token_usage` object: flat counts and OPTIONAL `additional`. An absent `usage` states no count. |
| `request` | OPTIONAL | An object of request attributes, for example `{ "service_tier": "priority", "batch": false }`. |
| `usage_scope` | OPTIONAL | `"request"` (default) or `"aggregate"`. An absent member and a `null` are not stated. Every other value is undefined: another word, the empty string, or a value that is not a string. An undefined value is never read as the default. |
| `request_count` | OPTIONAL | Positive number of requests the usage covers. Only with `"aggregate"`; stated otherwise, or not a positive integer, it is a refusal (`usage_inconsistent`), as is an undefined `usage_scope`. |
| `input_token_source`, `output_token_source` | OPTIONAL | `"reported"` or `"estimated"`: whether the provider reported the counts of that side, or the producer counted them itself. These are the member names of the metric contract's token source. An absent member is `"reported"`. See Section 8.3. |
| `allow` | OPTIONAL | A list of the assumption names of Section 8.3 that the caller permits. An absent or empty list permits none. A repeated name has no further effect. |
| `producer_cost` | OPTIONAL | The cost the producer of the usage computed for it by its own means, `{ "amount_nano", "producer" }`. See Section 8.4. |

**Absent and null.** A member of the input whose value is `null` is read as if the member were not there. This holds at every level of the input: for a member of the input object, of `model`, of `request`, of `usage`, and of `usage.additional`. So a `null` count is a count that was not reported, never zero and never an inconsistency; a `null` `usage` states no count; a `null` request attribute was not supplied, and `assume` applies to it; a `null` `model` or `model.id` names no model; a `null` `request_count` is not a count stated for usage that is not aggregate. This is the rule of the metric contracts, so one usage record reads the same when its tokens are counted and when they are priced, and a producer whose language writes a missing value as `null` is not refused for it.

**Wrong types.** A member of the input that is not `null` and is not of the type this section gives it is never read as absent. A wrong type is the producer's mistake, and reading it as a missing member would price the request as if the member had not been sent: a `request` that is a string would quietly take every attribute from `assume`. So:

- a `usage` that is not an object is `usage_inconsistent`, as a count that is not an integer and an `additional` that is not an object are (Section 5);
- a `model` that is not an object, a `model.id`, `model.provider` or `client_source` that is not a string, and a `request` that is not an object are `invalid_input`, whether or not the card or the aliases document would have read them;
- a request attribute whose value is neither a string nor a boolean is `invalid_input` too, whether or not a condition reads it and whether or not `assume` defaults it: a `service_tier` of `1` would otherwise be priced at the tier `assume` names;
- an `allow` that is not a list, or that has an element which is not one of the assumption names of Section 8.3, is `invalid_input`: a misspelled name would otherwise permit nothing and say nothing;
- an `input_token_source` or `output_token_source` that is not one of the two strings is `invalid_input`;
- a `producer_cost` that is not an object of the form Section 8.4 gives is `invalid_input`.

Three members keep the rules stated for them: `usage_scope` and `request_count` (the table above), and `observed_at` (a value that is not a string is malformed, and only a card that uses time reads it). An empty `model.id` is a string; it names no model in the card, so the result is `unknown_model`.

**Names are data.** The name of a request attribute, a quantity, a usage count or a member of `assume` is a string and nothing more. An engine looks a name up only among the members the card, the aliases document or the input states. Some languages give every object members of their own, and treat some names specially when a member is set. Neither may reach a lookup: `constructor`, `toString` and `__proto__` are ordinary names. A condition on an attribute so named that the request does not carry and `assume` does not default refuses with `missing_request_attribute`; an `assume` default, a supplied attribute and a reported count so named are stored, read, echoed and listed under that name like any other.

The rule is for the input. A rate card and an aliases document are written by an author and checked against a schema, and in them `null` is a value like any other: where the document defines a string, an object or a list, a `null` breaks it, on an optional member as on a required one.

Order of evaluation, first failure wins: card validity; the types of `model`, `client_source`, `request`, `allow`, the two token sources and `producer_cost`, and the values of request attributes; `observed_at` and the card's effective window; model resolution; an attribute the name sets that the request states with another value (Section 7.5), in order of attribute name; unknown members of the matched entry; unknown component types in the matched entry; the values the matched entry prices for an attribute (Section 4.5), in order of attribute name; `usage_scope`; usage validity, a `usage` that is not an object included; a token source stated as `"estimated"` (Section 8.3); `checks` in card order; the unspecified cache-write remainder (Section 4.7) below zero or refused; conditions in card order, with the aggregate rule for a condition on a quantity; exclusivity; a lower-bound component whose `when` is false; component quantities in card order, with the aggregate rule for a tiered component; arithmetic; whether anything contributed; overflow. Derived quantities are evaluated only when a check, a condition, or an active component needs them, so an inconsistency in a quantity the matched entry never reads does not refuse the request. Where a step would refuse and Section 8.3 names an assumption for that refusal, an allowed assumption is applied at that step and evaluation goes on.

**Aggregated usage.** A tier boundary and a quantity condition are properties of one request, and an aggregate does not say how its total was spread over its requests. It does bound them. A count is never negative, and a quantity derived by subtraction that falls below zero refuses the request (Section 5), so the quantity of each request in an aggregate is at most the quantity of the aggregate. When `usage_scope` is `"aggregate"`:

- A `tiered_per_request` component whose tier quantity is at or under its lowest `above` is priced at the base price. Every request in the aggregate was in the base band, so the base price is the price of every unit. This holds in both modes. In `marginal` mode the tier quantity is the priced quantity, and no request had a unit above the first boundary.
- A condition on a quantity whose value is at or under the condition's integer is decided: `gt` is false and `lte` is true, for every request.
- Above that value the answer depends on how the total was spread, and the engine refuses with `aggregate_usage_with_request_tier`. An aggregate of 6000 tokens against a boundary of 1000 may be six requests in the base band or one request far above it.
- The engine refuses with the same reason when the quantity is defined, directly or through another derived quantity, with a `default` other than zero. Such a quantity is not the sum of the requests' quantities, so the bound does not hold. The definition is looked at before the quantity is read.

The rule is applied where the engine reads the quantity: for a condition when conditions are evaluated, every member of an `all` included, and for a tiered component when its tier quantity is read. A tiered component whose `when` is false, or that is skipped as absent, is not looked at. An absent quantity is `quantity_missing`, as for one request. The amount is the base price applied to the aggregate's quantity and rounded once, as a `per_unit` component of an aggregate is.

A `per_call` component under `"aggregate"` needs `request_count` (`quantity_missing` without it). On the wire, a calculated cost on `turn_end` or `subagent_stop` MUST be the sum of the calculated costs of its calls, never a price computed from summed tokens.

A consumer that prices metric points prices each point on its own with `price_point` (Section 8.6), which reads the size band a point carries. Pricing from points lists what a point has to carry for that. An aggregate given to `price` carries no band, and the rules above are all that can be said of it.

Result:

| Field | Description |
|---|---|
| `status` | `"priced"`, `"producer"`, `"unpriced"`, or `"invalid"`. `"producer"` is the outcome of Section 8.4: the engine has no amount of its own, and the result carries the producer's. |
| `source` | Present when priced: `"calculated"` when no assumption was applied, `"estimated"` otherwise (Section 8.3). |
| `assumptions` | Present when priced, possibly empty: `[{ "name", "detail" }]`, the assumptions that were applied, in the order of the table in Section 8.3. This `detail` is an object with the members that table gives, and conformance tests compare it. |
| `bound` | Present only when priced and the total is the least the request can have cost: `"lower"` (Section 8.3). |
| `reason` | Absent when priced. Otherwise one value of the closed list below. |
| `detail` | OPTIONAL free text for people, on the result itself. Not compared by conformance tests. |
| `currency` | `"USD"`. |
| `total`, `total_nano` | Present when priced. |
| `components` | Present when priced: for each contributing component, in card order, `{ "id", "type", "quantity", "units", "amount_nano", "multipliers": [ids], "adjustments": [ids], "bands": [{ "above", "units", "price" }] }`. `multipliers` and `adjustments` are always present, in card order. `quantity` and `units` are absent for `per_call` without aggregation (with aggregation they are `request_count` and its value). `bands` is present only for tiers and lists the bands that received at least one unit, lowest first; the base band has `"above": "0"`, and `price` is the band's price with no trailing zeros. A component whose units are zero still contributes, with amount zero. |
| `skipped` | Present when priced, possibly empty, in card order: `[{ "id", "why" }]`, `why` is `"when"` or `"absent"`. Multipliers are never listed. |
| `assumed` | Present when priced, possibly empty: the values the engine took for request attributes the request did not supply, the lower-bound values of an entry (Section 4.8) and the `assume` defaults. |
| `defaulted_quantities` | Present when priced, possibly empty: names of quantities whose `default` was used, sorted. |
| `lower_bound` | Present only when priced and Section 4.7 added an unspecified cache-write remainder to a component: `{ "component", "units" }`, the component's id and the units added, as an integer string. It says what was done; `bound` says whether the total is a lower bound. |
| `unread_attributes` | Present when priced, possibly empty: the names of the request attributes the caller supplied that the matched entry does not list in `attribute_values` (Section 4.5), sorted. They had no effect on the price. |
| `unpriced_quantities` | Present when priced, possibly empty: the names of the usage quantities reported above zero that nothing priced (Section 5.1), sorted. |
| `attribute` | Present only with `attribute_value_unpriced` and `attribute_conflict`: `{ "name", "value" }`. With `attribute_value_unpriced`, the attribute and the value the entry has no price for, as supplied, defaulted or set by the name. With `attribute_conflict`, the attribute and the value the request states (Section 7.5). `value` is a string or a boolean. |
| `producer_cost`, `difference_nano` | Section 8.4. |
| `card` | `{ "id", "version", "rate_card": "{id}@{version}", "sha256" }`. Present for every result except one with the reason `card_invalid`. `sha256` is the lowercase hex SHA-256 of the card bytes as supplied, present when the caller supplied bytes. |
| `model_match` | Present once a model entry was chosen. `received`: the `model` as received, its `id` and its `provider` when one was sent. `provider`: the canonical provider, absent when none was received and none was set. `canonical`: the canonical model. `family`: present when the aliases document names one for the canonical model. `step`: `"exact"`, `"alias"`, `"rule"` or `"fallback"` (Section 7). `rules`: the identifiers of the rules that applied, in order; absent when none did. `aliases`: the `{id}@{version}` of the aliases document, present when one was supplied and states them. `via` (Section 7.3). `entry`: the zero-based index in `models`. `priced_as`: `{ "provider", "model" }`, only when `step` is `"fallback"`. `attributes`: the request attributes the name set (Section 7.5), present only when it set any. |
| `fallback` | Present only with the reason `unknown_model`, when a fallback rule would have chosen an entry and the caller did not allow `model_fallback` (Section 7.4): `{ "rules", "provider", "model" }`, the rules that would have applied and the provider and model that would have been priced; `provider` is absent when none is known. It goes with the reason, so a `"producer"` result (Section 8.4) keeps it. |

**Sorted** means one order in every engine: ascending by Unicode code point, compared one code point at a time, a name that begins another before it. This is the order of the names' UTF-8 bytes. It is not the order of UTF-16 code units, which puts a character outside the Basic Multilingual Plane before U+E000 to U+FFFF; an engine whose language sorts strings that way MUST NOT use that order. `unread_attributes` and `unpriced_quantities` hold names from the input, which can be any string. `defaulted_quantities`, and the `attributes` of an `attribute_defaulted` assumption, hold names from the card, which the card's schema keeps to ASCII letters, digits, `_`, `.` and `-`, so every order agrees on them.

Closed reason list:

| Reason | Status | Meaning |
|---|---|---|
| `card_invalid` | invalid | The card breaks a rule of this document. |
| `usage_inconsistent` | invalid | A count is negative or not an integer, `usage` or `usage.additional` is not an object, a subtraction went negative, or a check failed. |
| `invalid_input` | invalid | `model` is not an object, `model.id`, `model.provider` or `client_source` is not a string, `request` is not an object, a request attribute's value is neither a string nor a boolean, or `allow`, a token source or `producer_cost` is malformed (Section 8, wrong types). The same string as the `allocate` reason for malformed input. |
| `exclusive_components` | invalid | Two multipliers that exclude each other are both active. |
| `overflow` | invalid | The total exceeds the limit in Section 6. |
| `card_not_effective` | unpriced | The card or the matching entry does not cover `observed_at`. |
| `unknown_model` | unpriced | No entry matches. |
| `ambiguous_model` | unpriced | Several entries or aliases match with equal claim. |
| `quantity_missing` | unpriced | A needed quantity is absent. |
| `missing_request_attribute` | unpriced | A condition needs an attribute that was neither supplied nor defaulted. |
| `attribute_value_unpriced` | unpriced | A request attribute has a value the matched entry does not list among those it prices (Section 4.5). |
| `attribute_conflict` | unpriced | The model's name sets a request attribute that the request states with another value (Section 7.5). |
| `unknown_component_type` | unpriced | The matched entry uses a component type the engine does not know. |
| `unknown_entry_member` | unpriced | The matched entry has a member the engine does not know (Section 4.6). |
| `cache_write_lifetime_unknown` | unpriced | Cache writes have no reported lifetime and the entry says to refuse, or its lower-bound component is not active (Section 4.7). The string is the metric issue code for the same fact. |
| `aggregate_usage_with_request_tier` | unpriced | Aggregated usage is above the lowest boundary of a per-request tier or above the integer of a quantity condition, or the quantity is defined with a default other than zero (Section 8). |
| `usage_estimated` | unpriced | A token source is `"estimated"` and the caller did not allow the `tokens_estimated` assumption (Section 8.3). |
| `point_not_price_ready` | unpriced | Only from `price_point`: the matched entry prices the point's quantity inside another quantity, and the result names that one in `send` (Section 8.6). |
| `point_quantity_unpriced` | unpriced | Only from `price_point`: none of the point's components is active, and no other component of the matched entry prices the point's quantity (Section 8.6). |

An engine MUST NOT return an amount of its own (`total`, `total_nano`, `components`) together with a reason, and MUST NOT return a zero amount in place of a refusal. A `"producer"` result carries a reason and the producer's amount; that amount is in `producer_cost` and nowhere else. A priced total of zero is legitimate only when every contributing component computed to zero. When no component of the matched entry contributed (each was skipped) nothing was priced, and the engine refuses with `quantity_missing`. A request that names no model is `unknown_model`.

### 8.1 `allocate`

`allocate(reported_total, breakdown) -> parts`

When the billing party reported a total and a calculation produced a component breakdown, `allocate` splits the reported total over the components in proportion to their calculated amounts, so that a reported cost can still be shown by component. `reported_total` is a non-negative decimal string: digits with no sign, no exponent and no leading zero unless the whole part is the single digit `0`, then optionally a point followed by one to nine digits. `breakdown` is `[{ "id", "amount_nano" }]`, and each `amount_nano` is a non-negative integer string with no leading zero. Both are numbers written as strings, bound by the 64 characters of Section 4. `reported_total`, `breakdown`, and the `id` and `amount_nano` of every part are required, and a `null` in the place of one is that value missing (Section 8): `invalid_input`. A `null` element of `breakdown` is not a part, and is `invalid_input` too. `breakdown` has at least one part: an empty list is `invalid_input`, for a zero total as for any other, because there is nothing to divide the total between. Every `id` names one part: an empty `id`, and an `id` that two parts share, are `invalid_input`. Each part is `floor(reported x amount / sum)` nano-dollars, and the nano-dollars left over are handed out one each to the parts with the largest remainders, ties going to the earlier component. The parts sum exactly to the reported total. When the calculated amounts sum to zero and the reported total is not zero the function returns `{ "status": "unallocated", "reason": "zero_basis" }`; malformed input returns `{ "status": "unallocated", "reason": "invalid_input" }`. A value of the wrong type is malformed input, never an absent one: a `reported_total` that is not a string, a `breakdown` that is not a list, a part that is not an object, and an `id` or `amount_nano` that is not a string.

The cost stays `cost_source: "reported"`; allocation changes only how it is displayed.

The cost join contract divides a billed
amount between the calls a provider's report covered with arithmetic of the
same shape: a floor for each part, then the units left over handed out one
each to the largest remainders, ties going to the earlier part. It is not this
function, and the join states its own rule in full. Its inputs are wider than
`allocate` takes: a weight may be a decimal number, rounded to twelve places;
the amount may be negative, a credit, divided by magnitude with the sign put
back on every part; the amount need not be in USD; and a basis that sums to
zero is always a refusal there, where `allocate` returns zeros for a zero
total. On an input both accept, a positive total over non-negative integer
weights that do not all equal zero, the two give the same parts. Each
operation has one rule: `allocate` is defined here, the join's division in the
join contract.

### 8.2 Loaded values are shared, never modified

A loaded card, a loaded aliases document and a parsed input are values. `price`, `price_point` and `allocate` read them and MUST NOT modify them, and an implementation MUST NOT keep state between calls: nothing a call writes may be read by a later call. So a result depends only on the arguments of its call, and a caller MAY share one loaded card, one loaded aliases document and one parsed input among any number of calls, running at the same time on any number of threads, with no lock of its own.

Anything an implementation derives from a card or an aliases document once, such as an index for finding a model, belongs to loading: it is complete before the loaded value is returned to the caller and does not change afterwards. The result of a call is a new value that shares nothing a later call can change.

Each reference engine holds itself to this: the Go engine prices the corpus from many goroutines against shared values, compares every result with the single-threaded one, and runs under the race detector in CI; the Rust crate asserts at compile time that its loaded values are `Send` and `Sync` and prices the corpus from many threads; the TypeScript engine, where calls do not overlap, checks that a card, an aliases document and an input are unchanged after many calls and that pricing never writes to a frozen one.

### 8.3 Estimates

Usage is often incomplete. A service tier was not sent, cache writes carry no lifetime, a total covers several requests. Section 8 refuses each of these, because an exact cost cannot be computed. A caller that needs a cost anyway can allow the engine to make **assumptions**. An assumption is one named rule from the fixed list below. The engine applies one only where the caller allowed it, and only at the step where it would otherwise refuse. It records every assumption it applied, and the result is then an estimate.

`allow` lists the names the caller permits. A caller that needs a number it can put on an invoice passes none, and gets an exact cost or a refusal. A caller that checks a spend limit can pass all of them.

A priced result states its `source`:

- `"calculated"`: no assumption was applied. The total is exact for the usage and the card.
- `"estimated"`: at least one assumption was applied, and `assumptions` names each.

An allowance that is never needed changes nothing: a request that prices exactly is `"calculated"` whatever `allow` holds.

| Assumption | Applies when | What the engine does | `detail` | Lower bound | Without the allowance |
|---|---|---|---|---|---|
| `card_not_effective` | `observed_at` is outside the card's own effective window. | Uses the card as if it were in effect. | `{ "observed_at", "effective_from", "effective_until" }`: the instant as supplied, and the card's window members as the card states them, each present only when the card states it. | no | `card_not_effective` |
| `model_fallback` | Model resolution found no entry for the canonical name, and a fallback rule of the aliases document leads to one (Section 7.4). | Prices the request with the entry the fallback rule led to. | `{ "rules", "provider", "model" }`, the members of `fallback` (Section 8): the structural and fallback rules that applied, and the provider and model whose prices were used; `provider` is present only when one is known. | no | `unknown_model`, which then carries `fallback` |
| `aggregate_lowest_tier` | The engine would refuse with `aggregate_usage_with_request_tier` for a `tiered_per_request` component (Section 8): its tier quantity is above its lowest boundary, or is defined with a default other than zero. | Prices all units of each such component at the lowest price the component states, among its base price and its bands. That is the base price when the bands cost more. | `{ "components": [ids] }`: the components priced this way, in card order. | yes | `aggregate_usage_with_request_tier` |
| `tokens_estimated` | `input_token_source` or `output_token_source` is `"estimated"`. | Prices the usage as given. | `{ "sides": [...] }`: `"input"`, `"output"`, or both in that order. | no | `usage_estimated` |
| `cache_write_lifetime_lower_bound` | The unspecified cache-write remainder is above zero and the entry states `"if_unspecified": "lower_bound"` (Section 4.7). | Adds the remainder to the units of the component the entry names. | `{ "component", "units" }`, the two members of `lower_bound`. | yes | `cache_write_lifetime_unknown` |
| `attribute_lower_bound` | A condition, or the `attribute_values` of the matched entry (Section 4.5), needs a request attribute that was not supplied, and the entry names a value for it in `attribute_lower_bounds` (Section 4.8). | Uses that value. | `{ "attributes": [names] }`, sorted. The values are in `assumed`. | yes | `attribute_defaulted`, where it applies; otherwise `missing_request_attribute` |
| `attribute_defaulted` | A condition, or the `attribute_values` of the matched entry (Section 4.5), needs a request attribute that was not supplied, and `assume` has an entry for it (Section 3.2). | Uses the entry. | `{ "attributes": [names] }`, sorted. The values are in `assumed`. | no | `missing_request_attribute` |
| `usage_incomplete` | A component's quantity is absent and its `if_absent` is `"refuse"`. | Skips the component and lists it under `skipped` with `"why": "absent"`. | `{ "components": [ids] }`, in card order. | yes | `quantity_missing` |

Rules:

- **One entry per name.** `assumptions` holds each applied assumption once, in the order of the table, whatever the order in `allow`.
- **`bound`.** The result carries `"bound": "lower"` when at least one assumption was applied and every applied assumption is a lower bound in the table. Each of those leaves out or underprices something that was used, so the total is the least the request can have cost. When any other assumption was applied as well, the total can be wrong in either direction and the result carries no `bound`.
- **The lowest price, not the base price.** A card can make later bands cheaper, as a volume discount does. Pricing a total at the base price would then overstate it. The lowest stated price never does: in either tier mode every unit is priced at one of the stated prices.
- **A tier priced this way** reports one band in `bands`: the band whose price was used, with all the units. Among bands of equal price it is the one with the lowest `above`; the base band has `"above": "0"`.
- **A condition on a quantity that Section 8 refuses under `"aggregate"` stays refused.** Which side of the condition each request fell on is not known, and a multiplier can raise or lower a price, so no side gives a bound. `aggregate_lowest_tier` does not apply to it.
- **Entry windows are not covered.** When the candidates of model resolution were all removed for their own effective window, the result is `card_not_effective` whether or not the assumption is allowed. Dated entries state different prices, and choosing one is choosing a price.
- **`observed_at` is still needed.** For a card that uses time, an absent or malformed `observed_at` is `missing_request_attribute` as before. `card_not_effective` records an instant, and there is none.
- **`"skip"` is not an assumption.** A component whose `if_absent` is `"skip"` and whose quantity is absent is skipped as before, and the result stays `"calculated"`: the card's author has said that an absent count means none.
- **Only the priced quantity.** `usage_incomplete` covers a component's `quantity`. A tiered component whose `tier_quantity` is absent, and a condition whose quantity is absent, are `quantity_missing` whether or not the assumption is allowed: without them the engine cannot tell which price applies.
- **A default that only `attribute_values` would read.** Without the allowance the default is not taken, and the attribute has no value to compare (Section 4.5). Nothing is refused at that step. A condition that needs the attribute refuses with `missing_request_attribute`. The same holds for a lower-bound value without the `attribute_lower_bound` allowance.
- **A lower-bound value before a default.** When the entry names a lower-bound value for an attribute and the caller allows `attribute_lower_bound`, that value is taken, whether or not `attribute_defaulted` is allowed too. `attribute_defaulted` then lists only the attributes `assume` gave a value. A result that took a lower-bound value for one attribute and a default for another is an estimate with no `bound`, because a default is not a lower bound.
- **Something has to be priced.** When `usage_incomplete` leaves no contributing component, the result is `quantity_missing`, as in Section 8.
- **A `per_call` component under `"aggregate"` with no `request_count`** is a component whose quantity is absent, and `usage_incomplete` covers it.
- **The two forms of Section 4.7.** `cache_write_lifetime_lower_bound` applies only to an entry that states `"lower_bound"`. With `"refuse"`, or when the named component's `when` is false, the result is `cache_write_lifetime_unknown` whether or not the assumption is allowed.
- **Either side.** `tokens_estimated` applies when either token source is `"estimated"`, whichever quantities the matched entry reads.

The same input, card, aliases and `allow` always give the same result. An estimate can be computed again exactly as a calculated cost can. What makes it an estimate is the assumption, and the assumption is in the result.

### 8.4 A producer's own cost

The producer of the usage may have computed a cost by its own means: a gateway from its price table, an agent from its own list. A caller passes that figure as `producer_cost`:

| Field | Required | Description |
|---|---|---|
| `amount_nano` | REQUIRED | The producer's figure in nano-dollars: a string of 1 to 64 decimal digits, with no sign, at most the total bound of Section 6. |
| `producer` | REQUIRED | A short label for who computed it, for example `"gateway"`: a string of 1 to 64 characters. |

The engine never computes with the figure. It does two things with it.

- **When the engine has its own amount** (`"priced"`), the result echoes `producer_cost` as supplied and adds `difference_nano`: `total_nano` minus the producer's amount, an integer string with a leading `-` when the producer's figure is larger. A large difference means the card is out of date, or the producer applied prices the card does not know.
- **When the engine has no amount of its own** for any reason except `invalid_input`, the result is the producer's figure. Its `status` is `"producer"`. It keeps the `reason` the engine would have given, the `card` and `model_match` blocks that refusal carries, and a member that goes with the reason (`attribute`, `fallback`). It echoes `producer_cost`. It has no `total`, `total_nano`, `components`, `source`, `assumptions`, `bound` or `difference_nano`: those describe an amount the engine computed, and here there is none.

An input that is `invalid_input` cannot be trusted, `producer_cost` included, so that result stays `"invalid"` and echoes nothing. A `producer_cost` that is not of the form above is never a figure. When a refusal earlier in the order of evaluation wins over it, as `card_invalid` does, the result keeps that reason and status and echoes nothing.

The outcomes, in the order a caller should prefer them:

1. `"priced"` with `"source": "calculated"`.
2. `"priced"` with `"source": "estimated"`.
3. `"producer"`.
4. `"unpriced"` or `"invalid"`.

The engine returns the first that applies. `allow` moves a request from the third or fourth to the second; `producer_cost` moves one from the fourth to the third. Neither changes an amount the engine computes.

### 8.5 `canonicalize`

`canonicalize(model, observed_at, aliases?) -> name`

The steps of Section 7.2 on their own, for a caller that needs the canonical name of a model and no price. It reads no card and applies no fallback, and it holds to Section 8.2 as `price` does. The input object has `model` and the OPTIONAL `observed_at` and `client_source`, read as `price` reads them.

| Field | Description |
|---|---|
| `status` | `"resolved"` or `"unresolved"`. |
| `received`, `provider`, `model`, `family`, `step`, `rules`, `aliases`, `attributes` | Present when resolved, with the meanings of the members of `model_match` (Section 8); `model` is the canonical model, and `step` is `"exact"`, `"alias"` or `"rule"`. |
| `reason` | Present when unresolved: `unknown_model` (the identifier is empty), `ambiguous_model`, `missing_request_attribute`, or `invalid_input` (a `model`, an `id`, a `provider` or a `client_source` of the wrong type). |
| `detail` | OPTIONAL free text for people. |

A name that is resolved is not thereby a model anyone prices. `canonicalize` says how the name is written; only a card says whether it has a price.

### 8.6 `price_point`

`price_point(point, model, observed_at, card, aliases?, allow?, producer_cost?) -> result`

A metric point is one count of one quantity, summed over many requests: so many uncached input tokens of one model at one service tier. `price` cannot price it. `price` takes the usage of one request, or an aggregate of whole requests, and a point is neither. `price_point` gives the cost of one point on its own. The cost of a series is the sum of the costs of its points, and no request has to be put back together first.

Input object (the shape the conformance vectors use):

| Field | Required | Description |
|---|---|---|
| `model`, `observed_at`, `client_source`, `request`, `allow`, `producer_cost` | As for `price` | Read as `price` reads them (Section 8). `observed_at` is the time of the point. `request` holds the request attributes the point's attributes give, such as `service_tier` and `batch`. The attributes the model's name sets apply to a point as to a request (Section 7.5). |
| `quantity` | REQUIRED | The name of the quantity the point counts: a string that is not empty. |
| `count` | REQUIRED | The count, read as a usage count is (Section 5). |
| `cache_write_lifetime` | OPTIONAL | A lifetime (Section 4.7), such as `"5m"`, `"30m"`, `"1h"` or `"12h"`, or `"unspecified"`: the lifetime of the cache writes the point counts. Stated only with the quantity `cache_write_input_tokens`. Absent is `"unspecified"`. |
| `context_band` | OPTIONAL | The size band of the requests the point covers, by its bounds: `{ "above": "200000", "max_input_tokens": "1000000" }`. Every request the point covers had `input_tokens` greater than `above` and at most `max_input_tokens`. Each bound is OPTIONAL and is a count (Section 5). A band with no `above` starts at zero tokens, and a band with no `max_input_tokens` has no upper end. |
| `token_source` | OPTIONAL | `"reported"` or `"estimated"`: whether the provider reported the count. Absent is `"reported"`. |

```json
{
  "model": { "provider": "exampleai", "id": "ex-long-1" },
  "observed_at": "2026-03-01T12:00:00Z",
  "quantity": "uncached_input",
  "count": 300000,
  "request": { "service_tier": "standard", "batch": false },
  "context_band": { "above": "200000", "max_input_tokens": "1000000" }
}
```

A `null` member is an absent member, as in Section 8. These are `invalid_input`: a `quantity` that is absent, empty or not a string; a `cache_write_lifetime` that is neither a lifetime nor `"unspecified"`, or that is stated with another quantity; a `context_band` that is not an object, that has a member other than the two bounds, whose bound is not a count, or whose `above` is not less than its `max_input_tokens`; a `token_source` that is neither string. An absent `count` is `quantity_missing`, and a `count` that is not a count is `usage_inconsistent`.

**The quantity.** A point names its quantity as a component does:

| A point of | `quantity` |
|---|---|
| Uncached input tokens | `uncached_input` |
| Cache-read tokens | `cache_read_input_tokens` |
| Cache-write tokens | `cache_write_input_tokens`, with the lifetime in `cache_write_lifetime` |
| Output tokens | `output_tokens` |
| Reasoning output tokens | `reasoning_output_tokens` |
| Requests the provider ran and bills each, such as web searches | The usage key of the count, such as `web_search_requests` |
| Requests | `request_count` |
| A quantity the card derives | The name the card gives it under `quantities` |

A cache-write point with a lifetime, such as `5m`, states two quantities with the one count, as a request's usage does: `cache_write_input_tokens`, and the lifetime's quantity, such as `cache_write_5m_input_tokens`. So an entry with one price for every cache write prices the point, and so does an entry with a price for each lifetime.

Two names are the **same quantity** when they are equal, or when the card or the prelude defines one as the other: by the name form, or by a `ref` whose `default` is absent or zero (Section 3.3). `billable_output` is `output_tokens`, and `prompt_size` is `input_tokens`. A quantity defined by `add` or `sub` is a quantity of its own. The engine never evaluates such a definition for a point, because a point holds one count and the definition needs several. The caller sends that quantity as its own point: the uncached input Counter for `uncached_input`, the output count less the reasoning count for a card that prices them apart.

**What a point prices.** The **point's components** are the components of the matched entry that read their units from the point: a `per_unit` or `tiered_per_request` component whose `quantity` is the same quantity as one the point states, with the point's count as its units; and, for a point of `request_count`, a `per_call` component, whose amount is `price` x the count. Each of them whose `when` is true is priced, in card order. One whose `when` is false is listed under `skipped` with `"why": "when"`. A component over another quantity is not this point's: it is not listed, `if_absent` plays no part, and the `usage_incomplete` assumption never applies.

**Conditions.** The engine evaluates, in card order, the `when` of each of the point's components and of each multiplier that applies to one of them, every member of an `all` included. It evaluates no other condition of the entry. So a point needs only what its own price depends on: a point of web searches is priced with no service tier and no band when no multiplier applies to the search fee. `exclusive_with` is checked among the multipliers evaluated.

When none of the point's components is active, or it has none, the engine refuses, with one of two reasons:

- `point_not_price_ready`: the entry prices these units inside another quantity. Input tokens with cached ones included, against an entry that prices `uncached_input`, is one case. Reasoning output against an entry that prices output whole is another: the reasoning tokens are in the output point, and pricing both would count them twice. The result names in `send` the quantity to send instead: the `quantity` of each other `per_unit` or `tiered_per_request` component of the entry, whatever its `when`, that counts, by rule 1 or rule 2 of Section 5.1, a base quantity that a quantity the point states adds once its definition is written out. The names are as the card writes them, in card order, each once.
- `point_quantity_unpriced`: no such component exists. The entry has no price for the quantity, as `unpriced_quantities` says for a request (Section 5.1).

The engine never prices a part through the component of its whole. Whether the points of the part are also counted in the points of the whole depends on the metric, and the engine cannot see that. Rule 3 of Section 5.1 needs several counts and is not applied.

**The outcome does not depend on the count.** Nothing below reads the count to choose a price, a tier or a refusal, and a count of zero is priced like any other. So the same quantity with the same attributes always has the same price for each unit, and points add (see Rounding).

**Size bands.** A tier and a condition on a quantity are properties of one request (Section 8). A point does not hold the size of any request. It can hold the band every request was in. A band is a statement about `input_tokens`, so it decides only what is chosen by that quantity: a tier whose `tier_quantity` is the same quantity as `input_tokens`, and a condition on such a quantity. For an integer `n` of the card, a boundary or the integer of a condition:

- every request was above `n` when the band states `above` and `above` is at least `n`;
- every request was at or under `n` when the band states `max_input_tokens` and it is at most `n`;
- otherwise the band holds `n`, and does not decide it.

| Case | Outcome |
|---|---|
| `whole_request` tiers, and the band decides every boundary | The whole count is priced at the price of the tier above the last boundary every request was above, or at the base price when there is none. Exact. `bands` reports that one tier. |
| `marginal` tiers, and every request was at or under the first boundary | The whole count is priced at the base price: no request had a unit above the boundary. Exact. |
| `marginal` tiers, in any other case | Not decided. The cost of a request above a boundary has a part that does not grow with its units, so the cost of the point needs the number of requests, and a point of tokens does not carry it. |
| The tier quantity is not `input_tokens`, the band holds a boundary, or the point has no band | Not decided. |
| A tier that is not decided | `aggregate_usage_with_request_tier`. With `aggregate_lowest_tier` allowed, the count is priced at the lowest price the component states, as Section 8.3 describes: an estimate and a lower bound. |
| A condition on a quantity that is not decided | `aggregate_usage_with_request_tier`, whether or not an assumption is allowed (Section 8.3). |

The rule of Section 8 that prices an aggregate at or under the lowest boundary is not applied to a point. It reads the count, and a point of few tokens can still come from one long request. A tier is looked at only for a component the point prices, and a condition only when it is one of those evaluated, so a point whose price depends on no size needs no band. A caller that holds the band list of the metric contract passes a band's `max_input_tokens` as it is listed, and as `above` the `max_input_tokens` of the band before it. A band list made from the card's boundaries gives bands that each lie in one tier.

**Per-request fees.** A `per_call` component is priced only from a point of `request_count`. A point of any other quantity leaves the fee out, and its result names every `per_call` component of the entry in `unpriced_fees`, whatever its `when`, so that the sum of token costs is never read as the whole cost. A point of `request_count` against an entry with no such component is `point_quantity_unpriced`.

**Cache writes with no lifetime.** A cache-write point whose lifetime is `"unspecified"`, or a lifetime the entry does not list in `cache_write_lifetimes`, is all unspecified remainder (Section 4.7). When the entry states `cache_write_lifetime`, the member applies as it does to a request: `refuse` is `cache_write_lifetime_unknown`; `lower_bound` adds the count to the units of the named component when the caller allows `cache_write_lifetime_lower_bound`, and is `cache_write_lifetime_unknown` otherwise or when that component's `when` is false. The named component is then one of the point's components. The point does not state the quantity of a lifetime the entry does not list, even where the card defines that quantity as a listed lifetime's, so no component prices the writes a second time. This holds whatever the count. An entry that states no such member prices the point only through a component over `cache_write_input_tokens`.

**What applies unchanged, and what cannot.**

| Rule of `price` | For a point |
|---|---|
| Card validity, the types of the members shared with `price`, model resolution, unknown entry members and component types | Unchanged, in the order of Section 8. |
| The card's and an entry's effective window, and a `time_utc` condition | Unchanged, read at `observed_at`. A point covers an interval and the engine reads one instant, so a price that changed inside the interval is applied as it stood at that instant. |
| `attribute_values`, `assume`, `unread_attributes` | Unchanged. |
| Conditions on attributes, multipliers, `exclusive_with`, adjustments | Unchanged, for the point's components and the multipliers that apply to them (Conditions). |
| A condition on a quantity | When it is evaluated: decided by the band, or refused (Size bands). The engine never reads the count for it. |
| `tiered_per_request` | Priced by the band (Size bands). |
| `per_call` | Priced from a point of `request_count` only (Per-request fees). |
| `checks`, derived quantities, `defaulted_quantities` | Not evaluated: each needs several counts. A subtraction below zero and a failed check are found by `price` and never by `price_point`. |
| `if_absent`, `usage_incomplete`, `unpriced_quantities` | Do not apply. A quantity the point does not state is another point's. |
| `card_not_effective`, `model_fallback`, `attribute_lower_bound`, `attribute_defaulted`, `cache_write_lifetime_lower_bound`, `aggregate_lowest_tier` | As in Section 8.3, with the `detail` given there. |
| `tokens_estimated` | Applies when `token_source` is `"estimated"`: the cost is an estimate when the caller allows it, and `usage_estimated` otherwise. Its `detail` is `{ "quantity" }`, the point's `quantity` as supplied. |
| `producer_cost` | As in Section 8.4. |
| Section 8.2 | Holds for `price_point` as for `price`. |

Order of evaluation, first failure wins: the steps of Section 8 up to and including the values the matched entry prices for an attribute, with the types of `quantity`, `cache_write_lifetime`, `context_band` and `token_source` checked where the types of the other members are; the count; an estimated `token_source`; a cache-write point with no lifetime that the entry refuses; the conditions the point's price depends on, in card order, with the band rule for a condition on a quantity; exclusivity among the multipliers evaluated; a lower-bound component whose `when` is false; whether one of the point's components is active; those components in card order, with the band rule for a tiered one; arithmetic; overflow.

**Rounding.** Each component a point prices is rounded half up to a whole nano-dollar, as Section 6 rounds a component, and the total is the sum of the rounded components. Before rounding, a component's amount is the count times a number that does not depend on the count. So exact amounts add: the exact amount of a point of `a + b` is the exact amount of a point of `a` plus that of a point of `b`, for the same quantity, attributes, band and time. A rounded amount is within half a nano-dollar of the exact one. So, for each component:

- the cost of a point of `a + b`, and the costs of a point of `a` and a point of `b` added, differ by at most one nano-dollar;
- the costs of `n` points added, and the cost of one point of their sum, differ by less than `(n + 1) / 2` nano-dollars;
- the cost of a point that covers `n` requests, and the costs `price` gives those requests one by one, added, differ by less than `(n + 1) / 2` nano-dollars. `price` rounds once for each request and `price_point` once for the point, so the point is the closer of the two to the exact amount.

**The points of one request.** Take one request and give each quantity its entry prices as a point with the request's attributes, the band the request is in, and a `request_count` of 1 where the entry has a per-request fee. Where `price` gives the request a calculated cost and each point is priced with no assumption, every component reads from its point the units `price` reads from the usage, at the same price. So each component's amount is the same, and the totals of the points add up to the `total_nano` of `price` exactly. A component that is priced from two points of the request, as a single cache-write price is from a `5m` point and a `1h` point, is rounded twice, and the first bound above applies to it. Where `price_point` cannot decide what `price` can, such as `marginal` tiers above the first boundary, it refuses or estimates. It never returns a different calculated amount.

Result. The members are those of `price` (Section 8), for the components the point prices:

| Field | For a point |
|---|---|
| `status`, `reason`, `detail`, `currency`, `source`, `assumptions`, `bound`, `card`, `model_match`, `fallback`, `attribute`, `producer_cost`, `difference_nano` | As for `price`. |
| `total`, `total_nano` | Present when priced: the sum of the components the point prices. |
| `components` | Present when priced: the components priced from the point, in card order, with the members Section 8 gives. A `per_call` component has `"quantity": "request_count"` and the count as `units`. |
| `skipped` | Present when priced, possibly empty: the point's components whose `when` is false. |
| `assumed`, `unread_attributes`, `lower_bound` | As for `price`. |
| `unpriced_fees` | Present when priced, possibly empty: the ids of the `per_call` components of the entry, in card order, for a point of any quantity but `request_count`. Empty for a point of `request_count`. |
| `send` | Present only with `point_not_price_ready`: the quantities to send instead. It goes with the reason, so a `"producer"` result keeps it. |
| `defaulted_quantities`, `unpriced_quantities` | Never present. |

**What a point cannot price.** These stay refusals, or estimates where an assumption is named for them: `marginal` tiers above the first boundary; a tier or a condition chosen by a quantity other than `input_tokens`; a tier or a condition whose integer the band holds; a per-request fee, from a point that does not count requests; a quantity the entry prices only inside another; cache writes with no lifetime where the entry says to refuse; and a price that changed inside the interval the point covers, which the engine cannot see at all.

### 8.7 Choosing among cards

`select_card(cards, model, observed_at, aliases?) -> selection`

A caller often holds more than one card: a customer's own prices and a public list, or several versions of one card. `price` takes one card. `select_card` says which: from a list in the caller's order of preference, it chooses the first card that is in effect at `observed_at` and has an entry for the canonical model. The input object has `model` and the OPTIONAL `observed_at` and `client_source`, read as `price` reads them. It reads no other member of a `price` input: no usage, no `request`, no `allow` and no `producer_cost`, so the input of a `price` call can be passed as it is. It holds to Section 8.2 as `price` does.

**Versions of one card.** Cards in the list that have the same `card.id` are versions of one card. A published card file is never rewritten: a cost records the digest of the card that priced it (`card.sha256`), and the digest must go on naming those bytes. Writing an end date into a version when the next one is published would change its digest though no price changed. So a version does not have to state when it ended. Among the cards in the list, a version is **superseded** at `observed_at` when another version of the same card states an `effective_from` that is later than its own and is not later than `observed_at`. A version that states no `effective_from` is earlier than every version that states one. Versions with the same `effective_from`, and versions that both state none, do not supersede each other, unless one corrects the other (below); the caller's order decides between them. An invalid card has no `id` to read and supersedes nothing. A version's own `effective_until`, where it states one, still ends it: that is how a card is withdrawn with no successor.

**Corrections.** A version whose prices were wrong for its whole window is corrected by another version of the same card that names it in `corrects`. Neither file is rewritten, so each digest still names its bytes, and a cost recorded with the corrected version still names the prices it used. Among the cards in the list, a version that another valid version of the same card corrects is superseded at every `observed_at` and supersedes no version: selection treats it as absent from the list. A correction usually states the `effective_from` of the version it corrects, so it covers the same time, and a later version supersedes it as it would any version. A correction can itself be corrected. A version that two versions correct is superseded by both, and the two are versions like any others.

Supersession is by card, not by entry. A model that a later version no longer lists is not priced by the version before it.

**In effect.** A card is in effect at `observed_at` when `observed_at` is inside the card's own effective window (Section 3.1) and the card is not superseded. For this operation a card uses time when Section 8 says it does, or when another version of it in the list states `effective_from`.

**Steps.** Each card is tried in order, and the first that passes every step is chosen. A card that fails a step is passed over with that step's reason, and the next card is tried.

1. The card is valid. Otherwise `card_invalid`.
2. `model` and `client_source` have the types Section 8 gives them. Otherwise `invalid_input`.
3. When the card uses time: `observed_at` is present and well formed, otherwise `missing_request_attribute`. No other version in the list corrects the card, and when the card uses time, it is in effect; otherwise `card_not_effective`.
4. The canonical name (Section 7.2) has an entry in the card (Section 7.3). The refusals are those of the two sections: `unknown_model`, `ambiguous_model`, `missing_request_attribute` for an alias with a window and no usable `observed_at`, and `card_not_effective` when the entries that match are all outside their own windows.

These are the steps of `price` up to model resolution (Section 8), in the same order, for the members selection reads, with supersession added to the third. So `price`, given the chosen card and the same `model`, `observed_at` and aliases, finds the same entry and returns the same `model_match`, whatever its `allow` lists: an entry was found, so no fallback applies, and the card is in effect, so `card_not_effective` is not assumed. `price` can still refuse for a reason selection does not look at: the type of another input member, an attribute the name sets that the request states otherwise (Section 7.5), a request attribute value the entry does not price (Section 4.5), a usage count. Selection does not then go on to the next card, because the card that prices the model has been found.

**Selection makes no assumption.** It applies no fallback rule (Section 7.4): a card has an entry for the canonical model or it is passed over. It never uses a card outside its window as if it were in effect, whatever the caller would allow `price` to assume (Section 8.3). A later card that is in effect is a better answer than an earlier one that is not. When no card is chosen and the caller wants an estimate, the caller picks the card, and says so by calling `price` with that card and `card_not_effective` or `model_fallback` in `allow`. The result is then `estimated` and its `assumptions` record what was assumed (Section 8.3). `passed_over` gives the caller what it needs to pick. A version that was superseded has no end date of its own, so `price` with it alone would return a calculated cost at the old prices: a caller that holds several versions chooses through `select_card`, and does not price with a card whose item says `superseded_by`.

| Field | Description |
|---|---|
| `status` | `"selected"` or `"none"`. |
| `index` | Present when selected: the zero-based position of the chosen card in `cards`. |
| `card` | Present when selected: the `card` block of a `price` result (Section 8). |
| `model_match` | Present when selected, as `price` returns it (Section 8). |
| `passed_over` | Always present, possibly empty, in list order: one item for each card before the chosen one, or for every card when none is chosen. An item is `{ "index", "card", "reason", "superseded_by" }`. `card` is the card block, absent for `card_invalid`. `reason` is one of the reasons of the steps above. `superseded_by` is present only when the card was superseded: the `{id}@{version}` of the version of it that is in force at `observed_at`, which is the one with the latest `effective_from` not later than `observed_at` among the versions that no other version corrects, and the first of those in the list when several state the same instant. For a corrected version with no version in force, or that uses no time, it is the version that corrects it, followed through any correction of that one to a version that nothing corrects; when the corrections form a cycle, it is the version that corrects it. An item MAY carry a free-text `detail`. |

An empty list chooses nothing: `{ "status": "none", "passed_over": [] }`.

## 9. Model aliases

An OPTIONAL separate document, `opentrajectory.model_aliases/1` (schema). It holds everything that turns a name as received into a canonical name (Section 7):

```json
{
  "schema": "opentrajectory.model_aliases/1",
  "id": "example-names",
  "version": "4",
  "providers": [
    { "canonical": "cloudco.models", "names": ["cloudco", "cloudco_converse"] }
  ],
  "aliases": [
    { "canonical": "ex-large-1", "canonical_provider": "exampleai", "provider": "gatewayco", "ids": ["prod-chat"] },
    { "canonical": "ex-large-1", "ids": ["ex-large-latest"], "effective_until": "2026-06-01T00:00:00Z" },
    { "canonical": "ex-large-2", "ids": ["ex-large-latest"], "effective_from": "2026-06-01T00:00:00Z" },
    { "canonical": "ex-large-2", "client_sources": ["example-editor"], "ids": ["ex-large-2-fast"], "attributes": { "service_tier": "fast" } }
  ],
  "rules": [
    { "id": "gateway-prefix", "op": "strip_prefix", "forms": ["exampleai/"], "set_provider": "exampleai" },
    { "id": "cloud-version", "op": "strip_suffix", "forms": ["-v{n}:{n}"], "set_provider": "cloudco.models" },
    { "id": "cloud-vendor", "op": "strip_prefix", "provider": "cloudco.models", "forms": ["{seg}."] },
    { "id": "effort", "op": "strip_suffix", "forms": ["-low", "-medium", "-high"], "except_providers": ["examplevendor"], "except_names": ["ev-*"] }
  ],
  "fallbacks": [
    { "id": "dated-version", "op": "strip_suffix", "forms": ["-{d}{d}{d}{d}{d}{d}{d}{d}"] }
  ],
  "families": [
    { "family": "ex-large", "models": ["ex-large-1", "ex-large-2"] }
  ]
}
```

Only `schema` and `aliases` are REQUIRED. A member this section does not define makes the document invalid.

The document is kept out of the card because it belongs to whoever knows the names: an operator knows its route names, and a platform's identifier forms are the same for every card.

**Identity.** `id` and `version` are stated together or not at all, and each follows the [identifier grammar](#card-identifier-grammar) of a card's. A change to any member is a new `version`. A result records `{id}@{version}`, so a cost names the document that resolved its model, as it names its card.

**`providers`.** Spellings of one provider's name. A spelling listed under two different canonical providers makes the document invalid.

**`aliases`.** Reviewed entries: each maps the identifiers in `ids` to `canonical`. `provider`, when present, limits the entry to requests whose provider equals it. `canonical_provider`, when present, replaces the provider; when absent the provider is kept. `effective_from` and `effective_until` are OPTIONAL instants, written and compared as a card's are: the entry applies from `effective_from` on and before `effective_until`, and `effective_from` MUST be before `effective_until`. `client_sources`, when present, is a list of at least one non-empty string and limits the entry to inputs whose `client_source` is one of them; such an entry takes precedence over the entries that state none (Section 7.2). `attributes`, when present, is an object of at least one member: each name follows the name grammar of a card (`^[A-Za-z_][A-Za-z0-9_.-]*$`) and each value is a string or a boolean. They are the request attributes the name stands for (Section 7.5). Entries that agree on the canonical identifier, the provider and the attributes are not ambiguous.

**`rules` and `fallbacks`.** Both are lists of rewriting rules; they differ in what a rule may do. A rule in `rules` removes wrapping around a name and leaves the model the same (Section 7.2). A rule in `fallbacks` leaves a related model (Section 7.4). A rule has:

| Member | Required | Meaning |
|---|---|---|
| `id` | REQUIRED | Unique across `rules` and `fallbacks`. A result names a rule by it. |
| `op` | REQUIRED | `"strip_prefix"` or `"strip_suffix"`. The list is closed; any other value makes the document invalid. |
| `forms` | REQUIRED | One or more forms. The first that matches is used. |
| `provider` | OPTIONAL | The rule applies only while the provider equals this value. |
| `set_provider` | OPTIONAL | Replaces the provider when the rule applies. |
| `except_providers` | OPTIONAL | One or more providers. The rule does not apply while the provider is one of them. |
| `except_names` | OPTIONAL | One or more patterns, written as a card's `match.patterns` are: `*` matches any run of characters, every other character matches itself, and the pattern covers the whole identifier. The rule does not apply while the identifier matches one of them. |

`provider`, `except_providers` and `except_names` are read against the provider and identifier the earlier rules left. A rule for names of one shape that some other maker's names also have states its exceptions. An effort suffix such as `-high` names how much reasoning a request asked for, and the price is the base model's, for some makers; another maker's names can end the same way and be models of their own. The rule for the suffix names that maker in `except_providers`, for a request that states the provider, and the maker's names in `except_names`, for one that does not.

Rules are data. An engine holds no gateway prefix, platform identifier form or date pattern in code: a new form is a new rule in a document, never a new engine release.

**Forms.** A form is a non-empty string of literal characters and three tokens:

| Token | Matches |
|---|---|
| `{d}` | One ASCII digit. |
| `{n}` | One or more ASCII digits: every digit at that place. |
| `{seg}` | One or more characters, none of them `/`, `:` or `.`: every such character at that place. |

Any other `{` or `}` in a form makes the document invalid. `strip_prefix` matches a form at the start of the identifier, reading left to right. `strip_suffix` matches it at the end, reading right to left. Matching is by Unicode code point. A token takes all it can and gives nothing back, so a form matches in at most one way, and the answer never depends on the engine. For the same reason two shapes could never match, and they make the document invalid: `{n}` followed, in reading order, by `{d}`, `{n}` or a literal digit; and `{seg}` followed, in reading order, by anything other than a literal `/`, `:` or `.`.

The two operations and three tokens cover the forms in use:

| Name as received | Rules | Canonical model |
|---|---|---|
| `exampleai/ex-large-1`, from a gateway | `strip_prefix` `exampleai/`, with `set_provider` | `ex-large-1` |
| `us.examplevendor.ex-large-1-v1:0`, a platform identifier with a region | `strip_prefix` `us.`; `strip_prefix` `{seg}.`; `strip_suffix` `-v{n}:{n}` | `ex-large-1` |
| `arn:cloudco:models:us-east-1:123456789012:inference-profile/…`, a resource name | `strip_prefix` `arn:cloudco:models:{seg}:{n}:inference-profile/`, then the rules above | `ex-large-1` |
| `publishers/examplevendor/models/ex-large-1@20260101` | `strip_prefix` `publishers/{seg}/models/`; `strip_suffix` `@{n}` | `ex-large-1` |
| `ft:ex-large-1:acme::abc123`, a tuned model | `strip_suffix` `:{seg}::{seg}` | `ft:ex-large-1` |
| `ex-large-1-20270101`, a dated version no card lists | as a fallback: `strip_suffix` `-{d}{d}{d}{d}{d}{d}{d}{d}` | priced as `ex-large-1` |
| `cloudco/examplevendor.ex-large-1-v1:0`, with no provider | `strip_prefix` `cloudco/` and `strip_suffix` `-v{n}:{n}`, each with `set_provider`; then `strip_prefix` `{seg}.` limited to that provider | `ex-large-1`, provider `cloudco.models` |
| `ex-large-1@20260101`, a platform's version suffix | `strip_suffix` `@{d}{d}{d}{d}{d}{d}{d}{d}` with `set_provider` | `ex-large-1`, provider `skyco.models` |
| `ex-large-1-high`, an effort suffix | `strip_suffix` `-high`, with `except_providers` and `except_names` for the makers whose names end so | `ex-large-1` |

A rule that is not limited to a provider applies to every name, so a form such as `{seg}.` belongs in a rule limited to the provider whose identifiers have that shape. Step 3 of Section 7.2 protects the names the document itself lists as canonical.

**`families`.** Each entry names a `family` and the canonical `models` in it. A model listed in two families makes the document invalid.

An aliases document that breaks its schema is rejected by the caller before pricing: it is not a pricing result, because the engine cannot tell which models its author meant to map. A document that breaks any other rule of this section is rejected the same way.

An aliases document nests at most 128 JSON containers, the bound of a rate card (Section 3.5), counted the same way: the document object is the first. Its own shape nests four, so a deeper document already breaks its schema, and it is rejected like any other. The bound says how: a reader MUST refuse a document past it without descending into it, so that what a hostile or damaged file costs to refuse does not depend on the engine that reads it.

## 10. Mapping to the wire

| Result | Wire |
|---|---|
| `status: "priced"`, `source: "calculated"` | `cost_usd` = `total` as a number, `cost_source: "calculated"`, `cost_rate_card` = `card.rate_card`. |
| `status: "priced"`, `source: "estimated"` | `cost_usd` = `total` as a number, `cost_source: "estimated"`, `cost_rate_card` = `card.rate_card`. |
| `total_nano` above 9007199254740991 | The event fields are written as for any priced result. A producer that records the portable cost metrics states the amount as it is: the metric contract finds it above its bound and records no cost point, with `cost_unusable` (Section 6). A producer MUST NOT lower it to fit. |
| `bound: "lower"` | The cost is a lower bound. The core event has no field for that. A producer that records the portable cost Counter states `cost_bound: "lower"` beside `cost_source: "estimated"` and the rate card, and the Counter carries `trajectory.cost.bound`: the metric contract accepts a bound on an estimate that names its card, and a lower bound here is always one. |
| `status: "producer"` | `cost_usd` = `producer_cost.amount_nano` as dollars, `cost_source: "estimated"`, no `cost_rate_card`: the engine's card did not produce the figure. |
| any other status | No `cost_usd`. A producer MUST NOT write `0`. |

A producer that records the portable cost metrics states the canonical name with the cost: `model_match.canonical`, `provider` and `family` as the observation's `canonical_model`, `canonical_provider` and `model_family`, and `model_match.priced_as.model` as `cost_priced_as_model`. The cost points carry them beside the names as received, which no point rewrites.

A producer that holds a `reported` amount writes that and does not replace it with a calculated one. One call has one cost, with one source: the first available of `reported`, `calculated`, `estimated` (call cost provenance). When the usage given to the engine was estimated rather than reported, the caller says so with a token source (Section 8). The result is then an estimate or a refusal, never `calculated`: the producer writes `cost_source: "estimated"` and keeps `cost_rate_card`, so a consumer can price the call again when reported usage arrives.

## 11. Conformance

The corpus in `conformance/pricing/` holds synthetic cards, alias documents, and vectors, including the vectors for model names (`model-names.json`: `canonicalize`, `price` through an aliases document with rules, client sources, attributes and the default provider, and aliases documents an engine must reject), the vectors for `price_point` (`points.json`), the vectors for choosing among cards (`card-selection.json`) and the vectors for the price evidence documents of Section 12 (`price-evidence.json`), which a reader of those documents runs and an engine does not. An implementation conforms when, for every vector, its result equals the expected result on every field the vector states, compared as described in the corpus README. The reference engines are `reference/go/pricing`, `reference/ts/pricing` and `reference/rust/trajectory-pricing`; `scripts/test-pricing-parity.py` runs the three over the corpus through their vector drivers and the conformance verifier, and requires identical output.

The conformance verifier also reads a rate card or an aliases document on its own (`trajectory-conformance verify card.json`) and reports each rule of this document that the card breaks, so a card's publisher can check it before any engine loads it.

Implementations MUST NOT use binary floating point anywhere between a card's price strings and the result's amount strings.

## 12. Price evidence

A card built from several public sources states where each price came from in its provenance (Section 3.6), and the tool that builds it keeps a fuller record (the reconciliation record). Three documents feed them besides the candidate cards. No engine reads them.

- **Observations** (`opentrajectory.price_observations/1`, schema): single prices read from a source that has no converter, such as a provider's own price page. Each is a source of its own in the reconciliation. A card names an observation of a page on the provider's own site as a `provider_page` source.
- **Decisions** (`opentrajectory.price_decisions/1`, schema): prices settled from the provider's own page, or kept for a retired or deprecated model, each with its evidence. A decision wins over every source. A card records it as a component's `decision`.
- **Announcements** (`opentrajectory.price_announcements/1`, schema): the provider's statements of when a price change takes effect, and decisions that the provider announced a model's launch nowhere. A card records an announcement as `effective_from_evidence`.

An observations or decisions document is an object with `schema` and a list, `observations` or `decisions`, possibly empty. An item names a price by `provider`, `model`, `component` (`input`, `cache_read`, `cache_write`, `cache_write_1h`, `cache_write_12h`, `output`, `reasoning`, `web_search` or `request`), and OPTIONAL `above` (a long-request threshold in prompt tokens), `batch` and `service_tier` (a request set other than the plain one), and gives it as `price` in USD per `per` units: per 1000000 tokens for a token price and per 1 for a fee unless `per` says otherwise. An observation states its `source`, and OPTIONAL `source_url`, `observed` (the day, `YYYY-MM-DD`) and `effective` (below). A decision states `evidence_url`, `date` and `decided_by`, and OPTIONAL `note`, `deprecated` and `overrides` (below). A member the schema does not define makes the document invalid.

`cache_write` is the price of a cache write of the shortest lifetime the model prices, such as five minutes or 30 minutes, or of every cache write when one price covers them all. `cache_write_1h` and `cache_write_12h` are the prices of a one-hour and a 12-hour write. A reader refuses a document that names a component it does not know, so a later version of this document can add a component and keep the schema identifiers at `/1`.

**Quoted evidence.** An observation and a decision MAY state:

| Member | Description |
|---|---|
| `quote` | The exact text read on the page that states the price, such as a table row. 1 to 500 characters (Unicode code points), on one line: a control character, a line break or a tab included, makes the document invalid. A quote is the words that state the price, not the page. |
| `retrieved_at` | When the page was read: an RFC 3339 UTC instant written as a card writes `effective_from` (Section 3.1). A malformed instant, an instant on a day that does not exist and an offset other than `Z` or `+00:00` make the document invalid. |

Both are OPTIONAL.

**Later prices.** A page can state a later price beside the one in effect, such as "$2.00 through November 30, 2026. $4.00 starting December 1, 2026." An observation of the later price MAY state `effective`, the day it starts, `YYYY-MM-DD`; a day that does not exist makes the document invalid. The observation states the price from that day only: a reconciliation as of an earlier instant, or of none, does not read it. From that day it is the page's reading of the price, in place of a reading that starts earlier, as a later reading of the page is. A reading with no `effective` starts on the day it was read. `effective` is OPTIONAL. The reconciliation record carries it on the statement.

**Deprecated models.** A decision MAY state `deprecated`, a boolean. `true` says that the model is deprecated or retired and that its provider no longer states the price, so the decision keeps a price that the provider's own page can no longer confirm, usually the one the card already has. Its `evidence_url` is the page that shows the model is deprecated or retired, and its `quote`, when stated, is the text there that says so, such as a deprecation notice, not a price. A tool that compares decisions with what sources state later SHOULD NOT report a deprecated decision as one the sources contradict: no source can show that a price the provider no longer states has moved. A card records such a decision with the rule `R3` (Section 3.6). `deprecated` is OPTIONAL.

**Values a decision overrides.** A decision MAY state `overrides`, a list of one or more objects, each with a `source`, named as the reconciliation names it, and a `price` in USD per the decision's `per` units. Each is a value that source stated for the price when it was decided, other than the decision's own. A list can go on stating another value, for example the price of a similar product, while the provider's own page goes on stating the decided one. A tool that compares a decision, or the reading of the provider's page that settles the decided price, with what sources state later SHOULD NOT report it as one the sources contradict when every source that states another value still states one the decision overrides: those values were weighed when it was decided, so they cannot show that the provider's price moved since. A source that states a value the decision does not override can. An empty list, an override that lacks `source` or `price`, and an override that states any other member make the document invalid. The reconciliation record carries the overrides with the decision, in the record's unit. `overrides` is OPTIONAL.

An item names its model as a source spells it, and the reconciliation canonicalizes it with the aliases document, with no `client_source`. When the alias that applies sets request attributes (Section 7.5), the item gives a price of the request set they select: `service_tier` and `batch` take the place of the plain set's. An item whose own `batch` or non-standard `service_tier` differs from what the name sets, a fee for a name that selects a set other than the plain one, and a name whose alias sets any other attribute are refused. A reader refuses an invalid document as a whole. The reconciliation record carries both: an observation's `quote` and `retrieved_at` on its statement of the price, and a decision's on the decision. A person reviewing a disputed price, or a price that changed, reads the words the source showed and when, without opening the page again.

**Announcements.** An announcements document is an object with `schema`, `announcements`, a list, possibly empty, and OPTIONAL `unannounced` (below). An announcement says when a change to some models' prices takes effect:

| Member | Required | Description |
|---|---|---|
| `provider` | REQUIRED | The provider whose prices change. |
| `models` | REQUIRED | The models whose prices change, at least one, each named as a source spells it. The reader canonicalizes each with the aliases document, as for an observation. |
| `effective` | REQUIRED | When the prices take effect: a day, `YYYY-MM-DD`, which means 00:00 UTC on that day, or an RFC 3339 UTC instant when the announcement gives a time. |
| `url` | REQUIRED | The absolute `https` URL of the announcement, on the provider's own site. |
| `quote` | REQUIRED | The exact text of the announcement that says when, under the rules for a `quote` above. |
| `retrieved_at` | REQUIRED | When the announcement was read, as above. |

A member the schema does not define makes the document invalid, and so do two announcements that name one model, for one provider, with the same `effective`. A tool that writes a later version of a card because a price of one of these models changed begins it at `effective`, when that is later than the start of the version in effect, and the card states the announcement as a source and as `effective_from_evidence` (Section 3.6). An announcement states no price. So when several announcements of the model are later than that start, nothing tells which one a price read now comes from, and the tool writes no such version: a person writes a version for each, from the next announcement after the version before it.

**Launches no announcement dates.** An announcements document MAY also state `unannounced`, a list, possibly empty, of decisions that a provider announced the launch of some models nowhere:

| Member | Required | Description |
|---|---|---|
| `provider` | REQUIRED | The provider of the models. |
| `models` | REQUIRED | The models, at least one, each named as a source spells it. The reader canonicalizes each with the aliases document, as for an announcement. |
| `searched` | REQUIRED | The pages of the provider's own site that would announce a launch, such as its changelog, at least one, each an absolute `https` URL. |
| `retrieved_at` | REQUIRED | When those pages were read, as above. |
| `note` | REQUIRED | One line for people, 1 to 1000 characters with no control character: that no announcement exists, and when the provider's pages first listed the models, such as between two Internet Archive captures. |
| `decided_by` | REQUIRED | Who made the decision, 1 to 200 characters on one line. |

A member the schema does not define makes the document invalid, and so do two decisions that name one model for one provider. A tool that adds one of these models to a card starts it on the card's first version, which applies from the start. A start the tool chose after the prices were read would leave the model's earlier usage unpriced. An announcement of the model, such as one of a later price change, still dates a later version.
