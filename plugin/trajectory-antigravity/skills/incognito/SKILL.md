---
name: incognito
description: Toggle Trajectory incognito mode for the current Antigravity CLI session. Use when the user says "/incognito", "go incognito", "pause capture", "stop recording", "private mode", or asks to temporarily stop publishing content during sensitive work while metrics continue without model and repository names.
---

# Incognito Mode

Incognito stops Trajectory from publishing the current Antigravity CLI session's
content to ordinary Datadog destinations. While it is on:

- Trajectory still records events locally to JSONL.
- Trace and log content is not sent to Datadog destinations, except exempt ones.
- Accounting and activity metrics are still sent. By default they leave out
  model and repository names.
- Session incognito turns off automatically when the session ends.

Organization-managed security destinations configured with
`incognito_exempt: true` can still receive events. Do not describe incognito as
a way to bypass security or compliance monitoring.

## Set Incognito for Future Sessions

For a lasting opt-out or opt-in request:

- Call `trajectory_incognito` with `persistent: true` and `enable: true`.
- The tool cannot turn the lasting setting off. When the user asks to resume
  publishing for future sessions, run
  `curl -fsS -X POST --get --data-urlencode "scope=user" --data-urlencode "enable=false" --data-urlencode "source=slash_command" "http://localhost:${TRAJECTORY_PORT:-19222}/session/incognito"`.
  Trajectory serve owns this setting, so the call uses its home. If serve is
  not running, run `trajectory config publish opt-in` instead.
- Do not pass `session_id`. The setting applies to all current and future
  sessions for the user.

Metrics follow the same rule as session incognito: `redacted` by default, or
`standard` when configured explicitly.

## Toggle

1. Choose the requested state:
   - `/incognito`, "go incognito", "pause capture", "stop recording", or
     "private mode": enable incognito (`enable: true`), unless it is already on.
   - "turn off incognito", "resume capture", or "resume publish": only the
     user can turn incognito off, and the tool refuses it. Use step 5 with
     `enable=false`.
   - An explicit request to toggle: if you have already confirmed that the
     active session is incognito, use step 5 with
     `enable=false`. Otherwise call the `trajectory_incognito` MCP tool with
     `enable: true`.
2. If the `trajectory_incognito` MCP tool is available, call it with `enable: true`,
   `client: agy`, and `project_dir` set to the current workspace. On this first
   call, omit `session_id`. The tool finds the active session in Trajectory's
   active-session registry.
3. If the tool cannot resolve the session for any reason, call
   `trajectory_status` and read its `active_sessions.sessions` list. If `truncated` is true, run `trajectory mcp sessions --active --json` to list every row. Use each row's `coding_agent`, `client`,
   `project_dir`, and `last_event` to find the current Antigravity session.
   Retry with a row's `session_id` only when a single row clearly matches. If no
   row, or more than one row, could match,
   show the complete active-session list to the user and ask them to choose. Do
   not guess.
4. For a quick lookup of the session ID, check `TRAJECTORY_SESSION_ID`,
   `AGY_SESSION_ID`, `ANTIGRAVITY_SESSION_ID`, `CODEX_SESSION_ID`,
   `GEMINI_SESSION_ID`, `CLAUDE_SESSION_ID`, `OPENCODE_SESSION_ID`,
   `PI_SESSION_ID`, `DROID_SESSION_ID`, or `COPILOT_SESSION_ID`. If none is set,
   call `trajectory_status` (its `active_sessions.sessions` list) or run `trajectory mcp sessions --active --json`
   from the workspace. Pick the row that matches the current client and
   workspace and has the newest `last_event`, then retry with its `session_id`.
5. To turn incognito off, or if MCP is not available, call the HTTP endpoint. Add
   `--data-urlencode "session_id=<session_id>"` when you selected a session
   in step 3 or 4. Otherwise the
   capture server finds the active Antigravity session:
   `curl -fsS -X POST --get --data-urlencode "client=agy" --data-urlencode "project_dir=${PWD}" --data-urlencode "enable=${enable}" --data-urlencode "source=slash_command" "http://localhost:${TRAJECTORY_PORT:-19222}/session/incognito"`
6. Tell the user whether incognito is now on or off.
