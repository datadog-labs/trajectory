## Emission Gates

This page lists the settings that decide whether Trajectory sends metrics.

### Base metrics

Trajectory sends base metrics to an active Datadog or OTLP destination that
has `export.metrics: true`.

In a normal Datadog setup in `~/.trajectory/config.yaml`, set `export.site` and
`export.metrics: true`. Trajectory then creates the built-in
`_config_datadog` destination. This also works with `export.traces: off`. In
that case, Trajectory sends metrics but no LLM Obs trace spans.

The destination `type` selects the backend. It does not turn metrics on or
off. A `type: datadog_agentless` destination sends live and historical metrics
through agentless OTLP. The legacy types `type: datadog` and `type: dd_llmobs`
are aliases for `datadog_agentless`.

The deprecated `metrics_transport` and `metrics_url` keys have no effect on
routing. An earlier release may have queued rows for the Metrics API. The next
time Trajectory drains the queue, it sends those rows through OTLP.

### Marker metrics

Marker-derived metrics need both marker evaluation and marker metrics turned
on:

```yaml
markers:
  enabled: true
  metrics: true
```

If a destination sets `markers.metrics: false`, Trajectory sends no
marker-derived metrics to that destination.

A project `publish.trajectory.yaml` file can add a destination that receives
metrics only. Trajectory accepts it only when all of these are true:

- The destination has `level: off`.
- Marker metrics are on.
- Marker logs are off.

A destination that a repository creates may select an API key reference that
is set up on the local machine. It cannot select endpoint overrides,
privileged credential controls, or a non-public site, unless the user config
allows that site.

Trajectory no longer publishes marker evaluations to LLM Obs. It still accepts
the `markers.evaluations` field but ignores it.

### Serve operational counters

`trajectory serve` sends some operational counters through the publish engine.
It sends them to each eligible destination through agentless OTLP, on a
best-effort basis. These counters do not depend on trace export. Turning
incognito on or off sends no metric to ordinary destinations.

An eligible destination is a Datadog destination that takes metrics. A
destination with `incognito_exempt: true` never takes metrics, so serve sends
none of these metrics while incognito mode stays on for the user. Most serve
metrics also need the destination's marker metrics, `markers.enabled` and
`markers.metrics`.

The deployment fleet gauges do not need markers:

- `trajectory.ops.binary.heartbeat`
- `trajectory.ops.convergence.heartbeat`
- `trajectory.ops.config_migration.heartbeat`
- `trajectory.ops.update.wait_age_seconds`

A destination receives them when `export.metrics` is on, which is the default.
It also receives them when its own marker metrics are on. Marker settings never
withhold them, so the operational dashboard sees every computer that runs
Trajectory. If no destination can take them, serve does not count the hourly
heartbeat as sent. It tries again 10 minutes later. It logs
`deployment heartbeat: not sent` at most once an hour.

Serve metrics carry the `tags` from your configuration and managed settings,
and the destination's `tags`. Session metrics carry these tags too, so a
dashboard filtered by your own tags includes both. The one exception is
`trajectory.ops.update.wait_age_seconds`. It carries only the destination's
`tags`, so the final `0` of a wait always lands in the series the wait
started.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
