# Skill Observability

Skill observability helps teams that maintain coding-agent skills. It shows
where each skill is used and how often agents invoke it. It also shows how
reliable each signal is and which tools run with the skill. Turn duration and
the cost source for the same repository and client are also available.

Trajectory builds these views from derived data only. Marker metrics and AI
Usage events do not publish prompts or assistant responses.
They also do not publish tool input or output, shell commands, diffs, file
contents, raw trace payloads, or local file paths.

## Quick Setup

For most teams, skill observability is a Datadog dashboard that you build from
the skill metrics. Trajectory does not ship one. You do not need AI Usage
events, changes to project skill files, or read virtualization to start.

1. Set up capture for Claude Code:

   ```bash
   trajectory setup --clients cc
   ```

2. Turn on metric export:

   ```bash
   trajectory config set export.metrics true
   ```

3. Send a test metric to confirm that metrics reach Datadog:

   ```bash
   trajectory doctor metrics canary
   ```

4. Start Claude Code sessions through Trajectory. This gives the best skill
   signal and tool attribution:

   ```bash
   trajectory claude
   ```

   To start the session with a prompt, put the prompt after `--`:

   ```bash
   trajectory claude -- "use the release skill to prepare the release checklist"
   ```

5. Open Datadog Metrics Explorer. Start with the `repo`, `skill_name`,
   `trajectory.client_source`, and `signal_confidence:high` tags.

## Optional Additions

Add these only when you need them:

| Need | What to do |
| --- | --- |
| Tighter tool windows for Claude | Run `trajectory claude`. Claude's native OTLP data then flows through the local `trajectory serve`. |
| Fallback hooks in user or project `.claude/skills` | Turn on `claude_skill_file_hooks`, run setup again, and sync the scope. See [skill file hooks](#claude-skill-file-hooks). |
| Skill-file experiments that change no files | Run `trajectory claude --skill-read-virtualization --skill-managed-binary -- <claude args>`. |
| AI Usage events for downstream intake | Turn on managed `required_destinations[].ai_usage`. You do not need it for metrics. |

## Questions You Can Answer

Filter the metrics by these tags: `trajectory.user`, `trajectory.client_source`,
`trajectory.client_version`, `repo`, `skill_name`, `source_scope`,
`signal_confidence`, `attribution_reason`, and `skill_attribution`. Start with
`signal_confidence:high`. Add lower confidence levels only when you look for
missing or weak signals.

| Question | Query or tags |
| --- | --- |
| Which skills are used, and where? | `sum:trajectory.turn.skill_invocations{...} by {repo,skill_name}` |
| How often is a skill invoked? | `trajectory.turn.skill_invocations`. For completed sessions, use `trajectory.session.skill_invocations.completed_count`. |
| Which signal found the skill name? | Group by `detected_from`, `source_scope`, `signal_confidence`, and `attribution_reason`. |
| How many tools did skill-assisted turns use? | `sum:trajectory.turn.skill_tool_uses.additive{...}.as_count()` by `skill_name` and `skill_attribution` |
| Which tool types and names appear? | `trajectory.turn.skill_tool_uses.additive` by `skill_name`, `tool_type`, and `tool_name` |
| How long do skill-assisted turns take? | `p95:trajectory.turn.skill_duration_ms.total{...} by {skill_name,skill_attribution}` |
| Which cost source applies? | Cost queries grouped by `trajectory.cost_source` and `trajectory.cost_role`, with the same repo and client filters. |

Cost panels give context for the same repository, client, model, and version.
They do not show how much of a turn's cost the skill caused.

To compare Claude's native cost data with Trajectory's attribution cost, keep
them in separate queries:

- Claude native data: `trajectory.cost_role:client_telemetry` and
  `trajectory.cost_source:claude_native_otlp`.
- Trajectory attribution: `trajectory.cost_role:attribution`.

## Signal Quality

All skill invocation metrics come from the `skill-invoked-turn-count` marker.
Use `trajectory.turn.skill_invocations` as the single metric for invocations.
Filter or group it by `signal_confidence` and `attribution_reason` to get the
quality your report needs.

Trajectory sends the turn metric when the turn completes. The session does not
need to end. It sends `trajectory.session.skill_invocations.completed_count`
when the session ends. If Trajectory finds an invocation only at session end,
it sends the missing turn point then, with the session total.

### Tags on invocation metrics

| Tag | Values |
| --- | --- |
| `signal_confidence` | `high`, `medium`, or `low` |
| `attribution_reason` | `native_attribution`, `explicit_skill_action`, `structured_provenance`, `prompt_activation`, `skill_file_observation`, or `unclassified` |
| `source_scope` | Where the skill came from, such as `user`, `project`, or `global` |
| `detected_from` | The signal that found the skill. See the next table. |

Common `detected_from` values:

| Value | Meaning |
| --- | --- |
| `claude_native_transcript` | The Claude transcript field `message.attributionSkill` named the skill. |
| `claude_native_otel` | Claude native OTLP sent a `skill_activated` log through Trajectory. |
| `pi_skill_prompt` | Pi's skill activation wrapper named the skill and its source path. |
| `provenance` or `skill_prompt` | Trajectory found the skill in local capture or in skill metadata. |

Current versions send lower-confidence skill signals in the invocation
metrics, with a confidence tag.

## Tool and Duration Attribution

Tool and duration metrics carry a `skill_attribution` tag. It tells you where
Trajectory got the tool window for the skill:

| Value | Meaning |
| --- | --- |
| `span_tool_attribute` | A native Claude tool span carried the skill name. |
| `span_temporal` | Trajectory matched one high-confidence skill signal to native tool spans in the same turn, by time. |
| `turn_assisted` | No native trace window was available. Trajectory counted all non-skill tools in the same turn. |

For a tighter estimate of skill complexity, use `span_tool_attribute` and
`span_temporal`. Use `turn_assisted` for broad trends, and for clients or
sessions without native skill spans.

## Claude Code Setup Details

### Transcript attribution

Normal setup reads skill activation from Claude transcripts when Claude writes
`message.attributionSkill`. This gives invocation counts by repository,
confidence breakdowns, and `turn_assisted` tool metrics. Setup is the same as
in [Quick Setup](#quick-setup).

### Native trace windows

To get tool windows from Claude's native traces, run Claude through
`trajectory claude`. Trajectory then routes Claude's native OTLP data:

```bash
trajectory claude
```

To start the session with a prompt, put the prompt after `--`:

```bash
trajectory claude -- "work on the release checklist"
```

### Claude skill file hooks

Skill file hooks are off by default because they write hook metadata into
your real `SKILL.md` files. You can undo these changes with `restore`. Normal
setup and removal of the Claude integration never edit these files.

1. Turn on the feature:

   ```bash
   trajectory config features enable claude_skill_file_hooks
   ```

2. Refresh the Trajectory plugin. Setup does not change your Claude settings:

   ```bash
   trajectory setup --clients cc
   ```

3. In a running Claude session, run `/reload-plugins` to load the new plugin
   version.
4. Sync the user skills:

   ```bash
   trajectory claude skills sync --user
   ```

5. Project skills need the project opt-in. Set
   `TRAJECTORY_CLAUDE_SKILLS_PROJECT=1`, or create
   `.trajectory/claude-skills-project-enabled` in the repository:

   ```bash
   TRAJECTORY_CLAUDE_SKILLS_PROJECT=1 trajectory claude skills sync --project
   ```

6. List the skill files that Trajectory instruments, with the status of each:

   ```bash
   trajectory claude skills status
   ```

7. Restore the files whose sync is no longer active:

   ```bash
   trajectory claude skills restore --stale
   ```

`trajectory claude skills restore` removes the hook entries that Trajectory
added. It keeps other frontmatter and your own edits.

### Read virtualization

On supported macOS launch chains, Trajectory can serve modified `SKILL.md`
content without changing the files. It launches a managed copy of Claude:

```bash
trajectory claude --skill-read-virtualization --skill-managed-binary -- <claude args>
```

Use read virtualization for clean experiments, or to avoid long-lasting edits
to project files. Transcript attribution does not need it.

## AI Usage Events

A managed Datadog destination can also send AI Usage events. Turn them on in
`required_destinations`:

```yaml
required_destinations:
  - name: aiusage-events
    type: datadog_agentless
    site: datadoghq.com
    ml_app: coding-agents
    api_key_ref: dd-aiusage-api-key
    level: off
    ai_usage:
      enabled: true
      endpoint: https://eudm-intake.datadoghq.com/api/v2/aiusage
      track: aiusage
```

To send the events through the local Datadog Agent, set
`type: datadog_agent`. The Agent's `evp_proxy` adds the API key and the site.
`ai_usage.subdomain` sets the intake subdomain for both transports. Its
default is `eudm-intake`.

AI Usage events use their own publisher, separate from logs, metrics, and
traces. Trajectory sends one `trajectory.ai_usage.skill.v1` event for each
skill-assisted turn. Each event has these fields, when they are available:

- Skill name, invocation count, and detection source.
- Repository, user, and coding-agent identity.
- Tool count, distinct tool count, tool names, and tool types.
- Turn duration and `skill_attribution`.
- Cost source fields.

Only invocations with `signal_confidence:high` create AI Usage events. Medium
and low invocations still appear in the invocation metric.

A project `publish.trajectory.yaml` file cannot turn on AI Usage events.
Datadog can accept an event and still drop it. This happens when the event's
`hostname` is not a known host in the target organization. Before you rely on
the events, confirm that they appear in Datadog.

## Troubleshooting

**Your dashboard has no skill data.** Check that metrics are publishing.

1. Check the metrics for your latest session:

   ```bash
   trajectory doctor metrics session --latest
   ```

2. Send a test metric to confirm that metrics reach Datadog:

   ```bash
   trajectory doctor metrics canary
   ```

3. Show whether the current config is expected to publish metrics:

   ```bash
   trajectory publish status
   ```

**High-confidence invocation counts are missing.** Filter
`trajectory.turn.skill_invocations` by `signal_confidence:medium` or
`signal_confidence:low`. Then group by `attribution_reason`, `repo`,
`skill_name`, `source_scope`, and `trajectory.client_version`. This shows weak
signals in the same metric.

**Claude skill invocations dropped after a Claude update.** Group
`trajectory.turn.skill_invocations` by `trajectory.client_version`,
`detected_from`, and `signal_confidence`. Fewer
`detected_from:claude_native_transcript` points can mean that Claude stopped
writing `message.attributionSkill`.

**Tool counts appear only with `skill_attribution:turn_assisted`.** Run the
session through `trajectory claude`. Confirm that Claude's native OTLP data
reaches the local `trajectory serve`. Native trace windows need that OTLP
path. The `turn_assisted` metrics do not.

**AI Usage events do not appear in Datadog.** Check the managed destination
config, the credential reference, and the endpoint. Then confirm that the
event `hostname` is a known host in your Datadog organization.
