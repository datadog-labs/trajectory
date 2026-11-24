# Metric Queries

This page gives Datadog queries for Trajectory's metrics, and the cautions
that keep dashboards and monitors right. For metric names, tags, and how each
family behaves, see [Metrics](METRICS.md).

## Common queries

### Spend and work

Spend totals use the additive cost metric, ungrouped, with one grain and one
source family in each widget:

```text
sum:trajectory.turn.cost.usd.additive{trajectory.cost_contract:v2,trajectory.cost_role:attribution}.as_count()
```

- For one client, add `trajectory.client_source:claude-code` or
  `trajectory.client_source:cursor` and `trajectory.cost_source:turn_metrics`.
  Group by user and model.
- To filter by route, add `trajectory.provider_route`: `direct`, `bedrock`,
  `vertex`, `foundry`, `llm_gateway`, or `datadog_ai_gateway`. Any gateway
  needs both gateway values.
- The client's own totals carry `trajectory.cost_role:client_telemetry`. To
  compare sources, group by `trajectory.cost_dedupe_group` and
  `trajectory.cost_role`.
- `trajectory.cost_overlap_risk:aggregate_only` likely overlaps a billing
  tool. Review `unknown`, `mixed`, and points without a cost role or
  contract.
- To split Claude spend, use `query_source:subagent` for delegated child agents. For parent spend,
  include the other values of `query_source`, such as `main`,
  `repl_main_thread`, and `compact`.

Backfill and corrections go to the live `.additive` series, with the original
timestamps and the `v2` tag. Query only that series.

PR work cost is `sum:trajectory.pr.work.cost.usd.additive{source:facts}.as_count()`.
Never add it to turn, session, or PR creation cost. It is the same turn cost,
grouped by PR. For cost per PR, use DDSQL. Divide that cost by the distinct
`(change_host, owner, repo, change_number)` groups in
`trajectory.pr.observations.total`, with the same filters.

To count distinct qualified PRs, use
`trajectory.pr.ai_assisted.observations.total`, not
`trajectory.pr.observations.total`, which also counts PRs that did not qualify.
Add up its signed observations for each PR over the interval, and count the
groups above zero. A plain sum counts qualifying turns instead. Narrow PR
metrics by `source:facts`, `change_host`, `owner`, `repo`, and
`change_number`. Then drill into `session_id`,
`trajectory.turn_id`, and the attribution tags.

### Sessions, turns, and users

| Question | Query |
| --- | --- |
| Completed sessions | `sum:trajectory.session.completed{...}.as_count()` |
| Active users | `max:trajectory.session.last_seen.unix{...} by {trajectory.user}` with `count_nonzero(query1)` |
| Slowest turns | `max:trajectory.turn.duration_ms{...} by {session_id,trajectory.turn_id}`, for clients that send or derive duration |
| Turns that created a PR | `sum:trajectory.turn.prs{repo:...,change_number:123} by {session_id,trajectory.turn_id}` |
| Permission reports | `trajectory.turn.permissions_denied` by `tool`, `category`, and `source` |

To sort tables by recent activity, use `trajectory.session.last_seen.unix`.
For tool counts, group `trajectory.turn.tool_uses.additive` by `tool_name` or
`tool_type`. A turn's total is the sum of `trajectory.turn.tool_uses.additive`
over all its tags.

Filter metrics by `trajectory.user:<name>` and traces by
`@trajectory.user:<name>`. Count Macs by `trajectory.device_id`, not `host`.
A Mac keeps its device ID when it is renamed.

### Marker metrics

| Question | Query |
| --- | --- |
| Force pushes by repository | `sum:trajectory.turn.force_pushes{*} by {repo}.as_count().rollup(sum, 86400)`. It needs the `repo` tag. |
| Permission denials over time | `sum:trajectory.turn.permissions_denied{team:agent-platform}.as_count().rollup(sum, 3600)` |
| 95th percentile of a custom range | `p95:trajectory.session.test_fix_cycle_duration_ms{*}`, from a range distribution of `@range_duration_ms` |
| A custom ratio | `avg:trajectory.session.test_pass_to_failure_ratio{repo:...}` |
| Security events per hour | `sum:trajectory.session.security_risky_shell_secret_exfils{env:prod}.rollup(sum, 3600)`, from a custom `metric_kind: count` measure |

For marker density, divide the daily sum of `trajectory.turn.force_pushes`
by `sum:trajectory.session.completed{*}.as_count()` in a formula widget. Add
up `.completed_count` session totals, such as
`trajectory.session.commits.completed_count`. Gauge rollups repeat final
values, so graph ratio and score gauges with `avg:`. See
[Markers](MARKERS.md) to define your own.

### Counts, units, and percentiles

Read count metrics with `sum:...as_count()`, and use `.additive` counts for
totals. Divide wait milliseconds by 1,000 for seconds. Add up oversight
additive metrics with `.as_count()`. For example, 2,000 ms and 3,000 ms give
5,000 ms, and a correction moves 0.05 USD to 0.055.

Use `p95:` or `avg:` only on current distributions, such as
`trajectory.turn.skill_duration_ms.total`. Turn on Datadog percentiles for
them first.

### Health checks

- Publish failures:
  `trajectory.instrumentation.publish.attempt{outcome:failure}`.
- Group `trajectory.instrumentation.capture.hook_event` and
  `trajectory.instrumentation.capture.hook_latency_ms` by
  `trajectory.client_source`, `outcome`, `error_class`, and `reason`.
- The Claude Code native timing match rate is the success share of
  `component:serve,trajectory.client_source:cc,signal:native_trace` timing.
  `native_tool_unmatched` with `outcome:skipped` means the call was unmatched
  at the end.
- Copilot CLI Stops that name their log never report
  `transcript_path_missing`.
- Read `trajectory.serve.terminal_recovery.oldest_age_seconds` with
  `trajectory.serve.terminal_recovery.pending` to find stalled repairs.

## Query cautions

### Adding values up

- Additive cost points are per turn: $2, $3, and $1 add up to $6.
- Turn gauges and observations are samples. Do not add them up over long
  ranges. Use additive, count, or session `.completed_count` metrics.
- Never add native, provider, completed-session, or non-`v2` points to the
  `v2` total. Points without the `v2` tag are history that Trajectory did not
  check.
- Session totals cover sessions that complete in the range. Turn totals cover
  activity in the range. Never add the two together.
- An exact average cost per completed session needs a session-grain view.
  Turn cost divided by `trajectory.session.completed` only comes close.
- Use formulas only for ratios of queries that do not overlap. A query cannot
  turn on collection or create missing history.
- The 5-minute and 1-hour cache write counters add up to the combined
  counter only while the split was recorded. Never derive the 1-hour value by
  subtraction.
- File-work indicators carry `trajectory.cost_role:indicator` and overlap.
  Query them one lens at a time, and never put them in spend totals.
- Count each backfill sweep once, and compare hosts on one version.
  `retryable_rows` and `failed_rows` describe rows, not failed submissions.

### Turns and IDs

- `trajectory.turn_id` is unique but has gaps. Count turns with
  `trajectory.turn.completed` or distinct IDs, never the highest ID or
  `turn.number`.
- A recovered turn's ID is reserved above the counter, so it is higher than
  the ID of the turn after it.
- Interim sends of a long turn add to session totals but are not turns. Add
  them up by session or time, not by `trajectory.turn_id`.
- `trajectory.turn.duration_ms` is the whole turn's time. Claude Code's
  `claude_code.active_time.total` leaves out foreground and idle time.
- Filter `trajectory.turn.subagents` to
  `trajectory.activity_execution_contract:confirmed_v1`. Points without that
  tag count something else, so never combine them.
- Each `trajectory.turn.agents.peak_running` point already counts every turn
  in flight on its machine, so take its `max` or `avg`, never its sum. For
  example,
  `max:trajectory.turn.agents.peak_running{agent_kind:session} by {trajectory.user_email}.rollup(max, 3600)`
  shows the most sessions each person had at work at once in each hour.
- `permission_mode:unknown` means the source data was missing.

### Time

- Corrections are signed points in the original point's minute. A point can
  be negative, but buckets of a minute or longer show the corrected total.
- Datadog drops points about 3 hours old. PR points therefore carry the time
  Trajectory handled them, and land later. OTLP collectors keep the turn's
  time.
- A run end handled over an hour late goes out at the time Trajectory handled
  it. Counts stay exact, but may land later.
- For one value over a range, use a distribution percentile over that range.
  Never average or add up bucket percentiles.
- For the current session errors, take the latest snapshot and
  `trajectory.snapshot_revision` per session and category. Corrections can
  lower it.
- Upgrades change only future points. Points and tags already in Datadog stay,
  and local rebuilds cannot fix them.

### Missing data

- A missing health series or point means unknown, not healthy or zero. Old
  binaries, disabled metrics, drops, and transport failures all leave gaps.
- Gauges show sampled state, and counters show events. Check the cadence,
  enrollment, policy, and lifecycle before you decide that a metric has no
  data.
- Some metrics have no `gen_ai.request.model`. A `*` template variable drops
  them, so group token widgets by model.
- `repo` groups data, but does not show Git identity. For rankings, filter
  `trajectory.repo_source:git_origin OR trajectory.repo_source:turn_activity`
  to leave out the `project_dir` folder names and `unknown`.
- Average oversight duration or cost over the operations that have that
  measurement. Divide by all operations only when coverage is `complete`.
- With `auto_update` off, serve never runs the update timer. `ring_version`
  stays stale or `unknown`, and `behind` appears only after a timer run.

### Health counts

- Capture gap, publish attempt, incident, and backfill failure counts are
  events and retries. They are not unique users, records, losses, or
  requests.
- Never use `hook_event` as the denominator of `capture.gap`. Report gaps by
  reason, over a denominator at the same level, such as completed turns.
- Incremental turn publishing records attempts only for the outputs it calls.
  A success does not show that Datadog took the data.
- Never combine native forwarder request counts with publish counts
  (`component:publish`) for delivery rates or loss estimates.
- Backfill failure metrics do not show final delivery. An old backlog is not
  a new failure, and zero failures can still be unhealthy.
- `start_source:rescue_hook` means a hook restarted a stopped listener. A
  forced kill shows only as a later rescue start.
- Keep Agent Security module health metrics apart from security findings.

### Resource metrics

- Group the serve disk byte metrics by `os` and `accounting` first. The kinds
  differ by platform, never add up, and are absent where a platform lacks
  them.
- `budget_exceeded` does not say which budget. Compare it with `rss_bytes`
  and the rate metrics. Read and write limits apply per accounting kind.

## Check capture and delivery

`trajectory.instrumentation.capture.recovered` counts turns and sessions that
live capture missed and Trajectory later recovered. A few are normal. When
`kind:turn` rises for one client, follow these steps:

1. Group by `trajectory.client_source` and `reason` to find the client and
   the kind of gap.
2. Group by `host` and `trajectory.version`. One host points to that
   computer's setup. A new version on many hosts points to a release.
3. Run `trajectory doctor` on an affected computer.
4. Install the client's hooks again with
   `trajectory setup clients install --clients <client>`.

Leave `reason:client_unsupported_live` out of alerts. It counts sessions that
the client never lets live capture record.

`trajectory.instrumentation.publish.daily_sent` lets you check that what each
computer sent reached your Datadog organization. Compare it with what your
organization received the day before, through `day_before()`:

```text
sum:trajectory.instrumentation.publish.daily_sent{kind:turns} by {host}.rollup(max, 86400)
day_before(sum:trajectory.turn.completed{*} by {host}.as_count().rollup(sum, 86400))
```

You can also import
[`delivery-audit-dashboard.json`](metrics/delivery-audit-dashboard.json).
A difference above `0` means Datadog accepted points that it did not store.
`trajectory publish status` on the computer shows points that never left it.

## Find managed Macs that stopped reporting

Rollout health finds Macs by `trajectory.device_id` in three groups: Macs
that never ran the install script, Macs that failed it, and Macs that stopped
reporting.

- To find Macs that never ran the script, compare two numbers: the computers
  in the MDM scope, and the device IDs that send
  `trajectory.ops.mdm_script.run.count`.
- The [managed Mac monitor](managed-mac-reporting/monitor.json),
  "Trajectory: managed Mac stopped reporting", alerts for each device ID with
  no `trajectory.ops.binary.heartbeat` for 72 hours.
- The [managed Mac dashboard](managed-mac-reporting/dashboard.json)
  lists the Macs that the Jamf script set up in the last 7 days. Macs that
  sent no heartbeat in that time come first.

[MDM script metrics](metrics/mdm-script-metrics.md) gives the
queries for failed script runs.
