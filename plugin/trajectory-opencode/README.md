# Trajectory OpenCode Plugin

`trajectory setup --clients opencode` installs this plugin from a copy built
into the Trajectory binary.
[Supported clients](../../docs/SUPPORTED-CLIENTS.md#opencode) says what it
captures.

## Manual Install

For development or recovery:

1. Copy this folder to a stable path, such as
   `~/.config/opencode/plugins/trajectory`. The config folder is
   `OPENCODE_CONFIG_DIR`, then `XDG_CONFIG_HOME/opencode`, then
   `~/.config/opencode`.
2. Add that path to the `plugin` array in `opencode.json`, or in
   `opencode.jsonc` if it exists.
3. Add the MCP entry:

```json
{
  "plugin": ["/absolute/path/to/trajectory"],
  "mcp": {
    "trajectory": {
      "type": "local",
      "command": ["/absolute/path/to/trajectory-binary", "mcp"],
      "enabled": true
    }
  }
}
```

To install the incognito skill by hand, copy
`plugin/trajectory-opencode/skills/incognito` to
`~/.config/opencode/skills/incognito`.

## OpenCode 2

Trajectory supports OpenCode 2.0.31 and later. See
[supported clients](../../docs/SUPPORTED-CLIENTS.md#opencode) for the version
rules.

### How OpenCode 2 loads the plugin

OpenCode 2 loads every plugin folder under
`<OpenCode config directory>/plugins` on its own. It needs no entry in
`opencode.json`. It loads the `server.ts` file at the root of the
`trajectory` folder, which the folder's `package.json` names as its `./server`
export. OpenCode 1.x loads the same file through that export and calls the
default export's `server`. OpenCode 2.x calls its `setup`. Keep `server.ts`
when copying the plugin for a manual install. Setup still writes the folder
into the `plugin` key for OpenCode 1.x.

Setup keeps your own entries in the `plugins` list, including objects that
have `package` and `options`. It removes only an entry that names the
Trajectory folder.

### What OpenCode 2 captures

The plugin captures accepted prompts from OpenCode's event stream. A prompt
sent while the agent is busy is captured when OpenCode delivers it to the
model, not when it is queued. A queued prompt that the user cancels is not
captured. Rejected prompts and attachment bytes are not captured. Final
assistant text and per-request usage come from completed text and model-step
events. Streaming fragments and session usage totals are not counted again.
Each request keeps the service tier the provider applied.

Compaction is a model call without step events. Its usage comes from the
compaction's ended or failed event and counts as one request in the turn. A
manual `/compact` runs as its own native execution, so its usage is recorded
in a turn with no prompt. The summary text is not captured as an assistant
message.

Unloading the plugin or deleting saved history releases capture state. These
actions do not end the native session. Native execution completion, failure,
or interruption ends the captured turn. A failed execution's `Stop` carries
its error type. An interruption or an aborted execution is not a failure.

A tool call that ends without the after-tool hook still gets one end event.
This covers interrupted calls, malformed calls, and tools the provider runs
itself. Malformed calls and provider-run tools also get a start event. Each
`subagent` call is linked to the child session OpenCode names for it,
including when several run at once.

On OpenCode 1.18.3, a failed native read does not invoke the plugin's
after-tool hook. Its failure result is absent from live capture. OpenCode
2.x captures these failures through its tool hook.

### OpenCode 2 limits

- Events missed while OpenCode 2's event subscription is down are not
  replayed. The plugin marks the turn partial.
- With several directories open in one OpenCode 2 process, each directory's
  plugin captures only its own sessions. OpenCode does not name the directory
  on every event, so the plugin asks OpenCode which directory a session is in.
  If OpenCode cannot answer, the plugin skips that event and marks the turn
  partial.
- A prompt with only attachments is captured with an empty prompt. Capture
  keeps the text and no attachment metadata.
- OpenCode 2 has no native `app.log`, so the plugin's loss diagnostics do not
  reach OpenCode's log.
- OpenCode 2 has no `chat.params` hook, so the plugin does not record the
  reasoning effort OpenCode sends. Trajectory reads the turn's variant choice
  from OpenCode's store instead. A turn with no variant chosen is recorded as
  `default`, even when OpenCode sends its own effort or the model has no
  effort setting. OpenCode 1.x records these turns with the sent effort or as
  `unsupported`.
- The plugin reports the usage of a `/compact` run. If that report is lost,
  Trajectory's fallback reads OpenCode's database but takes usage only from
  assistant messages. OpenCode 2 stores compaction as its own row, so that turn
  is recorded with no tokens or cost.

### Turn capture off on OpenCode 2

Removing the folder from `opencode.json` does not stop capture, because
OpenCode 2 finds the folder by itself. Use one of these instead:

- Run `trajectory uninstrument opencode`.
- Add `"-trajectory-opencode"` to the `plugins` list in `opencode.json`. Add
  `"-*"` to turn off every plugin.

`trajectory setup check` reports the plugin as disabled (`plugin_disabled`)
when the global OpenCode config has `-trajectory-opencode`, `-*`, or a
matching `-<prefix>.*` entry. It cannot see two other ways to turn the plugin
off:

- A disable entry in a project-level OpenCode config.
- Your organization's OpenCode policy.

### Do not install a second copy

The plugin's ID is `trajectory-opencode`. Two copies elsewhere share that ID
and can conflict, so install only one.

### When OpenCode exits or reloads the plugin

OpenCode 2 reloads a plugin when its files change, for example after a
Trajectory update. If OpenCode exits or reloads the plugin during a turn, the
plugin ends that turn with a `Stop` marked partial
(`turn_snapshot_dropped`). It sends no session end. The session closes after 2
hours without activity.

### Permission requests

OpenCode 2 permission requests are linked to their tool call. The plugin does
not forward a request's `metadata`, which can hold whole file diffs or tool
input.

### Session title usage is not captured

OpenCode 2 uses a model call to write each session's title. It reports that
call's tokens and cost only on an event that plugins do not receive. Trajectory
does not record this usage, so OpenCode 2 totals can be slightly lower than
OpenCode's own.

## Capture Failure Isolation

When capture fails, the plugin drops capture data and never changes
OpenCode's output.

- With `TRAJECTORY_HOME` set, the plugin needs no helper to find the home.
  Without it, a missing home pointer allows the normal fallback, and an
  invalid one declines capture until you repair it.
- On compiled Bun older than 1.2.16, the home pointer helper cannot start.
  Without `TRAJECTORY_HOME`, capture is declined and retried after 30 seconds.
- At shutdown, the plugin waits up to 500 ms for its queue, then drops
  pending work. Nothing is kept for recovery.
- With `app.log` available, the plugin logs
  `Trajectory optional capture diagnostics` with running totals of lost
  captures. Findings can overlap, and show local data only.
- Loss findings show no console output or popup. They leave out session IDs,
  payloads, workspace paths, and raw errors.

### Starting the capture server

If an event gets no answer because nothing listens on the capture port, the
plugin runs `trajectory serve ensure`. Then it sends the waiting events again.
