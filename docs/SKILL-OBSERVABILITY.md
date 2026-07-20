# Skill Observability

Skill observability is the privacy-preserving view for teams that maintain
coding-agent skills. It answers where a skill is used, how often it is invoked,
how trustworthy the signal is, what tool mix appears around the skill, how long
skill-assisted turns take, and which cost source applies to the same repo and
client scope.

It is intentionally derived telemetry. The dashboard and marker metrics do not
publish prompts, assistant responses, tool input or output, shell commands,
diffs, file contents, raw trace payloads, or local file paths.

## Quick Setup

For most teams, skill observability is a metrics dashboard. You do not need
project skill mutation or read virtualization to start.

1. Enable normal Trajectory capture and metrics:

```bash
trajectory setup --clients cc
trajectory config set export.metrics true
trajectory metrics verify
```

2. For Claude Code, launch sessions through Trajectory when you want the best
   skill signal and native tool-window attribution:

```bash
trajectory claude
trajectory claude -- "use the release skill to prepare the release checklist"
```

3. Export and import the skill observability dashboard:

```bash
trajectory dashboard export --type skill-observability --output trajectory-skill-observability.json
```

Import `trajectory-skill-observability.json` in Datadog, then set the dashboard
variables for `repo`, `skill_name`, `trajectory.client_source`, and
`signal_confidence:high`.

4. Read the first panels this way:

| Panel | What It Tells You |
|---|---|
| Skill invocations by repo | Whether the skill is being used and where |
| Signal source and confidence | Whether the skill name came from Claude transcript, Claude native OTLP, or a weaker observation |
| Tool totals and tool mix | How complex skill-assisted turns are |
| Duration | How long skill-assisted turns typically take |
| Cost-source context | Which cost stream applies to the same repo/client slice |

This simple path is enough for the common skill-maintainer questions: which
repos use the skill, how often it is invoked, whether attribution is reliable,
which tools it tends to drive, and how slow skill-assisted turns are.

## Optional Paths

Use these only when you need the extra surface:

| Need | Add |
|---|---|
| Tighter Claude tool windows | Run Claude with `trajectory claude` so native OTLP can flow through local `trajectory serve` |
| Project `.claude/skills` fallback instrumentation | Opt in with `TRAJECTORY_CLAUDE_SKILLS_PROJECT=1 trajectory claude skills sync --project` |
| Non-mutating skill-file experiments | Use `trajectory claude --skill-read-virtualization --skill-managed-binary -- <claude args>` |

## Dashboard Import Details

Export the standalone skill-maintainer dashboard:

```bash
trajectory dashboard export --type skill-observability --output trajectory-skill-observability.json
```

Import the JSON through the Datadog UI or Dashboard API. If an agent is creating
the dashboard through Datadog MCP, export the MCP-shaped payload instead:

```bash
trajectory dashboard export --type skill-observability --format mcp --output trajectory-skill-observability-mcp.json
```

The dashboard uses variables for `trajectory.user`,
`trajectory.client_source`, `trajectory.client_version`, `repo`, `skill_name`,
`source_scope`, `signal_confidence`, and `skill_attribution`. Start with
`signal_confidence:high`, then broaden only when investigating missing or
weaker signals.

## What You Can Answer

Use these fields and metrics directly in Datadog Metrics Explorer or dashboard
panels:

| Question | Use |
|---|---|
| Which skills are used, and where? | `sum:trajectory.turn.skill_invocations{...} by {repo,skill_name}` |
| How often is a skill invoked? | `trajectory.turn.skill_invocations`; use `trajectory.session.skill_invocations.completed_count` for completed-session rollups |
| Which signal produced the skill name? | group by `detected_from`, `source_scope`, and `signal_confidence` |
| How many tools did skill-assisted turns use? | `trajectory.turn.skill_tool_uses.total` grouped by `skill_name` and `skill_attribution` |
| Which tool types and names appear? | `trajectory.turn.skill_tool_uses` grouped by `skill_name`, `tool_type`, and `tool_name` |
| How long do skill-assisted turns take? | `p95:trajectory.turn.skill_duration_ms.total{...} by {skill_name,skill_attribution}` |
| What cost source is in scope? | cost panels or queries grouped by `trajectory.cost_source` and `trajectory.cost_role` for the same repo/client filters |

Cost panels are context for the same filtered repo, client, model, and version
scope. They are not proof that every token in a turn was caused by the skill.
When comparing Claude native telemetry with Trajectory attribution cost, keep
`trajectory.cost_role:client_telemetry` plus
`trajectory.cost_source:claude_native_otlp` separate from
`trajectory.cost_role:attribution`.

## Signal Quality

Skill invocation metrics are derived from the high-confidence
`skill-invoked-turn-count` marker point. Prefer
`trajectory.turn.skill_invocations` for trusted usage reports.

Common `detected_from` values:

| Value | Meaning |
|---|---|
| `claude_native_transcript` | Claude transcript `message.attributionSkill` identified the skill |
| `claude_native_otel` | Claude native OTLP emitted a `skill_activated` log through Trajectory |
| `provenance` or `skill_prompt` | Trajectory inferred the skill from local capture or explicit skill metadata |

`source_scope` describes where the skill came from, such as `user`,
`project`, or `global`. `signal_confidence:high` means the point is suitable
for normal usage reporting. Lower-confidence breadcrumbs publish as
`trajectory.turn.skill_observations` and
`trajectory.session.skill_observations`; use them for troubleshooting, not for
primary adoption reporting.

## Tool and Duration Attribution

Tool and duration metrics carry `skill_attribution` so you can tell whether the
tool window came from native Claude trace structure or from Trajectory's
same-turn fallback:

| Value | Meaning |
|---|---|
| `span_tool_attribute` | A native Claude tool span carried the skill name |
| `span_temporal` | A single high-confidence skill signal was matched to native tool spans in the same turn by time |
| `turn_assisted` | No usable native trace window was available, so Trajectory used all non-skill tools in the same skill-assisted turn |

Use `span_tool_attribute` and `span_temporal` when you need a tighter estimate
of skill complexity. Use `turn_assisted` for broad trend analysis and for
clients or sessions that do not expose native skill spans.

## Setup Details

The baseline path is normal Trajectory capture plus metrics publishing:

```bash
trajectory setup --clients cc
trajectory config set export.metrics true
trajectory metrics verify
```

For Claude Code, normal setup can capture skill activation from Claude
transcripts when the runtime writes `message.attributionSkill`. That is enough
for repo-scoped invocation counts, signal-confidence breakdowns, and fallback
same-turn tool metrics.

Run Claude through `trajectory claude` when you want Trajectory to route Claude
native OTLP and derive native trace-backed skill tool windows:

```bash
trajectory claude
trajectory claude -- "work on the release checklist"
```

Claude skill-file instrumentation is default-off because it writes reversible
hook metadata into real `SKILL.md` files. Enable it explicitly, then run setup
to refresh an existing Trajectory plugin installation without changing Claude
settings. An active Claude session can use `/reload-plugins` to load the new
generation. Project scope also requires the project opt-in:

```bash
trajectory features enable claude_skill_file_hooks
trajectory setup --clients cc
TRAJECTORY_CLAUDE_SKILLS_PROJECT=1 trajectory claude skills sync --project
trajectory claude skills status
trajectory claude skills restore --stale
```

Normal setup and Claude integration removal never edit these files. The
explicit `trajectory claude skills restore` command removes Trajectory-owned
hook entries while preserving unrelated frontmatter and user edits.

On supported macOS launch chains, the non-mutating read-virtualization path can
serve virtualized `SKILL.md` bytes through a managed Claude launch copy:

```bash
trajectory claude --skill-read-virtualization --skill-managed-binary -- <claude args>
```

Read virtualization is useful for clean experiments and for avoiding durable
project-file edits. It is not required for the main transcript attribution path.


## Troubleshooting

If the dashboard has no skill data, first confirm metrics are publishing:

```bash
trajectory metrics session --latest
trajectory metrics verify
trajectory publish status
```

If invocation counts are missing but observations exist, filter
`trajectory.turn.skill_observations` by `repo`, `skill_name`, `source_scope`,
and `trajectory.client_version`. This usually means the client exposed a weak
skill breadcrumb but not a high-confidence activation signal.

If Claude skill invocations dropped after a runtime update, group
`trajectory.turn.skill_invocations` by `trajectory.client_version`,
`detected_from`, and `signal_confidence`. A shift away from
`detected_from:claude_native_transcript` can indicate Claude stopped writing
`message.attributionSkill`.

If tool counts are present only with `skill_attribution:turn_assisted`, run the
session through `trajectory claude` and confirm Claude native OTLP is reaching
local `trajectory serve`. Native trace-backed windows require the Claude native
OTLP path; fallback same-turn metrics do not.
