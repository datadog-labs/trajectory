# Security Event Stream

The security event stream sends one Datadog log per captured event
(`ddsource: trajectory-event-stream`), so detection rules need not parse
traces.

## What the stream contains

Nothing in the stream is redacted. A log keeps every captured field:
prompts, responses, thinking, tool input and output, diffs, file content, raw
payloads, errors, and identity. Trajectory checks the privacy profile when it
loads config, picks destinations, and builds each log. It never sends a
partial security record.

`event_stream.privacy_profile` takes `security`, the default, or `full`, an
older spelling that behaves the same. Validation rejects any other value. The
deprecated `include_private_fields: true` means `full`.

## Turn on the stream

Only managed config can turn on the stream. Repository publish files cannot
add, turn on, or change it, and the user `export:` block has no setting for
it. Set `event_stream.enabled: true`, which defaults to `false`, on a managed
`required_destinations` entry. The entry needs `type: datadog_agentless` and
`incognito_exempt: true`. Validation rejects an entry without
`incognito_exempt: true`. Other destination types can pass validation but send
no stream logs.

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

It turns on no marker logs, metrics, or traces. It neither needs nor turns on
the `agent-security` module.

## Log fields

- `service` is the destination's service, or the default.
- `message` is a short summary, such as `tool_use: Bash (pre)`.
- `host` is the hostname in its original case. It replaces any event `host`,
  and OTLP `host.name` matches it. The `ddtags` copy may be lowercase. When
  `identity.host_override` or `TRAJECTORY_HOST_OVERRIDE` is set, `host` holds
  that value. Its metadata evidence then has the source `host_override` and the
  attestation `configuration_assertion`.
- `ddtags` holds the destination and common metric tags. It adds
  `session_id`, `event_type`, `client_source`, `turn_id`, `tool_name`,
  `tool_type`, `tool_operation`, `phase`, and `sequence_number`.
- `trajectory.user` is on every log, `unknown` if unresolved.
  `trajectory.user_email`, `git.email`, and `github.username` replace event
  fields when resolved.

The body holds every captured field, plus `event_stream_schema_version` 3,
`metadata_evidence_schema_version` 1, the profile, the destination name and
type, `ml_app`, and `trajectory_version`. Schema 3 added `host` and the common
metadata. `tool_operation` and the `security` profile exist since version 2.

`trajectory_metadata` holds Trajectory's common metadata: session, client,
user, version, host, OS, model, project, repository with
`trajectory.repo_source`, and destination tags. Missing values are `unknown`.
Logs also keep `project_dir`, which metrics do not carry.

`trajectory_metadata_evidence` gives each key a `source`, `confidence`, and
`attestation`. An attestation is not cryptographic proof. A high confidence
does not mean the value is correct.

Tool and event aliases map to shared names, such as Codex's `exec_command` to
`Bash`. The originals stay in `native_tool_name` and
`trajectory.original_event_type`.

An example log, without its metadata:

```jsonl
{"ddsource":"trajectory-event-stream","service":"coding-agents","ddtags":"host:laptop-example01,trajectory.user:jdoe,env:prod,session_id:sess-01,event_type:tool_use,client_source:codex,tool_name:bash,tool_type:shell,tool_operation:shell.execute,phase:pre,turn_id:3,sequence_number:12","message":"tool_use: Bash (pre)","event_stream_schema_version":3,"metadata_evidence_schema_version":1,"event_stream_privacy":"security","private_fields_included":true,"destination_name":"security-audit","destination_type":"datadog_agentless","host":"LAPTOP-EXAMPLE01","trajectory.user":"jdoe","sequence_number":12,"event_type":"tool_use","session_id":"sess-01","turn_id":3,"client_source":"codex","tool_name":"Bash","tool_type":"shell","tool_operation":"shell.execute","native_tool_name":"exec_command","phase":"pre","input":{"command":"git status --short"}}
```

## Detection matching

Write rules on `@tool_operation`, which is the same in every client. Use
`@tool_name` only for older records, and `@native_tool_name` to triage one
client. Unknown tools have no operation.

| Action | `@tool_operation` | Older `@tool_name` |
|---|---|---|
| Run a shell command | `shell.execute` | `Bash` |
| Read a file | `file.read` | `Read` |
| Write or replace a file | `file.write` | `Write` |
| Edit part of a file | `file.edit` | `Edit` |
| Delete a file | `file.delete` | `Delete` |
| Search source text | `code.search` | `Grep` |
| Match or list file paths | `filesystem.glob` | `Glob` |
| Apply a patch | `patch.apply` | `ApplyPatch` |
| Delegate to another agent | `agent.delegate` | `Agent` |
| Search the web | `web.search` | `WebSearch` |
| Fetch a web resource | `web.fetch` | `WebFetch` |
| Update a plan or task list | `plan.update` | `TodoWrite` |
| Load an agent skill | `skill.load` | `Skill` |

This query matches every shell command attempt from any client:

```text
@event_type:tool_use @phase:pre @tool_operation:shell.execute
```

`tool_name` keeps its displayed case in the log. Its `ddtags` copy is
lowercase.

## Delivery

Trajectory sends stream logs in their own OTLP logs request after each turn,
and again at session end to catch late events. A ledger sends each event once
per destination, keyed by `sequence_number`, else `event_id` or a log hash.
A rejected batch goes again at a later publish. If a send's result is unknown,
Trajectory holds the claim. Run `trajectory publish queue claims`, then the
`resolve-claim` command it shows.

## Privacy

The default `security` profile sends everything in
[What the stream contains](#what-the-stream-contains). Treat the destination
as a store of full session content.
