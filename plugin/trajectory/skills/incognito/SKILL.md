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

---

## Toggle

If the `trajectory_incognito` MCP tool is available, use it with the current session ID and `enable: true`, then tell the user the result. If the user asks to disable or resume publishing, call `trajectory_incognito` with `enable: false`.

If the MCP tool is not available, run `bash ${CLAUDE_SKILL_DIR}/scripts/toggle.sh` and tell the user the result. If the user asks to disable or resume publishing, run `bash ${CLAUDE_SKILL_DIR}/scripts/toggle.sh off`; if they explicitly ask to toggle, run `bash ${CLAUDE_SKILL_DIR}/scripts/toggle.sh toggle`.
