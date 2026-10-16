# LLM Capacity and Expense Controls

Most Trajectory work does not call an LLM. Trajectory records events, derives
metrics, and publishes them without sending the session to another model.
This page lists the Trajectory features that can call an LLM. It also shows
how to turn each one off or cap its spend.

## Quick summary

| Feature | Default | When it can call an LLM | Main controls |
|---|---|---|---|
| Task segmentation | Off. The `automatic_task_segmentation` feature flag turns it on. | None today. With the flag on, automated calls stay held until a headless CLI has a provider hard stop. Stored tasks can still publish metrics. See "Provider hard stops" below. | `segmentation.enabled`, `segmentation.interval`, `segmentation.model`, `TRAJECTORY_SEGMENTATION_DISABLED=1` |
| Patterns historical analysis | On, after you confirm | Up to two calls for each unclassified completed session. | The estimate, your confirmation, and `patterns_analysis_backfill` |
| AI gateway client routing | Off unless you select it | No Trajectory-initiated calls. It forwards the coding agent's own requests. | `--gateway`, `--no-gateway`, `ai_gateway_default_routing`, `ai_gateway.defaults`, the selected profile |

## Stop LLM calls from the capture server

To make sure the capture server starts no LLM calls, do this step. Commands
that you confirm, such as `trajectory patterns analyze --yes`, can still call
a model.

Automatic task segmentation runs only after you turn on the
`automatic_task_segmentation` feature flag. While the flag is on, turn
segmentation off again with:

```bash
trajectory config set segmentation.enabled false
```

To turn off segmentation for one server or shell only, set the environment
variable:

```bash
TRAJECTORY_SEGMENTATION_DISABLED=1 trajectory serve
```

## Check current settings

To see your whole effective config, run:

```bash
trajectory config show
```

To check one setting, use the command in this table:

| Setting | Command |
|---|---|
| Task segmentation on or off | `trajectory config get segmentation.enabled` |
| Turns between segmentation passes | `trajectory config get segmentation.interval` |
| Headless session capture | `trajectory config get capture.include_headless_agents` |
| Segmentation monthly budget | `trajectory config get segmentation.monthly_budget_usd` |

To see recent segmentation activity, search the serve logs:

```bash
trajectory doctor logs --grep 'segmentation:'
```

## Monthly budgets and provider hard stops

Segmentation has its own monthly budget for each user. The budget defaults to
`$10` and resets at the start of each UTC calendar month. To read the budget
setting, see [Check current settings](#check-current-settings).

To see the budgets and the spend for this month, run:

```bash
trajectory cost budget
```

`trajectory cost budget` shows each feature budget and each provider quota
for the current UTC month. For each one, it shows the limit, the settled
charge, the reserved amount, the remaining amount, and call counts. It shows
verification details but never the credential. Add `--json` for a
machine-readable report. The command only reads data. It does not create a
ledger for a user who has made no automated calls.

A budget of `0` blocks automated calls for that feature. A higher value allows
more calls. Changing the value does not delete history from earlier months.

### Provider hard stops

An automated request can start only if the provider can also stop it. This
check is the provider hard stop. Each request must have all of these:

- a built-in price for the model
- a safe upper limit on input size
- an output-token limit that the provider enforces

A direct API request also needs a quota receipt for the current month. The
receipt shows that the credential and endpoint use a dedicated provider
account. That account must have a monthly hard quota that refuses requests
over the limit. If the receipt is missing, stale, invalid, or for a different
credential, the request fails before Trajectory sends it.

MCP sampling and the installed headless coding-agent CLIs cannot meet these
rules yet. Trajectory therefore makes zero automated calls through them.
Today this holds all automated task segmentation.

### Record a provider quota receipt

Operators record a receipt after two steps. First, they create a dedicated
credential scope with a hard quota. Second, they confirm that the provider
refuses a request over the limit. The credential stays in its environment
variable or keychain entry. The command stores only a one-way binding to the
credential and details that are not secret:

```bash
trajectory cost budget quota record \
  --provider anthropic \
  --account-scope trajectory-automation \
  --quota-usd 10 \
  --period 2026-09 \
  --verified-by quota-check \
  --config-generation quota-config-generation \
  --evidence-ref sha256:immutable-evidence \
  --dedicated-scope --over-limit-refused --yes
```

In production, set `--period` to the current month. Do not copy the example
value. Record a new receipt after each of these changes:

- a new UTC month starts
- you rotate the credential
- the endpoint changes

### How Trajectory reserves and charges spend

Before a direct request starts, Trajectory reserves its worst-case price. It
reserves this amount against the feature budget and against the provider
quota. The reservation is saved in the local budget ledger. Trajectory runs
these calls one at a time across all Trajectory processes that share a home
directory.

After the call, a cost receipt from the provider replaces the reservation.
The receipt can charge more than the reservation. If cost data is missing, or
the call fails, times out, or returns a bad response, Trajectory charges the
full worst case. A reservation that is never settled blocks later automated
calls, even after a restart or a fallback.

The budget stops spending after a call ends. The call that crosses the budget
finishes, and Trajectory denies the next automated call. Estimates can differ
from the provider's rounding, subscription credits, gateway prices, and failed
requests. A model with unknown or custom pricing gets a fixed reservation, so
it cannot skip the budget.

### Commands you confirm do not use the budget

`trajectory patterns analyze` is user-driven. It does not check or charge the
automation ledger. Instead, it shows an estimate and calls no model until you
confirm.

## AI gateway client routing

AI gateway routing sends the coding agent's own requests through a configured
upstream. Trajectory does not start any inference of its own on this path.
Gateway traffic does not count toward the monthly automation budgets.

- `trajectory claude` and `trajectory codex` do not probe the model or the
  upstream at startup.
- The health and authenticated model-discovery endpoints answer locally. They
  make zero upstream calls.
- Each accepted client request makes one upstream request.
- A request with credentials can retry once after an upstream `401`.
- Trajectory forwards an Anthropic token-count request only when Claude Code
  sends one. It never schedules token counting itself.

The Frontier runtime follows the same rules. When you enable Frontier,
`trajectory claude` and `trajectory codex` launch through it. Frontier uses
Pup to authenticate at launch. It does not probe models or send inference
requests at launch, and its health checks make no gateway calls. Frontier
forwards each accepted client request once, including token counting. It
retries at most once after a `401`.

## Task segmentation

Task segmentation splits a session into tasks. Automatic segmentation is off
by default, and the `automatic_task_segmentation` feature flag turns it on. It
does not depend on trace export. Even with the flag on, automated calls are
held today, because no headless CLI has a provider hard stop. So new sessions
are not segmented until one does. Tasks that are already stored can still
publish task metrics when `segmentation.publish_metrics` is on. You can still
read the task data that already exists. `trajectory patterns analyze` also still works with its
estimate and confirmation.

The rest of this section describes how segmentation runs after a headless CLI
gets a hard stop. Segmentation can run when `export.traces` is `off`, because
it fills the local task cache. It can also feed optional task metrics and
traces.

### When segmentation runs

For an interactive session that is not headless, segmentation runs in the
background at these points:

- every 10 completed turns
- every 20 completed turns while the previous task is still open, because the
  trigger backs off to twice the interval
- once at session end, to set the final task boundaries

Segmentation makes zero calls in these cases:

- The selected turns have no prompt, response, or tool call. This includes
  empty stored turns.
- The session has 1 turn.
- The stored final tasks already cover every turn. A duplicate session end
  does not classify it again.

### Call count

This formula is an approximate upper limit for an interactive session with
`N >= 2` turns:

```text
floor(N / 10) admitted incremental passes + 1 final pass
```

For example, a 23-turn session usually makes about 3 calls: at turn 10, at
turn 20, and at session end. Adaptive backoff can lower that number. A 1-turn
session makes zero calls.

Final segmentation never sends a long transcript as one request. If the
compact transcript is longer than 12,000 characters, Trajectory keeps every
turn and classifies it in ordered windows. It carries only the checked open
task into the next window. Empty sessions and empty incremental ranges stop
before Trajectory checks the provider or the budget.

### Retries and fallbacks

Each segmentation operation starts at most two provider calls. The first call
goes to the first provider. The second call goes to one fallback provider.
Local provider discovery or a policy rejection does not use up these two
calls.

- If transport errors use both calls, a parse or validation error does not
  start a third provider.
- If the first call succeeds but its output does not match the schema, the
  retry goes to a different provider. It does not repeat the prompt against
  the same backend.
- A failed final segmentation gets at most one more automatic recovery
  attempt.

### Repair missing segments

`trajectory patterns segment` repairs ended sessions that have no task
segments. By default it shows a preview and makes no calls. When it runs, it
does the same final segmentation pass as session end. It uses the same
hard-stop check and monthly budget.

- `--all` needs a positive `--limit`. The default is 50.
- `--timeout` limits the time for each session. The default is 2 minutes.

### Control segmentation

To turn off segmentation, run:

```bash
trajectory config set segmentation.enabled false
```

To make incremental passes less frequent, raise the interval:

```bash
trajectory config set segmentation.interval 25
```

Some settings control only which outputs Trajectory publishes. They do not
stop local segmentation work:

- `segmentation.publish_metrics`
- `segmentation.task_insights.publish`
- `export.turn_traces`
- a destination-level `segmentation.enabled: false`

To stop the LLM calls, use `segmentation.enabled: false`.

The former `enhanced_segmentation_classification`,
`two_pass_segmentation_classification`, and `task_meta_segmentation` flags are
removed. Configs that still name them keep loading, and Trajectory ignores
them.

### Headless sessions

When export is configured, Trajectory captures and publishes headless
coding-agent sessions by default. Segmentation always skips headless sessions. To stop capture and publish for headless
sessions that Trajectory did not start, run:

```bash
trajectory config set capture.include_headless_agents false
```

Trajectory always suppresses its own classifier and segmenter subprocesses.

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
stops after the estimate and makes no calls. For the default local cache,
`--yes` also allows the Agent Console task-metric replay. The replay
covers only the capture retention period. See
`trajectory user-guide backfill` for details.

```bash
trajectory patterns analyze --period 7d
trajectory patterns analyze --period 7d --yes
```

Your confirmation is separate from the background automation rules. The
command can run when `segmentation.monthly_budget_usd` is exhausted or `0`.
These rules still apply:

- the feature flag
- the estimate and your confirmation
- the fixed session plan
- claims that let a stopped run resume
- a cost receipt for each attempt

### What analysis classifies

Analysis works on completed sessions in the local cache. It does not replay
the incremental segmentation cadence. It runs two passes:

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
reader discovery, the local UI, Patterns, Improve, and segmentation catch-up.
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

Incognito is a privacy control. It does not cap LLM calls for the whole
config. It stops sending trace and log content to ordinary destinations. By
default, metrics then leave out model and repository names. Local
segmentation and semantic classification continue. To guarantee zero
segmentation calls across your config, use `segmentation.enabled: false`.

Completed top-level headless sessions can still be part of a confirmed
`trajectory patterns analyze` run. Setting
`capture.include_headless_agents=false` stops capture and publish for headless
sessions that Trajectory did not start.

## Cost reporting

If a Datadog-typed destination has marker metrics enabled, Trajectory sends
metrics about its own LLM use. It sends them on a best-effort basis through
the agentless OTLP metrics transport, one copy for each such destination.

| Metric | Type | Tags | Notes |
|---|---|---|---|
| `trajectory.serve.llm_capacity.calls.total` | count | `feature`, `backend`, `gen_ai.request.model`, `pass`, `cost_source` | Trajectory-owned classifier calls. `feature` is `segmentation`, or `user_driven_segmentation` for confirmed backfill. |
| `trajectory.serve.llm_capacity.cost.usd.total` | count | `feature`, `backend`, `gen_ai.request.model`, `pass`, `cost_source` | Estimated USD cost for calls whose model has a price. |
| `trajectory.serve.llm_capacity.duration_ms` | distribution | `feature`, `backend`, `gen_ai.request.model`, `pass`, `outcome`, `reason`, `attempt` | One sample for each segmentation provider decision or call attempt. See the reasons below. |
| `trajectory.serve.llm_capacity.failures.total` | count | `feature`, `pass`, `error_class`, `reason` | Failed classifier operations, including saved historical-analysis attempts. See the budget reason below. |

A hard-stop failure before a call has `outcome:denied` on
`trajectory.serve.llm_capacity.duration_ms`. Its `reason` tag is one of these:

- `provider_quota_missing`
- `provider_quota_stale`
- `provider_quota_exhausted`
- `request_bound_missing`
- `unsettled_spend`
- `budget_exhausted`

Other `reason` values include `auth`, `rate_limit`, `timeout`, `empty_output`,
and `execution_failed`.

When automated segmentation hits the monthly budget,
`trajectory.serve.llm_capacity.failures.total` reports
`error_class:budget,reason:budget_exhausted`. Older versions reported the less
useful `provider/other`.

The cost metric estimates token counts from the prompt and output size. Then
it prices those counts with Trajectory's model pricing table. It is not a
provider invoice. If the model is not visible or has no price,
`trajectory.serve.llm_capacity.calls.total` still counts the call with
`cost_source:pricing_unknown`.

A backend error can still mean that the provider used capacity. This happens
when a call fails or returns output that Trajectory cannot parse. Group the
failure counter by `error_class` and compare it with the call and cost
metrics.

### Recover after a budget or quota denial

If a final segmentation is held for `budget_exhausted`, Trajectory reports it
with `retry_state:blocked`. It then stops automatic recovery attempts for that
session. After the UTC month resets, or after you review and change the
budget, run `trajectory patterns segment` to rebuild the local task data.

Provider hard-stop denials also appear in the capacity and segmentation
failure metrics. The session still finishes normally. Trajectory does not keep
a finished session open only to add optional task data. After you set up or
fix the provider quota, run the same `trajectory patterns segment` command.

### Useful queries

```text
sum:trajectory.serve.llm_capacity.cost.usd.total{*} by {feature}
sum:trajectory.serve.llm_capacity.calls.total{*} by {feature,backend}
count:trajectory.serve.llm_capacity.duration_ms{*} by {feature,backend,outcome,reason,attempt}
sum:trajectory.serve.llm_capacity.failures.total{*} by {feature,pass,error_class,reason}
```

## What does not add Trajectory-owned LLM calls

These settings and features do not ask another LLM to process the session:

- `export.traces` controls whether captured spans publish to LLM
  Observability.
- `export.metrics` controls whether metrics publish.
- `export.placeholder_llm_span` controls a synthetic Datadog LLM span for cost
  enrichment. It does not call an LLM.
- Marker evaluation uses rules over local SQLite data. This includes built-in
  and YAML markers.
- `segmentation.publish_metrics`, `segmentation.task_insights.publish`, and
  `export.turn_traces` control publishing of task and turn outputs that
  already exist.
- `segmentation.publish_traces` is a compatibility key. Trajectory accepts it
  and ignores it.

## Classifier providers and isolation

This section describes which provider each classifier uses. These rules apply
to confirmed analysis today. They will apply to automated segmentation after
a headless CLI gets a provider hard stop.

### Isolation for every call

Segmentation uses one registry of inference-only providers.
A few client-specific exceptions for segmentation are listed below. Every
classifier call follows these rules:

- It turns off Trajectory capture and configured MCP servers.
- It uses read-only, plan, or ask mode.
- It starts in a new, empty working directory with no repository content.

Trajectory never starts the retired Gemini CLI as a classifier.

### Provider order

Incremental segmentation prefers the coding-agent CLI of the captured session,
if it is installed locally. Final segmentation uses the shared
`classifier.standard_fallbacks` chain for every client. This gives final task
data the same classifier across the fleet. It does not depend on the client's
login or model quality.

| Captured client | Incremental classifier |
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

Trajectory reuses the successful CLI for the second classifier call in the
same pass. A failed backend, or one whose output does not match the schema,
waits five minutes while a healthy backend exists. The last successful
backend goes first for later shared calls. Claude and supported Codex versions
get the closed JSON schema directly. For older Codex versions, Trajectory
checks the output with a parser and validator. To override the model for every
provider, set `segmentation.model`.

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
