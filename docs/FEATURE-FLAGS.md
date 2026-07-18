
# Feature Flags

Trajectory feature flags gate risky or rollout-sensitive behavior. Use them for
new behavior that mutates durable user state, changes client startup, introduces
wrapper/interposer behavior, depends on managed settings, or changes outbound
network shape.

## Decision Checklist

For feature-oriented work, agents must tell the user the feature-flag decision
before implementation starts:

```text
Feature flag decision: needed/not needed - <reason>.
```

Use a flag when the change mutates durable user or admin config, changes setup
or client registration, changes wrapper/interposer behavior, changes environment
injection or OTLP/network shape, changes publish/export behavior, depends on
managed-settings precedence, introduces a new user-visible workflow, or needs a
fast kill switch for narrow rollout.

Do not use a flag for docs-only changes, tests-only changes, logging-only
visibility, internal refactors with no behavior change, or bug fixes that restore
documented behavior for everyone. Privacy and security fixes should not be made
optional unless a temporary rollout-safety kill switch is required.

## Commands

Inspect effective flags:

```bash
trajectory features list
trajectory features status claude_native_otlp_interposer
```

Persist a user override in `~/.trajectory/config.yaml`:

```bash
trajectory features enable claude_native_otlp_interposer
trajectory features disable claude_native_otlp_interposer
trajectory features clear claude_native_otlp_interposer
```

The same lists are visible through the config surface:

```bash
trajectory config get features.enabled
trajectory config get features.disabled
trajectory config set features.disabled claude_native_otlp_interposer
```

After changing a flag for long-running `trajectory serve` processes, run:

```bash
trajectory config reload --yes
```

## Runtime Overrides

Use process-local environment overrides for tests, emergency kill switches, or
one launched process:

```bash
TRAJECTORY_ENABLE_FEATURES=flag_a,flag_b trajectory ...
TRAJECTORY_DISABLE_FEATURES=flag_a,flag_b trajectory ...
```

Disabled wins when a flag appears in both enabled and disabled lists. A managed
`config.defaults.yaml` disable also wins over user config, so users cannot
locally re-enable an admin-disabled feature.

## Rollout Rules

- Default risky features off unless the user action is already an explicit
  opt-in boundary, such as running `trajectory claude`.
- Put the feature check at the entrypoint and at the mutation or side-effect
  boundary when practical.
- Add tests for default behavior, enabled behavior, disabled behavior, managed
  disabled behavior, and env-disabled kill switch behavior.
- Do not use feature flags as permission to mutate broad user settings. Feature
  flags gate behavior; setup still must use the least invasive supported client
  integration surface.

## Registered Flags

| Flag | Default | Purpose |
| --- | --- | --- |
| `additive_metrics_v1` | on | Publishes completed-turn COUNT companions under the `.additive` namespace for facts that are safe to sum across time. Gauges remain point views and distributions remain percentile/population views. User config, managed config, or `TRAJECTORY_DISABLE_FEATURES=additive_metrics_v1` can stop new additive points without changing either legacy family. Historical correction is a separate explicit operation. |
| `automatic_self_update` | on | Allows `trajectory serve` to perform background self-update checks when `auto_update` is enabled. Managed config and `TRAJECTORY_DISABLE_FEATURES=automatic_self_update` provide rollout kill switches; `TRAJECTORY_AUTO_UPDATE=0` remains the process-local override. |
| `automated_oversight_telemetry` | on | Captures model-backed automatic approval, safety, and quality judgments as bounded oversight operations instead of ordinary sessions. It also exposes the content-free Automated Oversight view in `trajectory view`; provider role and feature are local diagnostics, not public metric dimensions. The default external projection is metadata-only `summary`; disable the flag through user config, managed config, or `TRAJECTORY_DISABLE_FEATURES` to suppress new capture, storage, metrics, UI classification/dashboard, and publish projection. Provider approval and safety behavior is unaffected. |
| `codex_cost_derivation_repair` | on | Allows normal `trajectory serve` startup to run one repair page at most once per 24 hours for already-captured Codex sessions. Active and archived roots are paged together from globally newest to oldest. A page scans at most 5,000 directory entries, examines at most 100 candidates plus 1,000 preferred-live identity probes, starts no new unit after 15 seconds, loads/reconstructs at most 10 sessions, and reindexes at most 25. The ordinary lane uses 16 KiB metadata, 10,000-event, 8 MiB session, and 16 MiB phase in-memory/admission thresholds. One oversized source session and one oversized cache session per page reflow through private spill files and bounded record/turn batches with no fixed total-byte, record-count, record-size, or turn-size rejection; additional heavy sessions are cursor-deferred. An admitted source reconstruction and its paired cache promotion complete as one repair unit even when source work crosses the deadline, without leapfrogging a newer deferred candidate. Partial cache rebuilds are excluded until the final chunk promotes the current derivation. Quiet retained rollouts replace only canonical JSONL with a missing or obsolete cost derivation; current JSONL is left untouched while a missing or stale SQLite projection is reindexed, and already-current projections are not reindexed. Uncaptured history is ignored. User config, managed config, or `TRAJECTORY_DISABLE_FEATURES` can stop the repair without making `trajectory cost` trust stale money. |
| `conversation_view` | off | Adds an experimental conversation-first tab beside Transcript in the local viewer. It keeps user and assistant messages expanded, collapses thinking and tool details behind semantic summaries, bounds long snippets, and preserves safe ANSI terminal colors. Managed config or `TRAJECTORY_DISABLE_FEATURES` can remove the tab without changing captured session data. |
| `codex_boundary_capture` | on | Activates Codex `SessionStart`, `UserPromptSubmit`, and `Stop` plus `^Bash$`-matched paired `PreToolUse` and `PostToolUse` evidence hooks. Canonical tool/assistant/permission/compaction/subagent detail comes from the durable rollout, and watcher-observed `shutdown_complete` finalizes the session. The paired Bash hooks add no canonical tool events; they preserve immediate PR-work snapshots and fail closed on rollout-observed mutation overlap. Disabling activates all ten hooks currently supported by Codex, restoring direct per-tool fidelity for `codex exec --ephemeral` at higher process CPU. Setup, update, and feature flips reconcile commands, matchers, hook states, and trusted hashes; a failed feature reconciliation restores the exact prior config and hook mode. Autoupdate keeps all ten hooks while an old, wrong-home, or ambiguous capture owner is running, then updated-owner startup self-repairs to paired boundary mode. Existing Codex sessions keep the hook snapshot loaded at startup. Managed config or `TRAJECTORY_DISABLE_FEATURES` can select full-hook compatibility mode. |
| `codex_hook_cpu_pacing` | on | Applies a bounded 400 ms startup spread to enabled Codex command hooks using a process-local atomic sequence whose evenly permuted slots are not perturbed by unrelated host PIDs, and caps server admission at 1,536 in-flight requests and 256 MiB including fixed request overhead. The measured 20-session boundary profiles launch 380, 540, or 900 hook commands; the cap retains headroom for the 1,340-command all-Bash safety workload and full-hook compatibility. Disabled capture exits before pacing or helper startup, and no cross-process pacing lock is held. Admission overload returns the existing definite-unavailable `503` before reading a body. The empirically tuned two-worker durable-processing bound remains active when this feature is disabled; per-session stripes preserve lifecycle ordering. Pacing does not drop, reorder, asynchronously defer accepted events, or select boundary versus compatibility capture. User config, managed config, or `TRAJECTORY_DISABLE_FEATURES` can disable it. |
| `cost_contract_reconciliation` | off | Enables the read-only `trajectory cost reconcile` preview. The command independently rematerializes selected local session JSONL, compares supported client-native transcript evidence, and inspects retained v2 outbox rows without migrating or repairing the live cache/outbox. Managed config or `TRAJECTORY_DISABLE_FEATURES` can stop the preview without disabling stored-v2 inspection permanently. |
| `cost_fidelity_heartbeat` | off | Managed-only daily reconciliation for an explicitly assigned cohort. It audits only the immediately previous fully closed UTC day after the local activation boundary, uses indexed session/native receipts and hard budgets, and never catches up or backfills historical periods. The feature authorizes local audit only; `cost_fidelity_heartbeat.export.enabled: true` plus managed required-destination references is a separate export gate. User/project config and `TRAJECTORY_ENABLE_FEATURES` alone cannot start it. Managed disable or `TRAJECTORY_DISABLE_FEATURES=cost_fidelity_heartbeat` stops both audit and export. |
| `cost_contract_v2` | on | Adds `trajectory.cost_contract:v2` to eligible newly published live cost metrics so authoritative dashboards can positively exclude legacy and generic-backfill distributions. Disable only as an emergency publish-contract kill switch; disabling never blesses historical data. |
| `cursor_native_token_usage` | on | Managed-only default-on for Cursor Desktop and cursor-agent native input, output, cache-read, and cache-write capture. Canonical token publication and suppression of legacy/generic Cursor proxy cost activate together. Pricing defaults to `pricing.cursor.mode: emit` with `source: org_file` (missing rate card stays unpriced, not $0); managed `off` and `TRAJECTORY_DISABLE_FEATURES=cursor_native_token_usage` are kill switches. User config cannot enable this managed-only flag. |
| `cursor_task_subagent_synthesis` | on | When Cursor omits `subagentStart`/`subagentStop`, synthesize parent-side `subagent_start`/`subagent_stop` at session end from Task/Agent launches paired to nested `agent-transcripts/<parent>/subagents/<child>.jsonl` children or CLI sibling transcripts whose first user prompt matches the Task prompt. Start uses the Task launch timestamp; stop prefers child transcript mtime. Native Desktop hooks still win; synthesis is idempotent and launch-linked via `tool_use_id`. Managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `cursor_agent_durable_history` | off | Enables bounded read-only reconciliation of cursor-agent's provider-owned main and subagent JSONL transcripts. Native command-hook turns remain authoritative; passive source mode stays unknown; mutation or deletion rebuilds or clears only watcher-owned local history; incomplete discovery and duplicate raw IDs across projects fail closed. `TRAJECTORY_DISABLE_CURSOR_AGENT_WATCHER=1` is the watcher-specific kill switch. |
| `claude_native_otlp_interposer` | on | Allows `trajectory claude` to route Claude Code native OTLP through local `trajectory serve` for that launched process. Setup does not write Claude settings files. Disable this flag to keep `trajectory claude` from injecting native OTLP env vars. |
| `claude_skill_file_hooks` | off | Allows the Claude fallback path to write reversible Trajectory-owned hook entries into user or project `SKILL.md` frontmatter. Normal setup omits the prompt-time sync hook while this flag is off. Existing prompt hooks, setup refresh, and Claude uninstall remove owned entries when disabled; unrelated skill metadata and user edits are preserved. Enable explicitly, then rerun `trajectory setup --clients cc` before using `trajectory claude skills sync`. Managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable. |
| `claude_desktop_capture` | on | Enables Claude Desktop (macOS) capture: a near-real-time `trajectory serve` watcher that tails `local-agent-mode-sessions` `audit.jsonl` transcripts, plus backfill (`client_source=claude-desktop`) and app-bundle detection. On by default (macOS-only; the watcher is additionally darwin-gated and honors `TRAJECTORY_DISABLE_CLAUDE_DESKTOP_WATCHER=1`). Disabling this flag is the kill switch that makes Claude Desktop fully inert - not detected/reported, not imported, and the watcher does not start - via a durable `trajectory features disable claude_desktop_capture`, managed config, or `TRAJECTORY_DISABLE_FEATURES=claude_desktop_capture`. |
| `builtin_wrapper_command_shims` | on | Allows the explicit `trajectory setup --install-client-shims` opt-in to write transparent `claude` and `codex` launchers backed by Trajectory's built-in wrappers. Setup records the real upstream binary, refuses self-wrapping and unowned-file replacement, and does not edit shell startup files. User, managed, or environment disable prevents new installs and makes installed shims pass through without instrumentation. |
| `devin_cli_instrumentation` | off | Enables preview setup-managed Devin hooks, MCP, incognito skill, and authoritative local-source reconciliation. When disabled, setup does not mutate Devin configuration and runtime reconciliation remains off; managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `omp_instrumentation` | off | Enables preview setup-managed OMP lifecycle extension and MCP registration. Explicit read-only OMP history import remains available for repair when the flag is off; managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `opencode_durable_history` | off | Enables bounded read-only reconciliation of newly created or changed OpenCode SQLite and retained-JSON sessions. Native plugin traces remain authoritative, startup does not replay old history, and provider deletion never fabricates `session_end`. Managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `kilo_durable_history` | off | Enables explicit `backfill --from-kilo` repair and bounded read-only reconciliation of newly created or changed Kilo SQLite and retained-JSON sessions. Native Kilo plugin traces remain authoritative, startup does not replay old history, and provider deletion never fabricates `session_end`. `TRAJECTORY_DISABLE_KILO_WATCHER=1` disables only the background watcher; managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `amp_durable_history` | off | Enables bounded read-only reconciliation of Amp's provider-owned `T-*.json` thread files. Exact thread IDs correlate passive history with live plugin capture, native traces remain authoritative, startup imports retained threads in bounded passes, provider credits remain distinct from USD, and provider deletion never fabricates `session_end`. `TRAJECTORY_DISABLE_AMP_HISTORY_WATCHER=1` is the watcher-specific kill switch. |
| `goose_durable_history` | off | Enables count- and byte-bounded read-only reconciliation of Goose's schema-v15 SQLite session store. Exact provider IDs let ledger-derived model/token/cache corrections and provider-reported USD enrich native Open Plugins traces without replacing them; other native cost labels remain unattributed, passive-only sessions remain incomplete, deletion never fabricates `session_end`, and `TRAJECTORY_DISABLE_GOOSE_HISTORY_WATCHER=1` disables only this watcher. |
| `kiro_durable_history` | off | Enables bounded read-only reconciliation of Kiro CLI's provider-owned session JSONL and current or legacy SQLite conversation rows. Exact session IDs combine the stores, JSONL content remains authoritative, native hook traces always win, and provider deletion never fabricates `session_end`. No tokens or cost are inferred. `TRAJECTORY_DISABLE_KIRO_HISTORY_WATCHER=1` is the watcher-specific kill switch. |
| `hermes_durable_history` | off | Enables the explicit `trajectory backfill --from-hermes` workflow. When disabled, Trajectory does not open Hermes `state.db` or write derived canonical history. Managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `antigravity_durable_history` | off | Enables bounded read-only reconciliation of exact conversation IDs, user prompts, timestamps, and per-prompt workspaces from Antigravity CLI's provider-owned `history.jsonl`. Provider-typed slash commands and unknown typed history rows are skipped. The first scan baselines existing rows; subsequent appends and sessions are reconciled, including changes missed while `trajectory serve` was stopped. Native plugin events remain authoritative for tools and Stop metadata. The watcher does not interpret private protobuf/SQLite payloads or invent assistant, model, token, cost, turn-end, or session-end evidence. Managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request; `TRAJECTORY_DISABLE_ANTIGRAVITY_HISTORY_WATCHER=1` is the narrow runtime kill switch. |
| `qwen_durable_history` | off | Enables explicit Qwen Code durable-history backfill plus bounded automatic reconciliation of provider-owned active and archived chat JSONL. The watcher cold-starts in pages, learns workspace-specific runtime roots from native transcript paths, shares the canonical JSONL lock with native capture, retains tombstoned history, and never fabricates `session_end`. Managed config, `TRAJECTORY_DISABLE_FEATURES`, global watcher disable, or `TRAJECTORY_DISABLE_QWEN_WATCHER=1` wins over a local enable request. |
| `copilot_durable_history` | off | Enables the explicit GitHub Copilot CLI session-state history backfill workflow. It reads bounded provider-owned current and legacy history, reconciles canonical session JSONL without replacing native hook evidence, and never treats provider request cost or nano-AIU as USD. Managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `copilot_cli_durable_history` | off | Enables bounded read-only reconciliation of newly created or changed GitHub Copilot CLI `session-state` sources. Startup does not replay retained history; native plugin facts remain authoritative; active/resumed tails remain open; shutdown usage stays session-scoped; provider deletion never fabricates `session_end`. Managed config, `TRAJECTORY_DISABLE_FEATURES`, and the emergency `TRAJECTORY_DISABLE_COPILOT_HISTORY_WATCHER=1` process switch win over a local enable. |
| `forgecode_instrumentation` | off | Enables preview setup-owned ForgeCode MCP/incognito assets and read-only reconciliation of provider-owned `.forge.db` history. It installs no launcher shim and claims no live lifecycle. When disabled, setup does not mutate ForgeCode configuration and the watcher remains off; managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `qoder_cli_instrumentation` | off | Enables preview setup-managed Qoder native-plugin installation and authoritative JSONL transcript reconciliation. When disabled, setup does not install the plugin and the watcher remains off; managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `commandcode_instrumentation` | off | Enables preview setup-managed CommandCode wake hooks, MCP and incognito assets plus read-only reconciliation of provider-owned JSONL transcripts. No wrapper is installed, provider files remain read-only, and no SessionEnd, token, or cost source is inferred. Managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `kimi_cli_instrumentation` | off | Enables preview setup-managed Kimi Code hooks, MCP, incognito skill, and provider-owned JSONL/state reconciliation. Current `KIMI_CODE_HOME` data wins over legacy migration copies. Managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `warp_oz_instrumentation` | off | Enables preview setup-managed Warp MCP and incognito skill plus read-only reconciliation of local Warp Desktop and local Oz CLI stores. Warp cloud runs are excluded. Managed config or `TRAJECTORY_DISABLE_FEATURES` wins over a local enable request. |
| `vscode_copilot_instrumentation` | off | Enables preview user-scoped VS Code Copilot Chat OTel settings, MCP and incognito prompt assets, passive chat-history reconciliation, and strict first-party native OTel attribution. Content capture stays off. Managed config and `TRAJECTORY_DISABLE_FEATURES` win over a local enable. |
| `windsurf_instrumentation` | off | Enables preview setup-managed Windsurf Cascade hooks, MCP and incognito skill, authoritative transcript reconciliation, and the narrow allowlisted ItemTable fallback. When disabled, setup does not mutate Windsurf settings and the watcher remains off; managed config or `TRAJECTORY_DISABLE_FEATURES` wins. |
| `zed_passive_history` | off | Enables preview read-only reconciliation of Zed Agent `threads.db` history plus setup-owned MCP and global incognito skill registration. It claims no hooks, wrapper, or native OTel surface. When disabled, setup does not mutate Zed settings and the watcher remains off; managed config or `TRAJECTORY_DISABLE_FEATURES` wins. |
| `personal_cost_guard` | off | Enables discovery and explicit setup of the Personal Cost Guard preview and permits its safe-boundary hook decisions. Setup still requires explicit local consent, selected clients, and a positive session amount. Managed config or `TRAJECTORY_DISABLE_FEATURES` can disable both the guide topic and runtime safeguard. |
| `local_pr_work_attribution` | on | Derives durable local PR/MR work context from instrumented agent events and bounded read-only Git state. This is enabled for everyone by default; disable it only as an emergency managed or process-local kill switch. It never permits provider API, credential-helper, Git-hook, shell-history, or network access. |
| `historical_metric_replay` | on | Managed-only execution gate for bounded historical metric campaigns. It is inert without a managed `historical_replay.campaigns` record. Authorized campaign kinds can derive sparse AI-assisted PR observations or a separate additive historical turn-cost series from metric-ineligible Claude Code, Codex, Cursor Desktop/cursor-agent, Pi, and OpenCode laptop history. Each campaign records a permanent receipt. A managed disable or `TRAJECTORY_DISABLE_FEATURES=historical_metric_replay` prevents new claims; it does not retract completed campaigns or queued outbox rows. |
| `session_trace_snapshot_publish` | off | Allows an explicitly confirmed snapshot of one captured session to publish to a destination independently authorized by managed `session_trace_publish` policy. The flag alone never authorizes a destination. |
| `trajectory_disable_command` | on | Allows the explicit `trajectory disable` action to create `~/.trajectory/capture.disabled`. Managed config or `TRAJECTORY_DISABLE_FEATURES` can disable new use during rollout. `trajectory enable` remains available even when this flag is off so rollback cannot strand a user in the disabled state; existing markers remain honored until cleared. |
| `watcher_state_migration` | on | Stores Codex and Cursor Agent cursors and leader locks under root/source-keyed `${TRAJECTORY_HOME}/state/watchers/` paths. Enabled binaries dual-read and dual-write the released `${TRAJECTORY_HOME}/.state/` cursors and acquire the released leader lock first, so old binaries and rollback remain safe. User, managed, or environment disable returns entirely to the released paths. Changing this flag on a running serve owner is replacement-required; `trajectory config reload --yes` reports that status instead of moving an active watcher between namespaces. |
| `cache_fts_index` | off | Builds SQLite FTS5 full-text indexes over cached `tool_calls` and `turns` text during cache materialization so agents can run indexed `MATCH` search instead of full-table `LIKE` scans. When off there are no FTS objects and zero materialization overhead. Enabling creates trigram (`tool_calls`) and word/bm25 (`turns`) virtual tables plus keep-in-sync triggers, and runs a one-time backfill/rebuild for an already-populated cache. Disabling drops the FTS objects to reclaim space. Managed-disable and `TRAJECTORY_DISABLE_FEATURES=cache_fts_index` act as kill switches. |
