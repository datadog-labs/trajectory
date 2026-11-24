# Skill Observability

Skill observability helps teams that maintain coding-agent skills. It shows
where skills run, how often, and how reliable each signal is. It also shows
their tools, turn duration, and cost source. It sends no raw agent content.

## Quick setup

Trajectory ships no skill dashboard, so build one from the skill metrics. AI
Usage events, skill-file hooks, and read virtualization are optional.

1. Set up Claude Code: `trajectory setup --clients cc`.
2. Turn on metrics: `trajectory config set export.metrics true`.
3. Start sessions with `trajectory claude`.
4. In Metrics Explorer, start with `repo`, `skill_name`, and
   `signal_confidence:high`.

## Requirements

- Setup turns on detailed local Claude logging, so Trajectory keeps skill
  names when Claude reports them.
- Skill names on `claude_code.tool` spans and in skill logs need
  `OTEL_LOG_TOOL_DETAILS=1`.
- Native Claude tool-span windows need Claude's OTLP data to pass through
  Trajectory. Start sessions with `trajectory claude`.

## Claude Code setup

Normal setup reads `message.attributionSkill` from Claude transcripts. That
gives invocation counts by repository and confidence, and `turn_assisted` tool
metrics. Transcript and OTLP attribution never change skill files. Normal
setup and removal never edit `SKILL.md`.

Skill-file hooks are a fallback. They write hook metadata into the
`SKILL.md` frontmatter, and they are off by default. After they are turned
on, run `trajectory setup --clients cc`, then `/reload-plugins` in Claude
Code. Then manage them with these commands:

- `trajectory claude skills sync --user` adds hooks to `~/.claude/skills`,
  under a lock.
- `trajectory claude skills sync --project` also needs
  `TRAJECTORY_CLAUDE_SKILLS_PROJECT=1` or a
  `.trajectory/claude-skills-project-enabled` file in the project.
- `trajectory claude skills status` lists the files it changed.
- `trajectory claude skills restore [--stale]` removes only Trajectory's hook
  entries. It reads `~/.trajectory/state/claude-skills/manifest.json`, and
  keeps your own edits.

On supported macOS launch chains, this experimental command serves a modified
`SKILL.md` without changing the file:

```bash
trajectory claude --skill-read-virtualization --skill-managed-binary -- <args>
```

If settings block read virtualization, use sync, status, and restore. You then
get no scoped attribution and no proof that the hooks ran.

## Attribution

Trajectory finds a skill from these signals, named in `detected_from`:

- Claude Code: the transcript's `attributionSkill`, the main signal
  (`claude_native_transcript`), or a native OTLP `skill_activated` log
  (`claude_native_otel`). Claude native data wins over generic `Skill` tool
  data.
- Codex: a `<skill>` envelope in the rollout (`codex_skill_prompt`), or an
  `exec` that reads `SKILL.md` (`codex_skill_read`). It counts once.
- cursor-agent: a read of `.cursor/skills/<name>/SKILL.md`
  (`cursor_skill_read`), which means the skill was about to run.
- Pi: the `<skill name=... location=...>` wrapper (`pi_skill_prompt`, with
  `attribution_reason:native_attribution`). Similar text elsewhere is not a
  signal.
- `provenance` or `skill_prompt`: local capture or skill metadata.

When several high-confidence sources name one skill in a turn, Trajectory sends
one invocation. A skill seen only through a direct `SKILL.md` read gives a
lower-confidence `skill-invoked` point.

## Signal quality

`trajectory.turn.skill_invocations` comes from the `skill-invoked-turn-count`
marker. It is the one invocation metric and the source of AI Usage events.
It sends at turn end, and session end sends the turn points found only then.
For a session total, sum it by `session_id`.

The metric includes every confidence level as a tag. Its tags are:

- `signal_confidence`: `high`, `medium`, or `low`.
- `source_scope`: `user`, `project`, or `global`. Without native metadata,
  Trajectory infers it from local skill files.
- `attribution_reason`: `native_attribution`, `explicit_skill_action`,
  `structured_provenance`, `prompt_activation`, `skill_file_observation`, or
  `unclassified`.
- `detected_from`, as listed above. Destination tags such as `environment`
  come from your config.

Only `signal_confidence:high` invocations feed the skill tool and duration
metrics and AI Usage events. If a skill's confidence or source changes after
sending, Trajectory sends a negative point on the old tags and a new point.
Older skill observation metrics keep their smaller tag set.

## Tool attribution

Tool counts and durations take their window from the first source available,
named in `skill_attribution`:

1. `span_tool_attribute`: the span names the skill.
2. `span_temporal`: the tool spans match the skill by time.
3. `turn_assisted`: all tools in the same turn except skill tools.

The span sources measure a skill's work more tightly. `turn_assisted` suits
broad trends and clients without native skill spans. It does not give detail
for each call.

## Queries

Filter by `trajectory.user`, `trajectory.client_source`,
`trajectory.client_version`, `repo`, `skill_name`, `source_scope`,
`signal_confidence`, `attribution_reason`, and `skill_attribution`. Start with
`signal_confidence:high`.

- Skill usage:
  `sum:trajectory.turn.skill_invocations{...} by {repo,skill_name}`. Group by
  `detected_from`, `source_scope`, `signal_confidence`, or `attribution_reason`
  to see the signal.
- Tools in skill-assisted turns:
  `sum:trajectory.turn.skill_tool_uses.additive{...}.as_count()` by
  `skill_name`, `skill_attribution`, `tool_type`, and `tool_name`.
- Duration:
  `p95:trajectory.turn.skill_duration_ms.total{...} by {skill_name,skill_attribution}`.
- Cost source: group cost queries by `trajectory.cost_source` and
  `trajectory.cost_role`. These panels show cost in the same repository,
  client, and model. They do not show the cost the skill caused.

## AI Usage events

A managed destination with `ai_usage.enabled: true` sends one
`trajectory.ai_usage.skill.v1` event for each skill-assisted turn. The event
holds the skill, count, source, repository, user, agent, tool counts,
duration, attribution, and cost source. The defaults are `track: aiusage` and
`subdomain: eudm-intake`, which send to
`https://eudm-intake.<site>/api/v2/<track>`. With `type: datadog_agent`, the
local Agent's `evp_proxy` adds the key and site.

AI Usage events have their own publisher. They turn on no spans, marker
outputs, module spans, or event streams, and metrics never need them.

## Troubleshooting

- **The dashboard is empty.** Run `trajectory publish status` and
  `trajectory doctor metrics canary --publish --readback`.
- **High-confidence counts are missing.** Filter
  `trajectory.turn.skill_invocations` by `signal_confidence:medium` or `low`,
  and group by `attribution_reason`.
- **Claude counts dropped after an update.** Group by
  `trajectory.client_version`, `detected_from`, and `signal_confidence`. Fewer
  `claude_native_transcript` points mean Claude stopped writing
  `attributionSkill`.
- **Tool counts show only `turn_assisted`.** Start sessions with
  `trajectory claude`, and check that Claude's native OTLP data reaches the
  local service.
- **AI Usage events are missing.** Datadog can accept an event and then drop
  it when its hostname is not a known host in your organization. Check that
  events appear.
