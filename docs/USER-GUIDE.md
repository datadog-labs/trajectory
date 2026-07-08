# Trajectory User Guide

Trajectory captures sessions from AI coding agents and exports them to Datadog LLM Observability. This guide covers the CLI commands you'll use day-to-day.

## Check status

```bash
trajectory onboard                   # Local-first first-run readiness and next actions
trajectory status                    # Terminal dashboard with session metrics
trajectory metrics session --latest  # Local metrics preview for existing sessions
trajectory metrics verify            # Current Datadog metrics visibility proof
trajectory metrics last              # Reprint latest metrics proof
trajectory metrics open              # Reopen latest submitted Metrics Explorer proof
trajectory cost                      # Local cost summary and top sessions
trajectory local-ui                  # Start local UI, preferring port 8888
trajectory ps                        # Show live Trajectory processes
trajectory doctor                    # Plain-language local health, span, and metric diagnosis
trajectory doctor --verbose          # Full low-level doctor report
trajectory inventory refresh --json  # Refresh local agent and capability inventory
trajectory inventory show --json     # Read the latest local inventory artifact
trajectory plugins list              # Show opt-in product activation profiles
trajectory plugins show datadog-security # Show Datadog Security activation
trajectory security status           # Shortcut for the Datadog Security plugin
trajectory modules list              # Show compiled optional modules and status
trajectory modules capabilities <id> # Show one module's declared capabilities
trajectory modules install-plan <id> # Preview setup-managed module hooks
trajectory modules records --limit 20 # Show recent local module decisions
trajectory features list             # Show feature flags and effective sources
trajectory diagnose publish          # Explain capture, local mapping, and publish expectations
trajectory logs [-f] [--grep PAT]   # View capture server logs
trajectory version                   # Print version
```

`trajectory onboard` is the first command to run after install. It refreshes
local inventory, summarizes config and detected client readiness, and prints
the exact next commands for setup, a first real agent session, local proof,
local UI, Datadog validation, and the install outcomes dashboard. It does not
mutate client hooks or Datadog configuration.

`trajectory doctor` is the first thing to run if something isn't working. It starts with plain-language Datadog span-publish and metric-visibility answers: whether local config, capture state, credentials, retry queues, and metric destinations look ready, plus the next command to run. The full low-level report is still saved to `~/.trajectory/doctor-report.txt`; use `trajectory doctor --verbose` when you need the detailed subsystem checks in the terminal.

`trajectory inventory refresh --json` refreshes a first-class local inventory artifact under `~/.trajectory/inventory/` and prints a structured snapshot of detected agents and Trajectory-managed capabilities such as hooks, MCP entries, skills, commands, plugins, and settings sources. `trajectory inventory show --json` reads `current.json` without rescanning, and `trajectory inventory list --json` lists the hash-named snapshots under `snapshots/` for support triage or product-pack drift checks. Trajectory does not publish these inventory artifacts to Datadog yet.

`trajectory plugins list` shows opt-in product activation profiles layered over
compiled modules. Baseline `trajectory setup` remains observability-only; use
`trajectory security setup --mode observe --clients cc,codex,cursor` to enable
the Datadog Security plugin for explicit supported clients. Enforce mode can
block agent actions and requires `--yes`. Use `trajectory security disable
--clients ... --remove-hooks` to disable config and remove stale
Trajectory-managed dispatcher hooks while preserving baseline capture hooks.

`trajectory modules list` shows compiled optional modules such as
`agent-security` and `ccm`. Use `trajectory modules capabilities <id>` to see
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

Use `trajectory local-ui` to start the local inspection API and browser viewer on `http://127.0.0.1:8888`, or on the next available port if the default is occupied by another process. For hosted Lapdog backed by local Trajectory data, run `trajectory local-ui --lapdog` and use the printed Lapdog URL; its `portOverride` matches the active local-ui port.

Use `trajectory diagnose publish --session <id>` when Datadog data is missing or surprising. It compares local capture and local JSONL-to-span mapping against the transcript, then adds a metric publish plan from the local SQLite cache: expected metric counts, durable outbox row counts, missing expected rows, and the exact readback follow-up command. It does not query Datadog readback.

`trajectory doctor` also checks recent local session-end fidelity. The `Session-end local fidelity` row compares recent Trajectory JSONL against known native transcript, rollout, or hook-log evidence. It fails when a native source has strong terminal evidence such as `SessionEnd`, `shutdown_complete`, `away_summary`, or `stop_hook_summary` but the Trajectory JSONL has no terminal `session_end`. For that case, run `trajectory doctor --reconcile-session-end`; it auto-discovers recoverable sessions, prints the exact files and native evidence, and prompts before appending anything. To inspect one session directly, run `trajectory publish session-end reconcile --session <id> --dry-run`. Applying direct repair requires the interactive confirmation prompt or `--yes`; it refuses active sessions, appends a synthetic terminal `session_end` only when strong native terminal evidence is still present, then retries final publish. It warns on stale terminal anchors such as `Stop` or `task_complete` when no fresh session heartbeat remains; start those with `trajectory diagnose publish --session <id>`.

Use `trajectory user-guide claude-cost` when Claude cost overlap or native-cost parity is unclear. It covers `trajectory verify claude-cost route` for read-only route classification, `trajectory verify claude-cost transcript --session <id>` for transcript-vs-capture fidelity checks, and `trajectory verify claude-cost artifacts --dir <artifact-dir>` for native OTel canary artifacts that can prove equality against `claude_code.cost.usage`.

Use `trajectory flare` only as a debug/support action when you need to share a redacted ZIP under `~/.trajectory/` with doctor output, process state, metrics fast-path diagnostics, config files, managed `config.defaults.yaml`, cohort overlay files, log tails, and version/pricing metadata. It is not part of the normal onboarding path. `trajectory doctor --support-bundle` remains available for the older single-JSON support summary.

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
trajectory config reload             # Dry-run live serve reload/restart plan
trajectory config reload --yes       # Reload live serve config; restart only when required
trajectory update reconcile          # Dry-run old-version serve process refresh
trajectory update reconcile --yes    # Start a replacement and retire safe old-version serve processes
trajectory config set-secret <name>  # Store a secret in the OS keychain
trajectory config get <key>          # Read a single value
trajectory features enable <name>    # Persist a user feature-flag override
trajectory features disable <name>   # Persist a user feature-flag kill switch
```

Common settings:

```bash
trajectory config set export.site datadoghq.com
trajectory config set export.traces standard       # off | minimal | standard | full
trajectory config set export.metrics true
trajectory config set export.placeholder_llm_span false  # omit synthetic cost-only LLM spans
trajectory config set export.index_traces.session true    # optional standalone session index span
trajectory config set export.subagent_span_mode links_only # optional: links only, no parent-side subagent task spans
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
place. Listener, capture, sensitivity, org-sync, module, and similar process
shape changes report restart-required keys and use the safe replacement
fallback.

After a binary update, existing `trajectory serve` processes keep running the
old executable image until replaced. Run `trajectory update reconcile` to
compare per-PID serve health against the installed binary version. The default
dry-run reports old-version standalone serve processes and blockers. With
`--yes`, Trajectory starts a target-version replacement first, waits for fresh
target-version health, then signals only old-version standalone `serve` PIDs
that have no fresh session heartbeat or active publish outbox claim. Automatic
post-update signaling is guarded off by default; set
`TRAJECTORY_UPDATE_RECONCILE_PROCESSES=1` only when you want `trajectory update`
to run that `--yes` path after a successful binary replacement.

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

These controls are separate: destination `type` chooses the backend/transport,
`export.traces` or destination `level` controls LLM Obs trace spans, and
`export.metrics` plus destination metric settings control metrics.
Use `type: datadog` for direct Datadog destinations, `type: datadog_agent` for
Agent-managed publishing, or `type: otlp` for OpenTelemetry collectors in new
explicit configs. OTLP destinations set a base collector `endpoint`; Trajectory
derives `/v1/traces`, `/v1/metrics`, and `/v1/logs` from it. Legacy
`type: dd_llmobs` still works.

Managed or trusted destinations can also opt in to module custom spans with
`module_spans.enabled: true`. This is for module-owned APM-style spans such as
AI Guard hook evaluations, not for ordinary LLM Obs turn traces. The local
source is `~/.trajectory/modules/spans.jsonl`; publishing is off by default,
scoped to named modules, deduped through the publish ledger, and blocked from
repo `publish.trajectory.yaml` project config. Datadog destinations send these
as agentless OTLP traces, and `type: otlp` destinations send them directly to
the configured collector. Use `otlp_traces_url` only for test or special
Datadog trace-intake routing.

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
default `privacy_profile: security` mode keeps structural event metadata plus
pre-tool arguments for detections while omitting prompts, assistant text,
thinking text, post-tool output/results, raw payloads, error text, summaries,
and user email fields. See `trajectory user-guide security-event-stream`.

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

For fleet-wide local-ui auto-start rollback, deploy `local_ui.auto_start: false` in managed `~/.trajectory/config.defaults.yaml`. A managed false value disables automatic local-ui startup and cannot be overridden from user `config.yaml`; explicit `trajectory local-ui` commands still work.

## Capture server

The capture server receives hook events from your coding agent on port 19222.

```bash
trajectory serve                     # Start capture server (foreground)
trajectory dev serve                 # Start in dev mode (auto-restart on binary change)
```

The server starts automatically when your agent launches a session (via plugin hooks). You rarely need to start it manually.

## Querying sessions

```bash
trajectory status                    # Overview of recent sessions
trajectory status --session <id> --json
trajectory cost inspect --session <id>
trajectory cost observations --session <id>
trajectory cost validate
trajectory local-ui                  # Open local-ui, preferring http://127.0.0.1:8888
trajectory local-ui --lapdog         # Hosted Lapdog with local port override
trajectory user-guide query          # Local data and safe MCP query workflow
trajectory user-guide costs          # Cost tracking commands and fidelity checks
```

The current OSS binary does not expose a general-purpose `trajectory query`
CLI. Use `trajectory status`, `trajectory local-ui`, `get_session_trajectory`, and
the `trajectory_schema` / `trajectory_query` tools for local inspection. Pi
registers those as native extension tools; setup-managed MCP clients get the
same schema-first workflow through `trajectory mcp`. The embedded query guide
documents schema-first inspection and `TRAJECTORY_CACHE_DB` handling.

Use `trajectory cost` for local cost tracking. It reads the local SQLite cache
in read-only mode, shows recent cost totals, inspects turn-level cost evidence,
reports objective cost observations without causal claims, and validates recent
cost fidelity for Claude Code, Codex, Gemini, Antigravity, Aider, Pi, OpenCode, Kilo
Code, and Cursor.

## MCP tools

Setup-managed clients launch `trajectory mcp` automatically to expose local
agent introspection tools and resources. The MCP server covers status, active
sessions, JSONL-derived session data, marker evaluation, incognito, and guarded
read-only SQLite access.

| Surface | Names |
|---------|-------|
| Tools | `trajectory_status`, `list_active_sessions`, `get_session_trajectory`, `evaluate_markers`, `trajectory_incognito`, `trajectory_schema`, `trajectory_query` |
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
trajectory setup --clients copilot   # Add or refresh GitHub Copilot CLI beta live capture
trajectory setup --clients agy       # Add or refresh Antigravity CLI capture
trajectory setup --clients goose     # Add or refresh Goose capture
trajectory setup --clients cline     # Add or refresh Cline CLI capture
trajectory setup --clients aider --install-client-shims     # Add or refresh Aider shim capture
trajectory setup --clients continue --install-client-shims  # Add or refresh Continue CLI shim capture
trajectory setup --clients mistral-vibe --install-client-shims # Add or refresh Mistral Vibe shim capture
trajectory setup --clients codebuff --install-client-shims  # Add or refresh Codebuff shim capture
trajectory setup --clients kilo      # Add or refresh Kilo Code capture
trajectory setup --clients kiro      # Add or refresh Kiro CLI capture
trajectory setup --clients droid     # Add or refresh Factory Droid beta live capture
trajectory setup --clients all       # Add or refresh all setup-managed clients
trajectory setup --clients cc --forward-url URL  # Also forward finished sessions to a local sink
trajectory setup auto-instrument --json  # Dry-run managed auto-instrument plan
trajectory setup auto-instrument apply --yes --json  # Apply when managed mutation is enabled
trajectory setup auto-instrument status --json  # Last auto-instrument status
trajectory setup --uninstall codex   # Remove one client integration
```

`trajectory setup --clients ...` updates only client wiring. It skips Datadog
site, service name, and API key prompts, and leaves existing export config
unchanged. If no config file exists yet, it creates a capture-only config so
local session capture can start; run `trajectory setup` later to configure
Datadog export.

Managed fleets can preview automatic client instrumentation with `trajectory
setup auto-instrument`. The dry-run planner only becomes ready when both
conditions are true: `selfupdate.conf` stamps a managed owner such as `jamf` or
`mdm`, and managed `config.defaults.yaml` explicitly enables
`setup.auto_instrument.enabled` with an `allow_clients` list. Unmanaged users
and self-installs remain disabled by default, and a user config can opt out by
setting `setup.auto_instrument.enabled: false`. Managed defaults are the policy
ceiling: local user config can narrow `allow_clients`, add `deny_clients`, or
choose a less frequent interval, but it cannot expand automatic client
instrumentation beyond the managed allow-list.

Mutation requires a second managed opt-in:
`setup.auto_instrument.apply_enabled: true`. Without that key, auto-instrument
continues to plan and report status only. With it enabled, an MDM/Jamf job can
run `trajectory setup auto-instrument apply --yes`; the command reuses the same
client-only setup path as `trajectory setup --clients ... --non-interactive`,
then records the apply result in `state/auto-instrument/status.json`.

When `trajectory serve` starts, it records the same plan in
`state/auto-instrument/status.json` under the Trajectory home. Read it with
`trajectory setup auto-instrument status`. Startup remains dry-run unless the
managed policy also sets `setup.auto_instrument.apply_enabled: true`; when that
second gate is enabled and the plan has actionable detected clients, startup
runs the same client-only setup path in the background and records the apply
result with source `serve_startup_apply`.

Example managed defaults:

```yaml
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

### Feature coverage matrix

Incognito is a server-side Trajectory gate for every captured session once the
session is toggled. The privacy matrix calls out whether setup gives that
client a first-class way to toggle it. Sensitivity classification and task
segmentation are core Trajectory features for captured non-headless sessions;
headless sessions always skip sensitivity classification and segmentation.

#### Capture and telemetry

| Client | Live capture | Tool/model events | Token/cost usage | Backfill | Resume |
|--------|--------------|-------------------|------------------|----------|--------|
| Claude Code | HTTP hooks | Yes | Yes | Transcript backfill | Yes |
| Codex CLI | Command hooks plus rollout watcher fallback | Yes | Yes | Codex rollout backfill | Yes |
| GitHub Copilot CLI | Beta Copilot plugin command hooks | Command-level lifecycle, prompt, tool, and session events | Not exposed by current hook payloads | Not yet | Not yet |
| Gemini CLI | Managed command hooks | Yes | Yes | Gemini transcript backfill | Yes |
| Antigravity CLI (`agy`) | Antigravity plugin command hooks | Yes | Yes | Not yet | No setup-managed resume |
| Goose | Open Plugins command hooks | Session, prompt, tool, shell/file, and assistant-message events | Fixture-only from live hooks; historical SQLite usage readback can be added later | Not yet | No setup-managed resume |
| Cline CLI | File hooks | Lifecycle, prompt, tool, assistant-message, turn, and session-end events | Not exposed by current hook payloads | Not yet | No setup-managed resume |
| Aider | Opt-in command shim with analytics and history sidecars | Prompt, assistant-message, and turn events | Yes, from Aider analytics rows when present | Not yet | No setup-managed resume |
| Continue CLI | Opt-in `cn` command shim plus session JSON readback | Prompt, assistant-message, and turn events | Yes, from Continue session usage metadata when present | Not yet | No setup-managed resume |
| Mistral Vibe | Opt-in `vibe` command shim plus native tool hooks | Prompt, tool, assistant-message, and turn events | Yes, from Vibe session metadata when present | Not yet | No setup-managed resume |
| Codebuff | Opt-in command shims plus chat-history import | Prompt, assistant-message, turn, and chat-history-derived model events | Yes, from Codebuff chat metadata and nested run-state usage | `backfill --from-codebuff-chats` | No setup-managed resume |
| Cursor Desktop | Command hooks | Yes | Cursor DB dependent | Cursor chat backfill | Yes |
| cursor-agent CLI | Transcript watcher | Tool and turn events | Not exposed by current transcripts | Same transcript source | No setup-managed resume |
| Factory Droid | Beta Factory plugin command hooks | Documented lifecycle, prompt, tool, notification, compaction, stop, and subagent-stop events | Not exposed by current documented hook payloads | Not yet | Not yet |
| Pi | TypeScript extension | Yes | Yes | Pi/OMP session backfill | Yes |
| Hermes Agent | Observer plugin hooks | Yes | Yes, from observer usage payloads | Not yet | No setup-managed resume |
| Amp Code | System TypeScript plugin events | Yes | Fixture-tested; live usage when Amp exposes usage fields | Not yet | No setup-managed resume |
| Qwen Code | Native HTTP hooks | Yes | Yes, from Qwen usageMetadata and transcript fallback | Not yet | No setup-managed resume |
| OpenHands | Command hooks | Lifecycle, prompt, and tool events | Not exposed by command hook payloads | Not yet | No setup-managed resume |
| OpenCode | Plugin SDK events | Yes | Yes | SQLite backfill | Yes |
| Kilo Code | Plugin SDK events | Yes | Native OTLP traces/logs plus SDK payloads when exposed | Not yet | No setup-managed resume |
| Kiro CLI | Agent command hooks | Prompt, tool, and assistant-response events | Not exposed by current documented hook payloads | Not yet | No setup-managed resume |

#### Privacy and derived features

| Client | Incognito UX | MCP incognito tool | Sensitivity scanning | Segmentation | Coverage note |
|--------|--------------|--------------------|----------------------|--------------|---------------|
| Claude Code | `/trajectory:incognito` command and incognito skill | Yes | Non-headless eligible; headless skipped | Non-headless eligible; headless skipped | First-class incognito UX |
| Codex CLI | Incognito skill with bundled script fallback | Yes | Non-headless eligible; headless skipped | Non-headless eligible; headless skipped | First-class incognito UX |
| GitHub Copilot CLI | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions eligible; headless skipped | Non-headless plugin sessions eligible; headless skipped | Plugin sessions can toggle incognito |
| Gemini CLI | `/incognito` command and incognito skill | Yes | Non-headless hook sessions eligible; headless skipped | Non-headless hook sessions eligible; headless skipped | First-class incognito UX |
| Antigravity CLI (`agy`) | `/incognito` command and incognito skill | Yes | Non-headless hook sessions eligible; headless skipped | Non-headless hook sessions eligible; headless skipped | Incognito skill and command installed by setup |
| Goose | Setup-managed `goose-incognito` command | No | Non-headless Open Plugins sessions eligible; headless skipped | Non-headless Open Plugins sessions eligible; headless skipped | Command-based incognito toggle |
| Cline CLI | Setup-managed `cline-incognito` command plus MCP request path | Yes | Non-headless file-hook sessions eligible; headless skipped | Non-headless file-hook sessions eligible; headless skipped | Command and MCP incognito paths |
| Aider | Setup-managed `aider-incognito` command | No | Wrapper sessions eligible when non-headless; headless skipped | Wrapper sessions eligible when non-headless; headless skipped | Wrapper sessions can use command incognito |
| Continue CLI | Setup-managed `continue-incognito` command | No | Wrapper sessions eligible when non-headless; headless skipped | Wrapper sessions eligible when non-headless; headless skipped | Wrapper sessions can use command incognito |
| Mistral Vibe | Setup-managed `vibe-incognito` and `mistral-vibe-incognito` commands | No | Wrapper/native sessions eligible when non-headless; headless skipped | Wrapper/native sessions eligible when non-headless; headless skipped | Wrapper sessions can use command incognito |
| Codebuff | Setup-managed `codebuff-incognito` and `cb-incognito` commands | No | Wrapper/imported sessions eligible when non-headless; headless skipped | Wrapper/imported sessions eligible when non-headless; headless skipped | Wrapper/imported sessions can use command incognito |
| Cursor Desktop | Incognito skill, using Claude skill when available or native Cursor fallback; setup also installs `cursor-agent-incognito` | Yes | Non-headless GUI sessions eligible; headless skipped | Non-headless GUI sessions eligible; headless skipped | GUI sessions use skill-based incognito |
| cursor-agent CLI | Setup-managed `cursor-agent-incognito` command when the Cursor integration is installed; watcher has no native slash surface | No | Transcript-watcher sessions are treated as headless and skipped | Transcript-watcher sessions are treated as headless and skipped | Headless transcript watcher path |
| Factory Droid | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions eligible; headless skipped | Non-headless plugin sessions eligible; headless skipped | Plugin sessions can toggle incognito |
| Pi | Native `trajectory_incognito` tool plus MCP | Yes | Non-headless extension sessions eligible; extension-supplied verdicts accepted; headless skipped | Non-headless extension sessions eligible; headless skipped | Native extension incognito tool |
| Hermes Agent | Incognito skill | Yes | Non-headless observer sessions eligible; headless skipped | Non-headless observer sessions eligible; headless skipped | Observer sessions can toggle incognito |
| Amp Code | Setup-managed `amp-incognito` command plus MCP request path | Yes | Non-headless Amp plugin sessions eligible; headless skipped | Non-headless Amp plugin sessions eligible; headless skipped | Command and MCP incognito paths |
| Qwen Code | `/incognito` command and incognito skill | Yes | Non-headless Qwen hook sessions eligible; headless skipped | Non-headless Qwen hook sessions eligible; headless skipped | Incognito skill and command installed by setup |
| OpenHands | Setup-managed `openhands-incognito` command plus MCP request path | Yes | Non-headless command-hook sessions eligible; headless skipped | Non-headless command-hook sessions eligible; headless skipped | Command and MCP incognito paths |
| OpenCode | Incognito skill | Yes | Non-headless plugin SDK sessions eligible; headless skipped | Non-headless plugin SDK sessions eligible; headless skipped | Plugin SDK sessions can toggle incognito |
| Kilo Code | Incognito skill | Yes | Non-headless plugin SDK sessions eligible; headless skipped | Non-headless plugin SDK sessions eligible; headless skipped | Plugin SDK sessions can toggle incognito |
| Kiro CLI | Setup-managed `kiro-incognito` command plus MCP request path | Yes | Prompt/tool hook capture eligible when non-headless; headless skipped | Punted for final segmentation proof: current documented command hooks lack a terminal `SessionEnd` signal | Fixture-only capture plus command-behavior coverage; no positive privacy-feature proof yet |

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
states. Neither command verifies Datadog intake or readback.

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

Use `--readback-all --strict-fidelity` for CI/canaries or incident follow-up
where every sent outbox group, including volatile duration and last-seen
metrics, must read back exactly from Datadog. Strict mode fails if expected
source-tagged rows are missing, extra rows are present, rows are not `sent`,
source labels are unknown, or readback is incomplete.

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

For the publish operations runbook covering validate/status/preview, missing
Datadog data, `publish sync`, and publish ledger repair:

```bash
trajectory user-guide publish
```

For marker-metric readback, use `trajectory markers canary --keep-home`. It runs an isolated synthetic session, validates local marker/cost/token/assistant-message invariants, and prints Datadog query shapes for the configured destination.

`trajectory audit --deep` adds an interpretation block for local capture fidelity, config-driven trace-off states, missing model/cost attribution, and the 24-hour LLMO trace intake backfill limit.

`trajectory audit --source-data` checks the local SQLite cache contracts used by local-ui, including completed-session finalization, session/turn aggregate consistency, tool-call parentage, model/cost attribution, sparse turn IDs, and contentless active turns. Use `--json` for machine-readable output or `--db <path>` to inspect a non-default cache.

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
signal provenance, and instrumentation-health fallback/failure counters.

The `install-outcomes` dashboard is the managed rollout and onboarding view. It
uses Jamf attempt metrics for pre-binary and retry behavior, then uses
`trajectory.ops.install.current_state` and `trajectory.ops.install.agent_state`
as the durable setup and per-integration state once the binary runs.

The `operations` dashboard includes the low-cardinality coding-agent usage view:
installed agents, installed agent versions, active sessions by client, and
active-session versions. Use it to answer which coding agents are present and
which ones are actually being used without tagging by session ID or project
path.

## Privacy Controls

Use `/incognito` when the current session should not publish to ordinary Datadog observability destinations. Local JSONL capture continues, publish to non-exempt Datadog destinations is suppressed, active-session sensitivity scans are skipped, and the toggle resets when the session ends. Org-managed destinations configured with `incognito_exempt: true` may still receive events for approved security or audit use cases.

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
local UI cache, or repairing historical dashboard metrics in orgs where
Datadog Historical Metrics Ingestion is enabled. It is not required for
first-run metric onboarding; use `trajectory metrics session --latest` and
`trajectory metrics verify` first.

```bash
trajectory backfill --from-claude-code --republish-local  # Claude Code transcripts + local UI
trajectory backfill --republish-local                  # Refresh local UI from cached sessions
trajectory backfill --from-codex-sessions --limit 100  # Codex rollout files, newest first
trajectory backfill-my-metrics                         # Dry-run historical dashboard repair
```

Read the full embedded guide for modes, local UI repair, historical metric
readback, and structured record backfill:

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
```

Trajectory layers embedded built-ins, org markers, user add-ons in `~/.trajectory/markers.d/*.yaml`, user markers in `~/.trajectory/markers.yaml`, and project markers in `.trajectory/markers.yaml`. To opt in to the optional security catalog:

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
trajectory user-guide metrics        # Metric gates, names, tags, and queries
trajectory user-guide mcp            # MCP tools, resources, and SQL query workflow
trajectory user-guide query          # Local cache data and guarded MCP SQL workflow
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
trajectory user-guide clients/hermes # Hermes Agent observer plugin details
trajectory user-guide clients/amp    # Amp Code system plugin details
trajectory user-guide clients/goose  # Goose-specific details
trajectory user-guide clients/cline  # Cline CLI file hook details
trajectory user-guide clients/aider  # Aider command shim and sidecar details
trajectory user-guide clients/continue # Continue CLI command shim and session JSON details
trajectory user-guide clients/mistral-vibe # Mistral Vibe command shim and hook details
trajectory user-guide clients/codebuff # Codebuff command shim and chat-history import details
trajectory user-guide clients/qwen   # Qwen Code native HTTP hook details
trajectory user-guide clients/kilo   # Kilo Code plugin and OTLP relay details
trajectory user-guide clients/kiro   # Kiro CLI agent command hook details
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

- `trajectory.turn.tool_uses.total` - total tool calls in a completed turn. This is intentionally separate from the `trajectory.turn.tool_uses` gauge, which is split by `tool_name` for per-tool breakdowns.
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
- `trajectory.pr.contexts.total`, `trajectory.pr.work_turns.total`, `trajectory.pr.work_duration_ms.total`, and `trajectory.turn.pr_contexts` - existing-PR/MR work context metrics from prompt URLs, PR/MR creation output, common `gh pr ...` / `glab mr ...` output, and managed enrichment markers. These carry `change_host`, `owner`, `repo`, `change_number`, `context_source`, and `signal_confidence` when Trajectory has normalized identity.
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

PR attribution metrics support direct PR-to-session lookup when a GitHub-compatible `/pull/<number>` URL or GitLab-compatible `/-/merge_requests/<number>` URL is visible in the successful `gh pr create` or `glab mr create` output, including enterprise/self-hosted hosts. Trajectory emits `trajectory.pr.cost.usd.attributed.total` for the cost attributed to turns that contributed to new PR creation, `trajectory.pr.attributed_turns.total` for those creation-tail turns, `trajectory.pr.containing_session.cost.usd.total` for the total cost of sessions that contained PR creation activity, and `trajectory.turn.prs` for the exact PR/MR creation turn. Existing-PR work uses `trajectory.pr.contexts.total`, `trajectory.pr.work_turns.total`, `trajectory.pr.work_duration_ms.total`, and `trajectory.turn.pr_contexts`; these are driven by marker ranges that start from prompt URLs, PR/MR CLI output, or managed `pr-context-entered` structural markers. Filter by `change_host`, `owner`, `repo`, and `change_number`, then group by `session_id`, `trajectory.turn_id`, or `context_source` for drilldown. Managed installs may separately enable `pr_attribution` structured records for richer PR/MR drilldown; repo configs and security destinations cannot enable those records.
