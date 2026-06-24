# Configuration Guide

Trajectory reads a small YAML configuration, a managed defaults file when one is present, and a few environment variables. Most users only need `trajectory config show` and `trajectory config set`.

## Start Here

```bash
trajectory config show               # View the effective runtime config
trajectory config path               # Print the config file paths Trajectory uses
trajectory config                    # Open the interactive config editor
trajectory config set <key> <value>  # Set one supported scalar value
trajectory config get <key>          # Read one value
```

Use `trajectory config show` when behavior is surprising. It shows the merged config the binary will use after defaults and user settings are loaded.

## Config Files

By default, Trajectory uses these files under `~/.trajectory/`:

| File | Purpose | Who usually edits it |
|---|---|---|
| `config.yaml` | Normal per-machine user configuration | The user, usually through `trajectory config set` |
| `config.defaults.yaml` | Managed defaults and policy-style settings | An installer, administrator, or configuration management tool |

Set `TRAJECTORY_HOME` to move the whole Trajectory home directory, including both config files, to another location.

## How Layering Works

Trajectory starts with built-in defaults, then loads `config.defaults.yaml` if it exists, then loads `config.yaml` if it exists. Runtime environment variables can override specific values for the current shell or launched process.

The practical model is:

1. Built-in defaults provide safe behavior.
2. `config.defaults.yaml` supplies managed defaults.
3. `config.yaml` supplies user preferences.
4. Environment variables apply temporary runtime overrides.

For ordinary scalar settings, `config.yaml` can override `config.defaults.yaml`. Some settings are intentionally policy-like when they come from `config.defaults.yaml`:

- `local_ui.auto_start: false` disables automatic local-ui startup even if `config.yaml` sets it back to `true`. Manual `trajectory local-ui` and `trajectory view` commands still work.
- `required_destinations` describes managed publish destinations that user and project configuration cannot remove.

Project files named `publish.trajectory.yaml` are separate from the user config. They can add trusted publish destinations when allowed by `publish_trust`, but they do not replace `config.yaml` and should not be used for general capture, local UI, or identity settings.

## Common Settings

```bash
trajectory config set export.site datadoghq.com
trajectory config set export.traces standard       # off | minimal | standard | full
trajectory config set export.metrics true
trajectory config set export.placeholder_llm_span false
trajectory config set export.subagent_span_mode links_only  # semantic | links_only
trajectory config set local_ui.auto_start false
trajectory config set capture.retention_days 30
trajectory config set-secret dd-api-key            # prompts securely
```

Trace export is off by default. Set `export.traces` explicitly when you want sessions published to Datadog LLM Observability.

Metrics export defaults to `true`, but still needs a working Datadog destination and credentials before points can be submitted.

For metrics-only Datadog export, leave traces off and keep metrics enabled:

```yaml
export:
  site: datadoghq.com
  ml_app: coding-agents
  traces: off
  metrics: true
```

No `type:` field is needed in normal `~/.trajectory/config.yaml`. Trajectory
uses `export.site`, `export.ml_app`, `export.traces`, and `export.metrics` to
create the built-in Datadog destination named `_config_datadog`. With
`traces: off` and `metrics: true`, Datadog metrics publish and LLM Observability
trace spans do not.

For explicit managed destinations, `type` chooses the backend or transport:
`datadog`, `datadog_agent`, or `otlp`. Trace export is controlled by `level` on
that destination. Metrics export is controlled by `export.metrics` and
destination metric settings. Legacy aliases `dd_llmobs` and
`dd_llmobs_via_agent` are still accepted.

Managed Datadog security destinations can opt in to a security event stream:

```yaml
required_destinations:
  - name: security-audit
    type: datadog
    level: full
    incognito_exempt: true
    event_stream:
      enabled: true
      privacy_profile: security
```

The stream is off unless `event_stream.enabled: true` is set. The default
`security` profile keeps structural event metadata plus pre-tool arguments for
detections, while omitting prompts, assistant text, thinking text, post-tool
outputs/results, diffs, file contents, raw payloads, error text, summaries, and
user email fields. See [SECURITY-EVENT-STREAM.md](SECURITY-EVENT-STREAM.md).

Trace export is off by default. Rerunning `trajectory setup` preserves an
existing non-off trace setting and prints the effective level. If the existing
setting is `full`, interactive setup asks before preserving it; the safe default
is to switch back to `off`. Non-interactive setup cannot prompt, so it warns
loudly when it preserves `full`.

## Example User Config

This is a typical `~/.trajectory/config.yaml` for a user who wants local capture, Datadog metrics, and standard LLM Observability traces:

```yaml
export:
  site: datadoghq.com
  traces: standard
  metrics: true
  placeholder_llm_span: true
  subagent_span_mode: semantic

local_ui:
  auto_start: true

capture:
  retention_days: 30

segmentation:
  enabled: true
```

Prefer `trajectory config set` for routine edits so Trajectory preserves the expected shape and validates values.

## Global Publish Tags

Use a top-level `tags:` map in `~/.trajectory/config.yaml` or managed
`~/.trajectory/config.defaults.yaml` when every published Datadog coding-agent
signal from that machine should carry the same deployment or fleet tags:

```yaml
tags:
  team: platform
  environment: development
  workspace: cloud
```

These tags are added at publish time to Datadog LLM Observability spans and
Trajectory Datadog metric series for base, marker, heartbeat, and task metrics.
They are not written to local JSONL. They are not added to OTLP exports, Claude
native OTLP proxy metrics, or process-level health/privacy counters.

User and managed `tags:` maps are additive. When the same key appears in both,
the managed `config.defaults.yaml` value wins. Destination-level `tags:` from
trusted destinations or `publish.trajectory.yaml` remain destination-scoped, but
managed top-level tags are reapplied for shared keys.

Keep global tags low-cardinality and non-sensitive. Use stable values such as
`team`, `environment`, `deployment`, or `workspace`; avoid prompts, file paths,
URLs, arbitrary emails, SHAs, random IDs, and secrets. Use the `identity.*`
settings for user/email/GitHub attribution instead of custom tag keys.

## Example Managed Defaults

`config.defaults.yaml` is useful when an installation should start from the same defaults on many machines.

```yaml
export:
  site: datadoghq.com
  traces: off
  metrics: true

local_ui:
  auto_start: false

capture:
  retention_days: 30
```

In this example, users may still opt in to trace export from `config.yaml`, but automatic local-ui startup remains disabled because a managed `false` value is authoritative for that setting.

## Export And Credentials

Set the Datadog site, store an API key, and validate the publish configuration:

```bash
trajectory config set export.site datadoghq.com
trajectory config set-secret dd-api-key
trajectory config set export.traces standard
trajectory config set export.metrics true
trajectory publish validate
```

`trajectory publish validate` prints credential source and non-secret
value-shape diagnostics for each destination. A healthy Datadog API key reports
`normalized_shape=datadog-api-key` and `valid_format=true`. If
`valid_format=false`, re-enter the API key with `trajectory config set-secret
dd-api-key` or fix the `DD_API_KEY`, `DATADOG_API_KEY`, or `api_key_command`
source.

Use OS keychain storage for secrets. Avoid putting API keys or provider keys in
YAML files.

`trajectory config set-secret` updates keychain values defensively: it checks
for an existing value first, writes the new value, and attempts to restore the
previous value if the write fails. If setup or `set-secret` reports a keychain
problem, recover with `trajectory config set-secret dd-api-key`, or set
`DD_API_KEY` or `DATADOG_API_KEY` temporarily and run `trajectory publish
validate`.

For temporary shells and CI-style runs, environment variables can provide credentials:

```bash
DD_API_KEY=... trajectory publish validate
DATADOG_API_KEY=... trajectory publish validate
```

Standard publish credential lookup order:

1. Environment variable derived from the configured key ref, then `DD_API_KEY`,
   then `DATADOG_API_KEY`.
2. Default key provider from `auth.key_command`, for the default Datadog ref.
3. OS keychain account matching the key ref.
4. Destination `api_key_command`.

Set `auth.credential_source` when you need to force one standard source and
stop fallback. Valid values are `auto`, `env`, `key_provider`, `keychain`, and
`api_key_command`:

```bash
trajectory config set auth.credential_source keychain
trajectory config set auth.credential_source auto
```

`trajectory doctor`, `trajectory publish validate`, and serve logs report the
active policy, resolved source, and non-secret value shape. In `auto` mode,
malformed Datadog env vars are reported early and real Datadog publish
destinations fall through to later sources such as the key provider, keychain,
or destination command. Pin `auth.credential_source` when you want that source
to fail closed instead.

## Local Capture Without Remote Export

To keep local JSONL capture and the local viewer while disabling remote export:

```bash
trajectory config set export.traces off
trajectory config set export.metrics false
```

Captured JSONL remains under `~/.trajectory/trajectories/` unless you also disable capture for a launched process.

For one command where nothing should be recorded:

```bash
TRAJECTORY_DISABLED=1 claude "review this repo without recording"
```

For session privacy where local capture should continue, use `/incognito` inside the agent session. See [PRIVACY.md](PRIVACY.md).

## LLM Capacity Controls

Most capture, marker evaluation, local UI, and Datadog publish paths do not ask another LLM to process a session. The default features that may consume additional LLM capacity are task segmentation and sensitivity classification.

Disable both Trajectory-owned LLM paths:

```bash
trajectory config set segmentation.enabled false
trajectory config set export.sensitivity.scanning_mode off
```

For more detail, see [LLM-CAPACITY.md](LLM-CAPACITY.md).

## Identity Tags

Every exported span and metric includes `trajectory.user`, resolved from `TRAJECTORY_USER` or the system username.

Optional identity fields add `trajectory.user_email`, `github.email`, and `github.username` when values can be resolved:

```bash
trajectory config set identity.user_email_suffix example.com
trajectory config set identity.github_username your-github-username
```

GitHub identity can also resolve from repository-local Git config and then global Git config.

## Environment Overrides

Environment variables are best for temporary overrides, CI jobs, or one launched command.

| Variable | Effect |
|---|---|
| `TRAJECTORY_HOME` | Move Trajectory files to a different directory |
| `TRAJECTORY_PORT` | Override `server.port` |
| `DD_SITE` | Override `export.site` |
| `DD_API_KEY` | Provide a Datadog API key without editing config |
| `DATADOG_API_KEY` | Provide a Datadog API key without editing config |
| `TRAJECTORY_SEGMENTATION_DISABLED=1` | Disable segmentation for the current runtime |
| `TRAJECTORY_ROOT` | Change where trajectory JSONL files are written |
| `TRAJECTORY_DEBUG=1` | Enable verbose logging |
| `TRAJECTORY_AUTO_UPDATE=0` | Disable startup auto-update checks |
| `TRAJECTORY_DISABLED=1` | Disable capture for the launched process |
| `TRAJECTORY_USER` | Override the `trajectory.user` tag |
| `TRAJECTORY_USER_EMAIL` | Override `trajectory.user_email` |
| `TRAJECTORY_GITHUB_EMAIL` | Override `github.email` |
| `TRAJECTORY_GITHUB_USERNAME` | Override `github.username` |

## Frequently Edited Keys

| Key | Default | What it controls |
|---|---|---|
| `tags` | `{}` | Low-cardinality deployment tags added to published Datadog spans and Trajectory Datadog metrics; managed defaults win on shared keys |
| `deployment.ring` | `stable` | Release channel for updates, usually `stable` or `beta` |
| `auth.credential_source` | `auto` | Pin standard Datadog credential resolution to `env`, `key_provider`, `keychain`, or `api_key_command`; `auto` uses the fallback chain |
| `server.port` | `19222` | Local capture server port |
| `local_ui.auto_start` | `true` | Automatic local-ui startup from non-manual flows |
| `capture.redact_pii` | `true` | PII redaction in captured content |
| `capture.retention_days` | `30` | Local JSONL retention in days; `0` keeps files indefinitely |
| `export.site` | site selected during setup | Datadog site, such as `datadoghq.com`, `us5.datadoghq.com`, or `datadoghq.eu` |
| `export.ml_app` | `coding-agents` for implicit destinations | LLM Observability ML app name |
| `export.traces` | `off` | LLM Observability trace export level: `off`, `minimal`, `standard`, or `full` |
| `export.metrics` | `true` | Cost, token, marker, and operations metric export |
| `export.placeholder_llm_span` | `true` | Synthetic LLM child span for turn-level token and cost enrichment |
| `export.subagent_span_mode` | `semantic` | Parent-side subagent rendering mode: `semantic` adds readable parent-side task spans, `links_only` keeps only child-trace links and metadata |
| `export.sensitivity.scanning_mode` | `balanced` | Sensitivity classification mode: `balanced`, `near_realtime`, or `off` |
| `segmentation.enabled` | `true` | Async task segmentation |
| `segmentation.interval` | `10` | Number of turns between segmentation passes |
| `segmentation.publish_metrics` | `false` | Publish task-derived segmentation metrics |
| `segmentation.publish_traces` | `false` | Publish segmentation task traces and logs |
| `publish_trust.allowed_origins` | empty | Git origins allowed to load project `publish.trajectory.yaml` overlays |
| `publish_trust.require_committed` | `false` | Require project publish configs to be git-tracked |
| `publish_trust.allowed_sites` | empty | Optional Datadog site allowlist for project-created destinations |
| `cross_client_resume.enabled` | `false` | Enable cross-client transcript reconstruction |

## Troubleshooting

If a config value does not seem to apply:

1. Run `trajectory config show` and check the effective value.
2. Run `trajectory config path` and confirm you edited the file Trajectory is reading.
3. Check for environment variables such as `TRAJECTORY_HOME`, `DD_SITE`, or `TRAJECTORY_PORT`.
4. Check whether `config.defaults.yaml` exists and provides a managed value.
5. If a project `publish.trajectory.yaml` is involved, confirm the project origin is allowed by `publish_trust`.
6. Run `trajectory doctor` for a broader diagnostic report.
