# Traces

This page describes the traces Trajectory sends to Datadog LLM Observability
and OTLP collectors: their structure, span tags, and how subagents nest. To
choose where traces go and how much content they carry, see
[Publishing](PUBLISH.md).

## Trace structure

Each turn is one trace. The turn root has model inference, tool, and LLM call
children. Every span in it is tagged `trajectory.trace_type:turn` and carries
`trajectory.session_id`. No session index span is sent by default, so traces
start at the turn.

`trajectory.trace_type` is `turn` or `oversight`. Filter on it, and never infer
the type from span structure.

Automated oversight is a model-based reviewer that judges an action or
output. Trajectory reports it as oversight, not as a user session or subagent.
`oversight_publish_mode` controls what it sends:

- `summary`, the default, sends one span with no content, tagged
  `trajectory.oversight.kind`, `trajectory.oversight.outcome`, and
  `trajectory.oversight.linked`, plus usage metrics. The summary links to the
  reviewed work. It never copies it.
- `full` also sends the reviewer's own trace.
- `off` sends neither.

## Spans and tags

### Span types

- **Turn root**: `trajectory.semantic_type:turn` and `trajectory.session_id`.
  It may carry `gen_ai.request.reasoning_effort`, `trajectory.service_tier`,
  and `trajectory.billing_lane`.
- **Agent message**: `trajectory.semantic_type:agent_message`, named like
  `inference-0`.
- **Tool**: its parent is the agent message span that made the call, or the
  turn root.
- **Permission wait**: a `permission-wait` span,
  `trajectory.semantic_type:permission_wait`, under its tool span. It carries
  both permission tags and no metrics or input.
- **Compaction**: `trajectory.semantic_type:compaction` and
  `trajectory.trace_correlation.session_id`.
- **LLM call**: a real model call, tagged `trajectory.llm_call:true`. It may
  carry `trajectory.cost_source`, `trajectory.service_tier`, and
  `trajectory.billing_lane`.
- **Synthetic LLM span**: tagged `trajectory.placeholder_llm_span:true` and
  `trajectory.llm_span_role:turn_usage_carrier`. It carries the turn's totals
  when no real call span exists. At `standard` and `full` it repeats the turn's
  input and output, marked as totals. At `minimal` it carries neither.

A span with a semantic event name can carry `trajectory.semantic_name`.

Set `export.placeholder_llm_span: false`, or the same key on a destination, to
drop the synthetic span. The turn spans keep `metrics.estimated_total_cost`
and the cost tags.

Trajectory joins captured LLM calls to turns by ID or start time. A call with
no confirmed turn stays local and never becomes a span.

### Identity tags

Every span carries identity tags, with a fallback when a value is missing.
Context tags appear only when the source data exists. Trajectory never
invents them.

- `ml_app` and `service` come from the destination and default to
  `coding-agents`. `env` also comes from the destination.
- `host` comes from a host lookup and falls back to `unknown`. It creates no
  Datadog host.
- `trajectory.version` is the Trajectory version, or `dev`.
  `trajectory.client_version` is the agent's version.
  `trajectory.app_version` is the desktop app's version. CLI and SDK sessions
  have none.
- `trajectory.client_source` comes from `session_start.client_source`, such as
  `codex`, `claude-code`, `agy`, or `goose`. Claude Code keeps `claude-code` in
  every entry point. `trajectory.entrypoint` is `claude-desktop` for the Code
  tab, `cli`, or `sdk`.
- `trajectory.format_version` appears when capture records
  `session_start.format_version`.
- `trajectory.user`, `trajectory.user_email`, `git.email`, and
  `github.username` appear when resolved on the computer.
- `gen_ai.request.model` is the raw model label, the same as on metrics.
- `project_dir` holds only the last segment of the folder path, up to 255
  bytes.
- `trajectory.capture_level` is the capture or export level, such as
  `minimal`, `standard`, or `full`.
- `trajectory.account_billing_mode` (`subscription`, `usage_based`, or
  `free`), `trajectory.account_plan_type`, and
  `trajectory.account_billing_source` describe the account. They hold no
  credentials or identity.

### Token and cost tags

- `trajectory.token_source` names where a turn's tokens came from, such as
  `cursor_hook_turn_ended`. Trajectory never guesses a missing source.
- For Cursor turns, `trajectory.token_fidelity` is `native_turn_aggregate` or
  `transcript_fallback`. `trajectory.token_correlation:exact_generation_id`
  means the counts match one generation.
- The span metadata field `token_usage_provenance`, which is not a tag,
  records where tokens came from, such as `provider_native` or
  `native_session_aggregate`.
- A turn span with a cost carries `metrics.estimated_total_cost` in
  nanodollars, `estimated_total_cost_nanodollars`, `estimated_total_cost_usd`,
  and `trajectory.cost_source:turn_metrics`.
- Cursor cost detail is in span metadata under `cost_attribution.*`: the rate
  card, version, checksum, dates, and rates per token. It never becomes a
  metric tag.
- Session, turn, inference, and synthetic LLM spans carry the cost overlap
  tags as context. See
  [Overlap tags](COSTS.md#overlap-tags).
  For a `mixed` trace, use the turn span's tags.

Use metrics for cost totals. Never add up spans to get cost for a dashboard.

### Other span fields

- Model call spans carry typed `max_tokens`, `stream`, and
  `gen_ai.response.finish_reasons`.
- Claude tool spans with a permission decision carry `permission_decision` and
  `permission_source`, plus wait time, run time, and source metadata.
- When you start Claude Code with `trajectory claude`, which relays its native
  traces, Trajectory records tool timing. It holds a turn's publication for up
  to 60 seconds to do so.
- Claude assistant text is cut at a byte limit without splitting a UTF-8
  character. Cut steps, the turn root, and the synthetic span carry
  `output_truncated:true`.
- If Trajectory renames a tool, local records and Event Stream records keep
  the client's name in `native_tool_name`.

### PR work on turn roots

A turn root with one clear PR carries `change_host`, `owner`, `repo`,
`change_number`, `context_source`, `work_context_mode`, `identity_confidence`,
and `local_range_status`. These come from local commands and limited Git
state. They never include commands, paths, refs, URLs, or object IDs, and
only turn roots carry them. A turn root that Datadog accepted before the PR
was known is never changed or sent again. Use metrics for work linked later.

## Subagents

A subagent is a child agent that a parent session starts for delegated work.
The launching `Task`, `Agent`, or `spawn_agent` call owns a task span with no
metrics. The child's turns keep their own `session_id` beneath it.

`export.subagent_span_mode` sets the layout:

- `semantic`, the default: a sync launch with a matching `tool_use_id` gets a
  `subagent-*` span under the launching tool span, tagged
  `subagent_attachment: launch`. Its child turns go beneath it.
  Async children also stay under the launch, where their billable usage
  stays. A `subagent-result` span with no metrics in the notification turn
  links back to the launch.
- `links_only` sends no `subagent-*` or task spans. Child turns sit under the
  launching tool call, and async results link to it.

Span search does not read span links. So result spans also store
`launch_trace_id`, `launch_span_id`, `launch_link_type`, and
`trajectory.subagent.launch_*` tags.

A child joins its parent's trace only through its child session ID plus the
launch tool ID, a notification join, or a lifecycle event. Otherwise it stays
independent. Lifecycle events with no matching launch create a standalone
agent span under the active turn, tagged `subagent_attachment: standalone`,
with no links.

A reconstructed launch never counts the parent turn that started it as child
usage. If complete Claude or Cursor totals have no child LLM span or child
turns, Trajectory adds one synthetic span. It never bills them twice.

By client:

- **Claude Code**: sync and async subagents stay under the launch task. The
  result span sits at the async join.
- **cursor-agent CLI**: saved `Task` and `Agent` calls pair with child
  transcripts. Sibling CLI children link only when their prompts match
  exactly. Otherwise they stay unlinked.
- **Codex**: each successful `spawn_agent` creates a launch task, and child
  turns attach by child ID. A fork you start with no launch stays independent.
- **GitHub Copilot CLI**: subagents attach under the launching `Agent` or
  `Task` tool when the hook carries the recovered `tool_use_id`.
- **Cursor Desktop**: child turns attach at the launch when lifecycle events
  link them to their tool call. Otherwise they stand alone.
- **OpenCode and Kilo Code**: the child's `parentID` becomes
  `parent_session_id` for navigation. A counted launch needs exactly one
  pending `Task` call. Children in another folder or server get ancestry only
  if the plugin sees `session.created` for both.
- **Pi and Oh My Pi**: parent links, including `pi-subagents` children, are for
  navigation only. They create no subagent spans or counts.

## Sessions across clients

- Each turn a client ran keeps its own trace. If you later backtrack, that
  turn root gets `trajectory.branch_state:abandoned`.
- Context a fork inherits is for resuming only and creates no child turn
  traces.
- If client storage names a parent session, Trajectory records it as span
  attributes, not as another index trace.
- Claude Code's own native traces use the session `claude-native:<session>`
  in their own `ml_app`. `claude_code.session_id` keeps the raw ID for
  matching.
