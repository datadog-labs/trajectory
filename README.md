# Trajectory's default rate cards

This branch holds the default rate cards of Trajectory. Trajectory uses them
to estimate what a model request cost from its token usage.

These are list prices: the standard tier, in US dollars, as each model
provider publishes them on the page its `source_url` names. They are not what
a particular customer pays. A negotiated discount, a contract price, a
reseller's markup, and free tiers and quotas, such as Gemini's free grounded
prompts, are not on these cards. Neither is context cache storage, which a
provider bills per token-hour for as long as an explicit cache exists: it is
not charged per request, and no client reports it. Trajectory keeps the cards
current on a best-effort basis, with no promise that a card matches what a
provider charges.

## Files

| Path | What it holds |
| --- | --- |
| `cards/<id>.<version>.card.json` | One version of one rate card, in the `opentrajectory.rate_card/1` format. |
| `aliases.json` | The model aliases document, in the `opentrajectory.model_aliases/1` format. It maps the model names clients send to the models on the cards. |
| `DECISION-RULES.md` | The rules that settle which value a card states for each price, and what a card records about it. |
| `manifest.json` | The SHA-256 of every other file, the source commit the files were copied from, and the version of the format specification. |
| `SPEC-PRICING.md` | The rate card format specification the files follow. |
| `README.md` | This file. |

## Where each price comes from

The provider's own pricing page is the only authority for a price. Trajectory
also reads three public price lists, models.dev, LiteLLM and genai-prices. It
derives prices from them and compares them with each other and with the
provider's page. That is derivation only: reading a list states no
endorsement of it, either way.

Each card states where its prices come from:

- `card.sources` lists, by id, the sources that back something on the card:
  pages on the provider's own site (`provider_page`), the price lists
  (`price_list`, with the SHA-256 of the file that was read) and the
  provider's announcements of when a price takes effect (`announcement`).
  Each source states its URL and when it was read.
- `backed_by`, on each price, lists the ids of the sources that state exactly
  that value for that model. A price is backed by a source when the source
  states the same value, and that is all it says. An empty list means that no
  source states the price.
- `decision`, on a price that a rule other than agreement settled, names the
  rule, why it applied, the source it decided by, a one-sentence reason and
  the exact text quoted from that source. [`DECISION-RULES.md`](DECISION-RULES.md)
  states every rule.
- `effective_from_evidence`, on a card, quotes the provider's announcement
  that the version's `effective_from` comes from.

A card records what backs each price as its sources were last read. When a
page of the provider's own site comes to back a price, or a rule comes to
decide one, the version's file is rewritten with the same prices and its new
provenance.

A retired or deprecated model keeps the last price its card published, so
that past usage stays priced. That price is not a current offer.

## Published prices never change

There is one card for each provider. Each version of a card lists every model
of that provider in effect from its `effective_from`, retired models
included. A card's first version applies from the start and is named
`initial`.

The prices of a published version never change once it takes effect, and a
published file is never removed. Only what a version records about its prices
may change: `card.sources`, `backed_by`, `decision` and
`effective_from_evidence`. A version that has not taken effect yet, such as
one announced for a later day, has charged nobody. Until it begins, a later
sync may restate it: a price change dated before it is a version before it,
and the later version takes that change where it stated the old price. A price
change is a new version of the card: a new file with the same `id`, a later
`effective_from`, and a `version` named after the day the provider's change
took effect, such as `2026-10-07`. A version whose prices were wrong from its
start is replaced by a correction. The correction is a new file that names the
wrong version in `corrects`.

## Which card applies

A card applies to a request observed at or after its `effective_from`
and before its `effective_until`. A card with no start or no end has no
limit on that side. A later version of a card takes over from its own
`effective_from`, so the version before it needs no end. A correction
applies in place of the version it corrects, and the corrected version
applies to nothing.

## Format

The files follow version 0.1.0 of the
[rate card format specification](SPEC-PRICING.md). Its Section 8.7
defines the rules above, and its Section 3.6 the members that say where a
price comes from.

## Updates

Trajectory publishes a new commit here when its default rate cards change.
Each commit replaces every file with the current copy. A change made here is
lost at the next update.
