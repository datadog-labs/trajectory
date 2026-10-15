# Summary, Outcomes, and Patterns

These commands report on the sessions that Trajectory recorded on your
computer. They read the local SQLite cache. Each command can print JSON with a
stable schema.

| Command | What it shows |
|---|---|
| `trajectory summary` | Usage and cost for a period |
| `trajectory patterns outcomes` | Commits and PRs linked to your sessions, with cost per commit and per PR |
| `trajectory patterns` | Work mix, task outcomes, agent-work cost, and deliverables |

## Run the reports

### See this month's usage and cost

```bash
trajectory summary
```

It prints the local USD total, sessions, turns, and tokens for this month. It
breaks them down by agent, project, model, and day.

To use another window, add `--period`. This example shows the last seven days:

```bash
trajectory summary --period 7d
```

### See commits and PRs linked to your sessions

```bash
trajectory patterns outcomes
```

It prints cost per commit and cost per PR for this month.

To start the window on a date, add `--since`:

```bash
trajectory patterns outcomes --since 2026-07-01
```

### See your work mix for the last week

```bash
trajectory patterns
```

It prints the task mix, task scores, agent-work cost, and deliverables for the
last seven days. To change the window, add `--period`, for example
`--period 30d`.

### Look at one session in detail

```bash
trajectory patterns session SESSION_ID
```

It prints the tasks and turns of the session, with their cost and
deliverables. See [Look at one session](#look-at-one-session).

### Get JSON for scripts

Add `--json` to any report command. For example:

```bash
trajectory summary --json
```

The output is one JSON document with a stable schema. Each section below names
its schema.

### Choose the time window

| Command | Default `--period` | Values for `--period` |
|---|---|---|
| `trajectory summary` | `month` | `today`, `week`, `month`, `1d`, `7d`, `30d`, `90d`, `all` |
| `trajectory patterns outcomes` | `month` | `today`, `week`, `month`, `1d`, `7d`, `30d`, `90d`, `all` |
| `trajectory patterns` | `7d` | `1d`, `7d`, `30d`, `90d`, `all` |

To use a different start time, set `--since`. It replaces `--period`. It
accepts a duration, a date, `all`, or an RFC 3339 time, as `trajectory cost`
does.

In `summary` and `patterns outcomes`, `--limit` sets how many breakdown rows to
show. The totals always use every session in the window.

## Summary

`trajectory summary` shows one local USD total, then sessions, turns, tokens,
and averages. It breaks the totals down by agent, project, model, and day. It
uses the same window and cost rules as `trajectory cost`.

In the day breakdown, each turn counts on its own day. It brings its cost, its
tokens, and its provisional price if it has one. A day's cost is partial
or unavailable when a turn of that day has no price.

A session counts once on each day it has a turn. A session that runs for three
days is counted on three days. So the session counts of the days can add up to
more than the sessions in the window. Cost, turns, and tokens of the days add
up to the window totals.

Some values have no turn to place them by. They count on the session's last
day in the window:

- a cost that Trajectory knows only for a whole session, and the part of a
  complete Codex session's cost that its turns do not show
- the session's number of subagents
- all of a session whose cost is an estimate or a total for the whole
  session, such as a Codex Guardian session. Such a session stays on one day
  with its turns and tokens.
- all of a session whose turn records hold more turns, tokens, or cost than
  its session record

A session whose cost is hidden has no turns or tokens in the report. It gets
no day row, and the summary counts it as an incomplete session.

Some token usage has no verified price. If provisional pricing is on,
Trajectory prices that usage and adds it to the total. The total then has a
`*`, and one line shows the provisional part:

```text
* Contains $5.14 provisional cost. Run `trajectory cost pricing --since 2026-07-01` for details.
```

If some cost data is incomplete, a footnote shows how many sessions it affects.
The USD values are local estimates. They are not an invoice. For pricing
sources and reconciliation, run `trajectory user-guide costs`.

`--json` prints the `trajectory.summary.v1` schema. The cost includes the cost
of the subagents that sessions started. `cost.subagent_usd` is that part of
`cost.amount_usd`, or of `cost.known_subtotal_usd` when the cost is partial.
The breakdown rows include subagent cost and have no separate field for it.

## Outcomes

`trajectory patterns outcomes` shows two separate results:

- **Cost per commit.** Each `git-commit` marker records the cost of the turns
  since the previous commit in the same session. The report adds these up by
  branch. It is a local value only. Trajectory no longer sends a commit cost metric to
  Datadog.
- **Cost per PR.** This reads the local PR-work table first. In Datadog, the
  matching metric is `trajectory.pr.work.cost.usd.additive`. The distinct PRs
  in `trajectory.pr.observations.total` are its coverage denominator. Older
  caches use a fallback that counts only clearly linked PR interactions.
  Trajectory does not publish that fallback as a metric.

If a session has no outcome data, the report counts it as not covered. It does
not use total cost in its place. A missing ratio shows as `-`, which is
different from zero.

PR attribution uses only local data. It needs no credentials and does not call
GitHub or GitLab. The cost per PR covers AI work that Trajectory linked to a PR
or MR. It is not the provider bill or the full engineering cost.

`--json` prints the `trajectory.outcomes.v3` schema. The JSON includes
methodology strings that explain how each value is computed.

## Patterns

`trajectory patterns` shows the last seven days by default. The header counts
sessions, classified tasks, and turns.

The report shows these sections:

- **Work mix.** The main table uses the Work Insights v1 Level 1 and Level 2
  categories. A second table uses Trajectory's coding task types. Each
  classified task counts once in each table.
- **Per work type.** Each row shows task count, share, average turns,
  agent-work cost, and average complexity. It also compares 1-2-turn tasks with
  tasks of 10 or more turns.
- **Scores.** Average outcome, autonomy, and risk, and a split by agent and
  usage shape.
- **Deliverables.** Commits, PRs created, PRs interacted with, Markdown and
  test files, and turns that changed files.
- **Delivery cost.** Cost per attributed PR, with attribution coverage.
- **Highest-cost turns.** Each row has a `trajectory patterns session` command
  that you can copy.

`--json` prints the `trajectory.patterns.report.v5` schema.

### How deliverables are counted

Trajectory counts a deliverable only when a successful tool call shows it.
It reads tool calls from every client and PR-work records. If a tool output
summary was cut short, it also reads the local native transcript. Raw
transcript content and file paths stay on your computer.

A PR interaction is a successful create, checkout, inspect, comment, review,
edit, merge, or close. It can come from a shell command or a provider tool.
Trajectory counts it only when the PR identity is clear. List and search
operations across many PRs do not count.

### PR totals and GitHub

By default, Trajectory asks GitHub for the PRs you authored in the window. That
count becomes the headline PR total. You must be signed in to GitHub for this
step.

- To use only PRs seen in local sessions, add `--github=false`.
- If GitHub is not available, the report uses local data and prints a warning.

Delivery cost reports these values:

- authored and interacted PRs
- PRs with full cost context
- PRs linked only by the turn that created them
- PRs with no linked cost
- attribution coverage
- one cost per attributed PR

`--details` splits the authored PRs with no linked cost into two groups. One
group has no local interaction. The other has an interaction but no PR-work
cost context.

### Look at one session

To see the tasks and turns of one session, run:

```bash
trajectory patterns session SESSION_ID
```

The task table shows each task's turn span, its privacy-reduced label, its
classification, its cost, and its deliverables. The turn table shows each
turn's position in its task. It also shows these values for each turn:

- outcome, complexity, autonomy, and risk
- elapsed time
- recorded cost and where the cost came from
- tokens, tool calls, and lines of code changed
- model and deliverables

Large costs show their duration and source next to them.

To add short previews of the prompt, the response, and the classifier's
reasons, add `--details`:

```bash
trajectory patterns session --details SESSION_ID
```

To get JSON, add `--json`. It prints the `trajectory.patterns.session.v4`
schema.

The `session` command is read-only and local. Incognito does not hide sessions
from it.

### Agent-work cost

Agent-work cost includes parent turns and the subagents that they started.
Coverage compares priced turns with turns that have cost. A control turn with
zero usage still counts as a turn. The report does not show it as unpriced.

Trajectory does not count its own classifier cost as agent work. It reports
that cost separately as `user-driven-segmentation`. `trajectory patterns` and
`trajectory cost` never add it to agent-work spend. After analysis, reports show
the total analysis cost for the window, including failed attempts.

Automated-oversight child sessions appear in operational telemetry. They are
left out of agent-work cost and its coverage.

## Classify past sessions

`trajectory patterns` needs task classifications to fill its work mix. A model
creates them. When some sessions in the window are not classified, the report
shows one estimated cost to classify them. In a terminal, it asks whether to
start. If you answer yes, it runs the same steps as
`trajectory patterns analyze --yes`. Redirected output and `--json` never ask
and never run a model.

Model calls cost money, so the commands show an estimate first.

1. See what classification of the last 30 days would cost. This step does not
   run a model:

   ```bash
   trajectory patterns estimate --period 30d
   ```

2. Start classification for the same window:

   ```bash
   trajectory patterns analyze --period 30d --yes
   ```

Without `--yes`, `trajectory patterns analyze` prints the same estimate and
stops.

| Flag | What it changes |
|---|---|
| `--period` | The window to classify. The default is `7d` |
| `--yes` | Confirms the estimate and starts the model calls |
| `--parallel N` | Classifies N sessions at the same time (default 4, maximum 16) |
| `--repair-only` | Repairs local data and never runs a model. Use it with `--yes` |
| `--details` | Prints repair diagnostics and the estimate assumptions |
| `--json` | Prints one JSON document |
| `--db` | Uses another local cache and sends nothing to Datadog |

Before you use `--period all`, read the estimate. That window can include every
session you kept.

A confirmed run does these steps:

1. It repairs local data first. This step makes no model calls. See
   [How repair works](#how-repair-works).
2. It classifies each completed top-level session that is missing task or turn
   coverage.
3. It evaluates the markers again from local data.
4. For the standard cache, it sends Agent Console task metrics to Datadog. See
   [Task metrics in Datadog](#task-metrics-in-datadog).

To repair local data only, run this command. It never runs a model:

```bash
trajectory patterns analyze --period 30d --yes --repair-only --details
```

`trajectory patterns repair` does the same.

`--details` and `--json` list repair diagnostics: session ID, client, repair
phase, and a reason code. They show no session content. The default output
shows only the repair totals.

The run can stop and resume. It records each successful and failed attempt
with its cost.

### Task metrics in Datadog

For the standard cache, your confirmation also covers sending task metrics to
Agent Console. The window is the last 30 complete UTC days, limited by capture
retention. Trajectory sends the metrics through Datadog historical ingestion.
For more about this replay, run `trajectory user-guide backfill`.

- If you pass `--db`, Trajectory keeps everything local and sends nothing.
- If the replay fails, the command reports a partial result and exits non-zero.
  The local classification work is kept, and the next run resumes it.

When the run ends, the summary shows how many sessions it refreshed, deferred,
or could not read. It also reports replay delivery. Repeated warnings are
capped so that they do not flood the terminal or the JSON.

### If the estimate changes

The repair step can find sessions or cost data that were not there when you
saw the estimate. If the estimate changes, the command stops before its first
model call. It shows the new estimate. Run the same `--yes` command again to
confirm it.

A confirmed run uses a fixed plan of sessions and prompts. Sessions found after
that wait for the next run. JSON includes a SHA-256 of the analysis scope, so
automation can check that the plan did not change.

The estimate is for planning. It does not predict the provider bill.

## Progress and output

Interactive `patterns` commands show the current step on stderr. The line
clears when the step changes or the command ends. Classification progress shows
completed and total sessions, workers, elapsed time, and an estimated finish
time. It also warns when a provider is slow.

Redirected output keeps the same layout without color. JSON output is always a
single document on stdout, with no progress mixed in.

If one native history source is not available, the command prints a short
warning. Sessions that are already in the cache still appear.

## How repair works

This section explains what the repair step in `trajectory patterns analyze`
does. You do not need it to run the commands.

**Sessions that are missing from the cache.** Before any model call, Trajectory
looks for Claude, Codex, and Cursor sessions in each client's own history. It
adds sessions that the local cache does not have.

- Active Claude and Codex sessions are added as snapshots of their completed
  turns. They get final classification only after the real session end
  arrives.
- Active Cursor sessions wait. Trajectory does not yet trust Cursor's snapshots
  of active sessions.
- An open session that has completed turns but no provider transcript still
  appears as observed work. It is labeled `provider-source-unavailable`.
  Trajectory does not add a fake session end to it.

**Child sessions.** Activity in a child session brings its parent into the
window. The child's work and cost roll up to the root session. The child does
not count as another analyzed session. For Claude, Trajectory adds child
sessions before their parent, so cost is not counted twice.

**Cost and deliverables.** Trajectory refreshes old Codex token costs from the
Codex session files with the current rate card. Confirmed repair also checks
PR-work records and evaluates markers from completed local data.

**Marker timestamps.** Marker repair uses each turn's original time. A marker
that Trajectory evaluates again today stays in its original window.

**Coverage passes.** Classification has two passes: the coding pass and the
Work Insights v1 pass. Trajectory runs only the passes that a session is
missing. If a session already has full coverage, Trajectory uses it and makes
no call. If the coding task boundaries change, Trajectory updates the Work
Insights tasks to match.

For sessions that lack coding coverage, JSON reports
`dynamic_work_insights_passes`. Their Work Insights pass reuses the same
transcript and turns. Their task grouping comes from the checked coding pass.

**Bad model output.** A provider can return malformed JSON or a value outside
the categories. When that happens, Trajectory records the failed call. Then it
tries the next provider in the shared headless list.
