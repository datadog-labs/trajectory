# Client Instrumentation Reference

This page explains how Trajectory connects to each coding agent. For each
client it lists what setup installs, how capture works, which data is
available, and what is missing.

Trajectory uses each client's own plugin, hook, MCP, or history files. Every
capture path writes session JSONL under `~/.trajectory/trajectories/`. Live
events reach the local capture server on `localhost:19222` through the
transport that each client supports.

For install status and version support, see
[SUPPORTED-CLIENTS.md](SUPPORTED-CLIENTS.md). For the built-in client guides,
run:

```bash
trajectory user-guide clients
```

## Summary

| Client | Setup | Live capture | Past sessions |
|---|---|---|---|
| Claude Code | `trajectory setup --clients cc` (`--install-client-shims` optional) | Marketplace plugin hooks and MCP. Optional `trajectory claude` launcher. | Transcript backfill |
| Claude Desktop (macOS) | `trajectory setup --clients claude-desktop` | Watcher that reads Cowork session files | `trajectory session import claude-desktop` |
| Codex CLI | `trajectory setup --clients codex` (`--install-client-shims` optional) | CLI and Desktop hooks for session start, prompt, `Stop`, and `SessionEnd`. Rollout files are the source of truth. Optional full eleven-event hook mode. Optional `trajectory codex` launcher that keeps complete Responses API requests and responses. | Codex rollout backfill |
| GitHub Copilot CLI | `trajectory setup --clients copilot`. Optionally install the command shim and turn on `copilot_cli_durable_history` or `copilot_cli_native_otel`. | Beta plugin command hooks and MCP. Optional session-state watcher. Optional native OTel request capture with content off. | `trajectory session import copilot`, behind `copilot_durable_history` |
| VS Code Copilot Chat | Turn on `vscode_copilot_instrumentation`, then `trajectory setup --clients vscode-copilot` | Chat history files, first-party native OTel, MCP, and an incognito prompt | Tested with fixtures. Not yet tested in the real app or with incognito. |
| Cursor Desktop | `trajectory setup --clients cursor` | 18 Agent command hooks and MCP. Tab and workspace hooks are left out on purpose. | Cursor chat backfill |
| cursor-agent CLI | Turn on `cursor_agent_durable_history`. Command hooks use the Cursor setup. | Off by default. A watcher reads current and legacy JSONL transcripts. | The same transcript files plus Cursor chat stores |
| Antigravity CLI (`agy`) | `trajectory setup --clients agy` | Antigravity plugin command hooks and MCP | Off by default. Prompt history and generation usage through `antigravity_durable_history`. |
| Goose | `trajectory setup --clients goose` | Open Plugins command hooks | On by default. SQLite history and usage through `goose_durable_history`. |
| Cline CLI | `trajectory setup --clients cline` | File hooks and MCP | None |
| Factory Droid | `trajectory setup --clients droid` | Beta Factory command hooks and MCP | None |
| Hermes Agent | `trajectory setup --clients hermes` | Observer Python plugin and MCP | Off by default. Read-only `state.db` import through `hermes_durable_history`. |
| Amp Code | `trajectory setup --clients amp` | System TypeScript plugin and MCP | Off by default. Thread files through `amp_durable_history`. |
| Qwen Code | `trajectory setup --clients qwen` | Native HTTP hooks and MCP | Off by default. Chat JSONL watcher and import, including archives, through `qwen_durable_history`. |
| Kiro CLI | `trajectory setup --clients kiro` | Agent command hooks and MCP | Off by default. JSONL and SQLite history through `kiro_durable_history`. |
| Pi | `trajectory setup --clients pi` | TypeScript extension and MCP | `.pi/agent/sessions` backfill |
| Oh My Pi (`omp`) | Turn on `omp_instrumentation`, then `trajectory setup --clients omp` | Native `omp.extensions` capture, MCP, and an automatic v3 history watcher | `trajectory session import omp` |
| OpenCode | `trajectory setup --clients opencode` | OpenCode plugin SDK events and MCP | JSON and SQLite history import. Optional watcher. |
| Kilo Code | `trajectory setup --clients kilo` | OpenCode-compatible plugin SDK events and MCP. Optional history watcher. | `trajectory session import kilo`, behind `kilo_durable_history` |
| OpenHands | `trajectory setup --clients openhands`. Optionally turn on `openhands_durable_history`. | Command hooks and MCP. Off-by-default history watcher. No OTLP relay by default. | `trajectory session import openhands`, behind `openhands_durable_history` |
| Continue CLI | `trajectory setup --clients continue --install-client-shims` | Opt-in `cn` shim. After each run, Trajectory rebuilds the session and tool state that changed. | Current run only. Follows the CLI's `--resume` and `--fork` choice. No bulk backfill. |
| Codebuff | `trajectory setup --clients codebuff --install-client-shims` | Opt-in command shims. Chat history import after each run. | Codebuff chat history backfill. No guessed session end. |
| Aider | `trajectory setup --clients aider --install-client-shims` | Opt-in `aider` shim and Aider history files | `trajectory session import aider`, behind `aider_durable_history` |
| Mistral Vibe | `trajectory setup --clients mistral-vibe --install-client-shims` | Opt-in `vibe` shim, Vibe hooks, and session log import after each run | `trajectory session import mistral-vibe`, behind `mistral_vibe_durable_history` |
| Windsurf | Turn on `windsurf_instrumentation`, then `trajectory setup --clients windsurf` | Cascade hooks that tell Trajectory to read the transcript | Newest transcripts and older chat history |
| Devin CLI | Turn on `devin_cli_instrumentation`, then `trajectory setup --clients devin` | Local session store is the source of truth. Hooks only wake the reader. MCP and incognito skill. | No bulk import. Reads active and changed sessions only. |
| Grok Build | Turn on `grok_build_instrumentation`, then `trajectory setup --clients grok` | Native global hooks, session file watcher, and incognito skill and command | Watcher reads root and nested sessions. `trajectory session import grok` repairs history. |
| Qoder CLI | Turn on `qoder_cli_instrumentation`, then `trajectory setup --clients qoder` | Plugin hooks that wake a JSONL transcript reader. MCP and incognito skill. | No bulk import. Reads active and changed sessions only. |
| ZCode | Turn on `zcode_instrumentation`, then `trajectory setup --clients zcode` | Hooks that wake a SQLite reader. MCP and incognito skill. | `trajectory session import zcode`. Active sessions get no guessed end. |
| CommandCode | Turn on `commandcode_instrumentation`, then `trajectory setup --clients commandcode` | Hooks that wake a transcript reader. MCP and incognito skill and command. | Existing and changed transcripts. No guessed session end or usage. |
| Muse Code (macOS and Linux) | Turn on `muse_code_instrumentation`, then `trajectory setup --clients muse` | Hooks that wake a session file reader. Optional MCP and incognito skill. | Existing completed sessions get a baseline. New sessions keep provider IDs, session end, usage, tools, compaction, and subagents. Managed setup is macOS only. |
| Kimi Code CLI | Turn on `kimi_cli_instrumentation`, then `trajectory setup --clients kimi` | Hooks that wake a reader for `wire.jsonl`, `context.jsonl`, and state files. MCP and incognito skill. | Current and legacy roots without duplicates. Tested with fixtures. |
| gptme | Turn on `gptme_instrumentation`, then `trajectory setup --clients gptme` | Metadata-only lifecycle hooks that wake a session file reader. MCP and `/incognito`. | Existing and changed sessions. Tested with a real gptme install without credentials. |
| CodeWhale | Turn on `codewhale_instrumentation`, then `trajectory setup --clients codewhale` | Saved-session and runtime-thread reader, wake-only hooks, MCP, and incognito skill | Plain `exec` runs are not captured unless stream JSON or resume saves them |
| ForgeCode | Turn on `forgecode_instrumentation`, then `trajectory setup --clients forgecode` | Read-only `.forge.db` reader, MCP, and incognito skill and command. No hooks or wrapper. | Existing and changed conversations. Tested with fixtures. |
| Warp/Oz CLI | Turn on `warp_oz_instrumentation`, then `trajectory setup --clients warp` | Read-only local Warp/Oz SQLite reader, MCP, and incognito skill | Active and changed local stores only. Cloud runs are not captured. |
| Zed | Turn on `zed_passive_history`, then `trajectory setup --clients zed` | Read-only thread database reader, MCP, and incognito skill. No hooks, wrapper, or OTel. | Tested with fixtures. Not yet tested in the Zed app or with incognito. |
| OpenClaw | Turn on `openclaw_durable_history` | Off-by-default saved-history watcher. Released builds do not capture OpenClaw live. | `trajectory session import openclaw`, behind `openclaw_durable_history` |
| Gemini CLI (retired) | None | None | Earlier sessions stay readable |

## Hook ownership

Some hook payloads can reach the wrong client's capture path. For example, two
clients can read the same hook file. Trajectory checks which client sent each
hook before it records anything. These paths use the check:

- command hooks and module dispatchers
- native HTTP hooks
- the Codex capture helper
- Pi batch and compatibility hooks
- the remaining client-specific capture commands

Trajectory identifies the sending client as follows:

- A known top-level `client_source` value names the client. Known aliases
  match the client's main name.
- A non-empty `cursor_version` identifies Cursor. So does a pair of non-empty
  `conversation_id` and `generation_id` values. A conversation ID alone does
  not identify Cursor.
- Legacy `codex-app` payloads belong to Codex hooks. `antigravity` and `agy`
  share hooks.
- Clients with similar payloads stay separate. Pi and OMP are separate
  clients. So are OpenCode and Kilo.

When a hook clearly belongs to another client, Trajectory ignores it and
reports success. It does not send the event to the other client. The HTTP
path returns an empty 200 before it records a delivery receipt or changes the
session. The ignored event therefore cannot use up the right client's
delivery ID.

The Claude capture wrapper hands recovery to the `capture-hook` command, which
runs the check. Claude skill sync in hook mode and the security marketplace
bootstrap also check the sender before they change configuration. The check
does not apply to these commands:

- explicit setup commands
- history import
- `capture-shared`, which handles events from several clients on purpose

Transport health counts and command diagnostics still run.

The check prevents accidental routing between clients. It does not
authenticate the caller, and it is not a plugin setting. In these cases
Trajectory keeps the normal path:

- The origin data is missing, malformed, or unknown.
- The origin fields conflict. Repeated fields with different values conflict,
  including case variants and escaped key names. Identical repeated values
  keep their normal meaning.

Some native hooks carry no field that identifies the client. Claude-compatible
Codex hooks are one example. Trajectory cannot tell these apart from their
shape. Full protection needs origin data from the calling client itself. A
label that the hook adds about itself is not enough. The check never guesses
from nested tool input, model or provider names, generic event names, or
inherited environment variables.

## Shared Local Flow

Live hook integrations send each payload to:

```text
http://localhost:19222/capture/<client>/<event>
```

Some clients use their own capture endpoint, which maps native events to
Trajectory events. Each client runtime turns the native payload into
Trajectory event records. The capture server writes them to local session
JSONL first. Publishing, markers, metrics, diagnosis, and the local viewer
index all read from that local capture.

The capture server's own working directory belongs to no session. Some hook
payloads name no directory, such as `cwd`, `project_dir`, `working_dir`, or a
workspace root. For those, `capture-hook` adds the directory it ran in as
`cwd`, with `cwd_provenance=hook_process_working_dir`. The client starts the
hook in that directory. Session-start handlers never read the directory of
their own process. A payload sent without a directory therefore records no
project directory or branch. PR tracking does not read Git state for it.

### Assets that setup installs

Setup also installs the assets each client needs:

- MCP entries that give the agent Trajectory tools and resources for local
  inspection
- Agent skills or slash commands, where the client supports them
- Local marketplace files for plugin-based clients
- A `trajectory` binary path, installed or inside the extension, where the
  client expects one

A manual plugin-only install can miss these assets. Use
`trajectory setup --clients <client>` for normal installs.

`trajectory setup --clients <client>` only adds or updates clients. It
refreshes hooks, MCP entries, skills, commands, and local marketplace files.
It does not ask for the Datadog site or API key. To change export settings,
run `trajectory setup` without `--clients`.

### Command shims and launchers

Some clients have no native capture method. Trajectory captures them through a
command shim with the same name as the client command. To install one, pass
`--install-client-shims` in scripted setup. In interactive setup, answer yes
at the prompt.

Claude and Codex do not need a shim. Their native integrations work without
one. The same flag optionally installs same-name launchers for the built-in
`trajectory claude` and `trajectory codex` wrappers.

Setup handles shims and launchers as follows:

- Setup records the path of the real client binary.
- Setup stores built-in wrapper scripts in `~/.trajectory/client-shims/bin`.
- An opt-in creates launcher links in `~/.trajectory/bin`. If that folder is
  already on your `PATH`, the wrappers become active.
- Setup refuses to wrap its own shim. It refuses to replace files it does not
  own. It removes only files and links it created.
- Setup removes or moves a legacy wrapper script in `~/.trajectory/bin` only
  when the wrapper's metadata records that path.
- Cleanup of retired binaries keeps any script, or any link to an outside
  file, at a client command name.
- Setup keeps a wrapper that you put in place yourself, as a copy or a link.
  It also keeps it during the refresh after `trajectory update`.
- After an opt-in, setup replaces an exact copy of its own wrapper with the
  launcher link. It refuses to replace any other file.
- Launcher links from an earlier opt-in stay in place during normal refreshes.

Setup records your shim choice for each client in
`~/.trajectory/state/setup-install-record.json`. It records an explicit
`--install-client-shims` or `--no-client-shims` flag, or your answer at the
interactive prompt. A later run without either flag applies the recorded
choice. This includes the refresh after `trajectory update`.

The refresh after an update follows these rules:

- It adds `--install-client-shims` for clients that require shims and have no
  recorded choice. It does not record that flag.
- For installs made before the record existed, it records the opt-in it can
  see. That is setup's own launcher link in `~/.trajectory/bin`, or a wrapper
  that setup wrote for a client that requires one.

`--no-client-shims` records an opt-out. It does not remove a shim that is
already installed. Managed reconciliation makes its own shim choice. It does
not read or write the install record.

## Setup Instrumentation Policy

Setup uses the least invasive way to register with each client:

- Setup prefers the client's native package, plugin, hook, MCP, extension
  manifest, or transcript files. It uses command shims or launch wrappers only
  when no native method exists.
- Setup writes only the client files needed for capture, MCP, skills,
  commands, or plugin discovery. It does not add Trajectory to broad user
  settings when a package manifest or plugin folder can do the same job.
- Setup never edits shell startup files, aliases, or functions, and never
  exports `PATH`. The one exception is the marked `PATH` block that managed
  setup adds while the managed profile turns on client command shims. See
  "Route ordinary `claude`, `codex`, and `copilot` commands through
  Trajectory" in the [administrator guide](MANAGED-ENDPOINTS.md).
- If `trajectory` is not on your `PATH`, setup and `trajectory doctor` suggest
  a link in an existing home bin folder. An example is
  `ln -s ~/.trajectory/bin/trajectory ~/.local/bin/trajectory`.
- Managed reconciliation does not run with your terminal `PATH`. It links
  `~/.local/bin/trajectory` itself when that name is free.
- A command shim named after a client command is used only for clients with
  no stable native capture method. It always needs an opt-in through
  `--install-client-shims` or the interactive prompt.
- New behavior ships behind a feature flag when it changes saved user
  state or client startup. The same applies to wrapper or OTLP relay
  behavior, managed settings, and outbound network traffic.
- Wrapper metadata records the real client binary. Setup never wraps its own
  shim. Uninstall removes only the shim files and metadata that Trajectory
  manages.
- Setup verification, `trajectory doctor`, and the client inventory report the
  real registration method. For example, Pi reports package manifest
  registration. Wrapper clients report the command shim and its metadata.
  Hook clients report their hook or MCP config path.
- For plugin clients whose plugin records Trajectory can read, the inventory
  also reports activation: `enabled`, `disabled`, `not_installed`, or
  `unknown`. Plugin files that are only staged never count as enabled.
  Unreadable records are `unknown`, never `enabled`. Claude Code's activation
  comes from `internal/claudeconfig`, which applies `CLAUDE_CONFIG_DIR` for
  the current user's home and selects managed policy with the same
  precedence as launch validation. Activation also names its deciding source,
  user settings or managed policy, so doctor can tell a user-level fix from
  one only an administrator can make.

Trajectory modules extend this setup path. They do not use separate installers
or copied client hook logic.

### Removing an integration

`trajectory uninstrument <client>` and `trajectory uninstrument all` remove
every change that setup made. They behave as follows:

- They repeat cleanly when you run them more than once.
- They try every item that setup owns, even after one item fails.
- They remove module dispatchers as well as the main capture hooks.
- They keep unrelated user settings in shared files.
- They add the client to your user-level auto-instrument deny list. Background
  reconciliation then cannot reinstall it without telling you.
- They turn off any capture feature flag that belongs to that client.

To restore a client later, turn its feature flag back on if it needs one. Then
run `trajectory setup --clients <client>`.

Codex needs one extra step because released binaries predate the
`codex_durable_history` flag. Uninstrumenting Codex also writes a
compatibility fence. Current binaries keep capture on for other clients and
follow the Codex flag. An older binary, after a downgrade, sees the fence and
stops capture for all clients. Turning on `codex_durable_history` again
removes the fence.

### MCP tools

The full MCP catalog, with safe query examples, is built into the binary. If
it differs from the list below, the built-in catalog is correct:

```bash
trajectory user-guide mcp
```

| Group | Names |
|---|---|
| Session and status tools | `trajectory_status`, `get_session_trajectory` |
| Privacy tools | `trajectory_incognito` |
| SQLite tools | `trajectory_schema`, `trajectory_query`, `trajectory_search` |
| Resources | `trajectory://status`, `trajectory://config`, `trajectory://sqlite/schema` |

Agents should call `trajectory_schema` before `trajectory_query`. The SQL then
matches the live local database. `TRAJECTORY_CACHE_DB` selects that database.
Without it, Trajectory uses the cache under `TRAJECTORY_ROOT`.

## Local backfill order

Backfill rebuilds local history newest first for Claude Code, Cursor, Codex,
Antigravity, Pi, and Copilot. OpenCode already worked this way. The order
applies within each client, across all its projects and source folders.
Events inside a session stay in their original order.

Trajectory uses these times to sort:

- Claude, Cursor, Codex, Pi, OMP, and Copilot use the source file's change
  time. Copying or touching a source file can change its place in the order.
- Antigravity uses the session update time from history timestamps and
  generation database activity.
- OpenCode uses the provider's session update time.

Equal times sort by path or session ID. The order does not change which source
wins. Cursor's source order, Codex's preference for the active copy, and
OpenCode's preference for SQLite stay the same.

Codex merges active and archived rollouts before it picks each page. This
includes recently changed files in older date folders. Older continuation
cursors restart a newest-first sweep. The usual skip and `--force` rules apply
to sessions that Trajectory already has. A full scan reads all date folders
within the normal discovery limit.

With a page limit of zero, Codex shares one discovery limit across all pages
in the run. If a later scan reaches that limit, the error keeps the progress
so far and a continuation cursor. A new run can then resume.

Other discovery limits still apply. The order covers only the sessions that
discovery found. An incomplete scan can miss history.

## Claude Code

### Setup and the Claude plugin

Setup writes a local Claude Code marketplace in
`~/.trajectory/claude-marketplace`. It registers the marketplace through
Claude's plugin manager. It then installs or repairs `trajectory@trajectory`
at user scope.

Claude Code caches plugins by version. Setup therefore writes the marketplace
and plugin manifest with Trajectory's own release version. Setup, binary
updates, and MCP startup check the `trajectory@trajectory` registry entry and
its cache folder. They write the current plugin version and point only that
user-scope entry at it. A running Claude process can keep using the older
version until it restarts.

Managed settings can enable the plugin, which makes Claude record the entry
at managed scope. Trajectory manages that entry in the same way. Setup does
not change project-scope or local-scope entries.

Trajectory does not add, merge, or delete Claude settings itself:

- Explicit setup calls Claude's plugin manager to install or repair the plugin.
  If the command loses or changes an existing setting, setup restores the
  settings file as it was before.
- Background repair never runs Claude. It fixes only the registry entry and
  cached plugin that Trajectory owns.
- Unknown paths, links, malformed registries, and unclear ownership stop the
  repair without changes.

Setup can run before or after another installer that writes Claude OTel
settings. In either order, and on repeated runs, setup keeps these settings:

- the other installer's OTel keys
- Trajectory's plugin and marketplace keys
- unrelated user settings

No capture path is installed twice.

### Removing the Claude plugin

Uninstrumenting Claude keeps the Claude plugin registration and the local
marketplace. It points the Trajectory entry at an empty plugin version. That
version declares no hooks, MCP server, commands, or skills, so nothing in it
calls the Trajectory binary. Claude's marketplace and plugin update commands
then do not fail on a missing path or turn capture back on.

When you remove Trajectory itself (`uninstrument --for-uninstall`), cleanup
also does the following:

- It runs `claude plugin uninstall trajectory@trajectory --scope user`, with
  the settings protection described above.
- It deletes every cached plugin version that no registry entry names.
- An older plugin version whose hooks run scripts directly keeps only those
  scripts. They become stubs that exit 0, for Claude sessions that are still
  open.
- If the `claude` CLI cannot run, the empty version stays registered. Claude
  then reports no failed MCP server after the binary is removed.

If Agent Security is set up, removing Trajectory also removes it, in the same
way as `trajectory plugins security disable --remove-hooks`. Cleanup
uninstalls the `trajectory-security` plugin with each client's own CLI. For
Claude Code, that is `claude plugin uninstall trajectory-security@trajectory
--scope user`, with the same settings protection. Cleanup then deletes the
copies that Claude Code and Codex cached, and it removes Cursor's Agent
Security hooks. A project install stays. If a client's CLI cannot run, cleanup
prints a warning with the command to run and continues. A plain
`trajectory uninstrument` keeps Agent Security.

You can uninstall the plugin or remove the marketplace through Claude. This
does not damage Trajectory. Run `trajectory setup --clients cc` to restore
either one.

### Hooks

The plugin ships Claude's `hooks/hooks.json`. Claude Code loads it
automatically from that standard path. The plugin manifest has no `hooks`
entry for that file, so Claude does not load it twice. The manifest also has
no inline MCP configuration. The plugin's root `.mcp.json` is normally the
only MCP declaration.

You might already have an explicit `mcpServers.trajectory` entry from an
earlier release. In that case setup stages a plugin without an MCP file. Your
entry stays exactly as it was, and Claude uses it. The plugin also carries
skills, including `/incognito`.

Trajectory registers 17 Claude events:

`SessionStart`, `UserPromptSubmit`, `MessageDisplay`, `PreToolUse`,
`PostToolUse`, `PostToolUseFailure`, `Stop`, `StopFailure`, `PreCompact`,
`PostCompact`, `PermissionRequest`, `PermissionDenied`, `Elicitation`,
`ElicitationResult`, `SubagentStart`, `SubagentStop`, and `SessionEnd`.

The events produce these records:

- MCP `Elicitation` and `ElicitationResult` produce metadata-only
  `elicitation_start` and `elicitation_result` events. They record the server
  name, elicitation ID, tool use ID, and the `accept`, `decline`, or `cancel`
  action. They count as user input, not as permission decisions.
- Trajectory groups `MessageDisplay` batches and writes one `agent_message`
  when the message is final. Claude's display and turn IDs never become
  Trajectory IDs.
- `StopFailure` writes a failed `turn_end` when Claude cannot send `Stop`.

Trajectory leaves out the other hooks that Claude documents:

- `Setup` carries no session data.
- `InstructionsLoaded`, `ConfigChange`, `CwdChanged`, `DirectoryAdded`, and
  `FileChanged` have no matching Trajectory event.
- `UserPromptExpansion`, `PostToolBatch`, and `Notification` repeat data from
  registered hooks.
- The Task tool already records `TaskCreated` and `TaskCompleted`.
- `TeammateIdle` does not start or end anything.
- Worktree hooks would replace Claude's own behavior.

### Hook delivery and time limits

On macOS and Linux, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`, and
streaming `MessageDisplay` use Claude's native HTTP hooks on the loopback
address. Windows uses command hooks instead, because native HTTP delivery is
not reliable there. Background processes on that path open no console window.
Setup accepts an HTTP hook only for known events, paths, plugin versions,
timeouts, and headers.

The other lifecycle hooks run the `capture-with-serve.sh` helper, then
`trajectory capture-hook`. `PermissionRequest` also uses this path. It marks
the start of the wait for the user, so Trajectory must record it before the
outcome arrives.

Every command hook passes `--background-after-read`. Delivery works as
follows:

1. The hook reads Claude's input. For most events, it makes one POST to the
   running capture server, with a 250 ms limit.
2. If the server records the event, the hook returns.
3. Otherwise, a background worker takes the event with the same delivery ID.
   This covers no server, a refusal, an error, or the time limit. If the
   first POST did succeed, the server's receipt turns the retry into a no-op.
4. After a POST reaches the time limit, the next 30 seconds of hooks go
   straight to a worker. A session with an event still waiting in a worker
   also skips the POST. Events therefore stay in order.

`SessionStart` and `SessionEnd` go to a worker at once, because their server
handlers wait for session cleanup. To hand off an event, the hook saves
Claude's input to a private file, starts the worker, and returns.

A slow or missing capture server therefore delays your prompt or turn by at
most 250 ms. The worker starts the server if needed and retries with the same
delivery ID. A dropped connection while the server restarts cannot cause a
duplicate event. At session end, the worker starts the normal final publish
through `trajectory serve`.

Each hook stops on its own deadline before Claude Code would kill it. The
deadline is the hook's Claude Code timeout minus 500 ms. This includes the
foreground fallback when the handoff fails. Setup and `capture-hook` read all
capture timeouts from the same table.

`trajectory claude skills sync` adds capture hooks to skill front matter.
Those hooks follow the same rules. They pass `--background-after-read`, and
their deadline comes from the skill hook timeout. The
`claude skills sync --hook UserPromptSubmit` hook reads its input, starts a
background `--hook-worker` sync, and returns. A sync rewrites skill files
under a lock and cannot stop safely partway.

The Claude capture wrapper sets a five-second default for
`TRAJECTORY_SERVE_RESTART_WAIT`. The background capture worker uses it to wait
for a restarting server. Trajectory reads the value as a Go duration. An
invalid or non-positive value falls back to five seconds and does not drop the
event. An explicit `--ensure-serve-wait` flag wins and keeps the normal flag
checks. Other clients do not use this Claude wrapper setting.

### Turns, sessions, and permissions

At `SessionEnd`, Trajectory adds a missing final `turn_end` for the latest
prompted turn, even when earlier turns completed. It takes the turn identity
from the session JSONL. It does not repair an older session generation or add
a turn after a resume with no prompt. The repair leaves token usage pending.
Corrections from Claude's transcript set the token totals when they are
available.

Claude sends `SessionStart` with `source: "clear"` only after a full context
reset succeeds. Trajectory then treats the reset as a new logical session:

- It closes the earlier session and schedules its normal final publish.
- It maps the reused Claude session ID to a new, stable logical ID for the
  empty context.
- The hook delivery ID makes a retried reset safe. The mapping survives a
  capture server restart.

The text `/clear` in a prompt does not start a new session. Neither do
`PreCompact` and `PostCompact`.

Claude has a `PermissionRequest` hook and a `PermissionDenied` hook for its
automatic mode. It has no general hook for manual permission decisions.
Trajectory records each request with a generated ID. A matching post-tool
hook shows that the request was allowed. That hook's `duration_ms` leaves out
the wait for the user, so Trajectory can estimate the decision time.

Trajectory can repair a manual denial from Claude's transcript, but only for a
request it already recorded. The repair keeps the original request ID. It
records the result source, `inferred` or `user`. Permission wait and outcome
metrics therefore do not depend on event types that only Claude has.

### Transcript location

Every feature that reads Claude transcripts finds them the same way:

- If `CLAUDE_CONFIG_DIR` is set, Trajectory reads only
  `$CLAUDE_CONFIG_DIR/projects`.
- Otherwise, it reads `~/.claude/projects`.
- A `transcript_path` value from a hook always wins.

This applies to setup backfill, CLI backfill and token accounting,
`trajectory doctor`, `Stop` and ingest reconciliation, and resume lookup.
Trajectory does not use this rule for plugin, settings, credential, or legacy
cleanup paths. It does not merge or search other folders.

### Native OTLP and the `trajectory claude` wrapper

Trajectory can relay Claude Code's native OTLP logs, metrics, and traces.
Claude Code must send those signals to local `trajectory serve`. The
`trajectory claude` wrapper sets this up in the Claude process environment for
one launch:

```text
OTEL_EXPORTER_OTLP_LOGS_ENDPOINT=http://localhost:<port>/v1/logs
OTEL_EXPORTER_OTLP_METRICS_ENDPOINT=http://localhost:<port>/v1/metrics
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=http://localhost:<port>/v1/traces
```

For that process, the wrapper also turns on these Claude telemetry options:

- the enhanced telemetry beta
- user and assistant content
- tool details and content
- raw API-body events

The wrapper also records the complete Anthropic request and response bodies
on each `llm_call`. Before Trajectory stores them, the capture redaction
replaces secrets and personal data in them, as it does in captured prompts.
The LLM Observability span for each model call shows them as
`meta.input.value` and `meta.output.value`. You can then see system blocks,
messages, tool names, descriptions, input schemas, tool calls, thinking, and
response content. They appear in Datadog and in the local viewer (Lapdog).

Use `trajectory claude` for complete request and response capture and native
OTLP routing in one Claude process. It does not change
`~/.claude/settings.json`. Complete capture is on by default, because running
the wrapper is the opt-in. No second content setting exists.

The wrapper works as follows:

- It reads your effective Claude settings.
- It points the Claude process at local `/v1/logs`, `/v1/metrics`, and
  `/v1/traces`.
- When it starts a new shared `trajectory serve`, it passes the original
  upstream endpoint to that server. A server that is already running keeps its
  current relay settings.
- When your Claude settings name an upstream, the wrapper runs a relay for
  that launch with the same isolation. The running server then needs no
  upstream settings.
- Each launch carries a private correlation ID. Trajectory uses it to match
  model requests to the right Claude session when several Claude processes
  run.

The Claude, Copilot CLI, and cursor-agent wrappers find and repair the
capture server in the background. A busy port, a stale server, damaged
coordination state, a read-only state folder, or a missing optional asset can
reduce telemetry. None of these delays or blocks the client start. Each
wrapper process runs at most one repair for each client and port. It limits
how often it shows you a failure notice.

Running `trajectory claude` is the opt-in to the wrapper's OTLP setup, so no
feature flag controls it.

Each signal keeps its own protocol. Trajectory picks it in this order:

1. the setting for that signal
2. `OTEL_EXPORTER_OTLP_PROTOCOL`
3. Trajectory's default, `http/json`

If managed settings name `http/protobuf`, Claude sends protobuf to the local
relay, and Trajectory forwards protobuf upstream. If no setting names a
protocol, the wrapper sets `http/json` for each signal.

### What the OTLP relay does

The `/v1/logs` endpoint keeps only native `skill_activated` records. It turns
them into local `Skill` tool activations and drops other logs after capture.

If you set `server.otlp_proxy.endpoint`, `trajectory serve` also forwards OTLP
logs, metrics, and traces to that upstream collector. Use this when Claude
should keep sending native telemetry to Datadog or an OpenTelemetry collector
through Trajectory:

```yaml
server:
  otlp_proxy:
    enabled: true
    endpoint: https://otlp.datadoghq.com
    api_key_ref: dd-api-key
```

Trajectory decodes forwarded metrics and encodes them again in the original
OTLP protocol. It adds these datapoint attributes:

- session identity tags
- `trajectory.proxy.source:serve-otlp`
- `trajectory.cost_role:client_telemetry`
- `trajectory.cost_source:claude_native_otlp`
- cost-overlap tags

To find the session, the forwarder tries these sources in order:

1. the session identity in the OTLP payload
2. the only active local session
3. recent heartbeat state on disk

If no single session matches, the identity tags fall back to `unknown`.

For Claude-native spans, the trace forwarder makes these changes before it
sends them upstream:

- It keeps the raw session ID in `claude_code.session_id`.
- It replaces `session.id`, `session_id`, and `gen_ai.conversation.id` with a
  single `session.id` of `claude-native:<session>`.
- It sets the resource `service.name` to the native ML app. The default is
  `<export.ml_app>-claude-native`. Set `server.otlp_proxy.native_ml_app` to
  change it.
- It adds `trajectory.telemetry_plane:native_client_otlp`.

Native traces then keep their own correlation, ML app, and session. They stay
apart from Trajectory's LLM Observability session and turn view.

Trajectory also saves short local trace summaries in
`~/.trajectory/state/otlp-proxy/traces/`. The summaries keep span IDs, parent
IDs, timing, names, and allowed skill, tool, and session attributes. They do
not keep raw OTLP bodies or tool input. Skill complexity metrics use these
records to prefer native Claude tool spans over whole-turn attribution.

The same batches give one `native_tool_timing` event for each tool call. It
records the permission wait, its decision and source, and the run time.
Trajectory briefly holds the turn's publish for this event. It adds the data
to the tool span and to a `permission-wait` child span.

Skill complexity metrics carry a `skill_attribution` tag with one of these
values:

- `span_tool_attribute`: native Claude tool spans carry the skill name.
- `span_temporal`: Trajectory matched one high-confidence skill signal to
  native tool spans in the same turn by time.
- `turn_assisted`: Trajectory fell back to tool rows from the same turn.

The forwarder never blocks Claude. Local capture requests still return 200
when no upstream is set, when enrichment fails, or when the upstream request
fails. The forwarder does not correct native cost values or drop invalid
datapoints. Client telemetry does not join Trajectory's cost attribution data.

Datadog intake uses `api_key_ref` and sends the resolved key as `dd-api-key`.
Other collectors can read extra headers from the
`TRAJECTORY_OTLP_PROXY_HEADERS` process environment. Forwarded metrics keep
Claude's native values. To check that the collector indexed the added tags,
query the metrics in Datadog.

Each `trajectory serve` process reads the same Trajectory config from disk and
forwards on its own. After you change `server.otlp_proxy.*` or the process
environment, restart long-running serve processes. Every process that listens
with `SO_REUSEPORT` then uses the same upstream.

### Claude settings and managed policy

Setup never writes or overwrites Claude Code user settings for native OTLP.
An older Trajectory version wrote a legacy local OTLP env block into
`~/.claude/settings.json`. Setup can remove only those Trajectory keys at user
scope. It never cleans project or managed settings.

Claude managed settings take precedence over user settings, so admins still
control managed OTel policy. In that case setup leaves
`~/.claude/settings.json` unchanged. Standard hooks still capture. Trajectory
sees Claude's native OTLP skill and usage data only when your effective
settings or the `trajectory claude` wrapper send OTLP to local
`trajectory serve`.

When Trajectory reads Claude settings, it accepts any JSON value in `env`. It
writes numbers and booleans as their JSON text. A managed file such as
`{"env": {"CLAUDE_CODE_ENABLE_TELEMETRY": 1}}` is therefore not skipped. The
same managed-first order picks the `apiKeyHelper` for Trajectory's internal
headless Claude calls.

### Headless sessions

Claude `--print` sessions have no `transcript_path`, so Trajectory marks them
as headless. When export is set up, Trajectory captures and publishes headless
coding-agent sessions by default. Task segmentation always skips them. To turn
off capture for all headless agent sessions that Trajectory did not start
itself, run:

```bash
trajectory config set capture.include_headless_agents false
```

Trajectory never captures its own classifier and segmenter processes.

### Verify

```bash
claude plugin list
trajectory doctor
```

## Claude Desktop

Claude Desktop is the macOS app (`/Applications/Claude.app`, bundle ID
`com.anthropic.claudefordesktop`). It has three tabs. Each tab keeps its data
in a different place, and Trajectory treats each one differently:

| Tab | Data on disk | Captured as |
| --- | --- | --- |
| **Cowork** (local agent mode) | `~/Library/Application Support/Claude/local-agent-mode-sessions/**/audit.jsonl` | `client_source=claude-desktop` (this integration) |
| **Claude Code** (Code tab) | `~/.claude/projects/*.jsonl` (the same store as the CLI) | `client_source=claude-code` (the Claude Code integration), with an `entrypoint` value |
| **Chat** | Electron LevelDB | Not captured. General chat is out of scope. |

### Code tab

The Code tab runs Claude Code inside the app. It writes to the same
`~/.claude/projects` folder as the terminal CLI, so Trajectory already
captures it as `claude-code`.

To tell app use apart from terminal use, Trajectory copies the transcript's
own `entrypoint` field onto `session_start`. The values are `claude-desktop`
for the Code tab, `cli` for the terminal, and `sdk`. The LLM Observability
span mapper emits it as the `trajectory.entrypoint:<value>` span tag, which
you can filter on. `client_source` stays `claude-code`.

Trajectory reads `CFBundleShortVersionString` from the app's
`Contents/Info.plist`. It looks in `/Applications/Claude.app` and
`~/Applications/Claude.app`. A Code-tab session keeps the Claude Code
`client_version` and adds the app version as `app_version`. Terminal and SDK
sessions leave it out. Cowork sessions also add `app_version`. The published
tag is `trajectory.app_version`. A link, an unusual file, a malformed file, or
a missing version gives no value instead of a guess.

### Cowork tab

The rest of this section covers the Cowork tab. Cowork saves sessions as
Claude Code-style JSONL, so Trajectory reuses its Claude transcript reader.

Claude Desktop capture is always on for macOS. It needs no feature flag. On a
Mac with Claude Desktop, Trajectory does the following:

- It reports Claude Desktop in the client inventory.
- It can import Cowork history.
- `trajectory serve` runs a live watcher that reads each session's
  `audit.jsonl` every few seconds.

The watcher publishes sessions to Datadog like live CLI sessions. It applies
Claude Code redaction, and the sessions are not headless. Each poll emits only
completed turns that it has not sent yet. The watcher saves its position for
each session, so a restart does not send turns twice.

Claude Desktop has no CLI on `PATH`. Trajectory detects it from any of these
paths:

- `/Applications/Claude.app`
- `~/Applications/Claude.app`
- `~/Library/Application Support/Claude`

Transcripts are stored here:

```
~/Library/Application Support/Claude/local-agent-mode-sessions/<projectId>/<accountId>/local_<sessionId>/audit.jsonl
```

Trajectory does not rely on the `<projectId>/<accountId>` folders for
identity. Live capture and backfill accept added, removed, or reordered
folders at that level. Both require `audit.jsonl` to sit directly in a valid
`local_<sessionId>` folder. They skip worktree and cache content below it.

Each line looks like a Claude Code transcript record. Its `type` is `user`,
`assistant`, or `system`. Cowork also writes `tool_use_summary`,
`rate_limit_event`, and `result` records. Trajectory ignores these when it
does not understand them. The session ID comes from the `local_<sessionId>`
folder name. Trajectory checks that the ID is safe to use as a path and skips
invalid or unreadable entries.

Cowork transcripts differ from Claude Code transcripts in two ways:

- The event time is in `_audit_timestamp`, not `timestamp`. Trajectory uses it
  so that events keep their real times.
- Each turn ends with a `result` record that holds `total_cost_usd` for that
  turn. Trajectory adds these up into the session's `total_cost_usd`. Later
  steps prefer this value over the token-based `session_cost_usd` estimate.

No record marks the end of a session. The watcher therefore ends a session
after it has been idle for one hour. Completed turns publish without waiting.
Only the final session record waits for the idle window. To change the
window, set `TRAJECTORY_CLAUDE_DESKTOP_QUIESCENCE` to a Go duration such as
`60s` or `5m`. A shorter window publishes the session end sooner. It can also
end a session that was only idle for a short time.

Trajectory adds the project folder, working directory, Git branch, and model
to `session_start` for Cowork sessions. It reads them from the `cwd` and
`gitBranch` fields on each record. If those are missing, it reads an optional
metadata file:

```
~/Library/Application Support/Claude/claude-code-sessions/<projectId>/<accountId>/local_<sessionId>.json
```

Every field in that file is optional. `git_branch` is published as the
`trajectory.git_branch` span tag. This enrichment applies only to Cowork, so
Claude Code backfill does not change.

Backfill writes events with `client_source=claude-desktop`. To run it:

```bash
trajectory session import claude-desktop [--session ID | --since DATE] [--force]
```

`trajectory setup --clients claude-desktop` checks the requirements only.
Capture comes from the watcher, so setup writes no file for the client. The
live watcher honors incognito. If a Cowork process sends native OTLP with
`trajectory.client_source=claude-desktop`, the capture server credits the
metrics and logs to `claude-desktop`.

Trajectory does not add native OTLP settings or an MCP entry to Claude
Desktop. An app opened from Finder does not inherit shell `OTEL_*` variables.
No checked `claude_desktop_config.json` `mcpServers` path exists yet.

## Codex CLI

### Setup and hooks

Setup writes a local Codex marketplace in `~/.trajectory/codex-marketplace` and
registers it with Codex. The plugin provides command hooks, MCP settings, and
the `/incognito` skill. Codex Desktop runs the same installed hooks.

The plugin defines handlers for 11 Codex events. Setup picks one of two modes:

- **Boundary mode** turns on `SessionStart`, `UserPromptSubmit`, `Stop`, and
  `SessionEnd`, plus a `PreToolUse` and `PostToolUse` pair for Bash only. The
  Bash pair writes no events of its own.
- **Full-hook mode** also turns on all tool, permission, compaction, and
  subagent events. Codex waits for each command.

Setup uses boundary mode when the running capture server supports it.
Otherwise, for example with an older capture server, it uses full-hook mode.
After an update, explicit setup or feature reconciliation moves to boundary
mode once the current server supports it.

Codex hooks use `type: "command"`. Current Codex has no HTTP hook type for
Trajectory. The full `trajectory capture-hook --client codex --ensure-serve`
command remains the fallback when the fast helper is unavailable.

Setup extracts a small hook helper for your platform from the installed
Trajectory binary. On macOS it also extracts native relay files. It checks
each file before use. A stable selector at `~/.trajectory/bin/codex-hook`
picks the active version. Startup and update repair can then replace the
helper without changing the command that Codex trusts. A mode change updates
`codex-hook/policy-v1` instead of rewriting the trusted hook definition.

### Hook trust

On setup, Codex lists the installed handlers for the 11 events with their
current hashes. Trajectory checks that they belong to `trajectory@trajectory`.
It asks Codex to save those hashes, then reads them back to confirm that Codex
trusts them. Trajectory never computes trust from the editable local
marketplace. Codex runs and hashes its installed plugin cache.

Some supported Codex versions leave `SessionEnd` out of hook discovery.
Trajectory accepts that one gap, because the rollout's `shutdown_complete`
record also ends the session. Later repairs keep the trust that Codex
recorded. They leave the hook JSON unchanged when the helper version, capture
mode, or CPU pacing changes.

Setup changes the hook helper, hook commands, and enabled states in one step.
If that step fails, setup restores the earlier hook JSON and policy. If the
helper files fail to install, setup falls back to the full binary. Setup must
then authorize the fallback with the hashes it reads back from Codex.

Setup, explicit feature or config reconciliation, and `trajectory doctor` run
this full step. Background updates, MCP startup, and server startup only check
and switch the helper version. They never rewrite the trusted hook definition.
Background repair never sets up Codex for a user who has not run setup.

When managed policy denies Codex capture, `trajectory doctor --json` reports
the host as not ready. It names the user or managed-policy action that fixes
it.

### Hook time limits

Codex gives each command hook three seconds. Trajectory sets `timeout: 3` on
every handler. It limits the foreground helper to 2.3 seconds and waits at
most 100 ms for a response. If the server is slow or missing, a background
worker takes the fallback and any pending automatic update. It uses the same
delivery ID. A request that was fully sent is not sent again just because its
response was late.

A hook signals that a session is ending, but it is not the only way the end
is recorded. The rollout's `shutdown_complete` record can also end the
session. Either path writes `session_end` once. An interrupted update stays
pending for a later hook.

### Hooks and rollout files

Codex capture combines two sources from Codex:

- **Command hook payloads** cover the session and turn boundaries, plus the
  Bash tool pair.
- **Rollout JSONL** in `$CODEX_HOME/sessions/`, normally `~/.codex/sessions/`.
  It holds assistant messages, reasoning, tools, permissions, compaction,
  subagent activity, model details, token snapshots, `<skill>` activation
  blocks, and `shutdown_complete`.

The session JSONL in `~/.trajectory/trajectories/` merges both sources. At
each boundary, `trajectory serve` reads the rollout forward. It writes the tool
events in order, adds token and model data, and then writes the boundary
event. Each rollout change also wakes the merge while hooks are active.
Trajectory appends a fact only when the hook path did not already save it.

A hook `SessionEnd` and a rollout `shutdown_complete` lead to one final read
and one `session_end`. Trajectory never skips a large unread part of the
rollout. It moves its read position forward only after it saves the events. If
a save fails, it retries from the same point.

The merge still reads prompt and completed-turn records when the matching
hooks are expected. A tool hook cannot confirm past a prompt or completion
that Trajectory never saved. Late hooks reuse the turn number already
recorded. They cannot close a newer turn.

Before `SessionEnd` ends a session, Trajectory waits until the rollout file
stops changing. New hook or watcher activity restarts that wait. If activity
never stops, Trajectory writes no end event, and the watcher can still end the
session later.

New CLI and Desktop sessions both use `client_source="codex"`. Trajectory
reads `session_meta.originator` and `session_meta.source` to find the launch
type. It records `entrypoint` on spans and `client_surface` on metrics. The
values are `desktop`, `cli`, `ide`, or `exec`. Session JSONL from older
Trajectory versions can still contain `client_source="codex-app"`. Trajectory
treats that value as Codex.

### The rollout watcher

The live Codex watcher covers your whole account. It follows the `CODEX_HOME`
or `CODEX_SESSIONS_DIR` rollout folder for every project. CLI and Desktop
sessions can share one rollout folder while they use different working
directories. `TRAJECTORY_PROJECT_ROOT` can still describe the current run for
hook context and privacy tools. It does not limit the watcher.

Manual repair and optional startup repair also find flat rollout JSONL in
`$CODEX_HOME/archived_sessions/`. Startup repair handles one page at a time
and saves its place for the next maintenance run. History discovery follows
these rules:

- It prefers the active copy of a session by `session_meta.id`.
- It ignores rollout files that are links.
- `CODEX_SESSIONS_DIR` replaces the default folder. Trajectory then reads only
  that folder.

The live watcher reads only `sessions/`. When Codex moves a session to the
archive, the session is therefore not captured twice.

`codex exec --ephemeral` writes no rollout. In boundary mode, Trajectory
therefore has no tool, permission, compaction, or subagent detail for an
ephemeral run.

When `capture-hook --ensure-serve` runs for Codex, it makes sure a capture
server with the watcher is running. Then the rollout fallback stays
available. For that rescue server only, it ignores the Codex watcher disable
variables and does not start other clients' watchers. These settings still
stop all capture:

- `trajectory config capture disable`
- `TRAJECTORY_DISABLED=1`

The user-level disable command also stops a watcher that is already running.
Files in `~/.trajectory/state/codex-hook-active/` route watcher activity
through the shared merge while hooks are active. They hold no transcript
data. Trajectory still keeps a watcher fact that a hook missed.

Setup-written hook commands pass the current capture mode to the server, so a
feature change does not use a stale server config. A long-running server still
needs `trajectory config reload --yes` to pick up feature and performance
settings.

### Token counts

Trajectory keeps track of whether Codex reported each token count:

- An explicit whole number of zero or more is a reported value, including
  zero.
- A missing, null, negative, fractional, or invalid count is unavailable.
- Uncached input needs both the input and the cached-input values.
- An explicit zero for one request never falls back to a session total.

Live capture and history import use the same rules. They record which token
parts Codex reported. An older zero value without that record might not mean
that Codex reported zero. Trajectory does not rewrite metrics that it already
published because of these rules.

### The `trajectory codex` wrapper

`trajectory codex` is an explicit wrapper for model calls. It keeps the
request and response for every Responses API exchange by default. This
includes instructions, conversation input, tool results, tool descriptions and
parameter schemas, reasoning, tool calls, and assistant output. Streaming
responses are stored as the ordered list of JSON events. Before Trajectory
stores a body, the capture redaction replaces secrets and personal data in it,
as it does in captured prompts. In a streamed response, a redacted text goes
in the first event of its block and the block's later events are left empty.
These bodies fill the model span's input and output in Datadog LLM
Observability and in the local viewer.

The wrapper works as follows:

- It keeps Codex's built-in `openai` provider and normal OpenAI sign-in.
- It points that provider's `openai_base_url` at a private local proxy.
- It turns off Codex's request compression for that launch.
- The proxy answers Codex's WebSocket attempt with `426 Upgrade Required`.
  Codex then uses HTTP without retrying.
- The proxy forwards each JSON request unchanged, so Trajectory can read the
  user messages.

Codex saves the provider ID with each session and uses it again on resume.
The wrapper never picks a provider ID that plain Codex lacks. You can resume
a session with or without the wrapper, whichever way it started.

### Model calls without a turn ID

This rule applies to model calls that a Trajectory proxy intercepts, such as
calls through `trajectory codex`. Some calls arrive without a turn ID. Trajectory
places each one by comparing its start time with the prompt and turn-end
records in the session JSONL. It does not use the turn counter at the time
of delivery, because a delayed call can arrive after its turn ends.

Calls with an explicit turn ID keep it. Claude background-task notifications
settle their temporary IDs through a separate path.

If Trajectory cannot place a call yet, the call waits in a small local
queue. Trajectory checks again at later turn boundaries. A prompt that
arrives after its model call can still claim that call. Claude also checks the
queue after it writes a prompt. Trajectory never emits a call as a model span
when it cannot find the call's turn.

### Removing Codex

Uninstall removes Trajectory's hook state and cached plugin references first.
Then it removes the helper files. If either cleanup step fails, the helper
files stay in place.

### Verify

```bash
codex mcp list
trajectory doctor
```

## GitHub Copilot CLI

### Setup and hooks

Setup writes a local Copilot marketplace in `~/.trajectory/copilot-marketplace`.
It registers the marketplace and installs `trajectory@trajectory`. The plugin
includes command hooks, `.mcp.json`, and an incognito skill.

Every command hook runs `trajectory capture-hook --client copilot
--ensure-serve`. The hook keeps one delivery ID across server restarts, so
retries do not create duplicates.

Copilot hook payloads have no tool call ID. Trajectory names a hook
`tool_use` with a hash of the tool name and input. Provider history names the
same call with Copilot's call ID. When Trajectory merges history, it joins the
two records. The hook record stays and gains Copilot's call ID as
`source_tool_use_id`. Identical calls pair up in order.

Copilot CLI 1.0.91 sends the first `UserPromptSubmit` of a process before
`SessionStart`. A resume `SessionStart` keeps the turn that the prompt
opened. In the merged session file, each `session_start` comes first in its
generation. The first one is the first record in the file. A resume start
follows the `session_end` that closed the generation before it.

### Session history

To import past sessions, turn on `copilot_durable_history` and run:

```bash
trajectory session import copilot [--session ID] [--force]
```

`COPILOT_HOME` replaces the whole default `~/.copilot` folder. The importer
reads these files without changing them:

- the current `session-state/<id>/events.jsonl` and `workspace.yaml`
- legacy flat `<id>.jsonl` files

The current layout wins when both exist. The importer merges history into the
hook JSONL without replacing hook events. It keeps shutdown usage at session
level. It separates fresh input from cache reads and cache writes. It does not
treat Copilot request units as USD.

To pick up new and changed session-state files automatically, run:

```bash
trajectory config features enable copilot_cli_durable_history
trajectory config reload --yes
```

This watcher is off by default. It uses the same `COPILOT_HOME` rules and
reader as the manual import. It works as follows:

- On startup it records a baseline and does not replay old history.
- It notices new files, appends, replaced files, and deleted files in the
  current and legacy layouts, plus `workspace.yaml` changes.
- One process on the machine delivers events. It saves its progress, without
  content, across restarts.
- It never changes Copilot's files. Hook facts win when both sources have the
  same fact.
- Active and resumed sessions stay open. A deleted file is recorded as
  deleted. Trajectory does not write a `session_end` for it.

Use the import command for bulk history and repair.

### Usage and cost

Copilot reports usage at shutdown and in native OTel, never in hooks. What a
session records depends on which sources are on:

| Sources | Tokens | Model | Cost |
| --- | --- | --- | --- |
| Hooks only (the default) | None. `turn_end` stays `tokens_status=pending` | None | None |
| Hooks and `copilot_cli_durable_history` | The session total on `session_end` (`total_token_usage`, `tokens_status=session_aggregate_only`). Each `turn_end` is `session_aggregate_only` with no vector | Each turn and the session | None per turn. The session total can be priced once for the session |
| Hooks, `copilot_cli_native_otel` and the launcher | Each request (`llm_call.tokens`) and each turn (`turn_end.token_usage`, `tokens_status=real`). The session total is the one history held at the last trace export | Each request, each turn and the session | Each request (`cost_nanodollars`) and each turn |
| All three | Each request, each turn and the session total | The same | The same |

A model with no rate in the rate card records tokens and no cost.

`session_end` carries the shutdown `modelMetrics` total in
`total_token_usage`, `total_input_tokens`, and `total_output_tokens`. The
merge drops the totals that the `SessionEnd` hook computes. Copilot writes its
usage after that hook returns, so those totals miss at least the last turn.

Copilot CLI 1.0.91 appends `session.resume` when a second process continues a
session. The session then stays open until the next `session.shutdown`. The
shutdown counts add up across resumes.

### Native OTel

For per-request usage, use the launcher:

```bash
trajectory setup --clients copilot --install-client-shims
trajectory config features enable copilot_cli_native_otel
trajectory config reload --yes
```

The launcher sets OTLP endpoints with content turned off. It does this only
for a Copilot process that has none of these:

- an external exporter
- a custom OTel scope
- a file exporter
- telemetry turned off on purpose

`trajectory serve` accepts only first-party spans with
`service.name=github-copilot` or `github.copilot`. It works as follows:

- It holds spans from split batches until the top-level span names the
  session.
- It maps nested agent calls from span parents.
- It joins each request to provider history for the model and user prompt.
- It confirms a span only after the merge into session JSONL succeeds.

The top-level span is the `invoke_agent` span with no parent. Up to Copilot
CLI 1.0.73 it carries `gen_ai.agent.id=github.copilot.default`. In 1.0.91 it
has no agent ID. The history join uses the service request ID. When history
has none, as in 1.0.91, it uses the span's `gen_ai.response.id`. That value
equals the message's `apiCallId`. History also has an output-only `llm_call`
for the same response. Trajectory merges it into the native request, so each
request is recorded once.

Copilot counts cached tokens inside its input count. Trajectory splits that
count into input, cache-read, and cache-creation parts. Reasoning tokens are
part of the output count and are priced once. The shared model rate card gives
labeled estimated USD. Premium-request multipliers and nano-AIU stay separate
provider diagnostics.

Each `turn_end` carries these values:

- the sum of its requests in `token_usage`
- the model that served the most tokens
- the sum of its request costs in `estimated_cost_usd`

A turn can mix models and include a request with no rate. Trajectory then
marks the turn unpriced. It does not price the turn at one model's rate.
Copilot names Claude models with a dotted version, such as
`claude-sonnet-5.5`. The rate card accepts that spelling for the same model.

## VS Code Copilot Chat

VS Code Copilot Chat support is a preview behind the
`vscode_copilot_instrumentation` flag:

```bash
trajectory config features enable vscode_copilot_instrumentation
trajectory setup --clients vscode-copilot
```

The history reader covers Code, Code - Insiders, and VSCodium. It reads
workspace, empty-window, and transferred chat-session stores. JSONL operation
logs win over the JSON fallback. A change to `workspace.json` makes Trajectory
read the sessions below that workspace again.

Native `/v1/traces` capture accepts a span only when all of these hold:

- The service is the first-party `copilot-chat` service.
- The provider is `github`.
- The operation is `invoke_agent`.
- The span has a Copilot session attribute and a non-empty agent name.

Agent names can differ for top-level modes and participants. A nested
subagent span cannot replace or repeat the top-level session. Trace
attribution and pending child spans survive split requests for a limited
time. Saved source IDs prevent a replay after a restart.

Native facts can arrive after provider history. Trajectory then upgrades the
matching token or tool fact in the same atomic write that adds the native
data. Unrelated history text and unmatched tools stay as they were. Content
stays off unless the provider sent it. Setup always writes
`github.copilot.chat.otel.captureContent=false` when no one else owns that key.

Tests use fixtures for the current file format. Trajectory has not yet been
tested in the real VS Code app or with incognito.

## Cursor

Cursor has two capture paths: Cursor Desktop hooks, and a watcher for
cursor-agent transcripts.

### Cursor Desktop hooks

Setup manages `~/.cursor/hooks.json` and `~/.cursor/mcp.json`. Command hooks
run Trajectory's capture helper and send Cursor payloads to
`/capture/cursor/...`. Before capture starts, `preToolUse`, `postToolUse` and
`postToolUseFailure` print `{}`. Trajectory states no permission decision, so
Cursor's own approval stays in charge. Only an enabled module that blocks a
call answers with a permission (`deny`).

If Cursor stops a slow capture at its timeout, it already has the answer.

Cursor documents 21 hook events: 18 Agent hooks, two inline Tab hooks, and
`workspaceOpen`. Setup writes all 18 Agent events. It leaves out the Tab hooks
because inline completion is not an agent session. It leaves out
`workspaceOpen` because the editor sends it without a conversation ID.

Cursor offers command and prompt hooks but no native HTTP hooks. Prompt hooks
call another model, so they cannot carry telemetry without loss. If Claude
Code is not installed, setup also writes `~/.cursor/skills/incognito/SKILL.md`.

The generic `preToolUse`, `postToolUse`, and `postToolUseFailure` hooks record
the tool's start and end. Shell, MCP, read, and edit hooks add gate,
permission, or operation details. They do not add a second tool event.

### cursor-agent transcripts

The current cursor-agent can send the same hook payloads as Desktop.
Trajectory's `capture-hook` handles them. When no hooks fire, a watcher and
backfill read the same files under `~/.cursor/projects/`:

- main sessions at `*/agent-transcripts/<session>/<session>.jsonl`
- nested child and side-chat files at
  `*/agent-transcripts/<parent>/subagents/<child>.jsonl`
- CLI Task children written next to the main transcripts
- legacy flat JSONL files

Trajectory keeps the raw and provider IDs. It adds a project-scoped session ID
that is safe as a path. Child sessions link to their exact parent.

The watcher is off by default:

```bash
trajectory config features enable cursor_agent_durable_history
trajectory config reload --yes
```

A config reload starts or stops the watcher without restarting
`trajectory serve`. An enabled watcher waits if the Cursor folder does not
exist yet. When the flag is off, disabled by managed policy or the
environment, or when all watchers are off, Trajectory creates no cursor or
transcript state.

The watcher emits only what the files contain: text, thinking, tool requests,
tool results, and `turn_ended` records. Current files have no provider
timestamps, model, token or cost usage, tool results, or session end.
Trajectory marks timestamps that come from file order as derived. It does not
invent a model, token estimate, cost, successful tool result, or session end.
A skill-file read therefore shows that the agent meant to use the skill. It
does not show a finished skill use.

When Cursor changes or deletes a transcript, Trajectory rebuilds or clears the
watcher's own session JSONL and local viewer data. Hook traces stay. The
watcher does not guess whether a session came from Desktop or the headless
CLI. Missing token data shows as zero in the local viewer.

One CLI Task parent can write several children as sibling main transcripts,
with no parent field. Trajectory links them only when the prompt matches
exactly and exactly one project folder holds the parent. Unclear parent IDs
are not linked. Legacy text transcripts are not supported.

### Side chats in Cursor Desktop 3.11

Cursor Desktop 3.11 marks interactive side chats in its global `state.vscdb`
composer headers. Trajectory reads only the `composerHeaders` table or the
legacy `composer.composerHeaders` key, within strict size limits. It uses
these fields:

- `parentComposerId` and `subagentTypeName: side-chat` tell an interactive
  side chat apart from a background subagent.
- `sideChatSeedTurnCount` lets Trajectory leave copied parent turns out of the
  side chat.

A child started from a side chat links to that side chat, not to the main
chat. Trajectory skips rows that conflict, loop, are too large, or do not
match each other. It never uses other chat-store data. Child transcripts wait
while the metadata database is unreadable and retry later. If late metadata
changes how a session was classified, Trajectory rebuilds the watcher's
session. Copied and live activity then never mix. Tests cover this with a
Desktop 3.11.25 fixture. A live test in the 3.11 app is still to do.

### Watcher polling

On macOS, some source watchers poll and do not use file system
notifications. Folder notifications on macOS can hold one file handle for each
file. These watchers poll on macOS: Cursor Agent, Warp, Antigravity, gptme,
CodeWhale, Kimi, Copilot, Devin, ForgeCode, Hermes, OMP, OpenCode, Qoder, Qwen,
and Zed. Other
platforms keep optional notifications alongside polling.

Trajectory checks active Cursor transcripts every minute and looks for new
paths every 30 seconds. A new event can wait for both checks. Changed files
are read at once. Unchanged files are checked from time to time, because file
change times can collide. Large files continue across polls.

### Cloud agents

Cursor cloud agents do not load the user-level hooks that Desktop setup
installs. They support only some project, team, and enterprise command hooks.
They leave out session lifecycle, MCP execution, Tab, and workspace hooks.
Cloud agents therefore need their own managed or project-level setup.

### Cursor usage and pricing

For both paths, Trajectory publishes Cursor's input, output, cache-read, and
cache-write tokens when all four are present. Live pricing is a separate
setting that applies only going forward:

- `pricing.cursor.mode` is `off`, `shadow`, or `emit`.
- `pricing.cursor.source` is `org_file` or `datadog_reference_table`.
- The `org_file` source reads `~/.trajectory/org/pricing.yaml`.
- The Reference Table source currently emits `pricing_source_unavailable` and
  no USD.

Some records never get a generic cost estimate. These include records with
missing, partial, invalid, or conflicting tokens, records with a missing or
mismatched model, and watcher-only records. Managed backfill can republish
retained cost under the live metric names with the original timestamps.

## Antigravity CLI

Setup writes these files:

```text
~/.gemini/antigravity-cli/settings.json
~/.gemini/config/plugins/trajectory/plugin.json
~/.gemini/config/plugins/trajectory/hooks.json
~/.gemini/config/plugins/trajectory/skills/incognito/SKILL.md
~/.gemini/config/plugins/trajectory/commands/incognito.toml
```

`settings.json` registers Trajectory MCP. The named hook definition uses
Antigravity's `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`,
and `Stop` events. Each hook runs
`trajectory capture-hook --client agy --ensure-serve`.

Each command prints its answer first: `{"decision":"allow"}` for
`PreToolUse`, and `{}` for the others. If Antigravity stops a slow capture at
its timeout, it already has the answer.

Trajectory reads Antigravity's camelCase identity and workspace fields and
records `client_source=agy`. `stepIdx` pairs each tool's start and end. Hooks
provide the following data:

- `PostToolUse` reports completion or error status, but not tool output.
- Hooks carry no prompt, assistant text, provider model, tokens, cost, or
  session end. Trajectory does not invent them.
- `modelName` can be a selector such as `auto` or a model-like name.
  Trajectory keeps it as `model_label`. It does not treat it as the provider
  model or use it for cost.

### Prompt history and usage

To add prompt history, run:

```bash
trajectory config features enable antigravity_durable_history
trajectory config reload --yes
```

This watcher is off by default. It reads
`~/.gemini/antigravity-cli/history.jsonl` and the current schema-v1
`~/.gemini/antigravity-cli/conversations/<uuid>.db` files.
`ANTIGRAVITY_CLI_DIR` points Trajectory at another folder. Current
Antigravity CLI does not use that variable itself.

The watcher works as follows:

- It uses only the `conversationId`, `display`, `timestamp`, and `workspace`
  fields.
- On first use it records a baseline of existing rows. It then picks up new
  rows and sessions, including changes made while `trajectory serve` was
  stopped.
- It uses the same conversation ID as the hooks and removes duplicates. Prompt
  rows add to hook traces and do not replace them.
- Deleted or rewritten history never removes local history or invents a
  session end.
- Slash-command rows and unknown typed rows are not treated as model prompts.

For the current database schema, Trajectory opens SQLite read-only. It checks
the schema version and file identity. It reads only the `gen_metadata` usage
block. It keeps the provider model and the uncached input, total output, and
cache-read counts. Output already includes thinking, and no separate
reasoning count exists.

These counts become token-only model spans. They can get a cost from
Trajectory's rate card, but never count as provider-billed cost. The table has
no time for each generation, so Trajectory marks the database file time as
synthetic. Unknown schemas, unreadable rows, rewrites, and removals are
skipped.

Trajectory does not read private step transcripts. It records no assistant or
thinking text, tool payloads, `turn_end`, or `session_end` from them.
Trajectory cannot replay history from before the first watcher baseline.

## Gemini CLI (retired)

Trajectory no longer launches, sets up, captures, imports, or resumes Gemini
CLI. It no longer marks Gemini CLI sessions as headless. Setup and update
remove only Trajectory's own Gemini hooks, MCP entry, and incognito files.
They do not touch user settings, retained history, or Antigravity state under
`.gemini`.

Trajectory records no new Gemini CLI activity. An older release might have
installed a Gemini CLI hook that cleanup has not removed yet. That hook does
nothing:

- `trajectory capture-hook --client gemini` exits successfully with no output.
- The capture server answers `/capture/gemini/...` with an empty response.
- Neither one records an event, starts `trajectory serve`, or prints into the
  Gemini CLI terminal.
- An inherited `GEMINI_SESSION_ID` no longer labels another client's events
  as Gemini or replaces their session ID.

Each dropped hook leaves a note with no hook content. Support can then tell
that the hook file is still installed:

- The command appends a line with
  `client=gemini delivery_result=retired_client` to `logs/capture-hook.log`.
- The capture server writes a `serve.capture.retired_client_hook_dropped`
  event with a drop count. It goes to `logs/serve-diag.ndjson` and the
  operational log, at most once a minute.

To remove the hook, run `trajectory setup` or `trajectory update`.

Sessions captured before retirement stay readable in the viewer, cost reports,
and exports. Backfill and replay still publish them, with the same values as
earlier releases. For these sessions, `gen_ai.usage.input_tokens` includes
cache reads, because Gemini CLI reported a prompt count that included them.
`gen_ai.usage.cache_read_tokens` reports the same cache reads again.

Trajectory does not change those published values. A different value for a
point already sent conflicts with the stored row, so backfill skips it.
Subtract cache reads when you compare Gemini CLI input tokens with other
clients.

Use `trajectory setup --clients agy` for Antigravity. The history-import SDK
keeps its Gemini history converter for other programs that use it. Gemini
models used through other supported clients are not affected.

## Goose

### Setup and hooks

Setup installs Goose Open Plugins command hooks in
`~/.agents/plugins/trajectory`. If `GOOSE_PATH_ROOT` is set, setup uses the
same path under that root. Setup turns a relative root into an absolute path
once, against its own working directory. It writes that path into every hook.
A later Goose working directory therefore cannot change where Trajectory looks.

New installs use the generic tool hooks: `PreToolUse`, `PostToolUse`, and
`PostToolUseFailure`. Trajectory still accepts the older shell and file hooks.
When both sets are installed, it drops the duplicate pair. It records current
names such as `developer__shell` and keeps `native_tool_name`.

Goose hooks carry lifecycle, prompts, assistant text, tools, and the session
ID. They have some gaps:

- They carry no reliable provider usage or launch mode.
- The generic tool payload has no tool call ID. Two calls to the same tool at
  the same time can be paired wrongly.
- Post-tool payloads leave out the tool result or error text.
- Lifecycle and prompt payloads have no working directory. `capture-hook` then
  adds its own directory with `cwd_provenance=hook_process_working_dir`.

Hooks cannot tell interactive runs from headless runs. All Goose hook sessions
therefore use `source_mode=unknown`. Task segmentation treats them as
headless.

All Goose hooks wait in the foreground until the server accepts the event,
so events keep Goose's order. If the server is unavailable, a local fallback
keeps the lifecycle. If a hook POST might have succeeded but the response was
lost, capture skips the fallback. This avoids writing `SessionEnd` before the
history merge.

Goose does not send another `SessionStart` when you reopen a conversation that
has content. The first hook after the session end therefore starts a new
session generation, marked `resume_evidence=post_terminal_hook`.

### Session history

The `goose_durable_history` feature is on by default. It reads the
`sessions`, `messages`, and `usage_ledger` tables from `sessions.db`,
including its WAL and SHM files. Trajectory finds the database as follows:

- It follows Goose's current data folder, or `GOOSE_PATH_ROOT/data/sessions`
  when set.
- It also checks legacy folders for migrated installs, unless setup
  registered an explicit root.
- A root that setup registered is the only one used. A stale copy of the same
  session elsewhere cannot override it.
- It rejects databases that are links, and it limits how much it reads.

The reader honors Goose's `userVisible=false` setting for every content and
tool block. It keeps only usage and model metadata from hidden blocks. It
keeps text and thinking for visible messages. It never keeps image bytes or
redacted thinking. System notices, tool confirmations, and elicitation blocks
become metadata-only records labeled
`provider_structured_content_fidelity=metadata_only`.

The provider session ID is also the Open Plugins ID. How history combines with
hooks depends on who started the session:

- **History-only sessions** become incomplete sessions owned by the history
  reader. The database wins for session and parent IDs, working directory,
  messages, model, and tool request and result IDs and payloads.
- **Hook sessions** get only exact per-turn usage corrections from history.
  History does not replace hook session data, repair tool IDs, or add missing
  tool result text. Hook content and lifecycle win.

Trajectory reads the database on a schedule, not while Goose waits for a
`Stop` hook. `SessionEnd` tries one history read before Trajectory saves the
end event. If the read fails, Trajectory records a diagnostic and still saves
`SessionEnd`. Publishing continues after Trajectory saves the end event.

Cost follows these rules:

- Only `provider_reported` USD counts toward attributed cost.
- `estimated`, mixed, or carried-forward amounts stay raw provider data, with
  no attribution.
- Token counts that are null, partial, negative, or that contradict each
  other stay raw data with `tokens_status=unavailable`. They never become turn
  usage.

A deleted provider session leaves a deletion record. Trajectory never invents
a session end for it.

### Verify

```bash
trajectory setup --clients goose
trajectory doctor
```

## Cline CLI

Setup writes Trajectory hooks in `~/.cline/hooks`, or `$CLINE_DIR/hooks`. It
also writes a manifest at `~/.cline/hooks/.trajectory-cline-hooks.json`. The
Cline MCP settings are in `~/.cline/data/settings/cline_mcp_settings.json`.
`CLINE_DATA_DIR` or `CLINE_MCP_SETTINGS_PATH` can change that path.

Cline loads one script for each hook file name. Trajectory installs scripts
that never block Cline for these hooks: `TaskStart`, `TaskResume`,
`UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `TaskComplete`, `TaskCancel`,
`TaskError`, and `SessionShutdown`. Setup keeps your own hook files. If
`TaskStart.sh` exists and Trajectory does not manage it, setup picks the next
supported name, such as `TaskStart.bash`.

The scripts run `trajectory capture-hook --client cline --ensure-serve`. They
send their input to `/capture/cline/<event>`. Trajectory accepts both the file
names and Cline's payload hook names, such as `agent_start`, `prompt_submit`,
`tool_call`, `tool_result`, `agent_end`, and `session_shutdown`. Records use
`client_source=cline` and `source_dialect=cline.cli.hooks.v1`.

Cline hooks carry lifecycle, prompt, tool, assistant summary, and shutdown
data. They carry no stable token or cost usage. Trajectory therefore writes
`turn_end.tokens_status=unavailable`.

```bash
trajectory setup --clients cline
trajectory doctor
```

## Factory Droid

Setup writes a local Factory marketplace in
`~/.trajectory/factory-marketplace`. It registers the marketplace with Droid
and installs `trajectory@trajectory`. The plugin includes command hooks,
`mcp.json`, and an incognito skill.

Capture is beta and covers live CLI sessions only. Trajectory cannot import
past Factory or Droid sessions. Every Factory command hook runs
`trajectory capture-hook --client droid --ensure-serve`. The hook keeps one
delivery ID across server restarts.

## Hermes Agent

Setup installs a user plugin in `$HERMES_HOME/plugins/trajectory`. It also
updates `$HERMES_HOME/config.yaml` with `plugins.enabled: [trajectory]` and
`mcp_servers.trajectory`. Hermes finds plugins through `plugin.yaml` and an
`__init__.py register(ctx)` entry point. Trajectory uses that native observer
plugin instead of hook JSON or shell shims.

When `HERMES_HOME` is not set, Trajectory uses Hermes's default folder:
`~/.hermes` on macOS and Linux, and `%LOCALAPPDATA%\hermes` on Windows.

The plugin registers read-only observer hooks:

- `on_session_start` -> `SessionStart`
- `pre_llm_call` -> `UserPromptSubmit`
- `post_api_request` -> `AgentMessage`, plus an `llm_call` record
- `post_llm_call` -> `Stop`
- `pre_tool_call` / `post_tool_call` -> tool events
- approval hooks -> permission events
- subagent hooks -> subagent events
- `on_session_finalize` -> `SessionEnd`

The plugin sends events to `http://127.0.0.1:19222/capture/hermes/<event>` from
one background sender. A hook never waits for capture, and delivery errors do
not affect Hermes. The sender works as follows:

- Each send has a time limit. Errors are ignored.
- When 1,024 events or 32 MiB are already queued, the hook waits up to one
  send timeout for space. Events stay in order, and memory use stays limited.
- When Hermes exits, the sender keeps sending for up to 30 seconds. It stops
  at the first failed send.

Records use `client_source=hermes`. Trajectory stores Hermes observer turn IDs
as `observer_turn_id`. It uses Hermes `usage` payloads for token and cost
fields when they are present.

### Session history

Session history is a separate, read-only feature that is off by default:

```bash
trajectory config features enable hermes_durable_history
trajectory session import hermes
trajectory session import hermes --session <provider-session-id>
trajectory session import hermes --force
```

Trajectory follows Hermes's `HERMES_HOME` and opens `state.db` read-only. It
keeps provider IDs, tool lifecycles, parent links, and session end state.
Current stores also give tool result details and the `session_model_usage`
breakdown as provider diagnostics. Session token counts and cost stay at
session level. The importer does not assign them to turns or create past
model calls.

While `trajectory serve` runs, the feature also reads `state.db` and its WAL
and shared-memory files from time to time. Hook events win. History adds to or
replaces only facts that came from history earlier. The `SessionStart`,
`AgentMessage`, `Stop`, and `SessionEnd` hook events ask for a read of that
session. Polling catches missed notices and rewrites.

A deleted provider session never deletes a local trace. An active final turn
stays open until Hermes records its end. Use the `--force` import for bulk
history and repair.

```bash
trajectory setup --clients hermes
trajectory config features enable hermes_durable_history
trajectory session import hermes
trajectory doctor
```

## Amp Code

Setup writes a system plugin at `~/.config/amp/plugins/trajectory.ts` or
`$AMP_CONFIG_DIR/plugins/trajectory.ts`. It adds `amp.mcpServers.trajectory`
to `~/.config/amp/settings.json`.

Amp's plugin events are `session.start`, `agent.start`, `tool.call`,
`tool.result`, and `agent.end`. The Trajectory plugin starts or reuses
`trajectory serve`. It turns these events into Pi-style payloads and sends
them to `http://127.0.0.1:19222/capture/amp/<event>`. Records use
`client_source=amp`. `tool.call` returns an allow decision, so capture never
blocks a tool.

Amp plugin events carry the thread ID, prompts, assistant messages, tool calls
and results, and agent status. They carry no model, token, cost, duration, or
session-end fields. Trajectory leaves those fields empty and does not guess
them. Amp has no session-end plugin event, so Trajectory does not invent one.
Amp support is tested with fixtures only. It has not been tested headless
against a live Amp account.

### Thread history

The `amp_durable_history` feature is off by default. It reads top-level
`T-*.json` files in `~/.local/share/amp/threads` or
`$XDG_DATA_HOME/amp/threads`. It reads them without changing them.

- The Amp thread ID is also the live plugin session ID. A session with any
  plugin event keeps its full trace. Trajectory can rebuild a history-only
  session after Amp rewrites the file.
- Current per-message usage and legacy usage-ledger events give the model and
  token counts. Legacy ledger rows match only by exact `toMessageId`.
- Amp credits stay in a separate field. They are not USD cost.
- History never marks a session active and never invents a session end.
- A deleted thread leaves the local trace in place, with a deletion record.

`TRAJECTORY_DISABLE_AMP_HISTORY_WATCHER=1` turns off only this watcher.

```bash
trajectory setup --clients amp
trajectory config features enable amp_durable_history
trajectory config reload --yes
trajectory doctor
```

## Qwen Code

Setup merges Trajectory settings into `~/.qwen/settings.json` or
`$QWEN_HOME/settings.json`. It keeps your provider and hook settings. It makes
these changes:

- It adds `mcpServers.trajectory`.
- It adds `http://127.0.0.1:19222/capture/qwen/*` to
  `security.allowedHttpHookUrls`.
- It registers native HTTP hooks that send events to
  `/capture/qwen/<event>`.

The registered events that write records are `SessionStart`,
`UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `PostToolUseFailure`,
`PermissionRequest`, `PermissionDenied`, `SubagentStart`, `SubagentStop`,
`PreCompact`, `PostCompact`, `Notification`, `Stop`, `StopFailure`, and
`SessionEnd`. Qwen-only hooks such as `TodoCreated` and `InstructionsLoaded`
are accepted but write nothing. Setup then matches Qwen's hook names without
inventing events.

### Qwen token usage

Records use `client_source=qwen`. Trajectory reads these Qwen `usageMetadata`
fields: `promptTokenCount`, `candidatesTokenCount`, `thoughtsTokenCount`, and
`cachedContentTokenCount`.

`cachedContentTokenCount` is part of `promptTokenCount`. `candidatesTokenCount`
can overlap `thoughtsTokenCount`. Trajectory uses `totalTokenCount` to split
the counts into uncached input, cache read, visible output, and reasoning. It
writes an `llm_call` record when the model, prompt count, and total count are
all present.

Without the total, Trajectory keeps the raw candidate and thought counts and
marks the split as partial. It then writes no `llm_call` and no cost estimate.
Malformed counts, or cached tokens larger than prompt tokens, get the same
treatment. Trajectory keeps the provider's numbers and never clamps them.

When a stop payload has no usage, Trajectory reads the end of the Qwen chat
JSONL named by `transcript_path`. It applies the same rules. It reads only
recent records and refuses very large ones. `qwen_transcript_status` and
`qwen_transcript_truncated` report when that usage is missing or partial. The
reader never returns older usage when the newest assistant record has none.

### Qwen chat history

To turn on the history watcher and manual repair, run:

```bash
trajectory config features enable qwen_durable_history
trajectory session import qwen [--session ID] [--force]
```

Trajectory finds the Qwen runtime folder the way current Qwen Code does:

1. It applies process and user-level `.env` overrides first.
2. `QWEN_RUNTIME_DIR` wins.
3. Otherwise it merges `advanced.runtimeOutputDir` from system defaults, user
   settings, trusted workspace settings, and system overrides, in that order.
4. `QWEN_HOME` or `~/.qwen` is the fallback.

Relative paths start from the working directory. Trajectory checked this
against Qwen Code 0.19.11. Live tests still use 0.19.2.

The importer reads regular files only, never links. It reads
`projects/*/chats/*.jsonl` and `projects/*/chats/archive/*.jsonl`. A session
found in both places, or at more than one path, is reported as unclear
instead of guessed.

The importer rebuilds the active branch of each chat from its `parentUuid`
chain. Hooks win for lifecycle and tool timing. History wins for per-request
assistant usage, because Qwen's `Stop` hook reports only the last request. The
same token rules apply as for hooks. The transcript has no session-end marker,
so the importer writes turn boundaries but never `session_end`.

While the flag is on, `trajectory serve` also runs a watcher. It works as
follows:

- The first pass reads existing active and archived chats in pages.
- Later passes use file notices and polling. They catch rewrites that keep
  the same size and time.
- Native `Stop` and `SessionEnd` hooks ask for a read of that session. Their
  `transcript_path` tells the watcher about workspace-specific runtime
  folders.
- A deleted chat keeps its local history. Trajectory does not invent a session
  end.
- When Qwen rewrites a chat, the local viewer drops spans that no longer
  exist.
- History writes share the session file lock with hooks, so a hook event that
  arrives at the same time is merged.

A hook's transcript path also starts discovery when the server did not see
Qwen at startup. If another server process runs the watcher, the receiving
process reads that session once and passes the folder on.

Automatic discovery starts from the server's own Qwen runtime folder and from
folders seen in hook transcript paths. Trajectory cannot find history in a
folder that only another workspace's settings chose. To import that history,
run the import command from that workspace.

```bash
trajectory setup --clients qwen
trajectory doctor
```

## Kiro CLI

Setup writes a Trajectory Kiro agent to `~/.kiro/agents/trajectory.json` or
`$KIRO_HOME/agents/trajectory.json`. It merges `mcpServers.trajectory` into
`~/.kiro/settings/mcp.json`. Kiro 2.x loads the agent's hooks when you select
it with `--agent trajectory`. Setup does not replace your default agent.

Kiro runs command hooks from the agent config. Trajectory registers hooks for
`agentSpawn`, `userPromptSubmit`, `preToolUse`, `postToolUse`, and `stop`.
They never block Kiro. Kiro passes each payload as JSON on stdin, and the hook
runs:

```bash
trajectory capture-hook --client kiro --ensure-serve --ensure-serve-wait 2s <event>
```

Records use `client_source=kiro` and `source_dialect=kiro.cli.hooks.v1`. `stop`
payloads include `assistant_response`, so Trajectory writes an `agent_message`
and then a `turn_end`. Kiro hooks have no stable token or cost fields, so turn
records use `tokens_status=unavailable`.

### Kiro session history

The optional `kiro_durable_history` feature reads Kiro's local history:

```bash
trajectory config features enable kiro_durable_history
```

It reads these stores:

- `$KIRO_HOME/sessions/cli/*.jsonl` and their metadata files
- the `conversations_v2` and legacy `conversations` tables in
  `kiro-cli/data.sqlite3` on macOS and Linux

The watcher opens provider files read-only and rejects links. It saves its
progress, so delivery resumes after a crash. The Kiro session ID joins JSONL,
SQLite, and hook records into one session:

- JSONL is the source of truth for content.
- SQLite adds data only for an exact message ID.
- Hook content wins in a mixed session.
- A deleted session leaves a deletion record. Local history stays, and no
  `session_end` is invented.

Kiro does not document a Windows SQLite location, so Trajectory does not
guess one. JSONL history still works through `KIRO_HOME`.

The history has messages, model IDs, tool IDs and results, working directory,
and timestamps. It has no token or cost data. Trajectory does not turn
`response_size` bytes or older usage estimates into tokens. Kiro 3.0 early
access stores sessions in a different format, and this watcher does not read
it.

Kiro's docs use `includeMcpJson` in agent config. The older Amazon Q Developer
CLI used `useLegacyMcpJson`. Trajectory does not write that older key.

```bash
trajectory setup --clients kiro
trajectory config features enable kiro_durable_history
trajectory config reload --yes
trajectory doctor
```

## Pi

Setup writes `~/.pi/agent/extensions/trajectory/`. It points
`~/.pi/agent/mcp.json` at the extension's own `bin/trajectory mcp` command. Pi
gets Trajectory tools through the extension. It can also use the shared MCP
catalog where MCP is available. Pi does not get a `hooks.json` file.

The Pi TypeScript extension listens for lifecycle events. Examples are
session start, message end, tool call, tool result, turn end, compaction,
model change, and session shutdown. Each event goes through an ordered queue and
runs `trajectory capture-hook --client pi`. The helper keeps one delivery ID
across server restarts. Pi waits at most 500 ms for each capture response. A
single helper stops after 1.5 seconds.

At shutdown, Pi gives the queue a short time to finish. It then hands the
remaining events to a background worker and exits. Provider history repair
stays available.

### Pi parent links

Pi reports fork and new-session changes through `session_start`. Trajectory
links two sessions only when the new session header names the previous
session file.

Trajectory also links subagents:

- The official `pi-subagents` extension starts child processes with
  `PI_SUBAGENT_CHILD=1` and `PI_SUBAGENT_PARENT_SESSION=<provider-session-id>`.
  If no fork or new-session parent exists, Trajectory records that parent as
  a `session_relationship=subagent` link.
- The Trajectory extension exports its session ID as
  `TRAJECTORY_PI_PARENT_SESSION`. A child Pi process that inherits it, starts
  a fresh session, and runs in print or JSON mode gets the same link.
  Custom tools that run `pi -p` or `pi --mode json` are therefore linked
  without Pi-specific variables.
- The `pi-subagents` variables win over the inherited value. TUI and RPC runs
  never use the inherited value.

The local database stores the link in `sessions.parent_session_id` and in the
`subagents` relation. Trajectory does not invent a launch tool or call.

### Pi history

Pi history starts with a session header. It stores parent links as a
reference to the parent's session file. `trajectory session import pi` and
managed history replay read these files.

The `pi_history_backfill` flag is off by default. It makes the capture server
find session files in `~/.pi/agent/sessions` that Trajectory has not captured.
It adds them to the local catalog. It keeps provider IDs and parent links.
It never rewrites a session that Trajectory already has. It never writes
`session_end`, active state, or a publish job.

Automatic import follows these rules:

- It waits until a file has not changed for two minutes.
- It handles up to 64 files or 64 MiB in each batch. It reads more pages in
  the background, then checks for new files every minute.
- Each source file can hold up to 8 MiB or 50,000 records.
- It reads only project files and the `pi-subagents` nested layout. It skips
  linked children, OMP folders, custom Pi folders, and other nested JSONL.
- Malformed or incomplete files are retried later.
- Its saved progress holds only hashed file paths. Damaged progress data
  stops the import and is reported. It is never reset without notice.

The flag imports history once and does not watch for changes. Trajectory
does not import a file again after it changes, is deleted, or ages out. The extension captures
everything after that. Use `trajectory session import pi` for history outside
the automatic limits. The flag does not change the import command or managed
replay.

## Oh My Pi

Oh My Pi (OMP) has its own integration behind a feature flag:

```bash
trajectory config features enable omp_instrumentation
trajectory setup --clients omp
```

Setup installs an OMP extension declared through `omp.extensions`. It merges
MCP into the active profile's `mcp.json`. The extension sends events to
`/capture/omp`. The server sets `client_source=omp`, and payloads cannot
change it.

### Profiles and folders

Setup follows OMP's active profile instead of assuming `~/.omp/agent`:

- `OMP_PROFILE` wins over `PI_PROFILE`. An empty value selects the default
  profile.
- Named profiles use `~/${PI_CONFIG_DIR:-.omp}/profiles/<name>/agent` and
  ignore `PI_CODING_AGENT_DIR`.
- The default profile honors `PI_CODING_AGENT_DIR`.
- Trajectory uses migrated XDG history only when the matching
  `$XDG_DATA_HOME/omp` or profile folder exists.
- Extensions and `mcp.json` stay in the profile's config folder, even when
  sessions move to XDG data storage.

### Capture

The extension sends lifecycle, prompts, assistant messages, model and usage,
tool calls and results, compaction, switch, branch, and shutdown events.
Session start, switch, and branch do not wait for capture, so OMP is never
blocked. Later events wait for the pending start, so the server still sees
`SessionStart` first. Only shutdown waits for its `SessionEnd`.

Parent links come only from the current v3 header or the exact previous file
named by OMP. Resume and switch reasons do not create fork links.

### History

`trajectory session import omp` imports the profile's v3 history, including
nested folders. Current files start with a `title` metadata slot before the
session header. `parentSession` can be a provider ID or a file reference. The
import keeps IDs, nested children, tool results and errors, model changes,
native usage, and compaction.

While the flag is on, a watcher also reads existing and changed v3 files from
the same profile folder. It works as follows:

- Its saved progress holds IDs and fingerprints, not paths or content.
- Extension events win over history for the same data.
- History never marks a session complete, makes it active, or starts a
  publish.

Use `trajectory session import omp` to repair complete history.

Automated tests run OMP 17.0.4 with Bun 1.3.14, without credentials. They
start the real RPC server and run a local command without a model call. They
check for exactly one start and one end in order, the session and model
identity, and an unpriced session with no token data. Turns with a real model,
the interactive UI, and privacy features are not yet tested live.

## OpenCode

Setup installs the OpenCode plugin in the OpenCode config folder. It adds the
plugin path and a `trajectory` MCP entry to `opencode.json`. It writes the
incognito skill to the OpenCode skills folder. OpenCode does not get a
`hooks.json` file.

The plugin SDK events cover chat messages, tool start and end, and lifecycle
events.

### OpenCode turns

OpenCode keeps one active Trajectory turn for each session during message,
permission, or tool activity:

- An idle notice sends the buffered assistant text and usage, then one `Stop`
  for the active turn. Repeated idle notices do not send another `Stop`.
- `Stop` closes the turn.
- Trajectory keeps session state until the session ends, is deleted, or the
  plugin shuts down. A resumed turn or a later `session.created` event then
  keeps the same parent links.

Memory use stays limited. Above 128 sessions, Trajectory evicts idle session
state. Above 512 sessions, it can evict the oldest state even if it is in
use. Each session keeps at most eight queued turns
with full detail. Beyond that, it keeps up to 128 placeholder `Stop`
boundaries marked `turn_snapshot_dropped`. Further overflow is merged or
dropped. Detail is lost only under heavy load.

### OpenCode history

`trajectory session import opencode` imports past sessions. It finds the
current and channel SQLite databases and retained JSON storage. SQLite wins
for duplicate session IDs. JSON-only sessions are kept. The importer looks in
these places:

- `OPENCODE_DB`
- `OPENCODE_DATA_DIR`, a comma-separated list. When set, only these folders
  are read.
- Otherwise `XDG_DATA_HOME/opencode` or `~/.local/share/opencode`

The import keeps child and archived sessions, parent and provider IDs, tool
call IDs and status, and reasoning. It sums usage from each step. It records
whether cost came from OpenCode or from Trajectory.

To read new and changed sessions automatically, run:

```bash
trajectory config features enable opencode_durable_history
```

This watcher is off by default. It reads the current and channel databases,
their WAL and SHM files, and the retained session, message, and part JSON. It
works as follows:

- It matches sessions by provider session ID across all sources.
- It waits for a short quiet period after writes. During long write bursts it
  still runs about once a second.
- It starts without replaying old history.
- Plugin traces always win.
- A deleted session leaves a deletion record. Trajectory does not invent a
  session end.
- If a session is too large or the reader is busy, Trajectory skips it for now
  and retries. It never replaces richer history.

Existing history still needs `trajectory session import opencode`.

### Nested session topology and local navigation

OpenCode can create a nested child session for delegated work. A child can
have its own children, several levels deep. Not every delegation creates a
child session.

For each child session, the plugin records the exact parent ID from
`session.created` on the child's first `SessionStart`. History import keeps
the same parent IDs. Events that arrive out of order still lead to one row per
session, and no launch is invented. The local viewer navigates by this parent
link. It is separate from the launch matching that counts subagent calls. See
[reference/SUBAGENT-TRACE-MODEL.md](SUBAGENT-TRACE-MODEL.md) for the
full rules and expected results for each case.

In the local viewer, each child stays a separate session with its own trace:

- Children do not appear in the top-level session list. You can open every
  child and grandchild by its session ID.
- Session detail shows the parent, the `root_session_id`, the list of
  ancestors in order, and up to 100 direct children.
- `child_sessions_total` gives the exact number of direct children.
  `child_sessions_more` says whether that number is larger than the returned
  `child_sessions` list.
- Trajectory computes these fields when you open the session, from the parent
  rows in SQLite. It follows at most 64 ancestors and stops at loops.
- Parent, breadcrumb, and child links open sessions by ID. They work from
  SQLite rows even when no child JSONL is available.
- Subagent cards nest up to eight levels. Below that, the viewer shows an
  "Open child session" link instead.

Broken chains stay usable. A missing ancestor, a loop, a chain that is too
deep, or a parent conflict between the JSONL and the cache keeps the direct
parent. The root is then the current session. The detail reports
`missing_parent`, `cycle`, `depth_exceeded`, or `parent_conflict`.

When the SQLite cache or the session row is unavailable, detail reports
`ancestry_status: unavailable`. It keeps a raw parent when one exists and sets
the root to the current session. The ancestor and child lists are empty. In
that state, `child_sessions_total: 0` and `child_sessions_more: false` are
placeholders, not a real child count.

Oh My OpenAgent (OMO) runs on top of OpenCode sessions. It has no setup
target or capture path of its own, and Trajectory adds nothing for it.
Delegation shows only when OpenCode creates or reuses a session ID. The OMO
Sisyphus-Junior worker uses the native Task tool and might create no child
session to link.

## Kilo Code

Kilo Code uses an OpenCode-compatible plugin. Setup installs the Trajectory
plugin in the Kilo config folder. That is `KILO_CONFIG_DIR` when set,
otherwise `XDG_CONFIG_HOME/kilo` or `~/.config/kilo`. Setup adds the plugin
path and a `trajectory` MCP entry to `opencode.json`. It writes the incognito
skill to the Kilo skills folder.

The plugin sends events to `/capture/kilo/...`. The server handles them
through the OpenCode capture path.

Kilo can also send native OpenTelemetry traces and logs to Trajectory's local
OTLP relay. To do this, set
`OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:19222` and turn on Kilo's
OpenTelemetry export. The relay works alongside the plugin events.

Kilo can send completion text before usage. The plugin therefore sends one
`AgentUsage` event after the final `message.updated`. Trajectory then records
one model call with input, output, reasoning, cache-read, and cache-write
tokens. The call also has the model, provider, native timestamp, and
provider-reported cost. If the usage event is missing, Trajectory records no
usage. `Stop` does not read OpenCode's database instead.

### Kilo history

History is a separate fallback that is off by default:

```bash
trajectory config features enable kilo_durable_history
trajectory session import kilo          # repair existing history
```

With the feature on, `trajectory serve` watches Kilo's data folder:

- `$XDG_DATA_HOME/kilo` when set
- `~/Library/Application Support/kilo` on macOS
- `%LOCALAPPDATA%\kilo` on Windows
- `~/.local/share/kilo` on other systems

It reads `KILO_DB` (absolute or relative to the data folder), `kilo.db`,
current `kilo-<channel>.db` files, and retained legacy `opencode-<channel>.db`
files. It also reads the retained `storage/session`, `storage/message`, and
`storage/part` JSON. `KILO_CONFIG_DIR` controls configuration only, never the
data folder.

Plugin JSONL always wins. The watcher starts without replaying old history. A
deleted source leaves only a deletion record. Active sessions do not get an
invented `session_end`. The Kilo CLI and editor share one store, so history
cannot tell which one started a session.

Kilo uses the same nested session topology and local viewer navigation as
OpenCode. This includes exact parent links on child sessions, root lookup when
you open a session, and hiding child sessions from the top-level list.

## OpenClaw

Released Trajectory builds do not capture OpenClaw live. When
`openclaw_durable_history` is on, a reader imports OpenClaw v2026.7.1
agent-session JSONL, and `trajectory session import openclaw` repairs it. Resume,
MCP and incognito controls, and setup-managed install are not available.

## Devin CLI

Devin support is a preview and is off by default. Turn it on before setup:

```bash
trajectory config features enable devin_cli_instrumentation
trajectory setup --clients devin
```

Setup keeps your other settings. It adds only Trajectory entries to the Devin
config: `~/.config/devin/config.json` on macOS and Linux, or
`%APPDATA%\devin\config.json` on Windows. It adds these items:

- `SessionStart`, `Stop`, `PostCompaction`, and `SessionEnd` hooks. They never
  block Devin. They only tell Trajectory to read the session store.
- `mcpServers.trajectory` for the incognito tool
- `skills/incognito/SKILL.md` under that config folder, for the global
  `/incognito` command

When `devin_cli_instrumentation` is off, setup does not change Devin settings,
and the reader stays off. Uninstall removes only Trajectory entries and files.

### How Devin capture works

Devin hook payloads have no stable `session_id`. Trajectory therefore does not
turn them into records. Each hook tells Trajectory to read active or changed
sessions from Devin's store:

- macOS: `~/Library/Application Support/devin/cli/sessions.db`, with
  transcripts in the `transcripts/` folder next to it
- Linux: `~/.local/share/devin/cli/sessions.db`, with transcripts in the
  `transcripts/` folder next to it
- Windows: `%APPDATA%\devin\cli\sessions.db`, with transcripts in the
  `transcripts\` folder next to it

The reader prefers `transcripts/<session-id>.json`. It falls back to
`message_nodes.chat_message` in `sessions.db`. Each database and session pair
is a separate source, so Trajectory handles concurrent sessions correctly. It
never picks the newest session for a working directory.

Records use `client_source=devin`. Transcripts and database rows can give
prompts, assistant and thinking text, tool calls and results, the model, and
per-step prompt, completion, and cache counts. Trajectory reads the final
`Snapshot.Usage` total but does not emit it yet.

Trajectory cannot import past Devin sessions in bulk. It reads only active or
changed sessions. Each event carries a delivery ID, so a crash or a retry does
not create duplicates. A session that crosses midnight UTC keeps one session
file.

Earlier releases kept a Devin delivery database at
`state/devin-delivery.sqlite`. Trajectory no longer uses it. You can delete
the file, with or without a `.retired` suffix. Trajectory cannot retract a
row that it already published when Devin later removes the source.

### Devin session end and privacy

Devin's store has no reliable field for interactive or headless mode.
Trajectory marks every Devin session as headless or unknown. Task segmentation
skips them.

Only Devin can end a Devin session. Trajectory writes `session_end` only after
it sees the session move from database messages to a finished transcript.
Without that change, it writes no session end. Session end and final session
metrics are reported as gaps. Server shutdown and orphan recovery never end a
Devin session. Crash recovery does finish an end record that is already
written.

Trajectory redacts session titles, prompts, assistant and thinking text, tool
input, and tool output before it writes session JSONL. Turning on incognito
also writes a privacy record at `state/provider-incognito-<session>`. It
works as follows:

- An enable before the first `session_start` writes the record.
- An explicit disable never removes it.
- Every event is marked incognito while the record exists. An unreadable
  record counts as present.
- Trajectory removes the record only after the session's final publish
  succeeds. A session that never ends keeps the record, and its events stay
  incognito.

Devin reads Claude hook settings by default. Do not change that setting.
Trajectory ignores or reassigns its imported Claude hooks when
`DEVIN_PROJECT_DIR` identifies a Devin process. This prevents duplicate Claude
and Devin records for one action.

Tests use sanitized database and transcript fixtures. Trajectory has not yet
tested Devin live with a signed-in account. It does not infer a
`DEVIN_API_KEY`. It emits only per-step counts that a source record holds. It
does not infer missing totals.

```bash
trajectory config features enable devin_cli_instrumentation
trajectory setup --clients devin
trajectory doctor
```

## Grok Build

Grok Build support is off by default:

```bash
trajectory config features enable grok_build_instrumentation
trajectory setup --clients grok
```

Setup owns these files:

- `$GROK_HOME/hooks/trajectory.json` (default `~/.grok/hooks/trajectory.json`)
- `$GROK_HOME/skills/trajectory-incognito/SKILL.md`
- `~/.trajectory/bin/grok-incognito`

Grok supports global hooks, which do not depend on project trust. Setup writes
one hook file of its own. Uninstall never edits or removes your other hook
files.

Every Grok hook event runs `trajectory capture-hook --client grok`:
`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`,
`PostToolUseFailure`, `PermissionDenied`, `Stop`, `StopFailure`,
`Notification`, `SubagentStart`, `SubagentStop`, `PreCompact`, `PostCompact`,
and `SessionEnd`. Trajectory reads Grok's camelCase fields and keeps the raw
payload. A hook's session ID and `transcriptPath` wake only the matching
session.

### Grok session files

The watcher reads Grok's session folders from these places:

- `$GROK_HOME/sessions` or `~/.grok/sessions`
- the `GROK_DIR` compatibility override
- folders listed in `TRAJECTORY_GROK_HISTORY_DIRS`

It reads the summary, update log, chat history, signals, and parent and child
metadata. It imports old history in batches.
`TRAJECTORY_DISABLE_GROK_HISTORY_WATCHER=1` turns off only this watcher. The
global watcher setting and the feature flag also turn it off.

Session files give prompts, assistant text and reasoning, tools, the model,
workspace, Git, and parent links. Hook data wins. A provider snapshot time
does not end a session, and a deleted file does not create `session_end`.
`signals.json` has token-like counts for the whole session. Grok does not tie
them to calls or turns, so Trajectory emits no token total or cost from them.

Setup, detection, the watcher, backfill, and the local viewer are tested
without credentials. Version 0.2.103 was checked without sign-in. Hooks and
file changes have not yet been tested live with a signed-in account.

## Qoder CLI

Qoder support is a preview behind a feature flag:

```bash
trajectory config features enable qoder_cli_instrumentation
trajectory setup --clients qoder
```

Setup stages a plugin in `~/.trajectory/plugins/qoder/trajectory`. It holds
`.qoder-plugin/plugin.json`, `hooks/hooks.json`, `.mcp.json`, an incognito
skill, and a command. Setup then uses `qodercli plugins` to check, install,
and uninstall it.

Hooks run
`capture-hook --client qoder --ensure-serve --ensure-serve-wait 2s`. They
discard output and always exit 0. They finish at least two seconds before
Qoder's eight-second hook timeout. Each hook passes Qoder's `transcript_path`,
so Trajectory reads only that session. File notices make capture faster.
Polling catches anything they miss.

On startup, Trajectory records a baseline of existing transcripts and does
not import old history. Automatic capture starts only after that baseline is
complete. New sessions are limited to 4,096 by default. When that limit is
reached, sessions already tracked continue, but new ones wait. Sessions left
out because the limit was full at startup stay out of automatic capture, even
after space frees up. A hook for one of those sessions can still add it when
space is free. Missing or damaged data stops the read
without moving its position or changing Qoder's files.

Trajectory looks for transcripts in this order:

1. `QODER_PROJECTS_DIR`
2. `QODER_CONFIG_DIR/projects`
3. `~/.qoder/projects`

It reads the main JSONL, `-session.json` metadata, and the parent's
`subagents/agent-*.jsonl`. It does not merge QoderWork. Repeated assistant
IDs replace earlier snapshots and do not count as extra model calls. When
Qoder changes earlier content, Trajectory rebuilds only its own session JSONL.
It never changes Qoder's files.

Trajectory keeps two IDs for each session:

- Session IDs that are safe as file names: `qoder-<id>` and
  `qoder-<parent>-subagent-<agent>`
- Qoder's own IDs in the provider ID fields: `qoder:<id>` and
  `qoder:<parent>:subagent:<agent>`

Session IDs are file names on every platform, so they cannot contain colons.

Fixture tests cover token and cache fields, tools, thinking, metadata files,
subagents, snapshots, rewrites, deletions, and the plugin CLI. Live tests and
telling interactive runs from headless runs are still to do.

## ZCode

ZCode support is a preview that is off by default. Its SQLite database is the
source of truth:

```bash
trajectory config features enable zcode_instrumentation
trajectory setup --clients zcode
trajectory session import zcode
```

Setup changes only `~/.zcode/cli/config.json`. It adds hooks for
`SessionStart`, `UserPromptSubmit`, `PostToolUse`, `PostToolUseFailure`, and
`Stop`. Each hook runs the Trajectory binary with
`capture-hook --client zcode --ensure-serve`. Hooks write no records
themselves. Setup leaves out pre-tool and permission hooks, because the
database might not have the matching change yet. The MCP entry carries a
Trajectory marker. Uninstall removes only marked MCP, hook, and skill files.

Trajectory finds the database from these settings:

- `~/.zcode/cli/db`
- `ZCODE_STORAGE_DIR/cli/db`
- `storage.sessionDbPath`
- `ZCODE_SESSION_DB_PATH`
- `ZCODE_SESSION_DB`

It accepts `db.sqlite`, even though the name does not end in `.db`. Changes to
its WAL and SHM files count as changes to the database. Records use
`client_source=zcode` and `source_dialect=zcode_sqlite_v3`.

Trajectory reads the `session`, `message`, and `part` tables for IDs,
content, tools, and parent links. Usage works as follows:

- If a `model_usage` table exists, Trajectory ignores older usage from
  messages.
- Each finished attempt (`completed`, `error`, or `cancelled`) becomes its own
  `llm_call`, with request and retry details.
- Token counts add up into the turn that owns them.
- The table has no USD field. Trajectory computes cost only from its rate
  card, labeled `token_derived:zcode_model_usage`. Unknown models stay
  `unavailable:price_unknown`.

`session.time_updated` shows current activity and never ends a session. Only
`time_archived` marks a session as ended. A deleted session leaves a deletion
record and keeps local history. Use `trajectory session import zcode` to
repair history.

These settings keep the watcher off:

- `TRAJECTORY_DISABLE_ZCODE_WATCHER=1`
- the global client watcher setting
- managed feature policy
- `TRAJECTORY_DISABLE_FEATURES`

## CommandCode

CommandCode support is a preview that is off by default:

```bash
trajectory config features enable commandcode_instrumentation
trajectory setup --clients commandcode
```

Setup makes these changes:

- It merges `SessionStart`, `PreToolUse`, `PostToolUse`, and `Stop` command
  hooks into `~/.commandcode/settings.json`.
- It adds the user MCP entry in `~/.commandcode/mcp.json`.
- It installs incognito skill and command files.
- It installs no launcher wrapper.

Detection uses the `command-code`, `commandcode`, and `cmdc` commands on all
platforms. It ignores the generic `cmd` alias.

The source of truth is `~/.commandcode/projects/<project>/<session>.jsonl` and
the optional `<session>.meta.json` file. Trajectory skips checkpoint, prompt,
share, and file-history files. CommandCode rewrites the whole transcript on
each save. It creates new message IDs and can change headless timestamps.
Trajectory therefore matches records by order, content, and tool call ID.

When CommandCode changes earlier content, Trajectory rebuilds only its own
session JSONL. It never changes CommandCode's files. Hooks make Trajectory
read that transcript sooner. Polling covers plan mode, headless mode, and
missed hooks.

Hooks give the working directory when present. A `Stop` hook marks a turn
boundary. Trajectory does not treat hooks as a sign of interactive mode.
Sessions stay `is_headless=true` and `source_mode=unknown` until a reliable
mode signal exists. CommandCode has no reliable session end and does not save
model, token, or cost data reliably. Trajectory does not invent them. Later
steps may still show text-based estimates, labeled as estimated.

Tests use sanitized fixtures of the current format. Live tests with a
signed-in CLI and the incognito command are still to do.

## gptme

gptme 0.32 support is off by default:

```bash
trajectory config features enable gptme_instrumentation
trajectory setup --clients gptme
```

Setup writes the user config that gptme 0.32 reads,
`~/.config/gptme/config.toml`, on every OS. It installs the
`trajectory_gptme` folder plugin, turns on a `trajectory` MCP server, and
registers `/incognito`. Setup stops before it changes anything if a local or
project config with higher priority would hide the integration.

The plugin sends metadata-only `SessionStart`, `UserPromptSubmit`,
`PreToolUse`, `PostToolUse`, `Stop`, and `SessionEnd` events. They tell
Trajectory to read the session, and they never repeat prompt, assistant, or
tool content. The plugin uses one background sender, so gptme never waits for
capture:

- When 1,024 events are already queued, the hook waits up to one send timeout
  for space. Events stay in order.
- When gptme exits, the sender keeps sending for up to 30 seconds. It stops at
  the first failed send.

The server matches the gptme session ID exactly and reads only that session.
It uses the plugin's end event and never picks the newest session in the same
project. An end notice cannot discard the launch mode that a start notice
reported.

The source of truth is `conversation.jsonl`, `events.jsonl`, and
`config.toml`. Trajectory finds them under `GPTME_LOGS_HOME` or gptme's
current data folders. A change to any of the three files triggers a read.
Event replay recovers partial writes and edit or undo changes. Saved progress
holds only hashes and IDs.

Trajectory keeps gptme's token counts for each message and adds up all model
calls in the user turn. It keeps recorded cost, labeled as computed. It treats
local timestamps with no time zone as unknown. Only an explicit
`--non-interactive` marks a session as headless. When the mode is missing,
privacy features still treat the session as headless or unknown.

Tests install gptme 0.32.0, run `mock/echo`, and check for a plugin
`SessionEnd`. Trajectory does not turn on gptme's optional native OTLP. It
cannot yet remove duplicates across hooks, the session store, and OTLP.

## CodeWhale

CodeWhale 0.9.0 support is a preview that is off by default. It reads saved
files first:

```bash
trajectory config features enable codewhale_instrumentation
trajectory setup --clients codewhale
```

Setup owns only its user-level hook entries, the MCP entry, and the incognito
skill. CodeWhale's `session_start`, `message_submit`, tool, `turn_end`, error,
subagent, and `session_end` hooks only wake the reader. CodeWhale gives hooks
a separate `sess_*` ID instead of the saved session's UUID. Trajectory
therefore never uses hook data as the transcript. The `/incognito` workflow
asks the model to call the `trajectory_incognito` MCP tool. CodeWhale has no
built-in incognito switch.

### CodeWhale files

Saved sessions are schema-v1 JSON files. Trajectory finds them as follows:

- If `CODEWHALE_HOME` is set, it reads `$CODEWHALE_HOME/sessions`.
- Otherwise it reads `~/.codewhale/sessions`. CodeWhale moves missing files
  there from the legacy `~/.deepseek/sessions` folder without overwriting
  current data.
- It treats `checkpoints/latest.json` as the same session in progress.
- It skips `checkpoints/offline_queue.json`.
- `DEEPSEEK_TUI_SESSIONS_DIR` is not a current CodeWhale setting.

The runtime API and task manager also save schema-v2 records. They are in
`$DEEPSEEK_RUNTIME_DIR`, or the `runtime` folder of the selected task root:
`threads/<id>.json`, `turns/<id>.json`, `items/<id>.json`,
`events/<thread>.jsonl`, and `state.json`. Trajectory reads finished records
after a restart. It uses the event file only to wake up sooner.

A runtime thread's optional `session_id` links it to the saved session's
UUID. Linked stores become one CodeWhale session, not two. A thread without a
link keeps its own ID until a link appears.

### CodeWhale usage

Runtime turns keep input, output, cache-hit, cache-miss, reasoning, and
reasoning-replay tokens. They also keep the provider and model, timing,
status, and errors.

Saved messages have no timestamp, model, or usage of their own. Trajectory
gives them an ordering time and marks it synthetic. Saved
`metadata.total_tokens` and cost cover the whole session only. CodeWhale
computes that cost. The provider did not bill it. In headless `exec` runs,
`model_provider` shows the provider you chose. Trajectory still prefers the
runtime record for each turn's provider and model.

`codewhale exec` does not run hooks. A plain one-shot `exec` saves no session
unless it resumes one. `--output-format stream-json` saves a session and
reports input and output tokens at the end. It does not report cache,
reasoning, or cost. Setup installs no wrapper.

Tests run without credentials. They install the published CodeWhale 0.9.0 and
run a real stream-JSON `exec` against a local test server. Task segmentation
skips CodeWhale sessions until a source reports a reliable launch mode.

## ForgeCode

ForgeCode support reads saved history and is off by default:

```bash
trajectory config features enable forgecode_instrumentation
trajectory setup --clients forgecode
```

Trajectory reads `.forge.db` under `FORGE_CONFIG` when set. Otherwise it uses
an existing legacy `~/forge` folder or the current `~/.forge` folder. It opens
SQLite read-only, and changes to the WAL and SHM files count as changes. Each
database and conversation ID becomes one session. Saved progress holds full
content fingerprints, so Trajectory catches rewrites that do not change the
file's size or time.

The conversation context is the source of truth for most data. This
includes messages, raw content, model, reasoning, tool arguments and results,
failure state, usage, provider cost, and child conversation IDs. When the system message has ForgeCode's
`current_working_directory` tag, it sets the working directory. Tool results
that name a child conversation create exact parent and child links. Trajectory
never links sessions by time or workspace.

Messages have an order but no timestamps. Trajectory gives them synthetic
times, starting at `conversation.created_at`, and labels them as such. Exact
token counts use the native token fields. Approximate or mixed counts use the
estimated fields and keep the provider's usage object. Provider cost stays
labeled provider-reported.

History never marks a session active or complete. Trajectory writes no
`session_end` and keeps local history after a deletion. When ForgeCode changes
a conversation, Trajectory rebuilds only its own session JSONL. Sessions
without a launch mode are marked headless, so task segmentation skips them.

Setup writes no launcher shim or shell config. It detects ForgeCode only when
the read-only `forge config path` command prints a path that ends in
`.forge.toml`. This avoids other programs named `forge`. Setup merges only the
`mcpServers.trajectory` entry in `.mcp.json` and writes its skill and command
files.

Incognito needs an exact session ID from `trajectory status --json`. History
never guesses a conversation by recency or workspace. Tests use a sanitized
copy of ForgeCode's schema. Live CLI tests and the incognito command are still
to do.

## Warp/Oz CLI

Warp/Oz support is off by default and reads only local stores:

```bash
trajectory config features enable warp_oz_instrumentation
trajectory setup --clients warp
```

Setup owns only `mcpServers.trajectory` in `~/.warp/.mcp.json` and the
`~/.warp/skills/trajectory-incognito/SKILL.md` file. The capture server
watches the stable, preview, legacy, and TUI folders for changes to
`warp.sqlite` and its `-wal` and `-shm` files. `WARP_DIR` overrides the
folder. Each database and conversation pair becomes one session.

Trajectory reads data as follows:

- It prefers `agent_tasks` rows, decoded with public Warp protobuf commit
  `248f5f62663e`.
- It keeps task and parent task IDs as subagent links.
- If no rich messages decode, it falls back to user prompts in `ai_queries`.
- It never invents assistant text, tool calls, token splits, or cost.
- When any rich row fails to decode, it emits
  `warp.source.protobuf_decode_incomplete` with the schema commit.

Conversation token usage covers the whole conversation. Trajectory keeps it as
source metadata only. It does not publish it as token usage, and it never
mixes it with per-message usage.

No local field records the launch mode or the session end. Sessions are
therefore headless or unknown, and Trajectory writes no session end.
`oz agent run-cloud` is not supported.

## Zed

Zed support is a preview that reads saved history and is off by default:

```bash
trajectory config features enable zed_passive_history
trajectory setup --clients zed
```

Trajectory reads `threads/threads.db` in Zed's data folder, or in `ZED_DIR`
when set. It opens SQLite read-only. Changes to the WAL and SHM files count as
changes. Saved progress holds no Zed content. Polling continues when file
notices are unavailable or missed. A deleted thread leaves a deletion record.

Trajectory reads Zed data as follows:

- It decodes both JSON and zstd row payloads.
- It keeps Zed's `zed:<id>` IDs next to session IDs that are safe as paths,
  `zed-<id>`.
- A non-empty `parent_id` marks a real subagent session. Trajectory keeps the
  parent and emits `relationship=subagent`.
- It recovers prompts, assistant text, thinking, tool calls and results, the
  model, and the first folder path as the working directory.
- `request_token_usage` covers the whole session. Trajectory stores it only
  as `provider_session_usage` metadata on `session_start`. It never assigns it
  to a message or turn.
- Message times come only from database order. They carry
  `provider_timestamp_present=false` and
  `timestamp_provenance=derived_order`. Only row created and updated times
  come from Zed.

Trajectory does not add lifecycle hooks, a launch wrapper, OTel, or a session
end. The database has no reliable interactive or headless signal. Sessions
are therefore marked headless or unknown, and task segmentation skips them.

Setup merges only the `context_servers.trajectory` entry. It installs the
global skill `~/.agents/skills/trajectory-incognito/SKILL.md`. Zed documents
both. Verify and uninstall touch only these items. Tests use fixtures. Live
tests in the Zed app, incognito, and other platforms are still to do.

## Provider watcher recovery

These rules apply to the watchers for gptme, Kimi, and CodeWhale:

- Each watcher records the last point that capture accepted. After a storage
  error, it goes back to that point only when the record still matches.
- New content that capture has not accepted stays pending. This holds even if
  the content was written before the error appeared.
- If saving progress fails, the watcher keeps the accepted data and stops
  taking new work until a retry succeeds.

Each watcher tracks a limited number of sessions. At that limit, it reports
the pressure and keeps reading the sessions it already tracks. New session
files stay in the client's store until space frees up. Trajectory never
treats a session as deleted because discovery stopped early.

## DD Harness

DD Harness is a default-off preview integration, never selected by
`setup --clients all` while its flag is off:

```bash
trajectory config features enable dd_harness_instrumentation
trajectory setup --clients dd-harness
```

It captures sessions, model requests, tools, messages, and session
lifecycle as versioned batch envelopes over loopback HTTP. Model requests
carry token vectors priced through the shared rate card. The
`trajectory session import dd-harness` command (or `trajectory backfill
--from-dd-harness`) imports retained history with merge-by-identity so
re-imports never double-count. Gaps are reported honestly, never guessed.

The DD Harness org-managed user guide holds the integration's operational
details.
## Troubleshooting

Start with:

```bash
trajectory doctor
trajectory config show
trajectory publish status
trajectory doctor logs --grep capture
```

If no data appears, check these items before you look at Datadog publishing:

1. The client's plugin or hooks exist.
2. The capture server answers on the configured port.
3. `trajectory status` shows recent local sessions.

### Confirmed activity evidence

Activity metrics separate accepted subagent launches from launch attempts and
from tool names alone. A Codex spawn-begin record shows intent. Accepted
results provide the launch facts. Pi extensions that report activity use the
versioned format in `plugin/trajectory-pi/README.md`.

Coverage works as follows:

- No extension report means coverage is unknown.
- A `complete` coverage report allows a count of zero.
- Unsupported or incomplete capture does not allow a zero count.

These activity metrics are on by default and need no feature flag.
