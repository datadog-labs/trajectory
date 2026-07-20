# Cost Tracking

Trajectory records local token and cost telemetry for supported coding-agent
sessions. Use `trajectory cost` when you want a local, read-only cost view
without querying Datadog or inferring invoice totals.

For Codex, summaries keep observed tokens, standard API-equivalent USD, and
ChatGPT Codex credits separate. Guardian automatic-review sessions use an
explicitly labeled provisional `codex-auto-review` proxy estimate based on
third-party rate evidence pending provider billing validation. Unsupported,
negative, incomplete, or session-only token evidence without the required
cache breakdown remains unavailable instead of being treated as free.

Codex cache rows created before the current ownership and rate derivation are
excluded from cost, credit, session, turn, token, and top-session totals. If a
stale row intersects the requested window, the overall result fails closed as
unavailable and reports the repair command rather than presenting a partial
ranking as complete. Normal `trajectory serve` startup performs a bounded,
default-on repair for quiet retained sessions.

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
the window. Summary totals and top-session rows use the same sliced population;
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

`trajectory cost validate` checks recent sessions for the six main supported
agents: Claude Code, Codex, Gemini, Pi, OpenCode, and Cursor. It reports whether
each agent has recent data, positive recorded turn costs, zero-cost turns with
tokens, and the observed cost sources.

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

The command reads the local SQLite cache in read-only mode. Override the cache
path with `--db <path>` or `TRAJECTORY_CACHE_DB` when inspecting an isolated
test cache.
