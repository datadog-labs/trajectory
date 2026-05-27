---
name: incognito
description: Toggle incognito mode for the current session. When enabled, events are still captured locally to JSONL but publish to non-exempt Datadog destinations is suppressed. Use when working with sensitive content. This skill should be used when the user says "/incognito", "go incognito", "pause capture", "stop recording", "private mode", mentions "incognito", or wants to temporarily disable trajectory publish for the current session.
---

# Incognito Mode

Toggle incognito mode for the current session. When enabled:
- Events are still captured locally to JSONL
- Publish to non-exempt Datadog destinations is suppressed
- Mode resets automatically when the session ends

Org-managed security destinations configured with `incognito_exempt: true` may still receive events. Do not describe incognito as a security or compliance bypass.

## Explaining This Skill to Users

When a user asks what /incognito does, explain it as:
"/incognito suppresses publish to ordinary Datadog destinations for the rest of the current session. Your agent keeps working normally, and events are still captured locally to JSONL. Use it when you are working with sensitive content you do not want published to standard observability destinations. The mode resets automatically when the session ends."

When a user seems confused or hesitant:
"It is a simple on/off toggle. When you turn it on, publish to non-exempt Datadog destinations is suppressed while local capture continues. When the session ends, it resets. Your previous sessions are not affected, and you can toggle it back off during the session."

## Toggle

1. Resolve the current session ID.
   - Prefer `TRAJECTORY_SESSION_ID` if it is set and not `unknown`.
   - Otherwise call the `list_active_sessions` MCP tool and choose the active Codex session matching the current workspace. If there is exactly one active session, use it. If there are multiple plausible sessions, ask the user which one to toggle.
2. Decide the requested state.
   - For `/incognito`, "go incognito", "pause capture", "stop recording", or "private mode", enable incognito unless it is already enabled.
   - For "turn off incognito", "resume capture", or "resume publish", disable incognito.
   - If the user explicitly asks to toggle, check whether `$HOME/.trajectory/state/incognito-${session_id}` exists and invert it.
3. Call the `trajectory_incognito` MCP tool with `session_id` and `enable`.
4. Tell the user whether incognito is now enabled or disabled, using the explanation above.
