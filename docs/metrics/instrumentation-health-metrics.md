## Instrumentation Health Metrics

Instrumentation health metrics show how well Trajectory itself works. They
cover event capture, data derivation, marker evaluation, publishing, backfill,
and updates. Use them to monitor Trajectory across your fleet.

The tags carry no prompts, paths, session IDs, or other content.

### How health metrics reach Datadog

- Trajectory sends health metrics only to destinations that have metrics
  turned on and valid credentials.
- Trajectory also keeps recent health records in a local rolling buffer. The
  buffer holds up to 4,096 records. When it is full, Trajectory removes the
  oldest half. A full buffer is normal.
- The local buffer is for diagnostics on the machine. It is not a delivery
  queue. Trajectory never sends its contents again.
- Sending health metrics never adds network delay to a client hook. Hooks put
  records on a queue that does not block. If the queue is full, Trajectory
  drops the record and counts it in
  `trajectory.instrumentation.health.emit_dropped`.
- Old binaries, turned-off metrics, dropped records, and transport failures
  can all leave a series empty. A missing series means unknown. It does not
  mean healthy.

### Metrics

| Metric | Type | Tags | What it measures |
|---|---|---|---|
| `trajectory.instrumentation.publish.attempt` | count | `component`, `signal`, `destination_type`, `site`, `outcome`, `error_class`, `reason` | Publish attempts for spans, metrics, event logs, and module outputs, including skipped and failed attempts |
| `trajectory.instrumentation.publish.latency_ms` | distribution | `component`, `signal`, `destination_type`, `site`, `outcome`, `reason` | Publish latency by signal and destination type |
| `trajectory.instrumentation.capture.hook_event` | count | `component`, `client_source`, `signal`, `outcome`, `error_class`, `reason` | Hook deliveries with a receipt, and duplicate retries |
| `trajectory.instrumentation.capture.hook_latency_ms` | distribution | `component`, `client_source`, `signal`, `outcome`, `error_class`, `reason` | Total time of a capture request on the server |
| `trajectory.instrumentation.capture.gap` | count | `component`, `client_source`, `signal`, `reason` | Missing or inconsistent capture evidence |
| `trajectory.instrumentation.capture.write_latency_ms` | distribution | `component`, `client_source`, `signal`, `outcome`, `reason` | Time from hook to JSONL file, and from JSONL file to the local index |
| `trajectory.instrumentation.derivation.fallback` | count | `component`, `client_source`, `signal`, `source_pair`, `reason` | Values that Trajectory had to derive another way, such as token estimates or model, cost, or cache-token fallbacks |
| `trajectory.instrumentation.derivation.correction` | count | `component`, `client_source`, `signal`, `source_pair`, `reason` | Transcript reconciliation, backfill corrections, and repairs found by an audit |
| `trajectory.instrumentation.marker.evaluation` | count | `component`, `signal`, `outcome`, `error_class`, `reason` | Local marker evaluations at session end, including skipped and failed ones |
| `trajectory.instrumentation.marker.evaluation_latency_ms` | distribution | `component`, `signal`, `outcome`, `reason` | How long local marker evaluation took at session end |
| `trajectory.instrumentation.watchdog.gap_detected` | count | `component`, `client_source`, `signal`, `reason` | Missing captures, stalled queues, and delayed publish claims that the watchdog found |
| `trajectory.instrumentation.health.emit_dropped` | count | `component`, `signal`, `error_class`, `reason` | Health records that Trajectory could not keep |
| `trajectory.instrumentation.runtime_reconcile.attempt` | count | `component`, `signal`, `trigger`, `outcome`, `result_status`, `process_status`, `handoff_mode`, `reason` | Automatic runtime repair attempts and their results |
| `trajectory.instrumentation.runtime_reconcile.duration_ms` | distribution | Same as `runtime_reconcile.attempt` | How long each automatic runtime repair took |
| `trajectory.instrumentation.lifecycle.incident` | count | `component`, `signal`, `trigger`, `outcome`, `reason` | Capture, update, owner, retirement, and replacement incidents |
| `trajectory.instrumentation.backfill.files` | gauge | `component`, `signal`, `stage`, `outcome`, `reason` | Files handled by the local index pass and by Claude transcript import, by stage and outcome |
| `trajectory.instrumentation.backfill.sessions` | count | `component`, `client_source`, `signal`, `stage`, `outcome`, `reason` | Claude transcript import results for each stage |
| `trajectory.instrumentation.backfill.duration_ms` | distribution | `component`, `signal`, `stage`, `outcome`, `reason` | How long the local index pass and Claude transcript import took |

The publisher also adds `trajectory.version`, host, and operating-system tags
when it sends a record.

### Capture

#### Hook events and latency

`trajectory.instrumentation.capture.hook_event` counts hook deliveries that
have a receipt. A successful request counts only when the client supplied an
authenticated Trajectory home and a valid delivery ID. A success without a
receipt does not count.

`trajectory.instrumentation.capture.hook_latency_ms` measures the whole capture
request on the server. This includes admission, delivery coordination,
processing, and building the response.

Group both metrics by `client_source`, `outcome`, `error_class`, and `reason`.
Neither metric carries event, session, delivery, path, or payload identity.

#### Capture gaps

Do not use `trajectory.instrumentation.capture.hook_event` as the denominator
for `trajectory.instrumentation.capture.gap`. Gap reasons are findings at
different levels, such as usage on a completed turn. Hook events are transport
deliveries. Report gap counts by reason. A rate for one reason needs a
denominator at the same level. For example, use completed turns for
`usage_missing`.

A gap count does not count unique lost records. It also does not show whether
the data was saved. A delivery failure in a later step is a separate problem.

For Codex, Trajectory uses the result of the native mapper to classify tool
gaps. These do not count as gaps:

- tool events that mapped successfully
- history copied from a parent session, when Trajectory confirms the copy
- decoded output that repeats a tool completion Trajectory already sent

These still count as gaps:

- unmapped tool evidence in a fork whose owner is unclear, reported as
  `reconciliation_failed`
- malformed output blocks
- tool records that Trajectory does not support
- real reconciliation failures

Trajectory does not treat missing or equal timestamps, or opaque turn IDs, as
signs that a record was copied from the parent. Function and custom-tool outputs decode strings and
text content blocks the same way.

A Codex code-mode script can leave a child open on purpose. A yielded cell
waits for `wait`. A running `exec_command` waits for its own exit from
`write_stdin` or its `CommandExecution` record. That output maps no tool event
and is not a gap.

The child's own completion might not arrive before the turn ends (for example,
at `task_complete` or `turn_aborted`). It might also not arrive before the
session ends (`shutdown_complete`). The record that ends the turn or session
then reports one `reconciliation_failed` gap. At a turn end, the child's post
carries only the script output.

#### Write latency

`trajectory.instrumentation.capture.write_latency_ms` also covers short-lived
hook processes. While `trajectory serve` runs, these records go to the normal
metric destinations. A hook that runs without serve keeps its records on the
local machine only.

Claude native tool timing records one sample for each native tool call. The
sample carries `component:serve`, `client_source:cc`, and
`signal:native_trace`.

- `outcome:success` means serve matched the native tool to a Trajectory tool
  event and wrote its `native_tool_timing` event.
- `outcome:skipped` with `reason:native_tool_unmatched` means the native tool
  was still unmatched at session end.
- The value is the delay from the end of the native tool to that moment.
- The share of `success` outcomes is the native match rate.

### Derivation fallback

Trajectory classifies a missing Claude transcript path before it sends
`trajectory.instrumentation.derivation.fallback`:

- Trajectory's own classifier and segmenter processes send no fallback
  metric. They run without a native transcript by design.
- `headless_transcript_unavailable` is expected for other known headless Claude
  sessions, such as `claude --print`.
- `transcript_path_missing` applies to sessions that are neither headless nor
  internal analysis. It means Trajectory could not find a source that should
  exist.

The headless reason means the source does not exist by design. It is not a
capture gap. Headless and internal-analysis sessions are never segmented.

When a Claude SessionEnd adds a missing `turn_end` after a captured prompt,
the fallback metric reports `reason:missing_turn_end`. This counts the repair.
It does not show lost usage or a completed delivery. Sessions that are already
complete, and sessions without a prompt, do not send it. A repeated SessionEnd
delivery does not count it again.

### Publish attempts

`trajectory.instrumentation.publish.attempt` counts workflow attempts. It does
not count unique records, lost data, or intake requests. Report pending work
separately from successful and failed attempts. The latency samples carry the
same `outcome` and `reason` as the attempts.

| Case | `outcome` | Other tags |
|---|---|---|
| Metric rows are queued or claimed in the outbox, with no delivery error yet | `pending` | `error_class:none`, `reason:metric_delivery_pending` |
| Failed rows, or a recorded credential, HTTP, timeout, or uncertain-delivery error | `failure` | Applies even when newer queued rows have no error |
| A canceled context, a serialization failure, or an internal publish error (since version 0.5.31) | `failure` | `reason:context_canceled`, `serialization_failed`, or `publish_internal_error` |
| The API key could not be read, including from the OS keychain | `failure` | `error_class:auth`, `reason:credentials_unavailable` |
| Metric rows wait for a later pass: the pass reached its request limit, an older row for the same value is still sending, a process stopped before sending, or a PR point is older than Datadog accepts | `failure` | `error_class:unavailable`, `reason:metric_delivery_deferred` |
| Trajectory could not reserve a slot for a metric request, usually because too many were already running | `failure` | `error_class:unavailable`, `reason:queue_full` |
| Metric rows held by a setting that is off, such as oversight delivery | `failure` | `error_class:permission`, `reason:policy_disabled` |
| Trajectory could not confirm that the destination may still receive the metric rows | `failure` | `error_class:permission`, `reason:authorization_unavailable` |
| Trajectory could not finish the incognito check for historical metric rows | `failure` | `error_class:unavailable`, `reason:privacy_context_unavailable` |
| Datadog accepted only part of a request | `failure` | `error_class:validation`, `reason:partial_failure` |
| Datadog accepted the metric rows, but Trajectory could not save that result locally | `failure` | `error_class:internal`, `reason:storage_io` |
| Marker metrics sent to a `datadog_agent` destination | `skipped` | `reason:unsupported_metric_transport` |

A `pending` attempt is neither complete nor failed. A publish pass can leave
work for a later pass or another publisher. The publish operation still
reports incomplete delivery, so retries and duplicate protection still work.

Rows that report `reason:metric_delivery_deferred` or `reason:policy_disabled`
were not rejected. They stay in the outbox and send on a later pass, or once
the setting changes. `reason:publish_internal_error` remains for errors that
Trajectory does not recognize.

The `datadog_agent` destination has no metric transport. Actual evaluation
errors on that path still report as failures. Both `datadog_agent` and its
older spelling `dd_llmobs_via_agent` report `destination_type:datadog_agent`.
Older binaries reported them as `custom`. These records stay local when the
destination cannot export health metrics.

Incremental turn publishing sends the same attempt and latency records as
other publishing, for each output it actually calls. An empty metric change
sends no attempt. A successful call can still do nothing after eligibility and
duplicate checks. A success does not show that an intake request was made or
that the data was indexed. Counts go up after an upgrade from versions that
reported only credential failures for incremental publishing.

Publish attempts use the client identity saved at session start. A missing
session context reports `unknown`. Trajectory does not look at other active
sessions or saved transcripts to fill it in. Event Platform event streams and
AI Usage outputs report `signal:record`. Other module-specific signals report
`unknown`.

### Marker evaluation

Since version 0.5.31, marker evaluation reports these causes separately:

- missing tables
- missing columns
- other schema mismatches
- unavailable local storage
- canceled contexts
- invalid marker configuration
- an internal evaluator fallback

Each cause has its own `reason` value. Raw database errors, destination
responses, paths, and content never become tags.

### Native OTLP forwarding

Trajectory serve can forward native `/v1/metrics`, `/v1/traces`, and
`/v1/logs` requests on a best-effort basis. The forwarder also sends
`publish.attempt` and `publish.latency_ms`.

- Select `component:serve,destination_type:otlp` for the forwarder.
  Publish-engine attempts use `component:publish`.
- Its signals are `metric`, `span`, and `event_log`.
- Client identity and site are `unknown`.
- No payload identity, endpoint, credential, header, or raw error becomes a
  tag.

Each forward sends one attempt count and one latency sample. The sample covers
configuration and credential lookup and the HTTP forward.

| Case | Tags |
|---|---|
| Forwarding is off or has no endpoint | `outcome:skipped,reason:config_disabled` |
| Configuration error | `reason:config_error` |
| Missing credentials | `reason:credentials_unavailable` |
| Transport error | `reason:network_error`, `timeout`, or `context_canceled` |
| Upstream rejection | `reason:http_4xx` or `http_5xx` |
| HTTP 401, 403, or 429 | `error_class:auth`, `permission`, or `rate_limited` |

Success means the upstream returned HTTP 2xx. It does not confirm each record,
a fully read response, or indexing. The native client's request succeeds
whether or not forwarding succeeds. Forwarding adds no retries and saves
nothing for later delivery. Requests that Trajectory rejects or blocks before
forwarding send no attempt.

Do not combine these request counts with publish-engine counts to compute a
delivery rate or estimate data loss.

Health-only metric exports carry the header `X-Trajectory-Health-Export: 1`.
Native forwarders keep this header and the metric payload. They add no session
or model tags, and they do not send another health pair for the request. This
keeps health metrics free of session data. It also stops a loop through one or
more native proxies. Requests without the header get normal tags. The header
grants no access and skips no forwarding controls.

Forwarding health uses the same queue as other serve health records. A full
queue cannot delay native intake. Dropped records add to
`health.emit_dropped{component:hook,reason:queue_full}`. That count does not
say which producer lost the samples.

### Held publish claims

`trajectory.instrumentation.watchdog.gap_detected` with
`{component:publish, client_source:unknown, signal:watchdog,
reason:publish_ledger_claim_held}` reports a held final-session publish claim.
The claim stays in the publish ledger long after any live publish could need
it. The trace outbox then retries it without end.

Trajectory sends this point only while the condition lasts. It covers hosts
that export instrumentation health but not serve metrics. The main signals,
which carry the user, are
`trajectory.serve.local_state.publish_ledger_held_claims` and
`publish_ledger_held_claims_detail`.

To recover, run `trajectory publish queue claims`, then
`trajectory publish queue resolve-claim`.

### Local index and transcript import

The local index pass sends one `trajectory.instrumentation.backfill.files`
gauge for each `stage`: `processed`, `indexed`, `deferred`, and `failed`. It
also sends one `trajectory.instrumentation.backfill.duration_ms` sample with
`stage:complete`. Both carry `outcome` and `reason` tags. A background pass
that stops because the Mac switched to battery reports `outcome:held` and
`reason:on_battery`. These records hold only counts and elapsed time. File names, session identities, and local paths
are never recorded or sent.

Claude transcript import sends the same file gauges and duration, even when it
finds no sessions.

- `stage` is `discover`, `convert`, `submit`, or `confirm`.
- `outcome` is `success`, `failure`, `skipped`, or `held`.
- `trajectory.instrumentation.backfill.sessions` counts each stage result with
  `client_source:cc`.
- Count each stage separately. One session can complete all four stages, and
  retries count again.
- The file gauges describe the current run. Use the session counts for rates
  across runs.

| Stage and outcome | Meaning |
|---|---|
| `stage:submit,outcome:success` | The local step succeeded. It does not mean Datadog accepted the data. |
| `stage:submit,outcome:failure` | Submission failed |
| `stage:confirm,outcome:success` | Processing and evaluation succeeded, and the completeness check passed |
| `stage:confirm,outcome:skipped` | The existing index already passed the completeness check |

Conversion can be skipped while submission retries. A failure carries one of
these reasons: `transcript_read_failed`, `transcript_parse_failed`,
`conversion_failed`, `canonical_write_failed`, `canonical_materialize_failed`,
`ingest_failed`, `evaluation_failed`, `projection_check_failed`, or
`token_repair_failed`.

Session identity, paths, error details, and parser lines appear only in local
CLI output. If Trajectory cannot write or send these metrics, the import
result does not change. Trajectory sends the summary metrics together, at most
64 records for each session and privacy group.

### Backfill fidelity

The `trajectory.instrumentation.fidelity.backfill.*` family measures backfill
over complete UTC days. It uses delivery receipts saved in the metric outbox.
The rolling backfill worker sends it when all of these are true:

- The managed rolling backfill policy is on.
- The managed `agent_console_durable_backfill` feature is not turned off. It
  is on by default.
- A managed Datadog destination exists that has not set
  `backfill_opt_out: true`.

This family does not count each import command. A local import on an
unmanaged device creates no managed delivery receipts. Use the import metrics
above to check its health. If the managed fidelity metrics are missing, the
import has not necessarily failed.

These gauges leave out the current binary version. A new value must replace
the old one in the same series across upgrades.

| Metric | Type | What it reports |
|---|---|---|
| `trajectory.instrumentation.fidelity.backfill.sessions` | gauge | Sessions for each client and UTC day at `stage:local`, `eligible`, `materialized`, and `delivered`. `delivered` comes from saved outbox receipts. `source_capability` shows whether Trajectory rebuilt the data from provider and local records or from local records only. |
| `trajectory.instrumentation.fidelity.backfill.turns` | gauge | The same stages for completed turns |
| `trajectory.instrumentation.fidelity.backfill.days` | gauge | One set of points for each reconciled UTC day, across `state:complete`, `partial`, and `unobservable`. The day's state is `1` and the others are `0`. Count the `complete` points over the trailing window to track the backfill objective. |
| `trajectory.instrumentation.fidelity.backfill.last_success_age_seconds` | gauge | The age of a fully delivered UTC-day snapshot. It is zero for partial or unobservable days. Use it with `last_success_valid`. |
| `trajectory.instrumentation.fidelity.backfill.last_success_valid` | gauge | `1` when the matching age is valid for a fully delivered day, `0` otherwise |
| `trajectory.instrumentation.fidelity.backfill.unpriced_turns` | gauge | Turns without a price, by client and reason, after a complete scan |
| `trajectory.instrumentation.fidelity.backfill.failures` | gauge | Source-import and local-scan failures by client and `reason:deleted`, `malformed`, `incomplete`, `oversized_fragment`, `oversized_session`, `discovery_limit`, or `scan_error`. Trajectory writes zero after recovery to clear the same historical point. Any value above zero keeps the day unproven. |
| `trajectory.instrumentation.fidelity.outbox.allocated_bytes` | gauge | The SQLite space used by the metric outbox after a rolling sweep |
| `trajectory.instrumentation.fidelity.outbox.oldest_pending_age_seconds` | gauge | The age of the oldest pending row, or zero after a complete scan finds none |
| `trajectory.instrumentation.fidelity.outbox.effective_horizon_days` | gauge | The age of the oldest kept record, by `evidence_state:sent`, `dropped`, or `pending`. It measures the data on disk, not the retention setting. |
| `trajectory.instrumentation.fidelity.outbox.dropped` | gauge | Saved drop receipts by reason. `reason:max_size` shows data lost because the outbox was full. |

### Dropped health records

`trajectory.instrumentation.health.emit_dropped` counts health records that
Trajectory could not keep. This happens when a record cannot be cleaned of
private data, or when the write to the local buffer fails. Trajectory sends
this count only to remote destinations. It carries `component`, `signal`,
`error_class`, and `reason` tags.

| Cause | `error_class/reason` |
|---|---|
| Lock contention | `lock_contention/lock_contended` |
| Full file system | `unavailable/storage_full` |
| Permission error | `permission/storage_io` |
| Missing path | `not_found/storage_io` |
| Other file system error | `internal/storage_io` |
| Malformed saved JSON | `parse/schema_mismatch` |
| Invalid saved record | `validation/schema_mismatch` |
| Unknown cause | `internal/unknown` |
| Hook queue full | `component:hook` with `reason:queue_full` |

The capture server writes health records from a background queue. If another
writer holds the local buffer, the server waits up to 5 seconds before it drops
the records and counts them here.

These counts show that Trajectory could not keep local diagnostic records.
They do not show lost captured data or a failed remote delivery. After a local
write fails, Trajectory still tries to send the original health sample. Raw
error text, paths, and record contents never become tags. Drop reports are not
themselves reported again.

Local audit and doctor output show how full the buffer is.

### Batched diagnostic export

The `instrumentation_health_batching` feature groups remote health records. It
is on by default. Trajectory sends one OTLP request for each destination
configuration every ten seconds. Records from hooks and from publishing both
use this path.

- Each data point keeps its value, tags, metric type, and source timestamp.
  Batching does not add counts together or merge latency samples.
- Destinations stay separate even when they share an intake URL. Each keeps
  its own credential and policy.
- When a session becomes private, Trajectory also stops its older samples that
  are still waiting.
- Trajectory checks session and global incognito again before it sends.

The local buffer still gets each record right away. Waiting remote work stays
in memory only. It is limited across all publish engines in the process to
2,048 records and 4 MiB. When that limit is reached, Trajectory drops remote
work but keeps the local record.

- Flushes share the existing limit of four requests at a time for each
  process. Each request has a two-second timeout.
- Batching adds no new HTTP client, retry queue, or saved delivery.
- At shutdown, Trajectory starts a flush right away and waits up to 250 ms.
  A slow export can take longer. Shutdown does not promise delivery.
- An interval with no records sends nothing.
- Turning the feature off restores one request for each record. This includes
  records still waiting when you turn it off.

With the feature off, a local batch of records takes one of the four request
slots. Trajectory sends its records one at a time, each with a two-second
timeout. The batch holds its slot for at most ten seconds. If a request uses
its whole timeout, Trajectory stops sending the rest of that batch. Those
records stay in the local buffer.

### Runtime reconciliation

Trajectory repairs its runtime on its own at these times:

- after a managed install
- when an MCP server starts
- when the serve owner starts
- after a background update

Each repair sends
`trajectory.instrumentation.runtime_reconcile.attempt` and
`trajectory.instrumentation.runtime_reconcile.duration_ms`.

The tags are `trigger`, `result_status`, `process_status`, `handoff_mode`,
`outcome`, and `reason`, plus fixed `component` and `signal` values. They hold
no path, PID, session identity, plugin output, or error text.

`handoff_mode` is one of `fenced_independent`, `seamless_reexec`,
`deferred_natural_exit`, `pending_agent_adoption`,
`automatic_orphan_adoption`, `nuclear_reconcile_contended`, `adopter_lost`,
`none`, or `unknown`.

| Situation | Tags |
|---|---|
| The owner has active sessions | `process_status:active_sessions_deferred` |
| A healthy older owner without a fenced handoff | `process_status:activation_pending`, `handoff_mode:deferred_natural_exit`, `outcome:skipped`, `reason:update_activation_pending` |
| Waiting for an agent to take over, or a contended repair | `process_status:activation_pending`, with the original `handoff_mode` |

A later activation or automatic retry reports its own result. Because the
original handoff mode stays, you can tell these delays apart.

When a repair finds a lifecycle failure or a safe delay,
`trajectory.instrumentation.lifecycle.incident` sends one count. Its `reason`
is the same incident code that `trajectory doctor` and
`diagnostics/lifecycle.json` show. `component`, `signal`, `trigger`, and
`outcome` let you group incidents across the fleet. The metric holds no local
path, PID, session identity, raw error, or user content. Counts are incidents
or attempts, not unique affected users. To investigate one host, use the code
to request a redacted flare.

### Fleet update heartbeat

The elected serve owner sends these gauges at most once an hour. They go
through the normal Datadog destinations that have metrics turned on.

| Metric | Value | Tags |
|---|---|---|
| `trajectory.ops.binary.heartbeat` | The number of fresh running processes, or `1` for the installed or desired state | `role`, `owner`, `managed`, `cohort`, `binary_state`, `version` |
| `trajectory.ops.convergence.heartbeat` | `1` for the current convergence state of the host | `role`, `owner`, `managed`, `cohort`, `convergence_status`, `manifest_status`, `running_version`, `installed_version`, `desired_version`, `deployment_generation`, `deployment_action` |

`managed` is `true` when the install owner is a device-management owner:
`jamf`, `mdm`, `managed`, or `datadog-managed`. On macOS, a Mac with the
Trajectory configuration profile whose serve runs the account's
`~/.trajectory/bin/trajectory` has owner `mdm`, even when no install owner is
recorded. Managed org sync uses the same rule. `managed` is `false` for every
other owner, in these cases:

- The install records no owner and uses the default `manual` owner.
- Trajectory cannot read the install owner.
- The host was installed by the user but uses managed-keychain defaults. It
  still syncs managed org configuration.

Every gauge with the fleet tags uses this value.

`convergence_status` is `converged`, `binary_pending`, `activation_pending`,
`paused`, `manifest_invalid`, `unmanaged`, or `unknown`. `manifest_status`
separates a missing managed policy from a present or invalid one. A bad
org-config deployment therefore cannot look like an unmanaged host.

Version values are cleaned and come from fixed formats. The metrics hold no
PID, session, path, user, or rollout identity. Query them as gauges with an
hourly `max` rollup over at least four hours. Do not use `.as_count()`. It
turns repeated gauge samples into false growth.

#### Update policy, check freshness, and wait age

Serve adds update policy tags to the convergence heartbeat. It also reports one
wait-age gauge. No feature flag controls them. They go to the same
destinations as the heartbeat: Datadog destinations with metric markers and
credentials, unless the user opted out of publishing.

Serve adds these five tags to `trajectory.ops.convergence.heartbeat`. The
existing tags keep their values. `desired_version` still comes only from
`deployment.json`.

| Tag | Values | Source |
|---|---|---|
| `update_enabled` | `true`, `false`, `unknown` | The install owner and the automatic-update setting: `TRAJECTORY_AUTO_UPDATE`, `auto_update`, and `automatic_self_update` |
| `update_authority` | `trajectory`, `mdm`, `package_manager`, `unknown` | The install-owner records that the updater reads, including the delegation marker of a managed user install. `package_manager` is a Homebrew install, which Trajectory never updates itself. |
| `target_version` | A cleaned version, or `unknown` | The version that the active updater's policy selects. See below. |
| `release_ring` | `stable`, `beta`, `bravehearts`, `unknown` | The saved `deployment.ring` setting |
| `check_freshness` | `current`, `stale`, `unknown` | Whether an update check finished in the last 90 minutes |

`target_version` is the desired version of a valid, non-pause
`deployment.json` when the updater acts on that file. Two updaters act on it:

- a managed user install's updater, while its org sync policy names
  `deployment.json`
- the ordinary updater, with `managed_deployment_convergence` on

Otherwise, `target_version` is the release that the last finished check chose.
It is `unknown` when updates are off, when a manifest the updater acts on is
invalid, or when no check has chosen a release.

Notes on these tags:

- When Trajectory cannot read `selfupdate.conf`, the ordinary updater ignores
  the file and still runs. `update_enabled` follows what the binary's
  location, build and environment decide. `update_authority` is what they
  decide, and `unknown` when they decide nothing, because the file may name the
  owner. A managed user install is the exception. Its updater never reads
  `selfupdate.conf`.
  A damaged or unreadable copy, such as one left by an earlier install run as
  root, therefore does not change its tags.
- A serve whose binary belongs to an installer-owned install in another home
  reports `unknown` for `update_enabled` and `update_authority`. The ordinary
  updater refuses to replace that binary. The install's own updater runs only
  for its home.
- A missing `deployment.json` changes none of these tags.
- A managed user install picks its update documents through its org sync
  files, which managed defaults also carry. After the policy moves to
  `RELEASES.json`, a leftover `deployment.json` still sets `desired_version`.
  It does not set `target_version`.
- `convergence_status:unmanaged` does not show whether the host is enrolled
  or whether updates are off.
- Updates that are off or that device management controls are not failures.
- Besides the hourly report, serve sends the heartbeat again when one of these
  five values changes.
- These tags use saved settings, like the updater. A report waits for a
  settings reload to finish. A failed reload does not change them and does not
  stop an update.

##### Check freshness

`check_freshness` shows only whether update checks still happen. Routine check
results stay on the device. Trajectory sends no check-age metric.

- The window is 90 minutes. The updater allows a check at most once an hour
  and polls every 10 minutes. The window covers that hour, the first poll
  after it, the check itself, and scheduling delay.
- `current` means a check finished within the window, whatever its result. A
  failed check is still `current`. Failures appear in the update events.
- `stale` means three things. Updates were on for the whole window. Reports
  ran with no gap longer than 30 minutes. No check finished in the window.
- `unknown` means no check has finished yet, the window was not fully
  observed, or the clock is earlier than the last check.
- While updates are off or their state is unknown, an old check is `unknown`.
  It is never `stale`.
- A gap of more than 30 minutes between reports restarts the observed window.
  Sleep or a stopped service can cause this, because the updater may not have
  run. Reports run every 10 minutes.
- Trajectory saves the last check time in `state/update/observation.json`.
  Freshness therefore survives restarts.

##### Wait age

Serve also reports this gauge with the fleet tags `role`, `owner`, `managed`,
and `cohort`:

| Metric | Value | Extra tags | When it is sent |
|---|---|---|---|
| `trajectory.ops.update.wait_age_seconds` | Whole seconds since the current install or activation wait began | `stage`, `outcome`, `reason` | When a wait starts or changes, when a heartbeat tag changes, and every hour. One final `0` when the wait ends or its tags change. |

A wait has a known target version.

- The `install` stage means updates are on and the installed version differs
  from the target.
- The `activation` stage means the target is installed, but the live serve
  processes are not exactly one process on the target.

| `outcome` | `reason` |
|---|---|
| `waiting` | `install_pending`, `activation_pending` |
| `deferred` | `update_in_progress`, `activation_retry_pending` |
| `failure` | `install_failed`, `rollout_failed`, `managed_update_failed`, `target_rejected` |

When a wait starts and changes:

- A new stage or target restarts the wait. A change of outcome keeps the start
  time.
- Only a check that names the wait's target changes its outcome. One
  exception applies. If another updater holds the install lock and blocks every
  install attempt, that delay changes the current install wait without naming
  a version.
- Any other check that names no version leaves the wait as it is. Examples
  are an unreadable manifest and a managed generation rejected before any
  attempt. A failed managed user reconciliation that never chose a release is
  another example.
- A failed managed user reconciliation that did name a release reports
  `failure`/`managed_update_failed` for that release. This includes a failure
  to admit the release. Its reported desired version is still the installed
  one, and Trajectory never uses that as the target.
- A rejected release reports `failure`/`target_rejected`, and the check counts
  as skipped, not failed. The ordinary and managed user updaters reject a
  release that fails verification. They also refuse a release listed in
  `selfupdate-blocked.json` until a newer release or an operator retry.
- Every updater refuses the exact release digest that it rolled back from on
  this machine, until an operator overrides it. Only that refusal counts as
  rejected. Another failure at the same version, such as an unreachable
  checksum manifest, stays a retry.
- A drift repair reinstalls a deployment generation that was already applied.
  It changes the wait like any other check for its release. `serve.repair.*`
  events report its result, not update events.
- A managed rollout that keeps a verified candidate to retry reports
  `deferred`/`activation_retry_pending` for its target. The ordinary updater
  does the same.
- An unknown target keeps any open wait and starts none. An unknown installed
  version keeps an open wait for the same target and starts none.
- If there is no evidence about live processes, an existing activation wait
  stays open and no new one starts. A live process without a version makes
  all live process evidence missing. So does a process whose command line
  cannot be read to confirm that it is Trajectory.

When a wait ends:

- When the evidence shows the wait ended, Trajectory sends one final `0` for
  the last reported series, with its previous tags. A wait ends, for example,
  when the target runs or updates are turned off.
- A change of stage, outcome, reason, or fleet tags also sends a final `0`
  before the new series reports its age.
- A final `0` stays pending until a submission succeeds. Each later report
  sends it again. A ten-minute follow-up keeps running while a `0` is pending.
- A destination that refuses the point, or an intake request that fails,
  leaves it pending. If no destination is eligible, the `0` counts as sent.
- At most eight ended series can wait for a final `0`. Trajectory drops the
  oldest first. A new age for the same series replaces its pending `0`.
- Missing evidence or an unknown target keeps reporting the open wait's age.
  A publishing opt-out, or a clock earlier than the wait's start, stops the
  reports. None of these cases sends a guessed `0`.

State and versions:

- Trajectory saves the start time and the last reported series in
  `state/update/observation.json`. The age and the final `0` survive
  restarts.
- After the first report from a version with this gauge, or after state loss,
  the age is a lower bound. A series reported before state loss gets no final
  `0`.
- Serve processes in one home share this state. Another process may have
  ended or replaced the wait after this process saw it. This process then
  sends the series' current value instead of its old age. That value is the
  final `0` or the new wait's age.
- A wait for a new target can keep the same tags. The series then continues
  with the new wait's age. If the wait changes while the age is being sent,
  the process then sends the current value.
- Each point carries the `trajectory.version` of the serve process that
  reported it. A final `0` keeps that version, even when a newer binary sends
  it. Module state metrics work the same way. When the target version ends an
  activation wait that the old version reported, the old version's series gets
  its `0`.
- A process of another version that reports an open wait first ends the
  earlier version's series. It then reports the age under its own version.
  While serve processes of two versions both run, each report ends the other
  version's series. Only the latest reporter's series shows an age.
- `host` and `os.version` still come from the sending machine, which is the
  same machine.

How to query:

- The gauge goes through the serve metric sender. Trajectory does not retry
  ages. A missed report appears later as an older age.
- Trajectory retries a final `0` as described above. If it drops a `0` from
  the pending list, the last positive value stays until it ages out.
- Use a `max` rollup and alert on age thresholds.
- To find stale hosts, look for a missing heartbeat, not a missing wait-age
  gauge.
- Update outcomes are `serve.update.*` operational log events, not metrics.

To find hosts with a stale org-config sync or a missing required destination,
use `trajectory.ops.org_sync.success_age_seconds` and
`trajectory.ops.required_destination.health`. See the
[query guidance](query-guidance.md).

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
