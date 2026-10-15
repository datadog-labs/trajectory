## Agent Security Metrics

AI-EDR and AI Guard send their metrics through one shared set of destination
rules. These metrics are off by default.

### Who can turn them on

- Only a managed required destination with `agent_security.metrics: true` can
  turn them on. User and project configuration cannot.
- A destination that is not incognito-exempt and receives these metrics must
  set `level: off`. Its metrics grant cannot turn on findings or any span or
  log output.
- Trajectory sends no metrics to that destination for incognito sessions.
- A destination that receives findings must be `incognito_exempt`. It does not
  need `level: full`. Findings therefore never turn on ordinary session
  traces.

### Metrics

| Metric | Type | Unit | What it counts |
| --- | --- | --- | --- |
| `trajectory.security.agent_security.evaluations` | count | evaluation | Evaluations by engine, mode, client and event, user and repository, and outcome |
| `trajectory.security.agent_security.decisions` | count | decision | Decisions by the evaluator's disposition |
| `trajectory.security.agent_security.would_block` | count | decision | Results that would block an action, in observe mode or when the enforcement veto stopped the block |
| `trajectory.security.agent_security.duration_ms` | distribution | ms | Every evaluator latency sample |
| `trajectory.security.agent_security.fail_open` | count | evaluation | Evaluations that failed open because of a timeout, capacity, storage, routing, unavailable, or evaluation problem |
| `trajectory.security.agent_security.custody` | count | record | Saved decision and custody records, by record type |
| `trajectory.security.agent_security.projection` | count | finding | Finding log submissions that succeeded or failed |
| `trajectory.security.agent_security.active` | gauge | evaluator | Evaluators seen active in the 10-second bucket |

### How points are grouped

Trajectory combines count and gauge points that share the same tags into
10-second buckets. Distribution series keep every sample. OTLP output sends
one delta histogram for each sample.

A repository, runtime, or release tag can change later. In that case,
Trajectory moves the running count to the new tags. It does not start a second
baseline.

Trajectory does not sample, keep only the top values, group users or
repositories into buckets, or merge tags.

### Tags

Metrics carry these tags:

- `trajectory.user`, repository identity, cohort, and environment
- host and operating system
- client, normalized event name, engine, mode, and enforcement-gate state
- component and release
- outcomes specific to each metric, from fixed lists

The disclosure profile appears only when the same destination can also
receive findings.

Metrics never carry session or turn IDs, paths, prompts, or commands. They also
exclude tool input and output, policy and rule IDs, and hashes. Trace and span
IDs, analyst or evidence text, and email addresses are excluded too. Metric
names and tag keys come from fixed allowlists.

### Enabled-module rollout state

Activity metrics such as `active` cannot show whether a module is enabled. An
enabled evaluator can be idle. Missing activity can also mean that export is
off or that delivery failed. Trajectory therefore reports module state in
separate metrics, including the disabled state. These metrics need the
`module_state_metrics` grant. Only managed configuration can set it, and it is
off by default.

| Metric | Type and value | Purpose |
| --- | --- | --- |
| `trajectory.ops.module.heartbeat` | Gauge, `1` for each observed entity | Shows that a state report exists, including disabled and unknown reports |
| `trajectory.ops.module.observed_at` | Gauge, Unix seconds of the observation | Picks the newest state when tags change, and shows how fresh it is |

Both points carry the same tags and the same observation time. Read them as a
pair. Neither metric counts evaluations or confirms delivery.

#### What one snapshot covers

One snapshot describes one managed user home on a host
(`config_scope:user_home`). It has seven entities:

- one module summary (`engine_id:module`, `client_source:all`)
- `ai_guard` and `ai_edr` for each of `claude-code`, `codex`, and `cursor`

The snapshot describes policy, not which clients are installed. It does not
cover Copilot or other clients. It does not cover project overrides. Trajectory
never loads a project or scans repositories to report state.

| Tag | Meaning |
| --- | --- |
| `module_enabled` | The resolved module switch |
| `evaluator_enabled` | The evaluator override, or its built-in default |
| `product_active` | The product is activated and admitted. A plugin directory on disk is not enough. |
| `client_enabled` | The managed setting for each client |
| `availability` | The built-in evaluator and its managed availability setting allow evaluation. This tag does not report backend or credential health. |
| `enabled` | Every activation and availability check allows evaluation |
| `mode` | The resolved intent: observe or enforce |
| `enforcement_gate` | The AI-EDR enforcement veto. It is `not_applicable` where no veto exists, as for AI Guard. |
| `snapshot_status` | `complete`, `unknown`, or `conflicting` |

Boolean tags use `true`, `false`, and `unknown`. They use `not_applicable`
where a field does not apply to the module summary. `availability` is
`available`, `unavailable`, `unknown`, or `not_applicable`. `mode` is
`observe`, `enforce`, or `unknown`.

The module summary's `enabled` tag shows the module's own activation. It is
not a combination of its evaluators. Never add the summary to an evaluator
row.

Trajectory reports `unknown` in these cases:

- a read failed
- the authority could not be resolved
- an activation was not accepted
- the owner was ambiguous

It never reports these cases as disabled. Only `snapshot_status:complete`
counts toward enabled or disabled.

Enforce intent with an open veto does not mean that the agent is protected.
Protection also depends on the event's blocking policy and native hook support.
It also depends on the installed hooks, credentials, and backend. Taking a
snapshot never runs an evaluator, tests a credential, installs a hook, or calls
a backend.

The snapshot also carries these tags:

- `host`, `os.type`, and optional `os.version`
- `trajectory.user`, `trajectory.version`, and `cohort`
- `module_id:agent-security`, `engine_id`, `client_source`, `config_scope`,
  and `schema_version:1`
- the standard catalog tags

The payload excludes destination names, project or repository identity, and
session and turn IDs. It also excludes raw configuration, policy and rule IDs,
and credential references. Email addresses, errors, paths, and custom tags are
excluded too. Trajectory applies the allowlist to the final payload, after it
adds the common tags.

#### Cadence and limits

- Trajectory takes at most one snapshot per rolling hour for each managed user
  home. A failed attempt counts. A restart or a new owner process keeps the
  schedule.
- State comes from the configuration that the running serve processes in that
  home accepted. If they agree, Trajectory reports one observation. If they
  disagree, it reports `conflicting`. Processes it cannot read, or that are
  ambiguous, make the state unknown.
- Each eligible destination gets one request of seven pairs, at most 64 KiB.
  Collection reads at most 256 process records and 1 MiB. The whole pass has
  10 seconds.
- Trajectory sends the snapshot directly, once. It has no outbox, queue, or
  retry. The next pass reports the current state. An observation keeps its
  original time.

#### Who may receive it

The grant does not depend on module enablement or `agent_security.metrics`.
It also does not depend on findings, module spans, or retry settings. An
administrator can therefore see `enabled:false` while every security output
stays off.

- Only managed required Datadog destinations that may receive ordinary
  metrics are eligible.
- Incognito-exempt security destinations, project destinations, and local
  grants are not eligible.
- Global incognito stops these metrics.
- Trajectory checks the authority again just before each submission.
- User, project, and `TRAJECTORY_ENABLE_FEATURES` settings cannot turn it on.

#### Reading the fleet

Follow these steps to measure enablement across the fleet:

1. Select the newest observation before you apply any filter.
2. Require all seven pairs at that time.
3. Treat observations older than four hours as stale.

Do not filter on `enabled:true` first. An enabled report from three hours ago
must lose to a disabled report from one hour ago. A newer incomplete snapshot
makes its entities unknown. It does not fall back to older reports. A point
more than 60 seconds in the future makes that scope unknown.

Use distinct hosts with a fresh
`trajectory.ops.binary.heartbeat{binary_state:running}` as the denominator.

- A host counts as enabled for an evaluator and client only when every fresh
  user scope on it reports complete enabled state.
- If the scopes disagree, the host is mixed.
- If a report is missing, the host is unknown.
- Report hosts with security reports but no binary heartbeat separately.
- A denominator of zero gives no percentage.

This measures coverage of the hosts that report. It does not cover every
company device.

For example, take five hosts with a fresh binary heartbeat, and AI-EDR for
Codex:

| Host | Observations | Result |
| --- | --- | --- |
| A | Enabled at 10:00, disabled at 11:00 | Disabled |
| B | Enabled at 11:00, no sessions | Enabled |
| C | Enabled at 07:59 (query at 12:00) | Stale, unknown |
| D | Older binary, no state report | Unknown |
| E | Running processes disagree | Unknown |

That gives 1 enabled, 1 disabled, and 3 unknown: 20% coverage.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
