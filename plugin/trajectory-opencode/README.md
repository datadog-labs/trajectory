# Trajectory OpenCode Plugin

Beta: Trajectory ships this plugin in GitHub Release tarballs today. We plan to
publish it to npm as `@datadog/trajectory-opencode`.

## Install

`trajectory setup --clients opencode` does three things:

- It installs this plugin under the OpenCode config directory. Setup picks the
  directory in this order: `OPENCODE_CONFIG_DIR`, then
  `XDG_CONFIG_HOME/opencode`, then `~/.config/opencode`.
- It adds the plugin path to `opencode.json`.
- It writes a `trajectory` MCP entry.
- It records the Trajectory home and the Trajectory binary in the plugin
  folder, in the files `trajectory-home` and `trajectory-bin`.

### Manual Install

To install manually, copy this plugin to a stable local path. Then add the
plugin path and the MCP entry to `opencode.json`:

```json
{
  "plugin": [
    "/absolute/path/to/trajectory"
  ],
  "mcp": {
    "trajectory": {
      "type": "local",
      "command": ["/absolute/path/to/trajectory-binary", "mcp"],
      "enabled": true
    }
  }
}
```

You can also copy this folder to `~/.config/opencode/plugins/trajectory`. Then
reference that absolute path from the `plugin` array.

Manual local installs are still supported for development and recovery. Use
setup for regular installs. Setup copies the plugin, writes the MCP entry, and
installs the global incognito skill in one step.

## Skill

OpenCode loads native agent skills from
`~/.config/opencode/skills/<name>/SKILL.md`. It also loads skills from the
compatible paths `.agents/skills/<name>/SKILL.md` and
`.claude/skills/<name>/SKILL.md`.

This plugin ships an incognito skill at `skills/incognito/SKILL.md`. To install
it globally, run:

```bash
mkdir -p ~/.config/opencode/skills
cp -R plugin/trajectory-opencode/skills/incognito ~/.config/opencode/skills/incognito
```

`trajectory setup --clients opencode` also writes this skill into the global
OpenCode skills directory.

## Capture failure isolation

Capture is optional. When capture fails or reaches a limit, the plugin drops
capture data. It never changes OpenCode's own output. This section lists the
limits and explains what happens when capture data is lost. Backfill can
repair data from the provider's stored session records. Capture never invents
missing facts.

### Setup Verification

Setup verification compares the imported `capture-state` and `capture-queue`
files with the bundled copies. If a file is missing, unreadable, or changed,
verification fails. Verification never runs client code.

### Callbacks and Snapshots

- Prompt, tool, render, idle, and disposal callbacks take size-limited
  snapshots. They return without waiting for capture HTTP or for filesystem
  work on the home pointer.
- Snapshots read only an object's own properties. Fields added to shared
  object or array prototypes do not extend the payload scan.
- At most 64 ordinary callbacks hold preparation snapshots at the same time.
  Temporary snapshots share a separate total limit of 16 MiB.
- Each callback has at most two arguments. Each argument is also subject to
  the event size and complexity limits.
- When all 64 slots are in use, the plugin declines capture before it copies
  payloads.
- When the 16 MiB limit is reached, the plugin declines capture before it runs
  capture handlers.

If callback preparation is full, one small end-of-turn record stays on the
existing session. Cleanup waits for admitted preparation and blocks later
callbacks. It then releases the turn without waiting for HTTP delivery. The
preparation-loss counts include the decline, and the plugin marks the affected
Stop incomplete.

Assistant usage needs an admitted deduplication marker before the plugin sends
token or cost data. When a response has several text parts, the plugin keeps
all their text but counts the native request once. If accounting admission is
rejected, the plugin leaves out usage and marks the turn snapshot incomplete.

### Task and Child Sessions

- If a child-creation callback is rejected, the plugin stops inferring Task
  matches for that parent. Explicit native resume IDs still link the child.
- When a Task completes, the plugin clears its pending capture link before it
  prepares the result. This also applies when the session ID is nested in the
  callback.
- Cleanup reads only size-limited own data fields. It never evaluates native
  accessors or proxies.
- An oversized or non-JSON result can lose optional capture data. It cannot
  make a later child session inherit the completed Task identity.
- If a pending Task identity is lost, the plugin cannot safely infer the
  creating call from the remaining IDs. It turns this inference off for that
  parent session. Explicit native Task resume IDs can still link a child.
- Declined links increase the preparation-loss count and mark the affected
  parent turn incomplete. The plugin never assigns the child to a different
  Task.
- Live child links protect their parents from eviction, also when the parent
  turn is idle.
- Native child sessions with a parent stay protected until they go idle or are
  deleted. This applies even when the plugin cannot infer a Task link.
- The plugin declines Task identifiers over 512 characters before it keeps
  them. They mark their turn incomplete.

### Delivery Queue

- The queue sends events in order, with at most one active request.
- It keeps at most 256 events and 8 MiB of encoded bodies. Each event is at
  most 1 MiB.
- A Stop reserves 32 bytes within these limits for an incompleteness flag that
  the plugin may add later.
- Lifecycle events may replace pending ordinary events. SessionEnd has the
  highest priority among pending events.
- Each delivery ID stays attached to its admitted snapshot.

An admitted event gets up to three delivery attempts. The plugin retries after
a preparation failure, an HTTP refusal, a timeout, or an uncertain transport
result. Each retry keeps the same body, selected home, and delivery ID. The
server uses the delivery ID to drop duplicates.

Capture needs a selected home before it sends. Without one, the request cannot
use receipt deduplication safely. Retries wait 100 ms, then 500 ms, after the
previous attempt settles. No retry starts after the 20-second recovery window
or during disposal. A dependency that ignores cancellation keeps its slot until
it settles. The queue does not start replacement work around it.

### Starting the capture server

Trajectory's capture server stops after 10 minutes without capture events. It
can stop while an OpenCode window stays open. When a request gets no answer
because nothing listens on the capture port, the plugin asks Trajectory to
start the server:

1. The plugin runs `trajectory serve ensure` with the binary named in
   `trajectory-bin`. Without that file, it runs `bin/trajectory` in the
   selected home.
2. Later events wait in the queue, in order, while the server starts.
3. The plugin sends the waiting event again with the same delivery ID.

These limits apply:

- The request waits at most 6.5 seconds. That time counts against the event's
  20-second recovery window.
- After a request, the plugin waits 30 seconds before it makes another.
  Events in that time get the three attempts described above.
- Trajectory keeps one capture server for each port. If a server is running or
  starting, the command joins it and starts no second one.
- A server that answers with a refusal is never asked to start.
- Disposal ends a pending request at the 500 ms shutdown deadline.

Non-2xx responses have their own capped count. Transport, preparation, queue,
and shutdown failures each have one too. HTTP acceptance confirms only that the
server received the event.

`unconfirmedDeliveries` counts each event whose delivery retries ended without
HTTP acceptance. Failed attempts that later succeed are not counted. An
unconfirmed event might still have reached Trajectory's stored data.

### Shutdown

- Disposal waits at most 500 ms for the queue to drain. It then drops pending
  work and stops the active request.
- `opencode run` exits as soon as disposal finishes. If disposal returned
  sooner, the final Stop and SessionEnd still in flight would be lost.
- The 500 ms limit applies once to the whole queue. It does not reset for each
  event or session. A transport that ignores cancellation cannot extend it.
  Capture delay therefore cannot add up across repeated deliveries.
- Prompt, tool, text, and idle callbacks still never wait for delivery.
- The shutdown timer stays referenced. A host that awaits disposal stays alive
  for at most 500 ms while home selection finishes.
- If the active event fails during disposal, the plugin drops the pending
  events without sending them. It reports them as shutdown findings.
- Disposal ends retry waits at once, so an idle host records the unconfirmed
  delivery before it exits. Disposal does not wait for the retry timer or start
  another attempt for that event.
- Home selection still works while the queue drains. The queue closes its
  reader when the queue is empty or at the same deadline.
- A dependency that does not cooperate keeps its one permit. The queue does
  not start replacements for it.

### Retained State

The plugin limits the message, text, deduplication, and task-call data that
capture keeps.

- One admission owner limits that data to 16 MiB and 4,096 entries across all
  sessions in this plugin instance. The count includes UTF-16 strings and a
  fixed cost for each entry. It does not measure or limit the memory of the
  whole process.
- Each message keeps at most 128 tool IDs.
- A rejected replacement leaves admitted data unchanged.
- Turn completion and session removal release the data they kept.
- Deferred cleanup recognizes normalized idle statuses, server disposal, and
  explicit idle and deletion events. This also works during callback overload.
- Retained strings and normalized identifiers keep their own copy of the data.
- Invalid identifiers decline capture. The plugin does not pick another session
  instead.
- At 512 protected sessions, the plugin declines new capture. Admitted turns
  then keep their final data.
- The plugin can evict completed child sessions and old Task deduplication IDs
  as inactive state. A long-running host can then keep capturing new work.
- Clearing a native text part removes its buffered text.

### Incomplete Turns

- Incomplete turn snapshots and rejected turn events carry
  `turn_snapshot_dropped` on Stop. This also applies when lifecycle admission
  evicts an event that the queue already accepted.
- Each admitted entry shares only a true or false loss marker with its turn. A
  Stop that is already queued reads that marker before it is sent. The queue
  never keeps the full turn state.
- A later healthy turn starts with its own completeness state.
- The shared OpenCode and Kilo handler keeps that marker. It sets
  `completed: false` on the stored `turn_end` event. Later consumers then
  cannot treat the turn as complete.

Disposal blocks new callbacks and waits for admitted local preparation. It then
releases state. It does not wait for delivery or for filesystem work on the
home pointer.

Preparation loss works as follows:

- If a size-limited native session ID is available, the loss marks that
  session's turn incomplete.
- The plugin cannot safely assign a loss to an unknown session. After such a
  loss, the plugin instance stays cautious when it reports later turns as
  complete.
- A loss for a known session affects only the affected turn.
- For a loss before session creation, the plugin keeps the session ID. It keeps
  at most 512 of these IDs, within the same retained-data limit. That session's
  first turn then takes the loss. A later healthy turn is not marked
  incomplete.
- Sometimes the plugin cannot keep a loss identity, or must evict one. Then
  later turns carry `turn_snapshot_dropped` until the plugin instance restarts.
  The plugin cannot tell which future turn owns that forgotten loss.
- Disposal releases the kept identities. Local loss counts are capped.

### Loss reporting without client alerts

When the native client provides `app.log`, the plugin writes
`Trajectory optional capture diagnostics` to its native logs. It uses the
`trajectory-capture` service. The first record can show a healthy plugin with
zero findings. The plugin can also merge early findings into that record.

Later records report five running totals:

- queue declines
- preparation declines
- retained-state declines
- delivery without confirmed acceptance
- shutdown without confirmed delivery

Findings can overlap. They are not a count or rate of unique lost events.

- Failed delivery attempts that later succeed do not increase the
  unconfirmed-delivery count.
- A header or home preparation failure adds one preparation decline for each
  failed attempt. Running out of retries also records an unconfirmed delivery.
- One rejected preparation snapshot adds one preparation decline. It also adds
  a retained-state decline, but only if keeping its incompleteness marker
  reaches a separate state limit.

Each record has a schema version, the client source, and the five numbers. It
leaves out session IDs, payloads, workspace paths, and raw errors.

Reporting has these limits:

- Reporting runs outside client callbacks.
- It merges updates at power-of-two checkpoints. It starts at most 55
  checkpoints in a plugin's lifetime.
- Each checkpoint has at most three attempts. A plugin therefore sends at most
  165 small requests in its lifetime.
- One logging request holds its permit until it settles. It has a 250 ms
  cancellation deadline.
- The plugin tells the native SDK to throw on a failed logging response.
- Temporary failures retry after 100 ms and 500 ms, even if no new capture loss
  occurs.
- When those attempts run out, the totals stay intact. A later checkpoint can
  retry them.
- Timers do not keep the process alive, and requests never overlap. The last
  exported record can therefore lag behind the local counts.
- Reporting adds no metric families or tags.

Optional capture must not interrupt a user's task. These findings therefore
produce no console output, popup, or notification. If the logging API is
missing or fails, nothing appears in the foreground. The findings might then
not be visible.

Native logs show local data only. Do not use them to judge fleet-wide
reporting freshness, capture completeness, or downstream storage.

### Prompt Capture

- `UserPromptSubmit` captures text and identifiers. Image bytes stay in the
  native client. They are not part of this event's schema.
- The plugin selects the text fields before it takes a snapshot. This includes
  identifiers and message metadata nested in native output objects.
- Attachments nested in those objects stay in the client. They do not prevent
  capture of the prompt that comes with them.
- The existing whitespace normalization and synthetic-text exclusion still
  apply.
- A captured text or tool payload over the existing size limit still counts as
  a visible capacity decline. The plugin does not classify it as an invalid
  native event.
- The plugin does not keep events for recovery after the delivery window ends.

### Trajectory Home Selection

The plugin picks the Trajectory home only when it first needs one.

- A failed selection is reused for 30 seconds. Queued events then do not repeat
  the same filesystem failure.
- A later background delivery can retry after you repair the home pointer.
- A successful selection stays fixed for the life of the plugin instance.
- Repairing the pointer does not replay events whose delivery retries already
  ran out.
- An explicit `TRAJECTORY_HOME` needs no helper process.

Without `TRAJECTORY_HOME`, one helper process reads the installed home pointer.

- The helper has a 1,500 ms deadline. At the deadline, the plugin stops the
  helper with SIGKILL. A graceful exit could itself wait for a blocked
  filesystem worker.
- The helper keeps its permit until the process closes. This also applies when
  parent cancellation fails.
- Child pipes and timers cannot keep the client running.
- Each plugin instance runs one selection at a time, so reads never overlap.
- Sometimes a worker from another plugin instance is still running. A later
  admitted capture then retries after that worker closes. It does not start a
  second worker or pick a fallback.
- Disposal stops the reader process.

Fallback rules:

- Only a missing pointer allows the normal home fallback.
- An invalid or unreadable pointer declines optional capture.
- The plugin checks fallback environment values only when it selects that
  fallback.
- An explicit capture home ignores unused home variables.
- An installed pointer takes precedence over an oversized fallback.

Compiled Bun hosts use the documented
[raw-runtime entrypoint](https://bun.sh/docs/bundler/executables#running-as-bun-cli),
which Bun 1.2.16 and later provide. Older or unrecognized Bun versions skip
this optional read before they start a helper. The helper starts in the
executable's filesystem root with an empty Bun configuration. It does not
inherit HOME or XDG configuration. Project preloads therefore cannot run before
its deadline or corrupt its response.
