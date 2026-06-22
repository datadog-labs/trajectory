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
| `security` | Default detection-focused fidelity: structural metadata plus pre-tool input/argument fields; prompts and post-tool outputs are omitted. |
| `minimal` | Structural metadata only. Pre-tool input, command, and argument fields are also omitted. |
| `full` | Original event fields are included for explicit managed investigations. |

The stream itself remains off unless `event_stream.enabled: true` is set.

The default `security` profile keeps fields such as `event_type`, `session_id`,
`sequence_number`, `turn_id`, `tool_name`, `phase`, `success`, `duration_ms`,
`client_source`, token and cost summaries, provenance, MCP identity, and
pre-tool input fields such as `input`, `tool_input`, `args`, `arguments`,
`cmd`, and `command`. Those input fields are omitted outside pre-tool events.

It omits prompt, assistant response, thinking text, post-tool output/result
payloads, raw payloads, error text, summaries, and user email fields. This is
the detection-focused middle ground: security detections can see what a tool
was asked to do without receiving the user's prompt or the tool's returned
content.

`event_stream.include_private_fields: true` is a deprecated compatibility alias
for `privacy_profile: full` when `privacy_profile` is omitted.

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
