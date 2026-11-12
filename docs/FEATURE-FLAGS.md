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

`ai_gateway_claude_setting_sources` is a rollout flag that defaults on. It
applies to Claude Code sessions launched through the AI Gateway. It keeps
Claude Code's user, project, and local settings on. The session then loads
your `CLAUDE.md` files, custom commands, subagents, skills, and MCP servers.
That part applies to Claude Code 2.1.310 or later. The flag also lets these
sessions start when your settings name another provider, API key, or key
helper. The session ignores those settings and uses the AI Gateway. Disable
the flag to turn your settings off in these sessions and to stop the launch
when they set a route or credential. The flag was called
`frontier_claude_setting_sources` before, and the old name still works.

`ai_gateway_model_catalog` is a rollout flag that defaults on. It lists the AI
Gateway models you can use in the Codex and Claude Code `/model` pickers. It
applies to launches that do not pin a provider with `--provider`. Sometimes the
Gateway model list cannot load. If the flag is on only by default, the launch
then starts with the client's own picker and prints a notice. If you enable the
flag yourself, that launch stops instead.
To turn the listing off, run
`trajectory config features disable ai_gateway_model_catalog`. The flag was
called `frontier_model_catalog` before. Settings and commands that use the old
name still work.

`frontier_client_gateway_context` is a rollout flag that defaults on. On
`trajectory claude` and `trajectory codex` Frontier launches, it keeps the AI
Gateway team and `x-dd-tag-*` tags from your native client headers. Claude Code
reads `ANTHROPIC_CUSTOM_HEADERS`. Codex reads its selected provider headers.
Turn it off to send no inherited team or tags. `--gateway-team` still works.

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

`claude_usage_from_client_file` defaults on. A new Claude Code session counts
tokens and cost from Claude Code's own session files, once per response. It no
longer counts what its stops read. Each turn's usage settles two minutes after
it closes. Trajectory reads the flag when a session starts, and the session keeps
that path for life. Turning the flag off affects only later sessions. It is a kill
switch for one release. The same flag covers what Claude Code's native metrics say
about its background requests: only a session on this path reads them.

`open_turn_usage` defaults on. A turn that runs for a long time, or waits on a
question, reaches Datadog before it ends. About every 10 minutes, Trajectory sends
the turn's tokens and cost so far, and the PRs it has opened. With the flag off,
these wait for the turn to end. Trajectory reads the flag each time it looks at a
session, and the usage a turn has already sent stays counted.

`pi_usage_from_client_file` defaults on. A new Pi session counts tokens and cost
from Pi's own session file, once per response. That includes the model calls behind
a compaction, a branch summary or a tool. Each turn's usage settles two minutes
after it closes. Trajectory reads the flag when a session starts, and the session
keeps that path for life. Turning the flag off affects only later sessions. It is
a kill switch for one release.

`claude_native_subagent_output` defaults on. On some Claude Code versions, a
sub-agent's file often holds only an early snapshot of a response's output. Versions
2.1.294 to 2.1.303 did this in our measurements, and 2.1.308 and later did not. When
a session's native metrics match its files on every other count, Trajectory adds the difference in
sub-agent output as its own point, tagged `trajectory.output_source:native`. Turning
it off stops storing native main-thread and sub-agent counts. It is a kill switch for
one release.

`opencode_usage_from_store` defaults on. A new OpenCode session counts tokens and
cost from OpenCode's own store, once per response. It no longer counts what the
plugin delivers, and each turn's usage settles two minutes after it closes. OpenCode
2 doesn't load the plugin, so a new session on that release is captured from its
store and published. The plugin still gives timing and permissions on 1.x.
Trajectory reads the flag when a session starts, and the session keeps that path
for life. Turning the flag off affects only later sessions. It is a kill switch for
one release.

`setup_debug_instructions` defaults on. Setup writes local debugging
instructions for agents under the Trajectory home and records the files it
owns. Later setup runs refresh owned files that you did not change, and keep
your edits. If you turn the flag off, setup skips the instructions and leaves
existing files alone. The instructions point to the user guide of the
installed binary. They register no global skills.

`agent_security_plugin_restore` defaults on. An earlier release could
uninstall the Agent Security plugin from Claude Code when its activation
failed. When your own config still enables Agent Security, the runtime asset
reconcile finds such an install and starts the activation again in the
background. It checks once per release, after the release finishes updating.
It leaves the plugin alone when you uninstalled it yourself with `/plugin`,
removed it with `trajectory plugins security disable --clients cc
--remove-hooks`, or turned Agent Security off with
`trajectory plugins security disable`. If you turn the flag off, Trajectory
leaves the plugin uninstalled.

The former `automatic_task_segmentation` and `agent_console_task_backfill`
flags are removed with automatic task segmentation, and Trajectory ignores old
overrides. Both defaulted off. The capture server never splits sessions into
tasks, and the `segmentation.*` settings are removed too. Task classification
stays available on demand through `trajectory patterns analyze --yes`. See
[LLM capacity](LLM-CAPACITY.md#the-capture-server-makes-no-llm-calls).

Trajectory no longer publishes task metrics. When the metric outbox drains, it
drops task metric rows that an older version left there.

Serve always imports idle Pi files that were never captured into the local
catalog. It does this in small background batches. It does not rewrite
captured sessions, invent a session end, or start historical publishing. The
former `pi_history_backfill` flag is removed, and Trajectory ignores old
overrides. `trajectory config features enable`, `disable`, and `clear` for
that name succeed and change nothing. `trajectory uninstrument pi` saves Pi in
`setup.auto_instrument.deny_clients`, which stops the import.
`trajectory setup --clients pi` removes that entry. The import starts again at
the next `trajectory config reload --yes` or service start. See
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

The former `cost_contract_reconciliation` flag is removed with the
`trajectory cost audit` command it gated, and Trajectory ignores old
overrides. It defaulted off, and the command only read data.

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

The former `btview` flag is removed with the btview viewer, and Trajectory
ignores old overrides. It defaulted off. `trajectory view` opens the local
viewer.

History recovery for Hermes Agent, Amp Code, OpenCode, Kilo Code, and Qwen
Code always runs when the client is installed. The background service reads
the client's saved history to recover sessions that its hooks missed. On a
computer without the client, it does nothing. The former
`<client>_durable_history` flags for these five clients are removed, and
Trajectory ignores old overrides. `trajectory uninstrument <client>` saves
the client in `setup.auto_instrument.deny_clients`, which stops its recovery.
`trajectory setup --clients <client>` removes that entry. Recovery starts
again at the next `trajectory config reload --yes` or service start.

To stop one watcher and keep the client set up, set its variable to `1` when
the service starts. The variables are
`TRAJECTORY_DISABLE_HERMES_HISTORY_WATCHER`,
`TRAJECTORY_DISABLE_AMP_HISTORY_WATCHER`,
`TRAJECTORY_DISABLE_OPENCODE_WATCHER`, `TRAJECTORY_DISABLE_KILO_WATCHER`, and
`TRAJECTORY_DISABLE_QWEN_WATCHER`.

Serve always runs publish dedup ledger retention, and
`trajectory flare --heap-profile` always works. The former
`task_segmentation_metrics_v3`, `publish_ledger_retention`, and
`heap_profile_flare` flags are removed, and Trajectory ignores old overrides.
Trajectory no longer publishes task metrics.

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
removed, and Trajectory ignores old overrides. All three defaulted off.
Confirmed
`trajectory patterns analyze` runs still write turn labels and Work Insights
labels under `patterns_analysis_backfill`.

Six `metric_samples_*` selections each control one kept distribution sample.
They default on today, so current users keep getting the samples. A later
release can change the default to off.

| Selection | Distribution |
| --- | --- |
| `metric_samples_turn_cost` | `trajectory.turn.cost.usd.total` |
| `metric_samples_session_cost` | `trajectory.session.cost.usd.total` |
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

`inherited_proxy_direct_fallback` is a temporary rollout flag that defaults
on. The background service takes its proxy from `HTTPS_PROXY` and `HTTP_PROXY`
in the environment of the process that started it. A coding agent can start
the service with a proxy that runs only during its session. The flag covers
what happens when that proxy is on this machine (`localhost`, `127.0.0.1` or
`::1`) and nothing listens on its port any more:

- The service sends to Datadog, GitHub and your org config source directly.
- It tries the proxy again after one minute. The wait doubles after each
  refusal, up to fifteen minutes.
- When the proxy listens again, the service uses it again.
- `/health` reports `egress_proxy` with `state` `direct_fallback`, and
  `trajectory doctor` warns that the service sends directly.

The service never goes around a proxy on another host. It also keeps using a
proxy that answers, even with an error such as HTTP 407.

If this machine must send everything through a local proxy, turn the flag off
in managed settings. The service then keeps trying the proxy. Its health record
reports `publish_delivery` reason `proxy_unreachable`, and doctor names the
proxy.

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

`claude_direct_hook_start` is a temporary rollout kill switch that defaults on.
It covers the Claude Code hooks for prompts, turn ends, session starts and ends,
permissions, compaction, and subagents on macOS and Linux. With the flag on,
Claude Code starts the Trajectory binary itself for each of these hooks. No
shell runs in between, so a hook starts one process.

If you turn the flag off, the earlier behavior returns on the next hook of
every session, with no setup run and no restart. A session keeps the hooks it
loaded, so the binary reads the flag each time Claude Code starts it for a
hook. With the flag off, it runs the `capture-with-serve.sh` of the plugin the
session loaded. The script runs in the environment the earlier hook set, and
it does the capture. The flag can be off in your `config.yaml`, in your organization's
configuration, or in `TRAJECTORY_DISABLE_FEATURES`. If the plugin folder has no
script, the hook captures directly.

Setup and runtime asset reconciliation also write the earlier hooks while the
flag is off, which run that script through a shell. A Claude Code session
loads them when it starts. Windows and an installation whose binary path holds
a space or another character the shell reads always use those hooks.

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

`copilot_mcp_tool_hook` is a temporary rollout flag that defaults off. When it
is on, setup also registers GitHub Copilot CLI's `preMcpToolCall` hook. That
hook names an MCP tool's server and tool separately. Copilot's tool hooks name
the tool `<server>-<tool>`, which cannot be split when either part has a
hyphen. Capture remembers the pair for the session and adds the MCP server and
tool to the tool events that follow. With the flag off, capture learns the
same pair from the `permissionRequest` hook, which names the tool
`<server>/<tool>`. Either way, the first call of a tool has no server on its
pre event, because Copilot sends both hooks after `PreToolUse`. Run setup for
Copilot again after you change the flag.

`copilot_cli_stop_read` is a temporary rollout control for GitHub Copilot CLI
and Agent Security. It defaults on. Copilot's Stop hook carries no reply, and
Copilot writes the reply to its session log just after the hook starts. While
the flag is on and AI-EDR evaluates Copilot's Stop, the hook reads that log
and gives rules the turn's reply as `event.response`. It waits at most 150 ms
for the log, and never for a subagent's own Stop: Copilot's `subagentStop`
already carries the subagent's reply. A log too large to read in that time
gives its Stop no reply. No shipped rule reads a reply, so the
flag changes no verdict until a managed rule does. AI-EDR stores the reply
with the Stop's record. A destination's disclosure profile decides whether the
records it receives hold the reply: `full`, `curated` and `curated+` keep it,
and `metadata_only` withholds it.

The same flag lets capture read each turn from that log. When Copilot's Stop
reaches the capture server, the server waits for the turn to land in the log.
It waits at most 500 ms, five times Copilot's 100 ms flush interval. It then
writes one `llm_call` record per model request, with its tokens, and the
turn's reply, before the turn's `turn_end`. The `turn_end` gets the turn's
model. The session's next hook waits for that read, so a headless `SessionEnd`
cannot come before the final turn. A request that the native OpenTelemetry
records already hold, by its request ID, is not written again.

A subagent's requests count as the subagent's, as they do for Claude Code
and Cursor, not as the turn's. While the flag is on, a `subagentStop` writes
its `subagent_stop` with `subagent_usage_status: unavailable`. The turn's read
then writes a `subagent_usage_amendment` with the subagent's tokens, which
completes that stop. A subagent whose requests never reach the read keeps
unavailable usage.

If you turn the flag off, the Stop payload is as Copilot sent it. The capture
server then writes the Stop's `turn_end` at once, without the log's model,
reply or tokens:
`trajectory config features disable copilot_cli_stop_read`, or
`TRAJECTORY_DISABLE_FEATURES=copilot_cli_stop_read`.

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

`deferred_live_projection` is a temporary rollout control for the capture
server's disk writes. It defaults on. While no reader such as Studio is
attached, a turn end only writes the turn to the session's local record. The
capture server then projects, evaluates and publishes all of a session's
finished turns in one batch. The batch runs at the first of these events:

- 60 seconds without new events in the session
- 10 minutes after the oldest waiting turn ended
- session end
- shutdown, or the next start after a restart

A reader never makes a session publish sooner. The first reader request, and
a request from `trajectory local-ui` or the MCP tools, which ask before they
read, project the waiting turns at once. Their publish still waits for the
batch. While a reader is attached, each turn is projected as it ends and
published in the batch. Readers see a running turn's state, such as its
running tools, through the session's coding-agent activity, and its rows
when it ends.

While nothing reads them, local rows can arrive up to 10 minutes after the
turn ends. Datadog traces and metrics can arrive up to 10 minutes after the
turn ends. A session's first published turn is never held, and a home that
does not publish to Datadog holds no turns. While nothing reads it, the
capture server also keeps each session's coding-agent activity in memory. It
saves the activity at most a minute later, or as soon as a reader connects.
If you turn the flag off, the capture server runs every waiting batch at
once. After that it projects and publishes each turn as it ends, and saves
activity at every hook. A reader then gets a running turn's rows again,
within about a second of each hook:

```bash
trajectory config features disable deferred_live_projection
trajectory config reload --yes
```

`TRAJECTORY_DISABLE_FEATURES=deferred_live_projection` also turns it off for
one process at start-up.

`open_turn_memory_store` is a temporary rollout control for the capture
server's disk writes while a reader such as Studio is attached. It defaults
on. When it is on, the capture server keeps each live session's unfinished
turn in memory. It answers Reader V1 and V2 requests for that turn from
there. It writes the turn to the local cache once, when the turn ends, the
session ends or the capture server stops. A turn larger than 16 MiB goes to
the cache in paced batches instead. So does a turn that brings the turns held
in memory over 128 MiB. The session's local record stays the source of every turn, so a
restart loses nothing. If you turn the flag off, the capture server writes the
unfinished turn to the cache on each update, as before:

```bash
trajectory config features disable open_turn_memory_store
trajectory config reload --yes
```

`TRAJECTORY_DISABLE_FEATURES=open_turn_memory_store` also turns it off for
one process at start-up.

`live_projection_read_budget` is a temporary rollout control for long
sessions. It defaults on. When it is on, the capture server updates the local
cache of a running session by the new part of its local record only. Each
update reads at most 32 MiB of new data, and the next update reads on from
there. A session whose record is larger than 32 MiB gets its local rows,
turn-level marker points and pull request details while it runs. Each update
costs the same as one for a small session. Some updates read such a record again
from its start, such as a rebuild after an update of Trajectory. They wait
until the session has been quiet for 15 minutes. The capture server then gives
a record of up to 256 MiB one such read in batches. A session that needs another
waits longer each time: 15 minutes, then an hour, 4 hours and a day. These reads
share a limit of about 1.2 GB written a day, which `trajectory doctor` shows
when they reach it. A larger record waits for the session to end. If you turn
the flag off, the capture server stops
updating a running session's local cache once its record passes 32 MiB. The
session's end then updates it, as before:

```bash
trajectory config features disable live_projection_read_budget
trajectory config reload --yes
```

`TRAJECTORY_DISABLE_FEATURES=live_projection_read_budget` also turns it off
for one process at start-up.

`claude_desktop_connector_catalog` defaults off. It gates whether
`trajectory claude-desktop` populates the `managedMcpServers` list in the
Claude Desktop third-party profile. Two sources fill that list. The first is a
connector catalog file, `claude-desktop-connectors.json` in the Trajectory
home. The second is the local (stdio) MCP servers declared in the standard
profile's `claude_desktop_config.json`.

While the flag is off, the launch writes the profile with no connectors,
exactly as before. Enabling it adds connectors only. Gateway routing,
credentials, and model settings are unchanged, and the standard profile is
never written.

Values whose env names look like secrets are withheld from the disk-backed
profile and reported at launch. A missing catalog is not an error. A malformed
one is reported, and the launch proceeds without connectors. The setting is
temporary. The catalog's long-term source is AI Gateway settings, and the flag is
removed once that lands.

The per-request prompt size distribution, which includes cache tokens, always
publishes. See [per-request prompt size](metrics/per-turn-metrics.md#per-request-prompt-size)
for coverage, deduplication, and percentile queries.

`reliable_metric_retry` defaults on. Sometimes Trajectory cannot tell whether
Datadog accepted a metric submission. This flag retries those submissions in a
limited number of rounds, and it saves them to disk between rounds. A disable
in managed config or the environment still works as a kill switch. It stops
the attempts and keeps the pending retries.

`final_session_claim_reclaim` defaults on. It replaces a final-session claim
only when the ledger proves transport never started. The stored PID,
process-start identity, operating-system boot identity, executable, user, and
serve boot ID must identify a process that is now dead. Claims with a started
or unknown submit phase remain held for `trajectory publish queue resolve-claim`.
Disabling the flag sends otherwise safe dead-owner claims to the same operator
workflow.

`reliable_trace_retry` defaults on. Sometimes the Datadog trace intake
answers a turn trace with a 5xx server error. This flag keeps that turn
queued on disk and sends it again later. The wait between tries grows to at
most one hour, and the tries stop 14 days after the turn was queued. A
destination that already accepted the turn does not receive it again. A
disable in managed config or the environment works as a kill switch. It
stops the retries of turns that wait after a 5xx answer. Those turns stay
queued and resume if the flag is turned on again. A new 5xx answer then ends
the turn's retries, as it did before this flag. This flag does not change
traces sent through a Datadog Agent, because the Agent may already have
forwarded them.

Trajectory takes flag names, defaults, control restrictions, and short
descriptions from the flag registry in the binary. To see them, run:

```bash
trajectory config features list
trajectory config features list --json
trajectory config features status <flag>
```

The CLI reads the flag list from the binary, so its list is always current.

An explicit `trajectory patterns analyze --yes` run acts with the authority of
the user. It shows its estimate first and calls no model until you confirm.
Backfill still uses its documented budgets.

AI-EDR availability depends on the version:

- `agent_security_ai_edr` is still on as a compatibility marker for releases
  through v0.5.36.
- Current binaries allow AI-EDR only through the `agent_security_ai_edr_v2`
  flag. That flag defaults off, is managed-only, and ignores environment
  overrides.
- Neither flag turns on the module, installs hooks, selects the evaluator mode,
  or overrides destination publishing gates.

`agent_security_copilot_apply_patch` is a temporary rollout kill switch that
defaults on, is managed-only, and ignores environment overrides. GitHub
Copilot CLI edits files with `apply_patch`, one patch that can add, edit,
delete, or move several files. While the flag is on, AI-EDR rules see each of
those files as they see a Claude Code `Write` or `Edit`. So a Copilot write to
`~/.ssh/authorized_keys` is detected and flagged. Enforce mode blocks a call
only when its policy score reaches the block threshold, as for any other
tool. A lone `authorized_keys` write scores under the default threshold, so it
is flagged and still runs. Rules read at most 3,000 files of one patch, so
the hook stays within its five-second deadline. A larger patch is evaluated
as far as the limit and marked degraded (`copilot_apply_patch.files_over_limit`).
When AI-EDR enforces, it also blocks that patch under the rule
`copilot_apply_patch.files_over_limit`, so harmless files cannot push a
sensitive one past the limit. In observe mode, or without managed
enforcement, the larger patch still runs. A managed disable makes AI-EDR read no file from a Copilot patch again, without
turning off Agent Security for Copilot. Codex `apply_patch` is not covered.

`otlp_zstd_compression` is a default-off temporary rollout control. When
enabled, Trajectory compresses the bodies of the OTLP traces, logs, and metrics
requests it sends. Datadog destinations, and `otlp` destinations that do not
set `compression`, send zstd. An `otlp` destination can set `compression` to
`zstd`, `gzip`, or `none`. A receiver that refuses the encoding fails the send.
Trajectory does not try again uncompressed. Disabling the flag sends every
OTLP request uncompressed, whatever the destination sets. See
[OTLP destinations](PUBLISH.md#otlp).

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
