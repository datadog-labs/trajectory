# Per-Repo Publish Configuration

Use a `publish.trajectory.yaml` file in a repo to control what Trajectory
publishes for that repo. The file can pick trusted destinations, reduce what
they receive, and add destinations for metrics only. A destination is a place
where Trajectory sends data, such as a Datadog organization.

If `publish.trajectory.yaml` is missing, Trajectory still reads the deprecated
`.trajectory/publish.yaml` path.

Repo markers live in a separate file, `.trajectory/markers.yaml`. To define
them, run `trajectory user-guide repo-markers`.

For a simple setup with one destination, you do not need this file. Use the
`export.*` fields in `~/.trajectory/config.yaml` instead. Do not add `type`
under `export:`. Only destination objects in managed config or repo overlays
take a `type` field.

## Quick start

1. Declare the trace destination in trusted user or managed config:

   ```yaml
   # ~/.trajectory/config.yaml or managed config.defaults.yaml
   export:
     site: us5.datadoghq.com
     ml_app: checkout-agents
     traces: standard
     metrics: true
   ```

2. If the repo needs less trace detail, tags, filters, or marker metrics,
   commit a project overlay as `publish.trajectory.yaml`:

   ```yaml
   # publish.trajectory.yaml
   version: 1
   destinations:
     - name: _config_datadog
       level: minimal
       markers:
         enabled: true
         metrics: true
       tags:
         team: checkout
         environment: production
   ```

3. From the repo, check the result:

   ```bash
   trajectory publish validate
   ```

   The command checks the schema, the trust policy, the credentials, and the
   marker settings. It prints each destination and any authority decisions.

## What this file controls

A project publish config can do these things:

- Lower the trace level of a trusted destination.
- Add safe tags and filters.
- Turn on marker metrics for chosen destinations.
- Add project destinations that receive metrics only.

A project publish config cannot do these things:

- Add a new trace destination.
- Raise trace detail above the level that the trusted destination allows.
- Set the site, endpoint, credential references, privacy exemption, or
  incognito behavior of a trace destination. These come from user or managed
  config.
- Change the transport of a trace destination.
- Turn on or change security event streams, AI Usage events, module spans, or
  Agent Security output. Only managed destinations can turn these on.

The built-in Datadog destination from `~/.trajectory/config.yaml` is named
`_config_datadog`. Trajectory builds it from `export.site`, `export.ml_app`,
`export.traces`, and `export.metrics`. The `export:` block has no `type:`
field.

## Trust model

Trajectory ignores repo publish configs until you trust the repo's git origin.
You set trust in user or managed config. A repo publish file cannot set it.

```yaml
publish_trust:
  allowed_origins:
    - "github.com/example-org/*"
    - "github.com/acme/*"
  require_committed: true
  allowed_sites:
    - "datadoghq.com"
    - "us5.datadoghq.com"
    - "datadoghq.eu"
```

- `allowed_origins` lists the git origins whose publish files Trajectory
  reads.
- `require_committed: true` ignores publish files that git does not track.
  This blocks local changes that nobody committed.
- `allowed_sites` lists the Datadog sites that repos may use. If it is empty,
  Trajectory accepts only its known public Datadog sites. A list that you set
  replaces that default.

A trusted repo can narrow approved trace destinations. It can also add
metrics-only destinations on approved sites.

## Destination types

Destination `type` names the backend or transport. It appears only inside a
`destinations:` or `required_destinations:` list. There is no `export.type`.

| Type | Use it for |
|---|---|
| `datadog_agentless` | Sending to Datadog directly. Trajectory handles egress and credentials. |
| `datadog_agent` | Sending through a local Datadog Agent, which handles egress and credentials |
| `otlp` | Sending to an OpenTelemetry HTTP collector |

Trajectory still accepts the legacy aliases `datadog`, `dd_llmobs`, and
`dd_llmobs_via_agent` for old configs. `dd-agent` is not a destination type.
Use `datadog_agent` in new config.

### Datadog agentless

```yaml
destinations:
  - name: dd-main
    type: datadog_agentless
    site: datadoghq.com
    ml_app: payments-agents
    api_key_ref: dd-payments-api-key
    level: standard
```

`datadog_agentless` sends trace spans and all metrics through Datadog's
agentless OTLP intakes. Set `otlp_traces_url` to send trace spans to another
OTLP endpoint. `intake_url` does not redirect them.

The retired `traces_transport` values `direct`, `dd`, `llmo`, and `llmobs`
still load. Trajectory logs one warning for each destination that sets one and
sends its spans over OTLP. Any other value except `otlp` is rejected. The
deprecated `metrics_transport` and `metrics_url` keys accept any value and do
not change routing.

In a project config, Trajectory accepts a new `datadog_agentless` destination
only for metrics. It needs `level: off` and marker metrics turned on.

### Datadog Agent

```yaml
destinations:
  - name: dd-via-agent
    type: datadog_agent
    ml_app: payments-agents
    level: minimal
```

`datadog_agent` sends LLM Observability spans through the local Datadog
Agent's `evp_proxy`, the route the LLM Observability SDKs use. The Agent adds
its own API key and handles the site, proxies, and egress, so this destination
needs no Datadog API key on the host. Declare trace use in trusted config.

Trajectory finds the Agent in this order:

1. The destination's `agent_url`, such as `http://127.0.0.1:8126`.
2. `DD_TRACE_AGENT_URL`.
3. `DD_AGENT_HOST`, on port 8126.
4. `http://127.0.0.1:8126`.

`agent_url` and `DD_TRACE_AGENT_URL` can also name the Agent's Unix socket,
such as `unix:///var/run/datadog/apm.socket`.

Spans go to `<agent>/evp_proxy/v2/api/v2/llmobs`. Set `intake_url` to send
them somewhere else, such as a proxy in front of the Agent. Trajectory sends
the same Agent request there, with no API key. `TRAJECTORY_INTAKE_URL` does not
change this route.

If the Agent is not running, Trajectory keeps the turn's spans queued and
retries them later. The Agent's trace receiver and `evp_proxy` are on by
default. Trajectory needs both.

### OTLP

```yaml
destinations:
  - name: security-otlp
    type: otlp
    endpoint: https://otel.security.example.com
    level: minimal
    markers:
      enabled: true
      metrics: true
      logs: true
```

`otlp` sends traces, metrics, and marker event logs to an OpenTelemetry
collector. Declare it in trusted config. Trajectory adds `/v1/traces`,
`/v1/metrics`, and `/v1/logs` to the base `endpoint`. So set `endpoint`
without a signal path. OTLP destinations authenticate at the collector. They
do not use Datadog API keys.

`trace_shape` sets the shape of the turn traces an `otlp` destination receives:

- `conventions` follows the OpenTelemetry GenAI semantic conventions. Use it
  for a generic collector.
- `datadog` keeps the shape the Datadog LLM Observability intake expects. Use
  it for a collector that forwards traces into Datadog LLM Observability.

Without `trace_shape`, an `otlp` destination uses `datadog` unless the
`otlp_conventions_trace_shape` feature is on. Datadog destinations always use
`datadog`. They reject `trace_shape: conventions`.

### OTLP proxy for client telemetry

The OTLP destination is separate from `server.otlp_proxy`. The proxy receives
OTLP logs and metrics that a client sends to `trajectory serve`, such as
Claude Code telemetry.

Set `server.otlp_proxy.endpoint` only when you want this flow: the client sends
OTLP to Trajectory, and Trajectory forwards it to another collector.
Trajectory forwards the logs and adds identity tags to the metrics.

The relay adds tags such as `trajectory.cost_role:client_telemetry` and
`trajectory.cost_source:claude_native_otlp`. These metrics do not count toward
Trajectory's attribution cost totals.

Native OTLP logs, metrics, and traces share these limits in each Trajectory
process:

- At most four requests at the same time.
- At most 5 MiB for each request body.

When all four slots are busy, Trajectory returns HTTP 503 with
`Retry-After: 1`. The client's exporter retries. `trajectory ps --json` and
`/health` report the `native_otlp_admission` capacity, use, peak, and
rejection counts.

## Trace levels

| Level | What the destination receives |
|---|---|
| `off` | No traces |
| `minimal` | Structure and metadata only |
| `standard` | Standard LLM Observability detail |
| `full` | All captured content that privacy policy allows |

Trajectory always captures at full detail on your computer. The trace level
controls only what a destination receives. It does not turn metrics on or
off.

A project overlay can only lower the trace level of a trusted destination. If
a trusted destination allows at most `minimal`, a repo cannot raise it to
`standard` or `full`.

### Content in `minimal` spans

At `minimal`, a span sends only what Trajectory lists as structure.
Trajectory treats a level it does not recognize the same way. It sends a
listed value only when the value passes its check, and it drops everything
else. That includes a metadata key or a tag that nobody has listed yet. So a
field that Trajectory adds to a span later cannot send content before someone
lists it.

`standard` and `full` spans carry content. `standard` leaves out thinking
text.

#### What a `minimal` span keeps

- Trace, span, and parent IDs, span kind, links, start time, and duration.
- Status: `ok`, `error`, or `unknown`.
- The session ID.
- The model and the provider.
- Token and cost numbers.
- Listed metadata and tags: IDs, counts, flags, timestamps, and states such
  as the permission mode and the stop reason.
- Tool names, agent types, and the name of a configured agent.
- Plugin IDs and versions, and MCP server and tool names.
- Client and app versions, and the Git branch.
- The project directory. The `project_dir` tag holds its last path segment.
- Tags that you set in configuration: `tags`, `publish_tags`, and a
  destination's `tags`. Trajectory sends them as you wrote them.
- User and host tags. Trajectory resolves them on your computer, never from
  the session.
- The repository, owner, and change number that Trajectory attributes to a
  turn.

#### How Trajectory checks each span value

A span value passes the same checks as a forwarded event value. See
[How Trajectory checks each value](#how-trajectory-checks-each-value). The
128, 255, and 1,024 limits are the same. These rules are specific to spans:

- One token starts with a letter, a digit, or `_`. The rest can be letters,
  digits, and `_ . : # + = @ | -`. A model ID or a branch can also contain
  `/ [ ] ,` after its first character, as in `claude-opus-4-7[1m]`.
- Each name and each ID must be one token.
- The model and the provider can be a display name of up to five words
  joined by single spaces, as in `Claude Opus 4.7` or `Amazon Bedrock`. Each
  word follows the model ID rules and cannot end with `.` or `,`.
- Trajectory sends the session ID when it has only letters, digits, `_`, and
  `-`, and at most 128 characters. It also sends a session ID that is one
  token.
- Span metadata holds each number as text. The number can have a sign, a
  fraction, and an exponent, as in `9e-05`. It can have at most 32
  characters.
- The `project_dir` tag is one path segment of at most 255 bytes. It can
  start with a dot.
- Five metadata values are objects: `request_summary`, `response_summary`,
  `context_breakdown`, and `rate_limit` on a model call, and
  `compaction_usage` on a compaction. Each keeps only the counters that
  Trajectory defines for it, such as `message_count`, `text_length`,
  `system_tokens`, and `requests_remaining`. A counter must be a boolean or a
  number of at most 32 characters. Trajectory drops any other key together
  with its value, whatever the key says.
- A span whose name is not one token takes the name of its kind, such as
  `tool`. A model call's name is its model, so it can be a display name.
- Trajectory does not send a span whose trace ID or span ID is not one token.
  It writes one log line with the count. No current span has such an ID.

#### What a `minimal` span drops

- Input, output, and thinking text.
- A sub-agent's prompt, result, last message, task name, nickname, and
  transcript path.
- Skill names.
- Error text. The status message says only this:
  - A failed tool: `tool failed: <category>`. The category is
    `command-failed`, `user-rejected`, `edit-failed`, `file-changed`,
    `file-too-large`, `file-not-found`, or `other`.
  - A denied tool: `permission denied`. Trajectory adds the denial category
    when the client reported it as one token.
  - A failed model call: `model call failed`. It has no category.
- A value that is not one token, other than a model or provider display
  name. None of these examples leaves at `minimal`:
  - a tool named `Read File` or `$web_search`
  - the client version `2.1.0 (Claude Code)`
  - the project directory `/Users/x/My Project`
  - a branch that starts with `#` or contains parentheses

#### One token can still leave a span

A span field whose check is "one token" sends any one token, as a forwarded
event does. See [One token can still leave](#one-token-can-still-leave). A
client, a user, or a model chooses the value in these span fields:

- The tool name, which is also the name of the tool span
- The tool names that a model call returned (`llm_output_tool_use_names`)
- The agent type and the name of a configured agent
- MCP server and tool names, and plugin IDs
- The Git branch and the project directory
- The model and `model_label`
- `denial_category`, which also appears in the status message of a denied
  tool
- `stop_reason`, `failure_type`, and `permission_source_detail`

#### Module spans

The trace level does not change module spans. A destination turns them on
with `module_spans`. Trajectory sends them at `level: off` and at `minimal`
as the module wrote them. They follow their own `ai_edr_disclosure_profile`.

### Content in marker event logs

Marker event logs (`markers.logs: true`) follow the same level for content:

- `standard` sends event and marker content but leaves out thinking. It drops
  fields whose names contain `thinking` or `reasoning`, and the
  `thought_signature` field. It also drops the text of events whose type
  contains `thinking` or `reasoning`.
- `full` sends every captured field.

The `event_logs` query still matches on the whole event. The level changes
only which fields Trajectory sends.

At `off` or `minimal`, a forwarded event sends only the fields that Trajectory
lists as structure. Trajectory treats a level it does not recognize the same
way. It sends a listed field only when the value passes that field's check,
and it drops everything else. That includes a field under a name Trajectory
has never seen. So a field that a client adds later cannot send content
before someone lists it.

#### What a forwarded event keeps

- Event type, sequence number, timestamps, and the session, turn, tool-call,
  trace, and span IDs.
- Tool name, phase, success, decision, decision source, approval path,
  permission mode, and stop reason. Also the other statuses, sources, and
  modes that clients report.
- Token counts, costs, durations, line and file counts, and flags.
- Client, client version, model, and provider.
- The facts that `minimal` spans also carry:
  - The project directory. This is `project_dir`, or `cwd` on a session start
    that has no `project_dir`.
  - The branch (`git_branch`) and the agent type.
  - The agent, plugin, and MCP server identity in `provenance`.
- The per-tool timing that Claude Code measures (`native_tool_timing`). This
  covers start and end times, execution time, and the wait for a permission
  decision.

Trajectory builds the log message and the `session_id` tag from the kept
fields.

#### How Trajectory checks each value

Trajectory does not send a value that fails its check.

- Trajectory sends a number or a boolean as it is, whatever its size.
- A timestamp must be a number or an RFC 3339 date-time. It can have at most
  nine fractional digits.
- A cost written as text must be a plain decimal number. It can have at most
  nine digits on each side of the point.
- `approval_path`, `client_source`, `capture_level`, and the `phase` of a tool
  event must each be a value from a fixed list. Trajectory drops a
  `client_source` in the retired spelling `claude_code`. Current clients write
  `claude-code`.
- Any other text must be one token of at most 128 characters. It cannot
  contain spaces, slashes, or quotes.
- A model ID or a branch name can be up to 255 characters. It can also
  contain slashes, square brackets, and commas. Trajectory drops a value that
  contains `:/`, as a URL does.
- The project directory must be an absolute path, a home-relative path (`~`
  or `~/...`), or a UNC path (`\\server\share\...`). It can be at most
  1,024 bytes.
  Trajectory drops a path that contains any of these:
  - a quote
  - a space or other Unicode white space, so a directory with a space in its
    name is dropped
  - a line or paragraph separator
  - a control, format, or private-use character
  - a variation selector
  - a character that displays as blank or as nothing, such as a zero-width
    space or a Hangul filler

  Any other text of that length passes, as it does in a `minimal` span.
- A map such as `token_usage` keeps only its listed entries.
- Trajectory keeps a list only in a field that holds a list, such as
  `tool_use_names`. It keeps the items that pass. It drops a list of more
  than 256 items whole.

#### What Trajectory drops

- Content: tool input and output, prompts, messages, summaries, titles, typed
  denial reasons, error text, thinking, and attachments.
- Objects that Trajectory copies whole from the client.
- File paths other than the project directory, transcript paths, and
  repository and project names. `minimal` spans do not carry them.
- The top-level `agent_name`, `developer_email`, `user_email_hash`, and the
  provider session keys. Spans take the developer's email from the identity
  that Trajectory resolved, never from the event.
- Skill names: `trajectory_skill_name`, `trajectory_skill_invocations`, any
  `skill_name` field, and the name in `provenance.skill`.
- `agent_nickname` and `agent_task_name`. These hold the task description or
  name that the model gave.
- Every field of an event type that Trajectory does not define, except its
  type, IDs, and timestamp.
- A structural field that is missing from the list, until someone adds it.

#### One token can still leave

A field whose check is "one token" sends any one token. The limit is 128
characters, or 255 for model and branch values. For the project directory it
is 1,024 bytes without white space. Trajectory does not know what the token
means. So it would send an email address, or a string shaped like an API key,
in one of these fields.

A client or a user chooses the value in these fields:

- `git_branch`
- Tool names: `tool_name`, `tool`, the items of `tool_use_names`, and the
  `name` of each entry in `tool_calls`
- `agent_type`, which can be the display name that an agent was given
- Model fields: `model`, `model_id`, `model_label`, and the `model` inside a
  usage map
- `provenance.agent.name`, `provenance.mcp.server`, `provenance.mcp.tool`,
  and `provenance.plugin.id`
- `failure_type`, the error type that a hook or tool reported
- `stop_reason` and `finish_reason`, which some clients report as free text
- `notification_type`
- IDs that the client chooses: `session_id`, `task_id`, `workspace_id`, and
  `source_terminal_key`
- `role`, `agent_color`, and `message_kind`

`minimal` spans send the same facts for most of these fields. Use incognito
for a session that must send nothing.

### Content in marker logs

Point and range marker logs are stricter at `off` or `minimal`. What a marker
log sends depends on what wrote the marker. Its field names do not matter.

- **Markers from a marker definition**, built-in or your own, send no
  `detail`. A definition's `extract` and `extract_fields` can store prompt,
  response, or tool values under any name. So Trajectory cannot trust any
  detail name.
- The log of such a marker keeps the marker name, severity, confidence, turn,
  and the tool call's `tool_use_id`. A range also keeps its turn range and its
  outcome.
- The outcome is the `on_complete` or `on_session_end` text in the definition.
  Trajectory sends it as written, like the marker name. It never holds a value
  from the session.
- **Markers that Trajectory detects during ingest** keep the same facts as
  forwarded events.
- Trajectory checks these values against a fixed list: the decision of a
  `permission-denied` marker, the denial category, and the approval path. It
  also checks the language of `language-activity`.
- Trajectory sends these values as the client reported them: tool name,
  permission mode, decision source, and the decision of a `permission-result`
  marker. Each must be one token of at most 128 characters, without spaces or
  slashes.
- The file count for `files-touched` stays. Trajectory drops the typed denial
  reason, file paths, and skill names.
- **PR-work markers** keep their counts, confidence, command family, and
  generated IDs. Trajectory drops the repository, owner, and change number.
- **`compaction` markers** send no `detail`.

A marker's `tool_use_id` is the client's tool call ID. Trajectory sends it as
the client reported it, under the same one-token limit. If the ID does not
fit, Trajectory does not send it.

Some marker IDs contain a skill name, error category, language, or file path.
Trajectory sends only the kind for these IDs, such as `skill-invoked`. This
includes the `slash-command-<name>` ID of a skill run as a slash command.

A skill marker found through a tool call keeps that call's ID. So the marker
log still joins to the tool call's event log.

These rules do not change marker metrics or their tags. To receive marker
details in logs, use `standard`.

## Markers and metrics

```yaml
destinations:
  - name: dd-main
    type: datadog_agentless
    site: us5.datadoghq.com
    ml_app: checkout-agents
    api_key_ref: dd-checkout-api-key
    level: standard
    markers:
      enabled: true
      metrics: true
      logs: false
```

`markers.enabled` turns on marker publishing for that destination. If neither
`metrics` nor `logs` is set, Trajectory sends marker metrics. This keeps older
configs working.

`export.metrics` and the destination's own settings control base telemetry.
Base telemetry includes cost, token, turn, and session metrics. Metrics from
markers and custom metrics also need `markers.metrics: true` on the
destination. If a destination sets `markers.metrics: false`, it receives no
metrics.

Custom marker definitions live in these files:

- `~/.trajectory/markers.yaml`.
- `~/.trajectory/markers.d/*.yaml`.
- The repo's `.trajectory/markers.yaml`.

For the repo workflow, run `trajectory user-guide repo-markers`. For marker
syntax, run `trajectory user-guide markers`.

Custom metrics go only to destinations that you select by name. A destination
needs marker metrics turned on to receive them. Trajectory does not send
custom metrics to every active destination by default.

## Metrics-only project destinations

A project config can add a destination for custom metrics without adding a
trace destination:

```yaml
version: 1
destinations:
  - name: checkout-metrics
    type: datadog_agentless
    site: us5.datadoghq.com
    ml_app: checkout-agents
    api_key_ref: dd-checkout-metrics-key
    level: off
    markers:
      enabled: true
      metrics: true
      logs: false
    tags:
      team: checkout
```

`level: off` is required. Trajectory rejects a project destination with a
trace level above `off` or with marker logs turned on.

Use this form for metrics that a repo or team owns. For example, a project
might need metrics in a separate Datadog organization, or with its own tags.

For your own user config, a simpler form sends metrics only:

```yaml
export:
  site: us5.datadoghq.com
  ml_app: coding-agents
  traces: off
  metrics: true
```

This creates the built-in `_config_datadog` destination. Do not add `type` to
this `export:` block.

Both forms can target the same site and `ml_app`. Trajectory then skips the
duplicate metric copy only if they also use the same API key reference. A
project destination with a different `api_key_ref` counts as a separate
Datadog organization.

## Tags

### Global tags and destination tags

Top-level `tags:` in `~/.trajectory/config.yaml` or managed
`config.defaults.yaml` describe the machine or deployment:

```yaml
tags:
  team: platform
  environment: development
  workspace: cloud
```

Trajectory adds these global tags to published Datadog telemetry. That means
LLM Observability spans and Trajectory DD metric series for base, marker,
heartbeat, and task metrics.

Trajectory does not add global tags to these places:

- Local JSONL.
- OTLP exports.
- Claude native OTLP proxy metrics.
- Process health and privacy counters.

Destination `tags:` belong to one destination. You can set them in a trusted
destination or in a repo `publish.trajectory.yaml`. Use them when one
destination needs more routing tags, or another value for a key that managed
config does not set:

```yaml
destinations:
  - name: _config_datadog
    tags:
      team: checkout
```

User and managed top-level `tags:` add up. When both set the same key, the
managed `config.defaults.yaml` value wins. Trajectory also applies managed
top-level tags again after destination tags for shared keys.

Static tag maps have these limits:

| Limit | Value |
| --- | --- |
| Entries in each map | 10 |
| Key length | 64 characters |
| Value length | 50 characters |
| Full `key:value` tag | 200 characters |

Trajectory rejects static tags that break these limits. It does not cut them
short. It also rejects reserved identity keys, such as `host`, `session_id`,
and `trajectory.user`.

### Conditional and startup-resolved tags

Top-level `publish_tags:` adds tags to traces, metrics, or both. A fixed value
can depend on the session's project directory:

```yaml
publish_tags:
  - key: workload
    value: migration
    when:
      project_regex: '/migration-[^/]+$'
    signals: [traces, metrics]
```

Trusted user or managed config can instead run one program when
`trajectory serve` starts. The program's output becomes the tag value:

```yaml
publish_tags:
  - key: workspace_class
    command:
      argv: [/usr/local/bin/workspace-class]
      timeout_ms: 250
    allowed_values: [standard, regulated, experimental, unknown]
    fallback: unknown
```

These rules apply to tag commands:

- A repo `publish.trajectory.yaml` cannot run commands.
- Trajectory runs the program directly, without a shell. `argv` must name an
  absolute path.
- `allowed_values` lists at most five values.
- `timeout_ms` can be at most 1000.
- The output must be one short UTF-8 line that matches an allowed value.
  Trajectory discards stderr.

Trajectory resolves the tag in the background, so a slow command cannot delay
capture or agent startup. Trajectory uses the `fallback` value or leaves out
the tag in these cases:

- The command is still running or timed out.
- The command failed.
- The output is too long or not in `allowed_values`.

Trajectory saves the resolved trace and metric tags with each session. A config
reload, retry, serve restart, or historical replay reuses the saved values. It
does not run the command again.

As a final limit, each host accepts at most 10 different sets of resolved
global tags per UTC day. All serve processes share this limit.
`allowed_values` is the control for the whole fleet. Each endpoint rejects
values outside the list.

## Monorepo configs

```text
my-monorepo/
  publish.trajectory.yaml
  services/
    api/
      publish.trajectory.yaml
    ml-pipeline/
      publish.trajectory.yaml
```

Trajectory starts in your working directory and walks up through each parent
directory. It merges every `publish.trajectory.yaml` it finds. If the new file
is missing, Trajectory reads `.trajectory/publish.yaml` instead.

## Merge rules

| Rule | Behavior |
|---|---|
| A child names a trusted destination | The child can narrow the allowed fields |
| A child adds a trace destination | Trajectory rejects it |
| A child adds a metrics-only destination | Trajectory adds it for Datadog sites when `level: off` and marker metrics are on. It removes endpoint overrides and other credential controls. |
| A child sets `inherit: false` | Trajectory stops walking up and ignores parent repo configs |
| MDM sets `required_destinations` | They always apply, even with `inherit: false` |

A child can also narrow a trusted destination in these ways:

- Set `placeholder_llm_span: false`.
- Set `subagent_span_mode: links_only`.
- Lower `oversight_publish_mode`.

### Example: org defaults plus API team override

```yaml
# my-monorepo/publish.trajectory.yaml
version: 1
destinations:
  - name: org-llmobs
    level: minimal
    tags:
      org: engineering
```

```yaml
# my-monorepo/services/api/publish.trajectory.yaml
version: 1
destinations:
  - name: org-llmobs
    level: minimal
    tags:
      org: engineering
      team: api

  - name: api-metrics
    type: datadog_agentless
    site: datadoghq.com
    ml_app: api-team-agents
    api_key_ref: api-metrics-key
    level: off
    markers:
      enabled: true
      metrics: true
      logs: false
```

A session in `services/api/` sends traces to the trusted `org-llmobs`
destination at the lower level. It sends custom metrics to `api-metrics`. A
session in `services/frontend/` keeps the org defaults.

### Example: fully isolated team

```yaml
version: 1
inherit: false
destinations:
  - name: ml-dedicated
    type: datadog_agentless
    site: us5.datadoghq.com
    ml_app: ml-pipeline
    api_key_ref: ml-team-api-key
    level: off
    markers:
      enabled: true
      metrics: true
      logs: false
```

Use this form when one team sends its own custom metrics to a separate Datadog
organization. A new trace destination for the repo must first move to trusted
user or managed config. MDM-required destinations from `config.defaults.yaml`
still apply.

Trajectory merges a required destination and an implicit user destination
only when three things match: the destination type, the Datadog site, and the
credential reference. A required destination on the same site with another API
key reference or type adds a separate output. The user's own output also
continues.

## Team credential patterns

Use `api_key_ref` to name a credential that each developer stores locally:

```yaml
api_key_ref: dd-payments-api-key
```

Use `api_key_ref` in trusted config. In project config, use it only for
metrics-only destinations. Project metrics-only destinations can name a local
reference. They cannot set `api_key_command`, bearer or app key references, or
custom endpoint URLs.

For daily use, store the key in the keychain:

```bash
trajectory config set-secret dd-payments-api-key
```

For CI or a short-lived shell, set the matching environment variable instead:

```bash
export DD_PAYMENTS_API_KEY="dd_api_key_0123456789abcdef0123456789abcd"
```

### Default Datadog key names

`dd-api-key` and `dd_api_key` name the same default credential. `trajectory
setup` stores `dd_api_key`. Publish destinations often use
`api_key_ref: dd-api-key`. Trajectory looks up both names in the order that
`auth.credential_source` sets: environment, key provider, keychain, and
`api_key_command`.

Managed keychain mode works differently. It reads only the keychain names in
config, spelled as written. It does not read environment variables, other spellings of
the name, key provider commands, or destination `api_key_command`.

### Background publishing and `DD_API_KEY`

`DD_API_KEY` is visible only to processes that start with it in their
environment. Your shell can have `DD_API_KEY` while a Codex session's
metrics are still missing. In that case, run `trajectory doctor` to see the
credential status of the running serve process.

Setup-managed Codex hooks run `trajectory capture-hook --client codex
--ensure-serve`. This checks for a matching local capture server and starts
one if needed. Background publishing still needs a stored credential or a key
command:

1. Store the key:

   ```bash
   trajectory config set-secret dd_api_key
   ```

2. Check that Trajectory finds it:

   ```bash
   trajectory publish validate
   ```

### Pin the credential source

Your shell might set `DD_API_KEY` or `DATADOG_API_KEY` to a secret manager ID
instead of the real key. With the default `auto` source, Trajectory reports
the bad value and tries the next source.

To make one source fail when it has no valid key, pin it:

```bash
trajectory config set auth.credential_source keychain
```

To go back to trying each source in turn, set `auto`:

```bash
trajectory config set auth.credential_source auto
```

With a pinned source, Trajectory stops after that source. `trajectory doctor`,
`trajectory publish validate`, and serve logs report the policy. Managed
keychain mode still takes priority over this user setting.

### Secrets manager command

```yaml
api_key_command:
  command: "op read op://Engineering/dd-payments-api-key/credential"
  ttl: 3600
```

`api_key_command` works with these approved secret tools: macOS `security`,
`pass`, `op`, `vault`, `aws secretsmanager`, and `gcloud secrets`.
Trajectory keeps the output in memory for `ttl` seconds and then runs the
command again. To allow any other command, set
`TRAJECTORY_ALLOW_API_KEY_COMMAND=1`. Do this only in trusted environments.

### Bearer authentication

Some custom intakes or forwarders expect bearer authentication. For these,
turn on `bearer_destination_auth` and use `bearer_token_ref` instead of
`api_key_ref`:

```yaml
features:
  enabled: [bearer_destination_auth]

required_destinations:
  - name: llmobs-forwarder
    type: datadog_bearer
    site: datadoghq.com
    ml_app: coding-agents
    level: off
    bearer_level: standard
    intake_url: https://forwarder.example/api/v2/llmobs
    otlp_traces_url: https://forwarder.example/v1/traces
    otlp_metrics_url: https://forwarder.example/v1/metrics
    logs_url: https://forwarder.example/v1/logs
    bearer_token_ref: forwarder-token
```

Trajectory resolves only the named bearer reference. It sends
`Authorization: Bearer <token>` to the OTLP endpoints in the config.
Validation still requires `intake_url`, but agentless spans do not use it.
These rules apply:

- Trajectory never falls back to `DD_API_KEY` for bearer authentication.
- A destination can set `api_key_ref` or `bearer_token_ref`, but not both.
- Turning off the feature stops bearer export. Normal API key destinations keep
  working.
- Endpoints must use HTTPS. Plain HTTP is allowed only on loopback addresses,
  for development.
- Trajectory does not follow redirects on bearer requests.

Managed `datadog_bearer` entries keep `level: off`, so an older binary that
does not know the type sends nothing. The current binary uses `bearer_level`
instead.

A publish config file that sets `bearer_token_ref` must use `version: 2`, so
older binaries reject the file instead of sending without authentication.
Trajectory rejects managed bearer OTLP destinations, because older binaries
would treat them as collectors without authentication. A repository's
`publish.trajectory.yaml` cannot add a bearer destination: project
destinations are metrics-only, and they cannot set bearer references.

## Managed-only outputs

Only managed `required_destinations` can turn on the outputs in this section.
A project `publish.trajectory.yaml` cannot add, turn on, or change them.

### AI Usage events

A managed Datadog destination can send AI Usage events for skill
observability:

```yaml
required_destinations:
  - name: aiusage-events
    type: datadog_agentless
    site: datadoghq.com
    ml_app: coding-agents
    api_key_ref: dd-aiusage-api-key
    level: off
    ai_usage:
      enabled: true
      endpoint: https://eudm-intake.datadoghq.com/api/v2/aiusage
      track: aiusage
```

To send the events through the local Datadog Agent's `evp_proxy`, set
`type: datadog_agent`. The Agent then adds the API key and the site.
`ai_usage.subdomain` sets the intake subdomain for both transports. The
default is `eudm-intake`.

AI Usage is a separate publisher. Turning on `ai_usage` does not turn on LLM
Observability spans, marker metrics, marker logs, module spans, or security
event streams.

Trajectory sends one `trajectory.ai_usage.skill.v1` JSON event for each turn
that used a skill. The event includes:

- The skill name and invocation count.
- The repo, user, and coding agent identity.
- The detection source.
- The tool count, distinct tool count, duration, tool names, and tool types.

The event leaves out prompts, assistant responses, tool input and output,
shell commands, diffs, file contents, raw trace payloads, and local file
paths.

The source is the `skill-invoked-turn-count` marker point. Skill
observability metrics use the same point. AI Usage takes only its
`signal_confidence:high` rows. Medium and low confidence candidates stay
available through `trajectory.turn.skill_invocations`. They do not count as
AI Usage attribution.

Tool counts and duration come from skill windows in native traces when they
exist. Otherwise, they come from tool calls in the same turn in the local
cache. The `skill_attribution` field shows which source Trajectory used.

`track` defaults to `aiusage`. Without `endpoint`, Trajectory uses
`https://eudm-intake.<site>/api/v2/<track>`. Set `endpoint` when your intake
uses a different URL. Security
destinations with `incognito_exempt: true` do not receive these events.

Datadog can accept the request and still drop the event. This happens when
the event's `hostname` is not a known host in the target organization.

For the skill maintainer workflow and the skill metrics, run
`trajectory user-guide skill-observability`.

### Security event streams

A managed Datadog destination can turn on a security event stream:

```yaml
required_destinations:
  - name: security-audit
    type: datadog_agentless
    site: us5.datadoghq.com
    ml_app: coding-agents-security
    api_key_ref: dd-security-api-key
    level: full
    incognito_exempt: true
    event_stream:
      enabled: true
      privacy_profile: security
```

The stream sends one Datadog log for each Trajectory event, with
`ddsource: trajectory-event-stream`. Security detections use it next to LLM
Observability traces.

`privacy_profile` defaults to `security` when the stream is on. That profile
keeps the complete captured event. This includes prompts, responses, thinking,
tool inputs and outputs, diffs, file content, raw payloads, errors, summaries,
and identity fields.

Known tools also carry a `tool_operation` value that names the action the same
way for every agent. The event keeps the Trajectory `tool_name` and the
client's `native_tool_name`.

Other profile values:

- `privacy_profile: minimal` sends structure only.
- `privacy_profile: full` is an older name for complete events.
- The legacy `include_private_fields: true` maps to `full` when
  `privacy_profile` is not set.

Project configs cannot create event stream destinations, turn on the stream,
or raise its privacy level. Turning on `event_stream` does not turn on marker
logs, metrics, segmentation logs, or traces. Each of those keeps its own
setting. The stream also does not need the optional `agent-security` runtime
module.

The stream is delivered when traces are, but it is not part of the trace
payload:

- Each turn publish sends the events that are new since the last one.
- The final session publish looks at the full event list.
- The publish ledger removes duplicates for each destination and event.
- Event stream logs are not buffered into LLM Obs trace bundles. They do not
  use a separate logs outbox.
- Ambiguous submit failures retain ledger claims until an operator resolves
  them.

For the full stream format, run
`trajectory user-guide security-event-stream`.

### Operational logs

A managed destination can send operational events about the endpoint. These
events leave out private data:

```yaml
required_destinations:
  - name: trajectory-operations
    type: datadog_agentless
    site: datadoghq.com
    ml_app: trajectory
    service: trajectory
    api_key_ref: dd-api-key
    operational_logs:
      enabled: true
      min_level: warn
      components: [trajectory.serve]
      include_session_id: true
```

The stream uses the destination's credentials and OTLP Logs route. It is off
by default and only managed config can turn it on.

To stop the stream, turn off `operational_logs` in managed config. Trajectory
then stops queueing new events and stops delivery. It does not delete queued
events.

Operational events contain fixed codes, the endpoint and process identity, an
optional session ID, and fixed triage fields. They never contain raw error
text, paths, prompts, responses, tool payloads, commands, diffs, file content,
credentials, or free-form tags.

Trajectory queues these events in a local SQLite outbox. The outbox holds at
most 32 MiB and keeps events for seven days. Each event is delivered at least
once.

A destination config can block local module span records. When that happens,
the serve log prints the warning `CONFIG SUPPRESSED PUBLISH`. The warning names
the destination, output, modules, config setting, and recovery step. It also
says `local_records=retained`.

An operational log destination whose component filter includes
`trajectory.serve` also gets the warning event `publish.config_suppressed`.

#### Module span limits

Module span publishing reads a fixed snapshot of the files. It does not keep
the whole backlog in memory. These limits apply:

- At most two module span publishers run in each process.
- Repeated work for the same destination and session merges into one run.
- Each submit holds at most 128 records and 1 MiB of JSON content.
- One local JSONL record can be at most 4 MiB.

Trajectory rejects a larger record before it creates a publish ledger claim.
A line that is still being written waits for the next pass.

These limits cover Trajectory's own working data only. OTLP conversion, HTTP,
the Go runtime, and other libraries still use more memory, in proportion to
the input.

### Incognito-exempt destinations

```yaml
# managed config.defaults.yaml
required_destinations:
  - name: security-audit
    type: datadog_agentless
    site: datadoghq.com
    ml_app: security-agents
    api_key_ref: dd-security-api-key
    level: full
    incognito_exempt: true
```

Use `incognito_exempt` only in trusted user or managed config. It is for
destinations that must receive events even when a user turns on incognito.
`incognito_exempt` needs an `api_key_ref` and `level: full`.

Project files cannot change security destinations. Security destinations do
not receive metrics, marker logs, custom metrics, or active destination
metrics. Managed security destinations can turn on `event_stream` separately to
receive Datadog event logs. For details, run
`trajectory user-guide security-event-stream`.

Do not commit security destinations in project config. Trajectory ignores a
project entry like the following one. If `security-audit` already exists in
trusted config, project fields still cannot change it.

```yaml
version: 1
destinations:
  - name: security-audit
    type: datadog_agentless
    site: datadoghq.com
    ml_app: security-agents
    api_key_ref: dd-security-api-key
    level: full
    incognito_exempt: true
```

## Publish controls

These settings control different things. Set each one separately:

| Control | Where you set it | What it decides |
|---|---|---|
| Backend | `type` on `destinations:` or `required_destinations:` entries | Datadog, a Datadog Agent, or an OTLP collector |
| Datadog trace transport | Fixed | Agentless OTLP. `otlp_traces_url` changes the endpoint. Retired `traces_transport` values load with a warning and change nothing. |
| Datadog metrics transport | Fixed | Agentless OTLP for live, replayed, and backfilled metrics |
| Trace export | `level` on a destination, or `export.traces` for `_config_datadog` | Whether LLM Observability spans publish, and at what detail |
| Turn traces | `export.turn_traces` | Whether per-turn traces publish. The default is on. |
| Metrics export | `export.metrics`, marker settings, and destination rules | Whether cost, token, session, and marker metrics publish |
| Automated oversight | `export.oversight_publish_mode` or destination `oversight_publish_mode` | `summary`, `full`, or `off` for automatic reviewers |
| Security event stream | `event_stream` on managed `required_destinations` | Whether a security destination gets one log per event |

`type` does not switch traces on or off. A destination can have
`type: datadog_agentless` and `level: off`. That means a Datadog destination
without LLM Observability spans. Metrics can still publish if the metric
settings allow them.

### Automated oversight

Automated oversight is the record of model-backed automatic reviewers:

- `summary` is the default. It sends one operation span without content and a
  few usage metrics. It does not send the reviewer's transcript.
- `full` also sends the reviewer trace under `trajectory.trace_type:oversight`.
- `off` stops new oversight spans and metrics for that destination.

A project overlay can lower a trusted destination from `full` to `summary` or
`off`, or from `summary` to `off`. It cannot raise it. Without the key, the
trusted destination keeps its setting.

### Task metrics

Task segmentation builds a local task model. It can publish task metrics
when `segmentation.publish_metrics`, `export.metrics`, and the destination
settings allow them.

Task metrics carry `session_id`, `task_id`, and the start and end turn as
tags. They also carry a gauge with the task's turn count, counting both ends.
The free-form task label is never a metric tag.

Trajectory accepts the older `segmentation.publish_traces` and
`segmentation.task_insights.publish` keys but ignores them. Trajectory no
longer publishes task traces or classification evaluations.

## Validation messages

Publish validation and logs report authority decisions with these codes:

| Code | Meaning |
| --- | --- |
| `project_trace_destination_rejected` | A project tried to add a trace destination |
| `project_trace_level_clamped` | A project asked for a higher trace level than allowed |
| `project_metrics_destination_accepted` | Trajectory added a project metrics-only destination |
| `project_metrics_authority_clamped` | Trajectory removed endpoint or credential settings from a project metrics destination |
| `project_metrics_site_rejected` | A project metrics destination uses a site outside `allowed_sites` |
| `security_destination_override_ignored` | A project tried to change a security destination |
| `project_event_stream_rejected` | A project tried to add an event stream destination |
| `project_event_stream_ignored` | A project tried to turn on the event stream for a trusted destination |
| `project_ai_usage_rejected`, `project_ai_usage_ignored` | A project tried to add or change AI Usage events |
| `project_module_spans_rejected`, `project_module_spans_ignored` | A project tried to add or change module spans |
| `project_agent_security_rejected`, `project_agent_security_ignored` | A project tried to add or change Agent Security output |

When Trajectory rejects a trace destination, move that destination into
trusted user or managed config.

## Validate before rollout

Run these commands from the directory where users start sessions:

| Command | What it checks |
| --- | --- |
| `trajectory publish validate` | The schema, trust policy, credentials, and marker settings |
| `trajectory publish status` | The publish mode before sessions start |
| `trajectory publish preview` | The marker metrics that would publish for the latest matching session |
| `trajectory doctor publish` | Local capture and what Trajectory plans to publish |

`publish validate` and `publish status` check only local state. They do not
query Datadog.

In metrics-only mode, `export.traces=off` turns off LLM Observability spans.
`export.metrics=true` can still publish metrics.

### Diagnose one session

To find out why data is missing for one session, run:

```bash
trajectory doctor publish --session <id>
```

The command checks local capture and span mapping against the transcript. It
reports the trace and metric plan from config. It also shows a short metric
plan from the local SQLite cache:

- The expected metric counts.
- The outbox row counts.
- The expected rows that are missing.
- The `publish metrics audit --session <id> --readback` command to run next.

`doctor publish` does not query Datadog.

### Check metrics on first run

| Command | What it does |
| --- | --- |
| `trajectory doctor metrics session --latest` | Rebuilds the metrics of the latest session from local data |
| `trajectory doctor metrics session --session <id>` | Rebuilds the metrics of one session |
| `trajectory doctor metrics canary` | Sends a current test metric set and tries to read it back |

`metrics session` reads only local data. It prints metric names, session tag
filters, and outbox status. It sends nothing to Datadog. For sessions older
than 24 hours, use it as a local preview only. Datadog intake of historical
metrics, and reading them back, are not reliable enough for onboarding.

`metrics canary` sends a current test metric set through the normal publish
path. It tries to read the points back from Datadog when one destination and
an application key are ready. Otherwise, it only sends and prints a notice.

The canary always prints a `trajectory.canary_run` tag that finds the points
it sent. To make the command fail when Datadog does not return the points, add
`--readback`.

### Audit metric publishing

To compare local expectations with what Trajectory queued, run:

```bash
trajectory publish metrics audit --latest
```

The audit rebuilds the Datadog metric points that Trajectory should publish.
It uses the local SQLite cache and the publish config. It then matches those
points with metric outbox rows, if the session-end publish has run. The audit
sends nothing.

| Option | Effect |
| --- | --- |
| `--session <id>` | Audits one session |
| `--builtin-details` | Shows each built-in metric as `observed`, `not_observed`, or `out_of_scope` |
| `--readback` | Reads the stable `.completed_count` dashboard metrics back from Datadog |
| `--readback-all --strict-fidelity` | Checks that every sent metric group reads back with the same values |
| `--readback-app-key-ref <secret-name>` | Uses a custom keychain secret for the application key |
| `--destination <name>` | Audits one destination |

The audit leaves `content_length_estimate` token and cost rows out of the
expected metrics. It warns when the selected sessions contain them.

`--readback` needs a Datadog application key with the `timeseries_query`
scope. By default, the audit uses `DD_APP_KEY`, `DATADOG_APP_KEY`, or the
keychain secret `dd_app_key`.

1. Store the application key:

   ```bash
   trajectory config set-secret dd_app_key --stdin
   ```

2. Run the audit and read the metrics back from Datadog:

   ```bash
   trajectory publish metrics audit --session <id> --readback
   ```

Metric reads from Datadog and `publish sync` look for the application key in
the same order:

1. The reference you pass on the command line.
2. The destination's `app_key_ref`.
3. `dd_app_key` or `DD_APP_KEY`.

Managed keychain mode uses the keychain names as written, in the same order.

The audit prints the outbox counts for the selected session and destination:
recorded, pending, sent, failed, and dropped. Its `matched` and `missing`
counts compare the metric payload with its outbox source, including tags and
value. The audit records timestamps but does not match on them.

Use `--readback-all --strict-fidelity` for CI, canaries, or incident follow-up.
This mode requires every sent outbox group to read back from Datadog with the
same values. That includes volatile duration and last-seen metrics.

For delivery health, start with `trajectory publish queue --kind metrics`. For
full row details, the older `trajectory publish metrics outbox
<status|drain|prune>` command still works. It will enter deprecation after two
releases.

Older sessions can have outbox rows from before the current metric catalog
tags existed. The audit reports these rows as `historical_contract_drift`. It
still shows the missing and unexpected counts. This state is expected for old
rows. On a new session or canary, it means the current code does not send the
required tags.

### Client-native OTLP metrics

Client-native OTLP metrics that `server.otlp_proxy` forwards do not use the
outbox. To check them in Datadog, filter or group on these tags:

- `trajectory.cost_role:client_telemetry`.
- `trajectory.cost_source:claude_native_otlp`.
- `trajectory.cost_dedupe_group`.

### Attribution cost points

Trajectory attribution cost points are `trajectory.*.cost.usd.total` with
these tags:

- `trajectory.cost_contract:v2`.
- `trajectory.cost_role:attribution`.
- `trajectory.cost_source:turn_metrics`.

Each point also has a one-time key for its turn or session. The key stays the
same across process restarts and changes to the destination name, transport,
or timestamp. Trajectory skips a replay of the same point. A Claude subagent's
cost in a turn, tagged `agent_role:child`, has its own key for each child
model. It is a separate point from the parent's cost for that turn.

If a later calculation gives a different dollar value, Trajectory stops and
reports a fidelity conflict. It does not add a second point. This check covers
only Trajectory's own publish and retry path. It does not remove duplicates
against provider billing, native client telemetry, gateway metrics, or other
sources.

### Session audit

`trajectory session audit --session <id> --deep` adds an explanation block. It
covers local fidelity errors, traces turned off in config, and missing model or
cost attribution. It also explains a limit of the LLM Observability trace
intake. That intake accepts only recent backfills. A session older than 24
hours might stay missing from traces, even after a local capture fix.

## Operations runbook

Use these commands in order when you roll out or debug publishing:

| Situation | Command | What it checks |
|---|---|---|
| Before you turn on a repo or destination | `trajectory publish validate` | Schema, trust policy, destinations, and credentials |
| Before a session starts | `trajectory publish status` | Whether traces, metrics, both, or only local capture are on |
| Diagnosing one session | `trajectory doctor publish --session <session-id>` | Capture, span mapping, trace plan, metric plan, and outbox summary |
| Previewing first-run metrics | `trajectory doctor metrics session --latest` | Metrics rebuilt from existing local sessions |
| Checking first-run metrics in Datadog | `trajectory doctor metrics canary` | Sends a test metric and can read it back |
| Auditing expected metrics | `trajectory publish metrics audit --latest` | Expected points for the latest finished session. It sends nothing. |
| Auditing built-in metric coverage | `trajectory publish metrics audit --latest --builtin-details` | Built-in metrics against local session data |
| Reading metrics back from Datadog | `trajectory publish metrics audit --latest --readback` | The stable completed-count metrics in Datadog |
| Strict metric check | `trajectory publish metrics audit --session <session-id> --destination <name> --readback-all --strict-fidelity` | The outbox against its sources, and each sent group in Datadog |
| Before you rely on marker metrics | `trajectory publish preview` | Marker metrics for the latest matching session |
| Missing Datadog metrics | `trajectory publish metrics audit --session <session-id> --readback` | The session's completed-count metrics in Datadog |
| Local mapper or source mismatch | `trajectory session audit --session <session-id> --deep` | Local data against the client's own files |
| A metric row stuck in `ambiguous_delivery` | `trajectory publish queue resolve --kind metrics --id <row-id> --action abandon --yes` | Drops the row. `--action resend` queues it again. |
| A trace row in `retry_exhausted` with no held claim | `trajectory publish queue resolve --kind traces --session <session-id> --artifact-kind final_session --action resend --dry-run` | Previews a new retry budget. Run it again with `--yes` to apply. |
| A held final-session claim | The `trajectory publish queue resolve-claim ...` command that `trajectory publish queue claims` prints | Resolves the claim and the matching trace row |
| Support data | `trajectory flare` or `trajectory flare --privileged --session <session-id>` | Redacted diagnostics. Privileged mode adds raw data for one session. |

`publish validate`, `publish status`, `publish preview`, `doctor publish`,
and `session audit` check only local data. They do not query Datadog.

To confirm data in Datadog, use one of these:

- The Datadog Metrics API.
- The LLM Observability UI.
- Intake logs.
- `trajectory patterns markers canary --keep-home`.
- `trajectory publish metrics audit --readback`.

To fill gaps in your own metrics history, use `trajectory publish history
--yes`. To send one metric family, use `cost publish`, `session publish`, or
`patterns publish`. For which command sends what, run
`trajectory user-guide backfill`.

### Log-based metric definitions

Use `publish sync` only to set up Datadog log-based metric definitions:

```bash
trajectory publish sync
```

Most metric publishing does not need `publish sync`. If it prints
`No metrics to sync`, turn on marker metrics for the destination first, or
skip the command.

If it prints `Application key unavailable`, store a Datadog application key
with log configuration write permission:

```bash
trajectory config set-secret dd_app_key --stdin
```

`publish validate` checks the Datadog API key that publishing uses. It does
not check the application key for Datadog configuration APIs. To check that
key, run `publish sync` or `publish metrics audit --readback`.

### Delivery queue

To see metric and trace deliveries, run:

```bash
trajectory publish queue
```

To retry eligible rows, run:

```bash
trajectory publish queue retry
```

### Metric rows with ambiguous delivery

The metric outbox records the moment before each HTTP submit. Trajectory
retries automatically only after an HTTP 429 response.

These failures mark the row `ambiguous_delivery`:

- A timeout.
- A network error.
- An HTTP 5xx response.
- A process exit after the submit started.
- A failure to record a successful response.

The row stops there. Trajectory does not resend it, because the destination
might already have the added values. Inspect it with
`trajectory publish queue --kind metrics`.

Warning: a resend can count the same values twice in Datadog. Check what the
destination received before you choose.

- To drop the row without sending it again, run
  `trajectory publish queue resolve --kind metrics --id <row-id> --action abandon --yes`.
- To send it again and accept a possible duplicate, use `--action resend --yes`.
- To preview the decision without changing the row, add `--dry-run`.

### Clean up rows for a destination that cannot accept them

An older binary might have queued metrics for a destination that cannot accept
that producer. To list the zero-attempt rows without changing them, run:

```bash
trajectory publish queue repair \
  --destination security-audit \
  --source base_telemetry \
  --attempts 0 --older-than 30m --limit 1000
```

The command is a dry run by default. It needs a `--source`, so it can tell a
security destination's ordinary metrics from Agent Security metrics. The row's
saved authority hash must also match the current destination and transport.
This stops a reused destination name from cleaning up rows for an older
target.

Review the destination, the source and kind breakdown, the selected rows, and
the sample row IDs. Then apply the same filters with `--apply --yes`.

Applied rows become audited `destination_ineligible` drops. Trajectory does
not delete, send, or count them as transport attempts. Repeat until the
command prints `remaining=0`.

This command never repairs attempted or ambiguous rows. Those rows need a
delivery check against the destination. The preview opens the outbox
read-only. It does not create or migrate the outbox. If the outbox lacks the
columns that this check needs, the command stops with an error.

### Final-publish claims

A claimed row means that Trajectory blocks duplicate publish attempts until
someone resolves the row. To list the claims, run one of these commands:

- `trajectory publish queue claims` lists the held claims.
- `trajectory publish queue claims --session <session-id>` lists the claims
  for one session.
- `trajectory publish queue claims --all --limit 200` lists up to 200 claims
  of every kind.

`queue claims` prints recovery commands that include the current
`claim-id`.

Destination claims stop duplicates for each artifact. Event stream publishers
revisit saved session events during turn and final publishing. So each event
needs a stable completed identity. The publisher claims and sends event stream
records in batches. It does not claim a whole session before one request.

A metric outbox row with `attempts=0` and a ledger hold reason are different
records. Publish ledger claims have no attempt counter. `owner_lost_or_legacy`
and `ambiguous_export` do not mean that the submit failed. The export might
have reached the destination.

Release a claimed row only when the earlier export did not reach the
destination and a retry is safe:

```bash
trajectory publish queue resolve-claim --session <session-id> \
  --claim-id <claim-id> --action release --yes
```

Complete a claimed row only when the earlier export counts as handled.
Future duplicate publishes then stay blocked:

```bash
trajectory publish queue resolve-claim --session <session-id> \
  --claim-id <claim-id> --action complete --yes
```

Do not make up claim IDs or repair rows from memory. Copy the command from
`publish queue claims`. Then choose `release` or `complete` based on what the
destination shows.

For a final-session claim, the decision also handles the matching trace row:

- `release` rearms a matching trace row that stopped after its held-claim
  checks.
- `complete` reconciles the matching row.
- Completing the whole-session claim retires its remaining work.
- Completing one destination rearms a stopped row, so other destinations can
  finish. The completed destination stays blocked.

You make one ledger decision. You do not need a separate queue repair.

### Trace rows from older binaries

An older binary might have written rows as `status=failed
last_error_class=retry_exhausted`. These rows might have no final-session
ledger row left to repair. Recover them directly:

1. Preview the change:

   ```bash
   trajectory publish queue resolve --kind traces --session <session-id> \
     --artifact-kind final_session --action resend --dry-run
   ```

2. Apply it:

   ```bash
   trajectory publish queue resolve --kind traces --session <session-id> \
     --artifact-kind final_session --action resend --yes
   ```

These options choose the rows:

- `--id <trace-row-id>` selects one row.
- `--all` selects every row. Use it only after you preview the full set.
- `--artifact-kind final_session|turn_trace` narrows a session or `--all`
  selection. Without it, the command acts on both kinds.

`resend` grants a new, limited retry budget. It might send an export twice if
the destination already accepted it. `abandon` retires the row and might leave
a gap in delivery.

### Monitor held claims

You do not need to poll `trajectory doctor` on each host to find held claims.
When the ledger exists, `trajectory serve` publishes the held count every
hour, including a healthy `0`:

```text
trajectory.serve.local_state.publish_ledger_held_claims{artifact_scope:final_session}
```

The companion metric
`trajectory.serve.local_state.publish_ledger_held_claims_detail` separates
whole-session claims from destination claims. It also reports age and cause
in buckets:

- `completion_unrecorded` means the export succeeded but Trajectory could not
  save the local completion.
- `ambiguous_export` means the request might have reached the destination.

A running serve process sends zero values for detail groups that disappear
after a repair. The all and final-session gauge is the health signal across
processes.

A held final-session claim also sends
`trajectory.instrumentation.watchdog.gap_detected{reason:publish_ledger_claim_held}`.
Alert on either signal. Then run the `publish queue claims` and
`publish queue resolve-claim` steps above on the reported host. For monitor
queries, run `trajectory user-guide metrics`.

### Ledger retention

Serve runs ledger retention maintenance every day. Each pass
force-completes old destination claims that are not final-session claims:

- It completes up to 1,000,000 claims older than seven days.
- It works in transactions of 100,000 claims.
- It keeps duplicate blocking. It never releases a claim for replay.
- It accepts that some old deliveries might have a gap.

Final-session claims stay open for manual repair after you check the
destination.

The same daily maintenance deletes a completed row only when two things are
true. The source session's replay window has ended. A limited scan also finds
no saved session JSONL for it. A saved path is reused on resume only while its JSONL
still exists. So an expired source does not come back as an old replay.

Each run updates at most 1,000 legacy timestamps and scans at most 1,000
eligible identities. The next run resumes from the saved progress. Row and
byte limits report pressure, but they do not erase completed identities that
can still replay.

The local retention snapshot and `/health` report
`publish_ledger_forced_completed_claims` with `retention_error`,
`row_limit_ok`, and `byte_limit_ok`. The serve log records the same count. You
can still watch ledger pressure through the held-claim detail, completed-row,
and allocated-byte gauges.

### Historical metrics

To repair historical metrics, start with the local audit instead of live
publishing:

```bash
trajectory publish metrics audit --since YYYY-MM-DD --destination <name>
```

For the historical audit and the commands that send history, run
`trajectory user-guide backfill`.

## Local-only capture

To keep capture on disk and turn off publishing, turn off traces:

```bash
trajectory config set export.traces off
```

Then turn off metrics:

```bash
trajectory config set export.metrics false
```
