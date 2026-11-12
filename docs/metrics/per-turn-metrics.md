## Per-Turn Metrics

A turn is one user prompt and the agent's work in reply to it. Trajectory
sends per-turn metrics when a turn completes.

A long turn doesn't hold its usage until then. While a turn runs, Trajectory
sends what it has used so far about every 10 minutes, as `gen_ai.usage.*` token
counts and `trajectory.turn.cost.usd.additive`. Each send has a
`trajectory.turn_id` of its own, of 1,000,000 or more, and adds to the session's
totals. No other metric goes out for it, so it doesn't count as a turn. The
turn's own metrics go out when it completes, and hold only the usage not sent
yet. Add the points by session or by time. Grouping by `trajectory.turn_id`
splits a long turn into its sends.

Some providers record a reasoning-effort setting, such as `high`, for a
request. When the provider record has this label, every metric with
`trajectory.trace_type:turn` also carries `gen_ai.request.reasoning_effort`.
Trajectory lowercases the label and drops labels that are longer than 32
characters. Session metrics do not carry this tag. They do not copy the
setting of the last turn. Trajectory also stores the label in the
`turns.reasoning_effort` column of the local SQLite database, so you can
group turns by it locally.

### Turn pricing tags

Turn metrics also carry the two pricing inputs of the turn, so you can split
turn cost and tokens by them:

- `trajectory.service_tier` is the service tier the turn was priced at, such
  as `fast`, `priority`, or `standard`. It is the tier of the turn's last
  request. Claude Code, Claude Desktop, Cursor, and Codex record it.
- `trajectory.billing_lane` is the billing lane the turn was priced in. Codex
  sessions record `api` for API-key billing, `chatgpt_credits` for ChatGPT
  credits, or `unknown` when Trajectory could not read the login. A session
  that Trajectory launched through its AI gateway or Frontier always uses
  `api`.

Each tag is left out when the session did not record it. A turn without a
tier is not reported as `standard`. Sub-agent usage points
(`agent_role:child`) and captured-call points
(`trajectory.cost_component:captured_call`) leave out the turn's tier,
because those requests were priced at their own tier. They keep the billing
lane. Session metrics and the human-wait metrics, such as
`trajectory.turn.permission_wait_ms.additive`, carry neither tag. When model
names are redacted from metrics, the service tier is removed too.

A turn that an earlier release sent without these tags keeps its untagged
points. A later correction outside the live window replaces those untagged
points. See
[Corrections outside the live window](#corrections-outside-the-live-window).

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

#### Activity of a Claude Code turn without its own end

A Claude Code reply can cover prompts that you queued while the agent
worked. Trajectory gives each queued prompt its own turn ID, but only the last
of these turns ends. The activity of the earlier turns counts toward the turn
that ends:

- tool uses, and the counts that come from them
- permission prompts, decisions and waits
- questions to you and their waits
- sub-agent launches

A turn that stopped before Claude Code ended it counts toward the next turn
that ends, in the same way. Tokens, cost and the turn count do not move.

A turn after the session's last ended turn has no turn to count toward. Its
activity is sent only when Trajectory recovers the turn on its own.

Older versions sent no activity points for these turns. After you upgrade,
sums such as `trajectory.turn.tool_uses` and
`trajectory.turn.permission_prompts.additive` rise for Claude Code. Turns that
were sent before the upgrade keep the values they had.

#### A point keeps its first value

A session end and a backfill derive each completed turn again. A newer version
can derive another value for a point that was already sent. Trajectory sends
nothing more for that point. The first value stays in Datadog.

Trajectory records the difference in the local metric queue as a dropped row
with the reason `changed_after_send`. The row's value is the new value minus
the first one. `trajectory.instrumentation.fidelity.outbox.dropped` counts
these rows under `reason:changed_after_send`.

A turn that a session end has sent is final for its tool counts and its late
permission results. Suppose a newer version later counts a tool the turn did
not have, or gives a permission result a point of its own. Trajectory records
that value the same way. It adds no point at the turn's old time.

Tool uses that a stopped turn gave to the next turn are checked one turn at a
time. Older versions sent some of these uses at the stopped turn. Trajectory
sends a use at the ended turn only if no point holds it at the stopped turn.
It records only the uses that no point holds.

Two counts are the same value only when they are equal. Two other values are
the same when they differ by at most one billionth of the larger, or one
billionth when both are below 1. A cost summed in another order differs only
that much.

### Turn metrics

Every metric below also carries the [common tags](common-tags.md),
`trajectory.trace_type:turn`, and `trajectory.turn_id`. Trajectory sends them
on the publish that follows a completed turn. The "Sent when" column names any
other condition. A value of zero is not sent unless the row says so. Read
counts with `sum:...as_count()`.

| Metric | Type, unit | Meaning | Other tags | Sent when |
|---|---|---|---|---|
| `trajectory.turn.completed` | count, turn | One point for each completed turn. Use it to count turns. Backfill counts a turn only when its stored `turn_end` event exists. | `gen_ai.request.model` | Every completed turn |
| `trajectory.turn.number` | gauge, turn | The turn's number. Numbers can have gaps. Do not use it to count turns. | None | The turn number is known |
| `trajectory.turn.duration_ms` | gauge, ms | Wall-clock duration of the turn | None | Trajectory can calculate the duration |
| `gen_ai.usage.input_tokens` | count, token | Input tokens the turn used | [Grouped dimensions](#grouped-per-turn-metrics) | The value is greater than zero |
| `gen_ai.usage.output_tokens` | count, token | Output tokens the turn produced | [Grouped dimensions](#grouped-per-turn-metrics) | The value is greater than zero |
| `gen_ai.usage.cache_read_tokens` | count, token | Tokens read from the prompt cache | [Grouped dimensions](#grouped-per-turn-metrics) | The value is greater than zero |
| `gen_ai.usage.cache_creation_tokens` | count, token | Tokens written to the prompt cache | [Grouped dimensions](#grouped-per-turn-metrics) | The value is greater than zero |
| `gen_ai.usage.cache_creation_5m_tokens` | count, token | Cache writes billed at the 5-minute TTL rate | None | The value is greater than zero and the client reported the TTL split. See [Cache-Write TTL Breakdown](#cache-write-ttl-breakdown). |
| `gen_ai.usage.cache_creation_1h_tokens` | count, token | Cache writes billed at the 1-hour TTL rate | None | The same as the 5-minute row |
| `trajectory.turn.thinking_tokens` | count, token | Reasoning (thinking) tokens | None | The provider reports them |
| `trajectory.turn.cost.usd.additive` | count, USD | Turn cost. Use it for spend totals with the v2 attribution filters. | [Grouped dimensions](#grouped-per-turn-metrics), cost tags | The turn is priced. Zero is sent. |
| `trajectory.turn.cost.usd.total` | distribution, USD | One cost sample for each priced turn, for percentiles. Recorded model calls add their own samples. See [Model calls the transcript does not have](#model-calls-the-transcript-does-not-have). | Cost tags, lower-bound tags | The turn is priced and `metric_samples_turn_cost` is on, which is the default |
| `trajectory.turn.web_search.requests.additive` | count, request | WebSearch requests | None | The turn made a search |
| `trajectory.turn.web_search.cost.usd.additive` | count, USD | WebSearch cost. See [WebSearch cost](#websearch-cost). | Cost tags | The turn made a search and every search has a price |
| `trajectory.turn.tool_uses.additive` | count, call | Tool calls. Use it for tool totals. | [Grouped dimensions](#grouped-per-turn-metrics) | One point for each tool the turn called |
| `trajectory.turn.tool_uses` | gauge, call | The same value as `trajectory.turn.tool_uses.additive` as a gauge, kept for readers that still query it | [Grouped dimensions](#grouped-per-turn-metrics) | The same as the additive row |
| `trajectory.turn.errors.additive` | count, error | Tool errors | `category`, `trajectory.error_capture_status` | A category has errors in the turn |
| `trajectory.turn.subagents` | count, invocation | Confirmed subagent launches. See [Activity and execution contract](#activity-and-execution-contract). | `trajectory.subagent_capture_status` | The turn launched subagents |
| `trajectory.subagent_usage_status` | count, subagent stop | Subagent stop reports by how complete the child's usage data is. It measures data quality. | `trajectory.subagent_usage_status` | A subagent stopped in the turn |
| `trajectory.turn.files_modified.additive` | count, file | Successful Edit, Write, MultiEdit, NotebookEdit, and ApplyPatch operations, not distinct files | None | The turn modified files |
| `trajectory.turn.files_read.additive` | count, file | Read operations, not distinct files | None | The turn read files |
| `trajectory.turn.file_work.lens_weight.additive` | count, byte or operation | File-work evidence summed over the turn's files. See [File-Work Indicators](file-work-indicators.md). | `lens`, `weight_unit`, `evidence_status` | `file_work_indicators` is on, which is the default |
| `trajectory.turn.lines_of_code.count` | count, line | Lines added or removed | `type:added` or `type:removed` | The value is greater than zero |
| `trajectory.turn.compactions.additive` | count, compaction | Context compactions | None | The turn compacted its context |
| `trajectory.turn.permission_prompts.additive` | count, prompt | Permission prompts shown to the user | `decision`, `permission_mode`, `approval_path` | The turn recorded a `permission_result` that prompted |
| `trajectory.turn.tool_decision` | count, decision | Recorded permission decisions. Trajectory never infers an approval. | `tool_name`, `decision`, `source`, `permission_mode`, `approval_path` | The turn recorded a `permission_result` |
| `trajectory.turn.code_edit_tool.decision` | count, decision | Recorded decisions on code-edit tools | The same as `trajectory.turn.tool_decision`, plus `language` | The turn recorded a `permission_result` for an edit tool |
| `trajectory.turn.elicitations.additive` | count, elicitation | Completed built-in tool calls that asked the user a question | None | The turn asked a question |
| `trajectory.turn.permission_wait_ms.additive` | count, ms | Time the turn waited for permission approvals. See [Human-wait additive measurements](#human-wait-additive-measurements). | `measurement_coverage`, `timing_provenance`, `duration_basis` | Trajectory measured the turn's waits |
| `trajectory.turn.elicitation_wait_ms.additive` | count, ms | Time the turn waited for answers to questions and MCP requests | The same as the permission-wait row | Trajectory measured the turn's waits |
| `trajectory.request.prompt_tokens` | distribution, token | Prompt size of each model request, including cached input. See [Per-request prompt size](#per-request-prompt-size). | `gen_ai.request.model`, `query_source` | One sample for each live request with complete usage |

Cost tags are the v2 cost contract and cost-overlap tags in
[common tags](common-tags.md). Marker turn counts, such as
`trajectory.turn.commits` and `trajectory.turn.cli_tool_count`, and skill
metrics are in [Built-In Marker Metrics](built-in-marker-metrics.md). PR
metrics, which split a turn across the PRs it worked on, are there too.

Each successful `ApplyPatch` call adds one modified operation, even when it
changes multiple files or changes a file already modified in the turn.
Repeated completions with the same turn, agent, and tool-call ID count once.
Failed, denied, or unfinished patches do not contribute.
Completed patches without a recorded success outcome are also excluded.
The metric therefore has incomplete coverage when capture omits outcomes.
Retained patch text cannot recover whether execution succeeded.
This count needs no patch paths, so successful calls can count even when retained
input is truncated.
Updating Trajectory changes future derivation. It does not correct points
already accepted by Datadog. Rebuilding the local viewer cannot repair remote metrics.

#### WebSearch cost

Each search costs the rate card's price per search for the model of the call
that made it, at the time of that call. For example, a Claude search costs
$0.01 and a Gemini 2.5 search costs $0.035.

Some searches have no price:

- The rate card does not price the call's model.
- No model can be tied to the search, and the turn used more than one model.
  A search with no model takes the turn's model when the turn used one model.
- The turn cannot be priced for a reason that holds for every call in it.
  Examples are a client whose usage is not priced from token counts, and a
  Codex auto-review session, whose rate is not verified.

A turn with such a search sends its request count but no WebSearch cost.
The session's WebSearch cost gauge is then not sent either.

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
| `gen_ai.usage.{input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens}` | count | `gen_ai.request.model` and `query_source`, when the turn's per-request usage adds up to the turn total. Claude subagent usage also carries `agent_role:child`, and the parent's points carry `agent_role:parent`. A child's points are what each run added since the sub-agent's previous stop, from its usage facts. |
| `trajectory.turn.cost.usd.additive` | count | `gen_ai.request.model` and `query_source`, when every request has a native cost and the costs add up to the turn total. Priced Claude subagent runs also carry `agent_role:child`, at their usage-fact price. If any subagent cost is missing, Trajectory sends only the parent point. A child's points go out once for a turn and are never corrected, so a turn an earlier release sent keeps the child values it was sent with. |
| `trajectory.turn.tool_uses` | gauge | `tool_name` and `tool_type`. MCP calls also carry `mcp_server`, `mcp_tool`, and `mcp_source_scope` when Trajectory can find them. Newer points also carry `signal_confidence`, `identity_confidence`, `attribution_reason`, `lifecycle_coverage`, and `tool_outcome`. Older history may not have these tags. |
| `trajectory.turn.tool_uses.additive` | count | The same dimensions as `trajectory.turn.tool_uses`. Use it for tool-use totals over long time ranges. |
| `trajectory.turn.elicitations.additive` | count | Completed built-in elicitation tool calls, which ask the user a question |
| `trajectory.turn.permission_prompts.additive` | count | `decision`, `permission_mode`, and `approval_path`. Use it for prompt totals over long time ranges. |
| `trajectory.turn.tool_decision` | count | `tool_name`, `decision`, `source`, `permission_mode`, and `approval_path`. One point for each recorded `permission_result`. Trajectory never infers an approval. |
| `trajectory.turn.code_edit_tool.decision` | count | `tool_name`, `decision`, `source`, `permission_mode`, `approval_path`, and `language`. One point for each recorded `permission_result`. Trajectory never infers an approval. |
| `trajectory.turn.errors.additive` | count | `category`. Use it for error totals over long time ranges. |

#### Claude Code's background requests

Claude Code makes model requests of its own, such as summaries, suggestions,
session titles and compactions. They never reach its session files. Claude Code's
native metrics report them as `query_source:auxiliary`.

A session counted from its client files publishes them as their own points:

- `gen_ai.usage.*` and `trajectory.turn.cost.usd.additive` points carry
  `query_source:auxiliary` and no `agent_role`.
- Each turn's points hold what arrived since the last settled close. They do not
  say which turn caused the requests.
- The dollars are the ones Claude Code reported, because only it knew each
  request's context size, cache lifetime and speed. A model the rate card prices
  at nothing stays at nothing. A model with no rate counts tokens and no dollars.
- Native numbers for main-thread and sub-agent requests never replace the files'.
  Trajectory uses them to test whether native metrics are complete for the session.
  When they are, the sub-agent output a file's snapshot left out goes out on its own
  point, tagged `trajectory.output_source:native`.

To see the file's numbers alone, leave out `query_source:auxiliary`.

Native metrics reach Trajectory through `trajectory claude`, your own Claude
settings or an administrator's managed settings. Setup does not turn them on. See
[Supported Clients](../SUPPORTED-CLIENTS.md). Without them, the file's numbers
go out marked as a lower bound with `trajectory.usage_bound:lower` and
`trajectory.cost_bound:lower`.

#### Model calls the transcript does not have

Some captured model calls are not in the client transcript's usage, for
example Claude Code's session title generation. A session counted from its client
files does not publish these points, because the files and native metrics count
the same requests. Claude Code capture decides
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

Gemini CLI sessions stored before the history converter took cached content
out of the prompt count record input tokens with cache reads included. For
those sessions, Trajectory subtracts cache reads before it applies the
formula. Gemini CLI capture is
[retired](../SUPPORTED-CLIENTS.md#gemini-cli-retired), so this applies only
to replay of those sessions. Their `gen_ai.usage.input_tokens` turn metric
still includes cache reads, as it did when it was first sent. A request
imported since states `token_usage_provenance: gemini_prompt_less_cached_content`,
and its input already excludes cache reads.
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

Use `.as_count()` for sums. Divide by 1,000 to get seconds.

For example, a 60-second turn has a 20-second permission wait and a
15-second permission wait. The two waits overlap for 5 seconds, so together
they cover 30 seconds. The turn adds 30,000 ms to
`trajectory.turn.permission_wait_ms.additive`.

- Separate questions that run at the same time keep their summed request
  time.
- Automatic approvals are not human waits.
- Trajectory never uses provider duration fields as the clock for these
  values.

#### Coverage and timing tags

Publication, backfill, and local session JSON read these values the
same way, from the `turns[].human_wait` data. Two tags describe the data:

- `measurement_coverage` is `complete`, `partial`, or `missing`.
- `timing_provenance` is `measured`, `tool_boundary_proxy`,
  `permission_estimate`, `mixed`, or `missing`.

`duration_basis:wall_clock` names the source clock. A partial value counts
only the waits that Trajectory observed. Complete coverage needs a
`human_wait_capture_complete:true` marker and valid timing for every observed
request. Current client integrations do not claim complete coverage. A missing
measurement is null in local data and is left out of exported metrics. A
valid zero is kept.

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
`claude_native_trace_enrichment`, publication, backfill, and local session
JSON all ignore native timing.

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
has the time its turn ended. A change to a count older than an
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
mapping for every client. Live publication and backfill share it.
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

Oversight reviewer sessions, including Codex Guardian, may emit oversight
metrics without turn metrics. Session-end reconciliation accepts their completed
turns without requiring turn metric receipts. Their final projection preserves
reviewer classification and excludes ordinary session cost totals. Ordinary
sessions still require turn records for each completed turn.

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

#### A correction known before the first send

A turn's tokens and cost can be corrected before Trajectory has sent them.
This happens when a backfill publishes a retained session. The backfill
sends the turn as one point with the corrected value. It sends no signed rows
for that turn. A correction that arrives after the turn was sent follows the
rules below.

A live session keeps the turn's first value and the signed rows, even when
session end finds that nothing was sent for the turn. A turn publish that
failed can still run later, and it sends the values from the turn's end. One
case differs from earlier releases. A correction that repeats the values from
the turn's end changes nothing, so no signed rows are sent for it.

Three cases make a backfill send the first value too:

- **A live session end has claimed the session.** It sends the first value
  and the signed rows, so the backfill sends the same rows and the two add up
  once. A live session end that finds a backfill publishing the session waits
  for it and tries again.

- **The turn's live publish is waiting to be retried.** The retry sends the
  values from the turn's end. The backfill sends the first value and the
  signed rows, so the retry adds nothing.
- **The session's first end does not publish.** A backfill leaves a corrected
  turn's tokens and cost to the session's first end. If that session end
  fails, or a destination filter stops it, the turn's first value goes out
  instead.

A point sent with a corrected value can stop matching what Trajectory derives
later. This happens when the model's price changes, or when a tag is added to
the destination. Trajectory then sends nothing more for that point. The value
it sent stays. When the value itself changed, the point gets one
`changed_after_send` record, as [a point keeps its first
value](#a-point-keeps-its-first-value) describes. A later change updates that
record, and a value back at the one sent removes it. A correction that arrives
after the point was sent is still applied to the value that was sent.

A correction can set all of a turn's usage to zero. A backfill then sends no
tokens or cost for the turn. A later session end of the same session sends
none either, because the backfill has recorded the session as published. The
backfill also records that it sent the turn without the values from the
turn's end. The turn's own publish can still run after the backfill, from a
retry or a catch-up of the session file. It then sends nothing for the turn.

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
  `trajectory.turn.elicitation_wait_ms.additive` and
  `trajectory.turn.elicitations.additive`.

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
