# Integration tile metric contract

The Datadog Trajectory integration tile and out-of-the-box (OOTB) dashboard
protect the 29 metrics below. The original tile contract contains 25 names.
The OOTB dashboard adds completed turns, installation state, client setup
state, and update wait age. They stay supported, and no metric-specific
feature flag or optional sample setting controls them.

## When Trajectory sends them

These metrics are on by default. They need a running, configured Trajectory
installation with a valid metric destination and credentials.
`export.metrics` defaults to true. If you turn off export, or a destination or
privacy policy blocks it, Trajectory does not send them.

Some metrics also need a source:

- An event counter needs the event that it counts.
- Managed diagnostics need managed state.
- Installed-version inventory needs a detected client.

You do not need to opt in to any of these metrics. Trajectory sends
operational metrics directly on a best-effort basis, so delivery is not
guaranteed.

## Session start counts

A live session start sends `trajectory.session.count`. It counts lifecycle
starts, including fresh starts and resumptions, rather than distinct sessions.

## Metrics

| Metric | Type | What must happen for a sample |
| --- | --- | --- |
| `trajectory.instrumentation.capture.gap` | count | Trajectory finds an inconsistency in capture or usage data. |
| `trajectory.instrumentation.capture.hook_event` | count | Trajectory admits or retries a hook event that has a delivery receipt. Successes without a receipt are not counted. |
| `trajectory.instrumentation.capture.hook_latency_ms` | distribution | A capture HTTP request completes. |
| `trajectory.instrumentation.capture.write_latency_ms` | distribution | An append to a session JSONL file completes. `trajectory serve` forwards the sample through its health worker. A standalone hook process keeps the sample only on the local machine. |
| `trajectory.instrumentation.derivation.correction` | count | Transcript reconciliation or late usage recovery corrects a derived value. `trajectory serve` publishes the sample. |
| `trajectory.instrumentation.derivation.fallback` | count | Trajectory falls back to a less accurate way to derive a value. `trajectory serve` publishes the sample. A standalone fallback can record it only on the local machine. |
| `trajectory.instrumentation.health.emit_dropped` | count | A health record is not valid, a local append fails, or the health queue overflows. Normal buffer rotation does not count as a drop. |
| `trajectory.instrumentation.lifecycle.incident` | count | Trajectory classifies a lifecycle incident during capture delivery or runtime reconciliation. Other incident records stay on the local machine for diagnosis and are never sent. |
| `trajectory.instrumentation.publish.attempt` | count | A publish attempt runs, or Trajectory skips it for a known reason. |
| `trajectory.instrumentation.publish.latency_ms` | distribution | A timed publish attempt completes. |
| `trajectory.instrumentation.runtime_reconcile.attempt` | count | Runtime reconciliation finishes. Skipped and disabled outcomes count. |
| `trajectory.ops.agent.active_sessions` | gauge | Every hour, for fresh sessions. Known clients with no sessions report zero. |
| `trajectory.ops.agent.present` | gauge | Every day, for the client inventory. Absent clients are included. |
| `trajectory.ops.agent.version` | gauge | Every day, for the client inventory. Only detected clients are included, each with the result of a version probe. |
| `trajectory.ops.binary.heartbeat` | gauge | Every hour, as a deployment heartbeat with the running, installed, and desired version states. Use `binary_state:running` to count processes. |
| `trajectory.ops.convergence.heartbeat` | gauge | Every hour, as a deployment heartbeat. It includes the unmanaged and unknown states. |
| `trajectory.ops.install.auto_instrument_state` | gauge | Trajectory reports the managed auto-instrument owner and defaults, the configured publication, and the saved readiness that it checked. A disabled auto-instrument policy reports zero and does not turn on capture. |
| `trajectory.ops.install.current_state` | gauge | Managed setup reports its overall result. A changed result closes the previous series with zero. |
| `trajectory.ops.install.agent_state` | gauge | Managed setup reports one result per selected client integration. A changed result closes the previous series with zero. |
| `trajectory.ops.org_sync.success_age_seconds` | gauge | Every hour, when managed organization config is expected. The value is `-1` if a sync never succeeded. No feature flag controls it. |
| `trajectory.ops.required_destination.health` | gauge | Every hour, one series for each required destination that managed config sets. No feature flag controls it. |
| `trajectory.ops.update.wait_age_seconds` | gauge | Serve observes an installation or activation wait, at a change and hourly. An ended wait sends a final zero with its original tags. |
| `trajectory.serve.capture.request_error_total` | count | A capture request fails. |
| `trajectory.serve.goroutine.panic_recovered_total` | count | `trajectory serve` recovers from a panic in a background task. |
| `trajectory.serve.local_state.publish_ledger_held_claims` | gauge | Every hour, when a readable publish ledger exists. A healthy value of zero is sent too. |
| `trajectory.serve.terminal_recovery.oldest_age_seconds` | gauge | At each health check by the owning `trajectory serve` process. It sends one series for each `feature` value (`finalization`, `sensitivity`, and `segmentation`), including a healthy zero. |
| `trajectory.serve.terminal_recovery.pending` | gauge | At each health check by the owning `trajectory serve` process. It counts pending recoveries that have a receipt, including a healthy zero. |
| `trajectory.session.count` | count | A live session starts as fresh, resume, continue, or agents view. Trajectory sends it with an ID that is safe to replay. Sessions found by passive discovery are not counted. |
| `trajectory.turn.completed` | count | A completed turn produces one replay-safe point with its source completion time. |

## OOTB dashboard tag contract

The OOTB dashboard uses the following supported names. Every row needs `trajectory.user` and
`trajectory.version` for the dashboard filters. Additional tags below cover
both grouping and fixed filters.

| Metric | Additional required tags |
| --- | --- |
| `trajectory.instrumentation.capture.gap` | None |
| `trajectory.instrumentation.capture.hook_event` | None |
| `trajectory.instrumentation.capture.hook_latency_ms` | None |
| `trajectory.instrumentation.health.emit_dropped` | `component`, `signal` |
| `trajectory.instrumentation.publish.attempt` | `outcome`, `error_class` |
| `trajectory.instrumentation.publish.latency_ms` | `signal` |
| `trajectory.ops.convergence.heartbeat` | `host`, `update_enabled`, `target_version`, `manifest_status`, `deployment_action`, `convergence_status` |
| `trajectory.ops.install.auto_instrument_state` | `host`, `reason` |
| `trajectory.ops.install.current_state` | `host`, `outcome`, `reason`, `setup_binary_status` |
| `trajectory.ops.install.agent_state` | `host`, `setup_binary_version`, `client_source`, `agent_status`, `setup_component`, `setup_stage`, `setup_next_step`, `reason` |
| `trajectory.ops.org_sync.success_age_seconds` | `host`, `sync_status`, `failure_reason`, `failure_streak`, `failure_scope` |
| `trajectory.ops.required_destination.health` | `host`, `destination`, `destination_state` |
| `trajectory.ops.update.wait_age_seconds` | `host`, `stage`, `outcome`, `reason` |
| `trajectory.serve.capture.request_error_total` | `error_kind`, `event_type` |
| `trajectory.session.count` | `trajectory.client_source` |
| `trajectory.turn.completed` | `gen_ai.request.model` |

The publish-failure queries migrate to
`trajectory.instrumentation.publish.attempt{outcome:failure}`. The required
tags include that replacement query.

Health publishing adds the resolved user only to these six instrumentation
metrics. User resolution follows the other
metric publishers: `TRAJECTORY_USER`, then the operating-system username,
then `unknown`. Local health records contain no user identity. Incognito
health records stay local, including for otherwise exempt destinations.

Migrate consumers before changing this contract.

For the full behavior of each metric, see
[instrumentation health](instrumentation-health-metrics.md),
[publish and serve health](publish-and-serve-health-metrics.md), and
[session metrics](per-session-metrics.md).
