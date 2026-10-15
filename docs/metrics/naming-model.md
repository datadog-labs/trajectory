## Naming Model

Trajectory metric names have this form:

```text
trajectory.<scope>.<concept>[.<measurement>]
```

The common scopes are `turn`, `session`, `task`, `oversight`, `commit`, `pr`,
`publish`, `serve`, `ops`, and `instrumentation`. The
[operational metrics reference](operational-metrics.md) groups the operational
families by question, whatever their names are. Token-count metrics named
`gen_ai.usage.*` follow the OpenTelemetry GenAI naming convention.

The last part of a name tells you how the value behaves:

| Suffix | Meaning |
|---|---|
| `.elapsed` | A running session-to-date gauge. Trajectory sends it while a session is active. |
| `.accumulated` | A running cost gauge. Trajectory sends it while a session is active and at session end. |
| `.total` | A completed sample or a count, as the family defines it. Check the metric type. |
| `.count` | An additive count delta. |
| `.additive` | A value to sum across the grain that its family states. Attribution projections such as `trajectory.pr.work.*` use it. |

The metric type is part of each metric's definition. Trajectory never uses one
name for both a gauge and a distribution. For this reason, completed samples
and live gauges have different names.

The `.total` suffix alone does not tell you the type or whether you can add
the values. Many session-derived `.total` metrics are completed distribution
samples. Operational metrics also use `.total` for counts, such as
`trajectory.serve.llm_capacity.calls.total`. Before you sum a metric, read its
type, its grain, and how it associates with turns, sessions, PRs, or owners.
Do not build a turn, session, PR, or owner total only because a name ends in
`.total`.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
