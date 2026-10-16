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

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
