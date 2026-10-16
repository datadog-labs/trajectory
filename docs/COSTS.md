# Cost Tracking

`trajectory cost` shows the tokens and cost of your coding-agent sessions. Use
it to see what your sessions cost, find the expensive sessions and files, and
check where a cost number came from.

The command reads data on your machine and does not query Datadog. Its USD
values are estimates. They cover only the activity that Trajectory captured.
Before you compare them with a client, provider, gateway, cloud, Cursor Admin,
or invoice total, read `trajectory user-guide cost-reconciliation`.

Related guides:

- `trajectory user-guide cost-attribution`: how to build Datadog dashboards
  from Trajectory cost metrics.
- `trajectory user-guide cost-reconciliation`: how to compare Trajectory cost
  with other cost sources.
- `trajectory user-guide cursor-cost`: how Trajectory prices Cursor tokens and
  when it publishes Cursor cost.

## Commands

| Task | Command |
| --- | --- |
| See cost by day, agent, and session | `trajectory cost` |
| Rank the most expensive sessions | `trajectory cost top --since 7d` |
| Find the files that agents read and edit most | `trajectory cost hotspots --since 7d` |
| Explain provisional prices | `trajectory cost pricing --since 7d` |
| Show the cost of each turn in a session | `trajectory cost inspect --session <session-id>` |
| List facts about a session's cost | `trajectory cost observations --session <session-id>` |
| Check cost data for each agent | `trajectory cost validate --since 7d` |
| Compare published cost with local data | `trajectory cost audit --latest` |

The summary, `top`, `hotspots`, `pricing`, and `validate` commands use the
last seven days by default. To change the window, add `--since` with a value
such as `24h`, `30d`, `all`, or a date.

### Summary

To see your recent cost, run `trajectory cost`. The report has these parts:

1. A stacked bar chart with one bar for each of seven rolling 24-hour periods.
   The chart and its table appear only with the default seven-day window.
   Each bar shows the cost of each agent in that period. Each turn counts in
   the period of that turn, and a session counts in each period in which it
   has a turn. For the costs that stay on a session's last day, run
   `trajectory user-guide reports`.
2. A legend with the daily average, the number of active periods, and the
   peak period.
3. A table of cost for each period.
4. A table for each agent with cost, sessions, turns, subagents, and tokens.
5. The sessions with the highest cost.
6. A **Coverage** section and, when needed, an **Attention** section with
   notes.

The chart fits the width of your terminal.

### Rank the most expensive sessions

To list the sessions with the highest cost, run `trajectory cost top`.

The ranking includes only sessions with complete cost data. A note at the
bottom gives the number of incomplete sessions that the ranking left out. A
session is incomplete when one of its turns has no price, or when a subagent
that it started used tokens and has no price.
Codex Guardian sessions are included when their provisional estimate is
complete.

### Inspect one session

If a session looks too expensive or too cheap, run
`trajectory cost inspect --session <session-id>`. You must give the full
session ID.

The command shows each turn with its cost, model, token counts, and tool
counts. It also shows the cost provenance, which tells you where each cost
came from. See [Cost Sources](#cost-sources).

The estimate at the top covers the whole session, because `cost inspect` has
no `--since` option. It is the same total that the summary and the ranking
show for the session when their window covers the whole session. It includes
the cost of the subagents that the session started. When there is such a
cost, a `Subagent cost` line under the estimate shows that part. The turn table lists the session's own turns, so the turn
costs add up to the estimate without the subagent part. See
[Subagents](#subagents).

To get facts about the same session, run
`trajectory cost observations --session <session-id>`. The command reports
local-cache observations and does not claim root cause or waste. Examples:

- the turn with the highest cost
- the share of the cost that came from subagents
- the model with the most recorded cost
- the mix of cost sources
- the number of failed or denied tool calls
- turns that have tokens but a recorded cost of zero

See [Objective Observations](#objective-observations).

### File hotspots

To see which files in a project the agents edit and read most, run
`trajectory cost hotspots`. The command uses the file tool calls that
Trajectory kept, and shows two views:

- **Editing hotspots** rank files with many write, edit, patch, or delete
  attempts. Trajectory labels these rows `review-churn`. The label suggests a
  file that might need a refactor. It does not tell you why the file changed
  often.
- **Read context** ranks files that agents read successfully. Trajectory
  labels agent setup files `expected-context`. These files include
  `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, skills, and agent configuration
  directories. Agents read them often by design.

Each view shows as a bar chart with its own scale. On a wide terminal the
two charts are side by side. On a narrow terminal they are stacked.

To look at the last 30 days, run:

```bash
trajectory cost hotspots --since 30d
```

To rank directories two levels deep, run:

```bash
trajectory cost hotspots --group-by directory --depth 2
```

To rank by tool call count, run:

```bash
trajectory cost hotspots --sort interactions
```

Options:

| Option | Effect | Default |
| --- | --- | --- |
| `--project PATH` | Selects another local project. | The current directory, or the nearest recorded project that contains it |
| `--group-by file\|directory` | Ranks single files or whole directories. | `file` |
| `--depth N` | Sets the directory levels to keep with `--group-by directory`. | `1` |
| `--sort cost\|interactions` | Ranks by cost indicator or by tool call count. | `cost` |

The USD columns are rough indicators. For each priced turn, Trajectory splits
the turn cost among the files in one view. It splits by the size of the
payloads that it kept. If a size is unknown, it splits by the number of
operations. The read view and the edit view each split the same turn cost.
Do not add the two views together, and do not use them as the spend for one
file.

The coverage value is the share of file interactions whose turn had usable
cost data. Interactions without a price still count toward the counts and
weights. Trajectory does not show them as zero-cost work.

### Validate cost data for each agent

To check the cost data of recent sessions, run
`trajectory cost validate --since 7d`. The report has one row for each agent.
The agents are Claude Code, Codex, Gemini, Pi, OpenCode, Cursor, Hermes Agent, Amp
Code, Qwen Code, Kilo Code, and Mistral Vibe.

Each row shows:

- whether the agent has recent data
- the number of turns with a positive recorded cost
- the number of turns with tokens but zero cost
- the cost sources that the agent used

The status column uses these values:

| Status | Meaning |
| --- | --- |
| `ok` | The cost data is complete. |
| `estimated` | Some Codex Guardian sessions use a provisional estimate. |
| `session-aggregate` | The client gave cost only for the whole session. Trajectory does not count these sessions as turns with cost. |
| `mixed` | Some turns have tokens but zero cost. |
| `gap` | Some sessions have no priced turns and no session cost. |
| `stale` | Some sessions have stale cost records. |
| `no-data` | The agent has no sessions in the window. |

The command exits with code 1 if a row is `gap` or `stale`. Add `--strict` to
also fail on `mixed` and `no-data`.

Gemini CLI is retired. Its row covers only sessions that Trajectory stored
before the retirement. Without such sessions, the row shows `no-data`.

The human tables for `inspect` and `validate` leave out the fidelity and
provisional-count columns. The JSON output includes them.

### Audit cost publishing

`trajectory cost audit` checks that Trajectory captured and published the
right cost for each turn. It is a preview feature.

1. Turn on the preview:

   ```bash
   trajectory config features enable cost_contract_reconciliation
   ```

2. Audit one session. The command prints the result and any problems it
   found:

   ```bash
   trajectory cost audit --session <session-id>
   ```

3. To audit all sessions from the last day, run this command. It prints only
   counts and totals, as JSON:

   ```bash
   trajectory cost audit --since 24h --summary-only --json
   ```

The audit only reads data. It compares three things for each session:

1. The client's own transcript or rollout file.
2. A new copy of the Trajectory session JSONL file, built again for the audit.
3. The rows in the metric outbox that carry `trajectory.cost_contract:v2`. The
   metric outbox is the local queue of metric rows for Datadog.

The audit ignores outbox rows without a contract tag. It reports each type of
problem on a separate line. The types are missing coverage, overcount,
undercount, wrong values, duplicate rows, delivery failures, and timestamp or
bucket errors.

Details:

- If a Codex record is larger than 8 MiB, the audit writes it to a private
  file. It keeps only the usage and cost fields in memory.
- The audit counts billable work that the client aborted or replaced.
- If a later turn repeats a cumulative token count without changes, the audit
  does not count it as a new request.
- If the client file or the outbox data is missing, the result is
  `inconclusive`.
- The detailed report marks each row as prepared or delivered. It counts the
  expected usage once, for any number of destinations.
- `--summary-only` prints only counts and totals for each stage. It leaves out
  cost values and all local identifiers.

For exit codes and the full workflow, see
`trajectory user-guide cost-reconciliation`.

### Provisional pricing

By default, Trajectory reports only the cost that it recorded with the
session. Some turns have tokens but no recorded price. The
`provisional_cost_estimates` feature adds a price for those turns when you
run a report. The feature is off by default.

1. Turn on the feature:

   ```bash
   trajectory config features enable provisional_cost_estimates
   ```

2. Run the summary. Values that include provisional cost end with `*`:

   ```bash
   trajectory cost --since 7d
   ```

3. To see how Trajectory priced each model, run:

   ```bash
   trajectory cost pricing --since 7d
   ```

With the feature on, there are two kinds of cost:

- **Verified:** cost that Trajectory recorded with the local session data.
- **Provisional:** a price that Trajectory calculates for an unpriced token
  row when you run the report.

The main `COST` value adds the two, so the summary keeps one headline number.
In human output, a row or total that includes provisional USD ends with `*`.
One line below the table explains the mark:

```text
* Provisional cost: $5.14. Details: trajectory cost pricing --since 7d
```

To find a provisional rate, Trajectory uses these steps in order:

1. It looks for a current rate for that model name.
2. It searches one list made from the cached LiteLLM price list and the
   verified built-in table of public rates. Trajectory uses the LiteLLM cache
   only while it is fresh. If both sources have the same model, the LiteLLM
   entry wins.
3. In that list, it tries a match on the full name first. Next, it tries the
   longest prefix that ends at a name boundary. Last, it tries a close spelling
   match, but only when one candidate fits.

Some LiteLLM entries have no cache rates. For those, the report shows the
assumed rates `read=0.1x_input` and `write=1.25x_input`. Some token data does
not split cache writes into 5-minute and 1-hour writes. For that data, the
report says that it assumed 5-minute writes.

To see every provisional price in the window, run
`trajectory cost pricing --since 7d`. You do not need a session ID. The
headline shows `combined = verified + provisional`. The table groups each
provisional or unresolved pricing decision by these fields:

- observed model and matched model
- agent
- pricing source and match method
- reason and cache-rate basis
- sessions, turns, tokens, and estimated USD

The table shows up to 50 groups. `--limit` changes only the number of groups
in the table. The totals always cover all sessions in the window. `--json`
returns the groups in a stable structure.

Provisional pricing changes only the reports. Trajectory does not do these
things with it:

- change the cost attribution in the SQLite cache
- treat a guessed model name as a confirmed match
- publish provisional dollars to Datadog
- convert Codex credits into USD

To go back to verified cost only, run
`trajectory config features disable provisional_cost_estimates`. The change
applies to the next report.

## Cost Sources

When the cache has them, turn rows include three provenance columns. These
columns tell you where a value came from:

- `cost_source`: where the turn cost came from. Examples are
  `native:materialized_token_usage`, `token_derived:materialized`, and
  `content_length_estimate`.
- `token_source`: where the token counts came from.
- `tokens_status`: whether the token counts are real, corrected, estimated,
  or unavailable.

Use these columns to judge how reliable a cost number is. For example, they
show if the cost came from the agent itself or from a token count and a rate
card.

The published Datadog tag `trajectory.cost_source` has a different meaning.
It names the metric stream, such as `turn_metrics` or `claude_native_otlp`.
Dashboards use the tag to select one stream.

## Objective Observations

`trajectory cost observations` says what the local cache shows. It does not
say why the agent behaved that way.

Example observations:

- "Turn 14 accounted for 41% of recorded session cost."
- "Model claude-opus-4 accounted for 72% of recorded session cost."
- "The session recorded 6 failed tool calls and 1 denied tool call."
- "2 turns have token counts but recorded zero cost."

Do not read an observation as a cause. A turn with a high cost can come from a
hard task. Use the observations as a start for your own review.

## How the Report Is Built

### Time windows

A window such as `--since 7d` selects turns by when each turn happened. The
session start time does not matter. If the window starts or ends during a
session, Trajectory counts only the turns inside the window. If a whole
session is inside the window, Trajectory can use the session total.

Turns with missing or unclear timestamps show as unavailable. The summary and
the ranking use the same set of turns. JSON output reports the window limits
apart from the session start and end times.

### Subagents

A session's cost includes the subagents that it started. In a window, a
subagent counts when the turn that started it is inside the window.

Some agents record a subagent as a session of its own, as Codex does. Such a
subagent shows as its own session. Trajectory adds to the session that started
it only the part that the subagent's own session does not show, so each
subagent counts once.

If a subagent used tokens and has no price, the cost of the session that
started it is partial. A partial session shows a known subtotal, leaves the
ranking of `trajectory cost top`, and counts as an incomplete session there.

`trajectory cost`, `trajectory cost top`, `trajectory cost inspect`,
`trajectory cost observations`, and `trajectory summary` all use this rule.
`cost inspect` and `cost observations` always cover the whole session. The
other commands show the same total for a session when their window covers the
whole session.

`cost inspect` and `cost observations` show recorded cost only. With
provisional pricing on, the summary and the ranking add provisional prices,
for a session and for a subagent's own session. So they can differ from
inspect by the provisional part.

### Automatic history repair

You do not need to run a backfill command before you view cost. Before it
builds a summary or a ranking, `trajectory cost` does two repair steps.

First, it imports sessions from client history files on disk. This step
covers Claude Code, Codex and Codex.app, Cursor, Pi, and OpenCode sessions in
the window. A session counts as inactive after two minutes without changes.
For each inactive session, the command does these things:

- It writes the Trajectory session JSONL file if it is missing.
- It adds the session to the local cache if it is missing.
- It repairs incomplete cache records.

Second, it repairs old Codex cost records for inactive sessions in the window:

- It reads only session and model settings, token counters, turn start and
  end markers, and web-search charges from the Codex rollout files.
- It skips prompts, responses, tool payloads, and compaction text before it
  decodes them.
- It changes only token, model, service-tier, and cost fields, and the session
  totals that use them.
- It stops after 25 seconds.
- If another repair is already running, it skips this step.

Both steps are local. They do not read remote credentials, queue metrics, or
publish data. They skip client files that are still active or changing. If
you set `--db`, the command skips both repair steps.

The **Coverage** section shows three counts. They are sessions found on disk,
sessions in the local cache, and sessions with incomplete or unpriced cost.
JSON output has the same counts in `local_history`, with the results for each
source. JSON output reports the Codex repair in `automatic_cost_repair`.

Trajectory leaves out a cost row if its source is active or missing. It also
leaves out a row that the repair did not reach in 25 seconds. It does not use
an older value for that row. Other sessions still count. The report shows one
total, and a note at the bottom reports the coverage. JSON output gives the
number of left-out sessions in `incomplete_ranking_sessions` or
`incomplete_cost_sessions`.

When `trajectory serve` starts, it can also run its own background Codex
repair. The `trajectory cost` command still repairs its own window.

To send cost points that a Datadog destination never received, use
`trajectory cost publish`. It rebuilds the cost metrics from the session
history that Trajectory kept, and keeps their original timestamps. Without
`--yes`, it shows a preview and sends nothing.

### Codex costs

Trajectory reports Codex tokens, API-equivalent USD, and ChatGPT Codex credits
as separate values. Do not add credits to USD, because both measure the same
usage.

- Codex Guardian review uses a provisional proxy rate labeled
  `codex-auto-review`. OpenAI has not confirmed this rate. Human output shows
  this note once, at the bottom. JSON output and `cost observations` include
  the rate and the fidelity details.
- If token data is missing, invalid, or incomplete, the cost shows as
  unavailable.
- If the output tokens already include reasoning tokens, Trajectory does not
  charge the reasoning tokens a second time.

### Cost of Trajectory analysis

`trajectory patterns analyze --yes` calls an LLM to classify your sessions.
This cost is not agent work.

When you run this command, `trajectory cost` adds a separate
**Trajectory-owned analysis** table. It has a row for
`user-driven-segmentation` with the run count, the tokens, and a cost from the
rate card. Trajectory leaves this cost out of the USD headline, the agent rows,
and the session ranking.

### Progress output

On an interactive terminal, cost commands print the current step and the time
spent to stderr. The steps include history import, Codex repair, aggregation,
ranking, and rendering. During the Codex repair, the progress line counts the
sessions that Trajectory checked, repaired, skipped, found missing, or failed
to repair. Progress never goes to stdout, so JSON and redirected output do not
change.

## JSON Output

Every subcommand supports `--json` for agents and scripts. Add the flag to
any command in the [Commands](#commands) table. For example, this command
prints the summary as JSON:

```bash
trajectory cost --json
```

The summary, hotspots, pricing, inspect, observations, and validate commands
open the local SQLite cache as read-only. To read a test cache, set its path
with `--db <path>` or `TRAJECTORY_CACHE_DB`.

`trajectory cost audit` does not use the live cache. It reads the Trajectory
session files, the client files, and the metric outbox under
`TRAJECTORY_HOME`. It builds the expected values in a temporary database.

### Token usage in `cost inspect`

The `cost inspect` JSON includes `schema_version: 1`. Read token data from
`session.token_usage`:

```json
{
  "schema_version": 1,
  "session": {
    "session_id": "01J...",
    "token_usage": {
      "scope": "turn_components",
      "component_status": "complete",
      "input": 120,
      "output": 40,
      "cache_read": 20,
      "cache_creation": 0,
      "total": 180
    }
  }
}
```

Use `scope` and `component_status` to decide which fields you can use:

- If `component_status` is `complete`, you can use the four components.
- If it is `partial`, the object keeps the values it has. They might not add
  up to the total.
- Some clients report only a total for the whole session. Then `scope` is
  `session_aggregate_only`, and `component_status` is `unavailable`. The
  object contains only `total`. Trajectory does not make up a split.
- The scopes `mixed`, `session_totals`, and `unavailable` are also not
  complete.

The older flat token fields are still present for compatibility. New
automation should use `session.token_usage`.

### Subagent cost

The cost fields include the cost of the subagents that a session started. A
separate field gives that part, so you can subtract it:

- In a session object, `subagent_cost_usd` is the subagent part of `cost_usd`,
  or of `known_subtotal_usd` when the cost is partial. It is also part of
  `verified_cost_usd`. Session objects appear in `top_sessions` of the summary,
  in `sessions` of `cost top`, and in `session` of `cost inspect` and
  `cost observations`.
- In the summary, `subagent_cost_usd` is the subagent part of `total_cost_usd`,
  or of `known_subtotal_usd` when the total is partial.
- `priced_items` and `unavailable_items` count a session's turns and its
  subagents. A subagent that used tokens and has no price adds one to
  `unavailable_items`.
- The per-agent rows in `agents` include subagent cost in `cost_usd` and have
  no separate field for it.

The field is absent when no subagent cost was added.

### Provisional fields in the summary

When provisional pricing applies, the summary JSON adds `verified_cost_usd`,
`provisional_cost_usd`, and `contains_provisional_cost`. If all data in the
window has a price, `total_cost_usd` is the combined total. If some data has
no price, `cost_state` is `partial`. In that case, `known_subtotal_usd` is the
combined lower bound.
