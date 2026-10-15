# Supported Clients

This page lists the coding agents that Trajectory supports. For each one, it
says how to set it up, what Trajectory captures, and how well that path is
tested. This page calls each coding agent a client.

Trajectory captures session events through each client's hooks, plugins, or
extensions. It sends them to a local capture server, `trajectory serve`.

For install files, hook details, watcher behavior, and backfill limits for each
client, see [CLIENT-INSTRUMENTATION.md](CLIENT-INSTRUMENTATION.md).

For the MCP tool and resource catalog, run `trajectory user-guide mcp`. For the
client overview and the guide for each client, run one of these commands:

```bash
trajectory user-guide clients
trajectory user-guide clients/claude-code
trajectory user-guide clients/codex
trajectory user-guide clients/copilot
trajectory user-guide clients/gemini
trajectory user-guide clients/agy
trajectory user-guide clients/goose
trajectory user-guide clients/cline
trajectory user-guide clients/cursor
trajectory user-guide clients/droid
trajectory user-guide clients/hermes
trajectory user-guide clients/amp
trajectory user-guide clients/qwen
trajectory user-guide clients/aider
trajectory user-guide clients/continue
trajectory user-guide clients/mistral-vibe
trajectory user-guide clients/grok
trajectory user-guide clients/codebuff
trajectory user-guide clients/pi
trajectory user-guide clients/opencode
trajectory user-guide clients/kilo
trajectory user-guide clients/kiro
trajectory user-guide clients/devin
trajectory user-guide clients/qoder
trajectory user-guide clients/zcode
trajectory user-guide clients/commandcode
trajectory user-guide clients/muse
trajectory user-guide clients/kimi
trajectory user-guide clients/gptme
trajectory user-guide clients/codewhale
trajectory user-guide clients/forgecode
trajectory user-guide clients/warp
trajectory user-guide clients/windsurf
trajectory user-guide clients/zed
```

## Terms Used on This Page

- **Saved history**: the session files or database that a client writes to
  disk. Feature flags whose names end in `_durable_history` control whether
  Trajectory reads it.
- **Sync**: Trajectory reads saved history and updates its own records to
  match.
- **Watcher**: the part of `trajectory serve` that watches saved history for
  changes and syncs them.
- **Import**: `trajectory session import <client>` reads saved history on
  request. Add `--force` to import sessions again that Trajectory already has.
- **Wake hook**: a hook that only tells Trajectory to read saved history
  again. It carries no session content.
- **Shim**: a small command that setup puts on `PATH` in front of the client's
  own command.
- **Fixture**: recorded or synthetic sample data that tests replay.
- **Headless**: a session that runs without an interactive user, such as a
  print mode or a script.
- **Preview**: an integration that is off by default. Turn on its feature
  flag before you run setup.
- **Local UI (Lapdog)**: the viewer for the sessions on your computer.

## Quick Reference

The Trajectory status column gives the release status of each integration.
The Version support column lists up to three versions:

- **Minimum**: the oldest supported version. A live replay or a compatibility
  contract supports it.
- **Validated**: a version that one fixture, source, contract, or live-replay
  check covers.
- **Latest checked**: the newest client release that Trajectory compared for
  changes. It does not extend the supported range.

The word in parentheses names the kind of check. A `live-replay` check replays
a real session from that pinned version. A `source` check compares
Trajectory with the client's source code. A `fixture` check replays sample
data in that version's format. A `contract` check tests Trajectory against the
client's published hook or file format.

| Client | Setup integration | Trajectory status | Version support | Capture method | Coverage notes |
|--------|-------------------|-------------------|-----------------------|----------------|----------------|
| Claude Code | `trajectory setup --clients cc`. Optional: `--install-client-shims`. | Supported | Minimum 2.0.0 (contract); validated 2.1.215 (live-replay); latest checked 2.1.215 | Native HTTP hooks for tools and messages. Command hooks for lifecycle and permission events. MCP. Optional `trajectory claude` launcher. | Trajectory can relay Claude's native OTLP. Transcript sync fills in missing content and session-end data. |
| Claude Desktop (macOS) | On by default. Optional: `trajectory setup --clients claude-desktop`. | Capture (near-real-time watcher + backfill) | No minimum established | `trajectory serve` watches `audit.jsonl` on macOS in near real time. Backfill flag: `--from-claude-desktop`. | Live capture and backfill use `client_source=claude-desktop`. `app_version` is the Claude.app marketing version. Code-tab sessions keep `client_source=claude-code` with `entrypoint=claude-desktop`. Incognito applies. |
| Codex CLI | `trajectory setup --clients codex`. Optional: `--install-client-shims`. | Supported | Minimum 0.128.0 (contract); validated 0.159.2 (live-replay); latest checked 0.159.2 | By default, CLI and Desktop hooks for session start, prompt, Stop, and SessionEnd, plus rollout sync. Hooks for all eleven Codex events are kept for compatibility. Optional `trajectory codex` launcher. | Full Responses API request and response spans. Rollout backfill. Desktop sessions get the Desktop launch tags. |
| GitHub Copilot CLI | `trajectory setup --clients copilot`. Optional watcher: `copilot_cli_durable_history`. | Beta | No minimum established; validated 1.0.71 (contract); latest checked 1.0.71 | Copilot plugin command hooks, MCP, and saved-history import or watcher | Hooks, the watcher, and Lapdog queries are tested with fixtures. Live CLI tests are pending. |
| Antigravity CLI (`agy`) | `trajectory setup --clients agy` | Supported | No minimum established; validated 1.1.2 (fixture) | Native Antigravity plugin hooks and MCP. Optional watcher for prompts and schema-v1 usage. | Synthetic 1.0.12 and 1.1.2 hook and history fixtures. Local schema-v1 and local UI tests. Tests with a real released CLI are pending. |
| Goose | `trajectory setup --clients goose` | Beta | Minimum 1.43.0 (live-replay); validated 1.43.0 (source); latest checked 1.43.0 | Open Plugins command hooks, plus SQLite sync that is on by default | Live hook tests use an OpenAI model. Fixtures cover schema-v15 history, usage enrichment, and the local UI. |
| Cline CLI | `trajectory setup --clients cline` | Beta | Minimum 3.0.46 (live-replay); validated 3.0.46 (source); latest checked 3.0.46 | File hooks and MCP | Live tests use an OpenAI model. Current hooks carry no token or cost usage. |
| Cursor Desktop | `trajectory setup --clients cursor` | Supported | Minimum 1.0.0 (contract) | Command hooks that post events to the capture server through a helper | Native input, output, cache-read, and cache-write tokens, behind a managed rollout. Tests use real sanitized payloads. |
| cursor-agent CLI | Uses the Cursor setup for hooks. For saved history, turn on `cursor_agent_durable_history`. | Beta | No minimum established | The same command hooks as Cursor Desktop when the CLI runs them. Optional watcher, off by default, for current and older JSONL transcripts. | Saved-history capture is tested with fixtures. A live check confirms that hook and saved-history sessions get the same ID. |
| Factory Droid | `trajectory setup --clients droid` | Beta | No minimum established | Factory plugin command hooks and MCP | Plugin command hooks only |
| Hermes Agent | `trajectory setup --clients hermes` | Beta | Minimum 0.17.0 (live-replay); validated 0.18.2 (source); latest checked 0.18.2 | Observer plugin hooks and MCP. Optional history sync, off by default. | Observer usage events, plus session totals from saved history |
| Amp Code | `trajectory setup --clients amp` | Beta | No minimum established | System TypeScript plugin events and MCP | Tested with fixtures until a usable `AMP_API_KEY` is available |
| Qwen Code | `trajectory setup --clients qwen` | Beta | Minimum 0.20.0 (live-replay); validated 0.20.0 (source); latest checked 0.20.0 | Native HTTP hooks and MCP | Live tests use an OpenAI model and check usage data |
| OpenHands | `trajectory setup --clients openhands`. Optional: turn on `openhands_durable_history`. | Beta | Minimum 1.16.0 (live-replay); validated 1.16.0 (live-replay); latest checked 1.16.0 | Command hooks and MCP. Optional conversation sync, off by default. | Live hook tests. Fixtures cover assistant text, thinking, tools, model, and session totals from history. |
| Aider | `trajectory setup --clients aider --install-client-shims`. Optional: turn on `aider_durable_history`. | Beta | Minimum 0.86.2 (live-replay); validated 0.86.2 (live-replay); latest checked 0.86.2 | Opt-in command shim and sidecar files for analytics and history. Optional sync of Markdown history from folders you name, off by default. | Live shim tests use an OpenAI model. Fixtures cover the history parser, watcher, backfill, and local UI. |
| Continue CLI | `trajectory setup --clients continue --install-client-shims` | Beta | Minimum 1.5.47 (live-replay); validated 1.5.47 (live-replay); latest checked 1.5.47 | Opt-in `cn` command shim that reads the session JSON file after each run | Live tests use an OpenAI model. Fixtures cover the current schema for tools, usage, and Lapdog. |
| Mistral Vibe | `trajectory setup --clients mistral-vibe --install-client-shims`. Optional: turn on `mistral_vibe_durable_history`. | Beta | Minimum 2.21.0 (contract); validated 2.26.0 (live-replay); latest checked 2.26.0 | Opt-in `vibe` command shim, native hooks for session identity and tools, and import by session ID. Optional history sync, off by default. | Live shim tests use an OpenAI model. Fixtures cover root and nested history, changes, repair, and the local UI. |
| Grok Build | Turn on `grok_build_instrumentation`, then run `trajectory setup --clients grok`. | Preview | No minimum established; validated 0.2.103 (fixture) | Native global hooks, sync of root and nested saved sessions, and repair by import | Tests check the binary without credentials. Fixtures cover changes, recovery, and the local UI. A signed-in test of hooks and changes is pending. |
| Codebuff | `trajectory setup --clients codebuff --install-client-shims` | Beta | No minimum established; validated 1.0.684 (source); latest checked 1.0.684 | Opt-in command shims and a chat-history importer | Tested with fixtures. Usage comes from Codebuff `chat-messages.json` in the same format that the ccusage adapter reads. |
| Pi | `trajectory setup --clients pi` | Supported | Minimum 0.80.10 (live-replay); validated 0.80.10 (live-replay); latest checked 0.84.1 | TypeScript extension and MCP | Extension events with usage for each model call |
| Oh My Pi (`omp`) | Turn on `omp_instrumentation`, then run `trajectory setup --clients omp`. To repair history, run `trajectory session import omp`. | Beta (preview) | Minimum 17.0.4 (live-replay); validated 17.0.5 (source); latest checked 17.0.5 | Native `omp.extensions` lifecycle and MCP. Automatic sync of v3 history that follows the active profile and XDG paths. | Real lifecycle tests through the RPC interface without credentials. Fixtures cover setup, paths, crash and retry, hook and history overlap, JSONL records, SQLite, and the local UI. |
| OpenCode | `trajectory setup --clients opencode` | Supported | Minimum 1.18.3 (live-replay); validated 1.18.3 (live-replay); latest checked 1.18.7 | Plugin SDK events and MCP | Plugin SDK events, JSON-storage and SQLite backfill, and an opt-in watcher |
| Kilo Code | `trajectory setup --clients kilo` | Beta | Minimum 7.4.11 (live-replay); validated 7.4.11 (live-replay); latest checked 7.4.11 | Plugin SDK events and MCP. Optional saved-history fallback, off by default. | Five native token types and model provider cost from plugin and SQLite records. Optional native OTLP relay. |
| Kiro CLI | `trajectory setup --clients kiro` | Beta | No minimum established; validated 2.12.2 (fixture) | Agent command hooks and MCP. Optional saved-history sync. | Hooks tested with fixtures. JSONL and SQLite history sync. No native usage data. |
| Devin CLI | Turn on `devin_cli_instrumentation`, then run `trajectory setup --clients devin`. | Beta (preview) | No minimum established | Sync of the local session database and transcripts. Command hooks act as wake hooks. MCP. | Sanitized database and transcript fixtures. A test with the credentials file is pending. |
| Qoder CLI | Turn on `qoder_cli_instrumentation`, then run `trajectory setup --clients qoder`. | Beta (preview) | No minimum established; validated 1.0.43 (fixture) | Native plugin wake hooks, JSONL transcript sync, and MCP | Sanitized fixtures in the current format. A live test with a personal access token is pending. |
| ZCode | Turn on `zcode_instrumentation`, then run `trajectory setup --clients zcode`. | Beta (preview) | No minimum established; validated 0.15.2 (fixture) | Native wake hooks, SQLite sync, MCP, and an incognito skill | Schema checked against the official release. Current-format fixtures, repair by import, and local UI tests. A signed-in conversation test is pending. |
| CommandCode | Turn on `commandcode_instrumentation`, then run `trajectory setup --clients commandcode`. | Beta (preview) | No minimum established; validated 0.44.1 (fixture) | Native wake hooks, sync of transcripts that the client rewrites, and MCP | Sanitized current-format fixtures, plus JSONL record and Lapdog tests. A live signed-in test is pending. |
| Muse Code | Turn on `muse_code_instrumentation`, then run `trajectory setup --clients muse` (macOS and Linux). | Beta (preview) | No minimum established; validated 0.1.0-R708.1 (contract) | Managed wake hooks, sync of append-only session logs, and optional MCP. Managed setup is macOS only. | Official stable binary and docs. Real interactive and headless logs from an echo model. Managed hook tests. Sanitized fixture and JSONL record tests. |
| Kimi Code CLI | Turn on `kimi_cli_instrumentation`, then run `trajectory setup --clients kimi`. | Beta (preview) | No minimum established; validated 1.49.0 (source); latest checked 1.49.0 | Sync of the client's wire, context, and state files. Wake hooks. MCP. | Sanitized current and older fixtures. Live tests are pending. |
| gptme | Turn on `gptme_instrumentation`, then run `trajectory setup --clients gptme`. | Beta (preview) | Minimum 0.32.0 (live-replay); validated 0.32.1 (source); latest checked 0.32.1 | Native plugin hooks that carry metadata only. Sync of conversation, events, and config files. MCP. | Real live tests with the `mock/echo` model and no credentials. Local UI and privacy fixtures. |
| CodeWhale | Turn on `codewhale_instrumentation`, then run `trajectory setup --clients codewhale`. | Beta (preview) | Minimum 0.9.0 (live-replay); validated 0.9.0 (live-replay); latest checked 0.9.0 | Sync of saved sessions and the runtime store. Native hooks act as wake hooks. MCP. | Fixtures in the client's native format. A stream-JSON test of the released wrapper runs without credentials. |
| ForgeCode | Turn on `forgecode_instrumentation`, then run `trajectory setup --clients forgecode`. | Beta (passive-history preview) | No minimum established; validated 2.13.18 (source); latest checked 2.13.18 | Read-only `.forge.db` sync, MCP, and Trajectory's own incognito skill and command | Sanitized current-schema fixtures and Lapdog tests. Live tests of CLI history and incognito are pending. |
| Warp/Oz CLI | Turn on `warp_oz_instrumentation`, then run `trajectory setup --clients warp`. | Beta (preview) | No minimum established | Sync of local Warp Desktop and local `oz agent run` stores. MCP. | Sanitized SQLite and protobuf fixtures. Cloud runs are excluded. Live sign-in and lifecycle tests are pending. |
| VS Code Copilot Chat | Turn on `vscode_copilot_instrumentation`, then run `trajectory setup --clients vscode-copilot`. | Beta (fixture preview) | No minimum established | Saved JSONL and JSON history, first-party native OTel, and MCP | Source review, sanitized history and OTel fixtures, and local UI fixtures. A real Electron UI OTel test and an incognito test are still required. |
| Windsurf | Turn on `windsurf_instrumentation`, then run `trajectory setup --clients windsurf`. | Beta (preview) | No minimum established | Native Cascade hooks, transcript sync, a fallback for older database history, and MCP | Synthetic fixtures based on the official schema. A live IDE test is pending. |
| Zed | Turn on `zed_passive_history`, then run `trajectory setup --clients zed`. | Beta (preview) | No minimum established; validated 1.11.3 (source); latest checked 1.11.3 | Read-only `threads.db` sync, MCP, and a global skill | Sanitized JSON and zstd SQLite fixtures. Live tests of the Zed UI, schema, and incognito are pending. |
| OpenClaw | Saved history only: turn on `openclaw_durable_history`. Released builds do not capture OpenClaw live. | Saved-history import beta | No minimum established; validated 2026.7.1 (source); latest checked 2026.7.1 | JSONL history sync | Current-schema fixture, watcher and backfill change tests, and local UI tests. A signed-in live history test is pending. |
| DD Harness | Enable `dd_harness_instrumentation`, then `trajectory setup --clients dd-harness` (explicit-only) | Preview | No minimum established | Versioned batch envelopes over loopback HTTP; `chat.db` retained-history import | Receiver/mapper/import tests and contract fixtures; operational details in the org-managed guide |

## Historyimport Artifact Coverage

The root `historyimport` SDK has two source sets with different purposes:

- `DefaultSources()` is the cautious set that it discovers on the local
  computer.
- `ArtifactSources()` is the full saved-history set for `ImportArtifacts`. It
  reads only the artifacts that the caller opens.

These clients have an artifact adapter in the SDK:

| Agent surface | SDK source |
|---|---|
| Claude Code | `claude` |
| Claude Desktop | `claude-desktop` |
| Codex CLI | `codex` |
| Gemini CLI (retired. Saved history only.) | `gemini` |
| Cursor Desktop and cursor-agent CLI | `cursor` |
| Pi | `pi` |
| Oh My Pi | `omp` |
| Hermes Agent | `hermes` |
| OpenHands | `openhands` |
| OpenCode | `opencode` |
| Kilo Code | `kilo` |
| ZCode | `zcode` |
| Aider | `aider` |
| Antigravity CLI | `agy` |
| Codebuff | `codebuff` |
| GitHub Copilot CLI | `copilot` |
| Grok Build | `grok` |
| Mistral Vibe | `mistral-vibe` |
| OpenClaw | `openclaw` |
| Qwen Code | `qwen` |

Trajectory captures the other supported clients through live hooks, sync of
active sessions, or a saved-history watcher. They have no full-history
artifact adapter yet:

- Goose
- Cline CLI
- Factory Droid
- Amp Code
- Continue CLI
- Kiro CLI
- Devin CLI
- Qoder CLI
- CommandCode
- Muse Code
- Kimi Code CLI
- gptme
- CodeWhale
- ForgeCode
- Warp/Oz CLI
- VS Code Copilot Chat
- Windsurf
- Zed

`ImportArtifacts` rejects these sources. It does not guess a file layout or
claim full history coverage. A source joins the list only when its saved
history has known size limits and keeps session IDs. It also needs a setup
adapter and a test that compares it with the live path.

## Feature Coverage Matrix

### Main Features

These tables summarize support across clients:

- `X`: supported on the main path, with strong test coverage.
- `P`: supported with a condition. Examples are a feature flag, a limit on
  capture mode or detail, a destination requirement, or a live test that is
  still pending.
- `-`: no supported path today.

The signal columns describe what Trajectory captures. That can be less than
what the client itself can do. Published traces are LLM Observability traces.
Published security logs are the managed `event_stream` output. For details,
run `trajectory user-guide security-event-stream`.

#### Capture And Controls

| Client | Live capture | Backfill | Incognito | Segmentation |
|---|---|---|---|---|
| Claude Code | X | X | X | X |
| Claude Desktop (macOS) | P | X | P | P |
| Codex CLI | X | X | X | X |
| GitHub Copilot CLI | P | P | P | P |
| Antigravity CLI (`agy`) | P | P | P | - |
| Goose | X | P | P | - |
| Cline CLI | X | - | P | P |
| Cursor Desktop | X | X | P | P |
| cursor-agent CLI | P | P | P | P |
| Factory Droid | P | - | P | P |
| Hermes Agent | X | P | P | P |
| Amp Code | P | P | P | P |
| Qwen Code | X | X | P | P |
| OpenHands | X | P | P | - |
| Aider | P | P | P | P |
| Continue CLI | P | P | P | P |
| Mistral Vibe | P | P | P | P |
| Grok Build | P | P | P | - |
| Codebuff | P | X | P | P |
| Pi | X | X | X | X |
| Oh My Pi (`omp`) | P | X | P | P |
| OpenCode | X | X | X | X |
| Kilo Code | X | X | P | P |
| Kiro CLI | P | P | P | - |
| Devin CLI | P | P | P | - |
| Qoder CLI | P | P | P | - |
| ZCode | P | X | P | - |
| CommandCode | P | P | P | - |
| Muse Code | P | P | P | - |
| Kimi Code CLI | P | X | P | - |
| gptme | P | P | X | P |
| CodeWhale | P | X | P | P |
| ForgeCode | - | P | P | - |
| Warp/Oz CLI | - | P | P | - |
| VS Code Copilot Chat | P | P | P | P |
| Windsurf | P | P | P | P |
| Zed | - | P | P | - |
| OpenClaw | - | X | - | - |
| DD Harness | P | P | - | - |

#### Captured Signals And Publishing

| Client | Token/cost | Skills | Tools | Permissions | Subagents | Publish metrics | Publish traces | Publish security logs |
|---|---|---|---|---|---|---|---|---|
| Claude Code | X | X | X | X | X | X | X | X |
| Claude Desktop (macOS) | P | P | P | - | P | X | X | X |
| Codex CLI | X | X | X | P | P | X | X | X |
| GitHub Copilot CLI | P | P | P | P | P | X | X | X |
| Antigravity CLI (`agy`) | P | P | P | P | - | X | X | X |
| Goose | P | P | P | - | - | X | X | X |
| Cline CLI | - | P | P | - | - | X | X | X |
| Cursor Desktop | X | X | X | X | P | X | X | X |
| cursor-agent CLI | P | X | P | P | P | X | X | X |
| Factory Droid | - | P | P | P | P | X | X | X |
| Hermes Agent | P | P | P | X | P | X | X | X |
| Amp Code | P | P | P | - | - | X | X | X |
| Qwen Code | X | P | X | X | P | X | X | X |
| OpenHands | P | P | P | - | - | X | X | X |
| Aider | P | - | - | - | - | X | X | X |
| Continue CLI | P | P | P | - | - | X | X | X |
| Mistral Vibe | P | P | P | - | - | X | X | X |
| Grok Build | - | P | P | P | P | X | X | X |
| Codebuff | P | - | - | - | - | X | X | X |
| Pi | X | P | X | - | - | X | X | X |
| Oh My Pi (`omp`) | X | P | P | - | P | X | X | X |
| OpenCode | X | X | X | X | P | X | X | X |
| Kilo Code | X | P | X | X | P | X | X | X |
| Kiro CLI | - | P | P | - | - | X | X | X |
| Devin CLI | P | P | P | - | - | X | X | X |
| Qoder CLI | P | P | P | - | P | X | X | X |
| ZCode | P | P | P | - | P | X | X | X |
| CommandCode | - | P | P | - | - | X | X | X |
| Muse Code | P | P | P | P | P | X | X | X |
| Kimi Code CLI | P | P | P | - | P | X | X | X |
| gptme | P | P | P | - | - | X | X | X |
| CodeWhale | P | P | P | - | P | X | X | X |
| ForgeCode | P | P | P | - | P | X | X | X |
| Warp/Oz CLI | - | P | P | - | P | X | X | X |
| VS Code Copilot Chat | P | P | P | - | P | X | X | X |
| Windsurf | - | - | - | - | - | X | X | X |
| Zed | P | P | P | - | P | X | X | X |
| OpenClaw | P | - | P | - | P | X | X | X |
| DD Harness | P | - | P | - | P | X | X | X |

#### Cross-client Resume

`trajectory session resume` opens a captured session in another client. This
table covers the clients that it supports today. Rows are the source client
and columns are the target client.

- `X`: the printed command opens the session in the target.
- `P`: partial support. Cursor can only show the session.

| Source \ Target | Claude Code | Codex CLI | Cursor | OpenCode | Pi |
|---|---|---|---|---|---|
| Claude Code | - | X | P | X | X |
| Codex CLI | X | - | P | X | X |
| Cursor | X | X | - | X | X |
| OpenCode | X | X | P | - | X |
| Pi | X | X | P | X | - |

Context capacity depends on the model, not the client. For an interactive
target, Trajectory keeps the captured conversation but leaves out the source
model and context-window settings. So the target does not read a model ID from
another client as its own setting. The target chooses the model and runs any
compaction after it opens the history.

How resume treats session IDs and branches:

- Claude Code and Codex keep their UUID session IDs.
- OpenCode, and sources without UUID session IDs, get a stable alias in the
  target's own format. The printed resume command selects it.
- For a Claude Code rewind, resume follows only the ancestry that `leafUuid`
  selects. Abandoned branches do not go into the target.
- Codex child rollouts keep copied parent messages as context for resume only.
  Child token and cost totals count only the child's own turns.
- OpenCode `session.revert.messageID` removes the abandoned messages from
  resume. Trajectory keeps the turn that ran for telemetry.
- OpenCode 1.18.7 does not save a parent ID for `opencode run --fork`. So
  Trajectory cannot safely remove copied fork history later.

Tests use real pinned Claude Code, Codex, and OpenCode CLIs, with no
credentials. They test every source and target pair among those three
clients. They check that the working directory carries over and that the model
provider sees the imported context. They also cover active-branch selection,
inherited fork context, and native `/compact` boundaries before a later turn.
They do not yet cover Pi, Cursor, or hosted model providers.

Traces follow what ran, not what resume shows:

- Each turn that the client ran keeps its own turn trace.
- A later backtrack keeps that trace. Trajectory tags its turn root with
  `trajectory.branch_state:abandoned`.
- Inherited fork context is for resume only. It does not create child turn
  traces.
- When the client's storage names a parent session, Trajectory records it as
  span attributes. It does not create an extra index trace.
- OpenCode forks are the one exception. OpenCode does not save fork lineage,
  so Trajectory keeps the transcript as it was captured. It does not guess
  which copied turns belong to another session.

To see each target's ownership policy, run
`trajectory session resume --list-targets`. It shows `target-native` or
`view-only`.

The detailed tables below explain the condition behind each `P`. For example,
headless sessions and sessions with an unknown run mode skip segmentation.
Some saved-history paths also leave out token and cost attribution but keep
the base metrics.

### Detailed Coverage

These tables show capture detail first, then privacy and segmentation.

Trajectory applies incognito on its server. So incognito works for any
captured session once it is on for that session. Trace and log content does
not go to Datadog destinations, except exempt ones. Metrics leave out model and
repository names by default. The privacy table shows whether setup gives each
client its own way to turn incognito on.

Task segmentation is a core feature for captured sessions that are not
headless. Trajectory captures and publishes headless sessions when you
configure it to. It always skips segmentation for them.

Segmentation uses a classifier, which is a local headless CLI that Trajectory
runs. Which classifier Trajectory picks does not change which sessions can be
segmented. When a session has enough saved content to segment, Trajectory
prefers the matching local headless CLI:

- The default fallback list is Claude, Codex, OpenCode, and Cursor Agent.
- Managed org configuration can change that order or add Antigravity (`agy`).
- Antigravity sessions prefer Antigravity.
- Trajectory never picks the retired Gemini CLI as a classifier.

Current Antigravity hooks carry no prompt text. So an Antigravity session
needs saved history before it has enough text to segment. The tables below
show this.

### Capture And Telemetry

| Client | Live capture | Tool/model events | Token/cost usage | Backfill | Resume |
|--------|--------------|-------------------|------------------|----------|--------|
| Claude Code | Yes. Native HTTP hooks for tools and messages, plus command hooks for lifecycle events. | Yes | Yes | Transcript backfill and repair of live events | Yes |
| Codex CLI | Yes. Command hooks, with the rollout watcher as a fallback. | Yes | Yes | Codex rollout backfill | Yes |
| GitHub Copilot CLI | Beta plugin command hooks. Optional session-state watcher, off by default. Native OTel with content turned off. | Hooks give lifecycle, prompt, tool, and session events. History adds assistant text, reasoning, tool results, permissions, subagents, and the request model that native OTel uses. | Native `chat` spans give input, output, cache, and reasoning tokens for each request. They add public-rate USD by model when both managed features are on. Shutdown totals are the fallback. | Bulk backfill. Automatic discovery needs `copilot_cli_durable_history`. | Not yet |
| Antigravity CLI (`agy`) | Yes. Native plugin command hooks. | Tool calls, input, results, errors, invocation boundaries, Stop metadata, and a hook model label that is not used for cost. With `antigravity_durable_history`, also user prompts, timestamps, workspaces, and schema-v1 models. | Live rows give uncached input, output (including reasoning), cache-read, and cache-creation tokens for each request. They add public-rate USD, joined to the hook turn. Saved history does not produce metrics. | Optional watcher, off by default, for saved JSONL and SQLite rows. A separate live reader captures new model calls. Backfill imports history from before the watcher started. | No setup-managed resume |
| Goose | Yes. Open Plugins command hooks. | Session, prompt, assistant, and tool events. Hooks omit tool IDs and result bodies, so matching two calls to the same tool is best effort. | Hooks omit usage. `goose_durable_history`, on by default, adds model, input, output, and optional cache tokens, plus compaction. Only complete USD that the client reports counts. | Read-only SQLite sync through `goose_durable_history`. Traces from history keep their metadata and tool data. Traces from hooks get usage updates only. | After a session ends, a new hook event reopens it with the same ID. No setup-managed resume command. |
| Cline CLI | Yes. File hooks. | Lifecycle, prompt, tool, assistant-message, turn, and session-end events | Not in current hook payloads (`turn_end.tokens_status=unavailable`) | Not yet | No setup-managed resume |
| Cursor Desktop | Yes. Command hooks. | Yes | Native input, output, cache-read, and cache-write tokens. Rate-card cost defaults to `emit` with `org_file`. Without a synced rate card, turns stay unpriced. Child usage comes only from complete child data. Other `subagent_stop` records are marked unavailable or partial. | Cursor chat import. Backfill republishes under the live metric names with the original timestamps. | Yes |
| cursor-agent CLI | Native command hooks when the CLI runs them, plus a shared JSONL watcher and backfill | Model text, thinking, tool requests, actual tool results, and turn markers | Same native token set as Desktop. Saved-history records have no token data and stay unpriced. Trajectory never copies the parent turn's usage to a child task. | Current main and child JSONL files, and older flat JSONL files. Backfill republishes under the live metric names with the original timestamps. | No setup-managed resume |
| Factory Droid | Beta. Factory plugin command hooks. | Documented lifecycle, prompt, tool, notification, compaction, stop, and subagent-stop events | Not in current documented hook payloads | Not yet | Not yet |
| Hermes Agent | Yes. Observer plugin hooks, plus optional history sync, off by default. | Yes | Live observer usage when present. Saved history keeps session totals without per-turn attribution. | Read-only `state.db` watcher plus backfill | No setup-managed resume |
| Amp Code | Yes. Setup-managed system plugin. | Yes | Live events omit usage. Optional saved history, off by default, adds model and token data and the model provider's credits. Credits are not counted as USD. | `T-*.json` thread sync behind `amp_durable_history`. Plugin traces take priority. | No setup-managed resume |
| Qwen Code | Yes. Native HTTP hooks, plus optional history sync, off by default. | Yes | Yes, from Qwen `usageMetadata`, with the transcript as a fallback | Chat JSONL watcher for the active branch, plus manual backfill that includes archives | No setup-managed resume |
| OpenHands | Yes. Command hooks, plus optional history sync. | Hooks give lifecycle, prompt, and tool events. Saved bundles add assistant text, thinking, tool input and results, model, and CWD. | Hooks have no usage. `base_state.json` gives model provider totals and cost for the session only. | `trajectory session import openhands`, plus a watcher behind `openhands_durable_history` | Native resume uses the same conversation ID. No setup-managed resume command. |
| Aider | Opt-in command shim. Optional sync of native Markdown history from folders you name, off by default. | The wrapper gives lifecycle, prompt, assistant, and turn events. History adds prompt, assistant, model, and status text, but no structured tool calls. | The wrapper keeps usage and cost for each model call. History counts mix model provider data and local estimates, rounded for display. Printed cost is the client's own figure. | Watcher plus `session import aider`, behind `aider_durable_history` | No setup-managed resume. History has no session-end marker. |
| Continue CLI | Yes. Opt-in `cn` command shim. | Lifecycle, prompt, assistant-message, tool, outer-turn, and session events. Tool events come from the transcript. | Yes, from Continue session JSON when it has usage data | Current run only. No bulk history. | Native CLI `--resume` and `--fork` are captured when the start job records a clean starting state. Otherwise Trajectory does not attribute the session. |
| Mistral Vibe | Yes. Opt-in `vibe` command shim, plus native hooks for session identity and tools. | Lifecycle, prompt, tool, assistant-message, and turn events | Valid session totals for root and nested sessions, and the client's cost estimate. No per-turn attribution. Unclear continuation totals are dropped. | Optional watcher for root and nested sessions, off by default, plus repair by import | Hook data takes priority. Resume and child sessions keep their client IDs. Saved snapshots stay incomplete until a native session end arrives. |
| Grok Build | Preview native global hooks, plus sync of saved sessions | Lifecycle, prompt when present, assistant and reasoning text, tools and results, model, and parent and child links | No tokens or cost per turn. Session counters are for diagnosis only. | Optional watcher for root and nested sessions, off by default, plus repair by import | Hook data takes priority. Snapshots and deletions never mark a session as ended. |
| Codebuff | Yes. Opt-in command shims and a chat-history import after each run. | Lifecycle, prompt, assistant-message, and turn events | Yes, from usage data in `~/.config/manicode*/projects/*/chats/*/chat-messages.json` | Codebuff chat history backfill | No setup-managed resume |
| Pi | Yes. TypeScript extension. | Yes | Yes | Import from `.pi/agent/sessions`, plus optional `pi_history_backfill`, off by default, for idle files that were never captured. Parent sessions are resolved. History is not refreshed continuously. | Yes |
| Oh My Pi (`omp`) | Preview native extension plus history sync, behind a feature flag | Lifecycle, prompts, assistant and model, tool results and errors, compaction, and session links from file headers | Native input, output, cache, and total tokens, plus model provider cost when present | Sync of v3 history that follows the active profile and XDG paths, plus full-history repair | Native OMP resume, switch, and branch. Trajectory records them but does not start resume. |
| OpenCode | Yes. Plugin SDK events. | Yes | Yes | `session import opencode` for JSON storage and SQLite. Opt-in watcher for new and changed sessions. | Yes |
| Kilo Code | Yes. Plugin SDK events. | Yes | Native model, model provider, input, output, reasoning, cache-read, and cache-write tokens, and cost. Optional native OTLP. | `session import kilo`, plus an optional SQLite and JSON watcher, off by default | No setup-managed resume |
| Kiro CLI | Yes. Agent command hooks. | Prompt, tool, assistant response, and saved models and timestamps | Not in hooks or saved history. Trajectory does not estimate it. | Optional JSONL and SQLite sync through `kiro_durable_history`, off by default. Hook traces take priority. | Native `--resume-id`. No setup-managed resume. |
| Devin CLI | Beta. Sync of `sessions.db` and transcripts. Hooks act as wake hooks only. | Prompt, assistant, thinking, tool, model, and lifecycle data from the local files | Prompt, completion, and cache tokens for each step. Trajectory parses the final session total but does not record it. | No bulk import. Only active and changed sessions sync. | Native `devin --resume`. No setup-managed resume. |
| Qoder CLI | Beta. JSONL transcript sync. Native plugin hooks act as wake hooks. | Prompt, assistant, thinking, tool, model, subagent, and lifecycle data | Native prompt, completion, cache-write, and cache-read tokens | No bulk import. Only active and changed sessions sync. | Native Qoder resume. No setup-managed resume. |
| ZCode | Preview wake hooks plus SQLite sync | Session ID, parent, CWD, prompt, assistant and thinking text, model, model provider, and tools and results | Input, output, reasoning, cache-create, and cache-read tokens for each attempt and turn. Cost only when a known rate applies. | Automatic sync plus `session import zcode` | Active updates keep a session open. Only an archived session can end. |
| CommandCode | Preview watcher. Native hooks act as wake hooks. | Prompt, assistant, thinking, tools and results, CWD when a hook or metadata file gives it, and Stop turn boundaries. No session-end event. | The client saves no reliable usage or cost. Later estimates stay marked as estimates. | Existing and changed transcripts sync in passes of limited size | Native CommandCode resume only. No setup-managed resume. |
| Muse Code | Preview watcher for append-only logs. Managed hooks act as wake hooks. | Session ID, CWD, prompt, assistant, tools and results, compaction, turn end, SessionEnd, the model when recorded, and nested subagent identity | Native input, output, cache, and reasoning tokens. Exact `muse-spark-1.1` gets a public-rate USD estimate. The client reports no USD. Unknown or newer model IDs stay unpriced. | When the watcher starts, it skips completed saved sessions and replays active ones from the start. New logs sync as they grow. | Native Muse resume. No setup-managed resume. |
| Kimi Code CLI | Preview watcher. Hooks act as wake hooks. | Prompt, assistant, thinking, tools and results, model, stop reason, main, subagent, and fork metadata, and lifecycle | Native input, output, cache-read, and cache-create tokens. Trajectory computes cost and labels it as computed. | Current `~/.kimi-code` sessions and older `~/.kimi` sessions, without duplicates. Active and changed sessions sync. | Native Kimi resume. No setup-managed resume. |
| gptme | Preview watcher. Native hooks carry metadata only and act as wake hooks. | Prompt, assistant, thinking, tools and results, model, and lifecycle | Native tokens for each message, added up for each user turn. Recorded cost is labeled as computed. | Existing and changed conversation, events, and config files sync in passes of limited size | Native gptme resume. No setup-managed resume. |
| CodeWhale | Preview watcher. Saved sessions and runtime threads are the source. Native hooks act as wake hooks only. | Prompt, assistant, thinking, tools and results, model and model provider when the client records them, forks, and runtime lifecycle | Input, output, cache, and reasoning tokens for each runtime turn. Saved totals and client-computed cost stay at the session level. | Current and migrated saved sessions, plus runtime thread, turn, item, and event stores. Linked runtime and saved IDs are merged. | Native CodeWhale resume. A plain `exec` run is not captured unless stream-JSON or resume saves it. |
| ForgeCode | Preview read-only `.forge.db` sync, behind a feature flag | System, prompt, assistant, reasoning, tools and results, failures, model, CWD, and child conversations | Actual native counts are recorded as real. Approximate or mixed counts stay marked as estimates. Cost that the client reports keeps that source label. | Existing and changed conversations from the active root sync in passes of limited size | No setup-managed resume. Saved rows do not mark sessions as live or ended. |
| Warp/Oz CLI | Preview sync of the local stores, behind a feature flag | Prompt, assistant, reasoning, tools and results, model, working directory, and task and subagent hierarchy | Not recorded. The native conversation total is kept for diagnosis only. Trajectory does not split it into input and output or estimate cost. | Active and changed local stores. No import of cloud runs. | Native Warp/Oz resume only. No setup-managed resume. |
| Windsurf | Beta. Native Cascade hooks wake the transcript sync. A fallback repairs older history from the legacy database. | Prompt, assistant, lifecycle status, and model, only when present. Trajectory does not infer tools. | Not in the public transcript or legacy database schemas. No cost. | Fallback that reads stable and Next `ItemTable` history | Native Cascade conversations. No setup-managed resume. |
| Zed | Beta. Read-only `threads.db` sync. | Prompt, assistant, thinking, tool, model, CWD, and subagent links | Trajectory parses the native session total but does not record it or assign it to turns | Changed sessions only | No setup-managed resume |
| OpenClaw | Saved-history import beta. JSONL history sync, off by default. Released builds do not capture OpenClaw live. | Prompt, response, thinking, tools and results, model, compaction, and agent links | Native token counts for each message and the cost that the model provider billed, when saved. | `session import openclaw`, plus a watcher behind `openclaw_durable_history` | No setup-managed resume |

### Privacy And Derived Features

Two kinds of test appear in the Coverage note column:

- A **spending-stop test** runs segmentation end to end. It checks that
  segmentation makes no model provider call until that provider path has a
  spending hard stop.
- A **positive segmentation test** checks that segmentation runs for a
  session that qualifies.

| Client | Incognito UX | MCP incognito tool | Segmentation | Coverage note |
|--------|--------------|--------------------|--------------|---------------|
| Claude Code | `/trajectory:incognito` command and incognito skill | Yes | Non-headless sessions qualify. Headless sessions are skipped. | Live incognito UX. End-to-end spending-stop test. |
| Codex CLI | Incognito skill with a bundled script fallback | Yes | Non-headless sessions qualify. Headless sessions are skipped. | Live incognito UX. End-to-end spending-stop test. |
| GitHub Copilot CLI | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions qualify. Headless sessions are skipped. | Spending-stop fixture test. No live incognito UX test yet. |
| Antigravity CLI (`agy`) | `/incognito` command and incognito skill | Yes | Current hooks give no prompt or assistant text to segment | MCP and incognito setup are tested. Positive segmentation and live incognito UX tests need saved history. |
| Goose | Setup-managed `goose-incognito` command | No | Hooks do not report the run mode. So sessions are treated as headless and skipped. | Headless-skip fixture test. No interactive-mode or live Goose incognito UX test yet. |
| Cline CLI | Setup-managed `cline-incognito` command plus an MCP request | Yes | Non-headless file-hook sessions qualify. Headless sessions are skipped. | Spending-stop fixture test. No live Cline UX test yet. |
| Cursor Desktop | Incognito skill. It uses the Claude skill when available, or a native Cursor fallback. Setup also installs `cursor-agent-incognito`. | Yes | Non-headless GUI sessions qualify. Headless sessions are skipped. | Positive segmentation test deferred. The GUI and transcript watcher have no stable non-headless hook stream that runs without credentials. |
| cursor-agent CLI | Setup-managed `cursor-agent-incognito` command when the Cursor integration is installed. The watcher has no native slash command. | No | Saved history stays local and is not replayed for segmentation. Hook sessions follow their own known path. | Live `cursor-agent --print` check that hook and saved-history sessions get the same ID. The shared saved-history store does not record which product wrote it. |
| Factory Droid | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions qualify. Headless sessions are skipped. | Spending-stop fixture test. No live Droid incognito UX test yet. |
| Hermes Agent | Incognito skill | Yes | Non-headless observer sessions qualify. Headless sessions are skipped. | Spending-stop fixture test. Live capture tests. No live incognito UX test yet. |
| Amp Code | Setup-managed `amp-incognito` command plus an MCP request | Yes | Non-headless Amp plugin sessions qualify. Headless sessions are skipped. | End-to-end tests cover saved capture and the spending stop. Amp sends no session-end signal, so Trajectory cannot close the final task yet. |
| Qwen Code | `/incognito` command and incognito skill | Yes | Non-headless Qwen hook sessions qualify. Headless sessions are skipped. | Spending-stop fixture test. Setup and live capture tests. No live incognito UX test yet. |
| OpenHands | Setup-managed `openhands-incognito` command plus an MCP request | Yes | Hook payloads have no run-mode field. So hook and history-only sessions are treated as headless and skipped. | Fixture tests for the headless skip and for a set mode. Live hook tests, and local UI tests of saved history. |
| Aider | Setup-managed `aider-incognito` command | No | Wrapper sessions qualify when not headless. Saved-history sessions have an unknown run mode, so they are treated as headless and skipped. | End-to-end spending-stop test through the wrapper. Setup, inventory, and history fixture tests. |
| Continue CLI | Setup-managed `continue-incognito` command | No | Wrapper sessions qualify when not headless. Headless sessions are skipped. | Spending-stop fixture test. Setup, inventory, and command tests. |
| Mistral Vibe | Setup-managed `vibe-incognito` and `mistral-vibe-incognito` commands | No | Wrapper and hook sessions qualify when not headless. Headless sessions are skipped. | Spending-stop fixture test. Setup, inventory, and command tests. |
| Grok Build | Setup-managed `grok-incognito` command and `trajectory-incognito` skill | No | Sessions from saved history only stay unknown and are treated as headless. Sessions where the hooks report a mode may qualify. | Fixture and control tests. Signed-in hook and incognito UX tests are pending. |
| Codebuff | Setup-managed `codebuff-incognito` and `cb-incognito` commands | No | Wrapper and imported sessions qualify when not headless. Headless sessions are skipped. | Spending-stop fixture test. Setup, inventory, and command tests. |
| Pi | Native `trajectory_incognito` tool plus MCP | Yes | Non-headless extension sessions qualify. Headless sessions are skipped. | Live incognito UX. Spending-stop fixture test. Extension verdict tests. |
| Oh My Pi (`omp`) | MCP request. No setup-managed slash command yet. | Yes | Non-headless sessions qualify. Headless sessions are skipped. | Setup and capture fixtures only. Live incognito UX and positive segmentation tests are pending. |
| OpenCode | Incognito skill | Yes | Non-headless plugin SDK sessions qualify. Headless sessions are skipped. | Live incognito UX. Spending-stop fixture test. |
| Kilo Code | Incognito skill | Yes | Non-headless plugin SDK sessions qualify. Headless sessions are skipped. | Spending-stop fixture test. Setup and live capture tests. |
| Kiro CLI | Setup-managed `kiro-incognito` command plus an MCP request | Yes | A final segmentation test is deferred. Current documented command hooks have no `SessionEnd` signal. | Capture tested with fixtures only, plus command tests. No positive segmentation test yet. |
| Devin CLI | Global `/incognito` skill | Yes | The run mode is unknown. So sessions from saved history are treated as headless and skipped until a reliable mode signal exists. | Sanitized fixtures test saved incognito state, redaction, and session end from the client's files. Interactive mode, live sign-in, and incognito UX are not tested yet. |
| Qoder CLI | Native plugin `/incognito` command and skill | Yes | The run mode is unknown. So sessions from saved history are treated as headless and skipped until a reliable mode signal exists. | Fixture tests cover replaced snapshots and changes to saved history. Live token, session-end, and incognito UX tests are follow-ups. |
| ZCode | User incognito skill that calls `trajectory_incognito` | Yes | Sessions from saved history only are treated as headless and skipped | Setup, MCP ownership, history sync, and local UI fixtures. A signed-in incognito UX test is pending. |
| CommandCode | Trajectory's own `/incognito` command and skill. They need the session ID. Turn incognito off by hand, because the client sends no session end. | Yes | Sessions are treated as headless until a reliable mode signal exists | Fixture and Lapdog tests. Live signed-in hook and incognito UX tests are a follow-up. |
| Muse Code | Trajectory's own incognito skill. It needs the session ID when more than one session could match. | Yes | The run mode in saved history is unknown, so sessions are skipped | Tests of the pinned stable binary with an echo model, in interactive and headless mode, plus managed hook tests. Signed-in incognito through the model is a follow-up. |
| Zed | Global `trajectory-incognito` skill | Yes | Saved history has an unknown run mode, so sessions are treated as headless and skipped | Fixture and local UI tests only. Live Zed incognito UX and session-mode tests are follow-ups. |
| Kimi Code CLI | User incognito skill | Yes. It needs the session ID when more than one session could match. | An unknown run mode is treated as headless and skipped | Sanitized current and older fixtures, plus headless-skip, local UI, and Lapdog tests. A live read-only test is pending. |
| gptme | Native `/incognito` command | Yes | Non-interactive and unknown modes are skipped | Real gptme 0.32.0 headless lifecycle test with the mock echo model. Non-headless fixture tests cover capture and the spending stop. |
| CodeWhale | `/incognito` skill prompt that calls `trajectory_incognito` | Yes | An unknown run mode is skipped. Sessions with a known non-headless mode qualify. | The slash command relies on the model choosing the tool to turn incognito on. It is not a native toggle. To turn it off, it shows the user a terminal command, because the tool refuses to turn incognito off and the command allows no shell tool. Stream-JSON saving, the privacy skip, and positive output are tested with fixtures only, until the pinned live binary is published. |
| ForgeCode | Trajectory's own `/incognito` command and `trajectory-incognito` skill. They need the session ID. | Yes | An unknown run mode in saved history is treated as headless and skipped | Fixture and Lapdog tests only. Live incognito through the model and run-mode tests are follow-ups. |
| Warp/Oz CLI | Global Trajectory incognito skill | Yes | Sessions from local stores are treated as headless and skipped | Fixture tests cover store capture and the Lapdog task hierarchy. Interactive mode, session end, live sign-in, and incognito are not tested yet. |
| Windsurf | Global `/incognito` workflow | Yes | Non-headless sessions qualify. Headless sessions are skipped. | JSONL record and Lapdog fixture tests. Positive segmentation, live hook, SessionEnd, and incognito UX tests are not done yet. |
| OpenClaw | Control plane only. Released builds have no live OpenClaw capture to control. | No | Saved-history sessions are treated as headless and skipped. | Deferred. Setup, MCP, and incognito are not available. |

### Cost Checks

To check local cost and how well each supported client reports it, run these
commands:

- `trajectory cost` shows local cost.
- `trajectory cost pricing` totals provisional and verified local USD for the
  selected time window. It does not change recorded attribution.
- `trajectory cost inspect --session <id>` shows the cost data for one
  session.
- `trajectory cost validate` reports recent cost coverage for Claude Code,
  Codex, Gemini, Pi, OpenCode, Cursor, Hermes Agent, Amp Code, Qwen Code, Kilo
  Code, and Mistral Vibe.

The Mistral Vibe row in `trajectory cost validate` is a `session-aggregate`
row. It keeps the whole-session cost that Vibe reports. It does not create
turns with tokens or cost. The Gemini row covers only sessions that Trajectory
saved before it retired Gemini CLI support.

Codex cost output shows three values separately: observed tokens, USD at
standard API rates, and ChatGPT Codex credits. Guardian oversight usage gets a
provisional estimate from the `codex-auto-review` proxy rates:

- $2.50 per million input tokens
- $0.25 per million cached input tokens
- $15 per million output tokens

These are third-party rates. Trajectory has not checked them against OpenAI
billing, so cost output labels the estimate as provisional. If any token type
has no rate, the cost stays unavailable. If Codex cost data is out of date,
`trajectory cost inspect` reports it and leaves it out. Run
`trajectory session import codex --force` to rebuild it from the rollout.

## Recommended vs Manual Installs

Use `trajectory setup --clients ...` for normal installs. It sets up
everything each client needs: hooks, MCP entries, skills, commands, local
binaries, and local marketplace metadata.

With `--clients`, setup only adds or updates clients. It skips the prompts for
Datadog site, service name, and API key. It also leaves your export
configuration as it is. To change Datadog export settings, run
`trajectory setup` without `--clients`.

For development or manual recovery, you can still install a plugin directly or
from a local copy. If you do, follow these steps:

1. Copy or install the plugin from a local folder that will stay in place.
2. Copy the integration configuration that setup would have written.

A plugin-only install may load the extension but miss MCP tools, incognito
controls, commands, or the capture hooks that full telemetry needs.

OpenClaw is the one exception. Released builds only import its saved history.
See [OpenClaw](#openclaw).

### Agent Security on Copilot CLI

Copilot CLI lets a hook stop only the actions that are about to run, so Agent
Security enforces less on Copilot than on Claude Code:

| Copilot hook | What Agent Security can do |
| --- | --- |
| `preToolUse` | Deny the tool call. The reason goes to Copilot in `permissionDecisionReason`. |
| `permissionRequest` | Deny the permission request. |
| `postToolUse` | Send a finding to the model in `additionalContext`. The tool has already run. |
| `userPromptSubmitted`, `sessionStart`, `postToolUseFailure` | Record findings only. Copilot treats a hook's exit 2 as a warning on these events. |
| `agentStop` | Record findings only. Its only output makes the agent keep working, which is not a block. |

## Claude Code

**Status:** Supported. Minimum supported version: 2.0.0, from the
compatibility contract. Live replay tests run 2.1.215.

**Install.** Run setup:

```bash
trajectory setup --clients cc
```

Setup builds a local Claude Code marketplace in
`~/.trajectory/claude-marketplace`. It registers that directory with Claude's
plugin manager and installs `trajectory@trajectory` at user scope.

Setup, binary updates, and MCP startup all check the installed plugin. They
look at Trajectory's user-scope registry entry and the
`~/.claude/plugins/cache/trajectory/trajectory/` folder. If the installed copy
is stale or invalid, Trajectory writes a fresh copy and points its own
user-scope entry at it. It keeps the previous copy for sessions that are still
running. It leaves project and local scope entries alone.

If Claude managed settings enable `trajectory@trajectory`, Claude records the
plugin at managed scope. Trajectory checks and repairs that entry the same way,
so user settings do not need the plugin keys.

**Claude settings.** Trajectory never adds, merges, or deletes Claude user
settings. This covers `~/.claude.json`, `~/.claude/settings.json`, and other
settings files. Setup does call Claude's own plugin manager to install or
repair the plugin. Claude may update its own plugin registration fields.

- Setup checks that the plugin manager kept every existing settings value.
- If the plugin manager rewrote settings destructively, setup restores the
  original files byte for byte and fails.
- Automatic startup and update repair never call Claude. They change only
  Trajectory's plugin registry entry and cache.

**MCP.** The plugin declares its MCP server in one root `.mcp.json` file. Setup
does not run `claude mcp add` or `claude mcp remove`. If you already have a
user MCP entry for Trajectory from a released version, Trajectory keeps it
unchanged. In that case it installs a plugin copy without an MCP declaration.

**Managed fleets.** A Claude administrator can roll out the plugin through
managed settings:

1. Declare the staged directory as an `extraKnownMarketplaces.trajectory`
   directory source.
2. Set `autoUpdate: true`.
3. Enable `trajectory@trajectory`.

Claude can also update installed plugins in the background after startup.
Trajectory's own repair does not depend on that update.

**Uninstall and repair.** The local marketplace directory stays in place while
Trajectory is installed. This includes after `trajectory uninstrument cc`,
because Claude's marketplace and plugin registration may still point to it.
So these commands keep working:

- `claude plugin marketplace update trajectory`
- `claude plugin update trajectory@trajectory --scope user`

Removing the plugin or marketplace in Claude does not remove the Trajectory
CLI or its files. To restore registration and the plugin, run
`trajectory setup --clients cc`. `trajectory doctor` reports an installed
Trajectory plugin whose local marketplace is missing. It names that repair
command.

**Plugin updates in running sessions.** A running Claude session keeps the
plugin version it loaded. A background update changes only the files on disk.
To load the new files in place, run `/reload-plugins`. A new session loads them
automatically. You do not need to close Claude.

An update or MCP startup can find an older Trajectory capture server still
running. Trajectory replaces it only after its active client sessions end.
Until then it records `active_sessions_deferred`, leaves the old server
running, and retries later. This avoids a gap in capture. Trajectory never
signals a legacy, external, or unidentified server.

**Manual install.** For manual recovery or work from a source checkout, adopt
the staged marketplace directly:

```bash
claude plugin marketplace add ~/.trajectory/claude-marketplace
claude plugin marketplace update trajectory
claude plugin install trajectory@trajectory --scope user
```

From a source checkout, use the checkout root instead of
`~/.trajectory/claude-marketplace`.

**Transcript location.** Trajectory finds Claude Code transcripts the way
Claude documents its configuration root:

- If `CLAUDE_CONFIG_DIR` is set and not empty, Trajectory reads and writes
  session history only under `$CLAUDE_CONFIG_DIR/projects`.
- Otherwise it uses `~/.claude/projects`.
- It never merges the default folder into an overridden one.
- A `transcript_path` from Claude's hooks takes precedence over both.

This override applies only to transcripts and session history. It does not
move Trajectory's Claude plugin, settings, or credential handling. Trajectory
does not support `CLAUDE_PROJECTS_DIR`, multiple config roots, or XDG fallbacks
for Claude Code. They are not part of the
[Claude Code environment-variable contract](https://code.claude.com/docs/en/env-vars).

**What Trajectory captures.** The plugin ships the standard Claude
`hooks/hooks.json` file with 17 registered capture events. Claude Code loads
that file automatically. The plugin manifest does not list it, because listing
it would load the same file twice.

- `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, and streaming
  `MessageDisplay` use Claude's native loopback HTTP hooks on macOS and Linux.
- Lifecycle and permission-request events use command hooks. These can start
  the capture server when it is not running.
- `PermissionDenied` records denials from the auto-mode classifier.
- Trajectory matches a manual allow or deny to a captured permission request
  through the later tool or transcript events.
- Transcript repair never invents a missing permission request.

The command hooks run `hooks/capture-with-serve.sh` in a shell that contains
capture failures and output. That script passes lifecycle flags to
`trajectory capture-hook`. When an event is missing, inspect the script
together with `hooks.json`.

Most command hooks first post the event once to a running capture server and
wait at most 250 ms. `SessionStart` and `SessionEnd` skip that post. If the
post does not succeed, the hook saves the payload to a private file and hands
it to a background worker. The worker starts or notifies the capture server. So
server recovery, retries, and publishing never block a prompt, a turn, or
Claude's exit. Each hook finishes inside its Claude Code timeout. For details,
see [client instrumentation](CLIENT-INSTRUMENTATION.md).

**Headless sessions.** Claude `--print` sessions have no `transcript_path`, so
Trajectory marks them as headless. When export is configured, Trajectory
collects and publishes headless coding-agent sessions by default. Segmentation
always skips headless sessions. To stop collecting headless agent sessions,
except Trajectory's own, run:

```bash
trajectory config set capture.include_headless_agents false
```

Trajectory always leaves out its own classifier and segmenter subprocesses.

**Native OpenTelemetry.** Trajectory can relay Claude Code's native OTLP logs,
metrics, and traces through the local `trajectory serve`. This works in either
case:

- `trajectory claude` launches Claude with local OTLP environment overrides.
- Your effective Claude settings point those signals at the local OTLP
  endpoints.

Setup does not write, merge, or delete Claude user settings. Older Trajectory
versions wrote a user-scope OTLP env block. If setup finds that exact block, it
warns and leaves the file unchanged. If Claude managed settings own the OTel
configuration, an administrator must make any lasting change there.
Trajectory leaves managed OTLP routes untouched.

`trajectory claude` keeps the OTLP protocol from your Claude settings. It
checks the per-signal protocol first, then `OTEL_EXPORTER_OTLP_PROTOCOL`. If
neither is set, it uses `http/json`.

The `trajectory claude` launcher also captures full content. Its Bun or Node
preload records each complete Anthropic request and response body by default.
Before Trajectory stores a body, the capture redaction replaces secrets and
personal data in it, as it does in captured prompts. LLM spans show the bodies
as input and output in Datadog and in the local UI (Lapdog).

From the native logs, Trajectory keeps only `skill_activated` records. It
stores them locally as `Skill` tool activations tagged
`detected_from:claude_native_otel`.

To forward native telemetry to your own collector, set
`server.otlp_proxy.endpoint`. If your Claude settings already name a
collector, the launcher relays to it for that launch. Trajectory forwards the
original OTLP logs, enriched OTLP metrics, and native traces.

- Forwarded native traces go to a separate ml_app, by default
  `<export.ml_app>-claude-native`.
- Each trace sits in a `claude-native:<session>` session and keeps the raw
  session ID as `claude_code.session_id`.
- Traces carry `trajectory.telemetry_plane:native_client_otlp`. You can query
  them without merging them into the Trajectory session.
- Forwarded native metrics carry `trajectory.cost_role:client_telemetry` and
  `trajectory.cost_source:claude_native_otlp`. Use these tags to keep native
  client totals apart from Trajectory's attribution metrics.

Trajectory also writes safe local trace summaries under
`~/.trajectory/state/otlp-proxy/traces/`. Skill complexity metrics prefer the
native Claude tool spans in these summaries. The `skill_attribution` tag shows
where a skill window came from:

- `span_tool_attribute` and `span_temporal` come from native traces.
- `turn_assisted` comes from the same-turn fallback.

### Skill Observability

Trajectory attributes Claude skills from the native transcript and from OTLP.
Neither path changes your skill files.

**Native transcript.** Current Claude builds write `message.attributionSkill`
into the transcript. Trajectory treats this field as the main skill signal.
When it processes a turn, it adds the skill to the `agent_message` and
`turn_end` events. Ingest then creates a high-confidence `skill-invoked` marker
tagged `detected_from:claude_native_transcript`.

**Metrics.** The skill invocation metric has these dimensions: `repo`,
`skill_name`, `detected_from`, `source_scope`, `signal_confidence`,
`attribution_reason`, and `trajectory.client_version`. Older observation
metrics keep their smaller dimension set for compatibility.

Use the `trajectory.client_version` dimension to spot changes in Claude. If a
newer Claude version stops writing `attributionSkill`, invocation metrics move
away from `detected_from:claude_native_transcript`. Lower-confidence
observations may continue.

**Skill-file hooks (fallback).** This fallback is off by default, because it
writes hook metadata into the frontmatter of user or project `SKILL.md` files.
Normal setup leaves out its prompt-time sync hook. To opt in:

1. Enable the feature and stage the plugin.
2. Let Claude adopt the plugin through its managed or user update path.
3. Sync the skills you choose.

Trajectory records what it changed in
`~/.trajectory/state/claude-skills/manifest.json`, so you can undo it:

```bash
trajectory config features enable claude_skill_file_hooks
trajectory setup --clients cc
trajectory claude skills status
trajectory claude skills sync --user
trajectory claude skills sync --project
trajectory claude skills restore --stale
```

To sync project `.claude/skills` files, also set
`TRAJECTORY_CLAUDE_SKILLS_PROJECT=1` or add a
`.trajectory/claude-skills-project-enabled` marker file to the project. Normal
setup and removing the Claude integration never edit these files. To remove
only the hook entries that Trajectory added, run `trajectory claude skills
restore`. It keeps all other skill metadata.

**Read virtualization.** On supported macOS launch chains, you can test skill
hooks without changing project files:

```bash
trajectory claude --skill-read-virtualization --skill-managed-binary -- <claude args>
```

This mode serves modified `SKILL.md` content through a managed copy of the
Claude launcher. Your real skill files stay unchanged. If the runtime or
managed settings block this path, use the manual `sync`, `status`, and
`restore` commands instead. Trajectory does not report scoped skill attribution
when this path is blocked.

Read virtualization is useful for testing the `SKILL.md` transformation and for
hook experiments. A successful virtualized read does not mean Claude will run
the hook metadata in the skill file.

For the full guide for skill maintainers, run
`trajectory user-guide skill-observability`.

## Codex CLI

**Status:** Supported. Minimum supported version: 0.128.0, from the
compatibility contract. The [Quick Reference](#quick-reference) lists the
live-replayed and latest checked releases.

**Minimum version.** Codex 0.128.0 is the first version where hooks bundled in
a plugin work from end to end. Earlier versions added the pieces one at a time:

- **0.118.0**: plugin system and hook notifications.
- **0.120.0**: `SessionStart` hooks can tell session types apart, and Stop
  hooks can show prompts live.
- **0.121.0**: the `codex plugin marketplace add` command.
- **0.128.0**: Codex finds and fires hooks bundled with marketplace plugins
  automatically.

Earlier versions may work in part, for example a marketplace without hook
discovery. For reliable capture, use 0.128.0 or later.

**Install.** Run setup:

```bash
trajectory setup --clients codex
```

Setup writes a local marketplace in `~/.trajectory/codex-marketplace` and
registers that path with Codex. It installs the hook helper and an optional
launcher under `~/.trajectory/bin/codex-hook/<version>-<sha256>/`. Hook
commands use a stable `codex-hook/current` selector, so updates do not change
the hook command that Codex trusts.

Setup asks Codex which hooks it loaded from the installed plugin. It checks
that every reported handler belongs to `trajectory@trajectory`. Then it asks
Codex to trust them and reads the trust state back. Setup succeeds only when
Codex reports every supported handler as trusted. Codex still shows its own
first-use workspace trust prompt.

Trajectory keeps the trust hashes that Codex reported during later mode
changes, updates, and startup repair. These changes do not rewrite the trusted
hook commands or matchers. A running Codex process keeps the hooks it loaded at
startup. Repairs apply to new sessions.

If an asset repair fails, Trajectory installs a fallback that runs the full
`trajectory` binary. Rerun setup after that, so Codex can approve the changed
hook definition. Trajectory keeps two older helper versions for rollback and
for sessions that are still running.

You can also register the GitHub marketplace directly. This is not the
recommended path. Codex refreshes git marketplaces at startup, which can delay
the first screen on a slow network.

**Finding Codex.** Setup looks for Codex on `PATH`, in common user install
folders, and in Volta, nvm, fnm, npm, pnpm, yarn, asdf, and mise/rtx. For npm
installs, setup also looks for the bundled native Codex binary before it falls
back to the node launcher. Each candidate must pass `codex --version`. Setup
skips broken candidates and uses the first one that works.

If every `codex --version` candidate failed with `ENOENT` under an npm, nvm,
fnm, or Volta path, the launcher is there but its native binary is missing. To
fix it:

1. Repair or reinstall the Codex CLI, or install the standalone or Homebrew
   Codex binary.
2. Run `trajectory setup --clients codex` again.

**What Trajectory captures.** Codex capture combines a few hooks with the
session rollout files that Codex writes.

- Hooks in the default boundary mode: `SessionStart`, `UserPromptSubmit`, `Stop`, `SessionEnd`, and
  `PreToolUse` and `PostToolUse` matched to `^Bash$`. The Bash hooks capture
  only immediate PR-work activity.
- Rollout watcher: it reads `$CODEX_HOME/sessions/`, normally
  `~/.codex/sessions/`. It adds tool phases, assistant messages, reasoning,
  permissions, compaction, subagent activity, model and token data, and the
  session end.

At each hook, `trajectory serve` first reads the rollout forward and records
what it finds. Then it records the hook event. A hook `SessionEnd` or a
rollout `shutdown_complete` both trigger one final read, which writes exactly
one `session_end`.

The plugin defines all eleven events that current Codex supports. In the
default boundary mode, only the hooks listed above are on. Full-hook mode turns
on the rest. Some supported Codex versions do not include
the documented `SessionEnd` entry. Setup accepts that one missing handler. For
those versions, the rollout `shutdown_complete` record ends the session.

**Subagents.** In current rollouts, a successful `spawn_agent` call output
with a stable call ID confirms a subagent launch. Trajectory counts it once,
even when `collab_agent_spawn_begin` describes the same launch. Structured
`agent_id` output links the child trace. A launch named only by task name or
text counts, but Trajectory does not invent a child session for it. Failed or
missing outputs do not count.

**Ephemeral runs.** `codex exec --ephemeral` writes no rollout. For these
runs, Trajectory has no tool, permission, compaction, or subagent detail.

**Full request content.** When you run Codex through `trajectory codex`,
Trajectory captures each complete Responses API request and response by
default. The LLM span keeps:

- instructions and conversation input
- tool results, tool descriptions, and parameter schemas
- reasoning, tool calls, and assistant output
- the ordered JSON event sequence for streaming responses

The same content appears in Datadog LLM Observability and in the local UI
(Lapdog).

**Saved history.** To import past sessions, run:

```bash
trajectory session import codex --limit 100
```

The import reads both `$CODEX_HOME/sessions/` and
`$CODEX_HOME/archived_sessions/`. If a session is in both, Trajectory uses the
active copy. `CODEX_HOME` moves both folders. `CODEX_SESSIONS_DIR` still names
one rollout folder that Trajectory reads alone. This is useful for isolated
tests and managed layouts.

Trajectory reads archive files only as past sessions. It ignores symlinked
rollout files, so discovery stays inside the chosen folder. If you turn on
startup repair, it handles at most 100 sessions per pass. It continues where it
stopped on the next pass.

**Privacy and segmentation.** The Codex marketplace plugin ships the
`/incognito` skill. The skill calls the `trajectory_incognito` MCP tool.
Trajectory then stops sending the session's trace and log content to Datadog
destinations, except exempt ones. Local JSONL capture continues.

### Codex Desktop (Codex.app) attribution

Codex.app is the macOS desktop app, bundle ID `com.openai.codex`. It writes
to the same `~/.codex/sessions/` rollout folder as the CLI and uses the same
hooks. So Trajectory handles Desktop sessions the same way as CLI sessions. A
hook event does not tell you whether a session came from the CLI.

The watcher covers the whole active `CODEX_HOME` or `CODEX_SESSIONS_DIR`
folder. It does not filter by the current `TRAJECTORY_PROJECT_ROOT`, because
CLI and Desktop sessions may run from different projects.

New CLI and Desktop sessions both use `client_source="codex"`. Trajectory
reads `session_meta.originator` and `session_meta.source` to find where the
session started. It records this as `entrypoint` on LLM Observability spans
and as `client_surface` on metrics.

| Launch | `entrypoint` and `client_surface` | `app_version` |
| --- | --- | --- |
| Codex.app | `desktop` | The resolved Codex.app version |
| CLI | `cli` | Not set |
| IDE | `ide`, when the rollout gives it | Not set |
| Noninteractive run | `exec`, when the rollout gives it | Not set |

Local JSONL records from older Trajectory versions can still contain
`client_source="codex-app"`. Trajectory still treats that value as Codex
everywhere, and it does not rewrite old files. When you read local session
records, query both `codex` and `codex-app`. Agent Console backfill publishes
both under `trajectory.client_source:codex`. To find Desktop sessions, use
`trajectory.entrypoint:desktop` or `trajectory.client_surface:desktop`.

## GitHub Copilot CLI

**Status:** Beta. No minimum version is established. The compatibility
contract checks 1.0.71, which is also the latest checked release. Trajectory
follows GitHub's public Copilot CLI plugin-hook, session-history, and native
OTel contracts.

**Install.** Install the Copilot CLI plugin with setup:

```bash
trajectory setup --clients copilot
```

Setup writes a local Copilot marketplace in
`~/.trajectory/copilot-marketplace`. It registers the marketplace with
`copilot plugin marketplace add` and installs `trajectory@trajectory`. The
plugin includes `hooks.json`, `.mcp.json`, and an incognito skill.

- Copilot starts `trajectory mcp` from the plugin's MCP config. That MCP
  process starts Trajectory's local capture server.
- Copilot command hooks run
  `trajectory capture-hook --client copilot --ensure-serve`. The hook retries
  safely if the capture server restarts.

To repair the plugin, run `trajectory setup --clients copilot` again.

**What Trajectory captures.** The plugin registers these documented events:
`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`PostToolUseFailure`, `permissionRequest`, `notification`, `Stop`,
`subagentStart`, `SubagentStop`, `ErrorOccurred`, `PreCompact`, and
`SessionEnd`.

The plugin uses command hooks. Copilot requires HTTPS for HTTP hooks that can
affect permissions, so Trajectory does not use Copilot HTTP hooks.

**Tokens and cost.** For token and cache counts per request, and estimated
USD, install the opt-in launcher and turn on the native OTel feature. Both are
off by default:

```bash
trajectory setup --clients copilot --install-client-shims
trajectory config features enable copilot_cli_native_otel
trajectory config reload --yes
```

The launcher turns on OTLP export with content capture off. It does this only
for Copilot processes that start through the shim. It keeps your own settings
unchanged in these cases:

- an existing collector that is not Trajectory's
- a custom scope or a file exporter
- telemetry turned off on purpose

So a managed rollout can proceed in steps without interrupting sessions:

1. Distribute the pass-through shim.
2. Deploy the Trajectory binary everywhere.
3. Turn on `copilot_cli_native_otel`.

With `copilot_cli_native_otel` on, Trajectory joins first-party `chat` spans
to the saved session records by session and service request ID.

- All inference calls in one interaction, including nested subagents, map to
  one Trajectory turn.
- Span ancestry sets `query_source=main|subagent`.
- Copilot's input total includes cache tokens. Trajectory splits it into
  uncached input, cache-read, and cache-creation counts.
- The resolved model sets the rate for estimated USD from the shared rate card.
- Premium-request multipliers and nano-AIU stay as client diagnostics. They
  are not treated as USD.

Without native OTel, session shutdown totals are the fallback. Copilot's
shutdown `inputTokens` includes cache reads and writes. Trajectory subtracts
them to keep uncached input separate. This total stays at session level and is
never copied onto a turn. Request cost and nano-AIU values in history stay
client diagnostics. They are not labeled as USD.

**Saved history.** To import Copilot's saved local history, run:

```bash
trajectory session import copilot
trajectory session import copilot --session <id>
```

To sync new and changed local sessions automatically, turn on the watcher. It
is off by default:

```bash
trajectory config features enable copilot_cli_durable_history
trajectory config reload --yes
```

Trajectory reads these files without changing them:

- the current `session-state/<id>/events.jsonl` layout and its
  `workspace.yaml` file
- the older `session-state/<id>.jsonl` layout

`COPILOT_HOME` replaces the whole default `~/.copilot` folder. If both layouts
hold the same session ID, Trajectory uses the current folder layout. It ignores
symlinked files. It skips unchanged sessions. Running the import again refreshes
active or changed sessions. `--force` re-imports one session or all of them.

Saved history keeps:

- session IDs, timestamps, and event order
- prompts, assistant text, and reasoning
- model changes, tool calls, and tool results
- permission decisions and subagent links
- session shutdown totals

When a hook already captured the same lifecycle, prompt, tool, permission, or
subagent event, Trajectory keeps the hook event. Saved history only fills in
missing fields. Trajectory does not invent a final turn or session end for an
active log.

The watcher does not import past sessions when you turn it on. It starts from
the current state. To import past sessions, run `trajectory session import
copilot`. The watcher then follows new sessions, appends, rewrites, workspace
file changes, and deletions in both layouts.

- Active or resumed sessions stay open.
- Shutdown usage stays at session level.
- When Copilot deletes a session, Trajectory keeps its copy and records the
  deletion. It does not mark the session as ended.

`trajectory doctor` shows whether the feature is on and whether the watcher is
running.

**Testing.** Tests use local fixtures shaped like Copilot's files. Live
validation needs an installed, signed-in Copilot CLI. It checks the plugin
files that setup writes. It also runs a real `copilot --plugin-dir ... -p`
session that must produce prompt, tool, turn, session, and
`client_source=copilot` JSONL. Until that live check runs, the status stays
beta and fixture-tested.

Trajectory has no cloud-agent import and no setup-managed resume for Copilot
yet.

## Gemini CLI (retired)

Trajectory no longer captures Gemini CLI. It keeps the sessions it captured
before retirement. The history-import SDK still converts saved Gemini history.

For Antigravity, run `trajectory setup --clients agy`. To learn what setup
removes, how leftover hooks behave, and how saved Gemini token values compare
with other clients, see
[CLIENT-INSTRUMENTATION](CLIENT-INSTRUMENTATION.md#gemini-cli-retired) or run
`trajectory user-guide clients/gemini`.

## Antigravity CLI (`agy`)

**Status:** Supported. No minimum version is established. Fixtures and source
shape checks cover 1.0.12 and 1.1.2. The 1.1.5 generation metadata has been
checked against the current decoder.

**Install.** Run setup:

```bash
trajectory setup --clients agy
```

Setup writes the Trajectory MCP server to
`~/.gemini/antigravity-cli/settings.json`. It also stages a Trajectory plugin
under `~/.gemini/config/plugins/trajectory`. The plugin includes a root-level
`hooks.json`, `skills/incognito/SKILL.md`, and `commands/incognito.toml`.

To check the plugin by hand, run:

```bash
agy plugin validate plugin/trajectory-antigravity
```

A valid plugin reports `hooks: 1 processed`. If you see
`hooks: skipped (not found)`, the plugin has the old nested `hooks/hooks.json`
layout. Run setup again to refresh it.

**What Trajectory captures.** The plugin uses Antigravity's native
`PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, and `Stop`
events. It posts their payloads to `/capture/agy/<Event>` with
`client_source=agy`.

- `conversationId` is the session ID.
- `stepIdx` links each tool call to its result.
- Trajectory records the client's tool errors and Stop metadata as given.
- `Stop` ends one execution loop. It does not end the conversation.

The hooks report `modelName` as a selector such as `auto` or as a model-like
name. Neither reliably names the model. Trajectory keeps the value as
`model_label`, which it never uses for cost. The hooks carry no prompts,
assistant text, tokens, cost, or conversation end. Trajectory does not infer
them.

**Saved history.** The `antigravity_durable_history` watcher adds the data
that hooks lack. It is off by default. To turn it on and reload a running
server, run:

```bash
trajectory config features enable antigravity_durable_history
trajectory config reload --yes
```

The watcher reads the client's `history.jsonl` and the current schema-v1
`conversations/<uuid>.db` files. It does not change them. On first start it
records the existing rows as a starting point. After that it syncs new
changes to the JSONL file, the database, and its WAL and shared-memory files.
Hook tool and Stop events always stay in place.

With the watcher on, Trajectory adds user prompts, timestamps, workspaces, and
the models from current schema-v1 generations. Antigravity stores no time per
generation, so the SQLite or WAL file time is used and marked synthetic.

To import saved history from before the watcher's starting point, run:

```bash
trajectory session import antigravity
trajectory session import antigravity --session <conversation-id>
```

The import skips sessions Trajectory already has, unless you add `--force`.
A forced import refreshes the matching history facts and keeps unmatched new
events.

**Tokens and cost.** Each generation's `gen_metadata` gives the model,
uncached input, total output, response output, reasoning output, cache read,
cache creation, and usage per retry attempt.

- Total output includes reasoning.
- The attempt counts must add up to the total. If they do not, Trajectory
  records one request with the total.

For live sessions, Trajectory marks where each invocation starts at
`PreInvocation`. At `Stop`, it joins the new generation rows to that
invocation's turn. It waits briefly after Stop in case Antigravity writes late.

- Each live request counts toward metrics.
- Trajectory prices each request with the public Gemini rate card for that
  exact model.
- Publishing adds the turn's total only after the request totals match.

This is an estimated model cost, like Claude's native cost metric. It is not
Antigravity subscription, credit, or invoice cost.

Rows from the watcher or a manual import do not count toward metrics. They
stay on stable turns built from the client's records. The saved history has
no key that joins past prompts to generations. It also has no completion
status. So imported rows never count as a live success or a new turn.

**What Trajectory skips.** Trajectory skips slash commands and unknown row
types in saved history. If a schema is unknown, a row cannot be decoded, or a
row is rewritten or removed, Trajectory skips it. It never invents assistant
text, tools, `turn_end`, or `session_end`.

- Hook events and incognito state stay in place.
- Trajectory refuses sessions that belong to another client.
- Client files stay read-only.
- Open sessions appear in the local UI without a made-up end.

**Privacy and segmentation.** Setup installs the `/incognito` command and the
incognito skill. Current hooks carry no prompt or assistant text, so
segmentation needs the saved-history watcher.

**Known gaps.** Trajectory does not decode the private step transcript.
Antigravity has no setup-managed resume target.

## Goose

**Status:** Beta. Minimum supported version: 1.43.0, tested by live replay.
Source checked: 1.43.0. Latest checked: 1.43.0.

**Install.** Run setup:

```bash
trajectory setup --clients goose
```

Setup writes a Goose Open Plugins package to `~/.agents/plugins/trajectory`.
The package holds a `plugin.json` manifest and `hooks/hooks.json`. If
`GOOSE_PATH_ROOT` is set, setup writes the package under
`$GOOSE_PATH_ROOT/.agents/plugins/trajectory` instead.

Setup handles `GOOSE_PATH_ROOT` as follows:

- It turns a relative value into an absolute path once, from its own working
  directory. It writes that path into the installed hook. A later change to
  the Goose working directory does not move discovery.
- It records every root it installs to. Trajectory accepts a Goose root from a
  hook only when setup recorded that root.
- When setup has recorded a root, Trajectory ignores the default Goose store
  for sessions with the same ID.
- Uninstall removes the plugin from every recorded root. Changing or unsetting
  `GOOSE_PATH_ROOT` does not leave an old plugin behind.

**What Trajectory captures.** The hooks run `trajectory capture-hook`. Each
hook waits until the capture server accepts the event, so events keep the
order Goose sent them. If the server is unavailable, the hook writes the event
to the local JSONL record. Setup registers these hooks:

- `SessionStart` and `UserPromptSubmit`
- the generic `PreToolUse`, `PostToolUse`, and `PostToolUseFailure` hooks
- `Stop` and `SessionEnd`

Current Goose sends the generic tool hook and then a shell or file hook for the
same call. So setup installs only the generic hooks. Trajectory still accepts
the older `BeforeReadFile`, `AfterFileEdit`, `BeforeShellExecution`, and
`AfterShellExecution` hooks and removes the duplicates. Trajectory keeps native
tool names such as `developer__shell` next to the standard tool names.

The hook payloads have these limits:

- They carry no tool-call ID. When two calls to the same tool overlap,
  Trajectory matches their start and end events on a best-effort basis.
- Post-tool payloads leave out the tool result or error body.
- They do not report model usage, cost, or whether the run is interactive.
- Lifecycle and prompt payloads leave out the working directory. When no
  directory field exists, `capture-hook` uses the working directory of the
  hook process. It records `cwd_provenance=hook_process_working_dir`.

**Tokens and cost.** Live hooks carry no usage. Saved history supplies the
model, input and output tokens, optional cache tokens, and compaction rows.

- Goose counts cached tokens inside its input total. Trajectory reports
  uncached input, cache-read, and cache-write tokens separately.
- Goose labels each cost as `provider_reported`, `estimated`, or carried
  forward. Only `provider_reported` USD counts toward cost attribution.
- Trajectory keeps estimated, mixed, and carried-forward amounts as raw values
  without attribution.
- Token counts that are null, partial, negative, or contradictory stay raw
  values with `tokens_status=unavailable`. They do not become turn usage.

**Saved history.** The `goose_durable_history` feature flag is on by default.
It lets `trajectory serve` read the Goose schema-v15 `sessions.db` without
changing it. The database is in the Block/goose data folder for your platform,
or at `$GOOSE_PATH_ROOT/data/sessions/sessions.db`. To turn off only this
watcher, set `TRAJECTORY_DISABLE_GOOSE_HISTORY_WATCHER=1`. To turn off the
feature flag, run `trajectory config features disable goose_durable_history`
or list it in `TRAJECTORY_DISABLE_FEATURES`.

Saved history has two uses:

- For a session that Trajectory found only in saved history, Trajectory builds
  a trace from the database. The trace keeps the Goose session and parent IDs
  and the working directory. It also keeps messages, thinking, tool calls and
  results with their IDs, model, model provider, tokens, compaction rows, and
  cost.
- For a session that hooks captured, Trajectory adds only usage to the hook
  trace. It keeps the hook prompts, tools, messages, tool IDs, working
  directory, parent, model, and lifecycle.

Trajectory handles message content as follows:

- It leaves out content that Goose marks `userVisible=false`, but keeps the
  usage and model data of that content.
- It keeps user-visible text and thinking.
- It leaves out image bytes and redacted thinking.
- It records system notifications, tool confirmations, and action or
  elicitation messages as metadata only. These records carry
  `provider_structured_content_fidelity=metadata_only`.

Trajectory handles the session lifecycle as follows:

- It syncs saved history on a timer, not inside the `Stop` hook. Each sync of
  a hook-captured session takes at most two seconds.
- At `SessionEnd`, it tries one sync before it records the session end. Final
  tokens and cost then arrive before the session closes. If the database is
  unavailable or busy, Trajectory records a diagnostic and still records the
  session end.
- Goose sends no new `SessionStart` when you reopen a conversation. The first
  hook after the session end starts a new part of the session. Trajectory
  labels it `resume_evidence=post_terminal_hook`.
- A session that exists only in saved history stays incomplete. Trajectory
  does not add `turn_end` or `session_end` events for it.
- When Goose deletes a session, Trajectory keeps its copy and records the
  deletion. It does not mark the session as ended.

**Privacy and segmentation.** Goose hooks do not report the run mode, so hook
sessions use `source_mode=unknown`. Trajectory treats these sessions as
headless and skips segmentation, because the run mode is unknown.

**Testing.** Live tests run Goose 1.43.0 with an OpenAI model provider. Default
tests replay recorded Open Plugins payloads and sanitized fixtures of the
current database schema, because a real model call needs credentials.
Trajectory follows the Goose source for the database schema, platform paths,
cache fields, compaction, and cost labels.

## Cursor

Cursor has two separate products. Each one has its own capture path.

### Cursor Desktop (IDE)

**Status:** Supported. Minimum supported version: 1.0.0, the first release
with `hooks.json` support.

**Install.** Run setup:

```bash
trajectory setup --clients cursor
```

Setup creates `~/.cursor/hooks.json` and `~/.cursor/mcp.json`. The hooks are
Cursor command hooks that run
`trajectory capture-hook --client cursor --ensure-serve`. Cursor does not
accept every Claude Code lifecycle hook name. Setup registers only the event
names that Cursor supports.

**Privacy and segmentation.** For `/incognito`, Cursor uses the incognito
skill from the Trajectory plugin that Claude Code loads. If that plugin has no
incognito skill, setup installs a Cursor skill at
`~/.cursor/skills/incognito/SKILL.md`. For example, after
`trajectory uninstrument cc`, the Claude Code plugin has no skill. Setup then
installs the Cursor skill for an instrumented Cursor.

The skill calls the shared `trajectory_incognito` MCP tool. Trajectory then
stops publishing the active Cursor session to Datadog destinations, except
exempt ones. Local JSONL capture continues.

**Tokens and cost.** A complete generation publishes the Cursor input, output,
cache-read, and cache-write token counts.

- The hook `input_tokens` value includes the cache-read and cache-write
  tokens. Trajectory keeps that raw total. It subtracts both cache counts once
  to get uncached `input_tokens`.
- Trajectory maps `cache_write_tokens` to `cache_creation_tokens`.
- Partial, invalid, missing, conflicting, or unknown-model generations stay
  unpriced.
- Estimates from `state.vscdb` or response length cannot price a generation
  or fill in its token counts.

Pricing uses `pricing.cursor.mode: emit` with `source: org_file` by default.

- Managed policy can set the mode to `off` or `shadow`.
- `org_file` reads the rate card at `~/.trajectory/org/pricing.yaml`. The rate
  card is validated and has effective dates.
- The `datadog_reference_table` source is not implemented. It returns
  `pricing_source_unavailable`.
- Without a rate card, turns stay unpriced. Trajectory does not report them as
  $0.
- The live Cursor USD metrics apply only from the time pricing starts.
  Managed history sync can republish eligible saved Cursor cost under the
  live metric names.

For the full cost rules, run `trajectory user-guide cursor-cost`.

**Testing.** Tests check the Desktop install on macOS in an isolated home
folder. They check the Cursor MCP and hook files and the incognito skill
choice. They replay sanitized fixtures of real Desktop payloads into
`/capture/cursor`. They then compare the JSONL record, SQL, LLM Observability,
and Lapdog query results.

### cursor-agent (CLI)

**Status:** Beta. No minimum version is established.

cursor-agent is a standalone CLI. Run `cursor-agent --print` for headless
mode. To install cursor-agent, run:

```bash
curl -fsSL https://cursor.com/install | bash
```

**What Trajectory captures.** cursor-agent uses the same command hooks as
Cursor Desktop when it dispatches them. Trajectory tested signed-in
interactive use of cursor-agent `2026.07.20-8cc9c0b` with a real Trajectory
binary. The final hooks carried the model, generation, and all four token
counts. They also kept the CLI surface attribution.

**Tokens and cost.** The cursor-agent hook `input_tokens` value also includes
cache tokens. In one live Sonnet turn, the uncached input was
`42,420 - 21,162 cache-read - 21,251 cache-write = 7` tokens. This matched the
turn display in Cursor.

- Trajectory keeps the raw total and publishes the four separate counts.
- It estimates USD only from those four counts and a rate card that is in
  effect for the exact model.
- A set of counts that cannot add up stays unpriced.
- Plain `--print` runs dispatch no final hooks, so they stay unpriced.
- `trajectory cursor-agent --print` can attach the `cursor_print_result` from
  standard output. It does not invent IDs. If the print JSON is ambiguous,
  Trajectory does not attach it.

For the full cost rules, run `trajectory user-guide cursor-cost`.

**Saved history.** The watcher and import read the same saved JSONL files:

- current main files at
  `~/.cursor/projects/*/agent-transcripts/<session>/<session>.jsonl`
- current child and side-chat files at
  `~/.cursor/projects/*/agent-transcripts/<parent>/subagents/<child>.jsonl`
- current CLI Task children, which Cursor writes as sibling main transcripts
- older flat `agent-transcripts/<session>.jsonl` files

Trajectory does not support older plain-text transcripts.

The watcher is a preview and is off by default. To turn it on and reload the
running server, run:

```bash
trajectory config features enable cursor_agent_durable_history
trajectory config reload --yes
```

When the client changes or deletes a saved file, Trajectory rebuilds or clears
only the records that the watcher wrote. It keeps the hook traces.

Saved records have these limits:

- They contain no timestamps, model, tokens, cost, or `SessionEnd`. Trajectory
  labels timestamps as derived from the order it reads the records.
- The current fixture has tool requests but no tool results. Trajectory
  records a tool end only for an actual `tool_result`. It does not guess that a
  tool succeeded.
- Trajectory does not guess the model, token counts, cost, or session end.
- Desktop and CLI share these files, so the run mode is unknown.
- When the matching session is active, Trajectory keeps the hook events.
- A read of `.cursor/skills/<name>/SKILL.md` records that a skill was about to
  run. Trajectory does not record it as a completed skill run.

**Side chats.** Cursor Desktop 3.11 stores links between chats in the
`composerHeaders` table of the global `state.vscdb`. For older data, Trajectory
reads the `composer.composerHeaders` key of `ItemTable`. It reads only these
sources, with row and size limits.

- A chat with `subagentTypeName: side-chat` is an interactive side chat. Its
  parent is the `parentComposerId` chat.
- Trajectory leaves out the copied parent turns that `sideChatSeedTurnCount`
  counts.
- A child of a side chat keeps the side chat as its parent.
- Trajectory ignores link data that conflicts, loops, is too large, or does
  not agree with itself. It ignores other chat-store metadata.
- While the metadata database cannot be read, Trajectory holds the child
  transcript and retries later.
- If late metadata changes how Trajectory classified a chat, Trajectory
  rebuilds that session. Copied and live side-chat activity do not mix, even
  after a watcher restart.

**Subagents.** cursor-agent Task children often have a child transcript but no
`subagentStart` or `subagentStop` event. The child can also appear as a sibling
main session whose first prompt matches the Task prompt. Trajectory then adds
`subagent_start` and `subagent_stop` events to the parent:

- It adds them after the Task or Agent tool call and again before `turn_end`.
  Session end is a final chance to add them. Metrics then count the launch
  before Trajectory publishes the turn.
- For a synchronous Task, it adds both events to the launch turn.
- For a background Task (`run_in_background`, or background Task output), it
  adds the start to the launch turn. It adds the stop to the turn that reports
  the task result, once it identifies the child.
- Hook events from Cursor Desktop take priority.
- Trajectory adds these events only when a child transcript matches. It never
  invents a child.
- The sibling search must find exactly one project folder that holds the
  parent transcript. Child IDs use the same project-scoped IDs as saved-history
  sessions and keep the raw client IDs.
- Trajectory skips copied or ambiguous parent IDs rather than guess the parent.

When a Task or Agent launch matches no child, Trajectory records a diagnostic.
It does not invent a child lifecycle. Trajectory amends a stop event that has
no usage at most once. It does so after the separately captured child ends
with complete usage. Child tool hooks that name their parent can open their own
session if Cursor left out `sessionStart`. Trajectory does not invent final
turns, tokens, USD, or a Desktop surface for them.

**Testing.** Fixture tests check main and child discovery, client IDs, project
namespaces, child-parent links, and text, tool, and turn data. They also check
retries, file replacement, deletions, and import followed by Lapdog queries.
A sanitized fixture of cursor-agent `2026.07.16-899851b` covers a parent with
two sibling Task children. A sanitized Desktop 3.11.25 fixture covers a main
chat, its side chat, the skipped copied turns, and a child of that side chat.
That fixture is based on the source of the signed application. Trajectory has
not yet run a live test with the 3.11 GUI.

## Factory Droid

**Status:** Beta. No minimum version is established. Trajectory follows the
public Factory plugin hook contract.

**Install.** Run setup:

```bash
trajectory setup --clients droid
```

Setup creates a local Factory marketplace at
`~/.trajectory/factory-marketplace`. It registers the marketplace with
`droid plugin marketplace add`, then installs `trajectory@trajectory` at user
scope. The plugin holds `hooks/hooks.json`, `mcp.json`, and an incognito
skill.

- Droid starts `trajectory mcp` from the plugin's `mcp.json`. That MCP process
  starts the local Trajectory capture server, as for other clients that setup
  installs.
- The Factory command hooks run
  `trajectory capture-hook --client droid --ensure-serve`.

To repair the plugin, run `trajectory setup --clients droid` again.

**What Trajectory captures.** The plugin registers these documented events:
`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`Notification`, `Stop`, `SubagentStop`, `PreCompact`, and `SessionEnd`.

The public Factory docs do not list `PostToolUseFailure`, `PermissionRequest`,
`SubagentStart`, or `PostCompact` for Droid. The capture server accepts these
Claude Code event names in case Droid adds them. The Droid plugin does not
register them.

Capture is live only. Trajectory has no import, watcher, or backfill for
Factory Droid sessions.

**Testing.** The integration follows the public Factory plugin, hook, skill,
and MCP docs. Tests use local fixtures that match the documented hook payloads.
Trajectory has not yet tested it with a live Droid install.

## Hermes Agent

**Status:** Beta. Minimum supported version: 0.17.0, tested by live replay.
Source checked: 0.18.2. Trajectory uses the public Hermes observer-hook
contract.

**Install.** Run setup:

```bash
trajectory setup --clients hermes
```

Setup writes these files under `$HERMES_HOME`:

- `plugins/trajectory/plugin.yaml` and `plugins/trajectory/__init__.py`: the
  Trajectory plugin.
- `config.yaml`: setup merges `plugins.enabled: [trajectory]` and
  `mcp_servers.trajectory` into it.
- `skills/incognito/SKILL.md`: the incognito skill.

When `HERMES_HOME` is unset, Hermes uses `~/.hermes` on macOS and Linux and
`%LOCALAPPDATA%\hermes` on Windows.

**What Trajectory captures.** Hermes plugins are Python observers. They can
read hook events but cannot change what Hermes does. The Trajectory plugin
sends these hooks to `/capture/hermes/<event>`:

- `on_session_start` and `on_session_finalize`
- `pre_llm_call`, `post_api_request`, and `post_llm_call`
- `pre_tool_call` and `post_tool_call`
- the approval hooks and the subagent hooks

The plugin returns no values that change Hermes behavior. If capture fails,
Hermes keeps running.

**Tokens and cost.** `post_api_request` carries the Hermes `usage` fields.
Trajectory records them on `agent_message`. When the model is known, it also
writes `llm_call` rows. Cost comes from the Hermes cost fields first.
Otherwise Trajectory uses its model pricing table.

**Saved history.** Trajectory can read `state.db` in the effective
`$HERMES_HOME`. It never changes the file. Turn on the feature flag, then
import:

```bash
trajectory config features enable hermes_durable_history
trajectory session import hermes
trajectory session import hermes --session <provider-session-id>
trajectory session import hermes --force
```

The import and the watcher read the active message rows in the order Hermes
wrote them. They recover user, assistant, reasoning, and tool messages. They
also recover parent, branch, delegation, and compression-continuation links. A
session stays open until Hermes records `ended_at`.

With the flag on, `trajectory serve` watches the database and its WAL and
shared-memory files. At startup it also syncs a limited set of existing
sessions. A session-end hook starts an immediate sync of that session. Other
rules:

- When a hook event and saved history describe the same thing, Trajectory
  keeps the hook event.
- When Hermes deletes a session, Trajectory keeps its local copy.
- After a restart, Trajectory retries deliveries that did not finish.
- An active final turn stays incomplete until Hermes records its end.
- `--force` re-imports complete history.

Hermes saves token and cost totals only for the whole session. Trajectory
keeps the session token total and the Hermes breakdown by model. The breakdown
includes the schema-v22 auxiliary task labels and the input and output parts.
For cost, Trajectory prefers actual cost, then estimated cost, then computed
cost. It leaves per-turn token and cost fields empty. It does not create
`llm_call` spans from session totals.

The flag is off by default. Managed configuration or
`TRAJECTORY_DISABLE_FEATURES` can turn off both automatic and manual
saved-history reads. Live hook capture continues. Hermes can also export JSON
snapshots, which Hermes turns off by default. Trajectory reads `state.db` and
ignores those snapshots.

## Amp Code

**Status:** Beta. No minimum version is established. Trajectory follows the
current Amp plugin API.

**Install.** Run setup:

```bash
trajectory setup --clients amp
```

Setup writes a system plugin to `~/.config/amp/plugins/trajectory.ts`, or to
`$AMP_CONFIG_DIR/plugins/trajectory.ts`. It also merges a `trajectory` MCP
server into `~/.config/amp/settings.json` under `amp.mcpServers`.

**What Trajectory captures.** Amp plugins receive `session.start`,
`agent.start`, `tool.call`, `tool.result`, and `agent.end`. The Trajectory
plugin starts or reuses `trajectory serve`. It sends those events to
`/capture/amp/<event>` with `client_source=amp`. The plugin returns
`{action: "allow"}` from `tool.call` and sends capture in the background. If
capture is unavailable, Amp keeps running.

The plugin API gives thread identity, prompts, assistant messages, tool calls
and results, and agent status. It gives no live model, token, cost, duration,
or session-end fields. Trajectory does not create those values.

**Saved history.** A saved-history fallback is off by default. Turn it on and
reload the running server:

```bash
trajectory config features enable amp_durable_history
trajectory config reload --yes
```

Trajectory then syncs the top-level `T-*.json` files under
`~/.local/share/amp/threads`, or `$XDG_DATA_HOME/amp/threads`. The plugin and
the thread files use the same `T-...` thread ID. After any plugin event for a
thread, Trajectory keeps the plugin trace. Saved history does not replace it.

When Amp changes a thread, Trajectory rebuilds its copy. When Amp deletes a
thread, Trajectory keeps its copy and records the deletion. It does not mark
the session as ended.

**Tokens and cost.** Only saved history has usage data. Current
`messages[].usage` records and legacy `usageLedger.events[]` records give the
model and token counts. Ledger usage joins a turn only through a matching
`toMessageId`. Usage without a matching turn stays at the session level. Amp
credits stay labeled as Amp credits. Trajectory never converts them to USD.

**Testing.** Amp can run headless with `amp --execute` and `AMP_API_KEY`.
Trajectory has not yet tested Amp with a live subscription. Tests replay
fixtures of the current plugin contract. They cover setup, inventory, and
automatic setup. The saved-history sync is also tested only with fixtures. A
signed-in Amp run must still confirm two things for a current release:

- Amp keeps complete threads on disk.
- The Linux folder layout matches.

## Qwen Code

**Status:** Beta. Minimum supported version: 0.20.0, tested by live replay.
Source checked: 0.20.0.

**Install.** Run setup:

```bash
trajectory setup --clients qwen
```

Setup changes `~/.qwen/settings.json`, or `$QWEN_HOME/settings.json`:

- It registers a `trajectory` MCP server.
- It adds `http://127.0.0.1:19222/capture/qwen/*` to
  `security.allowedHttpHookUrls`.
- It adds HTTP hooks for lifecycle, prompt, tool, permission, subagent,
  compaction, notification, stop, and session-end events.

Setup also writes an incognito skill at `~/.qwen/skills/incognito/SKILL.md`
and an incognito command at `~/.qwen/commands/incognito.toml`.

Qwen Code works with OpenAI-compatible model providers. To run it headless
with OpenAI:

1. Set `security.auth.selectedType=openai`.
2. Configure `modelProviders.openai`.
3. Set `OPENAI_API_KEY`.
4. Run `qwen -p`.

**What Trajectory captures.** Trajectory uses the native Qwen HTTP hooks. It
does not use command or curl shims. It records `client_source=qwen` and these
events: prompt, tool, permission, subagent, assistant message, turn, session
start, and session end. It writes `llm_call` rows from Qwen `usageMetadata`.

**Tokens and cost.** Qwen counts tokens the same way as Gemini:

- Trajectory subtracts `cachedContentTokenCount` from `promptTokenCount` to
  get uncached input.
- Cache reads stay a separate category, so cost does not count them twice.
- `candidatesTokenCount` can include `thoughtsTokenCount`. Trajectory needs
  `totalTokenCount` to split output and reasoning tokens.
- Without that total, Trajectory keeps the raw counters and marks the token
  data as partial. It does not compute a strict request cost.
- Malformed, non-finite, negative, fractional, or contradictory counters are
  also partial and unpriced. Trajectory keeps the usable numbers for
  diagnosis. It does not repair them.

If the stop hook has no token usage, Trajectory reads the Qwen chat JSONL
transcript instead.

**Saved history.** Turn on automatic sync, and import saved history by hand:

```bash
trajectory config features enable qwen_durable_history
trajectory session import qwen
trajectory session import qwen --session <session-id>
```

Trajectory finds the Qwen runtime folder in this order:

1. It applies the Qwen user-level `.env` file.
2. It uses `QWEN_RUNTIME_DIR` when set.
3. Otherwise it merges `advanced.runtimeOutputDir` from the system defaults,
   user, trusted workspace, and system override settings.
4. Otherwise it uses `QWEN_HOME` or `~/.qwen`.

Relative paths start at the process working directory. Trajectory reads
regular files in `projects/*/chats/*.jsonl` and
`projects/*/chats/archive/*.jsonl`. It reports a session as ambiguous when it
appears in both the active and archive folders, or in two projects.

Qwen transcripts are append-only trees. Trajectory follows the `parentUuid`
chain back from the last valid record. It leaves out branches that a rewind
abandoned. It keeps:

- timestamps, models, and usage for each assistant message
- cache overlap, thinking, and tool calls and results
- sidechain identity, title, and parent and fork links
- session-source metadata and counters that are zero

Hooks own lifecycle and tool timing. Saved history owns usage for each
request, because the Stop hook carries only the last request. The token rules
above also apply to saved history. Trajectory does not rewrite a local JSONL
record whose `session_start` does not name Qwen as the client. Qwen writes no
session-end record in the transcript, so the import does not add
`session_end`.

The same flag starts a watcher in `trajectory serve`:

- At startup it syncs existing history in pages of limited size.
- It retries failed deliveries and local UI updates.
- When Qwen rewrites a session, Trajectory replaces the local UI copy. Spans
  that Qwen removed disappear.
- When Qwen deletes a session, Trajectory keeps its copy and records the
  deletion. It does not mark the session as ended.
- A session-end hook starts an immediate sync. Its `transcript_path` also
  tells the watcher about workspace-specific runtime folders. This works even
  when Trajectory did not detect Qwen at first.

To stop the watcher, turn off client watchers globally or set
`TRAJECTORY_DISABLE_QWEN_WATCHER=1`.

The watcher cannot find an older runtime folder that was set only in another
workspace before hook capture started. To import that history, run the import
from that workspace.

## OpenHands

**Status:** Beta. Minimum supported CLI version: 1.16.0, tested by live
replay. OpenHands SDK 1.36.1 source checked.

**Install.** Run setup:

```bash
trajectory setup --clients openhands
```

Setup writes command hooks to `~/.openhands/hooks.json`. It writes a
`trajectory` MCP server to `~/.openhands/mcp.json`. For isolated runs, set
`OPENHANDS_PERSISTENCE_DIR`, and setup writes both files there.

The hook command is `trajectory capture-hook --client openhands
--ensure-serve`. OpenHands sends the hook payload as JSON on stdin, so a curl
bridge does not work.

Headless OpenHands conversations load hooks from the workspace file
`.openhands/hooks.json`. For a headless run, copy the setup hook config into
the project folder before you start the session.

**What Trajectory captures.** The OpenHands CLI has these hooks:
`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Stop`, and
`SessionEnd`. Trajectory records session, prompt, tool, turn, and session-end
events with `client_source=openhands`. The hooks carry no assistant messages
or token usage. So OpenHands `turn_end` records set
`tokens_status=unavailable`.

**Privacy and segmentation.** The hook events do not include the run mode.
Trajectory treats hook sessions as headless and skips segmentation, because
the run mode is unknown. If OpenHands adds a mode field to its hooks,
Trajectory uses that field.

**Saved history.** Turn on the feature flag, which is off by default. Then
use the watcher, or import by hand:

```bash
trajectory config features enable openhands_durable_history
trajectory session import openhands
trajectory session import openhands --session <provider-conversation-id>
trajectory session import openhands --force
```

Trajectory reads conversations, without changing them, from the first folder
that applies:

1. `OPENHANDS_CONVERSATIONS_DIR`
2. `OPENHANDS_PERSISTENCE_DIR/conversations`
3. `~/.openhands/conversations`

The watcher detects changes and deletions in that folder. It retries delivery
after a crash. To stop only this watcher, set
`TRAJECTORY_DISABLE_OPENHANDS_HISTORY_WATCHER=1`. To repair complete history,
run the import with `--force`.

Trajectory ignores a conversation folder until it has a regular
`base_state.json` file within the size limit. Trajectory skips a conversation
whose `base_state.json` ID does not match, or changes later. This prevents a
second copy of the session.

Saved conversations add these details:

- assistant messages and visible reasoning
- tool inputs and results, from action and observation pairs and from SDK
  ACP tool events
- conversation error details
- model, working directory, and final state

A tool input or result over 4 MiB is stored as its JSON byte count and SHA-256
digest. When hooks and saved history describe the same event, Trajectory
keeps the hook event. A session ends only on a finish action or a final state
in the saved conversation.

**Tokens and cost.** `base_state.json` gives prompt, completion, cache-read,
cache-write, and reasoning totals. It also gives the total cost that OpenHands
reports. These values cover the whole session only. Trajectory does not create
per-turn usage or an `llm_call`.

**Testing.** Live tests run a real headless OpenHands session with
`LLM_API_KEY`, `LLM_MODEL`, and `--override-with-envs`. Tests without
credentials replay a trace fixture through `/capture/openhands/<Event>`. They
also run a sample conversation through watcher restart, change, deletion, the
local JSONL record, CLI import, and Lapdog queries.

OpenHands SDKs also offer OpenTelemetry and Laminar environment variables.
Trajectory does not install an OpenHands OTLP relay.

**Sources:** [OpenHands-CLI](https://github.com/OpenHands/OpenHands-CLI),
[OpenHands SDK](https://github.com/OpenHands/software-agent-sdk)

## Aider

**Status:** Beta. Minimum supported and latest checked version: 0.86.2,
tested by live replay.

**Install.** Run setup with the shim option:

```bash
trajectory setup --clients aider --install-client-shims
```

Interactive setup asks before it installs the shim. Scripted setup must pass
`--install-client-shims`. Setup does three things:

- It writes a shim at `~/.trajectory/bin/aider`.
- It links `aider` into an existing home bin folder on `PATH` when it can.
- It writes `~/.trajectory/state/aider/wrapper.json`, which points to the real
  Aider binary.

The shim runs `trajectory aider --real <path> -- ...`. It starts or reuses
`trajectory serve` and passes your arguments through. It adds
`--analytics-log`, `--llm-history-file`, and `--chat-history-file` unless you
set them. It adds `--no-analytics` unless you set `--analytics`,
`--no-analytics`, or `--analytics-disable`.

**What Trajectory captures.** The shim sends `SessionStart`,
`UserPromptSubmit`, `AgentMessage`, `TurnEnd`, and `SessionEnd` to
`/capture/aider/<Event>` with `client_source=aider`. The data comes from
these places:

- Token and cost fields come from the Aider `message_send` analytics rows.
- Assistant text comes from the LLM history file.
- Prompts come from `--message`, `--message-file`, or the chat history.

Aider has no stable hook, plugin, or OTLP interface for tool events. So
Trajectory does not create file-edit or tool rows from transcripts.

**Saved history.** Trajectory can also read Aider chat history that the shim
did not create. Turn on the feature flag, which is off by default. Then name
only the files Trajectory may read:

```bash
trajectory config features enable aider_durable_history
export AIDER_CHAT_HISTORY_FILE=/path/to/project/.aider.chat.history.md
# Or use AIDER_DIR for a compatibility root, or a path-list in
# TRAJECTORY_AIDER_HISTORY_DIRS.
trajectory session import aider
```

`trajectory serve` then syncs the `.aider.chat.history.md` files you named. It
retries after a crash. `trajectory session import aider` imports complete
history and repairs it.

Each `# aider chat started at ...` launch becomes a session with a stable ID.
Trajectory keeps prompts, assistant Markdown, model labels, and blockquoted
command output. Shim events take precedence over saved history. Blockquotes
do not count as structured tool events.

The history file has no session ID, message timestamps, or end marker. So
Trajectory labels its ordering timestamps as derived, and the session stays
open. When the file is deleted, Trajectory keeps its copy and records the
deletion. It does not mark the session as ended.

**Tokens and cost.** The Aider token line can come from model provider usage
or from the local Aider token counter. Aider rounds values of 1,000 or more
for display. Trajectory marks these values as estimated and records their
source. The Aider message and session cost can come from LiteLLM or from local
token pricing. Trajectory keeps it as a cost that Aider reported. It never
treats it as billed cost.

**Testing.** Live tests run a real OpenAI-backed `aider --message` session.
Tests without credentials replay the Aider trace fixture and check the
`llm_call` span. History fixtures test these cases:

- several launches in one file, and rounded usage
- file changes, and delivery after a restart
- deletion and manual repair
- SQLite indexing and local UI reads

**Sources:** [Aider](https://github.com/Aider-AI/aider), [Aider CLI options](https://aider.chat/docs/config/options.html)

## Continue CLI

**Status:** Beta. Minimum supported and latest checked version: 1.5.47,
tested by live replay.

**Install.** Run setup with the shim option:

```bash
trajectory setup --clients continue --install-client-shims
```

Interactive setup asks before it installs the shim. Scripted setup must pass
`--install-client-shims`. Setup does three things:

- It writes a shim at `~/.trajectory/bin/cn`.
- It links `cn` into an existing home bin folder on `PATH` when it can.
- It writes `~/.trajectory/state/continue/wrapper.json`. This file points to
  the real Continue CLI binary from the `@continuedev/cli` package.

The shim runs `trajectory continue --real <path> -- ...`. It starts or reuses
`trajectory serve` and passes your arguments through unchanged. For a new
session, it sets `CONTINUE_CLI_TEST_SESSION_ID` to the Trajectory session ID.

**What Trajectory captures.** The shim sends `SessionStart`,
`UserPromptSubmit`, `AgentMessage`, tool events, `TurnEnd`, and `SessionEnd`
to `/capture/continue/<Event>` with `client_source=continue`. After the real
`cn` exits, Trajectory reads the Continue session file. The file is in
`$CONTINUE_GLOBAL_DIR/sessions` or `~/.continue/sessions`.

Trajectory matches the run to a session file as follows:

- A new run uses the session ID that the shim set.
- For `--resume`, a background start job records the newest session that
  Continue selects, before the run changes it.
- For `--fork <id>`, exactly one new child session must exist. Its copied
  history must match the named parent.
- Trajectory skips attribution when the start job has no clean starting
  point, or when two runs make the choice ambiguous. It also skips when
  resume history was rewritten. It never imports the newest unrelated file.

Trajectory sends only the history that the current run added. It does not
replay the history that a fork copied, or earlier resumed turns. Other rules:

- Tool-call state in assistant messages produces matched tool start, result,
  and failure events.
- Several assistant and tool steps under one prompt produce one `TurnEnd`.
- Input, output, cache, reasoning, model, and cost fields stay on their own
  request.
- The session `usage` object stays on `SessionEnd`. It never goes to the
  first assistant message.
- Resumed runs report only the usage that the run added.

The reader reads at most 4,096 session files, and at most 64 MiB for the
selected session. The state passed from the start job to the shim never
contains transcript content. Old state expires.

The interactive `/resume` picker in Continue can switch to
another saved session without telling the shim. The shim then captures only
the original session. It does not guess at content written after the switch.

In the current release, `/fork` prints a new `cn --fork <id>` command. To
attribute the child session, exit and run that command separately.

The Continue source includes a Claude-compatible hook system. It reads
`.continue/settings.json` and `.claude/settings.json`. The 1.5.47 release does
not call those hooks from the chat path. So Trajectory uses the shim and the
session file. While the shim runs, Trajectory ignores Claude-compatible hook
processes. This prevents double capture if Continue turns those hooks on
later.

**Testing.** Live tests run a real OpenAI-backed `cn -p` session. Unit tests
without credentials cover these cases:

- setup, wrapper parsing, and the current 1.5.47 session JSON
- resume and fork selection, and ambiguity between concurrent runs
- usage that each run adds, and tool events rebuilt from the transcript
- Lapdog queries

**Sources:** [Continue](https://github.com/continuedev/continue), [Continue CLI docs](https://docs.continue.dev/cli/overview)

## Mistral Vibe

**Status:** Beta. Minimum supported version: 2.21.0. Latest checked version:
2.26.0, tested by live replay. Live tests cover the shim. Fixtures cover saved
history for the Vibe 2.21 and 2.26 layouts.

**Install.** Run setup with the shim option:

```bash
trajectory setup --clients mistral-vibe --install-client-shims
```

Interactive setup asks before it installs the shim. Scripted setup must pass
`--install-client-shims`. Setup does four things:

- It writes a shim at `~/.trajectory/bin/vibe`.
- It links `vibe` into an existing home bin folder on `PATH` when it can.
- It writes `~/.trajectory/state/mistral-vibe/wrapper.json`.
- It writes a managed block in `$VIBE_HOME/hooks.toml` or `~/.vibe/hooks.toml`.

The managed block adds three native hooks. Each one runs `trajectory
capture-hook --client mistral-vibe`:

- `post_agent` records the Vibe `session_id` and `transcript_path`.
- `pre_tool` and `post_tool` capture tool runs.

Vibe 2.21.0 introduced these hook type names and rejects the older names.
Vibe releases before 2.21.0 do not load the hooks.

**What Trajectory captures.** The shim runs `trajectory vibe --real <path> --
...` and passes your arguments through unchanged. It queues a start job and a
finish job around the Vibe process. A background worker starts or reuses
`trajectory serve` and sends the queued data.

The `post_agent` hook ties the Vibe session to one Trajectory session. This
works for `--resume` with a session ID, picker resume, and `-c`/`--continue` runs.
With picker resume, Trajectory waits to send `SessionStart` until the hook
names the chosen session.

The shim passes these to Vibe without recording a session:

- the `mcp` and `update` commands
- the `--setup`, `--check-upgrade`, `--help`, and `--version` flags

The shim reads flag values the same way Vibe 2.26 does. Trajectory still
records a session command line that Vibe rejects with a usage error.

With a bare `--worktree`, Vibe names the worktree itself, so the shim does not
know its folder. Then `-c` links to no earlier session until the hook or a
single changed session identifies it.

Before launch, the worker records only digests and source metadata. After the
run, Trajectory imports the new prompts and assistant messages from the
transcript that the hook named. It does this only when the starting state was
clean. Without a hook, Trajectory accepts the result only when exactly one
session changed. If two runs raced, or the source is ambiguous, Trajectory
skips the message content. This prevents mixing sessions. Valid root-session
totals and session-end facts are still recorded.

The prompt you launch Vibe with is recorded from the session store after the
run, with the run's other prompts, not when Vibe starts. In some runs Vibe
runs no turn, such as `--continue` with no session to continue or a failed
sign-in. Such a run therefore records no prompt and adds no turn. When the store cannot
show what a run submitted, the launch prompt is recorded only if Vibe exited
cleanly.

Live capture records `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
`PostToolUse`, `AgentMessage`, `TurnEnd`, and `SessionEnd` with
`client_source=mistral-vibe`.

**Saved history.** Turn on the feature flag, which is off by default.
Optionally run a repair:

```bash
trajectory config features enable mistral_vibe_durable_history
trajectory session import mistral-vibe
trajectory session import mistral-vibe --session <provider-session-id>
trajectory session import mistral-vibe --force
```

With the flag on, `trajectory serve` syncs root sessions and their nested
`agents/*` child sessions. It retries after a crash. It looks in these places:

- `$VIBE_HOME/logs/session`
- the global `session_logging.save_dir`, when it is absolute or relative to
  the home folder
- `VIBE_SESSIONS_DIR`, a compatibility override
- `TRAJECTORY_MISTRAL_VIBE_HISTORY_DIRS`

A hook `transcript_path` starts a sync of that session, including in trusted
project-config folders. Trajectory does not scan whole workspaces. To turn off
only this watcher, set `TRAJECTORY_DISABLE_MISTRAL_VIBE_HISTORY_WATCHER=1`. A
managed feature disable and the global client watcher switch also turn it off.

**Session layouts.** The shim reads every session layout Vibe has written.
It follows `--workdir`, native `--worktree`, and trusted project
configuration.

- Vibe 2.26 keeps each session under `<save_dir>/unified/<session_id>/` as
  published generations, a pool of content-addressed chunks, and a journal.
  The shim reads the generation that `CURRENT` names, checks each document
  against its recorded digest, and applies the journal records written after
  that generation. The transcript is the public history in the projection
  state, because compaction rewrites the model context but not that history.
- Vibe 2.21 through 2.25, and 2.26 with `--legacy-harness`, write `meta.json`
  plus `messages.jsonl` for each session.
- Older releases wrote one `session_*.json` file.

The shim reads a newer minor revision of the 2.26 store and records its
number on the session end. It refuses a store whose history format, document
version, or manifest shape it does not know. That run is recorded without
messages or totals, and its session end says the store is newer than this
release supports.

Vibe 2.26 resumes a session from an earlier layout by copying it into a new
session with a new ID. The shim selects that copy, never the untouched
original. It keeps the copy in the Trajectory session of the resumed run and
imports only the messages after the copied history.

Each turn of a 2.26 session produces one `TurnEnd`, even when it holds tool
calls and no assistant text. A turn Vibe starts without a prompt, such as a
retry after a failed reply, is a turn of its own. A message that steers a
running turn does not end it. For the earlier layouts a turn ends at the next
prompt.

Vibe 2.26 reports built-in tools under qualified names such as
`file_system.bash`. These map to the same tools as the unqualified names.
`process.start` runs a shell command and is recorded as a shell tool. Vibe
2.26 always reports a tool duration of zero, which Trajectory does not
record. Vibe 2.26 keeps subagent sessions beside their parent, and the shim
never selects one as the session of a run.

**Saved history for Vibe 2.26.** The history watcher and `trajectory session
import mistral-vibe` read both layouts through the same reader the shim uses.
For the 2.26 layout:

- Discovery lists `<save_dir>/unified/*/CURRENT`. The cheap fingerprint is the
  `CURRENT` pointer plus the size of the journal segment it names, so a change
  between two published generations is seen. A hook's `transcript_path`, which
  names the session folder, wakes that exact session. The shim's session end
  names it too, so history read before the run's prompts and replies arrived
  is merged with them.
- Relationships come from the store. A session whose runtime identity is
  `subagent` is a subagent of the parent the store names. The store keeps it
  beside its parent, not under `agents/`. A session whose identity is `fork`
  is a fork or rewind continuation of the session the store names. Vibe makes
  one for `/branch` and for a rewind into a new session.
- A session copied from another starts with that session's messages, stored
  as entries named `imported-<n>`. A fork is such a copy. So is the session
  Vibe makes when it resumes a session from an earlier layout. The reader
  marks the copied part, so history and the shim record only what the copy
  added. The store counts a copy's tokens from zero. History reports those
  totals on the copy's session start and marks them
  `session_usage_attribution=excludes_imported_session_history`. The shim's
  session end carries the same mark for a copy of an earlier-layout session,
  but not for a fork.
- Hooks report a fork or a subagent with its parent. The hook path records it
  under `mistral-vibe-<provider session ID>`, and history binds it to that
  same ID. History binds a copy of a bound earlier-layout session to that
  session's Trajectory session. The result does not depend on which of hooks
  and history sees the session first.
- The shim imports prompts and replies only for the root session of its run.
  A fork's or subagent's prompts and replies come from history. Its tool
  events come from hooks when hooks ran in it.
- A history entry for a tool carries the store's own action ID, and hooks
  report the provider's call ID. The reader recovers the call ID from these
  sources, in order:
  1. The tool intents in every journal segment Vibe retains.
  2. The hook notices Vibe records on both sides of the entry.
  3. The tool calls still in the model context, matched by tool and
     arguments from the newest back.
- A tool run inside `run_typescript` has its own entry, intent, and pair of
  hook events. Its call ID is
  `typescript:<n>:<run_typescript call ID>:<i>:tool:<i>`. `run_typescript`
  itself has no entry and no hook event.
- Sometimes a tool entry's call ID cannot be recovered. That entry is left to
  the hook events only when Vibe recorded hook notices for it and the session
  has hook tool events. Any other such entry is recorded under the action ID. That
  includes every tool of a turn that ran before the hooks were installed.
- The shim can bind more than one provider session to one Trajectory session.
  History for one provider session replaces only that session's earlier
  history, and takes back only what that session added to live events. An
  event that belongs to another provider session is never matched, even when
  both number their turns from 1. A Trajectory session keeps the session
  start it has, and history adds its own only when there is none.
- A scheduled pass skips a session it cannot read and reports it. The other
  sessions are still synced.
- A new root session with no binding is left alone while a shim run that
  could bind it is in flight. That way history does not start a second
  Trajectory session for that run. Such a run saves sessions to the same folder and was
  launched before Vibe created the session. The wait ends when the run binds
  the session, at its first hook or when Vibe exits. It ends at the latest 15
  minutes after Vibe created the session. Vibe's default request timeout is 12
  minutes, and the first hook follows the first model reply. A run stands
  for nothing once its shim process has exited and its finish job is done, so
  a killed shim delays no session. A queued start job that names no shim
  process counts for at most 5 minutes. Forks, subagents, bound
  sessions, and copies of a bound session never wait. A waiting session is not
  read and takes none of a pass's budget.

Saved history adds session, prompt, assistant, thinking, tool start, tool
result, and turn events. It never creates `SessionEnd`. The Vibe `end_time`
field marks the last saved snapshot that can resume. It does not mean that the
session ended.

Session links follow these rules:

- Root and nested sessions keep separate client IDs.
- When child metadata omits the parent, the folder structure supplies it.
- A top-level session with a parent counts as a compaction continuation or a
  fork or rewind continuation. It does not count as a subagent.
- When hooks and saved history overlap, Trajectory keeps the hook event.
- When Vibe deletes a session, Trajectory reports a
  `mistral_vibe.source.tombstone` diagnostic and keeps the history it already
  recorded. It does not mark the session as ended.

**Tokens and cost.** The Vibe `stats.session_*` token counters and
`session_cost` are totals for the whole session. Trajectory accepts them only
when they are nonnegative, finite, and consistent.

A Vibe 2.26 session records summed input, cached, and output tokens and no
cost. Its session end carries them as `total_token_usage`, with cached tokens
apart from uncached input, and `tokens_status=session_aggregate_only`.
Trajectory prices the session once from its own rates, at the session's
current model. Each turn end of such a session carries only that status.
Vibe 2.26 records no model for each completion. It records a move to another
model, between turns, as a `model_change` checkpoint in the session's history.
When the session moved after it had already used a model, its totals mix more
than one model's usage. The session end then keeps the tokens and adds
`session_model_changes` with the number of moves. It carries an unpriced
`cost_attribution` with reason `exact_model_correlation_missing` and
`cost_complete=false`, so the totals are not priced at one model's rates. A
move before the first completion leaves every completion on one model. A
resumed session reopens on the model it was left on, so a change of
configuration between runs is not a move.

Vibe 2.26 can continue a session from an earlier release as a copy. The
session end of that copy reports the new session's own totals. It marks them
as not including the earlier session's tokens.

Other rules:

- Trajectory labels `session_cost` as the approximate estimate from Vibe.
- It never assigns either value to a turn or to an `llm_call`.
- Totals for a nested subagent stay with that child.
- Compaction continuations can include totals from parent sessions.
  Trajectory keeps them as unattributed data and leaves them out of session
  totals. This prevents double counting.
- Fork usage stays with the fork.

Vibe does not save token counts for each turn.

**Testing.** Live tests run real Mistral Vibe through its generic OpenAI
provider. The test writes an isolated `$VIBE_HOME/config.toml` and sets
`active_model`. It requires assistant, turn, session identity, and session
token facts, plus tool start and completion from a real shell tool call. Vibe
2.26 fixtures cover the 2.26 session reader and a journal ahead of its
snapshot. They also cover a session copied from an earlier release, a parent
with its subagent, and a session with its fork. The history tests merge each store with the events a
live run recorded for it, using the call IDs the hooks sent. Vibe 2.21 fixtures cover these
cases:

- discovery of root and child sessions, and their links
- thinking, tools, and results
- client changes, rewrites of the same size, deletion, and redelivery after a
  crash
- first start with existing history, and manual repair
- the local JSONL record, SQLite, and local UI reads

**Sources:** [Mistral Vibe](https://github.com/mistralai/mistral-vibe)

## Grok Build

**Status:** Preview. No minimum version is established. The official CLI
0.2.103 was inspected and is tested with fixtures.

**Install.** Grok Build support is off by default. Turn on the feature flag,
then run setup:

```bash
trajectory config features enable grok_build_instrumentation
trajectory setup --clients grok
```

Setup writes one global hook file at `$GROK_HOME/hooks/trajectory.json` or
`~/.grok/hooks/trajectory.json`. It also installs a `trajectory-incognito`
skill and the `~/.trajectory/bin/grok-incognito` command. Setup does not wrap
the `grok` command or edit shell startup files. Uninstall removes only the
files that Trajectory owns.

**What Trajectory captures.** The native hooks cover these events:

- session start and end
- prompt notification
- tool start, success, and failure
- permission denial
- `Stop` and `StopFailure`
- subagent start and stop
- compaction and notifications

Each hook carries the client session ID, workspace root, transcript path,
model, and tool IDs. A prompt notification without prompt text starts a sync
of saved history. It does not create an empty or guessed prompt.

**Saved history.** Grok saves sessions under `$GROK_HOME/sessions` or
`~/.grok/sessions`. Trajectory also accepts `GROK_DIR` as a compatibility
override. Use `TRAJECTORY_GROK_HISTORY_DIRS` to name folders for a repair.
Trajectory reads these files:

- `summary.json`
- `updates.jsonl`
- `chat_history.jsonl`
- `signals.json`
- nested relationship metadata

A hook with a session path starts a sync of that session only. Polling
catches missed hooks and headless saves. To import complete history or
repair it, run:

```bash
trajectory session import grok
trajectory session import grok --session <provider-session-id>
trajectory session import grok --force
```

Root sessions and `subagents/*` child sessions keep separate client IDs and
links. Saved history keeps prompts, assistant text, reasoning, tool input and
results, model, workspace, title, and Git metadata. Other rules:

- When hooks and saved history overlap, Trajectory keeps the hook event.
- A saved snapshot time does not mean that the session ended.
- When Grok deletes a session, Trajectory keeps its copy and records the
  deletion. It does not mark the session as ended.

**Tokens and cost.** Grok does not save token or cost data that Trajectory can
assign to a turn. Counters in `signals.json` stay as session diagnostics.
Trajectory never assigns them to a message, a turn, a token total, or a cost.

**Testing.** Sample 0.2.103 fixtures cover these cases:

- root and child session IDs, content, and tools
- rewrites of the same size, and first start with existing history
- syncs that hooks start, client changes, and replay after a crash
- failure on a damaged sync position, and deletion
- the local JSONL record, SQLite, and local UI reads

A test ran the official binary without credentials. It checked the version,
help, and inspect output, and the failure when signed out. Tests of
signed-in hooks, client changes, and incognito are still pending.

**Sources:** [Grok Build documentation](https://docs.x.ai/build/overview)

## Codebuff

**Status:** Beta. No minimum version is established. Source and npm package
1.0.684 checked.

**Install.** Run setup with the shim option:

```bash
trajectory setup --clients codebuff --install-client-shims
```

Setup also accepts `cb` and `codebuff-ai` as client names. Interactive setup
asks before it installs the shims. Scripted setup must pass
`--install-client-shims`. Setup does three things:

- It writes shims at `~/.trajectory/bin/codebuff` and `~/.trajectory/bin/cb`.
- It links `codebuff` and `cb` into an existing home bin folder on `PATH` when
  it can.
- It writes `~/.trajectory/state/codebuff/wrapper.json`, which points to the
  real Codebuff binary.

**What Trajectory captures.** The shim runs Codebuff unchanged. Then it
imports the `chat-messages.json` rows written for the current project.
Trajectory reads the same folders that Codebuff uses:

- `~/.config/manicode`
- `~/.config/manicode-dev`
- `~/.config/manicode-staging`

`CODEBUFF_DATA_DIR` can replace that list.

The shim and `trajectory session import codebuff` read chat history the same
way. Both record `SessionStart`, `UserPromptSubmit`, `AgentMessage`,
`llm_call`, and `TurnEnd`, with `client_source=codebuff`. The shim also
records `SessionEnd`, because it sees the process exit code. A manual import
leaves the session open and marks its end state as unavailable. It does not
assume success from the last message.

Codebuff has no stable hook, plugin, or OTLP interface for tool events in the
standard CLI. So Trajectory does not record file-edit or shell-tool events
for Codebuff.

**Tokens and cost.** Trajectory records token usage and `llm_call` rows when
the chat history has model provider usage in one of these fields:

- `metadata.usage`
- `metadata.codebuff.usage`
- `metadata.runState.sessionState.mainAgentState.messageHistory`, the nested
  layout that the ccusage Codebuff adapter reads

**Testing.** Tests use fixtures. Codebuff has no live test yet, because it
uses its own sign-in (`CODEBUFF_API_KEY` or local credentials). It does not
accept an OpenAI-compatible model provider key.

**Sources:** [Codebuff](https://github.com/CodebuffAI/codebuff), [ccusage Codebuff adapter](https://github.com/ryoppippi/ccusage)

## Pi

**Status:** Supported. Minimum supported version: 0.80.10, tested by live
replay. Latest checked: 0.84.1. Headless mode: `pi -p`.

**Install.** Run setup to install the Trajectory extension:

```bash
trajectory setup --clients pi
```

To install by hand from a Trajectory checkout, run:

```bash
mkdir -p ~/.pi/agent/extensions
cp -R /path/to/trajectory/plugin/trajectory-pi ~/.pi/agent/extensions/trajectory
```

Then point `~/.pi/agent/mcp.json` at
`~/.pi/agent/extensions/trajectory/bin/trajectory mcp`.

Setup writes `~/.pi/agent/extensions/trajectory/package.json`. Its
`pi.extensions` entry points to a versioned bundle at
`./.trajectory-bundles/<sha256>/index.ts`.

- Each bundle holds the TypeScript extension and its own `bin/trajectory`.
  `~/.pi/agent/mcp.json` uses the helper from the same bundle.
- Setup keeps older bundles, so Pi sessions that are already running keep
  working.
- New folders get the owner of the selected home folder.
- If an existing Pi folder has a different owner than its parent folder, setup
  stops before it writes anything below it. Restore the intended owner, then
  run setup again.

Setup does not add the extension to `~/.pi/agent/settings.json`. Pi finds the
extension in its standard extensions folder.

**What Trajectory captures.** Pi has a TypeScript extension API,
`pi.on("event", handler)`. The extension subscribes to lifecycle events such
as `session_start`, `agent_end`, `agent_settled`, `tool_call`, and
`tool_result`. It sends every event through
`trajectory capture-hook --client pi`.

- Pi's native `turn_end` covers one model request or tool step.
- Pi can send `agent_end` more than once, for retries or queued follow-ups.
- The extension keeps request usage on `AgentMessage` and `llm_call` events.
  It adds up every run and records one Trajectory turn at `agent_settled`.
- Older Pi releases have no `agent_settled` event. On those releases, the next
  user prompt closes the previous turn. Session shutdown closes the last one.
- `SessionEnd` always arrives after the other events of the session. A slow
  capture server cannot keep Pi from exiting.

The extension also emits `PostCompact`. It registers the `trajectory_status`,
`trajectory_incognito`, `trajectory_schema`, and `trajectory_query` tools. Where Pi routes MCP tools, the shared Trajectory MCP
tools are also available. Pi supports several model providers. Use any model
provider API key for testing.

**Skills.** Pi reads Agent Skills from `~/.pi/agent/skills`,
`~/.agents/skills`, `.pi/skills`, `.agents/skills`, configured paths, and
packages. When Pi activates a skill, Trajectory records a high-confidence
`skill-invoked` marker with `detected_from:pi_skill_prompt`.

**Privacy and segmentation.** The extension provides incognito through its
native `trajectory_incognito` tool. Where MCP is available, Pi can also use the
shared `trajectory_incognito` MCP tool.

**Session links.** Current Pi reports forks and new sessions through
`session_start`. The extension keeps the Pi session IDs. It records a parent
link only when the new header's `parentSession` matches Pi's
`previousSessionFile`.

- Import resolves the same file reference to the ID in the parent header. It
  keeps safe Pi IDs as they are. It uses a stable scoped ID only when a Pi ID
  is unsafe as a file name.
- The official `pi-subagents` extension marks child processes with
  `PI_SUBAGENT_CHILD=1`. It passes the parent session in
  `PI_SUBAGENT_PARENT_SESSION`. Trajectory records the link with
  `session_relationship=subagent`, unless the session already has a fork or
  new-session parent.
- The extension exports its active session as `TRAJECTORY_PI_PARENT_SESSION`.
  Another tool can launch a print or JSON Pi child with the parent's
  environment. The child's extension reads that value on a fresh start and
  records the same link. TUI and RPC runs ignore the inherited value.

These links appear in the local UI session list and trace views. Pi does not
report a child-session launch with a launch tool ID. So Trajectory does not
count the link as a subagent invocation or show it as a subagent task span.

**Saved history.** To import sessions from `.pi/agent/sessions`, run
`trajectory session import pi`. The `pi_history_backfill` feature flag is off
by default. When it is on, Trajectory imports idle session files that it never
captured. It resolves parent sessions. It does not keep refreshing saved
history.

### Pi child-launch evidence

The Pi plugin accepts the `trajectory:subagent` extension bus contract. The
contract is described in `plugin/trajectory-pi/README.md`. An extension that
reports a child launch must supply these fields:

- an accepted child ID
- the tool-call ID
- the parent session and turn
- the source timestamp

Separate events report coverage as complete, incomplete, or unsupported. These
events stay in the local JSONL record. When an extension sends no coverage
event, coverage stays unknown. Tests cover bus dispatch and the HTTP capture
endpoint, through trace and CLI reads. Native support for other Pi extensions
and for Oh My Pi is not tested. Trajectory has not yet tested this with an
installed client or confirmed the results in Datadog.

## Oh My Pi (`omp`)

**Status:** Beta (preview). Minimum supported version: 17.0.4, tested by live
replay. Source checked: 17.0.5. Latest checked: 17.0.5.

Oh My Pi is a separate client from Pi. The Pi extension does not cover it.

**Install.** The integration is behind a feature flag. Turn it on, then run
setup:

```bash
trajectory config features enable omp_instrumentation
trajectory setup --clients omp
```

Setup installs an Oh My Pi extension declared with `omp.extensions`. It adds
the Trajectory MCP entry to the `mcp.json` of the active profile. The
extension sends live events to `/capture/omp`. The server always records
`client_source` as `omp`, even if a payload names another client.

**Profiles and paths.** Trajectory follows the Oh My Pi profile rules:

- `OMP_PROFILE` takes priority over `PI_PROFILE`, even when it is set to an
  empty value.
- Named profiles live under the Oh My Pi config folder and ignore
  `PI_CODING_AGENT_DIR`.
- Default profiles use `PI_CODING_AGENT_DIR` when it is set.
- Trajectory uses migrated XDG data only when the matching Oh My Pi folder
  exists.

**Saved history.** To import the v3 history of the active profile, run
`trajectory session import omp`. The import reads nested child files. It keeps
the title, session IDs, parent links, tool results and errors, model changes,
usage, and compaction. Use the same command to repair the full history.

When the feature flag is on, the server also syncs existing and changed
history files from the same folder.

- When hook events and saved history overlap, Trajectory keeps the hook event.
- When Oh My Pi deletes a session file, Trajectory does not treat that as a
  session end.
- Changes to saved history do not reopen, complete, or publish a session.

**Testing.** A live test runs the real Oh My Pi 17.0.4 executable in RPC mode
without credentials. It checks startup, session state, and a local command,
with no model call. It also checks that Trajectory captures the session start
and end. Fixture tests use sanitized v3 layouts. They cover file changes,
retries, and reads in the local UI.

## OpenCode

**Status:** Supported. Minimum supported version: 1.18.3, tested by live
replay. Latest checked: 1.18.7. Headless mode: `opencode run`.

**Install.** Run setup to install the Trajectory plugin:

```bash
trajectory setup --clients opencode
```

Setup finds the OpenCode config folder in this order:
`OPENCODE_CONFIG_DIR`, then `XDG_CONFIG_HOME/opencode`, then
`~/.config/opencode`. It then does three things:

- It installs the Trajectory OpenCode plugin in that folder.
- It adds the plugin path and a `trajectory` MCP entry to `opencode.json`.
- It writes the incognito skill to the global OpenCode skills folder.

To install by hand, copy `plugin/trajectory-opencode` to
`~/.config/opencode/plugins/trajectory`. Then add that local path to the
`plugins` array in `~/.config/opencode/opencode.json`. Add a `trajectory` MCP
entry to the same file.

**What Trajectory captures.** OpenCode has a plugin SDK,
`@opencode-ai/plugin`. Its `server` entry point returns handlers for
`chat.message`, `tool.execute.before`, `tool.execute.after`, and `event`. The
plugin sends these events to `trajectory serve`. OpenCode supports several
model providers.

Trajectory records the OpenCode agent name and type on prompt, tool, and
message events. For subagents:

- The plugin pairs one pending `Task` call with a `session.created` event.
  That event must carry a child `info.id` and a different parent
  `info.parentID`.
- The plugin closes the link when the child goes idle or is deleted.
- The subagent events carry both `child_session_id` and `tool_use_id`.
- When several `Task` calls are pending at once, the plugin cannot tell them
  apart. It records no link rather than guess.
- Trajectory does not link a subagent trace to its parent from the OpenCode
  `agent_id` or `agent_type` alone.

**Skills.** OpenCode reads skills from `.opencode/skills/<name>/SKILL.md`,
the configured OpenCode user skills folder, `.agents/skills/<name>/SKILL.md`,
and Claude Code skill paths.

**Privacy and segmentation.** The incognito skill uses the
`trajectory_incognito` MCP tool when MCP is available. Otherwise it uses the
`/session/incognito` HTTP endpoint.

**Saved history.** To import saved history, run:

```bash
trajectory session import opencode
trajectory session import opencode --session <session-id>
```

The import reads these sources:

- the current and channel `opencode*.db` databases
- the saved `storage/session`, `storage/message`, and `storage/part` JSON
  folders

When both stores hold the same session ID, Trajectory uses the SQLite copy.
Sessions that exist only as JSON are also imported. Trajectory handles them as
follows:

- It imports child and archived sessions.
- It keeps the OpenCode `parentID` in the local UI trace metadata.
- It keeps a usage value of zero apart from missing usage.
- It does not add a `session_end` to a session that is still active.

To choose where the import looks:

- `OPENCODE_DB` sets the database path. The path can be absolute or relative
  to the data folder, as in OpenCode itself.
- `OPENCODE_DATA_DIR` sets a comma-separated list of data folders. Trajectory
  reads only those folders.
- Without `OPENCODE_DATA_DIR`, the import uses `XDG_DATA_HOME/opencode` or
  `~/.local/share/opencode`.

A preview watcher keeps new and changed sessions current while
`trajectory serve` runs. It is off by default. To turn it on, run:

```bash
trajectory config features enable opencode_durable_history
trajectory config reload --yes
```

The watcher works as follows:

- It does not import old history when it starts. To import sessions from
  before you turned it on, run the import commands above.
- It rebuilds only the records that the import created. It does not replace
  records from the live plugin.
- When OpenCode deletes a session, Trajectory keeps its copy and records the
  deletion. It does not mark the session as ended.
- It considers at most 4,096 sessions.

The import and the watcher read at most these amounts:

- 8 data folders and source candidates
- 32 databases
- 8,192 messages and 32,768 parts
- 4 MiB for one record
- 16 MiB of saved JSON for one session

Trajectory does not import a session that is over these limits or incomplete.
It reports the session and leaves it in OpenCode.

The watcher can miss a JSON rewrite that keeps the same file size and change
time. This happens only before its first full read of that session, and only
outside the folders it watches. To repair the session, run
`trajectory session import opencode --session <session-id> --force`.

**Sources:** [github.com/anomalyco/opencode](https://github.com/anomalyco/opencode)

## Kilo Code

**Status:** Beta. Minimum supported version: 7.4.11, tested by live replay.
Latest checked: 7.4.11. Headless mode: `kilo run --auto`.

**Install.** Run setup to install the Trajectory plugin:

```bash
trajectory setup --clients kilo
```

Kilo Code accepts OpenCode plugins. Setup finds the Kilo config folder in this
order: `KILO_CONFIG_DIR`, then `XDG_CONFIG_HOME/kilo`, then `~/.config/kilo`.
Set `KILO_CONFIG_DIR` for isolated runs. Setup then does three things:

- It installs a plugin SDK package in that folder.
- It adds the plugin path and a `trajectory` MCP entry to `opencode.json`.
- It writes the incognito skill to the global Kilo skills folder.

To install by hand, copy `plugin/trajectory-kilo` to
`~/.config/kilo/plugins/trajectory`. Then add that local path to the `plugin`
array in `~/.config/kilo/opencode.json`. Add a `trajectory` MCP entry to the
same file.

**What Trajectory captures.** The plugin sends SDK events to
`/capture/kilo/<event>`. The server reads them with the OpenCode parser and
records `client_source=kilo`.

**Tokens and cost.** Kilo can send assistant text before its final usage
data. The plugin matches the final `message.updated` event by message ID. It
then sends one short usage event and does not repeat the assistant text.
Trajectory keeps these values in one `llm_call` and in the completed turn:

- input, output, reasoning, cache-read, and cache-write tokens
- the model and model provider
- the Kilo timestamp
- the cost that Kilo reports

**Native telemetry.** Kilo can also export OpenTelemetry. To send it through
Trajectory, set `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:19222` before
you start `kilo`. When its OpenTelemetry setting is on, Kilo exports OTLP
traces and logs to the local Trajectory relay. This adds to the plugin events.
Keep the plugin that setup installs.

**Saved history.** A watcher syncs saved history and is off by default. To
turn it on, or to import and repair existing history, run:

```bash
trajectory config features enable kilo_durable_history
trajectory session import kilo [--session ID] [--force]
```

The watcher reads the Kilo data folder for your platform:

- `$XDG_DATA_HOME/kilo` when it is set
- `~/Library/Application Support/kilo` on macOS
- `%LOCALAPPDATA%\kilo` on Windows
- `~/.local/share/kilo` elsewhere

It reads `KILO_DB`, `kilo.db`, the current and older channel databases, and
the saved JSON storage folder. It only reads these files and never changes
them. The watcher works as follows:

- When the plugin captured a session, Trajectory keeps the plugin trace.
- It does not import old history at startup.
- When Kilo deletes a session, Trajectory does not treat that as a session
  end.
- `Stop` and session-end events make it sync only the changed sessions.
- To turn off only this watcher, set `TRAJECTORY_DISABLE_KILO_WATCHER=1`.

`KILO_CONFIG_DIR` changes where the plugin and config go. It does not change
where the watcher looks for saved history. The Kilo CLI and editor share one
store. So saved history cannot show which of them created a session.

**Testing.** Live tests run Kilo with an OpenAI model provider. They set
`KILO_PROVIDER=openai` and a `KILOCODE_MODEL`, then run `kilo run --auto`.

**Sources:** [github.com/Kilo-Org/kilocode](https://github.com/Kilo-Org/kilocode),
[Kilo CLI docs](https://kilo.ai/docs/code-with-ai/platforms/cli)

## Kiro CLI

**Status:** Beta. No minimum version is established. Fixtures validate Kiro CLI
2.12.2. Support follows the 2.12.2 stable manifest, the public command-hook and
saved-session docs, and fixtures of the SQLite storage.

**Install.** Run setup:

```bash
trajectory setup --clients kiro
```

Setup writes a Trajectory agent config to `~/.kiro/agents/trajectory.json`, or
to `$KIRO_HOME/agents/trajectory.json`. It also adds a `trajectory` MCP server
to `~/.kiro/settings/mcp.json`. The agent keeps Kiro's normal coding-agent
behavior and turns on `includeMcpJson`. Its command hooks run
`trajectory capture-hook --client kiro --ensure-serve`, and Kiro keeps working
if a hook fails.

With the stable 2.x CLI, select the agent with `--agent trajectory`. The Kiro 3.0
preview still accepts hooks embedded in an agent config during its
transition. Trajectory does not install standalone v3 hook files yet.

**What Trajectory captures.** Kiro command hooks come from the agent
configuration. Trajectory reads these hook payloads from stdin and records
`client_source=kiro`:

- `agentSpawn`
- `userPromptSubmit`
- `preToolUse`
- `postToolUse`
- `stop`

The documented `stop` hook includes `assistant_response`. Trajectory records
that final assistant text and a turn end.

**Tokens and cost.** The documented hook payloads carry no stable token or
cost usage. Trajectory marks live Kiro turns `tokens_status=unavailable`. Saved
history has no reliable token or pricing fields either. `response_size` counts
bytes, not tokens. Trajectory does not capture the local usage estimates of
earlier Kiro versions.

**Saved history.** Sync of saved history is off by default. Turn it on with:

```bash
trajectory config features enable kiro_durable_history
```

The watcher reads these sources without changing them:

- top-level session JSONL and metadata under `$KIRO_HOME/sessions/cli`, or
  `~/.kiro/sessions/cli`
- `data.sqlite3` under `~/Library/Application Support/kiro-cli` on macOS
- `data.sqlite3` under `${XDG_DATA_HOME:-~/.local/share}/kiro-cli` on Linux

It reads the current `conversations_v2` table and the older `conversations`
table, including changes still in the SQLite WAL file. If a pass fails, the
watcher retries it, also after a restart.

The Kiro session UUID links both stores to the live hooks. When both stores
exist, Trajectory takes message content from the JSONL. SQLite adds only its
model and stream-end timestamp, and only to a message with the same ID. After a
hook event arrives, Trajectory keeps the hook event, and later saved-history
changes cannot overwrite it.

Kiro documents no stable SQLite location on Windows. On Windows, Trajectory
reads only the JSONL files and does not guess a database path.

Saved history adds prompts, assistant messages, tool calls and results, the
working directory, model IDs, and Kiro's timestamps. When Kiro deletes a
session, Trajectory keeps its copy and records the deletion. It does not mark
the session as ended.

To stop only this watcher, set `TRAJECTORY_DISABLE_KIRO_HISTORY_WATCHER=1`.
Trajectory also accepts `KIRO_SESSIONS_DIR` to point discovery at another
folder. Kiro itself does not document that variable.

**Testing.** Kiro runs headless with `kiro-cli chat --no-interactive` and
`KIRO_API_KEY`. Trajectory has not yet tested Kiro with a live subscription.
Tests replay fixtures through the real capture route. They cover setup,
inventory, `trajectory doctor`, update refresh, and automatic setup.

The Kiro 3.0 preview stores sessions in a format that differs from stable 2.x.
Trajectory does not support that format until a real saved fixture exists. The
saved-history sync stays an off-by-default preview until a signed-in run of a
current release confirms the SQLite schema and platform paths.

**Sources:**

- [Kiro CLI hooks](https://kiro.dev/docs/cli/hooks/)
- [Kiro CLI MCP](https://kiro.dev/docs/cli/mcp/)
- [Kiro CLI session management](https://kiro.dev/docs/cli/chat/session-management/)
- [Kiro CLI 3.0](https://kiro.dev/docs/cli/v3/)
- [Kiro CLI custom-agent configuration](https://kiro.dev/docs/cli/custom-agents/configuration-reference/)
- Earlier Amazon Q Developer CLI references in
  [amazon/amazon-q-developer-cli](https://github.com/aws/amazon-q-developer-cli)

## Devin CLI

**Status:** Beta (preview). No minimum version is established. Support follows
the public Devin CLI extensibility docs and the current shape of its local
session store.

**Install.** Devin support is a preview and is off by default. Turn on the
feature flag before you run setup:

```bash
trajectory config features enable devin_cli_instrumentation
trajectory setup --clients devin
```

Setup adds Trajectory wake hooks and `mcpServers.trajectory` to the platform
config file:

- macOS and Linux: `~/.config/devin/config.json`
- Windows: `%APPDATA%\devin\config.json`

Setup also installs the global incognito skill below that config folder. It does
not change project config in `.devin/config.json` or
`.devin/config.local.json`.

While the feature flag is off, setup does not change Devin config or install
files, and Trajectory does not sync Devin sessions. Managed policy and
`TRAJECTORY_DISABLE_FEATURES` can keep the preview off even after a local
enable.

**What Trajectory captures.** Devin hook payloads carry no stable session ID.
So Trajectory uses `SessionStart`, `UserPromptSubmit`, tool, stop, and
`SessionEnd` hooks only as wake hooks. A wake hook tells Trajectory to re-read
saved history and carries no session content. Devin keeps working if a hook
fails.

Trajectory reads active or changed sessions from Devin's saved history:

- macOS: `~/Library/Application Support/devin/cli/sessions.db` and
  `~/Library/Application Support/devin/cli/transcripts/<session-id>.json`
- Linux: `~/.local/share/devin/cli/sessions.db` and
  `~/.local/share/devin/cli/transcripts/<session-id>.json`
- Windows: `%APPDATA%\devin\cli\sessions.db` and
  `%APPDATA%\devin\cli\transcripts\<session-id>.json`

Trajectory prefers the transcript JSON. When a transcript is missing, it reads
`message_nodes.chat_message` in `sessions.db` instead. Each session keeps its
own identity. Trajectory never assigns a hook to the newest session in the same
working directory.

From these files, Trajectory recovers prompts, assistant and thinking text,
tool calls and results, and the model.

**Tokens and cost.** Trajectory records per-step prompt, completion, and cache
tokens when Devin saves them. It reads the final aggregate `Snapshot.Usage` but
does not record it yet. If a source later includes native cost, Trajectory
keeps that cost and does not recompute it from tokens.

**Saved history.** No bulk import exists for Devin. The preview syncs only
active or changed sessions. Sync progress survives a restart, and Trajectory
retries a failed pass. When Devin rewrites a session, Trajectory rebuilds its
local JSONL record and refreshes the local UI without a duplicate copy.
Rebuilt token and cost values do not count twice in metrics.

Trajectory cannot retract rows that it already published if Devin later
removes them.

Trajectory closes a session only when Devin moves it from a database message to
a finalized transcript. Without that transition, terminal closure and
final-session metrics are a known gap. Trajectory does not infer the end of a
session from a hook, a shutdown, or an orphaned session.

**Privacy and segmentation.** Trajectory redacts session titles, prompts,
assistant and thinking text, tool input, and tool output before it writes the
local JSONL record or its recovery data. After incognito is turned off, later
sync of that session stays private. Trajectory keeps that privacy record until
Devin confirms the session ended, and keeps it with no time limit if Devin never
does.

The saved history does not show whether a session was interactive or headless.
Trajectory treats Devin sessions as headless and skips segmentation, because
the run mode is unknown.

Devin imports Claude hook configuration by default. Trajectory does not turn off
that user setting. When `DEVIN_PROJECT_DIR` marks a Devin process, Trajectory
ignores or reassigns its own imported Claude hooks. One action is then never
recorded as both Claude Code and Devin.

**Testing.** Tests use fixtures of the current `sessions.db` and transcript
formats. They include the database-only fallback and concurrent sessions. Devin
now documents `devin --print` as a stable headless mode and a saved
`credentials.toml` token. Trajectory has not yet run a live test with Devin
identity or that credential file. Trajectory does not rely on an undocumented
`DEVIN_API_KEY` variable.

**Sources:**

- [Devin hooks](https://docs.devin.ai/cli/extensibility/hooks/overview)
- [Lifecycle hooks](https://docs.devin.ai/cli/extensibility/hooks/lifecycle-hooks)
- [MCP configuration](https://docs.devin.ai/cli/extensibility/mcp/configuration)
- [Skills](https://docs.devin.ai/cli/extensibility/skills/overview)
- [CLI commands](https://docs.devin.ai/cli/reference/commands)
- [Devin authentication](https://docs.devin.ai/cli/enterprise/devin-auth)
- [ccusage source-support assessment](https://github.com/ryoppippi/ccusage/blob/997ad7f90189867d9f218aa0e7401586e3b9fde8/docs/guide/source-support-qa.md)

## Qoder CLI

**Status:** Beta (preview). No minimum version is established. Fixtures and
artifact checks validate Qoder CLI 1.0.43.

**Install.** Qoder support is off by default. Turn on the feature flag, then run
setup:

```bash
trajectory config features enable qoder_cli_instrumentation
trajectory setup --clients qoder
```

Setup builds a Trajectory plugin and manages it with Qoder's own commands:
`qodercli plugins validate`, `plugins install --scope user`,
`plugins list --json`, and `plugins uninstall --scope user`. The plugin adds
lifecycle wake hooks, `.mcp.json`, an incognito skill, and an `/incognito`
command. A wake hook tells Trajectory to re-read saved history and carries no
session content. When the feature is off or managed policy turns it off, setup
does not change any plugin.

**Saved history.** Trajectory reads Qoder's sessions from `~/.qoder/projects`,
or from `$QODER_CONFIG_DIR/projects`. `QODER_PROJECTS_DIR` is an older
override that points straight at the projects folder. Trajectory does not scan
`~/.qoderwork/projects`, because that folder belongs to a separate product.

Qoder saves these files in each project folder:

- main transcripts: `<project>/<session>.jsonl`
- metadata: `<project>/<session>-session.json`
- subagents: `<project>/<parent>/subagents/agent-*.jsonl`

Qoder appends a new snapshot of an assistant message under the same message ID.
Trajectory keeps the last snapshot and counts its tokens once. If Qoder changes
an earlier message, Trajectory rebuilds its local JSONL record for that
session. When Qoder deletes a session, Trajectory keeps its copy and records the
deletion. It does not mark the session as ended. Trajectory never changes
Qoder's files.

Qoder uses IDs such as `qoder:<id>` and
`qoder:<parent>:subagent:<agent>`. Trajectory stores them as
`provider_session_id` and `provider_parent_session_id`. Its own `session_id`
and `parent_session_id` use hyphens instead of colons. Trajectory session IDs
become file names on every platform, so they cannot contain colons. Trajectory
also keeps the raw IDs.

**What Trajectory captures.** Trajectory records prompts, assistant and thinking
text, tools, the model, subagents, and lifecycle events.

**Tokens and cost.** Trajectory records Qoder's own prompt, completion,
cache-write, and cache-read token counts and marks them as native.

**Privacy and segmentation.** The saved history does not show whether a session
was interactive or headless. Trajectory records these sessions with
`is_headless=true` and `source_mode=unknown`. Trajectory treats the session as
headless and skips segmentation, because the run mode is unknown.

**Testing.** Fixture tests are the current release check. A live test with a
`QODER_PERSONAL_ACCESS_TOKEN` is pending.

## ZCode

**Status:** Beta (preview). No minimum version is established. Fixtures validate
ZCode 3.3.6 with its built-in agent 0.15.2.

**Install.** ZCode support is off by default. Turn on the feature flag, then run
setup:

```bash
trajectory config features enable zcode_instrumentation
trajectory setup --clients zcode
trajectory session import zcode  # Optional complete-history repair
```

Setup changes only `~/.zcode/cli/config.json` and keeps unrelated settings. It
adds wake-only process hooks, a Trajectory MCP server, and a folder for the
Trajectory incognito skill. The hooks carry no lifecycle or session content.
They only tell `trajectory serve` to re-read ZCode's SQLite rows.

**Saved history.** Trajectory follows these settings to find ZCode's database:

- the default `~/.zcode/cli/db/db.sqlite`
- `ZCODE_STORAGE_DIR`
- `storage.sessionDbPath`
- `ZCODE_SESSION_DB_PATH`
- the `ZCODE_SESSION_DB` alias

Trajectory syncs changes to the database and its WAL and SHM files. Run
`trajectory session import zcode` to import or repair the complete history. When
ZCode changes a session, Trajectory replaces only its own copy. When ZCode
deletes a session, Trajectory keeps its copy and records the deletion. It does
not mark the session as ended.

`session.time_updated` records activity, not the end of a
session. Trajectory does not mark an active session as ended. Only a saved
`time_archived` value closes a session.

**What Trajectory captures.** Session, message, and part rows supply:

- session identity, parent links, and working directory
- prompts and assistant and thinking text
- model and model provider
- tool calls and results

**Tokens and cost.** Current `model_usage` rows take priority over older
per-message totals. Each finished attempt stays a separate `llm_call` event,
linked to its retries. The turn adds up input, output, reasoning, cache-create,
and cache-read counts. The database holds no billing amount. Trajectory
computes cost from tokens only when it knows the model's rate. Otherwise cost
is unavailable.

**Privacy and segmentation.** Sessions seen only in ZCode's history are treated
as headless and skip segmentation, because the run mode is unknown.

**Testing.** Testing inspects the official ZCode release and uses fixtures. The
fixtures cover setup, hook wakeups, session changes, retry accounting, manual
import, the local JSONL record, SQLite, and local UI (Lapdog) reads. A signed-in
test with a real conversation and incognito is still pending.

## CommandCode

**Status:** Beta (preview). No minimum version is established. Fixtures validate
the CommandCode 0.44.1 package.

**Install.** CommandCode support is off by default. Turn on the feature flag,
then run setup:

```bash
trajectory config features enable commandcode_instrumentation
trajectory setup --clients commandcode
```

Setup keeps your existing configuration and adds:

- Trajectory wake hooks in `~/.commandcode/settings.json`
- a user MCP entry in `~/.commandcode/mcp.json`
- Trajectory's incognito skill and command files

A wake hook tells Trajectory to re-read saved history and carries no session
content. Setup never installs a shim. Trajectory detects CommandCode through
the `command-code`, `commandcode`, and `cmdc` commands on all platforms. It
never uses the generic `cmd` alias, because other programs share that name.

**Saved history.** Trajectory reads
`~/.commandcode/projects/<project>/<session>.jsonl` and the optional
`<session>.meta.json` file next to it. It skips checkpoint, prompt, share, and
file-history files.

Each CommandCode save rewrites the whole transcript. The save creates new
message IDs and, in headless runs, may create new timestamps. Trajectory
matches messages by their content order and tool-call IDs instead. If a part
that Trajectory already recorded changes, Trajectory rebuilds only its own copy
of that session.

**What Trajectory captures.** The native `SessionStart`, `PreToolUse`,
`PostToolUse`, and `Stop` hooks tell Trajectory to scan the matching transcript.
They supply the working directory when present. A native Stop marks a turn
boundary. Regular polling still catches missed hooks and sessions that exist
only as transcripts.

Trajectory records prompts, assistant and reasoning text, and tool calls and
results. CommandCode writes no reliable session-end event, so Trajectory does
not infer one.

**Tokens and cost.** CommandCode does not reliably save the model, token counts,
or cost. Trajectory does not infer them. If a later step estimates usage from
text, that value stays labeled as estimated.

**Privacy and segmentation.** A hook event does not show whether a session is
interactive. Trajectory treats CommandCode sessions as headless and skips
segmentation, because the run mode is unknown. The `/incognito` command needs
the session ID. Turn incognito off yourself when you are done, because
CommandCode sends no session end.

**Testing.** Fixtures of the 0.44.1 format, the local JSONL record, and Lapdog
queries are the current release check. A live, signed-in test is still needed
to check hook timing, the incognito flow, and future format changes.

## Kimi Code CLI

**Status:** Beta (preview). No minimum version is established. Kimi Code CLI
1.49.0 is checked against source. Support follows the current Kimi Code source
and hook schemas.

**Install.** Kimi Code support is off by default. Turn on the feature flag, then
run setup:

```bash
trajectory config features enable kimi_cli_instrumentation
trajectory setup --clients kimi
```

Setup manages three things and nothing else:

- a marked `[[hooks]]` block in `$KIMI_CODE_HOME/config.toml`, which defaults
  to `~/.kimi-code/config.toml`
- the `mcpServers.trajectory` entry in `mcp.json`
- the user incognito skill

The hooks fire on lifecycle, prompt, stop, and subagent events. They only tell
Trajectory to re-read Kimi's saved files. When the files and a hook disagree,
Trajectory uses the files.

**Saved history.** Current sessions live in
`sessions/<work-dir-key>/<provider-session-id>/agents/main/`, with child agents
in sibling folders. Trajectory session IDs stay safe for file names. Trajectory
also keeps Kimi's own IDs, such as `kimi:<provider-id>`, and the parent and tool
links.

Trajectory watches the wire, context, and session state files, the session's
row in the top-level `session_index.jsonl`, and agent metadata. It notices a
rewrite even when the file size and time stay the same. When Kimi deletes a
session, Trajectory keeps its copy and records the deletion. It does not mark
the session as ended.

Trajectory searches a `KIMI_DIR` override first. It also reads older records
from `KIMI_SHARE_DIR` or `~/.kimi`. When a session exists in both places, it
keeps the copy in the current `KIMI_CODE_HOME`.

**What Trajectory captures.** Trajectory reads current metadata, config, turn,
context step, tool, and usage records, and older nested Wire records. It keeps
thinking, the model, tool calls and results, the stop reason, and main,
subagent, and fork links.

**Tokens and cost.** Trajectory records Kimi's own input, output, cache-read,
and cache-create token counts. Trajectory computes cost itself and labels it as
computed. It never presents that cost as the vendor's bill.

**Privacy and segmentation.** Trajectory treats the session as headless and
skips segmentation, because the run mode is unknown. When main and child
sessions run at the same time in one workspace, incognito needs the session ID.

**Testing.** Default tests use fixtures of the current and older formats. They
also run real local UI (Lapdog) queries. A live test with `KIMI_MODEL_NAME`,
`API_KEY`, and a read-only prompt is pending.

**Sources:** [Kimi Code CLI](https://github.com/MoonshotAI/kimi-cli),
[Kimi hooks](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/hooks.html),
and [data locations](https://www.kimi.com/code/docs/en/kimi-code-cli/configuration/data-locations.html).

## gptme

**Status:** Beta (preview). Minimum version 0.32.0, tested by live replay.
gptme 0.32.1 is checked against source.

**Install.** gptme support is off by default. Turn on the feature flag, then run
setup:

```bash
trajectory config features enable gptme_instrumentation
trajectory setup --clients gptme
```

Setup uses `~/.config/gptme/config.toml` on every OS, because gptme 0.32 reads
user config from that path. Setup does these things:

- installs the `trajectory_gptme` folder plugin under `~/.config/gptme/plugins`
- turns on MCP
- registers the native `/incognito` command

Setup keeps unrelated TOML settings. It first checks local and project config
files that would override the user config. It refuses to replace a plugin
folder or `trajectory` MCP entry that Trajectory does not own.

**What Trajectory captures.** The hooks carry only identity, the run mode when
gptme reports it reliably, lifecycle, and tool events that wake the watcher.
Content comes from gptme's saved `conversation.jsonl`, `events.jsonl`, and
`config.toml` files. These files supply the model, thinking, tool arguments and
results, tokens, and cost.

**Saved history.** The watcher handles partly written files, edit and undo
replays, rewrites, replaced files, and deleted sessions. On first start, it
syncs existing sessions without repeating events that hooks already sent.

If `GPTME_LOGS_HOME` is set, Trajectory reads only that folder. Otherwise it
reads each of these log folders:

- `gptme/logs` under `XDG_DATA_HOME`, when it is set
- the older `~/.local/share/gptme/logs`
- the platform data folder, such as `~/Library/Application Support/gptme/logs`
  on macOS

Current gptme 0.32 does not use `GPTME_DIR`, so Trajectory ignores it.

**Tokens and cost.** Trajectory keeps gptme's per-message input, output,
cache-read, and cache-creation tokens. It adds them up across all model calls in
the user turn. Recorded cost stays labeled as computed. gptme saves local times
without a time zone, so Trajectory labels those times as time zone unknown.

**Privacy and segmentation.** `--non-interactive` runs are headless. For other
runs, gptme gives no reliable interactive signal. Trajectory treats the session
as headless and skips segmentation, because the run mode is unknown.

**Testing.** Default tests install real gptme 0.32.0 and run its `mock/echo`
model provider, which needs no credentials. The test requires a `SessionEnd`
from the plugin. Fixtures separately test segmentation of a non-headless session
and Lapdog queries. Native OTLP export from gptme stays off until tests cover
removing duplicates across hooks, saved files, and OTLP.

**Sources:** [gptme](https://github.com/gptme/gptme)

## ForgeCode

**Status:** Beta (passive-history preview). No minimum version is established.
ForgeCode 2.13.18 is checked against source.

**Install.** ForgeCode support is off by default. Turn on the feature flag, then
run setup:

```bash
trajectory config features enable forgecode_instrumentation
trajectory setup --clients forgecode
```

Setup installs these items under the active ForgeCode folder:

- a `trajectory` MCP entry
- an incognito skill
- an `/incognito` command

Uninstall removes only these entries. The `forge` and `forge-code` setup aliases
mean `forgecode`. To detect ForgeCode on `PATH`, Trajectory runs the read-only
`forge config path` command and checks its output. Another product that installs
a `forge` command is not treated as ForgeCode.

**Saved history.** Trajectory opens ForgeCode's `.forge.db` read-only. It
watches the database and its WAL and SHM files. Trajectory uses only the first
folder that applies:

1. `FORGE_CONFIG`, when set
2. the older `~/forge`, when it exists
3. the current `~/.forge`

Each conversation row has a stable ID and a JSON context. The context holds
system, user, assistant, reasoning, image, tool-call, tool-result, model,
usage, and child-conversation data. Trajectory notices rewrites that keep the
same size and time, and rebuilds its own copy after a change. When ForgeCode
deletes a row, Trajectory keeps its copy and records the deletion. It does not
mark the session as ended.

ForgeCode messages have no timestamps. Trajectory orders them by the
conversation's `created_at` value and the message position. It labels every such
timestamp as synthetic.

**What Trajectory captures.** Trajectory records system, prompt, assistant, and
reasoning messages, tool calls and results, failed tool results, the model, the
working directory, and child-conversation links. ForgeCode history does not show
which session is live or when it ends.

**Tokens and cost.** Trajectory records actual token counts as native usage.
Approximate and mixed counts stay labeled as estimated. Recorded cost keeps the
label that ForgeCode reported it, so it is not shown as a Trajectory estimate.

**Privacy and segmentation.** Saved history cannot identify the open
conversation. So the incognito command needs a `forgecode-...` session ID that
you pick from `trajectory status --json`. It never guesses by workspace or by
the newest session. Trajectory treats these sessions as headless and skips
segmentation, because the run mode is unknown.

**Testing.** The release check loads a sample of the current schema into a real
SQLite database in WAL mode. It tests the parser, the watcher, setup, markers,
and Lapdog queries. A live test of ForgeCode's saved history and of incognito
through the model is still to do.

**Sources:** [ForgeCode](https://forgecode.dev/),
[ForgeCode source](https://github.com/tailcallhq/forgecode), and
[ForgeCode piping guide](https://forgecode.dev/docs/piping-guide/)

## Warp/Oz CLI

**Status:** Beta (preview). No minimum version is established. Support covers
the saved history of local Warp Desktop and the local Oz CLI. Cloud runs with
`oz agent run-cloud` are not supported.

**Install.** Warp support is off by default. Turn on the feature flag, then run
setup:

```bash
trajectory config features enable warp_oz_instrumentation
trajectory setup --clients warp
```

Setup adds only `mcpServers.trajectory` to `~/.warp/.mcp.json` and writes
`~/.warp/skills/trajectory-incognito/SKILL.md`. Both entries carry a Trajectory
ownership marker. Setup refuses to overwrite an entry that Trajectory does not
own. Uninstall removes only Trajectory's entries.

**Saved history.** Trajectory opens `warp.sqlite` read-only and watches the
database and its WAL and SHM files. It covers the stable, preview, legacy, and
`tui` folders on macOS, Linux, and Windows. That includes Warp Desktop and local
`oz agent run` sessions. `WARP_DIR` overrides the folder.

Each session is keyed by its database and its conversation ID. So the same
conversation ID in two channels or folders stays two separate sessions. When
Warp deletes a session, Trajectory keeps its copy and records the deletion.

**What Trajectory captures.** Trajectory decodes `agent_tasks.task` with Warp's
public protobuf definitions. It keeps:

- user and assistant text and reasoning
- native tool calls and results
- the selected model and the working directory
- Warp's task hierarchy

Child tasks become subagents with their own `agent_id` links, so they stay
separate from the parent. When no task row can be decoded, Trajectory falls back
to `ai_queries` and records the prompts only.

If a protobuf row fails to decode, Trajectory reports
`warp.source.protobuf_decode_incomplete` with the schema version and the
fallback it used.

These limits keep long Warp conversations from slowing down
`trajectory serve`:

- Trajectory decodes at most 4,096 messages per session. It does not import a
  longer session in part. It records only an incomplete-source diagnostic.
- Trajectory tracks at most 512 sessions at a time. Older conversations outside
  that set are watched again only after they come back into it.

**Tokens and cost.** Warp saves one usage total per conversation. Trajectory
keeps that total only as diagnostic metadata. It does not add it to Lapdog token
values or published token fields. Trajectory does not count it as output tokens,
split it into input and output, or infer a cost.

**Privacy and segmentation.** The saved history shows neither the end of a
session nor whether it was interactive. Trajectory does not mark sessions as
ended. It treats the session as headless and skips segmentation, because the
run mode is unknown.

**Testing.** Fixtures test SQLite and protobuf decoding, stable IDs, deleted
sessions, rewrites, and the task hierarchy through JSONL and Lapdog. They also
test setup ownership, feature flag order, inventory, and automatic setup. After a
crash, Trajectory may repeat some side effects of writing its JSONL record.

Live tests are still needed for signed-in local `oz agent run`, a supported
session-end signal, and incognito. Cloud runs are not supported.

## VS Code Copilot Chat

**Status:** Beta (fixture preview). No minimum version is established. This
integration is separate from the `copilot` CLI client.

**Install.** VS Code Copilot Chat support is off by default. Turn on the feature
flag, then run setup:

```bash
trajectory config features enable vscode_copilot_instrumentation
trajectory setup --clients vscode-copilot
```

Setup changes only user-level VS Code settings, and records what it owns before
it changes anything. Setup does these things:

- turns on the `otlp-http` exporter at `http://127.0.0.1:19222`
- keeps `github.copilot.chat.otel.captureContent` set to false
- adds the Trajectory MCP server to `User/mcp.json`
- installs an incognito prompt

Setup never overwrites a conflicting value that you set. Uninstall removes only
the values and files that Trajectory owns. A managed feature disable and
`TRAJECTORY_DISABLE_FEATURES` take priority over a local enable.

**What Trajectory captures.** Trajectory accepts native OpenTelemetry traces
from Copilot Chat only when the root span has all of these:

- `service.name=copilot-chat`
- `gen_ai.operation.name=invoke_agent`
- `gen_ai.provider.name=github`
- a non-empty `gen_ai.agent.name`
- Copilot's own `copilot_chat.session_id`
- no parent Copilot chat-session attribute

The agent name can be any value, because each top-level mode and participant
sets its own name. A nested subagent span cannot replace or copy the accepted
root. Its child data stays on the parent trace for now. Spans from the
standalone CLI and from other tools lack this full set, so their own clients
keep them.

Trajectory records accepted `invoke_agent`, `chat`, `execute_tool`, and
`execute_hook` spans. Content capture is off, so Trajectory never infers the
missing content.

Native lifecycle, tool, and token data take
priority. Saved history still supplies the text. When native data arrives late,
Trajectory updates only the matching token or tool data. A split delivery cannot
erase usage or a tool from saved history before the native data is stored.

**Saved history.** Trajectory reads chat history from Code, Code - Insiders, and
VSCodium:

- `User/workspaceStorage/*/chatSessions`
- `globalStorage/emptyWindowChatSessions`
- `transferredChatSessions`

`VSCODE_COPILOT_DIR` can point straight at a fixture or a managed `User` folder.
When a session exists in both formats, Trajectory reads the JSONL operation log
and ignores the JSON copy. Changes to workspace manifests also trigger a new
sync.

**Testing.** Fixtures cover:

- discovery, JSONL replay, and session identity
- top-level agent names and nested-span isolation
- split, out-of-order, and repeated deliveries
- multi-turn counters and setup ownership
- recovery from late native data, and the priority of native over saved data

Restart tests check stable ordering and that replays change nothing. Lapdog
queries return the fixture's 16-token total once, without double-counted usage.
Before this integration leaves fixture preview, it needs a live smoke test of
OTel from the real VS Code app. It also needs a live test that links an
interactive incognito session.

**Sources:**
[VS Code monitoring agents](https://code.visualstudio.com/docs/agents/guides/monitoring-agents),
[VS Code MCP configuration](https://code.visualstudio.com/docs/agents/reference/mcp-configuration),
and [VS Code prompt files](https://code.visualstudio.com/docs/agent-customization/prompt-files).

## Windsurf

**Status:** Beta (preview). No minimum version is established. Trajectory
combines native hooks with Windsurf's saved history.

**Install.** Windsurf support is off by default. Turn on the feature flag, then
run setup:

```bash
trajectory config features enable windsurf_instrumentation
trajectory setup --clients windsurf
```

Setup adds Trajectory entries to three official Windsurf user files:

- hooks: `~/.codeium/windsurf/hooks.json`
- MCP: `~/.codeium/windsurf/mcp_config.json`
- the global `/incognito` workflow:
  `~/.codeium/windsurf/global_workflows/incognito.md`

Setup keeps unrelated entries. Uninstall removes only entries that carry a
Trajectory ownership marker.

Windsurf hook entries have no timeout field, and `pre_user_prompt` can block the
prompt. So each Trajectory hook waits at most two seconds for the server, with
`--ensure-serve-wait 2s`. It also discards its output and always exits 0.
`trajectory doctor` flags an older Trajectory hook that lacks these guards. Run
setup again to replace it.

**What Trajectory captures.** The main source is Windsurf's
`post_cascade_response_with_transcript` hook and the transcript at
`~/.windsurf/transcripts/{trajectory_id}.jsonl`. Trajectory keeps the same
newest-100 limit that Windsurf uses for transcripts. It records these fields
when present:

- prompts and assistant responses
- lifecycle status
- the model
- the execution ID and timestamp

Trajectory does not turn code actions in the transcript into tool calls. The
public schema does not define them as the same thing.

The transcript hook starts an immediate scan of that file. Regular polling
catches missed hooks. This preview does not install a recursive file watcher.

**Tokens and cost.** The public transcript and the older database do not include
tokens or cost. Trajectory makes no cost claim.

**Saved history.** For older conversations only, Trajectory checks the
`User/workspaceStorage/*/state.vscdb` files of stable and Next Windsurf. It reads
only the `workbench.panel.aichat.view.aichat.chatdata` and `aiChat.chatdata`
keys. It never copies other `ItemTable` values. This history adds prompt and
assistant text only. Trajectory does not invent timestamps, models, tools,
tokens, or cost for it.

When both sources describe the same conversation, Trajectory keeps the
transcript. Each database session has an ID of the form `<db>#<session-id>`.
When a session is deleted, Trajectory keeps its copy and records the deletion.
Transcript eviction does not count as a clean session end.

**Privacy and segmentation.** Non-headless sessions are eligible for
segmentation. Headless sessions skip it.

**Testing.** Fixture replay is the preview release check. Windsurf is an
interactive IDE with no supported way to sign in headless. A live pilot still
needs to confirm, in the real UI, these items:

- hook delivery and the transcript schema
- variants of the older database schema
- a clean `SessionEnd`
- running `/incognito`

**Sources:** [Cascade hooks](https://docs.windsurf.com/windsurf/cascade/hooks),
[MCP](https://docs.windsurf.com/windsurf/cascade/mcp), and
[Workflows](https://docs.windsurf.com/windsurf/cascade/workflows).

## Zed

**Status:** Beta (preview). Trajectory reads Zed's saved history only. No
minimum version is established. Zed 1.11.3 is checked against source.

**Install.** Zed support is off by default. Turn on the feature flag, then run
setup:

```bash
trajectory config features enable zed_passive_history
trajectory setup --clients zed
```

Setup owns only `context_servers.trajectory` in Zed's `settings.json` and the
global `~/.agents/skills/trajectory-incognito/SKILL.md`. Setup refuses to
overwrite an entry that you own. Uninstall removes only Trajectory's entries.

This integration has no lifecycle hooks, launch wrapper, native OTel, session
end, or bulk import.

**Saved history.** Trajectory syncs `threads/threads.db` read-only from Zed's
data folder:

- macOS: `~/Library/Application Support/Zed`
- Linux: `$XDG_DATA_HOME/zed` or `~/.local/share/zed`
- Windows: `%LOCALAPPDATA%\Zed`
- any OS: `ZED_DIR`, when set

Trajectory also syncs changes to the SQLite WAL and SHM files. Regular polling
catches missed file notifications. When Zed deletes a session, Trajectory keeps
its copy and records the deletion.

**What Trajectory captures.** Each database row is one session. Its JSON and
zstd payloads give prompts, assistant and thinking text, tool calls and results,
the model, and the working directory.

Rows that have a `parent_id` are real subagent sessions. Trajectory keeps them,
with their parent IDs and `relationship=subagent`. Trajectory keeps Zed's own
`zed:<id>` IDs next to its file-safe `zed-<id>` IDs.

Zed rows have no per-message timestamps. Trajectory derives the message order
and labels those timestamps `provider_timestamp_present=false` and
`timestamp_provenance=derived_order`. Only the row's created and updated times
come from Zed.

**Tokens and cost.** Trajectory keeps Zed's `request_token_usage` values as one
session total. It never assigns them to a message or turn. The raw JSONL keeps
them as `provider_session_usage` metadata on the session start.

**Privacy and segmentation.** The saved history does not show whether a session
was interactive or headless. Trajectory treats the session as headless and skips
segmentation, because the run mode is unknown.

**Testing.** Fixtures and local UI (Lapdog) queries are the current release
check. Live tests of the Zed UI, the database schema, incognito, and folders on
each platform are still to do.

**Sources:** [Zed Agent configuration](https://zed.dev/docs/assistant/configuration),
[MCP servers](https://zed.dev/docs/ai/mcp), and
[agent skills](https://zed.dev/docs/ai/skills).

## OpenClaw

**Status:** Saved-history import beta. Released Trajectory builds do not
capture OpenClaw live, and they have no setup, MCP, or incognito controls for
it. Support follows the saved-session layout of OpenClaw v2026.7.1.

**Saved history.** Trajectory reads OpenClaw's saved session JSONL. Turn it on, then run a full repair when needed:

```bash
trajectory config features enable openclaw_durable_history
trajectory session import openclaw
trajectory session import openclaw --session <provider-session-id> --force
```

Trajectory finds OpenClaw's state folder in this order: `OPENCLAW_STATE_DIR`,
then `~/.openclaw`, then the official older `~/.clawdbot`. In that folder it
reads:

- `agents/<agent-id>/sessions`
- session IDs and parent links from `sessions.json`
- active JSONL files before reset or deleted archives
- the newest archive, only when no active file exists

Existing `.kimi_openclaw`, `.moltbot`, and `.moldbot` folders are read as
compatibility folders, not as current OpenClaw defaults. Entries in
`TRAJECTORY_OPENCLAW_HISTORY_DIRS` must use the same agent folder layout. A
`sessionFile` entry in `sessions.json` names the session's file. Trajectory
reads it only when it is inside that agent's `sessions` folder.

Trajectory skips backups, checkpoints, symbolic links, internal cron runs,
dreaming runs, and their child sessions. Saved history adds:

- prompts, responses, and thinking
- native tool calls and results
- model changes and snapshots
- compaction
- parent and child session links
- token counts per message and the cost that the model provider billed

The watcher notices rewrites
that keep the same size and time, though not right away. When OpenClaw deletes a
session, Trajectory keeps its copy and records the deletion. It does not mark the
session as ended.

**Privacy and segmentation.** Sessions from saved history are treated as headless,
because the run mode is unknown. They skip segmentation.

**Testing.** Tests use fixtures of the current schema. They cover watcher and
import changes and local UI reads. These items are still to do:

- setup-managed install
- MCP and incognito controls
- a live, signed-in test of saved history
- any future SQLite session store in OpenClaw

**Sources:** [ccusage OpenClaw adapter](https://github.com/ryoppippi/ccusage).
Its `OPENCLAW_DIR` setting belongs to ccusage, not to OpenClaw.

## Version Check

To check which version of a client is installed, run its version command. This
works when the client CLI reports a version:

```bash
claude --version          # Claude Code
codex --version           # Codex CLI
copilot version           # GitHub Copilot CLI
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
openclaw --version        # OpenClaw
```
