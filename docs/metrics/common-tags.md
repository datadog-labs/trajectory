## Common Tags

The publish engine adds the tags below when the metric family and the source
data support them. Session-scoped and user-scoped metrics use the fallback
values in the table. Process-level and direct operational metrics can leave
out identity tags.

For the tags on Datadog LLM Observability spans, see
[LLM-OBS-SPAN-TAGS.md](../LLM-OBS-SPAN-TAGS.md).

| Tag | Meaning | Fallback |
|---|---|---|
| `gen_ai.conversation.id` | Session ID | `unknown` |
| `session_id` | Session ID, kept for compatibility | `unknown` |
| `trajectory.client_source` | Client, such as `claude-code`, `codex`, `gemini`, `agy`, `goose`, `cursor`, `pi`, or `opencode` | `unknown` |
| `trajectory.user` | Resolved user | `unknown` |
| `trajectory.user_email` | Resolved user email. It comes from `TRAJECTORY_USER_EMAIL`, `identity.user_email`, `identity.user_email_command`, or `identity.user_email_suffix`. | Omitted |
| `git.email` | Resolved Git email. It comes from `TRAJECTORY_GITHUB_EMAIL`, `identity.github_email`, `identity.github_email_command`, the repository Git config, or the global Git config. | Omitted |
| `github.username` | Resolved GitHub username. It comes from `TRAJECTORY_GITHUB_USERNAME`, `identity.github_username`, `identity.github_username_command`, the repository Git config, or the global Git config. | Omitted |
| `trajectory.version` | Trajectory binary version | `dev` |
| `host` | Local hostname | `unknown` |
| `os.type` | Operating system family | The runtime OS |
| `os.version` | Operating system version, when available | Omitted |
| `ml_app` | ML app of the destination | Omitted |
| `gen_ai.request.model` | Model name | Omitted |
| `gen_ai.request.reasoning_effort` | Reasoning effort that the provider selected, on completed-turn metrics. Trajectory normalizes it from Codex `effort`, Claude Code `effort`, OpenCode `variant`, or the Cursor effort setting or model-name suffix. | Omitted when the provider record does not include it |
| `trajectory.client_version` | Client or harness version, from capture or cache | Omitted when not known |
| `trajectory.app_version` | Marketing version of the outer desktop application, from capture or cache | Omitted for sessions outside a desktop app, or when not resolved |
| `trajectory.turn_id` | Turn ID on turn-scoped metrics. Normally it is unique for each turn in a session, including turns rebuilt from queued Claude prompts. It keeps two turns that end in the same second as separate Datadog points. | Omitted when Trajectory cannot resolve the turn |
| `project_dir` | Base name of the project directory | Omitted |
| `repo` | Git repository name from the selected remote. If there is no usable remote, Trajectory uses the base name of the project directory. | `unknown` when the project directory is not known |
| `owner` | Git repository owner from the selected remote | `unknown` when there is no usable remote |
| `git_remote_host` | Host of the selected Git remote. For an SSH alias, Trajectory uses the `HostName` from the user's OpenSSH config. | `unknown` when there is no usable remote |
| `trajectory.repo_source` | Where `repo`, `owner`, and `git_remote_host` came from: `git_origin`, `git_remote`, `git_origin_unparsed`, `project_dir`, `configured`, or `unknown` | `unknown` |
| `trajectory.trace_type` | Grain of the metric: `turn`, `session`, `task`, `oversight`, `commit`, `pr`, or `serve` | Set by the code that sends the metric |
| `trajectory.metric_lifecycle` | Lifecycle in the metric catalog: `current`, `deprecated`, `legacy`, `debug`, or `unknown` | Set by the metric catalog |
| `trajectory.metric_provenance` | Where the data came from, such as `captured_session`, `activity_classifier`, `context_budget_estimator`, `waste_evaluator`, `skill_attribution`, `marker_evaluation`, `repository_metadata`, `serve_process`, or `instrumentation_health` | Set by the metric catalog |
| `trajectory.metric_signal` | Intended use, such as `authoritative_usage`, `derived_behavior`, `operational`, `diagnostic`, or `investigate` | Set by the metric catalog |
| `trajectory.metric_family` | Catalog family of a current built-in metric | Omitted when the lifecycle is `deprecated`, `legacy`, `debug`, or `unknown` |

### Security event logs

In managed installations, security event logs carry the same metadata in
`trajectory_metadata`.
They also put the exact operating system hostname in the top-level Datadog
`host` attribute, so you can match them with other endpoint logs. Each key also
carries its source, confidence, and attestation. For details, run
`trajectory user-guide security-event-stream`.

### Git remote hosts

Trajectory treats public `*.github.com` transport aliases as GitHub. It does
not look them up in the SSH config. For other SSH aliases, Trajectory reads
only the `Host`, `HostName`, and `Include` lines in the OpenSSH config. It
follows `Include` only to files inside `~/.ssh`, and it reads a limited number
of files and bytes. It does not run
`ssh -G`, evaluate `Match exec`, or make network lookups. If a mapping is
malformed, conditional only, missing, or unknown, the host stays unresolved.

### Custom tags

Trajectory adds the top-level `tags:` from your config to the Datadog metric
series that it publishes to DD LLM Obs destinations. This includes base,
marker, heartbeat, and task metrics. Trajectory merges user and managed tag
maps. If both set the same key, the managed `config.defaults.yaml` value wins.

Trajectory does not add these tags to:

- local JSONL files
- OTLP exports
- Claude native OTLP proxy metrics
- process-level health and privacy counters

Some publish paths also add destination tags and marker dimensions. Keep custom
tags low in cardinality, and never put sensitive data in them.

### Marker dimensions

Marker dimensions add tags. They cannot replace the standard tags for session,
user, client, model, host, operating system, project, turn, or trace scope.
One exception applies. The built-in PR association marker metrics may set
`owner` and `repo` to the associated change. That change can be in a different
repository from the captured session. All other marker metrics keep the
repository that the session reported.

### Retired CODEOWNERS Attribution Tags

Trajectory no longer links work to CODEOWNERS. Base metrics and LLM
Observability turn root spans no longer carry these tags:

- `trajectory.codeowner`
- `trajectory.codeowner_scope`
- `trajectory.codeowner_source`
- `trajectory.codeowner_status`
- `trajectory.codeowner_truncated`

Root spans also no longer carry the `trajectory.codeowner_*` count fields in
their metadata.

### Cost Overlap Tags

Trajectory cost metrics carry tags that help dashboards avoid counting the
same spend twice. Without them, you could add Trajectory's attributed cost to
cost from the provider, a gateway, cloud billing, or the client's own
telemetry. The tags classify the route only. They never contain URLs,
headers, credentials, helper commands, account IDs, or org IDs.

| Tag | Values |
|---|---|
| `trajectory.provider` | `anthropic`, or `openai` for a Codex session Trajectory launched through its AI gateway or Frontier |
| `trajectory.provider_route` | `direct`, `llm_gateway`, `bedrock`, `vertex`, `foundry`, `unknown`, `mixed` |
| `trajectory.provider_cost_visibility` | `anthropic_api`, `gateway_aggregate`, `cloud_provider_billing`, `unknown`, `mixed` |
| `trajectory.cost_overlap_risk` | `possible`, `aggregate_only`, `unknown`, `mixed` |
| `trajectory.cost_overlap_signal` | `trajectory_launch`, `session_env`, `claude_settings`, `none`, `mixed` |
| `trajectory.cost_role` | `attribution`, `client_telemetry` |
| `trajectory.cost_contract` | `v2` on live Trajectory cost points that meet the current usage checks. Generic historical replay does not send the live cost metrics. |
| `trajectory.cost_dedupe_group` | A provider and route group, such as `anthropic:direct`, `anthropic:llm_gateway`, or `anthropic:mixed` |
| `trajectory.cost_dedupe_confidence` | `high`, `medium`, `low`, `mixed` |
| `trajectory.cost_source` | The source of the cost, for metrics that can overlap. Trajectory's turn-based attribution uses `turn_metrics`. Claude Code's native telemetry, forwarded by Trajectory, uses `claude_native_otlp`. |
| `trajectory.cost_status` | `priced`, `unpriced`, `unavailable`, `invalid`, or `other` |
| `trajectory.cost_reason` | Why a cost could not be attributed, such as `model_missing`, `model_mismatch`, `rate_missing`, `pricing_source_unavailable`, or `other`. Left out when no reason applies. |
| `trajectory.pricing_source` | `provider_reported`, `organization_rate_card`, `local_rate_card`, `public_rate_card`, `client_telemetry`, `turn_attributions`, `request_attributions`, or `other` |
| `trajectory.cost_method` | `provider_reported`, `four_component_token_rate_card`, `token_rate_card`, `request_rate`, `credit_rate`, `sum_of_turn_attributions`, `sum_request_attributions`, or `other` |
| `trajectory.cost_fidelity` | `native`, `token_derived`, `proxy`, `unpriced`, `aggregate`, or `other` |
| `trajectory.cost_basis` | `gross_model_cost`, `usage_economic_cost`, `provider_rated_usage`, `amortized_seat`, or `other` |
| `trajectory.pricing_unit` | `provider_amount`, `tokens`, `requests`, `credits`, or `other` |
| `trajectory.pricing_version` | A shipped version from the allowed list, a combined version, or `custom` for organization and local rate cards. Events and spans keep the full custom version. |
| `trajectory.cost_component` | `captured_call` on the token and cost points of a captured model call the turn's transcript does not count, such as Claude Code's session title generation. Absent on every other point. |

#### Which metrics carry the tags

Trajectory adds the tags to these cost metrics:

- `trajectory.turn.cost.usd.additive`
- `trajectory.turn.web_search.cost.usd.additive`
- `trajectory.session.cost.usd.accumulated`
- `trajectory.session.web_search.cost.usd.accumulated`

The optional distributions `trajectory.turn.cost.usd.total` and
`trajectory.session.cost.usd.total` carry the same tags, for percentiles. The
settings `metric_samples_turn_cost` and `metric_samples_session_cost` control
them. For totals, use the additive and accumulated metrics.

The PR-work cost metric `trajectory.pr.work.cost.usd.additive` also gets
`trajectory.cost_role:attribution` and `trajectory.cost_source:turn_metrics`.
It shows the same turn cost again, grouped by PR. It is not extra spend. The
process-cost metric `trajectory.serve.llm_capacity.cost.usd.total` does not
use `turn_metrics`.

Trajectory can forward Claude Code's native OTLP metrics. When it adds tags
to them, it uses `trajectory.cost_role:client_telemetry` and
`trajectory.cost_source:claude_native_otlp`. Trajectory's turn-based cost
metrics use `trajectory.cost_role:attribution` and
`trajectory.cost_source:turn_metrics`.

#### Local UI cost fields

Local UI (Lapdog) spans also carry two more fields:

- `trajectory.cost_state` is `available`, `partial`, or `unavailable`.
- `trajectory.cost_reason_category` gives a short category for the reason.

Span metadata keeps the full reasons, rate card IDs, catalog state, and
severity. These are not metric tags. Unavailable cost never sends a dollar
value. A cost that was priced at zero is still sent as zero.

#### Querying cost totals

- `trajectory.cost_dedupe_group` is a small set of provider and route groups.
  It does not identify a request or an event.
- `trajectory.cost_dedupe_confidence` says how sure Trajectory is about the
  route. It does not say how well two records match.
- For spend totals, require `trajectory.cost_contract:v2`.
- Points without `trajectory.cost_contract:v2` are older history that
  Trajectory did not check. You can query them to investigate. Do not add
  them to a v2 total.
- Older points, and payloads queued before the tag existed, may not have
  `trajectory.cost_source`. Adding the tag creates a new metric series. Show
  those points as uncategorized. Do not guess their source in the query.

#### Backfill and replay

Generic historical backfill sends no Trajectory token or live cost
attribution metrics. Replay of provider history that is not approved also
sends none. Both can still save local sessions and send traces and session
data that qualify. They can also send operational metrics that are not used
for attribution.

By default, `trajectory publish metrics audit` shows a local preview only.
Managed backfill reconciliation sends these live metric names again, with
their original timestamps. Older points already in Datadog stay outside v2.
Trajectory does not rewrite them.

#### How Trajectory avoids sending cost twice

Trajectory gives each additive v2 cost point an ID based on its turn or
session. The ID does not include the send time, the destination display
name, or the metrics transport.

- Trajectory skips a repeat of the same point, also across restarts and
  configuration changes.
- If an existing ID comes back with a different value, Trajectory rejects it.
- After an HTTP send starts, Trajectory retries only an HTTP 429 reply.
- A network error, timeout, 5xx reply, crash, or unclear local record after
  the send started ends as `ambiguous_delivery`. Trajectory does not retry it,
  so it cannot send a second additive point.

This stops Trajectory from sending its own cost twice. It does not remove
overlap with provider cost or native client cost.

Return to the [Metrics Reference index](../METRICS-REFERENCE.md).
