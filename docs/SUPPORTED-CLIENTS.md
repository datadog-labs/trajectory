# Supported Clients

Trajectory instruments AI coding agents via hooks that capture session events
to a local server. Each client has its own plugin/extension format, Trajectory
release status, and upstream CLI version support.

For the lower-level install artifacts, hook surfaces, watcher behavior, and
backfill boundaries per client, see
[CLIENT-INSTRUMENTATION.md](CLIENT-INSTRUMENTATION.md).
For the shared MCP tool and resource catalog, run `trajectory user-guide mcp`.
For the built-in client overview and per-client guides, run:

```bash
trajectory user-guide clients
trajectory user-guide clients/codex
trajectory user-guide clients/agy
trajectory user-guide clients/goose
trajectory user-guide clients/amp
trajectory user-guide clients/cline
trajectory user-guide clients/qwen
trajectory user-guide clients/openhands
trajectory user-guide clients/aider
trajectory user-guide clients/continue
trajectory user-guide clients/mistral-vibe
trajectory user-guide clients/grok
trajectory user-guide clients/codebuff
trajectory user-guide clients/kilo
trajectory user-guide clients/kiro
trajectory user-guide clients/devin
trajectory user-guide clients/gptme
trajectory user-guide clients/codewhale
trajectory user-guide clients/forgecode
```

## Quick Reference

Trajectory status describes the release posture for each integration. Version
support distinguishes a validated minimum from exact versions inspected for
compatibility. A version listed as the latest checked does not expand the
supported range by itself.

| Client | Setup integration | Trajectory status | Version support | Hook mechanism | Relay or native telemetry |
|--------|-------------------|-------------------|-----------------------|----------------|---------------------------|
| Claude Code | `trajectory setup --clients cc` (`--install-client-shims` optional) | Supported | 2.0+ | HTTP hooks + MCP; optional transparent `trajectory claude` launcher | Claude native OTLP can be relayed through Trajectory |
| Claude Desktop (macOS) | On by default; optionally `trajectory setup --clients claude-desktop` | Capture (near-real-time watcher + backfill) | macOS GUI app (bundle `com.anthropic.claudefordesktop`); no CLI | Darwin `serve` audit.jsonl watcher (near-real-time) + filesystem backfill (`--from-claude-desktop`) | Audit JSONL live capture + backfill (`client_source=claude-desktop`); incognito honored; serve-side native-OTLP attribution ready; on by default, `claude_desktop_capture` is the kill switch |
| Codex CLI | `trajectory setup --clients codex` (`--install-client-shims` optional) | Supported | 0.128.0+ | Three boundary command hooks plus rollout detail/terminal by default; ten-hook compatibility and optional transparent `trajectory codex` launcher | Responses proxy spans and rollout backfill |
| GitHub Copilot CLI | `trajectory setup --clients copilot`; optional `copilot_cli_durable_history` watcher | Beta | Public plugin hook and session-state contracts; no stable minimum pinned | Copilot plugin command hooks + MCP + provider history backfill/watcher | Fixture-proven hooks, durable watcher, and Lapdog readback; protected live CLI gate pending |
| Gemini CLI | `trajectory setup --clients gemini` | Supported | 0.30.0+ | Managed command hooks + MCP | Hook payload token/cost fields |
| Antigravity CLI (`agy`) | `trajectory setup --clients agy` | Supported | 1.0.12 and 1.1.2 inspected | Native Antigravity plugin hooks + MCP; optional exact prompt-history watcher | Current-schema fixture, local plugin validation, real 1.1.2 `agy --print` hook-delivery proof, and provider-history/local-ui fixture proof; successful provider response not claimed |
| Goose | `trajectory setup --clients goose`; optionally enable `goose_durable_history` | Beta | 1.43.0 source inspected; 1.39.0 live tested | Open Plugins command hooks plus default-off SQLite reconciliation | Live OpenAI-backed hook CI; schema-v15 history, native enrichment, and local-UI contracts covered by fixtures |
| Cline CLI | `trajectory setup --clients cline` | Beta | 3.0.34 tested | File hooks + MCP | Live OpenAI-backed CI; current hooks omit token/cost usage |
| Cursor Desktop | `trajectory setup --clients cursor` | Supported | 1.0+ | Command hooks that POST to capture through a durable helper | Native four-component token payloads behind managed rollout; real sanitized fixtures |
| cursor-agent CLI | Same Cursor setup for hooks; enable `cursor_agent_durable_history` for passive fallback | Beta | Current installed CLI bundle tested; current 3.11 storage pilot pending | Shared command-hook schema when dispatched + default-off current main/child and legacy flat JSONL fallback | Fixture-backed passive fidelity and protected native/passive identity gate |
| Factory Droid | `trajectory setup --clients droid` | Beta | Public plugin hook contract; no stable minimum pinned | Factory plugin command hooks + MCP | Plugin command capture only |
| Hermes Agent | `trajectory setup --clients hermes` | Beta | Public observer-hook contract; no stable minimum pinned | Observer plugin hooks + MCP | Observer usage payloads when present |
| Amp Code | `trajectory setup --clients amp` | Beta | Current plugin API inspected; no stable minimum pinned | System TypeScript plugin events + MCP | Fixture-tested until a usable `AMP_API_KEY` exists |
| Qwen Code | `trajectory setup --clients qwen` | Beta | 0.19.2 tested | Native HTTP hooks + MCP | Live OpenAI-backed CI with usage metadata |
| OpenHands | `trajectory setup --clients openhands` | Beta | V1 CLI tested | Command hooks + MCP | Live OpenAI-backed CI with generic Metrics readback; command hooks omit token/assistant payloads |
| Aider | `trajectory setup --clients aider --install-client-shims` | Beta | Current CLI tested | Opt-in command shim + analytics/history sidecar | Live OpenAI-backed CI; usage/cost from Aider analytics log |
| Continue CLI | `trajectory setup --clients continue --install-client-shims` | Beta | 1.5.47 tested | Opt-in `cn` command shim + session JSON readback | Live OpenAI-backed CI plus current-schema tool/usage and Lapdog fixtures |
| Mistral Vibe | `trajectory setup --clients mistral-vibe --install-client-shims` | Beta | 2.20.0 inspected | Opt-in `vibe` command shim + native identity/tool hooks + exact-identity bounded post-run import | Live OpenAI-backed CI; provider session token totals and client-estimated cost remain session-scoped |
| Codebuff | `trajectory setup --clients codebuff --install-client-shims` | Beta | 1.0.682 inspected | Opt-in command shims + chat-history importer | Fixture-tested; usage from Codebuff `chat-messages.json` following ccusage's adapter shape |
| Pi | `trajectory setup --clients pi` | Supported | Current CLI tested | TypeScript extension + MCP | Extension events with provider-call usage |
| Oh My Pi (`omp`) | Enable `omp_instrumentation`, then `trajectory setup --clients omp`; history repair with `trajectory backfill --from-omp-sessions` | Beta (preview) | v16.5.2 source and sanitized durable fixtures | Native `omp.extensions` lifecycle + MCP; profile/XDG-aware bounded recursive v3 import | Setup, path matrix, route attribution, and durable fixtures; real executable smoke and automatic watcher pending |
| OpenCode | `trajectory setup --clients opencode` | Supported | Current CLI tested | Plugin SDK events + MCP | Plugin SDK events plus JSON-storage/SQLite backfill and opt-in durable watcher |
| Kilo Code | `trajectory setup --clients kilo` | Beta | Current CLI tested | Plugin SDK events + MCP; default-off durable-history fallback | Native five-category usage and provider cost from plugin/SQLite records; optional native OTLP relay |
| Kiro CLI | `trajectory setup --clients kiro` | Beta | Stable 2.12.2 manifest and public command-hook/retained-session contracts inspected | Agent command hooks + MCP; optional durable history | Fixture-tested hooks plus JSONL/SQLite retained-history reconciliation; no native usage metadata |
| Devin CLI | Enable `devin_cli_instrumentation`, then `trajectory setup --clients devin` | Beta (preview) | Public hook/source contract; no stable minimum pinned | Local source reconciliation + command-hook wake hints + MCP | Sanitized DB/transcript fixtures; protected credential-file pilot pending |
| Qoder CLI | Enable `qoder_cli_instrumentation`, then `trajectory setup --clients qoder` | Beta (preview) | 1.0.43 inspected | Native plugin wake hooks + authoritative JSONL transcript reconciliation + MCP | Sanitized current-format fixtures; protected PAT live follow-up pending |
| CommandCode | Enable `commandcode_instrumentation`, then `trajectory setup --clients commandcode` | Beta (preview) | 0.44.1 package contract inspected | Native wake hooks + authoritative mutable-transcript reconciliation + MCP | Sanitized current-format fixtures plus canonical JSONL and Lapdog readback; live authenticated pilot pending |
| Kimi Code CLI | Enable `kimi_cli_instrumentation`, then `trajectory setup --clients kimi` | Beta (preview) | Current provider source and hook contract inspected | Provider-owned wire/context/state reconciliation + wake hooks + MCP | Sanitized current and legacy fixtures; protected live CI follow-up requires `KIMI_MODEL_NAME` and `API_KEY` |
| gptme | Enable `gptme_instrumentation`, then `trajectory setup --clients gptme` | Beta (preview) | 0.32.0 tested | Metadata-only native plugin hooks + authoritative conversation/events/config reconciliation + MCP | Real credential-free `mock/echo` live CI plus local-ui and privacy fixtures |
| CodeWhale | Enable `codewhale_instrumentation`, then `trajectory setup --clients codewhale` | Beta (preview) | 0.8.68 source and fixture contract pinned | Authoritative saved-session/runtime-store reconciliation + wake-only native hooks + MCP | Native-dialect fixtures plus a credential-free stream-JSON gate; live install skips until 0.8.68 release assets are published |
| ForgeCode | Enable `forgecode_instrumentation`, then `trajectory setup --clients forgecode` | Beta (passive-history preview) | 2.13.17 source contract inspected | Read-only `.forge.db` reconciliation + MCP + owned incognito skill/command | Sanitized current-schema fixtures plus Lapdog list/trace/fetch/scalar readback; live CLI persistence and incognito pilot pending |
| Warp/Oz CLI | Enable `warp_oz_instrumentation`, then `trajectory setup --clients warp` | Beta (preview) | Current local `warp.sqlite` and public Warp protobuf contract | Local Warp Desktop and local `oz agent run` source reconciliation + MCP | Sanitized SQLite/protobuf fixtures; cloud runs excluded; live auth/lifecycle proof pending |
| VS Code Copilot Chat | Enable `vscode_copilot_instrumentation`, then `trajectory setup --clients vscode-copilot` | Beta (fixture preview) | Current VS Code agent OTel and chat-session contracts | Passive JSONL/JSON history + strict first-party native OTel + MCP | Sanitized source/OTel fixtures; real Electron/UI OTel and incognito correlation smoke still required |
| Windsurf | Enable `windsurf_instrumentation`, then `trajectory setup --clients windsurf` | Beta (preview) | Public Cascade hooks/transcript contract inspected 2026-07-11 | Native Cascade hooks + authoritative transcript reconciliation + narrow legacy DB history fallback + MCP | Official-schema synthetic fixtures; live IDE pilot pending |
| Zed | Enable `zed_passive_history`, then `trajectory setup --clients zed` | Beta (preview) | Pinned external source shape at `0dc2402` inspected | Read-only `threads.db` reconciliation + MCP + global skill | Sanitized JSON/zstd SQLite fixtures; live Zed UI/schema/incognito follow-up pending |

## Feature Coverage Matrix

This section separates capture fidelity from privacy and derived-feature
coverage. Incognito is a server-side Trajectory gate for every captured session
once the session is toggled; the privacy matrix calls out whether setup gives
that client a first-class way to toggle it. Sensitivity classification and task
segmentation are core Trajectory features for captured non-headless sessions;
headless sessions are captured and published when configured, but always skip
sensitivity classification and segmentation.

### Capture And Telemetry

| Client | Live capture | Tool/model events | Token/cost usage | Backfill | Resume |
|--------|--------------|-------------------|------------------|----------|--------|
| Claude Code | Yes, HTTP hooks | Yes | Yes | Transcript backfill | Yes |
| Codex CLI | Yes, command hooks plus rollout watcher fallback | Yes | Yes | Codex rollout backfill | Yes |
| GitHub Copilot CLI | Beta Copilot plugin command hooks plus default-off bounded provider session-state watcher | Native live hooks provide command-level lifecycle, prompt, tool, and session events but no assistant response body; manual history backfill or the opt-in watcher adds assistant text/reasoning, tool results, permissions, and subagents | History preserves native shutdown model aggregates; cache categories are separated and never assigned to a turn | Explicit bulk backfill plus automatic discovery only when `copilot_cli_durable_history` is enabled | Not yet |
| Gemini CLI | Yes, managed command hooks | Yes | Yes | Gemini transcript backfill | Yes |
| Antigravity CLI (`agy`) | Yes, native plugin command hooks | Tool call/input, tool completion/error, invocation wake signals, execution-loop Stop metadata, and a non-authoritative hook model label; exact user prompts/timestamps/workspaces plus current schema-v1 generation models when `antigravity_durable_history` is enabled | Exact provider uncached-input, total-output, and cache-read counts; output includes thinking, no reasoning breakdown or provider-billed cost | Default-off watcher baselines existing JSONL/SQLite rows, then reconciles subsequent provider changes; `trajectory backfill --from-antigravity` explicitly repairs retained pre-baseline history | No setup-managed resume |
| Goose | Yes, Open Plugins command hooks | Session, prompt, assistant, and canonical tool events; generic hooks omit provider tool IDs and result/error bodies, so same-name concurrent correlation is best-effort | Live hooks omit usage; `goose_durable_history` supplies validated model, input/output and optional cache categories plus compaction observations; only complete provider-reported USD is attributed | Bounded read-only SQLite reconciliation behind `goose_durable_history`; provider-owned passive traces retain exact metadata and tool facts, while native traces receive usage-only corrections | Native post-terminal hooks establish same-ID resume generations; no setup-managed resume command |
| Cline CLI | Yes, file hooks | Lifecycle, prompt, tool, assistant-message, turn, and session-end events | Not exposed by current hook payloads; `turn_end.tokens_status=unavailable` | Not yet | No setup-managed resume |
| Cursor Desktop | Yes, command hooks | Yes | Native input/output/cache-read/cache-write on by default (`cursor_native_token_usage`); exact-model rate-card cost defaults to `emit`/`org_file` and stays unpriced without a synced rate card | Cursor chat backfill; historical USD replay suppressed | Yes |
| cursor-agent CLI | Native command-hook path when dispatched, plus shared passive JSONL watcher/backfill | Provider text/thinking, tool requests, actual tool results, and explicit turn markers | Same native quartet contract as Desktop; passive records have no token evidence and remain unpriced | Current main/child and legacy flat JSONL plus chat stores; historical USD replay suppressed | No setup-managed resume |
| Factory Droid | Beta, Factory plugin command hooks | Documented lifecycle, prompt, tool, notification, compaction, stop, and subagent-stop events | Not exposed by current documented hook payloads | Not yet | Not yet |
| Hermes Agent | Yes, observer plugin hooks plus default-off durable reconciliation | Yes | Live observer usage when present; durable history preserves exact session aggregates without inventing turn attribution | Bounded read-only `state.db` watcher plus explicit backfill | No setup-managed resume |
| Amp Code | Yes, setup-managed system plugin | Yes | Live events omit usage; default-off durable history captures exact model/token components and provider credits without treating credits as USD | Bounded `T-*.json` thread reconciliation behind `amp_durable_history`; native plugin traces win | No setup-managed resume |
| Qwen Code | Yes, native HTTP hooks plus default-off durable-history reconciliation | Yes | Yes, from Qwen `usageMetadata` and transcript fallback | Bounded active-chain chat JSONL watcher plus manual backfill, including archives | No setup-managed resume |
| OpenHands | Yes, command hooks plus optional durable reconciliation | Hooks provide lifecycle, prompt, and tool events; durable bundles add assistant text, thinking, exact tool input/results, model, and CWD | Hooks expose no usage; durable `base_state.json` preserves provider totals and cost as session aggregates only | `trajectory backfill --from-openhands` plus bounded watcher behind `openhands_durable_history` | Provider-native resume is discoverable through the same conversation ID; no setup-managed resume command |
| Aider | Opt-in command shim plus default-off explicitly rooted native Markdown reconciliation | Wrapper lifecycle/prompt/assistant/turn events; history adds prompt, assistant, model, and operational text without claiming structured tools | Wrapper analytics retain provider-call usage/cost; history counts are client-rendered, mixed provider-or-local estimates and display-rounded at scale, while printed cost remains noncanonical client evidence | Bounded watcher plus `backfill --from-aider` behind `aider_durable_history` | No setup-managed resume; history remains open-ended without a provider terminal marker |
| Continue CLI | Yes, opt-in `cn` command shim | Lifecycle, prompt, assistant-message, transcript-derived tool, outer-turn, and session events | Yes, from Continue session JSON when usage metadata is present | Current invocation only; no bulk history | Native CLI `--resume`/`--fork` captured exactly when the background start job establishes a clean baseline; otherwise attribution fails closed |
| Mistral Vibe | Yes, opt-in `vibe` command shim plus native identity/tool hooks | Lifecycle, prompt, tool, assistant-message, and turn events | Exact valid root/nested session totals and client-estimated session cost; no per-turn attribution; ambiguous continuation totals suppressed | Default-off bounded root/nested watcher plus explicit repair backfill | Native facts win; exact provider bindings preserve resume and child identity; durable snapshots remain incomplete until native terminal evidence exists |
| Grok Build | Preview native global hooks plus exact-source durable reconciliation | Lifecycle, prompt when present, assistant/reasoning, tools/results, model, and root/child relationships | No attributable per-turn tokens or cost; session signal counters remain diagnostics only | Default-off bounded root/nested watcher plus explicit repair backfill | Native facts win; provider snapshots and deletion never fabricate terminal state |
| Codebuff | Yes, opt-in command shims and post-run chat-history import | Lifecycle, prompt, assistant-message, and turn events | Yes, from `~/.config/manicode*/projects/*/chats/*/chat-messages.json` usage metadata | Codebuff chat history backfill | No setup-managed resume |
| Pi | Yes, TypeScript extension | Yes | Yes | `.pi/agent/sessions` backfill with parent-session resolution | Yes |
| Oh My Pi (`omp`) | Preview native extension plus durable-history reconciler, feature-gated | Lifecycle, prompts, assistant/model, exact tool results/errors, compaction, and exact header-backed relationships | Native input/output/cache/total tokens and provider cost when present | Bounded profile/XDG-aware recursive v3 reconciliation plus explicit complete-history repair | Native OMP resume/switch/branch; Trajectory records transitions but does not launch resume |
| OpenCode | Yes, plugin SDK events | Yes | Yes | `backfill --from-opencode` for JSON storage and SQLite; opt-in watcher for new/changed durable sessions | Yes |
| Kilo Code | Yes, plugin SDK events | Yes | Native model, provider, input/output/reasoning/cache-read/cache-write, and cost; optional native OTLP | `backfill --from-kilo` plus default-off SQLite/retained-JSON watcher | No setup-managed resume |
| Kiro CLI | Yes, agent command hooks | Prompt, tool, assistant response, exact retained models and timestamps | Not exposed by hooks or retained stores; no estimates inferred | Default-off bounded JSONL/SQLite reconciliation via `kiro_durable_history`; native hook traces win | Native `--resume-id`; no setup-managed resume |
| Devin CLI | Beta, authoritative `sessions.db`/transcript reconciliation; hooks only wake reconciliation | Prompt, assistant, thinking, tool, model, and lifecycle facts from the local source | Per-step prompt, completion, and cache tokens; final-only aggregate usage is parsed but not materialized | No bulk historical import; active/changed source reconciliation only | Native `devin --resume`; no setup-managed resume |
| Qoder CLI | Beta, authoritative JSONL transcript reconciliation; native plugin hooks wake exact-source reconciliation | Prompt, assistant, thinking, tool, model, subagent, and lifecycle facts | Native prompt, completion, cache-write, and cache-read tokens | No bulk historical import; active/changed source reconciliation only | Native Qoder resume; no setup-managed resume |
| ZCode | Preview wake hooks plus authoritative SQLite reconciliation | Session identity/parent/CWD, prompt, assistant/thinking, model/provider, and tools/results | Exact attempt and turn input/output/reasoning/cache-create/cache-read tokens; cost only when derivable from a known rate | Bounded automatic reconciliation plus `backfill --from-zcode` | Active updates remain open; only archived durable evidence can close a session |
| CommandCode | Preview hybrid watcher; native hooks wake exact-source reconciliation | Prompt, assistant, thinking, native tools/results, CWD when hook/meta provides it, and native Stop turn boundaries without terminal SessionEnd | No reliable native usage or cost persisted; downstream estimates remain explicitly estimated | Existing and changed transcripts reconcile in bounded passes | Native CommandCode resume only; no setup-managed resume |
| Kimi Code CLI | Preview hybrid watcher; hooks wake exact-source reconciliation | Prompt, assistant, thinking, tools/results, model, stop reason, main/subagent/fork metadata, and lifecycle | Native input/output/cache-read/cache-create tokens; cost computed downstream with explicit provenance | Current `~/.kimi-code` plus legacy `~/.kimi` migration dedup; bounded active/change reconciliation | Native Kimi session resume; no setup-managed resume |
| gptme | Preview hybrid watcher; metadata-only native hooks wake exact-source reconciliation | Prompt, assistant, thinking, tools/results, model, and lifecycle | Native per-message input/output/cache tokens summed across the user turn; recorded cost has computed provenance | Existing and changed conversation/events/config sources reconcile in bounded passes | Native gptme resume; no setup-managed resume |
| CodeWhale | Preview hybrid watcher; saved sessions and runtime threads are authoritative, native hooks only wake reconciliation | Prompt, assistant, thinking, native tools/results, model/provider where authoritative, fork and runtime lifecycle | Exact per-turn runtime input/output/cache/reasoning usage; saved totals and client-computed cost remain session-only provenance | Current and migrated saved sessions plus runtime thread/turn/item/event stores; linked runtime and saved IDs deduplicate | Native CodeWhale resume; plain exec is invisible unless stream-JSON or resume persists it |
| ForgeCode | Preview-gated passive read-only `.forge.db` reconciliation | System, prompt, assistant, reasoning, native tools/results, failures, model, CWD, and child-conversation relationships | Native actual values materialize as real; approximate or mixed values remain estimated; provider-reported cost keeps provider provenance | Existing and changed conversations from the exclusive active root reconcile in bounded passes | No setup-managed resume; provider rows do not establish live or terminal lifecycle |
| Warp/Oz CLI | Preview-gated provider-store reconciliation | Prompt, assistant, reasoning, native tool/result, model, working directory, and task/subagent hierarchy | Not materialized; native conversation total retained as diagnostic-only source metadata, with no invented input/output split or cost | Active/changed local stores; no cloud-run import | Native Warp/Oz resume only; no setup-managed resume |
| Windsurf | Beta, native Cascade hooks wake authoritative transcript reconciliation; bounded DB history repair | Prompt, assistant, lifecycle status, and model only when present; no inferred tools | Not exposed by the public transcript or legacy DB schemas; no cost claim | Narrow stable/Next `ItemTable` history fallback | Native Cascade conversation UX; no setup-managed resume |
| Zed | Beta, passive read-only `threads.db` reconciliation | Prompt, assistant, thinking, tool, model, CWD, and subagent relationships | Native session aggregate parsed but not attributed or materialized to turns | Changed-source reconciliation only | No setup-managed resume |

### Privacy And Derived Features

| Client | Incognito UX | MCP incognito tool | Sensitivity scanning | Segmentation | Coverage note |
|--------|--------------|--------------------|----------------------|--------------|---------------|
| Claude Code | `/trajectory:incognito` command and incognito skill | Yes | Non-headless eligible; headless skipped | Non-headless eligible; headless skipped | Live incognito UX; `privacy-features` E2E positive feature proof |
| Codex CLI | Incognito skill with bundled script fallback | Yes | Non-headless eligible; headless skipped | Non-headless eligible; headless skipped | Live incognito UX; `privacy-features` E2E positive feature proof |
| GitHub Copilot CLI | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions eligible; headless skipped | Non-headless plugin sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; no live incognito UX gate yet |
| Gemini CLI | `/incognito` command and incognito skill | Yes | Non-headless hook sessions eligible; headless skipped | Non-headless hook sessions eligible; headless skipped | Live incognito UX and positive feature coverage |
| Antigravity CLI (`agy`) | `/incognito` command and incognito skill | Yes | Current hooks expose no prompt or assistant text to scan | Current hooks expose no prompt or assistant text to segment | MCP/incognito setup is tested; positive privacy-derived feature and live incognito UX gates require the durable-history path |
| Goose | Setup-managed `goose-incognito` command | No | Current hook mode is unavailable, so sessions are conservatively headless/unknown and skipped | Current hook mode is unavailable, so sessions are conservatively headless/unknown and skipped | Headless-skip fixture proof; no authoritative interactive-mode or live Goose incognito UX gate yet |
| Cline CLI | Setup-managed `cline-incognito` command plus MCP request path | Yes | Non-headless file-hook sessions eligible; headless skipped | Non-headless file-hook sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; no live Cline UX gate yet |
| Cursor Desktop | Incognito skill, using Claude skill when available or native Cursor fallback; setup also installs `cursor-agent-incognito` | Yes | Non-headless GUI sessions eligible; headless skipped | Non-headless GUI sessions eligible; headless skipped | Punted for positive privacy-feature proof: GUI/transcript watcher path has no stable credential-free non-headless hook stream |
| cursor-agent CLI | Setup-managed `cursor-agent-incognito` command when the Cursor integration is installed; watcher has no native slash surface | No | Passive history is local-only and replay-ineligible; native hook sessions use their proven surface | Passive history is local-only and replay-ineligible; native hook sessions use their proven surface | Protected `cursor-agent --print` native/passive identity gate; shared passive store remains surface-unknown |
| Factory Droid | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions eligible; headless skipped | Non-headless plugin sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; no live Droid incognito UX gate yet |
| Hermes Agent | Incognito skill | Yes | Non-headless observer sessions eligible; headless skipped | Non-headless observer sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; protected live capture coverage; no live incognito UX gate yet |
| Amp Code | Setup-managed `amp-incognito` command plus MCP request path | Yes | Non-headless Amp plugin sessions eligible; headless skipped | Non-headless Amp plugin sessions eligible; headless skipped | `privacy-features` E2E proves incremental classification and segmentation without inventing the unavailable session-end signal; final task closure remains unavailable until Amp exposes one |
| Qwen Code | `/incognito` command and incognito skill | Yes | Non-headless Qwen hook sessions eligible; headless skipped | Non-headless Qwen hook sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; setup plus live capture CI; no live incognito UX gate yet |
| OpenHands | Setup-managed `openhands-incognito` command plus MCP request path | Yes | Current hook payloads have no run-mode field; hook and durable-only sessions are conservatively headless/unknown and skipped | Current hook payloads have no run-mode field; hook and durable-only sessions are conservatively headless/unknown and skipped | Headless-skip and explicit-mode fixture proof; live hook CI plus durable-history local-UI coverage |
| Aider | Setup-managed `aider-incognito` command | No | Wrapper sessions eligible when non-headless; passive native-history sessions are headless/unknown and skipped | Wrapper sessions eligible when non-headless; passive native-history sessions are headless/unknown and skipped | `privacy-features` E2E positive wrapper proof; setup/inventory plus native-history fixture coverage |
| Continue CLI | Setup-managed `continue-incognito` command | No | Wrapper sessions eligible when non-headless; headless skipped | Wrapper sessions eligible when non-headless; headless skipped | `privacy-features` E2E positive fixture proof; setup/inventory and command-behavior coverage |
| Mistral Vibe | Setup-managed `vibe-incognito` and `mistral-vibe-incognito` commands | No | Wrapper/native sessions eligible when non-headless; headless skipped | Wrapper/native sessions eligible when non-headless; headless skipped | `privacy-features` E2E positive fixture proof; setup/inventory and command-behavior coverage |
| Grok Build | Setup-managed `grok-incognito` command and `trajectory-incognito` skill | No | Source-only sessions remain headless/unknown; explicit native mode may become eligible | Source-only sessions remain headless/unknown; explicit native mode may become eligible | Fixture/control-plane proof; authenticated native-hook and incognito UX pilot pending |
| Codebuff | Setup-managed `codebuff-incognito` and `cb-incognito` commands | No | Wrapper/imported sessions eligible when non-headless; headless skipped | Wrapper/imported sessions eligible when non-headless; headless skipped | `privacy-features` E2E positive fixture proof; setup/inventory and command-behavior coverage |
| Pi | Native `trajectory_incognito` tool plus MCP | Yes | Non-headless extension sessions eligible; extension-supplied verdicts accepted; headless skipped | Non-headless extension sessions eligible; headless skipped | Live incognito UX; `privacy-features` E2E positive fixture proof; extension verdict tests |
| Oh My Pi (`omp`) | MCP request path; no setup-managed slash command yet | Yes | Native extension marks headless state; non-headless sessions eligible, headless skipped | Non-headless sessions eligible; headless skipped | Setup and capture fixtures only; live incognito UX and positive privacy-feature proof pending |
| OpenCode | Incognito skill | Yes | Non-headless plugin SDK sessions eligible; headless skipped | Non-headless plugin SDK sessions eligible; headless skipped | Live incognito UX; `privacy-features` E2E positive fixture proof |
| Kilo Code | Incognito skill | Yes | Non-headless plugin SDK sessions eligible; headless skipped | Non-headless plugin SDK sessions eligible; headless skipped | `privacy-features` E2E positive fixture proof; setup/live capture coverage |
| Kiro CLI | Setup-managed `kiro-incognito` command plus MCP request path | Yes | Prompt/tool hook capture eligible when non-headless; headless skipped | Punted for final segmentation proof: current documented command hooks lack a terminal `SessionEnd` signal | Fixture-only capture plus command-behavior coverage; no positive privacy-feature proof yet |
| Devin CLI | Global `/incognito` skill | Yes | Source-reconciled sessions are conservatively headless/unknown and skipped until an authoritative mode signal exists | Source-reconciled sessions are conservatively headless/unknown and skipped until an authoritative mode signal exists | Sanitized fixtures prove durable incognito/redaction and source-authoritative terminal closure; interactive mode and live auth/incognito UX remain gaps |
| Qoder CLI | Native plugin `/incognito` command and skill | Yes | Source-reconciled sessions are conservatively headless/unknown and skipped until an authoritative mode signal exists | Source-reconciled sessions are conservatively headless/unknown and skipped until an authoritative mode signal exists | Fixture proof covers replacement snapshots and source mutations; live PAT, terminal closure, and incognito UX remain follow-ups |
| ZCode | User incognito skill mediated through `trajectory_incognito` | Yes | Provider-only sessions are conservatively headless/unknown and skipped | Provider-only sessions are conservatively headless/unknown and skipped | Setup, MCP ownership, source reconciliation, and local-UI fixtures; authenticated incognito UX pilot pending |
| CommandCode | Owned `/incognito` command and skill; exact session ID required; explicit disable required because SessionEnd is unavailable | Yes | Sessions remain conservatively headless/unknown until an authoritative mode signal exists | Sessions remain conservatively headless/unknown until an authoritative mode signal exists | Fixture and Lapdog proof; live authenticated hook/incognito UX remains a follow-up |
| Zed | Global `trajectory-incognito` skill | Yes | Passive history is conservatively headless/unknown and skipped | Passive history is conservatively headless/unknown and skipped | Fixture and local-UI proof only; live Zed incognito UX and authoritative session-mode validation remain follow-ups |
| Kimi Code CLI | User incognito skill | Yes; exact session required when ambiguous | Unknown source mode is conservatively headless and skipped | Unknown source mode is conservatively headless and skipped | Sanitized current/legacy fixtures plus headless skip and local-ui/Lapdog proof; protected live read-only gate follows |
| gptme | Native `/incognito` command | Yes | Explicit non-interactive and unknown modes are skipped | Explicit non-interactive and unknown modes are skipped | Real gptme 0.32.0 mock/echo headless lifecycle gate; non-headless fixture proves positive privacy outputs |
| CodeWhale | `/incognito` skill prompt mediated through `trajectory_incognito` | Yes | Unknown source mode is conservatively skipped; proven non-headless sessions are eligible | Unknown source mode is conservatively skipped; proven non-headless sessions are eligible | The slash workflow depends on model tool selection, not a native deterministic toggle; stream-JSON persistence, privacy skip, and positive output remain fixture-backed until the pinned live binary is published |
| ForgeCode | Owned `/incognito` command and `trajectory-incognito` skill; exact session ID required | Yes | Unknown passive mode is conservatively marked headless and skipped | Unknown passive mode is conservatively marked headless and skipped | Fixture and Lapdog proof only; live model-mediated incognito and authoritative interaction-mode proof remain follow-ups |
| Warp/Oz CLI | Global Trajectory incognito skill | Yes | Local-store sessions are conservatively headless/unknown and skipped | Local-store sessions are conservatively headless/unknown and skipped | Fixture proof covers provider-store capture and Lapdog hierarchy; interactive-mode, terminal closure, and live auth/incognito remain gaps |
| Windsurf | Global `/incognito` workflow | Yes | Windsurf IDE/Cascade sessions are non-headless eligible; headless skipped | Non-headless eligible; headless skipped | Canonical JSONL and Lapdog fixture readback; positive privacy-feature, live hook, SessionEnd, and incognito UX pilots remain gaps |

For local cost readback and supported-agent fidelity checks, run
`trajectory cost`, `trajectory cost inspect --session <id>`, and
`trajectory cost validate`. The validation command reports recent cost coverage
for Claude Code, Codex, Gemini, Pi, OpenCode, Cursor, Hermes Agent, Amp Code,
Qwen Code, Kilo Code, and Mistral Vibe. Vibe's accepted
`session-aggregate` row preserves its explicit whole-session cost without
fabricating token-positive or costful turns.

Codex readback separates observed tokens, standard API-equivalent USD, and
ChatGPT Codex credits. Guardian oversight usage uses a clearly labeled
provisional `codex-auto-review` proxy estimate of $2.50/M input, $0.25/M cached
input, and $15/M output; this is third-party rate evidence, not a verified
OpenAI billing mapping. Incomplete component evidence remains unavailable.
Stale pre-ownership-fix cache rows are excluded until a forced source backfill
rebuilds them.

## Hermes Agent

**Trajectory status: Beta. Supported contract: public Hermes observer-hook contract.**

Install with setup:

```bash
trajectory setup --clients hermes
```

Setup writes `$HERMES_HOME/plugins/trajectory/plugin.yaml`,
`$HERMES_HOME/plugins/trajectory/__init__.py`, merges `plugins.enabled:
[trajectory]` and `mcp_servers.trajectory` into `$HERMES_HOME/config.yaml`, and
installs an incognito skill under `$HERMES_HOME/skills/incognito/SKILL.md`.
When `HERMES_HOME` is unset, the provider default is `~/.hermes` on macOS and
Linux and `%LOCALAPPDATA%\hermes` on Windows.

Hermes exposes a read-only observer hook system through Python plugins. The
Trajectory plugin maps `on_session_start`, `pre_llm_call`,
`post_api_request`, `post_llm_call`, `pre_tool_call`, `post_tool_call`,
approval hooks, subagent hooks, and `on_session_finalize` into canonical
Trajectory events at `/capture/hermes/<event>`. The plugin is fail-open and
does not return behavior-changing hook values.

`post_api_request` carries Hermes `usage` fields, which Trajectory records on
`agent_message` and normalizes into `llm_call` rows when a concrete model is
available. Cost prefers native Hermes cost fields and falls back to
Trajectory's model pricing table.

Durable history reads the effective `$HERMES_HOME/state.db` without modifying
it:

```bash
trajectory features enable hermes_durable_history
trajectory backfill --from-hermes
trajectory backfill --from-hermes --session <provider-session-id>
trajectory backfill --from-hermes --force
```

The importer and watcher read current active message rows in provider insertion order,
reconstructs user, assistant, reasoning, tool, parent, branch, delegation, and
compression-continuation facts, preserves native tool-effect disposition and
per-model, per-task session accounting from current Hermes stores, and keeps active sessions open when Hermes has
not recorded `ended_at`. With the feature enabled, `trajectory serve` watches
the database, WAL, and shared-memory sidecar, reconciles a bounded cold corpus,
and combines cheap change summaries with rotating full fingerprints. Native
observer events stay authoritative; durable facts are merged under the JSONL
lock, terminal hooks request exact reconciliation, provider deletion does not
erase local history, and crash-safe delivery is retried after restart. An
active final turn stays incomplete until Hermes records its provider boundary.
The explicit `--force` command remains the complete-history repair path. Hermes persists
token and cost accounting only at session scope. Trajectory therefore
preserves the exact session token total and provider-owned per-model breakdown,
including schema-v22 auxiliary task labels, input/output components, and
actual-over-estimated-over-computed cost while
leaving turn token and cost fields unattributed. `ccusage` independently
cross-checks the usage categories and cost precedence. Historical request-level
`llm_call` spans are not fabricated from those session aggregates. The feature
defaults off; managed configuration or `TRAJECTORY_DISABLE_FEATURES` can
disable automatic and explicit durable-history reads without affecting live
observer capture. Hermes's optional JSON snapshot export defaults off upstream;
Trajectory uses the canonical state database instead of treating snapshots as
a competing authority.

## Amp Code

**Trajectory status: Beta. Supported contract: current Amp plugin API inspected.**

Install with setup:

```bash
trajectory setup --clients amp
```

Setup writes a system plugin to `~/.config/amp/plugins/trajectory.ts` (or
`$AMP_CONFIG_DIR/plugins/trajectory.ts`) and merges a `trajectory` MCP server
into `~/.config/amp/settings.json` under `amp.mcpServers`.

Amp plugins expose `session.start`, `agent.start`, `tool.call`,
`tool.result`, and `agent.end`. The Trajectory plugin starts or reuses
`trajectory serve`, normalizes those events into `/capture/amp/<event>`, and
records `client_source=amp`. The plugin returns `{action: "allow"}` from
`tool.call`, posts capture asynchronously, and remains fail-open when capture is
unavailable. The current plugin API supplies thread identity, prompts, assistant
messages, tool calls/results, and agent status. It does not supply live model,
token, cost, duration, or terminal-session fields, so Trajectory does not claim
or synthesize those signals.

Amp supports headless execution with `amp --execute` and `AMP_API_KEY`, but the
Trajectory CI matrix does not currently have a usable Amp subscription token.
Default CI therefore uses fixture replay through
`TestAmpCaptureUsesCurrentPluginContract` plus setup, inventory, and
auto-instrument tests. A protected live Amp gate can be added later when
`AMP_API_KEY` is available.

For a default-off durable-history fallback, enable and hot-reload:

```bash
trajectory features enable amp_durable_history
trajectory config reload --yes
```

Trajectory then reconciles bounded top-level `T-*.json` files under
`~/.local/share/amp/threads` (or `$XDG_DATA_HOME/amp/threads`). The live plugin
and thread store share the exact `T-...` identity, so any native plugin event
makes that trace authoritative and prevents passive replacement. Current
`messages[].usage` and legacy `usageLedger.events[]` records supply exact model
and token components. Ledger usage joins to a turn only through exact
`toMessageId`; unassociated usage remains a session-level observation. Provider
credits remain labeled Amp credits and are never converted to USD. Mutable
history is atomically rebuilt, deletion is only a source tombstone, and no
`session_end` is inferred. `ccusage` is retained as an independent schema and
usage-fidelity reference.

This path is fixture-tested. A credentialed Amp run remains the follow-up for
confirming complete local thread retention and Linux-root behavior in a current
release.

## Qwen Code

**Trajectory status: Beta. Minimum supported: 0.19.2 live-replayed; latest
source checked: 0.20.0.**

The durable-source contract is additionally audited against Qwen Code 0.20.0
source at `92fda5603e84ef62a1b29bf6faf4f6a8124a2bf7`; that source audit is not a
claim of live 0.20.0 validation.

Install with setup:

```bash
trajectory setup --clients qwen
```

Setup merges Trajectory into `~/.qwen/settings.json` (or `$QWEN_HOME/settings.json`),
registers a `trajectory` MCP server, whitelists
`http://127.0.0.1:19222/capture/qwen/*` in
`security.allowedHttpHookUrls`, and installs HTTP hook entries for Qwen Code
lifecycle, prompt, tool, permission, subagent, compaction, notification, stop,
and session-end events. Setup also writes an incognito skill and command under
`~/.qwen/skills/incognito/SKILL.md` and `~/.qwen/commands/incognito.toml`.

Qwen Code supports OpenAI-compatible providers. For headless validation, use
`security.auth.selectedType=openai`, `modelProviders.openai`, and the provider
API key expected by Qwen, then run `qwen -p` with the model you want to test.

Capture uses Qwen's native HTTP hook transport rather than command/curl shims.
The Go runtime records `client_source=qwen`, normalizes prompt, tool,
permission, subagent, assistant-message, turn, session-start, and session-end
records, and derives provider-call `llm_call` rows from Qwen `usageMetadata`.
Because Qwen follows Gemini's counter semantics, Trajectory subtracts
`cachedContentTokenCount` from `promptTokenCount` before exposing uncached input;
cache reads remain a separate category and are not double-counted in cost.
`candidatesTokenCount` may include `thoughtsTokenCount`, so strict output and
reasoning categories require `totalTokenCount` as an anchor. If that total is
absent, Trajectory keeps the raw counters, marks token fidelity partial, and
does not claim strict request cost.
Malformed, non-finite, negative, fractional, or internally contradictory
counters also remain partial and unpriced. Trajectory retains the available
numeric provider counters for diagnosis; it does not repair contradictory
evidence into a strict token breakdown.
If the stop hook payload does not include token usage, Trajectory falls back to
the Qwen chat JSONL transcript path.

Enable bounded automatic reconciliation and import retained history manually:

```bash
trajectory features enable qwen_durable_history
trajectory backfill --from-qwen-sessions
trajectory backfill --from-qwen-sessions --session <session-id>
```

Trajectory applies Qwen's user-level `.env` bootstrap, then resolves
`QWEN_RUNTIME_DIR`; otherwise it merges `advanced.runtimeOutputDir` across
system defaults, user, trusted workspace, and system override settings before
falling back to `QWEN_HOME` or `~/.qwen`. Relative paths are
process-working-directory relative. It scans bounded regular files under
`projects/*/chats/*.jsonl` and `projects/*/chats/archive/*.jsonl`; duplicate
active/archive or cross-project copies are reported as ambiguous.

Qwen transcripts are append-only trees. The importer follows the last valid
record's `parentUuid` chain and excludes abandoned rewind branches. It
preserves provider timestamps, models, per-assistant usage, cache overlap,
thinking, tool calls/results, sidechain identity, title, parent/fork lineage,
immutable session-source metadata, and explicit zero counters. Native hooks own
observed lifecycle and tool timing;
history owns retained per-request assistant usage because Stop contains only
the terminal request. Prompt plus total counters are strict and disjoint;
unanchored candidate/thought counters remain partial and cannot claim strict
cost. Malformed, fractional, negative, overflowing, or contradictory counters
retain usable numeric provider evidence for diagnosis but remain partial and unpriced.
Canonical replacement serializes with native hook appends and refuses files
whose `session_start` does not prove Qwen ownership. Qwen does not persist a durable terminal boundary in this file, so
backfill does not invent `session_end`. `ccusage` independently confirms the
per-assistant usage fields and default projects/chats layout; Trajectory also
covers the current archive layout and avoids treating cached prompt tokens as
additive input.

The same default-off flag starts a bounded serve-side watcher. It cold-starts
existing history in count- and byte-bounded pages, combines filesystem
notification with rotating full hashes, persists crash-safe pending deliveries,
retries local-UI ingest, replaces local-UI snapshots after provider rewrites so
removed spans do not linger, and retains provider tombstones without inventing
completion. Native terminal
hooks force an exact merge and teach the watcher workspace-specific runtime
roots from `transcript_path`; canonical JSONL locking prevents concurrent hook
appends from being lost. A valid hook path bootstraps custom-root discovery even
when Qwen was not initially detectable, with one-shot exact reconciliation
during another process's watcher lease. Global watcher disable and
`TRAJECTORY_DISABLE_QWEN_WATCHER=1` stop the background path. An older runtime
root that was only configured in a different workspace before hook capture is
not globally enumerable; explicit backfill from that workspace remains the
complete-history repair path.

## OpenHands

**Trajectory status: Beta. Minimum supported CLI: 1.16.0 live-replayed;
OpenHands SDK 1.36.1 source checked.**

Install with setup:

```bash
trajectory setup --clients openhands
```

Setup writes command hooks to `~/.openhands/hooks.json` and a `trajectory` MCP
server entry to `~/.openhands/mcp.json`. For isolated runs, set
`OPENHANDS_PERSISTENCE_DIR`; setup writes both files under that directory. The
hook command is `trajectory capture-hook --client openhands --ensure-serve`,
not a curl bridge, because OpenHands command hooks send hook payload JSON on
stdin. Current OpenHands headless conversations load hooks from the workspace
`.openhands/hooks.json`; for isolated validation, copy the setup-generated hook
config into the project directory before launching the live session.

The OpenHands CLI hook surface supports `SessionStart`, `UserPromptSubmit`,
`PreToolUse`, `PostToolUse`, `Stop`, and `SessionEnd`. Trajectory maps these
into canonical session, prompt, tool, turn, and session-end records with
`client_source=openhands`. Command hook payloads do not expose assistant
messages or token usage, so OpenHands `turn_end` records set
`tokens_status=unavailable`. The current upstream hook event also omits runtime
mode, so Trajectory records hook sessions as mode-unknown and conservatively
headless. An explicit provider mode remains authoritative if that contract is
added later.

For provider-owned durable history, enable the default-off feature and use the
automatic watcher or explicit repair command:

```bash
trajectory features enable openhands_durable_history
trajectory backfill --from-openhands
trajectory backfill --from-openhands --session <provider-conversation-id>
trajectory backfill --from-openhands --force
```

The read-only source root follows the current CLI precedence:
`OPENHANDS_CONVERSATIONS_DIR`, then
`OPENHANDS_PERSISTENCE_DIR/conversations`, then
`~/.openhands/conversations`. The watcher is count-, event-, file-, and
byte-bounded, persists crash-retryable delivery state, detects provider
mutation and deletion, and can be stopped independently with
`TRAJECTORY_DISABLE_OPENHANDS_HISTORY_WATCHER=1`. Explicit backfill remains the
complete-history repair path. Directories are ignored until a bounded regular
`base_state.json` exists; a base-state identity mismatch or later identity
change fails closed rather than creating a second canonical session.

Durable bundles add assistant messages, visible reasoning/thinking, exact tool
inputs and results from standard action/observation pairs and SDK ACP tool
events, conversation-error detail, model, working directory, and provider
terminal state. An individual tool input or result above 4 MiB is represented
by its original JSON byte count and SHA-256 digest instead of emitting an
oversized canonical JSONL record.
Native hook rows remain authoritative when both surfaces describe the same
event. `base_state.json` supplies exact prompt, completion, cache-read,
cache-write, and reasoning totals plus provider-reported accumulated cost, but
only at session scope; Trajectory does not fabricate per-turn usage or an
`llm_call`. A session is closed only by an exact finish action or terminal
provider state. ccusage has no OpenHands adapter, so it provides no independent
usage or pricing authority for this client.

Headless validation can run a real OpenHands session with the provider key and
model expected by OpenHands. Command-hook payloads are enough for lifecycle,
prompt, and tool coverage, but they do not currently include assistant text or
token usage.

OpenHands SDKs also expose OpenTelemetry/Laminar environment variables, but
Trajectory does not install an OpenHands OTLP relay by default today. Add a
client-specific OTLP relay only if OpenHands exposes stable request/model/token
attributes through that path.

**Source:** [OpenHands-CLI](https://github.com/OpenHands/OpenHands-CLI),
[OpenHands SDK](https://github.com/OpenHands/software-agent-sdk)

## Aider

**Trajectory status: Beta. Minimum supported and latest checked: 0.86.2.**

Install with setup:

```bash
trajectory setup --clients aider --install-client-shims
```

Interactive setup asks before installing this shim; scripted setup must pass
`--install-client-shims`. Setup writes a managed shim at
`~/.trajectory/bin/aider`, links `aider` into an existing home bin directory on
PATH when possible, and writes metadata at
`~/.trajectory/state/aider/wrapper.json` pointing to the real Aider binary.
The shim invokes `trajectory aider --real <path> -- ...`, starts or reuses
`trajectory serve`, passes user arguments through, and adds sidecar flags when
the user has not supplied them: `--analytics-log`, `--llm-history-file`,
`--chat-history-file`, and `--no-analytics`.

The shim posts `SessionStart`, `UserPromptSubmit`, `AgentMessage`,
`TurnEnd`, and `SessionEnd` to `/capture/aider/<Event>` with
`client_source=aider`. Token and cost fields come from Aider's
`message_send` analytics rows. Assistant text comes from the LLM history file,
and prompts come from `--message`, `--message-file`, or chat history.

For retained provider history outside wrapper-created sidecars, enable the
default-off durable source and configure only the roots Trajectory may read:

```bash
trajectory features enable aider_durable_history
export AIDER_CHAT_HISTORY_FILE=/path/to/project/.aider.chat.history.md
# Or use AIDER_DIR for a compatibility root, or a path-list in
# TRAJECTORY_AIDER_HISTORY_DIRS.
trajectory backfill --from-aider
```

`trajectory serve` then reconciles configured `.aider.chat.history.md` files
in bounded, crash-retryable passes; the explicit command is the complete-history
and repair path. It splits each `# aider chat started at ...` launch into a
stable derived session, preserves prompts, assistant Markdown, model labels,
and blockquoted operational output, and keeps higher-authority wrapper events.
The history has no native session ID, per-message timestamps, or terminal
marker. Trajectory therefore labels ordering timestamps as derived, keeps the
session incomplete, and treats deletion as a tombstone rather than
`session_end`. Blockquotes are not structured tool telemetry.

Aider's rendered token line can use provider response usage or Aider's local
token counter and rounds values at or above 1,000 for display. Trajectory keeps
those values estimated with explicit precision provenance. Aider's rendered
message/session cost may come from LiteLLM or local token pricing, so it is
retained as Aider-reported client evidence and never promoted to canonical
provider-billed cost. The pinned ccusage reference has no Aider
adapter and supplies no separate usage or pricing authority.

Aider does not expose a stable native hook, plugin, or OTLP surface for
per-tool events today, so Trajectory does not synthesize file-edit/tool rows
from transcripts. Non-interactive validation can run `aider --message` with the
provider credentials configured for Aider.

**Source:** [Aider](https://github.com/Aider-AI/aider), [Aider CLI options](https://aider.chat/docs/config/options.html)

## Continue CLI

**Trajectory status: Beta. Minimum supported and latest checked: 1.5.47.**

Install with setup:

```bash
trajectory setup --clients continue --install-client-shims
```

Interactive setup asks before installing this shim; scripted setup must pass
`--install-client-shims`. Setup writes a managed shim at
`~/.trajectory/bin/cn`, links `cn` into an existing home bin directory on PATH
when possible, and writes metadata at
`~/.trajectory/state/continue/wrapper.json` pointing to the real Continue CLI
binary from the `@continuedev/cli` package. The shim invokes
`trajectory continue --real <path> -- ...`, starts or reuses `trajectory serve`,
sets `CONTINUE_CLI_TEST_SESSION_ID` to the Trajectory session id for new
sessions, and passes user arguments through unchanged.

The shim posts `SessionStart`, `UserPromptSubmit`, `AgentMessage`, tool events,
`TurnEnd`, and `SessionEnd` to `/capture/continue/<Event>` with
`client_source=continue`. After the real `cn` exits, Trajectory reads the
Continue session file from `$CONTINUE_GLOBAL_DIR/sessions` or
`~/.continue/sessions`. New runs use the exact setup-owned session id. The
ordered background start job fingerprints the exact provider-selected newest
session for `--resume`; `--fork <id>` requires one newly created child whose
copied history exactly matches the named parent. If the worker cannot establish
a clean pre-change baseline, or if concurrent selection is ambiguous or resume
history was rewritten, attribution fails closed instead of importing the newest
unrelated file.

Only history appended by the current invocation is emitted. Continue's copied
fork prefix and prior resumed turns are not replayed. Assistant tool-call state
produces correlated tool start/result/failure events, multiple assistant/tool
steps under one user prompt produce one outer `TurnEnd`, and native per-request
input/output/cache/reasoning/model/cost fields stay request-scoped. The
session-level `usage` object remains on `SessionEnd`; it is never assigned to
the first assistant message, and resumed runs report only the aggregate delta.
The local reader is bounded to 4,096 session files and 64 MiB per selected
session. Cross-process baseline state contains only a history fingerprint,
counts, usage totals, and bounded file identities; transcript content is never
copied into the handoff, and stale handoffs expire. Continue's interactive
`/resume` selector can switch to another saved
session without exposing the selected identity to the parent wrapper. The
wrapper therefore captures the original session only and does not guess at
content written after that in-process switch. In the current release `/fork`
prints a new `cn --fork <id>` command; exit and run that command separately for
exact child attribution.

Continue's source tree includes a Claude-compatible hook implementation that
reads `.continue/settings.json` and `.claude/settings.json`, but the current
1.5.47 CLI release does not call that hook dispatcher from the chat path.
Trajectory therefore uses the shim/session-file path today and suppresses
Claude-compatible hook subprocess capture while the shim is active to avoid
future double-capture if Continue wires those hooks later.

Protected Docker live CI runs a real OpenAI-backed `cn -p` session when
`OPENAI_API_KEY` or `CODEX_API_KEY` is present. Credential-free unit tests cover
setup, wrapper parsing, current 1.5.47 session JSON, exact resume/fork
selection, concurrent ambiguity, history-delta accounting, tool reconstruction,
and Lapdog list/trace/fetch/scalar readback. The independent ccusage adapter
census has no Continue adapter, so it supplies no additional usage authority.

**Source:** [Continue](https://github.com/continuedev/continue), [Continue CLI docs](https://docs.continue.dev/cli/overview)

## Mistral Vibe

**Status: Beta, Vibe 2.21.0 inspected, protected live shim E2E plus fixture-proven durable history**

Install with setup:

```bash
trajectory setup --clients mistral-vibe --install-client-shims
```

Interactive setup asks before installing this shim; scripted setup must pass
`--install-client-shims`. Setup writes a managed shim at
`~/.trajectory/bin/vibe`, links `vibe` into an existing home bin directory on
PATH when possible, writes metadata at
`~/.trajectory/state/mistral-vibe/wrapper.json`, and writes a managed block in
`$VIBE_HOME/hooks.toml` or `~/.vibe/hooks.toml`. A native
`post_agent_turn` hook records Vibe's exact `session_id` and
`transcript_path`; `before_tool` and `after_tool` hooks capture tool execution.
All three call `trajectory capture-hook --client mistral-vibe`.

The shim invokes `trajectory vibe --real <path> -- ...`, passes user arguments
through unchanged, and queues bounded start and finish jobs around the wrapped
process. The ordered background worker starts or reuses `trajectory serve`,
enables Vibe experimental hooks, and processes the queued telemetry. The
identity hook binds the exact provider session to one durable Trajectory
session, including explicit resume, picker resume, and `-c`/`--continue` runs.
Picker resume defers `SessionStart` until the hook identifies the selected
provider session.

The worker records only digests and source metadata before launch. Post-run
capture imports the changed prompt/assistant suffix from the hook-selected
transcript only when that baseline is clean. When a hook is unavailable,
fallback discovery accepts exactly one changed session. Raced or ambiguous
sources fail closed for message content instead of risking cross-session
attribution, while valid root-session aggregates and terminal facts remain
available.

For retained history, enable the default-off feature and optionally run an
explicit repair:

```bash
trajectory features enable mistral_vibe_durable_history
trajectory backfill --from-mistral-vibe
trajectory backfill --from-mistral-vibe --session <provider-session-id>
trajectory backfill --from-mistral-vibe --force
```

When enabled, `trajectory serve` performs bounded, crash-retryable
reconciliation of provider-owned root sessions and recursively nested
`agents/*` descendants. It discovers `$VIBE_HOME/logs/session`, the global
`session_logging.save_dir` when it is absolute or home-relative, the
`VIBE_SESSIONS_DIR` compatibility override, and explicit
`TRAJECTORY_MISTRAL_VIBE_HISTORY_DIRS`. Native hook `transcript_path` values
wake the exact source, including trusted project-config roots, without broad
workspace scanning. `TRAJECTORY_DISABLE_MISTRAL_VIBE_HISTORY_WATCHER=1`
disables only this watcher; managed feature disable and the global client
watcher kill switch also win.

Root and nested sessions keep separate provider bindings. Nested directory
structure supplies an exact parent when child metadata omits it. Top-level
parent sessions are classified conservatively as compaction continuations or
fork/rewind continuations rather than subagents. Native hook events remain
authoritative when they overlap passive history, and deletion records a
tombstone without deleting already materialized history.

Live capture records `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
`PostToolUse`, `AgentMessage`, `TurnEnd`, and `SessionEnd` with
`client_source=mistral-vibe`. Durable history emits provider-derived session,
prompt, assistant, thinking, tool-start/result, and turn facts, but never
fabricates `SessionEnd`: Vibe's `end_time` is the last saved resumable snapshot,
not proof that the session terminated. Current sessions use `meta.json` plus
`messages.jsonl`; the shim also reads the historical single-file layout and
follows `--workdir`, native `--worktree`, and trusted project configuration.

Vibe's `stats.session_*` token counters and `session_cost` are whole-session
aggregates. Trajectory accepts them only when they are nonnegative, finite, and
internally consistent; labels `session_cost` as the provider's approximate
session estimate; and never assigns either value to a turn or request-correlated
`llm_call`. Structurally nested subagent aggregates remain scoped to that child.
Compaction continuations may contain cumulative parent-lineage totals, so those
values are retained only as unattributed provider evidence and excluded from
canonical session totals to prevent double counting; fresh fork usage remains
scoped to the fork. Vibe does not persist
historical per-turn token vectors.

Protected Docker live CI runs real Mistral Vibe through its generic OpenAI
provider when `OPENAI_API_KEY` or `CODEX_API_KEY` is present. The CI config
writes an isolated `$VIBE_HOME/config.toml`, sets `active_model` to
`MISTRAL_VIBE_MODEL`, and requires assistant, turn, provider-session identity,
and session-token scope facts. Vibe 2.21 fixtures cover recursive root/child
discovery, structural relationships, thinking, tools/results, provider mutation,
same-stat rewrites, deletion, crash redelivery, bounded cold start, explicit
repair, canonical JSONL, SQLite, and local-UI list/trace/fetch/scalar behavior.
The independent ccusage adapter census has no Vibe adapter, so it provides no
additional usage or pricing authority.

**Source:** [Mistral Vibe](https://github.com/mistralai/mistral-vibe)

## Grok Build

**Status: Preview, official CLI 0.2.103 inspected, fixture-first validation**

Enable the default-off feature and install the native integration:

```bash
trajectory features enable grok_build_instrumentation
trajectory setup --clients grok
```

Setup writes one owned global hook file at
`$GROK_HOME/hooks/trajectory.json` or `~/.grok/hooks/trajectory.json`. It also
installs an owned `trajectory-incognito` skill and the
`~/.trajectory/bin/grok-incognito` control command. Setup does not wrap the
`grok` executable or edit shell startup files, and uninstall removes only
Trajectory-owned files.

The native hook surface covers session start/end, prompt notification, tool
start/success/failure, permission denial, Stop/StopFailure, subagent
start/stop, compaction, and notifications. Hook envelopes carry the exact
provider session ID, workspace root, transcript path, model, and tool
identifiers. A prompt notification without prompt content wakes history
reconciliation but does not create an empty or inferred prompt.

The durable store lives under `$GROK_HOME/sessions` or `~/.grok/sessions`.
Trajectory also accepts `GROK_DIR` as a compatibility discovery override and
`TRAJECTORY_GROK_HISTORY_DIRS` for explicit repair roots. It fingerprints all
contributing `summary.json`, `updates.jsonl`, `chat_history.jsonl`,
`signals.json`, and nested relationship metadata. Exact hook paths scan only
the named eligible session, while bounded polling covers missed hooks and
headless saves.

Run complete-history or repair reconciliation explicitly with:

```bash
trajectory backfill --from-grok
trajectory backfill --from-grok --session <provider-session-id>
trajectory backfill --from-grok --force
```

Root sessions and `subagents/*` children retain separate exact provider
identities and relationships. History preserves prompt, assistant, reasoning,
tool input/result, model, workspace, title, and Git evidence. Native events
remain authoritative on overlap. Saved-snapshot timestamps are not terminal
proof; deletion records a tombstone and never fabricates `session_end`.

The provider's durable store does not expose attributable per-turn token or
cost data. Counters from `signals.json` remain nested session diagnostics and
are never assigned to a message, turn, canonical token total, or cost. The
independent ccusage adapter census has no Grok adapter and supplies no usage or
pricing authority.

Sanitized 0.2.103 fixtures cover root/child identity, content, tools,
same-stat rewrites, bounded cold start, exact-source wakeups, mutation,
crash-safe delivery replay, corrupt-cursor failure, tombstones, canonical
JSONL, SQLite, and local-UI list/trace/fetch behavior. A credential-free
official executable probe verified version, help, inspect output, and the
unauthenticated failure path. Authenticated native-hook, mutation, and
incognito UX pilots remain follow-ups.

**Source:** [Grok Build documentation](https://docs.x.ai/build/overview)

## Codebuff

**Trajectory status: Beta. No minimum established; source and npm 1.0.684
checked.**

Install with setup:

```bash
trajectory setup --clients codebuff --install-client-shims
```

`trajectory setup --clients cb` and `codebuff-ai` are accepted as aliases.
Interactive setup asks before installing these shims; scripted setup must pass
`--install-client-shims`. Setup writes managed shims at
`~/.trajectory/bin/codebuff` and `~/.trajectory/bin/cb`, links `codebuff` and
`cb` into an existing home bin directory on PATH when possible, plus metadata at
`~/.trajectory/state/codebuff/wrapper.json` pointing to the real Codebuff
binary.

The shim invokes real Codebuff unchanged, then imports any Codebuff
`chat-messages.json` rows written for the current project. Trajectory reads the
same stable/dev/staging roots used by Codebuff and ccusage:
`~/.config/manicode`, `~/.config/manicode-dev`, and
`~/.config/manicode-staging`; `CODEBUFF_DATA_DIR` can override that list.

The shim and `trajectory backfill --from-codebuff-chats` emit
`SessionStart`, `UserPromptSubmit`, `AgentMessage`, `TurnEnd`, and
`SessionEnd` to `/capture/codebuff/<Event>` with `client_source=codebuff`.
When Codebuff history contains `metadata.usage`, `metadata.codebuff.usage`, or
ccusage-style nested `metadata.runState.sessionState.mainAgentState.messageHistory`
provider usage, Trajectory normalizes token usage and emits provider-call
`llm_call` records.

Codebuff does not currently expose a stable native hook, plugin, or OTLP
surface for per-tool events in the standard CLI, so Trajectory does not claim
file-edit or shell-tool events for Codebuff. Live validation requires
Codebuff-specific auth (`CODEBUFF_API_KEY` or local credentials).

**Source:** [Codebuff](https://github.com/CodebuffAI/codebuff), [ccusage Codebuff adapter](https://github.com/ryoppippi/ccusage)

## Recommended vs Manual Installs

`trajectory setup --clients ...` is the recommended path for normal installs because it wires the complete integration each client expects: hooks, MCP entries, skills, commands, local binaries, and local marketplace metadata. It is a client-only add/update path: Datadog site, service name, and API key prompts are skipped, and existing export config is left unchanged. Run `trajectory setup` without `--clients` when you need to change Datadog export settings.

Direct or local plugin installs remain supported for development and manual recovery. When using a manual path, copy or install the plugin from a stable local location and mirror the integration config that setup would have written. A plugin-only install may load the extension but miss MCP tools, incognito controls, command assets, or the capture hooks needed for complete telemetry.

## Codex CLI

**Trajectory status: Supported. Minimum supported: 0.128.0; 0.144.6
live-replayed and source checked.**

Codex 0.128.0 is the first version where plugin-bundled hooks work end-to-end:

- **0.118.0** - Plugin system and hook notifications introduced
- **0.120.0** - SessionStart hooks can distinguish session types; live Stop-hook prompts
- **0.121.0** - `codex plugin marketplace add` command for installing plugin marketplaces
- **0.128.0** - Hooks bundled with marketplace plugins are discovered and fired automatically

Earlier versions may have partial support (marketplace without hook discovery, or hooks without marketplace). For reliable instrumentation, use 0.128.0 or later.

### Codex boundary and rollout capture

The default-on `codex_boundary_capture` feature activates `SessionStart`,
`UserPromptSubmit`, and `Stop` plus `^Bash$`-matched `PreToolUse` and
`PostToolUse`. The paired Bash hooks capture immediate PR-work evidence only;
the rollout watcher tails
`$CODEX_HOME/sessions/` (normally `~/.codex/sessions/`) and provides tool
phases, assistant messages, reasoning, permissions, compaction, subagent
activity, model and token metadata, and terminal completion. Codex does not
currently expose a `SessionEnd` hook, so watcher-observed `shutdown_complete`
performs the final drain and exact-once `session_end`.

At each command-hook boundary, `trajectory serve` first reads the rollout
forward, writes the available detail under the same per-session ordering lock,
and then records the boundary. Contiguous tool phases use one canonical JSONL
append and one complete write-through live-state projection. Assistant messages
wake the watcher immediately without starting another command shell. A
file-based sentinel under `~/.trajectory/state/codex-hook-active/` coordinates
the two paths and prevents duplicate non-message events.
Boundary reads drain every complete durable rollout record and commit their
source cursor only after canonical persistence succeeds.

The plugin retains definitions for all ten events supported by current Codex.
Disabling `codex_boundary_capture` activates all ten and restores direct
per-tool hook fidelity at higher process CPU. Run one of these before starting
a new Codex session:

```bash
trajectory features disable codex_boundary_capture  # full-hook compatibility
trajectory features enable codex_boundary_capture   # paired boundary default
trajectory features clear codex_boundary_capture    # return to default
```

A running Codex process keeps the hook snapshot it loaded at startup. Feature
changes reconcile the installed plugin's enabled states and exact trusted
hashes for new sessions; they do not install a second extension or opt an
unconfigured user into setup.
Setup-generated commands also carry the reconciled mode to the server. During
autoupdate, an old, different-home, or ambiguous server response retains all ten
hooks; updated-owner startup self-repairs to three only after the owner proves
boundary support for the same Trajectory home.

`codex exec --ephemeral` writes no rollout. In default boundary mode,
Trajectory therefore does not claim tool, permission, compaction, or subagent
detail for explicit ephemeral runs. This is the same gap as the former
watcher-only implementation. Disable `codex_boundary_capture` before a new
ephemeral run when direct per-tool fidelity is required.

Codex command hooks still use the release-owned minimal runtime and full-binary
fallback. Codex starts a command shell for every enabled hook, which is why a
direct `curl` command would not remove the dominant launch cost. The helper,
relay, and optional Darwin launcher are embedded in the one Trajectory binary
and installed as one verified content-addressed generation.

Historical repair scans both `$CODEX_HOME/sessions/` and
`$CODEX_HOME/archived_sessions/`, with active copies preferred when the same
provider session appears in both. `CODEX_HOME` re-roots the pair.
`CODEX_SESSIONS_DIR` retains its existing meaning as one exclusive exact
rollout root, which is useful for isolated tests and managed layouts:

```bash
trajectory backfill --from-codex-sessions --limit 100
```

Archive files are scanned only as historical sources; symlinked rollout files
are ignored so discovery cannot escape the selected root. Opt-in startup repair
processes at most 100 candidates per maintenance lease and saves an opaque
continuation so large histories advance without one unbounded startup scan.

For local development validation, start capture with `trajectory dev serve`. The dev process registers its exact process identity before binding. The coordinated production owner closes its listener, drains owner-only work, and commits a generation-fenced `YIELDED` authorization before the rebuilt binary can bind. When the dev process exits, production resumes only after exact-process death and listener absence are proven. An older or uncoordinated owner cannot acknowledge this protocol, so the command times out without starting a second listener.

The Codex marketplace plugin also ships the `/incognito` skill. It uses the `trajectory_incognito` MCP tool to suppress publish to non-exempt Datadog destinations for the current session while local JSONL capture continues.

`trajectory setup --clients codex` writes a local marketplace under `~/.trajectory/codex-marketplace` and registers that local path with Codex. The embedded helper and optional launcher are installed together under `~/.trajectory/bin/codex-hook/<version>-<sha256>/`; setup, foreground update, background auto-update, serve-owner startup, config reconciliation, and doctor verify and repair the complete generation, hook commands, enabled states, and trusted hashes under one transaction lock. A state/trust failure restores the prior hook JSON. A failed asset repair installs and trusts the full-binary fallback. Old generations are pruned only after commit, with two retained for rollback and already-running sessions. A direct GitHub marketplace registration can still work, but it is not the recommended path for regular installs because Codex refreshes git marketplaces during startup, which can block the first screen on network or GitHub latency.

Setup discovers Codex from `PATH`, common user install directories, Volta, nvm, fnm, npm, pnpm, yarn, asdf, and mise/rtx. For npm-style installs, setup also checks for the vendored native Codex binary before falling back to the node launcher. Each candidate must pass `codex --version`; setup skips broken candidates and uses the first working launcher.

If setup reports that every `codex --version` candidate failed with `ENOENT` under an npm, nvm, fnm, or Volta path, the Codex launcher is present but its bundled native binary is missing. Repair or reinstall the Codex CLI first, or install the standalone/Homebrew Codex binary, then rerun `trajectory setup --clients codex`.

## GitHub Copilot CLI

**Trajectory status: Beta. Supported contract: public Copilot CLI plugin-hook contract.**

Install the Copilot CLI plugin with setup:

```bash
trajectory setup --clients copilot
```

Setup writes a local Copilot marketplace under `~/.trajectory/copilot-marketplace`, registers it with `copilot plugin marketplace add`, and installs `trajectory@trajectory`. The plugin includes `hooks.json`, `.mcp.json`, and an incognito skill. Copilot launches `trajectory mcp` from the plugin's MCP config; that MCP process starts Trajectory's embedded local capture server, matching the same setup-managed lifecycle path used by other local agents. The hooks are Copilot command hooks that `curl` POST the hook JSON from stdin to `/capture/copilot/<event>`.

Manual fallback from a checkout:

```bash
copilot plugin marketplace add /path/to/trajectory
copilot plugin install trajectory@trajectory
```

Import Copilot's provider-owned local history with:

```bash
trajectory backfill --from-copilot-sessions
trajectory backfill --from-copilot-sessions --session <id>
```

Enable bounded automatic reconciliation for new and changed local sessions:

```bash
trajectory features enable copilot_cli_durable_history
trajectory config reload --yes
```

`COPILOT_HOME` replaces the complete default `~/.copilot` configuration root.
Trajectory reads the current `session-state/<id>/events.jsonl` layout and its
`workspace.yaml` sidecar, plus the older `session-state/<id>.jsonl` layout. A
current directory-form session wins if both layouts contain the same provider
ID. The reader is bounded, read-only, ignores symlink sources, and fingerprints
both the event log and workspace sidecar. Unchanged sessions are skipped;
rerunning refreshes active or changed sources, and `--force` explicitly
re-derives one or all discovered sessions.

History preserves provider IDs, timestamps, append order, prompts, assistant
text and reasoning, model changes, tool calls/results, permission decisions,
subagent relationships, and shutdown aggregates. Copilot's shutdown
`inputTokens` includes cache reads and writes, so Trajectory subtracts those
categories to retain fresh input separately. The aggregate remains session-only
and is never copied onto a turn. Provider request cost and nano-AIU values stay
provider diagnostics and are not labeled as USD. Active logs do not fabricate a
final turn or session end. If live hooks already captured a matching lifecycle,
prompt, tool, permission, or subagent event, that native event remains
authoritative and provider history only enriches missing fields.

The watcher is default-off. It establishes a content-free startup baseline, so
enabling it does not bulk-import retained history; use the explicit backfill
command for that. Exact notifications and bounded polling cover current and
legacy source creation, append, replacement, same-stat rewrite, workspace
sidecar changes, and deletion. Reconciliation uses a machine-wide lease,
bounded directories/fanout/content/work per pass, a crash-safe content-free
cursor, and atomic native-preserving replacement. Provider files are never
modified. Active or resumed tails remain open, session shutdown usage remains
session-only, and deletion is only a source tombstone. `trajectory doctor`
reports the effective feature and live runtime-manager state.

There is not yet a cloud-agent import or setup-managed resume path. The
implementation is based on GitHub's public Copilot CLI plugin, MCP, skills,
hooks, and configuration-directory documentation and is tested with
provider-shaped local fixtures. Authenticated live validation exercises a real
`copilot --plugin-dir ... -p` session that emits prompt, tool, turn, session,
and `client_source=copilot` JSONL. Until that validation passes, broader
release claims remain beta fixture-tested.

Registered documented events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `permissionRequest`, `notification`, `Stop`, `subagentStart`, `SubagentStop`, `ErrorOccurred`, `PreCompact`, and `SessionEnd`. The plugin uses command hooks, not Copilot HTTP hooks, because Copilot requires HTTPS for HTTP hooks that can affect permissions.

## Claude Code

**Trajectory status: Supported. Minimum supported: 2.0.0; 2.1.215
live-replayed.**

Install with setup:

```bash
trajectory setup --clients cc
```

Setup stages a local Claude Code marketplace under
`~/.trajectory/claude-marketplace`. It does not invoke the Claude CLI, register
the marketplace, or install a missing plugin. Once `trajectory@trajectory` is
installed at user scope, setup, binary update, and MCP startup reconcile that
exact user-scope plugin registry entry and the
`~/.claude/plugins/cache/trajectory/trajectory/` subtree. Reconciliation
materializes a fresh immutable generation when the installed payload is stale
or invalid, atomically repoints only Trajectory's user-scope entry, leaves
project and local scope entries unchanged, and retains the previous generation
for active sessions. Concurrent workers coalesce through an account-scoped
lock, and sequential starts inside a short
input-fingerprinted success cooldown skip repeated work.

Trajectory never directly writes, merges, or deletes Claude user settings,
including `~/.claude.json`, `~/.claude/settings.json`, and settings variants.
The standard plugin has one root `.mcp.json`; the manifest has no inline MCP
block and no nested MCP file. Setup does not run `claude mcp add` or `claude mcp
remove`. When a released explicit user MCP entry already exists, Trajectory
leaves it byte-for-byte unchanged and stages a compatibility plugin generation
with no MCP declaration. Legacy OTLP settings are diagnosed but left unchanged.
Marketplace registration and initial enablement remain owned by Claude or
managed Claude policy. For managed fleets, the Claude administrator may declare
the staged directory as an
`extraKnownMarketplaces.trajectory` directory source, set `autoUpdate: true`,
can also update installed plugins in the background after startup. Trajectory's
own repair path does not depend on that background update.

An active Claude session continues using the plugin version it loaded while a
background update changes the cache on disk. `/reload-plugins` can apply the
updated assets in place, and a new session loads them automatically; closing
Claude is not part of recovery. When
an update or MCP startup finds an exact old-version coordinator owner,
reconciliation replaces it only after its active provider sessions end
naturally. While sessions remain
attached it records `active_sessions_deferred`, leaves the owner and listener
untouched, and relies on a later MCP or background retry. This avoids a capture
blackout and never synthesizes `session_end`. Legacy, external, discovery-only,
and ambiguous owners remain fail-closed and are never signaled by this path.

If managed Claude policy is not available, a Claude administrator or the user
can adopt the staged marketplace through Claude's supported plugin interface:

```bash
claude plugin marketplace add ~/.trajectory/claude-marketplace
claude plugin marketplace update trajectory
claude plugin install trajectory@trajectory --scope user
```

From a source checkout, use the checkout root instead of `~/.trajectory/claude-marketplace`.

Claude Code transcript discovery follows Claude's documented configuration-root
contract. When `CLAUDE_CONFIG_DIR` is non-empty, Trajectory reads and writes
session history only under `$CLAUDE_CONFIG_DIR/projects`; otherwise it uses
`~/.claude/projects`. It does not merge the default root into an overridden
root. An exact `transcript_path` supplied by Claude's hooks remains authoritative.
This override is scoped to transcripts and session history, so it does not
implicitly reroot Trajectory's Claude plugin, settings, or credential handling.
Trajectory does not claim `CLAUDE_PROJECTS_DIR`, multiple config roots, or XDG
fallbacks as Claude Code behavior because they are not part of the current
[Claude Code environment-variable contract](https://code.claude.com/docs/en/env-vars).

### Skill Observability

Claude skill-file hook instrumentation is default-off because it writes hook
metadata into user or project `SKILL.md` frontmatter. Normal setup omits the
prompt-time sync hook. Native transcript and OTLP skill attribution remain
available without mutating skill files.

To opt in to the fallback, enable the feature, stage the plugin, and let Claude
adopt it through its managed or user-facing update path before syncing selected
skills. Reversible state is recorded under
`~/.trajectory/state/claude-skills/manifest.json`:

```bash
trajectory features enable claude_skill_file_hooks
trajectory setup --clients cc
trajectory claude skills status
trajectory claude skills sync --user
trajectory claude skills sync --project
trajectory claude skills restore --stale
```

Project `.claude/skills` fallback sync additionally requires
`TRAJECTORY_CLAUDE_SKILLS_PROJECT=1` or a
`.trajectory/claude-skills-project-enabled` marker in the project. Normal setup
and Claude integration removal never edit these files. Run the explicit
`trajectory claude skills restore` command to remove only Trajectory-owned hook
entries while preserving unrelated skill metadata.

For a non-mutating project path on supported macOS launch chains, use the
Claude wrapper read-virtualization mode:

```bash
trajectory claude --skill-read-virtualization --skill-managed-binary -- <claude args>
```

This mode serves virtualized `SKILL.md` bytes through a managed Claude launch
copy and leaves real skill files clean. If the runtime or managed settings block
the virtualized/hook path, Trajectory falls back to explicit sync/status/restore
commands rather than silently claiming scoped skill attribution.

For current Claude builds that write `message.attributionSkill` into the native
transcript, Trajectory treats that transcript field as the primary
non-mutating skill attribution signal. Deferred stop processing stamps the
skill onto `agent_message` and `turn_end` events, and ingest turns it into a
high-confidence `skill-invoked` marker tagged
`detected_from:claude_native_transcript`. Read virtualization remains useful
for proving clean `SKILL.md` transformation and for hook-based experiments, but
successful virtualized reads do not by themselves guarantee that Claude will
execute hook metadata injected into a skill file.

The packaged `skill-observability` dashboard exposes both invocation and
observation metrics with `repo`, `skill_name`, `detected_from`,
`source_scope`, `signal_confidence`, and `trajectory.client_version`
dimensions:

```bash
trajectory dashboard export --type skill-observability --output trajectory-skill-observability.json
```

Use those version slices to spot Claude runtime drift: if a newer Claude
version stops emitting transcript `attributionSkill`, invocation metrics will
drop or shift away from `detected_from:claude_native_transcript` while
lower-confidence observations may continue.

For the full skill-maintainer workflow, run
`trajectory user-guide skill-observability`.

The plugin ships the standard Claude `hooks/hooks.json` file with 13 lifecycle
hooks, primarily HTTP, with helper command shims for startup, shutdown, and serve
lifecycle handling. The registered permission hooks include `PermissionRequest`
and `PermissionDenied`; `PermissionDenied` records auto-mode classifier denials
without relying on latency inference. Claude Code loads that standard hook file
automatically; the plugin manifest intentionally does not list
`hooks/hooks.json`, because doing so would load the same file twice.

Claude Code native OTLP logs, metrics, and traces can be relayed through local
`trajectory serve` when `trajectory claude` launches Claude with local OTLP
environment overrides, or when the effective Claude settings explicitly point
those signals at the local OTLP endpoints. Setup does not write, merge, or
delete Claude user settings. If it detects the exact legacy user-scope
Trajectory OTLP env block written by older versions, it warns and leaves the
settings file byte-for-byte unchanged. When Claude managed settings own OTel
configuration, an admin must make any durable
managed-settings change. `trajectory claude` preserves the effective OTLP
protocol shape from Claude settings, falling back from per-signal protocol to
`OTEL_EXPORTER_OTLP_PROTOCOL` and then to an explicit `http/json` default.
Trajectory keeps only
`skill_activated` records from logs, stores them as bounded local `Skill` tool
activations tagged with
`detected_from:claude_native_otel`, and can forward the original OTLP
logs, enriched OTLP metrics, and original OTLP traces to an upstream collector
when `server.otlp_proxy.endpoint` is set. Trajectory also writes safe
normalized local trace summaries under `~/.trajectory/state/otlp-proxy/traces/`
so skill complexity metrics can prefer native Claude tool spans. Forwarded
Claude native metrics carry
`trajectory.cost_role:client_telemetry` and
`trajectory.cost_source:claude_native_otlp` so Datadog totals can keep native
client telemetry separate from Trajectory attribution metrics. Complexity
metrics expose `skill_attribution:span_tool_attribute`,
`skill_attribution:span_temporal`, or `skill_attribution:turn_assisted` to
distinguish native trace-derived windows from same-turn fallback attribution.
Set `server.otlp_proxy.capture_enabled: true` or
`TRAJECTORY_OTLP_PROXY_CAPTURE_ENABLED=1` to write local normalized
inbound-vs-forwarded metric comparison records, then inspect them with
`trajectory otlp metrics compare --session <session-id>`.

`SessionEnd` is a foreground `trajectory capture-hook --background-after-read
--ensure-serve --ensure-serve-wait 2s --wait-notify 2s SessionEnd` command hook.
The foreground phase only reads Claude's stdin and spools it to a private
payload file. A detached worker then restarts/notifies the local capture server,
so the terminal event that drives final session metrics can be delivered without
blocking Claude's exit path on publish or server recovery.

Claude `--print` sessions omit `transcript_path`, so Trajectory marks them as
headless. Headless coding-agent sessions are collected and published by default
when export is configured, while sensitivity/classification and segmentation
always skip headless sessions. To opt out for all non-internal headless agent
sessions:

```bash
trajectory config set capture.include_headless_agents false
```

Trajectory-owned classifier and segmenter subprocesses remain suppressed.

## Gemini CLI

**Trajectory status: Supported. Minimum supported: 0.30.0; 0.51.0
live-replayed and source checked.**

Install with setup:

```bash
trajectory setup --clients gemini
```

Setup writes `.gemini/settings.json`, `.gemini/hooks/hooks.json`,
`.gemini/skills/incognito/SKILL.md`, and
`.gemini/commands/incognito.toml` below Gemini CLI's effective user home. That
home is `$GEMINI_CLI_HOME` when non-empty and the operating-system home
otherwise; the override is exclusive and still receives the `.gemini`
component. The settings file registers Trajectory MCP, and the hooks file uses
command hooks with `curl` to post session events to the local capture server.

The repository still includes `hooks/hooks.json` as a legacy extension command-hook template for older manual installs. Manual extension installs remain supported for development and recovery, but they must match Gemini's hook format and wire MCP, skills, and commands separately. Current setup-managed installs should use `trajectory setup --clients gemini`.

The Gemini skill uses `trajectory_incognito` when MCP is available, and falls back to the `/session/incognito` HTTP endpoint.

Gemini CLI does not currently expose direct subagent lifecycle hooks. When
Gemini writes a `kind:"subagent"` chat artifact, Trajectory synthesizes
`subagent_start`, `subagent_stop`, and `subagent_cost` during `SessionEnd` and
links those lifecycle events back to the parent `generalist`, `cli_help`, or
`codebase_investigator` tool call when the parent JSONL contains the launch
`tool_use_id`.

Historical and token repair use the same effective home:

```bash
trajectory backfill --from-gemini-transcripts
trajectory backfill --tokens --all
```

Trajectory scans `<effective-home>/.gemini/tmp/*/chats`. Setup, uninstall,
doctor, inventory, update refresh, subagent lookup, and cross-client resume use
the same resolver. This contract is pinned to official Gemini CLI source commit
`fa975395bcc6b609e44735e47320e54f51535d47`. `ccusage` independently
cross-checks Gemini message usage and pricing, but its pinned path resolver does
not yet honor `GEMINI_CLI_HOME` and is not used as path authority.

## Antigravity CLI (`agy`)

**Trajectory status: Supported. No minimum version is established; 1.0.12 and
1.1.2 are fixture/source-shape evidence only.**

Install with setup:

```bash
trajectory setup --clients agy
```

Setup writes `~/.gemini/antigravity-cli/settings.json` for the Trajectory MCP server and stages a Trajectory plugin under `~/.gemini/config/plugins/trajectory`. The plugin includes root-level `hooks.json`, `skills/incognito/SKILL.md`, and `commands/incognito.toml`.

The plugin uses Antigravity's native `PreToolUse`, `PostToolUse`,
`PreInvocation`, `PostInvocation`, and `Stop` events and posts their camelCase
payloads to `/capture/agy/<Event>`. Trajectory preserves
`conversationId` as session identity, derives deterministic tool correlation
from `stepIdx`, and records the provider's exact tool error and Stop metadata
with `client_source=agy`. `Stop` closes an execution loop, not the durable
conversation. Current hooks expose `modelName` as either a selector such as
`auto` or a concrete-looking name, but do not establish authoritative provider
identity. Trajectory therefore preserves it as `model_label`, which cannot
drive cost attribution. The hooks do not expose prompts, assistant text,
tokens, cost, or a terminal conversation event, so Trajectory does not infer
those fields.

Manual validation:

```bash
agy plugin validate plugin/trajectory-antigravity
```

Successful validation reports `hooks: 1 processed`; `hooks: skipped (not found)`
means the plugin has the obsolete nested `hooks/hooks.json` layout and should be
refreshed with setup. The optional `antigravity_durable_history` watcher reads
exact scoped rows from provider-owned `history.jsonl` and current schema-v1
`conversations/<uuid>.db`; it baselines existing rows on first enable and
reconciles later JSONL, database, WAL, or shared-memory changes without
replacing native tool/Stop evidence. Strict bounded `gen_metadata` decoding
preserves provider model, uncached-input, total-output, and cache-read counts.
Output already includes thinking; no separate reasoning count exists. SQLite
and WAL modification time is marked synthetic because the provider supplies no
per-generation timestamp. The provider exposes no prompt-to-generation join
key, so generation usage stays on stable provider-indexed canonical turns and
is never attached to a prompt by ordinal. Token-only LLM spans keep cost unavailable because
cache-write usage and provider-billed cost are not exposed. Provider-typed
slash commands and unknown typed history rows are skipped, and unknown schemas,
undecodable rows, rewrites, and removals fail closed rather than fabricating
assistant/thinking text, tools, `turn_end`, or `session_end`.

After enabling the feature, explicitly import retained history that predates
the watcher's baseline with:

```bash
trajectory backfill --from-antigravity
trajectory backfill --from-antigravity --session <conversation-id>
```

Existing canonical sessions are skipped unless `--force` is supplied. Forced
repair refreshes matching provider-derived facts under the same
materialization lock as the watcher and preserves unmatched arrivals. Because
the provider omits cache-write usage and completion status, those fields and
derived cost remain unavailable rather than becoming zero or success.

Native hook events and incognito state are preserved, foreign canonical
ownership is refused, provider files stay read-only, and the intentionally
open snapshot is indexed into local UI without synthesizing completion.
Current limitations are private step transcript decode and the absence of a
setup-managed resume target.

Enable the supplement and reload a running server with:

```bash
trajectory features enable antigravity_durable_history
trajectory config reload --yes
```

## Goose

**Trajectory status: Beta. Goose 1.43.0 source inspected; 1.39.0 live tested.**

Install with setup:

```bash
trajectory setup --clients goose
```

Setup writes a Goose Open Plugins package under
`~/.agents/plugins/trajectory`. If `GOOSE_PATH_ROOT` is set, setup writes the
same package under `$GOOSE_PATH_ROOT/.agents/plugins/trajectory`. Setup resolves
a relative value once from its own working directory and embeds that canonical
absolute root in the installed hook, so later Goose working-directory changes
cannot retarget discovery. The hook conveys the same provider root to the
server. Setup records that canonical root and prior install locations in a
private Trajectory registry; the server rejects hook-conveyed roots that setup
did not authorize. When at least one root is registered, that set is exclusive
and default-store copies do not participate in same-ID discovery. Uninstall
uses the install-location history, so changing or unsetting the override cannot
leave an older Trajectory plugin behind. The package
contains a `plugin.json` manifest and `hooks/hooks.json`.

The Goose hooks use command actions backed by Trajectory's `capture-hook`.
Every hook stays foreground through bounded server acceptance to preserve
provider emission order, with canonical JSONL fallback if serve is unavailable.
Setup registers `SessionStart`, `UserPromptSubmit`,
the generic `PreToolUse`, `PostToolUse`, and `PostToolUseFailure` family,
`Stop`, and `SessionEnd`. Current Goose emits the generic tool hook and then a
shell/file-specific compatibility hook for the same invocation, so fresh setup
installs only the generic family. The runtime still accepts older
`BeforeReadFile`, `AfterFileEdit`, `BeforeShellExecution`, and
`AfterShellExecution` registrations and deduplicates them. Native names such as
`developer__shell` are retained alongside canonical tool names.
Current generic hook payloads do not include a provider tool-call ID, so live
pre/post matching for concurrent calls with the same tool name is best-effort.
Generic post-tool payloads also omit the provider result or error body. The
SQLite message history carries exact tool request/result IDs and payloads for
provider-owned passive traces. Durable-history reconciliation does not rewrite
or enrich those fields on an existing native trace.

Live Open Plugins payloads do not expose authoritative model usage, cost, or
interactive/headless mode. Lifecycle and prompt HookContext payloads also omit
working directory, so `capture-hook` injects the hook process cwd only when no
provider directory field exists and records
`cwd_provenance=hook_process_working_dir`. Durable history remains
authoritative for the stored session working directory on provider-owned
passive traces; usage-only reconciliation does not replace the hook-derived
directory on native traces. Until Goose exposes an authoritative mode signal,
hook sessions use `source_mode=unknown` and are conservatively headless for
sensitivity and segmentation.

The default-off `goose_durable_history` feature adds bounded, read-only
reconciliation of Goose's current schema-v15 `sessions.db` under the
platform-specific Block/goose data root, or
`$GOOSE_PATH_ROOT/data/sessions/sessions.db`. It reads DB/WAL/SHM state without
mutating the provider store. When Trajectory materializes a provider-owned
passive trace, it preserves exact Goose session and parent IDs, working
directory, messages, thinking, tool calls/results, model/provider,
input/output/cache-read/cache-write tokens, compaction rows, and Goose-rated
cost with its native `provider_reported`, `estimated`, or carried-forward
label. Only `provider_reported` USD is eligible for cost attribution;
`estimated`, mixed, and carried-forward amounts remain raw provider evidence
with unavailable attribution. Provider input includes cache subsets;
Trajectory exposes uncached input and the cache categories separately. Source
and materialized output have aggregate byte limits in addition to row/count
limits. Nullable, partial, negative, or contradictory token vectors remain raw
provider observations with `tokens_status=unavailable` and are not
materialized as canonical turn usage.

The current message parser enforces `userVisible=false` across text, thinking,
tools, and structured blocks while preserving only non-content usage/model
evidence. User-visible text and thinking are retained. Image bytes and
redacted-thinking payloads are omitted; system notifications, tool
confirmations, and action/elicitation variants are represented as typed
metadata-only boundaries with
`provider_structured_content_fidelity=metadata_only`.

Exact native session IDs allow history usage corrections and usage observations
to enrich an existing Open Plugins trace without replacing its prompts, tools,
messages, metadata, or terminal lifecycle. This native-trace path is usage-only:
it does not repair best-effort tool IDs, add omitted tool result/error bodies,
or replace hook-derived working directory, parent, or session model metadata.
Periodic reconciliation keeps SQLite work off Stop's request path and bounds
the complete native correction transaction, including ownership/index scans,
to two seconds.
Stop remains foreground and ordered ahead of SessionEnd but performs no SQLite
work. SessionEnd stays foreground through bounded server acceptance, attempts
one bounded exact reconcile, and commits the terminal record before final
publish and cleanup continue asynchronously; an unavailable provider source
or contended lock emits an explicit fidelity diagnostic rather than losing
lifecycle. If server delivery is definitively unavailable, the canonical local
fallback performs the same indexed exact-source reconcile before SessionEnd,
so final provider tokens and eligible cost remain ordered ahead of terminal
state. Repeated source revisions are idempotent, per-turn fingerprints keep
correction storage linear, and a persisted safe-tail index limits repeat scans
to newly appended JSONL bytes while detecting same-size rewrites. This relies
on the canonical JSONL append-only writer contract; a historical mutation
outside the checked trailing boundary followed by an append requires explicit
backfill repair. A later provider rewrite appends a last-write-wins replacement
or explicit clearing correction. Current Goose emits no new SessionStart when
reopening a non-empty conversation, so the first authoritative post-terminal
hook creates a `resume_evidence=post_terminal_hook` generation boundary,
reopens enrichment, and restores sequence allocation above the existing JSONL
maximum. If a hook POST may have been accepted but its response
is lost, Trajectory does not start a competing local fallback that could race
the pre-terminal reconcile. No correction is appended after an unresumed
`session_end`. Sessions
seen only in SQLite remain incomplete passive history: Trajectory does not
invent `turn_end` or `session_end`, and provider deletion is a tombstone rather
than proof of completion. Disable only the fallback with
`TRAJECTORY_DISABLE_GOOSE_HISTORY_WATCHER=1`.

```bash
trajectory features enable goose_durable_history
trajectory config reload --yes
```

Default CI uses recorded Open Plugins and sanitized current-schema fixtures
because a real Goose model call needs provider credentials on the runner. A
protected live smoke can run Goose when the environment supplies
non-interactive provider credentials. The pinned current Goose source is the
schema authority; `ccusage` independently cross-checks an override plus some
default roots and the aggregate input/output/total/model shape. It omits the
current macOS Block root and Windows root, sets cache counters to zero, and
derives cost externally, so the Goose source and ledger remain authoritative
for complete platform discovery, nullable cache fields, compaction, and native
cost-source semantics.

## Cursor

Cursor has two separate products with different capture paths:

### Cursor Desktop (IDE)

**Trajectory status: Supported. Minimum supported: 1.0.0** (`hooks.json` support)

The trajectory setup wizard writes hooks and MCP config directly:

```bash
trajectory setup --clients cursor
```

This creates `~/.cursor/hooks.json` and `~/.cursor/mcp.json`. Capture uses Cursor's supported command hooks to `curl` POST payloads to the Trajectory capture server. Cursor does not currently accept every Claude Code lifecycle hook name; setup registers the supported Cursor event names and omits unsupported lifecycle hooks. When Claude Code is installed, Cursor uses the Claude Code Trajectory skill path for `/incognito`; otherwise setup installs a native Cursor fallback at `~/.cursor/skills/incognito/SKILL.md`. The `incognito` skill uses the shared `trajectory_incognito` MCP tool to suppress publish to non-exempt Datadog destinations for the active Cursor session while local JSONL capture continues.

CI validates this Desktop install surface on macOS by running setup in an isolated home, checking the Cursor MCP/hooks files and incognito skill routing, replaying sanitized real Desktop payload fixtures into `/capture/cursor`, and verifying JSONL, materialization, SQL, LLM Obs, and Lapdog list/trace/fetch/scalar parity. With default-on `cursor_native_token_usage`, a complete generation publishes Cursor's native input, output, cache-read, and cache-write vector. `cache_write_tokens` is normalized exactly once to `cache_creation_tokens`. Partial, invalid, missing, conflicting, or unknown-model generations remain explicitly unpriced. `state.vscdb` and response-length estimates cannot price or complete the vector.

Pricing defaults to `pricing.cursor.mode: emit` with `source: org_file`. Managed policy can force `off` or `shadow`. `org_file` reads the validated effective-dated card at `~/.trajectory/org/pricing.yaml`; selecting the not-yet-implemented `datadog_reference_table` adapter fails closed with `pricing_source_unavailable`. Trajectory emits existing USD metric names only for explicitly priced new turns. Missing rate cards leave turns unpriced rather than $0. It performs no historical Cursor cost replay.

### cursor-agent (CLI)

cursor-agent is a standalone CLI (`cursor-agent --print` for headless mode). Authenticated interactive dispatch on `2026.07.09-a3815c0` has been validated through a real Trajectory binary: the terminal hooks carried the exact model, generation, input, output, cache-read, and cache-write values and preserved trusted CLI surface attribution. The same version's `--print` JSON result exposed all four usage fields but did not dispatch native terminal hooks, so headless native cost remains unsupported and unpriced rather than inferred from response text. Capture also uses one shared passive JSONL source for watcher and backfill: current main files at `~/.cursor/projects/*/agent-transcripts/<session>/<session>.jsonl`, current nested child and side-chat files at `~/.cursor/projects/*/agent-transcripts/<parent>/subagents/<child>.jsonl`, current CLI Task children written as sibling main transcripts, and legacy flat `agent-transcripts/<session>.jsonl` files.

Cursor Desktop 3.11 stores canonical relationship metadata in the typed
`composerHeaders` table of global `state.vscdb`, with the exact
`composer.composerHeaders` `ItemTable` key as a legacy fallback. Trajectory
reads only those sources under strict row and byte limits. It classifies
`subagentTypeName: side-chat` as an interactive side chat, uses the exact
`parentComposerId`, and omits the copied parent-turn prefix identified by
`sideChatSeedTurnCount`. A child of a side chat retains the side chat as its
parent. Conflicting, cyclic, oversized, or internally inconsistent canonical
relationships fail closed; arbitrary chat-store metadata is ignored. A
child transcript remains uncommitted while the metadata database is unreadable
and retries on a bounded cadence. A content-private source-contract fingerprint
forces a replacement rebuild if late metadata changes an earlier classification,
so copied and live side-chat activity cannot be mixed across watcher restarts.

cursor-agent Task children often omit `subagentStart`/`subagentStop` even when a
child transcript exists (sometimes as a sibling main session whose first user
prompt matches the Task prompt). Default-on
`cursor_task_subagent_synthesis` synthesizes launch-linked parent-side
`subagent_start`/`subagent_stop` at session end. Native Desktop hooks still win
when present; synthesis never invents a child without a transcript match. A
sanitized `2026.07.16-899851b` fixture covers one parent with two sibling Task
children. Sibling lookup must resolve exactly one project tree containing the
parent transcript. Synthesized lifecycle uses the same project-scoped logical
child IDs as passive session materialization and retains exact raw/provider child
identity; copied or otherwise ambiguous parent IDs fail closed.

The watcher is a default-off preview. Enable it explicitly and hot-reload the
running server:

```bash
trajectory features enable cursor_agent_durable_history
trajectory config reload --yes
```

The fixture-backed gate asserts main and child discovery, exact raw/provider
identity, collision-safe project namespacing, child-parent linkage, provider
text/tool request/turn evidence, durable retry, same-stat replacement, deletion
tombstones, and backfill-to-Lapdog list/trace/fetch/scalar readback. Mutation or
deletion rebuilds or clears only watcher-owned JSONL and local rows; native traces are preserved. Passive source mode remains
unknown because Desktop and CLI share the store. Flat legacy JSONL remains
covered; legacy text transcripts are not supported. A source-verified sanitized
Desktop 3.11.25 fixture covers a main chat, its side chat, copied-prefix
omission, and a child of that side chat. This is signed-application source and
fixture evidence, not a claim that a live 3.11 GUI pilot was performed.

Current passive records expose no provider timestamps, model, tokens, cost, or
SessionEnd, and the observed current fixture has tool requests but no tool
results. Trajectory marks observation/file-order timestamps derived, emits a
tool post only for an actual `tool_result`, and does not infer successful tool
completion, model, token estimates, cost, or SessionEnd. Native hooks remain
authoritative when their exact raw session is active. A Read of
`.cursor/skills/<name>/SKILL.md` records skill invocation intent as a pre event;
it is not promoted to a fabricated completion. ccusage currently has no Cursor
adapter and provides no independent Cursor token/cost evidence.

Install cursor-agent: `curl -fsSL https://cursor.com/install | bash`

## Pi

**Trajectory status: Supported. Minimum supported and latest checked: 0.80.10**
(headless mode: `pi -p`)

Install the trajectory extension with setup:

```bash
trajectory setup --clients pi
```

Manual fallback from the repo:

```bash
mkdir -p ~/.pi/agent/extensions
cp -R /path/to/trajectory/plugin/trajectory-pi ~/.pi/agent/extensions/trajectory
```

Then point `~/.pi/agent/mcp.json` at `~/.pi/agent/extensions/trajectory/bin/trajectory mcp`.

Setup writes `~/.pi/agent/extensions/trajectory/` with a `package.json` that declares `pi.extensions: ["./src/index.ts"]`, plus a root `index.ts` shim that re-exports `./src/index.ts`, and points `~/.pi/agent/mcp.json` at the extension-local `bin/trajectory mcp` command. Setup does not add Trajectory's extension entrypoint to `~/.pi/agent/settings.json`; Pi discovers the extension from its standard extensions directory. Pi uses a TypeScript extension API (`pi.on("event", handler)`) that subscribes to lifecycle events (session_start, agent_end, tool_call, tool_result, etc.) and POSTs them to the capture server. Native `turn_end` is one provider request/tool-loop step, so the extension retains that request usage on `AgentMessage`/`llm_call` but finalizes a Trajectory turn only at `agent_end`, using the complete native agent-run usage aggregate and a stable source event ID. Pi also writes key lifecycle events through `capture-hook` for robustness and emits `PostCompact`. The native extension registers `trajectory_status`, `trajectory_flush`, `trajectory_incognito`, `trajectory_schema`, and `trajectory_query`; MCP exposes the shared cross-client tool surface in environments where Pi routes MCP tools. Pi supports multiple LLM providers - use any provider API key for testing.

Pi does not currently consume the Codex/Claude-style `skills/` plugin directory. The Trajectory Pi extension vends incognito through its native `trajectory_incognito` tool; environments that expose MCP can also use the shared `trajectory_incognito` MCP tool.

Current Pi reports fork and new-session transitions through `session_start`.
The extension preserves the exact provider session IDs and records a canonical
parent link only when the new header's `parentSession` confirms the provider's
`previousSessionFile`. Historical backfill resolves the same file reference to
the parent header ID, keeps safe provider IDs unchanged, and uses a stable
provider-scoped ID only if an unexpected provider ID is unsafe for a filename.
These links are visible in local-UI list and trace readback. Pi still does not
expose a dedicated child-session launch lifecycle with a launch tool ID, so a
session relationship is not promoted to a semantic subagent task span.

### OhMyPi (`omp`)

OhMyPi is a distinct, feature-gated client source, not an alias for the Pi
extension. Enable `omp_instrumentation`, then run `trajectory setup --clients
omp`. Setup installs an OMP-native extension declared with `omp.extensions`,
merges the Trajectory MCP entry into the active profile's `mcp.json`, and posts
live events to `/capture/omp`. The server fixes `client_source` to `omp` even if
a payload tries to supply another source.

OMP path resolution follows the provider's active profile contract.
`OMP_PROFILE` takes precedence over `PI_PROFILE`, including an explicitly empty
value; named profiles live under the OMP config root and ignore
`PI_CODING_AGENT_DIR`; default profiles honor that override. Migrated XDG data
is selected only when the matching provider directory exists. Run `trajectory
backfill --from-omp-sessions` to recursively import the effective profile's v3
history, including its title metadata slot, nested child files, exact IDs and
parent links, real tool results/errors, model changes, usage, and compaction.
When the feature is enabled, the server automatically reconciles existing and
changed files from that same root in bounded passes. The cursor is crash-safe
and content-private; native facts win over overlapping history; provider
deletion is not treated as lifecycle; and passive updates do not activate,
complete, or publish sessions. The explicit backfill command remains the
complete-history repair path.

Current OMP coverage is fixture-backed against sanitized v3 layouts, including
mutation/retry and local-UI readback. A credential-free real-executable smoke
remains pending because the provider executable was unavailable in the
validation environment.

## Factory Droid

**Trajectory status: Beta. Supported contract: public Factory plugin-hook contract.**

Install the Factory Droid plugin with setup:

```bash
trajectory setup --clients droid
```

Setup writes a local Factory marketplace under `~/.trajectory/factory-marketplace`, registers it with `droid plugin marketplace add`, and installs `trajectory@trajectory` at user scope. The plugin includes `hooks/hooks.json`, `mcp.json`, and an incognito skill. Droid launches `trajectory mcp` from the plugin's `mcp.json`; that MCP process starts Trajectory's embedded local capture server, matching the same lifecycle path used by the other setup-managed clients. The hooks themselves stay simple Factory command hooks that `curl` POST the hook JSON from stdin to `/capture/droid/<event>`.

Manual fallback from the repo:

```bash
droid plugin marketplace add /path/to/trajectory
droid plugin install trajectory@trajectory --scope user
```

Capture is live only. There is no Factory/Droid historical backfill,
transcript watcher, or session import path. The implementation is based on
Factory's public plugin, hook, skills, and MCP documentation and is validated
against payloads that match the documented hook shape.

Registered documented events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Notification`, `Stop`, `SubagentStop`, `PreCompact`, and `SessionEnd`. Factory's public docs do not currently document `PostToolUseFailure`, `PermissionRequest`, `SubagentStart`, or `PostCompact` for Droid; the server accepts those Claude-compatible names as best-effort future compatibility, but the packaged Droid plugin does not register them.

## OpenCode

**Trajectory status: Supported. Minimum supported and latest checked: 1.18.3**
(headless mode: `opencode run`)

Install the trajectory plugin with setup:

```bash
trajectory setup --clients opencode
```

OpenCode uses a plugin SDK (`@opencode-ai/plugin`) with a `server` entrypoint that returns hook handlers for `chat.message`, `tool.execute.before`, `tool.execute.after`, and `event`. The plugin fires capture events via fetch to the trajectory serve endpoint. OpenCode supports multiple LLM providers.

OpenCode supports native agent skills from `.opencode/skills/<name>/SKILL.md`, the configured OpenCode user skills directory, `.agents/skills/<name>/SKILL.md`, and Claude-compatible skills paths. `trajectory setup --clients opencode` installs the Trajectory OpenCode plugin under the resolved OpenCode config directory (`OPENCODE_CONFIG_DIR`, then `XDG_CONFIG_HOME/opencode`, then `~/.config/opencode`), merges that plugin path plus a `trajectory` MCP entry into `opencode.json`, and writes the incognito skill into the global OpenCode skills directory. The skill uses `trajectory_incognito` when MCP is available, and falls back to the `/session/incognito` HTTP endpoint.

OpenCode capture currently records native agent metadata on ordinary prompt,
tool, and message events, but the plugin SDK path used here does not provide a
dedicated child-agent lifecycle with `child_session_id`. Trajectory therefore
does not infer subagent trace parentage from OpenCode `agent_id` or
`agent_type` alone.

Durable history is a separate, authoritative source. Run:

```bash
trajectory backfill --from-opencode
trajectory backfill --from-opencode --session <session-id>
```

The importer reads current and channel `opencode*.db` databases plus retained
`storage/session`, `storage/message`, and `storage/part` JSON trees. SQLite wins
when both stores contain the same provider session ID; JSON-only history remains
eligible. Child and archived sessions are included, native `parentID` is
preserved through the local-ui trace metadata, explicit-zero usage is kept
distinct from missing usage, and active durable sessions are not assigned a
synthetic `session_end`. `OPENCODE_DB` supports the runtime's absolute or
data-root-relative database override. Set `OPENCODE_DATA_DIR` to an exclusive
comma-separated root list; otherwise the importer uses `XDG_DATA_HOME/opencode`
or `~/.local/share/opencode`.

An opt-in preview can keep newly created or changed durable sessions current
while `trajectory serve` is running:

```bash
trajectory features enable opencode_durable_history
trajectory config reload --yes
```

The watcher treats the database plus its `-wal` sidecar as durable wake
surfaces, classifies retained session/message/part paths, and fingerprints one
logical provider session from the first authoritative content-bearing SQLite
or JSON copy. Database and WAL notifications are coalesced by database after a
200 ms quiet window, with a bounded one-second maximum cadence under continuous
WAL churn. SHM coordination notifications fold into an existing wake but do not
schedule reconciliation alone, and CHMOD-only lock metadata is ignored,
avoiding read-triggered self-wake loops. It is bounded, warms without replaying
old history, rebuilds only OpenCode backfilled JSONL, and rejects richer
live-plugin JSONL before provider content hashing. A provider deletion is
retained as a source diagnostic rather than fabricated as `session_end`; use
the explicit backfill commands above to import history that predates watcher
enablement. To bound idle work, automatic discovery considers a deterministic
set of up to 4096 logical sessions and evaluates at most 64 cheap signatures
per pass. Each
watcher pass performs at most one full-content fingerprint and materialization;
remaining work is persisted in the bounded cursor and rotated across later
passes. The fsnotify queue retains at most 4096 coalesced changed paths.
Manual and watcher loads share the same fail-closed resource envelope: at most
eight data roots and source candidates, 32 databases, 8192 messages, 32768
parts, 4 MiB per native record, and 16 MiB of retained transcript JSON per
logical load. One content fingerprint or provider transcript load is admitted
per user across local processes through process-local admission plus a
crash-safe advisory file lock; the subsequent bounded JSONL conversion is
serialized by its destination-file lock. Concurrent source work waits at most
10 ms and remains pending for retry instead of queueing CPU and memory work.
Oversized or incomplete history is left provider-owned and reported rather
than partially materialized or silently downgraded to a stale retained-JSON
copy. Same-size, same-mtime retained JSON rewrites are detected through exact
filesystem notifications or after the
rotating full-content baseline reaches that session. A rewrite that occurs
before that baseline and outside registered watch directories may require the
manual backfill repair path.

Manual fallback: copy `plugin/trajectory-opencode` to `~/.config/opencode/plugins/trajectory` and add that local path to the `plugins` array plus a `trajectory` MCP entry in `~/.config/opencode/opencode.json`.

**Source:** [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)

## Kilo Code

**Trajectory status: Beta. Minimum supported and latest checked: 7.4.11**
(headless mode: `kilo run --auto`)

Install the Trajectory plugin with setup:

```bash
trajectory setup --clients kilo
```

Kilo Code is OpenCode-compatible at the plugin surface. Trajectory installs a
plugin SDK package under the Kilo config directory (`KILO_CONFIG_DIR` when set
for isolated runs, otherwise `XDG_CONFIG_HOME/kilo` then `~/.config/kilo`),
merges that plugin path and a `trajectory` MCP entry into `opencode.json`, and
writes the incognito skill into the global Kilo skills directory. The plugin posts SDK events to
`/capture/kilo/<event>`, and the server reuses the OpenCode-compatible parser
while forcing `client_source=kilo`.

Kilo may publish assistant text before its final message accounting. The
installed plugin correlates the final `message.updated` by native message ID and
emits one compact usage event without duplicating assistant text. Trajectory
preserves input, output, reasoning, cache-read, cache-write, model, provider,
native timestamp, and provider-reported cost in one `llm_call` and the completed
turn.

Kilo also supports native OpenTelemetry export. To relay native telemetry through
Trajectory, set `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:19222` before
starting `kilo`; Kilo will export OTLP traces/logs to the local Trajectory relay
when its OpenTelemetry setting is enabled. This complements the plugin event
stream; it does not replace setup-managed plugin capture.

For durable fallback and existing-history repair, enable the default-off flag:

```bash
trajectory features enable kilo_durable_history
trajectory backfill --from-kilo [--session ID] [--force]
```

The watcher uses Kilo's official platform data root (`$XDG_DATA_HOME/kilo`,
`~/Library/Application Support/kilo` on macOS, `%LOCALAPPDATA%\kilo` on
Windows, or `~/.local/share/kilo` elsewhere), `KILO_DB`, `kilo.db`, current and
retained legacy channel databases, and the retained JSON storage tree. It is a
bounded read-only fallback: native plugin traces win, startup does not replay
old history, source deletion does not imply `session_end`, and exact Stop/end
wakeups reconcile only changed provider sessions. Use
`TRAJECTORY_DISABLE_KILO_WATCHER=1` as the watcher-specific kill switch.
`KILO_CONFIG_DIR` changes plugin/config placement, not durable-data discovery.
Kilo's CLI and editor share the core store, so durable history cannot reliably
distinguish which frontend created a session.

Kilo's live capture path is validated with its OpenAI-compatible provider mode
and automated CLI execution.

Manual fallback: copy `plugin/trajectory-kilo` to
`~/.config/kilo/plugins/trajectory` and add that local path to the `plugin`
array plus a `trajectory` MCP entry in `~/.config/kilo/opencode.json`.

**Source:** [github.com/Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode),
[Kilo CLI docs](https://kilo.ai/docs/code-with-ai/platforms/cli)

## Kiro CLI

**Trajectory status: Beta. Supported contract: Kiro CLI 2.12.2 stable manifest,
public command-hook and retained-session docs, plus fixture-pinned SQLite
storage.**

Install with setup:

```bash
trajectory setup --clients kiro
```

Setup writes a Trajectory agent config to `~/.kiro/agents/trajectory.json`
(or `$KIRO_HOME/agents/trajectory.json`) and merges a `trajectory` MCP server
into `~/.kiro/settings/mcp.json`. The installed agent keeps Kiro's normal
coding-agent behavior, enables `includeMcpJson`, and registers fail-open command
hooks that invoke `trajectory capture-hook --client kiro --ensure-serve`.
Select that agent with Kiro's `--agent trajectory` option when using the stable
2.x CLI. Kiro 3.0 early access continues to accept embedded agent hooks during
its transition, but Trajectory does not yet install standalone v3 hook files.

Kiro exposes command hooks from agent configuration. Trajectory captures
`agentSpawn`, `userPromptSubmit`, `preToolUse`, `postToolUse`, and `stop`
payloads from stdin and records `client_source=kiro`. The current documented
stop hook includes `assistant_response`, so Trajectory records final assistant
text and a turn end. The documented hook payloads do not expose stable token or
cost usage, so live Kiro turns are marked `tokens_status=unavailable`.

Optional retained-history reconciliation is disabled by default:

```bash
trajectory features enable kiro_durable_history
```

The watcher reads top-level session JSONL and metadata under
`$KIRO_HOME/sessions/cli` (or `~/.kiro/sessions/cli`) and `data.sqlite3` under
macOS `~/Library/Application Support/kiro-cli` or Linux
`${XDG_DATA_HOME:-~/.local/share}/kiro-cli`. It covers current
`conversations_v2` and legacy `conversations` tables. It is bounded, read-only,
WAL-aware, self-retrying, and crash-retryable. The exact Kiro session UUID
correlates both stores and live hooks. JSONL owns message content when both
stores exist; SQLite can enrich only an exact provider message ID with its
native model and stream-end timestamp. Native hook events make the Trajectory
JSONL authoritative, and later passive changes cannot overwrite it. A stable
Windows SQLite location is not documented, so Windows discovery intentionally
uses the JSONL contract without guessing a database path.

Retained stores provide prompts, assistant messages, exact tool calls/results,
CWD, model IDs, and provider timestamps. They do not provide authoritative
token or pricing fields. `response_size` is bytes, not tokens, and predecessor
local usage estimates are not captured. Source deletion is only a tombstone;
it never creates `session_end`. Set
`TRAJECTORY_DISABLE_KIRO_HISTORY_WATCHER=1` for the watcher-specific kill
switch. `KIRO_SESSIONS_DIR` is accepted only as a compatibility discovery
override, not claimed as a Kiro runtime setting.

Kiro supports headless execution with `kiro-cli chat --no-interactive` and
`KIRO_API_KEY`, but Trajectory does not currently have a usable Kiro CI
subscription/API key. Default CI therefore uses fixture replay through the real
serve route plus setup, inventory, doctor, update-refresh, and
auto-instrument tests. A protected live Kiro gate can be added later when
`KIRO_API_KEY` is available.

Kiro 3.0 early-access session storage is explicitly incompatible with stable
2.x storage and remains unclaimed until a real retained fixture is available.
The SQLite schema and platform paths also require a credentialed current-release
run before this feature can graduate from default-off preview.

**Source:** [Kiro CLI hooks](https://kiro.dev/docs/cli/hooks/),
[Kiro CLI MCP](https://kiro.dev/docs/cli/mcp/),
[Kiro CLI session management](https://kiro.dev/docs/cli/chat/session-management/),
[Kiro CLI 3.0 early access](https://kiro.dev/docs/cli/v3/),
[Kiro CLI custom-agent configuration](https://kiro.dev/docs/cli/custom-agents/configuration-reference/),
and prior Amazon Q Developer CLI references in
[amazon/amazon-q-developer-cli](https://github.com/aws/amazon-q-developer-cli).

## Devin CLI

**Trajectory status: Beta preview. Supported contract: Devin CLI public
extensibility docs plus its current local session-store shape.**

Devin instrumentation is preview-gated and disabled by default. Enable it
before setup:

```bash
trajectory features enable devin_cli_instrumentation
trajectory setup --clients devin
```

Setup merges Trajectory-owned wake hooks and `mcpServers.trajectory` into the
platform config (`~/.config/devin/config.json` on macOS/Linux or
`%APPDATA%\devin\config.json` on Windows), and installs the global incognito
skill below that config root. Project-local Devin configuration
in `.devin/config.json` and `.devin/config.local.json` remains project- and
user-owned. While the feature is disabled,
setup does not mutate Devin configuration or install assets, and the runtime
does not reconcile Devin sessions. Managed policy and
`TRAJECTORY_DISABLE_FEATURES` can keep the preview disabled even after a local
enable request.

Devin hook payloads do not expose a stable session identifier. Trajectory
therefore treats `SessionStart`, `UserPromptSubmit`, tool, stop, and
`SessionEnd` hooks only as fail-open wake hints. The authoritative capture path
reconciles active or changed source sessions from:

- macOS: `~/Library/Application Support/devin/cli/sessions.db` and
  `~/Library/Application Support/devin/cli/transcripts/<session-id>.json`
- Linux: `~/.local/share/devin/cli/sessions.db` and
  `~/.local/share/devin/cli/transcripts/<session-id>.json`
- Windows: `%APPDATA%\devin\cli\sessions.db` and
  `%APPDATA%\devin\cli\transcripts\<session-id>.json`

Transcript JSON is preferred; `message_nodes.chat_message` in `sessions.db` is
the fallback when a transcript is unavailable. This source-first design
keeps concurrent source identities separate and never attributes a hook to the
newest session sharing a working directory. It can recover prompts, assistant and thinking
text, tool calls/results, model identity, and per-step prompt, completion, and
cache metrics when Devin records them. Only per-step usage is currently emitted
and materialized; final-only aggregate `Snapshot.Usage` is parsed but remains a
preview gap. If a supported source later exposes native cost, Trajectory
preserves it rather than recomputing it from token totals.

There is no user-invoked bulk historical backfill or import. The preview only
reconciles active or changed sources. Cursor and delivery state survive
restarts, and bounded reconciliation continues across transient source and
fanout failures. A provider rewrite resumes across bounded delivery budgets,
with side-effect-free staging globally limited to eight directories, 256 MiB,
and 24 hours. It atomically rebuilds canonical JSONL, commits prepared live
state, delivery, and publish projections, and queues a bounded local-UI refresh
instead of appending a duplicate full snapshot. A failure after canonical
replacement or a full bounded work queue leaves source progress unacknowledged,
so the idempotent repair retries. Turn and mutation-snapshot work is retained
before acknowledgement and recovered until local ingestion and turn publish
handoff succeed. Durable provider turn identity pairs prompts and Stops across
separate source deltas without scheduling assistant-only history, and monotonic
snapshot generations preserve mutations that arrive during an in-flight local-
UI refresh. Canonical terminal fingerprints
make unchanged completed-source rediscovery a no-op after cursor pruning; a
changed fingerprint triggers a repair. Corrections to finalized sources retain
exactly one terminal event, and rebuilt token/cost observations are excluded
from additive metric replay.
Crash recovery sequence-fences projection and durably pending turn-work side effects. Terminal
intents are provider-snapshot-versioned and cross-process fenced, so corrected
final snapshots cannot be acknowledged by an older worker or finalized
concurrently during watcher handoff. Durable terminal failures retry in-process
with bounded exponential backoff. The bounded cursor keeps at most 8,192
resident plus completed rows and 16 MiB, while indexed retention removes at
most 4,096 expired delivery rows per bounded maintenance pass and keeps
draining on a cadence during long-lived watcher runs. Rows already published
remotely before a provider removes them cannot be retracted from that
destination.

Trajectory redacts session titles, prompt, assistant, thinking, tool input, and
tool response content before writing canonical JSONL or the crash-recovery
ledger. Incognito control also leaves conservative provider evidence: delayed
reconciliation stays private after disable, canonical markers survive mutation
repair, and the auxiliary evidence is removed only after provider terminal work
completes.
If a provider source never proves authoritative terminal completion, that
evidence remains indefinitely as a conservative privacy record. Cursor-store
migration also preserves a v1 recovery backup and writes a fail-closed rollback
guard so an older binary cannot silently replay all visible sources.

The observed source schema does not prove whether a session was interactive or
headless. Trajectory therefore marks source-reconciled Devin sessions
headless/unknown and skips sensitivity classification and segmentation until an
authoritative mode signal exists. A terminal closure may be emitted only when
the reconciler proves a database-message to finalized-transcript transition.
If that transition cannot be proven, terminal closure and final-session metrics
remain an explicit integration gap rather than being inferred from a hook.
Generic shutdown and orphan recovery do not synthesize a Devin terminal because
the provider source is authoritative; crash recovery still finalizes a
provider terminal already present in canonical JSONL. The terminal outbox
preserves cleanup intent until recovery rows are retired. A process exit after
external finalization succeeds but before its durable effect marker can retry
that finalization; destination receipts provide publish deduplication and local
cleanup remains idempotent.

Devin imports Claude hook configuration by default. Trajectory must not disable
that user setting, but it ignores or reattributes imported Trajectory Claude
hooks when `DEVIN_PROJECT_DIR` identifies a Devin process so one action cannot
be recorded as both Claude Code and Devin.

CI uses sanitized current-format `sessions.db` and transcript fixtures,
including the database-only fallback and concurrent-session cases. Devin now
documents `devin --print` as a stable headless mode and a persistent
`credentials.toml` token, but Trajectory does not yet have a dedicated protected
Devin identity or credential-file pilot. There is therefore no protected live
gate yet, and no undocumented `DEVIN_API_KEY` contract is inferred.

**Sources:** [Devin hooks](https://docs.devin.ai/cli/extensibility/hooks/overview),
[lifecycle hooks](https://docs.devin.ai/cli/extensibility/hooks/lifecycle-hooks),
[MCP configuration](https://docs.devin.ai/cli/extensibility/mcp/configuration),
[skills](https://docs.devin.ai/cli/extensibility/skills/overview),
[CLI commands](https://docs.devin.ai/cli/reference/commands),
[Devin authentication](https://docs.devin.ai/cli/enterprise/devin-auth), the
pinned external source adapter at `0dc2402`, and the pinned
[ccusage source-support assessment](https://github.com/ryoppippi/ccusage/blob/997ad7f90189867d9f218aa0e7401586e3b9fde8/docs/guide/source-support-qa.md).

## Qoder CLI

**Trajectory status: Beta preview. No minimum established; Qoder CLI 1.0.43
fixture/artifact shape tested.**

Qoder support is disabled by default:

```bash
trajectory features enable qoder_cli_instrumentation
trajectory setup --clients qoder
```

Setup stages a Trajectory-owned native plugin and uses Qoder's own
`qodercli plugins validate`, `plugins install --scope user`, `plugins list
--json`, and `plugins uninstall --scope user` commands. The plugin supplies
lifecycle wake hooks, `.mcp.json`, an incognito skill, and `/incognito`
command. Disabled or managed-disabled policy performs no plugin mutation.

The provider-owned source is `~/.qoder/projects`, or
`$QODER_CONFIG_DIR/projects`. `QODER_PROJECTS_DIR` is an explicit compatibility
override that points directly at the projects directory. Trajectory does not
silently scan `~/.qoderwork/projects`, which belongs to a separate product.
Main transcripts are `<project>/<session>.jsonl`, metadata sidecars are
`<project>/<session>-session.json`, and subagents are
`<project>/<parent>/subagents/agent-*.jsonl`.

Qoder appends replacement snapshots with the same assistant message ID.
Trajectory retains the last snapshot without double-counting tokens. The
watcher hashes transcript plus sidecar content, rotates full-hash fallback
checks for same-size/same-mtime rewrites, persists a content-free cursor,
emits tombstones, and fully rebuilds Trajectory's derived JSONL when a prior
provider message mutates. It never rewrites Qoder's provider-owned files.

Qoder's semantic IDs use `qoder:<id>` and
`qoder:<parent>:subagent:<agent>`. Trajectory records those as
`provider_session_id` and `provider_parent_session_id`; canonical
`session_id`/`parent_session_id` use the path-safe equivalent with hyphens
because Trajectory session IDs become cross-platform filenames and reject
colons. Raw IDs remain separately recorded.

Native prompt, completion, cache-write, and cache-read tokens are materialized
with native provenance. Qoder does not expose an authoritative interactive
versus headless signal in this store, so watcher sessions use
`is_headless=true` and `source_mode=unknown`; sensitivity and segmentation
remain conservatively skipped. Fixture tests are the current release gate.
A protected live test using `QODER_PERSONAL_ACCESS_TOKEN` is the follow-up; the
token must never be committed or printed.

## ZCode

**Trajectory status: Beta preview. Inspected application: ZCode 3.3.6 with embedded agent 0.15.2.**

ZCode support is disabled by default:

```bash
trajectory features enable zcode_instrumentation
trajectory setup --clients zcode
trajectory backfill --from-zcode  # Optional complete-history repair
```

Setup updates only `~/.zcode/cli/config.json`. It preserves unrelated user
configuration while adding wake-only process hooks, an explicitly owned MCP
server, and a Trajectory-managed incognito skill root. The hooks never become
canonical lifecycle or content authority: they notify `trajectory serve` to
re-read ZCode's provider-owned SQLite rows.

Trajectory follows ZCode's current `~/.zcode/cli/db/db.sqlite` default,
`ZCODE_STORAGE_DIR`, `storage.sessionDbPath`, `ZCODE_SESSION_DB_PATH`, and the
supported `ZCODE_SESSION_DB` alias. Database, WAL, and SHM changes reconcile in
bounded passes. Explicit `backfill --from-zcode` is the complete-history repair
path. Provider mutation replaces only Trajectory-owned derived rows; provider
deletion remains a tombstone and never removes retained local history.

Session, message, and part rows supply identity, relationships, working
directory, prompts, assistant/thinking content, model/provider, and native
tools/results. Current `model_usage` rows are authoritative over legacy message
totals: terminal attempts remain separate `llm_call` events with retry
correlation, while exact input/output/reasoning/cache-create/cache-read counts
roll up to the turn. The database contains no billing amount, so cost is marked
token-derived only when Trajectory has a model rate; unknown prices remain
unavailable.

`session.time_updated` records activity, not completion. Trajectory therefore
does not create `session_end` for an active session; only durable
`time_archived` evidence can close one. The independent usage reference has no
ZCode adapter and supplies no separate token or pricing authority. Current
proof is official-artifact inspection plus fixtures for setup, exact wakeups,
mutation, retry accounting, explicit backfill, canonical JSONL, SQLite, and
local-UI readback. An authenticated real-conversation and incognito pilot is
still pending.

## CommandCode

**Trajectory status: Beta preview. Inspected package contract: 0.44.1.**

```bash
trajectory features enable commandcode_instrumentation
trajectory setup --clients commandcode
```

Setup preserves user configuration while adding Trajectory-owned wake hooks to
`~/.commandcode/settings.json`, a user MCP entry in
`~/.commandcode/mcp.json`, and owned incognito skill/command files. It never
installs a wrapper. Detection accepts `command-code` and `commandcode` on all
platforms, plus the collision-safer `cmdc` alias on Windows, but never the
collision-prone generic `cmd` alias.

Trajectory reads
`~/.commandcode/projects/<project>/<session>.jsonl` and the optional
`<session>.meta.json` sidecar. Current CommandCode saves rewrite the complete
transcript atomically, regenerate provider message IDs, and may regenerate
timestamps in headless runs. The reconciler uses ordered semantic content and
tool-call IDs, persists a content-free cursor, bounds recursive discovery, and
rebuilds only Trajectory's derived session if an already emitted prefix
changes. Checkpoint, prompt, share, and file-history sidecars are excluded.

Native `SessionStart`, `PreToolUse`, `PostToolUse`, and `Stop` hooks are
wake hints for an exact transcript scan. They provide exact CWD when present
and native Stop proves a turn boundary, but hook presence alone does not prove
interactive mode. Bounded polling remains the correctness path for missed
hooks and transcript-only sessions, which stay conservatively headless/unknown.

Prompt, assistant, reasoning, and native tool/result content are captured. The
provider source has no authoritative terminal SessionEnd and does not reliably
persist native model, token, or cost data; Trajectory does not infer them. Downstream
text-based estimates, when produced, retain estimated provenance. ccusage has
no CommandCode adapter, so it is used only as a negative cross-check for usage
authority.

Sanitized 0.44.1 fixtures plus canonical JSONL and Lapdog list/trace/fetch
readback are the current release gate. A live authenticated CLI pilot is still
required to validate hook timing, interactive incognito UX, and future schema
drift.

## Kimi Code CLI

**Trajectory status: Beta preview. Supported contract: current Kimi Code
source and hook schemas, cross-checked against a pinned external parser.**

```bash
trajectory features enable kimi_cli_instrumentation
trajectory setup --clients kimi
```

Setup owns a marked `[[hooks]]` block in
`$KIMI_CODE_HOME/config.toml` (default `~/.kimi-code/config.toml`), only the
`mcpServers.trajectory` entry in `mcp.json`, and the user incognito skill.
Hooks cover lifecycle/prompt/stop/subagent wakeups but remain hints; provider
files are authoritative.

Current sessions use
`sessions/<work-dir-key>/<provider-session-id>/agents/main/` and sibling child
agent directories. Canonical IDs remain path-safe while exact semantic IDs
(`kimi:<provider-id>`) and parent/tool linkage are retained as provenance.
The composite fingerprint covers wire, context, session state, the matching
row from top-level `session_index.jsonl`, and agent
metadata. It detects same-stat content rewrites, persists cursors, bounds
discovery/change fanout, and tombstones disappeared sources. Legacy
`KIMI_SHARE_DIR`/`~/.kimi` records are compatibility inputs and deduplicate
behind current `KIMI_CODE_HOME`; explicit `KIMI_DIR` is searched first.

Trajectory parses current metadata/config/turn/context step/tool/usage records
and legacy nested Wire records. It preserves thinking, model, tool/result,
stop reason, and native input/output/cache-read/cache-create tokens. Cost is
computed downstream and labeled computed; it is never presented as native
vendor billing. The external parser supplied useful record coverage but its
wire-only and older layout assumptions are not copied.

Unknown invocation mode is conservatively headless, so sensitivity scanning
and segmentation skip rather than infer an interactive privacy posture.
Incognito requires exact session selection when concurrent main/child sessions
share a workspace. Default CI uses sanitized current and legacy fixtures plus
actual local-ui/Lapdog list, trace, fetch, and scalar readback. Protected live
CI is follow-up work using `KIMI_MODEL_NAME` and `API_KEY` with a read-only
prompt and the existing secret-safe environment path.

**Sources:** [Kimi Code CLI](https://github.com/MoonshotAI/kimi-cli),
[Kimi hooks](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html),
[data locations](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/data-locations.html),
and the pinned external Kimi adapter at `0dc2402`.

## gptme

**Trajectory status: Beta preview. Minimum supported: 0.32.0 live-replayed;
0.32.1 source checked.**

```bash
trajectory features enable gptme_instrumentation
trajectory setup --clients gptme
```

Setup uses gptme 0.32's actual user-config consumer path,
`~/.config/gptme/config.toml`, on every OS. It installs the
`trajectory_gptme` folder plugin under `~/.config/gptme/plugins`, enables MCP,
and registers the native `/incognito` command. Setup preserves unrelated TOML,
preflights higher-priority local/project overrides, and refuses to replace an
unowned plugin directory or `trajectory` MCP entry.

Hooks carry identity, invocation mode when authoritative, lifecycle, and tool
wake metadata only. The durable `conversation.jsonl`, `events.jsonl`, and
`config.toml` files own content, model, thinking, tool arguments/results,
tokens, and cost. The composite watcher supports partial-write recovery,
edit/undo replay, same-stat rewrites, replacement, tombstones, and bounded
cold-start reconciliation of existing sessions without duplicating hook facts.

`GPTME_LOGS_HOME` is authoritative when set. Otherwise Trajectory follows
gptme's XDG data root, existing legacy `~/.local/share/gptme/logs`, and
platform data root such as `~/Library/Application Support/gptme/logs` on
macOS. The pinned comparison source uses `GPTME_DIR`; current gptme 0.32 does
not, so Trajectory does not copy that stale override into runtime behavior.

Native per-message input, output, cache-read, and cache-creation usage is
preserved and aggregated across all provider calls in the user turn. Recorded
cost remains labeled computed. Naive local timestamps retain explicit
timezone-unknown provenance.

`--non-interactive` is explicitly headless. Other modes remain
headless/unknown until gptme provides an authoritative interactive signal, so
sensitivity and segmentation skip rather than infer. Default CI installs real
gptme 0.32.0 and runs its credential-free `mock/echo` provider, requiring a
plugin-sourced terminal `SessionEnd`; fixture coverage separately proves
positive non-headless sensitivity/segmentation and full Lapdog list, trace,
fetch, and scalar readback. Native gptme OTLP remains disabled until
hook/store/OTLP deduplication is proven.

**Source:** [gptme](https://github.com/gptme/gptme)

## ForgeCode

**Trajectory status: Beta passive-history preview. No minimum established;
2.13.18 source contract inspected.**

```bash
trajectory features enable forgecode_instrumentation
trajectory setup --clients forgecode
```

Trajectory opens ForgeCode's provider-owned `.forge.db` in read-only mode and
watches the database, WAL, and SHM files. `FORGE_CONFIG` is authoritative when
set; otherwise an existing legacy `~/forge` root wins, falling back to the
current `~/.forge` root. The `forge` and `forge-code` setup aliases normalize
to `forgecode`, but PATH detection requires the product-specific read-only
`forge config path` signature. A different product that happens to install a
binary named `forge` is not claimed.

Each conversation row has a stable provider ID and a JSON context containing
system, user, assistant, reasoning, image, tool-call, tool-result, model, usage,
and child-conversation facts. Trajectory preserves failed tool results and the
provider-owned child relationship. Actual token counts materialize as native
usage; approximate and mixed counts remain explicitly estimated. Recorded cost
keeps provider-reported provenance instead of being presented as a downstream
estimate.

ForgeCode context messages do not carry native timestamps. Trajectory derives
deterministic ordering from the conversation's `created_at` value plus message
position and labels every derived message timestamp as synthetic. The watcher
uses bounded discovery and changed-path fanout, hashes content to catch
same-size and same-timestamp rewrites, and rebuilds derived JSONL after mutation.
A deleted row produces a source tombstone only: the local archive is preserved
and no `session_end` is invented.

Setup installs only an owned `trajectory` MCP entry, an owned incognito skill,
and an owned `/incognito` command beneath the active ForgeCode root. Because
passive history cannot identify the currently open conversation, the workflow
requires an exact `forgecode-...` ID selected from `trajectory status --json`;
it never guesses by workspace or recency. Uninstall removes only the owned
entries.

Because the provider store has no authoritative interactive/headless signal,
Trajectory conservatively marks these passive sessions headless for
privacy-derived feature gating. Sensitivity scanning and segmentation skip rather than
mistaking missing mode data for proof of an interactive session.

The release gate materializes a sanitized current-schema context into a real
WAL-mode SQLite database and proves parser, watcher, setup, marker, and Lapdog
list/trace/fetch/scalar behavior. A live ForgeCode persistence and
model-mediated incognito pilot remains follow-up work. The ccusage adapter
census has no ForgeCode adapter, so it is retained as a negative cross-check,
not used to justify token or cost fields.

**Sources:** [ForgeCode](https://forgecode.dev/),
[ForgeCode source](https://github.com/tailcallhq/forgecode), and
[ForgeCode piping guide](https://forgecode.dev/docs/piping-guide/)

## Warp/Oz CLI

**Trajectory status: Beta preview. Supported contract: local Warp Desktop and
local Oz CLI provider stores. `oz agent run-cloud` is explicitly excluded.**

Enable the default-off integration and register its owned assets:

```bash
trajectory features enable warp_oz_instrumentation
trajectory setup --clients warp
```

Setup merges only `mcpServers.trajectory` into `~/.warp/.mcp.json` and writes
`~/.warp/skills/trajectory-incognito/SKILL.md`. Both entries carry Trajectory
ownership markers. Setup refuses an unowned collision and uninstall removes
only owned data.

The runtime opens `warp.sqlite` read-only and watches the database, WAL, and
SHM files across stable, preview, legacy, and `tui` roots. This includes Warp
Desktop and local `oz agent run` state on macOS, Linux, and Windows, plus an
explicit `WARP_DIR` override. A logical session is keyed by the canonical
database container and conversation ID, preventing collisions when the same
provider ID exists in multiple channels or roots.

Rich capture decodes `agent_tasks.task` with the pinned public module
`github.com/warpdotdev/warp-proto-apis/apis/multi_agent` at commit
`248f5f62663e`. It preserves user and assistant text, reasoning, native tool
calls/results, model selection, working directory, and Warp task parentage.
Child tasks become canonical subagent lifecycle and `agent_id` relationships;
they are not flattened into the parent stream. `ai_queries` is a conservative
prompt-only fallback when no rich task row can be decoded.

Trajectory wire-counts task messages before protobuf construction and decodes
at most 4,096 messages per logical session. A larger cumulative history remains
provider-owned and produces a metadata-only incomplete-source diagnostic; it
is not partially materialized. This prevents a long-running Warp conversation
from causing a proportional CPU or memory spike in `trajectory serve`.
Concurrent reconciliation admits at most 65,536 retained message identities in
one pass, which caps a worst-case batch at 16 full 4,096-message sessions.
Known pending sessions drain in bounded, spaced passes instead of accumulating
one monolithic multi-agent snapshot.

Protobuf decode failures emit `warp.source.protobuf_decode_incomplete` with the
schema pin and selected fallback. They are never silently ignored. Aggregate
conversation usage is retained only as diagnostic source metadata with native
aggregate provenance. It is not materialized into Lapdog token scalars or
published token fields. Trajectory does not relabel it as output tokens, invent
an input/output split, or infer native cost.

The current store does not prove terminal closure or interactive versus
headless mode. Trajectory therefore does not synthesize `session_end`, and
marks reconciled sessions headless/unknown so sensitivity and segmentation
skip them. Fixture coverage proves SQLite/protobuf decoding, stable identities,
WAL fanout, tombstones, same-stat rewrites, task hierarchy through JSONL and
Lapdog list/trace/fetch, the scalar non-claim for diagnostic aggregate usage,
setup ownership, feature precedence, inventory, and auto-instrument gating.
Cursor commits provide at-least-once replay with stable delivery IDs; a crash
replays the exact prepared message prefix before a newer provider append is
processed. JSONL handler side effects are not exactly once and may repeat after
a process crash. Discovery reads bounded primary-key slices without aggregating
the task or query corpus, combines roots before the global 512-source admission
limit, and uses indexed existence checks before declaring an out-of-view known
source deleted. Older conversations outside that bounded view are monitored
only after they re-enter it.
Follow-up live proof is required for local authenticated `oz agent run`, a
supported closure signal, and incognito UX. Cloud runs remain outside the
supported contract.

**Sources:** Warp source commit `3e3711ce`, public Warp protobuf commit
`248f5f62663e`, and the pinned external Warp adapter at commit `0dc2402`.

## VS Code Copilot Chat

**Trajectory status: Beta fixture preview.** This integration is distinct from
the existing `copilot` CLI client. Enable it explicitly:

```bash
trajectory features enable vscode_copilot_instrumentation
trajectory setup --clients vscode-copilot
```

Setup changes only user-scoped VS Code state and records ownership before doing
so. It enables the `otlp-http` exporter at `http://127.0.0.1:19222`, explicitly
keeps `github.copilot.chat.otel.captureContent` false, adds the Trajectory MCP
server to `User/mcp.json`, and installs an incognito prompt. Existing conflicting
user values are never overwritten; uninstall removes only values and assets
owned by Trajectory. Managed feature disable and `TRAJECTORY_DISABLE_FEATURES`
take precedence over a local enable.

Passive capture discovers Code, Code - Insiders, and VSCodium
`User/workspaceStorage/*/chatSessions`, plus
`globalStorage/emptyWindowChatSessions` and `transferredChatSessions`.
`VSCODE_COPILOT_DIR` may point directly to a fixture or managed `User`
directory. When both formats exist, the JSONL operation log is authoritative
over the JSON fallback. Workspace manifests participate in source fingerprints.

Native OTel is accepted only when a root span has
`service.name=copilot-chat`, `gen_ai.operation.name=invoke_agent`,
`gen_ai.provider.name=github`, a nonempty `gen_ai.agent.name`, and the
Copilot-owned `copilot_chat.session_id`, with no parent Copilot chat-session
attribute. The agent name is intentionally dynamic because current top-level
modes and participants set their own names. Nested subagent container spans
cannot replace or duplicate the accepted root identity; their child facts
remain on the parent trace until a relationship-safe native subagent model is
available. Standalone CLI and unrelated third-party spans that lack the
complete tuple remain owned by their existing clients. Correlation spans
multiple export batches, state is TTL/cap bounded, and durable source-event
checks make replay restart-idempotent. Accepted `invoke_agent`, `chat`,
`execute_tool`, and `execute_hook` spans are materialized; missing content is
never inferred when provider content capture is off.

Native lifecycle, tool, and token facts take precedence while provider history
continues to supply text. Late native delivery promotes only the matching token
or tool facts, and the native append plus provider-history replacement is one
locked atomic write. Split delivery therefore cannot erase provider usage or a
tool before its corresponding native evidence is durable. Restart fixtures
prove stable sequence ordering and idempotence, and local-UI list, trace, fetch,
and scalar readback prove the exact 16-token fixture total without duplicate
provider usage.

Fixture tests cover discovery, JSONL replay, identity, dynamic first-party
top-level agent names, nested-container isolation, attribution exclusions,
split/out-of-order batches, repeat delivery, multi-turn counters, eviction,
setup ownership, late native fault
recovery, and passive/native precedence. The current first-party source was
audited at `5863f5a`; ccusage has no VS Code Copilot adapter and therefore adds
no independent usage authority. A real Electron/UI OTel smoke and an
interactive incognito-session correlation smoke remain required before
promotion beyond fixture preview.

**Sources:** [VS Code monitoring agents](https://code.visualstudio.com/docs/agents/guides/monitoring-agents),
[VS Code MCP configuration](https://code.visualstudio.com/docs/agents/reference/mcp-configuration),
[VS Code prompt files](https://code.visualstudio.com/docs/agent-customization/prompt-files),
and the pinned external VS Code Copilot adapter at `0dc2402`.

## Windsurf

**Trajectory status: Beta preview. Integration class: hybrid.**

```bash
trajectory features enable windsurf_instrumentation
trajectory setup --clients windsurf
```

Setup merges Trajectory-owned entries into Windsurf's official user hook file
at `~/.codeium/windsurf/hooks.json`, MCP file at
`~/.codeium/windsurf/mcp_config.json`, and global `/incognito` workflow at
`~/.codeium/windsurf/global_workflows/incognito.md`. It preserves unrelated
entries and uninstall removes only ownership-marked Trajectory entries.

The authoritative source is Windsurf's
`post_cascade_response_with_transcript` hook and
`~/.windsurf/transcripts/{trajectory_id}.jsonl`. Trajectory mirrors the
provider's newest-100 retention bound and derives only prompts, assistant
responses, lifecycle status, model, execution ID, and timestamp when those
fields are actually present. It does not turn transcript code actions into
tool calls because the public schema does not establish that equivalence.

For older conversations only, Trajectory checks stable and Next Windsurf
`User/workspaceStorage/*/state.vscdb` files. This fallback queries only
`workbench.panel.aichat.view.aichat.chatdata` and `aiChat.chatdata`; it never
copies arbitrary `ItemTable` values. DB history emits prompt and assistant
text only-no invented timestamp, model, tool, token, or cost claims. Native
transcripts win when both sources identify the same trajectory. Freshness
combines DB, WAL, SHM, and workspace metadata; logical session identities are
`<db>#<session-id>`, with bounded changed-source fanout, durable cursors, and
explicit tombstones.

The native transcript hook triggers an immediate exact-path scan. A bounded
poll loop provides repair when hook delivery is missed; this preview does not
install a recursive filesystem watcher.

Fixture replay is the preview release gate because Windsurf is an interactive
IDE without a supported headless-auth CI contract. Real UI confirmation of
hook delivery/transcript schema, legacy DB schema variants, clean SessionEnd
semantics, and `/incognito` invocation remains a live pilot. Transcript
eviction is not treated as a clean session end.

Sources: [Cascade hooks](https://docs.windsurf.com/windsurf/cascade/hooks),
[MCP](https://docs.windsurf.com/windsurf/cascade/mcp), and
[Workflows](https://docs.windsurf.com/windsurf/cascade/workflows).

## Zed

**Trajectory status: Beta passive-history preview. No minimum established;
Zed 1.11.3 source shape inspected.**

```bash
trajectory features enable zed_passive_history
trajectory setup --clients zed
```

Trajectory reconciles `threads/threads.db` read-only beneath Zed's data
directory: `~/Library/Application Support/Zed` on macOS,
`$XDG_DATA_HOME/zed` or `~/.local/share/zed` on Linux,
`%LOCALAPPDATA%\Zed` on Windows, or the explicit `ZED_DIR`. SQLite WAL and SHM
changes participate in bounded reconciliation, with a durable content-free
cursor, tombstones, and polling fallback for missed filesystem notifications.

Each database row is a logical session. JSON and zstd payloads recover prompt,
assistant, thinking, tools/results, model, and CWD. Native
`request_token_usage` components are retained as a session aggregate but are
never assigned or materialized to an assistant message or turn; raw JSONL keeps
them under explicitly scoped `provider_session_usage` session-start metadata.
Zed rows do not carry per-message timestamps, so derived ordering timestamps
are explicitly labeled `provider_timestamp_present=false` and
`timestamp_provenance=derived_order`; only row created/updated times are
provider-native. Exact `zed:<id>` provider identities are retained alongside
path-safe `zed-<id>` Trajectory identities. Unlike the reference discovery
query, Trajectory does not discard rows with `parent_id`: those rows are real
subagent sessions and retain parent identities plus `relationship=subagent`.

Setup owns only `context_servers.trajectory` in Zed's `settings.json` and the
global `~/.agents/skills/trajectory-incognito/SKILL.md`. User-owned collisions
are refused and uninstall removes only owned entries. This integration claims
no lifecycle hooks, launch interception, native OTel, terminal closure, or bulk
historical import. Fixture and local-UI list/trace/fetch/scalar coverage are the
current release gate. Because the store does not prove interactive versus
headless mode, passive sessions are conservatively headless/unknown and skip
sensitivity classification and segmentation. Live Zed UI/database-schema,
incognito UX, and cross-platform root validation remain follow-ups.

**Sources:** [Zed Agent configuration](https://zed.dev/docs/assistant/configuration),
[MCP servers](https://zed.dev/docs/ai/mcp),
[agent skills](https://zed.dev/docs/ai/skills), and the pinned external Zed
adapter at `0dc2402`.

## Version Check

To verify an installed client version when the upstream CLI exposes one:

```bash
claude --version          # Claude Code
codex --version           # Codex CLI
copilot version           # GitHub Copilot CLI
gemini --version          # Gemini CLI
agy --version             # Antigravity CLI
goose --version           # Goose
cline --version           # Cline CLI
cursor --version          # Cursor (desktop) / cursor-agent --version (CLI)
droid --version           # Factory Droid
hermes --version          # Hermes Agent
amp --version             # Amp Code
qwen --version            # Qwen Code
openhands --version       # OpenHands CLI
aider --version           # Aider
cn --version              # Continue CLI
codebuff --version        # Codebuff
pi --version              # Pi
opencode version          # OpenCode
kilo --version            # Kilo Code
kiro-cli --version        # Kiro CLI
```
