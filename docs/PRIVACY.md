# Privacy Controls

This page says what Trajectory keeps on your computer, what each destination
receives, and how to keep a session's content out of Datadog. A destination is
a place where Trajectory sends data, such as a Datadog organization. To stop
recording completely, see
[Stop capture](CONFIGURATION.md#stop-capture) in the configuration guide.

## What Stays Local

Every capture path first writes the session to local JSONL in
`~/.trajectory/trajectories/`. Publishing, markers, metrics, and the local
viewer all read it from there. The local copy holds the full session content:
prompts, responses, and tool input and output. At the `standard` and `full`
trace levels, published spans include that content too. Use
[incognito](#incognito) to keep sensitive work out of Datadog.

These stay on your computer:

- Transcript text and file paths that Trajectory reads only to count
  deliverables.
- The file names, session identity, paths, errors, and parser lines of an
  import. They appear only in local command output. A metric failure never
  changes an import.
- Inventory files. Trajectory does not send them to Datadog.
- Summaries of Claude Code's own traces, in
  `~/.trajectory/state/otlp-proxy/traces/`. They hold IDs, timing, names, and
  allowed attributes. They hold no raw OTLP bodies and no tool input.

Session JSONL, local viewer data, publish records, and publish queues never
store API or application keys.

Records of automated reviews hold the review's ID, kind, outcome, duration,
usage, and cost. They never hold the reviewed transcript, tool arguments,
tool output, or reasoning.

To resolve an SSH host alias, Trajectory reads only `Host`, `HostName`, and
`Include` lines inside `~/.ssh`. It never runs `ssh -G`, never runs
`Match exec`, and does no network lookup.

## What Each Destination Receives

Your organization decides which destinations exist and what each is for. To
ask what an exempt destination receives, contact the team that owns your
managed policy.

### Spans and event logs at `minimal`

Each destination has a trace level: `off`, `minimal`, `standard`, or `full`.
At `minimal`, spans and event logs send only a fixed list of structural
fields. Each value must pass a check, and every other field is dropped. At
`off`, spans are not sent, and event logs use the `minimal` list. Configured
tags and local identity tags are sent as written.

A `minimal` span keeps IDs, timing, status, session, model, provider, tokens,
cost, and the listed metadata. It keeps tool, agent, MCP, and plugin names,
versions, branch, tags, and the attributed repository and change. It drops
content, thinking, and a subagent's prompt, result, task name, nickname, and
transcript path. It also drops skill names, error text, and values that fail
their checks.

At `minimal`, event logs drop content, copied client objects, paths outside
the project, repository and project names, identity, skill names, agent
nicknames, and task names. Forwarded events keep the type, sequence,
timestamps, IDs, tool states, counts, costs, durations, client, model,
provider, `project_dir`, branch, and provenance.

At `minimal`, these checks apply:

- Text must be one token of up to 128 characters. A token starts with a
  letter, digit, or `_`, and may also hold `.:#+=@|-`. Models and branches
  allow 255 characters and `/[],`, and a value that holds `:/` is dropped.
- Session IDs must be one token, or up to 128 letters, digits, `_`, and `-`.
- In spans, a model or provider can be a display name of up to five words
  and 255 characters, such as `Amazon Bedrock`. In event logs it must be one
  token.
- A project directory must be absolute, relative to `~`, a Windows drive
  path, or a UNC path. It holds at most 1,024 bytes, with no quotes, spaces,
  or invisible characters.
- Numbers in metadata become text of up to 32 characters. Summary, context,
  rate limit, and compaction objects keep only their defined counters.
- Maps such as `token_usage` keep only the listed entries. Lists keep the
  items that pass and are dropped whole above 256 items.
- Event numbers and booleans pass. Timestamps must be numbers or RFC 3339
  with at most 9 fractional digits. Costs given as text must be plain
  decimals.
- `approval_path`, `client_source`, `capture_level`, and the tool `phase` must
  come from fixed lists. The retired `client_source` value `claude_code` is
  dropped.
- An error status is only `tool failed: <category>`, `permission denied`,
  `permission denied: <category>`, or `model call failed`. The categories are
  `command-failed`, `user-rejected`, `edit-failed`, `file-changed`,
  `file-too-large`, `file-not-found`, and `other`.
- A span name that is not one token becomes the name of its kind, such as
  `tool`. A model call span takes its model's name, and an unknown kind
  becomes `task`. A span whose trace or span ID is not one token is not sent.

Marker logs at `minimal`:

- Ingest marker logs keep the facts of the forwarded event. Each marker keeps
  only its own listed keys. `permission-denied` checks its decision against a
  fixed list. `tool_name`, `permission_mode`, and `decision_source` must be
  one token.
- At `off` or `minimal`, definition marker logs send no `detail`. They keep
  the name, severity, confidence, turn, `tool_use_id`, range, and a fixed
  outcome text.
- A marker ID that names a skill, error category, language, or path, such as
  `slash-command-<name>`, sends only its kind.
- `files-touched` keeps only its count. Pull request context markers and
  `compaction` markers send no detail. Stored pull request work rows are never
  sent.
- A marker log sends `tool_use_id` only when it is one token of at most 128
  characters. A skill marker keeps the call ID when it recorded that call, so
  you can join it to tool call logs.

The user, host, and developer email on a span come from the identity resolved
on your computer. They never come from session or event content.

A field of one token, such as a tool name, branch, model, agent type, or
client ID, can still hold an email or a key. Incognito keeps spans and logs
out of ordinary destinations, but metrics keep tool names.

### Metrics

- Built-in metric tags never hold commands, refs, object IDs, patterns, or
  source text. Custom marker dimensions publish what you extract. Pull request
  identity uses only `change_host`, `owner`, `repo`, and `change_number`.
- Only the pull request file-work indicator has a `file_path` tag. It holds
  up to 25 paths, relative to the repository, for each pull request and lens.
  The rest go to `_other`. It is off unless `export.pr_file_work_cost_indicator`
  is on. While it is off, no point and no file name leaves the computer, and
  points queued earlier are dropped. A `false` in organization config wins
  over a `true` in your config. Redacted incognito metrics drop the tag.
- Cost overlap tags classify only the route. They never hold URLs, headers,
  credentials, helper commands, or account and organization IDs. Older Claude
  spans get `unknown`.
- Metric exports carry only Trajectory's own resource attributes.
  `OTEL_RESOURCE_ATTRIBUTES` never becomes metric tags.
- Health and capture server metric tags never hold prompts, paths, receipt
  IDs, process IDs, raw errors, bodies, URLs, or credentials. Only
  `trajectory.inventory.extension.installed` holds a session ID. No host,
  user, session, path, caller, or fingerprint is a dimension of the capture
  server's cost metrics. The health privacy and destination settings apply to
  them.
- Agent Security metrics never hold session or turn IDs, paths, prompts,
  commands, tool input or output, rule IDs, hashes, trace IDs, evidence, or
  emails.
- Skill metrics and AI Usage events never publish prompts, responses, tool
  input or output, commands, diffs, file contents, raw payloads, or paths.

### Other records

- Operational events hold fixed codes, the endpoint and process identity, the
  session ID, and triage fields. `operational_logs.include_session_id: false`
  leaves out the session ID. They never hold error text, paths, prompts,
  payloads, or credentials.
- The destination's oversight setting and privacy controls apply when an
  oversight point is queued, and again when it is sent.
- Pull request attribution reuses no credentials. It publishes no commands,
  refs, object IDs, URLs, diffs, emails, or code.

### Agent launchers and proxies

- `trajectory claude` records each model call's full Anthropic request and
  response bodies as span input and output, with secrets and personal data
  redacted.
- When Claude Code sends telemetry only to the local capture server,
  `trajectory claude` turns on content: prompts, responses, tools, and raw API
  bodies. You can turn it off.
- When Claude Code's settings name a collector, `trajectory claude` leaves the
  content options as they are. Use `OTEL_LOG_USER_PROMPTS` and the related
  `OTEL_LOG_*` variables. They count only from the environment, user
  settings, or managed settings, not from project settings.
- With `server.otlp_proxy.endpoint` set, the capture server forwards the
  telemetry it receives, content included, to that endpoint. To withhold
  content, turn it off in Claude Code's settings.
- With Codex's built-in OpenAI provider or `--gateway`, `trajectory codex`
  stores every Responses API request and response, redacted. Its model call
  spans show instructions, input, tools, reasoning, output, and stream events.
- The OpenCode proxy records calls to the `anthropic`, `openai`, `xai`, and
  `google` providers. Each becomes a model call with bodies, service tier, and
  the cache write split. A ChatGPT plan login, WebSockets, and `opencode serve`, `web`,
  and `acp` go direct.

## Incognito

Incognito stops publishing the current session's content. It ends with that
session, and earlier sessions are not affected. It applies on Trajectory's
capture server, so it works for any captured session.

To turn it on, type `/incognito` in the coding agent. In Claude Code, type
`/trajectory:incognito`. Trajectory saves the session's state in one atomic
write and reads it back before it reports success. If the write fails, the
command explains what to do and keeps the earlier, safer state.

### Turn incognito off

Only you can turn incognito off. Type `/incognito off`. In Pi,
`/incognito off all` publishes again for every session. If Trajectory is not
running, `/incognito off` changes nothing. Start Trajectory and try again.

An agent can turn incognito on with the `trajectory_incognito` tool. The tool
refuses `enable: false`. Trajectory logs each switch-off with its source, such
as `source=slash_command`. An agent that can run shell commands can still turn
incognito off through the script or the CLI. The tool's refusal only closes
the easy path.

### What incognito changes

During incognito, Datadog destinations that are not exempt receive no traces,
logs, AI Usage events, or managed operational logs that name the session.
Collectors you add over OTLP follow incognito like any other destination that
is not exempt. Switching incognito on or off sends no metric.

These continue during incognito:

- Local JSONL capture and local processing.
- `trajectory patterns session` and metric refresh.
- Accounting and activity metrics, without model and repository tags by
  default. Cost and token metrics publish in both metric modes.

Incognito also changes these:

- `trajectory patterns analyze` and `estimate` leave incognito sessions out,
  and say how many. Their JSON reports `excluded_incognito`.
- Destinations that are not exempt get no Agent Security metrics for the
  session.
- Health records of the session stay local, even for exempt destinations.
  Trajectory checks this again before it sends. Local health records hold no
  user identity.
- The session's pull request facts stay `local_only` and get no cost share.
  Commit and push facts still count, redacted.
- Late correction totals follow their session's privacy, including a later
  switch to incognito.

### Metric modes

`export.incognito_metrics` sets the metrics of incognito sessions:

- `redacted`, the default, removes the model and repository tags before the
  metrics leave your computer.
- `standard` keeps them.

There is no `off` mode. A managed value wins.

`redacted` removes these tags: model, `trajectory.session_models`, reasoning
effort, `service_tier`, every `trajectory.model.*` tag, provider, route, cost
visibility, pricing, cost overlap, and cost dedupe. It also removes repository, owner, remote host,
repository source, project, path, and change tags.

`redacted` adds `trajectory.metrics_disclosure:redacted`. It keeps identity,
timestamps, values, cost, tokens, activity, client, version, classifications,
host, OS, and the cost method. It removes only the listed tags. Trajectory
does not interpret custom tags, and the measurements that remain might still
reveal identity.

### Exempt destinations

A managed destination with `incognito_exempt: true` keeps receiving data
during incognito and opt-out, for approved security or audit use. Only
trusted user or managed config can set it. The destination needs an
`api_key_ref` and `level: full`. An Agent Security destination that sends only
findings can use `level: off`.

Exempt destinations never receive accounting, marker, custom, or
active-destination metrics. They receive no marker logs and no AI Usage
events. During opt-out, only exempt destinations get operational events, and
the queues of the others are dropped. Operational events that name an
incognito session go only to exempt destinations.

### Agent Security during incognito

Incognito leaves Agent Security on. AI Guard still checks the current prompt,
tool call, or tool result, even in observe mode. For Antigravity CLI it
checks even events Trajectory does not capture. During incognito, AI Guard
gets no session history.

### Opt out of all sessions

`trajectory config publish opt-out` applies incognito to all your current
and future sessions. `trajectory config publish opt-in` publishes again. Both
accept `--json`.

An agent can opt you out with `trajectory_incognito` and `persistent: true`.
It needs no session ID. Only you can opt back in.

Trajectory saves the choice in `~/.trajectory/standard-publish.disabled` and
reads it without a restart. Opt-out stops trace and log outputs and the
managed CLI and MCP usage counts. Destinations that are not exempt get the
incognito metric mode. Opt-in affects only future sessions. A session that
saw incognito stays suppressed until it ends.

## Redaction

Your organization can list model ID suffixes in
`export.redacted_model_suffixes`. Your `config.yaml` can add suffixes, but
cannot remove the organization's. A model whose ID ends in one of them always
loses the model tags that `redacted` removes, in metrics and AI Usage events.
A suffix matches the end of the ID or the end of any part of it, ignoring
case. Parts split at `_`, `/`, `:`, `@`, `,`, brackets, spaces, and tabs,
never at hyphens. A trailing `[...]` marker is removed first. This
redaction adds `trajectory.model_disclosure:redacted`. It keeps the
repository, accounting, and activity tags, and it applies even under
`standard`. With no list, nothing is redacted this way.
`trajectory doctor` and `trajectory status` show how many suffixes apply and
where they come from.

Captured data and module spans always have credentials removed. AI Guard
removes them only when the managed evaluator sets
`credential_redaction: true`. The default is `false`.

`<sensitive>...</sensitive>` blocks are a convention for readers. They do not
redact anything, and Trajectory may capture them locally. Use `/incognito` to
keep that content out of Datadog. Keep sensitive values out of metric tags,
marker dimensions, pull request descriptions, commit messages, and public
comments.

Trajectory ignores the `confidential`, `restricted`, and `unclassified`
labels that an older release stored. Spans that such a release held are never
sent and are removed with the local data.

## LLM Calls Trajectory Makes

These call a model: a confirmed `trajectory patterns analyze --yes` run, the
prompt in `trajectory patterns`, and Trajectory Lens's Work page and
investigations. Capture, metrics, markers, publishing, and the capture server
never do. `export.traces`, `export.metrics`, `export.placeholder_llm_span`,
`export.turn_traces`, and marker evaluation never send a session to a model.

Trajectory does not capture its own classifier runs, unless managed capture
policy requires capture. Then it marks them `trajectory_internal`, hides them
locally, and still sends them to required security destinations.

### Analyze sessions

1. Run `trajectory patterns estimate --period 7d` to see the estimate.
   `--details` shows the provider and token assumptions. `--period all` warns
   about the higher cost.
2. Run `trajectory patterns analyze --period 7d`. It stops after the
   estimate.
3. Add `--yes` to classify the sessions.

There is no monthly LLM budget. A session needs one call for each of two
passes, and up to four with retries. A confirmed run splits sessions into
tasks, adds Work Insights labels, saves the results locally, and sends nothing
to Datadog. A session's end never waits for it.

Analysis covers completed top-level sessions, including headless ones, but
not subagents, automated reviewers, or Trajectory's own classifier sessions.
It runs only missing passes, so a fully labeled session makes no call. Fixing
task boundaries also refreshes the Work Insights labels. Each attempt saves a
local receipt with its success, calls, format errors, and estimated tokens and
cost, so a run can resume.

### Which model runs

Analysis first tries the session's own client CLI, if it is installed. Then
it tries `classifier.standard_fallbacks` in order, skipping duplicates. The
default list is `claude`, `codex`, `opencode`, `cursor`. Managed config can
reorder or shorten it, or set it to `[]`. If it adds `agy`, `agy` becomes a
fallback for all clients. If a CLI fails, the next one runs.

| Client | How it classifies |
| --- | --- |
| Claude Code | `claude-haiku-5-5` |
| Codex | `gpt-6-luna` at low effort |
| Pi | Pi's own direct path first, with `anthropic/claude-haiku-5-5`, then `openai/gpt-6-luna`, at low thinking. Then the configured list. Pi is never a fallback for other clients. |
| OpenCode | An isolated `opencode run` with Haiku 5.5, GPT-6 Luna, or Gemini 3.1 Flash-Lite, using only providers that OpenCode's policy allows |
| Antigravity CLI | A sandboxed `agy --print` with `gemini-3.6-flash-low`. |
| Cursor Desktop and Cursor Agent | Headless `cursor-agent` in ask mode with `composer-2.5`, a sandbox, and an empty workspace |
| GitHub Copilot CLI | Claude Haiku 4.5 when available, else Copilot's automatic choice. It serves only Copilot sessions. If it fails, the normal fallback list runs. |

Classifier calls can use `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`. The
OpenCode classifier can also use `GEMINI_API_KEY` or
`GOOGLE_GENERATIVE_AI_API_KEY`. Classifier runs remove provider base URL
overrides. The Claude Code and Codex classifiers still use the key, on the
provider's public route. The Pi and OpenCode classifiers check a custom route
before they use a key. The Cursor classifier needs `cursor-agent login` or
`CURSOR_API_KEY`.

Headless Claude calls use the `apiKeyHelper` from Claude's managed settings,
then from `~/.claude/settings.json`. Tokens are cached for 15 minutes, and
failures for 5. If a configured helper fails or returns no token, the call
fails with `headless Claude apiKeyHelper: ...` and does not fall back to the
Claude login. Without a configured helper, Claude uses its normal login.

### How classifier runs are isolated

- Every call turns off capture and starts in an empty directory.
- Claude Code, Pi, and Copilot run with no tools. OpenCode denies every
  permission. Codex runs read-only, Cursor in ask mode, and Antigravity in
  plan mode. Cursor and Antigravity keep their MCP servers and their normal
  saved state.
- Other clients turn off saved client state where they support it.
  Otherwise the state goes in temporary directories that Trajectory deletes.
- Copilot runs the installed `copilot` binary in an empty mode: no tools,
  permissions, config discovery, Git, skills, storage, or telemetry.
- OpenCode runs in a temporary pure mode: no user plugins, sharing, tools,
  project config, or external skills, and managed config skips it. Only the
  chosen credential is copied, to temporary state with mode `0600` that is
  deleted afterward. The source file is not changed.
- OpenCode's free Zen models are never fallbacks, because their retention
  terms may allow training.

## Delete Data

Published data stays in Datadog for its retention period. Sessions that age
out locally are not sent again.

## Shared Computers

Do not use Trajectory on a computer you share with accounts you do not trust.
While the capture server is down, another account can take its port. It can
then read Claude Code hook data and approve or change tool calls. Accounts or
sandboxed processes that reach loopback can read your sessions through the
local API. Turn off its automatic start with `local_ui.auto_start`, and run
`trajectory local-ui` only when you need it.
