# Metrics

This page describes the metrics Trajectory sends to Datadog. It covers their
names, their tags, and how each family behaves. It ends with every metric and
its type, unit, and tags. To build dashboards and monitors from them, see
[Metric queries](METRIC-QUERIES.md). To choose where metrics go, see
[Publishing](PUBLISH.md).

## Naming

Built-in names follow `trajectory.<scope>.<concept>[.<measurement>]`. The
scopes are `turn`, `session`, `oversight`, `pr`, `serve`, `ops`, and
`instrumentation`. Token counts use the OpenTelemetry GenAI names,
`gen_ai.usage.*`.

Each name keeps one meaning for every coding agent and one metric type.
Trajectory never sends one name with two types. It never sends a metric again
under a new namespace.

A prefix names a group of metrics, and not every name under a prefix exists.
Trajectory forwards a client's own OTLP metrics under the client's names.

The last part of a name says how to read it:

| Suffix | Meaning |
| --- | --- |
| `.additive` | A count that adds up across its family's grain. Use it for totals. |
| `.count` | An additive change. |
| `.accumulated` | A running gauge that Trajectory sends while the session runs and at its end. |
| `.total` | A completed sample or count. The family decides which. |
| `.completed_count` | A session total that Trajectory sends once, when the session ends. |

Each `trajectory.turn.*` metric holds one completed turn's value. It holds a
session-to-date value only when its name says so, as `.accumulated` does.
Only additive turn metrics add up to session totals. Ordinals, latest values,
ratios, samples, and latencies never add up. Before you add up a metric, check
its type, its grain, and what it belongs to.

Built-in turn metrics use gauges for latest values and additive counts for
long totals. They use distributions only where no replay-safe replacement
exists. For your own marker metrics, use `.accumulated` for live cost gauges.
Use `.total` only for completed samples that have no additive replacement.

## Common tags

Trajectory adds these tags when the metric and its source data support them.
Session and user metrics use the fallback values in the table. Process-level
and direct operational metrics can leave identity tags out. The
[metric table](#all-metrics) lists the tags of each metric. Every turn metric
carries the common tags, `trajectory.trace_type:turn`, and
`trajectory.turn_id`.

### Who and where

| Tag | Value | When unknown |
| --- | --- | --- |
| `trajectory.user` | The computer account that ran the agent: `TRAJECTORY_USER`, or else the operating system user name. Spans and most metrics carry it. | `unknown` |
| `trajectory.user_email` | The person's work email. It comes from the first of `TRAJECTORY_USER_EMAIL`, `identity.user_email`, `identity.user_email_command`, or `identity.user_email_suffix` added to `trajectory.user`. | Omitted |
| `host` | The local hostname, or `identity.host_override` when you set it | `unknown` |
| `trajectory.device_id` | On macOS, the Mac's hardware UUID in uppercase, the value Jamf shows as the UDID | Omitted on other systems |
| `os.type` | The operating system family. Only instrumentation metrics carry it, such as `trajectory.instrumentation.*`, `trajectory.ops.*`, and `trajectory.security.*`. | The runtime's OS |
| `trajectory.version` | The Trajectory binary version | `dev` |

`trajectory.user_email` names a person, while `trajectory.user` names an
account. `identity.user_email_suffix` builds no email for root, `nobody`, user
ID 0, or a system account. A system account has a user ID below 1000 on
Linux, or below 500 or a name that starts with `_` on macOS. The email
variable, setting, and command still apply to those accounts. See
[Configuration](CONFIGURATION.md) for the
identity settings.

Trajectory adds `trajectory.device_id` only to metrics that carry `host`, so
it adds no metric series. Metrics sent to OTLP collector destinations, and Claude Code metrics that
Trajectory forwards, never carry it. Only `trajectory.ops.binary.heartbeat`
carries `os.version`.

`identity.host_override`, or `TRAJECTORY_HOST_OVERRIDE` for one process,
replaces the hostname on metrics, spans, and logs. It is for short-lived
machines, such as containers that run one session. `trajectory.device_id`
does not change. When many machines share one value, counts still add up.
Gauges from machines that run at the same time share one series, so
per-machine gauges no longer describe one machine.

Some instrumentation health metrics carry `trajectory.user`, as the metric
table shows. The local health records on the computer leave user identity
out.

### Client

| Tag | Value | When unknown |
| --- | --- | --- |
| `trajectory.client_source` | The client, such as `claude-code`, `codex`, `agy`, `goose`, `cursor`, `pi`, or `opencode` | `unknown` |
| `trajectory.client_version` | The client's version, from capture or a cache | Omitted |
| `trajectory.client_surface` | Where the client ran: `cli`, `desktop`, `ide`, `exec`, `cloud`, `workspace`, `web`, or `unknown`. Turn, session, token, and cost metrics carry it, and so do the Cursor diagnostics. | Omitted when the client does not report it |
| `trajectory.app_version` | The desktop app's version, such as Claude.app or Codex.app. Only `trajectory.turn.completed` and `trajectory.turn.cost.usd.additive` carry it. | Omitted for terminal and SDK sessions |

`trajectory.client_surface` uses the same values for every client. Claude
Code reports `desktop` inside the Claude Desktop app, `ide` in the VS Code
extension, and `exec` for `claude -p`. Trajectory sends any value it does not
recognize as `unknown`.

### Session and turn

| Tag | Value | When unknown |
| --- | --- | --- |
| `session_id` | The session ID | `unknown` |
| `gen_ai.conversation.id` | The same value as `session_id`, under its OpenTelemetry name. Every metric with `session_id` carries it. | `unknown` |
| `trajectory.turn_id` | The turn ID on turn metrics. It is normally unique within a session, so two turns that end in the same second stay apart. | Omitted |
| `trajectory.trace_type` | The grain: `turn`, `session`, `oversight`, or `pr`. Serve and instrumentation metrics leave it out. | Set by the code that sends the metric |
| `ml_app` | The destination's ML app | Omitted |

A session is one agent conversation, from its start to its end. A turn is one
prompt and the work it starts. Turn IDs appear only on turn metrics.

### Model and pricing

| Tag | Value | When unknown |
| --- | --- | --- |
| `gen_ai.request.model` | The model name. For a local model file path, Trajectory sends the file's base name, such as `qwen3-8b`, or `local-model`. | Omitted |
| `trajectory.session_models` | On session points sent at or after the session ends: `single` when every turn used the main model, `multiple` otherwise | Omitted when no turn names a model |
| `gen_ai.request.reasoning_effort` | The reasoning effort, in lower case, on completed-turn metrics. It comes from Codex or Claude Code `effort`, OpenCode `variant`, or the Cursor setting. Values over 32 characters are dropped. | Omitted |
| `trajectory.service_tier` | The tier of the turn's last request, such as `fast`, `priority`, or `standard`. Claude Code, Claude Desktop, Cursor, and Codex record it. | Omitted |
| `trajectory.billing_lane` | The pricing lane of a completed turn: `api`, `chatgpt_credits`, or `unknown` when the Codex login cannot be read | Omitted |

Trajectory never fills in a tier or lane that the client did not record, and
never writes it as `standard`. Child and model call points keep only the
lane. Session and wait metrics carry neither. Session metrics never carry the
reasoning effort.

### Repository

| Tag | Value | When unknown |
| --- | --- | --- |
| `repo` | The repository name from the selected Git remote. A turn's metrics can name the repository the turn worked in. With no usable remote, it is the project folder's name, unless that is a random temporary name. | `unknown` |
| `owner` | The organization or user from the selected remote | `unknown` |
| `git_remote_host` | The selected remote's host. Metrics leave it out; a tag you configure on a destination keeps going out. | `unknown` |
| `trajectory.repo_source` | Where `repo` came from: `git_origin`, `git_remote`, `git_origin_unparsed`, `turn_activity`, `project_dir`, `configured`, or `unknown` | `unknown` |

`trajectory.repo_source:project_dir` means `repo` is a folder name, not a
repository. Trajectory found no usable Git remote, so it used the name of the
project folder. `git_remote` is the upstream remote, or the only remote that
is not `origin`. `configured` comes from your config tags. A Claude Desktop
session that reports no project folder sends `repo:unknown`.

Trajectory can also tag each turn's metrics with the Git repository the turn
worked in, with `trajectory.repo_source:turn_activity`. It is off by default
while it rolls out. The turn gets the repository with most of its edits. A
turn with no edits gets the repository with most of its other work. That work
is the files it read and the folders its shell and Git commands ran in. So a
session started in a folder that holds several repositories, such as a home
folder, tags each turn with its own repository. A turn that touched no
repository with a usable remote keeps the session's tags. Session metrics take
the repository most of the session's turns worked in. A session keeps this
choice until it ends, and a turn keeps its repository on every point and
correction.

Trajectory picks the remote `origin`, else the current branch's upstream
remote, else the only remote. It runs Git by its full path with a 2-second
time limit, and follows includes and `insteadOf` rules. Without Git, it reads
`.git` directly. Worktrees, submodules, and bare repositories work.

For an SSH alias, Trajectory reads only part of your OpenSSH config. It never
runs SSH or uses the network. Public `*.github.com` aliases count as GitHub. A
malformed or conditional mapping leaves the host unresolved.

PR metrics carry `change_host`, `owner`, `repo`, and `change_number` for the
PR. Public `*.github.com` hosts become `github.com`. Other metrics carry no PR
tags.

### Cost tags

Cost metrics carry these tags so that dashboards can tell what a cost means.
Spans carry the same tags. See [Costs](COSTS.md)
for how Trajectory prices usage.

| Tag | Values |
| --- | --- |
| `trajectory.cost_status` | `priced`, `unpriced`, `unavailable`, `invalid`, or `other`. An unpriced cost never becomes zero. |
| `trajectory.cost_basis` | `gross_model_cost`, `usage_economic_cost`, `provider_rated_usage`, `amortized_seat`, or `other`. It says what the cost means, not how close it is to an invoice. |
| `trajectory.cost_fidelity` | `native`, `token_derived`, `proxy`, `unpriced`, `aggregate`, or `other`. It is separate from token accuracy. |
| `trajectory.cost_method` | `provider_reported`, `four_component_token_rate_card` (Cursor), `token_rate_card`, `request_rate`, `credit_rate`, `sum_of_turn_attributions`, `sum_request_attributions`, or `other` |
| `trajectory.pricing_source` | `provider_reported`, `organization_rate_card`, `local_rate_card`, `public_rate_card`, `client_telemetry`, `turn_attributions`, `request_attributions`, or `other` |
| `trajectory.pricing_unit` | `provider_amount`, `tokens` (Cursor), `requests`, `credits`, or `other` |
| `trajectory.pricing_version` | A shipped or combined version, or `custom` for organization and local rate cards. Spans keep the full custom version. |
| `trajectory.provider` | `anthropic` or `openai`, when Trajectory classifies the Claude Code route, and on some Codex sessions it launched |
| `trajectory.provider_route` | `direct`, `llm_gateway`, `datadog_ai_gateway`, `bedrock`, `vertex`, `foundry`, `unknown`, or `mixed`. `datadog_ai_gateway` is the Datadog AI Gateway; `llm_gateway` is any other gateway |
| `trajectory.provider_cost_visibility` | `anthropic_api`, `gateway_aggregate`, `cloud_provider_billing`, `unknown`, or `mixed`: which billing tool likely sees the spend |
| `trajectory.cost_overlap_signal` | `trajectory_launch`, `session_env`, `claude_settings`, `none`, or `mixed`: the evidence for the route |

### Other tags

- `query_source:subagent` marks Claude sub-agent usage. A child point holds what
  the sub-agent added since its last stop. The parent's points carry
  `query_source:main`. With complete child data, parent plus child is the
  whole spend. Otherwise only parent points go out. Child points are never
  corrected.
- `category` on error metrics is `command-failed`, `user-rejected`,
  `edit-failed`, `file-changed`, `file-too-large`, `file-not-found`, or
  `other`. Trajectory's own failures are not counted.
- `destination_type:datadog_agent` marks both `datadog_agent` and its older
  spelling, `dd_llmobs_via_agent`.
- `hook_name` on Cursor hook deliveries is one of 18 hooks in lower case, or
  `other`. It shows whether the stop hooks still arrive.
- MCP calls carry `mcp_server`, `mcp_tool`, and `mcp_source_scope` when
  Trajectory finds them. They come from the client's MCP data, or else from
  the `mcp__<server>__<tool>` tool name. They never carry arguments or output.
  A call without `mcp_server` may still be an MCP call. Claude Desktop runs
  some built-in tools through an MCP server named `workspace`. Trajectory
  reports them as the matching Claude Code tool, such as `Bash`, with no MCP
  tags. A connector added through claude.ai has its ID as `mcp_server`.
- Wait metrics carry `measurement_coverage` (`complete`, `partial`, or
  `missing`), `timing_provenance` (`measured`, `tool_boundary_proxy`,
  `permission_estimate`, `mixed`, or `missing`), and
  `duration_basis:wall_clock`.
- `trajectory.subagent_capture_status` is `complete`, `incomplete`,
  `unsupported`, or `unknown`. Confirmed launches count even when capture is
  incomplete.
- `trajectory.time_shifted:true` marks points of a turn that settled over an
  hour late. They carry the settle time. Leave them out of time-of-day views.
- `trajectory.usage_basis:session_total` marks OpenCode usage that only the
  session's total counts. Its model is `session_total_unattributed`, and it
  has dollars only when OpenCode recorded them.

`source` on permission metrics says who decided:

| Decision | `source` |
| --- | --- |
| A classifier | `auto_classifier` |
| A policy or config rule | `config` |
| A hook | `hook` |
| The user, once | `user_temporary` |
| The user, for the session | `user_session` |
| The user, always | `user_permanent` |
| The user, with no scope, or after a timeout or cancel | `user` |
| The user rejected it | `user_reject` |
| Unknown or other | `unknown` |

Some clients state the scope of an approval. Codex maps `approved` to
`once`, `approved_for_session` to `session`, and amendment or network policy
approvals to `always`, because Codex saves a rule for them. Claude Code's
native tool timing refines an accept to `user_temporary`, the default, or
`user_permanent`. Its other sources pass through as Claude Code reports them:
`user_reject`, `user_abort`, `config`, `hook`, and `user`.

## Tags to slice by

Agent Console and dashboards slice by these tags: `session_id`,
`trajectory.turn_id`, `trajectory.user`, `trajectory.user_email`,
`trajectory.client_source`, `trajectory.client_surface`,
`gen_ai.request.model`, `gen_ai.request.reasoning_effort`, `repo`, `owner`,
the PR tags, `tool_name`, `mcp_server`, and `skill_name`. The
[common tags](#common-tags) give the values of each one.

Agent Console and dashboards join a person's data across computers and
clients by `trajectory.user_email`. Set it on every computer the person uses.

Unless model tags are redacted, `gen_ai.request.model` is missing only when
the client records no model for the turn. Incognito and models that match
`export.redacted_model_suffixes` redact them. Session points sent at or after
the session ends name the session's main model: the one with the most
completed turns. When two models have the same number of turns, the one whose
turns cost more wins.

`skill_name` names the skill a turn used. Only skill metrics carry it, and
Trajectory sends no skill point when the client names no skill.

`mcp_server` also appears on Pi's MCP calls through the `pi-mcp-adapter`
extension. Trajectory reads the server and tool from the tool name and the
call's arguments.

## Metric table

The binary defines each metric's name, type, and tags. If this page and the
binary disagree, the binary is right. This page lists only current metrics.
To list every built-in metric that your version sends, read the `catalog`
field of this command's output:

```bash
trajectory publish metrics canary --include-diagnostics --json
```

To read the built-in metric guide in a terminal, run
`trajectory user-guide metrics`. For deployment guidance, run
`trajectory user-guide deploy`.

[All metrics](#all-metrics), at the end of this page, lists each metric with
its type, unit, tags, and meaning. It names a group of shared tags once:

<!-- BEGIN GENERATED TABLE metric-tag-groups -->
| Tag group | Tags |
| --- | --- |
| Host tags | `host`, `trajectory.device_id`, `trajectory.version` |
| Platform tags | `os.type` |
| User tags | `trajectory.user`, `trajectory.user_source`, `trajectory.user_email`, `trajectory.user_email_source`, `trajectory.actor_type` |
| Client tags | `trajectory.client_source`, `trajectory.client_version`, `trajectory.client_surface` |
| Repository tags | `repo`, `owner`, `trajectory.repo_source` |
| Session tags | `session_id`, `gen_ai.conversation.id`, `ml_app`, `gen_ai.request.model`, `trajectory.trace_type` |
| Privacy tags | `trajectory.metrics_disclosure`, `trajectory.model_disclosure` |
| Turn pricing tags | `gen_ai.request.reasoning_effort`, `trajectory.service_tier`, `trajectory.billing_lane` |
| Cost overlap tags | `trajectory.provider`, `trajectory.provider_route`, `trajectory.provider_cost_visibility`, `trajectory.cost_overlap_risk`, `trajectory.cost_overlap_signal`, `trajectory.cost_role`, `trajectory.cost_dedupe_group`, `trajectory.cost_dedupe_confidence` |
| Cost tags | `trajectory.cost_source`, `trajectory.cost_status`, `trajectory.pricing_source`, `trajectory.cost_method`, `trajectory.cost_fidelity`, `trajectory.cost_basis`, `trajectory.pricing_unit`, `trajectory.pricing_version`, `trajectory.cost_reason` |
| Jamf script tags | `provider`, `script_version`, `version_target`, `version_installed`, `trajectory.device_id` |
<!-- END GENERATED TABLE metric-tag-groups -->

## Metric notes

### Turns

A turn is one user prompt and the agent's reply. Trajectory sends turn
metrics when the turn completes. Backfill counts a turn in
`trajectory.turn.completed` only when its stored turn end exists.

A Claude Code, Codex, or Pi turn that called no model sends no
`trajectory.turn.completed` point, so turn counts leave it out. Examples are
a Claude Code local command such as `/status`, a Codex `!` shell command, and
a prompt you stop before any reply. Its other points still go out.

Long or waiting turns send usage, cost, and opened PRs about every 10
minutes, under turn IDs from 1,000,000 up. These interim points add to
session totals, but they are not turns.

Claude Code turns publish at the next prompt, after 3 quiet transcript
seconds, at session end, or after 30 seconds. They wait at most 5 minutes.
Turns with Claude Code native spans wait for native tool timing. They wait up
to 60 seconds after the turn ends, or 5 seconds after the session ends.

A stopped or queued Claude turn moves its tool uses, prompts, waits,
questions, and launches to the next turn that ends. Tokens and cost stay on
their turn. Activity after a session's last ended turn goes out only when
Trajectory recovers that turn.

A Claude turn that the hooks missed becomes a turn end tagged
`recovered_from_transcript:true`, when it has a prompt and usage. Otherwise
its usage joins the next turn. Claude transcript turns from before capture
started, such as a fork's copied history, are not counted.

If the turn counter or its lock cannot be read, capture continues, but turn
IDs can repeat. `trajectory session audit --deep` reports them as
`duplicate_turn_id`. A failed reservation of IDs for queued turns sends
`derivation.fallback{reason:turn_block_reserve_failed}`.

### Points, corrections, and replays

Datadog keys a point by name, type, second, and all its tags. Built-in turn
metrics are replay-safe, so a resend never counts twice. A replayed session
reuses its point identities, and each completed turn counts once.

Replays and backfill never send a sent point again with another value. That
holds after new derivation, a price change, or added tags. A distribution
sample goes out once and is never rebuilt, because a changed sample would add
a member.

When session end reads different turn usage, each `gen_ai.usage.*` value gets
a cancelling negative point and a corrected positive point. Signed
corrections go out only within about an hour of the point they fix, because
Datadog keeps older points only through Historical Metrics Ingestion.
Corrected first values match the transcript and keep the turn's completion
time.

For an older correction, `export.late_turn_correction_delivery` decides what
happens:

- `historical`, the default: Trajectory sends the corrected total for that
  point through Historical Metrics Ingestion, which replaces the stored
  value. It does this only when the destination takes historical points and
  Trajectory can verify the point it replaces.
- `gap`: Trajectory sends nothing.

A correction that Trajectory does not send is kept as a dropped row in the
local metric queue. Its reason is `late_turn_correction_outside_live_window`
when the setting is `gap`, and `late_turn_correction_hmi_unconfirmed` when the
destination does not take historical points. It is
`late_turn_correction_cell_unverified` when Trajectory cannot verify the point
it replaces. Corrections that are not turn corrections drop the `late_turn_`
prefix.

A turn that a correction set to zero gets no token or cost points from
backfill or a later session end. Zero-value turn metrics are not sent, unless
the metric defines zero, as a priced turn's cost does. Missing values never
become zero.

Backfilling a retained session sends a turn that was corrected before its
first send as one point, with the corrected value. A turn sent at session end
is final for tool counts and late permission results.

Cost and pricing updates use the turn's completion time. Final snapshots use
the session's completion time, and compaction gauges use the event time.
Trajectory never fills a missing timestamp from nearby data or the send time.
Before you replay sessions over an hour old, turn on Datadog Historical
Metrics Ingestion for `trajectory.session.last_seen.unix`.

### Tokens and cost

Token points split by model and `query_source` only when the request usage
adds up to the turn's usage. Cost also needs native costs. A request that
names no model counts under the model it is priced at. That is the session's
model, or the turn's when an earlier record of the turn names one. Claude Code
background requests, such as summaries, suggestions, titles, and compactions,
send points tagged `query_source:auxiliary`. Exclude them to match the session
file alone. These points hold requests since the last settled turn, and do not
say which turn caused them.

Without Claude Code native metrics, file-based usage and cost are lower
bounds, tagged `trajectory.usage_bound:lower` and
`trajectory.cost_bound:lower`. Native numbers never replace file numbers.
Serve reads only delta native points. When Claude Code sends cumulative
totals, the session keeps its lower-bound mark. Native usage that arrives
after the session ends is not counted. When
native metrics otherwise match, missing sub-agent output goes on points tagged
`trajectory.output_source:native`.

Model calls missing from the transcript add token and cost points tagged
`trajectory.cost_component:captured_call`. Exclude that tag for
transcript-only figures. Sessions counted from Claude Code client files send
no captured-call points, because the files and native metrics count them.

The 5-minute and 1-hour cache write counters add up to
`gen_ai.usage.cache_creation_tokens`, which keeps its combined total. They
exist only when the client reported the split. A missing series means the
split was not reported. Older Claude Code sessions have only the combined
counter.

WebSearch usage is known only when the client recorded a request count. A
recorded zero counts, and a missing count means unknown. Later WebSearch corrections go out as separate signed points.
The original turn points stay as they were.

### Tools and activity

Every tool call publishes once. That includes calls with only a request or
only a result, calls with no pair, and calls reported by two Trajectory
versions. Common tools map to one `tool_name` and input keys, such as `read`
to `Read` and `exec_command` to `Bash`. Others get `tool_type:unknown`.

When a trusted turn total is larger than the named calls, the rest goes to
`tool_name:unknown` with `attribution_reason:turn_aggregate_fallback`.
Tool-use points carry `signal_confidence`, `identity_confidence`,
`attribution_reason`, `lifecycle_coverage`, and `tool_outcome`. Low
confidence changes these tags, never the count. Trajectory never corrects
tool-use and decision metrics after it sends them.

A successful `ApplyPatch` adds one modified operation, however many files it
changes. Repeated completions of one call ID count once. Failed, denied,
unfinished, and outcome-less patches do not count, so capture that leaves out
outcomes has incomplete coverage. A truncated input counts.

Lines of code come only from edit or patch text. For agy, Copilot CLI,
OpenCode, and Pi, they also come from comparing whole-file writes. Unsafe
paths, symbolic links, oversized files, failed tools, calls without an ID,
and provider history rows have no line counts. A retried hook counts once.

`trajectory.turn.subagents` adds one for each distinct confirmed
`subagent_start`, for Claude Code, Codex, Cursor, Copilot CLI, and OpenCode.
Attempts, stop reports, parent links, tool intent, and unclear data do not
count. Each point has its turn's end time.

`trajectory.turn.agents.peak_running` is the most agents at work at the same
moment during a turn. With `agent_kind:session`, it counts the turns in flight
on the machine, this one included, for every client. A session counts only
while it works on a turn, from its prompt to its stop. An open session that
waits for a prompt does not count, so a turn on its own sends 1. With
`agent_kind:subagent`, it counts this session's sub-agents, and only a turn
that launched one sends it. A backfilled turn sends no session point. The
session count can be low for turns that run across a Trajectory restart or
upgrade. Each point has its turn's end time.

Zero activity or sub-agent counts go out only with complete capture
coverage. A missing series or unknown coverage never means zero.
`trajectory.turn.errors.additive` uses the client's category summary when
there is one. An empty summary is zero, and a missing one is incomplete.

Final compaction totals include compactions outside a turn. Those stop
running snapshots and go out without a costed turn. Totals the client
recorded can lower them.

### Permissions

Decision metrics send one point for each recorded `permission_result`. Calls
without one send none, even failed calls. Trajectory never infers an
approval.

Transcripts repair manual denials only for recorded requests. Claude Code
native tool timing fills an unknown `tool_outcome` and refines the decision
and source. It never adds calls or decisions.

Headless Claude Code records `unknown` for allow rules, hook allows, bypass
mode, and missing rules. `unknown` refines nothing.

A `permission_result` written after its turn arrives at session end. Examples
are a Claude Code Stop denial and a late Codex decision. Each late result gets
its own decision point, once per tool call. A child agent's late
result in the parent's events does not count in the parent session.

Some cases count late results wrong:

- A turn ID with two completion events, seen with Codex, can count on-time
  decisions twice.
- A session that never finishes its final publish, such as a crashed
  incognito one, never sends late permission points.
- A live session removed during replay after a failed registry write can
  send late permission points twice.

### Sessions

`trajectory.session.count` counts session starts, not distinct sessions. One
session can start several times.

Session-end metrics, marker metrics, and session distributions go out once, at the first session end. Session end
rebuilds final values from completed turns and accepted corrections. An
unfinished last turn adds no cost.

When a resumed session ends again, completed counts send only that run's
change, with its tags. Ending again adds nothing. A later run sends only the
turns not yet sent, even when the session's tags changed.

### Automated oversight

Automated oversight is a model call that an agent makes to judge another
action, such as an approval check. Oversight operations and reviewer
sessions, such as Codex Guardian, never count as turns, sessions, or session
cost. Permission metrics describe the reviewed action, and oversight metrics
describe the model call that judged it, so they do not overlap.

Each operation counts once, by its own ID and source. Changes to its outcome,
model, or coverage correct it. Its points use the time the review finished.
Operations without an ID, a source, or a valid time add nothing. A duration
counts when it is a finite, non-negative measurement or a valid interval.

Oversight operations send `gen_ai.usage.*` input, output, and cache counts
when they are reported, tagged `trajectory.trace_type:oversight`. They carry
the model that the review's record names. A Codex reviewer signed in with
ChatGPT names only `codex-auto-review`, so its metrics carry that model. Their
provider role and feature names appear only in traces, never in metric tags.
Corrections fail for pruned records, duplicates without an identity to
rebuild, and operations over an hour old. Earlier percentiles stay.

### Pull requests

Each priced turn's cost splits across its candidate PRs by fixed evidence
weights that add up to one. The shares are safe to correct. Two metrics carry
the shares: `trajectory.pr.work.cost.usd.additive` for cost, and
`trajectory.pr.work_turns.additive` for the fraction of each turn. Duration
and tokens are not split across PRs, so read them from the turn metrics.
Explicit PR interaction counts keep their meaning.

Supported GitHub or GitLab PR references give PR metrics their identity. CI
wrapper URLs become host, owner, repository, and number. PR metrics carry
`session_id` and, when there is a source turn, `trajectory.turn_id`. Broad
token, tool, and skill metrics carry no PR numbers.

A turn qualifies a PR in these cases: it creates the PR, takes a successful PR
action, or pushes a linked branch. It also qualifies one when it works in the
only branch context, or names one PR URL in its prompt. Failed actions,
mentions in output, incomplete turns, work before the PR existed, and prompts
that name several PRs never qualify. More evidence for the same PR adds no
observations. Each observation is keyed by session, turn, and PR. It uses the UTC completion
time, reverses when the turn stops qualifying or moves, and keeps its first
tags.

Before you rely on reports from `trajectory.pr.ai_assisted.observations.total`,
confirm that its points arrive in Datadog. `trajectory.pr.observations.total`
keeps every normalized PR, including abandoned, low-confidence, multi-PR, and
unpriced ones. Its tags explain each case. `trajectory.pr.interactions.total`
assigns no spend again when another workspace is the PR's main one.

`cost_coverage`, on `trajectory.pr.observations.total` and the oversight cost
metrics, is one of these values:

- `allocated`: the share is priced.
- `pending`: Trajectory saw the work before it was priced. The cost is still
  in `.additive`.
- `unpriced`: the share is unpriced.
- `no_priced_turn`: there is no share.

Session PR attribution gauges need one verified snapshot,
`attribution_source:facts_snapshot`. Without it, Trajectory sends nothing,
not zero. PR points take signed changes for about an hour after they are
handled. Later changes send nothing and count as `pr_settled_no_correction`
drops. A known final test-fix total that drops, even to zero, gets a signed
correction.

### File work

File-work indicators show which files an agent read or changed, and how a
PR's cost splits across them. Both are on by default. Each PR has three lenses:
`read`, `intermediate_edit`, and `final_change`. For one PR and lens, the file
values add up to the PR's work cost.

Reads weigh the bytes that came back. Change attempts weigh their payload
bytes. Calls without a size count as one operation, and repeats each add. A
lens that mixes bytes and operations uses operations throughout. It then
reports `weight_unit:operations` and `evidence_status:partial`.

`final_change` uses the commit's file operations. Until commits exist, it
uses successful changes from the transcript, with `evidence_status:partial`.
Committed files take their names from tool-call paths. Unnamed files go to
`_other`, and changes from before the session are left out. Codex
`intermediate_edit` includes failed patch attempts. The patch parser counts a moved
file under its original path.

Each PR lens keeps its 25 heaviest paths as series and folds the rest into
`_other`. Totals stay exact. The turn file-work metric has no file path, and
at most four series per turn. Datadog gets each file-work value once, at the
time Trajectory handles it. A later session end gives a new file only the part
of a turn's cost that Datadog doesn't have yet. OTLP collectors get weight
corrections at the original time, and removed paths reverse.

### Repository detection

Session end tries repository detection again, which can improve the final
session tags. Trajectory never rewrites turn points it already sent, or tags
that backfill sent.

### Capture and delivery health

Trajectory sends operational metrics once, on a best-effort basis, and never
replays them. A gap can mean an idle producer, a setting, credentials, the
transport, or the endpoint. Integration tile and out-of-the-box dashboard
metrics are on by default. They need a running, configured install and valid
credentials for a metric destination. Turning export off, or a policy that
blocks it, stops them.

Metrics that go through the local queue record `outcome:pending` with
`reason:metric_delivery_pending` when a publish queues them. Each queue pass
then records success or failure for each destination. Pending rows are
stored, so a failed delivery never runs a turn end or session end again. Rows
with `metric_delivery_deferred` or `policy_disabled` stay queued and are not
rejected. [Reason codes](#reason-codes) lists every reason.

Publish attempts use the client identity saved at session start, or `unknown`.
Event Platform streams and AI Usage report `signal:record`. Each native OTLP
forward sends one `publish.attempt`, tagged
`component:serve` and `destination_type:otlp`. Its site and identity are
`unknown`.

Forwarding health shares the serve health queue. A full queue never delays
native intake. Its drops stay in a local record with `component:hook` and
`reason:queue_full`, which `trajectory doctor` reads.
Batched health export keeps each point's value, tags, type, and time.
Destinations that share an intake keep their own credentials and policy. The
health buffer on the computer is local history with a size limit. It is never
retried, and a local record does not show that Datadog got the data.

`trajectory.instrumentation.capture.recovered` counts turns and sessions that
live capture missed and Trajectory later recovered from the client's history.
`kind` is `turn` or `session`. `reason` is `no_hook_events`, `hooks_partial`,
or `client_unsupported_live`. A recovered session sends one point of each
kind, so do not add the two kinds together.

`trajectory.instrumentation.publish.daily_sent` reports once a day, for each
destination, how many turns (`kind:turns`) and sessions (`kind:sessions`) of
the day before it accepted. `day` names that day. The point itself has the
time Trajectory sends it, so it appears a day later. See
[Metric queries](METRIC-QUERIES.md#check-capture-and-delivery) for how to use
both counts.

Codex gap reasons count gaps and unusable records. They do not count tool
calls, early discovery misses, or saves that were rolled back. Gaps that a
Cursor generation leaves go out at session end. Missing-usage metrics fire
only when an expected step fails, not for zero usage or clients without
provider usage. Trajectory's own classifier sessions send no fallback metric.

Some Copilot CLI Stops name their session log, and their turn takes its model,
tokens, and reply from it. Such a Stop sends no health metric.

`trajectory.instrumentation.capture.hook_event` counts only deliveries with a
receipt. A retry during an attempt that is still running counts
`outcome:skipped` with `lock_contended`.

Backfill failures include unreadable or partly accepted 2xx replies, and
failed credential lookups. Backoff, budget delays, and policy holds are not
failures. `trajectory.serve.backfill.failure_total` counts one for each failed
step or queue pass, not for each row, destination, or request. Its tags are:

- `stage`: `config`, `policy`, `engine`, `runtime`, `campaign`,
  `task_inference`, or `outbox`
- `failure_scope`: `control_plane` or `shared_outbox`
- `error_class`: `authentication` (401), `authorization` (403),
  `rate_limited` (429), `payload_too_large` (413), `backend_timeout` (408 or
  504), `backend_unavailable` (5xx), `request_rejected` (other 4xx), or
  `response_error` (a 2xx with an error). Without a status, it is a publisher
  class, `other`, or `mixed`.
- `http_status_class`: `1xx` to `5xx`, `none`, `unknown`, or `mixed`
- `transport` and `reason`

A held claim is a publish ledger row that stays claimed long after any live
publish could need it.
`trajectory.serve.local_state.publish_ledger_held_claims` counts them, and
`trajectory publish queue claims` lists them.

`trajectory.instrumentation.lifecycle.incident` counts each lifecycle failure
or safe delay. Its `reason` is the incident code that `trajectory doctor` and
`diagnostics/lifecycle.json` show. Runtime repairs run after a managed install,
after an MCP or serve owner starts, and when an older serve updates. Their
records stay on the computer, where `trajectory doctor` and the support flare
read them.

A failed session finalization keeps a receipt for recovery. Recovery tries up
to five 110-second attempts, and at most eight failures per home each UTC day.
Receipts retire after 60 days. Recovery gauges go out every minute while
receipts wait, as healthy zeros every 10 minutes, and as a final zero when
cleared. Their `feature` tag is `finalization` or `sensitivity`.

### Serve, fleet, and updates

Fleet gauges carry `role`, `owner`, `managed`, and `cohort`, and never a
process ID, session, or path. `trajectory.ops.binary.heartbeat` and
`trajectory.ops.required_destination.health` leave out `role` and `owner`,
which have one value there. `managed` is `true` for the owners `jamf`,
`mdm`, `managed`, and `datadog-managed`. A Mac with the Trajectory
configuration profile that runs `~/.trajectory/bin/trajectory` reports owner
`mdm`. Running-binary heartbeats carry `egress_route` (`proxy`, `direct`, or
`direct_fallback`) and `proxy_source` (`none` or `environment`).

The heartbeat and update state gauges go out when
`export.metrics` or marker metrics are on. Marker settings do not block them.
Serve sends its operational counters best-effort over agentless OTLP to
eligible Datadog destinations. Most counters also need `markers.enabled` and
`markers.metrics`.

`trajectory.ops.agent.present` covers every supported agent, including
codex-app and openclaw. It sends a series only for installed clients, and one
`0` when a client is removed. `agent.active_sessions` likewise sends a
series only while a client has sessions. Aliases report the main name, and
both Cursor surfaces report `cursor`. `client_version` is the CLI version or
`unknown`, and desktop apps use their bundle versions. `extension_version` may
be `unknown`.

`trajectory.ops.update.state` tags:

- `state`: `ring_below_floor`, checked first. Then `below_floor`, which
  install or update raise. Then `behind`, when auto-update is off and a newer
  release exists. Otherwise `current`.
- `ring`: `stable`, `beta`, or `bravehearts`, where `stable` is the default.
  Also `floor`, `ring_version`, `installed_version`, and `running_version`,
  which joins live versions with `+`.
- `check_freshness`: `current` within 90 minutes of the timer's last result,
  else `stale`.
- `configuration_profiles`: `none`, `one`, `several`, or `unknown`.

`check_freshness:stale` with `auto_update:on` means the hourly update timer
has not run.

`trajectory.ops.install.*` and `trajectory.ops.agent.*` show whether
computers are installed, configured, and capturing. The auto-instrument state
gauge only reports. A policy that is off reports zero and never turns capture
on. For serve health, use `trajectory.serve.capture.*`, `.goroutine.*`,
`.local_state.*`, and `.terminal_recovery.*`, and
`trajectory.instrumentation.lifecycle.incident`.

If recovery or backfill seems stuck, check `trajectory.serve.terminal_recovery.*`,
`trajectory.serve.backfill.failure_total`, and the local receipts. For
detail on each process and session, use the local health records and
`trajectory flare`. Operational logs need their own managed authorization and
may repeat. They carry process and session detail, without metric tags.

For fleet health, the update gauges, and managed setup, see
[Instrumentation health metrics](metrics/instrumentation-health-metrics.md),
[Publish and serve health metrics](metrics/publish-and-serve-health-metrics.md),
and [MDM script metrics](metrics/mdm-script-metrics.md).

### Resource use

Serve's idle budgets are 36 CPU seconds, 50 MiB read, and 20 MiB written per
hour. Its active medians are 180 CPU seconds, 2 GiB read, and 500 MiB written
per hour. Any interval over 1 GiB of resident memory counts, and active
medians need three active intervals. The active and memory limits may change.
Serve only reports overruns, and never slows or stops work. `trajectory doctor`
names the figure on each computer. Serve cost metrics use the dimensions
`trajectory.version`, `os`, `activity`, `history_bucket`, `cache_bucket`, and
`client_mix`, plus `accounting` or `store`.

Disk byte metrics carry an `accounting` tag that names what the operating
system's counter measures. Each value means the same thing on every system:

| `accounting` | macOS | Linux | Windows |
| --- | --- | --- | --- |
| `storage` | Disk I/O charged to the process, as Activity Monitor shows | Bytes read from block storage or dirtied for it (`read_bytes` and `write_bytes` in `/proc/<pid>/io`). It can be zero on tmpfs, network file systems, and when the page cache holds the data. | Not reported |
| `logical` | Bytes written through the file system, including writes the cache later combines. There is no read direction. | File I/O: `rchar` and `wchar` less the bytes serve counted on its own sockets. Only serve's own metrics report it. | Not reported |
| `transfer` | Not reported | Every read and write system call, on files, pipes, and sockets (`rchar` and `wchar`) | Every I/O operation, including devices and network |

`trajectory.instrumentation.serve.read_bytes_per_hour` and
`write_bytes_per_hour` measure the serve process, and report all three kinds
on Linux. Linux `logical` can be a little higher than file I/O alone, and is
never lower. Never add kinds together. A kind that a system does not report
is absent, not zero.

Tag lists differ by family, under destination and privacy policy. A
process-wide value never goes onto a per-session series.

### Agent Security

Agent Security counts and gauges with equal tags merge into 10-second
buckets. Distributions keep every sample, as OTLP delta histograms. These
metrics are never sampled, truncated, grouped by user or repository, or
merged by tag. A tag change moves running counts without a new baseline.

AI-EDR and AI Guard metrics follow the same destination rules, and are off by
default. Only a managed required destination with
`agent_security.metrics: true` turns them on. User and project config cannot.
Findings need an `incognito_exempt` destination, which need not use
`level: full`. Other destinations get only the metrics, and only with
`level: off`. The disclosure profile tag appears only where findings may go.

## Reason codes

These tables explain the main `reason` values of each metric. They are built
from the code, so they list only values that the metric sends.

### `trajectory.instrumentation.publish.attempt`

<!-- BEGIN GENERATED TABLE metric-publish-attempt-reasons -->
| Reason | Outcome | Meaning |
| --- | --- | --- |
| `metric_delivery_pending` | `pending` | A publish queued metric rows. The local queue now owns their delivery and retries. |
| `none` | `success` | A queue pass sent a destination's rows, or the OTLP forwarder got an HTTP 2xx reply. |
| `credentials_unavailable` | `failure` | Trajectory could not read the API key, also from the OS keychain. `error_class` is `auth`. |
| `authorization_unavailable` | `failure` | Trajectory could not confirm that the destination may still receive the rows. `error_class` is `permission`. |
| `policy_disabled` | `failure` | A setting that is off holds the rows. They stay queued and go out once the setting changes. `error_class` is `permission`. |
| `metric_delivery_deferred` | `failure` | The rows wait for a later pass. The pass reached its request limit, an older row for the same value is still sending, or a PR point is older than Datadog accepts. They stay queued. `error_class` is `unavailable`. |
| `queue_full` | `failure` | Too many metric requests were running, so Trajectory could not start another. `error_class` is `unavailable`. |
| `privacy_context_unavailable` | `failure` | Trajectory could not finish the incognito check for older rows. `error_class` is `unavailable`. |
| `partial_failure` | `failure` | Datadog accepted only part of a request. `error_class` is `validation`. |
| `storage_io` | `failure` | Datadog accepted the rows, but Trajectory could not save that result. `error_class` is `internal`. |
| `network_error`, `timeout` | `failure` | The request did not reach the endpoint, or it timed out. |
| `http_4xx` | `failure` | The endpoint rejected the request. `error_class` is `auth` for HTTP 401, `permission` for 403, `rate_limited` for 429, and `validation` for other codes. |
| `http_5xx` | `failure` | The endpoint failed. `error_class` is `unavailable`. |
| `context_canceled`, `serialization_failed`, `publish_internal_error` | `failure` | The work was canceled, a payload could not be encoded, or the error is one Trajectory does not recognize. |
| `config_error` | `failure` | The OTLP forwarder's settings or endpoint are not valid. `error_class` is `validation`. |
| `metrics_disabled` | `skipped` | The destination does not take metrics, so Trajectory sent it none. |
| `trace_level_off` | `skipped` | The destination's trace level is `off`, so Trajectory sent no LLM Observability spans to it. This is expected for metric-only destinations. |
| `config_disabled` | `skipped` | The destination turns this output off, such as module spans, event logs, or AI Usage events. The OTLP forwarder also reports it when forwarding is off or has no endpoint. |
| `unsupported_metric_transport` | `skipped` | Marker metrics went to a `datadog_agent` destination, which cannot take metrics. |
<!-- END GENERATED TABLE metric-publish-attempt-reasons -->

### `trajectory.instrumentation.capture.gap`

<!-- BEGIN GENERATED TABLE metric-capture-gap-reasons -->
| Reason | Meaning |
| --- | --- |
| `usage_missing` | A completed turn still has no usage after every recovery step. Trajectory stores it as missing, never as zero. Cursor sends it for a turn without usage and for a generation that never got its last hook. |
| `scope_filtered` | A watcher limited to some projects saw a Codex session file that its filter leaves out. |
| `usage_unregistered` | That left-out Codex session file later recorded token usage, which Trajectory did not record. |
| `source_unavailable` | No Codex session file existed when recovery looked for it. |
| `source_unusable` | A Codex record with tool data was malformed, too large, or not supported. |
| `reconciliation_failed` | Trajectory could read a Codex record's tool data but could not save it as a tool event. |
| `cache_missing_tool_calls` | At session end, the session file held tool calls that the local cache lacks. The value is how many. |
| `publish_catch_up_window` | A session's publish position was lost, so Trajectory left out its turns over seven days old. The value is how many. |
<!-- END GENERATED TABLE metric-capture-gap-reasons -->

### `trajectory.instrumentation.derivation.fallback`

<!-- BEGIN GENERATED TABLE metric-derivation-fallback-reasons -->
| Reason | Meaning |
| --- | --- |
| `transcript_usage_missing` | Claude Code transcript usage was still missing after the reconciliation window. |
| `estimated_last_resort` | Trajectory estimated a turn's usage from its content, the last fallback. |
| `transcript_path_missing` | A Claude Code session has no transcript where one should exist. |
| `transcript_read_failed`, `transcript_parse_failed` | A Claude Code Stop could not read the transcript after its retries, or could not find the turn in it. Trajectory writes the turn end without the transcript's data and marks it pending. |
| `lock_contended` | A Claude Code Stop could not get a processing slot in time. Trajectory writes the turn end without the transcript's data and marks it pending. |
| `headless_transcript_unavailable` | A headless Claude Code run, such as `claude --print`, has no transcript. This is expected. |
| `missing_turn_end` | A Claude Code session end added a missing turn end after a recorded prompt. It counts the repair, not lost usage, and counts once. |
| `settle_unaligned`, `settle_cumulative`, `settle_transcript_too_large`, `settle_unavailable`, `settle_timeout`, `settle_session_closed` | Turn validation kept the first usage it recorded. The match was unclear, the totals were cumulative, the transcript was over 64 MiB, it could not be read, the check timed out, or the session had closed. GitHub Copilot CLI reports its read of its session log at a Stop with the same reasons. |
| `reconciliation_unaligned` | Session-end reconciliation could not match a recorded turn to the transcript. |
| `turn_block_reserve_failed` | Trajectory could not reserve turn IDs for queued Claude Code prompts. |
| `subagent_parent_ended`, `subagent_parent_read_budget`, `subagent_parent_reviewer` | A sub-agent turn went out on its own trace. The parent ended without recording the launch, Trajectory may not read the parent's session file again, or the child is an automated reviewer. Each serve process sends it once per child session and destination. |
<!-- END GENERATED TABLE metric-derivation-fallback-reasons -->

## All metrics

<!-- BEGIN GENERATED TABLE metrics -->
| Metric | Type | Unit | Tags | Description |
| --- | --- | --- | --- | --- |
| `gen_ai.usage.cache_creation_1h_tokens` | count | `{token}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id`, `query_source`, `trajectory.usage_bound` | Prompt-cache write tokens a completed turn billed at the 1-hour cache lifetime rate. |
| `gen_ai.usage.cache_creation_5m_tokens` | count | `{token}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id`, `query_source`, `trajectory.usage_bound` | Prompt-cache write tokens a completed turn billed at the 5-minute cache lifetime rate. |
| `gen_ai.usage.cache_creation_tokens` | count | `{token}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id`, `query_source`, `trajectory.output_source`, `trajectory.usage_basis`, `trajectory.usage_bound`, `trajectory.time_shifted`, `trajectory.cost_component`, `trajectory.oversight.kind`, `trajectory.oversight.outcome` | Tokens a completed turn, or an automated oversight review, wrote to the prompt cache. |
| `gen_ai.usage.cache_read_tokens` | count | `{token}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id`, `query_source`, `trajectory.output_source`, `trajectory.usage_basis`, `trajectory.usage_bound`, `trajectory.time_shifted`, `trajectory.cost_component`, `trajectory.oversight.kind`, `trajectory.oversight.outcome` | Tokens a completed turn, or an automated oversight review, read from the prompt cache. |
| `gen_ai.usage.input_tokens` | count | `{token}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id`, `query_source`, `trajectory.output_source`, `trajectory.usage_basis`, `trajectory.usage_bound`, `trajectory.time_shifted`, `trajectory.cost_component`, `trajectory.oversight.kind`, `trajectory.oversight.outcome` | Input tokens a completed turn, or an automated oversight review, used. |
| `gen_ai.usage.output_tokens` | count | `{token}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id`, `query_source`, `trajectory.output_source`, `trajectory.usage_basis`, `trajectory.usage_bound`, `trajectory.time_shifted`, `trajectory.cost_component`, `trajectory.output_bound`, `trajectory.oversight.kind`, `trajectory.oversight.outcome` | Output tokens a completed turn, or an automated oversight review, produced. |
| `trajectory.ai_process.running` | gauge | `{app}` | Host tags, User tags, `client_source`, `trajectory.client_source`, `owner_verified`, `match_method`, `signature_verified`, `publisher_verdict`, `ml_app` | 1 for each known AI tool a process scan found running, counting an app once however many processes it runs. |
| `trajectory.ai_process.scan_ms` | gauge | `ms` | Host tags, User tags, `ml_app` | How long one process scan took, listing and matching included; sent once per scan that read the process list. |
| `trajectory.instrumentation.capture.gap` | count | `{gap}` | Host tags, Platform tags, `trajectory.client_source`, `trajectory.user`, `component`, `signal`, `reason` | Missing or inconsistent capture evidence, such as missing usage, duplicate events, or unpublished old turns. |
| `trajectory.instrumentation.capture.hook_event` | count | `{event}` | Host tags, Platform tags, `trajectory.client_source`, `trajectory.user`, `component`, `signal`, `outcome`, `error_class`, `reason`, `hook_name` | Hook deliveries with a receipt handled by the capture server, by client and outcome, including retries. |
| `trajectory.instrumentation.capture.hook_latency_ms` | distribution | `ms` | `os.type`, `trajectory.version`, `trajectory.client_source`, `trajectory.user`, `outcome`, `error_class`, `reason` | Time the capture server spent on one hook request from start to finish, in milliseconds. |
| `trajectory.instrumentation.capture.recovered` | count | `{item}` | Host tags, Platform tags, `trajectory.client_source`, `trajectory.user`, `component`, `signal`, `kind`, `reason` | Turns or sessions that a history import or reconciliation wrote because live capture had missed them. |
| `trajectory.instrumentation.derivation.fallback` | count | `{fallback}` | Host tags, Platform tags, `trajectory.client_source`, `component`, `signal`, `source_pair`, `reason` | Times Trajectory used estimated or substitute data, such as estimated tokens or a missing parent trace link. |
| `trajectory.instrumentation.lifecycle.incident` | count | `{incident}` | Host tags, Platform tags, `trajectory.client_source`, `component`, `signal`, `trigger`, `outcome`, `reason` | Capture, update, owner, retirement, or replacement problems, tagged with the stable code that doctor shows. |
| `trajectory.instrumentation.publish.attempt` | count | `{attempt}` | Host tags, Platform tags, `trajectory.client_source`, `trajectory.user`, `component`, `signal`, `destination_type`, `site`, `outcome`, `error_class`, `reason` | Attempts to publish spans, metrics, event logs, or module outputs, by destination type and outcome. |
| `trajectory.instrumentation.publish.daily_sent` | gauge | `{turn}` or `{session}` | Host tags, Platform tags, User tags, `ml_app`, `kind`, `day` | Turns or sessions, as its kind tag says, whose completion point a destination accepted, counted by the point's UTC day in its day tag. |
| `trajectory.instrumentation.serve.budget_exceeded` | count | `{event}` | `trajectory.version`, `os`, `activity`, `history_bucket`, `cache_bucket`, `client_mix` | Five-minute intervals that ended with the Trajectory server over its idle, active, or memory budget. |
| `trajectory.instrumentation.serve.cpu_seconds_per_hour` | distribution | `s/h` | `trajectory.version`, `os`, `activity`, `history_bucket`, `cache_bucket`, `client_mix` | CPU seconds per hour that the Trajectory server process used over a five-minute interval. |
| `trajectory.instrumentation.serve.read_bytes_per_hour` | distribution | `By/h` | `trajectory.version`, `os`, `activity`, `history_bucket`, `cache_bucket`, `client_mix`, `accounting` | Bytes per hour that the Trajectory server process read over a five-minute interval, by accounting kind. |
| `trajectory.instrumentation.serve.rss_bytes` | distribution | `By` | `trajectory.version`, `os`, `activity`, `history_bucket`, `cache_bucket`, `client_mix` | Resident memory of the Trajectory server process in bytes, sampled every five minutes. |
| `trajectory.instrumentation.serve.store_bytes` | distribution | `By` | `trajectory.version`, `os`, `activity`, `history_bucket`, `cache_bucket`, `client_mix`, `store` | Size in bytes of one local database store that the Trajectory server uses, sampled every five minutes. |
| `trajectory.instrumentation.serve.wal_bytes` | distribution | `By` | `trajectory.version`, `os`, `activity`, `history_bucket`, `cache_bucket`, `client_mix`, `store` | Size in bytes of the write-ahead log of one local database store, sampled every five minutes. |
| `trajectory.instrumentation.serve.write_bytes_per_hour` | distribution | `By/h` | `trajectory.version`, `os`, `activity`, `history_bucket`, `cache_bucket`, `client_mix`, `accounting` | Bytes per hour that the Trajectory server process wrote over a five-minute interval, by accounting kind. |
| `trajectory.instrumentation.watchdog.gap_detected` | count | `{gap}` | Host tags, Platform tags, `trajectory.client_source`, `component`, `signal`, `reason`, `stage`, `outcome` | Problems the watchdog found, such as stuck capture stages or final-session publish claims still held. |
| `trajectory.inventory.extension.installed` | gauge | `1` | Host tags, Platform tags, User tags, `session_id`, `gen_ai.conversation.id`, `trajectory.client_source`, `ml_app`, `extension_name`, `extension_version`, `extension_kind`, `session_start_reason` | One extension, plugin, or MCP server installed in a client, reported once when a session starts. |
| `trajectory.ops.agent.active_sessions` | gauge | `{session}` | Host tags, Platform tags, User tags, `trajectory.client_source`, `ml_app` | Active sessions of one client, sampled hourly. |
| `trajectory.ops.agent.configured_model` | gauge | `1` | Host tags, Platform tags, User tags, `trajectory.client_source`, `ml_app`, `gen_ai.request.model` | 1 for the default model an installed coding agent's user configuration sets. |
| `trajectory.ops.agent.mcp.configured` | gauge | `1` | Host tags, Platform tags, User tags, `trajectory.client_source`, `ml_app`, `mcp_server`, `mcp_source_scope`, `mcp_enabled`, `mcp_host` | 1 for each MCP server an installed coding agent's configuration declares, for the user or one project; trajectory.inventory.extension.installed reports the servers a session loaded. |
| `trajectory.ops.agent.present` | gauge | `1` | Host tags, Platform tags, User tags, `trajectory.client_source`, `ml_app` | 1 while a supported coding agent is installed on the machine, reported daily, and one 0 when it is removed. |
| `trajectory.ops.agent.version` | gauge | `1` | Host tags, Platform tags, User tags, `trajectory.client_source`, `ml_app`, `client_version`, `trajectory.client_version`, `version_source`, `app_version`, `app_version_source`, `app_version_disposition` | 1 for each installed client, tagged with its detected version; reported daily. |
| `trajectory.ops.binary.heartbeat` | gauge | `{process}` | Host tags, Platform tags, User tags, `os.version`, `ml_app`, `managed`, `cohort`, `binary_state`, `version`, `egress_route`, `proxy_source` | Hourly: live serve processes on a Trajectory version, or 1 for the installed binary's version. |
| `trajectory.ops.install.agent_state` | gauge | `1` | Host tags, Platform tags, User tags, `trajectory.client_source`, `ml_app`, `role`, `managed`, `setup_binary_status`, `setup_binary_version`, `management_provider`, `agent_status`, `setup_stage`, `setup_outcome`, `setup_component`, `setup_capture_path`, `setup_next_step`, `reason` | 1 for a selected client's current managed setup state, 0 to close a state that changed. |
| `trajectory.ops.install.auto_instrument_state` | gauge | `1` | Host tags, Platform tags, User tags, `ml_app`, `install_owner`, `managed`, `auto_instrument_enabled`, `apply_enabled`, `allow_clients_configured`, `clients_hooked`, `publish_configured`, `reason` | 1 when auto-instrumentation has at least one allowed client fully configured to capture, else 0. |
| `trajectory.ops.install.current_state` | gauge | `1` | Host tags, Platform tags, User tags, `ml_app`, `role`, `managed`, `setup_binary_status`, `setup_binary_version`, `management_provider`, `outcome`, `reason` | 1 for the current managed setup outcome after setup verifies the install, 0 to close an earlier one. |
| `trajectory.ops.mdm_script.duration_seconds` | gauge | `s` | Jamf script tags, `outcome` | Wall time of one Jamf script run, in whole seconds. |
| `trajectory.ops.mdm_script.run.count` | count | `{run}` | Jamf script tags, `outcome`, `exit_code`, `reason`, `launch_exit`, `trajectory.user` | One Jamf script run, by outcome, exit code, reason, and launch's raw exit status. |
| `trajectory.ops.mdm_script.step.count` | count | `{step}` | Jamf script tags, `step`, `step_outcome`, `reason` | One step that a Jamf script run performs itself, by step, the step's outcome, and reason. |
| `trajectory.ops.mdm_script.warning.count` | count | `{warning}` | Jamf script tags, `step`, `reason`, `curl_exit`, `http_status_class` | One warning during a Jamf script run, sent as it happens, by step and reason. |
| `trajectory.ops.module.heartbeat` | gauge | `1` | Host tags, Platform tags, `trajectory.user`, `cohort`, `module_id`, `config_scope`, `schema_version`, `engine_id`, `client_source`, `module_enabled`, `evaluator_enabled`, `product_active`, `client_enabled`, `availability`, `enabled`, `mode`, `enforcement_gate`, `snapshot_status` | Hourly 1 for each Agent Security module or evaluator state entity, including disabled and unknown. |
| `trajectory.ops.module.observed_at` | gauge | `s` | Host tags, Platform tags, `trajectory.user`, `cohort`, `module_id`, `config_scope`, `schema_version`, `engine_id`, `client_source`, `module_enabled`, `evaluator_enabled`, `product_active`, `client_enabled`, `availability`, `enabled`, `mode`, `enforcement_gate`, `snapshot_status` | Unix time in seconds when the paired module state was observed; older than four hours is stale. |
| `trajectory.ops.org_sync.success_age_seconds` | gauge | `s` | Host tags, Platform tags, User tags, `ml_app`, `role`, `owner`, `managed`, `cohort`, `verified`, `sync_status`, `failure_reason`, `failure_scope`, `fetch_error_class`, `http_status_class`, `failure_streak` | Seconds since the last successful managed org configuration sync, or -1 if none was ever seen. |
| `trajectory.ops.required_destination.health` | gauge | `1` | Host tags, Platform tags, User tags, `ml_app`, `managed`, `cohort`, `destination`, `incognito_exempt`, `destination_state` | Per required destination: 1 active in every live serve, 0 a proven gap, -1 unknown. |
| `trajectory.ops.update.state` | gauge | `1` | Host tags, Platform tags, User tags, `ml_app`, `role`, `owner`, `managed`, `cohort`, `ring`, `floor`, `auto_update`, `installed_version`, `running_version`, `ring_version`, `check_freshness`, `state`, `configuration_profiles` | Hourly 1 describing update settings and whether the installed version is current, behind, or below the floor. |
| `trajectory.oversight.cost.usd.additive` | count | `USD` | Host tags, User tags, Client tags, Repository tags, Privacy tags, `ml_app`, `trajectory.trace_type`, `gen_ai.request.model`, `trajectory.oversight.kind`, `trajectory.oversight.outcome`, `cost_coverage`, `timing_provenance`, `duration_coverage` | Independent cost in USD of one automated oversight review. |
| `trajectory.oversight.duration_ms.total` | distribution | `ms` | Host tags, User tags, Client tags, Repository tags, Privacy tags, `ml_app`, `trajectory.trace_type`, `gen_ai.request.model`, `trajectory.oversight.kind`, `trajectory.oversight.outcome`, `cost_coverage`, `timing_provenance`, `duration_coverage` | Duration of one automated oversight review, as a sample for percentiles. |
| `trajectory.oversight.operations.total` | count | `{operation}` | Host tags, User tags, Client tags, Repository tags, Privacy tags, `ml_app`, `trajectory.trace_type`, `gen_ai.request.model`, `trajectory.oversight.kind`, `trajectory.oversight.outcome`, `cost_coverage`, `timing_provenance`, `duration_coverage` | One point for each automated oversight review the agent ran. |
| `trajectory.pr.ai_assisted.observations.total` | count | `{observation}` | Host tags, User tags, Client tags, Repository tags, `trajectory.trace_type`, `ml_app`, `trajectory.model_disclosure`, `source`, `change_host`, `change_number` | Signed count of completed turns with clear evidence of work on a PR, such as creating or acting on it. |
| `trajectory.pr.file_work.cost_indicator.usd.additive` | count | `USD` | Host tags, User tags, Client tags, Repository tags, Session tags, `trajectory.model_disclosure`, `source`, `change_host`, `change_number`, `lens`, `file_path`, `weight_unit`, `evidence_status`, `trajectory.cost_role` | Directional USD score of PR work, split by file and lens, sent only while export.pr_file_work_cost_indicator is on; not real spend, never add it to cost totals. |
| `trajectory.pr.interactions.total` | count | `{interaction}` | Host tags, User tags, Client tags, Repository tags, Session tags, `trajectory.model_disclosure`, `source`, `change_host`, `change_number`, `context_source`, `work_context_mode`, `identity_confidence`, `signal_confidence`, `local_range_status`, `trajectory.turn_id` | One point per turn that interacted with a PR, such as viewing it, acting on it, or naming it in the prompt. |
| `trajectory.pr.observations.total` | count | `{pr}` | Host tags, User tags, Client tags, Repository tags, Session tags, `trajectory.model_disclosure`, `source`, `change_host`, `change_number`, `signal_confidence`, `identity_confidence`, `attribution_reason`, `cost_coverage`, `context_source` | That a PR was seen in the session; each PR nets to 1, with tags for confidence, reason, and cost coverage. |
| `trajectory.pr.work.cost.usd.additive` | count | `USD` | Host tags, User tags, Client tags, Repository tags, Session tags, Cost overlap tags, `trajectory.model_disclosure`, `source`, `change_host`, `change_number`, `context_source`, `work_context_mode`, `identity_confidence`, `local_range_status`, `signal_confidence`, `attribution_reason`, `trajectory.turn_id`, `trajectory.cost_contract`, `trajectory.cost_source`, `trajectory.cost_status`, `trajectory.pricing_source`, `trajectory.cost_method`, `trajectory.cost_fidelity`, `trajectory.cost_basis`, `trajectory.pricing_unit`, `trajectory.pricing_version` | Share of a completed turn's cost assigned to a PR; each turn's shares add up to its full cost. |
| `trajectory.pr.work_turns.additive` | count | `{turn}` | Host tags, User tags, Client tags, Repository tags, Session tags, `trajectory.model_disclosure`, `source`, `change_host`, `change_number`, `context_source`, `work_context_mode`, `identity_confidence`, `local_range_status`, `signal_confidence`, `attribution_reason`, `trajectory.turn_id` | Fraction of a completed turn assigned to a PR; each turn's fractions across its PRs add up to 1. |
| `trajectory.pricing.lookup.total` | count | `{lookup}` | Host tags, Platform tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Cost overlap tags, Cost tags, `status`, `reason`, `client_surface`, `trajectory.model.canonical`, `trajectory.model.equivalence_status`, `trajectory.model.thinking_mode`, `trajectory.model.speed_mode`, `trajectory.model.billing_mode`, `trajectory.model.context_mode` | Model pricing lookups in a session, by result, reason, and model. |
| `trajectory.security.agent_security.active` | gauge | `1` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate` | 1 when an Agent Security evaluator ran in this 10-second bucket for the tagged engine, client, and event. |
| `trajectory.security.agent_security.custody` | count | `{record}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `record_type` | Durable Agent Security decision and custody records saved, by record type. |
| `trajectory.security.agent_security.decisions` | count | `{decision}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `decision` | Agent Security evaluator decisions, by the decision the evaluator returned. |
| `trajectory.security.agent_security.duration_ms` | distribution | `ms` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate` | Time one Agent Security evaluation took, in milliseconds. |
| `trajectory.security.agent_security.evaluations` | count | `{evaluation}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `outcome` | Agent Security evaluations, by outcome: success, timeout, error, or degraded. |
| `trajectory.security.agent_security.fail_open` | count | `{evaluation}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `reason` | Agent Security evaluations that let the action proceed because evaluation failed, by reason. |
| `trajectory.security.agent_security.projection` | count | `{finding}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `outcome` | Agent Security finding log submissions to Datadog, by outcome: success or failure. |
| `trajectory.security.agent_security.skill_scanner.cache_evictions` | count | `{entry}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `verdict`, `quota` | Unexpired skill scanner cache entries removed to make room, by verdict and quota. |
| `trajectory.security.agent_security.skill_scanner.coverage_gaps` | count | `{gap}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `reason` | Skill scanner coverage gaps, by reason. |
| `trajectory.security.agent_security.skill_scanner.deferrals` | count | `{deferral}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `reason` | Skill scanner work deferred because a resource limit was reached, by reason. |
| `trajectory.security.agent_security.skill_scanner.excluded_files` | count | `{file}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `reason` | Credential files excluded from a skill scanner collection attempt, by reason. |
| `trajectory.security.agent_security.skill_scanner.failures` | count | `{failure}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `stage`, `reason`, `limit` | Skill scanner failures, by stage, reason, and the limit reached when applicable. |
| `trajectory.security.agent_security.skill_scanner.request_duration_ms` | distribution | `ms` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate`, `operation`, `outcome` | Time one skill scanner hash lookup or upload request took, in milliseconds, by operation and outcome. |
| `trajectory.security.agent_security.would_block` | count | `{decision}` | Host tags, Platform tags, `trajectory.user`, `repo`, `owner`, `env`, `cohort`, `module_id`, `engine_id`, `trajectory.client_source`, `canonical_event`, `mode`, `component`, `disclosure_profile`, `enforcement_gate` | Agent Security results that would have blocked an action, in observe mode or under the enforcement veto. |
| `trajectory.serve.backfill.failure_total` | count | `{failure}` | Host tags, Platform tags, User tags, `ml_app`, `stage`, `reason`, `failure_scope`, `error_class`, `http_status_class`, `transport` | A managed backfill step, or an outbox drain that backfill started, failed; by stage and reason. |
| `trajectory.serve.capture.request_error_total` | count | `{request}` | Host tags, Platform tags, User tags, `ml_app`, `client`, `event_type`, `error_kind`, `http_status_class` | Capture HTTP requests that returned 4xx or 5xx or failed in the handler, by client and error kind. |
| `trajectory.serve.goroutine.panic_recovered_total` | count | `{panic}` | Host tags, Platform tags, User tags, `ml_app`, `goroutine`, `action` | A serve background task panicked and was restarted or given up on, by task and action. |
| `trajectory.serve.local_state.publish_ledger_held_claims` | gauge | `{claim}` | Host tags, Platform tags, User tags, `ml_app`, `artifact_scope` | Publish ledger claims still held long after any live publish could need them, sampled hourly. |
| `trajectory.serve.terminal_recovery.oldest_age_seconds` | gauge | `s` | Host tags, Platform tags, User tags, `ml_app`, `feature` | Seconds since the last event of the oldest ended session still waiting for recovery, per feature. |
| `trajectory.serve.terminal_recovery.pending` | gauge | `{receipt}` | Host tags, Platform tags, User tags, `ml_app`, `feature` | Ended sessions whose finalization receipts still wait for recovery, per feature. |
| `trajectory.session.commits.completed_count` | count | `{commit}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.session_models` | Git commits the agent made in one finished session, sent once when the session ends. |
| `trajectory.session.completed` | count | `{session}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.session_models` | One point for each session that ended and was not abandoned. |
| `trajectory.session.count` | count | `{session}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `start_type`, `trajectory.session_start_sequence` | One point for each live session start, tagged fresh, resume, continue, or agents view. |
| `trajectory.session.duration_ms` | gauge | `ms` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.session_models` | Wall-clock duration of a completed session. |
| `trajectory.session.last_seen.unix` | gauge | `s` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.session_models` | Time of the session's latest source event, in Unix seconds. |
| `trajectory.session.pr_attribution.context` | gauge | `{pr}` | Host tags, User tags, Client tags, Repository tags, Session tags, `trajectory.model_disclosure`, `source`, `attribution_source`, `trajectory.session_models` | Distinct PRs that received a share of at least one completed turn in the session, priced or not. |
| `trajectory.session.pr_attribution.created` | gauge | `{pr}` | Host tags, User tags, Client tags, Repository tags, Session tags, `trajectory.model_disclosure`, `source`, `attribution_source`, `trajectory.session_models` | Distinct PRs the session created successfully. |
| `trajectory.session.pr_attribution.interacted` | gauge | `{pr}` | Host tags, User tags, Client tags, Repository tags, Session tags, `trajectory.model_disclosure`, `source`, `attribution_source`, `trajectory.session_models` | Distinct PRs observed in the session, including low-confidence and unpriced ones. |
| `trajectory.session.prs.completed_count` | count | `{pr}` | Host tags, User tags, Client tags, Repository tags, Session tags, `trajectory.model_disclosure`, `trajectory.session_models` | Pull or merge requests the agent created in one finished session; not PRs that only received work. |
| `trajectory.session.pushes.completed_count` | count | `{push}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.session_models` | Git pushes in one finished session, sent once when the session ends. |
| `trajectory.session.test_fix_cycles.completed_count` | count | `{cycle}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.session_models` | Completed test-fail, code-edit, test-pass cycles in one finished session; zero is sent too. |
| `trajectory.turn.agents.peak_running` | gauge | `{agent}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `agent_kind` | The most agents at work at the same moment during a completed turn: turns in flight on the machine, this one included, or this session's sub-agents. |
| `trajectory.turn.code_edit_tool.decision` | count | `{decision}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `tool_name`, `decision`, `source`, `permission_mode`, `approval_path`, `language` | Recorded permission decisions on code-edit tool calls in a completed turn. |
| `trajectory.turn.commits` | count | `{commit}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id` | Git commits the agent made in one turn, one per commit. |
| `trajectory.turn.compactions.additive` | count | `{compaction}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id` | Context compactions during a completed turn. |
| `trajectory.turn.completed` | count | `{turn}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.app_version`, `trajectory.turn_id` | One point for each completed turn; a Claude Code, Codex, or Pi turn that called no model sends none. |
| `trajectory.turn.cost.usd.additive` | count | `USD` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, Cost overlap tags, Cost tags, `trajectory.app_version`, `trajectory.turn_id`, `trajectory.cost_contract`, `query_source`, `trajectory.output_source`, `trajectory.usage_basis`, `trajectory.cost_component`, `trajectory.time_shifted`, `trajectory.cost_bound`, `trajectory.cost_bound_reason` | Cost in USD of a completed turn, summable across turns and sessions. |
| `trajectory.turn.duration_ms` | gauge | `ms` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id` | Wall-clock duration of a completed turn. |
| `trajectory.turn.errors.additive` | count | `{error}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `trajectory.activity_execution_contract`, `category`, `trajectory.error_capture_status` | Tool errors in a completed turn for one error category. |
| `trajectory.turn.force_pushes` | count | `{push}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id` | Git force pushes the agent ran in one turn. |
| `trajectory.turn.language_activity` | count | `{invocation}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `language` | Tool calls on files of each programming language in one turn, tagged by language. |
| `trajectory.turn.lines_of_code.count` | count | `{line}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id`, `type` | Lines of code a completed turn added or removed, split by the type tag. |
| `trajectory.turn.number` | gauge | `{turn}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id` | The completed turn's number within its session; numbers can have gaps. |
| `trajectory.turn.permissions_denied` | count | `{event}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `tool`, `category`, `source` | Tool permission denials in one turn, tagged by tool, category, and which report recorded the denial. |
| `trajectory.turn.prs` | count | `{pr}` | Host tags, User tags, Client tags, Repository tags, Session tags, `trajectory.turn_id`, `trajectory.model_disclosure`, `change_host`, `change_number` | Pull or merge requests the agent created in one turn, tagged by the PR's host, owner, repo, and number. |
| `trajectory.turn.skill_distinct_tools.total` | distribution | `{tool}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `skill_name`, `detected_from`, `source_scope`, `signal_confidence`, `skill_attribution` | Distinct tools, not counting skill tools, used in a turn where a skill was invoked. |
| `trajectory.turn.skill_duration_ms.total` | distribution | `ms` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `skill_name`, `detected_from`, `source_scope`, `signal_confidence`, `skill_attribution` | Duration of a turn where a skill was invoked. |
| `trajectory.turn.skill_invocations` | count | `{invocation}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `skill_name`, `detected_from`, `source_scope`, `signal_confidence`, `attribution_reason` | Skill invocations in one turn, by skill name, evidence source, source scope, confidence, and reason. |
| `trajectory.turn.skill_tool_uses.additive` | count | `{call}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `skill_name`, `detected_from`, `source_scope`, `signal_confidence`, `skill_attribution`, `tool_name`, `tool_type` | Tool calls for one tool in a turn where a skill was invoked, summable over time. |
| `trajectory.turn.skill_tool_uses.total` | distribution | `{call}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `skill_name`, `detected_from`, `source_scope`, `signal_confidence`, `skill_attribution` | Total tool calls in a turn where a skill was invoked. |
| `trajectory.turn.subagents` | count | `{invocation}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `trajectory.activity_execution_contract`, `trajectory.subagent_capture_status` | Confirmed sub-agent launches in a completed turn. |
| `trajectory.turn.thinking_tokens` | count | `{token}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id` | Reasoning tokens a completed turn used. |
| `trajectory.turn.tool_decision` | count | `{decision}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id`, `tool_name`, `decision`, `source`, `permission_mode`, `approval_path` | Recorded permission decisions on tool calls in a completed turn. |
| `trajectory.turn.tool_uses` | gauge | `{call}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id`, `tool_name`, `tool_type`, `mcp_server`, `mcp_tool`, `mcp_source_scope`, `signal_confidence`, `identity_confidence`, `attribution_reason`, `lifecycle_coverage`, `tool_outcome` | Tool calls in a completed turn for one tool, as a gauge sample. |
| `trajectory.turn.tool_uses.additive` | count | `{call}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id`, `tool_name`, `tool_type`, `mcp_server`, `mcp_tool`, `mcp_source_scope`, `signal_confidence`, `identity_confidence`, `attribution_reason`, `lifecycle_coverage`, `tool_outcome` | Tool calls in a completed turn for one tool, summable over time. |
| `trajectory.turn.user_frustrations` | count | `{event}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id` | Times the user expressed frustration or corrected the agent in one turn, detected from the prompt. |
| `trajectory.turn.user_interruptions` | count | `{event}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, `trajectory.turn_id` | Times the user interrupted the agent mid-response in one turn. |
| `trajectory.turn.web_search.cost.usd.additive` | count | `USD` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, Cost overlap tags, Cost tags, `trajectory.turn_id`, `trajectory.cost_contract`, `query_source` | Web search cost in USD of a completed turn. |
| `trajectory.turn.web_search.requests.additive` | count | `{request}` | Host tags, User tags, Client tags, Repository tags, Session tags, Privacy tags, Turn pricing tags, `trajectory.turn_id` | Web search requests a completed turn made. |
<!-- END GENERATED TABLE metrics -->
