# Cost Tracking

Trajectory records local token and cost telemetry for supported coding-agent
sessions. Use `trajectory cost` when you want a local cost view without
querying Datadog or inferring invoice totals. The command normally reads the
cache; when it finds an obsolete Codex cost derivation, it may repair only the
affected token and cost fields before displaying the result.

For Codex, summaries keep observed tokens, standard API-equivalent USD, and
ChatGPT Codex credits separate. They represent the same usage, so adding credits
to the dollar estimate would double count it. Guardian automatic-review
sessions use an explicitly labeled provisional `codex-auto-review` proxy
estimate based on third-party rate evidence pending provider billing
validation. Unsupported, negative, incomplete, or session-only token evidence
without the required cache breakdown remains unavailable instead of being
treated as free.

Before producing a summary or ranking, `trajectory cost` automatically repairs
quiet stale Codex sessions in the requested window. The cost-only repair reads
model settings, token counters, turn boundaries, and web-search charges, then
updates only cost evidence. It does not replace tools, markers, prompts,
responses, or evaluation data. Active or changing sources and concurrent
repair are deferred without blocking.

Rows that cannot yet be repaired remain excluded, but valid evidence from other
sessions stays visible as a conservative known-subtotal lower bound.
`trajectory cost top` reports a partial ranking and the excluded-session count
instead of presenting the result as complete.

## Commands

```bash
trajectory cost
trajectory cost top --since 7d
trajectory cost inspect --session <session-id>
trajectory cost observations --session <session-id>
trajectory cost validate --since 7d
```

`trajectory cost` shows a recent summary by agent and the highest-cost local
sessions in the selected window. Use `--since all`, `--since 24h`, or
`--since 2026-06-01` when you need a different window. Finite windows are
applied to observed turn activity, not to the session's original start time.
A long-running session therefore contributes only observed turn activity inside
the window. A current, completed Codex session whose start falls inside the
window uses its authoritative priced session aggregate; when the window starts
mid-session, Trajectory still uses only the in-window turns. Summary totals and
top-session rows use the same population;
JSON top rows expose `window_started_at` and `window_ended_at` separately from
the session lifetime timestamps. Explicit whole-session aggregate evidence
is included only when its session evidence timestamp falls inside the window
because it has no finer-grained split. A missing evidence timestamp fails
closed as unavailable in a finite window instead of assigning the lifetime
amount to an arbitrary turn; `--since all` can still use the exact lifetime
aggregate because no temporal placement is required. Session-wide aggregate
authority wins over incidental turn rows whenever the aggregate is in scope.
Turn timestamps are parsed chronologically, including RFC 3339 offsets, rather
than compared as text. Legacy or malformed turn timestamps enter a finite
window only when parseable session bounds or another valid turn prove possible
overlap; those ambiguous rows remain unavailable rather than exposing a coarse
fallback as precise turn cost.

`trajectory cost inspect --session <session-id>` shows turn-level cost evidence:
cost, model, token counts, tool counts, and cost provenance. This is the best
first command when a session looks expensive or unexpectedly cheap.

`trajectory cost observations --session <session-id>` reports objective
local-cache observations. It does not claim root cause or waste. Examples
include the highest-cost turn, dominant model by recorded cost, cost source mix,
failed or denied tool counts, and token-positive turns that recorded zero cost.

`trajectory cost validate` checks recent sessions for Claude Code, Codex,
Gemini, Pi, OpenCode, Cursor, Hermes Agent, Amp Code, Qwen Code, Kilo Code, and
Mistral Vibe. It reports whether each agent has recent data, positive recorded
turn costs, zero-cost turns with tokens, and the observed cost sources.

## Cost Sources

Turn rows include provenance columns when the cache has them:

- `cost_source`: where the turn cost came from, such as
  `native:materialized_token_usage`, `token_derived:materialized`, or
  `content_length_estimate`.
- `token_source`: where token counts came from.
- `tokens_status`: whether token counts were real, corrected, estimated, or
  unavailable.

These fields are important for fidelity. A cost number is more useful when you
can tell whether it came from a native agent field or from token-derived
pricing.

## Model Pricing

When managed catalogs are present, Trajectory resolves exact observed model
aliases through `~/.trajectory/org/model-equivalence.yaml` and prices them
through `~/.trajectory/org/provider-pricing.yaml`. Model identity and pricing
modes remain separate: thinking effort, speed tier, billing mode, and context
tier do not collapse into one approximate model name. Heuristic matches remain
unpriced.

Fast modes also preserve their native billing unit. Codex GPT-5.6 fast mode
reports its 2.5x ChatGPT credit utilization separately while its API-equivalent
USD remains at the Standard rate. Exact API Priority aliases use the provider's
published 2x Standard rate. Trajectory does not stack fast and long-context
multipliers unless the provider documents that combination; unsupported
fast-tier long-context usage remains unpriced.

## Objective Observations

`trajectory cost observations` intentionally uses objective language. It should
say what the local cache shows, not why the agent behaved that way.

Good observations:

- "Turn 14 accounted for 41% of recorded session cost."
- "Model claude-opus-4 accounted for 72% of recorded session cost."
- "The session recorded 6 failed tool calls and 1 denied tool call."
- "2 turns have token counts but recorded zero cost."

Avoid treating these as causal explanations by themselves. A high-cost turn may
reflect a genuinely difficult task. The command is meant to give evidence that a
human or agent can inspect further.

## JSON Output

Every subcommand supports `--json` for agents and scripts:

```bash
trajectory cost --json
trajectory cost inspect --session <session-id> --json
trajectory cost observations --session <session-id> --json
trajectory cost validate --json
```

The command normally reads the local SQLite cache. Its bounded Codex cost repair
may update obsolete cost projections before output. Override the cache path with
`--db <path>` or `TRAJECTORY_CACHE_DB` when inspecting an isolated test cache.
