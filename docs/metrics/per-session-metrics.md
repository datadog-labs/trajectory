## Per-Session Metrics

Trajectory sends session metrics when a session starts, while it runs, and
when it ends.

### Session starts

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.session.count` | count | session start | One replay-safe point for each live session start. Tagged with Claude Code's `start_type` values: `fresh`, `resume`, `continue`, or `agents_view`. Starts that Trajectory observed passively, and starts from historical backfill, send no point. Neither shows that a user started a session at that time. |

`trajectory.session.starts.count` is a second name for the same starts. See
[Activity snapshots and completion totals](#activity-snapshots-and-completion-totals).

### Running session gauges

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.session.cost.usd.accumulated` | gauge | USD | Session cost so far, and the final session cost |
| `trajectory.session.web_search.cost.usd.accumulated` | gauge | USD | WebSearch cost so far, and the final WebSearch cost, at $0.01 per request |
| `trajectory.session.compactions.accumulated` | gauge | compaction | Compactions in the whole session, sent at each completed turn and at session end. Zero is a valid value. |
| `trajectory.session.last_seen.unix` | gauge | second | Time of the latest source event, in Unix seconds |

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

Trajectory sends a running snapshot only when it knows every earlier completed
turn. After a restart, a batch of turns can be missing earlier turns.
Trajectory then sends no session snapshot for that batch. It still sends the
batch's own turn metrics.

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

Two corrections can have the same source second and tags. Trajectory then
sends them in the order it recorded them, and the newest one wins. This is
true even when the newest value is lower or zero. A correction waits until
the earlier point for the same series is sent. If the earlier point failed,
the correction waits until that failure is handled. Points for other series
are not delayed. Two snapshots with the same value at different times stay
separate points.

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

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `trajectory.session.completed` | count | session | One replay-safe point for each completed session |
| `trajectory.session.duration_ms` | gauge | ms | Session duration, when Trajectory can calculate it |
| `trajectory.repo.resolution.total` | count | session | One point for each completed session. It shows how Trajectory found the session's repository, grouped by `trajectory.repo_resolution`. Sent only live. Privacy settings limit its tags. The local audit of past sessions cannot rebuild it. |

### Cost completeness and Cursor diagnostics

| Metric | Type | Unit | Dimensions | Notes |
|---|---|---|---|---|
| `trajectory.session.cost.priced_turns` | gauge | turn | Cost-attribution tags | Completed turns in the session that have a price. Sent together with `trajectory.session.cost.unpriced_turns`, also when the value is zero. |
| `trajectory.session.cost.unpriced_turns` | gauge | turn | Cost-attribution tags, including `trajectory.cost_reason` | Completed turns that have no price, or whose price is unavailable or not valid. Sent together with `trajectory.session.cost.priced_turns`, also when the value is zero. A value above zero stops the complete session USD metrics. A model that Trajectory does not recognize gets `trajectory.cost_reason:model_mismatch`. A missing model gets `trajectory.cost_reason:model_missing`. |
| `trajectory.cursor.token_capture.turns_total` | count | turn | `status`, `source`, `client_surface`, `trajectory.client_surface`, and the standard session tags | Cursor generations that qualify, counted at session end. A missing final generation gets `source:unobserved`. Full generation IDs are never metric tags. |
| `trajectory.pricing.lookup.total` | count | lookup | `status`, `reason`, `client_surface`, `trajectory.client_surface`, `gen_ai.request.model`, `trajectory.model.canonical`, `trajectory.model.equivalence_status`, `trajectory.model.thinking_mode`, `trajectory.model.speed_mode`, `trajectory.model.billing_mode`, `trajectory.model.context_mode`, and the cost-attribution and session tags | One count for each combination of tag values from live pricing decisions. For Cursor, it counts each generation in `shadow` or `emit` mode. For other clients, it counts completed turns. A `candidate` equivalence is only a diagnostic. The turn stays unpriced until an approved managed mapping exists. Historical Cursor records do not send this metric. |

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

#### Session start names

`trajectory.session.starts.count` and `trajectory.session.count` count the
same session starts. Both keep the same `start_type`, source timestamp,
sequence number, and tags. Fresh, resume, continue, and agents-view starts
stay separate.

Choose one name. If you add the two together, you count each start twice. The
integration tile uses `trajectory.session.count`, and Trajectory keeps sending
it by default. No feature flag controls either name.

Backfill builds `trajectory.session.starts.count` only from the original
session start events.

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
