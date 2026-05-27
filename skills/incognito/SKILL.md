---
name: incognito
description: Toggle Trajectory incognito mode for the current Gemini CLI session. Use when the user says "/incognito", "go incognito", "pause capture", "stop recording", "private mode", or asks to temporarily suppress Datadog publish for sensitive work.
---

# Incognito Mode

Toggle incognito mode for the current Gemini CLI session. When enabled:
- Local JSONL capture continues
- Publish to non-exempt Datadog destinations is suppressed
- Mode resets automatically when the session ends

Org-managed security destinations configured with `incognito_exempt: true` may still receive events. Do not describe incognito as a security or compliance bypass.

## Toggle

1. Resolve the current session ID.
   - Prefer `TRAJECTORY_SESSION_ID` if it is set and not `unknown`.
   - Otherwise call the `list_active_sessions` MCP tool and choose the active Gemini session matching the current workspace. If there is exactly one active session, use it. If there are multiple plausible sessions, ask the user which one to toggle.
   - If MCP is unavailable, ask the user for the session ID or tell them how to find it with `trajectory mcp sessions --active --json`.
2. Decide the requested state.
   - For `/incognito`, "go incognito", "pause capture", "stop recording", or "private mode", enable incognito unless it is already enabled.
   - For "turn off incognito", "resume capture", or "resume publish", disable incognito.
   - If the user explicitly asks to toggle, check whether `$HOME/.trajectory/state/incognito-${session_id}` exists and invert it.
3. If the `trajectory_incognito` MCP tool is available, call it with `session_id` and `enable`.
4. If MCP is not available, call the HTTP endpoint directly:
   `curl -fsS -X POST "http://localhost:19222/session/incognito?session_id=${session_id}&enable=${enable}"`
5. Tell the user whether incognito is now enabled or disabled.
