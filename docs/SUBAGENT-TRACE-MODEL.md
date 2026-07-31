# Subagent Trace Model

Trajectory renders subagents with two separate relationships:

- Parent-side semantic spans make the trace tree readable at the workflow point
  where the parent agent launched or joined the child work.
- Span links preserve cross-trace navigation to the child session trace without
  collapsing the child trace under the parent turn.

The default mode is `export.subagent_span_mode: semantic`. Set
`export.subagent_span_mode: links_only`, or destination
`subagent_span_mode: links_only`, to suppress the extra parent-side subagent
task span while keeping child trace links and child metadata on the nearest
existing parent span.

## Invariants

| Shape | Parent-side rendering | Link rendering |
| --- | --- | --- |
| Sync launch with matching `tool_use_id` | A `subagent-*` task span is parented to the launching `Task` or `Agent` tool span and carries `subagent_attachment: launch`. | The launch tool span and subagent task span link to the child session root. |
| Async launch with task notification join | The launch tool span is annotated with launch metadata; a `subagent-*` task span is parented to the task-notification join turn and carries `subagent_attachment: join`. | The launch tool span and join task span link to the child session root. |
| Lifecycle without a matching launch tool | A standalone subagent agent span is parented to the active turn and carries `subagent_attachment: standalone`. | The standalone span links to the child session root. |
| `links_only` mode | No extra parent-side `subagent-*` task span is emitted. | The launch tool, join turn, or active turn carries child metadata and span links. |

The child session remains its own trace in every mode. The parent turn trace
must not directly parent child-session turns, tools, or LLM spans.

## Metrics Contract

Claude Code, Codex, Cursor, GitHub Copilot CLI, and OpenCode use the same
canonical launch-count contract: one distinct, source-backed `subagent_start`
increments `trajectory.turn.subagent_invocations` and its positive-only
`.additive` companion once. Stable launch or child identity deduplicates
replayed lifecycle. Missing, failed, or ambiguous provider evidence emits no
launch.

The older `trajectory.session.subagents` and `trajectory.turn.subagents`
marker metrics are compatibility views of an Agent-tool signal. They are not
cross-client lifecycle metrics and must not be combined with the canonical
invocation family.

## Client Validation Matrix

| Client | Current subagent source shape | Expected rendering |
| --- | --- | --- |
| Claude Code | Native `SubagentStart` and `SubagentStop` with a `Task` or `Agent` launch tool. Async background work returns through a `task_notification` user prompt. | Sync subagents attach under the launch tool. Async subagents attach under the join turn. |
| Codex | Modern rollouts retain `spawn_agent` function calls and terminal outputs; older or richer streams may also retain collab lifecycle events. | A successful tool output emits launch lifecycle keyed to the function call. Structured child identity supplies a link when present; text-only success remains launch evidence without inventing a child trace. |
| Cursor Desktop | Command-hook `subagentStart` and `subagentStop` payloads. Current Desktop fixtures can be sync or task-notification-style async. | Sync lifecycle without a launch tool falls back to standalone active-turn attachment; async lifecycle attaches to the task-notification join turn when present. |
| GitHub Copilot CLI | Command-hook lifecycle payloads plus transcript metadata that recovers the real child tool-call id and parent task tool id. | Subagent lifecycle attaches under the launching Agent/Task tool when the normalized hook carries the recovered `tool_use_id`. |
| Gemini CLI | No native lifecycle hook; Trajectory synthesizes `subagent_start` and `subagent_stop` from `kind:"subagent"` chat artifacts during session end. | Synthetic subagent lifecycle attaches under the synthesized launch tool. |
| Antigravity CLI (`agy`) | Gemini-compatible hook path; Trajectory synthesizes subagent lifecycle from `kind:"subagent"` chat artifacts during session end when Antigravity emits the same files. | Synthetic subagent lifecycle attaches under the synthesized launch tool. |
| Factory Droid | Current hook set includes `SubagentStop` but not `SubagentStart`. | Stop-only lifecycle falls back to a standalone active-turn subagent span. |
| OpenCode | Every observed child `session.created` carries exact parent and child IDs, recorded as immediate ancestry on the child's first `SessionStart`. A semantic launch additionally requires exactly one pending `Task` call. | Immediate ancestry supports navigation on its own. A launch span is emitted only for the one-candidate Task pairing; ambiguous Task calls keep ancestry but emit no launch. |
| Kilo | OpenCode-compatible plugin events use the same immediate-ancestry and one-candidate launch rules. | Identical to OpenCode: ancestry supports navigation, while only a proven Task pairing emits a launch span. |
| Pi | Current extension records normal session, prompt, tool, turn, compaction, model, and fork events but no dedicated child-session subagent lifecycle. | No semantic subagent parentage is inferred from fork or agent metadata alone. |

## OpenCode And Kilo Nested Sessions

OpenCode and Kilo record two independent facts for nested sessions:

- `parent_session_id` is the exact immediate provider parent and powers parent,
  breadcrumb, and immediate-child navigation.
- Semantic launch lifecycle requires an exact Task-to-child correlation and is
  the only fact that increments the canonical subagent invocation metrics.

An ancestry-only child remains navigable but does not claim a launch. With
multiple concurrent candidate Task calls, Trajectory retains exact ancestry
and fails closed on launch attribution rather than guessing. Recursive children
keep immediate edges, so a grandchild points to its child parent instead of
being flattened to the root.

Each child remains a separate, directly loadable trace. The local viewer
derives root and breadcrumb navigation from those immediate edges.

## When Adding A Client Pattern

Add or update coverage at the first layer that owns the new fact:

- Capture normalization tests for raw hook or transcript fields.
- Fixture replay tests when the client has a real or documented fixture shape.
- Mapper tests for parent-side span placement and `links_only` behavior.
- Client fixture matrix coverage when the fixture should pass through capture
  replay, direct published mapping, and publish-exporter mapping.

Do not infer subagent parentage from generic agent metadata alone. The mapper
needs a child session id plus either a launch tool id, a task-notification join
point, or an explicit standalone lifecycle event.
