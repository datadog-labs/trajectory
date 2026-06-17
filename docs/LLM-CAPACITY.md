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
| Task segmentation | On | Splits sessions into tasks and scores task dimensions such as outcome, autonomy, risk, and reversibility | About every `segmentation.interval` completed turns, default 10, plus one final pass at session end for sessions with at least 2 turns | `segmentation.enabled`, `segmentation.interval`, `segmentation.model`, `TRAJECTORY_SEGMENTATION_DISABLED=1` |
| Sensitivity classification | On, `balanced` mode | Classifies session content for the publish gate as public, internal, confidential, or restricted | In `balanced` mode, about every 10 completed turns, plus a session-end scan on the non-incognito publish path. In `near_realtime` mode, active sessions are scanned only when new content exists, default every 30 minutes. | `export.sensitivity.scanning_mode`, `export.sensitivity.near_realtime_interval_minutes` |

For zero Trajectory-owned LLM calls from the capture server, disable both:

```bash
trajectory config set segmentation.enabled false
trajectory config set export.sensitivity.scanning_mode off
```

## Task segmentation

Task segmentation is enabled by default and is independent of trace export. It
can run even when `export.traces` is `off`, because it feeds the local task
cache and optional task-derived metrics/traces.

By default it runs asynchronously for non-headless interactive sessions:

- Every 10 completed turns.
- Every 20 completed turns when the previous segment is still open, because the
  adaptive trigger backs off to twice the interval.
- Once at session end for final task boundaries.
- Zero LLM calls for 0-turn or 1-turn sessions, which get a trivial local
  segment instead.

Approximate default upper bound for an interactive session with `N >= 2` turns:

```text
floor(N / 10) incremental calls + 1 final call
```

For example, a 23-turn session normally means about 3 segmentation calls: turn
10, turn 20, and final session end. Adaptive backoff can reduce that.

Headless coding-agent sessions are included in capture and publish by default
when export is configured. Sensitivity/classification and segmentation always
skip headless sessions. To opt out of capture/publish for headless agent sessions:

```bash
trajectory config set capture.include_headless_agents false
```

Trajectory-owned classifier and segmenter subprocesses remain suppressed.

Segmentation uses a headless CLI provider. The default model is
`claude-haiku-4-5-20251001`; set `segmentation.model` to override it when the
selected provider supports a model flag.

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

Changing `segmentation.publish_metrics`, `segmentation.publish_traces`, or a
destination-level `segmentation.enabled: false` controls whether
segmentation-derived outputs publish. Those settings do not stop local
segmentation work. Use `segmentation.enabled: false` when the goal is to stop
LLM capacity use.

## Sensitivity classification

Sensitivity classification is enabled by default in `balanced` mode. It is
primarily used by trace publish privacy gates, but `export.traces=off` is not a
guaranteed capacity control by itself. If you want no sensitivity-classifier LLM
calls and no sensitivity publish gate, set `export.sensitivity.scanning_mode`
to `off`.

Scanning modes:

- `balanced` is the default. It scans on the same default turn cadence as
  segmentation: about every 10 completed turns, plus a final session-end scan on
  the non-incognito publish path.
- `near_realtime` scans active sessions on a time window when new content
  exists. The default interval is 30 minutes, and the durable per-session window
  is enforced across concurrent serve processes.
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
a paid classifier call.

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
trajectory config set export.sensitivity.near_realtime_interval_minutes 30
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

Incognito is a privacy control, not a global capacity control. It suppresses
publish for ordinary destinations and skips active-session and final sensitivity
scans for that session. Use `scanning_mode: off` when you want a
configuration-wide guarantee of zero sensitivity-classifier calls.

## Cost reporting

Trajectory emits best-effort Datadog Metrics v2 points for Trajectory-owned LLM
capacity when a `datadog` metrics destination is enabled:

| Metric | Type | Tags | Notes |
|---|---|---|---|
| `trajectory.serve.llm_capacity.calls.total` | count | `feature`, `backend`, `gen_ai.request.model`, `pass`, `cost_source` | One successful background LLM call. `feature` is `segmentation` or `sensitivity`. |
| `trajectory.serve.llm_capacity.cost.usd.total` | count | `feature`, `backend`, `gen_ai.request.model`, `pass`, `cost_source` | Estimated USD cost for calls whose model can be priced. |

The cost metric uses estimated token counts from prompt and output size, then
prices those counts with Trajectory's existing model pricing table. It is not a
provider invoice. Calls whose model is not visible or not priced still emit
`trajectory.serve.llm_capacity.calls.total` with `cost_source:pricing_unknown`.
Classifier backend errors can also represent attempted calls that consumed
provider-side capacity before failing or returning unparseable output. Check
`trajectory.serve.sensitivity.classifier_backend_error` alongside the capacity
metrics when investigating unexpected spend.

Useful queries:

```text
sum:trajectory.serve.llm_capacity.cost.usd.total{*} by {feature}
sum:trajectory.serve.llm_capacity.calls.total{*} by {feature,backend}
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
- `segmentation.publish_metrics` and `segmentation.publish_traces`: control
  publish of already-derived task outputs.

## Check current settings

```bash
trajectory config show
trajectory config get segmentation.enabled
trajectory config get segmentation.interval
trajectory config get export.sensitivity.scanning_mode
trajectory config get export.sensitivity.near_realtime_interval_minutes
```

Check recent activity in the serve logs:

```bash
trajectory logs --grep 'segmentation:'
trajectory logs --grep 'sensitivity:'
```
