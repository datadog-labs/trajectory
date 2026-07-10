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
trajectory user-guide clients/codebuff
trajectory user-guide clients/kilo
trajectory user-guide clients/kiro
```

## Quick Reference

Trajectory status describes this repository's release posture for the
integration. Supported CLI version describes the upstream client version or
contract Trajectory currently targets; beta status is not a minimum version.

| Client | Setup integration | Trajectory status | Supported CLI version | Hook mechanism | Relay or native telemetry |
|--------|-------------------|-------------------|-----------------------|----------------|---------------------------|
| Claude Code | `trajectory setup --clients cc` | Supported | 2.0+ | HTTP hooks + MCP | Claude native OTLP can be relayed through Trajectory |
| Codex CLI | `trajectory setup --clients codex` | Supported | 0.128.0+ | Command hooks (primary) + rollout watcher (fallback) | Responses proxy spans and watcher backfill |
| GitHub Copilot CLI | `trajectory setup --clients copilot` | Beta | Public plugin hook contract; no stable minimum pinned | Copilot plugin command hooks + MCP | Plugin command capture only |
| Gemini CLI | `trajectory setup --clients gemini` | Supported | 0.30.0+ | Managed command hooks + MCP | Hook payload token/cost fields |
| Antigravity CLI (`agy`) | `trajectory setup --clients agy` | Supported | 1.0.0+ | Antigravity plugin command hooks + MCP | Gemini-compatible hook payloads |
| Goose | `trajectory setup --clients goose` | Beta | 1.39.0 tested | Open Plugins command hooks | Open Plugins capture; provider-call detail depends on client payloads |
| Cline CLI | `trajectory setup --clients cline` | Beta | 3.0.34 tested | File hooks + MCP | File-hook capture; current hooks omit token/cost usage |
| Cursor Desktop | `trajectory setup --clients cursor` | Supported | 1.0+ | Command hooks that POST to capture | Cursor DB and watcher readback |
| cursor-agent CLI | Automatic when `cursor-agent` is on PATH | Beta | Current CLI tested; no stable minimum pinned | Transcript watcher | Transcript watcher only |
| Factory Droid | `trajectory setup --clients droid` | Beta | Public plugin hook contract; no stable minimum pinned | Factory plugin command hooks + MCP | Plugin command capture only |
| Hermes Agent | `trajectory setup --clients hermes` | Beta | Public observer-hook contract; no stable minimum pinned | Observer plugin hooks + MCP | Observer usage payloads when present |
| Amp Code | `trajectory setup --clients amp` | Beta | Current plugin API inspected; no stable minimum pinned | System TypeScript plugin events + MCP | Plugin events; token/cost usage depends on Amp payloads |
| Qwen Code | `trajectory setup --clients qwen` | Beta | 0.19.2 tested | Native HTTP hooks + MCP | Native hooks with usage metadata when present |
| OpenHands | `trajectory setup --clients openhands` | Beta | V1 CLI tested | Command hooks + MCP | Command-hook capture; current hooks omit token/assistant payloads |
| Aider | `trajectory setup --clients aider --install-client-shims` | Beta | Current CLI tested | Opt-in command shim + analytics/history sidecar | Usage/cost from Aider analytics logs |
| Continue CLI | `trajectory setup --clients continue --install-client-shims` | Beta | 1.5.47 tested | Opt-in `cn` command shim + session JSON readback | Usage/cost from Continue session history when present |
| Mistral Vibe | `trajectory setup --clients mistral-vibe --install-client-shims` | Beta | 2.18.3 inspected | Opt-in `vibe` command shim + native `before_tool`/`after_tool` hooks | Usage/cost from Vibe session metadata when present |
| Codebuff | `trajectory setup --clients codebuff --install-client-shims` | Beta | 1.0.682 inspected | Opt-in command shims + chat-history importer | Usage from Codebuff `chat-messages.json` |
| Pi | `trajectory setup --clients pi` | Supported | Current CLI tested | TypeScript extension + MCP | Extension events with provider-call usage |
| OpenCode | `trajectory setup --clients opencode` | Supported | Current CLI tested | Plugin SDK events + MCP | Plugin SDK events plus SQLite backfill |
| Kilo Code | `trajectory setup --clients kilo` | Beta | Current CLI tested | Plugin SDK events + MCP | Plugin SDK events; native OTLP traces/logs can be pointed at the Trajectory OTLP relay |
| Kiro CLI | `trajectory setup --clients kiro` | Beta | Public command-hook contract; no stable minimum pinned | Agent command hooks + MCP | Fixture-tested command hooks; no usage metadata in current hook payloads |

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
| GitHub Copilot CLI | Beta, Copilot plugin command hooks | Command-level lifecycle, prompt, tool, and session events | Not exposed by current hook payloads | Not yet | Not yet |
| Gemini CLI | Yes, managed command hooks | Yes | Yes | Gemini transcript backfill | Yes |
| Antigravity CLI (`agy`) | Yes, plugin command hooks | Yes, via Gemini-compatible hook schema | Yes, via Gemini-compatible token fields | Not yet | No setup-managed resume |
| Goose | Yes, Open Plugins command hooks | Session, prompt, tool, shell/file, and assistant-message hooks | Usage detail depends on provider payloads; SQLite usage readback is a future backfill path | Not yet | No setup-managed resume |
| Cline CLI | Yes, file hooks | Lifecycle, prompt, tool, assistant-message, turn, and session-end events | Not exposed by current hook payloads; `turn_end.tokens_status=unavailable` | Not yet | No setup-managed resume |
| Cursor Desktop | Yes, command hooks | Yes | Cursor DB dependent | Cursor chat backfill | Yes |
| cursor-agent CLI | Yes, transcript watcher | Tool and turn events | Not exposed by current transcripts | Same transcript source | No setup-managed resume |
| Factory Droid | Beta, Factory plugin command hooks | Documented lifecycle, prompt, tool, notification, compaction, stop, and subagent-stop events | Not exposed by current documented hook payloads | Not yet | Not yet |
| Hermes Agent | Yes, observer plugin hooks | Yes | Yes, from observer `usage` payloads when present | State DB backfill reference only; not implemented in Trajectory yet | No setup-managed resume |
| Amp Code | Yes, setup-managed system plugin | Yes | Yes when Amp plugin events or thread messages expose usage | Thread JSON backfill reference only; not implemented in Trajectory yet | No setup-managed resume |
| Qwen Code | Yes, native HTTP hooks | Yes | Yes, from Qwen `usageMetadata` and transcript fallback | Chat JSONL backfill reference only; not implemented in Trajectory yet | No setup-managed resume |
| OpenHands | Yes, command hooks | Lifecycle, prompt, and tool events | Not exposed by command hook payloads; `turn_end.tokens_status=unavailable` | Not yet | No setup-managed resume |
| Aider | Yes, opt-in command shim | Lifecycle, prompt, assistant-message, and turn events | Yes, from Aider `--analytics-log`; assistant text from `--llm-history-file` | Not yet | No setup-managed resume |
| Continue CLI | Yes, opt-in `cn` command shim | Lifecycle, prompt, assistant-message, and turn events | Yes, from Continue session JSON when usage metadata is present | Not yet | No setup-managed resume |
| Mistral Vibe | Yes, opt-in `vibe` command shim plus native tool hooks | Lifecycle, prompt, tool, assistant-message, and turn events | Yes, from Vibe session metadata when session logging is enabled | Not yet | No setup-managed resume |
| Codebuff | Yes, opt-in command shims and post-run chat-history import | Lifecycle, prompt, assistant-message, and turn events | Yes, from `~/.config/manicode*/projects/*/chats/*/chat-messages.json` usage metadata | Codebuff chat history backfill | No setup-managed resume |
| Pi | Yes, TypeScript extension | Yes | Yes | Pi/OMP session backfill | Yes |
| OpenCode | Yes, plugin SDK events | Yes | Yes | SQLite backfill | Yes |
| Kilo Code | Yes, plugin SDK events | Yes | Native OTLP traces/logs plus SDK payloads when exposed | Not yet | No setup-managed resume |
| Kiro CLI | Yes, agent command hooks | Prompt, tool, and assistant-response events | Not exposed by current documented hook payloads | Not yet | No setup-managed resume |

### Privacy And Derived Features

| Client | Incognito UX | MCP incognito tool | Sensitivity scanning | Segmentation | Coverage note |
|--------|--------------|--------------------|----------------------|--------------|---------------|
| Claude Code | `/trajectory:incognito` command and incognito skill | Yes | Non-headless eligible; headless skipped | Non-headless eligible; headless skipped | First-class incognito UX |
| Codex CLI | Incognito skill with bundled script fallback | Yes | Non-headless eligible; headless skipped | Non-headless eligible; headless skipped | First-class incognito UX |
| GitHub Copilot CLI | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions eligible; headless skipped | Non-headless plugin sessions eligible; headless skipped | Plugin sessions can toggle incognito |
| Gemini CLI | `/incognito` command and incognito skill | Yes | Non-headless hook sessions eligible; headless skipped | Non-headless hook sessions eligible; headless skipped | First-class incognito UX |
| Antigravity CLI (`agy`) | `/incognito` command and incognito skill | Yes | Non-headless hook sessions eligible; headless skipped | Non-headless hook sessions eligible; headless skipped | Incognito skill and command installed by setup |
| Goose | Setup-managed `goose-incognito` command | No | Non-headless Open Plugins sessions eligible; headless skipped | Non-headless Open Plugins sessions eligible; headless skipped | Command-based incognito toggle |
| Cline CLI | Setup-managed `cline-incognito` command plus MCP request path | Yes | Non-headless file-hook sessions eligible; headless skipped | Non-headless file-hook sessions eligible; headless skipped | Command and MCP incognito paths |
| Cursor Desktop | Incognito skill, using Claude skill when available or native Cursor fallback; setup also installs `cursor-agent-incognito` | Yes | Non-headless GUI sessions eligible; headless skipped | Non-headless GUI sessions eligible; headless skipped | GUI sessions use skill-based incognito |
| cursor-agent CLI | Setup-managed `cursor-agent-incognito` command when the Cursor integration is installed; watcher has no native slash surface | No | Transcript-watcher sessions are treated as headless and skipped | Transcript-watcher sessions are treated as headless and skipped | Headless transcript watcher path |
| Factory Droid | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions eligible; headless skipped | Non-headless plugin sessions eligible; headless skipped | Plugin sessions can toggle incognito |
| Hermes Agent | Incognito skill | Yes | Non-headless observer sessions eligible; headless skipped | Non-headless observer sessions eligible; headless skipped | Observer sessions can toggle incognito |
| Amp Code | Setup-managed `amp-incognito` command plus MCP request path | Yes | Non-headless Amp plugin sessions eligible; headless skipped | Non-headless Amp plugin sessions eligible; headless skipped | Command and MCP incognito paths |
| Qwen Code | `/incognito` command and incognito skill | Yes | Non-headless Qwen hook sessions eligible; headless skipped | Non-headless Qwen hook sessions eligible; headless skipped | Incognito skill and command installed by setup |
| OpenHands | Setup-managed `openhands-incognito` command plus MCP request path | Yes | Non-headless command-hook sessions eligible; headless skipped | Non-headless command-hook sessions eligible; headless skipped | Command and MCP incognito paths |
| Aider | Setup-managed `aider-incognito` command | No | Wrapper sessions eligible when non-headless; headless skipped | Wrapper sessions eligible when non-headless; headless skipped | Wrapper sessions can use command incognito |
| Continue CLI | Setup-managed `continue-incognito` command | No | Wrapper sessions eligible when non-headless; headless skipped | Wrapper sessions eligible when non-headless; headless skipped | Wrapper sessions can use command incognito |
| Mistral Vibe | Setup-managed `vibe-incognito` and `mistral-vibe-incognito` commands | No | Wrapper/native sessions eligible when non-headless; headless skipped | Wrapper/native sessions eligible when non-headless; headless skipped | Wrapper sessions can use command incognito |
| Codebuff | Setup-managed `codebuff-incognito` and `cb-incognito` commands | No | Wrapper/imported sessions eligible when non-headless; headless skipped | Wrapper/imported sessions eligible when non-headless; headless skipped | Wrapper/imported sessions can use command incognito |
| Pi | Native `trajectory_incognito` tool plus MCP | Yes | Non-headless extension sessions eligible; extension-supplied verdicts accepted; headless skipped | Non-headless extension sessions eligible; headless skipped | Native extension incognito tool |
| OpenCode | Incognito skill | Yes | Non-headless plugin SDK sessions eligible; headless skipped | Non-headless plugin SDK sessions eligible; headless skipped | Plugin SDK sessions can toggle incognito |
| Kilo Code | Incognito skill | Yes | Non-headless plugin SDK sessions eligible; headless skipped | Non-headless plugin SDK sessions eligible; headless skipped | Plugin SDK sessions can toggle incognito |
| Kiro CLI | Setup-managed `kiro-incognito` command plus MCP request path | Yes | Prompt/tool hook capture eligible when non-headless; headless skipped | Segmentation depends on a terminal session-end signal | Command and MCP incognito paths |

For local cost readback and supported-agent fidelity checks, run
`trajectory cost`, `trajectory cost inspect --session <id>`, and
`trajectory cost validate`. The validation command reports recent cost coverage
for Claude Code, Codex, Gemini, Antigravity, Pi, OpenCode, Kilo Code, Cursor,
Hermes Agent, Amp Code, Qwen Code, and Mistral Vibe, including token-positive
turns that recorded zero cost.

## Hermes Agent

**Trajectory status: Beta. Supported contract: public Hermes observer-hook contract.**

Install with setup:

```bash
trajectory setup --clients hermes
```

Setup writes `~/.hermes/plugins/trajectory/plugin.yaml`,
`~/.hermes/plugins/trajectory/__init__.py`, merges `plugins.enabled:
[trajectory]` and `mcp_servers.trajectory` into `~/.hermes/config.yaml`, and
installs an incognito skill under `~/.hermes/skills/incognito/SKILL.md`.

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

Historical import is not implemented yet. `ccusage` proves the usable Hermes
state surface is `~/.hermes/state.db`, including per-session token and cost
columns, but this Trajectory onboarding is scoped to live observer capture,
setup/verify/uninstall, inventory, and auto-instrument support.

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
records `client_source=amp`. The plugin is fail-open and does not return
allow/reject/modify decisions from `tool.call`.

Amp supports headless execution with `amp --execute` and `AMP_API_KEY`.
Trajectory captures plugin events when they are emitted; token and cost usage
depend on the fields Amp exposes in those plugin or thread payloads.

Historical import is not implemented yet. `ccusage` proves the usable history
surface is `~/.local/share/amp/threads/**/*.json`, with usage ledger events and
assistant-message usage fields that can supply tokens and credits.

## Qwen Code

**Trajectory status: Beta. Supported CLI version: 0.19.2 tested.**

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
If the stop hook payload does not include token usage, Trajectory falls back to
the Qwen chat JSONL transcript path.

Historical import is not implemented yet. `ccusage` proves the usable Qwen
history surface is `~/.qwen/projects/*/chats/*.jsonl` with Gemini-style
`usageMetadata`, but this onboarding is scoped to live hook capture and setup
support.

## OpenHands

**Trajectory status: Beta. Supported CLI version: V1 CLI tested.**

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
`tokens_status=unavailable`.

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

**Trajectory status: Beta. Supported CLI version: current CLI tested.**

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

Aider does not expose a stable native hook, plugin, or OTLP surface for
per-tool events today, so Trajectory does not synthesize file-edit/tool rows
from transcripts. Non-interactive validation can run `aider --message` with the
provider credentials configured for Aider.

**Source:** [Aider](https://github.com/Aider-AI/aider), [Aider CLI options](https://aider.chat/docs/config/options.html)

## Continue CLI

**Trajectory status: Beta. Supported CLI version: 1.5.47 tested.**

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

The shim posts `SessionStart`, `UserPromptSubmit`, `AgentMessage`,
`TurnEnd`, and `SessionEnd` to `/capture/continue/<Event>` with
`client_source=continue`. After the real `cn` exits, Trajectory reads the
Continue session file from `$CONTINUE_GLOBAL_DIR/sessions` or
`~/.continue/sessions` and derives prompt text, assistant text, model, tokens,
and cost from the session history when those fields are present.

Continue's source tree includes a Claude-compatible hook implementation that
reads `.continue/settings.json` and `.claude/settings.json`, but the current
1.5.47 CLI release does not call that hook dispatcher from the chat path.
Trajectory therefore uses the shim/session-file path today and suppresses
Claude-compatible hook subprocess capture while the shim is active to avoid
future double-capture if Continue wires those hooks later.

Non-interactive validation can run `cn -p` with the provider credentials
configured for Continue. Setup, wrapper parsing, and session-file ingestion are
the core Trajectory surfaces for this integration.

**Source:** [Continue](https://github.com/continuedev/continue), [Continue CLI docs](https://docs.continue.dev/cli/overview)

## Mistral Vibe

**Trajectory status: Beta. Supported CLI version: 2.18.3 inspected.**

Install with setup:

```bash
trajectory setup --clients mistral-vibe --install-client-shims
```

Interactive setup asks before installing this shim; scripted setup must pass
`--install-client-shims`. Setup writes a managed shim at
`~/.trajectory/bin/vibe`, links `vibe` into an existing home bin directory on
PATH when possible, writes metadata at
`~/.trajectory/state/mistral-vibe/wrapper.json`, and writes a managed block in
`$VIBE_HOME/hooks.toml` or `~/.vibe/hooks.toml`. The hook block uses Vibe's
native experimental `before_tool` and `after_tool` hooks and calls
`trajectory capture-hook --client mistral-vibe`.

The shim invokes `trajectory vibe --real <path> -- ...`, starts or reuses
`trajectory serve`, enables Vibe experimental hooks for the wrapped process,
and passes user arguments through unchanged. Tool hooks use the shim's
Trajectory session id, while post-run telemetry reads Vibe session logs from
`$VIBE_HOME/logs/session` or `~/.vibe/logs/session`.

Trajectory records `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
`PostToolUse`, `AgentMessage`, `TurnEnd`, and `SessionEnd` with
`client_source=mistral-vibe`. Token and cost fields come from Vibe's
`metadata.json` `stats` object when session logging is enabled.

Non-interactive validation can run Mistral Vibe through its generic OpenAI
provider with an isolated `$VIBE_HOME/config.toml`. Set `active_model` to the
model you want to test and confirm Trajectory records provider-call
`llm_call` facts.

**Source:** [Mistral Vibe](https://github.com/mistralai/mistral-vibe)

## Codebuff

**Trajectory status: Beta. Supported CLI version: 1.0.682 inspected.**

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

`trajectory setup --clients ...` is the recommended path for normal installs because it wires the plugin together with the companion config each client expects: hooks, MCP entries, skills, commands, local binaries, and local marketplace metadata. It is a client-only add/update path: Datadog site, service name, and API key prompts are skipped, and existing export config is left unchanged. Run `trajectory setup` without `--clients` when you need to change Datadog export settings.

Direct or local plugin installs remain supported for development and manual recovery. When using a manual path, copy or install the plugin from a stable local location and mirror the companion config that setup would have written. A plugin-only install may load the extension but miss MCP tools, incognito controls, command assets, or the capture hooks needed for complete telemetry.
## Codex CLI

**Trajectory status: Supported. Supported CLI version: 0.128.0+.**

Codex 0.128.0 is the first version where plugin-bundled hooks work end-to-end:

- **0.118.0** - Plugin system and hook notifications introduced
- **0.120.0** - SessionStart hooks can distinguish session types; live Stop-hook prompts
- **0.121.0** - `codex plugin marketplace add` command for installing plugin marketplaces
- **0.128.0** - Hooks bundled with marketplace plugins are discovered and fired automatically

Earlier versions may have partial support (marketplace without hook discovery, or hooks without marketplace). For reliable instrumentation, use 0.128.0 or later.

### Codex dual-path capture

Codex uses two capture mechanisms:

1. **Command hooks (primary)** - the plugin's `hooks.json` registers 12 lifecycle hooks using Codex's documented PascalCase hook keys, and each hook invokes the installed `trajectory capture-hook --client codex --ensure-serve` binary path with the same event name. Codex hooks stay in the foreground long enough to notify the local capture server so prompt, tool, stop, and session-end events cannot overtake each other. The hook verifies or starts a watcher-capable rescue `serve` process, overrides Codex watcher-disable variables for that rescue process, and suppresses unrelated client watchers so the rollout watcher fallback stays available. `trajectory disable` provides the durable user-scoped all-capture switch; `TRAJECTORY_DISABLED=1` remains the process-scoped override. Codex accepts `type: "command"` hook entries; it does not accept Claude-style `type: "http"` hook entries.

2. **Rollout watcher (fallback)** - the trajectory binary tails `~/.codex/sessions/` for rollout JSONL files. This captures sessions that started before the plugin was installed, or if hooks aren't firing.

The two mechanisms are not interchangeable duplicates. Hooks provide the
low-latency lifecycle edges that Codex blocks on, while rollout JSONL provides
checkpoint-only detail such as assistant messages, reasoning, non-shell tools,
permissions, compaction, model metadata, and token snapshots. Trajectory's
session JSONL is the merged output. During a hook request, `trajectory serve`
reads the Codex rollout forward first, writes only watcher-only events, applies
token/model enrichment, and then writes the hook event so the final Trajectory
JSONL preserves both order and detail. This is why Codex uses
`trajectory capture-hook --client codex --ensure-serve` rather than a direct
bounded `curl` hook or raw direct append.

A file-based sentinel system (`~/.trajectory/state/codex-hook-active/`) prevents the watcher from duplicating events that hooks are already capturing. Because Codex command hooks are one-shot processes, the sentinel stays fresh for the serve inactivity window (10 minutes by default, minimum 30 seconds) before the watcher is allowed to take over.

The watcher's quiescence timeout (how long to wait after last activity before declaring a session ended) defaults to 7 days, configurable via `CODEX_WATCHER_QUIESCENCE_TIMEOUT`.

For local development validation, start capture with `trajectory dev serve`. It writes a dev override sentinel so older non-dev serve processes yield the Codex watcher lock, ensuring the rebuilt binary under test owns rollout capture.

`codex exec --ephemeral` disables Codex's session rollout files. Trajectory can still capture those sessions when Codex command hooks are firing, but the rollout watcher fallback cannot recover an ephemeral exec session after the fact.

The Codex marketplace plugin also ships the `/incognito` skill. It uses the `trajectory_incognito` MCP tool to suppress publish to non-exempt Datadog destinations for the current session while local JSONL capture continues.

`trajectory setup --clients codex` writes a local marketplace under `~/.trajectory/codex-marketplace` and registers that local path with Codex. A direct GitHub marketplace registration can still work, but it is not the recommended path for regular installs because Codex refreshes git marketplaces during startup, which can block the first screen on network or GitHub latency.

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

Capture is live local CLI capture only. There is no Copilot historical backfill,
transcript watcher, cloud-agent capture path, or session import path. The
implementation is based on GitHub's public Copilot CLI plugin, MCP, skills, and
hooks documentation and is validated against payloads that match the documented
hook shape. Live validation should confirm setup-generated plugin assets plus a
real `copilot --plugin-dir ... -p` session that emits prompt, tool, turn,
session, and `client_source=copilot` JSONL.

Registered documented events: `SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `permissionRequest`, `notification`, `Stop`, `subagentStart`, `SubagentStop`, `ErrorOccurred`, `PreCompact`, and `SessionEnd`. The plugin uses command hooks, not Copilot HTTP hooks, because Copilot requires HTTPS for HTTP hooks that can affect permissions.

## Claude Code

**Trajectory status: Supported. Supported CLI version: 2.0+** (plugin marketplace support)

Install with setup:

```bash
trajectory setup --clients cc
```

Setup writes a local Claude Code marketplace under `~/.trajectory/claude-marketplace`, registers that local path with Claude, refreshes the marketplace, then installs the plugin at user scope. If `trajectory@trajectory` is already installed, setup refreshes the marketplace and runs `claude plugin update trajectory@trajectory --scope user` so an existing install moves to the bundled plugin version without requiring GitHub SSH or HTTPS credentials. Claude Code caches installed plugins by version; the setup-generated marketplace and plugin manifest use Trajectory's bundled Claude plugin version. `trajectory update` also checks installed Claude plugin metadata and refreshes the plugin when the cached version is stale or still carries the duplicate standard-hook manifest entry.

Manual fallback after setup has staged the local marketplace:

```bash
claude plugin marketplace add ~/.trajectory/claude-marketplace
claude plugin marketplace update trajectory
claude plugin install trajectory@trajectory --scope user
```

From a source checkout, use the checkout root instead of `~/.trajectory/claude-marketplace`.

### Skill Observability

The Claude plugin also installs a bounded prompt-time sync hook for Trajectory
skill observability. It keeps user/global Claude skills instrumented with
skill-scoped hooks and records reversible state under
`~/.trajectory/state/claude-skills/manifest.json`.

Useful commands:

```bash
trajectory claude skills status
trajectory claude skills sync --user
trajectory claude skills sync --project
trajectory claude skills restore --stale
```

Project `.claude/skills` fallback sync is opt-in because it mutates
version-controlled files. Enable it with `TRAJECTORY_CLAUDE_SKILLS_PROJECT=1`
or a `.trajectory/claude-skills-project-enabled` marker in the project.

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
those signals at the local OTLP endpoints. Setup does not write
`~/.claude/settings.json`; it may only remove the exact legacy user-scope
Trajectory OTLP env block written by older versions. When Claude managed
settings own OTel configuration, an admin must make any durable
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

**Trajectory status: Supported. Supported CLI version: 0.30.0+** (settings, hooks, and commands support)

Install with setup:

```bash
trajectory setup --clients gemini
```

Setup writes `~/.gemini/settings.json`, `~/.gemini/hooks/hooks.json`, `~/.gemini/skills/incognito/SKILL.md`, and `~/.gemini/commands/incognito.toml`. The settings file registers Trajectory MCP, and the hooks file uses command hooks with `curl` to post session events to the local capture server.

The repository still includes `hooks/hooks.json` as a legacy extension command-hook template for older manual installs. Manual extension installs remain supported for development and recovery, but they must match Gemini's hook format and wire MCP, skills, and commands separately. Current setup-managed installs should use `trajectory setup --clients gemini`.

The Gemini skill uses `trajectory_incognito` when MCP is available, and falls back to the `/session/incognito` HTTP endpoint.

Gemini CLI does not currently expose direct subagent lifecycle hooks. When
Gemini writes a `kind:"subagent"` chat artifact, Trajectory synthesizes
`subagent_start`, `subagent_stop`, and `subagent_cost` during `SessionEnd` and
links those lifecycle events back to the parent `generalist`, `cli_help`, or
`codebase_investigator` tool call when the parent JSONL contains the launch
`tool_use_id`.

## Antigravity CLI (`agy`)

**Trajectory status: Supported. Supported CLI version: 1.0.0+** (Antigravity CLI plugin manager and migrated Gemini hook support)

Install with setup:

```bash
trajectory setup --clients agy
```

Setup writes `~/.gemini/antigravity-cli/settings.json` for the Trajectory MCP server and stages a Trajectory plugin under `~/.gemini/config/plugins/trajectory`. The plugin includes `hooks/hooks.json`, `skills/incognito/SKILL.md`, and `commands/incognito.toml`.

The Antigravity hooks use the same Gemini-compatible event names (`SessionStart`, `BeforeAgent`, `AfterModel`, `BeforeTool`, `AfterTool`, `AfterAgent`, `PreCompress`, `Notification`, and `SessionEnd`) but post to `/capture/agy/<Event>`. The capture server reuses Gemini parsing and token/cost logic while emitting `client_source=agy`.

Manual validation:

```bash
agy plugin validate plugin/trajectory-antigravity
```

Current limitations: no historical Antigravity backfill or setup-managed resume target yet.

## Goose

**Trajectory status: Beta. Supported CLI version: 1.39.0 tested.**

Install with setup:

```bash
trajectory setup --clients goose
```

Setup writes a Goose Open Plugins package under
`~/.agents/plugins/trajectory`. If `GOOSE_PATH_ROOT` is set, setup writes the
same package under `$GOOSE_PATH_ROOT/.agents/plugins/trajectory`. The package
contains a `plugin.json` manifest and `hooks/hooks.json`.

The Goose hooks use command actions that post hook context JSON to
`/capture/goose/<Event>`. Setup registers `SessionStart`, `UserPromptSubmit`,
`PreToolUse`, `PostToolUse`, `PostToolUseFailure`, `BeforeReadFile`,
`AfterFileEdit`, `BeforeShellExecution`, `AfterShellExecution`, `Stop`, and
`SessionEnd`. Trajectory maps those into canonical session, prompt, tool,
assistant-message, turn, and session-end records with `client_source=goose`.

Real Goose model calls need provider credentials. Validate Goose either with
recorded Open Plugins payloads or with a live provider-backed run. Goose also
stores session history in SQLite under the normal Goose data root; historical
usage backfill is not setup-managed yet.

## Cursor

Cursor has two separate products with different capture paths:

### Cursor Desktop (IDE)

**Trajectory status: Supported. Supported CLI version: 1.0+** (hooks.json support)

The trajectory setup wizard writes hooks and MCP config directly:

```bash
trajectory setup --clients cursor
```

This creates `~/.cursor/hooks.json` and `~/.cursor/mcp.json`. Capture uses Cursor's supported command hooks to `curl` POST payloads to the Trajectory capture server. Cursor does not currently accept every Claude Code lifecycle hook name; setup registers the supported Cursor event names and omits unsupported lifecycle hooks. When Claude Code is installed, Cursor uses the Claude Code Trajectory skill path for `/incognito`; otherwise setup installs a native Cursor fallback at `~/.cursor/skills/incognito/SKILL.md`. The `incognito` skill uses the shared `trajectory_incognito` MCP tool to suppress publish to non-exempt Datadog destinations for the active Cursor session while local JSONL capture continues.

Validation for this Desktop install surface should run setup in an isolated
home, check the Cursor MCP/hooks files and incognito skill routing, replay
Cursor Desktop hook payloads into `/capture/cursor`, and verify the
`/session/incognito` sentinel lifecycle. Cursor Desktop metrics include tool,
turn, session, duration, and per-request cost values; token usage metrics are
emitted when Cursor's `state.vscdb` exposes non-zero real token counts.

### cursor-agent (CLI)

cursor-agent is a standalone CLI (`cursor-agent --print` for headless mode). It does NOT support hooks.json. Capture uses a **transcript file watcher** that tails nested transcript files under `~/.cursor/projects/*/agent-transcripts/<session>/*.jsonl`, similar to the Codex rollout watcher.

The watcher starts automatically when `cursor-agent` is on PATH. No manual setup
needed - the trajectory binary detects cursor-agent and watches for transcripts.
A live validation run can ask `cursor-agent --print` to read a nonce file and
assert `user_prompt` capture, a tool request event, turn end with the nonce,
agent loop end, session end, and `client_source=cursor`. Tool result events are captured when Cursor includes
`tool_result` parts in the transcript, but current live CLI transcripts do not
always include a separate result part. The watcher preserves `transcript_path`
on `session_start` for traceability and also marks the session headless, so
sensitivity scanning and segmentation are skipped for this headless path.
Because the current headless transcript format does not
expose token or cost fields, cursor-agent metrics are limited to tool, turn, and
session counts until Cursor adds those fields. Project or user skill activation
is represented as a Read of `.cursor/skills/<name>/SKILL.md`; Trajectory emits
that native load as a high-confidence skill invocation tagged
`detected_from:cursor_skill_read`. `CURSOR_AGENT_MODEL` is optional;
leave it unset to use the configured Cursor account default.

Install cursor-agent: `curl -fsSL https://cursor.com/install | bash`

## Pi

**Trajectory status: Supported. Supported CLI version: current CLI tested** (headless mode: `pi -p`)

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

Setup writes `~/.pi/agent/extensions/trajectory/` with a `package.json` that declares `pi.extensions: ["./src/index.ts"]`, plus a root `index.ts` shim that re-exports `./src/index.ts`, and points `~/.pi/agent/mcp.json` at the extension-local `bin/trajectory mcp` command. Setup does not add Trajectory's extension entrypoint to `~/.pi/agent/settings.json`; Pi discovers the extension from its standard extensions directory. Pi uses a TypeScript extension API (`pi.on("event", handler)`) that subscribes to lifecycle events (session_start, turn_end, tool_call, tool_result, etc.) and POSTs them to the capture server. Pi also writes key lifecycle events through `capture-hook` for robustness and emits `PostCompact`. The native extension registers `trajectory_status`, `trajectory_flush`, `trajectory_incognito`, `trajectory_schema`, and `trajectory_query`; MCP exposes the shared cross-client tool surface in environments where Pi routes MCP tools. Pi supports multiple LLM providers - use any provider API key for testing.

Pi does not currently consume the Codex/Claude-style `skills/` plugin directory. The Trajectory Pi extension vends incognito through its native `trajectory_incognito` tool; environments that expose MCP can also use the shared `trajectory_incognito` MCP tool.

Pi capture currently records normal session, prompt, tool, turn, compaction,
model, and fork events. It does not expose a dedicated subagent lifecycle event
with a child session id and launch tool id, so Trajectory does not render Pi
forks or agent metadata as subagent trace parentage.

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

**Trajectory status: Supported. Supported CLI version: current CLI tested** (headless mode: `opencode run`)

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

Manual fallback: copy `plugin/trajectory-opencode` to `~/.config/opencode/plugins/trajectory` and add that local path to the `plugins` array plus a `trajectory` MCP entry in `~/.config/opencode/opencode.json`.

**Source:** [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)

## Kilo Code

**Trajectory status: Beta. Supported CLI version: current CLI tested** (headless mode: `kilo run --auto`)

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

Kilo also supports native OpenTelemetry export. To relay native telemetry through
Trajectory, set `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:19222` before
starting `kilo`; Kilo will export OTLP traces/logs to the local Trajectory relay
when its OpenTelemetry setting is enabled. This complements the plugin event
stream; it does not replace setup-managed plugin capture.

Headless validation can run Kilo with an OpenAI-compatible provider:
`KILO_PROVIDER=openai`, provider credentials, the model you want to test, then
`kilo run --auto`.

Manual fallback: copy `plugin/trajectory-kilo` to
`~/.config/kilo/plugins/trajectory` and add that local path to the `plugin`
array plus a `trajectory` MCP entry in `~/.config/kilo/opencode.json`.

**Source:** [github.com/Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode),
[Kilo CLI docs](https://kilo.ai/docs/code-with-ai/platforms/cli)

## Kiro CLI

**Trajectory status: Beta. Supported contract: public Kiro CLI command-hook docs.**

Install with setup:

```bash
trajectory setup --clients kiro
```

Setup writes a Trajectory agent config to `~/.kiro/agents/trajectory.json`
(or `$KIRO_HOME/agents/trajectory.json`) and merges a `trajectory` MCP server
into `~/.kiro/settings/mcp.json`. The installed agent keeps Kiro's normal
coding-agent behavior, enables `includeMcpJson`, and registers fail-open command
hooks that invoke `trajectory capture-hook --client kiro --ensure-serve`.

Kiro exposes command hooks from agent configuration. Trajectory captures
`agentSpawn`, `userPromptSubmit`, `preToolUse`, `postToolUse`, and `stop`
payloads from stdin and records `client_source=kiro`. The current documented
stop hook includes `assistant_response`, so Trajectory records final assistant
text and a turn end. The documented hook payloads do not expose stable token or
cost usage yet, so Kiro turns are marked `tokens_status=unavailable` unless a
future Kiro payload adds usage metadata.

Kiro supports headless execution with `kiro-cli chat --no-interactive` and
`KIRO_API_KEY`. Trajectory captures command hooks when Kiro auth is configured;
token and cost usage depend on future Kiro hook payload fields.

Historical import is not implemented yet.

**Source:** [Kiro CLI hooks](https://kiro.dev/docs/cli/hooks/),
[Kiro CLI MCP](https://kiro.dev/docs/cli/mcp/),
[Kiro CLI custom-agent configuration](https://kiro.dev/docs/cli/custom-agents/configuration-reference/),
and prior Amazon Q Developer CLI references in
[amazon/amazon-q-developer-cli](https://github.com/aws/amazon-q-developer-cli).


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
