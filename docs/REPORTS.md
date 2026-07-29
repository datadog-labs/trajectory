# Reports and Work Insights

Use `trajectory summary` for a compact usage report, `trajectory outcomes` for
delivery-attribution evidence, and `trajectory patterns` for work mix,
outcomes, cost, complexity, and marker-backed deliverables. These commands read
the local SQLite cache and support stable JSON output.

```bash
trajectory summary
trajectory outcomes
trajectory summary --period 7d
trajectory outcomes --since 2026-07-01
trajectory patterns
trajectory patterns --period 30d
trajectory patterns session SESSION_ID
trajectory summary --json
trajectory outcomes --json
trajectory patterns --json
```

`--period` accepts `today`, `week`, `month`, `7d`, `30d`, `90d`, or `all`.
`--since` overrides it and accepts the same duration, date, and RFC 3339 forms
as `trajectory cost`. `--limit` changes displayed breakdown rows, not the
headline totals for the selected local corpus.

## Summary

`trajectory summary` shows one local USD headline, sessions, turns, tokens,
averages, and breakdowns by agent, project, model, and day. It uses the same
finite-window and cost-completeness rules as `trajectory cost`.

When provisional pricing is enabled, qualified estimates fill otherwise
unpriced retained token evidence. Totals containing provisional USD end in
`*`, and a bounded note routes to:

```bash
trajectory cost pricing --since 7d
```

If selected cost evidence remains incomplete, the report keeps one glanceable
recorded estimate and identifies the affected sessions in a coverage note.
Local USD is an estimate, not an invoice. See [Cost Tracking](COSTS.md) for
source, pricing, and reconciliation details.

## Outcomes

`trajectory outcomes` reports three separate evidence contracts:

- Yield coverage and outcome counts come from local repository evidence.
  `productive`, `partial`, `reverted`, `abandoned`, and `no-repo` are
  heuristic classifications, not delivery ground truth.
- Cost per commit sums the cost samples attributed to commits and divides by
  those same attributed commit samples.
- Cost per pull request sums priced, unambiguous PR-interaction turns and
  divides by the distinct normalized pull-request identities represented by
  those same samples.

The command reports attribution coverage instead of substituting total corpus
cost for missing outcome evidence. A missing ratio is unavailable, not zero.
PR attribution describes observed agent work connected to a PR or MR; it is not
the provider bill or total engineering cost of delivery.

Use `--json` for the stable `trajectory.summary.v1` and
`trajectory.outcomes.v1` schemas. Outcome JSON includes methodology strings and
the metric map so consumers do not have to infer denominators.

## Patterns

`trajectory patterns` defaults to the last seven days. The report shows:

- sessions, classified tasks, and turns;
- Work Insights Level 1/Level 2 work mix;
- coding-specific task types;
- agent-work cost and average complexity;
- outcomes, autonomy, and risk;
- agent and usage-shape breakdowns;
- commits, pull requests created and interacted with, Markdown and test files,
  file-changing turns, and other marker-backed deliverables.

Each classified task has equal weight in both work-taxonomy views. Average
turns and the 1-2-turn versus 10+-turn split distinguish quick exchanges from
longer agent jobs.

Deliverables are reconciled from successful cross-client tool evidence,
normalized PR-work receipts, and local native transcripts when canonical
output summaries were truncated. Raw transcript content and file paths remain
local.

### Pull Request Reconciliation

A PR interaction includes a successful, deterministically identified create,
checkout, inspect, comment, review, edit, merge, or close operation.
Collection-wide list/search operations and identity-ambiguous output are
excluded.

By default, an authenticated GitHub authored-PR census supplies the headline
for the same window. Use `--github=false` for a local-only,
session-observed count. When GitHub is unavailable, the command falls back to
local evidence and reports the limitation.

Add `--details` for attribution coverage, finalized PR-work cost,
cost-per-attributed PR, attribution sources, and the split between authored PRs
without recovered local interaction and interacted PRs without deterministic
cost context.

## Historical Classification

Historical classification is explicit and resumable:

```bash
trajectory patterns estimate --period 30d
trajectory patterns analyze --period 30d
trajectory patterns analyze --period 30d --yes
trajectory patterns analyze --period 30d --yes --parallel 4
trajectory patterns analyze --period 30d --yes --repair-only --details
```

The default report distinguishes fully classified sessions from unclassified
or incomplete sessions and estimates the cost to repair the selected window.
Interactive reports can ask whether to start analysis. Non-interactive and
JSON reports never prompt or infer. `estimate` and `analyze` without `--yes`
also make no classifier calls.

A terminal confirmation or explicit `--yes` is the spending boundary. Analysis
classifies only completed top-level sessions with missing coding or Work
Insights coverage. Complete sessions are not classified again. If coding task
boundaries must be rebuilt, their dependent Work Insights task projection is
refreshed against those boundaries.

Before inference, confirmed analysis can repair local session projections and
cost evidence without an LLM call. If repair changes the authorized session
set, prompt plan, provider/model plan, estimated cost, or analysis-scope
identity, the command stops before the first classifier call and requires
confirmation again.

The displayed amount is a planning estimate rather than an exact provider
invoice. Classifier cost is accounted separately as Trajectory-owned analysis;
it is never added to the agent-work spend shown by `trajectory patterns` or
`trajectory cost`.

Confirmed analysis uses isolated classifier workers and durable receipts.
`--parallel N` selects 1 through 16 workers. `--batch-size N` changes the
scheduling wave. Completed receipts are reused after interruption.
`--yes --repair-only` stops after deterministic local repair.

Incognito does not suppress explicitly requested local analysis or aggregate
metric refresh. It continues to govern trace-like publication.

## Progress and Automation

Interactive Patterns commands report their current phase on stderr. Reporting
can include provider discovery, source-window selection, tool and marker scans,
PR attribution, GitHub reconciliation, and rendering. Analysis can include
planning, local and cost repair, authorization verification, classification,
and metric refresh.

`--json` keeps stdout as one stable document because progress remains on
stderr. An unavailable native-history source is a bounded warning; already
cached sessions continue to report.

## Session Drilldown

Inspect one local session with:

```bash
trajectory patterns session SESSION_ID
trajectory patterns session --details SESSION_ID
trajectory patterns session --json SESSION_ID
```

The task table shows each classified task, privacy-reduced label, turn span,
outcome, complexity, autonomy, risk, cost, and evidence-backed deliverables.
The turn table overlays each turn's task position and shows classification,
elapsed time, recorded cost and source, tokens, tool calls, code-change volume,
model, and deliverables.

Large recorded costs remain visible with duration, token, tool, and provenance
evidence rather than being judged by magnitude alone. `--details` adds bounded
prompt, response, and classifier-evidence previews. JSON uses the stable
`trajectory.patterns.session.v4` schema. The command is local and read-only.
