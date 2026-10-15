# Use Markers in Your Own Repo

Use this guide to define Trajectory markers in a repository. You can also
publish the marker metrics to Datadog. A marker is a named rule that finds a
behavior in a coding-agent session, such as a failed test. For the marker
syntax, see [MARKERS.md](MARKERS.md).

A short version of this guide is built into the binary:

```bash
trajectory user-guide repo-markers
```

## The two repo files

A repo marker setup usually has two files:

| File | Purpose |
| --- | --- |
| `.trajectory/markers.yaml` | Defines or overrides marker points, ranges, measures, and tags for sessions in this repo. |
| `publish.trajectory.yaml` | Selects or limits trusted publish destinations, adds safe destination tags, and turns on marker metrics for those destinations. |

Put marker rules only in `.trajectory/markers.yaml`. Put Datadog destination
settings only in `publish.trajectory.yaml`.

## Before you start

Install and configure Trajectory on each developer machine that runs coding
agents:

```bash
trajectory setup
trajectory publish validate
```

A publish overlay is a `publish.trajectory.yaml` file that changes the publish
settings for one repo. Trajectory ignores a repo publish overlay unless the
user config or managed config trusts the git origin of the repo. To set trust
in user config, use these fields:

```yaml
publish_trust:
  allowed_origins:
    - https://github.com/acme/payments.git
  require_committed: true
```

If you set `require_committed: true`, commit `publish.trajectory.yaml` before
you expect it to apply. If the trust policy blocks a repo publish overlay,
`trajectory publish validate` reports it.

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

Validate the marker file before you use it:

```bash
trajectory patterns markers validate --config .trajectory/markers.yaml
trajectory patterns markers explain --config .trajectory/markers.yaml migration-file-edited
```

New sessions in the repo load the project marker file without any extra step.
Trajectory looks for it in the nearest parent directory that contains `.git/`.
To test a different project marker file on your machine, set
`TRAJECTORY_PROJECT_MARKERS_PATH`.

## Step 2: enable marker metrics for the repo

Your default Datadog destination can come from `~/.trajectory/config.yaml`. If
it does, refer to it as `_config_datadog` in `publish.trajectory.yaml`:

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

For that trusted destination, this overlay can do three things:

- lower the trace detail
- add destination tags
- turn on marker metrics

The overlay cannot create a new trace destination. It also cannot raise the
trace detail above the highest level that the trusted destination allows.

A project destination can send only metrics. For that case, set `level: off`
and keep marker logs off:

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

A project config cannot turn on security event streams, AI Usage events,
privacy exemptions, or new trace destinations.

## Step 3: validate the effective setup

Run these commands from inside the repo:

```bash
trajectory patterns markers validate
trajectory patterns markers list
trajectory publish validate
trajectory publish status
```

After a session runs, check it on your machine before you look for a problem
in Datadog:

```bash
trajectory doctor publish --session <session-id>
trajectory publish metrics audit --session <session-id> --builtin-details
```

You can change marker definitions after a session finishes. If you do,
re-evaluate the local cache before you audit or republish older metrics:

```bash
trajectory patterns markers reevaluate --session <session-id>
```

## How the files are merged

Trajectory loads marker config layers in this order:

1. Built-ins embedded in the binary.
2. Org markers from `TRAJECTORY_ORG_MARKERS_PATH` or
   `~/.trajectory/org/markers.yaml`.
3. User add-ons from `~/.trajectory/markers.d/*.yaml`.
4. User markers from `TRAJECTORY_MARKERS_PATH` or `~/.trajectory/markers.yaml`.
5. Project markers from `TRAJECTORY_PROJECT_MARKERS_PATH` or
   `.trajectory/markers.yaml`.

If two layers define a marker with the same name, the later layer wins. The
exception is an enforced org marker. No local layer can override it.

Trajectory merges repo publish overlays separately. It walks up from the
working directory and merges every `publish.trajectory.yaml` that it finds. An
overlay in a child directory can do these things:

- limit a trusted destination that has the same name
- add safe tags
- add a destination that sends only metrics, if the policy allows it

## What to send a teammate

For marker syntax, send [MARKERS.md](MARKERS.md). For the repo setup steps,
send this guide. For the full rules of publish overlays, run:

```bash
trajectory user-guide publish
```
