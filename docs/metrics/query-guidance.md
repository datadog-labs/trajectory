## Query Guidance

### Percentiles

Use `p95:` or `avg:` only on current distribution metrics, such as
`trajectory.turn.duration_ms.total`. Before you rely on a percentile query,
turn on percentiles for that distribution in Datadog.

### Cost and usage

To query live cost and usage, use the v2 cost contract:

```text
sum:trajectory.turn.cost.usd.additive{trajectory.cost_contract:v2,trajectory.cost_role:attribution,...}.as_count()
```

The `trajectory.cost_contract:v2` filter keeps only series that meet the
current cost contract. It leaves out older series with known errors.
Trajectory does not rewrite those older series.

Trajectory sends corrections and backfill to the `.additive` count series.
Backfill sends points through the live publish engine with their original
timestamps. Datadog Historical Metrics Ingestion cannot change distribution
samples. Never add distribution samples into totals. To replay points older
than one hour, turn on Historical Metrics Ingestion first.

A PR-work correction keeps the ID and timestamp of its turn. For Datadog
destinations, Trajectory sends a signed correction only within one hour after
the source turn completes. Older corrections stay queued with the reason
`unsupported_pr_source_history`, so Datadog keeps the value it already has.
Historical Metrics Ingestion replaces cells, so it cannot carry these signed
changes. Other OTLP collectors accept corrections of any age.

Example: three turns cost `$2`, `$3`, and `$1`.

- The additive series receives three deltas. `sum:...as_count()` returns `$6`.
- The optional `trajectory.turn.cost.usd.total` distribution receives the same
  three samples. Use it only for percentiles.
- The cumulative session values are `[$2, $5, $6]`. They belong to
  `trajectory.session.cost.usd.accumulated`. Never sum them across time.

### Claude agent roles

For Claude spend split by agent role, filter on `agent_role`:

- `agent_role:parent` gives spend by the parent agent only.
- `agent_role:child` gives the total spend of delegated child agents.

The sum of both roles is the observed agent spend on turns that have complete
child cost data. If any child cost is missing, Trajectory sends only a parent
point tagged `agent_role:parent`. It does not send a partial child subtotal.

### Session counts and active users

For count-like session markers, use the `.completed_count` metrics, such as
`trajectory.session.commits.completed_count` and
`trajectory.session.force_pushes.completed_count`.

Do not use `trajectory.session.evaluated` for active users or recent activity.
It is a heartbeat from marker evaluation, meant for absence monitors. It can
have gaps for a user who does not have marker evaluation or marker metrics
turned on. Use these queries instead:

- To count active users, use
  `max:trajectory.session.last_seen.unix{...} by {trajectory.user}` with
  `count_nonzero(query1)`.
- To count completed sessions, use
  `sum:trajectory.session.completed{...}.as_count()`.
- To sort a table by recent activity, use `trajectory.session.last_seen.unix`.

### Model tag

Some metrics do not carry `gen_ai.request.model`. A dashboard template
variable with a default of `*` becomes a filter that requires the model tag.
That filter drops valid metrics that have no model tag. Group token widgets on
`gen_ai.usage.*` by model instead. Add a model filter only on widgets that need
model-tagged data.

### Repository tags

Use `repo` to group data. It does not confirm the Git identity of the
repository.

To find the repository, Trajectory first runs Git by its absolute path, with a
two-second timeout. Git then applies global includes and `url.*.insteadOf`
rewrites in the usual way. If Git is missing or refuses the directory,
Trajectory reads the local `.git` metadata itself, up to a size limit. This
works without Git on `PATH`.

Trajectory selects the remote in this order:

1. `origin`
2. the upstream remote of the current branch
3. the only remote, if there is exactly one

This works for normal repositories, nested working directories, gitdir files,
linked worktrees, submodules, and bare repositories.

Trust for a project publish config is a separate check that runs Git. If Git's
ownership or safe-directory check fails, Trajectory does not trust the
project. Reading the repository from `.git` metadata never turns on a project
publish config.

Trajectory normalizes the host for PR and merge request identity by provider.
Public GitHub subdomains, such as transport aliases under `*.github.com`, are
sent as `change_host:github.com`. GitHub Enterprise and other forge hosts keep
their own names. Group public GitHub PRs on `github.com`, not on
account-specific transport aliases.

Use `trajectory.repo_source` to filter by where the repository tags came from:

| Value | Meaning | Use |
|---|---|---|
| `git_origin` | Trajectory parsed the `origin` remote. | Filter on it for dashboards that need parsed remotes only. |
| `git_remote` | Trajectory used the upstream remote of the current branch, or the only remote, which is not `origin`. | |
| `git_origin_unparsed` | Trajectory found the host and path of `origin`, but could not split the path into owner and repo. | |
| `project_dir` | Trajectory fell back to the project directory name. | Check fallback coverage. |
| `configured` | The tags came from custom config tags. | Find custom config tags. |
| `unknown` | No usable project directory or remote was available. | Find sessions with no repository. |

Hosts that run an older binary do not send `trajectory.repo_source`. While
your hosts upgrade, set the default of any `repo_source` template variable to
`*`. Otherwise, the filter can hide valid recent data from older hosts. Add a
separate widget to watch `trajectory.repo_source` coverage. Add `git_origin`
filters only to widgets that need the Git remote identity.

### Repository resolution metric

Trajectory sends `trajectory.repo.resolution.total` once for each completed
session. It is the only metric with the `trajectory.repo_resolution` tag.
Trajectory never copies that tag onto other base metrics.

| Outcome | Values |
|---|---|
| Success | `metadata_origin`, `metadata_upstream`, `metadata_sole_remote`, `command_origin`, `command_upstream`, `command_sole_remote` |
| No in-memory attribution for the session | `cache_fallback` |
| Failure | `project_dir_missing`, `project_dir_invalid`, `metadata_missing`, `metadata_unreadable`, `remote_missing`, `remote_ambiguous`, `remote_unparseable`, `command_unavailable` |

The metric never contains paths, remote names, URLs, credentials, or raw
errors.

A repository or remote can appear after the session starts. In that case,
Trajectory tries again at session end and can improve the final session
metrics. It does not rewrite turn points that it already sent or older
Datadog series. Historical backfill does not recompute repository or owner
tags, so a corrected tag cannot create duplicate historical series.

### Destination and health gauges

`trajectory.publish.active_destinations` is a gauge for each session. To ask
how many destinations were active, use `max`. An average can give a fraction
of a destination, which has no meaning.

Query `trajectory.ops.required_destination.health` and
`trajectory.ops.org_sync.success_age_seconds` the same way:

- Use an hourly `max` rollup over at least four hours.
- Never use `.as_count()`.
- Group `trajectory.ops.required_destination.health` by `destination` and
  `destination_state`, so the reason shows next to the value.

On both gauges, `-1` means that Trajectory could not confirm the state. A
threshold that reads `-1` as a low value gives wrong results in both
directions. Use these rules:

- Alert on `== 0` for a confirmed destination gap.
- Alert on `== -1` in a separate monitor for a host that never synced, so it
  does not hide below a staleness threshold.
- Exclude `verified:false` from any org-sync freshness alert. Its age is not
  the age of a successful sync.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
