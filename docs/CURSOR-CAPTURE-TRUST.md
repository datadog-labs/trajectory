# Cursor Capture Trust

Trajectory captures Cursor Desktop and cursor-agent through different surfaces.
Use these rules when interpreting tokens, cost, client surface, and subagent
activity.

## Trusted Signals

- Parent-turn tokens and estimated USD require a complete native input,
  output, cache-read, and cache-write vector plus an exact model and rate card.
- `client_surface=cli` requires a trusted cursor-agent invocation marker.
- `client_surface=desktop` requires setup-managed Desktop hooks. Run
  `trajectory setup --clients cursor` once after upgrading so existing hooks
  receive the current surface marker.
- Subagent launches are counted from native or safely synthesized
  `subagent_start` events.
- Child tokens and estimated USD require
  `subagent_usage_status=complete`. Partial or unavailable child evidence is
  never replaced with the parent turn's usage.
- Headless cost is supported when `cursor-agent --print` is launched through
  `trajectory cursor-agent --print`. The wrapper binds an exact printed
  session/generation identity and native token vector without changing stdout.

## Unsupported Inferences

- Parent totals do not include Task-child spend unless the provider supplies
  complete child evidence.
- Raw `cursor-agent --print` output is not enough to bind usage to a captured
  session.
- Passive transcript history does not prove model, token, cost, terminal
  closure, or Desktop-versus-CLI surface.
- Chat-only nested transcripts do not provide child token or cost evidence.

## Controls

The current Cursor surface marker and print-result binding are enabled by
default. They can be disabled as kill switches:

```bash
trajectory features disable cursor_desktop_surface_marker
trajectory features disable cursor_print_result_binding
```

Re-enable a control with `trajectory features enable <name>`, reload the
configuration, and rerun Cursor setup when changing the Desktop surface marker.

For broader client coverage, see [SUPPORTED-CLIENTS.md](SUPPORTED-CLIENTS.md).
For emitted signal details, see
[CLIENT-INSTRUMENTATION.md](CLIENT-INSTRUMENTATION.md) and
[METRICS-REFERENCE.md](METRICS-REFERENCE.md).
