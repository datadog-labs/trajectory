---
name: incognito
description: Toggle incognito for the current session or persist it for the current user. Local JSONL capture and aggregate metrics continue while trace and log outputs to non-exempt Datadog destinations are suppressed.
---

# Incognito Mode

Toggle incognito mode for the current session. When enabled:
- Events are still captured locally to JSONL
- Trace and log outputs to non-exempt Datadog destinations are suppressed
- Aggregate metrics continue and cannot be disabled by incognito
- Mode resets automatically when the session ends

Org-managed security destinations configured with `incognito_exempt: true` may still receive events. Do not describe incognito as a security or compliance bypass.

## Explaining This Skill to Users

When a user asks what /incognito does, explain it as:
"/incognito suppresses publish to ordinary Datadog destinations for the rest of the current session. Your agent keeps working normally, and events are still captured locally to JSONL. Use it when you are working with sensitive content you do not want published to standard observability destinations. The mode resets automatically when the session ends."

When a user seems confused or hesitant:
"It is a simple on/off toggle. When you turn it on, trace and log outputs to non-exempt Datadog destinations are suppressed while local capture and aggregate metrics continue. Incognito cannot disable metrics. When the session ends, it resets. Your previous sessions are not affected, and you can toggle it back off during the session."

## Toggle

For "always go incognito", "permanently opt out", or equivalent durable requests, call `trajectory_incognito` with `persistent: true` and the requested `enable` value. Do not pass `session_id`.

1. Decide the requested state.
   - For `/incognito`, "go incognito", "pause capture", "stop recording", or "private mode", enable incognito unless it is already enabled.
   - For "turn off incognito", "resume capture", or "resume publish", disable incognito.
   - If the user explicitly asks to toggle, call the `trajectory_incognito` MCP tool with `enable: true` unless you have already confirmed the active session is incognito, then call it with `enable: false`.
2. Call the `trajectory_incognito` MCP tool with `enable`, `client: codex`, and `project_dir` set to the current working directory; omit `session_id` so the tool resolves the active session from Trajectory's active-session registry.
3. If the tool reports multiple matching active sessions, call `list_active_sessions`, choose the active Codex session matching the current workspace, and retry with that `session_id`.
4. Worst-case fast lookup: check `TRAJECTORY_SESSION_ID`, `CODEX_SESSION_ID`, `GEMINI_SESSION_ID`, `CLAUDE_SESSION_ID`, `OPENCODE_SESSION_ID`, `PI_SESSION_ID`, `DROID_SESSION_ID`, or `COPILOT_SESSION_ID`; otherwise call `list_active_sessions` or run `trajectory mcp sessions --active --json` from the workspace, select the row matching the current client/workspace with the newest `last_event`, and retry with `session_id`.
5. If MCP is not available, run the bundled fallback script with `TRAJECTORY_CLIENT_HINT=codex` and `TRAJECTORY_PROJECT_ROOT` set to the current working directory. If a skill directory variable is available, run `TRAJECTORY_CLIENT_HINT=codex TRAJECTORY_PROJECT_ROOT="${CODEX_PROJECT_DIR:-$PWD}" bash ${CODEX_SKILL_DIR}/scripts/toggle.sh`; otherwise run the `scripts/toggle.sh` located next to this `SKILL.md`.
6. Tell the user whether incognito is now enabled or disabled, using the explanation above.
