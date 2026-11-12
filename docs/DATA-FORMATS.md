# Data Formats

This page lists the fields in materialized session JSON, the local viewer API,
and the cost fields on LLM Observability spans. The local viewer and
`trajectory flare --privileged` build materialized session JSON from the
session's JSONL files with the `sessionstream` SDK.

## Materialized Session JSON

Materialized session documents use `format_version: 1`.

### Session Fields

| Field | Type | Description |
| --- | --- | --- |
| `parent_session_id` | string, optional | The parent session ID. Trajectory copies it from `session_start.parent_session_id`, `session_start.forked_from_session_id`, or `session_start.forked_from_id` when one is present. It keeps the link from child to parent without the transcript paths. |
| `trajectory_internal` | boolean, optional | Set only after Trajectory confirms that the session is one of its own classifier launches. An internal session can still enter a required security capture stream. Ordinary local readers, reader discovery, recursive analysis, and the embedded viewer's default session list leave it out. `headless` is a different field. It also describes real coding sessions that a user started. |

### Turn Usage Fields

A materialized turn's `token_usage`, `model`, `service_tier`,
`codex_billing_mode`, `tokens_status`, `token_source`, `estimated_cost_usd`,
`estimated_credits` and `cost_attribution` come from the turn's usage facts.
The local cache and the reader API read the same facts. `token_usage` holds
`input_tokens`, `output_tokens`, `cache_read_tokens` and
`cache_creation_tokens`, and the cache-write split, reasoning tokens and web
searches when the turn has them. Input excludes cache reads and cache writes.
A turn whose tokens are an estimate has no `token_usage` and no cost.

| Field | Type | Description |
| --- | --- | --- |
| `lifecycle_status` | string, optional | How the turn ended, such as `ok` or `interrupted`. It is absent for a prompt that has not ended, which has no usage and no cost yet. |
| `recovered` | boolean, optional | Set when the turn and its usage came from the client's transcript rather than from its hooks. |
| `epoch` | integer, optional | The turn's turn-identity epoch. A session whose turn IDs start again from 1 begins a new epoch, so the epoch and `_original_turn_id` name the turn. |

### Embedded Viewer Session Visibility

`GET /viewer/api/sessions` leaves out sessions that have `trajectory_internal`
set in the local session database. The viewer's **Show Trajectory tasks**
control sends `include_trajectory=1` to show those sessions. This control does
not change capture, publishing, or any other local reader. In a database
created before Trajectory added this column, all sessions stay visible.

Session summaries show `trajectory_internal: true` for internal sessions. The
list response gives `trajectory_internal_count` for the selected date or for
live sessions. Each `available_dates[]` entry gives the count for that date.
Internal sessions do not count toward the requested limit of visible sessions.

### Turn Viewer Fields

The local viewer can add short summary fields to each materialized turn.
It builds them from the turn's own tool calls and from marker data. The marker
data comes from the marker annotations or the marker table in the local
database. These fields do not replace the raw `tool_calls`, `permissions`,
`sub_agents`, or top-level `annotations.markers` records.

| Field | Type | Description |
| --- | --- | --- |
| `tool_summary` | object, optional | Tool counts for the turn. It contains `total`, `by_tool[]` entries with `tool` and `count`, and the `failures` and `denied` counts. Subagent tool calls already nested under `sub_agents[]` do not count in the parent turn's summary. |
| `file_touches` | array of objects, optional | A summary of each file that file tools touched. Each entry contains `path`, `operation`, `tool`, and `count`. For write and edit content, it can also estimate `bytes` and `lines`. `operation` is `read`, `write`, `edit`, `delete`, or `rename`. |
| `markers` | array of marker objects, optional | The markers attached to this turn, for the viewer to show. The viewer takes markers from the trace's top-level `annotations.markers`, which it fills from marker records in the local database. The materializer does not write `annotations`. |
| `marker_ids` | array of strings, optional | Stable IDs for the markers attached to this turn. Each ID appears once. The IDs match the objects in `markers`, top-level `annotations.markers`, or both. |

Codex `ApplyPatch` file summaries use complete retained `input.patch` sections.
Additions use `write`, updates use `edit`, and deletions use `delete`.
Moves use `rename` for both the original and destination paths.
Only calls with recorded success contribute patch file rows.
Failed, denied, and unfinished calls remain in tool summaries, without patch file rows.
A completed call can also lack a recorded success outcome. Those calls remain
visible as tool activity but contribute no patch file rows. Completion and
retained patch text cannot establish that a patch applied.
Malformed or truncated patch text supplies no paths, including any complete prefix.
No file activity is inferred from shell commands.

Other patch tools can supply a direct `file_path` or `path` with a unified diff.
Successful calls retain that direct-path edit row when no Codex sections can be parsed.
Parsed Codex sections take precedence over optional direct-path metadata.

The transcript view reconstructs these summaries when read, without recapturing
sessions or rewriting retained events. The embedded viewer fallback follows the same rules.
Expanding a file shows its recorded patch section, including move metadata.
It does not reconstruct the file's full contents or load its current disk contents.
The SQLite fallback reconstructs file summaries from retained tool inputs.
That fallback still omits tool content, so expandable patch content requires
the retained session transcript. Existing size limits continue to apply.

### Session Viewer Tool Insights

The local viewer reads each tool call from the `tool_calls` table in the local
SQLite database. `GET /viewer/api/sessions/{session_id}/tools` returns an
`invocations` array with a maximum size. Each entry has these fields:

- an invocation ID that hides private data
- the turn
- the tool family
- a cleaned command label
- a stable key for grouping
- the outcome
- the start and end times, and the duration
- fields that say whether timing is available and where it came from

The response also gives the indexed total, whether the list was cut short,
database availability, the data scope, the privacy mode, and the schema
version. These fields only describe stored data. They do not create another
trace, span, token count, or cost record.

A shell command label shows only an executable from an allowed list and a safe
subcommand. It hides all arguments, environment variables, paths, URLs, and
unknown executable names. Grouping keys use the same short form. Other tools
group by a broad tool family, not by raw tool names or arguments.

`GET /viewer/api/tools?key={aggregate_key}` scans a limited number of matching
local rows. It returns these values:

- invocation and session counts
- outcome counts
- average, p50, p95, and maximum latency

Latency uses only rows with recorded timing or timing that Trajectory can work
out. The response labels the data as local. It gives the scan limit and the
number of timing samples. It marks the results partial when the scan stopped
at its limit. Older rows without timing stay visible with an unknown duration.
They do not count in the latency values.

### Turn Sub-Agent Fields

Each turn can include `sub_agents[]` records for delegated child sessions.

| Field | Type | Description |
| --- | --- | --- |
| `trace` | object, optional | The materialized child session. Trajectory loads it from the sibling `session-{child_session_id}.jsonl` file when the parent's subagent record has no nested content mixed in. The parent session's tool counts do not include tools from this nested trace. For older materialized parent traces, the local viewer can fill this field when it reads them. |

## Captured LLM Call Turn Attribution

For an ordinary call, Trajectory uses the `llm_call.turn_id` value when the
event sets one. A Claude background-task notification call carries a temporary
ID at first. Its final turn is set once recorded notification and timing data
confirm it.

When the ID is missing, capture compares the request start time with the
recorded prompt and turn-end times. It does not use the hook counter at
delivery time. A proxy start time, in epoch time, must not be later than its
wall-clock completion time. For the older interceptor, which records monotonic
times, the start time is the completion time minus the duration. If timing is
missing or contradicts itself, the call stays without a turn.

To find the turn, capture reads at most 2 MiB of the latest session records.
Before it appends, it checks that the file did not change. The data can be
missing, cut off, changing, or ambiguous. In those cases, Trajectory keeps the
call locally and does not invent a turn for export.

## LLM Observability Turn Cost Fields

Turn spans keep token and cost totals on the span itself. When turn metrics
include an estimated total cost, the span includes these fields:

- `metrics.estimated_total_cost`, in nanodollars
- `meta.metadata.estimated_total_cost_nanodollars`
- `meta.metadata.estimated_total_cost_usd`
- the tag `trajectory.cost_source:turn_metrics`

Trajectory can add a synthetic LLM child span to carry the turn cost. To turn
it off, set `export.placeholder_llm_span: false` in user config. You can also
set `placeholder_llm_span: false` on a publish destination. This setting keeps
real LLM spans. It also keeps the turn-level cost metric and the fallback
metadata above.

A real `llm_call` record can include `cost_source` with `cost_nanodollars` and
an optional `cost_attribution` decision. These rules apply:

- An unpriced decision stops automatic estimation. It must not carry a number.
- A priced decision must match the model and the nanodollar total.
- Cost components are never negative, and their sum must equal `total`.

Some providers give only a native total. Then Trajectory splits that total
across the component fields. It weights the split by the best model and token
data it has. It keeps the total unchanged and labels the source as native.

The `tokens` object can carry `cache_creation_5m_tokens`,
`cache_creation_30m_tokens`, `cache_creation_1h_tokens`,
`cache_creation_12h_tokens`, and `cache_creation_breakdown_known`. These sit
next to the combined `cache_creation_input_tokens`. Some models have different
rates for each cache-write duration. To price such a model exactly, Trajectory
needs a known breakdown, and the buckets must add up to the combined total. If
Trajectory has only the total, it prices the writes at the model's shortest
duration and marks the cost as a lower bound. If the numbers disagree, the call
stays unpriced.

A captured call also records the `service_tier` the provider says it applied,
such as `standard`, `fast`, `flex` or `priority`, and is priced at that tier.
For OpenAI, Trajectory reads the 30-minute and 12-hour cache writes from the
response. If the response does not split them, the writes take the duration
the request asked for. A split that Trajectory cannot read stays unknown and
gives a lower bound. For Anthropic, it reads the 5-minute and 1-hour writes.
xAI's Responses API is read as OpenAI's. A Gemini `generate_content` call
takes its tier from `usageMetadata.serviceTier`, its cache reads from
`cachedContentTokenCount`, and its thoughts as reasoning tokens. Its input
includes `toolUsePromptTokenCount`, the prompt of tools Gemini ran itself,
which Google bills as input. `tool_use_prompt_input_tokens` records that part
of the input. Its grounded searches are `web_search_requests`, in the unit
Google charges. That is each search query on Gemini 3 and later, and each
grounded prompt on Gemini 2.5 and earlier.
Trajectory's AI gateway can translate a response into its client's format. The
call then keeps the upstream's tier and cache-write durations, even when that
format cannot show them.

Reasoning output tokens stay a separate usage counter. Trajectory prices them
as output tokens. OpenAI and xAI Responses already include reasoning in their
output count, so pricing does not add it again.

Pi captures keep estimates from configured model metadata apart from provider
charges. New request summaries carry a `model_pricing` decision. It holds the
model and provider names. When rates are configured, it also holds four rates
in USD per million tokens. A rate card set to free stays at zero.

A custom model can have no configured rates. Trajectory then uses its own
provider rate list, but only when the request data is complete enough for an
estimate. If the rates are ambiguous, or the cache-write duration is missing,
the call stays unpriced. The request and turn `cost_attribution` keep the
source of the price. Older Pi payloads without this data keep their native
cost, including zeros they recorded.

Pi's SDK counts reasoning as part of `usage.output`. This applies to gateway
Completions, gateway Responses, and Google. So configured and fallback pricing
count output once. They still keep the separate `reasoning`,
`reasoningOutput`, or `reasoningOutputTokens` breakdown. Negative or
fractional counts, or reasoning counts above output, give no price. Message
capture and final request summaries also keep Pi's API name.

Subagent spans default to `export.subagent_span_mode: semantic`. A sync
subagent sits under the `Agent` or `Task` tool span that started it. An async
background subagent sits under the turn where its task notification arrives.
Span links and trace metadata keep the parent and child IDs. To remove the
extra parent-side subagent task span, set `export.subagent_span_mode:
links_only`. You can also set `subagent_span_mode: links_only` on a
destination. Then only links remain, on the nearest existing parent span. For
each client's behavior, see [Subagent Trace Model](SUBAGENT-TRACE-MODEL.md).

Automated reviewers that use a model write `oversight_start` and
`oversight_result` lifecycle records. These records hold no content. Each one
has these fields:

- a stable `oversight_id`
- a kind and an outcome from a fixed list
- correlation fields that Trajectory can confirm
- the duration
- usage and cost
- provider diagnostics

These records never copy the reviewed transcript, tool arguments, tool output,
or the reviewer's reasoning. Trajectory stores them in the
`oversight_operations` table in the local database. Each `oversight_id` is
stored once, so a repeated write has no effect.

`export.oversight_publish_mode` controls what Trajectory sends out:

- `summary`, the default, publishes oversight spans and metrics with no content.
- `full` also publishes the separate reviewer trace.
- `off` publishes no oversight spans or metrics.

See [Automated Oversight Metrics](metrics/automated-oversight-metrics.md).

For the Datadog LLM Observability span tags, see
[LLM Obs Span Tags](LLM-OBS-SPAN-TAGS.md).
