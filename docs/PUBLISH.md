# Publishing

Trajectory captures sessions on your computer. Publishing sends traces,
metrics, and logs from them to destinations. A destination is one place
Trajectory sends data: a Datadog site with an LLM Observability app, or an
OpenTelemetry collector. This page covers destinations, trace levels,
collectors, tags, delivery, and how to check publishing.

## Destinations

### One Datadog destination

For one Datadog destination, set `export.*` in `~/.trajectory/config.yaml`. You
need no publish file, backend, or transport setting.

```yaml
export:
  site: us5.datadoghq.com
  ml_app: checkout-agents
  traces: standard
  metrics: true
```

`export.site`, `export.ml_app`, `export.traces`, and `export.metrics` build one
Datadog destination named `_config_datadog`. Repository publish files can name
it. Datadog destinations send live, replayed, and backfilled traces and
metrics over agentless OTLP. `type` belongs only in `destinations:` or
`required_destinations:` entries. `export:` has no `type`.

`type` picks only the backend. `export.traces` or a destination's `level`
controls spans. `export.metrics` and a destination's metric settings control
metrics.

- `datadog_agentless` sends spans and all metrics straight to Datadog's
  agentless OTLP intakes. Trajectory handles egress and the API key.
  `otlp_traces_url` sends its spans to another OTLP endpoint. `intake_url`
  does not.
- `datadog_agent` sends LLM Observability spans through the local Datadog
  Agent's `evp_proxy`. The Agent supplies the key, site, proxy, and egress.
- `otlp` sends to a collector. See [OTLP](#otlp).

User `destinations:` accept only `type: otlp`. Datadog types go in managed
`required_destinations`, or in repository destinations for metrics only.

### Datadog Agent

Trajectory looks for the Agent at the destination's `agent_url`, then
`DD_TRACE_AGENT_URL`, then `DD_AGENT_HOST` on port 8126, then
`http://127.0.0.1:8126`. `agent_url` and `DD_TRACE_AGENT_URL` can name a Unix
socket, such as `unix:///var/run/datadog/apm.socket`. Spans go to
`<agent>/evp_proxy/v2/api/v2/llmobs`. `intake_url` sends them elsewhere, with
no key. `TRAJECTORY_INTAKE_URL` does not change this route.

### Metrics

Base metrics go to every active destination with `export.metrics: true`.
Setting it to `false` stops your own destinations. Managed required
destinations follow managed config. `export.metrics` and destination settings
control base telemetry: cost, token, turn, and session metrics. Marker metrics
also need `markers.metrics: true`. `markers.metrics: false` stops all of a
destination's turn and session metrics, cost and token included. Session
starts still send.

Destinations that share a site and `ml_app` skip duplicate metrics only with
the same `api_key_ref`. Different references count as separate organizations.
A destination with `incognito_exempt: true` never receives metrics. While
incognito is on, no destination can take the service's own metrics, so they
stop.

### Managed destinations

Administrators set `required_destinations` in managed `config.defaults.yaml`.
`trajectory config set` rejects the key, and user or repository config cannot
remove them. A required destination merges with a user destination only if
the type, site, and credential reference all match. Otherwise both send.

Only managed `required_destinations` can turn on AI Usage events, security
event streams, operational logs, module spans, and Agent Security output.

- **Module spans.** `module_spans.enabled: true` publishes module spans, such
  as AI Guard checks. It is off by default, names its modules, and removes
  duplicates. Module spans ignore the trace level and send even at `off` or
  `minimal`. They follow their own `ai_edr_disclosure_profile`. They are saved
  on your computer, one file per session, under
  `~/.trajectory/modules/by-session/`. They reach Datadog as agentless OTLP
  traces, or an `otlp` collector. `otlp_traces_url` is only for tests or
  special routing. `module_spans.native_composite_attributes` sends native
  OTLP maps and arrays instead of JSON strings. Collectors may flatten them, so
  read the data back to check.
- **Operational logs.** `operational_logs` (`enabled`, `min_level`,
  `components`, `include_session_id`) sends operational events over OTLP Logs.
  It is off by default. Turning it off keeps queued events. Destinations whose
  `components` include `trajectory.serve` also get a
  `publish.config_suppressed` warning event.

### Repository publish files

A committed `publish.trajectory.yaml` controls that repository's trusted
destinations, lower detail, tags, marker metrics, and destinations for metrics
only.

```yaml
# publish.trajectory.yaml
version: 1
destinations:
  - name: _config_datadog
    level: minimal
    markers:
      enabled: true
      metrics: true
    tags:
      team: checkout
```

Trajectory ignores repository publish files until user or managed
`publish_trust.allowed_origins` matches the repository's Git origin.
`trajectory publish validate` lists blocked files.

```yaml
publish_trust:
  allowed_origins:
    - "github.com/example-org/*"
  require_committed: true
  allowed_sites:
    - "us5.datadoghq.com"
```

- Origins match the repository's `origin` URL after your own Git
  `url.<base>.insteadOf` rules, never the repository's rules.
- Trust needs separate Git checks. A failed ownership or `safe.directory` check
  leaves the repository untrusted, and reading `.git` metadata never grants
  trust.
- An empty `allowed_sites` allows only known public Datadog sites. Your list
  replaces that default.
- With `require_committed: true`, only unchanged committed files load. Staged,
  edited, and symlinked files are ignored. A new commit applies at the next
  turn.

Trajectory walks up from the working directory and merges every
`publish.trajectory.yaml`. At turn end it also walks up from files the agent
wrote, edited, or named, adding at most 10 trusted configs per session. It
checks files at session start and on change. An ignored file stays ignored
all session. A trace destination that a repository config adds mid-session
gets the last 24 hours of turns. Incognito sessions send none. Publish files
in repositories nested in the session's repository, including submodules, are
ignored and logged. Linked worktrees are not nested.

Repository configs can do these things:

- Lower a trusted destination's level.
- Add safe tags and filters, and turn on marker metrics.
- Narrow a trusted destination with `placeholder_llm_span: false`,
  `subagent_span_mode: links_only`, or a lower `oversight_publish_mode`.
- Stop the walk with `inherit: false`, which ignores parent repository
  configs. Managed `required_destinations` still apply.
- Add Datadog destinations for metrics only: `level: off`, marker metrics on,
  and marker logs off. A higher level or marker logs are rejected. Such a
  destination may name a local `api_key_ref`. It loses endpoint overrides,
  `api_key_command`, bearer and application key references, and sites that
  are not allowed.

Repository configs cannot do these things:

- Add trace destinations or collectors.
- Raise detail or turn on options a trusted config turned off.
- Set the site, endpoint, credentials, transport, privacy, or incognito.
- Turn on security event streams, AI Usage events, or privacy exemptions.
- Create or change security destinations. Trajectory ignores such entries
  with `security_destination_override_ignored`.

An entry without `type` narrows the trusted destination it names. It never
changes the type, site, or endpoint. An unknown name reports
`project_trace_destination_rejected`. Managed or trusted destinations can set
`placeholder_llm_span: false` or `index_traces.session: true`.

### Bearer authentication

Bearer authentication is off by default for managed destinations and publish
files. Collectors in user `config.yaml` can send bearer tokens.
`bearer_token_ref` names a keychain secret, stored with
`trajectory config set-secret <name> --exact-name`. Trajectory sends it as
`Authorization: Bearer`.

- Bearer never falls back to `DD_API_KEY` or other Datadog key variables.
- A destination takes `api_key_ref` or `bearer_token_ref`, not both.
- Bearer needs HTTPS, except on loopback, and never follows redirects.
- A file that uses bearer needs `version: 2`. Repository files cannot add it,
  and managed bearer OTLP destinations are rejected.
- A managed forwarder that sends straight to Datadog uses
  `type: datadog_bearer` with `level: off`, and its real level in
  `bearer_level`. It must set the intake, OTLP trace, metrics, and logs URLs.
  Older binaries reject it.

### Where stored keys go

Stored keys go only to Datadog sites and hosts that machine policy names. See
[Configuration](CONFIGURATION.md) for the rules. For your own forwarder, use
`bearer_token_ref` with a token for that forwarder. It cannot name a Datadog
key, a managed key, or a known secret.

### Local forwarding

`export.local_forward_url`, or `trajectory setup --forward-url`, posts each
finished session to a local endpoint as NDJSON in the `session.jsonl` schema.
It needs no credentials and is best effort. A failed delivery is dropped, and
`session.jsonl` stays. An empty URL stops it.

## Trace levels

Local capture is always full. A destination's trace level controls only its
traces, never metrics.

| Level | Sends |
| --- | --- |
| `off` | No traces |
| `minimal` | Structure and metadata |
| `standard` | LLM Observability detail, without thinking text |
| `full` | All content the privacy policy allows |

`standard` and `full` spans carry content. Trace export is off by default.
Turn it on, for example with `trajectory config set export.traces full`, only
to debug or for an approved destination. Rerunning setup keeps a level other
than `off`. Interactive setup asks before it keeps `full`, and the default
answer sets `off`. Non-interactive setup warns.

For metrics without LLM Observability spans, set `export.traces: off` and
`export.metrics: true`.

Marker event logs (`markers.logs: true`) follow the destination's level.
`standard` drops thinking, reasoning, and `thought_signature`, and `full`
sends everything. Automated oversight has its own setting,
`oversight_publish_mode`, described in [Traces](TRACES.md).

## OTLP

Trajectory sends traces, metrics, and logs to any OTLP/HTTP collector, with
Datadog or alone. `trajectory user-guide otlp` prints a short guide. To add one,
put it under `destinations:` in `~/.trajectory/config.yaml`. Then run
`trajectory config reload --yes` and check `trajectory publish status`.

```yaml
destinations:
  - name: team-collector
    type: otlp
    endpoint: https://otel.security.example.com
    level: minimal
```

- Set a base `endpoint`. Trajectory adds `/v1/traces`, `/v1/metrics`, and
  `/v1/logs`. The endpoint must be `http` or `https`, with no password or query
  string.
- `name` cannot start with `_`. A collector named like a managed destination
  sends nothing, because managed `required_destinations` always apply.
- `level` defaults to `minimal`. `ml_app`, `service`, and `tags` label the
  data.
- Collectors need no Datadog API key. A setup with only collectors sends only
  there, and `trajectory publish validate` passes without a key.
- If the keychain is unreadable, the Datadog destination stays, and
  validation reports the key unavailable. `export.site: ""` removes the
  Datadog destination.
- A collector without `markers` gets session starts and cost, token, and turn
  metrics while `export.metrics` is on. `markers.enabled: false` stops them.
- `trajectory publish history` does not send to user collectors. They get
  sessions from when you add them. Datadog keys added later get new activity.
  Send past sessions with `trajectory publish history --yes`. Daily backfill
  covers only managed destinations.

`trace_shape: datadog`, the default, keeps the LLM Observability shape.
`trace_shape: conventions` follows the OpenTelemetry GenAI conventions.
Datadog destinations reject `conventions`.

OTLP compression is off by default. The `compression` setting then has no
effect, and requests are sent uncompressed. When compression is on,
`compression` is `zstd`, `gzip`, or `none`. A receiver that refuses the
encoding fails the send, with no uncompressed retry. Datadog's OTLP intake and
OpenTelemetry Collector v0.81.0 and later accept zstd.

Collector metrics use the local metric outbox. They survive restarts and
outages with their original timestamps, and session activity totals need it.
They use delta temporality, a timestamp on each point, exponential histograms,
`service.name` and `service.version`, and no Datadog header. Collectors get
late corrections as signed changes dated at the turn, and PR points dated at
the turn. Datadog replaces corrected points instead.

### Client OTLP proxy

`server.otlp_proxy` (`enabled`, `endpoint`, `api_key_ref`) forwards a client's
own OTLP data, sent to the local service, to an upstream collector. It does
not choose publish destinations.

- Forwarded points keep their native values. They gain session, client, and
  model tags, `trajectory.proxy.source:serve-otlp`,
  `trajectory.cost_role:client_telemetry`,
  `trajectory.cost_source:claude_native_otlp`, and overlap
  tags. Trajectory never corrects or drops native points, never checks them for
  completeness, and never turns missing model data into proxy counters.
- Forwarded Claude metrics include `claude_code.cost.usage`, the native cost
  with its value kept, and `claude_code.token.usage`, a sum.
- Forwarded Claude spans use the `ml_app` `<export.ml_app>-claude-native`
  (change it with `server.otlp_proxy.native_ml_app`) and the session
  `claude-native:<id>`. The raw ID is in `claude_code.session_id`. They carry
  `trajectory.telemetry_plane:native_client_otlp` and stay apart from
  Trajectory sessions.
- The proxy matches sessions by payload identity, then the only active
  session, then recent heartbeats. Otherwise identity tags are `unknown`.
- The proxy never blocks the client. It answers success without an upstream,
  or when tagging or the upstream fails, and local capture continues. Success
  means the upstream answered 2xx, not that it indexed the data. Forwarding
  never retries or saves delivery.
- Each process takes four native OTLP requests at a time, each at most 5 MiB.
  Extra requests get 503 with `Retry-After: 1`. Empty or oversized bodies get
  400.
- Health-only exports carry `X-Trajectory-Health-Export: 1`. Forwarders keep
  it and add no session or model tags. The header grants no access.
- Each service process forwards on its own. Restart long-running services
  after you change `server.otlp_proxy.*` or their environment.

### Claude Code relay

If your Claude settings export OTLP, `trajectory claude` adds a loopback relay
to that collector for the launch, with Claude's headers, and copies the data
locally. There is no relay when managed Claude settings set the OTLP route, or
when Claude uses gRPC. `trajectory claude --dry-run` shows the route.

- The service relays Claude Code's own OTLP logs, metrics, and traces from
  `trajectory claude`, or from Claude settings that point at local endpoints.
- Each signal keeps its protocol: its own setting, then
  `OTEL_EXPORTER_OTLP_PROTOCOL`, then `http/json`. Managed protobuf forwards
  as protobuf.
- Claude Code's span tree stays whole, including `claude_code.tool` spans with
  `skill_name` when Claude sends tool details.
- Setup never edits Claude's OTLP settings. It warns about an `env` block that
  older versions wrote, and keeps it. Managed routes stay untouched.

## Tags

Top-level `tags:` in user or managed config go on LLM Observability spans and
on base, marker, heartbeat, and service metrics. They skip local JSONL, OTLP
exports, Claude native proxy metrics, and process health and privacy
counters. User and managed `tags:` merge. On a shared key the managed value
wins, and it applies again over destination tags.

```yaml
tags:
  team: platform
  environment: development
```

A destination's `tags:` apply only to it. Set them in trusted config or a
repository `publish.trajectory.yaml`.

Use tags with few, stable values, such as team or environment. Never use
prompts, paths, URLs, emails, SHAs, random IDs, or secrets. Static tag maps
allow 10 entries, keys of 64 characters, values of 50, and `key:value` tags of
200. Trajectory rejects tags over these limits and does not cut them short.
Static tags cannot use reserved identity keys such as `host`, `session_id`,
and `trajectory.user`.

Top-level `publish_tags` adds tags to traces, metrics, or both (`signals`).
The value is fixed and can depend on `when.project_regex`. In trusted config
only, a tag can come from a command that runs when the service starts:

```yaml
publish_tags:
  - key: workspace_class
    command:
      argv: [/usr/local/bin/workspace-class]
      timeout_ms: 250
    allowed_values: [standard, regulated, unknown]
    fallback: unknown
```

- `argv` must be an absolute path. It runs with no shell. Allow at most 5
  `allowed_values`, and a `timeout_ms` of at most 1000.
- Output must be one short UTF-8 line that matches an allowed value. Standard
  error is discarded. Repository files cannot run commands.
- The command resolves in the background. While it runs, or after a timeout,
  failure, or a value not allowed, `fallback` applies or the tag drops.
- Resolved tags are saved with each session. Reloads, retries, restarts, and
  replays reuse them, and never run the command again.
- Each host accepts at most 10 distinct sets of resolved global tags per UTC
  day, shared by all service processes.

## Delivery and retries

`trajectory publish queue [--kind metrics|traces]` lists waiting or failed
deliveries and changes nothing. Check it before you chase missing data.
`trajectory publish queue retry` retries.

Delivery is not guaranteed. A metric point can arrive late or never when a
send fails or acceptance is unknown. Queued, accepted by Datadog, and readable
in Datadog are three different states. Queued operational metrics are saved
and retried. Each turn keeps one set of v2 cost
points. Restarts, retries, renamed destinations, transport changes, and clock
drift never add another. Trajectory never publishes part of a turn. The log
line `skipping incomplete turn ... (incremental)` means it waits for
`turn_end`. With no local reader, traces, metrics, and local rows may lag a
turn by up to 10 minutes. First turns never wait.

A service without Datadog credentials still captures and reports a publish
error. It never skips silently. Recovery never resends a turn a destination
has. It never follows a destination name that now points to another endpoint
or credential.

### Network and keys

- The service uses its starter's `HTTPS_PROXY` or `HTTP_PROXY`. If a localhost
  proxy is dead, it sends directly and checks again after 1 to 15 minutes.
  During that fallback, `/health` shows `egress_proxy` `direct_fallback`, and
  doctor warns. A remote proxy, or one that answers at all, even with 407, is
  never bypassed.
- An unreadable key pauses its destination. Trajectory retries after 30 seconds,
  backing off to five minutes, and health and status show it. Credential config
  changes and `set-secret` retry at the next drain. Unlocking the keychain
  elsewhere or changing its access list waits for the next scheduled attempt.

### Metrics

Metrics queue until a destination accepts them. Removed destinations and
destinations with metrics off never send. Above 20 GiB, pending rows older
than 30 days drop. Collector rows get a quarter of the outbox size limit, and
when it is full the oldest collector rows drop first.

- Three 401 or 403 answers in a row pause metric delivery
  (`credentials_rejected`). Rotate the key, or run
  `trajectory publish queue retry --kind metrics`.
- `credentials_unavailable` rows mean the keychain key is unreadable. Fix
  access, and they send at the next retry, within an hour.
- Rows at `attempts=0` for a destination that shows metrics disabled mean
  metrics are off there. Turn them on or clean up the rows.
- `Metrics: disabled for all resolved destinations` means no destination takes
  metrics. `incognito_exempt` destinations never do. Set
  `export.metrics: true` in organization defaults.
- For rows that name a removed or renamed destination, run
  `trajectory publish history --since <date>` and read "Stranded rows".
  `--yes` retires and resends them. `publish history` leaves rows older than
  its window queued. A `--since` earlier than what destinations received can
  duplicate points whose tags changed.
- `trajectory cost publish` resends cost metrics a destination missed, from
  kept history, with original timestamps. Without `--yes` it only previews.

Session metric points retry only on HTTP 429. After sending starts, a timeout,
network error, 5xx, or crash ends as `ambiguous_delivery`. Resolve such rows
with
`trajectory publish queue resolve --kind metrics --id <id> --action abandon|resend --yes`.
`resend` may count twice. Some other submissions whose acceptance is unknown
retry in limited rounds saved to disk. A publish attempt reports
`outcome:failure` while a point waits, failed, or was rejected, and the
session-end publish retries later. At session end, Datadog destinations get
missing completed-turn points that are safe to replay, each dated at its turn's
completion.

Skill invocations, `trajectory.turn.errors.additive`, subagent counts, session
skill invocations, and native human waits follow the late-correction setting,
`export.late_turn_correction_delivery`, in live sends and backfill. Outside the
live window, `historical` sends corrected totals through Historical Metrics
Ingestion, and `gap` records a dropped point. Neither sends signed rows.
Corrected totals send only when tags name one session and turn, privacy cannot
merge points, and the live point matches. Undeliverable corrections, also to
`backfill_opt_out` destinations, are dropped in the local outbox. Their reasons
are the `late_turn_correction_*` and `correction_*` forms of
`outside_live_window`, `hmi_unconfirmed`, and `cell_unverified`.

Operational events queue locally in an outbox of at most 32 MiB, kept seven
days, and delivered at least once.

### Traces

Trace and final-session retries queue in
`~/.trajectory/state/delivery-outbox.sqlite`, which holds metadata, never
session content. Turn traces answered with 5xx retry for 14 days, waiting up
to an hour. Traces sent through a Datadog Agent never retry. With the Agent
down, turn spans queue and retry. The Agent needs its trace receiver and
`evp_proxy`, which are on by default.

LLM Observability rejects spans older than 24 hours. Sessions older than that
can stay missing after a local fix, and trace backfill of them can fail.

Doctor reports pending, retryable, failed, stale, and dropped trace rows. A
row that stops retrying is marked failed and kept until resent or abandoned.
Failed rows expire at 14 days and stay as `failed_expired` for 3 days. When a
row reaches 14 days unsent, doctor fails the trace outbox check for the next
three days.

- `trajectory publish queue repair --kind traces` guides you through resending
  failed trace rows.
- `trajectory publish queue resolve --kind traces` selects `--id`, `--session`,
  or `--all`, narrowed by `--artifact-kind final_session|turn_trace`. `resend`
  may duplicate, and `abandon` may leave a gap. To resend `retry_exhausted`
  rows, run
  `trajectory publish queue resolve --kind traces --session <id> --artifact-kind final_session --action resend --dry-run`,
  then the same command with `--yes`.
- A missing destination's traces wait for it to return. Discard them with
  `trajectory publish queue resolve --kind traces --id <id> --action abandon --yes`.
  No other address can receive them. `abandon` leaves active claims, and
  `resend` skips pending rows for missing destinations.

### Clean up rows for a destination that cannot accept them

`trajectory publish queue repair --destination <name> --source <source> --older-than 30m`
lists rows with zero attempts that the destination cannot accept. Add
`--apply --yes` to drop them. It dry-runs by default and needs `--source`. It
skips attempted or ambiguous rows and audits `destination_ineligible` drops.
Repeat until `remaining=0`.

### Final-publish claims

A claim marks a final publish whose result is unknown. Claims have no attempt
counter. The hold reasons `owner_lost_or_legacy` and `ambiguous_export` mean
the export may have arrived.

1. List held claims with `trajectory publish queue claims`.
2. Run the `resolve-claim` command that `trajectory doctor` prints. Copy claim
   IDs, and never invent them. Do not choose the action from age alone.
   Release a claim to resend while the destination still accepts the data.
   Complete it only if its export was handled or you accept a gap. A resend
   may duplicate.

Doctor prints `release` for a claim under 25 hours old. For an older claim the
service keeps, it prints `complete`. Use `release` instead to resend it, for
example to a collector that still accepts older traces.

Resolving a claim also rearms or reconciles its trace row, so the queue needs no
separate repair. Claims with a started or unknown submit phase stay held for
`trajectory publish queue resolve-claim`. After 25 hours the service completes
held claims that lose nothing: Datadog turn traces and session ends that fully
succeeded. Single-destination session ends, collector, project,
removed-destination, and redirected-trace claims stay held. Stream, module span,
and AI Usage claims follow the seven-day rule: daily maintenance completes
claims older than seven days that are not final. They still block duplicates, so
old deliveries may have gaps.

## Check publishing

`trajectory publish validate`, `status`, `doctor publish`, and
`session audit` read local data only. None confirms that Datadog accepted
data. Run them from the folder where users start sessions, because repository
publish files load from the working directory.

- `trajectory publish validate` checks the schema, trust, destinations,
  markers, and each API key's source, format, site, and the running service's
  copy. It prints no secret. It checks the API key but not application key
  permissions. Check those with the canary's `--readback`.
- `trajectory publish status` shows the mode (traces, metrics, both, or local
  only), destinations, output plan, and warnings, such as `export.site`
  without a destination.
- `trajectory doctor publish --session <id>` checks capture, span, and metric
  plans against the transcript. It prints a readback command and never
  queries Datadog.
- `trajectory session audit --session <id> --deep` compares spans with client
  files. It explains fidelity errors, disabled traces, and missing models or
  cost.
- Trajectory no longer uses Datadog log-based metric definitions.
  `trajectory publish sync` and `trajectory publish preview` stay so existing
  scripts keep working, and report that there is nothing to do.

Validation and logs report authority decisions with these codes. If Trajectory
rejects a project trace destination, move it into trusted user or managed
config.

| Code | Meaning |
| --- | --- |
| `project_trace_destination_rejected` | A project added a trace destination, or named one that does not exist |
| `project_trace_level_clamped` | A project asked for a higher trace level than allowed |
| `project_metrics_destination_accepted` | Trajectory added a project destination for metrics only |
| `project_metrics_authority_clamped` | Trajectory removed endpoint or credential settings from a project metrics destination |
| `project_metrics_site_rejected` | A project metrics destination uses a site outside `allowed_sites` |
| `security_destination_override_ignored` | A project tried to change a security destination |
| `project_event_stream_rejected` | A project tried to add an event stream destination |
| `project_event_stream_ignored` | A project tried to turn on the event stream for a trusted destination |
| `project_ai_usage_rejected`, `project_ai_usage_ignored` | A project tried to add or change AI Usage events |
| `project_module_spans_rejected`, `project_module_spans_ignored` | A project tried to add or change module spans |
| `project_agent_security_rejected`, `project_agent_security_ignored` | A project tried to add or change Agent Security output |

### Check that Datadog receives data

`trajectory doctor metrics canary` checks locally. `--publish` sends test
metrics with the current time. `--readback`, which needs `--publish` and an
application key that can query metrics, reads them back. The canary sends
only new points, never old sessions, because Datadog handles old timestamps
unreliably. If it reports no eligible destinations, run
`trajectory config set export.metrics true` and
`trajectory config reload --yes`, then run it again.
`trajectory doctor metrics last` prints the latest result again, and
`trajectory doctor metrics open` opens its URL. It refuses runs that stayed
local.

To check every built-in metric, tagged `trajectory.canary_run`, run:

```bash
trajectory publish metrics canary --clients all --runs-per-client 2 --include-diagnostics --publish --readback
```

You can also confirm arrival with the Metrics API, the LLM Observability UI,
intake logs, or `trajectory patterns markers canary --keep-home`. Check
forwarded client metrics and Claude native spans, with their added tags, in the
upstream backend. Forwarded Claude metrics skip the local outbox. Find them in
Datadog by `trajectory.cost_role:client_telemetry`,
`trajectory.cost_source:claude_native_otlp`, and `trajectory.cost_dedupe_group`.
To see whether publishing fails, query
`trajectory.instrumentation.publish.attempt`. Direct sends and outbox delivery
have different guarantees.

### Delivery status

A service can capture and report ready while Datadog accepts nothing, so
check `publish_delivery`, not readiness. The verdict appears in
`trajectory ps --json` (`delivery`), `trajectory status`, doctor's
"Datadog delivery" check, `/health`, and managed status `runtime.delivery`.
Doctor fails "Datadog delivery" after 15 minutes of due sends with none
accepted. Services send metrics at least once a minute.

`publish_delivery` states are `publishing` (accepted within 15 minutes),
`idle` (nothing due), `no_destination` (no metric destination), and
`starting` (under 15 minutes old). `publish_delivery.destinations` gives each
destination's `network_path` (`direct`, `proxy`, or `local`),
`last_accepted_at`, and `last_failure`, with `error_class`, `http_status`,
`consecutive`, and `detail`. A `not_publishing` reason names the cause of the
failed send, such as `keychain_locked`, instead of `no_accepted_send`.

| Reason | What to do |
| --- | --- |
| `config_load_degraded` | Config failed to load, so defaults run. Fix what `trajectory doctor` names, then run `trajectory serve restart`. |
| `credentials_unavailable` | The key is unreadable, such as from a failed key command. Fix the source that doctor's credentials check names. |
| `intake_rejected` | Datadog refused data. For 401 or 403, check the key and site. Rows with 400, 413, or 422 are set aside. |
| `keychain_authorization` | This build cannot read the keychain item without a prompt. Run the `trajectory config set-secret` command doctor prints, in Terminal. |
| `keychain_locked` | The key's keychain is locked. Run `trajectory config secrets` in an interactive terminal as the user. |
| `keychain_missing` | The keychain or item is missing. Store the key with the `trajectory config set-secret` command doctor prints. |
| `network` | Sends got no answer. Check that the computer reaches each intake that `trajectory ps --json` shows. |
| `no_accepted_send` | Sends were due and none was accepted. If the check blames credentials, fix the API key first. |
| `no_send_attempted` | A destination exists but nothing was sent. Run `trajectory doctor logs --grep "publish delivery"`, then `trajectory serve restart`. |
| `proxy_unreachable` | The `HTTPS_PROXY`, `HTTP_PROXY`, or `ALL_PROXY` proxy refused connections. Start it, or restart the service without it. |

### Monitor delivery

The service publishes
`trajectory.serve.local_state.publish_ledger_held_claims{artifact_scope:final_session}`
every hour, including 0, and
`trajectory.instrumentation.watchdog.gap_detected{reason:publish_ledger_claim_held}`.
Alert on either. `trajectory ps --json` and `/health` report the
`native_otlp_admission` capacity, use, peak, and rejections. When destination
config blocks module span records, the service logs `CONFIG SUPPRESSED PUBLISH`
with the setting, a recovery step, and `local_records=retained`.
