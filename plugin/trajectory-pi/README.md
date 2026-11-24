# Trajectory Pi Extension

`trajectory setup --clients pi` installs this extension from a copy built
into the Trajectory binary.
[Supported clients](../../docs/SUPPORTED-CLIENTS.md#pi) says what it
captures.

## How Setup Installs It

- Setup writes each generation of the extension to
  `~/.pi/agent/extensions/trajectory/.trajectory-bundles/<sha256>/trajectory/`.
  `package.json` selects its `index.ts`, so Pi lists it as `trajectory`. The
  next setup or update moves an older layout, named by hash, to this one.
- Each generation has its own `bin/trajectory`, up to 256 MiB. The extension
  prefers it over the binary in the Trajectory home. `TRAJECTORY_BINARY`
  overrides both.
- Setup keeps at most eight generations, one per binary, never removing the
  selected one. A copy it cannot remove still counts, and setup retries later.
- Setup leaves the `index.ts` and `src/` files that older releases wrote
  directly in `~/.pi/agent/extensions/trajectory/`.
- Setup stops, and keeps the active extension, if bundle files changed, a
  child folder is a link, or another setup is running.
- Setup keeps file modes and owners, and new files take their folder's owner.
  On Windows it never replaces another user's file. Custom ACLs are not
  verified.
- Setup edits linked settings and MCP files at their targets, keeping links
  and permissions. Recovery after an abrupt stop is not verified.

## Manual Install

Copy this folder to `~/.pi/agent/extensions/trajectory`. Its `package.json`
declares `./index.ts`, which re-exports `./src/index.ts`.

## Capture

If no capture server is running, the helper records each event locally and
starts the server in the background. If Pi exits before its shutdown handoff
finishes, compare against Pi's own session files. The local count of queue
failures is not exported.

## Tools

- The extension registers two tools: `trajectory_status` and
  `trajectory_incognito`. It keeps the list short because Pi puts every
  declared tool in each session's system prompt.
- On Pi 0.99 and later, `trajectory_status` stays out of the model's tool
  list until Pi's `tool_search` tool finds it. The extension turns
  `tool_search` on at session start, as Pi does for deferred MCP servers.
  Ruling it out with `--tools` or `--exclude-tools` still holds, and
  `trajectory_status` is then unreachable. Older Pi lists both tools.
- It does not register the tools that read past sessions:
  `trajectory_schema`, `trajectory_query`, `trajectory_search`, and
  `get_session_trajectory`. `trajectory mcp` still serves them to clients
  that load it.
- If the extension cannot reach the capture server, incognito for one session
  writes `state/incognito-<session-id>` in the Trajectory home. Incognito for
  all sessions runs the installed binary.

## Report Child Launches

A Pi extension that launches child agents reports each accepted launch with
this versioned format on Pi's event bus:

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

Report coverage for a parent turn only from an integration that can confirm
it saw every accepted launch in that turn. Send it before the turn settles.
Without a coverage report, coverage stays unknown:

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

The adapter rejects missing identities, failed attempts, self-parenting, and
reports for another session. Evidence goes to `/capture/pi/SubagentEvidence`.
Local turns then carry `subagent_capture_status`, confirmed
`subagent_invocations`, and launch identities. `subagent_invocations` is left
out when it is zero and coverage is unknown.
