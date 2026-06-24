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

## Client Validation Matrix

| Client | Current subagent source shape | Expected rendering |
| --- | --- | --- |
| Claude Code | Native `SubagentStart` and `SubagentStop` with a `Task` or `Agent` launch tool. Async background work returns through a `task_notification` user prompt. | Sync subagents attach under the launch tool. Async subagents attach under the join turn. |
| Codex | Rollout `collab_agent_spawn_begin` and `collab_agent_spawn_end` events; parent linkage is preserved through `parent_session_id` and child thread id. | Codex collab lifecycle emits a standalone linked subagent span unless a future parent launch tool is present. |
| Cursor Desktop | Command-hook `subagentStart` and `subagentStop` payloads. Current Desktop fixtures can be sync or task-notification-style async. | Sync lifecycle without a launch tool falls back to standalone active-turn attachment; async lifecycle attaches to the task-notification join turn when present. |
| GitHub Copilot CLI | Command-hook lifecycle payloads plus transcript metadata that recovers the real child tool-call id and parent task tool id. | Subagent lifecycle attaches under the launching Agent/Task tool when the normalized hook carries the recovered `tool_use_id`. |
| Gemini CLI | No native lifecycle hook; Trajectory synthesizes `subagent_start` and `subagent_stop` from `kind:"subagent"` chat artifacts during session end. | Synthetic subagent lifecycle attaches under the synthesized launch tool. |
| Factory Droid | Current hook set includes `SubagentStop` but not `SubagentStart`. | Stop-only lifecycle falls back to a standalone active-turn subagent span. |
| OpenCode | Current plugin SDK path records agent metadata on prompt, tool, and message events but does not expose child-session lifecycle ids. | No semantic subagent parentage is inferred from `agent_id` or `agent_type` alone. |
| Pi | Current extension records normal session, prompt, tool, turn, compaction, model, and fork events but no dedicated child-session subagent lifecycle. | No semantic subagent parentage is inferred from fork or agent metadata alone. |

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
