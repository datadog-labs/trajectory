# Operational Metrics

Use this page to find metrics about Trajectory's own health, overhead, and
delivery. The table groups them by question, across all metric namespaces.
All the families are current, except the rows marked **Not available**.

Each family page lists its metrics, tags, gates, and query rules. Before you
use a metric name from an older dashboard or audit, check its family page to
confirm that the metric is current.

## Find a metric by question

| Question | Metrics | Where to read and how to interpret |
| --- | --- | --- |
| Is the endpoint installed, configured, and capturing? | `trajectory.ops.install.*`, `trajectory.ops.agent.*`, `trajectory.ops.managed_capture.*` | [Setup, inventory, managed capture, and required destinations](publish-and-serve-health-metrics.md). Some of these metrics need a provider that most installations do not have. |
| Which binary is running, and are hosts moving to the desired version? | `trajectory.ops.binary.heartbeat`, `trajectory.ops.convergence.heartbeat`, configuration migration metrics | [Fleet update heartbeat](instrumentation-health-metrics.md#fleet-update-heartbeat). Heartbeat gauges show how many hosts are in each state. Do not add them up as event counts. |
| Do update checks still run, how long has an update waited, and did it succeed? | `trajectory.ops.update.wait_age_seconds`, the update policy and `check_freshness` tags on `trajectory.ops.convergence.heartbeat`, and the `serve.update.*` and `serve.repair.*` operational log events | [Update policy, check freshness, and wait age](instrumentation-health-metrics.md#update-policy-check-freshness-and-wait-age). No feature flag controls them. The metrics use normal metrics publishing. The events need an authorized managed `operational_logs` destination. Tags and ages show state, and events show outcomes. A missing series does not mean the update is healthy. |
| Is managed configuration current, and can required destinations receive data? | `trajectory.ops.org_sync.*`, `trajectory.ops.required_destination.*` | [Serve health](publish-and-serve-health-metrics.md). Keep an unknown state separate from an unhealthy one. |
| Are the process lifecycle, HTTP capture, and local maintenance healthy? | `trajectory.serve.process.*`, `.capture.*`, `.goroutine.*`, `.local_state.*`, `.lifecycle.*`, `.operational_log.*` | [Serve health](publish-and-serve-health-metrics.md). Process start counts alone do not show whether a crash happened. |
| Is terminal recovery or backfill stuck? | `trajectory.serve.terminal_recovery.*`, `trajectory.serve.backfill.failure_total`, `trajectory.instrumentation.fidelity.backfill.*` | [Recovery metrics](publish-and-serve-health-metrics.md) and `trajectory user-guide backfill`. Source timestamps and backlog gauges say nothing about CPU or memory use. |
| Is publishing failing? | Operational families under `trajectory.publish.*` | [Publish and serve health](publish-and-serve-health-metrics.md) and [instrumentation health](instrumentation-health-metrics.md). Direct sending and outbox delivery give different guarantees. |
| What overhead or failures do background LLM calls add? | `trajectory.serve.llm_capacity.*`, `trajectory.serve.segmentation.*` | [LLM capacity and segmentation metrics](publish-and-serve-health-metrics.md). They report a fixed set of reasons, the estimated cost, and attempt durations. |
| Is instrumentation losing data or deriving it wrongly? | `trajectory.instrumentation.*`, diagnostic fidelity families, `trajectory.repo.resolution.*`, `trajectory.pricing.lookup.*` | [Instrumentation health](instrumentation-health-metrics.md). A local diagnostic record does not mean that Datadog received the data. |
| How are CLI and MCP entry points behaving? | `trajectory.ops.cli.*`, `trajectory.ops.mcp.*` | [Command and MCP metrics](publish-and-serve-health-metrics.md). Managed export policy applies. Dispatch tags carry no content. |
| Are product and security modules active and evaluating? | The operational metrics under `trajectory.security.*` and module families | [Agent Security metrics](agent-security-metrics.md). Keep module health separate from security findings. |
| Is the runtime using too much CPU or memory? | `trajectory.ops.resource.cpu_percent.*`, `trajectory.ops.resource.rss_bytes.max`, `trajectory.ops.resource.processes.max`, `trajectory.ops.resource.sample_coverage` | **Not available.** No released build sends these metrics, even with the `resource_observation` control turned on. For process and session detail, use local health records and `trajectory flare`. |
| Is the runtime reading or writing too much disk, and which helper or store causes it? | `trajectory.ops.resource.disk_read_bytes.total`, `trajectory.ops.resource.disk_write_bytes.total`, `trajectory.ops.resource.disk_write_bytes_per_second.max`, `trajectory.ops.resource.exit_*`, `trajectory.ops.storage.*` | **Not available.** No released build sends these metrics, even with the `resource_observation` control turned on. The `trajectory.serve.local_state.*` gauges report sizes once a day. They do not report write rates. |
| Is a metric name from an older dashboard still current? | `trajectory publish metrics audit --latest --builtin-details` | The family pages list the metrics to use, not every metric that Trajectory sends. The audit command lists every built-in metric that your installed version sends. An older version can keep sending a retired name until it upgrades. |

A prefix in the table names a group of metrics. Not every name under that
prefix exists, and not every name is operational. Session-derived cost, tool,
turn, skill, task, and PR usage come from captured sessions.
Trajectory forwards native client OTLP separately. A prefix alone cannot tell
you whether a historical, security, or module metric is operational.

## Delivery, absence, and identity

| How Trajectory sends it | What a failure or gap means |
| --- | --- |
| Direct operational metrics | Trajectory sends them once, on a best-effort basis, and does not replay them. A gap can mean an inactive producer, a gate, missing credentials, a transport failure, or a stopped endpoint. |
| Operational metrics through the outbox | Trajectory saves them in a local outbox and retries them. It retries only rows that it saved to the outbox. A queued row, a row Datadog accepted, and a value you can read in Datadog are three separate states. |
| Instrumentation health buffer | A local diagnostic history of limited size. Trajectory does not retry sending it. |
| Operational logs | They need a separate managed authorization. Trajectory keeps them in an outbox of limited size and retries them, so a log can arrive more than once. Use them for process and session detail without adding metric tags. |

Destination and privacy policy differ by family, so the tag list also differs.
For example, serve support metrics include endpoint attribution. A process ID
or session ID can be important evidence, but it does not belong on every
metric. Trajectory never copies a process-wide measurement onto one series for
each active session.

Gauges show sampled state. Counters show events or attempts. Neither one alone
counts the number of affected hosts. Before you decide that a metric has no
data, check how often the producer sends it, enrollment, policy, and lifecycle
records.

## Namespace changes

New resource metrics use `trajectory.ops.resource.*`. Existing
`trajectory.serve.*`, `trajectory.publish.*`, and
`trajectory.instrumentation.*` metrics stay current where their family pages
say so. By default, Trajectory does not send a second copy of a metric under a
new namespace. A second copy would add volume and could double counts. A
metric marked **Not available** is not current until Trajectory sends it.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
