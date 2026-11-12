# LLM Capacity and Expense Controls

Most Trajectory work does not call an LLM. Trajectory records events, derives
metrics, and publishes them without sending the session to another model.
This page lists the Trajectory features that can call an LLM. It also shows
how to turn each one off or cap its spend.

## Quick summary

| Feature | Default | When it can call an LLM | Main controls |
|---|---|---|---|
| Patterns historical analysis | On, after you confirm | Up to two calls for each unclassified completed session. | The estimate, your confirmation, and `patterns_analysis_backfill` |
| AI gateway client routing | Off unless you select it | No Trajectory-initiated calls. It forwards the coding agent's own requests. | `--gateway`, `--no-gateway`, `ai_gateway_default_routing`, `ai_gateway.defaults`, the selected profile |
| `trajectory opencode` capture proxy | Off unless you run the command | No Trajectory-initiated calls. It forwards OpenCode's own requests. | Run `opencode` directly |

## The capture server makes no LLM calls

`trajectory serve` never calls a model. It does not split sessions into tasks
or classify them. Only commands that you confirm, such as
`trajectory patterns analyze --yes`, call a model. Trajectory has no monthly
LLM budget. Instead, `trajectory patterns analyze` shows an estimate and calls
no model until you confirm it.

Trajectory no longer has the `automatic_task_segmentation` feature flag or
any `segmentation.*` setting. A configuration file that still names them
loads, and Trajectory ignores those entries.

## AI gateway client routing

AI gateway routing sends the coding agent's own requests through a configured
upstream. Trajectory does not start any inference of its own on this path.

- `trajectory claude` and `trajectory codex` do not probe the model or the
  upstream at startup.
- The health and authenticated model-discovery endpoints answer locally. They
  make zero upstream calls.
- Each accepted client request makes one upstream request.
- A request with credentials can retry once after an upstream `401`.
- Trajectory forwards an Anthropic token-count request only when Claude Code
  sends one. It never schedules token counting itself.

The AI Gateway runtime follows the same rules. When you enable the AI Gateway,
`trajectory claude` and `trajectory codex` launch through it. The AI Gateway uses
Pup to authenticate at launch. It does not probe models or send inference
requests at launch, and its health checks make no gateway calls. The AI Gateway
forwards each accepted client request once, including token counting. It
retries at most once after a `401`.

## OpenCode capture proxy

`trajectory opencode` sends OpenCode's model calls through a local proxy for
that launch. The proxy forwards each request OpenCode makes once, to the
provider OpenCode would have called, and records it. It starts no request of
its own, and it does not probe the provider at startup.

## Headless sessions

When export is configured, Trajectory captures and publishes headless
coding-agent sessions by default. To stop capture and publish for headless
sessions that Trajectory did not start, run:

```bash
trajectory config set capture.include_headless_agents false
```

Trajectory always suppresses its own classifier subprocesses.

## Patterns historical analysis

`trajectory patterns` shows the usual one-number estimate when classification
is incomplete. In a terminal, it offers to start the repair. Reports that are
not interactive, and JSON reports, never prompt and never call a model. To see
the estimate directly, run:

```bash
trajectory patterns estimate --period 7d
```

Add `--details` to see the provider, prompt-token, and output-token
assumptions. You can use `--period all`, but the command warns you. The cost
for the whole retained history can be much higher.

`trajectory patterns analyze` shows the same estimate. Without `--yes`, it
stops after the estimate and makes no calls. With `--yes`, it classifies the
sessions and saves the results on this computer. It sends nothing to Datadog.

```bash
trajectory patterns analyze --period 7d
trajectory patterns analyze --period 7d --yes
```

These rules apply to every run:

- the feature flag
- the estimate and your confirmation
- the fixed session plan
- claims that let a stopped run resume
- a cost receipt for each attempt

### What analysis classifies

Analysis works on completed sessions in the local cache. It runs two passes:

- The coding pass returns task boundaries. For every turn, it also returns
  outcome, complexity, autonomy, risk, coding task type, reversibility, and
  side effects.
- The Work Insights v1 pass labels each fixed leaf task and turn with the
  broader Level 1 and Level 2 work taxonomy.

A session with full coverage runs neither pass. A session with complete coding
labels but missing Work Insights labels runs only the Work Insights pass. If
the coding boundaries need repair, Trajectory also refreshes the Work Insights
task labels for those boundaries.

### Resume and reuse

Trajectory saves a versioned receipt for each attempt in the local database.
Each receipt records whether the attempt succeeded, the call count, format
errors, estimated tokens, and estimated cost. This lets a stopped run resume.

Trajectory reuses existing final rows without a new call only in one case.
Every stored turn must have matching coding and Work Insights labels linked
to its closed task. Trajectory repairs older task-only rows and partial
results.

- An active claim stops two commands from doing the same work.
- A failed claim can run again.
- If a crash happens after all results are stored, the next run adopts the
  stored rows.
- Before it writes repaired labels, the confirmed run upgrades an older local
  cache to the current schema.

### Which sessions analysis includes

Completed top-level user sessions are included, even when a headless agent
created them. Analysis excludes child and subagent sessions, automated
reviewers, and Trajectory's own classifier sessions. This keeps internal work
out of the report.

All Trajectory-owned coding-agent classifiers use the same headless launcher.
It turns off saved state where the client supports that. Otherwise, it keeps
state in temporary directories that Trajectory deletes. If managed security
policy requires capture, Trajectory marks the authenticated launch as
`trajectory_internal`. These features then skip it: local forwarding,
reader discovery, the local UI, Patterns, and Improve.
This mark never hides a session from a required security destination.
Headless sessions that a user starts are not marked and stay visible.

Incognito does not remove stored local sessions from this analysis, because
you asked for it. `--yes` confirms the model calls. It does not turn trace
publishing back on or create a new trace export.

## Sensitivity classification (removed)

Trajectory no longer classifies sessions by sensitivity. This path makes no
LLM calls and has no budget. `export.sensitivity.*` and the
`sensitivity_scanning` feature still load, and Trajectory ignores them. For
more detail, run `trajectory user-guide privacy`.

### Incognito and headless sessions

Incognito is a privacy control. It stops sending trace and log content to
ordinary destinations. By default, metrics then leave out model and repository
names. It does not change `trajectory patterns analyze`, which calls a model
only when you confirm it.

Completed top-level headless sessions can still be part of a confirmed
`trajectory patterns analyze` run. Setting
`capture.include_headless_agents=false` stops capture and publish for headless
sessions that Trajectory did not start.

## Cost reporting

Confirmed patterns analysis records estimated cost and call counts in its local
attempt receipts.

## What does not add Trajectory-owned LLM calls

These settings and features do not ask another LLM to process the session:

- `export.traces` controls whether captured spans publish to LLM
  Observability.
- `export.metrics` controls whether metrics publish.
- `export.placeholder_llm_span` controls a synthetic Datadog LLM span for cost
  enrichment. It does not call an LLM.
- Marker evaluation uses rules over local SQLite data. This includes built-in
  and YAML markers.
- `export.turn_traces` controls publishing of turn outputs that already
  exist.

## Classifier providers and isolation

This section describes which provider `trajectory patterns analyze` uses.

### Isolation for every call

Classification uses one registry of inference-only providers. A few
client-specific exceptions are listed below. Every classifier call follows
these rules:

- It turns off Trajectory capture and configured MCP servers.
- It uses read-only, plan, or ask mode.
- It starts in a new, empty working directory with no repository content.

Trajectory never starts the retired Gemini CLI as a classifier.

### Provider order

Analysis prefers the coding-agent CLI of the captured session, if it is
installed locally. It then follows the shared `classifier.standard_fallbacks`
chain.

| Captured client | Classifier |
|---|---|
| Claude | `claude-haiku-4-5-20251001` |
| Codex | A temporary read-only `codex exec` with `gpt-5.6-luna` at low reasoning effort |
| Antigravity | Sandboxed `agy --print` with `gemini-3.6-flash-low` |
| Cursor Desktop and Cursor Agent | Headless `cursor-agent` ask mode with `composer-2.5`, a sandbox, and an empty workspace |

If a released `classifier.standard_fallbacks` list contains `gemini`, the list
still loads. Trajectory ignores that entry.

The chain starts with the paths that match the client. It then follows the
`classifier.standard_fallbacks` order and skips duplicates. The default order
is Claude, Codex, OpenCode, and Cursor Agent. Antigravity matches its own
client but is no longer a standard fallback. Managed `config.defaults.yaml` or
cohort config can change the list in these ways:

- reorder it
- remove entries
- add `agy`
- set it to an empty list

The stable non-interactive Cursor path needs `CURSOR_API_KEY`. Agy OAuth
calls need a registered GCP quota project. If an installed CLI fails to
authenticate or run, it exits. Trajectory then tries the next local provider.

Trajectory reuses the successful CLI for the second classifier call of the
same session. A backend that fails waits five minutes while a healthy backend
exists. The last successful backend goes first for later calls. Trajectory
checks every output with a parser and validator. If the output does not match
the closed schema, the one retry goes to the next provider in the chain.

### OpenCode

OpenCode sessions prefer an isolated `opencode run` classifier. Automatic
selection uses only providers that are authenticated and that OpenCode policy
allows. It tries them in this order:

1. Anthropic Haiku 4.5
2. OpenAI GPT-5.6 Luna
3. Google Gemini 3.1 Flash-Lite

Trajectory copies only the selected credential into temporary state with mode
0600. It leaves out other provider credentials and endpoint overrides from the
environment. It never writes the source credential file. It deletes the
temporary state after the call. OpenCode's free Zen models are not automatic
fallbacks. Their published retention terms may allow use for model
improvement.

Trajectory replaces OpenCode home, XDG, cache, temp-directory, and loader
settings with temporary directories that the classifier owns. Pure mode
leaves out user plugins. Trajectory loads the bundled OpenAI OAuth adapter
only when OpenAI is selected. OpenCode also runs with these turned off:

- sharing, tools, and user plugins
- project configuration and external skills
- instructions from the environment

It uses temporary home, config, data, state, cache, temp, and workspace
directories. If a system or device-managed OpenCode configuration is active
or cannot be checked, Trajectory does not start OpenCode. It moves on to the
fallback chain.

### Claude

Headless Claude calls use the same `apiKeyHelper` that Claude Code would use.
Trajectory reads Claude managed settings first, then `~/.claude/settings.json`.
It uses the first file that sets `apiKeyHelper`. Env values in those files can
be strings, numbers, or booleans.

Trajectory runs the helper itself and caches the token for 15 minutes. After a
failure, it caches the result for 5 minutes. It starts Claude with `--bare`,
the token, and the file's `ANTHROPIC_*` settings. It leaves out
`ANTHROPIC_API_KEY`.

If the helper fails or prints no token, the headless call fails with
`headless Claude apiKeyHelper: ...`. It does not fall back to Claude's own
login. Without a configured helper, Claude logs in as usual.

### GitHub Copilot

GitHub Copilot CLI and VS Code Copilot sessions first use GitHub's official SDK
with an installed `copilot` binary. The SDK runs in empty mode with these
settings:

- a replacement classifier system prompt
- an empty tool allowlist
- denied permission requests
- no configuration discovery, host Git operations, skills, session storage,
  telemetry, or streaming

Its workspace and state are temporary. Trajectory pins Claude Haiku 4.5 when
the SDK reports that it is available. Plans that do not allow a named model keep Copilot's `auto`
selector.

Trajectory never selects Copilot for another client's session. These failures stop Copilot before Trajectory
moves to the normal fallback chain:

- a missing binary
- a login or account-policy failure
- a timeout
- a malformed response
- a validation failure

### Pi

Pi sessions start with Pi's own direct path, then the configured chain. If
every CLI in the chain fails, Pi gets one more best-effort attempt. That
attempt uses Haiku 4.5, a classifier-only system prompt, and low thinking.
Pi is never a fallback for other clients.
