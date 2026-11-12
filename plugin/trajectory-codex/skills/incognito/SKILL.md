---
name: incognito
description: Toggle incognito for the current session or persist it for the current user. Local JSONL capture and accounting and activity metrics continue. Trajectory stops publishing content to Datadog destinations that are not exempt, and metrics leave out model and repository names by default.
---

# Incognito Mode

Incognito stops Trajectory from publishing the current Codex session's content
to ordinary Datadog destinations. While it is on:

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

## Set Incognito for Future Sessions

For "always go incognito", "permanently opt out", or a similar lasting request:

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
     user can turn incognito off, and the tool refuses it. Run the fallback
     script in step 5 with `off`.
   - An explicit request to toggle: run the fallback script in step 5 with
     `toggle`.
2. To turn incognito on, call the `trajectory_incognito` MCP tool with `enable: true`, `client: codex`, and
   `project_dir` set to the current working directory. On this first call, omit
   `session_id`. The tool finds the active session in Trajectory's
   active-session registry.
3. If the tool cannot resolve the session for any reason, call
   `trajectory_status` and read its `active_sessions.sessions` list. If `truncated` is true, run `trajectory mcp sessions --active --json` to list every row. Use each row's `coding_agent`, `client`,
   `project_dir`, and `last_event` to find the current Codex session. Retry with
   a row's `session_id` only when a single row clearly matches. If no row, or
   more than one row, could match,
   show the complete active-session list to the user and ask them to choose. Do
   not guess.
4. For a quick lookup of the session ID, check `TRAJECTORY_SESSION_ID`,
   `CODEX_SESSION_ID`, `GEMINI_SESSION_ID`, `CLAUDE_SESSION_ID`,
   `OPENCODE_SESSION_ID`, `PI_SESSION_ID`, `DROID_SESSION_ID`, or
   `COPILOT_SESSION_ID`. If none is set, call `trajectory_status` (its `active_sessions.sessions` list) or run
   `trajectory mcp sessions --active --json` from the workspace. Pick the row
   that matches the current client and workspace and has the newest
   `last_event`, then retry with its `session_id`.
   Ordinary enable and disable requests may omit the ID, because the capture
   server falls back to its own record of the active session.
5. Use the bundled fallback script to turn incognito off or toggle it, or when
   MCP is not available. Run it with
   `TRAJECTORY_CLIENT_HINT=codex` and `TRAJECTORY_PROJECT_ROOT` set to the
   current working directory:
   - If a skill directory variable is available, run
     `TRAJECTORY_CLIENT_HINT=codex TRAJECTORY_PROJECT_ROOT="${CODEX_PROJECT_DIR:-$PWD}" bash ${CODEX_SKILL_DIR}/scripts/toggle.sh`.
   - Otherwise, run the `scripts/toggle.sh` located next to this `SKILL.md`.
6. Tell the user whether incognito is now on or off, using the explanation
   above.
