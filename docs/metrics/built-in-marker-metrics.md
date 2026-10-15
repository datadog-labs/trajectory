## Built-In Marker Metrics

Markers are events that Trajectory detects in a session, such as a commit, a
push, or a skill invocation. When Trajectory publishes, it reads the active
marker catalog to decide which marker metrics to send. This page describes the
built-in markers and the markers that setup turns on by default.

### Turn marker metrics

Trajectory sends these counts when the turn ends. For example,
`trajectory.turn.skill_invocations` is available after the turn that invoked
the skill finishes. Trajectory does not wait for the coding-agent session to
end or be deleted.

| Metric | Type | Scope | What it counts |
|---|---|---|---|
| `trajectory.turn.user_frustrations` | count | turn | User frustration events in the turn |
| `trajectory.turn.commits` | count | turn | Git commits in the turn |
| `trajectory.turn.prs` | count | turn | A PR or MR created in the turn, tagged by `change_host`, `owner`, `repo`, and `change_number` |
| `trajectory.turn.pushes` | count | turn | Git pushes in the turn |
| `trajectory.turn.user_interruptions` | count | turn | User interruptions in the turn |
| `trajectory.turn.permissions_denied` | count | turn | Permission denials in the turn, tagged by `tool`, `category`, and `source` |
| `trajectory.turn.language_activity` | count | turn | Language activity in the turn, tagged by `language`. Each `language-activity` point adds its `count` detail |
| `trajectory.turn.skill_invocations` | count | turn | Skill invocations, tagged by `skill_name`, `detected_from`, `source_scope`, `signal_confidence`, and `attribution_reason` |
| `trajectory.turn.cli_tool_count` | count | turn | Recognized command-line tools run in the turn, tagged by normalized `tool` |
| `trajectory.turn.subagents` | count | turn | Confirmed sub-agent launches in each completed turn, tagged `trajectory.activity_execution_contract:confirmed_v1` |
| `trajectory.turn.force_pushes` | count | turn | Force pushes in the turn |
| `trajectory.turn.lines_of_code.count` | count | turn | Lines changed, tagged `type:added` or `type:removed`. Use `type:added` for code added in each turn. |

For `trajectory.turn.subagents`, filter on the
`trajectory.activity_execution_contract` tag. Older points without this tag
came from an earlier, less accurate detection method.

Marker session gauges that hold a count also have these turn-level counts.
Use the turn metrics when you report by turn.

#### Session totals

Some session gauges hold one final value for each completed session. These
gauges also publish a `.completed_count` copy. Examples are
`trajectory.session.force_pushes.completed_count`,
`trajectory.session.language_activity.completed_count`, and
`trajectory.session.prs.completed_count`.

Datadog gauge rollups can repeat a final value in several dashboard buckets.
To answer "how many?", sum the `.completed_count` copy. Do not sum the gauge.

Trajectory builds `trajectory.session.tasks.completed_count` and
`trajectory.session.test_fix_cycles.completed_count` directly from the final
values saved on the machine. They do not depend on which gauges you select.

- Each point uses the time the session completed.
- When a known final total goes down, Trajectory sends a signed correction.
  This includes a change to zero.
- A missing local value does not create a zero count.

A test-fix cycle is a detected sequence: a test fails, the agent edits code,
and the test passes. The count does not show that the edit caused the fix. It
also does not show whether checks were skipped.

### Skill invocations

For skill usage reports, use only `trajectory.turn.skill_invocations` with
this grouping:

```text
sum by {skill_name,detected_from,source_scope,signal_confidence,attribution_reason}
```

- The metric includes every skill invocation that Trajectory models.
  `signal_confidence` is a tag. It does not decide whether Trajectory sends
  the point.
- The client may not report where a skill came from. Trajectory can then set
  `source_scope` by matching a generic skill-tool call to local project or user
  skill files.
- These series also carry the normal Trajectory session tags. These include
  `trajectory.client_source`, `trajectory.client_version`, `trajectory.user`,
  and repository tags when available.
- To check whether skill attribution changed across Claude Code releases,
  group by `trajectory.client_version`.
- `trajectory.session.skill_invocations.completed_count` gives totals for
  completed sessions over the same invocations.

A confidence or source can change after Trajectory sends a point. Trajectory
then sends a negative point for the old tags and a new point for the current
tags. The Datadog metric type stays `count`.

Skill-assisted tool and duration metrics and AI Usage events use only
`signal_confidence:high`.

#### Where skill invocations come from

Claude Code reports a skill activation in two high-confidence ways:

- A native OTLP `skill_activated` log. The local `trajectory serve` accepts it
  on the `/v1/logs` endpoint. Trajectory turns it into a cleaned `Skill` tool
  record tagged `detected_from:claude_native_otel`.
- A native transcript assistant message with `attributionSkill`. Trajectory
  adds it to the `turn_end` event and turns it into a `skill-invoked` marker
  tagged `detected_from:claude_native_transcript`.

Several high-confidence sources can describe the same skill in the same turn.
Trajectory then sends one invocation. Claude native OTel or transcript data
wins over generic `Skill` tool data. When both Claude native sources exist,
the completed transcript sets the `detected_from` tag.

Setup turns on detailed Claude logging on the local machine. Skill names are
then available when Claude reports them.

Trajectory finds Codex skill activations in two ways:

- the structured `<skill>` envelope in the native rollout, tagged
  `detected_from:codex_skill_prompt`
- an `exec` wrapper managed by the runtime, whose nested
  `tools.exec_command` reads `SKILL.md` without changing it, tagged
  `detected_from:codex_skill_read`

When both describe the same skill in one turn, Trajectory counts it once.

cursor-agent loads an active project or user skill with its Read tool.
Trajectory tags reads under `.cursor/skills/<name>/SKILL.md` with
`detected_from:cursor_skill_read`. Other direct `SKILL.md` reads stay
lower-confidence observations.

### Skill complexity metrics

When a turn has a high-confidence skill invocation, Trajectory also sends skill
complexity metrics. It picks the source for these metrics in this order:

1. Claude native OTLP trace spans. Tool spans with native skill attributes
   publish as `skill_attribution:span_tool_attribute`.
2. If there is one high-confidence skill in the turn, Trajectory can match it
   to Claude tool spans from the same turn. These publish as
   `skill_attribution:span_temporal`.
3. If no usable native trace window exists, Trajectory uses the tool rows
   from the same turn. These publish as `skill_attribution:turn_assisted`.

The last method is good for broad trends. It does not show which tool calls
the skill itself made.

All skill complexity series carry `skill_name`, `detected_from`,
`source_scope`, `signal_confidence`, and `skill_attribution`.

| Metric | Type | Scope | What it reports |
|---|---|---|---|
| `trajectory.turn.skill_tool_uses.additive` | count | turn | Tool uses in the same turn, with the same skill and tool tags, as a total you can sum |
| `trajectory.turn.skill_tool_uses.total` | distribution | turn | Tool calls in the skill-assisted turn. The `metric_samples_skill_tool_uses` control turns these samples on or off. It is on by default. |
| `trajectory.turn.skill_distinct_tools.total` | distribution | turn | Distinct tool names in the skill-assisted turn, not counting skill tools |
| `trajectory.turn.skill_duration_ms.total` | distribution | turn | How long the skill-assisted turn took, when turn times are available |

### Permission denials

For permission reports by turn, use `trajectory.turn.permissions_denied`
grouped by `tool`, `category`, and `source`.

Trajectory sends one point for each denial. It identifies a denial by its
`tool_use_id` within the turn. Both `turn_end.denial_reasons` and a
`permission_result` can report the same denial. Trajectory still sends one
point.

The earlier report sets the point's turn, time, and `tool`, `category`, and
`source` tags. If both reports have the same time, `turn_end.denial_reasons`
wins. The point keeps the tags that the turn publish already sent.

For example, Claude Code records a denial at Stop time in `turn_end`. It then
adds its `permission_result` with the same timestamp. That point keeps
`source:turn_end.denial_reasons` and has no `tool` tag. A `permission_result`
written before the `turn_end` keeps its own, more specific tags.

The saved marker also keeps the `permission_result` decision fields. It lists
both reports in `denial_sources`. Trajectory does not merge these cases:

- denials without a `tool_use_id`
- reports that reuse a `tool_use_id` in different turns

The `markereval` SDK, which needs no database, uses the same rule. It returns
one `permission-denied` marker and one `permission-denied-turn-count` point for
each denial. This matches the local SQLite data.

#### Claude Code user decisions

For Claude Code, a native `native_tool_timing` user decision updates the
existing `permission_result` before detection runs.

- A user rejection that transcript detection missed then counts as a denial.
  If a denial row already exists for that call, the rejection joins it.
- A user acceptance removes a wrong transcript denial. This applies whether
  `turn_end.denial_reasons` or the `permission_result` reported it.
- The point keeps `source:permission_result`.
- Config and hook decisions do not add or remove a denial. Neither does an
  event marked `after_turn_publish:true`.

### Command-line tools

For a toplist of command-line tools, use this query:

```text
sum:trajectory.turn.cli_tool_count{*} by {tool}.as_count()
```

The `tool` tag comes from an allowlist of command families, such as `git`,
`gh`, `go`, `pytest`, `npm`, `bazel`, `docker`, and `kubectl`. Trajectory
skips unknown command names. It never sends them as raw tag values.

### PR attribution metrics

| Metric | Type | Scope | What it reports |
|---|---|---|---|
| `trajectory.pr.observations.total` | count | pr | That a normalized PR or MR was seen. One point for each session generation. See below. |
| `trajectory.pr.interactions.total` | count | pr | One point for each turn that interacted with a PR, after duplicates are removed. Carries `trajectory.turn_id`. |
| `trajectory.pr.work_turns.additive` | count | pr | Turns assigned to the PR. Use `sum:...as_count()` for dashboards. |
| `trajectory.pr.work_duration_ms.additive` | count | pr | Duration assigned to the PR. Use `sum:...as_count()`. |
| `trajectory.pr.work.cost.usd.additive` | count | pr | Spend on work for the PR. Use `sum:...as_count()`. See below. |
| `trajectory.pr.work.input_tokens.additive` | count | pr | Input tokens assigned to the PR |
| `trajectory.pr.work.output_tokens.additive` | count | pr | Output tokens assigned to the PR |
| `trajectory.pr.work.cache_read_tokens.additive` | count | pr | Cache-read tokens assigned to the PR |
| `trajectory.pr.work.cache_creation_tokens.additive` | count | pr | Cache-creation tokens assigned to the PR |
| `trajectory.session.pr_attribution.interacted` | gauge | session | Distinct normalized PRs seen in the session, including unpriced and low-confidence ones, from the matching verified snapshot |
| `trajectory.session.pr_attribution.created` | gauge | session | Distinct PRs that the session created successfully, in the matching verified snapshot |
| `trajectory.session.pr_attribution.context` | gauge | session | Distinct PRs with a share of a completed turn, whether priced or not |

The additive PR metrics support corrections. If Trajectory changes an
assignment, it sends a correction instead of a second value.

#### PR presence

`trajectory.pr.observations.total` publishes during turn processing and again
when Trajectory reconciles the session at its end. It stays present in these
cases:

- abandoned sessions
- low-confidence PR matches
- sessions with several PRs
- unpriced cost
- cost that Trajectory has not yet verified

The `signal_confidence`, `identity_confidence`, `attribution_reason`, and
`cost_coverage` tags explain each case. If the cost is not available,
Trajectory never sends a zero cost and never reverses an earlier value.

`trajectory.pr.interactions.total` does not assign spend a second time when
another workspace is the main one for that PR.

#### PR work spend

Cost, the four token counts, duration, and fractional turns share the same
split of each completed turn. Each uses the time the source turn completed.

Trajectory splits each turn across every PR with evidence on that turn, by
weight:

- An explicit PR action on the turn, such as creating, checking out,
  viewing, commenting on, or merging the PR, weighs 8.
- A turn on the PR's branch, or a push linked to the PR, weighs 4.
- The work that led to a PR, in the turns before its create, weighs 2.
- A PR URL in the prompt weighs 1.

A PR's weight on a turn is the sum of the different kinds it has there.
`trajectory.pr.work.cost.usd.additive` carries every share. The shares of
each turn add up to exactly one, so the ungrouped total equals the cost of
the turns that have a PR. A turn with no PR evidence is not split. The metric
reuses the cost of completed turns.

- Query it with `.as_count()`.
- Never add it to `trajectory.turn.cost.usd.additive`, to session cost, or to
  the cost of PR creation turns.
- For totals, use the ungrouped metric.

See [Cost Attribution and Dashboarding](../COST-ATTRIBUTION.md).

#### PR work tags

PR work rows carry `source:facts`, `change_host`, `owner`, `repo`,
`change_number`, `context_source`, `work_context_mode`,
`identity_confidence`, `signal_confidence`, `attribution_reason`, and
`local_range_status`. `attribution_reason` names the strongest kind of
evidence the PR has on the turn. Rows with cost or tokens also carry
`trajectory.cost_role:attribution`. They also carry provider-route and
cost-overlap tags from their assigned turns. These tags come from fixed lists.

PR-specific marker metrics carry the `session_id` tag. Rows with a source turn
also carry `trajectory.turn_id`. Use PR identity tags only on PR-specific
metrics. Broad token, duration, tool, permission, and skill metrics do not
carry PR numbers.

A turn without a price, a model, or a user sends no cost share. An earlier
cost share for it is reversed. Trajectory never sends a zero instead. PRs from
an incognito or ineligible session get no share.

### Cost per PR

Cost per PR means the cost assigned to PRs, divided by the number of distinct
PRs or MRs seen. It does not mean the cost of creating a PR.

Use the same filters and time range for both parts:

1. Sum the cost from `trajectory.pr.work.cost.usd.additive`.
2. Count the distinct PR identities in `trajectory.pr.observations.total`. A
   PR identity is `(change_host, owner, repo, change_number)`.
3. Divide the cost by the count.

Step 2 needs DDSQL or another query tool that can count grouped metric rows.

```text
cost = sum:trajectory.pr.work.cost.usd.additive{source:facts,...}.as_count()
prs  = count rows from max:trajectory.pr.observations.total{source:facts,...}
       by {change_host,owner,repo,change_number}
cost / prs
```

Every normalized PR stays in the count. This includes PRs from sessions with
several PRs, low-confidence matches, and unpriced observations. Trajectory
divides each priced turn across every supported PR candidate, and the shares
add up to the full cost.

| `cost_coverage` | Meaning |
|---|---|
| `allocated` | Priced cost is assigned |
| `unpriced` | The PR has a share of a completed turn, but none of them has a price |
| `no_priced_turn` | The PR has no share of a completed turn |

Use the confidence, reason, and coverage tags on the presence metric to explain
each PR.

`trajectory.session.prs.completed_count` counts PRs created. Do not use it to
count PRs that received work.

### Qualified PR observations

`trajectory.pr.ai_assisted.observations.total` is a signed count. The
`qualified_pr_observations` flag controls it, and the flag is on by default.

A completed source turn adds one observation for each normalized PR when one
of these is true:

- The turn created the PR, or has a successful, recognized PR action or a
  push linked to the PR.
- The turn is on the PR's branch, and that branch is the turn's one PR
  context. The work before a PR's create does not count.
- The prompt contains exactly one PR URL, with no other PR identity.

More evidence for the same turn and PR does not add observations. These cases
do not qualify:

- failed or unknown actions
- PRs mentioned only in passing in output
- turns that did not complete
- prompts with more than one PR identity

Separate successful actions can qualify separate PRs. A price is never
required.

Trajectory identifies an observation by source session, turn, and PR.
Session and turn IDs are not tags on this metric.

- The completion time decides the time window, after conversion to UTC. This
  holds even when the turn crosses midnight.
- If a turn stops qualifying, Trajectory reverses the old observation.
- If the time or tags change, Trajectory reverses the old point and sends the
  new one.
- Live publishing and backfill use the same identity.
- A verified finished generation must fit completely inside the reconciled
  interval. Trajectory does not support generations that cross the interval or
  are incomplete. It does not report them as zero.

To count distinct PRs, follow these steps for the exact interval:

1. Sum the signed observations **for each PR**.
2. Keep the PR groups with a positive net count.
3. Count those groups.

If you only sum the observations, you count qualifying turns, not distinct
PRs. Ordinary PR presence in `trajectory.pr.observations.total` is a separate
set.

### PR correction times

PR corrections keep their source times. OTLP accepts points up to one hour old
here. Trajectory holds older points in the local outbox with the reason
`unsupported_pr_source_history`. It does not send them.

Datadog Historical Metrics Ingestion replaces a stored point instead of adding
to it. Trajectory therefore cannot use it to send signed corrections. A value
from before an upgrade that has no saved source time is also not supported.
Annotation changes and retries do not make an old point current.

The three session attribution gauges use one verified snapshot and timestamp,
with `attribution_source:facts_snapshot`. Without that proof, Trajectory does
not send them. It does not send a zero instead.

### Backfill

Backfill sends the live metric names again with their original timestamps. The
page for each metric describes its backfill behavior. Rolling reconciliation
reports its own data quality. See
[backfill fidelity](instrumentation-health-metrics.md#backfill-fidelity).

- Backfill publishes over OTLP with the original timestamps.
- Datadog stores the backdated points because Historical Metrics Ingestion is
  on for the destination.
- Every managed Datadog destination accepts backfill unless it sets
  `backfill_opt_out: true`.
- Events imported from a provider's history do not feed the ordinary metrics.
  Only the rolling backfill uses them.

Datadog identifies a point by metric name, type, timestamp in seconds, and the
full tag set. Sending the same point again therefore does not count it twice.
Trajectory merges count points with the same identity before it queues them.

Each backfilled metric name shows what Trajectory can send. Some sources do not
keep the data that a metric needs. Trajectory then leaves the point out. It
does not report zero.

### Custom measures

A custom measure can publish under any valid `trajectory.*` or `gen_ai.*`
metric name. If a measure has no `metric:` field, Trajectory names it
`trajectory.<scope>.<name>`. It changes hyphens to underscores.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
