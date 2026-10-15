## Claude Native OTLP Metrics

Claude Code can send its own OpenTelemetry (OTLP) metrics. `trajectory serve`
accepts them on `/v1/metrics` and can forward them to your collector.

| Metric | Type | Notes |
|---|---|---|
| `claude_code.token.usage` | sum | Claude Code token usage, forwarded with session tags added |
| `claude_code.cost.usage` | sum/gauge | Claude Code cost usage. Trajectory keeps the native value and adds source-selection tags. |

### Forwarding and tags

To forward the metrics, set `server.otlp_proxy.endpoint` to the upstream
collector. Before it forwards each data point, Trajectory adds these tags:

- the standard Trajectory session, client, and model tags
- `trajectory.proxy.source:serve-otlp`
- `trajectory.cost_role:client_telemetry`
- `trajectory.cost_source:claude_native_otlp`
- the cost-overlap tags: `trajectory.provider`, `trajectory.provider_route`,
  `trajectory.provider_cost_visibility`, `trajectory.cost_overlap_risk`,
  `trajectory.cost_overlap_signal`, `trajectory.cost_dedupe_group`, and
  `trajectory.cost_dedupe_confidence`

For how to use the cost-overlap tags, see the
[cost overlap consumer guide](../COST-OVERLAP-CONSUMER-GUIDE.md).

Trajectory returns success to Claude Code when it cannot add the tags or when
the upstream request fails. If it cannot add the tags, it forwards the
original payload unchanged. Other errors still return an error status. For
example, an empty or oversized body gets HTTP 400. A request over the
admission limit gets HTTP 503 with `Retry-After`.

Trajectory keeps the native metric values. It does not correct or drop native
data points. It does not decide from an OTLP batch whether usage is complete.
It does not turn missing or unknown model data into session proxy counters.
Session capture, ingest, and cost attribution own the accuracy of usage and
model data. The diagnostic metrics below report problems in those paths.

### Check the metrics in Datadog

To check the metrics that Trajectory publishes itself, run
`trajectory publish metrics audit --readback` or `--readback-all`.

The local metric outbox does not hold forwarded native metrics, so the audit
does not check them. To check them in Datadog, filter or group on
`trajectory.cost_role:client_telemetry`,
`trajectory.cost_source:claude_native_otlp`, and
`trajectory.cost_dedupe_group`.

### Diagnostic metrics for missing usage

Trajectory reports these cases for Claude Code and other clients:

- A cost model that is present but not recognized adds to
  `trajectory.session.cost.unpriced_turns{trajectory.cost_reason:model_mismatch}`.
  A missing model uses `trajectory.cost_reason:model_missing`.
- Claude transcript usage that is still missing after the reconciliation
  window sends
  `trajectory.instrumentation.derivation.fallback{reason:transcript_usage_missing}`.
- A turn that reaches the last fallback, which estimates usage from content,
  sends
  `trajectory.instrumentation.derivation.fallback{reason:estimated_last_resort}`.
- A completed turn whose usage is still missing after reconciliation and
  estimation sends
  `trajectory.instrumentation.capture.gap{reason:usage_missing}`. Trajectory
  stores the turn with `tokens_status=missing`.
- A scoped watcher might see a provider rollout that its project filter
  rejects. In that case, Trajectory sends
  `trajectory.instrumentation.capture.gap{component:serve,client_source:codex,signal:jsonl,reason:scope_filtered}`.
- That rejected rollout might later contain a native `token_count` record.
  Trajectory then sends the same metric with `reason:usage_unregistered`. This
  shows that provider usage existed but Trajectory did not record it. The
  value counts gaps. It is not a token or cost value.
- Eligible Cursor generations without final token usage add to
  `trajectory.cursor.token_capture.turns_total{status:missing}`.

Gaps between Codex source records and the tool events that Trajectory records
use four `reason` values on the same capture-gap metric. They do not report
parser-specific errors.

| Reason | Meaning |
|---|---|
| `source_unavailable` | No rollout existed when terminal recovery checked for it. |
| `source_unusable` | A source record with tool data was malformed, too large, or not supported. |
| `reconciliation_failed` | Trajectory could parse the tool data but could not save it as a tool event. |
| `unknown` | A fallback for any other case. |

These values count gaps or unusable records. They do not always match the
number of tool calls. Trajectory does not send these reasons when an early
discovery pass misses a rollout. It also does not send them when a save fails
and is rolled back to try again.

The missing-usage metrics report that an expected derivation failed. They do
not fire for a usage value of zero. They also do not fire for clients and
events that do not supply provider usage. In live `trajectory serve`, the
publish engine sends the last-resort fallback metric. Standalone ingest keeps
it only as a local instrumentation health record.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
