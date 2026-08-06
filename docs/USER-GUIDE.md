# Trajectory User Guide

Trajectory captures sessions from AI coding agents and exports them to Datadog LLM Observability. This guide covers the CLI commands you'll use day-to-day.

## Check status

```bash
trajectory setup check               # Local-first first-run readiness and next actions
trajectory status                    # Terminal dashboard with session metrics
trajectory report metrics session --latest # Local metrics preview for existing sessions
trajectory doctor metrics verify     # Current Datadog metrics visibility proof
trajectory cost                      # Local cost summary and top sessions
trajectory summary                   # Current-month usage and cost report
trajectory outcomes                  # Yield, cost per commit, and cost per PR
trajectory patterns                  # Work mix, outcomes, cost, and deliverables
trajectory plugins cost-guidance status # Optional local advisory cost checkpoints
trajectory view local-ui             # Start local UI, preferring port 8888
trajectory status processes          # Show live Trajectory processes
trajectory doctor                    # Plain-language local health, span, and metric diagnosis
trajectory flare                     # Write the full redacted support ZIP
trajectory doctor --verbose          # Full low-level doctor report
trajectory setup clients inventory refresh --json # Refresh local capability inventory
trajectory plugins list              # Show opt-in product activation profiles
trajectory plugins show datadog-security # Show Datadog Security activation
trajectory plugins show datadog-cost-guidance # Show Agent Cost Guidance activation
trajectory plugins show datadog-personal-cost-guard # Show Personal Cost Guard activation
trajectory plugins security status   # Datadog Security product status
trajectory plugins modules list      # Show compiled optional modules and status
trajectory cost-guard status         # Personal cost limits and paused-work actions
trajectory config features list      # Show feature flags and effective sources
trajectory config capture disable    # Stop all new capture for this user
trajectory config capture enable     # Resume capture for this user
trajectory doctor publish            # Explain capture, mapping, and publish expectations
trajectory doctor logs [-f] [--grep PAT] # View capture server logs
trajectory version                   # Print version
```

Run `trajectory help` for the small task-oriented surface, `trajectory help
--all` for maintainer/runtime commands, and `trajectory help legacy` for old
path mappings. Existing command paths remain compatible while bounded usage
telemetry establishes when each can be retired safely.

`trajectory setup check` is the first command to run after install. It refreshes
local inventory, summarizes config and detected client readiness, and prints
the exact next commands for setup, a first real agent session, local proof,
local UI, Datadog validation, and the install outcomes dashboard. It does not
mutate client hooks or Datadog configuration.

`trajectory doctor` is the first thing to run if something isn't working. It starts with plain-language Datadog span-publish and metric-visibility answers: whether local config, capture state, credentials, retry queues, and metric destinations look ready, plus the next command to run. The full low-level report is still saved to `~/.trajectory/doctor-report.txt`; use `trajectory doctor --verbose` when you need the detailed subsystem checks in the terminal.

`trajectory setup clients inventory refresh --json` refreshes a first-class local inventory artifact under `~/.trajectory/inventory/` and prints a structured snapshot of detected agents and Trajectory-managed capabilities such as hooks, MCP entries, skills, commands, plugins, and settings sources. `trajectory setup clients inventory show --json` reads `current.json` without rescanning, and `trajectory setup clients inventory list --json` lists the hash-named snapshots under `snapshots/` for support triage or product-pack drift checks. Trajectory does not publish these inventory artifacts to Datadog yet.

`trajectory plugins list` shows opt-in product activation profiles layered over
compiled modules. Baseline `trajectory setup` remains observability-only; use
`trajectory security setup --mode observe --clients cc,codex,cursor` to enable
and install the Datadog Security plugin for explicit supported clients. The
command installs the standalone marketplace plugin for Claude Code and Codex
and synchronizes Cursor's native hooks. Enforce mode can block agent actions
and requires `--yes`. Use `trajectory security disable --clients ...
--remove-hooks` to disable config, uninstall the selected standalone plugins,
and remove stale Trajectory-managed dispatcher hooks while preserving baseline
capture hooks.

The Trajectory marketplace includes `trajectory-security` as an independently
installable plugin alongside the core `trajectory` plugin. Use `trajectory
security destination add --destination <name> --app-key-ref <ref>` to enable
native `agent-security` module spans and application-key readback on an
existing Datadog destination. Store secret values with `trajectory config
set-secret <ref> --stdin`; do not put key values in YAML or command arguments.
See [SECURITY.md](SECURITY.md) for the complete setup and ownership contract.

Agent Cost Guidance is also disabled by default and is advisory-only. End users
can run `trajectory cost-guidance setup --clients codex` for local visibility;
automatic dollar warnings stay off until the user explicitly runs
`trajectory cost-guidance configure --session-amount <USD>`. Administrators can
enable the same `ccm` module and `local_cost_guidance` evaluator in managed
defaults, then use managed auto-instrument or an explicit setup pass for the
selected clients. See `trajectory user-guide cost-guidance` for personal and
managed examples. The guidance never blocks work or represents a provider bill
or global quota.

Personal Cost Guard is a separate, default-off preview profile for users who want a
local speed bump after an eligible session-cost checkpoint. The default-off
`personal_cost_guard` rollout feature controls its guide discovery, setup, and
runtime hook decisions. Dedicated setup enables an untouched default flag for
the local user, but cannot override a config, managed, or environment disable.
It still requires explicit clients, a positive amount, and `--yes`:

```bash
trajectory config features status personal_cost_guard
trajectory cost-guard setup --clients codex --hard-cap 20 --yes
```

It lets the current response finish, then pauses the next prompt until the
user runs an exact-session `continue`, `snooze`, `set-amount`, or `stop`
action. It is personal best-effort workflow control, not provider billing or
organization governance, and it never changes models automatically. See
`trajectory user-guide cost-guidance` for the bootstrap path. After the feature
is enabled, use `trajectory user-guide personal-cost-guard` for the complete
workflow, administrator kill switch, and recovery steps.

`trajectory modules list` shows compiled optional modules such as
`agent-security`, `ccm`, and `personal-cost-guard`. Use
`trajectory modules capabilities <id>` to see
the module's declared hooks, install intents, evaluators, MCP entries, skills,
commands, env fields, and keychain refs. Use `trajectory modules configure <id>
--set KEY=VALUE` for module-wide settings, then enable a module with
`trajectory modules enable <id> --mode observe` or `--mode enforce` and rerun
`trajectory setup --clients ...` to install any setup-managed client assets.
Use `trajectory modules install-plan <id> --clients codex,cursor --json` to
preview the exact dispatcher hook commands setup will render for each client.
Product evaluators such as `ai_guard` or `model_cost_governance` can stay
default-disabled until their evaluator config sets `enabled: true`. Use
`trajectory modules evaluators <id>` to inspect evaluator status and
`trajectory modules evaluator enable|configure ...` to update evaluator config
without hand-editing YAML. Ordinary capture hooks remain separate from module
hook-dispatch commands, and setup installs one dispatcher per client event and
lifecycle phase. Foreground module evaluator decisions are recorded
locally in `~/.trajectory/modules/decisions.jsonl` and can be inspected with
`trajectory modules records --module <id>`.
Use `trajectory user-guide modules` for the full inspect, activation,
credential, fail-open/fail-closed, recovery, and security-custody model.

Use `trajectory local-ui --lapdog` as the recommended inspection path. It starts the local inspection API on `http://127.0.0.1:8888`, or the next available port, and opens the hosted Lapdog viewer with a matching `portOverride`. Add `--no-open` for headless environments.

Use `trajectory doctor publish --session <id>` when Datadog data is missing or surprising. It compares local capture and local JSONL-to-span mapping against the transcript, then adds a metric publish plan from the local SQLite cache: expected metric counts, durable outbox row counts, missing expected rows, and the exact readback follow-up command. It does not query Datadog readback.

`trajectory doctor` also checks recent local session-end fidelity. The `Session-end local fidelity` row compares recent Trajectory JSONL against known native transcript, rollout, or hook-log evidence. It fails when a native source has strong terminal evidence such as `SessionEnd`, `shutdown_complete`, `away_summary`, or `stop_hook_summary` but the Trajectory JSONL has no terminal `session_end`. For that case, run `trajectory doctor --reconcile-session-end`; it auto-discovers recoverable sessions, prints the exact files and native evidence, and prompts before appending anything. To inspect one session directly, run `trajectory publish session-end reconcile --session <id> --dry-run`. Applying direct repair requires the interactive confirmation prompt or `--yes`; it refuses active sessions, appends a synthetic terminal `session_end` only when strong native terminal evidence is still present, then retries final publish. It warns on stale terminal anchors such as `Stop` or `task_complete` when no fresh session heartbeat remains; start those with `trajectory diagnose publish --session <id>`.

Use `trajectory user-guide claude-cost` when Claude cost overlap or native-cost parity is unclear. It covers `trajectory verify claude-cost route` for read-only route classification, `trajectory verify claude-cost transcript --session <id>` for transcript-vs-capture fidelity checks, and `trajectory verify claude-cost artifacts --dir <artifact-dir>` for native OTel canary artifacts that can prove equality against `claude_code.cost.usage`.

Use `trajectory user-guide cost-attribution` when building cost or CODEOWNER
dashboards. Canonical ungrouped metrics provide additive totals; owner-grouped
metrics describe overlapping involvement and must not be stacked or summed as
allocated spend. The full sendable guide is
[COST-ATTRIBUTION.md](COST-ATTRIBUTION.md).

Use `trajectory user-guide cost-reconciliation` before treating a cost total
as authoritative. It defines Trajectory, native-client, provider, gateway,
cloud, and Cursor source boundaries; handles different customer collection
configurations; and names the strongest reconciliation claim each data shape
can support.


Use `trajectory flare` as the critical debug/support action when you need to share a redacted ZIP under `~/.trajectory/` with doctor output, process state, metrics fast-path diagnostics, config files, managed `config.defaults.yaml`, cohort overlay files, log tails, and version/pricing metadata. When support needs raw evidence for one session, use `trajectory flare --privileged --session <id>` and review the ZIP before sharing. `trajectory doctor --support-bundle` remains available for the older single-JSON support summary.

For slow Codex launch or exit reports, the default doctor output includes recent Trajectory MCP lifecycle timing and any existing Codex startup traces. If attribution is unclear, run `trajectory doctor --codex-startup` to launch a bounded Codex startup probe. The probe records whether Codex is delayed before `thread_spawn`, before Trajectory MCP is launched, or inside Trajectory itself.

For repeated Codex turns or malformed LLM Obs spans, check the capture and publish guardrail signals:

- `codex.session_id_change_ignored`: serve diagnostic event. A replayed Codex rollout tried to change `session_id` after the first `session_start`; Trajectory kept the original child session ID and ignored inherited parent context.
- `trajectory.instrumentation.capture.gap` with `client_source:codex`, `signal:jsonl`, and `reason:duplicate_event`: instrumentation-health metric. Normalized Codex JSONL contained more than one `session_start` for the same session.
- `incompatible duplicate span identity`: publish error. Two spans in one export batch shared `(trace_id, span_id)` with different payloads, so export failed closed.
- `skipping incomplete turn ... (incremental)`: publish log. A turn batch had no `turn_end`, so Trajectory waited instead of publishing a partial turn span.

## Configuration

```bash
trajectory config show               # View merged runtime config
trajectory config set <key> <value>  # Set a config value
trajectory config sync               # Refresh organization-managed config now
trajectory config reload             # Dry-run live serve reload/restart plan
trajectory config reload --yes       # Ask the exact adopted owner to hot-reload config
trajectory update converge --dry-run # Preview managed desired-version convergence
trajectory update converge --yes     # Apply a managed generation and activate its binary
trajectory update reconcile          # Dry-run old-version serve process refresh
trajectory update reconcile --yes    # Retire the adopted old owner, then start the target version
trajectory update reconcile --yes --reload-config
                                     # Also reload managed config/credentials and verify required destinations
trajectory config set-secret <name>  # Store a secret in the OS keychain
trajectory config get <key>          # Read a single value
trajectory config features enable <name>  # Persist a user feature-flag override
trajectory config features disable <name> # Persist a user feature-flag kill switch
trajectory config capture disable         # Persistently stop all capture for this user
trajectory config capture enable          # Clear the user-scoped capture kill switch
```

`trajectory config capture disable` writes `~/.trajectory/capture.disabled`. New hook,
watcher, and OTLP events are discarded without JSONL writes, including by
already-running Trajectory servers. Use `trajectory config capture enable` to resume. For one
process tree only, use `TRAJECTORY_DISABLED=1`; the environment override wins
over the durable user state and must be unset before that process is relaunched.
During compatibility reconciliation, Trajectory may write the same path with
its selective-fence marker so released legacy clients fail closed while current
clients continue through the per-client policy check. Current hooks recognize
only that exact marker as selective; symlinks, malformed contents, and every
other marker remain a global disable.

Use `trajectory user-guide config` for the full config schema, settable key
table, config layering rules, environment overrides, and transport values. Use
`trajectory user-guide publish` for repo `publish.trajectory.yaml` overlays and
destination-level publish controls.

Common settings:

```bash
trajectory config set export.site datadoghq.com
trajectory config set export.traces standard       # off | minimal | standard | full
trajectory config set export.metrics true
trajectory config set export.placeholder_llm_span false  # omit synthetic cost-only LLM spans
trajectory config set export.index_traces.session true    # optional standalone session index span
trajectory config set export.subagent_span_mode links_only # optional: links only, no parent-side subagent task spans
trajectory config set export.oversight_publish_mode summary # summary | full | off; summary is the default
trajectory config set local_ui.auto_start false    # disable automatic local-ui startup
trajectory features disable claude_native_otlp_interposer # keep trajectory claude from injecting native OTLP env
trajectory config set-secret dd-api-key             # prompts for the key securely
```

Feature flags can also be overridden for one process with
`TRAJECTORY_ENABLE_FEATURES=name_a,name_b` and
`TRAJECTORY_DISABLE_FEATURES=name_a,name_b`. Disabled wins, and managed
`config.defaults.yaml` disables cannot be re-enabled by user config. See
[`FEATURE-FLAGS.md`](FEATURE-FLAGS.md) for rollout rules and the registered
flag catalog.

After changing config or credentials, run `trajectory config reload` first; if
it prints reload candidates, run `trajectory config reload --yes`, then confirm
with `trajectory ps`. Publish/export and identity changes normally reload in
place. Listener, capture, sensitivity, org-sync, module, and similar
process-shape changes are reported as restart-required; config reload does not
silently replace a live owner.

After a binary update, Trajectory automatically hands a compatible exact
`trajectory serve` owner to the updated binary. Active session generations stay
open: the owner retains its bound listener, quiesces without fabricating
terminal events, and replaces its process image in place. The PID, socket, and
kernel accept queue remain continuous while the new image reattaches the same
fenced ownership generation. Older owners that cannot perform an in-place
handoff first yield their listeners to a proven target-version owner and remain
available as failback if that replacement exits.

Run `trajectory update reconcile` to inspect the decision or `trajectory update
reconcile --yes` to retry a deferred handoff. For a managed recovery that must
also apply current org config and newly provisioned exact keychain credentials,
run `trajectory update reconcile --yes --reload-config`. The combined command
targets the exact ready owner and returns non-zero unless every in-scope managed
required destination is active in its fresh health projection. The flag is
manual-only; ordinary and automatic reconciliation keep their narrower binary
handoff behavior. Set
`TRAJECTORY_UPDATE_RECONCILE_PROCESSES=false` only to disable automatic
handoff, or disable the `seamless_update_handoff` feature through user, managed,
or `TRAJECTORY_DISABLE_FEATURES` policy. Foreign, discovery-only, partially
inventoried, and ambiguous owners remain fail-closed. Users do not need to end
active agent sessions for an update.

Managed installers can use `trajectory update converge --yes --target-version
VERSION --source managed-post-install` after laying down a binary. Managed
configuration can also select an immutable, checksum-pinned desired version for
forward convergence or controlled rollback. Run `trajectory update converge
--dry-run` to preview the decision. Previously accepted exact generations can
repair binary drift in either direction when controlled downgrade is enabled;
new older targets require both an explicit rollback generation and the
`controlled_binary_downgrade` feature.

For metrics-only Datadog export, keep `export.traces` off and set
`export.metrics` true:

```yaml
export:
  site: datadoghq.com
  ml_app: coding-agents
  traces: off
  metrics: true
```

### Forward finished sessions to a local sink

To stream finished sessions to a local HTTP endpoint instead of (or in addition
to) Datadog, set a forward URL:

```bash
trajectory setup --clients cc --forward-url http://localhost:4997/api/v1/sessions/ingest
# or, on an existing install:
trajectory config set export.local_forward_url http://localhost:4997/api/v1/sessions/ingest
```

When `export.local_forward_url` is set, `trajectory serve` POSTs each finished
session's complete event stream as NDJSON (one canonical JSONL event per line -
the same schema written to `session.jsonl`) to that URL at session end. This is
independent of the Datadog publish path and requires no Datadog credentials, so
it works in capture-only setups. Delivery is best-effort: a sink that is down
simply drops the delivery (the durable `session.jsonl` remains on disk). Leave
it empty to disable forwarding.

Do not add `type` under `export:` in normal `~/.trajectory/config.yaml`.
Trajectory creates the built-in `_config_datadog` destination from the
`export.*` fields. Destination `type` is only used in explicit
`destinations:` or managed `required_destinations:` lists.

These controls are separate: destination `type` chooses the backend,
`export.traces` or destination `level` controls LLM Obs trace spans, and
`export.metrics` plus destination metric settings control metrics. A
`datadog_agentless` destination uses agentless OTLP for traces and metrics by
default; trusted config can select the `direct` trace fallback or
`dd_metrics_v2` metric fallback independently. Use `type: datadog_agent` for Agent-managed publishing or
`type: otlp` for generic OpenTelemetry collectors. OTLP destinations set a base collector `endpoint`; Trajectory
derives `/v1/traces`, `/v1/metrics`, and `/v1/logs` from it. Legacy
`type: datadog` and `type: dd_llmobs` still work.

Managed or trusted destinations can also opt in to module custom spans with
`module_spans.enabled: true`. This is for module-owned APM-style spans such as
AI Guard hook evaluations, not for ordinary LLM Obs turn traces. The local
source is `~/.trajectory/modules/spans.jsonl`; publishing is off by default,
scoped to named modules, deduped through the publish ledger, and blocked from
repo `publish.trajectory.yaml` project config. Datadog destinations send these
as agentless OTLP traces, and `type: otlp` destinations send them directly to
the configured collector. Use `otlp_traces_url` only for test or special
Datadog trace-intake routing.

Collectors that support native OTLP maps and arrays can opt in one module at a
time with `module_spans.native_composite_attributes`. This setting belongs to
each destination because receiver compatibility can differ: the same module
can retain structure for one collector and keep JSON strings for another.
Scalar values do not change. The default-on
`module_span_native_composite_attributes` feature flag honors these allowlists;
disabling it restores JSON-string compatibility globally. Receiver behavior is
still destination-specific: a collector can accept native OTLP maps and arrays
but flatten or stringify them during indexing, and nested JSON null values may
be normalized from an empty OTLP `AnyValue`. Validate the destination's
readback before broadening the module allowlist.

`server.otlp_proxy` is separate from publish destinations. It controls the
local `trajectory serve` OTLP listener for client-native logs, metrics, and
traces, such as Claude Code's OTel stream:

```yaml
server:
  otlp_proxy:
    enabled: true
    endpoint: https://otlp.datadoghq.com
    api_key_ref: dd-api-key
    capture_enabled: true # optional local inbound-vs-forwarded comparison records
```

The serve proxy forwards inbound `/v1/logs`, `/v1/metrics`, and `/v1/traces`
payloads to the configured upstream. Metric payloads are decoded and re-encoded
in the same OTLP protocol so Trajectory can add canonical identity tags plus
`trajectory.proxy.source:serve-otlp`,
`trajectory.cost_role:client_telemetry`, and
`trajectory.cost_source:claude_native_otlp`. Trace payloads are forwarded
unchanged so Claude Code's native span hierarchy, including `claude_code.tool`
spans with `skill_name` when Claude is configured to emit tool details, can be
collected without mutating the client binary. The proxy is best-effort and
fail-open for the coding agent; local capture still succeeds when enrichment or
the upstream is unavailable.

When `capture_enabled` is true, Trajectory writes normalized metric comparison
records under `~/.trajectory/state/otlp-proxy/metrics/`. Run
`trajectory otlp metrics compare --session <session-id>` to confirm forwarded
values match inbound Claude native OTLP values and to see the cost-source tags
that should be used in Datadog. Local inbound-vs-forwarded comparison artifacts
are metrics-only today; use the upstream trace backend to inspect native Claude
tool and skill spans.
Restart long-lived serve processes after changing this config so all concurrent
listeners use the same disk-backed settings.

### Skill Usage Insights

Use the dedicated skill observability guide when skill maintainers want
repo-scoped usage, tool mix, duration, and cost-source context without exposing
raw coding-agent I/O. The same guidance is available in this repository at
[docs/SKILL-OBSERVABILITY.md](SKILL-OBSERVABILITY.md):

```bash
trajectory user-guide skill-observability
```

The packaged Datadog dashboards include a standalone **Skill Observability**
dashboard plus skill groups in the enterprise and developer dashboards:

```bash
trajectory dashboard export --type skill-observability --output trajectory-skill-observability.json
trajectory dashboard export --type skill-observability --format mcp --output trajectory-skill-observability-mcp.json
```

Baseline skill usage metrics come from Trajectory's normal capture and
materialized marker path. Exact native Claude tool-span windows require Claude
native OTLP traffic to flow through Trajectory, which is the explicit
`trajectory claude` path for Claude sessions.

Managed Datadog security destinations can opt in to a security event stream:
one Datadog log per canonical Trajectory event with
`ddsource: trajectory-event-stream`. This is configured under
`required_destinations[].event_stream`, not in repo `publish.trajectory.yaml`.
The stream is off unless `event_stream.enabled: true` is set. When enabled, the
default `privacy_profile: security` mode preserves the complete captured event,
including prompts, responses, thinking, tool inputs and outputs, diffs, file
content, raw payloads, errors, summaries, and identity fields. Common tools
follow the `trajectory-spec` coding-agent equivalence registry and expose a
vendor-neutral `tool_operation` for detections, such as `shell.execute` or
`file.read`. Canonical `tool_name` remains available for compatibility, while
`native_tool_name` retains source provenance. The built-in security event
stream guide includes the complete operation-to-canonical-name detection table
and a cross-client query example. The stream does not enable or depend on the
optional `agent-security` runtime module. See
`trajectory user-guide security-event-stream`.

Trace export is off by default. Set `export.traces` explicitly when you want
sessions published to LLM Observability. Rerunning `trajectory setup` preserves
an existing non-off trace setting and prints the effective level. If the
existing setting is `full`, interactive setup asks before preserving it; the
safe default is to switch back to `off`. Non-interactive setup cannot prompt, so
it warns loudly when it preserves `full`.

Secret writes are defensive: `trajectory setup` and `trajectory config
set-secret` snapshot an existing keychain value before updating it and attempt
to restore the old value if the write fails. Rescue a missing Datadog key with
`trajectory config set-secret dd_api_key` or a temporary `DD_API_KEY` /
`DATADOG_API_KEY`.

Environment variables are process-local. If a long-running `trajectory serve`
process was started before `DD_API_KEY` was exported, that process cannot see
the later shell variable. Setup-managed Codex hooks invoke the installed
`trajectory capture-hook --client codex --ensure-serve` binary path so they can
verify or start a matching local capture server while preserving lifecycle event
order, but stored credentials are still the durable option for agent sessions.
Store the key once with
`trajectory config set-secret dd_api_key`, configure `auth.key_command`, or
rerun setup with `DD_API_KEY` present.

Standard Datadog credential resolution uses `auto`: env var for the
`api_key_ref`, `DD_API_KEY`, `DATADOG_API_KEY`, the configured credential-provider
command from `auth.key_command`, keychain, then destination `api_key_command`.
For standard Datadog API-key resolution, `dd-api-key` and `dd_api_key` are the
same default key: setup stores `dd_api_key`, while publish config often names
`dd-api-key`. Managed keychain deployments are the exception; they use exact
refs only and do not alias, read env vars, or run key commands.
If an env var is a secret-manager ID rather than the Datadog key, `auto` reports
it and real Datadog publish destinations continue to later sources. Pin the
intended source when you want that source to fail closed:

```bash
trajectory config set auth.credential_source keychain  # auto | env | key_provider | keychain | api_key_command
trajectory doctor
```

Managed `auth.mode: managed_keychain` from MDM still wins and uses exact
keychain refs only. `trajectory serve` logs an early warning when `auto` would
select a malformed Datadog env var, before the first publish attempt.

Set `export.placeholder_llm_span: false` in `~/.trajectory/config.yaml`, or `placeholder_llm_span: false` on a managed/trusted `publish.trajectory.yaml` destination, to stop publishing Trajectory's synthetic LLM child span for turn-level token/cost enrichment. The turn span still carries `metrics.estimated_total_cost` plus cost fallback metadata and the `trajectory.cost_source:turn_metrics` tag, so cost remains queryable without the placeholder child span. Project configs may disable this for a trusted destination, but cannot re-enable it if the trusted or managed destination disabled it.

Set `export.index_traces.session: true`, or `index_traces.session: true` on a managed/trusted destination, only when you want a standalone link-only session index span at session end. It is off by default because the canonical topology is turn-rooted; project configs may disable a trusted destination's session index span, but cannot enable one the trusted destination did not allow.

Subagent rendering defaults to `export.subagent_span_mode: semantic`: sync subagents attach under the launching Agent/Task tool span, and async background subagents attach under the task-notification join turn. Use `links_only` only when you want to preserve child trace links without publishing the extra parent-side subagent task span.

Model-backed reviewers that run automatically to judge an action or output are
reported as automated oversight, not ordinary user sessions or work-performing
subagents. `export.oversight_publish_mode` defaults to `summary`, which emits one
content-free oversight result plus bounded usage metrics while suppressing the
reviewer transcript trace. Use `full` to publish the separate reviewer trace as
`trajectory.trace_type:oversight`, or `off` to suppress all new oversight spans
and metrics for that destination. The same key can be set on a trusted publish
destination, and project overlays may only narrow its value. Local UI hides
reviewer containers from the ordinary session list by default. Open the
**Oversight** tab in `trajectory view` to inspect content-free operation counts,
outcome rates, operations per 100 ordinary turns, p50/p95 added latency,
oversight-only tokens, reportable cost, and low-cardinality filters. Provider
role and feature are local diagnostics and do not become public metric
dimensions. Disable the default-on capture rollout and remove that view with
`trajectory features disable automated_oversight_telemetry`.

For fleet-wide local-ui auto-start rollback, deploy `local_ui.auto_start: false` in managed `~/.trajectory/config.defaults.yaml`. A managed false value disables automatic local-ui startup and cannot be overridden from user `config.yaml`; explicit `trajectory local-ui` commands still work.

## Capture server

The capture server receives hook events from your coding agent on port 19222.

```bash
trajectory serve                     # Start capture server (foreground)
trajectory dev serve                 # Temporarily hand capture to this exact dev binary
```

The server starts automatically when your agent launches a session (via plugin hooks). You rarely need to start it manually.

## Querying sessions

```bash
trajectory status                    # Overview of recent sessions
trajectory status --session <id> --json
trajectory summary                   # Current-month corpus report
trajectory outcomes                  # Yield and delivery-attribution ratios
trajectory patterns                  # Last-7-day work mix, outcomes, and deliverables
trajectory patterns --period 30d
trajectory patterns session SESSION_ID
trajectory patterns estimate --period 30d
trajectory patterns analyze --period 30d --yes
trajectory cost inspect --session <id>
trajectory cost observations --session <id>
trajectory cost pricing --since 7d
trajectory cost validate
trajectory cost reconcile --latest     # Independent transcript -> v2 outbox fidelity
trajectory cost-guidance status --session <id>
trajectory local-ui                  # Open local-ui, preferring http://127.0.0.1:8888
trajectory local-ui --lapdog         # Hosted Lapdog with local port override
trajectory user-guide query          # Local data and safe MCP query workflow
trajectory user-guide reports        # Summary/outcomes semantics and metric alignment
trajectory user-guide costs          # Cost tracking commands and fidelity checks
trajectory user-guide cost-guidance  # Optional local advisory checkpoints
trajectory user-guide cost-attribution # Additive totals and CODEOWNER dashboard patterns
trajectory user-guide cost-reconciliation # Source selection and upstream reconciliation
trajectory user-guide cursor-cost     # Cursor token formula, rate provenance, and rollout
```

The current OSS binary does not expose a general-purpose `trajectory query`
CLI. Use `trajectory status`, `trajectory local-ui`, `get_session_trajectory`, and
the `trajectory_schema` / `trajectory_query` tools for local inspection. Pi
registers those as native extension tools; setup-managed MCP clients get the
same schema-first workflow through `trajectory mcp`. The embedded query guide
documents schema-first inspection and `TRAJECTORY_CACHE_DB` handling.

Use `trajectory cost` for local cost tracking. It reads the local SQLite cache,
automatically repairs obsolete Codex token/cost projections when needed, shows
recent cost totals, and adds seven rolling 24-hour cost buckets to the default
seven-day human view. Empty buckets display `$0.00`; session cost is attributed
to the bucket containing its latest selected in-window evidence timestamp.
It also provides a corpus-wide provisional pricing deep dive and inspects
turn-level cost evidence,
reports objective cost observations without causal claims, and validates recent
cost fidelity for Claude Code, Codex, Gemini, Pi, OpenCode, Cursor, Hermes
Agent, Amp Code, Qwen Code, Kilo Code, and Mistral Vibe. Explicit whole-session
cost evidence appears as `session-aggregate` and is not counted as a costful
turn. Finite `--since` windows select observed turn activity rather than whole
session lifetimes, so a long-running session contributes only its observed
in-window turn activity. A current, completed Codex session whose start is in
the requested window uses its authoritative priced session aggregate; a window
that starts mid-session still uses only the sliced turns. This prevents a wider
window from dropping a session because of an incidental zero-usage legacy row.
Top-session JSON keeps session timestamps separate from
`window_started_at` and `window_ended_at`. Explicit whole-session aggregate
evidence is included only when its session evidence timestamp falls inside the
window because it cannot be split more finely. A missing evidence timestamp
fails closed as unavailable in a finite window instead of assigning the
lifetime amount to an arbitrary turn; `--since all` can still use the exact
lifetime aggregate because no temporal placement is required. Session-wide
aggregate authority wins over incidental turn rows whenever that aggregate is
in scope. Turn timestamps are parsed chronologically, including RFC 3339
offsets, rather than compared as text. Legacy or malformed turn timestamps
enter a finite window only when parseable session bounds or another valid turn
prove possible overlap; those ambiguous rows remain unavailable rather than
exposing a coarse fallback as precise turn cost.

For Codex, this view separates API-equivalent USD from ChatGPT Codex credits.
They represent the same usage, so credits are not added to USD a second time.
Human summary output shows credits once in the header and keeps agent/session
tables dollar-only; JSON retains detailed credit and fidelity fields. Human
rankings show sessions with complete cost evidence and put excluded-session and
Guardian proxy-pricing disclosures in compact footnotes.

Use `trajectory patterns` to understand the work agents performed, the outcomes
they reached, the cost and complexity of that work, and the deliverables they
produced. The default report covers the last seven days; use `--period 30d`,
`--details`, or `--json` for broader or deeper views. Historical classification
is explicit and resumable: `trajectory patterns estimate` makes no model calls,
and `trajectory patterns analyze --yes` is the spending boundary. Use
`trajectory patterns session SESSION_ID` to inspect one session locally.
See [Reports and Work Insights](REPORTS.md) for report semantics, classification
behavior, GitHub reconciliation, and provisional-cost handling.

The default-off `provisional_cost_estimates` feature can combine qualified
read-time estimates with verified USD without rewriting recorded attribution.
Affected totals and rows end in `*`; `trajectory cost pricing --since <window>`
shows verified, provisional, and unresolved evidence separately. Codex product
credits remain separate from API-equivalent USD.
Guardian usage contributes an explicitly labeled provisional
`codex-auto-review` proxy estimate using $2.50 per million input tokens, $0.25
per million cached input tokens, and $15 per million output tokens, with
corresponding inferred credit rates of 62.5, 6.25, and 375 per million. The
rate is third-party evidence, not a verified OpenAI billing mapping; JSON and
cost observations include the proxy version, source, and open validation
reference. Token
components without a provisional rate, negative components, incomplete token
status, and session-only aggregates without a cache breakdown remain unavailable
rather than being treated as free. Reasoning usage is already included in reported output tokens
and is not charged twice.

Before displaying a summary or ranking, the command automatically repairs quiet
stale Codex sessions in the requested window. The cost-only repair decodes
rollout metadata, model and service-tier settings, token counters, turn
boundaries, and web-search charges. It updates only cost evidence and does not
replace tools, markers, prompts, responses, or evaluation data. Active or
changing sources and concurrent repair are deferred without blocking. JSON
exposes `automatic_cost_repair` counts and elapsed time.

Stale rows that cannot yet be repaired remain excluded, but they no longer
erase valid evidence: cost and credits stay visible as one recorded estimate,
with incomplete coverage disclosed in the footnote. Standalone `trajectory cost top` reports
`ranking_state: partial`, retains sessions with known partial subtotals, and
exposes the excluded stale-session count rather than claiming a complete
ranking.
Guardian sessions with a complete proxy estimate participate in rankings and
carry `cost_fidelity_badge: proxy_estimate`; partial or otherwise unpriced
sessions make `ranking_state` partial. Human output labels the ranking as
incomplete, and JSON reports `incomplete_ranking_sessions` or
`incomplete_cost_sessions`; neither surface presents it as a complete
highest-cost ordering. When only some Guardian turns have complete
token evidence, the command still shows their provisional amount as an explicit
known subtotal and separately counts the incomplete turns and sessions.
Normal `trajectory serve` startup may also run its existing bounded background
repair, but `trajectory cost` does not wait for that daily page. The broader
Codex backfill remains available for importing or rebuilding non-cost session
data; it is not required for the cost command to repair the evidence needed for
its display.

For the stricter v2 integrity check, enable the preview and reconcile native
source evidence against a freshly materialized session and retained outbox:

```bash
trajectory features enable cost_contract_reconciliation
trajectory cost reconcile --latest
trajectory cost reconcile --since 24h --summary-only --json
```

This command never treats untagged legacy cost rows as authoritative. It
separates native-to-capture mismatches, capture-to-outbox overcount or
undercount, timestamp/bucket errors, and delivery state. Missing native or
retained evidence is `inconclusive`, not a pass. It reads retained outbox
schemas without migrating them, suppresses rematerialization side effects, and
classifies an unusable terminal transcript as `session_materialization_failed`
without aborting the rest of a selected cohort. Codex native and canonical
records above 8 MiB use private spill files and structural cost projection, so
the integrity check has no fixed per-record rejection. Billable aborted and
superseded requests remain in the comparison; a repeated unchanged cumulative
snapshot is treated as prior-turn evidence rather than new usage.

## MCP tools

Setup-managed clients launch `trajectory mcp` automatically to expose local
agent introspection tools and resources. The MCP server covers status, active
sessions, JSONL-derived session data, marker evaluation, incognito, and guarded
read-only SQLite access.

| Surface | Names |
|---------|-------|
| Tools | `trajectory_status`, `list_active_sessions`, `get_session_trajectory`, `trajectory_incognito`, `trajectory_schema`, `trajectory_query`, `trajectory_search` |
| Resources | `trajectory://status`, `trajectory://config`, `trajectory://sqlite/schema` |

For SQLite queries, call `trajectory_schema` first so the agent uses the live
database path and schema before calling `trajectory_query`.

```bash
trajectory user-guide mcp
```

## Setup and client registration

```bash
trajectory setup                     # Interactive setup (site, API key, agents)
trajectory setup --clients codex     # Add or refresh one client integration
trajectory setup --clients cc,codex --install-client-shims # Make ordinary claude/codex launches use built-in wrappers
trajectory setup --clients copilot   # Add or refresh GitHub Copilot CLI beta live capture
trajectory setup --clients agy       # Add or refresh Antigravity CLI capture
trajectory setup --clients goose     # Add or refresh Goose capture
trajectory features enable goose_durable_history  # Opt into Goose SQLite usage/history reconciliation
trajectory setup --clients cline     # Add or refresh Cline CLI capture
trajectory setup --clients aider --install-client-shims     # Add or refresh Aider shim capture
trajectory features enable aider_durable_history             # Opt into explicitly rooted native Aider history
trajectory backfill --from-aider                              # Import configured native Aider history
trajectory setup --clients continue --install-client-shims  # Add or refresh Continue CLI shim capture
trajectory setup --clients mistral-vibe --install-client-shims # Add or refresh Mistral Vibe shim capture
trajectory features enable grok_build_instrumentation
trajectory setup --clients grok      # Add or refresh Grok Build hooks and reconciliation
trajectory setup --clients codebuff --install-client-shims  # Add or refresh Codebuff shim capture
trajectory setup --clients kilo      # Add or refresh Kilo Code capture
trajectory features enable kilo_durable_history
trajectory backfill --from-kilo      # Import existing Kilo SQLite/JSON history
trajectory setup --clients kiro      # Add or refresh Kiro CLI capture
trajectory features enable kiro_durable_history
trajectory config reload --yes       # Preview bounded Kiro JSONL/SQLite reconciliation
trajectory features enable opencode_durable_history
trajectory config reload --yes       # Preview watching for changed OpenCode durable sessions
trajectory features enable amp_durable_history
trajectory config reload --yes       # Preview bounded Amp thread-history reconciliation
trajectory features enable cursor_agent_durable_history
trajectory config reload --yes       # Preview bounded cursor-agent transcript reconciliation
trajectory features enable devin_cli_instrumentation
trajectory setup --clients devin     # Add or refresh Devin CLI preview capture
trajectory features enable zed_passive_history
trajectory setup --clients zed       # Add or refresh Zed passive-history preview capture
trajectory features enable qoder_cli_instrumentation
trajectory setup --clients qoder     # Add or refresh Qoder CLI preview capture
trajectory features enable zcode_instrumentation
trajectory setup --clients zcode     # Add or refresh ZCode SQLite-backed preview capture
trajectory backfill --from-zcode      # Repair existing ZCode durable history
trajectory features enable commandcode_instrumentation
trajectory setup --clients commandcode # Add or refresh CommandCode preview capture
trajectory features enable kimi_cli_instrumentation
trajectory setup --clients kimi      # Add or refresh Kimi Code CLI preview capture
trajectory features enable gptme_instrumentation
trajectory setup --clients gptme     # Add or refresh gptme preview capture
trajectory features enable codewhale_instrumentation
trajectory setup --clients codewhale # Add or refresh CodeWhale preview capture
trajectory features enable forgecode_instrumentation
trajectory setup --clients forgecode # Add ForgeCode passive-history preview capture
trajectory features enable warp_oz_instrumentation
trajectory setup --clients warp      # Add local Warp Desktop / Oz CLI preview capture
trajectory features enable vscode_copilot_instrumentation
trajectory setup --clients vscode-copilot  # Add VS Code Copilot fixture-preview capture
trajectory features enable windsurf_instrumentation
trajectory setup --clients windsurf  # Add or refresh Windsurf preview capture
trajectory setup --clients droid     # Add or refresh Factory Droid beta live capture
trajectory setup --clients all       # Add or refresh all setup-managed clients
trajectory setup --clients cc --forward-url URL  # Also forward finished sessions to a local sink
trajectory setup auto-instrument --json  # Dry-run managed auto-instrument plan
trajectory setup auto-instrument apply --yes --json  # Apply when managed mutation is enabled
trajectory setup auto-instrument status --json  # Last auto-instrument status
trajectory uninstrument codex        # Remove one client integration
trajectory uninstrument all          # Remove every client integration
```

`trajectory setup --clients ...` updates only client wiring. It skips Datadog
site, service name, and API key prompts, and leaves existing export config
unchanged. If no config file exists yet, it creates a capture-only config so
local session capture can start; run `trajectory setup` later to configure
Datadog export.

Claude Code is a stricter boundary: Trajectory never adds, merges, or deletes
Claude user settings itself, including `~/.claude.json`,
`~/.claude/settings.json`, and settings variants. Its only write is an exact
rollback after a destructive Claude plugin-manager result. The standard plugin
uses one root `.mcp.json`; the manifest has no inline MCP block and no nested MCP file.
If an older explicit user MCP entry exists, Trajectory leaves it byte-for-byte
unchanged and stages a compatibility plugin generation with no MCP declaration,
preventing double instrumentation. Explicit setup stages the marketplace and
uses Claude's plugin manager to register, install, or repair
`trajectory@trajectory` at user scope; Claude may update its own plugin
registration fields while preserving unrelated settings. Trajectory verifies
that operation is additive; if Claude drops or changes an existing value,
setup restores the original settings files byte-for-byte and fails. Setup then
refreshes the owned cache after module-hook injection. For an existing owned
user-scope installation, background repair updates only Trajectory's plugin
registry entry and cache subtree and never launches Claude. Project and local
plugin scopes remain unchanged.
A legacy OTLP block is reported and left unchanged.

Claude Code and Codex already have native setup integrations, so transparent
launch shims are optional. `--install-client-shims` writes owned `claude` and
`codex` launchers beside the Trajectory binary, records each real upstream
executable, and links into an existing home bin directory on `PATH` only when
that does not replace a file. Setup never edits shell startup files. If another
command wins earlier on `PATH`, setup reports the conflicting path. The
default-on `builtin_wrapper_command_shims` flag is safe because the setup option
is the explicit opt-in boundary; disabling it prevents new installs and makes
installed Claude/Codex shims pass through without instrumentation.

Managed fleets can preview automatic client instrumentation with `trajectory
setup auto-instrument`. The dry-run planner only becomes ready when both
conditions are true: `selfupdate.conf` stamps a managed install owner, and
managed `config.defaults.yaml` explicitly enables
`setup.auto_instrument.enabled` with an `allow_clients` list. Unmanaged users
and self-installs remain disabled by default, and a user config can opt out by
setting `setup.auto_instrument.enabled: false`. Managed defaults are the policy
ceiling: local user config can narrow `allow_clients`, add `deny_clients`, or
choose a less frequent interval, but it cannot expand automatic client
instrumentation beyond the managed allow-list.

Mutation requires a second managed opt-in:
`setup.auto_instrument.apply_enabled: true`. Without that key, auto-instrument
continues to plan and report status only. With it enabled, a managed deployment
job can run `trajectory setup auto-instrument apply --yes`; the command reuses the same
client-only setup path as `trajectory setup --clients ... --non-interactive`,
then records the apply result in `state/auto-instrument/status.json`.

When `trajectory serve` starts, it records the same plan in
`state/auto-instrument/status.json` under the Trajectory home. Read it with
`trajectory setup auto-instrument status`. Startup remains dry-run unless the
managed policy also sets `setup.auto_instrument.apply_enabled: true`; when that
second gate is enabled and the plan has actionable detected clients, startup
runs the same client-only setup path in the background and records the apply
result with source `serve_startup_apply`.

Managed fleets can additionally enable the default-off
`periodic_auto_instrument_reconciliation` feature. While `trajectory serve`
continues running, the periodic path re-inventories installed clients after
each effective `setup.auto_instrument.interval` and applies only newly missing
or invalid allow-listed integrations. Enabled managed policy temporarily blocks
the shared owner's normal idle exit so the configured cadence can elapse. The
loop runs serially, rechecks the managed feature and policy before every pass
and again before mutation, polls policy at most once per minute while waiting,
honors the existing setup mutation lease, and clamps cadences shorter than one
minute. Disabling the feature releases the shared owner's idle-exit block after
the next policy poll. Periodic results use source `serve_periodic` or
`serve_periodic_apply`.

Example managed defaults:

```yaml
features:
  enabled: [periodic_auto_instrument_reconciliation]
setup:
  auto_instrument:
    enabled: true
    apply_enabled: false
    mode: detected
    interval: 6h
    allow_clients: [cc, codex, cursor, gemini, agy, goose, cline, aider, continue, codebuff, kilo, kiro]
```

`--forward-url <url>` records `export.local_forward_url`, making `trajectory
serve` POST each finished session as NDJSON to that local endpoint at session
end (no Datadog credentials required). See "Forward finished sessions to a local
sink" above.

### Feature coverage examples

The tables below explain representative capture and privacy shapes; they are
not the client registry. Use [SUPPORTED-CLIENTS.md](SUPPORTED-CLIENTS.md) for
the authoritative, complete setup and support matrix, including preview
clients added after these examples.

Incognito is a server-side Trajectory trace-publication gate for every captured
session once toggled. Local capture, task segmentation, and aggregate metric
publication continue. The privacy matrix calls out
whether setup gives that client a first-class way to toggle it. Sensitivity
classification is skipped while incognito; headless sessions always skip
sensitivity classification and segmentation.

#### Capture and telemetry

| Client | Live capture | Tool/model events | Token/cost usage | Backfill | Resume |
|--------|--------------|-------------------|------------------|----------|--------|
| Claude Code | HTTP hooks | Yes | Yes | Transcript backfill | Yes |
| Codex CLI | CLI and Desktop use four boundary hooks plus rollout reconciliation; optional eleven-hook compatibility | Yes, except default explicit-ephemeral detail gap | Yes when rollout data exists | Codex rollout backfill | Yes |
| GitHub Copilot CLI | Beta Copilot plugin command hooks plus provider session-state backfill | Live command lifecycle/prompt/tool/session events; history adds assistant text/reasoning, tool results, permissions, and subagents | Session-only shutdown aggregate with cache categories separated | Copilot session-state backfill | Not yet |
| Gemini CLI | Managed command hooks | Yes | Yes | Gemini transcript backfill | Yes |
| Antigravity CLI (`agy`) | Antigravity plugin command hooks plus optional `antigravity_durable_history` prompt/usage watcher | Tool input/completion/error, invocation wake signals, Stop metadata, exact provider JSONL prompts, and current schema-v1 generation models when enabled | Exact provider uncached-input, total-output, and cache-read counts; output includes thinking, no reasoning breakdown or provider-billed cost | Default-off watcher baselines existing JSONL/SQLite rows, then reconciles later appends/sessions; no manual pre-baseline replay | No setup-managed resume |
| Goose | Open Plugins command hooks plus default-off durable history | Session, prompt, assistant, and canonical tool events; older duplicate shell/file hooks are suppressed | Live hooks omit usage; schema-v15 history supplies validated model, input/output and optional cache categories plus compaction observations; only complete provider-reported USD is attributed | Bounded SQLite reconciliation behind `goose_durable_history`; provider-owned passive traces preserve exact metadata/tool facts, while native traces receive usage-only corrections | Native post-terminal hooks establish same-ID resume generations; no setup-managed resume command |
| Cline CLI | File hooks | Lifecycle, prompt, tool, assistant-message, turn, and session-end events | Not exposed by current hook payloads | Not yet | No setup-managed resume |
| Aider | Opt-in command shim plus default-off explicitly rooted native Markdown reconciliation | Wrapper lifecycle/prompt/assistant/turn events; history adds prompt, assistant, model, and operational text without claiming structured tools | Wrapper analytics retain provider-call usage/cost; history counts are mixed provider-or-local estimates with display rounding, and printed cost remains noncanonical client evidence | Bounded watcher plus `backfill --from-aider` behind `aider_durable_history` | No setup-managed resume; native history remains open-ended |
| Continue CLI | Opt-in `cn` command shim plus session JSON readback | Prompt, assistant-message, transcript-derived tool, and outer-turn events | Yes, from Continue session usage metadata when present | Current invocation only; no bulk history | Native CLI `--resume`/`--fork` captured exactly; no setup-managed resume |
| Mistral Vibe | Opt-in `vibe` command shim plus native identity/tool hooks | Prompt, tool, assistant-message, and turn events | Exact session totals and client-estimated session cost; no per-turn attribution | Current invocation only; no bulk history or watcher | Native resume reuses the durable provider binding; content deltas require a clean digest-only background baseline and otherwise fail closed |
| Grok Build | Preview native global hooks plus exact-source durable reconciliation | Lifecycle, prompt when present, assistant/reasoning, tools/results, model, and root/child relationships | No attributable per-turn tokens or cost; session signal counters remain diagnostics only | Default-off bounded root/nested watcher plus explicit repair backfill | Native facts win; provider snapshots and deletion never fabricate terminal state |
| Codebuff | Opt-in command shims plus chat-history import | Prompt, assistant-message, turn, and chat-history-derived model events | Yes, from Codebuff chat metadata and nested run-state usage | `backfill --from-codebuff-chats` | No setup-managed resume |
| Cursor Desktop | Durable command hooks | Yes | Native input/output/cache-read/cache-write behind managed rollout; forward-only exact-model pricing is off by default | Cursor chat backfill; no historical USD replay | Yes |
| cursor-agent CLI | Native command-hook path when dispatched plus default-off transcript fallback | Tool and turn events | Same native quartet contract; passive-only generations remain unpriced | Same transcript source; no historical USD replay | No setup-managed resume |
| Factory Droid | Beta Factory plugin command hooks | Documented lifecycle, prompt, tool, notification, compaction, stop, and subagent-stop events | Not exposed by current documented hook payloads | Not yet | Not yet |
| Pi | TypeScript extension | Yes | Yes | Pi session backfill (legacy command also checks default OMP root) | Yes |
| Oh My Pi (`omp`) | Feature-gated native `omp.extensions` lifecycle capture, MCP, and bounded durable-history reconciliation | Prompts, assistant/model, exact tool results/errors, compaction, and header-backed relationships | Native input/output/cache/total tokens and provider cost when present | Automatic effective-profile/XDG v3 reconciliation plus `backfill --from-omp-sessions` for explicit repair | Native OMP resume/switch/branch; no setup-managed resume launcher |
| Hermes Agent | Observer plugin hooks plus default-off durable reconciliation | Yes | Live observer usage when present; exact durable session aggregates remain session-scoped | Bounded read-only `state.db` watcher plus explicit backfill | No setup-managed resume |
| Amp Code | System TypeScript plugin events plus default-off durable history | Yes | Live events omit usage; retained history supplies exact model/token components and separate provider credits | Bounded `T-*.json` reconciliation behind `amp_durable_history`; native traces win | No setup-managed resume |
| Qwen Code | Native HTTP hooks | Yes | Yes, from Qwen usageMetadata and transcript fallback | Default-off active-chain chat JSONL backfill, including archives | No setup-managed resume |
| OpenHands | Command hooks plus optional `openhands_durable_history` reconciliation | Hooks provide lifecycle/prompt/tool events; bundles add assistant, thinking, tool results, model, and CWD | Exact provider session aggregates only; no per-turn attribution | `trajectory backfill --from-openhands` plus bounded watcher | Provider-native resume is discovered by conversation ID; no setup-managed resume command |
| OpenCode | Plugin SDK events | Yes | Yes | JSON-storage/SQLite backfill | Yes |
| Kilo Code | Plugin SDK events plus default-off durable-history fallback | Yes | Native model, five token categories, and cost from plugin/SQLite records; optional native OTLP | `backfill --from-kilo` plus watcher behind `kilo_durable_history` | No setup-managed resume |
| ZCode | Wake-only native hooks plus authoritative SQLite reconciliation | Session identity/parent/CWD, prompt, assistant/thinking, model/provider, and tools/results | Exact attempt and turn input/output/reasoning/cache-create/cache-read tokens; derived cost only for known rates | Bounded watcher plus `backfill --from-zcode` | Active updates remain open; only archived durable evidence can close a session |
| Kiro CLI | Agent command hooks plus default-off durable history | Prompt, tool, assistant response, exact retained models and timestamps | Not exposed by hooks or retained stores; no estimates inferred | Bounded JSONL/SQLite reconciliation via `kiro_durable_history`; native hook traces win | Native `--resume-id`; no setup-managed resume |
| CommandCode | Native wake hooks plus mutable-transcript reconciliation | Prompt, assistant, thinking, native tools/results, and CWD when authoritative | No native usage/cost source; downstream estimates retain estimated provenance | Existing and changed transcripts reconcile in bounded passes | Native resume only; no setup-managed resume or terminal SessionEnd |
| gptme | Metadata-only lifecycle hooks plus authoritative conversation/events/config reconciliation | Prompt, assistant, thinking, tool/result, model, and lifecycle facts | Native per-message tokens summed across each turn; recorded cost retains computed provenance | Existing and changed sessions reconcile in bounded passes | Native gptme resume; no setup-managed resume |
| ForgeCode | Passive read-only `.forge.db` reconciliation | System, prompt, assistant, reasoning, native tools/results/failures, model, CWD, and child conversations | Actual native values materialize as real; approximate/mixed values remain estimated; provider cost keeps provider provenance | Existing/changed conversations across legacy and current roots reconcile in bounded passes | No setup-managed resume; no inferred live or terminal lifecycle |

#### Privacy and derived features

| Client | Incognito UX | MCP incognito tool | Sensitivity scanning | Segmentation | Coverage note |
|--------|--------------|--------------------|----------------------|--------------|---------------|
| Claude Code | `/trajectory:incognito` command and incognito skill | Yes | Non-headless eligible; headless skipped | Non-headless eligible; headless skipped | Live incognito UX; `privacy-features` E2E positive feature proof |
| Codex CLI | Incognito skill with bundled script fallback | Yes | Non-headless eligible; headless skipped | Non-headless eligible; headless skipped | Live incognito UX; `privacy-features` E2E positive feature proof |
| GitHub Copilot CLI | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions eligible; headless skipped | Non-headless plugin sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; no live incognito UX gate yet |
| Gemini CLI | `/incognito` command and incognito skill | Yes | Non-headless hook sessions eligible; headless skipped | Non-headless hook sessions eligible; headless skipped | Live incognito UX and positive feature coverage |
| Antigravity CLI (`agy`) | `/incognito` command and incognito skill | Yes | Non-headless hook sessions eligible; headless skipped | Non-headless hook sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; no live incognito UX gate yet |
| Goose | Setup-managed `goose-incognito` command | No | Current hook mode is unavailable, so sessions are conservatively headless/unknown and skipped | Current hook mode is unavailable, so sessions are conservatively headless/unknown and skipped | Headless-skip fixture proof; no authoritative interactive-mode or live Goose incognito UX gate yet |
| Cline CLI | Setup-managed `cline-incognito` command plus MCP request path | Yes | Non-headless file-hook sessions eligible; headless skipped | Non-headless file-hook sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; no live Cline UX gate yet |
| Aider | Setup-managed `aider-incognito` command | No | Wrapper sessions eligible when non-headless; passive native-history sessions are headless/unknown and skipped | Wrapper sessions eligible when non-headless; passive native-history sessions are headless/unknown and skipped | `privacy-features` E2E positive wrapper proof; setup/inventory plus native-history fixture coverage |
| Continue CLI | Setup-managed `continue-incognito` command | No | Wrapper sessions eligible when non-headless; headless skipped | Wrapper sessions eligible when non-headless; headless skipped | `privacy-features` E2E positive fixture proof; setup/inventory and command-behavior coverage |
| Mistral Vibe | Setup-managed `vibe-incognito` and `mistral-vibe-incognito` commands | No | Wrapper/native sessions eligible when non-headless; headless skipped | Wrapper/native sessions eligible when non-headless; headless skipped | `privacy-features` E2E positive fixture proof; setup/inventory and command-behavior coverage |
| Grok Build | Setup-managed `grok-incognito` command and `trajectory-incognito` skill | No | Source-only sessions remain headless/unknown; explicit native mode may become eligible | Source-only sessions remain headless/unknown; explicit native mode may become eligible | Fixture/control-plane proof; authenticated native-hook and incognito UX pilot pending |
| Codebuff | Setup-managed `codebuff-incognito` and `cb-incognito` commands | No | Wrapper/imported sessions eligible when non-headless; headless skipped | Wrapper/imported sessions eligible when non-headless; headless skipped | `privacy-features` E2E positive fixture proof; setup/inventory and command-behavior coverage |
| Cursor Desktop | Incognito skill, using Claude skill when available or native Cursor fallback; setup also installs `cursor-agent-incognito` | Yes | Non-headless GUI sessions eligible; headless skipped | Non-headless GUI sessions eligible; headless skipped | Punted for positive privacy-feature proof: GUI/transcript watcher path has no stable credential-free non-headless hook stream |
| cursor-agent CLI | Setup-managed `cursor-agent-incognito` command when the Cursor integration is installed; watcher has no native slash surface | No | Passive history is local-only and replay-ineligible; native hook sessions use their proven surface | Passive history is local-only and replay-ineligible; native hook sessions use their proven surface | Protected `cursor-agent --print` native/passive identity gate; shared passive store remains surface-unknown |
| Factory Droid | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions eligible; headless skipped | Non-headless plugin sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; no live Droid incognito UX gate yet |
| Pi | Native `trajectory_incognito` tool plus MCP | Yes | Non-headless extension sessions eligible; extension-supplied verdicts accepted; headless skipped | Non-headless extension sessions eligible; headless skipped | Live incognito UX; `privacy-features` E2E positive fixture proof; extension verdict tests |
| Oh My Pi (`omp`) | MCP request path; no setup-managed slash command yet | Yes | Native extension marks headless state; non-headless eligible, headless skipped | Non-headless eligible; headless skipped | Sanitized v16.5.2 setup/capture/backfill fixtures; real executable and positive privacy proof pending |
| Hermes Agent | Incognito skill | Yes | Non-headless observer sessions eligible; headless skipped | Non-headless observer sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; protected live capture coverage; no live incognito UX gate yet |
| Amp Code | Setup-managed `amp-incognito` command plus MCP request path | Yes | Non-headless Amp plugin sessions eligible; headless skipped | Non-headless Amp plugin sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof until a usable `AMP_API_KEY` exists |
| Qwen Code | `/incognito` command and incognito skill | Yes | Non-headless Qwen hook sessions eligible; headless skipped | Non-headless Qwen hook sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; setup plus live capture CI; no live incognito UX gate yet |
| OpenHands | Setup-managed `openhands-incognito` command plus MCP request path | Yes | Current hook payloads have no run-mode field; hook and durable-only sessions are conservatively headless/unknown and skipped | Current hook payloads have no run-mode field; hook and durable-only sessions are conservatively headless/unknown and skipped | Headless-skip and explicit-mode fixture proof; live hook CI plus durable-history local-UI coverage |
| OpenCode | Incognito skill | Yes | Non-headless plugin SDK sessions eligible; headless skipped | Non-headless plugin SDK sessions eligible; headless skipped | Live incognito UX; `privacy-features` E2E positive fixture proof |
| Kilo Code | Incognito skill | Yes | Non-headless plugin SDK sessions eligible; headless skipped | Non-headless plugin SDK sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; setup/live capture coverage |
| ZCode | User incognito skill mediated through `trajectory_incognito` | Yes | Provider-only sessions are conservatively headless/unknown and skipped | Provider-only sessions are conservatively headless/unknown and skipped | Setup, MCP ownership, exact wake, retry accounting, and local-UI fixture proof; authenticated UX pilot pending |
| Kiro CLI | Setup-managed `kiro-incognito` command plus MCP request path | Yes | Prompt/tool hook capture eligible when non-headless; headless skipped | Punted for final segmentation proof: current documented command hooks lack a terminal `SessionEnd` signal | Fixture-only capture plus command-behavior coverage; no positive privacy-feature proof yet |
| CommandCode | Owned `/incognito` command and skill; exact session ID and explicit disable required | Yes | Conservatively headless/unknown until an authoritative mode signal exists | Conservatively headless/unknown until an authoritative mode signal exists | Fixture and Lapdog proof; live authenticated hook/incognito UX pending |
| gptme | Native `/incognito` command | Yes | Explicit non-interactive and unknown modes are skipped | Explicit non-interactive and unknown modes are skipped | Real gptme 0.32.0 mock/echo headless lifecycle gate plus non-headless positive privacy fixture |
| ForgeCode | Owned `/incognito` command and skill; exact session ID required | Yes | Unknown passive mode is conservatively marked headless and skipped | Unknown passive mode is conservatively marked headless and skipped | Fixture and Lapdog proof; live CLI persistence and model-mediated incognito remain follow-ups |
## Publishing and export

```bash
trajectory publish validate          # Verify publish config and credentials
trajectory publish status            # Show effective mode and active sessions
trajectory publish preview           # Preview what would be published
trajectory diagnose publish          # Explain whether traces/metrics should publish
trajectory metrics session --latest  # Preview metrics from local session history
trajectory metrics verify            # Submit current verification metrics proof
trajectory metrics last              # Reprint latest metrics proof
trajectory metrics open              # Reopen latest submitted Metrics Explorer proof
```

`trajectory publish validate` checks configuration, trust policy, and credentials,
including credential source and non-secret value-shape diagnostics. `trajectory
publish status` shows the effective mode, including metrics-only and trace-off
states, and warns when the configured `export.site` has no active destination
(for example `metrics:false` with `traces:off`) while data flows to a different
site. Neither command verifies Datadog intake or readback.

Trace and final-session publish retries use a durable metadata outbox at
`~/.trajectory/state/trace-publish-outbox.sqlite`. If one `trajectory serve`
process captures an event without Datadog credentials, it records the LLMO
artifact identity and returns a publish error instead of silently advancing. Any
other credentialed serve process can later claim a small batch and rebuild the
Datadog payload from the local JSONL. `trajectory doctor` reports pending,
retryable, failed, stale, and dropped trace outbox rows.

`trajectory diagnose publish --session <id>` includes a compact metric publish
plan for that session. Use it first when one session is missing data: it shows
whether the local cache expects metric points, whether the durable metric outbox
has matching rows, and what readback command to run next.

For onboarding, prefer the two metrics fast-path commands:

```bash
trajectory metrics session --latest
trajectory metrics session --session <id>
trajectory metrics verify
trajectory metrics last
trajectory metrics open
```

`metrics session` is a local preview for existing sessions. It reconstructs
the metrics Trajectory derived from the local cache, prints the metric names,
important session tag filters, and outbox status, and does not submit
historical metrics to Datadog. Sessions older than 24 hours are intentionally
treated as local-only previews because remote historical metric intake/readback
is not a reliable onboarding path.

`metrics verify` is the Datadog visibility proof. It submits a current
timestamped verification metric set through the normal metrics publish path,
tries Datadog Metrics readback when one destination and an application key are
ready, and otherwise falls back to submit-only with a notice. Filter the
verification points by the printed `trajectory.canary_run` tag. Pass
`--readback` explicitly when exact readback must be a hard gate.

`metrics last` reprints the latest saved verification proof. `metrics open`
reopens the saved Metrics Explorer URL after a submitted verification. Local-only
verification runs are saved for diagnostics, but `metrics open` refuses them
because no remote Datadog points were submitted.

If `metrics session` reports no eligible destinations, enable base metrics and
refresh live capture before proving visibility:

```bash
trajectory config set export.metrics true
trajectory config reload --yes
trajectory metrics verify
```

For exact readback, store an application key with Metrics query permission and
pin the destination:

```bash
trajectory config set-secret dd_app_key --stdin
trajectory metrics verify --destination <name> --readback
```

Use `trajectory publish metrics audit --latest` when you need the deeper
read-only audit. Add `--builtin-details` to account for every built-in metric
and show whether each one is `observed`, `not_observed`, or `out_of_scope` for
the selected local data. Audit reconstruction suppresses
`content_length_estimate` token and cost rows from authoritative metric
expectations and warns when selected sessions contain them, so lower estimated
cost is explicit instead of silent. To query Datadog for stable dashboard
mirrors outside the first-run flow, run:

```bash
trajectory config set-secret dd_app_key --stdin
trajectory publish metrics audit --latest --readback
```

For cost-only v2 incident triage, prefer `trajectory cost reconcile`. Unlike
the broad audit, it does not derive both sides from the live local cache: it
rematerializes the session JSONL, checks an independent client-native source
where supported, and then reads the retained outbox without initializing or
migrating it. It is local-only; use the broad audit's readback modes when the
question is whether sent points are visible in Datadog.

Use `--readback-all --strict-fidelity` for CI/canaries or incident follow-up
where every sent outbox group, including volatile duration and last-seen
metrics, must read back exactly from Datadog. Strict mode fails if expected
source-tagged rows are missing, extra rows are present, rows are not `sent`,
source labels are unknown, or readback is incomplete.

For older sessions, strict outbox correlation can surface rows emitted before
the current metric catalog provenance tags existed. The audit reports those as
`historical_contract_drift` while still keeping the missing/unexpected parity
counts visible. That state is expected for pre-contract historical rows; seeing
it on a fresh session or canary means the current instrumentation is not
emitting the required provenance tags.

`trajectory publish sync` creates log-based metric definitions through the
Datadog Logs configuration API. That path needs the Datadog API key used for
publish plus a Datadog application key. `publish validate` can accept the API
key while sync still fails if `DD_APP_KEY` / `dd_app_key` is missing or lacks
log configuration write permission. Store the app key with:

```bash
trajectory config set-secret dd_app_key --stdin
```

For full built-in publish fidelity across spoofed coding-agent sources, use the
synthetic canary. Add `--include-diagnostics` when you also want process and
instrumentation-health metric readback:

```bash
trajectory publish metrics canary --clients all --runs-per-client 2 --include-diagnostics --submit --readback
```

The canary generates one expected point for every session-auditable built-in
metric, can optionally emit diagnostic built-ins once per destination, tags each
run with `trajectory.canary_run`, submits through the same
MetricRecord-to-Datadog path, and polls Datadog Metrics until every expected
metric group reads back exactly. Use `--destination <name>` when multiple
Datadog metric destinations are configured.

To diagnose zero-valued task-score loss on an OTLP destination, add
`--zero-task-score-probe`. The canary persists a distinct
`trajectory.task.risk_score=0` row in an isolated durable outbox, verifies the
encoded OTLP point, submits it through the production outbox drain, and reports
intake acceptance separately from exact Datadog query readback. This probe
requires exactly one destination and OTLP metrics transport.

For the publish operations runbook covering validate/status/preview, missing
Datadog data, `publish sync`, and publish ledger repair:

```bash
trajectory user-guide publish
```

For marker-metric readback, use `trajectory markers canary --keep-home`. It runs an isolated synthetic session, validates local marker/cost/token/assistant-message invariants, and prints Datadog query shapes for the configured destination.

`trajectory audit --deep` adds an interpretation block for local capture fidelity, config-driven trace-off states, missing model/cost attribution, and the 24-hour LLMO trace intake backfill limit.

`trajectory audit --source-data` checks the local SQLite cache contracts used by local-ui, including completed-session finalization; exact turn/session rollups for turn count, tools, input tokens, output tokens, cache-aware total tokens, and cost; tool-call parentage; model/cost attribution; sparse turn IDs; contentless active turns; and CODEOWNER resolution-failure categories. Input and output are checked independently so compensating drift cannot hide behind a matching combined token total. CODEOWNER output is categorical counts only: reason is `missing`, `parse_error`, `snapshot_store_error`, or `change_files_unavailable`, and snapshot source is `session_head`, `persisted_snapshot`, or `pr_turn_range`. It never prints paths, Git object IDs, CODEOWNERS contents, or source content. Use `--json` for machine-readable output or `--db <path>` to inspect a non-default cache, and require `session_turn_aggregate_drift` to pass.

For a complete local-data diagnosis, use `trajectory audit data`. It rolls the
cache checks into nine bounded domains covering sessions, conversations,
tools, delegation, usage, outcomes, optional analysis, storage parity, and
local delivery. The default view is one line per domain. Session/file parity
is corpus-wide, while event-level parity defaults to the newest 100 sessions
and prints its exact coverage. Expensive content, usage-outlier, and outcome
checks are also deferred in the bounded profile; use `--all` for the complete
retained-corpus event scan and deep projection checks. Native replay for a
single extreme-token Codex rollout is capped at 64 MiB and reports
`unverified` when the source is larger, missing, or unsupported.
Add `--details` for individual evidence states or `--json` for automation. Missing evidence is
reported separately from a verified zero. In particular, delegation compares
canonical `subagent_start` facts with materialized subagent rows and checks
retained GitHub Copilot CLI history fingerprints directly; Pi delegation is
reported as unsupported.

Diagnosis is read-only. When the report proves exact session-level repairs,
write a content-addressed plan and inspect it before applying:

```sh
trajectory audit data --write-plan repair.json
trajectory backfill apply --plan repair.json --yes
```

To repair one area without suppressing the holistic diagnosis, add a stable
domain filter such as `--only delegation` or
`--only delegation,storage`. Every planned action retains its exact domain and
finding IDs.

Apply refuses expired plans, changed source files, disabled provider features,
and ambiguous repairs. It reuses full-session import/index paths and verifies
that every planned parity gap is closed. It writes an immutable
`repair.json.receipt.json` by default; use `--receipt PATH` to select another
new path. `trajectory doctor` uses this same data-health report and points to
the detailed audit; it never applies a plan.

For a cleaner troubleshooting flow across doctor, diagnose, audit, validate-spans, and support bundles:

```bash
trajectory user-guide diagnostics
```

For the full metric catalog, see [METRICS-REFERENCE.md](METRICS-REFERENCE.md).

## Local UI and resume

Start local-ui on the preferred default port 8888:

```bash
trajectory local-ui
```

Use Lapdog against local Trajectory data:

```bash
trajectory local-ui --lapdog
```

The viewer groups Browse, Transcript, and Insights under **Session**, while
Usage, Metrics, Skills, and Automated Oversight live under **All sessions**.
On wider screens, the session list docks beside the selected session so
session stats remain visible while switching between sessions.
The **Metrics** tab includes focused Cost, Time, and Reliability views plus
**Explore** for time ranges, comparisons, trends, series, and catalog analysis.
Ranked expensive or long turns link back to their sessions, and reliability
views summarize repeated tool failures and permission denials without exposing
prompt or tool content in aggregate responses.

The session drawer shows whether session JSONL exists and the last durable
local-cache indexing result. Pending pages, active files waiting for retry, and
indexing errors include the matching `trajectory backfill --index-local`
continuation command. A completed timestamp describes the latest indexing run,
not files created afterward.

Reconstruct a captured session into another supported client:

```bash
trajectory resume --list-targets
trajectory resume --session <id> --target codex --dry-run
trajectory resume --session <id> --target codex
```

Read the embedded guides for details:

```bash
trajectory user-guide onboarding
trajectory user-guide local-ui
trajectory user-guide source-provenance
trajectory user-guide resume
```

## Datadog dashboards

Trajectory ships embedded Datadog dashboards for enterprise, developer,
operations, skill observability, data fidelity, and install outcomes views.
The install-outcomes view exposes lifecycle components, agent discovery,
recovered retries, deployed versions, and installer revisions so missing
telemetry is not mistaken for success.

```bash
trajectory dashboard export --type enterprise --output trajectory-enterprise.json
trajectory dashboard export --type developer --output developer-dashboard.json
trajectory dashboard export --type operations --output trajectory-operations.json
trajectory dashboard export --type skill-observability --output trajectory-skill-observability.json
trajectory dashboard export --type data-fidelity --output trajectory-data-fidelity.json
trajectory dashboard export --type install-outcomes --output trajectory-install-outcomes.json
trajectory dashboard export --type operations --format mcp --output trajectory-operations-mcp.json
trajectory dashboard export --type skill-observability --format mcp --output trajectory-skill-observability-mcp.json
trajectory dashboard export --type data-fidelity --format mcp --output trajectory-data-fidelity-mcp.json
trajectory dashboard export --type install-outcomes --format mcp --output trajectory-install-outcomes-mcp.json
```

Trajectory exports dashboard JSON; it does not create the Datadog dashboard
directly. Import the default `raw` JSON through the Datadog dashboard API or
Datadog UI JSON import flow. Use `--format mcp` when importing through the
Datadog MCP `upsert_datadog_dashboard` tool. The MCP format keeps the payload
to the tool's expected fields (`title`, `description`, `tags`,
`template_variables`, and `widgets`), converts template variable `default`
values to `defaults`, and keeps only `team:` dashboard tags because the MCP
dashboard tool accepts only team tags.

The `skill-observability` dashboard is the narrow skill-maintainer view. It
answers which skills are used by repo, how often they are invoked, which source
produced the signal, how many tools and tool types appear in skill-assisted
turns, whether complexity came from native trace attribution or fallback, p95
duration, and cost-source context. It intentionally visualizes
metrics only, not raw prompts, tool outputs, or full coding-agent trace I/O.

The `data-fidelity` dashboard is the instrumentation trust view. It shows
metric provenance, model/user/client attribution, repo-source coverage, skill
signal provenance, instrumentation-health fallback/failure counters, and a
`PR CODEOWNER Fidelity` panel for exclusive coverage, canonical reconciliation,
bounded resolution status, and owner-cap overflow.

The `install-outcomes` dashboard is the managed rollout and onboarding view. It
uses installer attempt metrics for pre-binary and retry behavior, then uses
`trajectory.ops.install.current_state` and `trajectory.ops.install.agent_state`
as the durable setup and per-integration state once the binary runs.

The `operations` dashboard includes the low-cardinality coding-agent usage view:
installed agents, installed agent versions, active sessions by client, and
active-session versions. Use it to answer which coding agents are present and
which ones are actually being used without tagging by session ID or project
path.

For PR production and CODEOWNER cost widgets, use the packaged dashboard export
as a starting point and follow the cost-attribution contract:

```bash
trajectory dashboard export --type enterprise --output trajectory-enterprise.json
trajectory dashboard export --type developer --output developer-dashboard.json
trajectory dashboard export --type data-fidelity --output trajectory-data-fidelity.json
trajectory user-guide cost-attribution
```

The enterprise template includes `PR Work & CODEOWNER Attribution`. The
developer template uses canonical PR work and a flat non-additive owner view;
it does not use the legacy creation-tail metrics as its PR-work total. The
data-fidelity template carries the coverage and resolution diagnostics.
Canonical ungrouped PR-work metrics provide additive totals. CODEOWNER groups
overlap and cannot be summed. The exclusive attributed/unattributed coverage
pairs reconcile to the canonical PR-work measurement under identical filters.
There is no honest Datadog formula that turns the current overlapping owner
series into mutually exclusive owner allocation.

## Privacy Controls

Use `/incognito` when the current session should not publish trace-like content to ordinary Datadog observability destinations. Local JSONL capture continues, as does task segmentation; publish to non-exempt Datadog destinations is suppressed for trace and log outputs such as traces, logs, evaluations, records, and AI-usage events. Aggregate metrics continue without content-bearing user data and cannot be disabled through incognito. Active-session sensitivity scans are skipped, and the toggle resets when the session ends. Org-managed destinations configured with `incognito_exempt: true` may still receive events for approved security or audit use cases.

Use `<sensitive>...</sensitive>` blocks as an explicit signal to the agent and to human readers:

```text
<sensitive>
Customer details, HR/legal content, credentials, or private investigation notes.
</sensitive>
```

These tags are a convention, not a redaction boundary. Trajectory may capture the tags and enclosed text locally. If ordinary publish should be suppressed, enable `/incognito` before sharing the content, and keep sensitive values out of metric tags and marker dimensions.

The embedded `privacy` topic gives the managed-install and sensitivity-scanning version of this guidance:

```bash
trajectory user-guide privacy
```

## Backfill

Use backfill for maintenance: importing historical sessions, refreshing the
local UI cache, or auditing historical metric derivation locally. Historical
token/cost attribution is not republished by ordinary backfill; an explicit
user-driven Codex repair can publish an isolated additive cost namespace.
Corrections roll forward. Backfill is not required for
first-run metric onboarding; use `trajectory metrics session --latest` and
`trajectory metrics verify` first.

Claude Code imports and token repair honor `CLAUDE_CONFIG_DIR` as an exclusive
config root, reading transcripts from `$CLAUDE_CONFIG_DIR/projects` instead of
`~/.claude/projects` when it is set. The two roots are never merged.

```bash
trajectory backfill --from-claude-code --republish-local  # Claude Code transcripts + local UI
trajectory backfill --republish-local                  # Refresh local UI from cached sessions
trajectory backfill --from-codex-sessions --limit 100  # active then archived Codex rollouts
trajectory features enable copilot_durable_history     # one-time Copilot history opt-in
trajectory backfill --from-copilot-sessions            # GitHub Copilot CLI session-state history
trajectory backfill --from-gemini-transcripts          # effective-home Gemini chat history
trajectory features enable hermes_durable_history      # one-time Hermes history opt-in
trajectory backfill --from-hermes --session <id>       # explicit Hermes state.db repair
trajectory backfill --from-opencode --session <id>     # SQLite or retained JSON history
trajectory features enable qwen_durable_history        # one-time Qwen history opt-in
trajectory backfill --from-qwen-sessions --session <id> # active/archive Qwen chat JSONL
trajectory repair metrics                              # Local-only historical metric repair preview
trajectory backfill-my-metrics --since 2026-07-05 --until 2026-08-05 --yes # user-driven Codex cost repair
```

The explicit user-driven Codex repair can cover up to the effective
`capture.retention_days` age window (`0` keeps history forever), reads only the
user's Codex/Codex.app rollout history, requires `--yes` for publication, and
uses the resolved Datadog metric destinations. When no dates are supplied, the
historical 30-day default is capped by the configured retention. It publishes only
`trajectory.historical.turn.cost.usd.additive` and is idempotent for the same
window. Use `--campaign <id>` only when an organization-managed replay is
specifically required; ordinary user-driven repair does not need a campaign.

Codex and local-cache backfills use `--limit` as a per-chunk size. The command
reports the total file and chunk counts before starting, then runs every chunk
without requiring a separate `--continue` invocation. `--continue` remains
available to resume from the saved cursor after an interrupted run.

Read the full embedded guide for modes, local UI repair, local historical metric
audit, and structured record backfill:

```bash
trajectory user-guide backfill
trajectory user-guide source-provenance
```

## Viewing logs

```bash
trajectory logs                      # Last 50 lines of serve log
trajectory logs -f                   # Follow (tail -f style)
trajectory logs -n 100               # Last 100 lines
trajectory logs --grep publish       # Filter by keyword
trajectory logs -f --grep error      # Follow errors only
```

## Markers

Markers are YAML-defined behavioral signals that Trajectory evaluates against captured sessions. They produce points, multi-turn ranges, and measures that can be exported to Datadog as `trajectory.<scope>.<concept>` metrics (where `<scope>` is one of `turn`, `session`, `task`, `commit`, or `pr`). LLM Obs marker evaluations are separate and stay off unless a destination explicitly sets `markers.evaluations: true`.

Read the full guide in [MARKERS.md](MARKERS.md), or from the binary:

```bash
trajectory user-guide markers
trajectory user-guide repo-markers
```

Trajectory layers embedded built-ins, org markers, user add-ons in `~/.trajectory/markers.d/*.yaml`, user markers in `~/.trajectory/markers.yaml`, and project markers in `.trajectory/markers.yaml`. For repo-level rollout, keep marker definitions in `.trajectory/markers.yaml` and destination selection or marker metric enablement in `publish.trajectory.yaml`.

To opt in to the optional security catalog:

```bash
trajectory markers enable-security
```

This writes `~/.trajectory/markers.d/security.yaml`; delete that file to disable the add-on. Use `--output PATH` to write the template somewhere else, or `--force` to overwrite an existing output file.

## Built-in help

The binary includes a full user guide with detailed topics:

```bash
trajectory user-guide                # List all topics
trajectory user-guide config         # Configuration deep-dive
trajectory user-guide llm-capacity   # LLM capacity and expense controls
trajectory user-guide backfill       # Historical import, local UI repair, and metric backfill
trajectory user-guide local-ui       # Browser viewer, local-ui, and cache repair
trajectory user-guide source-provenance # Local-ui source kind and mechanism inventory
trajectory user-guide publish        # Per-repo publish config
trajectory user-guide dashboards     # Datadog dashboard export and MCP import
trajectory user-guide skill-observability # Skill usage and attribution
trajectory user-guide markers        # Marker authoring and metrics
trajectory user-guide repo-markers   # Repo marker file plus publish overlay workflow
trajectory user-guide metrics        # Metric gates, names, tags, and queries
trajectory user-guide mcp            # MCP tools, resources, and SQL query workflow
trajectory user-guide query          # Local cache data and guarded MCP SQL workflow
trajectory user-guide cursor-cost    # Cursor token formula, rate provenance, and rollout
trajectory user-guide privacy        # Incognito, sensitive tags, and sensitivity scanning
trajectory user-guide diagnostics    # Doctor, diagnose, audit, validate-spans, support bundles
trajectory user-guide resume         # Reconstruct captured sessions into other clients
trajectory user-guide clients        # All supported clients
trajectory user-guide clients/claude-code # Claude Code-specific details
trajectory user-guide clients/codex  # Codex-specific details
trajectory user-guide clients/copilot # GitHub Copilot CLI beta details
trajectory user-guide clients/cursor # Cursor-specific details
trajectory user-guide clients/droid  # Factory Droid beta details
trajectory user-guide clients/gemini # Gemini-specific details
trajectory user-guide clients/hermes # Hermes Agent observer and durable history details
trajectory user-guide clients/amp    # Amp Code system plugin details
trajectory user-guide clients/goose  # Goose-specific details
trajectory user-guide clients/cline  # Cline CLI file hook details
trajectory user-guide clients/aider  # Aider command shim and native-history details
trajectory user-guide clients/continue # Continue CLI command shim and session JSON details
trajectory user-guide clients/mistral-vibe # Mistral Vibe command shim and hook details
trajectory user-guide clients/grok   # Grok Build native hooks and durable history details
trajectory user-guide clients/codebuff # Codebuff command shim and chat-history import details
trajectory user-guide clients/qwen   # Qwen Code native HTTP hook details
trajectory user-guide clients/kilo   # Kilo Code plugin and OTLP relay details
trajectory user-guide clients/kiro   # Kiro CLI agent command hook details
trajectory user-guide clients/devin  # Devin CLI source reconciliation details
trajectory user-guide clients/qoder  # Qoder CLI plugin and source reconciliation details
trajectory user-guide clients/zcode  # ZCode wake hooks, SQLite reconciliation, and repair details
trajectory user-guide clients/commandcode # CommandCode transcript reconciliation details
trajectory user-guide clients/zed    # Zed passive-history reconciliation details
trajectory user-guide clients/kimi   # Kimi Code CLI provider-source details
trajectory user-guide clients/gptme  # gptme native plugin and durable source details
trajectory user-guide clients/codewhale # CodeWhale saved-session/runtime-store preview
trajectory user-guide clients/forgecode # ForgeCode passive-history preview
trajectory user-guide clients/warp   # Warp Desktop / local Oz provider-store details
trajectory user-guide clients/windsurf # Windsurf Cascade hooks and source reconciliation details
trajectory user-guide clients/pi     # Pi-specific details
trajectory user-guide clients/opencode # OpenCode-specific details
trajectory user-guide install        # Installation methods
```

## Filtering by user

Every span and metric emitted by trajectory carries a `trajectory.user` tag set to your Unix username. Override it with the `TRAJECTORY_USER` environment variable.

Trajectory can also emit `trajectory.user_email` when configured. Resolution uses the first successful value: `TRAJECTORY_USER_EMAIL`, then `identity.user_email`, then `identity.user_email_command`, then `identity.user_email_suffix` appended to `trajectory.user`. Config values follow normal layering first (`config.defaults.yaml`, assigned `cohort.yaml` when present, then `config.yaml`). If both command and suffix are set, the command wins when it returns a valid email; otherwise Trajectory falls through to the suffix.

```bash
trajectory setup --clients codex --user-email "$(git config --global user.email)"
trajectory config set identity.user_email user@example.com
trajectory config set identity.user_email_suffix datadoghq.com
trajectory config set identity.user_email_command "git config --global user.email"
trajectory config reload --yes
export TRAJECTORY_USER_EMAIL=user@example.com
```

Identity tags are optional. `git.email` resolves from `TRAJECTORY_GITHUB_EMAIL`, then `identity.github_email`, then `identity.github_email_command`, then repo-local `git config user.email`, then global `git config user.email`. `github.username` resolves from `TRAJECTORY_GITHUB_USERNAME`, then `identity.github_username`, then `identity.github_username_command`, then repo-local `git config github.user` or `github.username`, then global Git config. Repo-local values win over global values, and commands win over Git config when they return valid values.

Run `trajectory config reload --yes` after persistent `identity.*` changes and
confirm with `trajectory ps`; new spans and metrics use the updated tags after
live serve reloads or safely restarts. Environment overrides apply only to
processes launched with that environment.

Use these tags to filter in LLM Obs and Metrics Explorer:

- **LLM Obs**: filter traces by `@trajectory.user:<your-name>`
- **Metrics Explorer**: scope dashboards with `trajectory.user:<your-name>`
- **Identity**: filter with `github.username:<your-gh-login>` or `git.email:<your-git-email>` when configured or resolved from Git config

This is useful on shared machines or CI where multiple users generate sessions.

## Custom publish tags

Add a top-level `tags:` map to `~/.trajectory/config.yaml` or managed
`~/.trajectory/config.defaults.yaml` when every published Datadog coding-agent
signal from that machine should carry the same low-cardinality deployment tags:

```yaml
tags:
  team: platform
  environment: development
  workspace: cloud
```

These tags are applied at publish time to Datadog LLM Obs spans and Trajectory
DD metric series for base, marker, heartbeat, and task metrics. They are not
written to local JSONL, and they are not added to OTLP exports, Claude native
OTLP proxy metrics, or process-level health/privacy counters.

User and managed `tags:` maps are additive. When the same key appears in both,
the managed `config.defaults.yaml` value wins. Destination-level `tags:` in
trusted destinations or `publish.trajectory.yaml` remain destination-scoped, but
managed top-level tags are reapplied for shared keys.

Keep custom tags stable and non-sensitive. Avoid prompts, paths, URLs,
arbitrary emails, SHAs, random IDs, and secrets. Use `identity.*` settings for
user/email/GitHub attribution instead of custom keys.

## Repo tags on metrics

Trajectory enriches session-scoped DD metrics with bounded repository labels:

- `repo` - Git repository name when Trajectory can parse the remote origin;
  otherwise the project directory basename; `unknown` when neither is available.
- `owner` - org or user from the parsed Git remote; `unknown` for fallback repo
  labels.
- `git_remote_host` - Git remote host from the parsed origin; `unknown` for
  fallback repo labels.
- `trajectory.repo_source` - provenance for the repo labels:
  `git_origin`, `git_origin_unparsed`, `project_dir`, `configured`, or
  `unknown`.

For high-trust repository dashboards, filter `trajectory.repo_source:git_origin`
before grouping by `repo` or `owner`. Use `trajectory.repo_source:project_dir`
or `unknown` to audit fallback coverage instead of mixing fallback labels into
repo rankings.

## Completed-sample distributions

Trajectory publishes distribution metrics for completed samples that are useful as populations in Metrics Explorer. Use percentile aggregators such as `p95:` on these names after Datadog percentile aggregations are enabled for the metric:

- `trajectory.turn.tool_uses.total` - total tool calls in a completed turn. This
  is intentionally separate from the `trajectory.turn.tool_uses` gauge, which
  uses canonical names for registered common tools, preserves specialized
  extension names, adds normalized `tool_type`, and adds `mcp_server`,
  `mcp_tool`, and `mcp_source_scope` for MCP calls with derivable sanitized
  provenance.
- `trajectory.turn.cost.usd.total` - estimated USD cost of a completed turn.
- `trajectory.turn.web_search.requests.total` and `trajectory.turn.web_search.cost.usd.total` - completed-turn WebSearch request and cost samples.
- `trajectory.turn.duration_ms.total` - duration of a completed turn when the client provides or Trajectory can derive it.
- `trajectory.turn.permission_wait_ms.total` - estimated human approval wait inside a completed turn, emitted when Trajectory can derive a permission wait interval.
- `trajectory.turn.duration_ms.excluding_permission_wait.total` - completed-turn duration minus derivable permission wait, useful when you want agent elapsed time with approval waits removed.
- `trajectory.turn.permission_prompts` - permission prompt counts split by `decision`, `permission_mode`, and `approval_path` (`manual_prompt`, `auto_mode_prompt`, `auto_classifier`, or bounded fallbacks). Legacy inferred tool accepts use `permission_mode:not_captured`; `unknown` is reserved for source data that is missing or malformed.
- `trajectory.session.turns.total`, `trajectory.session.tool_uses.total`, `trajectory.session.cost.usd.total`, `trajectory.session.web_search.requests.total`, `trajectory.session.web_search.cost.usd.total`, and `trajectory.session.compactions.total` - completed-session samples.
- `trajectory.session.web_search.requests` and `trajectory.session.web_search.cost.usd.accumulated` - running and final observed WebSearch request and cost gauges.
- `trajectory.pr.cost.usd.attributed.total`, `trajectory.pr.attributed_turns.total`, and `trajectory.pr.containing_session.cost.usd.total` - completed-PR samples for PR cost attribution dashboards. When Trajectory extracts the PR/MR URL, these carry `change_host`, `owner`, `repo`, and `change_number`.
- `trajectory.turn.prs` - one count sample for the turn that created a PR/MR, tagged with PR/MR identity, `session_id`, and `trajectory.turn_id`.
- `trajectory.pr.contexts.total`, `trajectory.pr.interactions.total`, `trajectory.pr.work_turns.total`, `trajectory.pr.work_duration_ms.total`, and `trajectory.pr.work.{cost.usd,input_tokens,output_tokens,cache_read_tokens,cache_creation_tokens}.total` - durable PR/MR work context, explicit interaction, and primary-assignment spend metrics. Canonical rows carry `source:prwork`, bounded PR identity, context/range confidence, and cost-overlap tags where applicable.
- `trajectory.codeowner.pr.production.{turns,cost.usd,input_tokens,output_tokens,cache_read_tokens,cache_creation_tokens}.total` - six per-owner PR production-involvement distributions. They overlap across normalized `trajectory.codeowner` values and must never be stacked or summed as a total.
- `trajectory.pr.work.codeowner_{attributed,unattributed}_{turns,cost.usd,input_tokens,output_tokens}.total` - eight exclusive coverage distributions. Under identical filters, each attributed/unattributed pair sums to the matching canonical PR-work measurement.
- `trajectory.turn.pr_contexts` - exact turns where PR/MR context evidence was observed, tagged with PR/MR identity, `session_id`, `trajectory.turn_id`, `context_source`, and `signal_confidence`.
- `trajectory.session.last_seen.unix` - latest observed session event time as Unix seconds, useful for recency-sorted session tables. Enable Historical Metrics Ingestion for this gauge before replaying sessions older than one hour.

For Claude Code comparisons, treat these as the qualified active-time breakout:
`trajectory.turn.duration_ms.total` is total agent turn elapsed time,
`trajectory.turn.permission_wait_ms.total` is derivable human approval wait, and
`trajectory.turn.duration_ms.excluding_permission_wait.total` is elapsed time
with that derivable approval wait removed. They are comparable operational
signals, not an exact replacement for native `claude_code.active_time.total`
foreground/idle-excluded activity.

## Per-commit and PR cost attribution

Marker compute blocks (`sum` and `count` over turn windows) enable per-commit cost attribution. When a session contains multiple commits, trajectory can attribute token spend and tool call counts to the turns that produced each commit.

This powers the `trajectory.commit.cost.usd.total` and `trajectory.commit.attributed_turns.total` distribution metrics, letting you answer "how much did this commit cost?" and percentile questions such as p95 cost per commit in Metrics Explorer, optionally split by the `branch` tag.

PR attribution metrics support direct PR-to-session lookup when local captured command output contains normalized GitHub or GitLab change identity, including enterprise/self-hosted hosts. The legacy creation-tail metrics remain available for newly created PRs. Durable existing-PR work emits context, interaction, assigned-turn duration, cost, token, and CODEOWNER production metrics from local command evidence and bounded Git state. Production ownership includes successful current-session writes and eligible exact files from immutable session-produced commit evidence. Entry baselines, downloaded PR contents, fetch/pull/switch/rebase/reset imports, and merge or cherry-pick alone are excluded. Trajectory does not call a provider API, reuse user credentials, or publish commands, paths, CODEOWNERS patterns, refs, object IDs, URLs, diffs, email owners, or source content. Read/search ownership remains a later, separately labeled investigation contract.

Each completed turn has at most one primary PR spend assignment, while a one-off `gh pr view`, `checks`, or `diff` remains an explicit interaction even when another workspace is primary. Filter by `source:prwork`, `change_host`, Git repository `owner`, `repo`, and `change_number`, then group by `session_id`, `trajectory.turn_id`, `context_source`, or `work_context_mode` for drilldown. CODEOWNER identities use the separate `trajectory.codeowner` tag and are normalized without a leading `@`.

Managed installs may separately enable `pr_attribution` structured records for richer PR/MR drilldown; repo configs and security destinations cannot enable those records. Schema v2 emits one stable-dedup record per finalized durable context. Its public repository namespace is `repo_owner` (not the metric tag `owner`), and its parallel `codeowners` and `codeowner_kinds` arrays contain at most five normalized identities. `retroactive_membership:true` applies only to that record's `creation_window` context. Retroactive finalization updates the local/final context projection; it does not rewrite turn-root spans that were already accepted by the cloud before PR identity was known.

These PR, turn, and session metrics are projections of the same underlying
usage; do not add them together. CODEOWNER groups are also overlapping
associations rather than allocations. Run `trajectory user-guide
cost-attribution` before building a total, owner ranking, or coverage widget.
Within the PR-work projection, `trajectory.pr.work.cost.usd.total` is additive
across mutually exclusive primary assignments, but it reuses completed-turn
cost and must not be added to turn, session, or creation-tail PR totals.
For dashboards, use a flat owner Top List labeled `overlapping` or
`non-additive`, keep the total on the canonical ungrouped PR-work metric, and
build coverage only from the exclusive attributed/unattributed pairs. The
bounded source/status diagnostics never expose commands, paths, refs, object
IDs, diffs, CODEOWNERS patterns, or source content.
Session-end `trajectory.codeowner.resolution_failures.total` and the local
`trajectory audit --source-data` report provide bounded categorical failure
counts without publishing or displaying those raw values.
