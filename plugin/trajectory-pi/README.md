# Trajectory Pi Plugin

Beta: Trajectory ships this plugin in GitHub Release tarballs today. We plan to
publish it to npm as `@datadog/trajectory-pi`.

## Install

Setup installs the extension and an extension-local binary path:

```bash
trajectory setup --clients pi
```

### How Setup Activates the Extension

Setup prepares the full extension in a private directory. This README calls
each prepared copy a generation. When the generation is complete, setup changes
`package.json` to select it in one atomic step.

- Bundled installs and release-archive installs both use this activation step.
- If preparation is interrupted or rejected, the previous manifest and
  dependencies stay usable.
- Each generation has its own home pointer and binary path.
- Setup, inventory, and doctor use the same rules to find the manifest
  entrypoint.
- Generation identity includes the binary contents.
- Each generation holds a regular copy of the helper binary, up to 256 MiB. An
  upgrade at the same source path cannot change a helper that a client already
  loaded.
- At run time, the extension prefers this copy over the home binary, which can
  change. An explicit `TRAJECTORY_BINARY` override still comes first.

### Folder Layout

Each generation's files sit in
`~/.pi/agent/extensions/trajectory/.trajectory-bundles/<sha256>/trajectory/`.
The hash folder keeps generations apart. Pi names a local extension after the
folder that holds its `index.ts`, so Pi lists this one as `trajectory`.

Earlier releases put the files directly in the hash folder, so Pi listed the
extension by its hash. The next setup, or the client refresh after an update,
writes a generation in the current layout and switches `package.json` to it.
Pi then lists the extension as `trajectory`. Setup, inventory, and doctor
still read the earlier layout. Setup keeps and removes those copies by the
rules in [Older Generations](#older-generations).

### File Safety

The selected user home may itself be a link. Setup opens each Pi directory
under it through its parent directory, which setup already holds open. This
also applies to the first registration. Setup refuses linked child directories
before it creates anything under them. A user who replaces a parent directory
before setup opens the extension cannot redirect administrator writes into the
replacement.

- The target user can read the published runtime files and their non-secret
  home pointer, even when another user runs setup. Preparation stays private.
- Preparation, archive writes, publication, and cleanup use directory handles
  that setup holds open. Replacing the bundle directory cannot redirect writes
  or cleanup.
- Setup checks the bundle directory and the selected generation again before
  each registration write. It checks them again before it commits activation.
- If either identity changed, setup stops activation. It rolls back the
  registration changes it made.
- After publication, cleanup stops using the staging path name. A later
  replacement at that name stays in place.
- Published directories and the helper have mode 0755, even when an
  administrator's umask is 077.

### Checksums

Before explicit setup publishes a generation, it records a checksum. The
checksum covers the declared runtime files, the copied helper, and the home
pointer. When setup reuses a generation, it checks those bytes again.

- Changed files, a linked helper, or a special-file manifest cause a setup
  error. The active registration stays in place.
- Setup refuses a FIFO manifest without waiting for a writer.
- The checksum detects changes. It does not protect against a malicious user
  who can rewrite both the files and the checksum.
- Inventory keeps its structural checks. It does not hash the large helper on
  each poll.
- Generations from before this checksum format keep their files. Explicit
  setup prepares a separate generation.

Setup also checks source digests against the binary bytes it copies and the
archive bytes it reads during staging. If a source changes, setup stops
activation and keeps the previous registration. The new identity format
prepares a separate generation. It does not reuse an older receipt that lacked
this source check.

### Older Generations

Setup keeps up to eight generations in
`~/.pi/agent/extensions/trajectory/.trajectory-bundles/`. A new Trajectory
binary creates a new generation. When you run setup again with no changes, it
reuses the current generation.

Before setup adds a generation, it removes old copies:

1. It removes folders that an interrupted setup left behind.
2. At the limit of eight, it removes the generations that setup selected least
   recently.
3. It never removes the generation that `package.json` selects.

A Pi session that started before an update keeps using the files it loaded.
Its generation stays in place through seven later updates, unless setup
failed to remove other copies. When the extension loads, it reads the
Trajectory home once and keeps it. If setup later removes the generation, the
session still sends events to that home and uses the Trajectory binary there.
A new Trajectory home takes effect when Pi loads the extension again, for
example after a restart.

Setup also leaves the `index.ts` and `src/` files that releases before
generations wrote directly in `~/.pi/agent/extensions/trajectory/`.

- A copy that setup cannot remove still counts toward the limit. If setup
  still has room for the new generation, it shows a warning and tries again on
  the next run.
- Setup stops while another setup run holds the setup lock.
- Archive processing rejects links, path traversal, more than 128 entries, and
  expansion above 256 MiB.

If setup cannot remove enough copies, it stops with
`pi bundle retention limit reached` and keeps the current extension. The
refresh after an update records this error, and `trajectory doctor` reports
it. Pi shows no alert. The error names each copy that setup could not remove.
To recover, follow these steps:

1. Close every Pi session.
2. Remove the integration. This deletes every generation:

   ```bash
   trajectory uninstrument pi
   ```

3. Install the integration again:

   ```bash
   trajectory setup --clients pi
   ```

### Settings and Rollback

- Setup validates legacy extension settings before it selects the new capture
  generation.
- If setup reports an activation failure, it restores only the bytes that this
  setup run changed.
- Setup updates symlinked user settings and MCP files at their regular-file
  targets. It keeps their links and private permissions.
- Setup keeps changes that a person makes at the same time to bytes,
  permissions, or ownership. It reports any restore that it cannot confirm.
- Recovery after the process stops abruptly between separate file writes is not
  yet verified.

The extension registers every Trajectory tool itself, so setup does not
register Trajectory as an MCP server. Earlier versions of setup added a
`trajectory` server to `~/.pi/agent/mcp.json`, which gave Pi a second copy of
each tool through `pi-mcp-adapter`. After setup selects the capture
generation, it removes that server and keeps every other server.

- If setup cannot remove it, for example because `mcp.json` is read-only or
  not valid JSON, capture still works. Setup shows a warning.
- Setup does not read an `mcp.json` that never names `trajectory`.
- Until the final activation check succeeds, settings, package selection, and
  the MCP removal share one rollback.
- Rollback restores existing files or removes new ones through the directory
  handles that setup holds. This includes MCP symlink targets that the user
  manages.
- Rollback keeps concurrent user edits. It reports any restore that it cannot
  confirm.

### Ownership and Permissions

- Updates and rollback keep each file's permissions and its Unix user and
  group owner. A file with mode `0600` keeps that mode and stays private to
  its owner.
- New registration files take the owner of their parent directory.
- When an administrator runs setup for another user, that user stays the owner
  of their Pi settings, MCP, and `package.json` files. The user can still read
  them, including files with mode `0600`.
- If setup cannot keep a file's owner, capture registration stops before it
  replaces the file. Setup asks the operator to run setup as the target user.
- On Windows, updates also refuse to replace a file that another user owns.
  They do not request extra privileges.
- Keeping custom ACLs and extended attributes is not yet verified.

### Manual Install

Copy this folder into your Pi extensions directory. For example:

```bash
mkdir -p ~/.pi/agent/extensions
cp -R /path/to/trajectory/plugin/trajectory-pi ~/.pi/agent/extensions/trajectory
```

The package manifest declares the Pi extension entrypoint:

```json
{
  "pi": {
    "extensions": ["./index.ts"]
  }
}
```

Pi discovers the extension from
`~/.pi/agent/extensions/trajectory/package.json`. You do not need to add
`index.ts` to `~/.pi/agent/settings.json`. The root `index.ts` in the manual
copy is a shim that re-exports `./src/index.ts`. It serves Pi versions or
workflows that scan for package-root extension entrypoints.

## How Capture Works

Current Pi reports fork and new-session transitions through `session_start`.

- The extension sends every captured Pi event, one at a time, through
  `trajectory capture-hook --client pi`.
- If an old capture server resets while it shuts down, the helper retries
  safely with the same delivery ID.
- If no capture server is running, for example after an update or after it
  stopped while Pi was idle, the helper records the event locally. It also
  starts the server in the background, so the next event reaches it.
- The extension combines low-level `agent_end` retries through
  `agent_settled`.
- The shared queue keeps `SessionEnd` behind every admitted event for the
  session.
- Older Pi releases have no `agent_settled`. For them, the next user prompt
  finalizes the previous `agent_end`. Session shutdown finalizes the last one.
- Once Pi calls `agent_settled`, each `AgentMessage` carries
  `settles_on_agent_settled`, and serve settles coding-agent activity at
  `TurnEnd`. An unmarked final assistant message settles activity instead, so
  older Pi releases do not stay working until the next prompt.
- The extension records the exact provider session and parent IDs when the new
  header confirms the provider's previous-session file.

When Pi shuts down, the extension briefly drains the capture queue if the
queue is already almost idle. If a helper is still running, the extension
hands every incomplete admitted event to one detached batch. The batch keeps
the event order and the same delivery IDs. The server can then drop duplicate
retries, and the client does not wait for helper or server timeouts.

OhMyPi uses a different CLI, configuration root, extension manifest, and
package namespace. This Pi extension is not an OhMyPi live-capture package.

### Session Start and Enrichment

- Session-start callbacks fix the provider identity. They queue the
  transcript-header read and the extension-inventory read along with capture.
- Optional filesystem reads run in one supervised Node child process, outside
  the Pi process. Extension instances share this child.
- The child has a 1500 ms deadline and limits on its input and output.
- Shutdown stops the child process and its pipes. The child keeps its permit
  until the process closes, so an uncooperative worker cannot be replaced
  again and again.
- If the helper runtime is unsupported, the extension keeps the base event and
  reports an enrichment failure.
- Callbacks do not wait on filesystem metadata. A failed read keeps the
  admitted base identity.
- A shutdown handoff, which has a time limit, can carry that base event before
  enrichment finishes. Late enrichment cannot change or resend work that was
  already handed off.

### Shutdown Handoff

A pipe write alone does not confirm that the batch was spooled.

- The first helper returns failure if its batch deadline expires before the
  handoff. A detached worker still stops optional work silently.
- The helper must exit successfully within the 100 ms client wait to report a
  confirmed handoff.
- If that wait expires, the outcome is unknown. Admitted events stay in their
  original queue with the same delivery IDs.
- At that limit, the extension closes an unfinished pipe write, so the write
  cannot keep Pi running. The delayed reader can still read a batch that was
  fully written. The expired wait does not kill that reader.
- While Pi is running, the batch helper keeps the usual 1500 ms helper
  deadline.
- A Go worker that detached successfully owns its own processing deadline,
  which is finite.
- Receipt acceptance is a later check for each event. It is separate from
  spooling.
- Failed or unknown handoffs increase the local queue failure count.
- Pending work admitted after the batch snapshot stays in the queue.

If Pi exits before the fallback finishes, reconcile against the provider's
session source. Check activity separately. The local failure count is not an
exported health signal.

The plugin leaves out parent facts that it could not confirm. Source
reconciliation can fill them in later. The plugin never infers them.

### Inventory Limits

- Inventory scans at most 128 entries. It reads at most 64 KiB from each
  package file.
- Inventory uses at most 128 read operations. This limit handles filesystems
  that return data in small pieces.
- On Unix, metadata readers reject final-component symlinks and non-regular
  files. They open files without waiting on a FIFO.
- Optional capture callbacks catch preparation exceptions. They record a
  capped failure count in the local queue snapshot.
- Explicit privacy and query tools keep their own outcomes. The failure count
  is not an exported health contract.

## Uninstall

Run `trajectory uninstrument pi`. The command removes the Trajectory Pi
extension and any MCP entry that an earlier setup added. It keeps unrelated Pi settings, extensions, and MCP
servers. You can run the command again safely.

## Tools

The extension registers `trajectory_status`, `trajectory_incognito`,
`trajectory_schema`, `trajectory_query`, `trajectory_search`, and
`get_session_trajectory`.

`trajectory_incognito` turns incognito on for the current Pi session. It can
also save the setting for all of the user's sessions. It refuses to turn
incognito off: only the user can, by typing `/incognito off`, or
`/incognito off all` for every session. While incognito
is on, Trajectory sends no trace or log content to Datadog destinations, except
exempt ones. Trajectory still records events locally to JSONL. It still sends
accounting and activity metrics, without model and repository names by
default.

Sometimes the extension cannot reach Trajectory serve. Then turning incognito
on for the session writes a local marker file, `state/incognito-<session-id>`,
under the Trajectory home. Saving the setting for all sessions runs the
installed Trajectory binary instead.

`trajectory_schema`, `trajectory_query`, `trajectory_search`, and
`get_session_trajectory` call the tool of the same name on one `trajectory mcp`
process from the bundled binary. Pi gets the same results as every other
client, with no `sqlite3` command needed. The process starts on the first call
and stays up between calls, so raw session pages can follow their cursor. A
timeout, a canceled call, or Pi shutting down stops it, and an idle process
never keeps Pi running. The process uses the
Trajectory home that the extension read when it loaded, so it reads
`trajectories/cache/trajectory.db` under that home. `TRAJECTORY_ROOT` and
`TRAJECTORY_CACHE_DB` change the database as they do for the binary.

`trajectory_search` searches past tool calls and turns. Use
`target=tool_calls` for literal substrings such as paths and IDs. Use
`target=turns` for prose. If the tool-call index is being built, retry after
the build finishes.

`get_session_trajectory` returns one session as a summary, as detailed turns,
or as raw events. Large results come back in pages.

### Extension child-launch evidence

An extension that launches a child can report each accepted launch through
Pi's shared event bus. Trajectory does not infer launches from a tool name or
from a child session's parent link.

```typescript
pi.events.emit("trajectory:subagent", {
  contract_version: 1,
  parent_session_id: parentSessionId,
  parent_turn_id: parentTurnId,
  timestamp: acceptedAtUnixMilliseconds,
  accepted: true,
  child_session_id: childSessionId,
  tool_use_id: launchCallId,
});
```

- All identities must come from the accepted operation.
- Repeated reports keep the same child and call IDs. Separate launches use
  different identities.
- The adapter rejects missing identities, failed attempts, and a session that
  names itself as its parent. It also rejects reports for another active
  session.
- The capture helper forwards the original source time and parent turn to
  `/capture/pi/SubagentEvidence`.

Coverage is a separate report for each turn. Send it only from an integration
that can confirm it saw every accepted launch for that completed parent turn:

```typescript
pi.events.emit("trajectory:subagent", {
  contract_version: 1,
  kind: "coverage",
  parent_session_id: parentSessionId,
  parent_turn_id: parentTurnId,
  timestamp: completedAtUnixMilliseconds,
  status: "complete", // or "incomplete" / "unsupported"
});
```

- Send coverage before the turn settles. Without a coverage report, coverage
  is unknown.
- Installing this listener does not make arbitrary Pi or OhMyPi extensions
  fully supported. Trajectory still keeps positive accepted launches.
- Local materialized turns include `subagent_capture_status`, confirmed
  `subagent_invocations`, and stable launch identities. Trajectory leaves out
  `subagent_invocations` when the count is zero and coverage is unknown.
- The same adapter endpoint is available for Pi-compatible capture clients.
  Native OhMyPi extension dispatch has not been validated against this
  contract.
