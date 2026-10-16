## Automated Oversight Metrics

Automated oversight is a model call that a coding agent makes on its own to
judge another action or output. An automatic approval check is one example.
Trajectory reports each of these reviews as an oversight operation.

Every oversight metric carries `trajectory.trace_type:oversight`. Trajectory
does not count these operations as turns or sessions of the session that ran
the review.

| Metric | Type | Unit | When Trajectory sends it |
|---|---|---|---|
| `trajectory.oversight.operations.total` | count | operation | One point for each normalized `oversight_result` |
| `trajectory.oversight.duration_ms.total` | distribution | ms | One duration for each operation, when the duration is positive and known |
| `trajectory.oversight.duration_ms.additive` | count | ms | The operation duration, as a total you can sum. See [additive operation accounting](#additive-operation-accounting). |
| `trajectory.oversight.cost.usd.additive` | count | USD | The operation cost, as a total you can sum. See [additive operation accounting](#additive-operation-accounting). |
| `gen_ai.usage.input_tokens` | count | token | When the client reports input tokens for the operation |
| `gen_ai.usage.output_tokens` | count | token | When the client reports output tokens for the operation |
| `gen_ai.usage.cache_creation_tokens` | count | token | When the client reports cache-write tokens for the operation |
| `gen_ai.usage.cache_read_tokens` | count | token | When the client reports cache-read tokens for the operation |

### Tags

Every operation metric carries these tags when the value is known:

| Tag | Values |
|---|---|
| `trajectory.oversight.kind` | `approval`, `safety`, `quality` |
| `trajectory.oversight.outcome` | `passed`, `blocked`, `flagged`, `failed`, `unknown` |

Provider role and feature names appear only in trace diagnostics. They are not
metric tags.

### Avoid double counting

Some reviews report `oversight_cost_inclusion:parent_included`. For these
reviews, the parent turn's `gen_ai.usage.*` metrics already include the review
tokens. Trajectory therefore does not send the four oversight token metrics
for them. Otherwise, any sum that does not filter on `trajectory.trace_type`
would count the tokens twice.

Permission-decision metrics and oversight metrics describe different things.
A permission decision describes the action under review. An oversight metric
describes the model call that judged it. Do not treat them as duplicates.

If a destination uses the `off` publish mode, Trajectory sends it no oversight
spans or metrics.

### Local dashboard

`trajectory view` has a local Automated Oversight dashboard. It reads the
operation records saved on the machine and shows no prompt or response
content. It shows these values:

- operations per 100 ordinary turns
- outcome rates
- p50 and p95 added latency
- tokens used only by oversight
- the sum of costs with attribution status `priced`

The dashboard has provider-role and provider-feature filters. These filters
work only on the local machine. They do not add tags to the published metrics.

The dashboard cost sums every `priced` cost. The
`trajectory.oversight.cost.usd.additive` metric sums only independent costs, as
described below. The two totals can differ.

### Additive operation accounting

`trajectory.oversight.duration_ms.additive` and
`trajectory.oversight.cost.usd.additive` are count metrics. The same metric,
oversight, privacy, and destination controls apply to them as to the
operation count.

Sum them with `.as_count()`. For example, operations of 2,000 ms and 3,000 ms
add 5,000 ms. Independent costs of 0.02 USD and 0.03 USD add 0.05 USD. If the
first cost changes to 0.025 USD, Trajectory sends a correction. The total then
becomes 0.055 USD.

#### How Trajectory counts one operation

- Trajectory identifies an operation by its native operation ID and its
  source.
- One review can contain several model calls. One reviewer session can contain
  several reviews.
- A review can appear both inline and in a separate reviewer session.
  Trajectory counts it once.
- A change to the outcome, model, or coverage corrects the existing
  contribution. It does not add a new one.
- Each point uses the time the review finished. Trajectory takes this from the
  native result time or from `oversight_completed_at`. It does not use the
  upload time or the end of the surrounding turn.
- An operation without an ID, a source, or a valid result time adds nothing.

#### When duration and cost count

A duration counts when it is a finite, non-negative native measurement or a
valid interval between start and end events.

A cost counts only when all of these are true:

- The operation has a model.
- The amount is a finite, non-negative number. Zero is a valid amount.
- The operation has `cost_attribution_status:priced`.
- The operation has `oversight_cost_inclusion:independent`.

A `priced` status alone is not enough. Usage with `parent_included` or an
unknown inclusion never adds a second charge. Provider captures that lack this
information count as a gap in cost coverage.

The local `oversight_operations` records hold the same measurements, source
identity, and origin. A measurement that is not known is empty.

#### Coverage tags

The additive metrics and the operation count carry these tags:

| Tag | Values |
|---|---|
| `duration_coverage` | `complete`, `missing` |
| `cost_coverage` | `complete`, `missing`, `parent_included`, `unknown_inclusion` |
| `timing_provenance` | `native`, `measured`, `missing` |

To compute an average, divide by the operations that have the matching
measurement. Divide by all operations only when coverage is `complete`.

#### Duration samples

The `metric_samples_oversight_duration` control turns the
`trajectory.oversight.duration_ms.total` samples on or off. It is on by
default. Trajectory sends each sample at most once, even after a retry, a
change of reviewer session, or a change to the control. If the control is off
when a sample is due, Trajectory never sends that sample later. The additive
totals do not depend on this control.

#### Backfill and corrections

Backfill republishes the operation count and the two additive metrics. It
sends cost or duration only together with the operation count. It does not
republish the duration distribution.

Reviewer data never counts toward ordinary-work totals. The destination
oversight setting and the privacy controls apply twice: when Trajectory
queues a point, and again when it sends it.

Trajectory can correct an operation only while its count record is still kept
at its original time. A correction does not add a second count. Trajectory
cannot correct these records:

- older records that it has already pruned
- duplicate copies without an operation identity that Trajectory can rebuild

Trajectory cannot rebuild duration percentiles for past periods.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
