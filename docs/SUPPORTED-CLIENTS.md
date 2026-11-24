# Supported Clients

Trajectory records the sessions of coding agents, which this page calls
clients. It captures each client through its hooks, plugins, extensions, or
saved history. The captured events go to the local capture server,
`trajectory serve`. The section for each client gives its setup, what
Trajectory records, and its limits.

`trajectory user-guide clients` prints an overview of the clients on your
computer. `trajectory user-guide clients/<id>`, such as `clients/codex`,
prints the guide for one client.

## Reading This Page

These terms appear in every client section:

- **Saved history**: the session files or database that a client writes to
  disk. `trajectory serve` and `trajectory session import` read it.
- **Watcher**: the part of `trajectory serve` that reads saved history as it
  changes.
- **Wake hook**: a hook that only tells Trajectory to read saved history
  again. It carries no session content.
- **Shim**: a small command that setup puts on `PATH` ahead of the client's
  own command.
- **Headless**: a session with no interactive user, such as a print mode or
  a script.

The client table gives each client one status:

<!-- BEGIN GENERATED TABLE client-statuses -->
| Status | Meaning |
| --- | --- |
| Supported | Trajectory captures the client's sessions while they run, and the integration is complete. |
| Preview | Trajectory captures the client's sessions while they run, but the integration is new or partial, and what it captures can change. |
| History only | Trajectory reads only the sessions that the client saves. The client sends Trajectory nothing while a session runs. |
<!-- END GENERATED TABLE client-statuses -->

It also names how Trajectory captures each client:

<!-- BEGIN GENERATED TABLE client-capture-methods -->
| Capture | Meaning |
| --- | --- |
| Hooks | A hook, plugin, extension, or command shim that setup installs sends Trajectory session events while a session runs, such as its start or end, a turn's end, or a tool call. |
| Watcher | trajectory serve reads the client's saved session files as they change. A hook that only wakes the watcher, and records no event of its own, counts here and not as hooks. |
| OTLP | The client sends its own OpenTelemetry data to Trajectory's local OTLP receiver. |
| History import | Trajectory imports the client's saved sessions on request, at backfill, or after a run ends. |
<!-- END GENERATED TABLE client-capture-methods -->

The version support column names up to three versions:

- **Minimum**: the oldest version that a live replay or a compatibility
  contract covers.
- **Validated**: one version that a check covered.
- **Latest checked**: the newest client release that Trajectory compared for
  changes. It never extends the supported range.

The word in parentheses names the check. A `live-replay` check replays a
session recorded with that pinned version. A `source` check compares
Trajectory with the client's source code. A `fixture` check replays sample
data in that version's format. A `contract` check tests Trajectory against
the client's published hook or file format.

### Clients That Are Off by Default

Some clients are off by default, because their integration is new. The
section for each one starts with the setting that turns it on. Setup changes
nothing for such a client until you turn on its setting. For example:

```bash
trajectory config set clients.zcode.enabled true
trajectory setup --clients zcode
```

A `false` in managed config wins over a `true` in your config.
[Configuration](CONFIGURATION.md) explains
how the config layers combine.

## Client Table

Every client that Trajectory captures publishes metrics, LLM Observability
traces, and security logs. The security logs are the `event_stream` output
that managed config turns on.

<!-- BEGIN GENERATED TABLE clients -->
| Client | Status | Capture | Version support |
| --- | --- | --- | --- |
| Aider | Preview | Hooks, Watcher, History import | Minimum 0.86.2 (live-replay); validated 0.86.2 (live-replay); latest checked 0.86.2 |
| Amp Code | Preview | Hooks, Watcher | No minimum established |
| Antigravity CLI (agy) | Supported | Hooks, Watcher, History import | No minimum established; validated 1.4.7 (fixture) |
| Claude Code | Supported | Hooks, OTLP, History import | Minimum 2.1.152 (contract); validated 2.1.215 (live-replay); latest checked 2.1.215 |
| Claude Desktop (macOS and Windows) | Preview | Watcher, History import | No minimum established |
| Cline CLI | Preview | Hooks | Minimum 3.0.46 (live-replay); validated 3.0.46 (source); latest checked 3.0.46 |
| Codebuff | Preview | Hooks, History import | No minimum established; validated 1.0.684 (source); latest checked 1.0.684 |
| CodeWhale | Preview | Watcher | Minimum 0.9.0 (live-replay); validated 0.9.0 (live-replay); latest checked 0.9.0 |
| Codex CLI | Supported | Hooks, Watcher, History import | Minimum 0.128.0 (contract); validated 0.159.2 (live-replay); latest checked 0.159.2 |
| CommandCode | Preview | Hooks, Watcher | No minimum established; validated 0.44.1 (fixture) |
| Continue CLI | Preview | Hooks, History import | Minimum 1.5.47 (live-replay); validated 1.5.47 (live-replay); latest checked 1.5.47 |
| Cursor Desktop | Supported | Hooks, History import | Minimum 1.0.0 (contract) |
| cursor-agent CLI | Preview | Hooks, Watcher, History import | No minimum established |
| Devin CLI | Preview | Watcher | No minimum established |
| Factory Droid | Preview | Hooks | No minimum established |
| ForgeCode | History only | Watcher | No minimum established; validated 2.13.18 (source); latest checked 2.13.18 |
| GitHub Copilot CLI | Supported | Hooks, Watcher, OTLP, History import | Minimum 1.0.94 (contract); validated 1.0.103 (fixture); latest checked 1.0.105 |
| Goose | Preview | Hooks, Watcher | Minimum 1.43.0 (live-replay); validated 1.43.0 (source); latest checked 1.43.0 |
| gptme | Preview | Hooks, Watcher | Minimum 0.32.0 (live-replay); validated 0.32.1 (source); latest checked 0.32.1 |
| Grok Build | Preview | Hooks, Watcher, History import | No minimum established; validated 0.2.103 (fixture) |
| Hermes Agent | Preview | Hooks, Watcher, History import | Minimum 0.17.0 (live-replay); validated 0.18.2 (source); latest checked 0.18.2 |
| Kilo Code | Preview | Hooks, Watcher, OTLP, History import | Minimum 7.4.11 (live-replay); validated 7.4.11 (live-replay); latest checked 7.4.11 |
| Kimi Code CLI | Preview | Watcher | No minimum established; validated 1.49.0 (source); latest checked 1.49.0 |
| Kiro CLI | Preview | Hooks, Watcher | Minimum 3.0.0 (live-replay); validated 3.0.0 (live-replay) |
| Mistral Vibe | Preview | Hooks, Watcher, History import | Minimum 2.21.0 (contract); validated 2.26.0 (live-replay); latest checked 2.26.0 |
| Muse Code | Preview | Watcher | No minimum established; validated 0.1.0-R708.1 (contract) |
| Oh My Pi (omp) | Preview | Hooks, Watcher, History import | Minimum 17.0.4 (live-replay); validated 17.0.5 (source); latest checked 17.0.5 |
| OpenClaw | History only | Watcher, History import | No minimum established; validated 2026.7.1 (source); latest checked 2026.7.1 |
| OpenCode | Supported | Hooks, Watcher, History import | Minimum 1.18.3 (live-replay); validated 2.2.7 (contract); latest checked 2.2.7 |
| OpenHands | Preview | Hooks, Watcher, History import | Minimum 1.16.0 (live-replay); validated 1.16.0 (live-replay); latest checked 1.16.0 |
| Pi | Supported | Hooks, History import | Minimum 0.80.10 (live-replay); validated 0.80.10 (live-replay); latest checked 0.84.1 |
| Qoder CLI | Preview | Hooks, Watcher | No minimum established; validated 1.0.43 (fixture) |
| Qwen Code | Preview | Hooks, Watcher, History import | Minimum 0.20.0 (live-replay); validated 0.20.0 (source); latest checked 0.20.0 |
| VS Code Copilot Chat | Preview | Watcher, OTLP | No minimum established |
| Windsurf | Preview | Watcher | No minimum established |
| ZCode | Preview | Watcher, History import | No minimum established; validated 0.15.2 (fixture) |
| Zed | History only | Watcher | No minimum established; validated 1.11.3 (source); latest checked 1.11.3 |
<!-- END GENERATED TABLE clients -->

The next table shows what Trajectory records from each client:

- `X`: works on the main path, and tests cover it well.
- `P`: works with a condition. The client's section names it.
- `-`: no way to capture it today.

The columns describe what Trajectory captures. That can be less than what the
client itself does. The incognito column says whether setup gives the client
its own way to turn incognito on.

| Client | Live capture | Backfill | Incognito | Tokens and cost | Skills | Tools | Permissions | Subagents |
|---|---|---|---|---|---|---|---|---|
| Aider | P | P | P | P | - | - | - | - |
| Amp Code | P | P | P | P | P | P | - | - |
| Antigravity CLI (agy) | P | P | P | P | P | P | P | - |
| Claude Code | X | X | X | X | X | X | X | X |
| Claude Desktop (macOS and Windows) | P | X | P | P | P | P | - | P |
| Cline CLI | X | - | P | - | P | P | - | - |
| Codebuff | P | X | P | P | - | - | - | - |
| CodeWhale | P | X | P | P | P | P | - | P |
| Codex CLI | X | X | X | X | X | X | P | P |
| CommandCode | P | P | P | - | P | P | - | - |
| Continue CLI | P | P | P | P | P | P | - | - |
| Cursor Desktop | X | X | P | X | X | X | X | P |
| cursor-agent CLI | P | P | P | P | X | P | P | P |
| Devin CLI | P | P | P | P | P | P | - | - |
| Factory Droid | P | - | P | - | P | P | P | P |
| ForgeCode | - | P | P | P | P | P | - | P |
| GitHub Copilot CLI | X | P | P | P | P | X | P | X |
| Goose | X | P | P | P | P | P | - | - |
| gptme | P | P | X | P | P | P | - | - |
| Grok Build | P | P | P | - | P | P | P | P |
| Hermes Agent | X | P | P | P | P | P | X | P |
| Kilo Code | X | X | P | X | P | X | X | P |
| Kimi Code CLI | P | X | P | P | P | P | - | P |
| Kiro CLI | P | P | P | - | P | P | - | - |
| Mistral Vibe | P | P | P | P | P | P | - | - |
| Muse Code | P | P | P | P | P | P | P | P |
| Oh My Pi (omp) | P | X | P | X | P | P | - | P |
| OpenClaw | - | X | - | P | - | P | - | P |
| OpenCode | X | X | X | X | X | X | X | P |
| OpenHands | X | P | P | P | P | P | - | - |
| Pi | X | X | X | X | P | X | - | - |
| Qoder CLI | P | P | P | P | P | P | - | P |
| Qwen Code | X | X | P | X | P | X | X | P |
| VS Code Copilot Chat | P | P | P | P | P | P | - | P |
| Windsurf | P | P | P | - | - | - | - | - |
| ZCode | P | X | P | P | P | P | - | P |
| Zed | - | P | P | P | P | P | - | P |

### Check Your Client Version

Most clients print their version with `<command> --version`. The command
name can differ from the product. Use `cn` for Continue CLI, `kiro-cli` for
Kiro CLI, `agy` for Antigravity CLI, and `cursor-agent` for the Cursor CLI.
GitHub Copilot CLI uses `copilot version`.

## Shared Setup and History Import

### Set Up a Client

`trajectory setup --clients <list>` installs what each client needs: hooks,
MCP entries, skills, commands, local binaries, and local marketplace
metadata. `--clients all` sets up every client that setup finds.

When you pass only `--clients`, setup changes the client wiring and nothing
else. It skips the Datadog site, service, and API key prompts, and it keeps
your export settings. If you have no config yet, setup creates one that
captures locally.

Setup writes only each client's own plugin, hook, MCP, skill, or marketplace
files. It never edits broad user settings, and it never replaces a file,
entry, or setting that Trajectory did not write. It never edits shell startup
files or `PATH`, except for a marked block that managed setup writes. It may
link a command into a bin folder that is already on your `PATH`.

Setup also writes debugging instructions for agents in the Trajectory home.
It refreshes the files you have not edited, and it registers no global
skills.

Use setup for normal installs. For development or recovery, you can install
a plugin by hand:

1. Install the plugin from a local folder that will stay in place. You need
   no GitHub credentials.
2. Copy the integration config that setup would write.

A plugin-only install can miss MCP tools, skills, incognito controls,
commands, and capture hooks. Run `trajectory setup --clients <client>` to add
them.

### Turn On Saved History

Saved-history sync is off by default for Aider, Antigravity CLI, GitHub
Copilot CLI, cursor-agent CLI, Kiro CLI, Mistral Vibe, OpenClaw, and
OpenHands. Turn it on with the client's `history_sync` setting, then apply
it:

```bash
trajectory config set clients.kiro.history_sync true
trajectory config reload --yes
```

For Aider, Antigravity CLI, Mistral Vibe, OpenClaw, and OpenHands, the
setting also allows `trajectory session import`. GitHub Copilot CLI has a
separate `clients.copilot.history_import` setting for its import. Kiro CLI
has no import, so its watcher is its only saved-history path.

For Hermes Agent, Amp Code, OpenCode, Kilo Code, and Qwen Code, history sync
always runs while the integration is installed. `trajectory uninstrument
<client>` stops it, and `trajectory setup --clients <client>` starts it again.

### Command Shims

Aider, Continue CLI, Codebuff, and Mistral Vibe need a command shim for live
capture. Shims are opt-in. Interactive setup asks, and a scripted setup needs
`--install-client-shims`. For Claude Code, Codex CLI, and GitHub Copilot CLI,
a shim is an optional launcher.

Setup puts each shim in `~/.trajectory/bin`, which must be on your `PATH`.
It may also link the shim into a bin folder that is already on your `PATH`.
Each shim records the real command in
`~/.trajectory/state/<client>/wrapper.json`. Setup saves your choice in
`~/.trajectory/state/setup-install-record.json`.

`--no-client-shims` keeps the shims you have and adds no new ones.
`trajectory uninstrument <client>` removes them.

Setup also writes incognito commands to `~/.trajectory/bin` for Cursor,
Goose, OpenHands, Cline CLI, Amp Code, Kiro CLI, Grok Build, and the shim
clients.

### How Saved History Fills Gaps

Some clients save their sessions on disk. Trajectory reads these files to
fill gaps that live capture missed. It only reads them and never changes
them.

- When a hook, shim, or plugin event and saved history describe the same
  event, the live event wins.
- A session deleted from saved history stays in Trajectory with a deletion
  record. Trajectory never marks it ended.
- Saved activity times, such as Vibe `end_time`, Grok snapshot times, and
  ZCode `time_updated`, mark activity, not a session end.
- Some saved-history imports leave out token and cost attribution, but keep
  the base metrics.
- If neither hooks nor saved history show a run mode, the session counts as
  headless. Goose and OpenHands hooks report no run mode, and neither do many
  sessions known only from saved history.
- The gptme, Kimi Code CLI, and CodeWhale watchers track a limited number of
  sessions. At the limit they report pressure, and new files wait.

### Import Past Sessions

`trajectory session import <client>` reads a client's saved history on
request:

- `--session <id>` imports one session.
- `--force` imports sessions again that Trajectory already has.
- The `cursor`, `pi`, `omp`, and `codebuff` imports accept neither
  `--session` nor `--force`. They take a date window instead.
- `--since YYYY-MM-DD` imports the sessions that were active on or after that
  date, in full.
- `--until YYYY-MM-DD` skips the sessions that started on or after that date.

Antigravity CLI rejects `--since` and `--until`, because its saved times come
from its files.

Some clients have no import of their full history. They use live hooks, a
sync of active sessions, or a saved-history watcher instead. Each client's
section says which.

### Check the Setup

To check a client, run `trajectory setup --clients <client>`, then
`trajectory doctor`. Some clients have their own check:

- Claude Code: `claude plugin list`
- Codex CLI: `codex mcp list`
- Hermes Agent: `trajectory session import hermes`

`trajectory doctor` and the setup inventory report each client's
registration method and plugin state: `enabled`, `disabled`,
`not_installed`, or `unknown`, with the source of that state.

`trajectory setup refresh --json` rescans your clients and writes the
inventory to `~/.trajectory/inventory/`. `trajectory setup status --json`
reads the inventory without a scan. `trajectory setup status list --json`
lists the saved snapshots.

### What Every Client Shares

- Trajectory ignores, with success, a hook payload that clearly comes from
  another client. So clients that share hook files never record each other's
  sessions.
- A client keeps working if a Trajectory hook fails.
- The Claude Code, GitHub Copilot CLI, and cursor-agent launchers repair
  `trajectory serve` in the background. A problem reduces telemetry, but never
  stops the client from starting.
- Two processes that run one session at the same time can merge turns and
  lose usage. This applies to Claude Code, GitHub Copilot CLI, Cline CLI,
  Goose, OpenHands, Kiro CLI, and Qwen Code.
- Removing an integration deletes only Trajectory's files and entries. Your
  other settings, extensions, and MCP servers stay.

Setup registers the Trajectory MCP server with most clients. It offers
`trajectory_status`, `get_session_trajectory`, `trajectory_incognito`,
`trajectory_schema`, `trajectory_query`, and `trajectory_search`. Agents call
`trajectory_schema` before `trajectory_query`. Each client's section names
its incognito control.
[Privacy](PRIVACY.md) explains what
incognito does.

## Cross-Client Resume

`trajectory session resume --session <id> --target <client>` continues a
captured session in another client. `--dry-run` shows what it would write.
`--list-targets` shows whether each target is `target-native` or `view-only`.

Rows are the source client, and columns are the target:

- `X`: the printed command opens the session in the target.
- `P`: Cursor can only show the session.

| Source \ Target | Claude Code | Codex CLI | Cursor | OpenCode | Pi |
|---|---|---|---|---|---|
| Claude Code | - | X | P | X | X |
| Codex CLI | X | - | P | X | X |
| Cursor | X | X | - | X | X |
| OpenCode | X | X | P | - | X |
| Pi | X | X | P | X | - |

The table covers the clients that resume supports today.

- Resume keeps the conversation but leaves out the source model and
  context-window settings. The target chooses the model and runs any
  compaction.
- Claude Code and Codex keep their UUID session IDs. Other clients get a
  stable alias, which the printed command selects.
- For a Claude Code rewind, resume follows only the `leafUuid` ancestry. It
  does not copy abandoned branches.
- Codex child rollouts keep the copied parent messages as resume context
  only. The child's totals count only its own turns.
- OpenCode fork copies stay out of resume and usage. Messages that
  `session.revert` abandoned stay out of resume, but their usage still counts.
  Telemetry keeps the turns that ran.

## Aider

Trajectory captures Aider through an opt-in command shim:

```bash
trajectory setup --clients aider --install-client-shims
```

The `aider` shim runs `trajectory aider --real <path> -- ...`. It adds
`--analytics-log` and history file flags, and `--no-analytics` unless you set
analytics yourself.

- **Records**: each `# aider chat started at` launch becomes a session.
  Trajectory records prompts, assistant Markdown, models, blockquoted
  output, turns, and the session end.
- **No tools**: Aider has no stable tool interface, so Trajectory records no
  file edits or tool calls.
- **Tokens and cost**: usage for each call comes from the model provider or
  Aider's local count. A local count of 1,000 or more is rounded and marked
  estimated. Cost is the figure that Aider prints, never a bill.
- **Saved history**: turn on `clients.aider.history_sync`. Then
  `trajectory serve` syncs the history files you name, and
  `trajectory session import aider` imports or repairs them.
- **History files**: sync reads only `.aider.chat.history.md` files that
  `AIDER_CHAT_HISTORY_FILE`, an `AIDER_DIR` root, or
  `TRAJECTORY_AIDER_HISTORY_DIRS` names.
- **History limits**: the files have no session IDs, message times, or end
  markers. Trajectory derives the times, and these sessions stay open.
  `--since` keeps runs that never ended.
- **Incognito**: run the setup-managed `aider-incognito` command. There is no
  MCP incognito tool.

## Amp Code

```bash
trajectory setup --clients amp
```

Setup writes a plugin to `~/.config/amp/plugins/trajectory.ts`, or under
`$AMP_CONFIG_DIR`. It adds `amp.mcpServers.trajectory` to
`~/.config/amp/settings.json`.

- **Records**: the plugin uses the current Amp plugin API to send session,
  agent, and tool events. Its `tool.call` handler returns allow, so Amp never
  blocks.
- **Live limits**: live events carry no model, tokens, cost, duration, or
  session end. So the final task never closes.
- **Saved history**: Trajectory reads the top-level `T-*.json` threads in
  `~/.local/share/amp/threads` or `$XDG_DATA_HOME/amp/threads`, read-only.
  They add the model and the usage of each message. Plugin traces win.
- **Changes**: a changed thread is rebuilt. A deleted thread keeps its trace
  and gets a deletion record. Trajectory marks no thread active or ended.
- **Import**: there is none. The thread sync covers saved history.
- **Tokens and cost**: usage comes only from saved history, in
  `messages[].usage` or the older `usageLedger`. Amp credits stay separate
  and are never converted to USD.
- **Incognito**: run the setup-managed `amp-incognito` command, or ask the
  agent to use the MCP incognito tool.

## Antigravity CLI (agy)

Trajectory supports Antigravity CLI on macOS and Linux, not on Windows.

```bash
trajectory setup --clients agy
```

Setup stages a plugin with hooks, an incognito skill, and a command in
`~/.gemini/config/plugins/trajectory/`. It registers MCP in
`~/.gemini/antigravity-cli/settings.json`.

### Hooks

Command hooks run on `PreToolUse`, `PostToolUse`, `PreInvocation`,
`PostInvocation`, and `Stop`. Each one answers first and ends in `|| true`,
so it never affects agy.

- **Records**: hooks give prompts, tool calls, errors, and `Stop` metadata.
  They give no assistant text, provider model, tokens, cost, or session end.
- **IDs**: `conversationId` is the session ID. A turn's prompt comes from its
  first `PreInvocation`, and `stepIdx` links tool calls to results.
- **Tool output**: Trajectory reads it from the transcript in
  `~/.gemini/antigravity-cli/brain/`, up to 1 MiB per hook. An unreadable or
  changed transcript gives none.
- **Model**: agy's `modelName` is a selector such as `auto`. Trajectory keeps
  it as `model_label`, and never uses it as the provider model or for cost.
- **Tokens and cost**: live sessions get tokens for each request: the model,
  uncached input, output with reasoning, and cache tokens. Trajectory prices
  them at public Gemini rates, which are never a bill.
- **Session end**: agy's `Stop` ends one loop, not the conversation. agy
  sends no session end, and its updates can change hook data.
- **Subagents**: agy runs subagents as separate sessions with empty prompts.
  Hooks carry no child or lifecycle ID. So Trajectory records no prompt for
  them and infers no parent.

### Saved History

The history watcher is off by default. Turn on `clients.agy.history_sync`,
then run `trajectory config reload --yes`.

- **Reads**: it reads `history.jsonl` and `conversations/<uuid>.db`,
  read-only. It takes only the ID, display text, timestamp, and workspace
  from `history.jsonl`. It takes only the usage block from each database.
- **Never reads**: private step transcripts. So it adds no assistant or
  thinking text, tool payloads, or turn or session ends.
- **Adds**: schema-v1 generation models, with file times marked synthetic.
  It also adds prompts that you typed before the hooks recorded one.
- **Start**: on its first start it records the existing rows as a baseline.
  Later rows sync, including rows written while `trajectory serve` was
  stopped.
- **Rules**: sync keeps hook events and incognito, and refuses other clients'
  sessions. It skips slash commands, never deletes history, and never
  invents an end.
- **Metrics**: rows from the watcher or an import never count toward
  metrics, live success, or new turns.

With the setting on, `trajectory session import antigravity [--session <id>]`
imports history from before the watcher started. `--force` refreshes known
sessions and keeps the prompts that hooks recorded.

`ANTIGRAVITY_CLI_DIR` points Trajectory at another Antigravity CLI folder.
Antigravity itself ignores it.

### Incognito and Troubleshooting

Setup installs an `/incognito` command and an incognito skill. The MCP
incognito tool also works.

In a checkout of this repository, `agy plugin validate
plugin/trajectory-antigravity` should report `hooks: 1 processed`.
`skipped (not found)` means an old plugin layout. Run setup again.

`trajectory doctor` warns when the newest Antigravity line in
`~/.trajectory/logs/capture-hook.log` has `delivery_result=hook_failed`. A
newer clean line clears the warning.

## Claude Code

Claude Code needs version 2.1.152 or later. Earlier versions reject
Trajectory's hooks file, because it registers `MessageDisplay`, so no hooks
load.

```bash
trajectory setup --clients cc
```

### Plugin

Setup installs the `trajectory@trajectory` plugin from
`~/.trajectory/claude-marketplace` at user scope. It also installs at managed
scope if that is on, and never at project or local scope.

- **Settings**: setup runs Claude's plugin manager to install the plugin.
  Trajectory never adds, merges, or deletes Claude settings itself. Other
  tools' OTel keys stay.
- **Restore**: if the plugin manager removes one of your settings, setup
  restores that file and fails. If it only changes a value, setup keeps the
  change and warns.
- **Updates**: setup, updates, and MCP startup replace stale plugin copies
  without starting Claude. Claude caches plugins by version. A running
  session keeps its version until `/reload-plugins` or a new session.
- **MCP**: setup never runs `claude mcp add`. If you have your own
  `mcpServers.trajectory` entry, it stays, and the plugin leaves out its MCP
  entry.
- **Allowed variables**: if you set `httpHookAllowedEnvVars`, list
  `TRAJECTORY_HOME` in it. Otherwise the Trajectory home header stays empty.
- **Ports**: hooks you add by hand use the default capture port. A custom
  port needs `trajectory setup`. `trajectory doctor` warns if both are set.

Admins can roll out the plugin through Claude managed settings. Set
`extraKnownMarketplaces.trajectory` to the staged folder with
`autoUpdate: true`, and enable `trajectory@trajectory`. If managed policy
disables the plugin or blocks marketplaces, Trajectory reports it as
disabled. Automatic setup skips Claude Code when `CLAUDE_CONFIG_DIR` moves
its config.

### Hooks

The plugin registers 17 hooks. They cover `SessionStart`,
`UserPromptSubmit`, `MessageDisplay`, tool, `Stop`, compaction, permission,
elicitation, subagent, and `SessionEnd` events.

- **Delivery**: on macOS and Linux, tool and `MessageDisplay` hooks post over
  loopback HTTP. Command hooks exit 0. For most events, a command hook's one
  POST to the capture server waits at most 250 ms, then a background worker
  takes over. If the worker cannot start, the hook delivers in the foreground
  and can take longer.
- **Windows**: command hooks run `hooks/capture-with-serve.sh`, which calls
  `trajectory capture-hook`. Check both when an event is missing.
- **Size limits**: a hook body over 2 MiB is refused, but the client is not
  blocked. `PostToolUse` accepts up to 64 MiB and stores a copy cut to
  340 KiB.
- **Clear**: a successful `/clear` publishes the session and starts a new
  one with a stable ID. The text `/clear` and a compaction do not.
- **Elicitation**: these hooks record only IDs, the MCP server, the action,
  and timestamps. They never record prompts, schemas, answers, or URLs. They
  count as user input.
- **Permissions**: `PermissionDenied` records auto-mode denials. Manual
  decisions match later events. Transcript repair fixes content, but never
  invents permission requests.
- **Decision scope**: native timing records the scope once for
  `user_temporary` decisions and always for `user_permanent` ones. Other
  decision sources pass through.

### Transcripts

Transcript backfill repairs live events. It fills in missing content and
session-end data.

- **Location**: transcripts come from `$CLAUDE_CONFIG_DIR/projects` or
  `~/.claude/projects`. A hook's `transcript_path` wins.
  `CLAUDE_PROJECTS_DIR` and XDG folders are not supported.
- **Config folder**: with `CLAUDE_CONFIG_DIR` set, imports and token repair
  read `$CLAUDE_CONFIG_DIR/projects` and never `~/.claude/projects`.
- **Print mode**: `claude --print` sessions have no `transcript_path`, so
  they count as headless.

### Launcher

`trajectory claude [-- args]` starts Claude Code with its native OTLP sent to
the local capture server. It records full API bodies. Claude settings can
also send OTLP. `trajectory claude` ignores telemetry keys in a project's
`.claude/settings*.json`, and doctor warns about them. Set them in user or
managed settings.

### Remove and Troubleshoot

- `trajectory uninstrument cc` keeps the plugin registration and local
  marketplace, but points them at an empty plugin. So plugin updates keep
  working.
- Uninstall runs `claude plugin uninstall trajectory@trajectory --scope user`.
  It prunes cached versions and stubs old hooks. Without the `claude`
  command, the empty plugin stays.
- If you remove the plugin or marketplace in Claude, Trajectory stays
  installed. `trajectory setup --clients cc` restores it, and doctor flags a
  missing marketplace.
- Command hooks log to `~/.trajectory/logs/capture-hook-start.log`. A
  `result=` of `missing_script`, `missing_binary`, or `missing_entry` means
  nothing was captured. `trajectory doctor` checks the last 24 hours.

For incognito, use the plugin's `/trajectory:incognito` command or skill. The
MCP incognito tool also works.

## Claude Desktop (macOS and Windows)

Capture is always on for macOS and Windows. On macOS, Trajectory detects
Claude.app or `~/Library/Application Support/Claude`. On Windows, it detects
`%APPDATA%\Claude`. `trajectory setup --clients claude-desktop` writes
nothing.

- **Tabs**: the Cowork tab captures as `client_source=claude-desktop`, live
  and in backfill. The Code tab captures as `claude-code` through
  `~/.claude/projects`. The Chat tab is not captured.
- **Files**: Cowork sessions come from `audit.jsonl` files under
  `{Claude,Claude-3p}/local-agent-mode-sessions/`. That folder is in
  `~/Library/Application Support` on macOS and in `%APPDATA%` on Windows.
  `Claude-3p` holds third-party inference profiles.
- **Windows**: Windows sessions have no `app_version`. The Windows folders
  follow Electron's default app data path and have not been checked against a
  real Windows install yet.
- **Publishing**: Cowork sessions publish like CLI sessions. They get Claude
  Code redaction and incognito, plus the project, working directory, Git
  branch, and model.
- **Cost**: `session_cost_usd` prices each turn's tokens from the rate card.
  The cost that Claude reports is kept as `claude_reported_cost_usd`, for
  comparison only.
- **Session end**: a Cowork session ends after one idle hour. To change that,
  set `TRAJECTORY_CLAUDE_DESKTOP_QUIESCENCE` to a Go duration such as `5m`.
- **Resumed sessions**: a resumed older session is captured when the
  watcher's rotation reaches it. With 2,560 sessions, that takes about 20
  checks.
- **No OTLP or MCP**: Trajectory adds neither to Claude Desktop. An app
  started from Finder ignores shell `OTEL_*` variables.

## Cline CLI

```bash
trajectory setup --clients cline
```

Setup writes hook scripts in `~/.cline/hooks`, or `$CLINE_DIR/hooks`, and MCP
settings. `CLINE_HOOKS_DIR` overrides the hook folder. It keeps your own hook files by using another name, such as
`TaskStart.bash`.

- **Hooks**: `TaskStart`, `TaskResume`, `UserPromptSubmit`, `PreToolUse`,
  `PostToolUse`, `TaskComplete`, `TaskCancel`, `TaskError`, and
  `SessionShutdown`. They never block Cline.
- **Tokens and cost**: hooks carry no token or cost usage, so
  `turn_end.tokens_status` is `unavailable`.
- **History**: there is no backfill yet.
- **Incognito**: run the setup-managed `cline-incognito` command, or ask for
  the MCP incognito tool.

## Codebuff

```bash
trajectory setup --clients codebuff --install-client-shims
```

Setup also accepts `cb` and `codebuff-ai` as names for Codebuff.

- **Records**: the shims record the session start, prompts, messages,
  `llm_call` events, and the turn end. They record no tool events.
- **Session end**: only the shim records one, from the exit code. Backfill
  never guesses one.
- **Tokens**: they come from each project's `chat-messages.json` under
  `~/.config/manicode`, `manicode-dev`, or `manicode-staging`. History must
  hold provider usage, such as `metadata.usage`, `metadata.codebuff.usage`,
  or `runState`. `CODEBUFF_DATA_DIR` replaces that folder list.
- **Import**: `trajectory session import codebuff` imports chat history. The
  imported sessions stay open, and their end state is unavailable, never
  assumed successful.
- **Incognito**: run `codebuff-incognito` or `cb-incognito`. There is no MCP
  incognito tool.

## CodeWhale

CodeWhale is off by default:

```bash
trajectory config set clients.codewhale.enabled true
trajectory setup --clients codewhale
```

Setup adds only wake hooks, MCP, and incognito. Saved sessions and runtime
threads give prompts, thinking, tools, the model, and forks.

- **Sessions**: they come from `$CODEWHALE_HOME/sessions` or
  `~/.codewhale/sessions`. `checkpoints/latest.json` holds the session in
  progress. Trajectory ignores `offline_queue.json` and
  `DEEPSEEK_TUI_SESSIONS_DIR`.
- **Runtime stores**: after a restart, sync also reads the runtime stores in
  `$DEEPSEEK_RUNTIME_DIR` or the task runtime folder. It merges linked IDs.
  There is no history import.
- **Tokens and cost**: Trajectory records input, output, cache, reasoning,
  and replay tokens for each runtime turn. Saved totals and the cost that
  CodeWhale computes stay at the session level.
- **Exec**: `codewhale exec` runs no hooks. A one-shot exec saves no session
  unless it resumes one. Stream-JSON saves only input and output tokens.
- **Incognito**: CodeWhale has no native switch. `/incognito` is a skill
  prompt that calls `trajectory_incognito`. To turn it off, it shows a
  terminal command.

## Codex CLI

Use Codex 0.128.0 or later. It is the first version that runs
plugin-bundled hooks end to end.

```bash
trajectory setup --clients codex
```

### Setup

Setup registers `~/.trajectory/codex-marketplace`, which holds the hooks,
MCP, and `/incognito`. It also installs a stable hook helper,
`~/.trajectory/bin/codex-hook`. Do not register the GitHub marketplace.
Codex refreshes Git marketplaces at startup, which slows its first screen.

- **Finding Codex**: setup looks on `PATH`, in user folders, and in Volta,
  nvm, fnm, npm, pnpm, yarn, asdf, and mise. It prefers npm's native binary
  when `codex --version` passes.
- **Not found**: if every candidate fails with `ENOENT`, reinstall Codex or
  use the standalone or Homebrew build. Then run setup again.
- **Trust**: setup has Codex trust the 11 hook handler hashes, and checks
  them. Only setup, reconciliation, and doctor rewrite trust. Codex still
  asks you to trust a workspace.
- **Hook modes**: when the capture server supports it, Trajectory turns on
  the session, prompt, `Stop`, and Bash-only Git snapshot hooks. Full-hook
  mode turns on all 11.
- **Time limit**: Codex gives each hook 3 seconds. The helper stops at 2.3
  seconds and hands slow work to a detached process.
- **Updates**: setup-written hooks already pass the current capture mode, so
  no reload is needed. Updates and repairs keep trusted hook commands as
  they are. A running Codex keeps its hooks, and repairs reach new sessions.
- **Repair**: if asset repair fails, a fallback runs the full binary. Run
  setup again so Codex can approve the changed hook.

### Rollouts

Rollout JSONL in `$CODEX_HOME/sessions/`, normally `~/.codex/sessions/`,
supplies messages, tools, reasoning, permissions, compaction, subagents,
usage, and `shutdown_complete`. `trajectory serve` merges the hooks and
rollouts into session JSONL under `~/.trajectory/trajectories/`.

- **Session end**: some Codex versions leave `SessionEnd` out of hook
  discovery. The rollout's `shutdown_complete` ends those sessions.
- **Watcher**: it tails rollouts for sessions the hooks missed, in every
  project. `TRAJECTORY_PROJECT_ROOT` does not limit it.
- **Homes**: the watcher follows every `CODEX_HOME` that setup ran under. A
  home that setup never saw stays invisible. Backfill reads the active home.
- **Folders**: `CODEX_HOME` moves both session folders. `CODEX_SESSIONS_DIR`
  names one rollout folder, which Trajectory then reads alone.
- **Reopened sessions**: an idle session reopens on newer rollout records.
  Usage found later for an open turn adds a `turn_token_correction`.
- **Ephemeral runs**: `codex exec --ephemeral` writes no rollout. So it has
  no tool, permission, compaction, or subagent detail.

`trajectory session import codex [--limit 100]` imports rollouts, newest
first, from `$CODEX_HOME/sessions` and `archived_sessions`. It prefers the
active copy. Archived rollouts count only as past sessions, because the
watcher reads `sessions/` only. Linked rollouts are ignored, and duplicates
match on `session_meta.id`.

Codex startup repair, when it is on, handles at most 100 sessions per pass.
It continues on the next pass.

### Codex Desktop

Codex Desktop (Codex.app) writes the same `~/.codex/sessions/` and runs the
same hooks. So Trajectory captures its sessions like CLI ones. Both use
`client_source=codex`. `entrypoint` on spans and `client_surface` on metrics
say `desktop`, `cli`, `ide`, or `exec`.

### What Trajectory Records

- **Subagents**: a successful `spawn_agent` output with a stable call ID
  counts as one subagent, even when it names only the task. An output with an
  `agent_id` also links the child's traces. Failed launches do not count.
- **Turn outcome**: a turn that ends on a provider error gets
  `turn_outcome:error`. An interrupted turn gets `aborted`. A recovered
  stream error leaves no outcome.
- **Approvals**: native approvals map `approved` to once and
  `approved_for_session` to session. Amendment and network-policy approvals
  map to always.
- **Tokens**: a missing, null, negative, or fractional token count is
  unavailable. An explicit zero is kept. Uncached input needs both the input
  and cached counts.
- **Cache writes**: Codex records no cache-write lifetime, so cache writes
  use the 30-minute rate.

`trajectory codex` keeps your Codex sign-in, proxies model calls locally, and
records each Responses API exchange. Sessions resume with or without it.

For incognito, the marketplace plugin's `/incognito` skill calls
`trajectory_incognito`, with a bundled script fallback. The MCP tool also
works.

### Troubleshooting

- **Slow start or exit**: read the MCP timing in `trajectory doctor`. Then
  run `trajectory doctor startup codex`.
- **Repeated start**: `trajectory.instrumentation.capture.gap` with
  `client_source:codex`, `signal:jsonl`, and `reason:duplicate_event` means a
  rollout repeated `session_start`.
- **Changed ID**: `codex.session_id_change_ignored` means a replayed rollout
  tried to change `session_id`. The original child ID stays.
- **Duplicate spans**: the error `incompatible duplicate span identity` means
  two batch spans shared a trace ID and span ID with different content. That
  export stopped.

## CommandCode

CommandCode is off by default:

```bash
trajectory config set clients.commandcode.enabled true
trajectory setup --clients commandcode
```

Trajectory detects `command-code`, `commandcode`, or `cmdc`. Setup adds wake
hooks to `~/.commandcode/settings.json` and an MCP entry to
`~/.commandcode/mcp.json`. It also adds an incognito skill and command, and
no shim.

- **Sessions**: Trajectory reads
  `~/.commandcode/projects/<project>/<session>.jsonl` and its `.meta.json`,
  read-only, in passes of limited size. It skips checkpoint, prompt, share,
  and file-history files.
- **Scans**: hooks trigger scans and supply the working directory. Polling
  catches what they miss. There is no history import.
- **Records**: prompts, reasoning, tools, and `Stop` turns. Sessions stay
  headless or unknown, with no session end.
- **Tokens and cost**: CommandCode saves no reliable model, tokens, or cost,
  so Trajectory infers none. Estimates from text stay labeled as estimated.
- **Incognito**: Trajectory's own `/incognito` command and skill need the
  session ID. Turn incognito off by hand, because CommandCode sends no
  session end. The MCP tool also works.

## Continue CLI

```bash
trajectory setup --clients continue --install-client-shims
```

The `cn` shim runs `trajectory continue --real <path> -- ...` and passes your
arguments unchanged. It sets `CONTINUE_CLI_TEST_SESSION_ID` for new sessions.
`wrapper.json` points to the real `cn` from `@continuedev/cli`.

- **Records**: after `cn` exits, Trajectory reads
  `$CONTINUE_GLOBAL_DIR/sessions` or `~/.continue/sessions`. It records
  prompts, messages, tools, turns, and usage.
- **Current run only**: it captures what the current run added, with no bulk
  import of history. It reads at most 4,096 session files and 64 MiB.
- **Tokens**: usage comes from the session JSON. One prompt's steps form one
  turn. Request usage stays with each request, and session usage arrives on
  `SessionEnd`.
- **Hooks**: Continue 1.5.47 does not call its Claude-compatible hooks from
  chat. The shim ignores them to avoid double capture.
- **Resume and fork**: with `--resume`, Trajectory records the session that
  Continue selects. `--fork <id>` needs one new child and a clean start.
  Trajectory skips unclear cases.
- **In-session switches**: a `/resume` picker switch keeps only the original
  session. For `/fork`, exit and run the printed `cn --fork <id>` on its own.
- **Incognito**: run the setup-managed `continue-incognito` command. There is
  no MCP incognito tool.

## Cursor Desktop

Cursor Desktop and cursor-agent CLI are separate products with separate
capture paths.

```bash
trajectory setup --clients cursor
```

Setup manages `~/.cursor/hooks.json` and `~/.cursor/mcp.json`. It adds its
own incognito skill only when Trajectory's Claude Code plugin has none to
share. So after `trajectory uninstrument cc`, Cursor gets its own skill back.
18 Agent command hooks run `capture-hook --client cursor`. They print `{}`
with no permission decision. Tab and workspace hooks are skipped.

Cursor cloud agents ignore the user-level hooks that Desktop setup writes.
They need managed or project-level setup.

- **Tokens**: complete Cursor generations publish input, output,
  cache-read, and cache-write tokens. Cache tokens are taken out of
  `input_tokens`. Incomplete sets publish none.
- **Unpriced**: partial, invalid, conflicting, unknown-model, or watcher-only
  generations stay unpriced. `state.vscdb` and length estimates never price
  them or fill in counts.
- **Rates**: a turn's rate is fixed when its prompt starts. If the final
  token counts disagree, Trajectory records no tokens or cost for the turn.
- **Rate cards**: a custom rate card replaces `pricing.yaml` for Cursor.
  Models it does not cover, and fast models without a multiplier, stay
  unpriced. Long-context models get the standard rate as a floor.
- **Subagent usage**: it needs a known child model with complete usage, a
  known cost, or a complete child session.
- **Side chats**: Cursor 3.11 side chats are told apart from background
  subagents. A side chat gets its `parentComposerId` chat as parent, leaves
  out copied seed turns, and parents its own children.
- **Timing**: active transcripts are checked each minute, and new paths
  every 30 seconds. So events can wait for both.
- **Import times**: agent transcripts have no times, so imports use each
  file's write time. `store.db` chats and older logs carry their own times.
- **Incognito**: `/incognito` uses the Claude plugin skill, or else
  `~/.cursor/skills/incognito/SKILL.md`. Setup also adds
  `cursor-agent-incognito`. The MCP tool also works.

## cursor-agent CLI

Install the CLI with `curl -fsSL https://cursor.com/install | bash`.
`cursor-agent --print` runs headless.

cursor-agent uses Cursor Desktop's command hooks when it runs them. So
`trajectory setup --clients cursor` covers it. The final hooks carry the
model, the generation, and four token counts. Hook sessions and
saved-history sessions get the same session ID.

### Saved History

History sync is off by default. Turn on `clients.cursor.history_sync`, then
run `trajectory config reload --yes`. Reload starts or stops the watcher
without restarting `trajectory serve`. It syncs in passes.

- **Reads**: `~/.cursor/projects/*/agent-transcripts/<session>/<session>.jsonl`,
  `subagents/<child>.jsonl`, sibling Task transcripts, and older flat files.
  Older plain-text transcripts are not supported.
- **Rebuilds**: on a file change, only the records the watcher wrote are
  rebuilt. Hook traces stay. A tool end needs a real `tool_result`.
- **Limits**: saved records have no timestamps, model, tokens, cost, tool
  results, or session end. Trajectory derives times from their order and
  leaves the sessions unpriced. It invents nothing.
- **Shared files**: Desktop and the CLI share saved files that do not name
  the product. So the run mode is unknown, and hook events win.
- **Off**: when a setting, policy, environment variable, or watcher control
  turns capture off, Trajectory creates no state. An enabled watcher waits
  for the folder to exist.

### Subagents and Tokens

- **Task launches**: they get subagent events only when child transcripts
  match. An unmatched launch gets a diagnostic, not an invented child.
- **Order**: a foreground Task starts and stops in its launch turn. A
  background Task starts at launch and stops in its result turn. Desktop
  events win.
- **Child hooks**: a child tool hook that names a parent opens its own
  session when Cursor sends no `sessionStart`. Trajectory invents no turns,
  tokens, or USD.
- **Late usage**: a subagent stop without usage is amended at most once,
  when the child ends with complete usage.
- **Tokens**: `input_tokens` includes cache. Trajectory publishes four counts
  and prices USD only with an effective rate card for the exact model.
- **Unpriced**: counts that cannot add up, and plain `--print` runs, stay
  unpriced. Parent usage is never copied to child tasks.

`trajectory cursor-agent --print` can attach `cursor_print_result` from
standard output. It skips print JSON that is ambiguous.

For incognito, run `cursor-agent-incognito` when the Cursor integration is
installed. The watcher has no slash command, and there is no MCP tool.

## Devin CLI

Devin CLI is off by default:

```bash
trajectory config set clients.devin.enabled true
trajectory setup --clients devin
```

Setup adds only Trajectory entries to `~/.config/devin/config.json`, or
`%APPDATA%/devin` on Windows. These are wake hooks, `mcpServers.trajectory`,
and a global incognito skill. Uninstall removes only those.

Devin reads Claude hook settings by default, and you should keep that.
Trajectory ignores or reassigns hooks under `DEVIN_PROJECT_DIR` to avoid
duplicates.

- **Reader**: Devin hooks carry no stable session ID, so they only wake the
  reader. It reads `sessions.db` and `transcripts/<session-id>.json`.
- **Folders**: `~/Library/Application Support/devin/cli`,
  `~/.local/share/devin/cli`, or `%APPDATA%\devin\cli`.
- **Sources**: Trajectory prefers the transcript JSON and falls back to the
  chat messages in `sessions.db`. It never assigns a hook to the newest
  session.
- **Records**: prompts, assistant and thinking text, tool calls and results,
  and the model. Sessions count as headless or unknown.
- **Tokens**: prompt, completion, and cache tokens for each step. Trajectory
  reads the final session total but does not record it.
- **Sync**: there is no bulk import. Only active and changed sessions sync.
- **Session end**: a session ends only when Devin moves it to a finalized
  transcript. Delivery IDs prevent duplicates. A session that crosses
  midnight keeps one file.
- **Rewrites**: when Devin rewrites a session, its JSONL and local UI copy
  are rebuilt without duplicates or double-counted tokens and cost.
  Published rows cannot be retracted when Devin later removes them.
- **Redaction**: titles, prompts, assistant and thinking text, and tool input
  and output are redacted before Trajectory writes JSONL or recovery data.
- **Incognito**: use the global `/incognito` skill or the MCP tool. The
  choice is saved in `state/provider-incognito-<session>`. Later sync of that
  session stays private until Devin confirms the session ended. Otherwise it
  stays private for good.

## Factory Droid

```bash
trajectory setup --clients droid
```

Setup installs `trajectory@trajectory` from
`~/.trajectory/factory-marketplace` at user scope, with hooks, `mcp.json`,
and an incognito skill. Run setup again to repair it. The plugin follows
Factory's public plugin hook contract.

- **Hooks**: `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
  `PostToolUse`, `Notification`, `Stop`, `SubagentStop`, `PreCompact`, and
  `SessionEnd`. Payloads carry no token usage.
- **Live only**: there is no import, watcher, backfill, or resume for past
  sessions.
- **Subagents**: Droid sends `SubagentStop` but no `SubagentStart`. So a stop
  becomes a standalone subagent span under the active turn.
- **Incognito**: use the skill in the local marketplace plugin, or the MCP
  tool.

## ForgeCode

ForgeCode is off by default:

```bash
trajectory config set clients.forgecode.enabled true
trajectory setup --clients forgecode
```

Setup also accepts `forge` and `forge-code`. It runs `forge config path` to
detect ForgeCode, which needs a `.forge.toml` path. Under the active
ForgeCode folder, it adds only `mcpServers.trajectory` in `.mcp.json`, an
incognito skill, and `/incognito`.

- **Database**: Trajectory opens `.forge.db` read-only, with its WAL and SHM
  files. It looks in `FORGE_CONFIG`, then in `~/forge` if present, then in
  `~/.forge`. Each conversation is a session.
- **Records**: messages, reasoning, tools, failures, the model, the working
  directory, child links, usage, and provider cost.
- **Tokens and cost**: exact counts are native usage. Approximate or mixed
  counts are marked as estimates. Cost keeps ForgeCode's label.
- **Times**: history shows no live or ended state. Message times are
  synthetic, from `conversation.created_at` and message order.
- **Sync**: it runs in passes of limited size. It never marks sessions
  active or complete, writes no `session_end`, and keeps deleted history.
  There is no history import.
- **Incognito**: Trajectory's own `/incognito` command and
  `trajectory-incognito` skill need an exact session ID from
  `trajectory status --json`. They never guess it. The MCP tool also works.

## GitHub Copilot CLI

```bash
trajectory setup --clients copilot
```

Setup installs `trajectory@trajectory` from
`~/.trajectory/copilot-marketplace`, with hooks, `.mcp.json`, and an
incognito skill. Run setup again to repair it. Trajectory follows GitHub's
public contracts for Copilot CLI plugin hooks, session history, and native
OTel.

### Hooks

Plugin hooks cover the session start and end, prompts, tools,
`permissionRequest`, notifications, `Stop`, subagents, `ErrorOccurred`, and
`PreCompact`.

- **Usage**: hooks carry no usage. On 1.0.94 and later, tokens for each
  request come from Copilot's session log. Native OTel can also give them.
  Otherwise Trajectory uses the session totals at shutdown.
- **Stop**: capture waits 500 ms for the session log. `events_log_matched`
  means it found the tokens, model, and reply for each request. A `settle_*`
  reason means it did not.
- **MCP tools**: a tool event gets its server from `permissionRequest`. So a
  tool's first call has no server on its pre event.
- **Hyphens**: by default, MCP server and tool names that contain hyphens may
  split in the wrong place.

### Native Telemetry

Tokens and USD for each request from Copilot's native telemetry are off by
default. They need the command shim from `--install-client-shims`. The shim
turns on OTLP with content off. It does so only for processes it starts that
have no other exporter, custom scope, file exporter, or telemetry opt-out.

Native OTel `chat` spans join records by session and request ID. One
interaction is one turn, and its ancestry sets `query_source`.

### Tokens and Cost

- **Split**: input splits into uncached, cache-read, and cache-creation
  tokens, priced at public rates.
- **Unrated requests**: a turn with one is `rate_missing`, never 0. A session
  with one sends no USD and keeps `cost_known_subtotal_usd`.
- **Lower bounds**: priced turns are lower bounds, tagged
  `service_tier_unstated`. BYOK requests show no credits but are still
  priced.
- **No rate card**: `mai-code-1.1-flash` has no built-in rate card, because
  it has no public API price. Its turns are `rate_missing` unless an org
  custom card prices it.
- **Credits**: premium-request multipliers, nano-AIU, and history request
  costs stay diagnostics, never USD. On `llm_call`, `provider_nano_aiu`
  counts AI credits in billionths. `provider_request_cost_units` counts
  premium-request units.
- **Premium requests**: `provider_premium_requests` counts units for the
  requests you start and 0 for the ones the agent starts. They sum to
  `totalPremiumRequests`, and the field is left out when unknown.

### Saved History

Copilot history is `session-state/<id>/events.jsonl` with `workspace.yaml`,
or the older `<id>.jsonl`, under `~/.copilot` or `COPILOT_HOME`. Trajectory
only reads it, and the folders win.

- **Contents**: IDs, times, prompts, replies, reasoning, model changes,
  tools, permissions, subagent links, and shutdown totals.
- **Rules**: history fills gaps without replacing hook events. It keeps
  shutdown usage at the session level, and never treats request units as
  USD.
- **Session total**: with saved history on, `session_end` carries the
  session total, priced once as `session_aggregate_only`. Turns get models
  but not tokens.
- **Import**: turn on `clients.copilot.history_import`, then run
  `trajectory session import copilot [--session <id>]`. `--force` imports
  again. Import does not cover cloud agent sessions.
- **Import rules**: import ignores symbolic links and skips unchanged
  sessions. A rerun refreshes active or changed ones.
- **Watcher**: turn on `clients.copilot.history_sync`, then run
  `trajectory config reload --yes`. It is read-only. It syncs new and changed
  sessions from then on, not past ones, and keeps deleted ones. Import works
  without it.

`trajectory doctor` shows whether history sync is on and whether its watcher
runs. For incognito, use the incognito skill in the local marketplace plugin,
or the MCP tool.

## Goose

```bash
trajectory setup --clients goose
```

Setup writes an Open Plugins package to `~/.agents/plugins/trajectory`, or
to `.agents/plugins/trajectory` under each recorded absolute
`$GOOSE_PATH_ROOT`. Uninstall cleans every root.

### Hooks

Hooks cover session, prompt, tool, `Stop`, and `SessionEnd` events. They wait
for `trajectory serve` to keep events in order, with a local fallback.

- **Limits**: hooks have no tool-call IDs, result or error text, usage,
  cost, launch mode, or working directory. Calls to the same tool match on a
  best-effort basis.
- **Run mode**: hooks cannot tell interactive from headless, so sessions get
  `source_mode=unknown`.
- **Reopen**: Goose sends no `SessionStart` when you reopen a session. The
  first hook after a session end starts a new part, with
  `resume_evidence=post_terminal_hook`.
- **Tool names**: native names such as `developer__shell` are kept.

### Saved History

A read-only sync of Goose's SQLite store is on by default. `sessions.db` is
in Goose's data folder or in `$GOOSE_PATH_ROOT/data/sessions`. Trajectory
checks older folders unless setup registered a root. A recorded root
overrides the default store for matching session IDs. Goose has no history
import, so this sync covers its saved history.

- **Adds**: the model, input, output, and cache tokens, and compaction.
  Counts that are not valid stay raw, with `tokens_status=unavailable`.
- **Hook sessions**: history adds only exact usage for each turn. Hook
  content and lifecycle win.
- **Session end**: `SessionEnd` triggers one sync for the final tokens and
  cost. If the database is busy, Trajectory logs it and the session ends.
- **History-only sessions**: they get traces with IDs, the working
  directory, messages, thinking, tools, model, provider, tokens, compaction,
  and cost. They stay incomplete.
- **Deleted sessions**: they keep a deletion record and never end.

### Privacy and Cost

- **Hidden content**: content with `userVisible=false` is dropped, except
  usage and the model. Image bytes and redacted thinking are dropped.
  Notices keep only metadata.
- **Cost**: only `provider_reported` USD counts as attributed cost.
  Estimated, mixed, and carried-forward amounts stay raw values.
- **Incognito**: run the setup-managed `goose-incognito` command. There is no
  MCP incognito tool.

## gptme

gptme is off by default:

```bash
trajectory config set clients.gptme.enabled true
trajectory setup --clients gptme
```

Setup edits `~/.config/gptme/config.toml` on every OS. It adds the
`trajectory_gptme` plugin, turns on the MCP server, and registers
`/incognito`. It keeps unrelated TOML. It stops before any change if a local
or project config would override the user config.

- **Plugin events**: lifecycle, prompt, tool, and stop events with metadata
  only. They never repeat prompt, assistant, or tool content.
- **Never waits**: gptme never waits on capture. At 1,024 queued events a
  hook waits one send timeout, and sending continues for 30 seconds.
- **Saved files**: content, the model, tools, tokens, and cost come from
  `conversation.jsonl`, `events.jsonl`, and `config.toml` under
  `GPTME_LOGS_HOME`.
- **Folders**: Trajectory uses only `GPTME_LOGS_HOME` if it is set. Otherwise
  it uses `$XDG_DATA_HOME/gptme/logs`, `~/.local/share/gptme/logs`, or the
  platform folder. It ignores `GPTME_DIR`.
- **Sync**: on first start, the watcher syncs existing sessions without
  repeating hook events. Then it syncs changed files in passes of limited
  size. There is no history import.
- **Tokens and cost**: message tokens are summed for each user turn and
  priced from the rate card, labeled as computed.
- **Run mode**: only `--non-interactive` runs are recorded as headless. Other
  runs give no reliable interactive signal. Timestamps without a time zone
  count as unknown.
- **Native OTLP**: gptme's own OTLP export stays off. Trajectory cannot yet
  remove duplicates across hooks, saved files, and OTLP.
- **Incognito**: use the native `/incognito` command or the MCP tool.

## Grok Build

Grok Build is off by default. `clients.grok.enabled` also turns on its
session sync.

```bash
trajectory config set clients.grok.enabled true
trajectory setup --clients grok
```

Setup writes `~/.grok/hooks/trajectory.json`, or under `$GROK_HOME` if set.
It also writes a `trajectory-incognito` skill and
`~/.trajectory/bin/grok-incognito`. It adds no wrapper and edits no shell
files. Other hook files stay untouched.

- **Hooks**: global hooks run whether or not you trust a project. They cover
  14 events: session, prompt, tools, permission denial, `Stop`, subagents,
  compaction, and notifications.
- **Session files**: prompts, assistant text, reasoning, tools, the model,
  the workspace, the title, Git metadata, and parents. Hooks win, and
  Trajectory never invents an empty prompt.
- **Sync**: it reads `summary.json`, `updates.jsonl`, `chat_history.jsonl`,
  and `signals.json`. Root and `subagents/*` sessions keep separate IDs and
  links.
- **Folders**: `$GROK_HOME/sessions` or `~/.grok/sessions`, the `GROK_DIR`
  override, and `TRAJECTORY_GROK_HISTORY_DIRS` folders. Old history imports
  in batches.
- **Import**: `trajectory session import grok [--session <id>] [--force]`
  imports or repairs history.
- **Tokens and cost**: Grok records no tokens or cost for each turn. Its two
  session counters in `signals.json` stay diagnostics.
- **Session end**: snapshots and deletions never end a session.
- **Incognito**: run the setup-managed `grok-incognito` command or the
  `trajectory-incognito` skill. There is no MCP incognito tool.

## Hermes Agent

```bash
trajectory setup --clients hermes
```

Setup adds an observer plugin and an incognito skill to `$HERMES_HOME`. It
sets `plugins.enabled` and `mcp_servers.trajectory` in `config.yaml`. Without
`HERMES_HOME`, the folder is `~/.hermes` on macOS and Linux, and
`%LOCALAPPDATA%\hermes` on Windows.

- **Hooks**: observer hooks send session, LLM, tool, approval, and subagent
  events in the background, so Hermes is unaffected.
- **Queue**: at 1,024 queued events or 32 MiB, a hook waits one send
  timeout. Sending continues for 30 seconds after exit.
- **Saved history**: Trajectory reads Hermes's `state.db`, with its WAL and
  SHM files, read-only at startup and at session end. It needs no setting.
  It ignores Hermes's JSON snapshot exports, which are off by default.
- **History adds**: messages, reasoning, tools, and parent, branch,
  delegation, and compression links.
- **Precedence**: hooks win over history. Deleted sessions stay local. An
  active last turn stays open until Hermes records `ended_at`.
- **Tokens**: hooks sum the usage of each call for each turn. History has
  session totals only, with no attribution to turns. Live usage appears when
  Hermes reports it.
- **Cost**: Hermes's own cost fields win over Trajectory's rates. Session
  totals create no `llm_call` spans. The model breakdown includes schema-v22
  auxiliary labels and input and output parts.
- **Import**: `trajectory session import hermes [--session <id>] [--force]`
  repairs history. `--force` imports everything again.
- **Incognito**: use the incognito skill or the MCP tool.

## Kilo Code

```bash
trajectory setup --clients kilo
```

Setup installs the plugin SDK package, and adds it and an MCP entry to
`opencode.json`. It writes a global incognito skill. It uses
`KILO_CONFIG_DIR`, then `XDG_CONFIG_HOME/kilo`, then `~/.config/kilo`. Set
`KILO_CONFIG_DIR` to isolate runs.

Kilo loads skills from `~/.config/kilo/skills/<name>/SKILL.md`,
`.agents/skills/<name>/SKILL.md`, and `.claude/skills/<name>/SKILL.md`.

- **Records**: the plugin sends one usage event per reply, with the model,
  provider, every kind of token, and the cost that Kilo reports.
- **Plugin failures**: a failure drops data, not output. Affected turns get
  `turn_snapshot_dropped` and `completed: false`.
- **Native OTLP**: to relay Kilo's own traces and logs, turn on its
  OpenTelemetry export with
  `OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:19222`. Keep the plugin.
- **Watcher**: it syncs new history with no setting needed. It skips old
  history at start, keeps plugin JSONL, and invents no `session_end`.
- **Folders**: `$XDG_DATA_HOME/kilo`, `~/Library/Application Support/kilo`,
  `%LOCALAPPDATA%\kilo`, or `~/.local/share/kilo`. `KILO_CONFIG_DIR` never
  moves them.
- **Stores**: `KILO_DB`, `kilo.db`, `kilo-<channel>.db`, older
  `opencode-<channel>.db`, and storage session, message, and part JSON.
- **Import**: `trajectory session import kilo [--session ID] [--force]`
  imports and repairs SQLite and JSON history.
- **Sessions**: Kilo uses OpenCode's nested sessions, with exact parent
  links and root lookup on open. Children are hidden from the top-level
  list.
- **Run mode**: the CLI and the editor share one store, so history cannot
  show which one started a session. Headless mode is `kilo run --auto`.
- **Incognito**: use the incognito skill or the MCP tool.

## Kimi Code CLI

Kimi Code CLI is off by default:

```bash
trajectory config set clients.kimi.enabled true
trajectory setup --clients kimi
```

Setup manages only a marked `[[hooks]]` block in
`$KIMI_CODE_HOME/config.toml`, by default `~/.kimi-code`. It also adds
`mcpServers.trajectory` in `mcp.json` and an incognito skill.

- **Records**: `wire.jsonl`, `context.jsonl`, and state files give prompts,
  thinking, the model, tools, and subagent and fork links. They win over
  hooks.
- **Folders**: sync checks the `KIMI_DIR` override first, then
  `~/.kimi-code` (`KIMI_CODE_HOME`), then the older `KIMI_SHARE_DIR` or
  `~/.kimi`. It creates no duplicates.
- **Layout**: sessions are in `sessions/<work-dir-key>/<id>/agents/main/`,
  with child agents beside them. Session IDs look like `kimi-<id>`, or
  `kimi-<id>-subagent-<agent>` for a child, and links are kept.
- **Sync**: active and changed sessions sync. There is no history import.
- **Tokens and cost**: native input, output, cache-read, and cache-create
  tokens. Trajectory computes the cost and labels it as computed, never as a
  vendor bill.
- **Incognito**: use the user incognito skill. The MCP tool needs the session
  ID when a main session and a child share a workspace. Copy `session_id`
  from `trajectory status --json`.

## Kiro CLI

```bash
trajectory setup --clients kiro
```

Kiro runs the V2 or the V3 engine, and setup captures both. V2 is the
default on 3.0.0. Use `--v3` or `chat.agentEngine v3` for V3. An ACP editor
runs Kiro on V2 unless `acp.agentEngine` is `v3`. Agent Security protects V3
only. [Agent Security](AGENT-SECURITY.md#kiro-cli) lists its Kiro limits.

Kiro's docs say a `--cloud` session runs in Kiro's sandbox with the sandbox's
hooks. Trajectory does not capture it.

### Setup

- **V2**: setup writes `~/.kiro/agents/trajectory.json`, or under
  `$KIRO_HOME` if set, with `includeMcpJson`. V2 loads Trajectory's hooks
  only with `--agent trajectory`. Setup keeps your default agent.
- **V3**: setup writes the global `~/.kiro/hooks/trajectory.json`, which V3
  runs everywhere. With Kiro 2.31 or later and an absolute `KIRO_HOME`
  outside your home, it also writes `$KIRO_HOME/hooks`.
- **MCP**: setup adds a `trajectory` MCP server to `settings/mcp.json` under
  each Kiro home it writes.
- **Ownership**: setup never replaces a global hook file it did not write.
  Removal takes only its own hooks.
- **Doctor**: it warns if a hook file is in only one hook folder, or under a
  `KIRO_HOME` your shell does not set.

### Hooks

V2 hooks are `agentSpawn`, `userPromptSubmit`, `preToolUse`, `postToolUse`,
and `stop`. V3 adds `SessionStart` and `SessionEnd`. None of them block Kiro.

- **Session end**: V3 sends `SessionEnd`, except from a headless run with
  text output. V2 never does. A session that never ends closes after 72
  idle hours. `--resume-id` resumes a session.
- **Replies**: V2's `stop` hook carries the reply. V3 hooks do not, so
  Trajectory reads V3 replies from `sessions/.../messages.jsonl`. It scans
  up to 8 MiB and keeps 4,096 bytes. If another `Stop` hook sends the turn
  back, Kiro writes the rest of the reply after every `Stop` hook exits.
  Trajectory then records only the text written before `Stop`.
- **Tool calls**: a blocked call records only a start, and duplicates record
  once. `duration_ms` spans `PreToolUse` to `PostToolUse`, within the last
  4 MiB.
- **Failures**: V3 `PostToolUse` has no ID or error. The `tool_result` row
  marks failures, with the error cut to 2,048 bytes. Otherwise success is
  assumed. Failed calls count in `tool_calls.success` and in turn errors.
- **Native tool IDs**: when exactly one store call matches, the result record
  also gets its `toolCallId` as `native_tool_use_id`. Two matching identical
  calls get none, and so does an ID over 256 bytes or with whitespace or a
  control character. `tool_use_id` stays the ID that Trajectory derives.
- **Tokens and cost**: Kiro reports no tokens, so `tokens_status` is
  `unavailable`, and `response_size` counts bytes. V3 turns get Kiro
  credits after `Stop`. Credits are not USD.
- **Workflows**: each workflow step records the starting session as
  `parent_session_id`, from `session.json`. Each step keeps its own traces.

### Saved History

Saved-history sync is off by default. Turn on `clients.kiro.history_sync`,
then run `trajectory config reload --yes`. Hook traces win. Kiro CLI has no
history import.

- **Reads**: JSONL in `$KIRO_HOME/sessions/cli` or `~/.kiro/sessions/cli`.
  `KIRO_SESSIONS_DIR` overrides the folder. On macOS and Linux, sync also
  reads kiro-cli `data.sqlite3`.
- **Windows**: sync reads only JSONL through `KIRO_HOME`. It guesses no
  SQLite location.
- **Rules**: sync is read-only, rejects links, and resumes after a crash.
  JSONL holds the content, and SQLite adds message data.
- **Adds**: prompts, replies, tools, the working directory, model IDs, and
  times. It adds no tokens or cost, and `response_size` never becomes tokens.
- **Not read**: Kiro 3.0 V3 and early-access sessions live in a separate
  store that sync does not read.

To check the setup, run `trajectory setup --clients kiro`, then
`trajectory doctor`. For incognito, run the setup-managed `kiro-incognito`
command, or ask for the MCP tool.

## Mistral Vibe

Vibe 2.21.0 or later is required. It introduced the hook type names that
Trajectory's hooks use.

```bash
trajectory setup --clients mistral-vibe --install-client-shims
```

The `vibe` shim runs `trajectory vibe --real <path> -- ...`, passes your
arguments unchanged, and queues start and finish jobs. Setup writes a managed
block of `post_agent`, `pre_tool`, and `post_tool` hooks in
`$VIBE_HOME/hooks.toml` or `~/.vibe/hooks.toml`.

### Live Capture

Live capture records `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
`PostToolUse`, `AgentMessage`, `TurnEnd`, and `SessionEnd`. Hook data wins.

- **Turns**: Vibe 2.26 sends one `TurnEnd` per turn. Qualified tools such as
  `file_system.bash` map to plain names. Tool durations of zero are dropped.
- **Folders**: the shim follows `--workdir` and `--worktree`. `post_agent`
  binds `--resume`, picker, and `-c` sessions. A bare `--worktree` links
  nothing until the session is identified.
- **No session**: Vibe records none for `mcp`, `update`, `--setup`,
  `--check-upgrade`, `--help`, or `--version`. Runs that Vibe rejects for a
  usage error are still recorded.
- **After the run**: prompts and replies are imported only for clean root
  sessions that are not ambiguous. Forks and subagents use history.

### Tokens and Cost

Vibe saves only checked token totals for the whole session and its own
approximate cost. Trajectory prices them once, as `session_aggregate_only`,
never per turn.

- **Copies**: child, fork, and copied-session usage stays with the copy that
  added it.
- **Left out**: totals from compaction continuations and unclear
  continuations stay out of session totals.
- **Model switches**: Vibe 2.26 sessions that switched models after use stay
  unpriced, with `exact_model_correlation_missing`.

### Saved History

History sync is off by default. Turn on `clients.mistral-vibe.history_sync`.
Then `trajectory serve` syncs root and nested `agents/*` sessions, and
retries after a crash.

- **Folders**: `$VIBE_HOME/logs/session`, the global
  `session_logging.save_dir`, `VIBE_SESSIONS_DIR`, and
  `TRAJECTORY_MISTRAL_VIBE_HISTORY_DIRS`.
- **Formats**: the Vibe 2.26 unified store, and the 2.21 to 2.25 layout of
  `meta.json` plus `messages.jsonl`, also used with `--legacy-harness`. It
  also reads older `session_*.json` files.
- **Unknown formats**: sync refuses them and records nothing. The session end
  says the store is too new.
- **Hook path**: a hook's `transcript_path` syncs that session, even in
  trusted project folders. Workspaces are never scanned.
- **Adds**: session, prompt, assistant, thinking, tool, and turn events, but
  never `SessionEnd`. Snapshots stay incomplete until a native session end.
- **Delay**: a new root session that no hook bound waits up to 15 minutes
  before it syncs, or 5 minutes after a queued start.
- **Import**: `trajectory session import mistral-vibe [--session <id>]
  [--force]` imports or repairs history.

### Sessions

- **IDs**: root and nested sessions keep separate IDs. Folders supply
  missing parents. A top-level session with a parent is a continuation, not
  a subagent.
- **Identity**: in Vibe 2.26, runtime identity `subagent` marks the named
  parent's subagent. `fork` marks `/branch` or rewind continuations.
- **Copies**: when Vibe 2.26 resumes an older session as a copy, only the
  messages after the copied history are imported.
- **Deletes**: when Vibe deletes a session, Trajectory reports
  `mistral_vibe.source.tombstone` and keeps the recorded history.
- **Errors**: a scheduled pass skips and reports an unreadable session. The
  others still sync.

For incognito, run the setup-managed `vibe-incognito` or
`mistral-vibe-incognito` command. There is no MCP incognito tool.

## Muse Code

Muse Code is off by default:

```bash
trajectory config set clients.muse.enabled true
trajectory setup --clients muse
```

Setup supports macOS and Linux. Managed setup supports Muse Code on macOS
only.

- **Start**: the watcher skips completed saved sessions and replays active
  ones. New logs sync as they grow. There is no history import.
- **Records**: new sessions capture prompts, text, tools, compaction, the
  turn and session end, the model, and subagents. Completed sessions get a
  baseline.
- **Tokens and cost**: native input, output, cache, and reasoning tokens.
  Only the exact model `muse-spark-1.1` gets a public-rate USD estimate.
- **Incognito**: use Trajectory's own incognito skill. It needs the session
  ID when more than one session could match. The MCP tool also works.

## Oh My Pi (omp)

Oh My Pi is off by default:

```bash
trajectory config set clients.omp.enabled true
trajectory setup --clients omp
```

The Pi extension does not cover Oh My Pi, which has its own CLI, config root,
and extension manifest. Setup installs an extension declared with
`omp.extensions`, and adds an MCP entry to the active profile's `mcp.json`.

- **Profiles**: `OMP_PROFILE` wins over `PI_PROFILE`, even when it is empty.
  Profiles live in `~/${PI_CONFIG_DIR:-.omp}/profiles/<name>/agent`. Only
  default profiles use `PI_CODING_AGENT_DIR`.
- **XDG data**: migrated XDG history is used only if `$XDG_DATA_HOME/omp` or
  the profile folder exists.
- **Records**: prompts, the model, tools, compaction, native tokens,
  provider cost, and session links. Trajectory records native resume but
  does not start it.
- **Tokens and cost**: native input, output, cache, and total tokens, plus
  provider cost when present.
- **Capture**: events arrive at `/capture/omp`, always with
  `client_source=omp`. Only shutdown waits for capture.
- **Sync**: with the setting on, `trajectory serve` syncs existing and
  changed v3 history for the active profile. It never completes or publishes
  sessions.
- **Import**: `trajectory session import omp` imports or repairs the active
  profile's v3 history: child files, links, tool results, usage, and
  compaction.
- **Incognito**: ask the agent to use the MCP tool. There is no
  setup-managed slash command yet.

## OpenClaw

Released builds do not capture OpenClaw live. They have no setup, MCP,
incognito controls, or resume for it. Trajectory imports the history that
OpenClaw saves:

```bash
trajectory config set clients.openclaw.history_sync true
trajectory config reload --yes
trajectory session import openclaw
```

Once the setting is on, a watcher syncs. `trajectory session import openclaw
[--session <id> --force]` repairs history.

- **Format**: import supports the v2026.7.1 JSONL format.
- **Records**: prompts, replies, thinking, tools, model changes, compaction,
  parent and child links, and tokens for each message. It also records the
  cost the provider billed, when saved.
- **State folder**: `OPENCLAW_STATE_DIR`, then `~/.openclaw`, then
  `~/.clawdbot`. Each agent has `agents/<agent-id>/sessions`, with IDs and
  links in `sessions.json`.
- **Other folders**: `.kimi_openclaw`, `.moltbot`, and `.moldbot` are also
  read. `TRAJECTORY_OPENCLAW_HISTORY_DIRS` entries need the same agent
  layout. `OPENCLAW_DIR` belongs to ccusage, not OpenClaw.
- **Session files**: a `sessionFile` entry in `sessions.json` is read only
  inside that agent's sessions folder. Active JSONL files win over reset or
  deleted archives. The newest archive is read only if no file is active.
- **Skipped**: backups, checkpoints, symbolic links, internal cron and
  dreaming runs, and their child sessions.
- **Rewrites**: the watcher notices a rewrite with the same size and time,
  but not right away.
- **Incognito**: OpenClaw has no incognito control of its own, because there
  is no live capture to control. There is no MCP incognito tool.

## OpenCode

```bash
trajectory setup --clients opencode
```

Setup installs the plugin, and adds it and a `trajectory` MCP entry to
`opencode.json`. It writes an incognito skill and records `trajectory-home`
and `trajectory-bin`. It uses `OPENCODE_CONFIG_DIR`, then
`XDG_CONFIG_HOME/opencode`, then `~/.config/opencode`.

OpenCode loads skills from `.opencode/skills`, `~/.config/opencode/skills`,
`.agents/skills`, and Claude Code paths such as `.claude/skills`.

The MCP entry starts `trajectory serve`. If nothing listens, the plugin runs
`trajectory serve ensure` and resends the events that wait.

OpenCode 2 needs 2.0.31 or later. Earlier 2.x releases are not supported,
and `trajectory setup check` warns when it finds one.
Trajectory validates 2.0.31 and 2.2.7. OpenCode 2 loads the same plugin from
its `server.ts` entry point and captures sessions live. Tokens and cost come
from OpenCode's store, as on 1.x. A smoke test runs the real 1.18.3, 2.0.31
and 2.2.7 releases and checks that the plugin captures turns and tool calls on
each. On 2.0.31 it also checks that OpenCode connects the `trajectory` MCP
entry that setup writes.

### What Trajectory Records

- **Agents**: the agent name and type are recorded on prompt, tool, and
  message events.
- **Reasoning effort**: the plugin's `chat.params` handler records only the
  reasoning effort that OpenCode sends for a turn.
- **Prompts**: prompt capture keeps text and identifiers. Image bytes and
  nested attachments stay in the client.
- **Plugin failures**: a failure drops data, not output. Affected turns get
  `turn_snapshot_dropped` and `completed: false`.
- **Load**: above 128 sessions the plugin evicts idle ones, and above 512 the
  oldest. Each session queues eight detailed turns, then
  `turn_snapshot_dropped` placeholders.
- **Errors**: `session.error` puts the error name in `Stop` as
  `failure_type`, which is a live `StopFailure`. `MessageAbortedError` ends
  normally.
- **Turns**: they close on OpenCode's idle notice. `opencode run` ends on
  exit, and windows end on close. Others end after 2 idle hours. Headless
  mode is `opencode run`.

### Subagents

- **Parents**: children record their exact parent from `session.created`,
  also on import. So a grandchild points to its child.
- **Launches**: a child with exactly one pending Task gets one counted launch,
  with `child_session_id` and `tool_use_id`. It closes when the child idles.
- **No launch**: a child with no launch tool, or with several pending Tasks,
  keeps the parent link but gets no launch or count.
- **Resumed tasks**: a resumed `task_id` reuses the child ID and starts
  nothing new. Its single launch is never counted twice.
- **Oh My OpenAgent**: it has no setup target or `client_source`. The
  OpenCode plugin captures it through OpenCode session IDs.

### Cost and the Launcher

OpenCode's reported cost assumes the standard tier and 5-minute cache writes.
Trajectory keeps it untagged, as a lower bound. Calls with no reported cost
get lower-bound prices. OpenCode records the service tier only for OpenAI and
xAI Responses calls, on 1.19 and later. It never records the cache-write
lifetime.

After plugin setup, run `trajectory opencode` instead of `opencode`. It
proxies Anthropic, OpenAI, Google, and xAI calls for that launch, and
captures the service tier and cache lifetime.

- **Config**: it sets `OPENCODE_CONFIG_CONTENT` for one launch and keeps your
  own value. It changes no file and forwards requests unchanged.
- **Prices**: routed calls use rate-card prices with the provider tier and
  cache lifetime. Streams over 1 MiB keep OpenCode's cost.
- **Counting**: plugin and proxy records count once. Turns use rate-card
  prices at the captured tier. Title requests are not turns.
- **Direct calls**: only providers that OpenCode offers are routed. Other
  SDKs, custom base URLs, providers from managed config, ChatGPT-plan
  `openai`, and OpenRouter call directly.
- **No routing**: unreadable config, a `.well-known` login, organization
  sign-in, `serve`, `web`, `acp`, or a proxy failure. The command says why.
- **Missed calls**: calls the capture server cannot take still reach the
  provider. The command reports them on exit, with details in
  `~/.trajectory/logs`.

### Saved History

With OpenCode installed, a watcher syncs new and changed sessions with no
setting needed. It skips old history and keeps plugin records.

- **Import**: `trajectory session import opencode [--session <id>]` imports
  `opencode*.db` SQLite and storage session, message, and part JSON. SQLite
  wins duplicates.
- **Sources**: `OPENCODE_DB`, `OPENCODE_DATA_DIR`, or else
  `$XDG_DATA_HOME/opencode` or `~/.local/share/opencode`.
  `OPENCODE_DATA_DIR` is comma-separated and, when set, the only source.
- **Keeps**: child and archived sessions, parent and tool IDs, reasoning,
  summed usage, cost source, and tier. A zero stays apart from a missing
  value.
- **Limits**: 8 data folders, 32 databases, 8,192 messages, 32,768 parts,
  4 MiB per record, 16 MiB of JSON per session, and 4,096 sessions.
- **Not imported**: a session over the read limits, or incomplete, is
  reported instead.
- **Missed rewrite**: the watcher can miss a rewrite with the same size and
  modification time before a full read. Run `trajectory session import
  opencode --session <id> --force` to fix it.

For incognito, the incognito skill uses the `trajectory_incognito` MCP tool
when it is available. Otherwise it uses the capture server's
`/session/incognito` endpoint.

## OpenHands

```bash
trajectory setup --clients openhands
```

Setup writes command hooks to `~/.openhands/hooks.json` and an MCP server to
`~/.openhands/mcp.json`, or under `OPENHANDS_PERSISTENCE_DIR`. Headless
OpenHands loads hooks from the workspace's `.openhands/hooks.json`. Copy
setup's hook config into the project first.

- **Hooks**: `SessionStart`, `UserPromptSubmit`, `PreToolUse`,
  `PostToolUse`, `Stop`, and `SessionEnd` give lifecycle, prompt, and tool
  events. They carry no usage, so `tokens_status` is `unavailable`.
- **Run mode**: if OpenHands adds a run-mode hook field, Trajectory uses it
  instead of assuming hook sessions are headless.
- **No OTLP relay**: Trajectory installs none, though the OpenHands SDKs
  offer OpenTelemetry and Laminar variables.
- **Resume**: native OpenHands resume reuses the conversation ID.
- **Incognito**: run the setup-managed `openhands-incognito` command, or ask
  for the MCP tool.

### Saved History

History sync is off by default. Turn on `clients.openhands.history_sync`, and
a watcher syncs. `trajectory session import openhands [--session <id>]
[--force]` repairs history.

- **Folders**: `OPENHANDS_CONVERSATIONS_DIR`, else
  `OPENHANDS_PERSISTENCE_DIR/conversations`, else
  `~/.openhands/conversations`.
- **Adds**: assistant messages, visible reasoning, tool input and results,
  errors, the model, the working directory, and the final state.
- **Tokens and cost**: `base_state.json` gives token totals for the session
  only, and the cost that OpenHands reports.
- **Ignored**: a conversation without a regular `base_state.json` within
  size limits. Mismatched or changed IDs are skipped.
- **Large values**: a tool input or result over 4 MiB is stored only as its
  JSON byte count and SHA-256 digest.
- **Session end**: a session ends only on a finish action or a final state
  in the saved conversation.

## Pi

```bash
trajectory setup --clients pi
```

Setup writes the extension to `~/.pi/agent/extensions/trajectory/`. Pi finds
it through the `package.json` there, and setup adds nothing to
`~/.pi/agent/settings.json`.

- **Tools**: the extension registers two tools, `trajectory_status` and
  `trajectory_incognito`. Pi puts every tool in each session's system prompt,
  so the extension leaves out the tools that read past sessions.
- **Old MCP server**: setup removes an older `trajectory` server from
  `~/.pi/agent/mcp.json`, and warns if it cannot.
- **Owners**: setup stops when the folder and parent owners differ, or when
  it cannot keep a file's owner. Fix the owners, or rerun as that user.
- **Updates**: running sessions keep their loaded files and Trajectory home
  through updates. A new home applies when the extension reloads.

### What Trajectory Records

- **Events**: the extension sends `session_start`, `agent_end`,
  `agent_settled`, `tool_call`, `tool_result`, and `PostCompact` through
  `trajectory capture-hook`.
- **Waits**: it waits 500 ms for each capture response, and helpers stop at
  1.5 seconds. `SessionEnd` comes last. Shutdown waits up to 100 ms for the
  capture queue. If work remains, it waits up to another 100 ms to hand that
  work to a background worker.
- **Turns**: one turn records at `agent_settled`. It sums the `agent_end`
  runs and keeps Pi's `stopReason`. Activity settles at the turn, not at each
  assistant message.
- **Usage**: extension events carry the usage of each model request, on
  `AgentMessage` and `llm_call` events.
- **Prompts**: up to 8,192 bytes. An oversized `/skill:name` prompt keeps its
  tags and arguments and leaves out the skill body.
- **Skills**: Pi reads them from `~/.pi/agent/skills`, `~/.agents/skills`,
  `.pi/skills`, `.agents/skills`, configured paths, and packages.
- **Cost**: estimates for Pi's configured models stay apart from provider
  charges. Free rate cards stay at zero. A custom model with no rate is priced
  only with full data.
- **Headless**: headless mode is `pi -p`.

### Session Links

- **Forks**: fork and new-session changes are linked only when the new
  header's `parentSession` matches `previousSessionFile`. Trajectory never
  infers an unconfirmed parent.
- **pi-subagents**: children with `PI_SUBAGENT_CHILD=1` and
  `PI_SUBAGENT_PARENT_SESSION` link as `session_relationship=subagent`,
  unless a fork or new-session parent exists.
- **Child launches**: the extension exports `TRAJECTORY_PI_PARENT_SESSION`.
  Print or JSON Pi children started with it record the link. TUI and RPC
  children ignore it.
- **Foreground children**: finished pi-subagents children of a live parent
  import and publish as separate sessions. Parent totals leave out the
  launch.
- **Display**: child links show in the local UI and in traces, not as
  subagent invocations. Tool names or parent links never imply a launch.
- **Not yet checked**: child-launch links on an installed client and in
  Datadog. Other extensions and Oh My Pi are not checked either.

### Automatic Import

`trajectory serve` imports idle `~/.pi/agent/sessions` files that were never
captured, with their IDs and parent links. It keeps them local and does not
publish them.

- **Timing**: it waits two quiet minutes, or up to one hour for children. It
  works in batches of 64 files or 64 MiB, and skips lines over 16 MiB.
- **Scope**: it reads only project files and the pi-subagents layout. It
  skips linked children, Oh My Pi or custom folders, and other nesting.
- **Once**: it reads each file once and never imports changes. Run
  `trajectory session import pi` for history outside its limits.
- **Stop**: `trajectory uninstrument pi` stops it, and setup starts it again.

### Remove and Troubleshoot

`trajectory uninstrument pi` removes the extension, every bundle generation,
and the old MCP entry. It keeps your other Pi settings and is safe to rerun.

If doctor reports `pi bundle retention limit reached` and names stuck
copies, do these steps:

1. Close your Pi sessions.
2. Run `trajectory uninstrument pi`.
3. Run `trajectory setup --clients pi`.

For incognito, the native `trajectory_incognito` tool turns incognito on for
the session or for all sessions. It never turns it off. The MCP tool also
works.

## Qoder CLI

Qoder CLI is off by default:

```bash
trajectory config set clients.qoder.enabled true
trajectory setup --clients qoder
```

Setup builds a plugin with wake hooks, `.mcp.json`, an incognito skill, and
`/incognito`. It stages the plugin in `~/.trajectory/plugins/qoder/trajectory`
and manages it with `qodercli plugins validate`, `install`, `list`, and
`uninstall`. Never copy the files yourself.

- **Hooks**: they exit 0 two seconds before Qoder's eight-second timeout.
  Trajectory never changes Qoder's files.
- **Transcripts**: prompts, thinking, tools, the model, and subagents. They
  come from `~/.qoder/projects` or `$QODER_CONFIG_DIR/projects`, or the
  older `QODER_PROJECTS_DIR`. `~/.qoderwork/projects` is never scanned.
- **Files**: `<project>/<session>.jsonl`, `<session>-session.json` metadata,
  and `<parent>/subagents/agent-*.jsonl`.
- **Sync**: capture records existing transcripts as a baseline without
  importing them. There is no bulk import. Only active and changed sessions
  sync, up to 4,096 new sessions.
- **Tokens**: native prompt, completion, cache-write, and cache-read counts.
  Repeated snapshots of one message count once, from the last one.
- **IDs**: session IDs look like `qoder-<id>` and
  `qoder-<parent>-subagent-<agent>`, because IDs become file names. Qoder's
  own IDs, such as `qoder:<id>`, stay in `provider_session_id`.
- **Run mode**: sessions record `is_headless=true` and
  `source_mode=unknown`.
- **Incognito**: use the plugin's `/incognito` command or skill, or the MCP
  tool.

## Qwen Code

```bash
trajectory setup --clients qwen
```

Setup merges into `~/.qwen/settings.json`, or under `$QWEN_HOME` if set. It
adds `mcpServers.trajectory`, HTTP hooks, and
`http://127.0.0.1:19222/capture/qwen/*` in `security.allowedHttpHookUrls`.
It also writes `~/.qwen/skills/incognito/SKILL.md` and
`~/.qwen/commands/incognito.toml`.

- **Hooks**: session, prompt, tool, permission, subagent, compaction,
  notification, `Stop`, `StopFailure`, and `SessionEnd` events, plus
  `llm_call` rows.
- **Tokens**: usage comes from `usageMetadata`, with saved chat JSONL or
  `transcript_path` as a fallback. It splits with `totalTokenCount` into
  uncached input, cache read, output, and reasoning.
- **Partial usage**: `qwen_transcript_status` flags it. Without
  `totalTokenCount`, or with malformed counts, usage is partial and stays
  unpriced. Raw counters stay for diagnosis and are never repaired.
- **Incognito**: use the `/incognito` command or skill, or the MCP tool.

### Saved History

A watcher syncs the active branch of saved chats, with no setting needed. It
pages through existing chats, then follows changes.

- **Files**: regular files in `projects/*/chats/*.jsonl` and
  `chats/archive/*.jsonl`, never links. A session at two paths, or in two
  projects, is reported as ambiguous.
- **Keeps**: message times, models, usage, cache overlap, thinking, tools,
  sidechain identity, the title, and parent and fork links.
- **Branches**: sync follows the `parentUuid` chain from the last valid
  record. It drops branches that a rewind abandoned.
- **Precedence**: hooks win for lifecycle and tool timing. History wins for
  the usage of each request. Import never writes `session_end`.
- **Deletes**: deleted chats keep their local history. A rewrite drops
  spans that vanished, locally.
- **Import**: `trajectory session import qwen [--session <id>] [--force]`
  imports active or archived chat JSONL by hand.

The runtime folder resolves as Qwen resolves it: `.env`,
`QWEN_RUNTIME_DIR`, `advanced.runtimeOutputDir`, then `QWEN_HOME` or
`~/.qwen`. Relative paths use the working directory. A session-end hook
triggers an immediate sync. Its `transcript_path` shows runtime folders that
a workspace chose.

The watcher cannot find a runtime folder that only another workspace's
settings chose. Run the import from that workspace.

## VS Code Copilot Chat

VS Code Copilot Chat is off by default, and separate from Copilot CLI:

```bash
trajectory config set clients.vscode-copilot.enabled true
trajectory setup --clients vscode-copilot
```

Setup changes only user settings. It sets an `otlp-http` exporter at
`http://127.0.0.1:19222`, adds MCP in `User/mcp.json`, and adds an incognito
prompt. It writes `github.copilot.chat.otel.captureContent=false` if no one
owns the key. So content stays off unless you send it. When the binary moves,
setup rewrites its own MCP entry, never others.

- **Spans**: Trajectory accepts only first-party root spans. These have
  `service.name=copilot-chat`, `invoke_agent`, provider `github`, a session
  ID, and no parent.
- **Recorded**: `invoke_agent`, `chat`, `execute_tool`, and `execute_hook`
  spans. With content capture off, Trajectory infers no content.
- **Subagents**: nested subagent spans stay on the parent trace. Spans from
  the standalone CLI and other tools keep their own.
- **Chat text**: it comes from the stores of Code, Code - Insiders, and
  VSCodium: `chatSessions`, `emptyWindowChatSessions`, and
  `transferredChatSessions`. Native OTel data wins.
- **Folder**: `VSCODE_COPILOT_DIR` names a `User` folder.
- **Formats**: when a session exists in both formats, the JSONL operation log
  wins. Workspace manifest changes trigger a sync. There is no history
  import.

## Windsurf

Windsurf is off by default:

```bash
trajectory config set clients.windsurf.enabled true
trajectory setup --clients windsurf
```

Setup adds marked entries to `~/.codeium/windsurf/hooks.json`,
`mcp_config.json`, and `global_workflows/incognito.md`. Uninstall removes only
those.

- **Hooks**: each one waits at most two seconds for `trajectory serve`,
  discards its output, and exits 0. So prompts are never blocked.
- **Old hooks**: doctor flags an older hook without timeout guards. Run
  setup again to replace it.
- **Transcripts**: Trajectory reads the newest 100
  `~/.windsurf/transcripts/{trajectory_id}.jsonl` files, plus older database
  history. Code actions never become tool calls.
- **Older conversations**: Trajectory reads only the chat-data keys in the
  `ItemTable` of stable and Next `state.vscdb`, for prompt and reply text.
- **Precedence**: when both sources hold a conversation, the transcript wins.
  Database IDs look like `<db>#<session-id>`. An eviction is not a clean end.
  There is no history import.
- **Tokens and cost**: transcripts and the database hold none, so Trajectory
  makes no cost claim.
- **Incognito**: use the global `/incognito` workflow or the MCP tool.

## ZCode

ZCode is off by default:

```bash
trajectory config set clients.zcode.enabled true
trajectory setup --clients zcode
```

Setup changes only `~/.zcode/cli/config.json`, with wake-only lifecycle and
tool hooks and a marked MCP entry. It also adds an incognito skill folder.
Uninstall removes the marked items.

- **Database**: `~/.zcode/cli/db/db.sqlite`, with WAL and SHM files.
  `ZCODE_STORAGE_DIR`, `storage.sessionDbPath`, `ZCODE_SESSION_DB_PATH`, or
  `ZCODE_SESSION_DB` can move it.
- **Records**: the session, parent, working directory, prompts, assistant
  and thinking text, the model, tools, and tokens for each attempt.
- **Calls**: each finished attempt is an `llm_call`, and `model_usage` wins
  over message totals. Cost needs a known rate. Otherwise it is
  `unavailable:price_unknown`.
- **Sync**: ZCode syncs automatically. `trajectory session import zcode`
  imports or repairs history, and replaces only Trajectory's copy.
- **Session end**: only `time_archived` ends a session, and active ones stay
  open. Deletions keep local history.
- **Incognito**: use the user incognito skill, which calls
  `trajectory_incognito`, or the MCP tool.

## Zed

Zed is off by default:

```bash
trajectory config set clients.zed.enabled true
trajectory setup --clients zed
```

Setup owns only `context_servers.trajectory` in Zed's `settings.json` and
`~/.agents/skills/trajectory-incognito/SKILL.md`. It never touches Zed's
thread database. When the binary moves, setup rewrites its own MCP entry,
never others.

- **No live capture**: Zed has no hooks, wrapper, native OTel, session end,
  or bulk import. Sessions count as headless or unknown.
- **Sync**: Trajectory reads `threads/threads.db` read-only from Zed's data
  folder or `ZED_DIR`, with WAL and SHM. It reads changed sessions only.
- **Records**: each row is a session, with prompts, thinking, tools, the
  model, the working directory, and `parent_id`. Message times come from
  their order.
- **Subagents**: rows with a `parent_id` become subagent sessions, with
  `relationship=subagent`. `zed:<id>` IDs are kept beside file-safe
  `zed-<id>` IDs.
- **Tokens**: `request_token_usage` is stored as reported, on
  `session_start`. It is never summed or assigned to messages or turns.
- **Deletes**: deleted threads leave a deletion record. Saved sync progress
  holds no Zed content.
- **Incognito**: use the global `trajectory-incognito` skill or the MCP tool.
