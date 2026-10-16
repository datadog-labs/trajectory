# Metrics Consistency Audit

This page explains how each coding agent supplies the data behind the base
Trajectory metrics. Each metric name keeps one meaning for every agent.

## Turn and session values

Each `trajectory.turn.*` metric holds one sample for one completed turn. A turn
metric never holds a session-to-date value, unless its name says so. Examples
of names that do are `trajectory.session.*.elapsed` and `.accumulated`.

The metric catalog states how each turn metric rolls up:

- Each turn metric is either additive or an observation. It also names its
  rollup target and the check that validates it.
- An additive metric states its target: an exact session total, a total over
  completed turns, or a total over a limited subset of turns. Trajectory never
  guesses the target from the metric type.
- Trajectory stores session totals for turns, tools, input tokens, output
  tokens, cache-aware tokens, and cost. `trajectory audit --source-data`
  recomputes each of these from the stored turn rows and compares them.
- Marker session counts and turn counts come from the same stored marker
  points and ranges. Use `.completed_count` on dashboards for the final
  session value.

Only additive metrics add up across turns. Ordinals, ratios, and latency
distributions do not, so the catalog never treats them as additive.

## Failed tool calls

`trajectory.turn.errors.additive` counts failed tool results in a completed
turn, grouped by the `category` tag. It does not count failures in Trajectory
capture, publishing, or Datadog submission.

Trajectory takes the categories from these sources, in this order:

1. If the agent supplies a per-turn map in `turn_end.tool_error_categories`,
   Trajectory uses it.
2. Otherwise, Trajectory takes one category from each completed `tool_use`
   event that has `success:false`.

The categories are `command-failed`, `user-rejected`, `edit-failed`,
`file-changed`, `file-too-large`, `file-not-found`, and `other`.

## Agent Coverage

| Agent | Source of failed tool calls for `trajectory.turn.errors.additive` | Source of per-turn data |
|---|---|---|
| Claude Code | Failed `tool_use` records from `PostToolUse` and `PostToolUseFailure`, plus `turn_end.tool_error_categories` from the transcript | Trajectory reads the transcript and adds only the change since the last read to the current turn. It never adds the whole session state. |
| Codex | `PostToolUse` records with `tool_error` or `is_error:true` | The adapter sends failed `tool_use` events. Trajectory takes categories from them when there is no per-turn map. |
| Cursor | `PostToolUse` records with `tool_error` or `is_error:true` | The adapter sends failed `tool_use` events. Trajectory takes categories from them when there is no per-turn map. |
| Gemini | `AfterTool` records with `tool_error` | The adapter sends failed `tool_use` events. Trajectory takes categories from them when there is no per-turn map. |
| Pi | `turn_end.tool_error_categories` when the agent supplies it. Otherwise, `PostToolUse` records with `is_error:true`. | The adapter forwards the turn-end fields from the Pi payload. |
| OpenCode | `tool.execute.after` payloads with `is_error` or `tool_error`, converted to failed `tool_use` records | The adapter sends failed `tool_use` events. Trajectory takes categories from them when there is no per-turn map. |
| OpenClaw | The same hook format as Pi | The plugin maps `after_tool_call` errors to `PostToolUse` with `is_error:true`. |
| Copilot CLI | The same hook format as Claude Code | Supports `PostToolUseFailure`. Trajectory does not backfill history from transcripts. |
| Factory Droid | The same hook format as Claude Code, for the documented hooks | The documented plugin hooks do not include `PostToolUseFailure`. Trajectory still captures a failure from `PostToolUse` when the payload has `tool_error` or `is_error:true`. |
