---
name: incognito
description: Toggle incognito for the current session or persist it for the current user. Local JSONL capture and accounting and activity metrics continue. Trajectory stops publishing content to Datadog destinations that are not exempt, and metrics leave out model and repository names by default. Use for temporary or lasting privacy requests.
---

# Incognito Mode

Incognito stops Trajectory from publishing the current session's content to
ordinary Datadog destinations. While it is on:

- Trajectory still records events locally to JSONL.
- Trace and log content is not sent to Datadog destinations, except exempt ones.
- Accounting and activity metrics are still sent. By default they leave out
  model and repository names.
- Learnings synthesis is paused.
- Session incognito turns off automatically when the session ends.

Organization-managed security destinations configured with
`incognito_exempt: true` can still receive events. Do not describe incognito as
a way to bypass security or compliance monitoring.

## Explaining This Skill to Users

When a user asks what `/incognito` does, say:

"/incognito stops Trajectory from publishing your content to ordinary Datadog destinations for the rest of this session. Your agent keeps working as usual. Events are still recorded locally to JSONL, and accounting and activity metrics are still sent, without model and repository names by default. Use it when you are working with sensitive content that you do not want sent to standard observability destinations. It turns off automatically when the session ends."

When a user seems confused or hesitant, say:

"It is an on/off switch. While it is on, trace and log content goes only to exempt Datadog destinations. Local JSONL capture and accounting and activity metrics continue. Metrics leave out model and repository names by default. A session-only switch turns off when the session ends. Your earlier sessions are not affected, and you can turn it off again during the session."

## Keep Incognito On for Future Sessions

For "always go incognito", "permanently opt out", or a similar lasting request:

- Call `trajectory_incognito` with `persistent: true` and `enable: true`.
- Do not pass `session_id`. The setting applies to all current and future
  sessions for the user.
- The tool cannot turn the lasting setting off. When the user asks to resume
  publishing for future sessions, run
  `curl -fsS -X POST --get --data-urlencode "scope=user" --data-urlencode "enable=false" --data-urlencode "source=slash_command" "http://localhost:${TRAJECTORY_PORT:-19222}/session/incognito"`.
  Trajectory serve owns this setting, so the call uses its home. If serve is
  not running, run `trajectory config publish opt-in` instead.

Trajectory stores the setting as `~/.trajectory/standard-publish.disabled`, and
the capture and publish runtime reads it in later sessions. Clearing it affects
future sessions only. A session that already saw incognito stays suppressed
until it ends. Metrics follow the same rule as session incognito: `redacted` by
default, or `standard` when configured explicitly.

## Toggle

The `trajectory_incognito` MCP tool only turns incognito on. Only the user can
turn it off. For a request to disable incognito or resume publishing, run the
fallback script below with `off`. Never call the tool with `enable: false`,
because the tool refuses it.

To turn incognito on, if the `trajectory_incognito` MCP tool is available,
call it first:

- Omit `session_id`. The tool finds the active session in Trajectory's
  active-session registry.
- Always pass the current workspace as `project_dir`.
- Pass a client hint: `client: claude-code` for Claude Code, `client: codex`
  for Codex, or the current client name, if known, for other clients.

Pass `enable: true` for `/incognito`, "go incognito", "pause capture", "stop
recording", or "private mode". For an explicit request to toggle, run the
fallback script with `toggle`.

If the tool cannot resolve the session for any reason, call
`trajectory_status` and read its `active_sessions.sessions` list. If `truncated` is true, run `trajectory mcp sessions --active --json` to list every row. Each row includes `coding_agent`, `client`,
`project_dir`, and `last_event`. Retry with a row's `session_id` only when a
single row clearly matches the current coding agent and workspace. If no row,
or more than one row, could match, ask the user to choose:
show the complete active-session list to the user. Do not guess.

For a quick lookup of the session ID, check `TRAJECTORY_SESSION_ID`,
`CODEX_SESSION_ID`, `GEMINI_SESSION_ID`, `CLAUDE_SESSION_ID`,
`OPENCODE_SESSION_ID`, `PI_SESSION_ID`, `DROID_SESSION_ID`, or
`COPILOT_SESSION_ID`. If none is set, call `trajectory_status` (its `active_sessions.sessions` list) or run
`trajectory mcp sessions --active --json` from the workspace. Pick the row that
matches the current client and workspace and has the newest `last_event`, then
retry with its `session_id`.

## Fallback Script

Use the bundled fallback script to turn incognito off or toggle it. Also use it
to turn incognito on when the MCP tool is not available. Run it with a client
hint, then tell the user the result:

- Claude Code: `TRAJECTORY_CLIENT_HINT=claude-code TRAJECTORY_PROJECT_ROOT="${TRAJECTORY_PROJECT_ROOT:-$PWD}" bash ${CLAUDE_SKILL_DIR}/scripts/toggle.sh`
- Codex from a repository checkout: `TRAJECTORY_CLIENT_HINT=codex TRAJECTORY_PROJECT_ROOT="${CODEX_PROJECT_DIR:-$PWD}" bash .agents/skills/incognito/scripts/toggle.sh`

Add `off` to disable incognito, or `toggle` to switch to the opposite state.

The script first asks the capture server to find the active session. For
ordinary enable and disable requests, never tell the user that a local session
ID is missing, because the server lookup does not need one.
