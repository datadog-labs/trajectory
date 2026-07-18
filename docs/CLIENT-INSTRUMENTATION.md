# Client Instrumentation Reference

Trajectory instruments each supported coding agent through that agent's native
plugin, hook, MCP, or transcript surface. All live capture paths normalize into
canonical JSONL under `~/.trajectory/trajectories/` and route through the local
capture server on `localhost:19222` through the transport each client supports.

For installation status and version support, see
[SUPPORTED-CLIENTS.md](SUPPORTED-CLIENTS.md).
For the built-in user-facing client guides, run:

```bash
trajectory user-guide clients
```

## Summary

| Client | Setup path | Live capture surface | Backfill |
|---|---|---|---|
| Claude Code | `trajectory setup --clients cc` (`--install-client-shims` optional) | Marketplace plugin hooks plus MCP; optional transparent `trajectory claude` launcher | Transcript backfill |
| Codex CLI | `trajectory setup --clients codex` (`--install-client-shims` optional) | Three boundary command hooks plus authoritative rollout reconciliation by default; optional full ten-hook compatibility and transparent `trajectory codex` launcher | Codex rollout backfill |
| GitHub Copilot CLI | `trajectory setup --clients copilot`; optionally enable `copilot_cli_durable_history` | Beta plugin command hooks plus MCP and default-off bounded session-state reconciliation | Enable `copilot_durable_history`; `trajectory backfill --from-copilot-sessions` remains the explicit bulk-history and repair path |
| Gemini CLI | `trajectory setup --clients gemini` | Managed command hooks plus MCP | Gemini transcript backfill |
| Antigravity CLI (`agy`) | `trajectory setup --clients agy` | Antigravity plugin command hooks plus MCP | Default-off exact prompt-history reconciliation from provider `history.jsonl` |
| Goose | `trajectory setup --clients goose` | Open Plugins command hooks | Default-off bounded schema-v15 SQLite reconciliation and native-trace usage enrichment via `goose_durable_history` |
| Cline CLI | `trajectory setup --clients cline` | File hooks plus MCP | None |
| Cursor Desktop | `trajectory setup --clients cursor` | Cursor command hooks plus MCP | Cursor chat backfill |
| cursor-agent CLI | Enable `cursor_agent_durable_history`; command hooks use the Cursor setup | Default-off shared passive JSONL watcher for current main/child and legacy flat layouts | Same shared JSONL source contract plus Cursor chat stores |
| Factory Droid | `trajectory setup --clients droid` | Beta Factory command hooks plus MCP | None |
| Hermes Agent | `trajectory setup --clients hermes` | Observer Python plugin plus MCP | Read-only `state.db` backfill |
| Amp Code | `trajectory setup --clients amp` | System TypeScript plugin plus MCP | Default-off bounded thread reconciliation via `amp_durable_history` |
| Qwen Code | `trajectory setup --clients qwen` | Native HTTP hooks plus MCP | Default-off bounded active-chain chat JSONL watcher and explicit backfill, including archives, via `qwen_durable_history` |
| Kiro CLI | `trajectory setup --clients kiro` | Agent command hooks plus MCP | Default-off bounded JSONL/SQLite reconciliation via `kiro_durable_history` |
| Devin CLI | Enable `devin_cli_instrumentation`, then `trajectory setup --clients devin` | Authoritative local source reconciliation, hook wake hints, MCP, and incognito skill | No bulk historical import; active/changed source reconciliation only |
| Qoder CLI | Enable `qoder_cli_instrumentation`, then `trajectory setup --clients qoder` | Native plugin wake hooks, authoritative JSONL transcript reconciliation, MCP, and incognito skill | No bulk historical import; active/changed source reconciliation only |
| CommandCode | Enable `commandcode_instrumentation`, then `trajectory setup --clients commandcode` | Native wake hooks plus authoritative mutable-transcript reconciliation, MCP, and owned incognito skill/command | Existing and changed transcripts reconcile in bounded passes; no inferred terminal lifecycle or native usage |
| Kimi Code CLI | Enable `kimi_cli_instrumentation`, then `trajectory setup --clients kimi` | Wake hooks plus authoritative `wire.jsonl`/`context.jsonl`/state reconciliation, MCP, and incognito skill | Current and legacy roots are migration-deduplicated; fixture-first CI |
| gptme | Enable `gptme_instrumentation`, then `trajectory setup --clients gptme` | Metadata-only native lifecycle hooks plus authoritative conversation/events/config reconciliation, MCP, and `/incognito` | Existing and changed sessions reconcile in bounded passes; real credential-free CI |
| CodeWhale | Enable `codewhale_instrumentation`, then `trajectory setup --clients codewhale` | Saved-session and runtime-thread reconciliation, wake-only native hooks, MCP, and an incognito skill | Plain exec is invisible unless stream-JSON or resume persists it; unknown source modes skip privacy-derived features |
| ForgeCode | Enable `forgecode_instrumentation`, then `trajectory setup --clients forgecode` | Read-only `.forge.db`/WAL reconciliation, MCP, and owned incognito skill/command; no hooks or wrapper | Existing and changed conversations reconcile in bounded passes; fixture-first passive history |
| Warp/Oz CLI | Enable `warp_oz_instrumentation`, then `trajectory setup --clients warp` | Read-only local Warp/Oz SQLite+protobuf reconciliation, MCP, and incognito skill | Active/changed local stores only; cloud runs excluded |
| VS Code Copilot Chat | Enable `vscode_copilot_instrumentation`, then `trajectory setup --clients vscode-copilot` | Passive JSONL/JSON chat history, strict native OTel, MCP, and incognito prompt | Fixture preview; real Electron/UI and incognito correlation smoke pending |
| Zed | Enable `zed_passive_history`, then `trajectory setup --clients zed` | Read-only provider thread DB reconciliation, MCP, and incognito skill; no hooks/wrapper/OTel | Fixture-first; live Zed UI/incognito follow-up |
| OpenHands | `trajectory setup --clients openhands` | Command hooks plus MCP; no default OTLP relay | None |
| Continue CLI | `trajectory setup --clients continue --install-client-shims` | Opt-in `cn` shim plus exact post-run session-delta and tool-state reconstruction | Current invocation JSON only; exact CLI `--resume`/`--fork` selection, no bulk backfill |
| Codebuff | `trajectory setup --clients codebuff --install-client-shims` | Opt-in command shims plus post-run chat-history import | Codebuff chat history backfill |
| Pi | `trajectory setup --clients pi` | TypeScript extension plus eager MCP | `.pi/agent/sessions` backfill |
| Oh My Pi (`omp`) | Enable `omp_instrumentation`, then `trajectory setup --clients omp` | Native `omp.extensions` lifecycle capture plus eager MCP | `trajectory backfill --from-omp-sessions` recursively imports the effective profile's v3 history |
| OpenCode | `trajectory setup --clients opencode` | OpenCode plugin SDK events plus MCP | JSON-storage and SQLite durable-history backfill plus opt-in watcher |
| Kilo Code | `trajectory setup --clients kilo` | OpenCode-compatible plugin SDK events plus MCP; optional default-off durable-history watcher | `trajectory backfill --from-kilo` behind `kilo_durable_history` |

### VS Code Copilot Chat preview contract

The provider-history reconciler covers Code, Code - Insiders, and VSCodium
workspace, empty-window, and transferred chat-session stores. JSONL operation
logs take precedence over JSON fallback and `workspace.json` changes invalidate
the sessions below that workspace hash. Native `/v1/traces` ingestion requires
both the documented `copilot-chat` resource service and foreground
`GitHub Copilot Chat` agent root. Trace attribution and pending children survive
split requests in bounded TTL state; durable source IDs prevent restart replay.
Content remains off unless the provider emitted it, and setup always writes
`github.copilot.chat.otel.captureContent=false` when that key is unowned.
## Shared Local Flow

Live hook integrations post payloads to:

```text
http://localhost:19222/capture/<client>/<event>
```

or to a client-specific capture endpoint that maps native events to canonical
Trajectory events. The capture server writes JSONL locally first. Publish,
markers, metrics, diagnosis, and local UI indexing derive from local capture.

The setup-managed clients also install or register the associated assets needed
for the client:

- MCP entries that expose Trajectory tools and resources for local
  introspection.
- Agent skills or slash commands where the client supports them.
- Local marketplace metadata for plugin-based clients.
- An installed or extension-local `trajectory` binary path where the client
  expects one.

Plugin-only manual installs can miss these assets. Use
`trajectory setup --clients <client>` for normal installs. For clients that
capture by launching through an agent-name command shim, pass
`--install-client-shims` in scripted setup or answer yes to the interactive
setup prompt. Claude and Codex do not require launch interception for their
native setup integrations, but the same explicit flag optionally writes
same-name launchers for their built-in Trajectory wrappers. Setup records the
real upstream binary, refuses self-wrapping and unowned-file replacement, and
removes only Trajectory-owned files and links. The
`builtin_wrapper_command_shims` flag gates these optional built-in launchers;
when disabled, an installed launcher passes through to its recorded upstream
binary without instrumentation. This is the
client-only add/update path: it refreshes hooks, MCP entries, skills, commands,
and local marketplace files without prompting for Datadog site or API key
values. Run `trajectory setup` without `--clients` to change export settings.

### Oh My Pi preview contract

OMP setup follows the provider's active profile rather than assuming
`~/.omp/agent`. `OMP_PROFILE` takes precedence over `PI_PROFILE`, including an
explicitly empty value selecting the default profile. Named profiles use
`~/${PI_CONFIG_DIR:-.omp}/profiles/<name>/agent` and ignore
`PI_CODING_AGENT_DIR`; the default profile honors that agent-dir override.
Migrated XDG history is selected only when the matching `$XDG_DATA_HOME/omp`
or profile directory exists. Extensions and `mcp.json` remain in the effective
config agent directory even when sessions move to XDG data storage.

The native extension posts lifecycle, prompts, assistant/model/usage,
tool-call/result, compaction, switch, branch, and shutdown signals to
`/capture/omp`. Serve owns `client_source=omp`; payloads cannot relabel the
client. Parent identities come only from the current v3 header or the exact
provider-owned previous file, so resume and switch reasons do not invent fork
relationships. Explicit backfill recursively reads bounded v3 history,
including nested child files, real tool failures/results, usage, model changes,
and compaction. Automatic history watching and a real executable smoke remain
follow-ups; current coverage is sanitized v16.5.2 fixture replay. ccusage
independently corroborates recursive Pi-format history and usage fields, but it
does not validate OMP profiles, XDG selection, or native lifecycle behavior.

## Setup Instrumentation Policy

Client setup must use the least invasive registration surface the upstream
client supports:

- Prefer native package, plugin, hook, MCP, extension-manifest, or transcript
  discovery before command shims or wrapper-style launch interception.
- Write only scoped client integration files needed for capture, MCP, skills,
  commands, or plugin discovery. Do not add Trajectory to broad user settings
  when a package manifest or plugin directory can register the same entrypoint.
- Do not edit shell startup files, shell aliases, shell functions, or export
  PATH from setup. When `trajectory` is not on PATH, setup and doctor should
  prefer an existing home bin directory and suggest a symlink such as
  `ln -s ~/.trajectory/bin/trajectory ~/.local/bin/trajectory`.
- Command shims named like upstream agent commands are allowed only for clients
  that have no stable native capture surface, and they must require explicit
  opt-in through `--install-client-shims` or the interactive setup prompt.
- Feature gates are required for new behavior that mutates durable user state,
  changes client startup, adds wrapper or OTLP interposer behavior, depends on
  managed settings precedence, or changes outbound network shape. Register the
  flag as a registered Trajectory feature flag in the feature-flag catalog,
  document the default, and test the default, enabled, disabled,
  managed-disabled, and env-disabled paths.
- Wrapper metadata must record the real upstream binary, setup must avoid
  self-wrapping an existing Trajectory shim, and uninstall must remove only
  Trajectory-managed shim files and metadata.
- Setup verification, inventory, and doctor must report the actual registration
  mechanism. Examples: Pi reports package manifest registration, wrapper-based
  clients report command shim and metadata, and hook-based clients report their
  hook or MCP config path.

When adding a new client, document why the chosen surface is the least invasive
viable option. If a wrapper or command shim is still required, document the
missing upstream hook/plugin surface and add setup tests that prove the shim is
opt-in and uninstallable.

The authoritative MCP catalog, including safe query examples, is embedded in
the binary:

```bash
trajectory user-guide mcp
```

Compact MCP surface:

| Surface | Names |
|---|---|
| Session/status tools | `trajectory_status`, `list_active_sessions`, `get_session_trajectory` |
| Evaluation/privacy tools | `evaluate_markers`, `trajectory_incognito` |
| SQLite tools | `trajectory_schema`, `trajectory_query` |
| Resources | `trajectory://status`, `trajectory://config`, `trajectory://sqlite/schema` |

Agents should call `trajectory_schema` before `trajectory_query` so SQL matches
the live local-ui database selected by `TRAJECTORY_CACHE_DB` or the cache under
`TRAJECTORY_ROOT`.

## Claude Code

Setup writes a local Claude Code marketplace under
`~/.trajectory/claude-marketplace`, registers it, refreshes it, and installs or
updates `trajectory@trajectory` at user scope. Claude Code caches installed
plugins by plugin version, so setup generates the local marketplace and plugin
manifest with Trajectory's bundled Claude plugin version rather than copying the
development manifest verbatim. `trajectory update` can also refresh an already
installed Claude plugin after the binary is current when it detects a stale
cached version or the duplicate standard-hook manifest entry.

The plugin ships Claude `hooks/hooks.json`, which Claude Code loads
automatically from that standard path. Those lifecycle hooks post to the local
capture server. Claude Code supports native HTTP hook entries, so most lifecycle
events use HTTP hooks. `SessionStart` and `SessionEnd` use `trajectory
capture-hook` command hooks: startup must survive a server that is not ready
yet, and session shutdown must keep stdin attached long enough to spool the
terminal event before delegating final delivery to a background worker. That
worker triggers the normal final publish metrics path through `trajectory
serve`. The plugin manifest intentionally omits a `hooks` entry for
`hooks/hooks.json` to avoid duplicate hook-file loading. The plugin also carries
MCP configuration and skills, including `/incognito`.

All transcript/session-history fallback consumers share one root resolver.
`CLAUDE_CONFIG_DIR` exclusively selects `$CLAUDE_CONFIG_DIR/projects`; when it
is empty, the resolver selects `~/.claude/projects`. Setup backfill, CLI
backfill and token accounting, doctor, Stop reconciliation, ingest
reconciliation, resume placement lookup, and reconstructed Claude placement all
use that resolver. Hook-provided exact `transcript_path` values still win. The
resolver is deliberately not used for plugin, settings, credential, or legacy
cleanup paths, and it does not merge or probe alternative roots.

Trajectory can relay Claude Code native OTLP logs, metrics, and traces when
Claude Code is explicitly configured to send those signals to local
`trajectory serve`. The `trajectory claude` wrapper injects this configuration
into the Claude child process environment for that one launch:

```text
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:<port>/v1/logs
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:<port>/v1/metrics
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:<port>/v1/traces
```

It also enables Claude's enhanced telemetry beta and tool details in that child
environment so native tool spans can include the skill and tool attributes
needed for skill observability.

The `/v1/logs` endpoint keeps only native `skill_activated` records, converts
them into bounded local `Skill` tool activations, and drops other logs after
capture. If `server.otlp_proxy.endpoint` is configured, `trajectory serve` also
forwards OTLP log, metric, and trace payloads to that upstream collector.
Metrics are decoded and re-encoded in the original OTLP protocol so Trajectory
can add
Datadog-visible datapoint attributes: canonical identity tags,
`trajectory.proxy.source:serve-otlp`,
`trajectory.cost_role:client_telemetry`, and
`trajectory.cost_source:claude_native_otlp`. The forwarder prefers session
identity already present in the OTLP payload, then a single active local
session, then fresh heartbeat state on disk; if no unambiguous session is
available, the identity tags fall back to `unknown`. Trace payloads are
forwarded unchanged to the upstream collector. Trajectory also stores safe
normalized local trace summaries under
`~/.trajectory/state/otlp-proxy/traces/`, retaining span IDs, parent IDs,
timing, names, and allowlisted skill/tool/session attributes rather than raw
OTLP bodies or tool inputs. Those local records let skill complexity metrics
prefer native Claude tool spans over whole-turn fallback attribution.
Use this when Claude should continue sending native telemetry to Datadog or an
OpenTelemetry collector through Trajectory:

```yaml
server:
  otlp_proxy:
    enabled: true
    endpoint: https://otlp.datadoghq.com
    api_key_ref: dd-api-key
    capture_enabled: true # optional: write local comparison records
```

The forwarder is fail-open for Claude: local capture requests still return 200
when no upstream is configured, enrichment fails, or the upstream request fails.
It does not correct native client cost values, drop invalid datapoints, or make
client telemetry part of Trajectory's attribution cost stream. Datadog direct
intake uses `api_key_ref` and sends the resolved key as `dd-api-key`;
non-Datadog collectors can use the
`TRAJECTORY_OTLP_PROXY_HEADERS` process environment for additional headers.
When `server.otlp_proxy.capture_enabled` or
`TRAJECTORY_OTLP_PROXY_CAPTURE_ENABLED=1` is set, `/v1/metrics` also writes
normalized inbound-vs-forwarded comparison records under
`~/.trajectory/state/otlp-proxy/metrics/`. These records store payload hashes,
metric names, datapoint values, and attributes, not raw OTLP bodies. Inspect
them with:

```bash
trajectory otlp metrics compare --session <session-id>
```

Use this local comparison to prove that Trajectory preserved native Claude
metric values while adding `trajectory.cost_role:client_telemetry`,
`trajectory.cost_source:claude_native_otlp`, and cost-overlap tags. Use
Datadog readback separately to prove the upstream collector indexed those tags.

Skill complexity metrics carry `skill_attribution`:
`span_tool_attribute` when native Claude tool spans carry the skill name,
`span_temporal` when one high-confidence skill signal can be matched to
same-turn native Claude tool spans by time, and `turn_assisted` when Trajectory
falls back to materialized same-turn tool rows.

Setup does not write or overwrite Claude Code user settings for native OTLP.
When an older Trajectory version injected the exact legacy local OTLP env block
into `~/.claude/settings.json`, setup may remove only those Trajectory-owned
user-scope keys; it never cleans project or managed settings.

Use `trajectory claude` when you want Trajectory to route native OTLP for a
single launched Claude process without changing `~/.claude/settings.json`. The
wrapper reads effective Claude settings, points the child process at local
`/v1/logs`, `/v1/metrics`, and `/v1/traces`, and starts `trajectory serve` with
the original upstream endpoint as `server.otlp_proxy` process configuration.
This process-only interposer is controlled by the
`claude_native_otlp_interposer` feature flag. It is on by default because
running `trajectory claude` is the explicit opt-in boundary; disable it with
`trajectory features disable claude_native_otlp_interposer` or
`TRAJECTORY_DISABLE_FEATURES=claude_native_otlp_interposer` to keep the wrapper
from injecting native OTLP environment variables.
Protocol is preserved per signal: per-signal protocol settings win, then
`OTEL_EXPORTER_OTLP_PROTOCOL`, then Trajectory's explicit default
`http/json`. If managed settings specify `http/protobuf`, Claude sends protobuf to
the local interposer and Trajectory forwards protobuf upstream; if no settings
specify a protocol, the wrapper emits `http/json` explicitly for each
signal.

Because Claude managed settings have higher precedence than user settings,
enterprise-managed OTel policy remains admin-owned. Trajectory setup
intentionally leaves `~/.claude/settings.json` unchanged in that case; standard
hooks still capture, but Trajectory will not see Claude's native OTLP
skill/usage stream unless the effective Claude settings or the `trajectory
claude` wrapper route OTLP to local `trajectory serve`.

`trajectory serve` is multi-process-safe: each process reads the same on-disk
Trajectory config and forwards independently. Restart long-lived serve
processes after changing `server.otlp_proxy.*` or process environment overrides
so every process listening with `SO_REUSEPORT` uses the same upstream.

Claude `--print` sessions omit `transcript_path`, so Trajectory marks them as
headless. Headless coding-agent sessions are collected and published by default
when export is configured, while sensitivity/classification and segmentation
always skip headless sessions. The protected Docker live-client CI gate runs a
real `claude --print` session, requires the plugin hook path to emit `turn_end`,
and reads Datadog Metrics back with `trajectory.client_source:claude-code`. To
opt out for all non-internal headless agent sessions:

```bash
trajectory config set capture.include_headless_agents false
```

Trajectory-owned classifier and segmenter subprocesses remain suppressed.

Verify:

```bash
claude plugin list
trajectory doctor
```

## Claude Desktop

Claude Desktop is the macOS GUI app (`/Applications/Claude.app`, bundle id
`com.anthropic.claudefordesktop`). It has three distinct surfaces ("tabs"), each a
separate data store with a different capture owner - important because "Claude
Desktop capture" here means specifically the **Cowork** tab:

| Tab | On-disk store | Captured as |
| --- | --- | --- |
| **Cowork** (local-agent mode) | `~/Library/Application Support/Claude/local-agent-mode-sessions/**/audit.jsonl` | `client_source=claude-desktop` (this integration) |
| **Claude Code** (Code tab) | `~/.claude/projects/*.jsonl` (same store as the CLI) | `client_source=claude-code` (existing Claude Code integration) - now surface-attributed via `entrypoint` (see below) |
| **Chat** | Electron LevelDB | not captured (general chat, out of scope by design) |

The **Code tab** runs Claude Code inside the app and writes to the same
`~/.claude/projects` tree as the terminal CLI, so it is already captured as
`claude-code`. To distinguish Desktop-app usage from the terminal without
fragmenting `claude-code` metrics, the converter surfaces the transcript's own
`entrypoint` field (on user records: `claude-desktop` = Desktop Code tab, `cli` =
terminal, `sdk`) onto `session_start`, and ddllmobs emits it as a filterable,
client-agnostic `trajectory.entrypoint:<value>` span tag. This is a facet only -
`client_source` stays `claude-code`.

The rest of this section covers the **Cowork** tab. Its local-agent mode persists
sessions to disk as Claude Code-dialect JSONL, so Trajectory reuses the existing
Claude transcript converter rather than a new parser.

Rollout is governed by the `claude_desktop_capture` feature flag (on by default;
disabling it is the kill switch), which gates every surface. The currently landed
pieces are detection reporting, a programmatic backfill entry point, and a
near-real-time **live watcher**: on macOS (unless the flag is disabled),
`trajectory serve` runs a poll-based watcher (built on the shared `localtail`
core) that tails the per-session `audit.jsonl` transcripts and publishes sessions
to Datadog like CLI
live sessions (CC redaction applied; not headless). The watcher polls every few
seconds, holds no file descriptors across polls, re-converts each transcript, and
emits only the stable, not-yet-emitted turns; it is restart-safe via a persisted
per-session high-water mark. `fsnotify` is deliberately not used on macOS
(recursive kqueue silently misses in-place appends and burns a descriptor per
path), so polling is the correctness path.

**On-disk schema specifics.** Claude Desktop's `audit.jsonl` is Claude Code
dialect but differs in two fidelity-relevant ways the converter accounts for:
event time is carried in `_audit_timestamp` (not `timestamp`), which is folded
into the shared converter at parse time so real conversation times are used
rather than capture time; and each turn ends with a `result` record carrying an
authoritative per-turn `total_cost_usd`, which the converter sums into the
session's `total_cost_usd` (preferred downstream over the token-based
`session_cost_usd` estimate). The `result` records are per-turn and the schema
has no reliable session-terminal marker, so the watcher finalizes a session on
**quiescence** (idle window, default 10m) rather than on any single record.
That window is tunable via `TRAJECTORY_CLAUDE_DESKTOP_QUIESCENCE` (a Go duration
such as `60s` or `5m`) to trade materialization latency against finalizing an
only-briefly-idle session early.

The flag is **on by default**, so on a macOS host detection reporting, backfill,
and the live watcher are active out of the box. Disabling it (the kill switch) makes
Claude Desktop fully inert: it is neither detected/reported, imported, nor watched.
With the flag disabled, even on a macOS host with `Claude.app` present, Claude
Desktop is omitted from the inventory snapshot and from session-start
`installed_agents` metadata, the `Source=claude-desktop` backfill dispatch is a
no-op that imports nothing, and the live watcher does not start. (The low-level
`agentdetect` detection routines stay pure - the app bundle is still recognized -
but the gated surfaces do not report or import it when disabled.)

There is no CLI on `PATH`, so detection keys on macOS filesystem artifacts:
`/Applications/Claude.app`, `~/Applications/Claude.app`, or the app-support
directory `~/Library/Application Support/Claude`.

Transcripts live at:

```
~/Library/Application Support/Claude/local-agent-mode-sessions/<projectId>/<accountId>/local_<sessionId>/audit.jsonl
```

Each line is a JSON object shaped like a Claude Code standard transcript record
(`type` in `user`, `assistant`, `system`, plus desktop-only `tool_use_summary`,
`rate_limit_event`, and `result` records that are tolerated and ignored when not
understood). Session IDs are derived from the `local_<sessionId>` directory name
and validated for path-safety; invalid or unreadable entries are skipped. An
optional metadata sidecar may exist at
`~/Library/Application Support/Claude/claude-code-sessions/<projectId>/<accountId>/local_<sessionId>.json`.

Backfill emits trajectory events with `client_source=claude-desktop`. The
programmatic entry points are `setup.FindClaudeDesktopSessions` and
`setup.BackfillFromClaudeDesktopSessions`, dispatched through
`backfill.ReconstructLocal` with `Source=claude-desktop`, and exposed on the CLI
as `trajectory backfill --from-claude-desktop [--session ID | --since DATE]
[--force]`.

Live `trajectory serve` filesystem watching (darwin-only, poll-based),
setup-wizard registration (`trajectory setup --clients claude-desktop` - passive:
capture is watcher-delivered, so register only verifies the flag + prerequisites
and writes no client-side artifact), and incognito enforcement on the live
watcher lane are all wired. If a Cowork process ever emits native OTLP tagged
`trajectory.client_source=claude-desktop`, serve attributes the derived
metrics/logs to `claude-desktop` (serve-side attribution is ready). A
managed/Jamf preview-rollout path is documented in
`docs/reference/sample-installers/jamf-managed-install.md`, and a darwin
live-capture CI smoke (`tests/ci/claude-desktop-smoke.sh`, wired as the
"Claude Desktop Smoke" CI job and a release gate) guards the end-to-end path.

Session metadata (project_dir/cwd, git_branch, model) is enriched onto
`session_start` for the claude-desktop lane from the standard Claude Code-dialect
per-record `cwd`/`gitBranch` fields, with the optional
`claude-code-sessions/<projectId>/<accountId>/local_<sessionId>.json` metadata
sidecar as a best-effort fallback (records-first; every field is optional and
fail-safe). `git_branch` is emitted as the `trajectory.git_branch` span tag. The
enrichment is scoped to claude-desktop so claude-code backfill stays byte-identical.

Remaining follow-ups: a **client-side** native-OTLP injector and an MCP config
writer are blocked on Claude Desktop app support - an Electron GUI launched from
Finder does not inherit shell `OTEL_*` env, and there is no verified
`claude_desktop_config.json` `mcpServers` ingestion path.

## Codex CLI

Setup writes a local Codex marketplace under `~/.trajectory/codex-marketplace`
and registers it with Codex. The plugin provides command hooks, MCP
configuration, and the `/incognito` skill. `codex_boundary_capture` is on by
default and activates `SessionStart`, `UserPromptSubmit`, and `Stop` plus
paired Bash-only `PreToolUse` and `PostToolUse` evidence hooks.
Disabling it activates all ten events supported by current Codex and is the
full-hook compatibility path.

Setup extracts a same-platform minimal hook helper and, on Darwin, native relay
assets from the single installed Trajectory binary. It verifies each asset's
digest, protocol, platform, executable mode, and self-check before committing
an immutable generation. Hook JSON, per-hook enabled states, and exact Codex
trusted hashes are reconciled under the same transaction lock. A failed state
or trust commit restores the prior hook JSON; a failed asset install commits a
trusted full-binary fallback. Setup, update, background auto-update, owner
startup, config reconciliation, and doctor use this transaction. Background
repair does not create plugin config for a user who has not configured Codex.
An update only selects paired boundary mode after the running capture owner
advertises boundary support for the same Trajectory home. An old, wrong-home,
timed-out, or otherwise ambiguous owner keeps all ten hooks until the updated
owner starts and self-repairs them.

Codex hooks use `type: "command"`; current Codex does not support a Trajectory
HTTP hook variant. The full
`trajectory capture-hook --client codex --ensure-serve` path remains the
definite-unavailability and compatibility fallback.

Codex is a hybrid capture integration, not a simple hook-to-JSONL integration.
There are two upstream Codex streams:

- **Command hook payloads** cover the three default lifecycle/turn boundaries
  plus paired Bash-only before/after evidence. The paired tool hooks do not
  emit canonical events. Full-hook compatibility additionally activates all
  tool, permission, compaction, and subagent events. Codex waits for each command.
- **Codex rollout JSONL** under `$CODEX_HOME/sessions/` (normally
  `~/.codex/sessions/`) contains checkpoint data
  used for assistant messages, reasoning blocks, tools, permissions, compaction
  records, subagent activity, model details, token snapshots, structured
  `<skill>` activation envelopes, and `shutdown_complete`.

Manual and opt-in startup repair additionally discover flat rollout JSONL under
`$CODEX_HOME/archived_sessions/`. Startup repair processes a bounded page and
persists its continuation for the next maintenance lease. Historical discovery
prefers an active copy by `session_meta.id`, ignores symlinked rollout files,
and keeps `CODEX_SESSIONS_DIR` as an exclusive exact-root override. The live
watcher remains attached only to `sessions/` so a provider move into the archive
cannot replay an already captured session.

The JSONL under `~/.trajectory/trajectories/` is the normalized result of
merging those streams. At each boundary, `trajectory serve` reads the rollout
forward, derives canonical tool phases in one ordered durable batch, applies
token/model enrichment, and then dispatches the boundary event. Watcher-seen
assistant messages wake an immediate drain without adding a command hook.
Watcher-seen `shutdown_complete` performs the final drain and exact-once
`session_end`, because current Codex has no `SessionEnd` hook.
Boundary mode never fast-forwards a large unread rollout suffix. Its source
cursor is committed only after the derived canonical events are persisted; a
write failure leaves the source checkpoint retryable.

Because Codex starts the command shell before a hook command runs, replacing
the helper with `curl` would not remove the dominant shell-launch cost and
would add a child process. A direct append would also bypass canonicalization,
hook-active sentinel updates, rollout cursor advancement, token patching, and
duplicate suppression.

When `capture-hook --ensure-serve` runs for Codex, it ensures a
watcher-capable rescue `serve` process is present so the rollout fallback stays
available. For that rescue process only, it overrides Codex watcher-disable
environment variables and suppresses unrelated client watchers;
`trajectory disable` and `TRAJECTORY_DISABLED=1` still suppress all capture.
The durable user-scoped command also suppresses an already-running watcher.
Hook-active sentinels under `~/.trajectory/state/codex-hook-active/` suppress
duplicate non-message watcher events while boundary hooks own the session.

`codex exec --ephemeral` does not write a rollout. Default boundary mode
therefore cannot derive tool, permission, compaction, or subagent detail for an
explicit ephemeral run. Disable `codex_boundary_capture` before starting a new
ephemeral session when direct per-tool fidelity is required. Existing Codex
sessions retain the hook snapshot loaded at startup.

Setup-generated commands carry their reconciled capture mode to the server, so
a feature flip cannot be interpreted using a stale server config snapshot. A
long-running server still needs `trajectory config reload --yes` to converge
its process-wide feature state and performance settings.

When changing Codex capture behavior, preserve these invariants: every accepted
canonical event is durable before acknowledgement; boundary, full-hook,
watcher, and backfill paths materialize the same available evidence; rollout
cursors advance through the server merge path; and feature/setup repair keeps
hook commands, enabled states, and trust hashes in one recoverable transaction.
Uninstall removes Trajectory-owned hook state and cached plugin references
before runtime assets, and leaves those assets intact if either cleanup cannot
be committed.

Verify:

```bash
codex mcp list
trajectory doctor
```

## Hermes Agent

Setup installs a user plugin at `$HERMES_HOME/plugins/trajectory` and updates
`$HERMES_HOME/config.yaml` with both `plugins.enabled: [trajectory]` and
`mcp_servers.trajectory`. Hermes discovers plugins with a `plugin.yaml` and
`__init__.py register(ctx)` entrypoint, so Trajectory uses that native observer
surface rather than hook JSON or shell shims.
When `HERMES_HOME` is unset, Trajectory follows Hermes's platform default:
`~/.hermes` on macOS and Linux and `%LOCALAPPDATA%\hermes` on Windows.

The plugin registers read-only observer hooks:

- `on_session_start` -> `SessionStart`
- `pre_llm_call` -> `UserPromptSubmit`
- `post_api_request` -> `AgentMessage` plus `llm_call` derivation in Go
- `post_llm_call` -> `Stop`
- `pre_tool_call` / `post_tool_call` -> tool events
- approval hooks -> permission events
- subagent hooks -> subagent events
- `on_session_finalize` -> `SessionEnd`

The plugin posts to `http://127.0.0.1:19222/capture/hermes/<event>` with a
bounded timeout and swallows delivery errors so Hermes behavior is unaffected.
The Go capture runtime records `client_source=hermes`, stores Hermes observer
turn IDs as `observer_turn_id`, and uses native Hermes `usage` payloads for
token and cost fields when present.

Durable history uses a separate read-only path:

```bash
trajectory features enable hermes_durable_history
trajectory backfill --from-hermes
trajectory backfill --from-hermes --session <provider-session-id>
trajectory backfill --from-hermes --force
```

Trajectory follows the provider's single literal `HERMES_HOME`, opens
`state.db` read-only with WAL visibility, and reads active messages by their
autoincrement IDs. It preserves provider IDs, tool lifecycles, lineage, and
terminal state. Current stores also preserve tool-result effect disposition and
the bounded `session_model_usage` breakdown as provider diagnostics. Session
token categories and cost remain session aggregates;
the importer does not assign them to turns or synthesize historical LLM calls.
An active final turn remains open and is not locally materialized until Hermes
records its provider boundary; rerun with `--force` after the session ends.

Verify:

```bash
trajectory setup --clients hermes
trajectory features enable hermes_durable_history
trajectory backfill --from-hermes
trajectory doctor
```

## Amp Code

Setup writes a system plugin at `~/.config/amp/plugins/trajectory.ts` or
`$AMP_CONFIG_DIR/plugins/trajectory.ts`, and updates
`~/.config/amp/settings.json` with `amp.mcpServers.trajectory`.

Amp's plugin lifecycle provides `session.start`, `agent.start`, `tool.call`,
`tool.result`, and `agent.end`. The Trajectory plugin starts or reuses
`trajectory serve`, normalizes those events into Pi-compatible payloads, and
POSTs to `http://127.0.0.1:19222/capture/amp/<event>`. The Go runtime records
`client_source=amp`. `tool.call` returns an explicit allow decision so capture
never blocks the tool. The current plugin event types expose thread identity,
prompts, assistant messages, tool calls/results, and agent status, but not
model, token, cost, duration, or terminal-session fields; Trajectory leaves
those fields absent instead of inferring them.

Amp does not expose a session-end plugin event today, so Trajectory does not
synthesize one. Current CI coverage is fixture-only because Trajectory does not
have a usable Amp subscription token for `AMP_API_KEY` headless execution.

The default-off `amp_durable_history` feature adds bounded read-only
reconciliation of top-level `T-*.json` files under
`~/.local/share/amp/threads` or `$XDG_DATA_HOME/amp/threads`. The provider
thread ID is also the live plugin session ID: any native event preserves the
complete trace, while watcher-owned JSONL can be atomically rebuilt after a
provider rewrite. Current per-message usage and legacy usage-ledger events
provide exact model and token components. Legacy ledger rows correlate only by
exact `toMessageId`; provider credits remain a separate native-credit field,
not USD cost. Passive history never registers a session active and never
invents terminal lifecycle. Provider deletion retains the local trace as a
source tombstone. `TRAJECTORY_DISABLE_AMP_HISTORY_WATCHER=1` disables only this
fallback. `ccusage` remains an independent usage-schema cross-check.

Verify:

```bash
trajectory setup --clients amp
trajectory features enable amp_durable_history
trajectory config reload --yes
trajectory doctor
```

## Goose

Setup installs Goose Open Plugins command hooks under
`~/.agents/plugins/trajectory`, or the equivalent root beneath
`GOOSE_PATH_ROOT`. Setup resolves a relative override once against setup's
working directory and embeds that canonical absolute root in every installed
hook, so a later Goose working directory cannot retarget provider discovery.
The hook conveys the same authorized absolute root to the long-running server.
Fresh setup uses the current generic tool-hook family only:
`PreToolUse`, `PostToolUse`, and `PostToolUseFailure`. The adapter continues to
accept the older shell/file-specific hooks and suppresses the duplicate pair
when both families are still installed. It canonicalizes current names such as
`developer__shell` while preserving `native_tool_name`.
Because the current generic payload has no provider tool-call ID, simultaneous
same-name live calls can only use best-effort pre/post correlation. Generic
post-tool payloads also omit the provider result or error body. Durable message
history supplies exact request/result IDs and result payloads only when
Trajectory materializes a provider-owned passive trace; it is not merged back
into existing native tool events.

Goose hook payloads establish lifecycle, prompts, assistant text, tools, and
exact session identity, but not authoritative provider usage or invocation
mode. Lifecycle and prompt HookContext payloads also omit a working directory;
`capture-hook` therefore conveys its own process cwd with
`cwd_provenance=hook_process_working_dir` when Goose did not supply one. That
is invocation-cwd evidence. The durable store is authoritative for the working
directory on provider-owned passive traces, but usage reconciliation does not
replace the hook-derived directory on an existing native trace. Because current
hooks cannot distinguish interactive from headless execution, all Goose hook
sessions use `source_mode=unknown` and are conservatively headless for
sensitivity and segmentation.

The default-off `goose_durable_history` feature reads the current
`sessions`/`messages`/`usage_ledger` schema from `sessions.db`, including its
WAL/SHM state. Platform discovery follows Goose's current Block/goose data root
and exact `GOOSE_PATH_ROOT/data/sessions` override, with legacy roots retained
for migrated installations only when setup has not registered an explicit
root. A setup-registered root is exclusive, so a stale default-store copy with
the same session ID cannot override it. Discovery rejects symlink databases and
caps sessions, rows, row size, fanout, and per-pass reconciliation.
An aggregate 64 MiB provider-snapshot bound and a 96 MiB materialized-output
bound prevent individually valid rows from accumulating into an unbounded
session.

The message parser honors Goose's `userVisible=false` gate for every content
and tool block while retaining only non-content usage/model evidence. Text and
thinking remain available for user-visible messages. Image bytes and redacted
thinking are never retained; system notifications, tool confirmations, and
action/elicitation variants become typed, metadata-only boundaries labeled
`provider_structured_content_fidelity=metadata_only` rather than silently
disappearing or leaking their schemas, arguments, or response payloads.

The provider session ID is also the Open Plugins ID. Watcher-only sessions are
atomically materialized as incomplete passive history. In those provider-owned
passive traces, the SQLite snapshot is authoritative for session/parent
identity, working directory, messages, model/provider, and exact tool
request/result IDs and payloads. For a native-owned JSONL, only exact per-turn
usage corrections carrying validated model/token/cache/cost fields and
metric-ineligible usage observations are appended. Reconciliation does not
replace hook-derived session metadata, repair best-effort tool IDs, or add
omitted tool result/error bodies; native content and lifecycle remain
authoritative. Source revisions deduplicate
retries, per-turn fingerprints append only new or changed corrections, and
replacement/clearing corrections are applied in file order. Periodic
reconciliation keeps SQLite work off the Stop request path and caps the full
native correction transaction, including ownership/index scans, at two
seconds. All setup-managed Goose hooks remain foreground through bounded
server acceptance so provider emission order is preserved; final SessionEnd
publish and live-state cleanup continue asynchronously only after the durable
terminal record is committed. A local canonical fallback preserves lifecycle
when serve is unavailable and, when durable history is enabled, uses the same
indexed exact-source reconcile before committing SessionEnd. SessionEnd
attempts one bounded exact pre-terminal reconcile before preserving the
terminal event. A provider read or lock failure emits an explicit fidelity
diagnostic instead of discarding SessionEnd. A persisted safe-tail index makes native correction
reconciliation linear in newly appended JSONL bytes and invalidates on
same-size rewrites. The index relies on Trajectory's canonical JSONL
append-only contract: shrink, same-size replacement, or a changed trailing
boundary resets it, while a historical mutation outside that boundary followed
by an append is outside the writer contract and requires an explicit backfill
repair. Provider deletion emits a tombstone diagnostic and never fabricates
completion. `ccusage` independently corroborates an override plus some default
roots and the aggregate input/output/total/model shape. It does not cover all
current platform roots and is not an authority for cache or native cost
provenance; the current Goose source and ledger are authoritative for those
fields and for compaction. Only `provider_reported` USD enters attributed cost;
`estimated`, mixed, or carried-forward amounts remain raw provider observations
with unavailable attribution. Nullable, partial, negative, or internally
contradictory token vectors likewise remain raw observations with
`tokens_status=unavailable`; they never become canonical turn usage. If a hook
POST may have been accepted but the response is lost, capture skips the
competing local fallback rather than racing SessionEnd ahead of reconciliation.
Current Goose does not emit another SessionStart when a non-empty conversation
is reopened. The first authoritative post-terminal hook therefore creates an
explicit `resume_evidence=post_terminal_hook` generation boundary before the
new event, reopens enrichment, and restores sequence allocation above the
existing JSONL maximum.

```bash
trajectory setup --clients goose
trajectory features enable goose_durable_history
trajectory config reload --yes
trajectory doctor
```

## Cline CLI

Setup writes Trajectory-owned file hooks under `~/.cline/hooks` or
`$CLINE_DIR/hooks`, plus a verification manifest at
`~/.cline/hooks/.trajectory-cline-hooks.json`. The Cline MCP settings live at
`~/.cline/data/settings/cline_mcp_settings.json`, or the path selected by
`CLINE_DATA_DIR` or `CLINE_MCP_SETTINGS_PATH`.

Cline loads one hook script per hook file name. Trajectory installs fail-open
scripts for `TaskStart`, `TaskResume`, `UserPromptSubmit`, `PreToolUse`,
`PostToolUse`, `TaskComplete`, `TaskCancel`, `TaskError`, and
`SessionShutdown`. Existing user hook files are preserved: if `TaskStart.sh`
already exists and is not Trajectory-managed, setup chooses the next supported
suffix such as `TaskStart.bash`.

The scripts invoke `trajectory capture-hook --client cline --ensure-serve` and
send stdin payloads to `/capture/cline/<event>`. The Go runtime accepts both the
file names and Cline's native payload hook names such as `agent_start`,
`prompt_submit`, `tool_call`, `tool_result`, `agent_end`, and
`session_shutdown`. Captured rows use `client_source=cline` and
`source_dialect=cline.cli.hooks.v1`.

Current Cline hooks expose lifecycle, prompt, tool, assistant summary, and
shutdown payloads, but not stable token/cost usage. Trajectory therefore emits
`turn_end.tokens_status=unavailable` until Cline exposes provider usage
metadata or a transcript backfill path is added.

Verify:

```bash
trajectory setup --clients cline
trajectory doctor
```

## Qwen Code

Setup merges Trajectory-owned settings into `~/.qwen/settings.json` or
`$QWEN_HOME/settings.json`. It preserves existing provider and user hook
configuration, adds `mcpServers.trajectory`, appends
`security.allowedHttpHookUrls` for
`http://127.0.0.1:19222/capture/qwen/*`, and registers native HTTP hooks that
POST directly to `/capture/qwen/<event>`.

Registered emitting events include `SessionStart`, `UserPromptSubmit`,
`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `PermissionRequest`,
`PermissionDenied`, `SubagentStart`, `SubagentStop`, `PreCompact`,
`PostCompact`, `Notification`, `Stop`, `StopFailure`, and `SessionEnd`.
Qwen-only enrichment hooks such as `TodoCreated` and `InstructionsLoaded` are
accepted as no-op capture signals so setup can stay aligned with upstream hook
names without fabricating user-visible events.

The Go capture runtime records `client_source=qwen`. It maps Qwen
`usageMetadata` fields (`promptTokenCount`, `candidatesTokenCount`,
`thoughtsTokenCount`, and `cachedContentTokenCount`) into Trajectory token
fields and emits provider-call `llm_call` rows when a model and token usage are
available with both prompt and total counters. `cachedContentTokenCount` is a
subset of `promptTokenCount`; `candidatesTokenCount` can overlap
`thoughtsTokenCount`. The runtime uses `totalTokenCount` to form strict,
disjoint uncached-input, cache-read, visible-output, and reasoning categories.
Without the total anchor, it preserves the raw candidate/thought counters,
labels the derived split partial, and does not emit a strict `llm_call` or
estimated cost. Malformed counters or contradictions such as cached tokens
exceeding prompt tokens receive the same partial, unpriced treatment; the
provider's numeric counters remain attached as evidence instead of being
silently clamped into an apparently strict result. When stop payloads omit
usage, the runtime reads the Qwen chat JSONL transcript referenced by
`transcript_path`. That fallback applies the same strict counter contract,
reads only a
newline-aligned 256 KiB tail, inspects at most 128 records, and refuses records
larger than 192 KiB. `qwen_transcript_status` and
`qwen_transcript_truncated` disclose unavailable or partial fallback evidence;
the reader never returns older usage after the newest matching assistant record
omits usage.

Default-off durable-history reconciliation and manual repair use:

```bash
trajectory features enable qwen_durable_history
trajectory backfill --from-qwen-sessions [--session ID] [--force]
```

Runtime-root resolution matches current Qwen Code: process and user-level
`.env` overrides are applied first; `QWEN_RUNTIME_DIR` wins; otherwise
`advanced.runtimeOutputDir` is merged in system-default, user, trusted-workspace,
then system-override order; `QWEN_HOME` or `~/.qwen` is the fallback. Relative
paths are working-directory relative. This source contract was audited against
Qwen Code 0.19.11 at `c56ae42fed50aad97b51b856ee721984d5916618`;
0.19.2 remains the version covered by live CI. The importer reads at most 256 MiB from
regular, non-symlink `projects/*/chats/*.jsonl` and
`projects/*/chats/archive/*.jsonl` sources. A session found in both stores or
at multiple paths is reported as ambiguous rather than guessed.

The importer reconstructs the physical tail's active `parentUuid` chain,
coalesces same-UUID fragments in append order, and keeps the latest physical
custom title even when title re-anchoring is outside the active branch. Native
hooks remain authoritative for observed lifecycle and tool timing; retained
history is authoritative for its per-request assistant usage because Qwen's
Stop hook exposes only the terminal request. Prompt plus total counters produce
strict disjoint tokens and `llm_call` events. Without total, raw
candidate/thought counters are retained with partial fidelity and no strict
cost. Invalid, overflowing, or contradictory counters likewise retain numeric
provider evidence but cannot emit strict calls or estimated cost. Canonical replacement
uses the same JSONL lock as native capture. Since the transcript has no durable terminal marker, the importer emits
turn boundaries but never fabricates `session_end`.

While the flag is enabled, `trajectory serve` also runs a bounded watcher. Its
first pass pages existing active and archived sources by source count and
bytes; later passes combine filesystem notifications, cheap signatures, and
rotating full hashes so
same-size/same-mtime rewrites are eventually detected. A crash-safe cursor
retries unacknowledged materialization and local-UI ingest. Native Stop and
SessionEnd hooks request exact reconciliation, and their `transcript_path`
teaches the watcher about workspace-specific runtime roots. Provider deletion
is a tombstone only: retained Trajectory history remains and no lifecycle end
is inferred. Rebuilt canonical snapshots also replace their local-UI
materialization, so spans removed by a provider rewrite do not linger.
Canonical replacement uses the same per-JSONL lock as native capture, so a
concurrent hook append is merged rather than lost.

A valid terminal-hook transcript path also starts discovery when Qwen was not
visible to the serve process at startup. If another serve process currently
owns the watcher lease, the receiving process performs the exact reconciliation
once while retaining that root for watcher handoff.

Automatic discovery begins with the serve process's effective Qwen runtime
root and roots observed in native transcript paths. Historical roots that were
selected only by another workspace's settings before Trajectory was enabled
cannot be enumerated globally; run the explicit backfill command from that
workspace as the complete-history repair path.

Verify:

```bash
trajectory setup --clients qwen
trajectory doctor
```

## Kiro CLI

Setup writes Trajectory-owned Kiro agent configuration into
`~/.kiro/agents/trajectory.json` or `$KIRO_HOME/agents/trajectory.json`, and
merges `mcpServers.trajectory` into `~/.kiro/settings/mcp.json`.
Stable Kiro 2.x loads those embedded hooks when the setup-owned agent is
selected with `--agent trajectory`; setup does not replace the user's default
agent.

Kiro CLI exposes command hooks from agent configuration. Trajectory registers
fail-open command hooks for `agentSpawn`, `userPromptSubmit`, `preToolUse`,
`postToolUse`, and `stop`; Kiro passes each payload as JSON on stdin, and the
hook command invokes:

```bash
trajectory capture-hook --client kiro --ensure-serve --ensure-serve-wait 2s <event>
```

The Go capture runtime records `client_source=kiro` and
`source_dialect=kiro.cli.hooks.v1`. `stop` payloads include
`assistant_response`, so Trajectory writes an `agent_message` followed by
`turn_end`. Current documented Kiro hook payloads do not expose stable token or
cost fields, so turn records use `tokens_status=unavailable`.

The optional `kiro_durable_history` feature adds bounded passive reconciliation
of `$KIRO_HOME/sessions/cli/*.jsonl` plus companion metadata and the macOS or
Linux `kiro-cli/data.sqlite3` `conversations_v2` and legacy `conversations`
stores:

```bash
trajectory features enable kiro_durable_history
```

Provider files are opened read-only, symlinks are rejected, discovery and each
pass are bounded, SQLite uses query-only mode with WAL visibility, and an
in-flight cursor makes delivery retryable after a process crash. Initialization
errors retry with bounded backoff. The exact provider session ID forms one
source across JSONL, SQLite, and hooks. JSONL is the content authority; SQLite
enriches only an exact provider message ID. No ordinal join is allowed. Native
hook content owns any mixed Trajectory JSONL. Deletion creates a diagnostic
tombstone without removing local history or inventing `session_end`. A stable
Windows SQLite location is not documented, so Trajectory does not guess one;
the JSONL contract remains available through `KIRO_HOME`.

The durable schema exposes exact messages, model IDs, tool IDs/results, CWD,
and timestamps but no native token or cost vector. Trajectory does not convert
`response_size` bytes or predecessor local usage estimates into tokens. ccusage
has no Kiro adapter, which supports leaving usage unavailable but is not a
schema authority. Kiro 3.0 early-access session storage is incompatible with
stable 2.x and is not claimed by this watcher.

Kiro's current docs use `includeMcpJson` in agent config; the older
Amazon Q Developer CLI repository used `useLegacyMcpJson`, which is retained
only as predecessor context and not written by Trajectory.

Verify:

```bash
trajectory setup --clients kiro
trajectory features enable kiro_durable_history
trajectory config reload --yes
trajectory doctor
```

## Devin CLI

Devin support is a preview and defaults off. Enable it before setup:

```bash
trajectory features enable devin_cli_instrumentation
trajectory setup --clients devin
```

Setup preserves unrelated user configuration while merging only
Trajectory-owned entries into the platform config (`~/.config/devin/config.json`
on macOS/Linux or `%APPDATA%\devin\config.json` on Windows):

- fail-open `SessionStart`, `Stop`, `PostCompaction`, and `SessionEnd` hooks used
  only to wake source reconciliation
- `mcpServers.trajectory` for the incognito control tool
- a `skills/incognito/SKILL.md` below that platform config root for the global
  `/incognito` UX

When `devin_cli_instrumentation` is disabled, setup must not mutate Devin
configuration or install those assets, and runtime reconciliation must remain
off. Uninstall removes only Trajectory-owned entries and files.

Devin's documented hook schemas do not include a stable `session_id`, including
the lifecycle hooks Trajectory uses as wakes. Raw hook payloads therefore
must not be mapped directly to canonical Trajectory records. They are wake
hints that tell the watcher to reconcile active or changed source identities:

- macOS: `~/Library/Application Support/devin/cli/sessions.db` with transcripts
  under the adjacent `transcripts/` directory
- Linux: `~/.local/share/devin/cli/sessions.db` with transcripts under the
  adjacent `transcripts/` directory
- Windows: `%APPDATA%\devin\cli\sessions.db` with transcripts under the
  adjacent `transcripts\` directory

The reconciler prefers `transcripts/<session-id>.json` and falls back to
`message_nodes.chat_message` in `sessions.db`. Each database/session pair is a
separate source identity and fingerprint, so concurrent sessions are processed
without selecting the newest session for a working directory.

The source parser records `client_source=devin` and keeps the original
database/session provenance in source metadata while mapping it to a
Trajectory-safe session identifier. Transcript and fallback rows can provide
prompts, assistant/thinking content, tool calls/results, model identity, and
per-step prompt, completion, and cache metrics. Final-only aggregate
`Snapshot.Usage` is parsed but is not yet emitted or materialized. If a
supported source exposes native cost, it must stay distinct from estimates.

There is no user-invoked bulk historical backfill/import. The source runtime is
limited to active or changed sources. Durable cursor/delivery recovery, bounded
fanout continuation, and resumable bounded replacement after an upstream
mutation are covered. A replacement can span several delivery budgets without
restarting from page zero. Staging remains side-effect free until canonical
replacement, is globally bounded to eight directories and 256 MiB with a
24-hour age limit, and is discarded if any payload is a symlink. Replacement
atomically refreshes canonical JSONL, then commits prepared live-state,
delivery, and publish projections and queues a bounded local-UI snapshot
refresh. If any post-canonical boundary fails or the bounded work queue is full,
the provider cursor remains unacknowledged and the idempotent projection repair
retries. Completed-turn and mutation-snapshot work is retained durably before
source acknowledgement and retries in-process or after restart until local-UI
ingestion succeeds and turn publication succeeds or is durably queued. Durable
provider turn identity pairs prompts and Stops across separate deltas without
scheduling assistant-only history. Monotonic requested/completed snapshot
generations prevent an in-flight refresh from erasing a newer mutation.
Canonical terminal rows retain a provider snapshot fingerprint, so
rediscovering an unchanged completed source is a no-op even after its bounded
cursor row has expired; a changed fingerprint triggers replacement. A
correction to a finalized source retains exactly one terminal event, and
rebuilt token/cost
observations are marked ineligible for additive metric replay.
Terminal intents are versioned by provider snapshot and finalization holds the
same cross-process delivery fence as canonical repair, so an older worker or a
new watcher owner cannot acknowledge or concurrently finalize a correction.
Transient terminal failures remain in the durable outbox and retry in-process
with bounded exponential backoff; restart recovery is not required to resume
them.
Active-projection recovery is sequence-fenced across crashes. The cursor holds
at most 8,192 resident plus completed rows and 16 MiB, preserving a
completed-source window as large as the production resident limit. Indexed
cursor migration leaves a fail-closed rollback guard and preserves the prior v1
cursor as a recovery backup rather than letting an older binary replay every
visible source. Delivery-state TTL cleanup removes at most 4,096 expired rows per maintenance
pass and continues on a bounded cadence while the watcher remains active.
An already-published remote row that the provider later removes cannot be
retracted from the destination.

Free-form session titles, prompts, assistant, thinking, tool input, and tool
response fields are redacted before either canonical JSONL or the
crash-recovery ledger is written.
Enabling incognito also writes conservative provider-reconciliation evidence.
Delayed source reads remain private after an explicit disable; terminal
completion removes that auxiliary evidence only after canonical event markers
are durable. A source that never proves authoritative terminal completion keeps
the evidence indefinitely as a fail-closed privacy record. Mutation repair
carries those markers forward, so recovery and later corrections cannot drop
publish suppression.

The observed database/transcript schema has no authoritative interactive versus
headless field. Conservatively mark every source-reconciled Devin session
headless/unknown and skip sensitivity classification and segmentation until a
supported mode signal exists. Emit terminal closure only after proving the
database-message to finalized-transcript transition for that exact source
identity. Without that transition, do not synthesize `session_end`; report
terminal closure and final-session metrics as unsupported gaps. Devin source
sessions are provider-terminal-authoritative: generic server shutdown and
orphan recovery must not synthesize closure for them, but crash recovery does
finalize an already-written authoritative provider terminal. The terminal
outbox keeps cleanup and recovery rows until both are acknowledged. If the
process exits after external finalization succeeds but before its effect marker
is durable, finalization may be retried; destination publish receipts remain
the deduplication authority and local cleanup is idempotent.

Devin reads Claude hook configuration by default. Do not change that user
preference. Imported Trajectory Claude hooks must be ignored or reattributed
when `DEVIN_PROJECT_DIR` identifies a Devin process, preventing duplicate
Claude/Devin records for one action.

Verification is fixture-first: use sanitized current-format database and
transcript fixtures, a database-only fallback fixture, and separate concurrent
source identities. Devin now documents `devin --print` as a stable headless
execution mode and stores a persistent token in `credentials.toml`, but the
protected CI environment does not yet provision a dedicated Devin identity or
that credential file. Do not infer a `DEVIN_API_KEY`; add a live gate only after
the dedicated credential and pilot are available. The pinned ccusage comparison
also declines to claim Devin usage because it found no generally reliable local
history; Trajectory therefore emits only explicit per-step metrics present in a
source record and does not infer missing aggregate usage.

Verify the enabled setup surface with:

```bash
trajectory features enable devin_cli_instrumentation
trajectory setup --clients devin
trajectory doctor
```

## gptme

gptme 0.32 support is default-off and hybrid:

```bash
trajectory features enable gptme_instrumentation
trajectory setup --clients gptme
```

Setup writes the actual gptme user config consumed by v0.32,
`~/.config/gptme/config.toml`, on every OS. It installs the
`trajectory_gptme` folder plugin, enables a named `trajectory` MCP server, and
registers `/incognito`. Writes are ownership-aware and fail before mutation
when higher-priority local/project configuration would hide the integration.

The plugin sends metadata-only `SessionStart`, `UserPromptSubmit`,
`PreToolUse`, `PostToolUse`, `Stop`, and `SessionEnd` wake/lifecycle events.
It never duplicates prompt, assistant, or tool content. The server correlates
the raw provider session ID exactly, scans only that source, and uses the
plugin's terminal event without selecting a newest same-project session.

The authoritative source is the composite of `conversation.jsonl`,
`events.jsonl`, and `config.toml` below `GPTME_LOGS_HOME` or gptme's current
data roots. Fingerprints include all three files. Event replay recovers partial
conversation writes and edit/undo replacements; the durable cursor contains
only hashes and IDs. Cold start, changed-path fanout, polling, fsnotify,
replacement, and tombstones are bounded.

Preserve native per-message token categories and aggregate all provider calls
within the user turn. Preserve recorded cost as computed provenance. Treat
naive local timestamps as timezone-unknown. Only explicit
`--non-interactive` is authoritative headless evidence; absent mode remains
headless/unknown for privacy-derived features.

Default CI installs gptme 0.32.0, runs `mock/echo`, and requires a native
plugin `SessionEnd`. Synthetic current-schema fixtures cover mutation and
positive non-headless privacy behavior, and the local-ui contract covers list,
trace, fetch, and scalar readback. Do not enable gptme's optional native OTLP
until hook/store/OTLP deduplication has a deterministic contract.

## CodeWhale

CodeWhale 0.8.68 support is a default-off, watcher-first preview:

```bash
trajectory features enable codewhale_instrumentation
trajectory setup --clients codewhale
```

Setup owns only its user-level hook entries, MCP registration, and incognito
skill. The native `session_start`, `message_submit`, tool, `turn_end`, error,
subagent, and `session_end` hooks are wake hints: CodeWhale generates an
independent `sess_*` hook identifier rather than exposing the UUID in the saved
session. Trajectory therefore never treats hook identity or hook content as the
authoritative transcript. The installed `/incognito` workflow is model-mediated
through the `trajectory_incognito` MCP tool; it is not a native deterministic
CodeWhale toggle.

Saved sessions are schema-v1 JSON files under `$CODEWHALE_HOME/sessions` when
that variable is explicitly set. Otherwise CodeWhale uses
`~/.codewhale/sessions`, relocating or merging missing files from the legacy
`~/.deepseek/sessions` root without overwriting current data. Trajectory watches
direct saved-session files, hashes content so same-size atomic replacement is
visible, treats `checkpoints/latest.json` as the same in-flight logical session,
and excludes `checkpoints/offline_queue.json`. The similarly named
`DEEPSEEK_TUI_SESSIONS_DIR` is not a current CodeWhale runtime setting.

The runtime API and background task manager also persist schema-v2 records under
`$DEEPSEEK_RUNTIME_DIR` or the selected task root's `runtime` directory:
`threads/<id>.json`, `turns/<id>.json`, `items/<id>.json`,
`events/<thread>.jsonl`, and `state.json`. Runtime thread, turn, and item files
are atomic replacements; the event file is append-only and globally sequenced.
Trajectory reconciles terminal records after restart and uses events only for
lower-latency wakeup. A runtime thread's optional `session_id` links it to the
saved UUID; linked stores materialize one CodeWhale session, not duplicate
traces. Unlinked runtime threads keep their own stable identity until such a
link appears.

Runtime turns preserve exact input, output, cache-hit, cache-miss, reasoning,
and reasoning-replay usage plus effective provider/model, timing, status, and
error. Saved messages have no native per-message timestamp, model, or usage, so
their ordering time is synthetic. Saved `metadata.total_tokens` and cost are
session-only facts; cost is CodeWhale-computed, not provider billing. In
headless exec persistence, `model_provider` reflects the explicit provider
selection. Trajectory still prefers exact runtime provenance for per-turn
provider and model attribution when it is available.

`codewhale exec` does not execute native hooks. Plain one-shot exec also writes
no saved session unless it resumes an existing session. `--output-format
stream-json` persists a saved session and emits exact terminal input/output
tokens, but does not expose cache, reasoning, or cost categories. Setup does not
install a wrapper. The default credential-free gate validates the checked-in
native dialect, then attempts to install CodeWhale 0.8.68 and run its real
stream-JSON exec against a loopback OpenAI-compatible server. The npm registry
currently has a 0.8.67 wrapper, but its verified 0.8.68 release manifest is not
yet published; package-install failures therefore skip only the live portion
after the fixture passes. Do not report the live path as passed until those
assets exist and the durable schema-v1 assertions execute.

Until a source exposes an authoritative interaction mode, sensitivity scanning
and task segmentation skip the session. Positive non-headless privacy behavior
remains fixture-backed. The independent ccusage adapter census currently has no
CodeWhale adapter, so it is retained as a negative cross-check rather than used
to validate CodeWhale token or cost derivation.

## ForgeCode

ForgeCode is a default-off passive-history integration:

```bash
trajectory features enable forgecode_instrumentation
trajectory setup --clients forgecode
```

The provider package scans `.forge.db` under `FORGE_CONFIG` when set, otherwise
under an existing legacy `~/forge` root or the current `~/.forge` root. It
opens SQLite read-only, includes WAL and SHM changes in freshness, and creates
one path-safe logical session per canonical database and provider conversation
ID. Cold-start discovery, changed-path fanout, and reconciliation are bounded.
The durable cursor stores full content fingerprints, so
same-size/same-mtime row rewrites are eventually detected even when cheap
SQLite file metadata does not change.

The conversation context is authoritative for messages, raw content, model,
reasoning, tool arguments/results, failure state, native usage precision,
provider cost, and child-conversation IDs. The system message is also the
authoritative CWD source when it carries ForgeCode's
`current_working_directory` tag. Tool results that name an AI child
conversation create exact parent/child events; no temporal or workspace join is
used.

Message rows have provider order but no native timestamps. The adapter anchors
their deterministic synthetic ordering at `conversation.created_at` and marks
both ordering and timestamp provenance. Actual token components use native
token fields. Approximate or mixed components use estimated fields and retain
the provider usage object, preventing them from becoming strict provider-call
usage. Provider cost remains provider-reported.

The watcher never treats a durable row as active or complete. It emits no
`session_end`, does not register a passive session as active, preserves the
local archive after tombstones, and rebuilds only derived JSONL on mutation.
Missing interaction mode is conservatively marked headless so sensitivity and
segmentation skip rather than infer an interactive session.
Setup writes no launcher shim or shell configuration. Product detection requires
the read-only `forge config path` signature ending in `.forge.toml`, avoiding a
collision with unrelated binaries named `forge`.

Setup merges only the owned `mcpServers.trajectory` entry in `.mcp.json` and
writes owned skill/command assets. Incognito requires an exact session selected
from `trajectory status --json`; passive history never guesses a conversation
by recency or workspace. Fixture coverage materializes the sanitized upstream
schema in a WAL-mode SQLite database and exercises parser, mutation, watcher,
setup, marker, and Lapdog list/trace/fetch/scalar behavior. Live CLI persistence
and model-mediated incognito remain explicit follow-ups.

## Warp/Oz CLI

Warp/Oz support is default-off and limited to local provider-owned stores:

```bash
trajectory features enable warp_oz_instrumentation
trajectory setup --clients warp
```

Setup owns only `mcpServers.trajectory` in `~/.warp/.mcp.json` and the
`~/.warp/skills/trajectory-incognito/SKILL.md` file. The capture server watches
bounded stable, preview, legacy, and TUI roots for `warp.sqlite`, `-wal`, and
`-shm` changes. `WARP_DIR` is the explicit override. The source maps each
canonical database/conversation pair to one stable Trajectory identity.

Prefer rich `agent_tasks` rows decoded with public Warp protobuf commit
`248f5f62663e`. Preserve task and parent-task IDs as canonical subagent links.
If no rich messages decode, fall back to user prompts in `ai_queries`; do not
synthesize assistant text, tool calls, token splits, or cost. Emit
`warp.source.protobuf_decode_incomplete` with the schema pin whenever any rich
row cannot be decoded. Conversation token usage is aggregate-only and must stay
separate from per-message input/output usage. It remains diagnostic source
metadata and is not materialized or published as canonical token usage.

No local store field currently proves invocation mode or terminal closure, so
source sessions are headless/unknown and no terminal event is synthesized.
`oz agent run-cloud` is outside the supported contract.

## GitHub Copilot CLI

Setup writes a local Copilot marketplace under
`~/.trajectory/copilot-marketplace`, registers it, and installs
`trajectory@trajectory`. The plugin includes command hooks, `.mcp.json`, and an
incognito skill.

Provider-owned local history is available through
`trajectory backfill --from-copilot-sessions [--session ID] [--force]`.
`COPILOT_HOME` replaces the complete default `~/.copilot` root. The importer
reads current `session-state/<id>/events.jsonl` plus `workspace.yaml` and legacy
flat `<id>.jsonl`, with bounded read-only discovery and current-layout
precedence. It merges into native hook JSONL without replacing native events,
keeps shutdown usage session-scoped, separates fresh input from cache reads and
writes, and does not reinterpret provider request units as USD.

Enable automatic reconciliation for newly created or changed session-state
sources with:

```bash
trajectory features enable copilot_cli_durable_history
trajectory config reload --yes
```

The default-off watcher uses the same central `COPILOT_HOME` resolver and exact
source materializer as manual backfill. Startup establishes a content-free
baseline and does not replay old history. Exact file notifications and bounded
polling detect current/legacy creation, append, replacement, same-stat rewrite,
sidecar change, and deletion. One machine-wide lease owns delivery; a
content-free cursor persists per-source fingerprints and in-flight work across
restart. Provider files remain read-only, native hook facts win during atomic
merge, active/resumed tails remain open, and deletion is a source tombstone-not
a fabricated `session_end`. The explicit backfill command remains the bulk
historical import and repair surface.

## Gemini CLI

Setup writes:

```text
<effective-home>/.gemini/settings.json
<effective-home>/.gemini/hooks/hooks.json
<effective-home>/.gemini/skills/incognito/SKILL.md
<effective-home>/.gemini/commands/incognito.toml
```

`<effective-home>` is the non-empty `GEMINI_CLI_HOME` value or the operating-
system home. The override replaces the home exclusively; it is not the
`.gemini` directory itself. Transcript/token backfill, subagent artifact
lookup, setup diagnostics, inventory, update refresh, and resume placement use
the same resolver and scan `<effective-home>/.gemini/tmp` for history.

`settings.json` registers Trajectory MCP. `hooks.json` uses command hooks with
`curl` to post supported Gemini events to the capture server. The skill and
command expose `/incognito` with an MCP path and HTTP fallback.

## Antigravity CLI

Setup writes:

```text
~/.gemini/antigravity-cli/settings.json
~/.gemini/config/plugins/trajectory/plugin.json
~/.gemini/config/plugins/trajectory/hooks.json
~/.gemini/config/plugins/trajectory/skills/incognito/SKILL.md
~/.gemini/config/plugins/trajectory/commands/incognito.toml
```

`settings.json` registers Trajectory MCP. The root-level named hook definition
uses Antigravity's current `PreToolUse`, `PostToolUse`, `PreInvocation`,
`PostInvocation`, and `Stop` events and posts to `/capture/agy/...`. The adapter
normalizes camelCase identity and workspace fields while preserving
`client_source=agy`. `stepIdx` provides deterministic pre/post tool correlation;
the current PostToolUse payload supplies completion/error status but not tool
output. The hook surface does not expose prompt, assistant, authoritative
provider model, token, cost, or terminal conversation data. Its `modelName`
value can be a selector such as `auto` or a concrete-looking name, so Trajectory
preserves it as `model_label` without treating it as provider identity or using
it for cost. The other unavailable fields are not manufactured.
Enable the default-off durable prompt-history supplement with:

```bash
trajectory features enable antigravity_durable_history
trajectory config reload --yes
```

The watcher reads `~/.gemini/antigravity-cli/history.jsonl`. A
Trajectory/reference compatibility override, `ANTIGRAVITY_CLI_DIR`, supports
isolated roots; current upstream Antigravity CLI does not expose it as a
provider variable. The watcher promotes only exact scoped
`conversationId`, `display`, `timestamp`, and `workspace` fields. It baselines
existing rows on first enable, then reconciles subsequent appends and sessions,
including changes missed while `trajectory serve` was stopped. It uses the
same conversation ID as native hooks and deduplicates stable source-event IDs,
so prompt rows complement rather than replace current hook traces. Provider
deletion or rewrite never removes local history or fabricates lifecycle.
Provider-typed slash-command and unknown typed history rows are not promoted as
model prompts.

The provider's SQLite/protobuf conversation payload remains private and
schema-unstable. Trajectory does not interpret it, so durable history still
does not claim assistant messages, authoritative model, token/cost, tool
payloads, `turn_end`, or `session_end`. Manual replay of history that predates
the first watcher baseline is not implemented.

## Cursor

Cursor has two distinct capture paths.

Cursor Desktop uses setup-managed `~/.cursor/hooks.json` and
`~/.cursor/mcp.json`. Command hooks use Trajectory's durable capture helper and
route Cursor payloads through `/capture/cursor/...`.
Cursor does not accept every Claude lifecycle hook name, so setup writes only
the supported Cursor event set. If Claude Code is not installed, setup also
writes `~/.cursor/skills/incognito/SKILL.md`.

The current cursor-agent bundle can serialize the same native terminal payload
shape as Desktop. Trajectory's capture-hook executable normalizes that trusted
CLI surface. When native delivery is absent, one shared passive source contract
drives both watcher and backfill under `~/.cursor/projects/`: current main files
at `*/agent-transcripts/<session>/<session>.jsonl`, nested child files at
`*/agent-transcripts/<parent>/subagents/<child>.jsonl`, CLI Task children written
as sibling main transcripts, and legacy flat JSONL.
It preserves exact raw/provider IDs, adds a project-scoped path-safe identity,
and links child sessions to the exact parent identity.

The background source is default-off:

```bash
trajectory features enable cursor_agent_durable_history
trajectory config reload --yes
```

Runtime reload starts or stops the watcher without restarting `trajectory
serve`. An enabled watcher starts dormant when the provider root does not yet
exist, while default-off, managed-disabled, environment-disabled, and global
watcher-disabled states create no cursor or transcript state.

The passive source emits only provider-authored text, thinking, tool requests,
tool results, and `turn_ended` evidence that is actually present. Current
fixtures do not expose provider timestamps, model, token/cost usage, tool
results, or SessionEnd. Observation/file-order timestamps are marked derived;
no model, token estimate, cost, successful tool result, or SessionEnd is
manufactured. A skill-file Read therefore proves invocation intent and emits a
pre event, not a fabricated completion. The watcher checkpoints only after a
durable idempotent batch append and detects exact-notification same-stat file
replacement. Provider mutation or deletion atomically rebuilds or clears
watcher-owned canonical JSONL and local readback while preserving native hook traces. Passive source
mode is unknown rather than guessed as Desktop or headless CLI. Lapdog
list/trace/fetch/scalar tests preserve missing token evidence as zero. ccusage
has no Cursor adapter, so it is not independent evidence
for Cursor token or cost recovery. A sanitized cursor-agent
`2026.07.16-899851b` fixture proves that one CLI Task parent can write multiple
children as sibling main transcripts with no provider parent field. Synthesis
therefore requires exact prompt evidence and exactly one project tree containing
the parent. It links to the same project-scoped logical child IDs used by passive
sessions while retaining raw and provider child identity; ambiguous copied parent
IDs fail closed. Legacy text transcript import and Cursor Desktop 3.11 side-chat
storage remain unproven gaps.

For both surfaces, managed `cursor_native_token_usage` enables canonical
publication of the exact input/output/cache-read/cache-write quartet. Pricing
is a separate forward-only decision: `pricing.cursor.mode` is
`off|shadow|emit`, and `pricing.cursor.source` is `org_file` or
`datadog_reference_table`. The organization-file source reads
`~/.trajectory/org/pricing.yaml`; the Reference Table adapter currently emits
`pricing_source_unavailable` and no USD. Missing/partial/invalid/conflicting
tokens, missing or mismatched models, and watcher-only records never fall
through to generic estimation. Historical Cursor monetary records are not
replayed.

## Factory Droid

Setup writes a local Factory marketplace under
`~/.trajectory/factory-marketplace`, registers it with Droid, and installs
`trajectory@trajectory`. The plugin includes command hooks, `mcp.json`, and an
incognito skill.

Capture is beta live CLI capture only. There is no Factory/Droid historical
backfill or transcript import path.

## Hermes Agent

Setup writes a Hermes observer plugin and config entry so Hermes can notify
Trajectory about session, model, tool, and API-request lifecycle events.
Hermes discovers the plugin from its configured plugin roots, and the plugin
posts observer payloads to the local capture server without blocking normal
Hermes behavior.

The Go capture runtime records `client_source=hermes`, preserves Hermes
observer turn identifiers, and uses native Hermes `usage` payloads for token
and cost values when present. Historical Hermes import is not implemented yet.

## Amp Code

Setup writes a system TypeScript plugin plus MCP configuration for Amp Code.
Amp lifecycle events such as session start, agent start, tool calls, tool
results, and assistant messages are normalized as `client_source=amp` events.
Token and cost fields are preserved when Amp exposes them.

Amp does not expose a session-end plugin event today, so live sessions end on
Trajectory's idle lifecycle handling. Historical Amp thread import is not
implemented yet.

## Qwen Code

Setup writes Qwen Code settings for Trajectory MCP plus native HTTP hooks.
Capture uses Qwen's hook transport directly rather than command-line curl
shims, and Qwen payloads are normalized as `client_source=qwen` events.

Qwen Code supports OpenAI-compatible providers. Trajectory records Qwen
`usageMetadata` when present and can read the current chat JSONL transcript as
a fallback for stop payloads that omit usage. Historical Qwen import is not
implemented yet.

## OpenHands

Setup writes command hooks to `~/.openhands/hooks.json` and a Trajectory MCP
server entry to `~/.openhands/mcp.json`. The hooks invoke `trajectory
capture-hook --client openhands --ensure-serve` because OpenHands sends hook
payload JSON on stdin.

Current OpenHands command hooks cover session start, prompts, tools, stop, and
session end. They do not expose assistant messages or token usage today.

## Pi

Setup writes `~/.pi/agent/extensions/trajectory/` and points
`~/.pi/agent/mcp.json` at the extension-local `bin/trajectory mcp` command.

The Pi TypeScript extension subscribes to lifecycle events such as session
start, message end, tool call, tool result, turn end, compaction, model change,
and session shutdown. Current fork/new transitions arrive through
`session_start`; Trajectory links them only when the new session header confirms
the provider's previous-session file. Key events also write through `trajectory
capture-hook` for robustness when a short-lived `pi --print` process exits
before async HTTP posting completes.

Pi exposes native Trajectory tools through the extension and can use the shared
MCP catalog when the environment supports MCP. It does not install a
`hooks.json` file.

Pi history starts with a session header and stores parentage as a provider-owned
session-file reference. OhMyPi uses a separate feature-gated integration:
enable `omp_instrumentation`, then run `trajectory setup --clients omp`.
Setup resolves the effective OMP profile, installs an OMP-native extension
declared through `omp.extensions`, merges MCP into that profile's `mcp.json`,
and sends lifecycle and interaction events to `/capture/omp` with server-owned
`client_source=omp` attribution.

`trajectory backfill --from-omp-sessions` recursively imports the effective
profile's v3 history. Current files begin with a `title` metadata slot before
the session header, and `parentSession` may be an exact provider ID or a file
reference. Discovery and parent resolution are bounded to the provider-owned
corpus; conversion preserves exact IDs, nested children, real tool
results/errors, model changes, native usage, and compaction. Automatic history
watching and a real-executable smoke remain follow-ups; sanitized v16.5.2
fixtures cover setup, capture, conversion, and local-UI readback today.

## OpenCode

Setup installs the OpenCode plugin under the resolved OpenCode config
directory, merges the plugin path plus a `trajectory` MCP entry into
`opencode.json`, and writes the incognito skill into the OpenCode skills
directory.

The plugin SDK events cover chat messages, tool execution before/after events,
and lifecycle events. `trajectory backfill --from-opencode` discovers current
and channel SQLite databases plus retained JSON storage, gives SQLite precedence
for duplicate provider session IDs, and retains JSON-only sessions. It honors
`OPENCODE_DB` plus the exclusive comma-separated `OPENCODE_DATA_DIR` override,
otherwise resolving `XDG_DATA_HOME/opencode` or
`~/.local/share/opencode`. Historical conversion preserves child and archived
sessions, native parent and provider IDs, tool call IDs and terminal status,
reasoning, summed per-call step-finish usage, and native-versus-derived cost
provenance. OpenCode does not install a `hooks.json` file.

`trajectory features enable opencode_durable_history` enables a default-off
serve-side watcher for new or changed durable sessions. It watches current and
channel databases with their WAL/SHM sidecars plus retained session, message,
and part JSON. Reconciliation uses the provider session ID across source
transitions, bounded discovery, exact changed-session lookup, and logical
content fingerprints from the first authoritative content-bearing copy.
Database and WAL notifications for one database are coalesced after a 200 ms
quiet window and forced through at a bounded one-second cadence during a
continuous write storm. SHM coordination notifications fold into an existing
wake but do not schedule work alone because SQLite readers also update SHM;
CHMOD-only lock metadata is ignored. At most one full-content fingerprint and
resulting materialization is attempted per watcher pass; overflow work rotates
durably through the bounded cursor. Startup is a warm no-op; native plugin
traces always win, and their ownership
is checked before provider content hashing as well as under the destination
lock. Provider deletion records a source tombstone without synthesizing
lifecycle completion. Full fingerprints and provider transcript loads share
one non-queueing worker per user across local processes through process-local
admission plus a crash-safe advisory file lock; the subsequent bounded JSONL
conversion is serialized by the destination-file lock. Native
records are capped at 4 MiB, aggregate retained JSON at 16 MiB, messages at
8192, and parts at 32768; discovery also caps roots, databases, source
candidates, directory entries, depth, and 4096 pending changed paths. A limit
or 10 ms admission timeout fails closed so the durable delivery can retry
without replacing richer or stale history. Existing history still requires
explicit `backfill --from-opencode`.

## Kilo Code

Kilo Code uses an OpenCode-compatible plugin surface. Setup installs the
Trajectory plugin under the Kilo config directory (`KILO_CONFIG_DIR` when set,
otherwise `XDG_CONFIG_HOME/kilo` or `~/.config/kilo`), merges the plugin path
plus a `trajectory` MCP entry into `opencode.json`, and writes the incognito
skill into the Kilo skills directory.

The plugin SDK posts events to `/capture/kilo/...`; the server routes those
events through the OpenCode-compatible capture path. Kilo can also send native
OpenTelemetry traces and logs to Trajectory's local OTLP relay when the user
sets `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:19222` and enables Kilo's
OpenTelemetry export. That relay complements plugin capture and does not
replace setup-managed plugin events.

Final assistant accounting is preserved even when Kilo emits completion text
before usage: the plugin sends one compact `AgentUsage` event after final
`message.updated`, and Trajectory records one provider call with input, output,
reasoning, cache-read, cache-write, model, provider, native timestamp, and
provider-reported cost. A missing Kilo usage event fails closed; Stop processing
does not query OpenCode's database as a substitute.

Durable history is a separate default-off fallback:

```bash
trajectory features enable kilo_durable_history
trajectory backfill --from-kilo          # explicit existing-history repair
```

With the feature enabled, `trajectory serve` watches Kilo's official data root:
`$XDG_DATA_HOME/kilo` when set, `~/Library/Application Support/kilo` on macOS,
`%LOCALAPPDATA%\kilo` on Windows, and `~/.local/share/kilo` on other systems.
It reads `KILO_DB` (absolute or relative to the data root), `kilo.db`, current
`kilo-<channel>.db` files, retained legacy `opencode-<channel>.db` files, and
the retained `storage/session`, `storage/message`, and `storage/part` JSON tree.
`KILO_CONFIG_DIR` controls configuration only and is never treated as a data
root. Native plugin JSONL always wins; watcher startup establishes a warm
baseline, source deletion is only a tombstone, and active durable sessions do
not gain a fabricated `session_end`. The Kilo CLI and editor surfaces share the
same core store, so history alone does not reliably identify the originating
frontend.

## Qoder CLI

Qoder instrumentation is preview-gated and source-first:

```bash
trajectory features enable qoder_cli_instrumentation
trajectory setup --clients qoder
```

Setup stages `~/.trajectory/plugins/qoder/trajectory` with a
`.qoder-plugin/plugin.json`, `hooks/hooks.json`, `.mcp.json`, incognito skill,
and command, then delegates validation/install/uninstall to `qodercli plugins`.
Hooks use `capture-hook --client qoder --ensure-serve` and carry the native
`transcript_path`, allowing an exact-source scan. Bounded fsnotify is a latency
optimization; bounded polling and a rotating full-content hash are the
correctness fallback.

Source root precedence is `QODER_PROJECTS_DIR`, then
`QODER_CONFIG_DIR/projects`, then `~/.qoder/projects`. Parse main JSONL,
`-session.json` metadata, and parent `subagents/agent-*.jsonl`; do not merge
QoderWork. Repeated assistant IDs are replacement snapshots, not extra model
calls. A changed emitted prefix triggers a full rebuild of only Trajectory's
derived session JSONL and sequence clock before replaying the current provider
snapshot. Provider source files are read-only.

Keep both identities: path-safe canonical IDs are `qoder-<id>` and
`qoder-<parent>-subagent-<agent>`, while the exact provider identities
`qoder:<id>` and `qoder:<parent>:subagent:<agent>` are recorded in provider ID
fields. This mapping is required because canonical IDs are cross-platform file
names and the shared validator rejects colons.

Fixture tests cover native token/cache fields, tools, thinking, sidecars,
subagents, replacement snapshots, same-stat rewrites, mutation rebuilds,
tombstones, feature precedence, and plugin CLI invocation. Live PAT validation
and native interactive/headless discrimination remain follow-ups.

## CommandCode

CommandCode instrumentation is a default-off, watcher-first preview:

```bash
trajectory features enable commandcode_instrumentation
trajectory setup --clients commandcode
```

Setup merges only Trajectory-owned `SessionStart`, `PreToolUse`,
`PostToolUse`, and `Stop` command hooks into
`~/.commandcode/settings.json`, adds the user-scoped MCP entry in
`~/.commandcode/mcp.json`, and installs owned incognito skill and command
files. The generic `cmd` alias is deliberately excluded from detection;
`command-code` and `commandcode` are used on all platforms; `cmdc` is a
collision-safer Windows identity.
No launcher wrapper is installed.

The authoritative source is
`~/.commandcode/projects/<project>/<session>.jsonl` plus the optional
`<session>.meta.json` sidecar. Checkpoint, prompt, share, and file-history
sidecars are excluded. Current saves atomically rewrite the full transcript,
regenerate message IDs, and can regenerate headless timestamps. Reconciliation
therefore uses provider order, semantic content, and tool-call IDs. A changed
emitted prefix rebuilds only Trajectory's derived JSONL; provider files remain
read-only. Hook delivery accelerates an exact eligible transcript scan, while
bounded polling covers plan/headless modes and missed hooks.

Native hooks supply exact CWD when present and native Stop proves a turn
boundary; hook presence alone does not prove interactive mode. Sessions remain
conservatively `is_headless=true` and `source_mode=unknown` until an
authoritative mode signal exists. The source has no authoritative SessionEnd
and does not reliably persist native model, token, or cost data, so Trajectory does not invent
those fields. Downstream text-based estimates may still appear with estimated
provenance. The ccusage adapter set has no CommandCode source, so it remains a
negative usage-authority cross-check rather than a token/cost oracle.

Sanitized current-format fixtures cover recursive bounded discovery, sidecar
filtering, regenerated IDs/timestamps, exact-source wakeups, mutation rebuilds,
explicit versus unknown tool failures, canonical JSONL, and Lapdog
list/trace/fetch readback. A live authenticated CLI and incognito UX pilot
remain follow-ups.

## Zed

Zed is a default-off passive-history preview:

```bash
trajectory features enable zed_passive_history
trajectory setup --clients zed
```

Read `threads/threads.db` beneath the platform Zed data directory or explicit
`ZED_DIR` with SQLite `mode=ro`. Include WAL/SHM changes in fingerprints, bound
database fanout and watched directories, persist no provider content in the
cursor, emit tombstones, and keep bounded polling active when filesystem
notifications are unavailable or missed.

Decode both JSON and zstd row payloads. Preserve exact `zed:<id>` provider IDs
alongside path-safe `zed-<id>` session IDs. A non-empty `parent_id` is a real
subagent session, not a discovery filter; retain parent identities and emit
`relationship=subagent`. Recover prompt, assistant, thinking, tool call/result,
model, and the first folder path as CWD. Parse `request_token_usage` only as a
native session aggregate; do not assign or materialize it to an assistant
message or turn. Preserve it only as explicitly scoped
`provider_session_usage` metadata on `session_start`. Message timestamps are
derived solely to retain database order
and must carry `provider_timestamp_present=false` plus
`timestamp_provenance=derived_order`; only row created/updated times are
provider-native. Do not
infer lifecycle hooks, launch interception, OTel, or terminal closure.
The database does not expose an authoritative interactive/headless signal, so
mark passive sessions headless/unknown and skip sensitivity classification and
segmentation rather than inventing eligibility.

Setup may merge only the owned `context_servers.trajectory` entry and install
the owned global skill `~/.agents/skills/trajectory-incognito/SKILL.md` because
those are documented Zed surfaces. Verify and uninstall only owned state.
Fixtures cover database discovery, JSON/zstd, WAL fanout, durable no-op,
tombstones, subagent identity, setup ownership, and local-UI readback. Live Zed
UI/schema/incognito and cross-platform root validation remain follow-ups.

## Troubleshooting

Start with:

```bash
trajectory doctor
trajectory config show
trajectory publish status
trajectory logs --grep capture
```

If no data appears, verify that the client-specific plugin or hooks exist, the
capture server is reachable on the configured port, and `trajectory status`
shows recent local sessions before investigating Datadog publish.
