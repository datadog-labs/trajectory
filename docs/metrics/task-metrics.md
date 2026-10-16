## Task Metrics

A task is a group of consecutive turns that work toward one goal. Trajectory
finds tasks by splitting a session into segments. Task metrics describe each
closed task segment.

### Turning task metrics on

Task metrics are off by default.
Trajectory sends them only when the `automatic_task_segmentation` feature
flag is on. This flag is off by default.

The flag also controls all automatic segmentation in the Trajectory
background service. This includes incremental, session-end, recovery, and
historical catch-up passes.

While the flag is off:

- `segmentation.enabled` and `segmentation.publish_metrics` have no effect.
  This is true even when managed or organization defaults set them.
- Live publication and managed task backfill send no `trajectory.task.*`
  points. `trajectory publish metrics audit` expects none.
- Trajectory holds task rows that were queued before the flag went off. It
  does not send them, and the audit ignores them.
- You can still read the stored `task_segments` rows locally.

The rest of this page describes what happens when the flag is on.

### Metrics

| Metric | Type | Unit |
|---|---|---|
| `trajectory.task.observations.total` | count | task |
| `trajectory.task.outcome_score` | gauge | score |
| `trajectory.task.autonomy_score` | gauge | score |
| `trajectory.task.complexity_score` | gauge | score |
| `trajectory.task.risk_score` | gauge | score |
| `trajectory.task.turns` | gauge | count |
| `trajectory.task.cost.usd.additive` | count | USD |
| `trajectory.session.task_attribution.total` | gauge | task |
| `trajectory.session.task_attribution.attributed` | gauge | task |
| `trajectory.session.task_attribution.unattributed` | gauge | task |
| `trajectory.session.task_attribution.coverage` | gauge | ratio |

### When task metrics are sent

Trajectory sends task metrics when both of these are true:

- `automatic_task_segmentation` is on.
- `segmentation.publish_metrics` or `segmentation.task_insights.publish` is
  in effect.

Task metrics come from closed task segments. A task's score gauges are sent
once, after the task is no longer the open task at the end of the session.
Only that last open task can change. At session end, Trajectory classifies
only that open task again. So a task's ID, boundaries, and scores do not
change after Trajectory sends them.

For Datadog destinations, Trajectory queues every closed task in its local
metric queue. Each task has a fixed completion time and a fixed ID, so the
queue removes repeats.

### Tags

Task metrics carry `trajectory.trace_type:task` and these tags:

- `task_type`
- `outcome_label`
- `task_id`
- `trajectory.task.turn_start` and `trajectory.task.turn_end`, the first and
  last turn IDs of the task. Both turns belong to the task.

`trajectory.task.turns` is the number of stored turns in the task.

Task points also carry `task_level:task`. Trajectory no longer sends
`task_level:meta_task` points, because the meta-task pass was removed. An
older Trajectory version may have left meta-task rows in the local database.
A task point then keeps its `meta_task_id` tag while the task covers the same
turns. So a replay matches the first point that was sent.

`trajectory patterns analyze` can store Work Insights v1 results. Task points
then also carry these tags:

- `work_insights_taxonomy_version`
- `work_insights_level_1`
- `work_insights_level_2`

These tags place the task in a broad outcome taxonomy. `task_type` is a
separate, coding-specific type.

Trajectory never puts the free-form task label in metric tags. The privacy
filter removes that label.

### Task observations and attribution

`trajectory.task.observations.total` counts closed tasks. Use it as the
denominator for task coverage. Trajectory sends it even when attribution is
incomplete.

When the user, model, or client is unknown, the `attribution_status` and
`attribution_reason` tags say so. Trajectory does not guess those values.
Model and client tags come from every stored turn in the task. A task gets one
value only when all its turns agree. If the value is missing or differs
between turns, the task stays unattributed.

Backfill and `trajectory publish metrics audit` build task points with the
same code as live publication. So these values match between live, repaired,
and locally audited rows:

- the observation ID
- the task end time
- the task level
- the Work Insights tags
- the v2 cost tags

### Timestamps and missing values

A task point uses the stored end time of the task's last turn. This includes
late segmentation and cost corrections. If the last turn has no end time,
Trajectory leaves out the point. It never uses another turn's end time or the
send time instead.

A score that was not assessed stays absent. A score of zero is a valid value.
A task cost of zero is valid when every turn has a price.

### Corrections

Task observations and additive task cost go through the shared correction
record. Sending a task again does not add another observation or another full
cost. Better attribution or a lower cost produces signed corrections at the
original task end time.

Trajectory starts from older queued counts when they are clear. If those
counts are missing or unclear, historical corrections for those tasks might
be incomplete.

Use `trajectory.task.cost.usd.additive` for task cost. An older Trajectory
version may still have `task_level:meta_task` points in its queue. Select
`task_level:task` when you add up task cost.

### Task cost

Live task cost is the sum of `turns.estimated_cost_usd` for every turn in the
task.

Historical replay uses checked source data for turn cost first. It falls back
to the same stored turn costs as live publication when every turn in the task
has a value. Malformed source data cannot replace a complete stored sum. If
source data for one task spans segments and disagrees, Trajectory ignores the
source data and uses the complete stored sum. Turn, commit, and PR cost still
reject such disagreements.

Trajectory sends no task cost in these cases:

- Any turn in the task has no price.
- Any turn lacks a known user or model.
- More than one leaf task claims the same turn. Trajectory then sends no cost
  for any of those tasks, so the cost is not counted twice.
- Any first-pass task in the session is still open. This applies even after
  session-end publishing has started.

A task that uses more than one model stays in the observation count. It does
not send a cost under a single model. When Trajectory calculates cost, task
observations carry `cost_coverage:complete` or `cost_coverage:incomplete`.
Trajectory never turns a missing task cost into zero. A missing cost never
removes a turn from its task. A cost that was priced at zero is still a valid
point.

`trajectory publish metrics audit` reports these turn counts for leaf tasks:

- total turns
- turns assigned to exactly one task
- turns assigned to no task
- turns assigned to more than one task

Turns assigned to no task stay outside task cost. Tasks with overlapping turns
still send observations, so you can find the segmentation problem.

Trajectory sends complete leaf-task cost only after a closed segmentation
exists that covers every turn exactly once. A semantic final pass can create
it. Managed backfill can instead create the boundary-only fallback described
in [Managed task backfill](#managed-task-backfill). If the live final pass is
pending or failed, Trajectory keeps the scores it already sent but sends no
task cost.

The `segmentation.task_insights.publish` setting, off by default, also turns
on task cost, together with its privacy-reduced task spans. To stop all
outputs based on task segmentation for a destination, set
`segmentation.enabled: false`.

### Session task attribution

At session end, `trajectory.session.task_attribution.*` compares closed tasks
with every first-pass task row in the session.

- The open task at the end of the session counts in the total.
- A session can have turns but no task rows. Its total then counts one
  missing task projection. It is not zero.
- `projection_state` is `complete`, `partial`, `missing`, or `no_turns`.

So timeouts of the final pass and storage gaps show up in the data.
Trajectory does not invent task boundaries to hide them.

Trajectory still sends both `unattributed` and `coverage`.

#### Reading the attribution gauges

Trajectory reads all four gauges in the same database transaction as task
membership and attribution. They carry the same values for these tags:

- `projection_id`
- `projection_revision`, which Trajectory derives from the content
- `projection_state`

They also carry the same source timestamp. That timestamp is the later of two
times: when the session finished, and when the stored task projection last
changed. Replay keeps it.

`projection_revision` is only for checking whether two snapshots are the same.
It is not a sequence number.

To calculate `attributed / total`, first select the latest matching snapshot
for each session. Never divide gauges that were averaged on their own. If
different revisions share the latest source time, their order is not known.

- A session with no turns has a coverage of 1.
- A missing projection keeps a total of 1.

Historical projection can rebuild coverage states from stored session
completion and task rows. It cannot rebuild earlier snapshots that were
overwritten.

### Managed task backfill

Managed task backfill checks every completed session that qualifies and has
at least one stored turn. Each turn must belong to exactly one closed leaf
task. Only then does Trajectory queue task metrics from that replay. Task
projections that are open, have gaps, overlap, or are out of range are
treated as needing repair. They do not count as done.

If semantic inference fails, managed backfill stores a fallback split based
only on boundaries. It is marked `trajectory:task-coverage-fallback:v1`.

- Its task points carry `segmentation_fidelity:coverage_fallback`.
- The usual attribution tags still describe the user, model, and client.
  Trajectory derives these separately.
- It sends task observations and exact turn counts.
- It never sends score gauges or Work Insights labels.

The managed `agent_console_task_backfill` feature turns this backfill on and
off.

Sometimes neither semantic inference nor the fallback can assign every turn.
Rolling replay then leaves out the whole task slice. It never sends a partial
set of tasks.

### Sessions without task segmentation

Incognito sessions and Trajectory's own segmentation sessions do not run task
segmentation. They send no task metrics and no segmentation operational
telemetry.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
