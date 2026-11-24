# Summary, Outcomes, and Patterns

These commands report on the sessions Trajectory recorded on your computer,
from its local cache. With `--json`, each prints one document with a stable
schema: `trajectory.summary.v1`, `trajectory.outcomes.v3`,
`trajectory.patterns.report.v5`, or `trajectory.patterns.session.v4`.

## Summary

`trajectory summary` shows local USD, sessions, turns, tokens, and averages,
by agent, project, model, and day. The default window is the current month.
It uses the same window and cost rules as `trajectory cost`.

Each turn counts on its own day, so the days' cost, turns, and tokens add up to
the totals. A session that runs for three days counts on each of those days.
Values with no turn count on the session's last day in the window. These are
session-only cost, subagent counts, whole-session estimates such as Codex
Guardian sessions, and sessions whose turns hold more than the session record.
A session whose cost is hidden adds no turns, tokens, or day row. It counts as
incomplete, and a footnote gives the number.

## Patterns

`trajectory patterns` shows the last 7 days: sessions, tasks, turns, work mix,
scores, agent split, agent-work cost, and deliverables.

- **Work mix** uses the Work Insights v1 Level 1 and Level 2 categories. With
  `--details`, a second table shows coding task types. Each task counts once
  in each table.
- **Per work type** rows give count, share, average turns, agent-work cost, and
  complexity. They compare tasks of 1 to 2 turns with tasks of 10 or more.
- **Scores** average outcome, autonomy, and risk.
- **Deliverables** are commits, PRs created or touched, Markdown and test
  files, and turns that changed files. Each counts once, from a successful tool
  call or a PR-work record.

Agent-work cost covers parent turns and their subagents. Coverage counts priced
turns. It leaves out control turns with zero usage and automated-oversight
child sessions.

A PR interaction is a successful create, checkout, inspect, comment, review,
edit, merge, or close that names one PR. List and search commands do not
count. A lone `gh pr view`, checks, or diff still counts while another
workspace is active.

By default, the headline PR count is your GitHub-authored PRs, which needs a
GitHub sign-in. Without GitHub, the report uses PRs seen in sessions and
warns. `--github=false` stays local. Delivery cost lists authored and
interacted PRs, PRs with full, creating-turn-only, or no linked cost,
coverage, and cost per PR.

`--details` adds coding task types, outcome spread, PR attribution
diagnostics, and unlinked-PR splits. It also lists the highest-cost turns,
with cost, duration, tokens, tools, and source, and a
`trajectory patterns session` command to copy for each.

`trajectory patterns session SESSION_ID` shows task and turn tables with cost,
deliverables, scores, and tokens. `--details` adds short previews of the
prompt, response, and classifier reasons. It reads local data only and shows
incognito sessions too.

## Outcomes

`trajectory patterns outcomes` shows the commits and PRs linked to your
sessions, with cost per commit and per PR. The default window is the current
month.

Each `git-commit` point stores the cost and turns since the last commit, in
`attributed_cost_usd` and `attributed_turns`. Commits in the same turn split it
evenly. Cost per commit stays local.

PR attribution uses only local data. It needs no credentials, makes no GitHub
or GitLab calls, and reads no provider bills. A session without outcome data
counts as not covered, and a missing ratio shows `-`, not zero.

## Classify sessions

Work mix needs task classifications, which a model creates. Classification
returns task boundaries and, for each turn, an outcome, complexity, autonomy,
risk, task type, reversibility, side effects, and Work Insights labels.

Model calls cost money, so you opt in. In a terminal, `trajectory patterns`
shows one estimate and asks. Non-interactive runs, `--json` reports,
`trajectory patterns estimate`, and `analyze` without `--yes` never ask and
never call a model.

1. See the estimate: `trajectory patterns estimate --period 30d`. Use it to
   plan. It does not predict the bill. Read it before `--period all`, which can
   include every kept session.
2. Classify: `trajectory patterns analyze --period 30d --yes`. Without
   `--yes`, it prints the estimate and stops.

`analyze` defaults to `--period 7d`, `--parallel 4` (at most 16), and
`--batch-size 8`. `--details` and `--json` add the estimate's assumptions and
content-free repair diagnostics: session ID, client, phase, and reason code.

A confirmed run first repairs local data without models. Then it classifies
finished top-level sessions that lack coverage. Complete sessions are skipped.
`--yes --repair-only`, like `trajectory patterns repair`, only repairs.

Repair adds Claude, Codex, and Cursor sessions the cache lacks. Live Claude and
Codex sessions get snapshots of their finished turns but wait for their real
end. Active Cursor sessions wait too. An open session with finished turns and
no provider transcript is labeled `provider-source-unavailable`. Child
activity pulls its parent into the window, and child work and cost roll up to
the root session. Repair and metric backfill keep the original turn and
PR-interaction times, so a 7-day repair stays in those 7 days.

If repair changes the estimate, the run stops before any model call. Run the
same `--yes` command again to accept. A confirmed run uses a fixed plan of
sessions and prompts, and sessions found later wait. JSON includes a
content-free SHA-256 of the scope.

Progress shows sessions done and total, workers, elapsed time, the expected
finish, and slow providers. Interrupted runs resume and record each attempt's
cost. The summary counts sessions analyzed, done elsewhere, and failed, and
the analysis cost. If a provider returns bad JSON or an unknown category,
Trajectory records the failed call and tries the next provider. If a client's
history is unavailable, the command warns and shows cached sessions.

Classification sends nothing to Datadog. To send retained history, run
`trajectory publish history`.

## Aged sessions

When a session's full data ages out, Trajectory keeps its totals.

- `cost`, `cost top`, and `summary` count it whole, at its stored cost, in the
  window that holds its end. A session that began before the window can shift
  the window's totals, because its turns cannot be split. It has no subagent
  count.
- `cost inspect` prints its totals and notes it as summary-only.
  `trajectory view` labels it. Turn and tool views show only sessions with
  full data.
- `patterns outcomes` counts it. PRs that only aged sessions touched count
  without cost, listed in `summary_only_prs`.
- Resuming it adds new turns to the kept totals without rereading old events.

## Time windows

`trajectory patterns` takes `--period` `1d`, `7d` (default), `30d`, `90d`, or
`all`. `summary` and `patterns outcomes` also take `today`, `week`, and
`month` (default). `--since` replaces `--period` with a duration, a date,
`all`, or an RFC 3339 time, as in `trajectory cost`.

## Local data and MCP tools

There is no `trajectory query` command. Use `trajectory status`,
`trajectory local-ui`, or the MCP tools. Clients that setup manages start
`trajectory mcp`, with the tools `trajectory_status`,
`get_session_trajectory`, `trajectory_incognito`, `trajectory_schema`,
`trajectory_query`, and `trajectory_search`, and three `trajectory://`
resources. Call `trajectory_schema` before `trajectory_query` to get the live
database path and schema.

## Check local data

`trajectory session audit data` checks nine areas without changing anything:
sessions, conversations, tools, delegation, usage, outcomes, analysis,
storage, and delivery. Its event checks cover the newest 100 sessions and skip
the slow content, usage-outlier, and outcome checks. `--all` scans every
session.
`--details` shows findings, and `--json` suits scripts. Missing data stays
apart from a checked zero. Pi delegation is not checked. `trajectory doctor`
uses the same report and points to the audit, but never applies a repair.

To repair:

1. Write a plan: `trajectory session audit data --write-plan repair.json`. Add
   `--only` to limit it.
2. Review the plan.
3. Apply it: `trajectory session audit data apply --plan repair.json --yes`.

Apply refuses an expired plan, changed sources, a needed feature that is off,
or an unclear repair. It checks that the gaps closed and writes a new receipt,
which `--receipt PATH` places. A Codex rollout larger than 64 MiB, missing, or
unsupported reports unverified.

`trajectory session audit --source-data` checks the local-ui cache:
finalization, turn and session totals, tool parents, attribution, turn gaps,
and active content. It checks input and output tokens apart.
`session_turn_aggregate_drift` must pass. `--json` suits scripts, and
`--db <path>` checks another cache.
`trajectory session audit --deep` also explains local capture, trace-off
settings, missing model or cost, and the trace intake time limit.
