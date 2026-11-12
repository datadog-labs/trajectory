## Publish and Serve Health Metrics

These operational metrics help you check a rollout, privacy settings, and
publishing. Trajectory sends them on a best-effort basis.

In the tables below, "serve tags" means the standard tags on metrics from
`trajectory serve`. They include `host`, `os.type`, `trajectory.version`, and
`trajectory.user`. "Fleet tags" means `role`, `owner`, `managed`, and
`cohort`.

### Setup state

| Metric | Type | Tags | What it reports |
|---|---|---|---|
| `trajectory.ops.install.current_state` | gauge | Serve tags plus `managed`, `role`, `outcome`, `reason`, `setup_binary_status`, `setup_binary_version`, `management_provider` | The managed setup summary |
| `trajectory.ops.install.agent_state` | gauge | Serve tags plus `client_source`, `trajectory.client_source`, `agent_status`, `setup_outcome`, `setup_stage`, `setup_component`, `setup_capture_path`, `setup_next_step`, `reason`, `setup_binary_status`, `setup_binary_version`, `management_provider` | Setup state for each selected client |
| `trajectory.ops.install.auto_instrument_state` | gauge | Serve tags plus `install_owner`, `managed`, `auto_instrument_enabled`, `apply_enabled`, `allow_clients_configured`, `clients_hooked`, `publish_configured`, `reason` | Whether auto-instrument capture is ready on each managed publishing host |

#### Managed setup gauges

Trajectory sends `current_state` and `agent_state` only after
`trajectory setup --managed-keychain` verifies the install. It does not
refresh them on a schedule.

`current_state` sends `1` for the current state. When the setup state changes,
it sends `0` for each earlier state. Dashboards can then filter on the latest
state.

`agent_state` separates registration failures from verification failures. It
also shows fallback capture paths, such as the MCP watcher fallback. These tags
explain the state:

| Tag | Values |
|---|---|
| `setup_stage` | `registration`: the client setup command failed before it wrote or registered files. `verification`: setup finished, but the installed configuration does not work. `fallback`: capture runs through a lower-quality fallback. `configured`: the integration is fully verified. |
| `setup_component` | The part that failed, such as `mcp_config`, `hooks_config`, `plugin_marketplace`, `plugin_install`, `wrapper_metadata`, `client_runtime`, or `sdk_extension` |
| `setup_next_step` | A fix code, such as `rerun_setup_client`, `install_client_then_rerun_setup`, `fix_permissions_then_rerun_setup`, `install_node_or_reinstall_client`, or `ensure_trajectory_bin_first_on_path` |

#### Management provider

`management_provider` names the device-management service behind a managed
setup. Both setup gauges always carry it. No separate feature flag controls
it. The gauges report only through the existing managed metrics destination,
credential, and privacy controls.

Setup reads the value from the `managed status` check that its binary
verification already runs. Each point therefore reflects that run. Setup does
not reuse a saved result.

| Result of setup verification | `management_provider` |
|---|---|
| Policy layer is `compliant` with a supported provider ID, such as `jamf`, `intune`, or `workspace_one` | That provider ID |
| Policy layer is `compliant` with any other valid provider ID | `other` |
| Policy layer is not `compliant` (`pending_policy`, `failed`, `drifted`, or `blocked`), the provider is empty, the status is unavailable, or no managed install receipt exists | `unknown` |

`unknown` means setup could not find the provider. It does not mean the device
is unmanaged.

The provider reflects only the policy layer. For example, a verified Jamf
policy with a failed user layer reports `management_provider:jamf` with
`setup_binary_status:failed`. Managed verification reads install receipts on
macOS only, so other platforms report `unknown`.

When the provider changes, Trajectory sends one `0` point for the previous
series. The first run after an upgrade from a build without this tag ends the
untagged series the same way.

#### Auto-instrument state

`trajectory.ops.install.auto_instrument_state` sends `1` only when the latest
saved reconciliation receipt shows one thing. At least one detected, allowed
client must have every required capability configured. Policy intent alone
never counts as healthy.

It sends `0` when the host publishes but does not capture. The `reason` tag
then names the first check that failed. `ready_with_drift` still sends `1`,
but it warns that a partial repair is needed.

Trajectory sends this gauge at these times:

- after `setup auto-instrument apply` saves its receipt, even without the
  serve process
- after the reconciler in `trajectory serve` runs
- with each serve heartbeat

While serve runs, it checks the saved result every minute. It publishes only
when the value or the tags change.

A `serve` started with `TRAJECTORY_DISABLED=1` sends nothing. It stops before
it loads publish credentials. On that host, only the apply path sends the
gauge.

Trajectory sends the gauge only on hosts with a managed owner that can reach a
metric destination. Either the user configuration publishes, or the managed
policy has a metrics destination. The second case keeps `--managed-keychain`
hosts in scope. This is true even though setup writes `traces: off` and
`metrics: false` for them. The scope and the result use the same capture-gap
check as `trajectory doctor`.

The `reason` tag has these values:

- `ready`: an observed client is configured.
- `ready_with_drift`: one observed client is configured, but another client
  or the latest repair is unhealthy.
- A capture-gap code: `capture_disabled`, `managed_policy_disabled`,
  `disabled_by_user_config`, `no_allowed_clients`, `apply_disabled`,
  `deny_cancels_allow`, `all_clients_feature_gated`,
  `reconcile_status_unavailable`, `no_detected_clients`, `setup_drift`,
  `repair_failed`, or `no_configured_clients`.

`capture_disabled` means the host has hooks installed, but
`trajectory config capture disable` stops every event. The host captures
nothing, whatever the policy says.

`TRAJECTORY_DISABLED=1` on one process does not change the result. Otherwise
the host's series would switch between senders. A `serve` in that mode sends
no point at all.

Other tags:

- `clients_hooked` is `1_plus` only when the latest saved receipt shows at
  least one detected, allowed client configured. Otherwise it is `0`.
- `auto_instrument_enabled`, `apply_enabled`, `allow_clients_configured`, and
  `publish_configured` are booleans.
- `install_owner` is the managed owner: `jamf`, `mdm`, `managed`, or
  `datadog-managed`.

To find hosts that publish but capture nothing, alert on the following
condition, grouped by `install_owner`:

```text
publish_configured:true AND (auto_instrument_enabled:false OR apply_enabled:false OR clients_hooked:0)
```

### Agent inventory

| Metric | Type | Tags | What it reports |
|---|---|---|---|
| `trajectory.ops.agent.present` | gauge | Serve tags plus `client_source`, `trajectory.client_source` | Once a day: `1` if a supported coding agent is installed on the machine, `0` if it is not |
| `trajectory.ops.agent.version` | gauge | Serve tags plus `client_source`, `trajectory.client_source`, `client_version`, `trajectory.client_version`, `version_source`. Desktop clients also add `app_version`, `trajectory.app_version`, `app_version_source`, `app_version_disposition`. | Once a day: `1` for each detected client, with its installed version |
| `trajectory.ops.agent.active_sessions` | gauge | Serve tags plus `client_source`, `trajectory.client_source` | Once an hour: the number of fresh active sessions for each client |
| `trajectory.ops.agent.active_session_version` | gauge | Serve tags plus `client_source`, `trajectory.client_source`, `client_version`, `trajectory.client_version`, `version_source`, and `app_version` and `trajectory.app_version` when captured | Once an hour: the number of active sessions for each client version |
| `trajectory.inventory.extension.installed` | gauge | `extension_name`, `extension_version`, `extension_kind`, `client_source`, `session_id`, `session_start_reason` | One point for each installed extension, plugin, or MCP server at session start |

`agent.present` covers every coding agent that Trajectory supports. This
includes clients that setup manages and clients that Trajectory sees only at
run time, such as `codex-app` and `openclaw`. Aliases such as `cc` report as
`claude-code`. Cursor Desktop and `cursor-agent` both report as `cursor`.

For `agent.version`, `client_version` is the semantic version from the
client's command-line tool. It is `unknown` when that version is not
available. Claude Desktop and Codex Desktop use their application bundle
version as the client version too. Cursor keeps its command-line version
separate. Bundle reads have limits and report a fixed result code in
`app_version_disposition`.

`agent.active_sessions` counts each session once, even when several
`trajectory serve` processes run. Each process writes heartbeat files that
Trajectory uses to remove duplicates. Known clients with no fresh active
sessions report `0`.

`agent.active_session_version` uses the session-start state saved in the
heartbeat files. A missing version reports as `client_version:unknown`.

For `inventory.extension.installed`, `extension_version` is `unknown` when the
client does not report it.

### CLI and MCP usage

| Metric | Type | Tags | What it reports |
|---|---|---|---|
| `trajectory.ops.cli.command.started` | count | `trajectory.command`, `trajectory.command_class`, `trajectory.invocation_mode`, `trajectory.distribution`, `trajectory.version`, `host`, `os.type`, and metric-catalog tags | One count just before a CLI command runs |
| `trajectory.ops.mcp.tool.started` | count | `trajectory.mcp_tool`, `trajectory.mcp_tool_class`, `trajectory.mcp_transport`, `trajectory.version`, `host`, `os.type`, and metric-catalog tags | One count before a registered MCP tool handler runs |
| `trajectory.ops.mcp.tool.completed` | count | MCP tool tags plus `trajectory.mcp_outcome` | One count when the handler ends, as `success`, `tool_error`, `handler_error`, `canceled`, or `panic` |
| `trajectory.ops.mcp.tool.duration_ms` | distribution | MCP tool tags plus `trajectory.mcp_outcome` | How long the registered handler ran |

For `capture-hook`, `hook-dispatch`, and `runtime`, Trajectory adds counts with
the same tags into one-minute rows. Other commands keep one row for each run.
Hook processes write to a local file without locks. The serve process then
adds those entries into one-minute rows. A hook's background worker is not
counted again.

Recording the MCP completion count and duration does not change the tool's
result, error, cancellation, or panic.

Both families go by default to managed required Datadog destinations that
accept ordinary metrics. Managed policy can limit or turn off this export.

These metrics never include arguments, results, queries, or paths. They also
never include session identity, prompts, errors, credentials, or arbitrary user
tags.

### Destinations and managed configuration

| Metric | Type | Tags | What it reports |
|---|---|---|---|
| `trajectory.ops.required_destination.health` | gauge | Serve tags plus fleet tags, `destination`, `incognito_exempt`, `destination_state` | Whether each required destination is active |
| `trajectory.ops.org_sync.success_age_seconds` | gauge | Serve tags plus fleet tags, `verified`, `sync_status`, `failure_reason`, `failure_scope`, `fetch_error_class`, `http_status_class`, `failure_streak` | Seconds since the last successful managed configuration sync |
| `trajectory.ops.config_migration.heartbeat` | gauge | Deployment heartbeat tags plus `migration_state`, `reason`, `trajectory.version` | Once an hour: the state of managed user-configuration reconciliation. It carries no configuration content. |

The elected serve owner sends `required_destination.health`,
`org_sync.success_age_seconds`, and both `managed_capture` gauges at most once
an hour. No metric-specific feature flag controls them. The normal destination
and privacy controls apply.

#### Required destination health

`trajectory.ops.required_destination.health` has one series for each required
destination name. You can query an inactive destination by name. This
includes traces-only destinations without an opt-out, which
The destination health gauge records policy-required destinations.

The value matches the `Required destinations` result in `trajectory doctor`:

| Value | Meaning | `destination_state` |
|---|---|---|
| `1` | Active in every live serve process | `active` |
| `0` | Not active in at least one live serve process | `missing`, `unavailable`, `config_invalid` |
| `-1` | Trajectory cannot tell | `unobservable`, `uncertain`, `unprojected`, `no_live_serve`, `out_of_scope` |

`-1` means unknown. It does not mean healthy. Alert on `== 0` only. Never
alert on `< 1`.

The `destination_state` values mean:

- `active`: the destination is active.
- `missing`: the destination is absent from a credential list that would
  include it.
- `unavailable`: the destination is present, but Trajectory could not resolve
  its credential.
- `config_invalid`: Trajectory reports `destination:managed_defaults` when it
  cannot load managed defaults. It reports the destination's name when that
  destination's settings were invalid and it skipped the destination.
- `unobservable`: the credential list can never include this destination, so
  its absence shows nothing.
- `uncertain`: the credential list in the live health record was cut short.
- `unprojected`: a live serve process reported no credential list. This
  happens when versions differ.
- `no_live_serve`: no live serve process can be checked.
- `out_of_scope`: only older releases send this value. They sent it for hosts
  whose own `export.*` settings publish nothing. Current releases decide the
  scope from managed authority, because managed destinations publish anyway.

When live processes disagree, the worst state wins. A host with no running
serve process sends nothing. Doctor shows nothing for `out_of_scope`.

#### Managed configuration sync

`trajectory.ops.org_sync.success_age_seconds` reports whole seconds since the
last observed successful managed sync. Trajectory reads this from the success
time only, never from the time of the last attempt.

`-1` means the host has never synced: no success time and no starting value
exist. Trajectory does not use `0` here, because `0` would read as "just
synced". Trajectory sends this metric only where a managed org configuration
is expected.

| Tag | Values |
|---|---|
| `sync_status` | `healthy`, `degraded`, `failing`, `never`, `unverified` |
| `failure_reason` | Separates source, fetch, syntax, validation, backup, write, success-time, multiple, and unknown failures |
| `failure_scope` | The class of managed file that failed |
| `fetch_error_class` | `dns`, `timeout`, `tls`, `connect`, `proxy`, `http_status`, `response_read`, `response_too_large`, `unknown`, `multiple`, `none` |
| `http_status_class` | The HTTP status class, or `none` or `multiple` |
| `failure_streak` | The number of failures in a row, in buckets |
| `verified` | `false` means the value comes from a starting value, not from an observed success |

A `degraded` sync met the core managed requirements, but an optional file
failed. Trajectory still records the success. The cause stays visible in the
tags. The exact HTTP status appears only in the structured operational event.

### Resource use

| Metric | Type | Tags | What it reports |
|---|---|---|---|
| `trajectory.ops.resource.cpu_percent.avg` | gauge | Resource-window tags | Mean CPU over a complete five-minute window aligned to UTC |
| `trajectory.ops.resource.cpu_percent.max` | gauge | Resource-window tags | The largest 15-second CPU interval in the same window |

The runtime sends resource-window metrics behind the default-on
`resource_observation` control. Turning it off stops collection on an endpoint.

For both metrics, 100% is one busy core. Values can be higher than 100%. Use
`max` rollups for `cpu_percent.max`, and never `.as_count()`.

On Apple Silicon Macs, releases up to 0.6.3-beta.5 read the kernel's CPU
counters in the wrong unit and reported about 42 times too little CPU. That
affects these two metrics, `trajectory.ops.resource.exit_remainder_cpu_seconds.total`
and `trajectory.instrumentation.serve.cpu_seconds_per_hour`, tagged
`os.type:darwin` or `os:darwin`. Later releases report the real figure, so a
Mac series steps up at the upgrade. Intel Macs, Linux and Windows were always
right. Compare Mac CPU only between releases after 0.6.3-beta.5.

### Serve process and capture

| Metric | Type | Tags | What it reports |
|---|---|---|---|
| `trajectory.serve.process.start_total` | count | `start_source` | The capture server listener started |
| `trajectory.serve.process.exit_total` | count | `exit_reason`, optional `signal` | The capture server exited normally or with an error, before publishing shut down |
| `trajectory.serve.capture.request_error_total` | count | `client`, `event_type`, `error_kind`, `http_status_class` | A capture HTTP request returned 4xx or 5xx, or the handler failed |
| `trajectory.serve.operational_log.dropped_total` | count | `reason:queue_full` plus serve tags | Operational events dropped because the in-process queue was full |
| `trajectory.serve.goroutine.panic_recovered_total` | count | `goroutine`, `action` | A serve background task panicked and recovered. `action` is `restart` or `give_up`. |

`start_source:rescue_hook` means a hook restarted the listener after it had
stopped. Trajectory cannot record a forced kill directly. A later
`rescue_hook` start shows that one happened.

Trajectory sends `operational_log.dropped_total` on the owner's next
maintenance pass. The events were dropped before Trajectory saved them.

### Local state

Trajectory reads these gauges during the local-state health scan.

| Metric | Type | Tags | What it reports |
|---|---|---|---|
| `trajectory.serve.local_state.live_session_files` | gauge | Serve tags plus `stage`, `warning`, `scan_error` | The number of live-session files, not counting lock files |
| `trajectory.serve.local_state.heartbeat_files` | gauge | Serve tags plus `stage`, `warning`, `scan_error` | The number of active-session heartbeat files |
| `trajectory.serve.local_state.serve_log_bytes` | gauge | Serve tags plus `stage`, `warning`, `scan_error` | The size of `trajectory-serve.log` in bytes |
| `trajectory.serve.local_state.serve_diag_bytes` | gauge | Serve tags plus `stage`, `warning`, `scan_error` | The size of `serve-diag.ndjson` in bytes |
| `trajectory.serve.local_state.publish_ledger_held_claims` | gauge | Serve tags plus `artifact_scope` | Publish claims still held long after any live publish could need them |
| `trajectory.serve.local_state.publish_ledger_held_claims_detail` | gauge | Serve tags plus `artifact_type`, `claim_scope`, `age_bucket`, `hold_reason` | The held claims, split by type, scope, age, and bounded reason, including ambiguous export, unrecorded completion, missing legacy evidence, unverified owner identity, and a disabled reclaimer |
| `trajectory.instrumentation.publish.ledger_recovery` | count | `component:publish`, `signal:final_session`, `outcome`, `reason` | One record for each durable dead-owner reclaim and each first operator-required classification. Repeated retries do not increment it |

#### Held publish claims

The publish ledger stops a session from being published twice. A held claim is
a ledger row that stays claimed long after any live publish could need it.

The serve owner sends `publish_ledger_held_claims` once an hour, whenever the
ledger file exists. It sends the full count with no cap, including a healthy
`0`.

- `artifact_scope:final_session` is the number of orphaned final-session
  claims. You can act on this number.
- `artifact_scope:all` covers every type of held claim.

This check only reads the ledger. A separate maintenance task is on by
default. It completes non-final claims for a single destination that are older
than seven days. It does not release them to be published again.

`publish_ledger_held_claims_detail` splits the same claims:

| Tag | Values |
|---|---|
| `claim_scope` | Separates older whole-session claims from current claims for a single destination |
| `age_bucket` | `30m_to_2h`, `2h_to_1d`, `1d_to_7d`, `7d_plus` |
| `hold_reason` | `ambiguous_export`: the owner saved an uncertain submission. `completion_unrecorded`: the export succeeded, but Trajectory could not record completion locally. `owner_lost_or_legacy`: no result was recorded, or the row comes from an older release. `none`: the healthy final-session zero. |

An older release can still read the ledger and keep publishing. Session,
claim, destination, and path identities are never tags.

To recover, run `trajectory publish queue claims`, then
`trajectory publish queue resolve-claim`.

### Terminal recovery

When a session ends, Trajectory finalizes it. If a step fails, Trajectory keeps
a receipt and retries later. These gauges and counts track that work.

Recovery's cost does not grow with the number of receipts. A receipt gets at
most five attempts. An attempt that its 110-second deadline cuts off counts as
one. Only serve stopping returns an attempt.

A receipt the running serve process wrote in the last six hours is retried
as before. Serve looks every minute and runs one attempt, whatever sessions
are open.

Every other receipt waits for the five-minute look. That covers older
receipts and those a serve process that is gone left. The look runs at most
one attempt, at low disk and CPU priority. While a session is open or a
backfill pass runs, it runs at most once an hour. A host that is never idle
still recovers what a restart or an update left. All serve processes of a home share a limit of
eight failed attempts per UTC day. An attempt that recovers its session does
not count against the eight.

Serve retires a receipt without a further attempt in three cases. The receipt
used its five attempts. Its session's last event is more than 60 days old. Or
its session file is gone. Retiring removes the receipt's registry row and
publishes nothing. The session's incognito records stay. The daily backfill
still sends the session's metrics when the session is inside the backfill
window.

| Metric | Type | Tags | What it reports |
|---|---|---|---|
| `trajectory.serve.terminal_recovery.pending` | gauge | Serve tags plus `feature` | Ended sessions with receipts that still wait for finalization |
| `trajectory.serve.terminal_recovery.pending_detail` | gauge | Serve tags plus `feature`, `reason`, `retry_state`, `age_bucket` | The pending work, split by cause, retry state, and the age of the session's last event |
| `trajectory.serve.terminal_recovery.oldest_age_seconds` | gauge | Serve tags plus `feature` | The age of the oldest pending receipt in each feature |
| `trajectory.serve.terminal_recovery.attempt_total` | count | Serve tags plus `feature`, `outcome` | Recovery attempts that ran for a receipt, and receipts retired without one. `outcome` is `success`, `failure`, `retired_spent` (the receipt used its five attempts), `retired_old` (the session's last event is more than 60 days old), or `retired_no_file` (the session file is gone). |
| `trajectory.serve.terminal_recovery.success_age_seconds` | gauge | Serve tags plus `feature` | Whole seconds since the last successful repair for each feature |

`feature` is `finalization`, `sensitivity`, or `segmentation`. The
`finalization` count includes every pending receipt. The owner sends healthy
zero series on every health sweep, which runs every 10 minutes. Healthy
features report `0` for `oldest_age_seconds`.

`age_bucket` is `under_7d`, `7d_to_30d`, `30d_to_60d`, or `60d_plus`, from the
time of the session's last event. It is `unknown` when the receipt records no
such time, and `none` on the healthy zero series. A `60d_plus` receipt waits
for the next look to retire it.

While a receipt waits, the owner also sends these gauges every minute. It
sends them once more when the last receipt clears. With nothing pending, the
minute check sends nothing and opens no database, so an idle serve sends these
gauges every 10 minutes. If a submission fails, the next minute check sends
it again.

Serve keeps the receipts in memory. A receipt this serve process adds or
clears shows at the next minute check. Serve reads the receipts from disk
again every 10 minutes, so a change that another process makes can take up to
10 minutes to show.

For `pending_detail`, `reason` gives the cause:

- Sensitivity keeps the classifier cause: `timeout`, `auth`, `upstream`, a
  model, configuration, or response category, `storage`, or publisher
  availability.
- Segmentation keeps its provider, storage, or budget cause.
- Generic finalization uses `pending`.

`retry_state` is `ready`, `backoff`, `blocked`, or `exhausted`.

- `blocked` means an automatic retry cannot change the result. A spent
  monthly segmentation budget is one example. A blocked receipt uses no more
  attempts. After you repair or reset the dependency, run a catch-up.
- After an upgrade to a newer recovery policy, receipts from earlier releases
  become `ready` once, with a new, limited budget.
- Healthy zeros use `reason:none,retry_state:none`. When a partition clears,
  the owner sends a final zero for it.
- Session and receipt identities are never tags.

Use `oldest_age_seconds` with `pending_detail` to tell a short retry from a
repair that has stalled or run out of attempts.

For `attempt_total`, Trajectory saves the attempt budget before it starts the
retry. A restart therefore cannot cause an automatic retry loop. Segmentation
gets one automatic retry. Later shared sensitivity attempts skip it, and its
detail reports `retry_state:exhausted`.

For `success_age_seconds`, Trajectory reads a saved success time for each
feature. `-1` means the host has not yet seen a successful automatic repair.
It never means "just repaired". Use it with the pending and attempt metrics.
Together they tell an idle healthy host from a recovery path that has never
succeeded.

### Backfill failures

| Metric | Type | Tags | What it reports |
|---|---|---|---|
| `trajectory.serve.backfill.failure_total` | count | Serve tags plus `stage`, `reason`, `failure_scope`, `error_class`, `http_status_class`, `transport` | A managed backfill step failed, or an outbox drain pass that backfill started saw a failure |

Trajectory counts one failure for each failed step or drain pass. It does not count
each row, destination, or HTTP request. A drain failure can be a submission
error or a local condition that blocks publishing.

`stage` is `config`, `policy`, `engine`, `runtime`, `campaign`,
`task_inference`, or `outbox`. `campaign` is the rolling reconciliation run.

`reason` is one of these values:

- `historical_ingestion_unconfirmed`: the destination opted out of backfill,
  or an older integration reported a confirmation error
- `ledger`
- `destination_unavailable`: no eligible destination exists
- `outbox`
- `timeout_or_canceled`
- `config_invalid`
- `unsupported_engine`
- `other`

Reason tags never include raw errors or paths.

| Tag | Values |
| --- | --- |
| `failure_scope` | `control_plane` for backfill errors. `shared_outbox` for sweeps that backfill started. A shared sweep can also carry live metrics, so its failures do not belong only to backfilled data. |
| `error_class` | From the HTTP status: `authentication` (401), `authorization` (403), `rate_limited` (429), `payload_too_large` (413), `backend_timeout` (408 or 504), `backend_unavailable` (other 5xx), `request_rejected` (other 4xx), and `response_error` (2xx with an error). Without an HTTP status, Trajectory uses publisher or operational classes from a fixed list. Other classes become `other`. Different failures in one sweep become `mixed`. |
| `http_status_class` | `1xx`, `2xx`, `3xx`, `4xx`, `5xx`, `none` (no response), `unknown` (invalid status), or `mixed`. A configuration error does not mean that a backend responded. |
| `transport` | `otlp_metrics`, `dd_metrics_v2`, `dd_distribution_v1`, `none` (no submission), `unknown`, or `mixed`. |

`response_error` includes partial acceptance and response decoding failures.
`mixed` also covers a returned claim or finalization error together with
backend failures.

#### How Trajectory classifies a sweep

The publisher keeps a short failure summary for each transport. It records an
error when it sees one, before the retry policy acts. A later success does not
erase the error or HTTP class. Different causes become `mixed`. Trajectory
reads this summary and the errors that a sweep returns. It does not guess a
failure from row totals.

These cases count as failures:

- a 2xx response that Trajectory cannot parse, or that accepted only part of
  the request, even when the rows count as sent
- a credential or authority lookup failure that returns a queued retry without
  sending it

These cases are not failures: successful responses, normal backoff, budget
delays, and deliberate policy holds or retirement. The `retryable_rows` and
`failed_rows` fields describe what happened to rows. They do not show that a
submission failed.

Count each sweep once. Repeated failures across sweeps are retries, not
separate affected users. When volume changes, compare hosts that run the same
Trajectory version. Backend response bodies, URLs, destination names, and
request IDs never become tags.

The summary uses fixed space and keeps no history of requests. It does not
show that data was finally delivered. Each new sweep starts a new summary. An
old backlog alone is not a new failure. Check the local state and the values in
Datadog separately. A client with no failure metrics can still be unhealthy.

Approving backfill locally does not turn on Historical Metrics Ingestion in
Datadog. It also does not show that Datadog received the historical points.

### Unfinished Codex capture

Local health retains `codex_capture_progress` with per-stage counts and ages.
A request that stays in a stage for more than ten minutes emits one
`trajectory.instrumentation.watchdog.gap_detected{client_source:codex,reason:capture_stage_stuck}`
count with a bounded `stage` tag. A stage reports again only after an observation
below the threshold. Idle processes send no progress samples.

The event marks a new stall. Read the local health snapshot to check whether
the stage remains stuck.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
