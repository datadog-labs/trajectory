# Marker Usage Guide

Markers are Trajectory's YAML-defined behavioral signals. They turn captured agent sessions into named observations that can be evaluated locally, stored in Trajectory's SQLite database, and exported to Datadog as marker metrics and structured marker context.

A concise version of this guide is built into the binary:

```bash
trajectory user-guide markers
```

Use markers when you want durable answers to questions such as:

- Did the agent force-push, run a destructive command, or expose a secret in a shell command?
- How often did a user correct the agent, interrupt it, or deny a tool call?
- Which sessions produced commits, PRs, test fixes, or high-risk tasks?
- How much estimated cost should be attributed to each commit, PR, or branch?

## Where marker configs live

The marker resolver layers configs in this order:

1. **Built-ins** embedded in the binary.
2. **Org markers** from `TRAJECTORY_ORG_MARKERS_PATH`, or `~/.trajectory/org/markers.yaml`.
3. **User add-ons** from `~/.trajectory/markers.d/*.yaml`, loaded by sorted filename.
4. **User markers** from `TRAJECTORY_MARKERS_PATH`, or `~/.trajectory/markers.yaml`.
5. **Project markers** from `TRAJECTORY_PROJECT_MARKERS_PATH`, or from `.trajectory/markers.yaml` under the nearest parent directory containing `.git/`. If no project root is found and no env var is set, this layer is skipped.

Later layers override earlier layers by marker name. An org marker with `enforced: true` cannot be overridden by user, add-on, or project layers.

`trajectory setup` deploys the Datadog default marker profile to `~/.trajectory/markers.yaml`. That profile layers on top of the embedded built-ins; it does not replace them.

## Built-ins, defaults, and the security add-on

Trajectory always starts with embedded built-ins for common agent outcomes and friction:

- Points such as `user-frustration`, `agent-course-correction`, `git-commit`, `pr-created`, `git-push`, `test-passed`, `test-failed`, `skill-invoked`, skill and workflow lifecycle points, `tool-error`, `permission-denied`, `language-activity`, `code-change`, `files-touched`, `compaction`, `fork-detected`, and `backtrack-detected`.
- The `test-fix-cycle` multi-turn range.
- Measures such as `frustration-count`, `commit-count`, `commit-cost-usd`, `commit-attributed-turns`, task metrics, and error/interruption counts.

The setup default profile adds Datadog-oriented signals such as `force-push`, `destructive-command`, `secret-in-command`, `high-cost-turn`, CI and infrastructure touch points, retry ranges, and language/code-change measures.

The built-in `test-passed` and `test-failed` command regexes are intentionally examples, not an exhaustive test-runner catalog. They cover common high-confidence commands such as `go test`, `cargo test`, `pytest`, JavaScript package-manager test scripts, `make test`-style targets, shell scripts under `tests/`, and representative language-native runners like Maven/Gradle, `dotnet test`, RSpec, PHPUnit/Composer, Swift, and CTest. If your team uses more specific commands, override those points in org, user, or project marker config:

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

The optional security catalog is installed with:

```bash
trajectory markers enable-security
```

This writes `~/.trajectory/markers.d/security.yaml` by default. It includes declarative security points for jailbreak-like prompts, system prompt leak requests, web-content prompt injection, suspicious `WebFetch` domains, sensitive reads followed by network activity, and risky shell secret exfiltration patterns. Use `--output PATH` to write a copy somewhere else and `--force` to overwrite an existing output file.

## YAML file shape

Marker config files use `version: 2` and may define `tags`, `points`, `ranges`, and `measures`. Files declaring `version: 1` are still loaded but cannot use the v2-only `scope:` and `metric:` fields.

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
      - point: code-change
      - point: test-passed

measures:
  - name: force-pushes
    scope: session        # v2: drives the published metric name
    count:
      point: force-push
```

The code and some validation messages still use the word "arc" for historical reasons. Author new YAML under the top-level `ranges:` key.

### Schema v2 additions

`version: 2` introduces three optional fields on points, ranges, and measures:

- `scope: turn | session | task | commit | pr` - the natural granularity of the value. Determines the published metric name's `<scope>` segment and the DD `trajectory.scope` tag. If omitted, the loader infers a default from the marker shape (session-level for most measures, commit-level for `git-commit` distributions, task-level for task-outcome measures).
- `metric: <explicit name>` - an optional override for the published DD metric name. When set, this exact string is used verbatim; when absent, the publisher derives the name from `trajectory.<scope>.<concept>` using the marker name (hyphens normalized to underscores).
- `metric_kind: gauge | count | distribution` - the transport type. If omitted, Trajectory defaults to `gauge` for backward compatibility. Use `distribution` for raw numeric samples that need percentile queries.

Default derivation (typical case):

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: force-pushes        # measure name -> concept
    scope: session            # scope -> prefix
    count:
      point: force-push
# Publishes as the compatibility gauge trajectory.session.force_pushes and
# the dashboard-safe completed-session count trajectory.session.force_pushes.completed_count.
```

Explicit override (when you want a stable name that does not match the marker name):

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: commit-cost-usd
    scope: commit
    metric: trajectory.commit.cost.usd.total   # override; publisher uses this verbatim
    metric_kind: distribution
    distribution:
      signal: git-commit
      value: '@attributed_cost_usd'
```

Use `metric:` sparingly. Prefer naming the marker so default derivation produces the metric you want.

## Points

A point is a point-in-time observation. It fires on a matching prompt, response, tool call, or same-turn combination.

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

Tool-call match fields:

| Field | Meaning |
| --- | --- |
| `tool` | Exact tool name, or a list of names. Shell-like tools include `Bash`, `Shell`, `run_shell`, `exec_command`, and `terminal`. |
| `input` / `not_input` | Regex against the raw tool input JSON. |
| `output` / `not_output` | Regex against tool output text; falls back to error text when output is empty. |
| `command` | Regex against the first shell command line extracted from shell tool input. |
| `file` | Glob against paths extracted from common file/path keys in tool input. |
| `success` | Boolean success value. |
| `denied` | Boolean permission-denied value. |
| `duration_above` | Tool-call duration threshold in milliseconds. |
| `turn_cost_above` | Turn estimated-cost threshold in USD. |
| `agent_id` | `""` means root agent only, `"*"` means any subagent, any other value is exact. |
| `fields` | Structured field predicates; all predicates must match. |
| `allowlist` | Structured predicates where at least one must match if the list is present. |
| `denylist` | Structured predicates where any match excludes the tool call. |

Prompt/response/session fields:

| Field | Meaning |
| --- | --- |
| `prompt` / `not_prompt` | Regex against a user prompt. |
| `prompt_caps` | Minimum count of all-caps words in a prompt. |
| `response` / `not_response` | Regex against assistant response text. |
| `client` | Session client name filter. |
| `session_cost_above` | Session estimated-cost threshold in USD. |
| `session_duration_above` | Session duration threshold in milliseconds. |
| `min_turns` | Minimum number of turns in the session. |
| `signal_count_above` | Session-level count of an already evaluated point/signal. |

### Structured fields, allowlists, denylists, provenance, and source scope

Use `fields`, `allowlist`, and `denylist` when regexing raw JSON would be too broad. A predicate has a `path` and at least one operator:

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

Supported predicate operators are `equals`, `regex`, `glob`, `in`, `not_in`, and `exists`.

Structured paths may start with:

- `input.*`, `output.*`, `error.*` for parsed tool input/output/error JSON.
- `command`, `file`, or `files` for normalized shell/file views.
- `tool`, `agent_id`, `denied` for normalized tool metadata.
- `provenance.*` for provenance metadata merged from captured events.
- `source_scope` as a convenience path for provenance source-scope values.

Nested paths support dot notation and array indexes; `*` expands an array. Examples: `input.url`, `input.files.*`, `provenance.mcp.source_scope`.

## Extraction and point details

Marker findings carry a `Detail` map. Details are used for troubleshooting and can also feed measures and metric dimensions.

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

The first capture group is stored when present; otherwise the full regex match is stored.

Structured `extract_fields` entries support `name`, `path`, `regex`, and
`normalizer`. Marker YAML is parsed strictly; unknown fields are rejected so a
typo cannot silently change marker behavior.

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

Keep extracted details low-cardinality and non-sensitive. They are persisted locally and may be exported as metric tags when referenced by dimensions or `tag_keys`.
If a count or distribution measure uses `group_by` over a detail extracted from
`path: command`, the extraction must use either `regex` or a supported
`normalizer` first. Raw shell command strings cannot be used directly as metric
dimensions. For command-line tool toplists, use `normalizer: cli_tool`; publish
also suppresses `trajectory.session.cli_tool_count` rows whose `tool` value is
not one of Trajectory's recognized normalized CLI labels.

## Same-turn correlation with `within_turn`

`within_turn` lets a point require related tool calls inside the same turn.

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

Supported `within_turn` controls are:

- `min_occurrences`: require at least this many base-condition matches in the same turn.
- `consecutive`: require this many consecutive base-condition matches.
- `group_by`: group base matches by a normalized field before applying occurrence/consecutive checks.
- `after`: only consider base matches that occur after this nested match condition matched earlier in the same turn.
- `transitions`: require at least this many match/non-match state transitions in the turn.

## Ranges and correlations

Ranges detect multi-turn patterns. New YAML uses `ranges:`; older code comments may call these arcs.

### Sequence ranges

```yaml
# trajectory-marker-doc-snippet: fragment
ranges:
  - name: ci-feedback-loop
    sequence:
      - point: git-push
      - point: test-failed
      - point: code-change
      - point: test-passed
```

A sequence range fires when its steps happen in order. Use correlation ranges when you need an explicit turn-distance or wall-clock window.

### Bracket ranges

Bracket ranges start on a match condition and end on an end condition or one of several end conditions.

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

Correlation ranges connect two points that occur within a turn or time window.

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

Use `within_turns` for turn-distance windows or `within_minutes` for wall-clock windows. Ranges do not have a `max_turns` field; use correlation windows when you need explicit limits. Correlation capture can copy details from point `a`, point `b`, `first`, `then`, or `auto`.

## Measures

Measures aggregate points and ranges into numeric metrics.

### Count

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: tests-written
    scope: session
    count:
      point: new-test-written
```

`count` supports `point` (or legacy `signal`) and optional `group_by` over point detail values. Grouped counts produce one metric per observed detail value.

### Ratio

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: test-success-rate
    scope: session
    ratio:
      numerator:
        point: test-passed
      denominator:
        point: test-failed
```

The denominator can also be the scalar string `session_turns`.

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

Distribution measures collect numeric detail values from a source point or the computed duration of a source range. The schema is flat: set `signal` to the point or range name and `value` to a detail key prefixed with `@` (or `@range_duration_ms` for ranges).

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: commit-cost-usd
    scope: commit
    metric: trajectory.commit.cost.usd.total
    metric_kind: distribution
    distribution:
      signal: git-commit
      value: '@attributed_cost_usd'
      tag_keys: [branch]
```

Point distributions emit one point-level metric per source point firing. Range distributions support `value: '@range_duration_ms'`.

## Dimensions and cardinality

Distribution measures may add low-cardinality dimensions from point details:

```yaml
# trajectory-marker-doc-snippet: fragment
measures:
  - name: commit-cost-usd
    scope: commit
    metric: trajectory.commit.cost.usd.total
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

Guidelines:

- Use dimensions for bounded sets such as branch type, language, tool, outcome, or team.
- Do not use raw prompts, full paths, URLs with query strings, user IDs, emails, secrets, or commit SHAs as metric dimensions.
- Do not use raw shell commands as metric dimensions. Extract a bounded category
  with `regex`, or use `normalizer: cli_tool` when grouping recognized command
  families.
- Prefer `regex` and `max_length` on dimension definitions to normalize values before export.
- Set `cardinality_limit`, `max_dimensions`, `max_dimension_value_length`, and per-dimension `max_values` when adding dimensions.

## Datadog metrics, dashboards, and monitors

When marker metric publishing is enabled for a Datadog destination, Trajectory publishes marker-derived DD Metrics v2 series using each marker's `metric_kind` (`gauge`, `count`, or `distribution`) and names generated by the publisher.

### Metric naming convention

All trajectory metrics - markers and base - follow the same shape:

```
trajectory.<scope>.<concept>[.<measurement>]
```

- `<scope>` is one of `turn`, `session`, `task`, `commit`, or `pr` and reflects the natural granularity of the value.
- `<concept>` is a snake_case noun: plural for counts (`commits`, `force_pushes`, `tool_uses`), singular for scalars (`cost`, `duration`).
- `<measurement>` is an optional suffix when the unit, lifecycle, or aggregation is ambiguous: `usd`, `ms`, `score`, `elapsed`, `accumulated`, `total`, `mean`.

The publisher derives `<scope>` from the marker's `scope:` field (or the inferred default for v1 files) and `<concept>` from the marker name with hyphens normalized to underscores. Provide a `metric:` override on the marker to bypass derivation entirely.

Metric names should describe what the value means without relying on the Datadog type for interpretation:

- Use `.elapsed` for live, running count-like gauges that update as a session progresses, such as `trajectory.session.turns.elapsed`.
- Use `.accumulated` for live, running money or cost gauges, such as `trajectory.session.cost.usd.accumulated`.
- Use `.total` for completed-sample values emitted once per completed turn, session, commit, PR, task, or range, such as `trajectory.turn.cost.usd.total`, `trajectory.session.turns.total`, `trajectory.commit.cost.usd.total`, or `trajectory.pr.cost.usd.attributed.total`.
- Use `metric_kind: gauge` for current values, ratios, scores, and precomputed aggregates.
- Use `metric_kind: count` only for additive deltas that should be summed across time buckets.
- Use `metric_kind: distribution` for raw sample populations where percentiles, averages, and sums over samples are the desired product behavior.

Do not publish the same metric name with multiple `metric_kind` values. If a value is useful both while it is still in progress and after it completes, publish distinct lifecycle names such as `.elapsed` or `.accumulated` for the live gauge and `.total` for the completed sample.

Examples of the derivation:

| Marker (v2) | Published metric |
| --- | --- |
| measure `commits`, scope `session`, count over `git-commit` | `trajectory.session.commits` plus `trajectory.session.commits.completed_count` for dashboard totals |
| measure `force-pushes`, scope `session` | `trajectory.session.force_pushes` plus `trajectory.session.force_pushes.completed_count` for dashboard totals |
| measure `permissions-denied`, scope `session` | `trajectory.session.permissions_denied` plus `trajectory.session.permissions_denied.completed_count` for dashboard totals |
| measure `task-outcome-score`, scope `task` | `trajectory.task.outcome_score` |
| measure `commit-cost-usd`, scope `commit`, distribution per commit | `trajectory.commit.cost.usd.total` |
| built-in PR-attributed cost, distribution per PR | `trajectory.pr.cost.usd.attributed.total` |
| measure `test-fix-cycle-duration-ms`, scope `session`, distribution `@range_duration_ms` | `trajectory.session.test_fix_cycle.duration.ms` |

Built-in per-turn metrics intentionally publish both gauges and distributions where the questions differ. `trajectory.turn.tool_uses` is a gauge split by `tool_name` for per-tool breakdowns within a turn; `trajectory.turn.tool_uses.total` is a distribution sample of the total tools used by a completed turn and does not carry `tool_name`. Similarly, `trajectory.turn.cost.usd` and `trajectory.turn.duration_ms` are gauges for the latest turn values, while `trajectory.turn.cost.usd.total` and `trajectory.turn.duration_ms.total` are completed-turn distribution samples for percentile queries. `trajectory.turn.permission_wait_ms.total` and `trajectory.turn.duration_ms.excluding_permission_wait.total` break out derivable human approval wait from completed-turn duration. PR attribution metrics are also completed samples: `trajectory.pr.cost.usd.attributed.total` is the cost attributed to turns that contributed to a PR, `trajectory.pr.attributed_turns.total` counts those turns, and `trajectory.pr.containing_session.cost.usd.total` records the cost of sessions containing PR activity. `trajectory.session.last_seen.unix` is a session-scoped gauge whose value is the latest observed session event time as Unix seconds; use it for recency-sorted session tables. Enable Historical Metrics Ingestion for this gauge before replaying sessions older than one hour.

Managed `required_destinations` can opt in to structured `pr_attribution` records for PR/MR drilldown. Those records are derived from persisted `pr-created` marker detail and session summaries. They may include PR/MR URL, owner, repo, number, bounded attributed cost/turns, and containing-session cost; they do not include prompts, tool input/output, commands, diffs, file contents, or local file paths. Repo `publish.trajectory.yaml` files cannot enable records, and security destinations never receive them. Historical replay uses `trajectory backfill-records --kind pr_attribution` for dry-run and `--yes` to submit.

Any marker detail intended to feed a structured record must be durable,
schema-stable, and safe to publish without reading raw transcript or tool
payload tables. Marker detail may carry normalized identifiers and numeric
attribution values; it must not embed prompts, responses, command text, diffs,
file contents, local paths, or secret-bearing URLs.

Older `trajectory.marker.measure.<measure_name>` and `trajectory.marker.point.<measure_name>` namespaces are deprecated. Use the metric naming convention above for migration guidance.

Range markers are still exported as marker context/evaluation records. To make them easy to graph in dashboards, add a range-backed measure:

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

Marker metric series include top-level Datadog publish `tags:`, destination `tags:` from publish config, `session_id`, optional `ml_app`, best-effort repo tags (`git_remote_host`, `owner`, `repo`), and `trajectory.trace_type:session`. Per-emission dimensions from `dimensions` or legacy `tag_keys` are merged into point metric tags only. Add dashboard template variables only for tags that are present on the marker series you are querying; for example, `team`, `env`, `repo`, `owner`, or a bounded point dimension such as `branch`.

Keep metric tags low-cardinality. Avoid full prompts, command lines, paths, URLs, emails, SHAs, random IDs, and secret-looking values. Confirm tag presence in Metrics Explorer before wiring dashboards or monitors to them.

To publish marker metrics, enable markers for a Datadog destination in publish config and validate the destination:

```yaml
# trajectory-doc-snippet: publish-config
destinations:
  - name: team-llmobs
    type: datadog
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

Trajectory submits marker metrics according to `metric_kind`. Most session measures are gauges with completed-session `.completed_count` mirrors for dashboard totals; raw per-commit samples are distributions. Use `sum:` on the `.completed_count` mirrors for count-like session totals, `avg:` for ratios/scores, and percentile aggregators such as `p95:` for distribution samples.

| Widget | Example Datadog query | Notes |
| --- | --- | --- |
| Security events query value | `sum:trajectory.session.security_risky_shell_secret_exfils{env:prod}.rollup(sum, 3600)` | Count risky shell/secret exfil markers per hour. |
| Force pushes by repo toplist | `sum:trajectory.session.force_pushes.completed_count{*} by {repo}.rollup(sum, 86400)` | Requires the repo tag to be resolved or supplied. |
| Permission denials trend | `sum:trajectory.session.permissions_denied.completed_count{team:agent-platform}.rollup(sum, 3600)` | Useful for safety/friction dashboards. |
| P95 tools per completed turn | `p95:trajectory.turn.tool_uses.total{repo:trajectory}` | Distribution sample per completed turn; use the gauge `trajectory.turn.tool_uses` only for `tool_name` breakdowns. |
| P95 cost per completed turn | `p95:trajectory.turn.cost.usd.total{repo:trajectory}` | Distribution sample per completed turn. |
| P95 completed-turn duration | `p95:trajectory.turn.duration_ms.total{repo:trajectory}` | Requires clients to emit or derive turn duration. |
| P95 permission wait per completed turn | `p95:trajectory.turn.permission_wait_ms.total{repo:trajectory}` | Estimated from permission request and matching tool result timing when derivable. |
| P95 completed-turn duration excluding permission wait | `p95:trajectory.turn.duration_ms.excluding_permission_wait.total{repo:trajectory}` | Subtracts derivable approval wait; missing wait intervals remain part of duration. |
| Average per-commit cost | `avg:trajectory.commit.cost.usd.total{repo:trajectory} by {branch}` | Uses the built-in commit-cost-usd branch tag; confirm the `branch` point dimension is present in Metrics Explorer. |
| Total PR-attributed cost | `sum:trajectory.pr.cost.usd.attributed.total{repo:trajectory}` | Metrics aggregate. Optional managed `pr_attribution` records provide PR/MR drilldown separately from metric series. |
| PR-attributed turns | `sum:trajectory.pr.attributed_turns.total{repo:trajectory}` | Counts turns attributed to PR activity. |
| Average containing-session cost for PRs | `avg:trajectory.pr.containing_session.cost.usd.total{repo:trajectory}` | Compares attributed PR cost with the broader session cost that contained PR activity. |
| P95 range duration | `p95:trajectory.session.test_fix_cycle.duration.ms{*}` | Backed by a range distribution using `@range_duration_ms` and `metric_kind: distribution`. |
| Range success ratio | `avg:trajectory.session.test_success_rate{repo:trajectory}` | Ratio measures are session-level gauges; graph with `avg:`. |
| Marker density formula | `sum:trajectory.session.force_pushes.completed_count{*}.rollup(sum, 86400) / count_not_null(avg:trajectory.session.turns.total{*} by {gen_ai.conversation.id})` | Use a formula widget to normalize marker counts by completed sessions. |

### Monitor examples

Adapt scopes and thresholds to your org. These are metric monitor query shapes, not hard-coded defaults:

- Page on high-risk security markers in production:
  `sum(last_15m):sum:trajectory.session.security_risky_shell_secret_exfils{env:prod}.rollup(sum) > 0`
- Alert when force pushes happen outside a break-glass repo/team:
  `sum(last_1h):sum:trajectory.session.force_pushes.completed_count{team:agent-platform,!repo:release-tools}.rollup(sum) > 0`
- Watch range-backed retry health:
  `avg(last_4h):avg:trajectory.session.test_success_rate{team:agent-platform} < 0.8`
- Catch unusually long range cycles after defining a duration distribution:
  `max(last_1h):max:trajectory.session.test_fix_cycle.duration.ms{team:agent-platform} > 1800000`

### Security marker dashboard starter

After enabling the optional security marker add-on, define stable count measures for the signals you want to graph:

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

Useful starter widgets are a 24-hour query value for total security markers, a toplist by `repo` or `team`, and a timeseries split by the specific count metric. Keep extracted security details out of metric tags unless they are normalized to a bounded, non-sensitive category.

Packaged Datadog dashboard templates are embedded in the binary. For one-off analysis, prefer ad hoc dashboard queries like the examples above.

## CLI commands

```bash
# Install the optional security marker add-on.
trajectory markers enable-security [--output PATH] [--force]

# Inspect the resolved marker catalog.
trajectory markers list [--config PATH]
trajectory markers explain [--config PATH] <name>

# Validate marker YAML before running it through the evaluator.
trajectory markers validate [--config PATH]

# Export marker definitions as Datadog span metric rule JSON to stdout.
trajectory markers export-dd-rules [--config PATH] > dd-span-metric-rules.json

# Re-evaluate historical sessions with the current resolved marker config.
trajectory reevaluate [--db PATH] [--session SESSION_ID] [--since YYYY-MM-DD] [--dry-run]

# Validate captured marker expectations in a DB fixture/session.
trajectory validate-markers [--db PATH] [--session SESSION_ID] [--corpus] [--self-test]

# Run the isolated marker canary and print Datadog query examples.
trajectory markers canary [--source-home PATH] [--home PATH] [--keep-home]

# Validate publish destinations and marker metric settings.
trajectory publish validate
```

`trajectory markers validate` checks all resolved marker layers; pass `--config PATH` to validate a specific marker YAML file. Validation reports the file, schema path, and message for each error. Unknown marker YAML fields fail validation instead of being ignored.

## Marker canary

Use `trajectory markers canary --keep-home` after marker, publish, or client-capture changes that could affect marker fidelity. The command copies the current Trajectory config into an isolated `TRAJECTORY_HOME`, disables ambient Codex/Cursor transcript watchers, disables segmentation/self-update/token backfill, starts a local capture server on an ephemeral port, and posts a synthetic Pi session.

The synthetic session intentionally exercises:

- Three interleaved assistant-message turns so `assistant_messages_json` must be present for every turn.
- Skill detection through a `Skill` tool call, a `SKILL.md` file read, and tool provenance.
- Failed test, code edit, passed test, commit, push, PR, compaction, tool error, permission denial, language activity, cost, and token metrics.
- Session, commit, and PR cost attribution from per-turn cost rather than cumulative turn totals.

Local `PASS` means the SQLite cache contains the expected session/turn shape, non-null assistant-message data, marker points, grouped measures, cost, token totals, and commit/PR distribution point dimensions. When the copied config contains a Datadog metrics destination with marker metrics enabled, the command can publish to that destination and print Metrics Explorer query examples.

Expected readback includes:

```text
trajectory.session.skill_invocations by skill_name: setup-markers=1, integ-validate=1, e2e-test=1
trajectory.session.tool_errors by category: command-failed=1
trajectory.session.language_activity by language: go=2, markdown=1
trajectory.session.cli_tool_count.completed_count by tool: go=1, make=1, git=2, gh=1
trajectory.session.cost.usd.total: 0.0343
trajectory.commit.cost.usd.total by branch: feature/marker-canary=0.0343
trajectory.pr.cost.usd.attributed.total: 0.0343
gen_ai.usage.input_tokens: 4300
gen_ai.usage.output_tokens: 1240
```

The expected metric tags include `environment:test`, `session_id:<id>`, `trajectory.client_source:pi`, `trajectory.client_version:marker-canary/dev`, `gen_ai.request.model:openai/gpt-5.1`, and `project_dir:trajectory-marker-canary-fixture`. Marker detail fields such as `detected_from` and `source_scope` are validated locally; they are not Datadog metric tags unless a measure explicitly maps them to bounded dimensions.

## End-to-end authoring workflow

1. Start with a narrow point and test it on recent sessions.
2. Prefer structured predicates (`fields`, `allowlist`, `denylist`) over broad regexes on raw input.
3. Add extraction only for values you need for debugging or metrics.
4. Add a measure only after the point is stable.
5. Re-evaluate a small session set, then a larger window.
6. Validate publish config before relying on Datadog dashboards.

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

- **Avoid secrets in details and dimensions.** If a regex can capture a token, rewrite it to capture only a category or redacted prefix.
- **Keep cardinality low.** Datadog metric tags should be bounded. Avoid full file paths, URLs, command lines, prompts, SHAs, random IDs, and user-provided free text.
- **Use denylist predicates for known benign cases.** For example, exclude `--dry-run`, `--force-with-lease`, fixtures, and test data.
- **Use allowlist predicates when provenance matters.** Match `source_scope` or `provenance.*` fields to limit a marker to trusted capture paths when those fields are present.
- **Use `enforced: true` only in org configs.** It intentionally prevents local overrides.
- **Prefer `emit: metric` for quantitative signals and `emit: both` only for high-value debugging signals.**
- **Keep regexes bounded and case flags explicit.** Use `(?i)` for case-insensitive matches and anchor shell commands where possible.

## Troubleshooting

- **A marker never fires.** Check the tool name, inspect whether the data is in `input`, `output`, `error`, or normalized `command`, and try a simpler `fields` predicate first.
- **A shell command marker misses commands.** `command` matches the first extracted shell command line. Use `input` if you need to inspect full raw shell JSON or multi-line input.
- **A file marker misses paths.** `file` uses paths extracted from common input keys. Use `fields` on the exact structured input path when a tool uses a custom key.
- **A range does not fire.** Confirm each point fires independently, then check ordering, bracket end conditions, or correlation windows.
- **A metric is missing in Datadog.** Verify the measure emits a non-zero value, marker publishing is enabled for the destination, `trajectory publish validate` succeeds, and the session was re-evaluated after config changes.
- **A dimension is missing.** Confirm the point detail exists, the dimension `detail_key` matches exactly, and cardinality/length limits did not drop the value.
- **A local override is ignored.** Check whether an org marker with the same name is `enforced: true` and inspect the resolver order above.
