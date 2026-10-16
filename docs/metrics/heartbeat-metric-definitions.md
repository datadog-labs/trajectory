## Heartbeat Metric Definitions

Trajectory includes three log-based metric definitions for marker evaluation.
After the marker evaluator runs, Trajectory writes one `_evaluated` marker
event for the session. Each definition matches that event with the log query
`@event_type:marker @marker_type:_evaluated`.

| Metric | Type | Value |
|---|---|---|
| `trajectory.session.evaluated` | gauge | Always `1` when a session reaches marker evaluation |
| `trajectory.markers.evaluated_count` | gauge | Number of markers evaluated for the session |
| `trajectory.markers.org_pinned_count` | gauge | Number of evaluated markers from the enforced organization marker layer |

Use these metrics for absence monitors. For example, alert when no
`trajectory.session.evaluated` value arrives from a group of users for a set
time. These definitions are separate from the base metrics that the publish
engine sends.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
