# Metrics Reference

This reference describes the metrics to use in Datadog dashboards and
monitors. For each metric, it gives the name, type, tags, the conditions that
make Trajectory send it, and how to query it.

To read the built-in metric guide in a terminal, run:

```bash
trajectory user-guide metrics
```

## Source of Truth

The Trajectory binary defines each metric's name, type, and standard tags. If
this reference and the binary disagree about a current metric, the binary is
correct.

These pages list only the metrics to use. They leave out deprecated, legacy,
internal, and debug metrics. To see every built-in metric that your installed
version sends, run:

```bash
trajectory publish metrics audit --latest --builtin-details
```

## Related Guides

- Marker syntax and dashboard examples: [MARKERS.md](MARKERS.md).
- Configuration and which destinations Trajectory trusts:
  [USER-GUIDE.md](USER-GUIDE.md).
- How each coding agent supplies the data behind the base metrics:
  [METRICS-CONSISTENCY-AUDIT.md](METRICS-CONSISTENCY-AUDIT.md).
- How Agent Console and dashboards use the cost-overlap and dedupe tags for
  Claude Code and providers:
  [COST-OVERLAP-CONSUMER-GUIDE.md](COST-OVERLAP-CONSUMER-GUIDE.md).
- Additive totals, coverage, and dashboard queries:
  [Cost Attribution and Dashboarding](COST-ATTRIBUTION.md).
- Deployment for one developer or a managed fleet: run
  `trajectory user-guide deploy`.

## Agent Console Reconciliation

Agent Console reconciliation replays metrics from captured sessions. By
default, it builds its own complete list of metrics to replay. The list holds
every session-derived gauge and count that Trajectory can replay safely. The
legacy `metric_slices` setting cannot remove metrics from this list.

Reconciliation does not replay distribution, operational, or live-only
metrics. To see the default list, the task-gated list, and the exclusions, run
`trajectory user-guide backfill`.

## Reference Sections

Each metric family has its own page:

- [Naming Model](metrics/naming-model.md)
- [Operational Metrics Across Namespaces](metrics/operational-metrics.md)
- [Emission Gates](metrics/emission-gates.md)
- [Integration Tile Contract](metrics/integration-tile-metrics.md)
- [Common Tags](metrics/common-tags.md)
- [Per-Turn Metrics](metrics/per-turn-metrics.md)
- [File-Work Indicators](metrics/file-work-indicators.md)
- [Automated Oversight Metrics](metrics/automated-oversight-metrics.md)
- [Per-Session Metrics](metrics/per-session-metrics.md)
- [Agent Security Metrics](metrics/agent-security-metrics.md)
- [Task Metrics](metrics/task-metrics.md)
- [Built-In Marker Metrics](metrics/built-in-marker-metrics.md)
- [Publish and Serve Health Metrics](metrics/publish-and-serve-health-metrics.md)
- [Claude Native OTLP Metrics](metrics/claude-native-otlp-metrics.md)
- [Instrumentation Health Metrics](metrics/instrumentation-health-metrics.md)
- [Heartbeat Metric Definitions](metrics/heartbeat-metric-definitions.md)
- [Query Guidance](metrics/query-guidance.md)
