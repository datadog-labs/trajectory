# Markers

A marker is a YAML rule, a point, range, or measure, that finds a behavior in
a captured session. Markers find force pushes, destructive commands, secrets
in commands, interruptions, denials, retry loops, cost spikes, and cost per
commit or PR. Trajectory evaluates them on your computer into SQLite, and can
send them to Datadog as metrics.

`trajectory user-guide markers` and `trajectory user-guide repo-markers`
print short guides. `trajectory user-guide publish` has the full rules for
publish overlays.

## Built-in markers

Trajectory always loads built-in markers:

- Points: `git-commit`, `git-push`, `pr-created`, `test-passed`,
  `test-failed`, `user-frustration`, `user-frustration-profanity`,
  `user-interrupted`, `permission-denied`, `skill-invoked`, `cli-tool-used`,
  `language-activity`, `files-touched`, `compaction`, `markdown-file-written`,
  and `test-file-written`.
- The `test-fix-cycle` range: a fail, edit, and pass sequence. It records
  order only. It does not show that the edit caused the pass, or which checks
  ran.
- Measures such as `frustration-count`, `commit-count`, and counts of
  interruptions and denials.

`trajectory setup` writes a default profile to `~/.trajectory/markers.yaml`.
It adds `force-push`, `destructive-command`, `secret-in-command`,
`high-cost-turn`, CI points, the `ci-feedback-loop` range, and language
measures.

The `test-passed` and `test-failed` regexes cover common runners: `go`,
`cargo`, `pytest`, JavaScript package scripts, `make`, Maven, Gradle,
`dotnet`, RSpec, PHPUnit, Swift, and CTest. Override them for other runners:

```yaml
version: 2
points:
  - name: test-failed
    severity: error
    scope: turn
    match:
      tool: [Bash, Shell, exec_command, run_shell]
      command: '\b(?:mvnw?|gradlew?)\b'
      output: '(?m)\b(?:FAIL|FAILED|[1-9][0-9]* failed)\b'
```

`trajectory patterns markers enable-security [--output PATH] [--force]`
writes optional security markers to `~/.trajectory/markers.d/security.yaml`.
Delete the file to turn them off. They find jailbreak prompts, system prompt
leak requests, and prompt injection in web content. They also find suspicious
`WebFetch` domains, a sensitive read then network use, and shell commands that
could send secrets out.

Points for PRs and permissions:

- A PR interaction is a successful create, checkout, inspect, comment, review,
  edit, merge, or close that names one PR. List and ambiguous commands do not
  count. Shell detection covers `gh pr`, `glab mr`, and `gh api` PR endpoints,
  even behind redirections, `env -u`, or variable assignments.
- A PR counts as created only if the create command's own output proves it. A
  piped create needs output that names one change.
- `trajectory doctor` and the local session report count PRs from the stored
  fact points, including PRs that stay local.
- Each permission denial gives one point, keyed by `tool_use_id`, even when
  both `turn_end.denial_reasons` and `permission_result` report it. A Claude
  Code denial found at Stop carries `source:turn_end.denial_reasons` and no
  `tool` tag. An earlier `permission_result` keeps its tags.
- Your decisions, as Claude Code records them, correct denials. A missed
  rejection counts, and an acceptance removes a wrong one. Config and hook
  decisions change nothing.

## Repository markers

Marker layers load in this order. For each marker name, the later layer wins:

1. built-ins
2. org markers, `~/.trajectory/org/markers.yaml`
3. add-ons, `~/.trajectory/markers.d/*.yaml` in sorted order
4. user markers, `~/.trajectory/markers.yaml`
5. project markers

`TRAJECTORY_ORG_MARKERS_PATH`, `TRAJECTORY_MARKERS_PATH`, and
`TRAJECTORY_PROJECT_MARKERS_PATH` override the org, user, and project paths.
An org marker with `enforced: true` cannot be overridden by add-on, user, or
project layers. Use `enforced` only in org files.

A repository uses `.trajectory/markers.yaml` for marker rules. Its
`publish.trajectory.yaml` picks destinations, adds safe tags, and turns on
marker metrics, as
[Publishing](PUBLISH.md) describes.

Commands you run in a repository read `.trajectory/markers.yaml` from the
nearest parent folder that contains `.git/`. Without one, they skip the
project layer. Captured sessions ignore a repository's marker file, because
the capture service runs outside any repository. Setting
`TRAJECTORY_PROJECT_MARKERS_PATH` applies one file to every captured session.
Prefer org or user markers for captured sessions.

To set up a repository:

1. On each developer's computer, run `trajectory setup` and
   `trajectory publish validate`.
2. Commit `.trajectory/markers.yaml` and `publish.trajectory.yaml`.
3. In the repository, check with `trajectory patterns markers validate`,
   `trajectory patterns markers list`, `trajectory publish validate`, and
   `trajectory publish status`.

## Custom markers

Marker files use `version: 2` with `tags`, `points`, `ranges`, and `measures`.
`version: 1` files still load but cannot use `scope:` or `metric:`. The YAML
parses strictly, so an unknown field fails validation instead of changing
behavior. Messages that say "arc" mean a range.

```yaml
version: 2
points:
  - name: force-push
    description: Agent force-pushed to a remote
    severity: warn
    confidence: high
    emit: metric
    scope: session
    match:
      tool: Bash
      command: '(?i)^git\s+push\b.*--force'
ranges:
  - name: test-fix-cycle
    sequence:
      - point: test-failed
      - tool: [Edit, Write]
      - point: test-passed
measures:
  - name: agent-force-pushes
    scope: session
    count:
      point: force-push
```

### Points

A point is one moment. It fires when a prompt, response, tool call, or mix in
one turn matches. Its fields are `name`, `description`, `severity`,
`confidence`, `emit`, `disabled`, `enforced`, `builtin`, `match` (required
unless disabled), `extract`, `extract_fields`, and `compute`.

- `severity`: `info`, `warn`, `error`, or `success`.
- `confidence`: `high`, `medium`, or `low`.
- `emit`: `metric` (default), `log`, or `both`. Prefer `metric` for numeric
  signals, and use `both` only for valuable debugging signals.
- `scope` (version 2): `turn`, `session`, `task`, `commit`, or `pr`. It sets
  the grain, the metric name prefix, and `trajectory.trace_type`. Without it,
  the loader picks from the marker's shape, such as `session` for measures and
  `commit` for commit distributions.

`match` fields:

- Session: `client`, `min_turns`, `session_cost_above` and `turn_cost_above`
  (estimated USD), `session_duration_above` (ms), and `signal_count_above`
  (count of earlier points).
- Tool: `tool`, a name or list. Shells are `Bash`, `Shell`, `run_shell`,
  `exec_command`, and `terminal`. Also `file` (glob), `success`, `denied`,
  and `duration_above` (ms).
- Regex: `prompt` and `not_prompt`, with `prompt_caps` to count all-caps
  words. `response` and `not_response`. `input` and `not_input`, on raw JSON.
  `output` and `not_output`, which fall back to the error. `command`, the
  first shell line.
- `agent_id: ""` matches only the root agent, and `"*"` any subagent. Other
  values match exactly.
- `fields` (all must match), `allowlist` (one must match), and `denylist` (any
  excludes) hold predicates. A predicate has a `path` and `equals`, `regex`,
  `glob`, `in`, `not_in`, or `exists`. Paths are `input.*`, `output.*`,
  `error.*`, `command`, `file`, `files`, `tool`, `agent_id`, `denied`,
  `provenance.*`, and `source_scope`. Dots, indexes, and `*` navigate.
- `within_turn` needs related calls in the same turn. `after`,
  `min_occurrences`, `consecutive`, `group_by`, and `transitions` refine it.

```yaml
match:
  tool: Bash
  fields:
    - path: command
      regex: '(?i)\baws\s+s3\b'
  denylist:
    - path: command
      regex: '--dryrun\b'
  allowlist:
    - path: source_scope
      in: [client_hook, tool_name_convention]
```

`extract` stores a regex's first group, or the whole match.
`extract_fields` entries take `name`, `path`, `regex`, and `normalizer`. Both
fill the point's `Detail` map. Raw shell commands cannot be dimensions. Group a
`path: command` detail with `regex` or a normalizer such as `cli_tool`.

### Facts

`match: { fact: KIND }` fires once for each PR or commit fact. It gives the
same result in live capture, import, replay, and `markereval`. `fact` needs
`version: 2` and works only alone in a point's top-level `match`. `extract`
still reads the tool call behind the fact.

- `commit`: one per hash.
- `push`: one per ref and new object ID.
- `force-push`: a push that uses `-f`, `--force`, `--force-with-lease`,
  `--mirror`, or a `+` refspec.
- `pr-created`: one per proven create.
- `pr-context`: one per PR branch binding, with `end_turn_id` and a
  `creation_window`.
- `pr-interaction`: one per turn, PR, and kind.

Fact points carry `fact_kind`, `fact_rule`, `fact_tier`, and `fact_source`.
PR facts add `change_identity` and `change_url`.

```yaml
version: 2
points:
  - name: pr-shipped
    match:
      fact: pr-created
measures:
  - name: prs-shipped
    scope: session
    count:
      point: pr-shipped
```

### Splitting cost with `allocate`

`allocate` splits each covered turn across groups by weight, and a turn's shares
add up to one. It needs `version: 2`. `name` labels the allocation, and
`pr-work` is reserved. `group_by` groups by a detail.

- `over` is `turn` (default), `range` (needs `fact: pr-context`), or
  `turns_since_previous_match`.
- `classes` take a `reason`, a `weight` from 1 to 1000, a `rank` from 0 to
  1000, and `when`. The higher rank names a tie. `owning` and `needs_owner`
  claim turns and need `group_by`.
- `compute` with `sum` and `allocate` adds each turn's share, such as spend
  since the last deploy. If values are missing, it sets `<field>_partial` or
  `<field>_unpriced`, never 0. It needs `version: 2`, and cannot combine with
  `over`, `previous_point`, or `inclusive`.

```yaml
version: 2
points:
  - name: deploy
    match:
      tool: Bash
      command: '^make\s+deploy\b'
    allocate:
      name: deploy-cost
      over: turns_since_previous_match
      classes:
        - reason: deploy
          weight: 1
    compute:
      cost_usd:
        sum: turn.estimated_cost_usd
        allocate: deploy-cost
```

### Ranges

- A sequence range has ordered steps.
- A bracket range runs from `starts_when` to `ends_when`.
- A correlation range is point `a` then point `b` within `within_turns` or
  `within_minutes`. `capture` copies their details.

Ranges have no `max_turns`.

### Measures

- `count` counts a point or range, with an optional `group_by`.
- `ratio` divides a numerator by a point or by `session_turns`.
- `weighted_count` uses `tool_weights`.
- `distribution` sets `signal`, a `value` (`@detail`, a constant, or
  `@range_duration_ms`), and an optional `outcome`. It takes one sample each
  time a point fires or a range completes.

`metric_kind` is `gauge` (default) for current values, ratios, and scores,
`count` for changes summed across time buckets, or `distribution` for raw
samples and percentiles.

### Counted points

Ingest writes one `language-activity` point per turn and language. Its `count`
detail holds the occurrences, which measures add. A `count` you extract on your
own point changes nothing.

### Dimensions

`dimensions` take `name`, `detail_key`, `max_length`, and `max_values`. Also
set `cardinality_limit`, `max_dimensions`, and `max_dimension_value_length`.
The older `tag_keys` tags points only. Dimensions add tags, but cannot replace
the standard session, user, client, model, host, project, turn, or scope tags.

```yaml
measures:
  - name: commit-cost-usd
    scope: commit
    metric: trajectory.custom.commit_cost.usd
    metric_kind: distribution
    distribution:
      signal: git-commit
      value: '@attributed_cost_usd'
      dimensions:
        - name: branch
          detail_key: branch
          max_length: 80
          max_values: 100
      cardinality_limit: 100
```

Write markers in small steps:

1. Use structured predicates, and extract only the values you need.
2. Keep regexes specific with `(?i)` and anchored commands. Deny safe cases
   such as `--dry-run` or fixtures. Allow only trusted `source_scope` or
   `provenance.*` paths.
3. Add measures once the point is stable.
4. Re-evaluate a small window, then a larger one.
5. Validate publishing.

## Marker metrics

Marker metrics need `markers.enabled: true` and `markers.metrics: true` on a
Datadog destination. `enabled` alone turns on metrics too. Then run
`trajectory publish validate`. Custom metrics go only to the destinations you
name with marker metrics on, not to every active destination.

```yaml
destinations:
  - name: _config_datadog
    markers:
      enabled: true
      metrics: true
```

Values publish as `trajectory.<scope>.<name>`, with hyphens and other
disallowed characters turned into underscores. For example,
`trajectory.session.pushes.completed_count`. `metric:` sets any
`trajectory.*` or `gen_ai.*` name exactly. Only fixed built-in session counts
publish `.completed_count`. Other session measures, custom ones included, use
the derived name and their `metric_kind`. Do not reuse a built-in
distribution name. The exception is a name in the `catalog` field of
`trajectory publish metrics canary --include-diagnostics --json`.

A `group_by` value becomes a tag on the declared metric, never part of its
name. Without that declaration it is not published. Ranges publish as marker
context. To graph one, add a `count` measure over it or a distribution of
`@range_duration_ms`.

Datadog destinations get marker series over agentless OTLP, with each
marker's `metric_kind`. Older native transport settings are ignored. Series
carry the top-level and destination `tags:`, `session_id`, `ml_app` if set,
and the repository tags `git_remote_host`, `owner`, and `repo`. Turn series
leave out `git_remote_host`. Built-in PR
metrics may set `owner` and `repo` to the PR's repository. Other marker metrics
keep the session's.

Marker details stay on your computer. They become tags only through
`dimensions` or `tag_keys`. Never use prompts, full paths, query URLs, user
IDs, emails, secrets, SHAs, shell commands, or security details as
dimensions. Check in Metrics Explorer that a tag exists on the series before
you use it in a template variable, dashboard, or monitor.

Turn metrics send when the turn is saved, and later points and session rollups
at session end. Both share the stored points. A completed session's
`.completed_count` is final. Use `*.additive` metrics for long sums. For
absence monitors, use `trajectory.session.completed`, which every completed
session sends.

Marker event logs (`markers.logs: true`) follow the destination's trace
level. `event_logs` queries match whole events. Level and content rules change
only the fields sent, never metrics. Use `standard` to get details.

Trajectory creates no monitors and ships no marker dashboard. Build them from
the [Metrics Reference](METRICS.md). For security markers, define
count measures, then add a 24-hour query value, a toplist by repository or
team, and a timeseries for each metric.

- `trajectory patterns markers export [--config PATH]` prints marker
  definitions as Datadog span metric rule JSON.
- `trajectory patterns markers reevaluate [--db PATH] [--session ID] [--since YYYY-MM-DD] [--dry-run]`
  reruns markers on past sessions. Run it before you republish.

## Troubleshooting

- `trajectory patterns markers list` shows the resolved catalog, built-ins
  included. `trajectory patterns markers validate [--config PATH]` checks
  every layer and reports the file, schema path, and message.
- `trajectory patterns markers explain [--config PATH] <name>` shows how one
  marker matches events.
- `trajectory doctor markers` checks stored results with `--session ID`,
  `--corpus`, or `--self-test`, and an optional `--db PATH`.
- `trajectory patterns markers canary [--source-home PATH] [--home PATH] [--keep-home]`
  runs a synthetic session in a copy of `TRAJECTORY_HOME` on a free port. It
  never touches plugin caches or installed processes. It checks the results.
  With a Datadog destination that has marker metrics on, it publishes and prints
  Metrics Explorer queries. A local `PASS` does not show that data reached
  Datadog.

Common problems:

- **A marker never fires.** Check the tool name, and whether the data is in
  `input`, `output`, `error`, or `command`. Try simpler fields.
- **A shell marker misses commands.** `command` matches only the first line.
  Use `input` for the full input.
- **A file marker misses paths.** The tool may use its own key. Match that
  path with `fields`.
- **A range never fires.** Check that each point fires alone. Then check the
  order, the bracket end conditions, or the correlation window.
- **A local override is ignored.** Look for an enforced org marker with the
  same name, then check the layer order.
- **A dimension is missing.** Check that the detail exists, that `detail_key`
  matches it exactly, and that no cardinality or length limit dropped it.
- **A metric is missing.** Check that values are nonzero, marker publishing is
  on, `trajectory publish validate` passes, and you re-evaluated sessions
  after changing config.
