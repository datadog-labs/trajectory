---
name: incognito
description: Toggle Trajectory incognito mode for the current Kilo Code session. Use when the user says "/incognito", "go incognito", "pause capture", "stop recording", "private mode", or asks to temporarily suppress Datadog publish for sensitive work.
---

# Incognito Mode

Toggle incognito mode for the current Kilo Code session. When enabled:
- Local JSONL capture continues
- Trace and log outputs to non-exempt Datadog destinations are suppressed
- Aggregate metrics continue and cannot be disabled by incognito
- Mode resets automatically when the session ends

Org-managed security destinations configured with `incognito_exempt: true` may still receive events. Do not describe incognito as a security or compliance bypass.

## Toggle

For a durable user opt-out or opt-in, call `trajectory_incognito` with `persistent: true` and the requested `enable` value. Do not pass `session_id`.

1. Decide the requested state.
   - For `/incognito`, "go incognito", "pause capture", "stop recording", or "private mode", enable incognito.
   - For "turn off incognito", "resume capture", or "resume publish", disable incognito.
   - If the user explicitly asks to toggle, call the `trajectory_incognito` MCP tool with `enable: true` unless you have already confirmed the active session is incognito, then call it with `enable: false`.
2. If the `trajectory_incognito` MCP tool is available, call it with `enable`, `client: kilo`, and `project_dir` set to the current workspace; omit `session_id` so the tool resolves the active session from Trajectory's active-session registry.
3. If the tool reports multiple matching active sessions, call `list_active_sessions`, choose the active Kilo Code session matching the current workspace, and retry with that `session_id`.
4. Worst-case fast lookup: check `TRAJECTORY_SESSION_ID`, `CODEX_SESSION_ID`, `GEMINI_SESSION_ID`, `CLAUDE_SESSION_ID`, `KILO_SESSION_ID`, `KILOCODE_SESSION_ID`, `PI_SESSION_ID`, `DROID_SESSION_ID`, or `COPILOT_SESSION_ID`; otherwise call `list_active_sessions` or run `trajectory mcp sessions --active --json` from the workspace, select the row matching the current client/workspace with the newest `last_event`, and retry with `session_id`.
5. If MCP is not available, resolve the current session ID with `TRAJECTORY_SESSION_ID` or `trajectory mcp sessions --active --json`, then call the HTTP endpoint directly:
   `curl -fsS -X POST "http://localhost:19222/session/incognito?session_id=${session_id}&enable=${enable}"`
6. Tell the user whether incognito is now enabled or disabled.
