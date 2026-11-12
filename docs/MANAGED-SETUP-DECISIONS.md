# Setup Decisions

This page covers each choice that you make in the intent file. It says what
the choice does on computers and which mistakes are easy to make. Each section
ends with the intent fields it covers.

For each field's default and allowed values, see the
[Managed Endpoint Settings Reference](https://github.com/datadog-labs/trajectory/blob/main/docs/MANAGED-ENDPOINT-SETTINGS.md).
`trajectory-mdm validate` checks every field. It prints a `Warning:` line for
a setting that it accepts but that may not do what you expect.

## Product, platform, and deployment

Choose the MDM product and the platform first. They decide what the bundle can
do:

| Product and platform | What the bundle installs | Datadog destinations |
| --- | --- | --- |
| Jamf Pro on macOS | Installation script and configuration profile | Yes. Jamf Pro delivers the API keys. |
| Microsoft Intune on macOS | Installation script and configuration profile | No |
| Other products on macOS, and all products on Windows | Settings only, as a policy package | No |

Datadog destinations need API keys on each computer. Only Jamf Pro on macOS
delivers them. For every other product, use `schema_version` 1 and leave out
`destinations`.

- `provider` is the policy ID that `trajectory-mdm providers` lists.
- `schema_version` decides which fields the intent accepts. Use 5 for Jamf
  Pro, so you can use every field on this page.
- `deployment_id` names this deployment. Keep it the same for every revision.
  For Intune on macOS, a new ID needs a higher `--profile-revision`, or
  computers refuse the profile. Jamf Pro bundles get a higher revision on
  every run.
- `migration_mode` decides what the first installation script does with an
  existing personal installation. The default is `update_in_place`.
- `$schema` names the schema file that `trajectory-mdm schema` writes.
  Editors use it for completion.

Fields: `provider`, `platform`, `schema_version`, `deployment_id`, `migration_mode`, `$schema`

## Clients

`clients` lists the coding agents that managed setup configures. List only the
clients that the users may use. The
[client table](https://github.com/datadog-labs/trajectory/blob/main/docs/MANAGED-ENDPOINTS.md#choose-coding-agent-clients)
in the administrator guide gives each client ID.

- `auto_instrument` also sets up approved clients that users install later.
  Managed setup already sets up the clients in `clients`.
- `client_command_shims` installs launcher wrappers for `claude`, `codex`, and
  `copilot` on macOS. Without it, Trajectory installs no wrappers.

To change `clients`, deploy a new profile. The hosted settings file cannot
change it.

Fields: `clients`, `auto_instrument`, `client_command_shims`, `client_command_shims.enabled`

## Destinations

A destination is one Datadog site and LLM Observability application that
computers send data to. Each destination needs these fields:

| Field | What it is |
| --- | --- |
| `name` | A unique name for the destination |
| `type` | Always `dd_llmobs` |
| `site` | Your Datadog site, such as `datadoghq.com` or `datadoghq.eu` |
| `ml_app` | The application name in LLM Observability |
| `level` | How much session content goes to LLM Observability |
| `api_key_ref` | The name of the keychain entry that holds the API key |

`api_key_ref` is a name, such as `dd-primary-api-key`. It is never the API key
itself. See [API keys](MANAGED-WHAT-GOES-WHERE.md#api-keys).

### Trace level

`level` controls only LLM Observability traces. It does not turn metrics on or
off.

| `level` | What the destination receives |
| --- | --- |
| `off` | No traces. Metrics still go to it. |
| `minimal` | Structure and metadata only |
| `standard` | Standard LLM Observability detail |
| `full` | All captured content that privacy policy allows |

Choose `off` only for a destination that should get metrics alone. For traces,
use `standard`.

### Markers and metrics

Leave out `markers` unless you need marker metrics or marker logs. Without
`markers`, a destination receives turn, session, and cost metrics.

- `markers.enabled` turns markers on. With `true`, also set `metrics` or
  `logs` to `true`.
- `markers.metrics` sends marker metrics. `false` also stops turn and session
  metrics to this destination.
- `markers.logs` sends marker event logs.

A destination with `markers.metrics: false` receives only session start counts
and deployment heartbeats. Do not set it to turn markers off. Leave out
`markers` instead.

When `organization_sync.files` lists `config.defaults.yaml`, the profile
cannot turn markers on. Turn them on in a later hosted settings file.

### Other destination settings

- `tags` adds tags to this destination's data. Never put secrets in tags.
- `service` sets the service name that Trajectory reports.
- `incognito_exempt` lets the destination receive data in incognito mode. It
  needs `level` `full` and markers off.
- `backfill_opt_out` stops backfill, which sends earlier data with its
  original timestamps.
- `operational_logs`, `agent_security`, `module_spans`, `event_stream`, and
  `ai_usage` send other kinds of data. Each one is a separate data-export or
  security choice. Put AI Usage on its own destination.
- `privacy` and `segmentation` are removed. Computers ignore them.

Fields: `destinations`, `destinations[].name`, `destinations[].type`, `destinations[].site`, `destinations[].ml_app`, `destinations[].level`, `destinations[].api_key_ref`

Fields: `destinations[].markers`, `destinations[].markers.enabled`, `destinations[].markers.metrics`, `destinations[].markers.logs`

Fields: `destinations[].tags`, `destinations[].service`, `destinations[].incognito_exempt`, `destinations[].backfill_opt_out`

Fields: `destinations[].operational_logs`, `destinations[].agent_security`, `destinations[].module_spans`, `destinations[].event_stream`, `destinations[].ai_usage`

Fields: `destinations[].privacy`, `destinations[].segmentation`

## Organization sync and hosted files

Organization sync makes computers download files from your own HTTPS server.
`organization_sync` starts at `schema_version` 3 and is required from 4.

- `config_source` is the base HTTPS address. Computers download without a
  user sign-in.
- `sync_interval_seconds` is the time between downloads, from 60 to 86400.
  Computers sync at least once every 14400 seconds.
- `files` lists each file that computers download. When you remove an entry,
  computers delete their copy.
- With a hosted `config.defaults.yaml`, the hosted file's `files`,
  `markers_path`, and `sync_interval_seconds` replace the profile values once
  computers accept it. Computers always use the profile's `config_source`.
- Each entry has a `name`, a `path` under `config_source`, and `required`.
  With `required: true`, setup waits until the file downloads.
- `markers_path` is required. It has an effect only when `files` has a
  `markers.yaml` entry with the same path.
- `cohort` assigns these users to a cohort. It needs a required `cohort.yaml`
  entry at `cohorts/<cohort>.yaml`. It cannot be combined with
  `config.defaults.yaml`.

Computers download each file from a `latest/` folder next to its path.
[What goes where](MANAGED-WHAT-GOES-WHERE.md#hosted-files) lists each file name, who
writes it, and where it goes.

Fields: `organization_sync`, `organization_sync.config_source`, `organization_sync.sync_interval_seconds`, `organization_sync.files`

Fields: `organization_sync.files[].name`, `organization_sync.files[].path`, `organization_sync.files[].required`, `organization_sync.markers_path`, `cohort`

## Updates

Decide who installs new releases on macOS:

| You want | Set |
| --- | --- |
| Your MDM installs each release that you assign | `binary_update.authority: mdm`, or leave out `binary_update` |
| Computers install the release that you approve in a hosted file | `binary_update.authority: trajectory`, and a `RELEASES.json` entry in `organization_sync.files` |
| Computers install each new release of their update ring | `binary_update.authority: trajectory`, and no `RELEASES.json` entry |

Windows accepts only `mdm`.

- Under `mdm`, computers do not use a hosted `RELEASES.json`. To approve
  releases with it, you need `trajectory`.
- `RELEASES.json` is the file that approves a release. Do not host
  `deployment.json` for this. While `files` lists `deployment.json`, that file
  decides the release, and `RELEASES.json` does not cap it.
- Leave out `allow_rollback`. It is retired, it has no effect with
  `RELEASES.json` or with MDM update scripts, and `trajectory doctor` warns
  when the profile sets it.
- `deployment.minimum_version` sets the version floor, the lowest release
  computers may run, such as `0.6.3`. It needs `schema_version` 5. A hosted
  `config.defaults.yaml` that computers accept replaces it, so repeat it
  there. Updates do not use the floor yet.
- Computers that run 0.6.3-beta.5 or earlier refuse a profile that sets
  `deployment.minimum_version`, and a hosted `config.defaults.yaml` that sets
  it. Add the floor only after every computer runs a release that reads it.
  The helper warns with `minimum_version_older_releases`.
- The update ring comes from `deployment.ring` in the hosted
  `config.defaults.yaml`. The intent has no ring setting.

See
[Choose who controls updates](https://github.com/datadog-labs/trajectory/blob/main/docs/MANAGED-ENDPOINTS.md#choose-who-controls-updates)
for the rules on each computer.

Fields: `binary_update`, `binary_update.authority`, `binary_update.allow_rollback`, `deployment`, `deployment.minimum_version`

## Identity and tags

- `identity.user_email_suffix` is your email domain, such as `@example.com`.
  Trajectory uses it for user identity.
- `tags` adds up to 64 tags to all managed data, deployment heartbeats
  included. Use them to filter dashboards by team or rollout.

Never put secrets in tags. The helper refuses a tag value that looks like a
credential.

Fields: `identity`, `identity.user_email_suffix`, `tags`

## Local data retention

`capture` limits how long computers keep session data on disk. Leave it out
for no organization limit.

- `capture.retention_limit_days` is the longest time computers keep full
  session data, such as transcripts and tool text. `0` sets no limit.
- `capture.aggregate_retention_limit_days` is the longest time computers keep
  a session's cost and usage totals after its full data ages out. `0` sets no
  limit. A value below `retention_limit_days` is raised to it.

Users can choose a shorter time, but not a longer one. Releases before 0.6.3
reject a hosted settings file that has `capture`, so update those computers
before you publish one.

Fields: `capture`, `capture.retention_limit_days`, `capture.aggregate_retention_limit_days`

## Advanced settings

Most deployments leave these out. The settings reference lists each of their
fields.

- `security_modules` configures security modules. A later change needs a
  restart, so the profile owns it.
- `publish_trust` names the repositories whose `publish.trajectory.yaml`
  files Trajectory reads, and the Datadog sites those files can use.
- `pricing` sets how Trajectory prices Cursor usage.
- `historical_replay` is an older name for rolling historical reconciliation.
- `features` turns individual managed features on or off.
- `user_guide_overrides` replaces the `privacy` page of the `trajectory` user
  guide with a page from your `config_source`.
- `redacted_model_suffixes` lists model ID suffixes whose metrics always drop
  the model tags.
- `unbilled_model_suffixes` lists model ID suffixes that cost $0, as a known
  price.
- `sensitivity_scanning` and `task_segmentation` are removed. Computers ignore
  them.

Fields: `security_modules`, `publish_trust`, `pricing`, `historical_replay`, `features`, `user_guide_overrides`, `redacted_model_suffixes`, `unbilled_model_suffixes`

Fields: `sensitivity_scanning`, `task_segmentation`
