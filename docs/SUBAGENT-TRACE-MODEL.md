# Subagent Trace Model

This page explains how Trajectory shows subagents in traces and metrics. A
subagent is a child agent that a parent session starts for delegated work.

Trajectory puts a subagent in the parent's trace only when it can prove the
launch. A proven launch has a matching launch tool call and child session.

- The tool call that started the child owns a task span, called the launch
  anchor. The tool is `Task`, `Agent`, or `spawn_agent`. The anchor carries no
  metrics.
- The child's recorded turns keep their child `session_id`. Their parent is the
  launch trace and the launch anchor. Trajectory does not also publish them as
  a separate child trace.
- An async child can report back in a later turn, called the join. There,
  Trajectory adds a `subagent-result` span to the join trace. It carries no
  metrics and links back to the launch anchor across traces. The launch keeps
  the execution and all billable usage.

Datadog span search does not return native span links yet. So the result span
also stores the link as metadata: `launch_trace_id`, `launch_span_id`, and
`launch_link_type=subagent_launch`. The same values appear in the
`trajectory.subagent.launch_*` tags. Search on those tags to find the launch
for a result.

The default mode is `export.subagent_span_mode: semantic`. To remove the extra
parent-side subagent task span, set `export.subagent_span_mode: links_only`.
You can also set `subagent_span_mode: links_only` on one destination. In that
mode, the tool call that started the child is the launch anchor.

## Invariants

| Case | Parent-side spans | Links |
| --- | --- | --- |
| Sync launch with a matching `tool_use_id` | A `subagent-*` task span sits under the `Task`, `Agent`, or `spawn_agent` tool span that started it. It carries `subagent_attachment: launch`. Child turns sit under it in the same trace. | Launch metadata keeps the parent and child IDs. |
| Async launch that joins through a task notification | The same launch task holds the child's execution. A `subagent-result` span with no metrics sits under the turn where the notification arrives. | The result span links to the launch anchor in the other trace. |
| Lifecycle events with no matching launch tool | A standalone subagent agent span sits under the active turn. It carries `subagent_attachment: standalone`. | The span keeps the child session ID. Trajectory adds no trace or span link to a child root that it did not export. |
| `links_only` mode | Trajectory adds no parent-side `subagent-*` task span. Child turns sit directly under the tool call that started them. | An async result links back to that tool call. |

An ancestry field on its own never changes which trace a session belongs to.
While the parent session is open, the publisher waits for a matching launch.
It publishes ancestry-only and ambiguous relationships as independent
sessions. Before it attaches nested agents, it checks for cycles and for a
maximum depth.

Before the first publish, Trajectory saves the session's trace model in the
session's publish sentinel file: `parented` or `independent`. A config reload
or a restart then cannot split one session across both models. Live
publishing, final publishing, backfill, replay, and nested-ancestry checks all
read this saved value. A sentinel file from an older binary has no model
field. Trajectory treats it as `independent`. The new default applies only to
sessions started by a binary that can save the model.

The session JSONL file can mix parent and child events. So every trace and
metric view must first pick the session that owns each event. It does this
before it groups turns, pairs tool calls, or counts anything. `agent_id` names
the agent that wrote the event. `child_session_id` on a parent-side lifecycle
event describes the relationship. Turn IDs link events together. Never count
them as a number of turns or agents. This rule applies to every client.

## Metrics Contract

Claude Code, Codex, Cursor, GitHub Copilot CLI, and OpenCode count launches
the same way. Each distinct `subagent_start` event backed by client data adds
one to `trajectory.turn.subagents`. The point carries the tag
`trajectory.activity_execution_contract:confirmed_v1`. A stable launch or child
ID removes duplicates when lifecycle events replay. If the client data is
missing, failed, or ambiguous, Trajectory counts no launch.

Cursor `subagent_stop` records `subagent_usage_status` as `complete`,
`partial`, or `unavailable`. Trajectory adds a child model, token counts, and a
USD cost only when it knows the child model. It also needs one of these:

- complete native child usage
- a known native child cost
- a separately captured child session whose final turns are complete

Desktop hooks and the cursor-agent CLI use the same rule. When the child data
is incomplete, Trajectory adds no usage. A launch that Trajectory builds itself
never counts the parent turn that started it as child usage. The
`trajectory.subagent_usage_status` metric counts each status value. So you can
see when child usage is unavailable, and Trajectory does not invent tokens or
cost.

Sometimes no proxy or native LLM span exists for the child. Then complete
final data from Claude or Cursor can produce one synthetic child LLM span under
the launch anchor. It carries the child model, child token counts, and child
cost. For Codex, OpenCode, and any Cursor child with real usage, the recorded
child turns always take priority. Final totals stay as metadata. They never
become a second billable span.

Trajectory reads child data once for each publish request. It shares the
result across destinations and older turns. Complete totals can arrive while a
matching child session is still open. In that case, Trajectory keeps the
publish queued and retries later. It does not pick a source from a partial
read. If the child file is missing, Trajectory waits a short time before it
accepts the totals. A child session that is being created at the same time
then has a chance to appear. When recorded child turns have real LLM spans,
the local EVP view adds no synthetic fallback LLM span, as cloud publishing
does. The recorded child turns stay visible under the launch anchor.

Some Cursor `Task` or `Agent` launches have no matching child. For each one,
Trajectory records a `capture_diagnostic` event with
`diagnostic_kind=cursor_unpaired_task_launch`. It creates
no lifecycle or child spans. Complete native child usage can arrive later.
Then a `subagent_usage_amendment` event replaces the unavailable usage once.
It does not copy parent usage or count the launch again.

Trajectory no longer counts `Agent` tool markers as subagent launches. It
ignores marker profiles and stored rows that still count them. Only confirmed
launches feed `trajectory.turn.subagents`. Untagged older points are not
lifecycle data. Do not add them to the confirmed launch count.

## Client Validation Matrix

| Client | What the client records | Expected spans |
| --- | --- | --- |
| Claude Code | Native `SubagentStart` and `SubagentStop` events, with a `Task` or `Agent` launch tool. Async background work returns through a `task_notification` user prompt. | Sync and async execution stay under the launch task. Async completion adds a result span at the join. Complete totals supply a child-model LLM span only when no native child spans exist. |
| Codex | Recent rollouts keep `spawn_agent` function calls and their final outputs. Richer streams can also keep collaboration lifecycle events and a separate child rollout. Current outputs can show only `task_name`, with no child thread ID. Codex 0.154 then records the child thread in an `item_completed` `SubAgentActivity` item. The item ID is the `spawn_agent` call ID. A child can complete many tasks. It gets one `subagent_stop` when its final state is known: at shutdown, at the end of an exec session, or when history is finished. It ends at its last completed task. It is `interrupted` if it never completed. It is also `interrupted` if work it started after its last completion was interrupted while the session kept running. | A successful `spawn_agent` launch always creates a launch task under the tool call. A launch with only a task name stays visible, with no invented child trace or usage. If a real child ID is present or arrives later, the child rollout's turns attach under the same launch. Final totals never duplicate those turns. User forks with ancestry but no matching launch stay independent. |
| Cursor Desktop | Command-hook `subagentStart` and `subagentStop` payloads. Current Desktop fixtures can be sync, or async in the task-notification style. | A lifecycle event linked to its tool call attaches the child's turns at the launch. Ancestry or lifecycle without the tool call stays standalone or unresolved. Trajectory never guesses a parent. |
| cursor-agent CLI | The CLI often records no lifecycle events, even when `Task` creates a child transcript. Trajectory pairs saved `Task` and `Agent` calls with child transcripts and adds lifecycle events linked to the launch. Native hooks take priority. | Sync and async execution that Trajectory builds attach under the launch anchor. Async completion adds a result span at the notification join. |
| GitHub Copilot CLI | Command-hook lifecycle payloads, plus transcript metadata. The metadata gives the real child tool-call ID and the parent task tool ID. | Lifecycle attaches under the `Agent` or `Task` tool that started it, when the hook carries the recovered `tool_use_id`. |
| Gemini CLI (retired) | No live capture. Saved `kind:"subagent"` history gets `provider_session_kind` and `agent_type` on `session_start`. Trajectory adds no `subagent_start` or `subagent_stop`. | Saved subagent sessions stay standalone, because the history has no launch lifecycle. |
| Antigravity CLI (`agy`) | Current native hooks give no child conversation ID or subagent lifecycle ID. | Trajectory does not infer subagent parentage from invocation or tool metadata. |
| Factory Droid | The public hook set includes `SubagentStop` but not `SubagentStart`. | A stop event with no start becomes a standalone subagent span under the active turn. |
| OpenCode | Every observed child `session.created` event carries `info.id` and `info.parentID`. Trajectory records them as the immediate provider ancestry on the child's first `SessionStart`. A launch also needs exactly one pending `Task` call to pair with that child. Child idle or delete closes the link. | The immediate `parent_session_id` is enough for ancestry and navigation. Trajectory adds a `subagent-*` launch span only when exactly one `Task` call can pair. The span carries both the child ID and the launch tool ID. With several pending `Task` calls, Trajectory keeps the ancestry and adds no launch. Agent metadata alone never creates a parent link. |
| Kilo | The OpenCode-compatible plugin, routed through `/capture/kilo/...`. It records ancestry and pairs launches the same way as OpenCode. | Same as OpenCode. The immediate `parent_session_id` drives ancestry and navigation. Only a single `Task` pairing adds a launch span. |
| Pi / OhMyPi | Pi live capture and Pi and OhMyPi history keep the provider's parent-session links. Official `pi-subagents` child processes set `PI_SUBAGENT_CHILD=1` and pass their parent in `PI_SUBAGENT_PARENT_SESSION`. Trajectory records that as a subagent relationship. Other Pi children in print or JSON mode that inherit the parent's `TRAJECTORY_PI_PARENT_SESSION` get the same relationship. Backfill reads only its own closed transcript layout. Neither source gives a child launch lifecycle with a launch tool ID. | Parent links support navigation between sessions and the local UI. Official Pi subagent links are also copied to the older relationship table. Trajectory does not count them or turn them into subagent task spans. Native Pi fork and new-session ancestry, and OhMyPi ancestry, stay relationship-only. |

## OpenCode And Kilo Nested Sessions

OpenCode, and the compatible Kilo plugin, can create a nested child session
for delegated work. That child can nest further, several levels deep. Not
every delegation creates a child session. Trajectory records what it sees and
never assumes a child exists. For each child it sees, it records two separate
facts. It never uses one in place of the other.

- **Provider ancestry** is the immediate `parentID` that OpenCode assigns when
  it creates the child. When `session.created` supplies it, the plugin records
  it as `parent_session_id` on the child's first `SessionStart`. Ancestry
  drives parent, breadcrumb, and child navigation in the local viewer.
- **Launch lifecycle** is the parent-side `subagent-*` span. It needs a
  matching `Task` tool call. Trajectory adds it only when exactly one pending
  `Task` call can pair with the new child session.

Ancestry supports navigation only. It does not count as a launch, and it does
not add to the confirmed `trajectory.turn.subagents` count. Only a matching
`Task`-to-child pairing adds a launch span and a counted launch.

Each proven child execution joins the launch trace. It keeps its immediate
`parent_session_id` and child `session_id`. The viewer works out the
`root_session_id` and the full ancestry when it reads the session.
Ancestry-only relationships stay independent. They do not create a launch
structure.

### Expected results by case

| Case | Provider ancestry | Launch span | Launch counted |
| --- | --- | --- | --- |
| New child with one pending `Task` call | The immediate parent is recorded. | The launch span carries the child ID and `tool_use_id`. | Yes, once. |
| Nested children, several levels deep | Each level records its immediate parent. A grandchild points to the child, not the root. | Each level with a single `Task` pairing adds its own launch. | One for each proven level. |
| Resumed `task_id` | The existing child ID is reused. No second child `SessionStart` occurs. | One launch for that `Task` call, safe to replay. Trajectory adds no new child start. | Not counted twice. |
| Child with ancestry and no launch tool | The immediate parent is recorded. | None. | No. |
| Several `Task` calls at once | The immediate parent is still recorded. | None. The plugin does not guess which call started the child. | No. |
| Plugin state lost, then repaired | OpenCode's stored `parentID` restores ancestry on the same provider session. | Not rebuilt. Richer native lifecycle data and `task_tool_use_id` are kept, never deleted. | The repair adds no launch or completion. |
| Child in another directory or on another server | Recorded only when the plugin sees the `session.created` event for both sessions. Otherwise ancestry is missing or incomplete. | None when the plugin cannot see the child. | No. |

### Oh My OpenAgent

Oh My OpenAgent (OMO) runs orchestration on top of OpenCode sessions.
Trajectory has no separate capture source for it. OMO has no `client_source`
of its own and no OMO-specific instrumentation. The OpenCode plugin captures
its activity.

An OMO path can ask OpenCode to create or reuse a session ID. That child then
follows the ancestry and launch rules above. Some OMO delegation creates no
nested provider session at all. For example, its Sisyphus-Junior worker runs
through the native `Task` path with no separate child session. Then there is
nothing extra to link. Trajectory never infers OMO structure from agent names,
prompts, timing, project, or any other guess.

The local viewer treats every OpenCode or Kilo child as a separate session
that you can open on its own. For the full viewer navigation rules, see
[CLIENT-INSTRUMENTATION.md](CLIENT-INSTRUMENTATION.md).

## Parentage Rule

Do not infer subagent parentage from agent metadata alone. A child attaches to
a parent only when it has a child session ID and one of these:

- a launch tool ID
- a task-notification join point
- a standalone lifecycle event
