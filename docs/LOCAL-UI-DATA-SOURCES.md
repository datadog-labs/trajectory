# Local-UI Data Source Inventory

This inventory defines how Trajectory records the source of data written to the
local-ui datastore.

## Durable fields

The local SQLite cache stores source provenance on `sessions` and mirrors it to
`session_summary`:

| Column | Description |
| --- | --- |
| `datastore_origin` | First known writer for the local-ui session row. |
| `datastore_last_source` | Most recent writer that refreshed the row. |
| `datastore_source_detail` | Mechanism detail for the most recent writer. |

Synthesized local-ui spans expose the same values as:

- `meta.metadata.datastore_origin`
- `meta.metadata.datastore_last_source`
- `meta.metadata.datastore_source_detail`
- `trajectory.datastore_origin:<value>`
- `trajectory.datastore_last_source:<value>`

`sessions.source` remains the client/source from captured events. Do not reuse
it for datastore provenance.

## Source kinds

| Kind | Owning area | Meaning |
| --- | --- | --- |
| `live_capture` | Capture and evaluation pipeline | Active capture and session-end finalization. |
| `pipeline` | Pipeline and cache indexing | Explicit pipeline/cache indexing without a more specific caller. |
| `backfill` | Backfill commands | Explicit historical imports, JSONL indexing, and orphan reindex. |
| `local_ui_background_backfill` | Local-ui background indexing | Automatic local-ui query-triggered cache indexing. |
| `unknown` | migrations/defaults | Legacy or unrecognized data. |

## Mechanism details

| Detail | Source kind | Writer |
| --- | --- | --- |
| `ingest_incremental` | `live_capture` | `ingest.Run` default path. |
| `session_end` | `live_capture` | `ingest.RunSessionEnd` default path. |
| `ingest` | `live_capture` | Backward-compatible direct `ingest.UpsertSession` caller. |
| `evaluate_incremental` | `live_capture` | `evaluate.Run` default path. |
| `evaluate_session_end` | `live_capture` | `evaluate.RunSessionEnd` default path. |
| `pipeline_session_end_hook` | `live_capture` | `trajectory-pipeline` hook-mode session end. |
| `trajectory_pipeline` | `pipeline` | `orchestrator.WiredStages` default. |
| `trajectory_pipeline_cli` | `pipeline` | Manual `trajectory pipeline` command. |
| `cache_index` | `pipeline` | Direct `cache_index.UpsertSession` or `RunFull` default. |
| `backfill_index_local` | `backfill` | `trajectory backfill --index-local`. |
| `backfill_claude_session` | `backfill` | Claude single-session transcript conversion. |
| `backfill_claude_transcripts` | `backfill` | Claude transcript scan conversion. |
| `backfill_claude_force_replace` | `backfill` | Claude forced replacement conversion. |
| `backfill_codex_sessions` | `backfill` | Codex rollout conversion. |
| `backfill_copilot_sessions` | `backfill` | GitHub Copilot CLI session-state conversion. |
| `backfill_gemini_transcripts` | `backfill` | Gemini transcript conversion. |
| `backfill_cursor_chats` | `backfill` | Cursor chat conversion. |
| `backfill_pi_sessions` | `backfill` | Pi session conversion. |
| `backfill_omp_sessions` | `backfill` | Explicit OMP effective-profile session conversion. |
| `backfill_orphan_reindex` | `backfill` | Reindex of skipped sessions absent from SQLite. |
| `local_ui_query_backfill` | `local_ui_background_backfill` | Quiet-window local-ui background index-on-query; foreground queries preempt it. |

## Update checklist

When adding a new local-ui writer or repair path:

1. Pick an existing source kind, or add a new low-cardinality kind in
   `pipeline/localstore`.
2. Set explicit `localstore.Provenance` at the caller boundary.
3. Preserve `datastore_origin`; update `datastore_last_source` and
   `datastore_source_detail`.
4. Expose the values through local-ui readback if the writer affects display or
   filtering.
5. Add writer-level and local-ui readback tests.
6. Update this file and the embedded `source-provenance` user-guide topic.
