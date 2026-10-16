# Security Event Stream

The security event stream sends one Datadog log for each Trajectory event to
an approved security destination. Security teams can write detection rules
against these logs. They do not need to parse LLM Observability traces.

Only managed configuration can turn on the stream. A repository's
`publish.trajectory.yaml` cannot turn it on, and the user `export:` config has
no setting for it.

## Turn on the stream

1. Open the managed configuration that your organization deploys.
2. Find the security destination in `required_destinations`.
3. Set `incognito_exempt: true` on that destination.
4. Add an `event_stream` block with `enabled: true`.

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

The stream is off by default. `event_stream.enabled` defaults to `false`.

The destination must meet these conditions:

- It is a managed destination in `required_destinations`.
- Its type is a Datadog agentless type, such as `datadog_agentless`.
- It sets `incognito_exempt: true`. Configuration validation rejects an
  enabled stream without it.

Project publish configs cannot add event-stream destinations. They also cannot
turn on the stream for a managed destination or change its privacy profile.

## What the stream contains

Security event streams are always full fidelity. They do not redact, filter, or
omit captured event fields. A log keeps every field that Trajectory captured
for the event. This includes the following fields when the source provides them:

- prompts and assistant responses
- thinking text
- tool inputs and tool outputs, before and after each tool call
- raw payloads, error text, and summaries
- diffs and file content
- identity fields, such as user email

Trajectory checks the privacy profile at three points. It checks when it loads
the configuration, when it selects destinations, and when it builds each log.
Trajectory never sends a partial security record.

### Privacy profiles

| Profile | Behavior |
|---|---|
| `security` | Default. Sends complete captured-event fidelity to the approved security destination. |
| `full` | Older spelling. Behaves the same as `security`. |

Configuration validation rejects every other profile. For example,
`privacy_profile: minimal` is not valid.

`event_stream.include_private_fields: true` is deprecated. If you omit
`privacy_profile`, it means `privacy_profile: full`.

### Tool and event names

Coding agents use different names for the same tool. Trajectory converts
registered tool names and event aliases to one shared set of names. For
example, Pi's `read` plus `input.path` becomes `Read` plus `input.file_path`.
Codex's `exec_command` plus `input.cmd` becomes `Bash` plus `input.command`.

When Trajectory changes a name, it keeps the original. The original event type
goes in `trajectory.original_event_type`. The original tool name goes in
`native_tool_name`.

## Log fields

### Top-level fields

Every log sets `ddsource: trajectory-event-stream`. Filter on it to find
event-stream logs.

| Field | Value |
|---|---|
| `ddsource` | `trajectory-event-stream` |
| `service` | The destination service. Trajectory uses its default service if the destination sets none. |
| `ddtags` | Destination tags and event tags (see below). |
| `message` | A short event summary, such as `tool_use: Bash (pre)`. |
| `host` | The local operating-system hostname. |

`ddtags` contains the destination tags and the common metric tags. It also has
these event tags when the event has them: `session_id`, `event_type`,
`client_source`, `turn_id`, `tool_name`, `tool_type`, `tool_operation`,
`phase`, and `sequence_number`.

### Log body

The log body contains every captured event field. It also contains these
stream fields:

| Field | Value |
|---|---|
| `event_stream_schema_version` | `3` |
| `metadata_evidence_schema_version` | `1` |
| `event_stream_privacy` | The resolved profile, `security` or `full`. |
| `private_fields_included` | Always `true`. |
| `destination_name` | The destination `name`. |
| `destination_type` | The normalized destination type, such as `datadog_agentless`. |
| `ml_app` | The destination `ml_app`, if set. |
| `trajectory_version` | The Trajectory binary version. |
| `trajectory_metadata` | Common metadata (see below). |
| `trajectory_metadata_evidence` | Where each metadata value came from (see below). |

Schema version 3 added the host field and the common metadata. It kept the
`tool_operation` field and the `security` profile from version 2.

### Host

Every log has a top-level `host` field with the local operating-system
hostname. Trajectory keeps the hostname's original spelling and case, such as
`LAPTOP-EXAMPLE01`. Use this field to pivot from Log Explorer to endpoint logs
and infrastructure data.

Trajectory does not trust an agent event to report the endpoint. If a captured
event has its own `host` field, Trajectory replaces it with the local hostname.

Datadog can change the case of the `host` tag in `ddtags`. The top-level field
keeps the original case. The OTLP request also sets the resource attribute
`host.name` to the same value. Datadog uses it to link the log to the host in
its inventory.

### User identity

Trajectory resolves the local user identity and copies it into top-level log
fields:

- `trajectory.user` is on every log. If Trajectory cannot resolve it, the
  value is `unknown`.
- `trajectory.user_email`, `git.email`, and `github.username` appear when
  Trajectory can resolve them.

These values replace fields with the same name in a captured agent event. The
same values also appear in `ddtags` and `trajectory_metadata`.

### Common metadata

`trajectory_metadata` holds the same metadata that Trajectory adds to its
metrics. It includes the session, client, user, binary version, host, OS,
model, project, repository, and destination tags. Repository fields keep
`trajectory.repo_source`. Missing values use the same `unknown` fallbacks as
metrics.

### Metadata evidence

`trajectory_metadata_evidence` has one entry for each key in
`trajectory_metadata`. Each entry has three fields:

- `source` names where the value came from, such as `os.hostname`.
- `confidence` says how directly Trajectory got the value from that source.
- `attestation` names how Trajectory got the value.

Attestation values include a runtime observation, a claim in a captured event,
a local derivation, build metadata, and a configuration value. They do not mean
that anything was cryptographically verified. Confidence also does not say
whether a configured or captured value is true.

`metadata_evidence_schema_version` gives the version of this format.

### Tool identity fields

Each registered tool has three names in the log:

- `tool_operation`, such as `shell.execute`, is the same for every agent. Use
  it for security detections and queries across agents.
- `tool_name`, such as `Bash`, is the shared display name.
- `native_tool_name`, such as `exec_command`, is the agent's own name. It
  appears only when Trajectory changed the name.

## Security detection matching reference

Write detection rules against the `@tool_operation` attribute. It has the same
value when Claude Code, Codex, Cursor, Pi, or another registered client runs
the same kind of tool.

- Use `@tool_name` only to match older records.
- Use `@native_tool_name` only to triage one agent.

| Action | Primary `@tool_operation` match | Fallback `@tool_name` match |
|---|---|---|
| Run a shell command | `shell.execute` | `Bash` |
| Read a file | `file.read` | `Read` |
| Write or replace a file | `file.write` | `Write` |
| Edit part of a file | `file.edit` | `Edit` |
| Search source text | `code.search` | `Grep` |
| Match or list file paths | `filesystem.glob` | `Glob` |
| Delegate to another agent | `agent.delegate` | `Agent` |
| Search the web | `web.search` | `WebSearch` |
| Fetch a web resource | `web.fetch` | `WebFetch` |
| Update a plan or task list | `plan.update` | `TodoWrite` |
| Apply a patch | `patch.apply` | `ApplyPatch` |
| Load an agent skill | `skill.load` | `Skill` |
| Delete a file | `file.delete` | `Delete` |

For example, this query matches every attempt to run a shell command, from any
client:

```text
@event_type:tool_use @phase:pre @tool_operation:shell.execute
```

The `tool_name` attribute keeps the case shown in the table. Its copy in
`ddtags` is lowercase, because Datadog normalizes tags.

Unknown tools and extension tools have no `tool_operation`. Match them by
`tool_name` and the extension details in the log. Do not add them to this
table.

### Example logs

Example flattened log entries follow, one JSON object per line, before
transport encoding. The second entry leaves out `trajectory_metadata` and
`trajectory_metadata_evidence`, to keep it short. The first entry shows the
request. The second entry shows the result.

```jsonl
{"ddsource":"trajectory-event-stream","service":"coding-agents","ddtags":"host:laptop-example01,trajectory.user:jdoe,ml_app:coding-agents-security,env:prod,session_id:sess-01,event_type:tool_use,client_source:codex,tool_name:bash,tool_type:shell,tool_operation:shell.execute,phase:pre,turn_id:3,sequence_number:12","message":"tool_use: Bash (pre)","event_stream_schema_version":3,"metadata_evidence_schema_version":1,"event_stream_privacy":"security","private_fields_included":true,"destination_name":"security-audit","destination_type":"datadog_agentless","ml_app":"coding-agents-security","host":"LAPTOP-EXAMPLE01","trajectory.user":"jdoe","trajectory_metadata":{"host":"LAPTOP-EXAMPLE01","session_id":"sess-01","trajectory.client_source":"codex","trajectory.user":"jdoe"},"trajectory_metadata_evidence":{"host":{"source":"os.hostname","confidence":"high","attestation":"runtime_observation"},"session_id":{"source":"publish_session","confidence":"high","attestation":"runtime_observation"},"trajectory.client_source":{"source":"canonical_event","confidence":"medium","attestation":"captured_event_claim"},"trajectory.user":{"source":"local_identity_resolution","confidence":"medium","attestation":"local_derivation"}},"sequence_number":12,"event_type":"tool_use","session_id":"sess-01","turn_id":3,"client_source":"codex","tool_name":"Bash","tool_type":"shell","tool_operation":"shell.execute","native_tool_name":"exec_command","phase":"pre","prompt":"example user request","input":{"command":"git status --short"}}
{"ddsource":"trajectory-event-stream","service":"coding-agents","ddtags":"host:laptop-example01,trajectory.user:jdoe,ml_app:coding-agents-security,env:prod,session_id:sess-01,event_type:tool_use,client_source:codex,tool_name:bash,tool_type:shell,tool_operation:shell.execute,phase:post,turn_id:3,sequence_number:13","message":"tool_use: Bash (post)","event_stream_schema_version":3,"metadata_evidence_schema_version":1,"event_stream_privacy":"security","private_fields_included":true,"destination_name":"security-audit","destination_type":"datadog_agentless","ml_app":"coding-agents-security","host":"LAPTOP-EXAMPLE01","trajectory.user":"jdoe","sequence_number":13,"event_type":"tool_use","session_id":"sess-01","turn_id":3,"client_source":"codex","tool_name":"Bash","tool_type":"shell","tool_operation":"shell.execute","native_tool_name":"exec_command","phase":"post","tool_response":{"stdout":"## main...origin/main\n"},"success":true,"duration_ms":284}
```

## How Trajectory delivers the logs

Trajectory sends event-stream logs at the same points where it publishes
traces:

- After each turn, it sends the events that are new in that turn.
- At session end, it checks the full event list. This sends late events such as
  `session_end`.

Trajectory does not bundle them into the LLM Obs trace payload. It sends the
logs to the destination in a separate OTLP logs request, during the same publish
call.

The publish ledger stops Trajectory from sending the same event twice to one
destination. It identifies each event by its `sequence_number`. If an event has
no `sequence_number`, the ledger uses `event_id` or a hash of the log.

The ledger does not store logs for retry. If Datadog rejects a batch,
Trajectory releases the claim, and a later publish can send it again. If the
result of a send is unknown, Trajectory keeps the claim and blocks new
attempts.

To fix a held claim, do these steps:

1. Run `trajectory publish queue claims` to list held claims.
2. Run `trajectory publish queue resolve-claim` with the options that the list
   shows for each claim.

## Other outputs

Turning on `event_stream` does not turn on marker logs, metrics, segmentation
logs, or traces. Each of those outputs has its own setting. A destination with
`incognito_exempt: true` never receives metrics.

The security event stream does not enable or depend on the optional
`agent-security` runtime module. That module can create findings and policy
decisions. You do not need it to get full-fidelity security logs.

## Related guides

- Destination setup: `trajectory user-guide publish` and
  `trajectory user-guide deploy`.
- Privacy controls: `trajectory user-guide privacy`.
