---
name: incognito
description: Toggle incognito mode for the current session. When enabled, events are still captured locally to JSONL but publish to non-exempt Datadog destinations is suppressed. Use when working with sensitive content. This skill should be used when the user says "/incognito", "go incognito", "pause capture", "stop recording", "private mode", mentions "incognito", or wants to temporarily disable trajectory publish for the current session.
---

# Incognito Mode

Toggle incognito mode for the current session. When enabled:
- Events are still captured locally to JSONL
- Publish to non-exempt Datadog destinations is suppressed
- Mode resets automatically when the session ends

Org-managed security destinations configured with `incognito_exempt: true` may
still receive events. Incognito is not a security or compliance bypass.

## Explaining This Skill to Users

When a user asks what /incognito does, explain it as:
"/incognito suppresses publish to ordinary Datadog destinations for the rest of the current session. Your agent keeps working normally, and events are still captured locally to JSONL. Use it when you are working with sensitive content you do not want published to standard observability destinations. The mode resets automatically when the session ends."

When a user seems confused or hesitant:
"It is a simple on/off toggle. When you turn it on, publish to non-exempt Datadog destinations is suppressed while local capture continues. When the session ends, it resets. Your previous sessions are not affected, and you can toggle it back off during the session."

---

## Toggle

If the `trajectory_incognito` MCP tool is available, call it first and omit `session_id`; the tool resolves the active session from Trajectory's active-session registry. Always pass the current workspace as `project_dir` and pass a client hint:
- Claude Code: `client: claude-code`
- Codex: `client: codex`
- Other clients: use the current client name if known

For `/incognito`, "go incognito", "pause capture", "stop recording", or "private mode", call it with `enable: true`. If the user asks to disable or resume publishing, call it with `enable: false`. If they explicitly ask to toggle, check whether the resolved session is already incognito and invert it.

If the tool reports multiple matching active sessions, call `list_active_sessions`, choose the row matching the current client/workspace with the newest `last_event`, and retry with that `session_id`.

Worst-case fast lookup: check `TRAJECTORY_SESSION_ID`, `CODEX_SESSION_ID`, `GEMINI_SESSION_ID`, `CLAUDE_SESSION_ID`, `OPENCODE_SESSION_ID`, `PI_SESSION_ID`, `DROID_SESSION_ID`, or `COPILOT_SESSION_ID`; otherwise call `list_active_sessions` or run `trajectory mcp sessions --active --json` from the workspace, select the row matching the current client/workspace with the newest `last_event`, and retry with `session_id`.

If the MCP tool is not available, run the bundled fallback script with a client hint and tell the user the result. For Claude Code, run `TRAJECTORY_CLIENT_HINT=claude-code TRAJECTORY_PROJECT_ROOT="${TRAJECTORY_PROJECT_ROOT:-$PWD}" bash ${CLAUDE_SKILL_DIR}/scripts/toggle.sh`. For Codex from a repo checkout, run `TRAJECTORY_CLIENT_HINT=codex TRAJECTORY_PROJECT_ROOT="${CODEX_PROJECT_DIR:-$PWD}" bash .agents/skills/incognito/scripts/toggle.sh`. Add `off` to disable or `toggle` to explicitly invert the state.
