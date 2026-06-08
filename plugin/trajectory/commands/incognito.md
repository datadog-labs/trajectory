---
description: Toggle Trajectory incognito mode for the current Claude Code session
argument-hint: on | off | toggle
---

Use the Trajectory incognito skill for this Claude Code session.

Interpret command arguments this way:
- "off", "disable", "resume", or "resume publish" means disable incognito.
- "toggle" means invert the current state.
- Empty arguments, "on", "enable", "private", or "pause capture" means enable incognito.

Run `TRAJECTORY_CLIENT_HINT=claude-code TRAJECTORY_PROJECT_ROOT="${TRAJECTORY_PROJECT_ROOT:-$PWD}" bash ${CLAUDE_PLUGIN_ROOT}/skills/incognito/scripts/toggle.sh "$ARGUMENTS"` and report the result.
