# Privacy Controls
Trajectory captures local JSONL first, then publishes according to config and destination policy. Use the controls below when a session may involve sensitive content.

## Incognito
Use `/incognito` when ordinary observability destinations should not receive the current session. Local JSONL capture continues, publish to non-exempt remote destinations is suppressed, and the toggle resets when the session ends.

Clients with the Trajectory skill installed accept:

```text
/incognito
```

or a natural-language request such as:

```text
Go incognito for this session.
```

Some managed destinations can be configured with `incognito_exempt: true`. Those destinations may still receive spans during incognito for approved security or audit use cases. Security destinations are managed-config only and cannot be changed by project `publish.trajectory.yaml`.

## Sensitive Tags
Use `<sensitive>...</sensitive>` blocks as an instruction to the agent and to human readers:

```text
<sensitive>
Customer details, HR/legal content, credentials, or private investigation notes.
</sensitive>
```

These tags are a convention, not a redaction boundary. Trajectory may capture the tags and enclosed text locally. If normal publish should be suppressed, enable `/incognito` before sharing the content.

Do not put sensitive values into metric tags, marker dimensions, PR descriptions, commit messages, or public comments.

## Sensitivity Scanning
When sensitivity scanning is enabled, Trajectory classifies sessions as `public`, `internal`, `confidential`, or `restricted`.

```yaml
export:
  sensitivity:
    enabled: true
    interval_minutes: 5
```

For non-exempt destinations, spans are held while classification is unresolved. Confidential or restricted sessions are dropped by default unless the destination policy downgrades them to minimal spans:

```yaml
privacy:
  sensitive_policy: minimal
```

Sensitivity gating applies to span publish. Metrics, marker evaluations, and some event logs can still flow depending on destination policy. Keep metric tags and marker details low-cardinality and non-sensitive.

## Disable All Capture
For a one-off process where local capture should also stop, use:

```bash
TRAJECTORY_DISABLED=1 claude "review this without recording"
```

This is stronger than incognito. It disables capture for the launched process or server instead of only suppressing publish.

## Check Current Behavior
```bash
trajectory config show
trajectory publish status
trajectory diagnose publish --session <session-id>
trajectory doctor
```

`config show` reveals managed defaults, user config, and environment overrides. `publish status` explains the active publish mode. `diagnose publish` explains local capture and publish expectations for one session without claiming Datadog readback.
