## Instrumentation Health Metrics

Instrumentation health metrics show how well Trajectory itself works. They
cover event capture, data derivation, publishing, and updates. Use them to
monitor Trajectory across your fleet.

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
  drops the record and notes the drop in the local buffer. See
  [Dropped health records](#dropped-health-records).
- Old binaries, turned-off metrics, dropped records, and transport failures
  can all leave a series empty. A missing series means unknown. It does not
  mean healthy.

### Metrics

| Metric | Type | Tags | What it measures |
|---|---|---|---|
| `trajectory.instrumentation.publish.attempt` | count | `component`, `signal`, `destination_type`, `site`, `outcome`, `error_class`, `reason` | Publish attempts for spans, metrics, event logs, and module outputs, including skipped and failed attempts |
| `trajectory.instrumentation.capture.hook_event` | count | `component`, `trajectory.client_source`, `signal`, `outcome`, `error_class`, `reason`, `hook_name` | Hook deliveries with a receipt, and duplicate retries |
| `trajectory.instrumentation.capture.hook_latency_ms` | distribution | `trajectory.client_source`, `outcome`, `error_class`, `reason` | Total time of a capture request on the server |
| `trajectory.instrumentation.capture.gap` | count | `component`, `trajectory.client_source`, `signal`, `reason` | Missing or inconsistent capture evidence |
| `trajectory.instrumentation.capture.recovered` | count | `component`, `trajectory.client_source`, `signal`, `kind`, `reason` | Turns and sessions that Trajectory recovered from a client's history because live capture missed them |
| `trajectory.instrumentation.derivation.fallback` | count | `component`, `trajectory.client_source`, `signal`, `source_pair`, `reason` | Values that Trajectory had to derive another way, such as token estimates or model, cost, or cache-token fallbacks |
| `trajectory.instrumentation.watchdog.gap_detected` | count | `component`, `trajectory.client_source`, `signal`, `reason`, optional `stage` | Missing captures, stalled queues, and delayed publish claims that the watchdog found |
| `trajectory.instrumentation.lifecycle.incident` | count | `component`, `signal`, `trigger`, `outcome`, `reason` | Capture, update, owner, retirement, and replacement incidents |

Three kinds of health record stay on the computer and are never sent: capture
write latency, dropped health records, and runtime repair attempts.
`trajectory doctor` and the support flare read them.

The publisher also adds `trajectory.version`, `host`, and `os.type` when it
sends a record, and on macOS the
[`trajectory.device_id`](../METRICS.md#who-and-where) tag. The local record's
`client_source` is sent as `trajectory.client_source`.
`trajectory.instrumentation.capture.hook_latency_ms` leaves out `host`, the
device ID, `component`, and `signal`. A distribution keeps percentiles for
every series, and its readers group it by user and version.

The four health metrics in the
[OOTB dashboard contract](../METRICS.md)
and `trajectory.instrumentation.capture.recovered` also carry
`trajectory.user` for dashboard filtering. Local records omit user
identity. Incognito health stays local, including for destinations otherwise
exempt from incognito.

### Capture

#### Hook events and latency

`trajectory.instrumentation.capture.hook_event` counts hook deliveries that
have a receipt. A successful request counts only when the client supplied an
authenticated Trajectory home and a valid delivery ID. A success without a
receipt does not count. A retry that arrives while the server is still
handling an earlier attempt of the same delivery counts as `outcome:skipped`
with `lock_contention/lock_contended`. The earlier attempt's own result is
what shows whether the event was recorded.

`trajectory.instrumentation.capture.hook_latency_ms` measures the whole capture
request on the server. This includes admission, delivery coordination,
processing, and building the response.

Group both metrics by `trajectory.client_source`, `outcome`, `error_class`, and `reason`.
Neither metric carries session, delivery, path, or payload identity.

`hook_event` also carries `hook_name` on Cursor deliveries. It is the Cursor
hook in lower case, such as `stop` or `afteragentresponse`, from a fixed list of
18, or `other`.
A Cursor turn closes on those two hooks, so this tag shows whether they still
arrive when turns stop. Other clients leave it out.

#### Capture gaps

Do not use `trajectory.instrumentation.capture.hook_event` as the denominator
for `trajectory.instrumentation.capture.gap`. Gap reasons are findings at
different levels, such as usage on a completed turn. Hook events are transport
deliveries. Report gap counts by reason. A rate for one reason needs a
denominator at the same level. For example, use completed turns for
`usage_missing`.

A gap count does not count unique lost records. It also does not show whether
the data was saved. A delivery failure in a later step is a separate problem.

`trajectory serve` sends two gaps with `component:serve` and `signal:metric`.
The value of each is a count:

- `cache_missing_tool_calls`: at session end, after evaluation, the session's
  file holds tool calls the local cache lacks. The value is how many.
- `publish_catch_up_window`: a session whose publish cursor was bound or lost
  left out turns older than seven days. The value is how many.

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

#### Turns and sessions that live capture missed

`trajectory.instrumentation.capture.recovered` counts the turns and sessions
that live capture missed and Trajectory later recovered from the client's own
history. Live capture is the hooks, plugins, and extensions that record a
session while it runs. Each point is the number that one pass recovered.

Trajectory sends the count in these cases:

| Case | `kind` | `reason` |
|---|---|---|
| The daily backfill imports a whole session that live capture never recorded. Trajectory sends one point for the sessions and one for their turns, for each client. | `session`, `turn` | `no_hook_events` |
| `trajectory serve` imports an idle Pi session file that the Pi extension never recorded. | `session`, `turn` | `no_hook_events` |
| `trajectory serve` or the daily backfill imports a pi-subagents run. A sub-agent loads no extensions, so live capture never records it. | `session`, `turn` | `client_unsupported_live` |
| Claude Code transcript repair writes a turn that reached capture with neither its prompt hook nor its Stop hook, in a session that capture recorded. | `turn` | `hooks_partial` |

The daily backfill runs only where the managed rolling backfill policy is on.
The `reason` tag can
also take the values `serve_down` and `other`. This version does not send
them.

The count leaves these out:

- Turns and sessions that live capture recorded. Backfill finds them and
  writes nothing.
- The history from before install. The daily backfill counts only sessions
  that started after its first complete import of a client's history. This
  holds also when a later day's window first brings an older session in.
- The Pi session files that `trajectory serve` finds when it starts to watch
  them. They can hold history from before install or from a time when
  `trajectory serve` was not running.
- Sessions that ran while capture was off or disabled. Backfill does not
  import them.
- Incognito sessions. The daily backfill leaves them out of the count, and
  the Pi import's points for them stay on the computer.
- Turns that Claude Code transcript repair writes while `trajectory serve` is
  not running. They stay in the local health buffer.

A few recovered turns are normal. A client that crashes or is stopped can
lose a hook. A rise for one client means that its live capture stopped working
on some computers. To find and fix the cause, follow these steps:

1. Filter the count to `kind:turn` and group it by `trajectory.client_source`
   and `reason` to find the client and the kind of gap. Do not add the
   `kind:session` and `kind:turn` points together: a recovered session sends
   one of each.
2. Group by `host` and `trajectory.version`. One host points to that computer's
   setup. A new version on many hosts points to a Trajectory or client release.
3. For `reason:no_hook_events`, run `trajectory doctor` on an affected
   computer. Its capture line for the client shows whether the client is set
   up and whether its sessions arrive. `trajectory setup check --clients cc`
   checks the Claude Code setup and changes nothing. Look for hooks or a
   plugin that a client update removed, or a managed setting that turned the
   client's capture off. To install the hooks again, run
   `trajectory setup clients install --clients <client>`.
4. Leave `reason:client_unsupported_live` out of alerts. It counts sessions
   that the client never lets live capture record, so it rises and falls with
   their use.
5. For `reason:hooks_partial`, the hooks run but some of them fail. Check
   `trajectory.instrumentation.capture.hook_event` with `outcome:failure` and
   `trajectory.instrumentation.capture.hook_latency_ms` for the same client
   and hosts. Look for hooks that time out, or for `trajectory serve` restarts.
6. Watch the count after the fix. It falls once new sessions arrive through
   live capture again.

#### Write latency

Trajectory records the time from hook to JSONL file, and from JSONL file to
the local index, in the local health buffer. It never sends these records.

Claude native tool timing records one sample for each native tool call. The
sample carries `component:serve`, `trajectory.client_source:cc`, and
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

Claude Code turn validation reports `source_pair:transcript_to_jsonl` with
these fallback reasons when it keeps provisional usage:

- `settle_unaligned`
- `settle_cumulative`
- `settle_transcript_too_large`
- `settle_unavailable`
- `settle_timeout`
- `settle_session_closed`

GitHub Copilot CLI reports its Stop-time read of its session log
(`events.jsonl`) under the same tags, with `trajectory.client_source:copilot`. Each Stop
whose payload names the log counts once. A Stop whose turn took its model,
tokens, and reply from the log sends no health record. Every other such Stop
counts on the fallback metric with one of these reasons:

- `settle_unaligned`: the log has no entry for the Stop, or a log already
  read to the end has no hook entries at all.
- `settle_unavailable`: the log is missing or unreadable, the read failed,
  or the turn has no main-agent usage records, as before Copilot 1.0.94.
- `settle_timeout`: the Stop's entry did not reach the log within 500 ms.
  The first Stop of a log with no hook entries also ends here.
- `settle_transcript_too_large`: the unread part of the log is too large.
- `settle_session_closed`: the session ended before the turn could be
  written.

A Stop that names its log does not also report `transcript_path_missing`. A
Stop that names no log still does. With the `copilot_cli_stop_read` kill
switch off, no read runs and Copilot Stops that name their log report
neither. A subagent's own Stop is not counted.

A subagent turn that publishes on its own trace instead of under its parent
reports `source_pair:jsonl_to_spans` with one of these reasons. Each serve
process sends it once per child session and destination. The turn is not
retried, because no later attempt could find the parent link:

- `subagent_parent_ended`: the parent session ended without recording the
  child's launch. A user fork of an ended session looks the same.
- `subagent_parent_read_budget`: Trajectory may not read the parent's session
  file again, so it can never find the launch.
- `subagent_parent_reviewer`: the child is an automated reviewer, such as a
  Codex auto-review, that its client starts without a launch in the parent.

Session-end reconciliation reports `reconciliation_unaligned` when it cannot
align a captured turn with the transcript. This reason keeps its name after
health-record sanitization.

### Publish attempts

`trajectory.instrumentation.publish.attempt` counts workflow attempts. It does
not count unique records, lost data, or intake requests. Report pending work
separately from successful and failed attempts.

Metrics that go through the metric outbox are counted twice, once per step. A
publish that queued rows records the handoff as `pending`. Each pass of
serve's drain owner then records one attempt for each destination whose rows
it claimed or left waiting. The attempt is `success` or one of the failures
below. A pass that found nothing to send records nothing.

| Case | `outcome` | Other tags |
|---|---|---|
| A publish queued metric rows in the outbox | `pending` | `error_class:none`, `reason:metric_delivery_pending` |
| A drain pass sent a destination's claimed rows | `success` | `reason:none` |
| A drain pass left failed rows, or the transport's last request hit a credential, HTTP, timeout, or uncertain-delivery error | `failure` | The transport's last error picks `error_class` and `reason` |
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

A `pending` attempt is the handoff: the rows are stored, and the outbox owns
their delivery and retries. The publish operation succeeds, so a delivery
failure never runs a session end or turn end again. The drain's attempt for
the destination reports the delivery.

Rows that report `reason:metric_delivery_deferred` or `reason:policy_disabled`
were not rejected. They stay in the outbox and send on a later pass, or once
the setting changes. `reason:publish_internal_error` remains for errors that
Trajectory does not recognize.

The `datadog_agent` destination has no metric transport. Actual evaluation
errors on that path still report as failures. Both `datadog_agent` and its
older spelling `dd_llmobs_via_agent` report `destination_type:datadog_agent`.
Older binaries reported them as `custom`. These records stay local when the
destination cannot export health metrics.

Incremental turn publishing sends the same attempt records as other
publishing, for each output it actually calls. An empty metric change
sends no attempt. A successful call can still do nothing after eligibility and
duplicate checks. A success does not show that an intake request was made or
that the data was indexed. Counts go up after an upgrade from versions that
reported only credential failures for incremental publishing.

Publish attempts use the client identity saved at session start. A missing
session context reports `unknown`. Trajectory does not look at other active
sessions or saved transcripts to fill it in. Event Platform event streams and
AI Usage outputs report `signal:record`. Other module-specific signals report
`unknown`.

### Native OTLP forwarding

Trajectory serve can forward native `/v1/metrics`, `/v1/traces`, and
`/v1/logs` requests on a best-effort basis. The forwarder also sends
`publish.attempt`.

- Select `component:serve,destination_type:otlp` for the forwarder.
  Publish-engine attempts use `component:publish`.
- Its signals are `metric`, `span`, and `event_log`.
- Client identity and site are `unknown`.
- No payload identity, endpoint, credential, header, or raw error becomes a
  tag.

Each forward sends one attempt count.

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
or model tags, and they do not send another health record for the request. This
keeps health metrics free of session data. It also stops a loop through one or
more native proxies. Requests without the header get normal tags. The header
grants no access and skips no forwarding controls.

Forwarding health uses the same queue as other serve health records. A full
queue cannot delay native intake. Trajectory drops records from a full queue
without saying which producer lost them.

### Capture stalls

`trajectory.instrumentation.watchdog.gap_detected` reports a newly observed
Codex stage older than ten minutes with `component:watchdog`,
`trajectory.client_source:codex`, `signal:watchdog`, and `reason:capture_stage_stuck`.
The observer runs once a minute. Each stage reports once until a later
observation finds no request older than the threshold in that stage. A process
restart clears this local suppression state. Idle and healthy observations
send nothing. The event window records new stalls. Inspect the local
`codex_capture_progress` health snapshot to check whether a stage remains stuck.

The bounded `stage` values are `accepted`, `read_body`, `prepare_body`,
`delivery_coordination`, `worker_wait`, `session_wait`, `terminal_admission`,
`terminal_quiescence`, `context_resolution`, `rollout_lock`, `rollout_reconcile`,
`canonical_capture`, `delivery_receipt`, and `capture_response`.

### Held publish claims

`trajectory.instrumentation.watchdog.gap_detected` with
`{component:publish, trajectory.client_source:unknown, signal:watchdog,
reason:publish_ledger_claim_held}` reports a held final-session publish claim.
The claim stays in the publish ledger long after any live publish could need
it. The trace outbox then retries it without end.

Trajectory sends this point only while the condition lasts. It covers hosts
that export instrumentation health but not serve metrics. The main signals,
which carries the user, is
`trajectory.serve.local_state.publish_ledger_held_claims`.

To recover, run `trajectory publish queue claims`, then
`trajectory publish queue resolve-claim`.

### Dropped health records

Trajectory keeps a local record of health records it could not keep.
`trajectory doctor` and the support flare read it. Trajectory never sends it.
It covers two cases:

- A hook's health record was lost. These records carry `component:hook` and
  `signal:lifecycle`.
- Trajectory removed saved lines that it could not read. These records carry
  `signal:record`.

Each record carries `component`, `signal`, `error_class`, and `reason` tags.
Other lost records appear only in the local log.

| Cause | `error_class/reason` |
|---|---|
| Lock contention | `lock_contention/lock_contended` |
| Other file system error | `internal/storage_io` |
| Hook queue full | `component:hook` with `reason:queue_full` |
| Unreadable saved lines removed | `signal:record` with `validation/schema_mismatch` |

The capture server writes health records from a background queue. It holds
the records a successful hook emits and writes them together. These are
`capture.hook_latency_ms`, the local write-latency record, and a
`capture.hook_event` whose `outcome` is `success`. It writes them when 64 are
held, 15 seconds after the first one, when any other record arrives, or at
shutdown. Every other record, such as a failed delivery, is written at once.

Each held record keeps the time it arrived, in the local buffer and in
Datadog. `trajectory doctor` can count a successful hook up to 15 seconds
late. A crash loses the held records, at most 64. A server that yielded to a
development server writes them when it resumes.

If another writer holds the local buffer, the server waits up to 5 seconds
before it drops the records.

Older releases failed every later write to the local buffer while one saved
line could not be read. Trajectory now skips such a line, and a later write
removes it. These lines are unreadable: malformed JSON before the last line,
a line longer than 64 KiB, and a record that fails validation. An example of
the last is a record with a tag key this version does not know. The value of the `signal:record`
count is the number of lines removed. Records from a newer release stay as
they are: those are records with a metric or tag value this version does not
know. An incomplete last line from an interrupted write is still cut off
without a count.

When a write to the local buffer fails, Trajectory also notes the failure,
its `error_class/reason`, and when it started in
`instrumentation-health.jsonl.append-failure.json`, next to the buffer. A busy
buffer or a cancelled request is not noted. `trajectory doctor` reports
"Local health records" from that note and from the buffer, including
unreadable lines and lines removed in the last 24 hours.

These counts show that Trajectory could not keep local diagnostic records.
They do not show lost captured data or a failed remote delivery. After a local
write fails, Trajectory still tries to send the original health sample. Raw
error text, paths, and record contents never become tags. Drop reports are not
themselves reported again.

Local audit and doctor output show how full the buffer is.

### Batched diagnostic export

Trajectory groups remote health records and sends one OTLP request for each
destination configuration every ten seconds. Records from hooks and from publishing both
use this path.

- Each data point keeps its value, tags, metric type, and source timestamp.
  Batching does not add counts together or merge latency samples.
- Destinations stay separate even when they share an intake URL. Each keeps
  its own credential and policy.
- When a session becomes private, Trajectory also stops its older samples that
  are still waiting.
- Trajectory checks session and global incognito again before it sends.

The local buffer gets each record before the remote send. The capture server
first holds the records of a successful hook for up to 15 seconds, as
[Dropped health records](#dropped-health-records)
describes. Waiting remote work stays
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
- after the serve of an older release installs an update and runs this
  repair on the new binary

Each repair writes one record to the local health buffer. `trajectory doctor`
and the support flare read it. Trajectory never sends it.

The record's tags are `trigger`, `result_status`, `process_status`, `handoff_mode`,
`outcome`, and `reason`, plus fixed `component` and `signal` values. They hold
no path, PID, session identity, plugin output, or error text.

`handoff_mode` is how the repair restarted serve:

- `forced_restart`: it stopped serve and started it from the installed binary.
- `nuclear_process_replacement`: it stopped every Trajectory process of the
  user, as a forced repair does, and started serve.
- `nuclear_reconcile_contended`: another forced repair was already running,
  so this one stopped nothing.

It is `none` when the repair did not restart serve. Records that older
releases queued can also carry `background_runtime_asset_worker`,
`pending_agent_adoption`, `adopter_lost`, `deferred_natural_exit`,
`seamless_reexec`, `automatic_orphan_adoption`, `no_client_adoption`,
`successor_deferred_natural_exit`, `fenced_independent`, or
`fenced_independent_resumed`. Any other value reports as `unknown`.

| Situation | Tags |
|---|---|
| The owner has active sessions | `process_status:active_sessions_deferred` |
| Automatic restarts are off, for example with `TRAJECTORY_UPDATE_RECONCILE_PROCESSES=0` | `process_status:disabled`, `outcome:skipped` |

Records that older releases queued can also report
`process_status:activation_pending`, with `reason:update_activation_pending`
when a healthy older owner waited to exit.

When a repair finds a lifecycle failure or a safe delay,
`trajectory.instrumentation.lifecycle.incident` sends one count. Its `reason`
is the same incident code that `trajectory doctor` and
`diagnostics/lifecycle.json` show. `component`, `signal`, `trigger`, and
`outcome` let you group incidents across the fleet. The metric holds no local
path, PID, session identity, raw error, or user content. Counts are incidents
or attempts, not unique affected users. To investigate one host, use the code
to request a redacted flare.

### Fleet update heartbeat

The elected serve owner sends these gauges at most once an hour. They go to
every Datadog destination that takes metrics, whatever its marker settings.
[Serve, fleet, and updates](../METRICS.md#serve-fleet-and-updates) gives the rule.
If no destination can take them, serve tries again 10 minutes later and logs
`deployment heartbeat: not sent` at most once an hour.

| Metric | Value | Tags |
|---|---|---|
| `trajectory.ops.binary.heartbeat` | The number of fresh running processes, or `1` for the installed state | `managed`, `cohort`, `binary_state` (`running` or `installed`), `version`; the `binary_state:running` point also has `egress_route` (`proxy`, `direct` or `direct_fallback`, for that destination's intake) and `proxy_source` (`none` or `environment`); it also keeps `os.version`, the one metric that does |
| `trajectory.ops.update.state` | `1` for the update state of the computer | `role`, `owner`, `managed`, `cohort`, `ring`, `floor`, `auto_update`, `installed_version`, `running_version`, `ring_version`, `check_freshness`, `state`, `configuration_profiles`; [Update state](#update-state) describes them |

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

Version values are cleaned and come from fixed formats. The fleet tags hold no
PID, session, path, user, or rollout identity. Like every serve metric, the
gauges also carry the standard identity tags, such as the user. They also
carry the `tags` from your configuration, managed settings, and destination. Query them as gauges with an
hourly `max` rollup over at least four hours. Do not use `.as_count()`. It
turns repeated gauge samples into false growth.

#### Update state

`trajectory.ops.update.state` says how the computer follows its release ring
and version floor. No feature flag controls it.

| Tag | Values | Source |
|---|---|---|
| `ring` | `stable`, `beta`, `bravehearts` | `deployment.ring`, or `stable` when it names no ring |
| `floor` | A release version, or `none` | `deployment.minimum_version` |
| `auto_update` | `on`, `off` | Whether serve runs `trajectory update` every hour. `TRAJECTORY_AUTO_UPDATE=0` or a disabled `automatic_self_update` feature turns it off. Otherwise `auto_update` decides, and it is off by default on a managed Mac. |
| `installed_version` | A cleaned version, or `unknown` | The version the installed binary reports |
| `running_version` | Cleaned versions joined with `+` | The versions of the home's live serve processes. More than one version means an old serve process still runs beside the new one. |
| `ring_version` | A release version, or `unknown` | The release the current ring named in the last result of the update timer. A result from another ring does not count. |
| `check_freshness` | `current`, `stale` | `current` when the update timer's last result is less than 90 minutes old |
| `state` | `current`, `behind`, `below_floor`, `ring_below_floor` | The comparison below |
| `configuration_profiles` | `none`, `one`, `several`, `unknown` | How many Trajectory configuration profiles MDM installed on the computer. `several` means the computer is in more than one deployment's scope. |

`state` compares the versions it knows. A comparison that needs an `unknown`
version does not apply.

- `ring_below_floor`: the ring's release is below the floor, so no update can
  reach the floor. Put a newer release in the list or lower the floor. This comes first,
  whatever the installed release is.
- `below_floor`: the installed release is below the floor. `trajectory
  install` and `trajectory update` update it, even with automatic updates off.
- `behind`: automatic updates are off and the ring names a newer release than
  the installed one.
- `current`: none of the above.

So `state:current` with `ring_version:unknown` or `check_freshness:stale` was
not compared with the ring. Group or filter by those two tags before you count
a computer as up to date.

The update timer:

- While `auto_update` is `on`, serve runs `trajectory update --source timer
  --format json` as a separate process at most once an hour, across every
  serve process of the home. It reads only the child's exit code and its JSON
  result. Nothing else in serve replaces the binary.
- The child can stop serve to restart it on a new release, so it runs
  detached from serve. It writes its result to `logs/update-timer.json` and
  its errors to `logs/update-timer.log`. The hourly gate records the run
  before the child starts. So the serve that the child starts after an update
  or a rollback waits for the next hour. That serve saves the result the
  child left.
- After each run, serve also retries a client refresh that is due.
- Serve saves the last result it read in the home's state database, so
  `ring_version` and `check_freshness` survive restarts. Nothing reads that
  record to decide what to install.
- A result that names no ring release, such as a `busy` run, keeps the
  release saved before for the same ring.
- Only a child that printed a result counts for `check_freshness`. A child
  that cannot start lets it go `stale`.
- While `auto_update` is `off`, serve never runs the child. `ring_version`
  then keeps what an earlier timer run saw, or is `unknown` when serve has no
  result. So `behind` appears only after a timer run from a time when
  automatic updates were on.

Useful monitors:

- `state:below_floor` for more than two hours.
- `auto_update:on` with `check_freshness:stale`.

To find hosts with a stale org-config sync or a missing required destination,
use `trajectory.ops.org_sync.success_age_seconds` and
`trajectory.ops.required_destination.health`. See the
[query guidance](../METRIC-QUERIES.md).

Return to the [Metrics Reference index](../METRICS.md).

## Serve cost intervals

`trajectory.instrumentation.serve.cpu_seconds_per_hour`, `rss_bytes`,
`read_bytes_per_hour`, `write_bytes_per_hour`, `store_bytes` and `wal_bytes`
are distributions sampled every five minutes.
`trajectory.instrumentation.serve.budget_exceeded` counts intervals that end
with serve over a resource budget. Healthy intervals produce no budget event.
The `activity` tag says which kind of interval was counted:

- An idle interval counts when it is over 36 CPU seconds/hour, 50 MiB/hour
  read or 20 MiB/hour written.
- An active interval counts when the median of the retained active intervals
  is over 180 CPU seconds/hour, 2 GiB/hour read or 500 MiB/hour written. The
  median needs three active intervals, so one busy interval is not counted.
- An idle or active interval counts when serve holds more than 1 GiB of
  resident memory.

The read and write limits apply to each `accounting` kind separately. The
metric has no tag for which budget was exceeded. Compare it with `rss_bytes`
and the rate metrics for the same `activity`. `trajectory doctor` names the
figure on the affected machine. Serve only reports a budget. It never slows or
stops work because of one. The active and memory limits are provisional.

These metrics have a closed set of dimensions: `trajectory.version`, `os`,
`activity`, `history_bucket`, `cache_bucket`, and `client_mix`. Byte rates also
carry `accounting`, and database/WAL levels carry `store`. On Linux the byte
rates report `storage`, `logical` and `transfer`. See
[what each `accounting` value measures](../METRICS.md#resource-use). Unknown enum values
become `unknown`. Unknown stores become `other`. Release versions and `dev`
are accepted. Other version strings become `unknown`.

No host, user, session, path, caller or fingerprint is a metric dimension.
Publishing follows the same privacy and destination settings as other health
metrics. Disconnected installations retain six local intervals, visible in
`trajectory doctor` and serve's `/health`. The local SQLite summary includes
code caller names and statement fingerprints, without SQL text or content.
Statement attribution covers writable SQLite pools. Read-only pools keep
native engine query limits and contribute file sizes without statement pages.
