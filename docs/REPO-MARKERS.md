# So You Want To Use Markers In Your Own Repo?

This guide is for a team that wants a repository to define its own Trajectory
markers and, optionally, publish those marker metrics to Datadog.

The short version is built into the binary:

```bash
trajectory user-guide repo-markers
```

## The two repo files

Repo-level marker setup usually uses two different files:

| File | Purpose |
| --- | --- |
| `.trajectory/markers.yaml` | Defines or overrides marker points, ranges, measures, and tags for sessions in this repo. |
| `publish.trajectory.yaml` | Selects or narrows trusted publish destinations, adds safe destination tags, and turns marker metrics on for those destinations. |

`publish.trajectory.yaml` does not define marker rules. `.trajectory/markers.yaml`
does not configure Datadog destinations. Keep those responsibilities separate.

## Before you start

Make sure Trajectory is installed and configured on the developer machines that
will run coding agents:

```bash
trajectory setup
trajectory publish validate
```

Repo publish overlays are ignored unless the repo's git origin is trusted by
user or managed config. The relevant user config fields are:

```yaml
publish_trust:
  allowed_origins:
    - https://github.com/acme/payments.git
  require_committed: true
```

When `require_committed: true` is set, commit `publish.trajectory.yaml` before
expecting it to apply. `trajectory publish validate` reports when trust policy
blocks a repo publish overlay.

## Step 1: add repo marker rules

Create `.trajectory/markers.yaml` in the repo:

```yaml
version: 2

points:
  - name: migration-file-edited
    description: Agent edited a database migration file
    severity: warn
    confidence: high
    emit: metric
    scope: turn
    match:
      tool: [Edit, MultiEdit, Write]
      file: "**/migrations/**"

  - name: repo-test-failed
    description: Repo test command failed
    severity: error
    confidence: high
    emit: metric
    scope: turn
    match:
      tool: [Bash, Shell, exec_command, run_shell]
      command: '\b(?:make\s+test|npm\s+test|pytest)\b'
      success: false

measures:
  - name: migration-file-edits
    scope: session
    count:
      point: migration-file-edited

  - name: repo-test-failures
    scope: session
    count:
      point: repo-test-failed
```

Validate the marker file before relying on it:

```bash
trajectory markers validate --config .trajectory/markers.yaml
trajectory markers explain --config .trajectory/markers.yaml migration-file-edited
```

New sessions in the repo load the project marker layer automatically from the
nearest parent directory containing `.git/`. You can force a project marker file
for local testing with `TRAJECTORY_PROJECT_MARKERS_PATH`.

## Step 2: enable marker metrics for the repo

If the default Datadog destination comes from `~/.trajectory/config.yaml`, refer
to it as `_config_datadog` in `publish.trajectory.yaml`:

```yaml
version: 1
destinations:
  - name: _config_datadog
    level: minimal
    markers:
      enabled: true
      metrics: true
    tags:
      team: payments
      service: payments-api
```

This overlay can lower trace detail, add destination tags, and enable marker
metrics for that trusted destination. It cannot create a new trace destination
or raise trace detail above the trusted destination's ceiling.

For a metrics-only project destination, use `level: off` and keep marker logs and
LLM Obs marker evaluations off:

```yaml
version: 1
destinations:
  - name: payments-marker-metrics
    type: datadog_agentless
    site: datadoghq.com
    ml_app: payments-agents
    api_key_ref: payments-dd-api-key
    level: off
    markers:
      enabled: true
      metrics: true
      logs: false
      evaluations: false
    tags:
      team: payments
      service: payments-api
```

Project configs cannot enable structured records, security event streams, AI
Usage events, privacy exemptions, or new trace destinations.

## Step 3: validate the effective setup

Run these from inside the repo:

```bash
trajectory markers validate
trajectory markers list
trajectory publish validate
trajectory publish status
```

After a session runs, use local diagnostics before assuming a Datadog problem:

```bash
trajectory diagnose publish --session <session-id>
trajectory publish metrics audit --session <session-id> --builtin-details
```

If you changed marker definitions after a session already finished, re-evaluate
the local cache before auditing or republishing historical metrics:

```bash
trajectory reevaluate --session <session-id>
```

## How the files are merged

Marker config layers are resolved in this order:

1. Built-ins embedded in the binary.
2. Org markers from `TRAJECTORY_ORG_MARKERS_PATH` or
   `~/.trajectory/org/markers.yaml`.
3. User add-ons from `~/.trajectory/markers.d/*.yaml`.
4. User markers from `TRAJECTORY_MARKERS_PATH` or `~/.trajectory/markers.yaml`.
5. Project markers from `TRAJECTORY_PROJECT_MARKERS_PATH` or
   `.trajectory/markers.yaml`.

Later marker layers override earlier layers by marker name, except enforced org
markers cannot be overridden locally.

Repo publish overlays are separate. Trajectory walks upward from the working
directory and merges every `publish.trajectory.yaml` it finds. A child overlay
can narrow a same-name trusted destination, add safe tags, and add a metrics-only
destination when policy allows it.

## What to send a teammate

For authoring syntax, send [MARKERS.md](MARKERS.md). For the repo-specific
workflow, send this guide. For the full publish-overlay contract, use:

```bash
trajectory user-guide publish
```
