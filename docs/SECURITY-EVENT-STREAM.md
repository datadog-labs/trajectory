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
    type: datadog
    site: us5.datadoghq.com
    ml_app: coding-agents-security
    api_key_ref: dd-security-api-key
    level: full
    incognito_exempt: true
    privacy:
      sensitivity_exempt: true
    event_stream:
      enabled: true
      include_private_fields: false
```

`event_stream.enabled` defaults to `false`. When enabled, the destination must
be a managed Datadog destination with `incognito_exempt: true`. Project publish
configs cannot add event-stream destinations, enable the stream, or raise its
privacy level.

## Privacy Shape

`event_stream.include_private_fields` defaults to `false` and should stay false
for the managed default. In that mode, logs keep structural fields such as
`event_type`, `session_id`, `sequence_number`, `turn_id`, `tool_name`, `phase`,
`success`, `duration_ms`, `client_source`, token and cost summaries,
provenance, and MCP identity.

Default-minimal logs omit prompt, assistant response, thinking text, tool input,
tool output, command arguments, command output, diffs, file contents, raw
payloads, error text, summaries, and user email fields. This roughly mirrors
minimal trace privacy: security detections get the shape of the activity
without raw conversation or tool payload content.

Set `include_private_fields: true` only for an explicit managed investigation
scope. In full mode, Trajectory includes the original event fields in the log
body.

## Log Shape

Each event stream log uses:

- `ddsource: trajectory-event-stream`
- `service`: the destination service
- `ddtags`: destination tags plus event tags such as `ml_app`, `session_id`,
  `event_type`, `client_source`, `turn_id`, `tool_name`, `phase`, and
  `sequence_number` when present
- `message`: a short event summary such as `tool_use: Bash (pre)`

The log body includes event-stream metadata such as
`event_stream_schema_version`, `event_stream_privacy`,
`private_fields_included`, `destination_name`, `destination_type`, `ml_app`,
`trajectory_version`, and the canonical event fields allowed by the privacy
profile.

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

For destination configuration, see `trajectory user-guide publish` and
`trajectory user-guide deploy`. For privacy controls, see
`trajectory user-guide privacy`.
