# How Trajectory settles the prices on its rate cards

Trajectory's default rate cards restate the list prices that model providers
publish. Each time Trajectory reads its sources, it applies the rules below to
every price of every card it keeps current. It does so on a best-effort basis,
and it makes no promise that a card matches what a provider charges.

## What the cards state

- List prices only: the standard tier, in US dollars. A card does not state
  what a customer pays. A negotiated discount, a contract price and a
  reseller's markup are not on the cards, and neither are free tiers and
  quotas, such as Gemini's free grounded prompts.
- Prices per request only. Context cache storage, which a provider bills per
  token-hour for as long as an explicit cache exists, is not on the cards: it
  is not charged per request, and no client reports it.
- The provider's own pricing page is the only authority for a price.
- models.dev, LiteLLM and genai-prices are public price lists that Trajectory
  derives prices from and compares against. That is derivation only: reading
  a list states no endorsement of it, either way.
- A price is backed by the sources that state exactly that value for that
  model. Backed by a source means only that the source states the same value.
- A retired or deprecated model shows the last price its card published. It
  is kept so that past usage stays priced, and it is not a current offer.

## The rules

The rules are tried on a price in this order, and the first that applies
settles it: R3, R1, R2 and then R4. Rule R5 says when a new card version
starts, and rule R6 which version a model joins.

### R1: The provider's page decides

When the sources disagree, when only one source states a price, or when the
price would move by more than half, the value on the provider's own pricing
page decides it, and the card quotes the page. A price moves by more than half
when its new value is more than 1.5 times the old value or less than 0.5 times
it, or when the old value was zero and the new one is not.

### R2: Agreement

Otherwise a price changes only when at least two sources state the same value.
The provider's page counts as a source.

### R3: Retired or deprecated models

When the provider has retired or deprecated a model, the card keeps the last
price it had. The provider's deprecation notice is the evidence, and the card
quotes it.

### R4: No rule applies

A price that no rule settles stays as the card has it.

### R5: When a price takes effect

A new card version starts at the moment the provider announced for the price
change, in UTC, or at 00:00 UTC on the announced day when the announcement
gives no time; without an announcement it starts at 00:00 UTC on the day after
the sources were read.

### R6: A model with no launch announcement

A model joins its card on the version that starts at its launch, the moment
the provider announced it (R5). When the provider announced the model's launch
nowhere, the model joins the card's first version, `initial`, which applies
from the start, and a decision records that no announcement exists. The day
after the sources were read starts a price change, never a model.

## What a card records

A card version records what backs each of its prices. Its prices never
change once it takes effect; before then, a later sync may restate it. Its
provenance may change: the version is rewritten in place, with the same
prices, when a page of the provider's own site comes to back one of them or
a rule comes to decide one. The format
specification, `SPEC-PRICING.md`, defines these members in its Section 3.6.

| Member | Where | What it says |
| --- | --- | --- |
| `sources` | `card` | The sources that back something on the card, by id: `provider` for the provider's pricing page, `provider-` and a name for another page on the provider's own site, `models-dev`, `litellm` and `genai-prices` for the price lists, and `announcement-` and a day for an announcement. Each states its `kind` (`provider_page`, `price_list` or `announcement`), `name`, `url` and `retrieved_at`. A price list also states the `sha256` of the file that was read. |
| `backed_by` | each price | The ids of the sources that state exactly that value for that model. An empty list means that no source states it. |
| `decision` | a price that R1 or R3 settled | The `rule`, `why` it applied, the `source` it decided by, the `reason`, the `evidence` quoted from that source, and the day it was read, `decided_on`. |
| `effective_from_evidence` | `card` | For a version that starts at a moment the provider announced (R5): the announcement's `source` id and the `quote` that gives the moment. |

A source states exactly a price when it states it for the same model, the
same request set and the same prompt size, and the two values are equal once
both are written per one token, search or request. A page on the provider's
own site counts as a source.

A decision's `why` is one of these. When more than one applies to a price, the
first in the table is the one recorded.

| `rule` | `why` | When it applies |
| --- | --- | --- |
| R1 | `large_change` | The price would move by more than half, either way, from the version before. |
| R1 | `disputed` | The sources state different values. |
| R1 | `single_source` | Only one source states the price. |
| R3 | `deprecated` | The provider has retired or deprecated the model. |

A decision's `reason` is always the sentence for its `rule` and `why`, with
`{provider}` replaced by the provider's name, such as Google:

| `rule` | `why` | `reason` |
| --- | --- | --- |
| R1 | `large_change` | The price moved by more than half, so {provider}'s own pricing page decides it (rule R1). |
| R1 | `disputed` | The sources disagree on this price, so {provider}'s own pricing page decides it (rule R1). |
| R1 | `single_source` | Only one source states this price, so {provider}'s own pricing page decides it (rule R1). |
| R3 | `deprecated` | {provider} has retired or deprecated this model, so the card keeps the last price it had (rule R3). |

A price that two or more sources state alike (R2) has no decision,
and neither has a price that no rule settled (R4).
