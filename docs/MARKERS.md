# Marker Usage Guide

Use this guide to write markers and to send marker metrics to Datadog. A
marker is a YAML rule that finds a named behavior in a captured agent session,
such as a force-push or a failed test. Trajectory evaluates markers on the
local machine and stores the results in its SQLite database. It can also send
them to Datadog as marker metrics and structured marker context.

Trajectory no longer sends the former LLM Obs evaluation output. It still
accepts the `markers.evaluations` key for compatibility, but ignores it.

A short version of this guide is built into the binary:

```bash
trajectory user-guide markers
```

To keep a marker file and a Datadog marker metric overlay in a repo, start
with [REPO-MARKERS.md](REPO-MARKERS.md) or run:

```bash
trajectory user-guide repo-markers
```

Markers can answer questions such as these:

- Did the agent force-push, run a destructive command, or put a secret in a
  shell command?
- How often did a user correct the agent, interrupt it, or deny a tool call?
- Which sessions produced commits, PRs, or test fixes?
- How much estimated cost belongs to each commit, PR, or branch?

## Where marker configs live

Trajectory loads marker configs in layers, in this order:

1. **Built-ins** embedded in the binary. To see them, run
   `trajectory patterns markers list`.
2. **Org markers** from `TRAJECTORY_ORG_MARKERS_PATH`, or from
   `~/.trajectory/org/markers.yaml`.
3. **User add-ons** from `~/.trajectory/markers.d/*.yaml`, loaded in sorted
   filename order.
4. **User markers** from `TRAJECTORY_MARKERS_PATH`, or from
   `~/.trajectory/markers.yaml`.
5. **Project markers** from `TRAJECTORY_PROJECT_MARKERS_PATH`. Without that
   variable, Trajectory reads `.trajectory/markers.yaml` in the nearest parent
   directory that contains `.git/`. If it finds no project root, it skips this
   layer.

If two layers define a marker with the same name, the later layer wins. The
exception is an org marker with `enforced: true`. User, add-on, and project
layers cannot override it.

`trajectory setup` writes the Datadog default marker profile to
`~/.trajectory/markers.yaml`. This profile adds to the embedded built-ins. It
does not replace them.

For a repo setup, use two separate files. `.trajectory/markers.yaml` defines
the marker rules. `publish.trajectory.yaml` selects destinations and turns on
marker metrics. See [REPO-MARKERS.md](REPO-MARKERS.md).

## Built-ins, defaults, and the security add-on

Trajectory always loads built-in markers for common agent outcomes and points
of friction:

- Points such as `user-frustration`, `user-frustration-profanity`,
  `git-commit`, `pr-created`, `git-push`, `test-passed`, `test-failed`,
  `cli-tool-used`, `skill-invoked`, `user-interrupted`, `permission-denied`,
  `language-activity`, `files-touched`, `markdown-file-written`,
  `test-file-written`, and `compaction`.
- The `test-fix-cycle` range across several turns.
- Measures such as `frustration-count`, `commit-count`, `task-count`, and
  counts of interruptions and permission denials.
- The `git-commit` point records the cost and turns since the previous commit.
  It stores them in its `attributed_cost_usd` and `attributed_turns` details.

The default profile that setup writes adds signals for Datadog users. Examples
are `force-push`, `destructive-command`, `secret-in-command`, and
`high-cost-turn`. It also adds CI and infrastructure points, the
`ci-feedback-loop` range, and language measures.

The command regexes in the built-in `test-passed` and `test-failed` points are
examples. They do not cover every test runner. They match common commands that
clearly run tests:

- `go test`, `cargo test`, and `pytest`
- test scripts in JavaScript package managers
- `make test` targets and shell scripts under `tests/`
- native runners such as Maven, Gradle, `dotnet test`, RSpec, PHPUnit,
  Composer, Swift, and CTest

If your team uses other commands, override those points in an org, user, or
project marker config:

```yaml
version: 2

points:
  - name: test-failed
    severity: error
    confidence: high
    emit: metric
    scope: turn
    match:
      tool: [Bash, Shell, exec_command, run_shell]
      command: '\b(?:mvnw?|gradlew?|bundle\s+exec\s+rspec|composer\s+test)\b'
      output: '(?m)\b(?:FAIL|FAILED|Error:|AssertionError|[1-9][0-9]* failed)\b'

  - name: test-passed
    severity: success
    confidence: high
    emit: metric
    scope: turn
    match:
      tool: [Bash, Shell, exec_command, run_shell]
      command: '\b(?:mvnw?|gradlew?|bundle\s+exec\s+rspec|composer\s+test)\b'
      success: true
      output: '(?i)\b(?:BUILD SUCCESS|passed|0 failed|OK)\b'
      not_output: '(?m)\b(?:FAIL|FAILED|Error:|AssertionError|[1-9][0-9]* failed)\b'
```

To install the optional security catalog, run:

```bash
trajectory patterns markers enable-security
```

By default, this command writes `~/.trajectory/markers.d/security.yaml`. The
file has security points for:

- prompts that look like jailbreak attempts
- requests to leak the system prompt
- prompt injection in web content
- suspicious `WebFetch` domains
- reads of sensitive files followed by network activity
- risky shell patterns that can send secrets out

To write the file to another path, use `--output PATH`. To overwrite an
existing file, use `--force`.

The built-in PR interaction markers count two kinds of actions:

- Successful shell commands that create, check out, inspect, review, merge, or
  close a PR, and that name the PR.
- Provider tools for PRs or merge requests that are on an allowlist.

Trajectory reads provider tools as follows:

- If the input of a provider tool has a host, owner, repository, and number,
  Trajectory uses those fields. It ignores other URLs in the output.
- A create tool can take one normalized URL from its result.
- A provider tool without a separate success field still counts if it was not
  denied and has no recorded error.
- Trajectory leaves out operations that failed, that name no PR, that apply to
  a whole collection, or that are ambiguous.

A shell command counts when it calls `gh pr`, `glab mr`, or `gh api` on a pull
request endpoint or a pull request GraphQL operation:

- Redirections such as `2>&1` do not hide the command. Neither do `env -u NAME`
  or a leading assignment such as `GH_TOKEN=$(cat token)`.
- If a substitution itself contains a PR or Git command, the command does not
  count.
- If later commands act on the same pull request, the commands count once.
- A pipeline or a later command can hide the exit status, as in
  `gh pr create --fill | tail -3`. The creation then counts only if the output
  names exactly one change and does not say that the change already exists.

## YAML file shape

Marker config files use `version: 2`. They can define `tags`, `points`,
`ranges`, and `measures`. Trajectory still loads files with `version: 1`. Those
files cannot use the `scope:` and `metric:` fields, which need version 2.

```yaml
# trajectory-marker-doc-snippet: config
version: 2

points:
  - name: force-push
    description: Agent force-pushed to a remote
    severity: warn        # info | warn | error | success
    confidence: high      # high | medium | low
    emit: metric          # metric | log | both; default is metric
    scope: session        # turn | session | task | commit | pr (v2)
    match:
      tool: Bash          # scalar or list
      command: '(?i)^git\s+push\b.*--force'
      not_input: '--force-with-lease'

ranges:
  - name: test-fix-cycle
    severity: info
    sequence:
      - point: test-failed
      - tool: [Edit, Write]
      - point: test-passed

measures:
  - name: force-pushes
    scope: session        # v2: drives the published metric name
    count:
      point: force-push
```

The code and some validation messages still use the old word "arc" for a
range. Write new YAML under the top-level `ranges:` key.

### Schema v2 additions

`version: 2` adds three optional fields to points, ranges, and measures:

- `scope: turn | session | task | commit | pr` sets the natural grain of the
  value. It sets the `<scope>` part of the metric name and the Datadog
  `trajectory.trace_type` tag.
- If you omit `scope`, the loader picks a default from the marker shape. Most
  measures get `session`, `git-commit` distributions get `commit`, and task
  outcome measures get `task`.
- `metric: <name>` overrides the Datadog metric name. The publisher uses the
  string exactly as written.
- If you omit `metric`, the publisher derives `trajectory.<scope>.<concept>`
  from the marker name. It changes hyphens to underscores.
- `metric_kind: gauge | count | distribution` sets the metric type. If you omit
  it, Trajectory uses `gauge` for backward compatibility. Use `distribution`
  for raw numeric samples that need percentile queries.

Default derivation, the usual case:

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: force-pushes        # measure name -> concept
    scope: session            # scope -> prefix
    count:
      point: force-push
# Publishes the dashboard-safe completed-session count
# trajectory.session.force_pushes.completed_count.
```

Override, for a stable name that differs from the marker name:

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: commit-cost-usd
    scope: commit
    metric: trajectory.custom.commit_cost.usd # override; publisher uses this verbatim
    metric_kind: distribution
    distribution:
      signal: git-commit
      value: '@attributed_cost_usd'
```

Use `metric:` rarely. Prefer to name the marker so that the default derivation
gives the metric name you want.

## Points

A point is an observation at one moment in a session. It fires when a prompt, a
response, a tool call, or a mix of these in the same turn matches.

Point fields:

```yaml
# trajectory-marker-doc-snippet: fragment
points:
  - name: my-point                 # required
    description: Human-readable text
    severity: info                 # optional: info, warn, error, success
    confidence: high               # optional: high, medium, low
    emit: metric                   # optional: metric, log, both
    disabled: false
    enforced: false                # mainly useful in org configs
    builtin: false                 # set by built-in catalog, not usually authored
    match: { tool: Bash }          # required unless disabled
    extract: { key: 'regex' }      # regex extraction from matched content
    extract_fields: []             # structured extraction from tool fields
    compute: { attributed_cost_usd: { sum: turn.estimated_cost_usd, over: turns_since_previous_match } } # optional computed numeric details
```

### Match fields

Tool call match fields:

| Field | Meaning |
| --- | --- |
| `tool` | Exact tool name, or a list of names. Shell tools include `Bash`, `Shell`, `run_shell`, `exec_command`, and `terminal`. |
| `input` / `not_input` | Regex on the raw tool input JSON. |
| `output` / `not_output` | Regex on the tool output text. If the output is empty, it uses the error text. |
| `command` | Regex on the first shell command line taken from the shell tool input. |
| `file` | Glob on paths taken from common file and path keys in the tool input. |
| `success` | Boolean success value. |
| `denied` | Boolean permission-denied value. |
| `duration_above` | Tool call duration threshold in milliseconds. |
| `turn_cost_above` | Threshold for the estimated turn cost in USD. |
| `agent_id` | `""` means the root agent only. `"*"` means any subagent. Any other value must match exactly. |
| `fields` | Structured field predicates. All of them must match. |
| `allowlist` | Structured predicates. If the list is present, at least one must match. |
| `denylist` | Structured predicates. Any match excludes the tool call. |

Prompt, response, and session fields:

| Field | Meaning |
| --- | --- |
| `prompt` / `not_prompt` | Regex on a user prompt. |
| `prompt_caps` | Minimum number of all-caps words in a prompt. |
| `response` / `not_response` | Regex on the assistant response text. |
| `client` | Filter on the session client name. |
| `session_cost_above` | Threshold for the estimated session cost in USD. |
| `session_duration_above` | Session duration threshold in milliseconds. |
| `min_turns` | Minimum number of turns in the session. |
| `signal_count_above` | Session count of a point or signal that was already evaluated. |

### PR and commit facts

`match: { fact: KIND }` makes a point fire once for each PR or commit fact
of that kind. One deriver decides these facts for every entry point: live
capture, history import, historical replay, and `markereval`. It reads the
session's turns and tool calls and, when Trajectory captured them, the
Git facts the hooks recorded while the agent ran. A PR counts as created
only when the create's own output proves it.

| Fact | One point per |
| --- | --- |
| `pr-created` | PR the session created, proven by the create's own output |
| `pr-interaction` | turn, PR, and kind of interaction (create, inspect, push join, prompt mention, and others) |
| `pr-context` | PR branch binding, at the turn it started; `end_turn_id` is the turn it ended, such as the turn before the worktree switched to another branch. A create also gets a `creation_window` range over the turns of work that led to it. |
| `commit` | commit hash, or tool call when no hash was visible |
| `push` | pushed ref and new object ID, or tool call when no reflog entry names it |
| `force-push` | `push` fact whose call has a forcing `git push` segment: `-f`, `--force`, `--force-with-lease`, `--mirror`, or a `+` refspec |

`force-push` is a view of `push`, not another fact: its points carry
`fact_kind: push`. The shell parser reads each command segment, so
`git push origin main && rm -f x` is not a force push.

`fact` requires `version: 2` and cannot be combined with any other match
field. It works only in a point's top-level `match`, not in `within_turn.after`
or a range's `starts_when` or `ends_when`. `extract` and `extract_fields` still
read the tool call behind the fact. Each point's detail holds `fact_kind`,
`fact_rule`, `fact_tier`, `fact_source`, and, for PR facts, `change_identity`
and `change_url`.

Facts from an incognito or ineligible session are stored with `local_only`
set. Tags, ranges, and measures ignore the PR fact points among them, so no
metric counts those PRs under any name. Commit and push facts are still
counted, with the usual incognito redaction. `trajectory doctor` and the local
session report count the PRs from the stored points.

```yaml
# trajectory-marker-doc-snippet: config
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

The built-in `pr-created`, `git-commit`, `git-push`, `force-push`,
`pr-interaction`, and `pr-context` points use these facts.

### Structured fields, allowlists, denylists, provenance, and source scope

A regex on raw JSON can match too much. If it does, use `fields`, `allowlist`,
and `denylist`. A predicate has a `path` and at least one operator:

```yaml
# trajectory-marker-doc-snippet: match
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

The predicate operators are `equals`, `regex`, `glob`, `in`, `not_in`, and
`exists`.

Structured paths can start with:

- `input.*`, `output.*`, or `error.*` for the parsed tool input, output, or
  error JSON
- `command`, `file`, or `files` for normalized shell and file views
- `tool`, `agent_id`, or `denied` for normalized tool metadata
- `provenance.*` for provenance metadata merged from captured events
- `source_scope` as a short path to the provenance source-scope values

Nested paths use dot notation and array indexes. `*` expands an array.
Examples are `input.url`, `input.files.*`, and `provenance.mcp.source_scope`.

## Extraction and point details

Each marker finding has a `Detail` map. Use details for troubleshooting.
Measures and metric dimensions can also use them.

Regex extraction:

```yaml
# trajectory-marker-doc-snippet: fragment
points:
  - name: git-branch
    match:
      tool: Bash
      command: '^git\s+checkout\s+'
    extract:
      branch: '^git\s+checkout\s+([^\s]+)'
```

If the regex has a capture group, Trajectory stores the first group.
Otherwise, it stores the full match.

Structured `extract_fields` entries support `name`, `path`, `regex`, and
`normalizer`. Trajectory parses marker YAML strictly and rejects unknown
fields. So a typo cannot change marker behavior without an error.

Structured extraction:

```yaml
# trajectory-marker-doc-snippet: fragment
points:
  - name: suspicious-url
    match:
      tool: WebFetch
      fields:
        - path: input.url
          regex: '^https?://'
    extract_fields:
      - name: domain
        path: input.url
        regex: '^https?://([^/]+)'
```

Keep extracted details free of sensitive data, and keep their number of values
small. Trajectory stores details on the local machine. If dimensions or
`tag_keys` refer to a detail, Trajectory can send it as a metric tag.

A count or distribution measure can use `group_by` on a detail taken from
`path: command`. The extraction must then apply `regex` or a supported
`normalizer` first. Raw shell command strings cannot be metric dimensions. For
toplists of command-line tools, use `normalizer: cli_tool`. Publish also drops
`trajectory.turn.cli_tool_count` rows whose `tool` value is not a normalized
CLI label that Trajectory knows.

## Splitting turns with `allocate`

A point with an `allocate` block takes part in a named allocation.
Trajectory splits each turn that the allocation's points cover across the
groups that have a point on that turn. Each group gets a share in proportion
to its weight. A turn's shares add up to exactly one, because the last group
takes what the others leave. A turn that no point covers is not split.

A `compute` field with `sum` and `allocate` adds up the point's share of
each turn its group is given:

```yaml
# trajectory-marker-doc-snippet: config
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

Here `cost_usd` is the spend since the previous deploy. Two deploys in one
turn share that spend evenly.

`allocate` fields:

| Field | Meaning |
| --- | --- |
| `name` | The allocation. Points with the same name share each turn. `pr-work` belongs to the built-in PR points, because published PR spend reads only those. |
| `group_by` | A detail key. Points with the same value form one group. Without it, each firing is its own group. |
| `over` | The turns a firing covers. `turn`, the default, is its own turn. `range` runs from a `pr-context` fact's turn to its `end_turn_id`, or to the last turn while the context is open; it needs `match: { fact: pr-context }`. `turns_since_previous_match` is every turn after the point's previous firing in an earlier turn, up to and including this one. |
| `classes` | The weights. A firing takes the first class whose `when` matches its detail. A firing that no class matches is left out. |

Each class has a `reason`, a `weight` from 1 to 1000, an optional `rank`
from 0 to 1000, and an optional `when`. `when` maps a detail key to a value
or a list of values. Every key must match. Two points can give a group the
same weight on a turn. Then the one with the higher `rank` names the reason,
and a range comes before a one-turn point. `rank` never changes a share. A group's weight on a turn is the sum of the different reasons
its points give that turn. A reason that applies twice counts once, at the
highest weight its classes give it.

A computed `sum` leaves out a turn that has no value, such as a turn with no
price. If some turns have no value, the field holds the sum of the others and
`<field>_partial` is `true`. If no turn has a value, Trajectory writes no
value and sets `<field>_unpriced` to `true`. It never writes 0 for a missing
value. `allocate` in `compute` cannot be combined with `over`,
`previous_point`, or `inclusive`, and both fields need `version: 2`.

The built-in points use two allocations:

- `git-commit` uses `commit-cost`. Its `attributed_cost_usd` is the spend
  since the previous commit, and commits in one turn split it evenly.
- `pr-created`, `pr-interaction`, and `pr-context` use `pr-work`, grouped by
  `change_identity`. It splits each turn across the pull requests with
  evidence on that turn. An explicit PR action, such as creating, checking
  out, viewing, or merging the PR, weighs 8. The PR's branch being checked
  out, pushed, or linked weighs 4. The work that led to a PR, before the
  create, weighs 2. A PR URL in the prompt weighs 1.

PR points from an incognito or ineligible session never take part in an
allocation.

## Same-turn correlation with `within_turn`

`within_turn` lets a point require related tool calls in the same turn.

```yaml
# trajectory-marker-doc-snippet: fragment
points:
  - name: sensitive-read-followed-by-network
    match:
      tool: Bash
      command: '(?i)\b(curl|wget)\b'
      within_turn:
        after:
          tool: Read
          file: '**/.env*'
```

`within_turn` supports these controls:

- `min_occurrences`: require at least this many matches of the base condition
  in the same turn.
- `consecutive`: require this many matches of the base condition in a row.
- `group_by`: group base matches by a normalized field before the occurrence
  and consecutive checks.
- `after`: count only base matches that come after this nested condition
  matched earlier in the same turn.
- `transitions`: require at least this many changes between match and no
  match in the turn.

## Ranges and correlations

A range finds a pattern across several turns. Use `ranges:` in new YAML. Older
code comments can call ranges "arcs".

### Sequence ranges

```yaml
# trajectory-marker-doc-snippet: fragment
ranges:
  - name: ci-feedback-loop
    sequence:
      - point: git-push
      - point: test-failed
      - tool: [Edit, Write]
      - point: test-passed
```

A sequence range fires when its steps happen in order. If you need a window in
turns or in clock time, use a correlation range.

### Bracket ranges

A bracket range starts when a condition matches. It ends when one of its end
conditions matches.

```yaml
# trajectory-marker-doc-snippet: fragment
ranges:
  - name: long-debug-loop
    bracket:
      starts_when:
        tool: Bash
        command: 'pytest'
      ends_when:
        point: test-passed
```

### Correlation ranges

A correlation range connects two points that occur within a window of turns or
time.

```yaml
# trajectory-marker-doc-snippet: fragment
ranges:
  - name: sensitive-file-then-network
    correlation:
      a: security-sensitive-read
      b: network-command
      within_turns: 1
      capture:
        - key: file
          from: a
        - key: domain
          from: b
```

Use `within_turns` for a window in turns, or `within_minutes` for a window in
clock time. Ranges have no `max_turns` field. To set limits, use correlation
windows. Correlation capture can copy details from point `a`, point `b`,
`first`, `then`, or `auto`.

## Measures

Measures turn points and ranges into numeric metrics.

### Count

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: tests-added
    scope: session
    count:
      point: new-test-written
```

`count` supports `point`, or the legacy `signal`, and an optional `group_by`
on point detail values. A grouped count gives one metric for each detail value
that it observes.

### Counted points

Some ingest points stand for more than one occurrence. Ingest writes one
`language-activity` point for each turn and language. It puts the number of
occurrences in the `count` detail of the point.

Everything that counts points adds that number instead of 1:

- `count` measures
- ratio numerators
- `signal_count_above`
- distributions with `metric_kind: count`, where the number multiplies the
  value of the point

Other distribution kinds take one sample for each point. A correlation range
whose `b` point is counted stands for the same number of occurrences. Range
counts add it the same way.

A custom marker file needs no extra setting for this. Trajectory reads `count`
only on points that ingest wrote. An extract that you name `count` on your own
point does not change how the point is counted.

### Ratio

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: test-pass-to-failure-ratio
    scope: session
    ratio:
      numerator:
        point: test-passed
      denominator:
        point: test-failed
```

This example divides passing test runs by failing test runs. So it gives a
ratio of passes to failures. It does not give a pass rate between 0 and 1. The
denominator can also be the string `session_turns`.

### Weighted count

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: shell-risk-score
    scope: session
    weighted_count:
      tool_weights:
        Bash: 2
        WebFetch: 1
```

### Distribution

A distribution measure does one of these things:

- It collects numeric detail values from a source point.
- It sends a numeric constant for each matching source event.
- It measures the duration of a source range.

The schema is flat:

- Set `signal` to the name of the point or range.
- Set `value` to a detail key that starts with `@`, or to a numeric constant
  such as `"1"`.
- For range durations, set `value` to `@range_duration_ms`.
- To filter range distributions by how the range ended, set `outcome`.

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: commit-cost-usd
    scope: commit
    metric: trajectory.custom.commit_cost.usd
    metric_kind: distribution
    distribution:
      signal: git-commit
      value: '@attributed_cost_usd'
      tag_keys: [branch]
```

A point distribution sends one metric value each time the source point fires.
A range distribution supports `value: '@range_duration_ms'` for duration
samples. It also supports a numeric constant, for one count sample for each
completed range.

## Dimensions and cardinality

Distribution measures can add dimensions from point details. Keep the number
of values of each dimension small.

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: commit-cost-usd
    scope: commit
    metric: trajectory.custom.commit_cost.usd
    metric_kind: distribution
    distribution:
      signal: git-commit
      value: '@attributed_cost_usd'
      tag_keys: [branch]
      dimensions:
        - name: branch
          detail_key: branch
          max_length: 80
          max_values: 100
      cardinality_limit: 100
```

Follow these guidelines:

- Use dimensions for small, fixed sets of values, such as branch type,
  language, tool, outcome, or team.
- Never use raw prompts, full paths, URLs with query strings, user IDs, emails,
  secrets, or commit SHAs as metric dimensions.
- Never use raw shell commands as metric dimensions. Extract a category with
  few values with `regex`. To group known command families, use
  `normalizer: cli_tool`.
- Prefer `regex` and `max_length` on dimension definitions to normalize values
  before Trajectory sends them.
- When you add dimensions, set `cardinality_limit`, `max_dimensions`,
  `max_dimension_value_length`, and `max_values` for each dimension.

## Datadog metrics, dashboards, and monitors

If marker metric publishing is on for a Datadog destination, Trajectory sends
the marker series through agentless OTLP. Each series uses the `metric_kind`
of its marker: `gauge`, `count`, or `distribution`. The publisher generates
the metric name. Trajectory accepts the older native transport settings, but
ignores them.

### Metric naming convention

All Trajectory metrics, both marker metrics and base metrics, use this form:

```
trajectory.<scope>.<concept>[.<measurement>]
```

- `<scope>` is `turn`, `session`, `task`, `commit`, or `pr`. It names the
  natural grain of the value.
- `<concept>` is a snake_case noun. Use the plural for counts, such as
  `commits`, `force_pushes`, or `tool_uses`. Use the singular for single
  values, such as `cost` or `duration`.
- `<measurement>` is an optional suffix for when the unit, lifecycle, or
  aggregation is unclear. Examples are `usd`, `ms`, `score`, `elapsed`,
  `accumulated`, `total`, and `mean`.

The publisher derives `<scope>` from the `scope:` field of the marker. For v1
files, it uses the default scope. It derives `<concept>` from the marker name
and changes hyphens to underscores. To skip this derivation, set `metric:` on
the marker.

A metric name should say what the value means. Do not depend on the Datadog
type to explain the value:

- Use `.elapsed` for live count gauges that update while a session runs.
- Use `.accumulated` for live money or cost gauges, such as
  `trajectory.session.cost.usd.accumulated`.
- Use `.total` for completed samples only when no additive count replaces
  them.
- Do not copy a built-in distribution name into a new marker definition. The
  exception is a name that
  `trajectory publish metrics audit --latest --builtin-details` lists.
- Use `metric_kind: gauge` for current values, ratios, scores, and values that
  are already aggregated.
- Use `metric_kind: count` only for additive changes that you sum across time
  buckets.
- Use `metric_kind: distribution` for raw samples when you want percentiles,
  averages, and sums over samples.

Never publish the same metric name with more than one `metric_kind`. A value
can be useful both while it is in progress and after it completes. In that
case, publish separate names. Use `.elapsed` or `.accumulated` for the live
gauge and `.total` for the completed sample.

Examples of the derivation:

| Marker (v2) | Published metric |
| --- | --- |
| measure `commits`, scope `session`, count over `git-commit` | `trajectory.session.commits.completed_count` |
| measure `force-pushes`, scope `session` | `trajectory.session.force_pushes.completed_count` |
| measure `permissions-denied`, scope `session` | `trajectory.session.permissions_denied.completed_count` |
| measure `task-outcome-score`, scope `task` | `trajectory.task.outcome_score` |
| built-in PR-created turn point, one count for each turn that creates a PR or MR | `trajectory.turn.prs` |
| normalized PR presence, a count that is safe to correct | `trajectory.pr.observations.total` |
| PR work cost, an additive count that is safe to correct | `trajectory.pr.work.cost.usd.additive` |
| measure `test-fix-cycle-duration-ms`, scope `session`, distribution of `@range_duration_ms` | `trajectory.session.test_fix_cycle_duration_ms` |

Some built-in session counts publish only a `.completed_count` count. The
first three rows show examples. A count sums correctly across dashboard time
windows. Other session measures publish under their derived name with their
`metric_kind`, which defaults to `gauge`.

Built-in turn metrics publish gauges for the latest value and additive counts
for totals over long windows. They publish distributions only where percentile
analysis has no replacement that is safe to replay.

Use `trajectory.pr.observations.total` for normalized PR presence. Use
`trajectory.pr.work.cost.usd.additive` for PR cost that is safe to correct.

If Trajectory finds a supported GitHub or GitLab PR reference, PR metrics carry
a PR identity with a limited set of fields. Before it publishes, Trajectory
normalizes supported CI wrapper URLs for change requests. They become the
GitHub host, owner, repository, and PR number. Commands, refs, paths, and
source content never become metric tags.

Trajectory no longer attributes work to CODEOWNERS.

Name marker metrics with the `trajectory.<scope>.<concept>` pattern above.

Trajectory can publish range markers as marker context. To graph a range in a
dashboard, add a measure based on the range:

```yaml
measures:
  - name: test-fix-cycles
    scope: session
    count:
      range: test-fix-cycle

  - name: test-fix-cycle-duration-ms
    scope: session
    metric_kind: distribution
    distribution:
      signal: test-fix-cycle
      value: '@range_duration_ms'
```

### Tags and dimensions

Marker metric series have these tags:

- the top-level Datadog publish `tags:`
- the destination `tags:` from the publish config
- `session_id`, and `ml_app` if it is set
- repo tags (`git_remote_host`, `owner`, `repo`), when Trajectory can find
  them
- `trajectory.trace_type:session`

Trajectory adds the dimensions from `dimensions`, or the legacy `tag_keys`, to
point metric tags only. Add dashboard template variables only for tags that are
on the marker series you query. Examples are `team`, `env`, `repo`, `owner`, or
a point dimension with few values, such as `branch`.

Keep the number of values of each metric tag small. Avoid full prompts,
command lines, paths, URLs, emails, SHAs, random IDs, and values that look like
secrets. Before you build dashboards or monitors on a tag, confirm in Metrics
Explorer that the tag is present.

To publish marker metrics, turn on markers for a Datadog destination in the
publish config. Then validate the destination. To roll out markers from a repo,
put the marker definitions in `.trajectory/markers.yaml`. Put the destination
overlay in `publish.trajectory.yaml`. See [REPO-MARKERS.md](REPO-MARKERS.md).

```yaml
# trajectory-doc-snippet: publish-config
destinations:
  - name: team-llmobs
    type: datadog_agentless
    site: us5.datadoghq.com
    ml_app: coding-agents
    service: trajectory
    api_key_ref: dd-api-key
    tags:
      team: agent-platform
      env: prod
    markers:
      enabled: true
      metrics: true
```

```bash
trajectory publish validate
```

### Dashboard query examples

Trajectory sends each marker metric with its `metric_kind`. For built-in
session counts, query the `.completed_count` metric with `sum:`. For ratios
and scores, use `avg:`.

| Widget | Example Datadog query | Notes |
| --- | --- | --- |
| Security events query value | `sum:trajectory.session.security_risky_shell_secret_exfils{env:prod}.rollup(sum, 3600)` | Counts risky shell and secret exfiltration markers per hour. Needs a `security-risky-shell-secret-exfils` session measure that you define with `metric_kind: count`. Custom measures publish under their own name, not as `.completed_count`. |
| Force pushes by repo toplist | `sum:trajectory.session.force_pushes.completed_count{*} by {repo}.rollup(sum, 86400)` | Needs the repo tag, found by Trajectory or set by you. |
| Permission denials trend | `sum:trajectory.session.permissions_denied.completed_count{team:agent-platform}.rollup(sum, 3600)` | Useful for safety and friction dashboards. |
| P95 completed-turn duration | `p95:trajectory.turn.duration_ms.total{repo:trajectory}` | Needs clients that send or derive turn duration. |
| Cost per observed PR | DDSQL ratio of `sum:trajectory.pr.work.cost.usd.additive{source:facts,...}.as_count()` to the distinct `(change_host,owner,repo,change_number)` count from `trajectory.pr.observations.total`, with the same filters and time bounds | The denominator includes every normalized PR. `cost_coverage:allocated` has a priced allocation. `unpriced` has assigned completed work without a price. `no_priced_turn` has no completed assigned turn. |
| PR-created turn lookup | `sum:trajectory.turn.prs{repo:trajectory,change_number:123} by {session_id,trajectory.turn_id}` | One point for each turn that creates a PR or MR. |
| Existing-PR work turns | `sum:trajectory.pr.work_turns.additive{repo:trajectory,change_number:123} by {session_id}.as_count()` | Count, safe to correct, of completed turns in a PR or MR context. |
| Existing-PR work cost | `sum:trajectory.pr.work.cost.usd.additive{source:facts,repo:trajectory}.as_count()` | Trajectory divides each eligible turn across all supported candidate PRs. The shares add up to the turn cost. Do not add this cost to turn, session, or PR creation cost. |
| P95 range duration | `p95:trajectory.session.test_fix_cycle_duration_ms{*}` | Needs a range distribution with `@range_duration_ms` and `metric_kind: distribution`. |
| Pass-to-failure ratio | `avg:trajectory.session.test_pass_to_failure_ratio{repo:trajectory}` | Ratio measures are session gauges. Graph them with `avg:`. |
| Marker density formula | `sum:trajectory.session.force_pushes.completed_count{*}.rollup(sum, 86400) / sum:trajectory.session.completed{*}.as_count()` | Use a formula widget to divide marker counts by completed sessions. |

### Monitor examples

These are example metric monitor queries. Trajectory does not create them.
Change the scopes and thresholds to fit your organization:

- Page on high-risk security markers in production, with the custom count
  measure from the table above:
  `sum(last_15m):sum:trajectory.session.security_risky_shell_secret_exfils{env:prod}.rollup(sum) > 0`
- Alert when force pushes happen outside a break-glass repo or team:
  `sum(last_1h):sum:trajectory.session.force_pushes.completed_count{team:agent-platform,!repo:release-tools}.rollup(sum) > 0`
- Find sessions with more failing than passing test runs, with the example
  pass-to-failure ratio:
  `avg(last_4h):avg:trajectory.session.test_pass_to_failure_ratio{team:agent-platform} < 1`
- Find long range cycles after you define a duration distribution:
  `max(last_1h):max:trajectory.session.test_fix_cycle_duration_ms{team:agent-platform} > 1800000`

### Security marker dashboard starter

After you turn on the optional security marker add-on, define count measures
for the signals you want to graph:

```yaml
measures:
  - name: security-user-jailbreak-attempts
    scope: session
    count:
      point: security-user-jailbreak-attempt

  - name: security-sensitive-read-networks
    scope: session
    count:
      point: security-sensitive-read-followed-by-network

  - name: security-risky-shell-secret-exfils
    scope: session
    count:
      point: security-risky-shell-secret-exfil
```

Useful starter widgets are:

- a 24-hour query value for all security markers
- a toplist by `repo` or `team`
- a timeseries split by each count metric

Keep extracted security details out of metric tags. The exception is a detail
that you normalize to a safe category with few values.

Trajectory does not ship dashboard templates. When you build your own
dashboards, use the metric names and tags in the
[Metrics Reference](METRICS-REFERENCE.md).

## CLI commands

```bash
# Install the optional security marker add-on.
trajectory patterns markers enable-security [--output PATH] [--force]

# Inspect the resolved marker catalog.
trajectory patterns markers list [--config PATH]
trajectory patterns markers explain [--config PATH] <name>

# Validate marker YAML before running it through the evaluator.
trajectory patterns markers validate [--config PATH]

# Export marker definitions as Datadog span metric rule JSON to stdout.
trajectory patterns markers export [--config PATH] > dd-span-metric-rules.json

# Re-evaluate historical sessions with the current resolved marker config.
trajectory patterns markers reevaluate [--db PATH] [--session SESSION_ID] [--since YYYY-MM-DD] [--dry-run]

# Validate captured marker expectations in a DB fixture/session.
trajectory doctor markers [--db PATH] [--session SESSION_ID] [--corpus] [--self-test]

# Run the isolated marker canary and print Datadog readback queries.
trajectory patterns markers canary [--source-home PATH] [--home PATH] [--keep-home]

# Validate publish destinations and marker metric settings.
trajectory publish validate
```

`trajectory patterns markers validate` checks all resolved marker layers. To
check one marker YAML file, pass `--config PATH`. For each error, validation
reports the file, the schema path, and a message. An unknown marker YAML field
makes validation fail.

## Marker canary

Your change can affect marker results if it touches markers, publish, or
client capture. In that case, run `trajectory patterns markers canary
--keep-home`. The command does these things:

- It copies the current Trajectory config into a separate `TRAJECTORY_HOME`.
- It turns off the background transcript watchers for Codex and Cursor.
- It turns off segmentation, self-update, and token backfill.
- It starts a local capture server on a free port that the system picks.
- It posts a synthetic Pi session.

The canary also turns off repair of runtime assets. So its temporary capture
server cannot update user plugin caches or reconcile installed processes. When
the canary exits, it restores the repair setting that was in place before.

The synthetic session tests these behaviors:

- Three turns with interleaved assistant messages, so every turn must have
  `assistant_messages_json`.
- Skill detection through four paths: the native Pi activation wrapper, a
  `Skill` tool call, a read of a `SKILL.md` file, and tool provenance.
- The file read gives a `skill-invoked` point with lower confidence than the
  other paths.
- Failed test, code edit, passed test, commit, push, PR, compaction, tool
  error, permission denial, language activity, cost, and token metrics.
- Session, commit, and PR cost attribution from the cost of each turn. It does
  not use running totals.

A local `PASS` means that the SQLite cache contains all of these:

- the expected session and turn structure
- assistant message data that is not null
- marker points and grouped measures
- cost and token totals
- the dimensions of the commit and PR distribution points

If the copied config has a Datadog destination with marker metrics on, the
command also publishes to that destination. It then prints Metrics Explorer
queries for that destination. A local `PASS` does not show that the metrics
reached Datadog. Run those queries to check.

When you read the metrics back from Datadog, expect values such as these:

```text
trajectory.session.skill_invocations.completed_count by skill_name: marker-canary=1, dev-deploy=1, aiusage-live-readback=1, pi-native-canary=1
trajectory.turn.skill_invocations by skill_name, detected_from, source_scope, signal_confidence, attribution_reason: marker-canary=1, dev-deploy=1, aiusage-live-readback=1, pi-native-canary=1
trajectory.turn.permissions_denied by tool, category, source: Bash/user-rejected/turn_end.denial_reasons=1
trajectory.turn.errors.additive and trajectory.session.errors.accumulated by category: command-failed=1
trajectory.session.language_activity.completed_count by language: go=2, markdown=1
trajectory.turn.language_activity by language: go=2, markdown=1
trajectory.turn.cli_tool_count by tool: go=1, make=1, git=2, gh=1
trajectory.turn.commits, trajectory.turn.prs, trajectory.turn.pushes: each 1
trajectory.turn.cost.usd.additive by session_id: 0.0343
trajectory.turn.prs by change_number,trajectory.turn_id: 9999,3=1
gen_ai.usage.input_tokens: 4300
gen_ai.usage.output_tokens: 1240
```

A generic skill tool call can lack native skill source metadata. Trajectory
can then infer `source_scope`. It matches `skill_name` to local project or user
skill files.

In Pi sessions, the native `<skill name="..." location="...">` activation
wrapper is a strong sign that a skill was invoked. Trajectory publishes it
with `detected_from:pi_skill_prompt` and
`attribution_reason:native_attribution`. Similar user text from another client
does not become a Pi skill signal.

The expected metric tags include these:

- `session_id:<id>`
- `trajectory.client_source:pi`
- `trajectory.client_version:marker-canary/dev`
- `gen_ai.request.model:openai/gpt-5.1`
- `project_dir:trajectory-marker-canary-fixture`

Destination tags such as `environment` come from the copied config. Skill turn
metrics send `detected_from`, `source_scope`, and `signal_confidence` as
Datadog dimensions with few values. Other marker detail fields stay on the
local machine unless a measure maps them.

## End-to-end authoring workflow

1. Start with a point that matches few events. Test it on recent sessions.
2. Prefer structured predicates (`fields`, `allowlist`, `denylist`) over broad
   regexes on raw input.
3. Add extraction only for values you need for debugging or metrics.
4. Add a measure only after the point is stable.
5. Re-evaluate a small set of sessions, then a larger window.
6. Validate the publish config before you rely on Datadog dashboards.

Example:

```yaml
# trajectory-marker-doc-snippet: config
version: 2

points:
  - name: risky-rm-command
    description: Shell command removes files recursively without a dry run
    severity: warn
    confidence: high
    emit: both
    scope: session
    match:
      tool: Bash
      command: '(?i)^rm\s+.*\s-rf\b'
      denylist:
        - path: command
          regex: '(?i)--dry-run\b'
    extract_fields:
      - name: command_prefix
        path: command
        regex: '^(.{1,80})'

measures:
  - name: risky-rm-commands
    scope: session
    count:
      point: risky-rm-command
```

## Safe authoring guidelines

- **Keep secrets out of details and dimensions.** If a regex can capture a
  token, change it to capture only a category or a redacted prefix.
- **Keep the number of tag values small.** Datadog metric tags need a small,
  fixed set of values. Avoid full file paths, URLs, command lines, prompts,
  SHAs, random IDs, and free text from users.
- **Use denylist predicates for known safe cases.** For example, leave out
  `--dry-run`, `--force-with-lease`, fixtures, and test data.
- **Use allowlist predicates when provenance matters.** Match `source_scope`
  or `provenance.*` fields to limit a marker to trusted capture paths, when
  those fields are present.
- **Use `enforced: true` only in org configs.** It stops local overrides.
- **Prefer `emit: metric` for numeric signals.** Use `emit: both` only for
  debugging signals of high value.
- **Keep regexes specific and set case flags.** Use `(?i)` for matches that
  ignore case. Anchor shell commands where you can.

## Troubleshooting

- **A marker never fires.** Check the tool name. Check whether the data is in
  `input`, `output`, `error`, or the normalized `command`. Then try a simpler
  `fields` predicate.
- **A shell command marker misses commands.** `command` matches the first shell
  command line. To inspect the full raw shell JSON or input with several lines,
  use `input`.
- **A file marker misses paths.** `file` uses paths taken from common input
  keys. If a tool uses its own key, use `fields` on that structured input path.
- **A range does not fire.** Confirm that each point fires on its own. Then
  check the order, the bracket end conditions, or the correlation windows.
- **A metric is missing in Datadog.** Check these four things. The measure
  sends a value other than zero. Marker publishing is on for the destination.
  `trajectory publish validate` succeeds. The session was re-evaluated after
  the config changed.
- **A dimension is missing.** Confirm that the point detail exists and that the
  dimension `detail_key` matches it exactly. Check that the cardinality and
  length limits did not drop the value.
- **A local override is ignored.** Check whether an org marker with the same
  name has `enforced: true`. Then check the layer order above.
