# Security Event Stream

Security event streams are managed Datadog log projections for security
destinations. They publish one structured log per canonical Trajectory event
so detections can query the event stream directly without parsing LLM
Observability traces.

This is a managed-destination feature. Individual repositories cannot enable
it from `publish.trajectory.yaml`, and ordinary user `export:` config does not
expose it.

## Managed Configuration

Enable the stream only on managed `required_destinations`:

```yaml
required_destinations:
  - name: security-audit
    type: datadog_agentless
    site: us5.datadoghq.com
    ml_app: coding-agents-security
    api_key_ref: dd-security-api-key
    level: full
    incognito_exempt: true
    privacy:
      sensitivity_exempt: true
    event_stream:
      enabled: true
      privacy_profile: security
```

`event_stream.enabled` defaults to `false`. When enabled, the destination must
be a managed Datadog destination with `incognito_exempt: true`. Project publish
configs cannot add event-stream destinations, enable the stream, or raise its
privacy level.

## Privacy Shape

`event_stream.privacy_profile` controls field fidelity once the stream is
enabled:

| Profile | Behavior |
|---|---|
| `security` | Default. Complete captured-event fidelity for the approved security destination, including prompts, responses, thinking, tool inputs and outputs, diffs, file content, errors, raw payloads, summaries, and identity fields when captured. |
| `minimal` | Structural metadata only. Content-bearing prompt, response, tool, diff, file, raw payload, error, summary, and user-email fields are omitted. |
| `full` | Compatibility spelling for the same complete captured-event fidelity as `security`. |

The stream itself remains off unless `event_stream.enabled: true` is set.

Accepted event aliases and registered coding-agent tools use the shared
canonical contract before privacy filtering. The original spellings remain
available in `trajectory.original_event_type` and `native_tool_name` when
identity changes.

The default `security` profile preserves every captured event field. This
includes prompts, assistant responses, thinking text, pre- and post-tool
payloads, raw payloads, error text, summaries, diffs, file content, and user
email fields when the source provides them.

`event_stream.include_private_fields: true` is a deprecated compatibility alias
for `privacy_profile: full` when `privacy_profile` is omitted.

## Log Shape

Each event stream log uses:

- `ddsource: trajectory-event-stream`
- `service`: the destination service
- `ddtags`: destination tags plus event tags such as `ml_app`, `session_id`,
  `event_type`, `client_source`, `turn_id`, `tool_name`, `tool_type`,
  `tool_operation`, `phase`, and `sequence_number` when present
- `message`: a short event summary such as `tool_use: Bash (pre)`

The log body includes event-stream metadata such as
`event_stream_schema_version`, `event_stream_privacy`,
`private_fields_included`, `destination_name`, `destination_type`, `ml_app`,
`trajectory_version`, and the canonical event fields allowed by the privacy
profile. Event-stream schema version 2 adds the vendor-neutral
`tool_operation` detection contract and makes `security` full-fidelity.

Registered common tools retain three complementary identities:

- `tool_operation`, such as `shell.execute`, is the vendor-neutral field for
  security detections and cross-agent queries.
- `tool_name`, such as `Bash`, is the canonical compatibility and display name.
- `native_tool_name`, such as `exec_command`, preserves source provenance when
  canonicalization changed the name.

Detection rules should prefer `tool_operation`. For example,
`shell.execute`, `file.read`, `file.write`, `file.edit`, `code.search`, and
`web.fetch` remain stable across clients that use different native tool names.

## Delivery Semantics

Event-stream logs follow the same publish lifecycle as traces: incremental turn
publish sends newly observed turn events, and final session publish considers
the full session event list so late terminal events such as `session_end` can
be sent.

They are not bundled into the LLM Observability trace payload. Logs are
submitted as a separate Logs API request for the destination during the same
publish call. The publish ledger deduplicates per destination and event
identity, preferring `sequence_number` when available.

The ledger is a fail-closed dedupe and reconciliation guard, not a durable logs
retry outbox. If submit status is ambiguous, Trajectory keeps the claimed row
and suppresses duplicate attempts until an operator reconciles it with
`trajectory publish ledger status` and `trajectory publish ledger repair`.

## Relationship to Other Outputs

Enabling `event_stream` does not enable marker logs, structured records,
metrics, segmentation logs, or traces. Those outputs keep their existing gates.
Security destinations with `incognito_exempt: true` still do not receive
structured records or metrics.

The security event stream does not enable or depend on the optional
`agent-security` runtime module. That module may produce derived findings or
policy decisions, but it is not required for full-fidelity security logs.

For destination configuration, see `trajectory user-guide publish` and
`trajectory user-guide deploy`. For privacy controls, see
`trajectory user-guide privacy`.
