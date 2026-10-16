# Feature Flags

Trajectory feature flags turn some behavior on or off. Most flags let you try
new behavior before it becomes the default, or turn a change off if it causes a
problem on your computers. This page lists the commands, which setting wins,
and the flags you can use.

## Commands

To see the flags that apply, run:

```bash
trajectory config features list
trajectory config features status file_work_indicators
```

To save a user override in `~/.trajectory/config.yaml`, run:

```bash
trajectory config features enable file_work_indicators
trajectory config features disable file_work_indicators
trajectory config features clear file_work_indicators
```

The same lists are also config keys:

```bash
trajectory config get features.enabled
trajectory config get features.disabled
trajectory config set features.disabled file_work_indicators
```

After you change a flag, reload long-running `trajectory serve` processes:

```bash
trajectory config reload --yes
```

## Runtime Overrides

`frontier_model_catalog` is a rollout flag that defaults off. It lists AI
Gateway models in the model pickers of Frontier clients. It covers the Codex
and Claude Code `/model` pickers for launches that do not pin a model.

To override flags for one process, use environment variables. Use them for
tests, for emergency kill switches, or for a single launched process:

```bash
TRAJECTORY_ENABLE_FEATURES=flag_a,flag_b trajectory ...
TRAJECTORY_DISABLE_FEATURES=flag_a,flag_b trajectory ...
```

These rules decide which setting wins:

- If a flag is in both the enabled and the disabled list, disabled wins.
- A disable in the managed `config.defaults.yaml` wins over user config. So a
  user cannot turn on a feature that an admin turned off.
- Managed flags with security protection ignore environment overrides. The
  registry entry of each such flag says so.

## Registered Flags

`setup_debug_instructions` defaults on. Setup writes local debugging
instructions for agents under the Trajectory home and records the files it
owns. Later setup runs refresh owned files that you did not change, and keep
your edits. If you turn the flag off, setup skips the instructions and leaves
existing files alone. The instructions point to the user guide of the
installed binary. They register no global skills.

`automatic_task_segmentation` defaults off. It is the only switch for
automatic task segmentation and task metrics. While it is off, these things
happen:

- Serve starts no segmentation of any kind: incremental, at session end, in
  recovery, or in historical catch-up.
- Serve makes no segmentation LLM calls and uses no segmentation budget.
- Serve writes no `task_segments` rows.
- Session end and terminal recovery skip their time budgets for segmentation.
- No `trajectory.task.*` metrics publish from live sessions or from managed
  task backfill.

`segmentation.enabled`, `segmentation.interval`, and
`segmentation.publish_metrics` apply only when the flag is on. So managed or
org defaults that set them cannot turn segmentation on alone.

Task metric rows that are already in the metric outbox stay there. Trajectory
neither sends nor deletes them, and sends them if you turn the flag on later.
If a config reload turns the flag off, Trajectory holds the rows before the old
publish engine finishes sending.

When the flag is off, backfill and `trajectory publish history` leave out task
metrics. A session they publish then is not published again after you turn
the flag on. The diagnostic
`trajectory publish metrics canary --zero-task-score-probe` still sends its
probe.

Explicit `trajectory segment` and `trajectory patterns analyze --yes` runs are
direct user actions. They do not need the flag. See
[task metrics](metrics/task-metrics.md).

`pi_history_backfill` defaults off. When it is on, serve imports idle Pi files
that were never captured into the local catalog. It does this in small
background batches. It does not rewrite captured sessions, invent a session
end, or start historical publishing. Managed and environment disables win. A
config reload stops the import worker and waits for it to finish. See
[Pi history coverage](CLIENT-INSTRUMENTATION.md#pi) for discovery limits,
one-time import rules, and the files it skips.

Fleet destination-health and org-sync-age metrics are diagnostics that always
run on managed hosts where they apply. The former
`fleet_destination_health_metrics` flag is removed, and Trajectory ignores old
overrides. The normal metric destination and privacy controls still apply.

Each process reuses one shared metric outbox connection pool. The former
`metric_outbox_pooling` flag is removed, and Trajectory ignores old overrides.

Incognito sessions always publish metrics through `export.incognito_metrics`,
and shutdown always drains the metric outbox with its graceful budget. The
former `incognito_metric_disclosure` and `graceful_metric_outbox_drain` flags
are removed, and Trajectory ignores old overrides.

`unified_backfill_workflow` defaults on and no longer gates anything:
`trajectory backfill` always runs. The name stays registered so that scripts
and managed settings that check or set it keep working.

Backfill republication is always available. The former
`historical_metric_replay` flag is removed, and Trajectory ignores old
overrides. A destination stops backfill with `backfill_opt_out: true`. The
automatic Agent Console reconciliation keeps its
`agent_console_durable_backfill` gate.

The former `cost_source_hygiene` and `unified_launch_surface` flags are
removed, and Trajectory ignores old overrides. No code read either flag, so the
removal changes no behavior.

The former `cost_fidelity_heartbeat` flag is removed with the managed cost
fidelity heartbeat, and Trajectory ignores old overrides.

Account billing metadata, parented subagent traces, conditional and command
publish tags, and managed operational logs no longer have a flag. The former
`account_billing_metadata`, `parented_subagent_traces`, `publish_tag_resolvers`,
and `operational_log_publishing` flags are removed, and Trajectory ignores old
overrides.

The former `efficiency_shadow_observer` flag is removed with the efficiency
observer it controlled. Trajectory ignores old overrides. Trajectory no longer
records efficiency findings. The local cache deletes them when it migrates to
generation 43 or later.

`trajectory claude` always sets up Claude Code's native OTLP route. Cursor
setup always marks its hooks with the Desktop surface, and
`trajectory cursor-agent --print` always binds the print result. The former
`claude_native_otlp_interposer`, `cursor_desktop_surface_marker`, and
`cursor_print_result_binding` flags are removed, and Trajectory ignores old
overrides.

The former `live_in_turn_metrics` flag is removed with live in-turn metrics,
and Trajectory ignores old overrides. It defaulted off. Trajectory no longer
publishes `trajectory.live.*` metrics. Nothing opens the
`state/live-progress.sqlite` database that the feature kept.

Trajectory leaves that file in place. An older serve process on another port
can share the home and still use it. You can delete the file by hand once no
such process runs. Metric rows that the feature already queued are still sent.

Task metrics always use the current task projection, serve always runs publish
dedup ledger retention, and `trajectory flare --heap-profile` always works.
The former `task_segmentation_metrics_v3`, `publish_ledger_retention`, and
`heap_profile_flare` flags are removed, and Trajectory ignores old overrides.
`automatic_task_segmentation` still decides whether task metrics publish.

The former `cost_guidance` and `personal_cost_guard` flags are removed with
Agent Cost Guidance and Personal Cost Guard. Trajectory ignores old overrides.
Both defaulted off.

The former `fossilized_user_config_migration`, `seamless_update_handoff`,
`automatic_empty_owner_recovery`, and `request_prompt_metrics` flags are
removed, and Trajectory ignores old overrides. All four defaulted on, so
default behavior does not change.
`TRAJECTORY_UPDATE_RECONCILE_PROCESSES=false` still turns off the automatic
update handoff for one process.

The former `enhanced_segmentation_classification`,
`two_pass_segmentation_classification`, and `task_meta_segmentation` flags are
removed, and Trajectory ignores old overrides. All three defaulted off, so
default task segmentation is unchanged. Confirmed
`trajectory patterns analyze` runs still write turn labels and Work Insights
labels under `patterns_analysis_backfill`.

Seven `metric_samples_*` selections each control one kept distribution sample.
They default on today, so current users keep getting the samples. A later
release can change the default to off.

| Selection | Distribution |
| --- | --- |
| `metric_samples_turn_cost` | `trajectory.turn.cost.usd.total` |
| `metric_samples_session_cost` | `trajectory.session.cost.usd.total` |
| `metric_samples_turn_duration` | `trajectory.turn.duration_ms.total` |
| `metric_samples_skill_duration` | `trajectory.turn.skill_duration_ms.total` |
| `metric_samples_skill_tool_uses` | `trajectory.turn.skill_tool_uses.total` |
| `metric_samples_skill_distinct_tools` | `trajectory.turn.skill_distinct_tools.total` |
| `metric_samples_oversight_duration` | `trajectory.oversight.duration_ms.total` |

These rules apply to the selections:

- They never gate additive totals, and they never turn on a destination.
- The usual export, privacy, and source rules still apply.
- A managed disable wins over a user enable.
- A config reload also applies the selection to samples that wait in the
  outbox.
- Samples dropped while a selection is off are gone. If you turn it back on,
  new samples are sent. Trajectory does not rebuild the period when it was off.
  It does not resend samples that it admitted earlier.
- Sometimes Trajectory cannot tell whether Datadog accepted a sample. The
  usual failure and repair rules then apply.

`instrumentation_health_batching` is a temporary rollout kill switch that
defaults on. It covers best-effort requests for diagnostic metrics. It groups
the data points by destination every ten seconds. It keeps a limited number of
pending records, and it sends a best-effort final batch at shutdown.

If you turn it off, Trajectory sends each request on its own again. Batching
does not change metric values or privacy rules. A crash loses up to ten
seconds of remote samples that wait to be sent. A failed request loses its
batch for that destination. The local record stays in both cases. See
[instrumentation-health export](metrics/instrumentation-health-metrics.md#batched-diagnostic-export).

`otlp_metric_outbox` is a temporary rollout flag that defaults on. It covers
metrics for OpenTelemetry collector destinations (`type: otlp`). While it is
on, those metrics skip the in-memory OTel exporter. They go through the
metric outbox in the local SQLite database that Datadog destinations use:

- They survive a restart or a collector outage and are retried.
- Backfill keeps each point's original time, and corrections reach the
  collector.
- The wire shape matches Datadog's: delta temporality, a timestamp on every
  point, and exponential histograms. The resource carries `service.name` and
  `service.version`, and no Datadog header is sent.
- The in-memory exporter stops for that collector, so nothing is sent twice.
- Late corrections reach the collector as signed changes at the turn's time.
  Datadog instead replaces the corrected point, which a collector cannot do.
- A session may already be running when you turn the flag on. It keeps the
  turns the in-memory exporter sent, and the outbox does not send them again.
- Collector rows waiting to send, including rows waiting for a retry, get a
  quarter of the outbox size limit. When they hold more and the outbox is
  full, the oldest collector rows are dropped first. So a collector that is
  down cannot push out Datadog rows. Sweeps drain Datadog destinations before
  collectors.

If you turn the flag off, collectors use the in-memory exporter again. In a
session that is still running, the exporter skips the turns the outbox already
sent. Rows already queued for a collector stay in the outbox and send once the
flag is on again. Size pruning can still drop them. Agent Security metrics for a
collector use the outbox whatever the flag says. The flag stays for one
release as a kill switch.

`agent_security_incremental_staging` is a temporary rollout kill switch that
defaults on. When a session's Agent Security records only grew since its last
publish, Trajectory stages and sends only the new records. It adds them to the
session totals it kept. The metrics it sends are the same either way. If you
turn the flag off, Trajectory stages every changed session in full again on
every publish, as before.

In resumed sessions of Claude Code and every other hook client, the previous
generation can still hold its finalization lock at session end. Serve then
saves the resumed `SessionStart` to disk, answers the hook at once, and
captures the event when the lock is released. At startup, serve replays saved
events that an earlier process confirmed but did not finish. If serve cannot
save the event, it keeps it in memory, and the event is lost if serve exits
before capture. Hooks never wait for the lock. The former
`claude_session_start_async_admission` flag is removed, and Trajectory ignores
old overrides.

`claude_session_end_http_follows_capture` is a temporary rollout kill switch
that defaults on. It covers the installed Claude Code hooks. While capture is
off for Claude, these commands leave the native HTTP `SessionEnd` handler out
of the plugin:

- setup
- runtime asset reconciliation
- the commands that turn capture off and on

This way, Claude does not report a refused connection on exit. When capture is
on again, the handler comes back. If you turn the flag off, the handler stays
in every state.

`claude_resumed_event_queue` is a temporary rollout kill switch that defaults
on. It covers the order of events in resumed sessions of Claude Code and every
other hook client. In two cases, serve queues the other hook events of the
session:

- A resumed `SessionStart` is pending.
- The file ends in a `session_end` whose finalizer still holds the session
  lock.

Serve answers the hooks at once. It captures the events in order, with the
time it admitted them, once it records the start of the resumed session. If
you turn the flag off, serve captures events directly again. It can then write
resumed events after the `session_end` of the previous generation. Replay at
startup still empties existing queues.

`claude_native_trace_enrichment` is a temporary rollout kill switch that
defaults on. It covers native tool timing for Claude Code. Running
`trajectory claude` is the opt-in that relays native traces. The feature adds
data only to destinations that already receive the session, so it defaults on.
It does three things:

- It writes one `native_tool_timing` event for each native tool call.
- It holds the publication of a Claude turn for at most 60 seconds while native
  spans arrive for that session.
- It adds the time spent waiting for permission to tool spans.

If you turn it off, the writes and the hold stop. Recorded events stay out of
published spans.

`cursor_copilot_hook_helper` is a temporary rollout flag that defaults on.
When it is on, setup writes Cursor and GitHub Copilot command hooks on macOS
and Linux. These hooks run the small embedded hook helper that Codex already
uses. They do not start the full `trajectory` binary for every event. Existing
installations get the new hooks the next time Trajectory rewrites them: when
setup runs, or at the client integration refresh after an update.

For a healthy hook, the helper posts to serve with the same payload, delivery
ID, and hook outcome record as `capture-hook`. In these cases, it runs the full
binary in the foreground with the payload of the hook:

- Serve is down or refuses the hook.
- Capture is off.
- A runtime activation is pending.
- The session has handed-off events.
- The helper does not accept the payload.

A hook command uses the full binary when no helper generation is installed.
To turn the helper off, run
`trajectory config features disable cursor_copilot_hook_helper`, then run setup
again for the client.
`TRAJECTORY_DISABLE_FEATURES=cursor_copilot_hook_helper` also sends an
installed hook that uses the helper straight to the full binary. One
difference remains. CLI command telemetry does not count a hook that the helper
delivers as a `capture-hook` start. Codex hooks work the same way today.

`claude_turn_token_settle` is a temporary rollout control for Claude Code turn
token metrics. It defaults on. When it is on, Trajectory holds each turn until
it checks the token usage against the transcript. The check happens at the
first of these events:

- the next prompt
- a transcript that stops changing
- session end
- a deadline of at most 5 minutes

So the first published value matches the transcript and has the turn
completion time. Session end then adds no correction rows for settled turns.
If you turn the flag off, Trajectory again publishes the provisional usage from
the Stop hook at once. In both cases, reconciliation at session end matches
turns by prompt. See
[Claude Code turn token settle](metrics/per-turn-metrics.md#claude-code-turn-token-settle).

The per-request prompt size distribution, which includes cache tokens, always
publishes. See [per-request prompt size](metrics/per-turn-metrics.md#per-request-prompt-size)
for coverage, deduplication, and percentile queries.

`reliable_metric_retry` defaults on. Sometimes Trajectory cannot tell whether
Datadog accepted a metric submission. This flag retries those submissions in a
limited number of rounds, and it saves them to disk between rounds. A disable
in managed config or the environment still works as a kill switch. It stops
the attempts and keeps the pending retries.

Trajectory takes flag names, defaults, control restrictions, and short
descriptions from the flag registry in the binary. To see them, run:

```bash
trajectory config features list
trajectory config features list --json
trajectory config features status <flag>
```

The CLI reads the flag list from the binary, so its list is always current.

An explicit `trajectory patterns analyze --yes` run acts with the authority of
the user. It does not check or use the automation budget. Automatic
segmentation and backfill still use their documented budgets.

AI-EDR availability depends on the version:

- `agent_security_ai_edr` is still on as a compatibility marker for releases
  through v0.5.36.
- Current binaries allow AI-EDR only through the `agent_security_ai_edr_v2`
  flag. That flag defaults off, is managed-only, and ignores environment
  overrides.
- Neither flag turns on the module, installs hooks, selects the evaluator mode,
  or overrides destination publishing gates.

`otlp_conventions_trace_shape` is a default-off temporary rollout control for
generic `otlp` destinations that do not set `trace_shape`. When enabled, their
turn traces use the conventions-first OpenTelemetry GenAI shape instead of the
Datadog LLM Observability intake shape. An explicit per-destination
`trace_shape` always wins, and Datadog destinations always keep the Datadog
shape. See [OTLP destinations](PUBLISH.md#otlp).

`trace_request_metadata_copies_removed` is a temporary rollout kill switch
that defaults on. While it is on, traces no longer carry a
`gen_ai.request.<key>` copy of every span metadata key, and model calls carry
typed `gen_ai.request.max_tokens`, `gen_ai.request.stream` and
`gen_ai.response.finish_reasons`. In Datadog LLM Observability the copies
appeared as `request.<key>` tags next to the `metadata.<key>` tags. A saved
query may still use a `request.<key>` tag. To bring the copies back for
Datadog-shaped traces, turn the flag off in managed defaults, user config, or
`TRAJECTORY_DISABLE_FEATURES`.

`managed_reconcile_backoff` is a temporary rollout kill switch that defaults
on and is managed-only. After three identical failures in a row, the managed
reconcile LaunchAgent waits 5 minutes before its next attempt. The wait doubles
each time, up to 1 hour. Without the flag, it retries every minute.

A profile change, a new release, or a manual `trajectory managed reconcile`
always runs at once. To restore the retry every minute, use one of these:

- set `features.managed_reconcile_backoff` to `false` in the MDM intent
- add a disable to the remote managed defaults
- set `TRAJECTORY_DISABLE_FEATURES`

Status still records the last failure either way. See
[Background reconciliation failures](MANAGED-ENDPOINTS.md#background-reconciliation-failures).

`managed_dropped_client_removal` is a temporary rollout kill switch that
defaults on and is managed-only. An administrator can remove a client from the
managed profile. User reconciliation then removes the Trajectory integration
for that client, if reconciliation set it up. The removal is the same as
`trajectory uninstrument`.

A managed defaults disable or `TRAJECTORY_DISABLE_FEATURES` turns the removal
off. Reconciliation still records which clients it sets up. So if you turn the
flag back on, it removes the clients that were dropped in the meantime. See
[Remove a client from the profile](MANAGED-ENDPOINTS.md#remove-a-client-from-the-profile).

`managed_trajectory_link` is a temporary rollout kill switch that defaults on.
Managed user reconciliation runs setup with the `PATH` that its MDM adapter or
LaunchAgent sets. It does not use the `PATH` of the user's terminal.

While the flag is on, setup in those runs links `~/.local/bin/trajectory` to
the user's `~/.trajectory/bin/trajectory` when that name is free. It never
replaces another entry and never edits shell startup files.

A user config disable, a managed defaults disable, or
`TRAJECTORY_DISABLE_FEATURES` turns it off. Setup then uses its usual step
based on `PATH`, and leaves an existing link in place. The installer's
`remove` operation still deletes the link. See
[Run trajectory in a terminal](MANAGED-ENDPOINTS.md#run-trajectory-in-a-terminal).

`client_shim_terminal_path` is a default-on temporary rollout kill switch.
While it is on, setup decides whether a client command shim is active from the
`PATH` that the user's login shell sets. It does not use the `PATH` setup runs
with. Setup starts that shell as the user, as an interactive login shell
(`-i -l -c`) the way a new Terminal window does. The shell then reads the
user's interactive startup files. On Linux, a desktop terminal starts bash as
an interactive shell that is not a login shell. So for bash on Linux, setup
reads the login profile first. Then it starts an interactive bash, which reads
`~/.bashrc`.
The shell has no terminal, empty input, a fixed
environment, and a 5-second limit, and reports an unknown result as unknown.
It links a shim only into a home bin folder that this `PATH` lists, records
each result for `trajectory managed status`, and `trajectory doctor` runs the
same check. A user config disable, a managed defaults disable, or
`TRAJECTORY_DISABLE_FEATURES` turns it off. Setup then checks its own `PATH`
and starts no login shell. If setup cannot read the flag, for example because
a configuration file is unreadable or is not valid YAML, it treats the flag as
off. See "Route ordinary `claude`, `codex`, and `copilot` commands through
Trajectory" in the [administrator guide](MANAGED-ENDPOINTS.md).

`managed_shell_path_block` is a temporary rollout kill switch that defaults on
and is managed-only. While the managed profile turns on client command shims,
managed setup adds a marked block to the user's shell startup files. The block
puts `~/.trajectory/bin` on `PATH`, so a new terminal runs the wrappers. A
`trajectory setup` that a user runs never adds it.

A user config disable, a managed defaults disable, or
`TRAJECTORY_DISABLE_FEATURES` stops new blocks. Setup still removes a block it
added earlier when the profile option is turned off or the profile is
withdrawn. It also removes it when `trajectory uninstrument` or the
installation script's `remove` operation runs. If setup cannot read the flag,
for example because a configuration file is not valid YAML, it adds no block.
See "Route ordinary `claude`, `codex`, and `copilot` commands through
Trajectory" in the [administrator guide](MANAGED-ENDPOINTS.md).

`managed_late_client_setup` is a temporary rollout kill switch that defaults on
and is managed-only. Managed user status reports a client that the profile
selects, that is installed, but that is not set up. User reconciliation runs
setup for that client. If setup fails, it tries again on a growing schedule.

A managed defaults disable or `TRAJECTORY_DISABLE_FEATURES` turns the check
off. Status and reconciliation then rely only on the reconciliation receipt, as
before. See
[Clients installed later](MANAGED-ENDPOINTS.md#clients-installed-later).

`dd_harness_instrumentation` defaults off. It is a single gate for three
surfaces together. The first is the `/capture/dd-harness/capabilities`
and `/capture/dd-harness/batch` routes on `serve`. A disabled flag makes
the owner answer 404. DD Harness's own contract already treats that as
"no safe owner" and retries negotiation every 60s, so agents are
unaffected either way. The second is `trajectory setup --clients
dd-harness`. The third is the retained-history `--from-dd-harness` /
`trajectory session import dd-harness` importer.

It is independent of DD Harness's own per-home `pluginsEnabled` opt-in
(`trajectory` present in DD Harness's own `app-settings.json`). Both must
be true before any envelope flows. DD Harness is deliberately absent from
`setup`'s client catalog, so this flag turning on never makes `setup
--clients all` or auto-instrument select DD Harness. Only an explicit
`--clients dd-harness` does. See [DD Harness
coverage](CLIENT-INSTRUMENTATION.md#dd-harness).


## Qualified PR observation rollout

`qualified_pr_observations` defaults on. It gates
`trajectory.pr.ai_assisted.observations.total` for live sessions and for
historical sessions that you select. If you turn it off, Trajectory holds
queued points and stops new ones. It does not delete source facts or delivery
receipts.

Before you rely on reports built on this metric, query it in Datadog and
confirm that the points arrive. Trajectory still sends the older PR campaign
and the existing session and PR exports. See the
[metric contract](metrics/built-in-marker-metrics.md#qualified-pr-observations).
