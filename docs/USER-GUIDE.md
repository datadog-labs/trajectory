# Trajectory User Guide

Trajectory captures sessions from AI coding agents and sends them to Datadog
LLM Observability. This guide shows the `trajectory` commands you use day to
day and when to use each one.

In this guide, a *client* is a coding agent, such as Claude Code or Codex. A
*session* is one conversation with a client. A *turn* is one prompt and the
work the agent does to answer it.

## Get started

### Check the install

Run this command first after you install:

```bash
trajectory setup check
```

It refreshes the local client inventory and summarizes your config. It shows
which clients are ready. Then it prints the next commands to run: setup, a
first agent session, a local check, the local UI, and Datadog validation. It
does not change client hooks or your Datadog configuration.

### Browse your sessions

Start the local viewer:

```bash
trajectory local-ui --lapdog
```

The command starts the local inspection API on `http://127.0.0.1:8888`. If
that port is busy, it uses the next free port. Then it opens the hosted Lapdog
viewer with a `portOverride` that matches the port it printed. It also listens
on port 8126 for older Lapdog flows, unless a Datadog Agent already uses that
port. On a computer without a browser, add `--no-open`.

### Find help

Run `trajectory --help` to see the main commands. Run `trajectory user-guide`
to read the detailed guides that ship with the binary. The
[built-in help topics](#built-in-help-topics) section lists them.

Trajectory rejects retired top-level commands. This guide uses only the
current command names.

## Common commands

| Task | Command |
| --- | --- |
| Check the install and print next steps | `trajectory setup check` |
| Show a terminal dashboard with session metrics | `trajectory status` |
| Show this month's usage and cost | `trajectory summary` |
| Show local cost and the top sessions | `trajectory cost` |
| Show the files that agents read and edit most | `trajectory cost hotspots` |
| Show the work mix, outcomes, cost, and deliverables | `trajectory patterns` |
| Show cost per commit and cost per PR | `trajectory patterns outcomes` |
| Start the local UI, using port 8888 if it is free | `trajectory local-ui` |
| Show running Trajectory processes | `trajectory ps` |
| Find and explain problems | `trajectory doctor` |
| Show the full low-level doctor report | `trajectory doctor --verbose` |
| Explain capture, mapping, and publish expectations | `trajectory doctor publish` |
| Preview metrics for sessions you already have | `trajectory doctor metrics session --latest` |
| Send test metrics and read them back from Datadog | `trajectory doctor metrics canary --publish --readback` |
| View capture server logs | `trajectory doctor logs [-f] [--grep PAT]` |
| Write a redacted support ZIP | `trajectory flare` |
| Refresh the local capability inventory | `trajectory setup refresh --json` |
| List opt-in product plugins | `trajectory plugins list` |
| Show the Datadog Security plugin | `trajectory plugins show datadog-security` |
| Show Datadog Security status | `trajectory plugins security status` |
| List built-in optional modules and their status | `trajectory plugins modules list` |
| List feature flags and where each value comes from | `trajectory config features list` |
| Stop all new capture for your user | `trajectory config capture disable` |
| Start capture again for your user | `trajectory config capture enable` |
| Print the version | `trajectory version` |

## Set up clients

### Add or refresh one client

Run setup with the client's setup ID:

```bash
trajectory setup --clients codex
```

This command changes only the client wiring. It does not ask for the Datadog
site, service name, or API key, and it leaves your export config as it is. If
no config file exists yet, it creates a capture-only config so that local
capture can start. To set up Datadog export later, run
`trajectory publish destination configure`.

To set up every client that setup manages, run
`trajectory setup --clients all`.

### Client setup commands

Run the commands in a row in order. Preview clients need their feature flag
before setup. The [supported-client matrix](SUPPORTED-CLIENTS.md) is the full
list.

| Client | Commands |
| --- | --- |
| Claude Code | `trajectory setup --clients cc` |
| Codex | `trajectory setup --clients codex` |
| GitHub Copilot CLI (beta, live capture) | `trajectory setup --clients copilot` |
| Antigravity CLI | `trajectory setup --clients agy` |
| Goose | `trajectory setup --clients goose` |
| Cline CLI | `trajectory setup --clients cline` |
| Aider (command shim) | `trajectory setup --clients aider --install-client-shims` |
| Continue CLI (command shim) | `trajectory setup --clients continue --install-client-shims` |
| Mistral Vibe (command shim) | `trajectory setup --clients mistral-vibe --install-client-shims` |
| Codebuff (command shim) | `trajectory setup --clients codebuff --install-client-shims` |
| Grok Build | `trajectory config features enable grok_build_instrumentation`, then `trajectory setup --clients grok` |
| Kilo Code | `trajectory setup --clients kilo` |
| Kiro CLI | `trajectory setup --clients kiro` |
| Factory Droid (beta, live capture) | `trajectory setup --clients droid` |
| Devin CLI (preview) | `trajectory config features enable devin_cli_instrumentation`, then `trajectory setup --clients devin` |
| Zed (passive-history preview) | `trajectory config features enable zed_passive_history`, then `trajectory setup --clients zed` |
| Qoder CLI (preview) | `trajectory config features enable qoder_cli_instrumentation`, then `trajectory setup --clients qoder` |
| ZCode (preview) | `trajectory config features enable zcode_instrumentation`, then `trajectory setup --clients zcode` |
| CommandCode (preview) | `trajectory config features enable commandcode_instrumentation`, then `trajectory setup --clients commandcode` |
| Kimi Code CLI (preview) | `trajectory config features enable kimi_cli_instrumentation`, then `trajectory setup --clients kimi` |
| gptme (preview) | `trajectory config features enable gptme_instrumentation`, then `trajectory setup --clients gptme` |
| CodeWhale (preview) | `trajectory config features enable codewhale_instrumentation`, then `trajectory setup --clients codewhale` |
| ForgeCode (passive-history preview) | `trajectory config features enable forgecode_instrumentation`, then `trajectory setup --clients forgecode` |
| Warp Desktop and local Oz CLI (preview) | `trajectory config features enable warp_oz_instrumentation`, then `trajectory setup --clients warp` |
| VS Code Copilot (fixture preview) | `trajectory config features enable vscode_copilot_instrumentation`, then `trajectory setup --clients vscode-copilot` |
| Windsurf (preview) | `trajectory config features enable windsurf_instrumentation`, then `trajectory setup --clients windsurf` |

### Turn on saved-history sync for a client

Some clients save their own session history on disk. Trajectory can read that
history to fill gaps in live capture. Most of these clients have a feature
flag for this, and its name ends in `_durable_history`.

| Client | Commands | What it does |
| --- | --- | --- |
| Aider | `trajectory config features enable aider_durable_history`, then `trajectory session import aider` | Imports Aider history from the folders you configure |
| Kilo Code | `trajectory config features enable kilo_durable_history`, then `trajectory session import kilo` | Imports Kilo SQLite and JSON history |
| ZCode | `trajectory session import zcode` | Repairs ZCode history that is already on disk |
| Kiro CLI | `trajectory config features enable kiro_durable_history`, then `trajectory config reload --yes` | Syncs Kiro JSONL and SQLite history in passes of limited size |
| OpenCode | `trajectory config features enable opencode_durable_history`, then `trajectory config reload --yes` | Watches for new and changed OpenCode sessions |
| Amp Code | `trajectory config features enable amp_durable_history`, then `trajectory config reload --yes` | Syncs Amp thread history in passes of limited size |
| cursor-agent CLI | `trajectory config features enable cursor_agent_durable_history`, then `trajectory config reload --yes` | Syncs cursor-agent transcripts in passes of limited size |

Run `trajectory config reload` without `--yes` first to preview the change.

### Use command shims for Claude Code and Codex

Claude Code and Codex already have native setup integrations, so command shims
are optional for them. To add shims, run:

```bash
trajectory setup --clients cc,codex --install-client-shims
```

The flag creates `claude` and `codex` launcher links in `~/.trajectory/bin`.
The links point to scripts that Trajectory owns under
`~/.trajectory/client-shims/bin`. Setup records the path of each real client
binary. With the shims, a normal `claude` or `codex` launch runs through
Trajectory's built-in wrapper.

Setup follows these rules for your `PATH`:

- If `~/.trajectory/bin` is already first on your `PATH`, you need no other
  change.
- Setup can link into a bin folder in your home directory that is already on
  your `PATH`. It leaves files that belong to other programs in place.
- A setup run that you start never edits shell startup files. On a Mac
  whose MDM profile turns on launcher wrappers, managed setup adds a block
  marked `Trajectory command shims` to them. It removes the block when the
  profile turns the wrappers off.
- If another command comes earlier on your `PATH`, setup reports its path.

You must pass `--install-client-shims` to get shims. A normal refresh keeps the
launcher links that you installed before.

### How setup handles Claude Code settings

Trajectory never adds, merges, or deletes Claude user settings itself. This
includes `~/.claude.json`, `~/.claude/settings.json`, and their variants.
Trajectory writes to them only to roll back a destructive result from Claude's
plugin manager.

Setup works with Claude Code like this:

1. It stages the local marketplace.
2. It uses Claude's plugin manager to register, install, or repair
   `trajectory@trajectory` at user scope.
3. It checks that Claude only added settings. Claude may update its own plugin
   fields and must keep unrelated settings.
4. If Claude dropped or changed an existing value, setup restores the original
   settings files byte for byte and fails.
5. It refreshes the plugin cache that Trajectory owns, after it adds module
   hooks.

The standard plugin uses one `.mcp.json` file at its root. The manifest has no
inline MCP block and no nested MCP file. If you added a Trajectory MCP entry
yourself in an older release, Trajectory leaves it unchanged. It then stages a
plugin version with no MCP entry, so the client is not instrumented twice.

For an existing install at user or managed scope, background repair updates
only Trajectory's plugin entry and cache folder. It never starts Claude. It
does not change project or local plugin scopes. Setup reports an old OTLP
block and leaves it unchanged.

### Remove a client

To remove one client integration, run:

```bash
trajectory uninstrument codex
```

To remove every client integration, run `trajectory uninstrument all`.

### Turn on automatic client setup for a managed fleet

Administrators can let Trajectory set up clients on managed computers. To see
the plan without changing anything, run:

```bash
trajectory setup auto-instrument
```

The plan is ready only when both of these are true:

- The installation is managed. One of these must be true:
  - `selfupdate.conf` names a managed owner, such as `jamf` or `mdm`.
  - On macOS, MDM has installed the Trajectory configuration profile, and the
    command runs your account's `~/.trajectory/bin/trajectory`.
- Managed `config.defaults.yaml` sets `setup.auto_instrument.enabled` and an
  `allow_clients` list.

Auto-instrument is off for unmanaged users and personal installs. A user can
opt out with `setup.auto_instrument.enabled: false`. Managed defaults set the
upper limit. User config can shorten `allow_clients`, add `deny_clients`, or
choose a longer interval. User config cannot add clients beyond the managed
allow list.

To let auto-instrument change clients, the managed policy must also set
`setup.auto_instrument.apply_enabled: true`. Without that key, auto-instrument
only plans and reports status. With it, an MDM job can run this command:

```bash
trajectory setup auto-instrument apply --yes --json
```

This command uses the same client-only setup path as
`trajectory setup --clients ... --non-interactive`. It saves the result in
`state/auto-instrument/status.json`.

When `trajectory serve` starts, it saves the same plan in
`state/auto-instrument/status.json` under the Trajectory home. To read it,
run:

```bash
trajectory setup auto-instrument status
```

The default plan and status views show actions and next steps. They hide
internal hashes and policy codes. Add `--details` for short technical context,
or `--json` for automation.

At startup, `trajectory serve` only plans, unless the managed policy sets
`setup.auto_instrument.apply_enabled: true`. If that key is set and the plan
finds clients to set up, startup runs the client-only setup in the background.
It saves the result with source `serve_startup_apply`.

Managed fleets can also turn on the `periodic_auto_instrument_reconciliation`
feature, which is off by default. While `trajectory serve` runs, it checks the
installed clients again after each `setup.auto_instrument.interval`. It sets up
only allow-listed integrations that are new, missing, or broken. The periodic
check works like this:

- While the managed policy is on, the shared server does not exit when idle.
  This lets the interval pass.
- It runs one pass at a time.
- It checks the managed feature and policy before each pass, and again before
  it changes anything.
- While it waits, it reads the policy at most once per minute.
- It respects the setup lock that other setup runs hold.
- It raises any interval shorter than one minute to one minute.
- If you turn the feature off, the server can exit when idle again after the
  next policy read.

Periodic results use source `serve_periodic` or `serve_periodic_apply`.

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
    allow_clients: [cc, codex, cursor, agy, goose, cline, aider, continue, codebuff, kilo, kiro]
```

`allow_clients` and `deny_clients` still accept `gemini`, so config from an
older release still loads. The entry has no effect. Gemini CLI is
[retired](SUPPORTED-CLIENTS.md#gemini-cli-retired), and Trajectory never
detects or installs it.

### Forward finished sessions to a local server

You can send each finished session to a local HTTP endpoint. This works with
or without Datadog publishing. Set the URL during setup:

```bash
trajectory setup --clients cc --forward-url http://localhost:4997/api/v1/sessions/ingest
```

On an existing install, set the config key instead:

```bash
trajectory config set export.local_forward_url http://localhost:4997/api/v1/sessions/ingest
```

When `export.local_forward_url` is set, `trajectory serve` sends each session
to that URL when the session ends. It sends an HTTP POST with the full event
stream as NDJSON. Each NDJSON line is one Trajectory event. The schema is the
same one that Trajectory writes to `session.jsonl`.

Forwarding needs no Datadog credentials, so it works in capture-only setups.
Delivery is best effort. If the endpoint is down, Trajectory drops that
delivery, but `session.jsonl` stays on disk. To stop forwarding, set the URL to
an empty value.

## See usage, cost, and work patterns

### See recent sessions

```bash
trajectory status
```

This command shows recent sessions. To see one session as JSON, run
`trajectory status --session <id> --json`.

### See this month's usage

```bash
trajectory summary
```

This command prints a usage and cost report for the current month. For what
the summary and outcomes numbers mean, run `trajectory user-guide reports`.

### Track local cost

```bash
trajectory cost
```

The default view shows a stacked chart of cost by agent. The chart covers
seven rolling 24-hour periods and fits your terminal width. It shows the daily
average, the number of active periods, the peak, and a legend. Daily, agent,
and session tables follow the chart.

The view uses observed turns for each time window. It uses a whole-session
total only when it can place that total in the window safely. When data is
missing or unclear, the value stays unavailable.

Local USD is an estimate. It is not an invoice. Codex credits stay separate
from USD. A `*` marks a provisional value.

Use these commands for more detail:

| Command | What it shows |
| --- | --- |
| `trajectory cost pricing --since 7d` | How each price was chosen. Use it for pricing decisions. |
| `trajectory cost inspect --session <id>` | Cost and tokens for each turn of one session |
| `trajectory cost observations --session <id>` | The cost facts recorded for one session |
| `trajectory cost validate` | Cost coverage for recent sessions |
| `trajectory cost audit --latest` | Whether the queued cost metrics match the client's own records |
| `trajectory cost hotspots` | Files that agents read and edit most, with folder totals |

For windows, repair, pricing, and accuracy details, run
`trajectory user-guide costs`.

Before it shows a summary or ranking, `trajectory cost` imports and indexes
quiet saved sessions in its `--since` window. This covers Claude Code,
Codex and Codex.app, Cursor, Pi, and OpenCode. The Coverage section and the
`local_history` JSON field show what is on disk. They also show which cost data
is incomplete or unpriced. This step changes only local data.

Managed backfill finds live cost metrics that never reached Datadog. It sends
them again with their original timestamps. To see delivery status, run
`trajectory publish queue --kind metrics`.

`trajectory cost` also repairs stale Codex cost data for quiet saved sessions
before it shows results. It changes only token and cost fields. It skips
sources that are active or still changing, and it reports its work in JSON.
Sessions with missing data stay out of the totals. Rankings are then marked
partial, and known costs still show. For proxy rates, repair limits, and
accuracy details, run `trajectory user-guide costs`.

The `provisional_cost_estimates` feature is off by default. When it is on,
Trajectory prices rows that have no other price when it reads them. It does not
change stored attribution. A `*` marks those values.
`trajectory cost pricing --since <window>` shows the source, match method,
assumptions, and unresolved data for each price. Codex credits stay separate
from USD.

### Check cost metrics against the client's records

The `trajectory cost audit` check compares the client's own records with a
newly built session and the saved outbox. The outbox is the local queue of
metrics waiting to go to Datadog. To run it, turn on the preview flag first:

```bash
trajectory config features enable cost_contract_reconciliation
trajectory cost audit --latest
```

To audit the last day as JSON, run
`trajectory cost audit --since 24h --summary-only --json`.

The audit works like this:

- It never compares against old cost rows that have no source tag.
- It reports four kinds of problems separately: client-to-capture mismatches,
  capture-to-outbox over- or undercounts, timestamp or time-bucket errors, and
  delivery state.
- If client or saved data is missing, the result is `inconclusive`. It does not
  count as a pass.
- It reads saved outbox schemas without migrating them. It turns off side
  effects of rebuilding sessions.
- If a finished transcript cannot be used, it reports
  `session_materialization_failed` and checks the other sessions.
- Codex records above 8 MiB go to private temporary files. The audit then reads
  only the cost fields, so no record is too large to check.
- Billable aborted and superseded requests stay in the comparison.
- A repeated cumulative snapshot that did not change counts as usage from the
  turn before. It does not count as new usage.

### See what kind of work agents did

```bash
trajectory patterns
```

This command shows what kinds of work the agents did and how that work went.
The default report covers the last 7 days. To change the window, pass
`--period 30d`, `90d`, or `all`, or use `--since`.

The short default report shows these items:

- sessions, tasks, and turns
- the Work Insights v1 Level 1 and Level 2 task types, which describe outcomes
- the cost of agent work, task complexity, and a split by agent
- usage shape, such as average turns, and how many tasks took 1 to 2 turns
  versus 10 or more
- deliverables, such as commits and PRs

Add `--details` to also see a second set of coding-specific task types. It
also shows the outcome spread, PR attribution diagnostics, and the most
expensive turns. Each classified task counts once in both sets of task types.

#### How Trajectory counts deliverables

Trajectory counts these deliverables:

- commits
- PRs created and PRs worked on, each PR counted once
- Markdown and test files, each file counted once
- turns that changed files

The counts come from successful tool calls in any client, from PR-work
records, and from the client's local transcripts. Trajectory reads the
transcripts when its own output summaries were cut short.

Raw transcript text and file paths stay on your computer.

#### How Trajectory counts PRs

By default, Trajectory compares the PRs it saw locally with GitHub. It reads
the full list of PRs that your GitHub account authored in the same window. It
treats that GitHub list as correct and labels the headline **authored PRs**.
If GitHub authentication is not available, the label is
**session-observed PRs**. For a local-only report, pass `--github=false`.

These successful actions on an identified PR count as interactions: create,
checkout, inspect, comment, review, edit, merge, and close. Actions on a whole
collection of PRs do not count. Actions where the PR is unclear do not count.
Provider tools can name a PR by owner, repository, and number. That works even
when their output contains unrelated URLs.

With `--details`, the report adds these items:

- finished PR-work turns and their cost
- cost per attributed PR
- attribution sources and coverage
- authored PRs with no local interaction found
- PRs you worked on that have no PR-work cost data

### Inspect one session

```bash
trajectory patterns session SESSION_ID
```

This command shows one local session broken down by task and by turn.

The task table shows one row per classified task:

- a short label with private details removed
- the first and last turn of the task
- outcome, complexity, autonomy, and risk
- cost
- deliverables, with the data behind them

The turn table shows where each turn sits in its task. It also shows the turn
type, elapsed time, recorded cost and its source, tokens, tool calls, code
changes, model, and deliverables.

The `trajectory patterns` report lists its most expensive turns. Each row has
a command that you can copy to open that session. Trajectory shows large costs
as recorded, next to duration, tokens, tool calls, and source. It does not
judge a cost by its size.

Parent-turn costs and subagent costs add up. Coverage counts only turns and
subagents that have provider billing data. Control turns with zero usage do not
create a false pricing gap.

Add `--details` for short previews of the prompt, the response, and the
classifier's reasons. Add `--json` for the stable
`trajectory.patterns.session.v4` schema. The command only reads local data, and
it works when incognito is on.

### Automatic task segmentation is off by default

Automatic task segmentation is off by default.
While it is off, Trajectory makes no segmentation LLM calls. Session end
never waits on segmentation. No `trajectory.task.*` metrics are published,
including from managed task backfill. Settings such as
`segmentation.enabled`, `segmentation.interval`, and
`segmentation.publish_metrics`, from your own config or from managed or org
defaults, do not turn it on. Task rows that are already stored stay readable
in local reports.

To turn it on, enable the feature flag and reload serve:

```bash
trajectory config features enable automatic_task_segmentation
trajectory config reload --yes
```

A managed or org `features.disabled` entry for the flag wins over a user
enable. Explicit `trajectory segment` and `trajectory patterns analyze --yes`
runs still work while the flag is off. They store task rows locally, but
Trajectory does not publish task metrics from them until the flag is on.
`trajectory publish history --yes` leaves out task metrics while the flag is
off. A session it publishes then is not published again after you turn the
flag on, so its task metrics are not sent.

### Classify past sessions

Trajectory classifies sessions only when you ask, and it can resume after an
interruption. The default `trajectory patterns` report shows three groups:
fully classified sessions, unclassified sessions, and old or incomplete
sessions. It shows one estimated dollar amount to classify the rest of the
window. In a terminal, it asks you to confirm.

These commands never prompt and never start inference:

- non-interactive runs and `--json` reports
- `trajectory patterns estimate`
- `trajectory patterns analyze` without `--yes`

To classify the sessions, run:

```bash
trajectory patterns analyze --period 30d --yes
```

A confirmed run does these steps:

1. It finds and rebuilds missing local Claude, Codex, and Cursor sessions. It
   reindexes stale settled data without an LLM call.
2. It rebuilds finished Codex sessions when saved history has a standard
   connector call that the local cache lacks.
3. It adds any missing classification tables.
4. It classifies only finished top-level sessions that lack full task and
   per-turn coverage. It repairs each missing pass separately. It never
   classifies a complete session again.
5. It reconciles PR-work data and evaluates deterministic markers again from
   the finished local record.
6. It backfills only metrics that are not distributions. When
   `automatic_task_segmentation` is on, it also repairs saved Agent Console
   task metrics through Datadog historical ingestion.

Trajectory decides that a session is complete from its stored rows and its
Work Insights v1 task and turn coverage. Sometimes coding coverage needs new
task boundaries. Trajectory then refreshes the Work Insights task data against
the new boundaries.

Live Claude and Codex sessions get a snapshot of their finished turns, with no
fake end event. They stay out of final-session classification until their real
end event arrives. Trajectory waits on active Cursor sessions. Deliverable and
PR-interaction reports still include child sessions and sessions that cross the
window edge. Task classification counts finished root sessions only.

The local repair can change the plan after you confirm. For example, it can
change the session count, passes, tokens, providers, models, dollar estimate,
allowed inputs, or analysis scope. If that happens, the command stops before
its first classifier call. It shows the new estimate. Run the same `--yes`
command again to accept it. The run then uses the fixed list of sessions and
prompts that you confirmed. Sessions that arrive later wait for the next run.

The JSON output includes a SHA-256 of the analysis scope for automation. It
contains no session content. For sessions with incomplete coding coverage,
`dynamic_work_insights_passes` explains how the second prompt works. That
prompt uses the same transcript and turns, but takes its task groups from the
checked coding pass.

The dollar amount is a planning estimate. It is not a provider invoice. To run
only the local session and cost repair, use `--yes --repair-only`.
`--details` and JSON show short repair diagnostics with no session content.
Each one has the session ID, client, repair step, and a reason code.

Incognito does not stop this local analysis or its metric refresh. It still
stops trace publishing. Trajectory accounts for classifier cost separately,
under `user-driven-segmentation`. It never adds that cost to the agent-work
spend in `trajectory patterns` or `trajectory cost`. The run output and later
reports show the total analysis cost for the window, including failed tries.

#### Progress and workers

In a terminal, `trajectory patterns` commands print their current step to
stderr. Reports show steps such as client history discovery, window selection,
tool and marker scans, PR attribution, GitHub pages, and rendering. Analysis
shows prompt planning, local and cost repair, permission checks,
classification, and metric publishing. If a client's history cannot be read,
the report prints a short warning and still reports cached sessions.

Classification progress shows finished and total sessions, active workers,
elapsed time, an estimated time left, and slow or fallback providers. With
`--json`, stdout stays one JSON document because progress goes to stderr.

By default, a confirmed run uses 4 classifier workers in batches of 8
sessions. Use `--parallel N` to choose from 1 to 16 workers. Use
`--batch-size N` to change the batch size. Trajectory saves a receipt for each
finished session and reuses it after an interruption.

The metric step uses the original turn and PR-interaction times. It does not
use the time when markers ran again. So a 7-day repair stays inside the
selected 7 days, even when older sessions ran again recently. The step reports
finished sessions apart from active sessions, which wait until they finish. It
limits how often it repeats the same warning.

### Query local data

Trajectory has no general `trajectory query` command. Use these instead
to inspect local data:

- `trajectory status`
- `trajectory local-ui`
- the `get_session_trajectory`, `trajectory_schema`, and `trajectory_query`
  MCP tools

Pi registers these tools as native extension tools. MCP clients that setup
manages get the same tools through `trajectory mcp`. Ask for the schema first,
then run queries. For how to do this and how to use `TRAJECTORY_CACHE_DB`, run
`trajectory user-guide query`.

### Use the MCP tools

Clients that setup manages start `trajectory mcp` on their own. The MCP server
gives the agent tools and resources to look at its own data. It covers status,
active sessions, session data from JSONL, marker evaluation, incognito, and
read-only SQLite access with safety checks.

| Type | Names |
|---------|-------|
| Tools | `trajectory_status`, `get_session_trajectory`, `trajectory_incognito`, `trajectory_schema`, `trajectory_query`, `trajectory_search` |
| Resources | `trajectory://status`, `trajectory://config`, `trajectory://sqlite/schema` |

For SQLite queries, call `trajectory_schema` before `trajectory_query`. The
agent then uses the live database path and schema. For details, run
`trajectory user-guide mcp`.

## Troubleshoot

### Start with the doctor

When something does not work, run:

```bash
trajectory doctor
```

The doctor checks your local config, capture state, credentials, retry
queues, and metric destinations. Its first line says whether anything needs
action. Each problem follows, the most serious first, with the command that
fixes it.

Trajectory also saves the full low-level report to
`~/.trajectory/doctor-report.txt`. To see each subsystem check in the
terminal, run `trajectory doctor --verbose`.

### Find out why Datadog data is missing

If data in Datadog is missing or looks wrong, check one session:

```bash
trajectory doctor publish --session <id>
```

The command compares the local capture and the span mapping with the client's
transcript. Then it adds a metric publish plan from the local SQLite cache.
The plan shows how many metric points the cache expects and how many rows are
in the local metric outbox. It lists expected rows that are missing. It also
prints the command that reads the metrics back from Datadog. The doctor
command does not query Datadog itself.

### Repair a missing session end

The doctor also checks whether recent sessions ended correctly in the local
record. The `Sessions finalized` row compares Trajectory's recent JSONL
with the client's own transcript, rollout, or hook log. The check fails when
the client shows a clear end but Trajectory's JSONL has no `session_end`
event. Clear end markers include `SessionEnd`, `shutdown_complete`,
`away_summary`, and `stop_hook_summary`.

To fix these sessions, run:

```bash
trajectory doctor --repair-session-end
```

The command finds sessions it can repair. It prints the files and the end
markers it found. It asks before it appends anything.

To check one session without changing it, run:

```bash
trajectory publish session-end repair --session <id> --dry-run
```

To repair it, replace `--dry-run` with `--apply`. Confirm when asked, or pass
`--yes`. To also retry the final publish, add `--publish`. With `--apply` and
`--publish`, the command does these steps:

1. It refuses sessions that are still active.
2. It appends a synthetic `session_end` event, but only if a strong end marker
   is still in the client's records.
3. It retries the final publish.

Older end markers, such as `Stop` or `task_complete`, are weaker. If a session
has only those and no recent heartbeat, the command warns you. For those
sessions, start with `trajectory doctor publish --session <id>`.

### Diagnose Codex problems

If Codex starts or exits slowly, check the default `trajectory doctor` output
first. It shows recent MCP start and stop timing and any Codex startup traces.
If the cause is still unclear, run:

```bash
trajectory doctor --codex-startup
```

This command runs a Codex startup probe with a time limit. The probe shows
where the delay happens. The delay can be before `thread_spawn`, before Codex
starts Trajectory MCP, or inside Trajectory.

If Codex turns repeat or LLM Obs spans look wrong, look for these signals:

| Signal | Type | Meaning |
| --- | --- | --- |
| `codex.session_id_change_ignored` | Serve diagnostic event | A replayed Codex rollout tried to change `session_id` after the first `session_start`. Trajectory kept the original child session ID and ignored the parent context. |
| `trajectory.instrumentation.capture.gap` with `client_source:codex`, `signal:jsonl`, and `reason:duplicate_event` | Instrumentation-health metric | Codex JSONL had more than one `session_start` for the same session. |
| `incompatible duplicate span identity` | Publish error | Two spans in one export batch had the same `(trace_id, span_id)` but different content. Trajectory stopped that export. |
| `skipping incomplete turn ... (incremental)` | Publish log | A turn had no `turn_end` yet, so Trajectory waited. It did not publish part of a turn. |

### View logs

To see the last 50 lines of the capture server log, run:

```bash
trajectory doctor logs
```

These flags change what you see:

| Flag | Effect |
| --- | --- |
| `-f` | Follows the log as it grows, like `tail -f` |
| `-n 100` | Shows the last 100 lines |
| `--grep publish` | Shows only lines that contain `publish` |

You can combine flags. For example, `trajectory doctor logs -f --grep error`
follows only error lines.

### Collect support data

To collect data for support, run:

```bash
trajectory flare
```

The command writes a redacted ZIP file under `~/.trajectory/` that you can
share. The ZIP contains doctor output, process state, metric diagnostics,
config files, and managed `config.defaults.yaml`. It also has cohort overlay
files, the end of each log, and version and pricing details.

If support needs the raw data for one session, run
`trajectory flare --privileged --session <id>`. Review that ZIP before you
share it. For the older single-JSON support summary, run
`trajectory doctor --support-bundle`.

### Check the client and capability inventory

```bash
trajectory setup refresh --json
```

This command scans the computer and writes an inventory file under
`~/.trajectory/inventory/`. It prints the clients it found and the
capabilities that Trajectory manages. Capabilities include hooks, MCP entries,
skills, commands, plugins, and settings sources.

To read `current.json` without a new scan, run
`trajectory setup status --json`. To list the saved snapshots under
`snapshots/`, run `trajectory setup status list --json`. Each snapshot file is
named by its hash.

Use these commands for support triage, or to check whether a product pack has
changed. Trajectory does not send these inventory files to Datadog yet.

### Check the local data that local-ui reads

```bash
trajectory session audit --source-data
```

This command checks the local SQLite cache that local-ui uses. It checks these
things:

- Finished sessions are finalized.
- Turn and session totals match for turn count, tools, input tokens, output
  tokens, cache-aware total tokens, and cost.
- Tool calls have the right parent.
- Model and cost attribution are present.
- Turn IDs have no gaps.
- Active turns have content.

It checks input and output tokens separately. A matching combined total cannot
hide drift in one of them.

Add `--json` for output that scripts can read. Add `--db <path>` to check a
cache in another place. The `session_turn_aggregate_drift` check must pass.

To also explain local capture, trace-off settings, missing model or cost
attribution, and the 24-hour LLMO trace intake limit, run
`trajectory session audit --deep`.

### Find and repair local data problems

```bash
trajectory session audit data
```

This command checks the local data in nine areas. The areas are sessions,
conversations, tools, delegation, usage, outcomes, optional analysis, storage
matches, and local delivery. The default view prints one line per area.

The session and file checks cover all your data. The event-level checks cover
the newest 100 sessions by default and print what they covered. The default
run also skips the slow content, usage-outlier, and outcome checks. Use `--all`
to scan every saved session and run the deep checks.

For one Codex rollout with a very large token count, the client-record replay
reads at most 64 MiB. If the file is larger, missing, or not supported, the
result is `unverified`.

Add `--details` to see each finding, or `--json` for automation. The report
keeps missing data apart from a checked zero. The delegation area compares
`subagent_start` events with the subagent rows in the cache. It also checks
saved GitHub Copilot CLI history fingerprints. Pi delegation is reported as
unsupported.

The audit only reads data. When it finds sessions it can repair, write a plan
and read it before you apply it:

```sh
trajectory session audit data --write-plan repair.json
trajectory session audit data apply --plan repair.json --yes
```

The first command writes the plan. The second command applies it. To plan
repairs for some areas only, add `--only delegation` or
`--only delegation,storage` to the first command. The report still covers every
area. Each planned action keeps its area and finding IDs.

The apply step refuses a plan in these cases:

- the plan has expired
- a source file has changed
- a client feature it needs is off
- a repair is not clear

It uses the full-session import and index paths. Then it checks that each
planned gap is closed. By default, it writes a receipt to
`repair.json.receipt.json` and never overwrites it. Use `--receipt PATH` to
choose another new path.

`trajectory doctor` uses the same data-health report and points to this audit.
The doctor never applies a plan.

For one guide to the doctor, publish checks, audits, span checks, and support
bundles, run `trajectory user-guide diagnostics`.

## Publish to Datadog

### Check publish settings

To check your publish configuration, trust policy, and credentials, run:

```bash
trajectory publish validate
```

It reports where each credential comes from. It also checks that each value
looks right, without printing secrets.

The background service looks up its own credentials. A `DD_API_KEY` exported
in your shell does not reach a service that is already running or that another
app starts. So `publish validate` also checks the credentials each running
service found, and fails if one of them has none. To give the service a key it
can always find, run `trajectory config set-secret dd_api_key` or set
`auth.key_command`, then run `trajectory serve restart`.

To see the current publish mode, run:

```bash
trajectory publish status
```

It shows modes such as metrics-only and trace-off. It warns when your
`export.site` has no active destination while data goes to a different site.
For example, this happens with `metrics:false` and `traces:off`.

Neither command checks that Datadog accepted the data. Neither one reads data
back from Datadog.

To see what Trajectory would publish, run `trajectory publish preview`.

### Check that metrics reach Datadog

Start with these two commands when you first set up metrics.

To preview metrics for your newest session, run:

```bash
trajectory doctor metrics session --latest
```

This command rebuilds the metrics that Trajectory derived from the local
cache. It prints the metric names, the main session tag filters, and the outbox
status. It does not send old metrics to Datadog. Sessions older than 24 hours
are always local-only previews. Sending old metrics and reading them back is
not reliable during first setup. To preview another session, use
`--session <id>`.

To send test metrics, run:

```bash
trajectory doctor metrics canary --publish
```

Without `--publish`, the canary only builds test metrics locally. With
`--publish`, it sends metrics with the current time through the normal publish
path. It prints a `trajectory.canary_run` tag and a Metrics Explorer URL that
identify the points it sent. It never replays or time-shifts old sessions.

To also query Datadog for those metrics, add `--readback`. It needs
`--publish`. If the query fails, the canary reports a failed check. It never
changes modes without telling you.

To print the latest saved result again, run `trajectory doctor metrics last`.
To open its Metrics Explorer URL again, run `trajectory doctor metrics open`.
Trajectory saves local-only runs for diagnosis, but `metrics open` refuses
them because they sent no points to Datadog.

If `metrics session` reports no eligible destinations, turn on base metrics
first:

```bash
trajectory config set export.metrics true
trajectory config reload --yes
trajectory doctor metrics canary --publish
```

The first command turns on metrics. The second applies the change to the
running server. The third sends test metrics so you can check them in Datadog.

To read metrics back from Datadog, you need an application key with the
Metrics query permission. Save the key, then name the destination:

```bash
trajectory config set-secret dd_app_key --stdin
trajectory doctor metrics canary --publish --destination <name> --readback
```

### Audit published metrics

For a deeper check that only reads data, run:

```bash
trajectory publish metrics audit --latest
```

Add `--builtin-details` to list every built-in metric. Each metric is marked
`observed`, `not_observed`, or `out_of_scope` for the local data you chose.

The audit leaves out `content_length_estimate` token and cost rows from the
expected values. It warns when your sessions have those rows, so you can see
why the estimated cost is lower.

To query Datadog for stable dashboard metrics outside first setup, save an
application key and add `--readback`:

```bash
trajectory config set-secret dd_app_key --stdin
trajectory publish metrics audit --latest --readback
```

For CI, canaries, or incident follow-up, add
`--readback-all --strict-fidelity`. Every sent outbox group must then read back
from Datadog with the same values. This includes duration and last-seen
metrics, which change often. Strict mode fails in these cases:

- expected rows with source tags are missing
- extra rows are present
- rows are not `sent`
- a source label is unknown
- the read from Datadog is incomplete

Older sessions can have rows from before the current metric catalog added its
source tags. The audit reports those rows as `historical_contract_drift`. It
still shows the counts of missing and unexpected rows. This state is normal for
old rows. On a new session or canary, it means the current code is not sending
the required source tags.

### Audit cost metrics for an incident

For a cost-only incident, use `trajectory cost audit`. It works differently
from the broad audit:

- It does not build both sides of the comparison from the live local cache.
- It rebuilds the session from its JSONL.
- It checks the client's own records where Trajectory supports that.
- It reads the saved outbox without setting it up or migrating it.

It only reads local data. To check whether sent points are visible in Datadog,
use the broad audit with `--readback`.

### Create log-based metrics

`trajectory publish sync` creates log-based metric definitions through the
Datadog Logs configuration API. It needs the Datadog API key that you use for
publishing and a Datadog application key.

`publish validate` can accept your API key while `publish sync` still fails.
This happens if `DD_APP_KEY` or `dd_app_key` is missing, or the key cannot
write log configuration. To save the application key, run:

```bash
trajectory config set-secret dd_app_key --stdin
```

### Run the full metric canary

To check every built-in metric across simulated clients, run the synthetic
canary:

```bash
trajectory publish metrics canary --clients all --runs-per-client 2 --include-diagnostics --publish --readback
```

The canary works like this:

1. It builds one expected point for each built-in metric that a session can
   audit.
2. With `--include-diagnostics`, it also sends the process and
   instrumentation-health metrics once per destination.
3. It tags each run with `trajectory.canary_run`.
4. It sends the points through the same path that real metrics use.
5. It queries Datadog Metrics until each expected metric group reads back with
   the same values.

If you configure more than one Datadog metric destination, pick one with
`--destination <name>`.

If an OTLP destination loses task scores of zero, add
`--zero-task-score-probe`. The canary then saves a separate
`trajectory.task.risk_score=0` row in its own outbox. It checks the encoded
OTLP point and sends it through the normal outbox. It reports two results
separately: whether Datadog intake accepted the point, and whether a Datadog
query returns it. The probe needs OTLP metrics transport. It works with only
one destination.

For the publish runbook, run `trajectory user-guide publish`. It covers
validate, status, preview, missing Datadog data, `publish sync`, and publish
ledger repair.

### Check marker metrics

To check that marker metrics reach Datadog, run:

```bash
trajectory patterns markers canary --keep-home
```

It runs a synthetic session in its own home folder. It checks the local
marker, cost, token, and assistant-message results. Then it prints Datadog
queries for your destination.

### How publish retries work

Trace and final-session retries use a local outbox at
`~/.trajectory/state/trace-publish-outbox.sqlite`. The outbox stores only
metadata, not session content.

A `trajectory serve` process can capture an event without Datadog credentials.
It then records which LLMO data it owes and returns a publish error. It never
skips the event without telling you. Any other serve process with credentials
can later claim a small batch. It rebuilds the Datadog payload from the local
JSONL.

New turn rows record each destination that still needs the turn. They store
no secrets. So recovery does not send a turn again to a destination that has
it. Recovery also does not follow a destination name that now points to
another endpoint or credential. The live hook claims its row before it sends,
so a periodic retry cannot send the same turn at the same time.

`trajectory doctor` reports trace outbox rows that are pending, retryable,
failed, stale, or dropped.

### Build cost dashboards

Read `trajectory user-guide cost-attribution` before you build cost
dashboards. Ungrouped cost metrics give totals that you can add up. Do not add
turn, session, and PR views of the same usage. To share the full guide, link to
[COST-ATTRIBUTION.md](COST-ATTRIBUTION.md).

Read `trajectory user-guide cost-reconciliation` before you treat a cost total
as correct. It describes what each cost source covers. The sources are
Trajectory, the client, the provider, the gateway, the cloud, and Cursor. It
explains how to handle different ways customers collect data. For each kind
of data, it says how closely you can match it to a bill.

## Configure Trajectory

### Read and change settings

| Task | Command |
| --- | --- |
| Show the merged config that is in effect | `trajectory config show` |
| Read one value | `trajectory config get <key>` |
| Set one value | `trajectory config set <key> <value>` |
| Save a secret in the OS keychain | `trajectory config set-secret <name>` |
| Turn on a feature flag for your user | `trajectory config features enable <name>` |
| Turn off a feature flag for your user | `trajectory config features disable <name>` |
| Stop all capture for your user | `trajectory config capture disable` |
| Start capture again for your user | `trajectory config capture enable` |

For the full config schema, read `trajectory user-guide config`. It lists the
keys you can set, how config layers combine, the environment overrides, and
the transport values. For repository `publish.trajectory.yaml` overlays and
per-destination publish settings, read `trajectory user-guide publish`.

### Common settings

| Command | Effect |
| --- | --- |
| `trajectory config set export.site datadoghq.com` | Sets the Datadog site |
| `trajectory config set export.traces standard` | Sets the trace level: `off`, `minimal`, `standard`, or `full` |
| `trajectory config set export.metrics true` | Turns on metrics |
| `trajectory config set export.placeholder_llm_span false` | Stops the synthetic LLM span that carries only cost |
| `trajectory config set export.index_traces.session true` | Adds an optional session index span |
| `trajectory config set export.subagent_span_mode links_only` | Publishes only links for subagents, with no parent-side subagent task spans |
| `trajectory config set export.oversight_publish_mode summary` | Sets oversight publishing: `summary` (the default), `full`, or `off` |
| `trajectory config set local_ui.auto_start false` | Stops local-ui from starting automatically |
| `trajectory config set-secret dd-api-key` | Asks for the API key without showing it |

### Apply config changes

After you change config or credentials, preview the reload:

```bash
trajectory config reload
```

If it lists processes to reload, run `trajectory config reload --yes`. Then
check the result with `trajectory ps`.

The owner process does not reload while coding sessions are open. In that
case, `--yes` reports that the process will reload when its open sessions end.
The process keeps the request and reloads by itself when the last session ends.

Publish, export, and identity changes usually reload in place. Some changes
affect the process itself. Examples are listener, capture, org-sync, and
module settings. The reload reports those changes as
restart-required. A config reload never replaces a running owner process
without telling you.

These reload options are also available:

| Command | Effect |
| --- | --- |
| `trajectory config reload --yes` | Asks the running owner process to reload its config |
| `trajectory config reload --force` | Forces checked Trajectory processes to reload |
| `trajectory ps --reload PID --force` | Forces one checked process to reload |

### Turn capture off and on

To stop capture for your user, run:

```bash
trajectory config capture disable
```

The command writes `~/.trajectory/capture.disabled`. After that, Trajectory
drops new hook, watcher, and OTLP events and writes no JSONL for them. Servers
that are already running drop them too. To start capture again, run
`trajectory config capture enable`.

To stop capture for one process tree only, set `TRAJECTORY_DISABLED=1`. This
environment variable overrides the saved user setting. Unset it before you
start that process again.

During compatibility updates, Trajectory can write a special internal marker
to the same path. This marker stops capture in older released clients. Current
clients go on to check each client's policy, and that check decides. Current
hooks treat only that special marker as selective. A symlink, bad contents, or
any other marker still turns off all capture.

### Override feature flags for one process

To turn feature flags on or off for one process, set these environment
variables:

- `TRAJECTORY_ENABLE_FEATURES=name_a,name_b`
- `TRAJECTORY_DISABLE_FEATURES=name_a,name_b`

If a flag is in both, it is off. User config cannot turn on a flag that managed
`config.defaults.yaml` turns off. For rollout rules and the list of flags, see
[`FEATURE-FLAGS.md`](FEATURE-FLAGS.md).

### Save credentials

`trajectory setup` and `trajectory config set-secret` protect your current
key. Before they change a keychain value, they save a copy. If the write
fails, they try to put the old value back.

To add a missing Datadog key, run `trajectory config set-secret dd_api_key`.
For a quick test, you can also set `DD_API_KEY` or `DATADOG_API_KEY` for one
shell.

Environment variables belong to one process. A `trajectory serve` process that
started before you exported `DD_API_KEY` cannot see it. Codex hooks that setup
manages call `trajectory capture-hook --client codex --ensure-serve` from the
installed binary path. This lets them start a matching local capture server and
keep events in order. For agent sessions, a saved credential still works best.
Use one of these options:

- Save the key once with `trajectory config set-secret dd_api_key`.
- Set `auth.key_command`.
- Run setup again with `DD_API_KEY` set.

### How Trajectory finds the Datadog API key

By default, `auth.credential_source` is `auto`. Trajectory then tries these
sources in order and uses the first one that has a value:

1. the environment variable named by `api_key_ref`
2. `DD_API_KEY`
3. `DATADOG_API_KEY`
4. the credential command in `auth.key_command`, if one is set (a managed
   value wins over yours)
5. the OS keychain
6. the destination's `api_key_command`

For standard API key lookup, `dd-api-key` and `dd_api_key` mean the same key.
Setup saves `dd_api_key`, and publish config often names `dd-api-key`.

Managed keychain installs work differently. They use the key names they are
given and nothing else. They do not treat the two names as the same key, read
environment variables, or run key commands. Managed `auth.mode:
managed_keychain` from MDM always wins.

An environment variable can hold a secret-manager ID in place of the Datadog
key. In `auto` mode, Trajectory reports this and moves on to the next source
for real Datadog destinations. If you want Trajectory to fail when one source
is wrong, pin that source:

```bash
trajectory config set auth.credential_source keychain
trajectory doctor
```

The first command pins the keychain as the only source. The other values are
`auto`, `env`, `key_provider`, and `api_key_command`. The second command
checks the result. If `auto` would pick a bad Datadog environment variable,
`trajectory serve` logs a warning before its first publish.

### Send metrics only

To send metrics to Datadog without traces, keep `export.traces` off and set
`export.metrics` to true:

```yaml
export:
  site: datadoghq.com
  ml_app: coding-agents
  traces: off
  metrics: true
```

### Choose a destination type

Do not add `type` under `export:` in your normal `~/.trajectory/config.yaml`.
Trajectory builds the built-in `_config_datadog` destination from the
`export.*` fields. Use destination `type` only in a `destinations:` list or a
managed `required_destinations:` list.

These settings control different things:

- Destination `type` chooses the backend.
- `export.traces`, or the destination `level`, controls LLM Obs trace spans.
- `export.metrics`, with the destination's metric settings, controls metrics.

These destination types are available:

| Type | Use |
| --- | --- |
| `datadog_agentless` | Sends traces and live metrics to Datadog over agentless OTLP. Trajectory loads the retired `traces_transport: direct` setting and released native metrics settings, but ignores them. |
| `datadog_agent` | Publishes through a Datadog Agent |
| `otlp` | Sends to a generic OpenTelemetry collector |
| `datadog` and `dd_llmobs` | Older types that still work |

For `type: otlp`, set a base collector `endpoint`. Trajectory adds
`/v1/traces`, `/v1/metrics`, and `/v1/logs` to it.

### Publish module spans

Some modules record their own APM-style spans. For example, AI Guard records a
span for each hook check. Normal LLM Obs turn traces do not use this setting.
Trajectory saves these spans locally in `~/.trajectory/modules/spans.jsonl`.

To publish them, a managed or trusted destination sets
`module_spans.enabled: true`. Publishing works like this:

- It is off by default.
- It covers only the modules you name.
- The publish ledger removes duplicates.
- Repository `publish.trajectory.yaml` config cannot turn it on.
- Datadog destinations send the spans as agentless OTLP traces.
- `type: otlp` destinations send them to the configured collector.

Use `otlp_traces_url` only for tests or special Datadog trace intake routing.

Some collectors support native OTLP maps and arrays. For those, you can turn on
`module_spans.native_composite_attributes` one module at a time. Each
destination has its own setting, because collectors differ. One collector can
keep the structure, while another gets JSON strings. Scalar values do not
change.

The allow list controls only what Trajectory sends. A collector can still
accept native maps and arrays but flatten them or turn them into strings when
it indexes them. A nested JSON null can arrive as an empty OTLP `AnyValue`.
Read the data back from the destination and check it before you add more
modules to the list.

### Send Claude Code's own telemetry through Trajectory

`server.otlp_proxy` controls the OTLP listener in `trajectory serve`. It is
separate from publish destinations. The listener receives the client's own
logs, metrics, and traces, such as Claude Code's OTel stream:

```yaml
server:
  otlp_proxy:
    enabled: true
    endpoint: https://otlp.datadoghq.com
    api_key_ref: dd-api-key
```

The proxy forwards `/v1/logs`, `/v1/metrics`, and `/v1/traces` payloads to the
upstream `endpoint`. It decodes metric payloads and encodes them again in the
same OTLP protocol. This lets Trajectory add its identity tags and these tags:

- `trajectory.proxy.source:serve-otlp`
- `trajectory.cost_role:client_telemetry`
- `trajectory.cost_source:claude_native_otlp`

Trajectory keeps Claude Code's own span tree. This includes `claude_code.tool`
spans with `skill_name`, when Claude is set to emit tool details.

Before it forwards Claude's native traces, Trajectory moves them to their own
LLM Observability ml_app. By default, the name is
`<export.ml_app>-claude-native`. To choose another name, set
`server.otlp_proxy.native_ml_app`. It can never equal Trajectory's own ml_app.
The native session becomes `claude-native:<session>`. The raw session ID stays
in `claude_code.session_id`, so you can match it with the Trajectory session.
You can query native traces without mixing them into Trajectory's sessions.

Your Claude settings may already send OTLP to a collector. In that case,
`trajectory claude` adds a relay for each launch:

1. Claude exports to a private relay on the loopback interface.
2. The relay forwards the separated traces to that same collector, with the
   headers that Claude sent.
3. The relay gives the local server a copy.

This works whether or not the server was already running. Trajectory does not
add the relay in these cases:

- Managed Claude settings set the OTLP route.
- Claude settings export OTLP over gRPC. The relay forwards only OTLP/HTTP.

To see which route Trajectory picks, run `trajectory claude --dry-run`.
Trajectory still builds its local trace summary from the original request.

The proxy is best effort, and it never blocks the coding agent. Local capture
still works when Trajectory cannot add tags or reach the upstream.

To inspect forwarded metrics and Claude's native tool and skill spans, use the
upstream backend.

After you change this config, restart long-running serve processes. Every
listener then uses the same settings from disk.

### Trace export options

Trace export is off by default. To publish sessions to LLM Observability, set
`export.traces`.

If you run `trajectory setup` again, it keeps an existing trace setting other
than `off` and prints the level. If the setting is `full`, interactive setup
asks before it keeps it. The safe default answer switches back to `off`.
Non-interactive setup cannot ask, so it prints a clear warning when it keeps
`full`.

Use these settings to change the trace shape:

- **Placeholder LLM span.** Trajectory adds a synthetic LLM child span to
  each turn for token and cost data. To stop it, set
  `export.placeholder_llm_span: false` in `~/.trajectory/config.yaml`. On a
  managed or trusted `publish.trajectory.yaml` destination, set
  `placeholder_llm_span: false`. The turn span still has
  `metrics.estimated_total_cost`, cost fallback details, and the
  `trajectory.cost_source:turn_metrics` tag. So you can still query cost.
  Project config can turn the span off for a trusted destination. It cannot
  turn the span back on if the trusted or managed destination turned it off.
- **Session index span.** To add a link-only session index span at session
  end, set `export.index_traces.session: true`. On a managed or trusted
  destination, set `index_traces.session: true`. It is off by default because
  traces start at the turn. Project config can turn off a trusted
  destination's index span. It cannot turn one on that the trusted destination
  did not allow.
- **Subagent spans.** By default, `export.subagent_span_mode` is `semantic`.
  A subagent that runs in step attaches under the Agent or Task tool span that
  started it. A background subagent attaches under the turn that receives its
  task notification. Use `links_only` to keep the child trace links without
  the extra subagent task span on the parent side.

### Automated oversight reviewers

Some model-based reviewers run on their own to judge an action or an output.
Trajectory reports them as automated oversight. It does not count them as user
sessions or as subagents that do work.

`export.oversight_publish_mode` controls what Trajectory sends for them:

| Value | Effect |
| --- | --- |
| `summary` (default) | Sends one oversight result with no content, plus a few usage metrics. It does not send the reviewer's transcript trace. |
| `full` | Also publishes the reviewer trace as `trajectory.trace_type:oversight` |
| `off` | Sends no new oversight spans or metrics for that destination |

You can set the same key on a trusted publish destination. Project overlays can
only make it stricter.

Local UI hides reviewer sessions from the normal session list by default. To
see them, open the **Oversight** tab in `trajectory view`. The tab shows counts
with no content, outcome rates, and reviews per 100 normal turns. It also shows
p50 and p95 added latency, oversight-only tokens, reportable cost, and filters.
Provider role and feature are local diagnostics only. They do not become
public metric tags.

### Turn off local-ui auto-start for a fleet

To stop local-ui from starting automatically across a fleet, deploy
`local_ui.auto_start: false` in managed `~/.trajectory/config.defaults.yaml`.
User `config.yaml` cannot override a managed `false`. The
`trajectory local-ui` command still works.

## Update Trajectory and recover processes

### Update to the latest release

To recover from a stuck update and install the latest release in one step,
run:

```bash
trajectory update --force
```

The command does these steps in order:

1. It quarantines old or inconsistent activation and selector data.
2. It retries a latest release that was blocked on this computer.
3. It keeps a checked previous release that works, even when a newer pending
   release replaced the one in between.
4. It installs the checked latest release.
5. It replaces the current user's processes.

It still follows managed deployment policy and release selection. It still
checks the signature, checksum, version, readiness, user, and process names.
To recover only the update state, without stopping processes, run
`trajectory update --force-recover`.

Caution: `trajectory update --force` stops processes without the usual
ownership checks. The OS picks the current user's processes named
`trajectory`, `trajectory.real` and `trajectory-*`. The command then skips the checks for
coordinator ownership, generation, process identity, heartbeat, active
sessions, and the outbox. It sends TERM, then KILL after a time limit. Then it
restarts the target.

The only process it does not stop is the one that runs the update. A top-level
update first runs the installed target binary, and then it replaces processes.
So no older Trajectory supervisor has to survive the sweep.

`--force` still checks artifact integrity, version, managed deployment, and
target readiness. It never targets another user's processes. Other `--force`
commands keep their own, smaller set of skipped checks, as their docs describe.
`trajectory serve ensure` never forces a restart. A request to start the server
does not allow Trajectory to stop the running one.

### Retry or force a process handoff

| Command | Effect |
| --- | --- |
| `trajectory update repair` | Shows why an update handoff is waiting. It changes nothing. |
| `trajectory update repair --apply --yes` | Retries the coordinated handoff to the installed version |
| `trajectory update repair --apply --yes --force` | Replaces the current user's Trajectory processes now |
| `trajectory serve replace --force` | Does the same forced replacement in one command and waits for a ready server |
| `trajectory serve retire-stale --yes --force` | Stops a stale owner process even when sessions are active |
| `trajectory update repair --apply --yes --reload-config` | Also reloads managed config and credentials, and checks required destinations |
| `trajectory update repair --apply --yes --allow-publish-interruption` | Hands over before the new process can confirm its Datadog credentials |

The forced repair does not stop when ownership or identity is unclear. Before
it signals any process, it marks the installed binary as pending. An old
probation selector, which marks a release that is still on trial, then cannot
make the replacement exit. `trajectory serve replace --force` finds the
version, replaces the processes, and checks that a ready owner exists.

`--allow-publish-interruption` is for a handoff that an SDK or embedding host
starts on purpose. For example, the new credentials may arrive separately. The
command still checks the owner, active sessions, the outbox, and whether the
new process is ready. It lets the new process start before it can confirm its
Datadog publish credentials. Automatic updates never use this mode.

`--reload-config` is for a managed recovery that must also apply the current
org config and new keychain credentials. The command targets the ready owner.
It fails unless every managed required destination in scope is active in a
fresh health check. You must run it by hand. Normal and automatic updates keep
their own handoff behavior.

### How automatic updates hand over

After a binary update, the old process keeps running. It waits until a
registered client calls a hook. That hook call then takes over the pending
update. It can stop old Trajectory processes that are detached or orphaned,
without the usual ownership checks.

The hook call works like this:

1. It delivers the hook event that started it.
2. It checks each process again before it signals it.
3. It starts the installed target.
4. It confirms that one serve owner, and only one, is ready.

Trajectory matches hooks that a shell wraps to the client process that
started them. While an activation is pending, a healthy Codex relay can also
start this handoff. The handoff does not wait for coordinator identity, such
as `process_identity_reused`.

After the restart, startup catch-up and backfill rebuild any missing data.
They read the client's saved history, Trajectory's session JSONL, delivery
receipts, and publish outboxes. You do not need to end active agent sessions.

A newer release can arrive while an earlier one still waits for activation.
The updater then checks the installed pending binary and both saved release
images before it goes on. It keeps the previous release that is known to work.
If activation or selector data is corrupt, the updater first checks the
installed or downloaded binary. Then it quarantines the bad sidecar file and
rebuilds the update. The updater never interrupts another process that is
writing the binary. It stops and tries again at the next maintenance run.

A serve process can start normally and find a pending probation selector for
another version. It then keeps running as a normal capture owner. It does not
claim or promote that version, which stays pending for a later activation.

If no registered client calls a hook, the old process keeps serving on purpose.
The activation stays pending.

### Turn off automatic process replacement

To turn off automatic process replacement completely, set
`TRAJECTORY_UPDATE_RECONCILE_PROCESSES=false`.

To go back to automatic recovery with the usual ownership checks, turn off the
`automatic_nuclear_update_replacement` feature. You can turn it off in user
config, managed config, or `TRAJECTORY_DISABLE_FEATURES`. A `--force` command
always does the full replacement.

### Update managed installs

After a managed installer puts a binary in place, it runs this command:

```bash
trajectory update converge --yes --force --target-version VERSION --source managed-post-install
```

If that version is older than the release the runtime selected, the command
prints a warning and still switches to it.

To preview what convergence would do, run
`trajectory update converge --dry-run`. With `--target-version`, the preview
includes `"downgrade": true` when the version is older.

Managed org config can also publish a `deployment.json` generation that never
changes after it is published. A generation names a target version to move
forward to, or a controlled rollback. While that managed policy is active,
release-ring checks fail closed. `trajectory update` then tells you to run
`trajectory update converge --yes`.

If controlled downgrade is on, generations that Trajectory accepted before can
fix a binary that drifted to another version, in either direction. A new older
target still needs both of these:

- a new `rollback` generation
- the separately managed `controlled_binary_downgrade` feature

### Run the capture server

The capture server receives hook events from your coding agents on port
19222. The client's plugin hooks start it when a session starts, so you rarely
need to start it yourself.

To run the capture server in the foreground, run:

```bash
trajectory serve
```

To hand capture to a development binary for a while, run
`trajectory dev serve` from that binary.

## Uninstall

To stop capturing some clients and keep the rest of Trajectory, see
[Remove a client](#remove-a-client).

To remove a personal install, run:

```bash
bash ~/.trajectory/uninstall.sh
```

The script removes every client integration, stops the capture server, and
then removes the binary. If any client cleanup fails, it stops before it
removes the binary. To see what it would remove, add `--dry-run`.

The script keeps your sessions in `~/.trajectory/trajectories/` and your
`~/.trajectory/config.yaml`. To delete them too, add `--remove-data` or
`--remove-config`. To delete all of `~/.trajectory/` and every known or
ownership-tracked Trajectory keychain entry, add `--purge`.

If your organization installed Trajectory through MDM, an administrator
removes it. See the
[Managed Endpoint Admin Guide](MANAGED-ENDPOINTS.md).

For the full reference, run `trajectory user-guide install`.

## Privacy controls

### Use incognito

Use `/incognito` when the current session must not send content to normal
Datadog observability destinations. Local JSONL capture continues. Task
segmentation and semantic analysis also continue.

Trace and log outputs are not sent to Datadog destinations, except exempt
ones. These outputs include traces, records, and AI-usage events. Accounting
and activity metrics are still sent.

By default, `export.incognito_metrics: redacted` leaves out model and
repository names. The metrics keep these fields:

- session and user identity
- timestamps
- cost, tokens, and activity
- client and version
- semantic results
- host and OS
- cost method

Set the mode to `standard` to send the normal metric tags. Some models are
always model-redacted in metrics and AI Usage events, even in `standard`
mode. Those metrics carry `trajectory.model_disclosure:redacted`. There is
no metric-off mode, because cost and token accounting always continues.

Session incognito turns off when the session ends. Organization-managed
destinations with `incognito_exempt: true` can still receive events for
approved security or audit use.

### Mark sensitive text

Use `<sensitive>...</sensitive>` blocks as a signal to the agent and to human
readers:

```text
<sensitive>
Customer details, HR/legal content, credentials, or private investigation notes.
</sensitive>
```

These tags are only a convention. Trajectory does not redact the text inside
them. It can capture the tags and the text locally. If the content must not go
to normal Datadog destinations, turn on `/incognito` before you share it. Keep
sensitive values out of metric tags and marker dimensions.

For the managed-install version of this guidance, run
`trajectory user-guide privacy`.

## Import past sessions

Use backfill for maintenance tasks:

- importing past sessions
- refreshing the local UI cache
- checking how past metrics were derived, on your computer only

You do not need backfill to start using metrics. For that, run
`trajectory doctor metrics session --latest` and
`trajectory doctor metrics canary` first.

Normal backfill does not send past token and cost data again. When backfill
does publish, it uses the live metric names with their original timestamps.
Corrections move forward in time.

### Import commands

| Task | Command |
| --- | --- |
| Import Claude Code transcripts and refresh the local UI | `trajectory session import claude && trajectory session refresh-local` |
| Refresh the local UI from cached sessions | `trajectory session refresh-local` |
| Import Codex rollouts, newest first, from active and archived folders | `trajectory session import codex --limit 100` |
| Import GitHub Copilot CLI history | `trajectory config features enable copilot_durable_history`, then `trajectory session import copilot` |
| Repair one Hermes session from `state.db` | `trajectory config features enable hermes_durable_history`, then `trajectory session import hermes --session <id>` |
| Import one OpenCode session from SQLite or saved JSON | `trajectory session import opencode --session <id>` |
| Import one Qwen session from active or archived chat JSONL | `trajectory config features enable qwen_durable_history`, then `trajectory session import qwen --session <id>` |
| Check past metrics locally, without sending | `trajectory publish metrics audit` |
| Fill gaps in live cost, session, and task metrics | `trajectory publish history --last 30d --yes` |

Each feature flag above needs to be turned on only once.

For Claude Code, imports and token repair use `CLAUDE_CONFIG_DIR` when it is
set. Trajectory then reads transcripts from `$CLAUDE_CONFIG_DIR/projects` and
not from `~/.claude/projects`. It never merges the two folders.

### How backfill publishes

Backfill sends live metric names again with their original timestamps. It uses
Datadog Historical Metrics Ingestion. Managed Datadog destinations accept
backfill unless they set `backfill_opt_out: true`. Current Trajectory versions
no longer send separate historical metrics. Older versions keep sending them
until they upgrade.

For Codex and local-cache backfills, `--limit` sets the size of each chunk.
The command reports the total number of files and chunks before it starts.
Then it runs every chunk, so you do not need to run `--continue`. If a run is
interrupted, use `--continue` to resume from the saved position.

Codex imports reuse file listings in windows of limited size, which keeps small
chunks fast. Each window keeps the order it found. Trajectory checks for
current activity before it converts a file. You can retry sources that failed.
Files that appear during an import may need another run. Background recovery
lists sources again on each page.

For modes, local UI repair, local checks of past metrics, and record backfill,
read the full guides:

```bash
trajectory user-guide backfill
```

For where each local-ui record comes from, run
`trajectory user-guide source-provenance`.

## Continue a session in another client

Trajectory can rebuild a captured session so that another client can continue
it.

To list the clients that can continue a session, run:

```bash
trajectory session resume --list-targets
```

To preview the result without starting the client, run:

```bash
trajectory session resume --session <id> --target codex --dry-run
```

To continue the session in Codex, run the same command without `--dry-run`.
For details, run `trajectory user-guide resume`.

## Markers

Markers are behavior signals that you define in YAML. Trajectory checks them
against captured sessions. A marker can produce a point, a range across
several turns, or a measure.

Trajectory can send markers to Datadog as `trajectory.<scope>.<concept>`
metrics. `<scope>` is `turn`, `session`, `task`, `commit`, or `pr`. The old
LLM Obs evaluation output is retired. Trajectory ignores the
`markers.evaluations` key, which stays only for compatibility.

Read the full guide in [MARKERS.md](MARKERS.md), or run
`trajectory user-guide markers`. For markers in a repository, run
`trajectory user-guide repo-markers`.

Trajectory loads markers in layers, in this order:

1. Built-in markers.
2. Org markers.
3. User add-ons in `~/.trajectory/markers.d/*.yaml`.
4. User markers in `~/.trajectory/markers.yaml`.
5. Project markers in `.trajectory/markers.yaml`.

To roll out markers for a repository, put the marker definitions in
`.trajectory/markers.yaml`. Put destination choices and marker metric settings
in `publish.trajectory.yaml`.

To add the optional security markers, run:

```bash
trajectory patterns markers enable-security
```

This command writes `~/.trajectory/markers.d/security.yaml`. To turn the
add-on off, delete that file. To write the file to another path, add
`--output PATH`. To overwrite a file that already exists, add `--force`.

## Optional products

### Datadog Security plugin

`trajectory plugins list` shows the opt-in product plugins. Each plugin turns
on modules that are built into Trajectory. Normal `trajectory setup` installs
only observability.

To turn on Datadog Security in observe mode for some clients, run:

```bash
trajectory plugins security setup --mode observe --clients cc,codex,cursor
```

For Claude Code and Codex, this installs the separate marketplace plugin. For
Cursor, it updates Cursor's native hooks.

Warning: `--mode enforce` can block agent actions. Enforce mode requires
`--yes`.

To turn security off, run:

```bash
trajectory plugins security disable --clients cc,codex,cursor --remove-hooks
```

This command turns off the security config and removes the separate plugins
for the clients you name. It also removes old dispatcher hooks that
Trajectory manages. It keeps the normal capture hooks.

The Trajectory marketplace has two plugins that you install separately. The
core plugin is `trajectory`. The `trajectory-security` plugin has the security
hooks for Claude Code, Codex, and Cursor. It does not need the core plugin.

To send native `agent-security` module spans to a required Datadog
destination that you own, run:

```bash
trajectory plugins security destination add --destination <name> --app-key-ref <ref>
```

This also lets Trajectory read the spans back with the application key. The
command checks the secret before it saves it.

### AI Guard credentials

AI Guard reads its API and application keys through Trajectory's secret
lookup. An installer can pipe keys from a shared vault straight into the OS
keychain. Then it can turn on security without putting either key in YAML or
in command arguments:

```bash
vault_api_key_command | trajectory config set-secret dd_api_key --stdin
vault_app_key_command | trajectory config set-secret dd_app_key --stdin
trajectory plugins security setup --mode observe --clients cc,codex,cursor
```

The first two commands save the API key and the application key. The third
turns on security in observe mode.

The built-in AI Guard config uses `dd_api_key` and `dd_app_key` by default.
Existing `auth_headers` values of `DD_API_KEY` and `DD_APP_KEY` still work.
Trajectory looks them up the same way.

### Removed cost plugins

Agent Cost Guidance and Personal Cost Guard were removed. If your config still
turns on the `ccm` or `personal-cost-guard` modules, or the `cost_guidance` or
`personal_cost_guard` flags, Trajectory ignores those settings. Run
`trajectory setup` for the clients you use to remove their statusline, hooks,
and plugins. Setup puts back the Claude Code statusline you had before.

### Optional modules

`trajectory plugins modules list` shows the optional modules that are built
into the binary: `agent-security` and `frontier-ai-gateway`.

| Command | What it does |
| --- | --- |
| `trajectory plugins modules capabilities <id>` | Shows what the module declares: hooks, passive install steps, product-control owners, evaluators, MCP entries, skills, commands, environment fields, and keychain references |
| `trajectory plugins modules configure <id> --set KEY=VALUE` | Sets a module-wide setting |
| `trajectory plugins modules enable <id> --mode observe` | Turns on the module in observe mode. Use `--mode enforce` to enforce. |
| `trajectory plugins modules install-plan <id> --clients codex,cursor --json` | Previews passive module setup only |
| `trajectory plugins modules evaluators <id>` | Shows evaluator status |
| `trajectory plugins modules evaluator enable\|configure ...` | Changes evaluator config without editing YAML by hand |
| `trajectory plugins modules records --module <id>` | Shows the module's foreground evaluator decisions |

Trajectory saves module decisions locally in
`~/.trajectory/modules/decisions.jsonl`.

Normal `trajectory setup --clients ...` installs only observability and
passive module files. Some modules can respond, pause, protect, or block. You
must turn those on through the product command that owns them. For example:

```bash
trajectory plugins enable datadog-security --clients codex,cursor --setup
```

Raw module config cannot install or run that control through the
observability plugin. To preview the dispatch changes for clients, run
`trajectory plugins install-plan <product-id> ...` for the owning product.

Product evaluators such as `ai_guard` or `ai_edr` can stay off
until their evaluator config sets `enabled: true`. Normal capture hooks stay
separate from the dispatch commands of product modules.

For the full model, run `trajectory user-guide modules`. It covers inspection,
activation, credentials, fail-open and fail-closed behavior, recovery, and who
holds security control.

### Skill usage insights

Skill maintainers can see how a skill is used without seeing raw agent input
and output. They can see usage per repository, the mix of tools, duration, and
where the cost data came from. For the guide, run:

```bash
trajectory user-guide skill-observability
```

Basic skill usage metrics come from normal capture and marker processing.
Native Claude tool-span windows need Claude's own OTLP data to pass through
Trajectory. For Claude sessions, that means starting Claude with
`trajectory claude`.

### Security event stream

Managed Datadog security destinations can turn on a security event stream.
The stream sends one Datadog log for each Trajectory event, with
`ddsource: trajectory-event-stream`. Configure it under
`required_destinations[].event_stream`. Repository `publish.trajectory.yaml`
cannot configure it.

The stream is off unless `event_stream.enabled: true` is set. When it is on,
the default `privacy_profile: security` mode sends the complete captured
event. This includes prompts, responses, thinking, tool inputs and outputs,
diffs, file content, raw payloads, errors, summaries, and identity fields.

Common tools follow a shared coding-agent tool registry. Each
event gets a `tool_operation` that is the same across clients, such as
`shell.execute` or `file.read`. Use it in detections. The `tool_name` field
stays for compatibility. The `native_tool_name` field records the client's own
tool name.

The built-in guide has the full table that maps operations to tool names. It
also has a query example that works across clients. The stream does not turn on
or depend on the optional `agent-security` runtime module. For the guide, run
`trajectory user-guide security-event-stream`.

## Tags on published data

### Filter by user

Every span and metric that Trajectory sends has a `trajectory.user` tag. The
value is your Unix username. To change it, set the `TRAJECTORY_USER`
environment variable.

If you configure it, Trajectory can also send `trajectory.user_email`.
Trajectory uses the first of these sources that returns a value:

1. `TRAJECTORY_USER_EMAIL`
2. `identity.user_email`
3. `identity.user_email_command`
4. `identity.user_email_suffix`, added to the end of `trajectory.user`

Config values first follow the normal layers: `config.defaults.yaml`, then the
assigned `cohort.yaml` if there is one, then `config.yaml`. If you set both the
command and the suffix, the command wins when it returns a valid email.
Otherwise, Trajectory uses the suffix.

To set your email, use one of these options:

| Option | Command |
| --- | --- |
| Save it during client setup | `trajectory setup --clients codex --user-email "$(git config --global user.email)"` |
| Save a fixed address | `trajectory config set identity.user_email user@example.com` |
| Add a domain to your username | `trajectory config set identity.user_email_suffix example.com` |
| Read it from a command | `trajectory config set identity.user_email_command "git config --global user.email"` |
| Set it for one shell | `export TRAJECTORY_USER_EMAIL=user@example.com` |

After you change a saved `identity.*` setting, run
`trajectory config reload --yes`. Then check the result with `trajectory ps`.
New spans and metrics use the new tags after the live server reloads or
restarts. Environment overrides apply only to processes that start with that
environment.

These identity tags are optional. Trajectory sets each one from the first
source that returns a value:

- `git.email`: `TRAJECTORY_GITHUB_EMAIL`, then `identity.github_email`, then
  `identity.github_email_command`, then the repository's
  `git config user.email`, then the global `git config user.email`.
- `github.username`: `TRAJECTORY_GITHUB_USERNAME`, then
  `identity.github_username`, then `identity.github_username_command`, then the
  repository's `git config github.user` or `github.username`, then the global
  Git config.

Repository values win over global values. Commands win over Git config when
they return valid values.

Use these tags to filter in LLM Obs and Metrics Explorer:

- **LLM Obs**: filter traces by `@trajectory.user:<your-name>`.
- **Metrics Explorer**: scope dashboards with `trajectory.user:<your-name>`.
- **Identity**: filter with `github.username:<your-gh-login>` or
  `git.email:<your-git-email>`, when you configure them or Git config has them.

These tags help on shared computers or in CI, where several users create
sessions.

### Add custom publish tags

Add a top-level `tags:` map to `~/.trajectory/config.yaml` or to the managed
`~/.trajectory/config.defaults.yaml` file. Use it when every signal that the
computer sends to Datadog needs the same deployment tags. Choose tags with few
distinct values (low cardinality):

```yaml
tags:
  team: platform
  environment: development
  workspace: cloud
```

Trajectory adds these tags when it publishes. It adds them to Datadog LLM Obs
spans and to Trajectory's Datadog metrics for base, marker, heartbeat, and
task metrics. It does not add them in these places:

- local JSONL
- OTLP exports
- Claude native OTLP proxy metrics
- process-level health and privacy counters

Trajectory combines the user and managed `tags:` maps. If both have the same
key, the value from the managed `config.defaults.yaml` wins.
Destination-level `tags:` in trusted destinations or in
`publish.trajectory.yaml` apply only to that destination. For keys they share,
Trajectory still applies the managed top-level tags.

Keep custom tags stable and free of sensitive data. Do not use prompts, paths,
URLs, personal emails, SHAs, random IDs, or secrets. For user, email, or
GitHub attribution, use the `identity.*` settings.

### Repository tags on metrics

Trajectory adds repository labels with few distinct values to session metrics:

- `repo`: the Git repository name, if Trajectory can parse the remote origin.
  Otherwise, the name of the project folder. If neither is available, the
  value is `unknown`.
- `owner`: the org or user from the parsed Git remote. For fallback labels,
  the value is `unknown`.
- `git_remote_host`: the Git remote host from the parsed origin. For a custom
  SSH alias, Trajectory reads `HostName` from your OpenSSH config. It limits
  the config size and how deep `Include` lines go. For fallback labels, the
  value is `unknown`.
- `trajectory.repo_source`: where the repository labels came from. The value is
  `git_origin`, `git_origin_unparsed`, `project_dir`, `configured`, or
  `unknown`.

For repository dashboards you can trust, filter on
`trajectory.repo_source:git_origin` before you group by `repo` or `owner`. To
check fallback coverage, use `trajectory.repo_source:project_dir` or
`unknown`. Keep fallback labels out of repository rankings.

Public `*.github.com` transport aliases map straight to the GitHub host.
Looking up a custom SSH alias never runs SSH or uses the network. Trajectory
leaves bad, missing, conditional-only, and unknown mappings unresolved.

## Metric notes

For the full metric catalog, see [METRICS-REFERENCE.md](METRICS-REFERENCE.md).

### Distributions for finished samples

Trajectory publishes distribution metrics for finished samples that are useful
as populations in Metrics Explorer. Use percentile functions such as `p95:`
only on current distributions. First turn on Datadog percentile aggregations
for the metric.

- `trajectory.turn.duration_ms.total`: how long a finished turn took, when the
  client gives it or Trajectory can work it out.

Related turn and session metrics:

- `trajectory.turn.permission_wait_ms.additive`: the estimated time a person
  spent approving actions in a finished turn. Trajectory sends it when it can
  work out a permission wait.
- `trajectory.turn.duration_ms.excluding_human_wait.additive`: the turn
  duration minus the waits it saw for a person, such as approvals and
  elicitations.
- `trajectory.turn.permission_prompts.additive`: permission prompt counts by
  `decision`, `permission_mode`, and `approval_path`. The `approval_path`
  values are `manual_prompt`, `auto_mode_prompt`, `auto_classifier`, or a few
  fallback values. Older inferred tool accepts use
  `permission_mode:not_captured`. `unknown` means the source data is missing or
  bad.
- `trajectory.session.web_search.cost.usd.accumulated`: a gauge of WebSearch
  cost so far, and at the end.
- `trajectory.turn.prs`: one count for the turn that created a PR or MR. It is
  tagged with the PR or MR identity, `session_id`, and `trajectory.turn_id`.
- `trajectory.pr.interactions.total`, `trajectory.pr.work_turns.additive`,
  `trajectory.pr.work_duration_ms.additive`, and
  `trajectory.pr.work.{cost.usd,input_tokens,output_tokens,cache_read_tokens,cache_creation_tokens}.additive`:
  PR and MR interactions, and the primary assignment of work to a PR. These
  stay correct after corrections.
- `trajectory.session.last_seen.unix`: the time of the latest session event,
  in Unix seconds. Use it to sort session tables by recency. Turn on
  Historical Metrics Ingestion for this gauge before you replay sessions older
  than one hour.

Current Trajectory versions no longer send the deprecated distribution
metrics. Count metrics replace most of them. A few have no replacement.
Older versions keep sending them until
they upgrade. If you still see them, some clients run an older version.
[METRICS-REFERENCE.md](METRICS-REFERENCE.md) lists the metrics to use.

To compare with Claude Code, note what each metric measures:

- `trajectory.turn.duration_ms.total` is the total time of an agent turn.
- The permission-wait and excluding-human-wait metrics above show the human
  wait that Trajectory can work out.
- Claude's own `claude_code.active_time.total` leaves out time in the
  foreground and idle time.

You can compare these signals, but they do not measure the same thing.

### PR cost attribution

Trajectory no longer publishes commit attribution metrics. Do not use old
commit points to measure coverage.

PR attribution metrics let you look up the sessions for a PR. This works when
local command output contains a GitHub or GitLab change ID, including on
enterprise and self-hosted hosts. Work on an existing PR sends metrics for
interactions, assigned-turn duration, cost, and tokens. Trajectory takes them
from local command output and local Git state.

Trajectory does not call a provider API or reuse your credentials for this. It
never publishes commands, paths, refs, object IDs, URLs,
diffs, owner emails, or source code.

`trajectory.pr.work.cost.usd.additive` sends one share for each supported PR
on a priced turn, tagged with that PR. The shares for a turn add up to one. A
single `gh pr view`, `checks`, or `diff` still counts as an interaction when
another workspace is active.

To narrow the data, filter by `source:facts`, `change_host`, Git repository
`owner`, `repo`, and `change_number`. To drill down, group by `session_id`,
`trajectory.turn_id`, `context_source`, `work_context_mode`,
`signal_confidence`, or `attribution_reason`.

PR, turn, and session metrics show the same usage in different ways. Do not
add them together. Run `trajectory user-guide cost-attribution` before you
build a total or a widget filtered by owner.

For PR work, `trajectory.pr.work.cost.usd.additive` is the total to use. It
stays correct after corrections. Trajectory splits each eligible turn across
every supported PR, and the shares always add up to the turn's cost. Query the
ungrouped metric with `.as_count()`. Grouping by PR splits that total. It does
not count it twice. The metric reuses the cost of finished turns. Do not add it
to turn, session, or PR-creation totals.

Trajectory no longer attributes work to CODEOWNERS, and base metrics and
turn traces no longer carry CODEOWNER tags.

## Built-in help topics

The `trajectory` binary includes a full user guide, split into topics. To list
all topics, run:

```bash
trajectory user-guide
```

In a terminal, Trajectory formats each topic for the screen. It opens the topic
in the pager that `MANPAGER` or `PAGER` names. If neither is set, it uses
`less` or `more`. If you redirect the output, Trajectory prints raw Markdown.
To ask for raw Markdown in a terminal, pass `--format md`.

| Command | What it covers |
| --- | --- |
| `trajectory user-guide install` | Ways to install Trajectory |
| `trajectory user-guide onboarding` | First steps after install |
| `trajectory user-guide config` | All config settings |
| `trajectory user-guide llm-capacity` | LLM capacity and cost controls |
| `trajectory user-guide local-ui` | The browser viewer, local-ui, and cache repair |
| `trajectory user-guide source-provenance` | Where each local-ui record comes from |
| `trajectory user-guide resume` | Continuing captured sessions in other clients |
| `trajectory user-guide backfill` | Importing past sessions, local UI repair, and metric backfill |
| `trajectory user-guide publish` | Publish config for each repository |
| `trajectory user-guide metrics` | Metric gates, names, tags, and queries |
| `trajectory user-guide reports` | What the summary and outcomes numbers mean |
| `trajectory user-guide markers` | Writing markers and their metrics |
| `trajectory user-guide repo-markers` | Repository marker files and publish overlays |
| `trajectory user-guide skill-observability` | Skill usage and attribution |
| `trajectory user-guide mcp` | MCP tools, resources, and SQL queries |
| `trajectory user-guide query` | Local cache data and safe MCP SQL queries |
| `trajectory user-guide costs` | Cost commands and accuracy checks |
| `trajectory user-guide cost-attribution` | Cost totals that add up |
| `trajectory user-guide cost-reconciliation` | Choosing a cost source and matching it to a bill |
| `trajectory user-guide cursor-cost` | Cursor token formula, rate sources, and rollout |
| `trajectory user-guide modules` | Optional modules and product plugins |
| `trajectory user-guide security-event-stream` | The security event stream and its fields |
| `trajectory user-guide privacy` | Incognito, sensitive tags, and capture levels |
| `trajectory user-guide diagnostics` | Doctor, publish checks, audits, span checks, and support bundles |
| `trajectory user-guide clients` | All supported clients |
| `trajectory user-guide clients/claude-code` | Claude Code |
| `trajectory user-guide clients/codex` | Codex |
| `trajectory user-guide clients/copilot` | GitHub Copilot CLI (beta) |
| `trajectory user-guide clients/cursor` | Cursor |
| `trajectory user-guide clients/droid` | Factory Droid (beta) |
| `trajectory user-guide clients/gemini` | Gemini CLI retirement notes |
| `trajectory user-guide clients/hermes` | Hermes Agent observer and saved history |
| `trajectory user-guide clients/amp` | Amp Code system plugin |
| `trajectory user-guide clients/goose` | Goose |
| `trajectory user-guide clients/cline` | Cline CLI file hooks |
| `trajectory user-guide clients/aider` | Aider command shim and saved history |
| `trajectory user-guide clients/continue` | Continue CLI command shim and session JSON |
| `trajectory user-guide clients/mistral-vibe` | Mistral Vibe command shim and hooks |
| `trajectory user-guide clients/grok` | Grok Build native hooks and saved history |
| `trajectory user-guide clients/codebuff` | Codebuff command shim and chat-history import |
| `trajectory user-guide clients/qwen` | Qwen Code native HTTP hooks |
| `trajectory user-guide clients/kilo` | Kilo Code plugin and OTLP relay |
| `trajectory user-guide clients/kiro` | Kiro CLI agent command hooks |
| `trajectory user-guide clients/devin` | Devin CLI source sync |
| `trajectory user-guide clients/qoder` | Qoder CLI plugin and source sync |
| `trajectory user-guide clients/zcode` | ZCode wake hooks, SQLite sync, and repair |
| `trajectory user-guide clients/commandcode` | CommandCode transcript sync |
| `trajectory user-guide clients/zed` | Zed passive-history sync |
| `trajectory user-guide clients/kimi` | Kimi Code CLI provider sources |
| `trajectory user-guide clients/gptme` | gptme native plugin and saved sources |
| `trajectory user-guide clients/codewhale` | CodeWhale saved sessions and runtime store (preview) |
| `trajectory user-guide clients/forgecode` | ForgeCode passive history (preview) |
| `trajectory user-guide clients/warp` | Warp Desktop and local Oz provider store |
| `trajectory user-guide clients/windsurf` | Windsurf Cascade hooks and source sync |
| `trajectory user-guide clients/pi` | Pi |
| `trajectory user-guide clients/opencode` | OpenCode |

## Client feature coverage

These tables show examples of what Trajectory captures from each client and
which privacy features apply. They are not the client registry. For current
setup and support levels, see [SUPPORTED-CLIENTS.md](SUPPORTED-CLIENTS.md).

Trajectory applies incognito on its server. So incognito works for any
captured session once it is on for that session. Local capture, task
segmentation, semantic analysis, and accounting metrics continue. Trace and
log content does not go to Datadog destinations, except exempt ones. Metrics
leave out model and repository names by default. The privacy table shows
whether setup gives each client its own way to turn incognito on.

Headless sessions always skip segmentation.

Many rows mention a client's saved history. That is the session data the
client writes to disk. A feature flag whose name ends in `_durable_history`
controls whether Trajectory reads it.

### Capture and telemetry

| Client | Live capture | Tool/model events | Token/cost usage | Backfill | Resume |
|--------|--------------|-------------------|------------------|----------|--------|
| Claude Code | Native HTTP hooks for tools and messages, plus command hooks with receipts | Yes | Yes | Transcript backfill and live-event repair | Yes |
| Codex CLI | Command hooks, with the rollout watcher as fallback | Yes | Yes | Codex rollout backfill | Yes |
| GitHub Copilot CLI | Beta plugin command hooks. Optional session-state watcher, off by default. Native OTel with content turned off. | Hooks give lifecycle, prompt, tool, and session events. History adds assistant text, reasoning, tool results, permissions, and subagents. | Native `chat` spans give usage per request, and public-rate USD when both managed features are on. Shutdown totals are the fallback. | Bulk backfill. Automatic discovery needs `copilot_cli_durable_history`. | Not yet |
| Antigravity CLI (`agy`) | Native plugin command hooks | Tool calls, results, errors, and Stop metadata. With `antigravity_durable_history`, also user prompts, timestamps, workspaces, and models. | Live provider rows give token counts per request and public-rate USD. Saved history does not produce metrics. | Optional watcher for saved JSONL and SQLite rows, off by default. Backfill repairs older history. | No setup-managed resume |
| Goose | Open Plugins command hooks | Session, prompt, assistant, and tool events. Hooks omit tool IDs and result bodies, so matching tools with the same name is best effort. | Hooks omit usage. `goose_durable_history`, on by default, adds model, tokens, and compaction. Only complete provider-reported USD counts. | Read-only SQLite sync through `goose_durable_history` | Native hooks start a new generation with the same ID on resume. No setup-managed resume command. |
| Cline CLI | File hooks | Lifecycle, prompt, tool, assistant-message, turn, and session-end events | Not in current hook payloads (`turn_end.tokens_status=unavailable`) | Not yet | No setup-managed resume |
| Aider | Opt-in command shim. Optional sync of native Markdown history from folders you name, off by default. | The wrapper gives lifecycle, prompt, assistant, and turn events. History adds prompt, assistant, model, and status text, but no structured tool calls. | The wrapper keeps provider usage and cost. History counts mix provider data and local estimates, rounded for display. Printed cost is the client's own figure. | Watcher plus `session import aider`, behind `aider_durable_history` | No setup-managed resume. History has no end marker. |
| Continue CLI | Opt-in `cn` command shim | Lifecycle, prompt, assistant-message, tool, outer-turn, and session events | Yes, from Continue session JSON when it has usage data | Current run only. No bulk history. | Native `--resume` and `--fork` are captured when the start job sets a clean baseline. Otherwise attribution fails closed. |
| Mistral Vibe | Opt-in `vibe` command shim, plus native identity and tool hooks | Lifecycle, prompt, tool, assistant-message, and turn events | Session totals and the client's cost estimate. No per-turn attribution. Unclear continuation totals are dropped. | Optional watcher, off by default, plus repair backfill | Native data wins. Resume and child sessions keep their provider IDs. Saved snapshots stay incomplete until the native session ends. |
| Grok Build | Preview native global hooks, plus sync from the client's saved files | Lifecycle, prompt when present, assistant and reasoning text, tools and results, model, and parent-child links | No tokens or cost per turn. Session counters are for diagnosis only. | Optional watcher, off by default, plus repair backfill | Native data wins. Snapshots and deletions never mark a session as ended. |
| Codebuff | Opt-in command shims, plus chat-history import after each run | Lifecycle, prompt, assistant-message, and turn events | Yes, from usage data in `~/.config/manicode*/projects/*/chats/*/chat-messages.json` | Codebuff chat history backfill | No setup-managed resume |
| Cursor Desktop | Command hooks | Yes | Native input, output, cache-read, and cache-write tokens. Live rate-card cost needs a synced rate card. Child usage attaches only from complete child data. | Cursor chat import. Backfill uses live metric names with original timestamps. | Yes |
| cursor-agent CLI | Native command hooks when dispatched, plus a shared passive JSONL watcher | Text, thinking, tool requests, tool results, and turn markers | Same native token set as Desktop. Passive records have no token data and stay unpriced. | Current and older JSONL layouts. Backfill uses live metric names with original timestamps. | No setup-managed resume |
| Factory Droid | Beta Factory plugin command hooks | Documented lifecycle, prompt, tool, notification, compaction, stop, and subagent-stop events | Not in current documented hook payloads | Not yet | Not yet |
| Pi | TypeScript extension | Yes | Yes | Import from `.pi/agent/sessions`. Optional `pi_history_backfill`, off by default, picks up idle files that were never captured. | Yes |
| Oh My Pi (`omp`) | Preview native extension plus history sync, behind a feature flag | Lifecycle, prompts, assistant and model, tool results and errors, compaction, and session links from headers | Native input, output, cache, and total tokens, plus provider cost when present | Profile-aware v3 sync plus full-history repair | Native resume, switch, and branch. Trajectory records them but does not start resume. |
| Hermes Agent | Observer plugin hooks, plus optional history sync, off by default | Yes | Live usage when present. Saved history keeps session totals without per-turn attribution. | Read-only `state.db` watcher plus backfill | No setup-managed resume |
| Amp Code | Setup-managed system plugin | Yes | Live events omit usage. Optional saved history, off by default, adds model and token data. Provider credits are not counted as USD. | `T-*.json` thread sync behind `amp_durable_history`. Native plugin traces win. | No setup-managed resume |
| Qwen Code | Native HTTP hooks, plus optional history sync, off by default | Yes | Yes, from Qwen `usageMetadata` with transcript fallback | Chat JSONL watcher plus manual backfill, including archives | No setup-managed resume |
| OpenHands | Command hooks, plus optional history sync | Hooks give lifecycle, prompt, and tool events. Saved bundles add assistant text, thinking, tool input and results, model, and CWD. | Hooks have no usage. `base_state.json` gives provider totals and cost per session only. | `trajectory session import openhands` plus a watcher behind `openhands_durable_history` | Native resume uses the same conversation ID. No setup-managed resume command. |
| OpenCode | Plugin SDK events | Yes | Yes | `session import opencode` for JSON storage and SQLite. Optional watcher for new and changed sessions. | Yes |
| Kilo Code | Plugin SDK events | Yes | Native model, provider, input, output, reasoning, cache-read, and cache-write tokens, and cost. Optional native OTLP. | `session import kilo` plus an optional SQLite and JSON watcher, off by default | No setup-managed resume |
| ZCode | Preview wake hooks plus SQLite sync | Session ID, parent, CWD, prompt, assistant and thinking text, model, provider, and tools | Tokens per attempt and per turn, including reasoning and cache. Cost only when a known rate applies. | Automatic sync plus `session import zcode` | Active updates keep a session open. Only archived data can end a session. |
| Kiro CLI | Agent command hooks | Prompt, tool, assistant response, and saved models and timestamps | Not in hooks or saved stores. Trajectory does not estimate it. | Optional JSONL and SQLite sync through `kiro_durable_history`, off by default. Native hook traces win. | Native `--resume-id`. No setup-managed resume. |
| CommandCode | Preview watcher. Native hooks start the transcript sync. | Prompt, assistant, thinking, tools and results, CWD when given, and Stop turn boundaries. No terminal SessionEnd. | No native usage or cost. Later estimates stay marked as estimates. | Existing and changed transcripts sync in passes of limited size | Native resume only. No setup-managed resume. |
| gptme | Preview watcher. Metadata-only hooks start the sync. | Prompt, assistant, thinking, tools and results, model, and lifecycle | Native per-message tokens, added up for each user turn. Recorded cost has computed provenance. | Existing and changed sources sync in passes of limited size | Native gptme resume. No setup-managed resume. |
| ForgeCode | Preview read-only `.forge.db` sync | System, prompt, assistant, reasoning, tools, results, failures, model, CWD, and child conversations | Actual native values count as real. Approximate values stay marked as estimates. Provider cost keeps its source label. | Existing and changed conversations sync in passes of limited size | No setup-managed resume. Provider rows do not mark sessions as live or ended. |
| OpenClaw | Saved-history import beta: JSONL sync, off by default. No live capture in released builds | Prompt, response, thinking, tools and results, model, compaction, and agent links | Per-message native tokens and provider-billed cost when saved. | `session import openclaw` plus a watcher behind `openclaw_durable_history` | No setup-managed resume |

### Privacy and derived features

In the coverage notes, the segmentation hard-stop test checks two things for a
client. Trajectory captures and finishes the client's sessions. Automatic
segmentation makes no model provider call. A provider hard stop blocks that
call until the segmentation path has a spending limit. This test does not
cover incognito. "Live incognito UX" names the incognito tests.

| Client | Incognito UX | MCP incognito tool | Segmentation | Coverage note |
|--------|--------------|--------------------|--------------|---------------|
| Claude Code | `/trajectory:incognito` command and incognito skill | Yes | Non-headless eligible. Headless skipped. | Live incognito UX. Segmentation hard-stop test with fixtures. |
| Codex CLI | Incognito skill with a bundled script fallback | Yes | Non-headless eligible. Headless skipped. | Live incognito UX. Segmentation hard-stop test with fixtures. |
| GitHub Copilot CLI | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions eligible. Headless skipped. | Segmentation hard-stop test with fixtures. No live incognito UX test yet. |
| Antigravity CLI (`agy`) | `/incognito` command and incognito skill | Yes | Current hooks give no prompt or assistant text to segment | MCP and incognito setup are tested. Segmentation hard-stop and live incognito UX tests need saved history. |
| Goose | Setup-managed `goose-incognito` command | No | Hooks do not report the run mode, so sessions are conservatively headless/unknown and skipped | Headless-skip fixture test. No interactive-mode or live Goose incognito UX test yet. |
| Cline CLI | Setup-managed `cline-incognito` command plus MCP request | Yes | Non-headless file-hook sessions eligible. Headless skipped. | Segmentation hard-stop test with fixtures. No live Cline UX test yet. |
| Aider | Setup-managed `aider-incognito` command | No | Wrapper sessions eligible when non-headless. Passive history sessions are headless/unknown and skipped. | Segmentation hard-stop test through the wrapper. Setup, inventory, and history fixture tests. |
| Continue CLI | Setup-managed `continue-incognito` command | No | Wrapper sessions eligible when non-headless. Headless skipped. | Segmentation hard-stop test with fixtures. Setup, inventory, and command tests. |
| Mistral Vibe | Setup-managed `vibe-incognito` and `mistral-vibe-incognito` commands | No | Wrapper and native sessions eligible when non-headless. Headless skipped. | Segmentation hard-stop test with fixtures. Setup, inventory, and command tests. |
| Grok Build | Setup-managed `grok-incognito` command and `trajectory-incognito` skill | No | Source-only sessions stay headless/unknown. Sessions with a known native mode may become eligible. | Fixture and control-plane tests. Signed-in native hooks and incognito UX are not tested yet. |
| Codebuff | Setup-managed `codebuff-incognito` and `cb-incognito` commands | No | Wrapper and imported sessions eligible when non-headless. Headless skipped. | Segmentation hard-stop test with fixtures. Setup, inventory, and command tests. |
| Cursor Desktop | Incognito skill, using the Claude skill when available or a native Cursor fallback. Setup also installs `cursor-agent-incognito`. | Yes | Non-headless GUI sessions eligible. Headless skipped. | Segmentation hard-stop test deferred. The GUI and transcript watcher have no stable non-headless hook stream that runs without credentials. |
| cursor-agent CLI | Setup-managed `cursor-agent-incognito` command when the Cursor integration is installed. The watcher has no native slash command. | No | Passive history is local-only and cannot be replayed. Native hook sessions use their known path. | Native and passive identity tested with `cursor-agent --print`. The shared passive store does not record its path. |
| Factory Droid | Incognito skill in the local marketplace plugin | Yes | Non-headless plugin sessions eligible. Headless skipped. | Segmentation hard-stop test with fixtures. No live Droid incognito UX test yet. |
| Pi | Native `trajectory_incognito` tool plus MCP | Yes | Non-headless extension sessions eligible. Headless skipped. | Live incognito UX. Segmentation hard-stop test with fixtures. Extension verdict tests. |
| Oh My Pi (`omp`) | MCP request. No setup-managed slash command yet. | Yes | Non-headless sessions eligible. Headless skipped. | Setup and capture fixtures only. Live incognito UX and segmentation hard-stop tests pending. |
| Hermes Agent | Incognito skill | Yes | Non-headless observer sessions eligible. Headless skipped. | Segmentation hard-stop test with fixtures. Live capture tested. No live incognito UX test yet. |
| Amp Code | Setup-managed `amp-incognito` command plus MCP request | Yes | Non-headless Amp plugin sessions eligible. Headless skipped. | Capture and the segmentation hard stop tested with fixtures. Final task end is unavailable until Amp sends a session-end signal. |
| Qwen Code | `/incognito` command and incognito skill | Yes | Non-headless Qwen hook sessions eligible. Headless skipped. | Segmentation hard-stop test with fixtures. Setup and live capture tested. No live incognito UX test yet. |
| OpenHands | Setup-managed `openhands-incognito` command plus MCP request | Yes | Hook payloads have no run-mode field, so hook and history-only sessions are conservatively headless/unknown and skipped | Headless-skip and set-mode fixture tests. Live hooks and saved history in the local UI tested. |
| OpenCode | Incognito skill | Yes | Non-headless plugin SDK sessions eligible. Headless skipped. | Live incognito UX. Segmentation hard-stop test with fixtures. |
| Kilo Code | Incognito skill | Yes | Non-headless plugin SDK sessions eligible. Headless skipped. | Segmentation hard-stop test with fixtures. Setup and live capture tests. |
| ZCode | User incognito skill through `trajectory_incognito` | Yes | Provider-only sessions are conservatively headless/unknown and skipped | Setup, MCP ownership, source sync, and local-UI fixtures. Signed-in incognito UX is not tested yet. |
| Kiro CLI | Setup-managed `kiro-incognito` command plus MCP request | Yes | Deferred: current documented command hooks lack a terminal `SessionEnd` signal | Fixture-only capture plus command tests. No segmentation hard-stop test yet. |
| CommandCode | Owned `/incognito` command and skill. Needs the session ID. Turn it off by hand, because SessionEnd is unavailable. | Yes | Sessions stay conservatively headless/unknown until a reliable mode signal exists | Fixture and Lapdog tests. Live signed-in hook and incognito UX tests are a follow-up. |
| gptme | Native `/incognito` command | Yes | Non-interactive and unknown modes are skipped | Real gptme 0.32.0 mock headless lifecycle test. Non-headless fixture tests capture and the segmentation hard stop. |
| ForgeCode | Owned `/incognito` command and `trajectory-incognito` skill. Needs the session ID. | Yes | Unknown passive mode is conservatively marked headless and skipped | Fixture and Lapdog tests only. Live model-driven incognito and interaction-mode tests are follow-ups. |
| OpenClaw | Control plane only. Released builds have no live OpenClaw capture to control. | No | Saved-history sessions are treated as headless and skipped. | Deferred: setup, MCP, and incognito are not available. |

Released Trajectory builds do not capture OpenClaw live. To sync the history
that OpenClaw saves, turn on `openclaw_durable_history`. For a full repair, run
`trajectory session import openclaw`. Setup-managed install and MCP and
incognito controls are not available.
