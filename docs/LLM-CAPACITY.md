# LLM Capacity and Expense Controls

Trajectory mostly records local events, derives metrics, and publishes to
Datadog without asking another LLM to reprocess the session. The features below
are the Trajectory-owned paths that can create additional LLM calls.

This document is also available from the binary:

```bash
trajectory user-guide llm-capacity
```

## Quick summary

| Feature | Default | What it does | How often it can call an LLM | Primary controls |
|---|---|---|---|---|
| Task segmentation and classification | On | Splits sessions into tasks, scores coding-specific dimensions, and adds Work Insights Level 1/Level 2 classifications plus a privacy-reduced task label | Up to two calls on each admitted `segmentation.interval` pass, default 10 turns, plus up to two calls at session end | `segmentation.enabled`, `segmentation.interval`, `segmentation.model`, `enhanced_segmentation_classification`, `TRAJECTORY_SEGMENTATION_DISABLED=1` |
| Patterns historical analysis | On, but only after explicit terminal or `--yes` confirmation | Classifies completed local sessions for work-mix reporting | Up to two final-session calls for an unclassified session; only missing passes run | `patterns_analysis_backfill`; estimates and non-interactive reports perform no inference |
| Meta-task grouping | Off | Optionally groups finalized leaf tasks into a higher-level hierarchy | At most one additional session-end call, and only when at least 3 finalized tasks exist | `task_meta_segmentation` feature flag; also requires `task_segmentation_metrics_v2` |
| Sensitivity classification | Off in fresh single-user setup; managed or explicit config may enable it | Classifies session content for the publish gate as public, internal, confidential, or restricted | In `near_realtime` mode, non-incognito active sessions are scanned only when new content exists, default every 240 minutes, plus a session-end scan. In `balanced` mode, about every 10 completed turns, plus the session-end scan. | `export.sensitivity.scanning_mode`, `export.sensitivity.near_realtime_interval_minutes` |

For zero Trajectory-owned LLM calls from the capture server, disable both:

```bash
trajectory config set segmentation.enabled false
trajectory config set export.sensitivity.scanning_mode off
```

## Task segmentation

Task segmentation is enabled by default and is independent of trace export. It
can run even when `export.traces` is `off`, because it feeds the local task
cache and optional task-derived metrics and traces. The default-on
`enhanced_segmentation_classification` feature adds coding-specific
classification and a second Work Insights call on the same cadence. The Work
Insights response also carries the privacy-reduced task display label, so that
label does not add a third call.

By default it runs asynchronously for non-headless interactive sessions:

- Every 10 completed turns.
- Every 20 completed turns when the previous segment is still open, because the
  adaptive trigger backs off to twice the interval.
- Once at session end for final task boundaries.
- Zero LLM calls for a 0-turn session. A 1-turn session uses the enhanced calls
  so it receives actual turn and Work Insights labels.

Approximate default upper bound for an interactive session with `N >= 1` turns
while enhanced classification is enabled:

```text
2 * (floor(N / 10) admitted incremental passes + 1 final pass)
```

For example, a 23-turn session normally means about six calls: segmentation and
Work Insights at turn 10, turn 20, and session end. Adaptive backoff can reduce
that. Disabling `enhanced_segmentation_classification` restores one call per
admitted pass and the zero-call shortcut for a 1-turn session.

Segmentation prefers a qualified, locally available coding-agent CLI in an
isolated, tool-free workspace. Calls disable Trajectory capture and configured
MCP servers. Set `segmentation.model` to override the provider-specific model.

Historical Patterns classification is explicit and resumable:

```bash
trajectory patterns estimate --period 7d
trajectory patterns analyze --period 7d
trajectory patterns analyze --period 7d --yes
```

The first two commands make no inference. A terminal confirmation or `--yes`
is the spending boundary. Complete sessions are not classified again, and only
missing coding or Work Insights passes run. Incognito does not remove retained
local sessions from this explicitly requested analysis, but the command does
not re-enable trace publishing. See [Reports and Work Insights](REPORTS.md) for
the full workflow.

The default-off `task_meta_segmentation` feature can add one more final-session
call when at least three finalized leaf tasks are available. That pass groups
leaf tasks into higher-level meta-tasks:

```bash
trajectory features enable task_meta_segmentation
```

The pass remains inert unless `task_segmentation_metrics_v2` is also enabled,
and it skips sessions with fewer than three finalized tasks.

Headless coding-agent sessions are included in capture and publish by default
when export is configured. Live segmentation and sensitivity classification
skip headless sessions. Completed top-level headless sessions can still be
included in explicitly confirmed historical Patterns analysis. To opt out of
capture and publish for all non-internal headless agent sessions:

```bash
trajectory config set capture.include_headless_agents false
```

Trajectory-owned classifier and segmenter subprocesses remain suppressed.

Disable segmentation:

```bash
trajectory config set segmentation.enabled false
```

Disable it for one launched server or shell:

```bash
TRAJECTORY_SEGMENTATION_DISABLED=1 trajectory serve
```

Reduce incremental frequency:

```bash
trajectory config set segmentation.interval 25
```

Changing `segmentation.publish_metrics`, `segmentation.publish_traces`,
`segmentation.task_insights.publish`, `export.turn_traces`, or a
destination-level `segmentation.enabled: false` controls which already-derived
outputs publish. Those settings do not stop local segmentation work. Use
`segmentation.enabled: false` when the goal is to stop LLM capacity use.

To retain task segmentation while avoiding the enhanced output and second call:

```bash
trajectory features disable enhanced_segmentation_classification
```

## Sensitivity classification

Fresh single-user `trajectory setup` writes
`export.sensitivity.scanning_mode=off`, so initial minimal trace publishing is
not held behind classification.
Managed policy or explicit user config can enable sensitivity classification,
commonly in `near_realtime` mode. It is primarily used by trace publish privacy
gates, but `export.traces=off` is not a guaranteed capacity control. To prevent
classifier calls and disable the sensitivity publish gate, keep
`export.sensitivity.scanning_mode` set to `off`.

Scanning modes:

- `near_realtime` scans non-incognito active sessions on a time window when new
  content exists. The default interval is 240 minutes, and the durable
  per-session window is enforced across concurrent serve processes.
- `balanced` scans on the same default turn cadence as segmentation: about every
  10 completed turns, plus a final session-end scan on the non-incognito publish
  path.
- `off` disables sensitivity classifier calls and disables the sensitivity
  publish gate.

Before any server-side classifier call, Trajectory checks the session watermark.
If there are no new events since `last_scanned_seq`, the scan is a no-op. This
idle no-op applies to both `balanced` and `near_realtime` mode.

Extension-supplied sensitivity verdicts are used as a server-side no-op signal:
when a recent verdict exists, Trajectory skips the duplicate server-side scan.

The classifier reads a bounded session summary, not an unbounded raw file: up
to 100 session events, with user prompts and agent responses truncated to 1000
characters per event. The summary can still include project metadata, file
paths, commands, prompts, and assistant text.

Classifier backend selection prefers an available local/headless path before
direct provider APIs. In practice, capacity may come from the installed agent
CLI account, MCP sampling, or direct provider API keys such as
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GEMINI_API_KEY`. If no classifier
path is available, Trajectory fails closed for publish gating and does not make
a paid classifier call. The direct Google backend currently uses
`gemini-2.5-flash-lite`.

Disable sensitivity classification:

```bash
trajectory config set export.sensitivity.scanning_mode off
```

The legacy switch is still accepted:

```bash
trajectory config set export.sensitivity.enabled false
```

Use near-realtime scanning only when short-delay publish is worth the additional
classifier calls:

```bash
trajectory config set export.sensitivity.scanning_mode near_realtime
trajectory config set export.sensitivity.near_realtime_interval_minutes 240
```

Lower `near_realtime_interval_minutes` values can release held spans sooner, but
they can increase LLM capacity and cost. In `balanced` mode, the near-realtime
interval is ignored.

Approximate sensitivity-classifier call count:

```text
balanced:      floor(turns / 10) calls + at most 1 session-end call
near_realtime: active windows with new content / interval + at most 1 session-end call
off:           0 calls
```

Incognito suppresses trace-like content publish for ordinary destinations, but
local segmentation and content-free aggregate metrics continue. It skips
active-session and final sensitivity scans for that session. Use
`segmentation.enabled: false` or `scanning_mode: off` for a
configuration-wide guarantee of zero calls for the corresponding classifier.

## Cost reporting

Trajectory emits best-effort metrics for Trajectory-owned LLM capacity when a
Datadog-typed destination has marker metrics enabled. Each eligible destination
uses its selected Datadog metrics transport: agentless OTLP by default, with
`dd_metrics_v2` available as a trusted-config fallback:

| Metric | Type | Tags | Notes |
|---|---|---|---|
| `trajectory.serve.llm_capacity.calls.total` | count | `feature`, `backend`, `gen_ai.request.model`, `pass`, `cost_source` | Trajectory-owned classifier invocations for segmentation, Work Insights, sensitivity, or explicit historical analysis. |
| `trajectory.serve.llm_capacity.cost.usd.total` | count | `feature`, `backend`, `gen_ai.request.model`, `pass`, `cost_source` | Estimated USD cost for calls whose model can be priced. |
| `trajectory.serve.llm_capacity.failures.total` | count | `feature`, `pass`, `error_class` | Failed classifier operations, including historical-analysis attempts. |
| `trajectory.serve.llm_capacity.format_errors.total` | count | `feature`, `pass`, `error_class` | Responses rejected for malformed JSON, schema, or taxonomy validation. |

The cost metric uses estimated token counts from prompt and output size, then
prices those counts with Trajectory's existing model pricing table. It is not a
provider invoice. Calls whose model is not visible or not priced still emit
`trajectory.serve.llm_capacity.calls.total` with `cost_source:pricing_unknown`.

Useful queries:

```text
sum:trajectory.serve.llm_capacity.cost.usd.total{*} by {feature}
sum:trajectory.serve.llm_capacity.calls.total{*} by {feature,backend}
sum:trajectory.serve.llm_capacity.failures.total{*} by {feature,pass,error_class}
sum:trajectory.serve.llm_capacity.format_errors.total{*} by {feature,pass,error_class}
```

## What does not add Trajectory-owned LLM calls

These settings and features do not by themselves ask another LLM to process the
session:

- `export.traces`: controls whether captured spans publish to LLM Observability.
- `export.metrics`: controls metrics publish.
- `export.placeholder_llm_span`: controls a synthetic Datadog LLM span for cost
  enrichment; it does not call an LLM.
- Marker evaluation: built-in and YAML markers are rule-based over local SQLite
  data.
- `segmentation.publish_metrics`, `segmentation.publish_traces`,
  `segmentation.task_insights.publish`, and `export.turn_traces`: control
  publish of already-derived task or turn outputs.

## Check current settings

```bash
trajectory config show
trajectory config get segmentation.enabled
trajectory config get segmentation.interval
trajectory features status enhanced_segmentation_classification
trajectory features status task_meta_segmentation
trajectory config get export.sensitivity.scanning_mode
trajectory config get export.sensitivity.near_realtime_interval_minutes
```

Check recent activity in the serve logs:

```bash
trajectory logs --grep 'segmentation:'
trajectory logs --grep 'sensitivity:'
```
