# Privacy Controls

Use this page to keep session content out of Datadog. You can stop publishing
for one session, for all your sessions, or stop capture completely.

Trajectory first saves each session on your computer as local JSONL. Then it
publishes data based on your config and on the policy of each destination. A
destination is a place where Trajectory sends data, such as a Datadog
organization.

## Choose a Control

| Control | How long it lasts | Local capture | Metrics | Trace and log content | Exempt managed destinations | Use it for |
| --- | --- | --- | --- | --- | --- | --- |
| [`/incognito`](#incognito) | The current session | Continues | Sent without model and repository tags by default | Stopped for that session | Still receive data | One sensitive task |
| [Opt Out of All Non-Security Use Cases](#opt-out-of-all-non-security-use-cases) | Until you opt back in | Continues | Sent without model and repository tags by default | Stopped for all sessions | Still receive data | A lasting choice to keep content private |
| [`trajectory config capture disable`](#disable-all-capture) | Until you turn capture back on | Stops | No new session metrics | Nothing new to send | Nothing new, unless managed policy requires capture | Stopping all recording, if policy allows it |

Incognito and opt-out stop publishing. They do not stop capture:

- Local JSONL capture and local processing continue.
- Trajectory sends no trace or log content to Datadog destinations that follow
  your incognito choice.
- Trajectory still sends accounting and activity metrics. By default, these
  metrics leave out model and repository names.
- Managed destinations with `incognito_exempt: true` still receive events.

Your organization decides which destinations exist and what each one is for.
For example, it can send engineering analytics to an ordinary destination. It
can also send required security or audit monitoring to an exempt destination.
To ask what an exempt destination receives, contact the team that owns your
managed policy.

Capture disable is stronger. Trajectory records no new local data, so it has
nothing new to publish. Managed policy can block capture disable for some
clients.

Each destination also has its own trace level. A destination below `standard`
receives structure only, in spans and in event logs. Event logs send a fixed
list of structural fields. They drop everything else, including fields that
Trajectory does not recognize. See [trace levels](PUBLISH.md#trace-levels).

## Incognito

Incognito stops publishing the current session's traces, logs, and similar
content. It applies to one session and turns off when that session ends.

To turn on incognito in a client that has the Trajectory skill:

1. Type the command:

   ```text
   /incognito
   ```

   In Claude Code, the command is `/trajectory:incognito`. Or ask in plain
   words:

   ```text
   Go incognito for this session.
   ```

2. Wait for the success message. Trajectory saves the session's privacy state
   in one atomic write and reads it back before it reports success.

If Trajectory cannot write or clear the state, the command returns an error
that tells you what to do. Trajectory then keeps the earlier state, which is
the safer choice. It does not report success.

### Turn incognito off

Only you can turn incognito off. Type `/incognito off` in the client. In Pi,
type `/incognito off`, or `/incognito off all` to publish again for every
session.

An agent can turn incognito on with the `trajectory_incognito` tool. The tool
refuses to turn it off. So an agent, or text in its context, cannot switch your
privacy setting off through it. Trajectory logs each switch-off in its
serve log with the path it came through, such as `source=slash_command`.
If Trajectory is not running, `/incognito off` leaves incognito on and changes
nothing. Start Trajectory and run `/incognito off` again.

An agent that can run shell commands can still run the `/incognito` script or
call Trajectory directly. The tool rule closes the easy path and leaves a
record. It does not make a switch-off impossible for such an agent.

### What incognito changes

During incognito, these steps continue on your computer:

- Local JSONL capture.
- Task segmentation.
- Semantic classification.

Trajectory sends no trace or log output to Datadog destinations, except exempt
ones. These outputs include traces, evaluations, records, and AI Usage events.

Trajectory still sends metrics. You can still measure session count, cost,
tokens, activity, identity, timestamps, and semantic results.

### Metric modes

The `export.incognito_metrics` setting controls the metrics of an incognito
session:

```yaml
export:
  incognito_metrics: redacted # default; or standard
```

- `redacted` is the default. Trajectory removes the tags that name the model
  and the repository just before the metrics leave your computer.
- `standard` sends the normal metric tags.

If managed config sets `incognito_metrics`, the managed value wins.

`redacted` removes these tags:

- `gen_ai.request.model`, the reasoning effort, and every `trajectory.model.*`
  tag.
- The provider, the provider route, and the provider cost visibility.
- The pricing version and the cost overlap and cost dedupe tags.
- The repository, owner, git remote host, repository source, project
  directory, and file path.
- The change host and the change number.

`redacted` adds the tag `trajectory.metrics_disclosure:redacted`. It keeps
session and user identity, timestamps, metric names and values, and cost and
token counts. It also keeps activity, client and version, semantic
classifications, host and OS, and the other cost tags.

There is no `off` mode for metrics, so cost and token accounting always
continues. `redacted` removes only the tags listed above. Trajectory does not
read the meaning of your custom tags. Someone might still guess identity from
the measurements that stay.

### Models that are always redacted

Trajectory always removes the model tags from metrics for some models. This
happens even when `incognito_metrics` is `standard`, and you cannot turn it
off.

This redaction removes the model, reasoning effort, provider, route, and
pricing tags. It also removes the tags that link cost to the model. It keeps
the repository tags and the accounting and activity tags. It adds the tag
`trajectory.model_disclosure:redacted`.

### Exempt destinations and the security event stream

A managed destination can set `incognito_exempt: true`. Such a destination can
still receive spans during incognito, for approved security or audit use.

Exempt destinations never receive ordinary accounting metrics. They also
receive no marker metrics, marker logs, or AI Usage events. They work under a
separate managed policy for security and audit use.

A managed security destination can also turn on the security event stream.
The stream sends one Datadog log for each Trajectory event. Its default
`security` profile keeps the complete captured event. The event includes:

- Prompts, responses, and thinking.
- Tool inputs and outputs.
- Diffs, file content, and raw payloads.
- Errors, summaries, and identity fields.

Only managed config can set up security destinations. A project
`publish.trajectory.yaml` file cannot change them. For details, run
`trajectory user-guide security-event-stream`.

## Opt Out of All Non-Security Use Cases

Opt-out applies incognito to all your current and future sessions. You do not
need to run `/incognito` in each conversation.

To opt out, run:

```bash
trajectory config publish opt-out
```

To publish again for future sessions, run:

```bash
trajectory config publish opt-in
```

Both commands accept `--json`. The `persistent_incognito` feature must be on
for opt-out to work. It is on by default.

An agent can opt you out the same way. It calls the `trajectory_incognito` tool
with `persistent: true`, so a request such as "always go incognito" needs no
session ID. The tool cannot opt you back in. Only you can, with
`trajectory config publish opt-in`.

Trajectory saves the choice in `~/.trajectory/standard-publish.disabled`. It
reads the change without a restart. While you are opted out:

- Local JSONL capture and local processing continue.
- Trajectory stops trace and log outputs.
- Trajectory applies the incognito metric mode to destinations that are not
  exempt.
- Approved `incognito_exempt` security or audit destinations still receive
  data.

Opt-in applies to future sessions. A session that already saw incognito stays
suppressed until it ends.

## Sensitive Tags

You can mark text with `<sensitive>...</sensitive>` blocks. The tags tell the
agent and human readers that the text is sensitive:

```text
<sensitive>
Customer details, HR/legal content, credentials, or private investigation notes.
</sensitive>
```

These tags are a convention, not a redaction boundary. Trajectory can capture
the tags and the text inside them on your computer. To keep the content out of
Datadog, turn on `/incognito` before you share it.

Do not put sensitive values in metric tags and marker dimensions. Also keep
them out of PR descriptions, commit messages, and public comments.

## Sensitivity Scanning (Removed)
Trajectory no longer classifies sessions by sensitivity. It makes no
classifier calls, and it does not hold, drop, or reduce spans because of a
session's content. Sensitivity handling is no longer done in the client. It
belongs on the receiving side, where it can apply to every signal the same
way.

Every session is published at the destination's capture level. Some
destinations relied on the removed gate. They set
`privacy.sensitivity_classifier: true`, with `sensitive_policy: drop` or
`minimal`. Such a destination now receives every session, including sessions the
gate would have held or dropped. A sensitive label also used to reduce the
session to `minimal` on every other destination. That is gone too. Labels that
an older release stored are ignored. See
[Sessions from before the removal](#sessions-from-before-the-removal).

The client-side controls are:

- the destination capture level (`level: off`, `minimal`, `standard`, or
  `full`). For spans, `minimal` omits prompt, output, and tool payload
  content, and `off` sends none. Marker event logs follow the same level for
  content: at `off` or `minimal` they are still sent, without the content
  fields listed under [trace levels](PUBLISH.md#trace-levels). A content
  field under a name Trajectory does not recognize is still sent.
- [`/incognito`](#incognito) for one session, and the persistent publish
  opt-out for all sessions. Incognito stops spans and event logs, so use it
  for a session that must send no content. The one exception is a managed
  destination configured with `incognito_exempt: true`, which still receives
  the session.

Configuration written for an older release still loads. These keys are
ignored:

- `export.sensitivity.*`
- `privacy.sensitivity_classifier`, `privacy.sensitive_policy`, and
  `privacy.sensitivity_exempt` on a destination, in managed
  `required_destinations` or in a project publish file
- the `sensitivity_scanning` feature

`trajectory doctor` lists any of them it finds under "Removed sensitivity
settings". When a setting asked for scanning or gating, `trajectory status`
prints a note and `trajectory serve` logs one line at startup. Delete the keys
to clear the notice. An administrator removes keys that come from managed
configuration. Some endpoints may still run a release that has sensitivity
scanning. Then the order matters. Either turn the scanning block off or remove
it first, or remove the block, the feature and the destination keys together.
Those older releases reject a managed document whose scanning block is on
without its feature or without a destination that sets
`privacy.sensitivity_classifier`. Once every endpoint runs a release without
sensitivity scanning, any order works. The managed endpoint administrator guide
gives the steps.

### Sessions from before the removal

Labels that an older release stored are ignored. A session labeled
`confidential`, `restricted` or `unclassified` before the upgrade publishes
like any other session from now on. Its new turns, its session end, replays
and backfill are sent at each destination's capture level. Trajectory writes
no new label and does not delete the stored ones.

An older release can hold spans when you upgrade. These spans are sent once,
to the destinations they were held for, at each destination's current capture
level. They are sent at session end, or when an already ended session is
recovered. This applies whatever label the session had. If sending keeps
failing, Trajectory tries five times and then drops the spans. It drops them at
once when they have nowhere to go:

- the destination was removed or changed
- the destination takes no spans at its current level
- the session is incognito
- the session's events are gone

Spans of a session that had already ended before the upgrade are sent only if
the older release had finished classifying it. If classification had not
finished, they are dropped with the reason `ended_before_removal`.
`trajectory serve` records each drop in its operational log as
`serve.legacy_held_spans.cleared`, with the session, the reason and the number
of failed attempts.

Before it sends held spans, `trajectory serve` checks the whole session for
incognito, including every captured event. A record in the session may be
unreadable, or carry a privacy value that `serve` does not know. Then the spans
are dropped with the reason `range_unavailable`.

Reader v2 remote, where it is enabled (it is off by default), no longer blocks
a session because of a stored label. Incognito and the persistent publish
opt-out still block it.

## Disable All Capture

Capture disable stops all new recording for your user. Use it only when you
want no local data at all. To keep local capture and stop only publishing, use
[Opt Out of All Non-Security Use Cases](#opt-out-of-all-non-security-use-cases)
instead.

To stop capture, run:

```bash
trajectory config capture disable
```

To start capture again, run:

```bash
trajectory config capture enable
```

Trajectory saves this state in `~/.trajectory/capture.disabled`. Running
Trajectory servers discard new hook, watcher, and OTLP events right away. You
do not need to restart the agent.

Managed capture policy can block or override capture disable for some clients.
The `trajectory_disable_command` feature must be on for `disable` to work. It
is on by default. To stop capture for one process only, set
`TRAJECTORY_DISABLED=1` in its environment.

## Check Current Behavior

Use these commands to see what Trajectory does now. They change nothing.
`doctor publish` checks only local data and does not query Datadog.

| Command | What it shows |
| --- | --- |
| `trajectory config show` | Managed defaults, user config, and environment overrides |
| `trajectory publish status` | The active publish mode |
| `trajectory doctor publish --session <session-id>` | What Trajectory captured for one session and what it plans to publish |
| `trajectory doctor` | The install, capture, local data, credentials, and publish queues |
