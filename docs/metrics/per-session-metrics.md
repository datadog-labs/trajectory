## Per-Session Metrics

Trajectory sends session metrics when a session starts, while it runs, and
when it ends. Every metric on this page carries the
[common tags](common-tags.md) and `trajectory.trace_type:session`.

### Session starts

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.session.count` | count | session start | One replay-safe point for each live session start. Tagged with Claude Code's `start_type` values: `fresh`, `resume`, `continue`, or `agents_view`. Starts that Trajectory observed passively, and starts from historical backfill, send no point. Neither shows that a user started a session at that time. |

See [Activity snapshots and completion totals](#activity-snapshots-and-completion-totals).

### Running session gauges

| Metric | Type, unit | Meaning | Other tags | Sent when |
|---|---|---|---|---|
| `trajectory.session.cost.usd.accumulated` | gauge, USD | Session cost so far, and the final session cost | Cost tags | On a turn publish when the value changed, and at session end. Every earlier turn must be priced. |
| `trajectory.session.web_search.cost.usd.accumulated` | gauge, USD | WebSearch cost so far, and the final WebSearch cost. Each search costs the rate card's price for its call's model. See [WebSearch cost](per-turn-metrics.md#websearch-cost). | Cost tags | On a turn publish when the value changed, and at session end. Not sent once a search has no price. |
| `trajectory.session.compactions.accumulated` | gauge, compaction | Compactions in the whole session. Zero is a valid value. | None | On the first turn publish, when the count changed, and at session end |
| `trajectory.session.last_seen.unix` | gauge, second | Time of the latest source event, in Unix seconds | None | On every turn publish, compaction, and session end |

#### Reading snapshot values

The cost, WebSearch cost, compaction, and pricing-completeness gauges are
snapshots. Each point holds the session total at that time.

Select the latest or final point for each session and its tags. Do not sum the
points. Do not take the maximum, because a correction can lower the final
value.

WebSearch usage is known only when the session has a recorded request count.
That count can be zero. When the count is missing, WebSearch usage is unknown.
The read-only metric audits keep this difference. They use the stored
completion times. Default values in the local cache do not count as a known
zero or as a complete record of earlier turns.

#### When snapshots are sent

A turn publish sends a snapshot gauge only when its value or tags changed since
the last snapshot that Trajectory sent for the session. Session end always
sends the final value. To read the current value, take the latest point over a
window that reaches back to the last change. A `trajectory serve` restart sends
each snapshot once more on the next turn. The snapshot gauges are the cost,
WebSearch cost, compaction, priced-turn, and unpriced-turn gauges.

Trajectory sends a running snapshot only when it knows every earlier completed
turn. After a restart, a batch of turns can be missing earlier turns.
Trajectory then sends no session snapshot for that batch. It still sends the
batch's own turn metrics. The same goes for a resumed run
and for a session that serve restarted during. Its later turns send no running
snapshot, and its session end sends the final value when it can.

At session end, Trajectory rebuilds the final values from the completed turns,
including accepted corrections. It does not trust an older total cost.

- A resumed session keeps the turn counts recorded before the resume. A later
  count that is missing or lower does not remove completed turns.
- An unfinished last turn adds no completed-turn cost.
- The final WebSearch snapshot uses the publisher's completed-turn totals,
  also for resumed sessions.

The final compaction total includes compaction events that have no turn ID.
A complete session gets this total even when it has no costed or completed
turns. A final compaction total recorded by the client can lower the count.
When Trajectory rebuilds values from the local cache, it sends a known zero
only after a successful compaction query. Compaction events without a turn
stop running compaction snapshots, but they still count in the final total.

#### Corrections

A later WebSearch correction does not change the original turn snapshot or
running session snapshot. Trajectory sends the correction as separate signed
points. These points can raise or lower the value. The audits keep the
original rows, rebuild the signed corrections, and use the corrected totals
for the final session snapshot.

Datadog keeps the last point of a series in a second. So a correction goes out
at another second of the same minute as the point it corrects, and the two add.
A rollup of a minute or longer reads the corrected value. A per-second query
shows the point and its corrections separately.

A correction waits until the earlier point for the same series is sent. If the
earlier point failed, the correction waits until that failure is handled. Points
for other series are not delayed. Two snapshots with the same value at different
times stay separate points.

#### Timestamps

- Cost and pricing updates use the turn completion time.
- Final snapshots use the session completion time.
- A compaction gauge sent on its own keeps the compaction event time.

Trajectory never uses nearby metadata or the send time in place of a missing
timestamp. When the session events are still stored, the local audit uses
their completion time. This holds even if a later check extended the cached
turn duration.

#### Backfill

Backfill sends these five session gauges again only when the full session
start and end events are stored:

- `trajectory.session.cost.usd.accumulated`
- `trajectory.session.web_search.cost.usd.accumulated`
- `trajectory.session.compactions.accumulated`
- `trajectory.session.cost.priced_turns`
- `trajectory.session.cost.unpriced_turns`

Backfill does not rebuild distributions or request-size samples. Each point
keeps its source timestamp. So the history that a destination accepts limits
how far back backfill can go.

#### Codex session cost

For Codex, the final session cost is the sum of the accepted turn costs.
Trajectory does not price the session's total tokens again. A single rate for
the whole session could differ from the real turn costs. Long-context
thresholds for each request, service tiers, model changes, and costs that are
not based on tokens can all cause this.

### Session-end metrics

These metrics describe the whole session, so they are sent once, when the
session first ends. A resumed session's later ends do not send them again. See
[Resumed sessions](#resumed-sessions).

| Metric | Type, unit | Meaning | Other tags | Sent when |
|---|---|---|---|---|
| `trajectory.session.completed` | count, session | One replay-safe point for each completed session | None | The session ended and was not abandoned |
| `trajectory.session.duration_ms` | gauge, ms | Session duration | None | Trajectory can calculate the duration |
| `trajectory.session.cost.usd.total` | distribution, USD | One cost sample for each completed session, for percentiles, with its sub-agents and the client's background requests. A sub-agent with a session of its own sends its own sample instead. For spend totals, use `trajectory.turn.cost.usd.additive`. | Cost tags, lower-bound tags | Every turn has a price and `metric_samples_session_cost` is on, which is the default |
| `trajectory.repo.resolution.total` | count, session | How Trajectory found the session's repository. Privacy settings limit its tags. The local audit of past sessions cannot rebuild it. | `trajectory.repo_resolution` | Live session end only |

### Resumed sessions

A session end means that a run ended, not that the session is final. When a
resumed session ends again, Trajectory sends what the later run added. Ending
the same run again, or retrying it, adds nothing.

Each destination takes a later run once its own first end is sent. A
destination that cannot publish yet, for example because its API key is
missing, does not hold a later run back from the others.

Backfill publishes what a resumed session's later runs added the same way for
the completed-session counts, the turn counts of marker metrics, and
`trajectory.session.errors.accumulated`. When backfill publishes a session
with several runs, these go out with the last run. A run's end before it adds
no count, so a count that grew after an end backfill already published never
lands at that end's time. The first run's end still sends
`trajectory.session.errors.accumulated` as it stood at that end, when backfill
has not published that end before. The ends between the first and the last
send no snapshot. A destination's filter can exclude the project a
session was resumed in. That destination takes no later run at the last end,
and the first run's end sends the completed-session counts. Backfill sends
the other snapshot gauges with each turn, not again at a later run's end.

| Kind of metric | What a later run sends |
|---|---|
| Turn metrics, including turns that never got their own `turn_end` | Points for turns not sent yet. A point already sent is not sent again, even when the session's model or other session tags changed. A turn count that grew sends only the growth, at the time the run ended. |
| Completed-session counts such as `trajectory.session.pushes.completed_count` | The change since the last run, at the time the run ended, with that run's tags. |
| Snapshot gauges such as `trajectory.session.cost.usd.accumulated` and `trajectory.session.pr_attribution.created` | The latest value. Read the latest point; do not sum. |
| The session-end metrics above, `trajectory.session.evaluated`, `trajectory.markers.*`, and the session distributions | Nothing. |

Trajectory can handle a run's end more than an hour after it happened. Datadog no
longer takes a point at that older time, so the change goes out when Trajectory
handles it. A session's first count does too, for work after your destination
first ran a release with this behavior. The count stays exact, but it can fall on
a later day than the run.

A session that ended before this behavior shipped sends only the change as well,
because Trajectory reads what it already queued for that session. Trajectory keeps
that record for 60 days by default. After that, the session's completed-session
counts stay as sent, unless a later run left a newer record. Points older than
the metric outbox keeps do not go out either. Both could count twice.

### Cost completeness and Cursor diagnostics

| Metric | Type | Unit | Dimensions | Notes |
|---|---|---|---|---|
| `trajectory.session.cost.priced_turns` | gauge | turn | Cost-attribution tags | Completed turns in the session that have a price. A turn publish sends it when the value changed. Session end always sends it, also when the value is zero. |
| `trajectory.session.cost.unpriced_turns` | gauge | turn | Cost-attribution tags, including `trajectory.cost_reason` | Completed turns that have no price, or whose price is unavailable or not valid. A turn publish sends it when the value changed. Session end always sends it, also when the value is zero. A value above zero stops the complete session USD metrics. A model that Trajectory does not recognize gets `trajectory.cost_reason:model_mismatch`. A missing model gets `trajectory.cost_reason:model_missing`. |
| `trajectory.pricing.lookup.total` | count | lookup | `status`, `reason`, `client_surface`, `trajectory.client_surface`, `gen_ai.request.model`, `trajectory.model.canonical`, `trajectory.model.equivalence_status`, `trajectory.model.thinking_mode`, `trajectory.model.speed_mode`, `trajectory.model.billing_mode`, `trajectory.model.context_mode`, and the cost-attribution and session tags | One count for each combination of tag values from live pricing decisions. For Cursor, it counts each generation in `shadow` or `emit` mode. For other clients, it counts completed turns. A `candidate` equivalence is only a diagnostic. The turn stays unpriced until an approved managed mapping exists. Historical Cursor records do not send this metric. |

At session end, Cursor reports every eligible generation that ended without
final token usage, with or without a turn. Each one adds to
`trajectory.instrumentation.capture.gap{client_source:cursor,reason:usage_missing}`.

If a Cursor turn has no price, Trajectory sends no `trajectory.turn.cost.usd*`
point for it. If only some turns in a Cursor session have a price, Trajectory
sends no complete session USD gauge or distribution. A real price of zero is
still sent as a USD point, with `trajectory.cost_status:priced`.

`trajectory.client_surface` names where the agent ran: `desktop`, `cli`,
`cloud`, `workspace`, `web`, or `unknown`. It uses the same values for every
agent. When Trajectory captures it, the tag goes on token and cost metrics and
on the Cursor diagnostics. The older `client_surface` tag stays on the
diagnostics only, so existing queries keep working.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).

### Activity snapshots and completion totals

#### Session starts

`trajectory.session.count` counts lifecycle starts, including fresh, resume,
continue, and agents-view starts. It preserves source timestamps, sequence
numbers, and tags. One session can contribute several starts. The integration
tile uses this name. No feature flag controls it.

#### Session errors

`trajectory.session.errors.accumulated` is a gauge. It comes from the same
per-turn error data as `trajectory.turn.errors.additive`. Trajectory updates
both together.

For example, two completed turns have two errors and three errors. The
snapshots are two, then five. A correction can later lower five to three.

To get the current total, select the latest source snapshot and
`trajectory.snapshot_revision` for each session and category. Do not sum the
snapshots. Do not take their maximum.

- Source timestamps stay the same when Trajectory retries a send.
- Trajectory sends a snapshot only when every completed turn has complete
  error data. If any turn is missing data, no snapshot is sent.
- If a session has more than 10,000 turn error records, Trajectory sends no
  total. It never sends a cut-off total.

#### Subagent and skill totals

These totals use the `trajectory.activity_execution_contract:confirmed_v1`
rules:

- `trajectory.session.subagents.completed_count` sums confirmed subagent
  launches. It carries the capture coverage tags.
- `trajectory.session.skill_invocations.completed_count` sums the skill uses
  recorded for each turn. It keeps the skill confidence and attribution tags.

Both totals go through the shared correction record. Ending the same session
again does not add the total again. If a skill group changes, Trajectory sends
signed points that reverse the old group.

A session total covers sessions that complete in the time range. A turn total
covers activity in the time range. Do not add the two.

These rules are on by default. No feature flag controls them. Trajectory
keeps the correction data for these totals after it removes older session
data. So resumed sessions and later corrections still add up correctly.

A partial final view of the session can correct known turns. It cannot create
a session snapshot.

These session totals need a destination that queues metrics locally before it
sends them. Datadog destinations always do, and so does an OTLP collector by
default. If you turn off the `otlp_metric_outbox` feature flag, a collector gets
metrics from an in-memory exporter instead. That exporter leaves out session totals
that are not final yet and does not send provisional zeros. Its untagged
marker completion counts keep their earlier meaning.

There are four separate settings for duration and skill distributions. They
are on by default. Turning them off does not stop the skill invocation totals
or the additive skill-tool totals.

#### Audit

The metric audit rebuilds confirmed skill totals from the skill uses recorded
for each turn. It rebuilds skill run statistics from captured tools and from
native trace data.

- Stored session-end events give the completion time. They also exclude
  sessions that were abandoned before they ended.
- Rows that Trajectory already sent show which rules applied and when the
  rows were delivered. The audit never takes expected values from them.
- Older completion rows keep their earlier meaning.
- If the rows mix old and new rules, or the rules are unknown, the audit
  fails and explains why. It does not pick one set of rules.

#### Backfill of activity totals

Backfill does not rebuild `trajectory.session.errors.accumulated` or the
confirmed completion totals from history. Trajectory sends them only when it
checks a stored live session at session end. So partial history never appears
as a complete session snapshot.

### Session outcome logs

The Smart Routing A/B readout joins `trajectory.session.outcome` log events to
gateway logs by the raw `session_id`. Each event contains exact integer counts
(`prs_merged`, `prs_closed_unmerged`, `prs_open`),
`merge_keep_rate_valid`, an optional numeric `merge_keep_rate`,
`outcome_fingerprint`, `outcome_sequence`, `outcome_schema_version`,
`emitted_at`, and the OTLP transport `timestamp`. The pass checks for
changes each hour and rescans unchanged sources after a day. It queues an
event only when the local session snapshot changes.
The log is sent only to an explicitly authorized managed destination. A
general operational-log grant does not authorize it. The readout selects the
latest event per session by `emitted_at`, then `outcome_sequence` for ties.
`emitted_at` is the original observation time. The transport timestamp may
be refreshed when a queued event is delivered after six hours. The sequence
is the row ID stored in the local delivery queue and orders events from one
home. Do not average or sum metric buckets.

An unresolved PR contributes to none of the three counts. An absent keep rate
is not zero: `merge_keep_rate_valid=false` withdraws an earlier value, while a
computed rate of zero is a measured zero. Incognito sessions send no outcome
event, not even a redacted count. Publication checks both the live privacy fold
and retained aged-session privacy evidence before queueing and again before
delivery. If configured aggregate retention is shorter than the local queue's
90-day checkpoint window, publication waits rather than risk losing that
evidence. The local delivery queue retains undelivered rows for retry. The
receiving Datadog log index must retain them for at least
the full sixty-day outcome lookback. The receiving index must admit
`trajectory.session.outcome` events before the readout can use them.
