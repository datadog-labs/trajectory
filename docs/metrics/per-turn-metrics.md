## Per-Turn Metrics

A turn is one user prompt and the agent's work in reply to it. Trajectory
sends per-turn metrics when a turn completes.

Some providers record a reasoning-effort setting, such as `high`, for a
request. When the provider record has this label, every metric with
`trajectory.trace_type:turn` also carries `gen_ai.request.reasoning_effort`.
Trajectory lowercases the label and drops labels that are longer than 32
characters. Session metrics do not carry this tag. They do not copy the
setting of the last turn. Trajectory also stores the label in the
`turns.reasoning_effort` column of the local SQLite database, so you can
group turns by it locally.

### Turn IDs

`trajectory.turn_id` is unique, but the numbers can have gaps. Trajectory
skips an ID that it reserved for a turn that never happened. To count turns,
count distinct turn IDs. Do not read a turn total from the highest ID.

When Claude Code defers Stop processing, Trajectory reserves a block of IDs
for the queued prompts. A later prompt waits until those turns are rebuilt
before it takes its own ID. So each prompt and its reply stay in one turn.

Capture keeps running when Trajectory cannot read the turn counter or the
reservation lock:

- A failed reservation for queued turns sends
  `trajectory.instrumentation.derivation.fallback` with
  `reason:turn_block_reserve_failed`.
- An unreadable counter logs a local warning.

In both cases an ID can be used twice. `trajectory session audit --deep`
reports these as `duplicate_turn_id`. Trajectory keeps the local data for the
turn. It does not drop the turn.

### Turn metrics

| Metric | Type | Unit | Notes |
|---|---|---|---|
| `gen_ai.usage.input_tokens` | count | token | Sent when the value is greater than zero. For model and `query_source` tags, see [Grouped per-turn metrics](#grouped-per-turn-metrics). |
| `gen_ai.usage.output_tokens` | count | token | Sent when the value is greater than zero. For model and `query_source` tags, see [Grouped per-turn metrics](#grouped-per-turn-metrics). |
| `gen_ai.usage.cache_creation_tokens` | count | token | Cache-write tokens. Sent when the value is greater than zero. For model and `query_source` tags, see [Grouped per-turn metrics](#grouped-per-turn-metrics). |
| `gen_ai.usage.cache_creation_5m_tokens` | count | token | Cache writes billed at the 5-minute TTL rate. Sent when the value is greater than zero and the client reported the TTL split. |
| `gen_ai.usage.cache_creation_1h_tokens` | count | token | Cache writes billed at the 1-hour TTL rate. Sent when the value is greater than zero and the client reported the TTL split. |
| `gen_ai.usage.cache_read_tokens` | count | token | Sent when the value is greater than zero. For model and `query_source` tags, see [Grouped per-turn metrics](#grouped-per-turn-metrics). |
| `trajectory.turn.completed` | count | turn | One replay-safe point for each completed turn. Use it to count turns. Backfill counts a turn only when its stored `turn_end` event exists. It never infers a completed turn from cost or activity. |
| `trajectory.turn.number` | gauge | turn | The turn number, when known. Historical replay keeps the recorded number, which can have gaps. Use `trajectory.turn_id` to match a turn to its source. Do not use this gauge to count turns. |
| `trajectory.turn.cost.usd.additive` | count | USD | Turn cost. For spend totals, use `sum:...as_count()` with the v2 attribution filters. For model, `query_source`, and `agent_role` tags, see [Grouped per-turn metrics](#grouped-per-turn-metrics). |
| `trajectory.turn.web_search.requests.additive` | count | request | WebSearch requests in the turn |
| `trajectory.turn.web_search.cost.usd.additive` | count | USD | WebSearch cost in the turn |
| `trajectory.turn.duration_ms` | gauge | ms | Turn duration at completion, when Trajectory can calculate it |
| `trajectory.turn.duration_ms.total` | distribution | ms | One duration sample for each completed turn |
| `trajectory.turn.thinking_tokens` | count | token | Reasoning (thinking) tokens, when the provider reports them |
| `trajectory.turn.files_modified.additive` | count | file | Edit and write operations. It counts operations, not distinct files. |
| `trajectory.turn.files_read.additive` | count | file | Read operations. It counts operations, not distinct files. |
| `trajectory.turn.file_work.weight.additive` | count | byte or operation | File-work evidence, on by default. Tags: `file_path` (relative to the repository), `lens:read` or `lens:intermediate_edit`, `weight_unit`, and `evidence_status`. Each turn sends at most 25 paths. Other paths go into `_other`. See [File-Work Indicators](file-work-indicators.md). |
| `trajectory.subagent_usage_status` | count | subagent stop | Subagent stop reports, tagged `trajectory.subagent_usage_status` with `complete`, `partial`, or `unavailable`. The value says how complete the child's usage data is. Child usage that arrives later replaces an `unavailable` report once. This metric measures data quality. It is not a cost metric. |
| `trajectory.turn.compactions.additive` | count | compaction | Context compactions in the turn |
| `trajectory.turn.lines_of_code.count` | count | line | Lines added and removed in the turn, tagged `type:added` or `type:removed` |

#### Token corrections

Trajectory can correct token counts after a turn. The rule "sent when the
value is greater than zero" covers normal turn usage. Correction points are
the exception.

At session end, Trajectory can read different usage for a completed turn than
the hook recorded. It then sends two points for each `gen_ai.usage.*` value:

1. A negative point that cancels the original value.
2. A positive point with the corrected value.

Both points carry the turn completion time, not the time of the correction. A
single point can be negative. Any time bucket that contains the turn sums to
the corrected value, which is never negative. Releases before v0.6.0-beta used
the correction time, so a later bucket could sum to less than zero.

With `claude_turn_token_settle` on, the first value sent has already been
checked against the transcript. See
[Claude Code turn token settle](#claude-code-turn-token-settle). Signed
corrections then happen only for real late changes. Trajectory never sends a
correction older than the live ingestion window as signed points. See
[Corrections outside the live window](#corrections-outside-the-live-window).

#### Lines of code

Trajectory counts lines of code only from direct evidence:

- For edit and patch tools, it uses the old and new text, or the patch.
- For whole-file writes in agy, GitHub Copilot CLI, OpenCode, and Pi, it
  compares the project file before the write with the new content. Files
  above a size limit are skipped.

Trajectory keeps only the added and removed counts. A repeated or retried
post-tool hook does not count the change twice. Trajectory reports no line
counts for these cases:

- unsafe paths and symlinks
- files that are too large
- failed tools
- tool calls without an ID
- rows that come only from provider history

### Grouped per-turn metrics

These metrics send one data point for each value of their dimensions.

| Metric | Type | Dimensions |
|---|---|---|
| `gen_ai.usage.{input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens}` | count | `gen_ai.request.model` and `query_source`, when the turn's per-request usage adds up to the turn total. Claude subagent totals also carry `agent_role:child`, and the parent's points carry `agent_role:parent`. |
| `trajectory.turn.cost.usd.additive` | count | `gen_ai.request.model` and `query_source`, when every request has a native cost and the costs add up to the turn total. Complete Claude subagent totals also carry `agent_role:child`. If any subagent cost is missing, Trajectory sends only the parent point. |
| `trajectory.turn.tool_uses` | gauge | `tool_name` and `tool_type`. MCP calls also carry `mcp_server`, `mcp_tool`, and `mcp_source_scope` when Trajectory can find them. Newer points also carry `signal_confidence`, `identity_confidence`, `attribution_reason`, `lifecycle_coverage`, and `tool_outcome`. Older history may not have these tags. |
| `trajectory.turn.tool_uses.additive` | count | The same dimensions as `trajectory.turn.tool_uses`. Use it for tool-use totals over long time ranges. |
| `trajectory.turn.elicitations.additive` | count | Completed built-in elicitation tool calls, which ask the user a question |
| `trajectory.turn.permission_prompts.additive` | count | `decision`, `permission_mode`, and `approval_path`. Use it for prompt totals over long time ranges. |
| `trajectory.turn.tool_decision` | count | `tool_name`, `decision`, `source`, `permission_mode`, and `approval_path`. One point for each recorded `permission_result`. Trajectory never infers an approval. |
| `trajectory.turn.code_edit_tool.decision` | count | `tool_name`, `decision`, `source`, `permission_mode`, `approval_path`, and `language`. One point for each recorded `permission_result`. Trajectory never infers an approval. |
| `trajectory.turn.errors.additive` | count | `category`. Use it for error totals over long time ranges. |

#### Model calls the transcript does not have

Some captured model calls are not in the client transcript's usage, for
example Claude Code's session title generation. Claude Code capture decides
which captured calls a turn's usage leaves out and records them on the turn's
`turn_end` and its corrections. A call is left out only when it has a
provider response ID that neither the turn nor its subagents recorded. No
subagent of the session may still be running when the turn ends. Every path that
publishes the turn reads that record, so live publication, session end,
recovery and backfill count the same calls. A turn without the record, such as
one captured before this, has no such calls.

Each recorded call adds its own points to the turn's `gen_ai.usage.*` token
counts and to `trajectory.turn.cost.usd.total` and
`trajectory.turn.cost.usd.additive`. These points carry
`trajectory.cost_component:captured_call`, the call's
`gen_ai.request.model`, and its `query_source` when it has one. The marker
keeps them apart from the turn's own points, which keep the transcript's
figures. A query that sums a turn's points adds both. A query that excludes
the marker sees only the turn's. Each model and `query_source` gets
one cost point. It carries the pricing tags the calls recorded, or says it is
the sum of their request attributions when they were priced differently. The
calls' known cost is added to the session's cost. A call with no known cost
gets token points only and marks the session cost incomplete. So does a turn
that recorded more such calls than it lists.

The local SQLite database stores each turn's recorded calls with the turn. A
session's local cost includes their known cost, so it equals the published
session cost. Cost reconciliation expects each turn's cost and its calls'
cost, which is what the turn's published points add up to. Local views that
add up turn costs count a turn's calls with it, too: patterns reports, cost
reports and the local trace views. A turn whose calls include one with no
known cost has a partial cost there.

#### How tool-use values add up

Trajectory counts each tool call once. This includes calls with both a
request and a result, calls with only one of them, and calls with no phase.
Sometimes a trusted turn total is larger than the calls Trajectory can name.
Trajectory then sends the difference as `tool_name:unknown`. The sum of all
grouped values for a completed turn equals `trajectory.turn.tool_uses.additive`
for that turn.

Low confidence or partial lifecycle data changes the tags. It never stops a
call from being counted, and it never changes the metric name. Points with
different confidence, lifecycle, or outcome tags stay separate. When an older
and a newer Trajectory version both report the same call, Trajectory counts it
once.

#### Claude Code native tool timing

For Claude Code, a `native_tool_timing` event can refine the tool-use and
decision values. This event comes from Claude Code's own OTel tool spans.
Trajectory joins it to the tool call by `tool_use_id`.

- If the hooks left `tool_outcome` as `unknown`, the event's result fills it.
  A lost PostToolUse hook is one example. `lifecycle_coverage` and
  `attribution_reason` keep their observed values.
- The event's permission decision refines the `decision` and `source` of an
  existing Claude `permission_result`.
- For an accepted user prompt, `source` takes Claude's user value from
  `permission.source_detail`: `user_permanent` or `user_temporary`. Without
  that detail, `source` is `user_temporary`. This replaces the unrefined
  `source:unknown`. Events recorded before `decision_source` existed showed
  `source:config` instead.
- For a rejected prompt, `source` is `user_reject` or `user_abort`.
- Config and hook decisions keep their native `source`.
- An `unknown` decision or source refines nothing. Headless Claude Code
  records `unknown` for allow rules, hook allows, bypass mode, and a missing
  allow rule.

Native evidence never adds a tool call, prompt, or decision. Without it, the
values do not change. These two metrics cannot be corrected after Trajectory
sends them. So an event marked `after_turn_publish:true` does not refine them.
That mark means the event arrived after Trajectory released the turn. A late
repeat of an event never replaces the earlier one.

### Querying totals

- For dashboard totals, use the `.additive` counts with `.as_count()`.
- For percentiles, use only current distributions.
- For counts per tool, group `trajectory.turn.tool_uses` by `tool_name`, or by
  `tool_type` to compare clients.
- To get the tool-call total for a turn, sum
  `trajectory.turn.tool_uses.additive{*}` across all attribution tags.

Turn gauges are samples taken at turn completion. Do not sum gauge rollups
over a long time range as if they were event counts. Use additive or count
metrics, or the completed-count session metrics where they exist. The
exception is a dashboard that selects one point for each turn.

#### Tool names

Trajectory maps common coding-agent tools to one standard `tool_name` and one
set of input keys. For example, `read` becomes `Read`, `path` becomes
`file_path`, and `exec_command` becomes `Bash`. When the name changes, the
session JSONL and Event Stream records keep the source name in
`native_tool_name`. Specialized extension tools keep their own names. If
Trajectory cannot classify a tool, `tool_type` is `unknown`.

At publish time, Trajectory also maps known aliases in older records. Metric
points already stored in Datadog keep the tags they were sent with.

#### MCP tags

Trajectory takes MCP tags from MCP information that the client reports. It
removes unsafe values first. If the client reports none, Trajectory reads the
`mcp__<server>__<tool>` naming pattern. MCP tags never contain tool
arguments, input, or output. A call without `mcp_server` may still be an MCP
call.

#### How tool calls are paired

Trajectory publishes every tool call it sees, even when the evidence is weak.
It pairs request and result events by `tool_use_id`. If a result has no ID,
Trajectory can pair it with a recent request that has the same tool name.
Requests and results without a pair stay visible. An event with no phase
counts as one call. When a trusted turn total is larger than the named calls,
the difference goes to `tool_name:unknown` with
`attribution_reason:turn_aggregate_fallback`.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).

### Per-request prompt size

`trajectory.request.prompt_tokens` is a distribution. It has one sample for
each model request that Trajectory recorded. It measures how much prompt
context the request used, including cached input:

```
prompt_tokens = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
```

A 45k-token prompt adds a 45k sample, even when most of its input is cached.
The value is the usage the provider reported after the request. It is not the
model's context limit. It can also differ from the estimate a client shows
before the request.

#### How the value is calculated

Trajectory adds its normalized input, cache-read, and cache-write token
counts. These counts do not overlap. The sample leaves out output tokens and
reasoning-output tokens. It does not add the cache-write TTL split a second
time.

Stored Gemini CLI sessions record input tokens with cache reads included. For
those sessions, Trajectory subtracts cache reads before it applies the
formula. Gemini CLI capture is
[retired](../SUPPORTED-CLIENTS.md#gemini-cli-retired), so this applies only
to backfill and replay of those sessions. Their `gen_ai.usage.input_tokens`
turn metric still includes cache reads, as it did when it was first sent.
Input from other clients, including clients that use Gemini models, already
excludes cache reads. Trajectory uses it as is.

#### When samples are sent

Trajectory sends the samples when the turn completes. Each sample keeps its
own request size, source timestamp, model tag, and `query_source` tag. The
usual user and client tags also apply. Two requests of the same size count as
two samples. Trajectory does not add a request ID tag.

Trajectory leaves a request out in these cases. It never replaces the request
with zero or with a turn total.

- An input or cache count is missing.
- The prompt total is zero or not valid.
- The request has no recorded sequence number or timestamp.

Sources that report only turn totals send no samples. Historical backfill
sends no samples. So coverage depends on the request records that each client
captures. The `gen_ai.usage.*` counters do not change.

The usual metric privacy and destination settings apply. Trajectory never
exports prompt content.

#### Querying prompt size

Turn on Datadog distribution percentiles for this metric before you query it.
For example:

```
p50:trajectory.request.prompt_tokens{trajectory.client_source:pi} by {trajectory.user}
p90:trajectory.request.prompt_tokens{trajectory.client_source:pi} by {trajectory.user}
```

These queries show one percentile for each time bucket. To get one value for
the selected time range, use a distribution percentile over that range. Do
not average the bucket percentiles. Do not add percentiles of the separate
usage counters.

### Cache-Write TTL Breakdown

Providers price cache writes by time to live (TTL). A 5-minute write and a
1-hour write cost different multiples of the input rate.
`gen_ai.usage.cache_creation_5m_tokens` and
`gen_ai.usage.cache_creation_1h_tokens` show that split, so you can price
cache writes from metrics.

These two counters are sent in addition to
`gen_ai.usage.cache_creation_tokens`. That counter keeps its name, its
`count` type, and its combined total. The TTL points never change it.

The TTL counters exist only when the client reported the split. A missing
value means "not reported". It does not mean zero. If the client reported
only the combined total, the turn has no TTL point. For example, a missing
1-hour series does not mean that there were no 1-hour writes.

Coverage starts when a client version that reports the split starts writing
sessions. For Claude Code, coverage starts with Trajectory's 2026-07-20
capture change. Earlier sessions have only the combined counter. Trajectory
does not backfill older sessions.

So `sum(5m) + sum(1h)` equals `sum(collapsed)` only inside the covered time.
Before that time, the TTL counters cover only part of the cache writes. Do not
treat them as a complete split over a range that includes the start of
coverage. Do not calculate a 1-hour total by subtracting the 5-minute series
from the combined counter.

The TTL counters are part of the stable metric contract.

### Human-wait additive measurements

These metrics measure how long a turn waited for a person. They are on by
default. No feature flag controls them. The usual metric, privacy, and
destination settings apply.

| Metric | Type / unit | Value |
| --- | --- | --- |
| `trajectory.turn.permission_wait_ms.additive` | count / ms | Total time covered by observed permission waits, clipped to the completed turn. Overlapping waits count once. |
| `trajectory.turn.elicitation_wait_ms.additive` | count / ms | Sum of the measured durations of separate question and MCP requests, clipped to the completed turn |
| `trajectory.turn.duration_ms.excluding_human_wait.additive` | count / ms | Wall-clock turn time minus the time covered by all observed human waits |

Use `.as_count()` for sums. Divide by 1,000 to get seconds.

For example, a 60-second turn has a 20-second wait and a 15-second wait. The
two waits overlap for 5 seconds, so together they cover 30 seconds. The turn
adds 30,000 ms to the adjusted duration.

- Separate questions that run at the same time keep their summed request
  time.
- Automatic approvals stay in the adjusted duration.
- Trajectory never uses provider duration fields as the clock for these three
  values.

#### Coverage and timing tags

Publication, backfill, and local session JSON read these values the
same way, from the `turns[].human_wait` data. Two tags describe the data:

- `measurement_coverage` is `complete`, `partial`, or `missing`.
- `timing_provenance` is `measured`, `tool_boundary_proxy`,
  `permission_estimate`, `mixed`, or `missing`.

`duration_basis:wall_clock` names the source clock. A partial adjusted value
removes only the waits that Trajectory observed. Complete coverage needs a
`human_wait_capture_complete:true` marker and valid timing for every observed
request. Current client integrations do not claim complete coverage. A missing
measurement is null in local data and is left out of exported metrics. A
valid zero is kept.

`trajectory publish metrics audit` rebuilds these values from the stored
session events. It keeps the same difference between missing and zero. The
audit compares signed additive rows as counts. It still checks their values,
tags, producer source, and delivery status.

#### How each client is measured

- Claude Code's `Elicitation` and `ElicitationResult` hooks record the request
  ID, MCP server, enclosing tool ID when present, action, and timestamps. The
  action is `accept`, `decline`, `cancel`, or `unknown`. The hooks do not
  record prompts, schemas, answers, or URLs.
- An MCP request inside a known question tool replaces the question tool's
  estimate. Separate MCP requests count separately, in the turn where they
  complete.
- Trajectory cannot pair a start and an end without an ID.
- OpenCode marks a matched native permission response as `measured`.
- Other clients use a labeled estimate: the time from permission request to
  tool result, minus the tool's run time. A failed or rejected tool can use
  this estimate without a run time. A successful tool without a run time stays
  unknown. A match on tool name alone stays unknown.

For a Claude Code permission request with a `native_tool_timing` event,
Trajectory uses Claude Code's own blocked-on-user interval:

- A user decision adds the time from `blocked_start` to `blocked_end`,
  clipped to the turn, with `timing_provenance:measured`.
- Trajectory does not use the provider's `wait_ms` as the clock.
- Config and hook decisions are automatic, so they are left out, like
  `prompted:false`.
- Trajectory ignores a decision other than `accept` or `reject`, and a source
  other than `user`, `config`, or `hook`. Headless `unknown` is one example.
  The existing estimate and labels stay.
- Native evidence never adds a request, so `measurement_coverage` keeps its
  meaning.

Late native events correct the turn through the `human_wait_v1` correction
record. This includes events marked `after_turn_publish:true`. Repeats share a
`source_event_id`, and the last complete event wins. A late repeat never
replaces evidence written before the turn was published. If you turn off
`claude_native_trace_enrichment`, publication, the metrics audit, backfill
replay, and local session JSON all ignore native timing.

#### Corrections and history

Each value uses the original turn completion time. Corrections go through the
shared correction record. Trajectory keeps wait boundaries and tool run times
for the final session check. If that evidence is removed, Trajectory marks
the check incomplete. It does not treat the evidence as missing capture, and
it does not reverse a valid live value.

Sending the same final data again adds nothing. Changed evidence produces
signed corrections to the value or the tags.

Trajectory sends these values for past turns only when all of these are true:

- The stored events have the wait boundaries.
- The turn has a valid clock.
- The destination confirms historical ingestion.
- Privacy settings allow the data.

Trajectory does not rebuild missing history from whole MCP run times or
counts. Optional distributions are never rebuilt for past turns.

#### Related session totals

Six session `.completed_count` totals do not depend on gauge export. They
count permissions denied, interruptions, frustration-language matches,
destructive commands, infrastructure changes, and commands that match secret
patterns. Trajectory leaves out zero values for these totals.

### Activity and execution contract

These rules are on by default. No feature flag controls them.

`trajectory.turn.subagents` counts confirmed subagent launches. Each point
has the time its turn ended, the same time as the turn's
`trajectory.source_completed_unix` tag. A change to a count older than an
hour follows
[Corrections outside the live window](#corrections-outside-the-live-window).
An example is a turn sent again with a new version tag. A count an earlier
release wrote is never corrected at a different time. That release stamped
counts with their send time, so the earlier point may hold part of the count.
Datadog keeps the count it holds, and the change is counted as a
`late_turn_correction_cell_unverified` gap. Its points
carry `trajectory.activity_execution_contract:confirmed_v1`. Points without
that tag are older data from a proxy based on Agent-tool markers. That proxy
stopped on 2026-09-24. For any population or time range, select one of the
two. Never combine the old and new data.

The `trajectory.subagent_capture_status` tag is `complete`, `incomplete`,
`unsupported`, or `unknown`.

- A confirmed launch still counts when capture is incomplete.
- Trajectory sends a zero count only when capture is known to be complete.
- A missing series does not mean zero.
- Trajectory matches the different names for the same launch, including
  duplicate reports from the client and from an extension. The launch counts
  once.
- Stop reports, parent links, and tool intent never count as a launch.

`trajectory.subagent_usage_status` counts subagent stop reports by how
complete their token and cost data is: `complete`, `partial`, or
`unavailable`. It does not count launches. It does not give one status for
each turn.

`trajectory.turn.errors.additive` prefers a category summary from the client
over a count of failed tools without duplicates.

- An empty summary means zero errors.
- Missing capture stays incomplete.
- The categories are `command-failed`, `user-rejected`, `edit-failed`,
  `file-changed`, `file-too-large`, `file-not-found`, and `other`.
- When a complete summary exists, Trajectory sends every category, including
  categories with zero.
- Corrections use signed values.

### Tool decisions and permission prompts

`trajectory.turn.tool_decision` and `trajectory.turn.code_edit_tool.decision`
count one decision for each recorded `permission_result`. A tool call without
a `permission_result` adds no decision point. This includes a failed call.
Trajectory does not infer an approval because a tool ran. To count calls, use
`trajectory.turn.tool_uses`.

Earlier releases added an inferred accept point for such calls, with these
tags: `decision:accept`, `source:config`, `permission_mode:not_captured`, and
`approval_path:inferred_legacy`. Those points stay in your history. To compare
data across that change, exclude `permission_mode:not_captured`. Only inferred
accepts carry that tag. Do not use `approval_path:inferred_legacy` to find
them. An observed decision with a `config` source and no recorded approval
path also gets that tag.

A `permission_result` written after the turn completed is sent at session
end. A denial that Claude Code records at Stop is one example.

#### The source tag

The `source` tag uses Claude Code's native `tool_decision` source values. It
adds one value that Claude Code does not have: `user_session`.

When a `permission_result` has a `decision_source` field, Trajectory uses one
mapping for every client. Live publication and the metrics audit share it.
The mapping uses who decided and, for a person's approval, the scope in
`decision_scope`:

| `decision_source` | Decision and `decision_scope` | `source` tag |
| --- | --- | --- |
| `user` | rejected | `user_reject` |
| `user` | approved, `once`: this request only | `user_temporary` |
| `user` | approved, `session`: also later matching requests until the session ends | `user_session` |
| `user` | approved, `always`: saved as a standing rule | `user_permanent` |
| `user` | approved with no scope stated, or a timeout or cancel | `user` |
| `policy` (a standing rule or mode) | any | `config` |
| `hook` | any | `hook` |
| `classifier` (an automated reviewer) | any | `auto_classifier` |
| `unknown` or anything else | any | `unknown` |

Trajectory never reports a scope that the event did not state. `unknown`
means that nobody observed who decided. For example, Claude Code can record
an allow that Trajectory inferred because the tool ran after a permission
prompt.

Some clients state the scope directly:

- Codex native OTel capture takes the scope from Codex's decision.
  `approved` is `once`. `approved_for_session` is `session`.
  `approved_with_amendment` and `approved_with_network_policy_allow` are
  `always`, because Codex saves a rule that allows later matching requests.
- A record refined from Claude native tool timing states `once` for
  `user_temporary` and `always` for `user_permanent`. This gives the same tags
  that Claude Code reports. Its other native sources are sent as Claude Code
  reported them: `user_reject`, `user_abort`, `config`, `hook`, and a bare
  `user`.

Events written before `decision_source` existed keep their original mapping.
`inferred` becomes `config`, and a user approval becomes `user_temporary`. So
when Trajectory sends an old turn again, it sends the same points as before.
It does not add new ones.

#### Late and repeated decisions

A decision counts once, in the place where Trajectory observed it.

A late `permission_result` that is the first one for its `tool_use_id` in the
turn counts its decision. It also counts its prompt in
`permission_prompts.additive`. This applies whether the call already
completed or never ran. Examples:

- A Claude Code allow resolved at Stop, for a call that completed.
- A Codex native decision that arrives after `turn_end`.
- A denial at Stop, for a call that never ran.

A late `permission_result` that repeats an earlier one for the same call in
the same turn adds no decision and no prompt. So a decision delivered twice
counts once. The repeat stays in the session events, spans, and permission
markers. The late publish, the session-end check, and backfill all use this
rule, so they agree.

At session end, Trajectory sends each late `permission_result` as its own
`tool_decision`, `code_edit_tool.decision`, and `permission_prompts.additive`
points. The session-end check resends only the counts that the turn publish
sent. It leaves late results out, because these metrics cannot be corrected
after they are sent.

So a late decision or prompt with the same tags as an on-time one in the same
turn adds exactly one. For example, one on-time and one late `allow` prompt
total 2. An earlier version of the session-end check gave 1 + 2 = 3.

Trajectory tells a late point apart from an on-time point with the same tags
and value. It uses a local ID for the late result, which it never sends as a
tag. So repeated session-end publishes add nothing. Two late results without
a permission ID or tool-use ID can share every other field. Trajectory tells
them apart by their order in the session, so each one counts. A child agent's
late result in the parent's event stream does not count in the parent
session, as at turn publish.

Codex native decisions that arrive after `turn_end` follow the same path.
They reach Datadog at session end.

#### Replay of published sessions

Rolling reconciliation replays sessions that the live publish already sent.
Historical replay sends the same points as the live publish:

- The turn's own points hold the results written before the turn ended.
- Each late result has its own decision and prompt points, with the same
  identity as the live points.

So replaying a session that this release published live adds no rows.

Rolling reconciliation picks up a turn when it is one to two days old, even
if its session has not ended. The live publish sends late permission points
only at session end. It does not check for rows that a replay added. So while
the live session-end publish is still to come, replay leaves the late points
to it. When the final live publish is recorded, replay sends the late points
again and matches them to the live rows. A session with no live publisher is
one that was imported, came from another machine, or was already finalized.
Replay sends the late points for such a session itself. The turn's own points
and all other metrics replay as usual.

#### Known limits

These cases can count a decision or prompt twice, or miss it:

- One turn ID with two completion events, published by two turn reads. Replay
  dates the turn's permission points with the last completion. The first read
  dated them with the first completion. So replay adds a second copy of each
  on-time decision and prompt. If another call's first result falls between
  the two completions with the same tags, the live publish itself holds two
  totals. This has been seen with Codex. Claude Code capture drops a second
  Stop, so it is not affected. Other clients without the same guard may be
  affected.
- A live session that was not registered for publishing when replay ran.
  This happens when its registry write failed and the publisher had not yet
  marked the session. Replay sends its late points, and the session-end
  publish sends them again.
- A session that stays registered but never completes its final publish. A
  crashed incognito session is one example, because stale-session recovery
  skips it. A final publish held after an unclear export is another. Replay
  never sends its late points.

#### Sessions published by 0.6.0 or earlier

Earlier releases counted an inferred accept for a completed call. So 0.6.0
left out a late decision for that call. Session events do not record which
release published a turn. So Trajectory cannot tell that an inferred accept
was already sent. This release can send a turn again, for a session that spans
the upgrade or a backfill of it. The observed decision can then be
added next to the earlier inferred accept. To count each call once, exclude
`permission_mode:not_captured`.

0.6.0 also put a late result's prompt into the turn's own points. When the
call never ran, it put the decision there too. It also counted the prompt of a
repeat. This affects a session only when all of these are true:

- 0.6.0 or an earlier release published it.
- It has a late permission result.
- This release replays it while it is still inside the reconciliation window.

For such a turn, replay does one or both of these:

- Where 0.6.0's turn point has a different value from the value this release
  calculates, replay skips the point. 0.6.0's value stays, and no row is added
  for it. The metric outbox records one `producer_fidelity_conflict` drop. The
  reconciliation request does not fail.
- Replay adds the late result's own decision and prompt points next to 0.6.0's
  rows. If 0.6.0's turn points already held that decision or prompt, it is
  counted twice. That gives one extra `tool_decision` or
  `permission_prompts.additive` row for each late result.

A session that this release published, with turns that each complete once,
counts once. This is true however often it is replayed, and whichever publish
runs first.

#### Audit

`trajectory publish metrics audit` applies the same rules to the session
JSONL. So the permission points it expects match the published rows.

Without the JSONL, the audit uses the local SQLite data. There, a tool call
counts the decision and prompt of its earliest `permission_result` marker.
Every tag comes from the same function that live publication uses. A later
marker for the same call is a repeat. A call without a marker counts no
decision. A marker holds only what its `permission_result` recorded. So the
audit cannot see a permission mode or approval path that only the earlier
`permission` request event stated.

### Turn/session aggregation contract

Each built-in turn metric has a fixed rule for how it rolls up to a session.
Trajectory does not guess the rule from the metric type. There are two kinds
of turn metric:

- **Additive metrics.** Their turn values add up to a session total. The total
  matches a named session metric, the record of completed turns, or a defined
  subset of that record.
- **Observations.** These record a position, a latest value, a ratio, or one
  sample from a population. Do not add them to get a session total.

This matters even for count metrics. For example, the number of file edits
and the number of turns that touched files are counted at different levels.

#### Check local session totals

Run this command to check your local data:

```bash
trajectory session audit --source-data --db <cache.db>
```

The check recalculates these values for each completed session from the
`turns` table:

- turn count
- tool calls
- input tokens
- output tokens
- total tokens, including cache tokens
- cost

It compares the results with the `sessions` table. It checks input and output
tokens separately, so an error in one cannot hide behind a matching total.
The `session_turn_aggregate_drift` check must pass.

#### Marker metric pairs

Marker metrics come in turn and session pairs. Both metrics in a pair come
from the same stored point and range rows. They use the same source, outcome,
and grouping. A completed session's `.completed_count` metric is a count of
the final session value. For sums over a long time range, use the
`*.additive` metric. Trajectory does not send a second session count point
for it.

#### When turn points are sent

Trajectory calculates marker turn metrics (`trajectory.turn.*`) after it saves
the completed turn. It sends only that turn's points. If it finds more turn
count points later, it sends them in the normal session-end cycle. Built-in
token, cost, completion, and other count and gauge turn metrics follow the
same rules. They are replay-safe: sending them again does not double count.
Their `trajectory.session.*` rollups are still sent at session end.

Distribution samples are sent once. Trajectory does not resend them, because a
changed sample would add a second member to the population. It would not
correct the first one.

For Datadog destinations, session end checks every completed turn that
Trajectory still keeps. It sends each replay-safe point that Datadog has not
received yet. Points already sent at turn end are not sent again. Each point
keeps its turn completion time.

A metric publish attempt fails when a point is still waiting, failed, or was
rejected. It also fails when the final check is cut short or a late
correction is not valid. Trajectory then sends
`trajectory.instrumentation.publish.attempt` with `signal:metric` and
`outcome:failure`. The session-end publish tries again later.

If Datadog replies with HTTP 429, Trajectory keeps the point and retries it.
A timeout, network error, or 5xx reply can happen after sending started.
Trajectory then marks the point failed and never resends it automatically.
Datadog may already have the point, and a resend could count it twice.

### Claude Code turn token settle

Claude Code's Stop hook reads token usage from the end of the transcript. The
transcript may still be incomplete at that time, so the hook's value is
provisional. The transcript is the source of truth.

Without a settle step, session end corrects the turn later with signed rows.
Those rows can arrive days after the turn, outside Datadog's live OTLP window.
A correction dated at correction time can also make daily sums negative.

The `claude_turn_token_settle` flag is on by default. It holds each Claude
Code turn until Trajectory checks its usage against the transcript. The first
of these events releases the turn:

1. The next prompt.
2. A quiet transcript: no writes for 3 seconds after the turn's last assistant
   record has a stop reason.
3. Session end.
4. A deadline. The default is 30 seconds. To change it, set
   `TRAJECTORY_CLAUDE_TURN_SETTLE_DEADLINE` to a Go duration, up to 5 minutes.

Every turn in the waiting batch waits, including its trace spans.

A second hold is also on by default. It applies only to Claude Code sessions
that send native trace spans to Trajectory. The turn and its trace wait until
each tool call has a `native_tool_timing` event. The wait is at most 60
seconds after `turn_end`, or 5 seconds after session end. This hold runs after
the settle hold. It can keep back a turn that the settle hold released. It
never releases a turn that the settle hold still holds.

If you turn off `claude_turn_token_settle`, Trajectory sends the Stop hook's
provisional usage right away.

#### How transcript requests match turns

Trajectory matches transcript requests to turns by prompt and by Stop cycle.
It never matches by position in the transcript.

- A transcript prompt that matches a UserPromptSubmit hook prompt belongs to
  the turn that the hook opened.
- Claude Code can submit a queued follow-up prompt without a hook. That prompt
  belongs to the Stop cycle that covered it. Its usage is added to that turn,
  so it is not lost.
- A transcript turn that starts before capture started belongs to no turn.
  Trajectory did not observe it. Either capture started during the session,
  or the session is a fork. A fork's transcript starts with a copy of the
  earlier conversation.
- Some transcript turns after capture started match no hook prompt. Capture
  missed such a turn when it starts more than a second before the first hook
  prompt of the Stop cycle it would join. Hooks can miss a turn, for
  example while they fail. Trajectory writes it as a `turn_end` of its own
  with `recovered_from_transcript:true`. The event carries the transcript
  turn's time, usage, model, service tier and price. The next recorded turn
  keeps only its own usage.
- A missed turn is recovered only when it has a prompt record and its usage
  is observed and not zero. Otherwise it counts toward the next recorded turn,
  as it does when that turn's Stop cycle has no hook prompt.

Live settle and session end both write recovered turns. The recovered
`turn_end` keeps the transcript prompt time in `recovered_prompt_at`. A later
run matches the transcript turn to it by that time, so each missed turn is
written once. Its turn ID is reserved above the turn counter, so it is higher
than the ID of the turn that follows it in time. The startup token backfill
does not add missed turns. It fills a recorded turn with that turn's own usage.

Capture start is the earliest time among the records that a hook writes to
the session file. These are `session_start`, a hook `user_prompt`,
`tool_use`, and `turn_end`. Usually this is the time of `session_start`. Other
records do not count, because some carry the time of a transcript entry. A
recovered `turn_end` does not count either.

#### The settled value

After the check, Trajectory appends one `turn_token_correction` event to the
session. The event has `token_source:turn_settle_validation` and
`publication_baseline:true`. Trajectory appends it even when the values
already match, so the record shows where the published value came from.

Trajectory applies this baseline before it sends anything for the turn. So the
first value sent is the checked one, and it keeps the turn completion time.
The session-end check reuses the same records. A later real correction is
signed against the baseline.

Between turns, Trajectory reads only the new part of the session file and
transcript. So the cost of the check grows in line with session length. A
replaced or shorter transcript, or a restart of the Trajectory background
service, causes one full reread.

#### When the check falls back

In these cases Trajectory keeps the provisional value:

- The match is unclear or does not agree. Two prompts compete for a match,
  or a hook prompt is missing from the transcript.
- The transcript uses the older running-total format.
- The transcript is larger than 64 MiB.
- The session is closed.
- The deadline passes before the last assistant record arrives.

Trajectory then records `trajectory.instrumentation.derivation.fallback` with
a `settle_*` reason, such as `settle_timeout` or `settle_unaligned`.

#### Session-end check

The session-end check matches turns by prompt in the same way, whether the
flag is on or off. It compares the transcript with the `turn_end` and its
latest correction.

- An interrupted last turn has a hook prompt but no `turn_end`. Trajectory
  matches it too and corrects it before session end writes its `turn_end`.
- A session with no recorded hook prompts cannot be matched by prompt.
  Trajectory matches it by position only when the transcript has the same
  number of turns as the record. A recorded turn is one with a hook prompt or
  a `turn_end`. Otherwise Trajectory writes no correction.

Matching by position across a queued prompt gives one reply's usage to
another turn and loses the queued reply.

#### Corrections outside the live window

Late corrections to turn tokens and cost keep the turn completion time.
Datadog stores points older than about one hour only through Historical
Metrics Ingestion. So Trajectory never sends a signed correction when its own
time, or the time of the value it corrects, is older than that window.
Trajectory checks this before it queues the correction and again before each
retry.

The `export.late_turn_correction_delivery` setting chooses what happens
instead:

- `historical` (the default): Trajectory sends the corrected total for that
  metric, tag set, and turn completion time. It sends it over OTLP to a
  destination that confirms Historical Metrics Ingestion. It never sends the
  signed rows, because Historical Metrics Ingestion replaces the stored value.
- `gap`: Trajectory always records a dropped point instead.

Trajectory calculates the corrected total from its correction record. It
uses the total only when all of these are true:

- The tag set names exactly one session and one turn.
- No privacy setting can merge the point with other points.
- The provisional live point matches the correction record.

If the destination opted out of backfill (`backfill_opt_out`), or Trajectory
cannot verify the point, the correction becomes a counted gap.

A gap has one of these reasons:

- `late_turn_correction_outside_live_window`
- `late_turn_correction_hmi_unconfirmed`
- `late_turn_correction_cell_unverified`

Trajectory reports gaps through
`trajectory.instrumentation.fidelity.outbox.dropped{reason}`. Corrections
inside the live window are still sent as signed OTLP points.

Several metrics use the same setting and the same path, for both live
publishing and backfill:

- `trajectory.turn.skill_invocations`.
- The activity counts: `trajectory.turn.errors.additive`,
  `trajectory.turn.subagents`, `trajectory.session.subagents.completed_count`
  and `trajectory.session.skill_invocations.completed_count`.
- The native human waits: `trajectory.turn.permission_wait_ms.additive`,
  `trajectory.turn.elicitation_wait_ms.additive`,
  `trajectory.turn.elicitations.additive` and
  `trajectory.turn.duration_ms.excluding_human_wait.additive`.

An old
correction to one of them is sent as the cell's corrected total. That total is
the sum of the current values that Trajectory's correction record places at
that metric, tag set, and time. When a correction
moves a value to a new tag set or time, Trajectory empties the old cell instead
of leaving the value there. Trajectory uses the total only when all of these
are true:

- The tag set names the session whose correction record holds the value.
- No privacy setting can merge the point with other points.
- Every value in the record with that tag set was written, and last changed,
  by a release that keeps each value in one cell.

An earlier unsent row for that cell is sent first, and the total follows it.
An earlier row that waits to be retried after the total was sent is not sent,
because the total includes it. While another process is still sending an
earlier row for that cell, Trajectory waits and queues the total afterwards. The total follows its
session's privacy, including a later switch to incognito.
The newer half of a moved value can fall inside the live window. Trajectory
then sends it as a signed point, but only when the old cell gets its total. These
gaps use the reasons `correction_outside_live_window`,
`correction_hmi_unconfirmed`, and `correction_cell_unverified`.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
