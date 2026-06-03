# Cost Tracking

Trajectory records local token and cost telemetry for supported coding-agent
sessions. Use `trajectory cost` when you want a local, read-only cost view
without querying Datadog or inferring invoice totals.

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
`--since 2026-06-01` when you need a different window.

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
