# Metrics Consistency Audit

This audit documents the coding-agent contracts behind the base Trajectory
metrics. It is meant to prevent metric names from drifting into
adapter-specific meanings.

## Metric Semantics

`trajectory.turn.*` metrics are per completed-turn samples. A turn metric
should not contain cumulative session-to-date values unless the metric name
says so, for example `trajectory.session.*.elapsed` or `.accumulated`.

`trajectory.turn.errors` means failed tool results in the completed turn,
grouped by the `category` tag. It does not mean Trajectory capture, publish,
or Datadog submission failures. The source precedence is:

1. Use explicit `turn_end.tool_error_categories` when an adapter provides a
   per-turn map.
2. Otherwise derive one error category from each completed `tool_use` event
   with `success:false`.

The shared category taxonomy currently includes `command-failed`,
`user-rejected`, `edit-failed`, `file-changed`, `file-too-large`,
`file-not-found`, and `other`.

## Agent Coverage

| Agent | Failed-tool source for `trajectory.turn.errors` | Per-turn enrichment source |
|---|---|---|
| Claude Code | `PostToolUse`/`PostToolUseFailure` failed `tool_use` records, plus transcript-derived `turn_end.tool_error_categories` | Transcript enrichment is applied as the just-read turn delta, not the cumulative session state |
| Codex | `PostToolUse` records with `tool_error` or `is_error:true` | Adapter emits failed `tool_use`; publish derives categories when no explicit turn map exists |
| Cursor | `PostToolUse` records with `tool_error` or `is_error:true` | Adapter emits failed `tool_use`; publish derives categories when no explicit turn map exists |
| Gemini | `AfterTool` records with `tool_error` | Adapter emits failed `tool_use`; publish derives categories when no explicit turn map exists |
| Pi | Explicit `turn_end.tool_error_categories` when supplied; otherwise `PostToolUse` records with `is_error:true` | Adapter forwards per-turn turn-end fields from the Pi payload |
| OpenCode | `tool.execute.after` payloads with `is_error` or `tool_error`, normalized to failed `tool_use` records | Adapter emits failed `tool_use`; publish derives categories when no explicit turn map exists |
| Copilot CLI | Reuses the Claude-compatible capture contract | Supports `PostToolUseFailure`; no historical transcript backfill |
| Factory Droid | Reuses the Claude-compatible capture contract for documented hooks | Current documented plugin hook set lacks `PostToolUseFailure`; ordinary `PostToolUse` failures are still captured when the payload carries `tool_error` or `is_error:true` |

## Findings

Claude Code transcript enrichment now stores cumulative state only for
incremental transcript reads and writes only the new delta onto the current
turn. This keeps turn-level error, language, line, file, interruption, and
denial fields scoped to the completed turn.

Publish now derives the same error categories from failed completed
`tool_use` records when no explicit turn-end category map exists, so
`trajectory.turn.errors` has the same meaning across adapters.

OpenCode capture now preserves failed tool outcomes, error text, and output
summaries, matching the other adapters' normalized `tool_use` shape.
