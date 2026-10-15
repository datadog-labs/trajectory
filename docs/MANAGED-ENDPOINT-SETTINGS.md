# Managed Endpoint Settings Reference

This page lists each setting of the `trajectory-mdm` source settings file. For
each setting, it gives the default and the allowed values. It also lists the
options of each `trajectory-mdm` command.

A managed deployment uses three files. This page tells you what each file
does and which file controls each setting.

For the deployment steps, see the
[Managed Endpoint Administrator Guide](MANAGED-ENDPOINTS.md).

## The Three Files

You update each of the three files in a different way. A change to each file
reaches computers at a different time.

| | Source settings file | Configuration profile | Hosted settings file |
| --- | --- | --- | --- |
| File name | `trajectory-managed.yaml` or `trajectory-managed.json` | `trajectory.mobileconfig` | `config.defaults.yaml` |
| Contents | All settings on this page. | Your settings in JSON, the profile revision, and a SHA-256 digest. | The behavior settings and a copy of the profile values, in Trajectory configuration format. |
| Who edits it | You. Keep it in version control. | Nobody. `trajectory-mdm prepare` generates it. | Nobody, except for the update ring. `trajectory-mdm prepare` or `trajectory-mdm remote-defaults` generates it. See [Update settings](#update-settings). |
| How to update it | Edit it. | Run `prepare` with a higher `--profile-revision`. Then replace the profile in your MDM. | Run `remote-defaults`. Then publish the file at `<config_source>/latest/config.defaults.yaml`. |
| When a change reaches a computer | Never directly. You must generate one of the other two files. | When your MDM delivers the new profile. Trajectory applies it at login, when the profile changes, and every minute. | At the next download. Computers download within `organization_sync.sync_interval_seconds`. You do not need a new profile. |

### Source settings file

You write the source settings file. It is the only file that you write. You
make one edit to a generated file: the update ring in the hosted settings
file. See [Update settings](#update-settings).

`trajectory-mdm` reads the file as YAML when its name ends in `.yaml` or
`.yml`. It reads all other files as JSON. Both formats accept the same
settings and produce the same bundle.

Never put API keys or other secrets in the source settings file.

To check the file, run:

```bash
trajectory-mdm validate --file trajectory-managed.yaml
```

`validate` checks each setting and most rules between settings. `prepare` and
`build` do more checks. They compile the settings into the endpoint
configuration, and then they apply the endpoint rules. So `prepare` and
`build` can refuse a file that `validate` accepts. The tables on this page
include these rules.

### Configuration profile

`trajectory-mdm prepare` makes a deployment bundle from the source settings
file. For Jamf Pro and Intune on macOS, the bundle contains the configuration
profile, `trajectory.mobileconfig`. The profile contains:

- your validated settings,
- the revision that you give with `--profile-revision`,
- a digest of the settings.

Each computer checks the digest. Then it builds its managed policy and its
starter settings from the profile. The starter settings are the behavior
settings that a computer uses before its first download.

`provider` and `deployment_id` identify the profile. Keep the same values in
every revision. Increase `--profile-revision` for every change, also when you
go back to earlier settings. Do not edit the profile.

The bundle also contains `trajectory-login-items.mobileconfig`. This second
profile stops users from turning off Trajectory's background jobs on macOS 13
and later. It does not change with the settings. See
[Managed login items](MANAGED-ENDPOINTS.md#managed-login-items).

### Hosted settings file

The hosted settings file, `config.defaults.yaml`, lets you change behavior
settings without a new profile. To use it, you need:

- schema version 4 or higher,
- a `config.defaults.yaml` entry in `organization_sync.files`.

You publish the file on your own HTTPS server, in the `config_source` folder
that the profile names. Computers download the file on the sync schedule.
Each computer validates the file and then replaces its current settings with
it.

Before the first download, computers use the starter settings from the
profile. A download can fail, or a computer can reject the file. In both
cases, the computer keeps its last good settings and reports the
`configuration_refresh_failed` warning. A rejected file also makes managed
status `failed`, with reason `organization_file_rejected`, until you publish a
version the computer accepts. A failed download does not change compliance.

The hosted settings file replaces all starter settings. When you remove a
setting from the source settings file, computers lose it after you publish the
new hosted settings file.

The starter settings must work before the first download. So when
`organization_sync.files` lists `config.defaults.yaml`, `prepare` refuses
these settings:

- a destination with markers on,
- Cursor pricing in `shadow` or `emit` mode,
- a `cohort`.

To turn on markers or Cursor pricing, set them in a later hosted settings
file. Generate that file with `remote-defaults`.

## Which File Controls Each Setting

The profile controls where a computer gets its configuration and what the
computer trusts. The hosted settings file can change only behavior settings.
Computers reject a hosted settings file that changes a value that the profile
controls.

<!-- BEGIN SETTING OWNERSHIP -->
| Setting | Set in | Can the hosted settings file change it? |
| --- | --- | --- |
| `schema_version`, `deployment_id`, `provider`, `platform` | Profile | No. These settings identify the deployment. |
| `migration_mode` | Profile | No. Only the first installation script reads it. |
| `clients` | Profile | No. To add clients later, use `auto_instrument` in the hosted settings file. |
| `organization_sync` (`config_source`, `markers_path`, `sync_interval_seconds`, `files`) | Profile | No. The hosted settings file must repeat the profile values. |
| `cohort` | Profile | No. You cannot use a cohort together with a hosted `config.defaults.yaml`. |
| `binary_update` (`authority`, `allow_rollback`) | Profile | No. The hosted settings file must repeat the `auto_update` value of the profile. The update ring is not part of `binary_update`. You set the ring in the hosted settings file. See [Update settings](#update-settings). |
| `security_modules` | Profile | No. The hosted settings file must repeat the same modules. A change needs a restart, so computers refuse it. |
| `destinations` and their fields | Profile and hosted settings file | Yes. |
| `tags` | Profile and hosted settings file | Yes. |
| `auto_instrument`, `features`, `task_segmentation`, `client_command_shims` | Profile and hosted settings file | Yes. |
| `identity`, `publish_trust`, `pricing`, `historical_replay`, `user_guide_overrides` | Profile and hosted settings file | Yes. |
| `sensitivity_scanning` | Profile and hosted settings file | Yes. Trajectory no longer uses this setting, and computers ignore it. |
<!-- END SETTING OWNERSHIP -->

When the profile has destinations, computers read API keys from the user's
keychain. The hosted settings file cannot change where computers read API
keys.

Jamf Pro writes API keys only for the `api_key_ref` names in the bundle that
you deployed. A destination that only the hosted settings file adds must use
one of those names. To use a new name, generate a new bundle. Then update the
credential policy in Jamf Pro.

## A Typical Jamf Pro Settings File

This example sets up Claude Code and Codex. It sends data to one Datadog
destination. Later, a hosted `config.defaults.yaml` can change the behavior
settings. Replace the IDs, the site, and the server address with your values.

<!-- BEGIN SETTINGS YAML EXAMPLE -->
```yaml
# trajectory-managed.yaml: source settings for one Jamf Pro deployment.
# Keep this file in version control. trajectory-mdm ignores comments.
schema_version: 5                         # allows every setting on this page
deployment_id: engineering-coding-agents  # stable ID, the same in every revision
provider: jamf                            # Jamf Pro
platform: macos                           # Jamf Pro deploys to macOS
migration_mode: update_in_place           # keep personal installations and their data
clients: [cc, codex]                      # clients that the profile sets up
tags:                                     # tags on all managed telemetry, never secrets
  team: developer-experience
destinations:                             # where Trajectory sends data
  - name: primary                         # unique name of this destination
    type: dd_llmobs                       # Datadog LLM Observability
    site: datadoghq.com                   # your Datadog site
    ml_app: coding-agents                 # application name in LLM Observability
    level: standard                       # session content: off, minimal, standard, or full
    api_key_ref: dd-primary-api-key       # keychain entry that Jamf Pro fills with the key
organization_sync:                        # your HTTPS server for hosted files
  config_source: https://config.example.com/trajectory
  markers_path: markers.yaml              # used only if files lists markers.yaml
  sync_interval_seconds: 3600             # download hosted files every hour
  files:
    - name: config.defaults.yaml          # the hosted settings file
      path: config.defaults.yaml          # must be config.defaults.yaml
      required: false                     # must be false for this file
auto_instrument:                          # set up approved clients that users install later
  enabled: true
  apply_enabled: true                     # false only reports the changes
  interval_seconds: 21600                 # every 6 hours
  allow_clients: [cc, codex, cursor]
binary_update:                            # who installs new releases
  authority: mdm                          # you assign update scripts in Jamf Pro
```
<!-- END SETTINGS YAML EXAMPLE -->

To deploy the example, generate the bundle:

```bash
trajectory-mdm prepare --file trajectory-managed.yaml \
  --release-json public-release.json --checksums checksums.sha256 \
  --output trajectory-deployment.zip
```

The bundle contains the profile, `trajectory.mobileconfig`. It also contains
the first hosted settings file, `remote-defaults/config.defaults.yaml`.
Publish that file as `latest/config.defaults.yaml` under your `config_source`.
Then assign the bundle in your MDM, as the
[administrator guide](MANAGED-ENDPOINTS.md#step-5-assign-the-bundle-in-your-mdm)
describes.

To change a behavior setting later, edit the source settings file. Then
generate a new hosted settings file:

```bash
trajectory-mdm remote-defaults --file trajectory-managed.yaml \
  --output config.defaults.yaml --force
```

The new file selects the `stable` update ring. To use another ring, set
`deployment.ring` in the new file before you publish it. See
[Update settings](#update-settings).

Check the file before you publish it:

```bash
trajectory-mdm check-remote-defaults --file trajectory-managed.yaml \
  --defaults config.defaults.yaml
```

## Settings

### How to read the tables

- **Setting** is the path of the setting. For example,
  `destinations[].level` is the `level` field of each entry in the
  `destinations` list.
- **Version** is the lowest `schema_version` that accepts the setting.
- **Required** is `Yes` when the setting must be present in its parent object.
  `From version N` means that the setting must be present at schema version N and
  higher.
- **Default** is the value or behavior when you leave out the setting.
- **Allowed values** gives the accepted values or limits. An ID has 1 to 64
  letters, digits, dots (`.`), underscores (`_`), or dashes (`-`). It starts
  with a letter or a digit.

No setting accepts `null`. To keep a default, leave out the setting.
`trajectory-mdm` rejects unknown fields, so a misspelled setting fails
validation.

To get the JSON Schema with all limits, run:

```bash
trajectory-mdm schema --output managed-endpoint-intent.schema.json
```

<!-- BEGIN INTENT SETTINGS -->

### Deployment settings

| Setting | Version | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- | --- |
| `$schema` | 1 | No | Not set | `managed-endpoint-intent.schema.json` | Names the JSON Schema file that `trajectory-mdm schema` writes. Editors use it for completion. |
| `schema_version` | 1 | Yes | - | An integer from 1 to 5 | Version of the settings format. A higher version accepts more settings. |
| `deployment_id` | 1 | Yes | - | An ID | Stable name of this deployment. Together with `provider`, it identifies the configuration profile. |
| `provider` | 1 | Yes | - | A policy ID from the [provider table](MANAGED-ENDPOINTS.md#supported-platforms-and-mdm-products), such as `jamf` or `intune` | Your MDM product. `trajectory-mdm` reads upper-case letters as lower case. |
| `platform` | 1 | Yes | - | `macos`, `windows` | Operating system of the managed computers. |
| `migration_mode` | 1 | No | `update_in_place` | `update_in_place`, `clean_reinstall`, `replace_untrusted` (macOS only) | What the first installation script does with an existing personal installation. See [Choose how to migrate](MANAGED-ENDPOINTS.md#choose-how-to-migrate-existing-installations). |
| `clients` | 1 | Yes | - | 1 to 64 client IDs from the [client table](MANAGED-ENDPOINTS.md#choose-coding-agent-clients), each listed once | Coding-agent clients that managed setup configures. `claude-desktop` and `muse` work only on macOS. |
| `tags` | 1 | No | No tags | Up to 64 tags. Names: up to 128 letters, digits, `.`, `_`, `:`, `/`, or `-`. Values: up to 256 characters. | Tags that Trajectory adds to managed telemetry. Never put secrets in tags. |
| `destinations` | 2 | From version 2 | No destinations | 1 to 64 destinations, each with a unique `name` | Datadog destinations. They need API keys, so they work only with Jamf Pro on macOS. See [Destination settings](#destination-settings). |
| `cohort` | 3 | No | No cohort | An ID | Cohort name for these users. It needs `organization_sync` and a required `cohort.yaml` entry at `cohorts/<cohort>.yaml`. You cannot use it with a hosted `config.defaults.yaml`. |
| `organization_sync` | 3 | From version 4 | No hosted files | An object | Your HTTPS server for hosted files. See [Organization sync settings](#organization-sync-settings). |
| `binary_update` | 4 | No | Your MDM controls updates | An object | Who installs new releases. See [Update settings](#update-settings). |
| `sensitivity_scanning` | 3 | No | Not set | An object | Removed. `trajectory-mdm` accepts it, and computers ignore it. See [Removed settings](#removed-settings). |

### Destination settings

| Setting | Version | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- | --- |
| `destinations[].name` | 2 | Yes | - | An ID, unique in the list | Name of the destination. |
| `destinations[].type` | 2 | Yes | - | `dd_llmobs` | Datadog LLM Observability. |
| `destinations[].site` | 2 | Yes | - | `datadoghq.com`, `us3.datadoghq.com`, `us5.datadoghq.com`, `datadoghq.eu`, `ap1.datadoghq.com`, `ap2.datadoghq.com`, `ddog-gov.com` | Your Datadog site. `trajectory-mdm` refuses site names that are specific to one organization. |
| `destinations[].ml_app` | 2 | Yes | - | An ID | Application name in LLM Observability. |
| `destinations[].level` | 2 | Yes | - | `off`, `minimal`, `standard`, `full` | How much session content Trajectory sends to LLM Observability. |
| `destinations[].api_key_ref` | 2 | Yes | - | An ID | Name of the keychain entry that holds the API key. Jamf Pro writes the key. Jamf Pro supports up to 8 different names. |
| `destinations[].incognito_exempt` | 2 | No | `false` | `true`, `false` | `true` lets the destination receive data in incognito mode. It needs `level` `full` and markers off. |
| `destinations[].markers` | 2 | No | Markers off | An object | Marker metrics and marker logs for this destination. |
| `destinations[].markers.enabled` | 2 | Yes | - | `true`, `false` | Turns markers on. With `true`, also set `metrics` or `logs` to `true`. |
| `destinations[].markers.metrics` | 2 | Yes | - | `true`, `false` | Sends marker metrics. |
| `destinations[].markers.logs` | 2 | Yes | - | `true`, `false` | Sends marker event logs. |
| `destinations[].operational_logs` | 2 | No | Operational logs off | An object | Operational events of Trajectory itself, sent as logs. |
| `destinations[].operational_logs.enabled` | 2 | Yes | - | `true`, `false` | Turns operational logs on. |
| `destinations[].operational_logs.min_level` | 2 | Yes | - | `debug`, `info`, `warn`, `warning`, `error` | Lowest log level that Trajectory sends. |
| `destinations[].operational_logs.components` | 2 | Yes | - | Up to 32 unique names of 1 to 96 characters, such as `trajectory.serve` | Components whose events Trajectory sends. |
| `destinations[].operational_logs.include_session_id` | 2 | Yes | - | `true`, `false` | Adds the session ID to each event. |
| `destinations[].tags` | 2 | No | No tags | Up to 10 tags. Names: 1 to 64 characters. Values: 1 to 50 characters. | Tags that Trajectory adds to the data for this destination. Never put secrets in tags. |
| `destinations[].privacy` | 2 | No | Not set | An object | Removed. `trajectory-mdm` accepts it, and computers ignore it. See [Removed settings](#removed-settings). |
| `destinations[].privacy.sensitivity_classifier` | 2 | Yes | - | `true`, `false` | Removed. Computers ignore it. |
| `destinations[].privacy.sensitivity_exempt` | 2 | Yes | - | `true`, `false` | Removed. Computers ignore it. |
| `destinations[].privacy.sensitive_policy` | 2 | Yes | - | `drop`, `minimal` | Removed. Computers ignore it. |
| `destinations[].service` | 5 | No | Not set | An ID, or an empty string | Service name that Trajectory reports for this destination. |
| `destinations[].segmentation` | 5 | No | Segmentation metrics allowed | An object | Task segmentation output for this destination. |
| `destinations[].segmentation.enabled` | 5 | Yes | - | `true`, `false` | `false` stops task segmentation metrics to this destination. |
| `destinations[].agent_security` | 5 | No | Agent Security output off | An object | Agent Security metrics and findings for this destination. |
| `destinations[].agent_security.metrics` | 5 | Yes | - | `true`, `false` | Sends operational metrics for Agent Security. When this is `true` and `incognito_exempt` is not `true`, `level` must be `off`. |
| `destinations[].agent_security.findings` | 5 | Yes | - | `true`, `false` | Sends curated Agent Security findings. With `true`, `incognito_exempt` must be `true`. |
| `destinations[].agent_security.disclosure_profile` | 5 | No | `curated` | `curated`, `curated+`, `metadata_only` | How much finding detail Trajectory sends. It needs `findings` `true`. |
| `destinations[].module_spans` | 5 | No | Module spans off | An object | Custom spans from Trajectory modules. |
| `destinations[].module_spans.enabled` | 5 | Yes | - | `true`, `false` | Turns module spans on. With `true`, `modules` must name at least one module. |
| `destinations[].module_spans.modules` | 5 | Yes | - | Up to 64 of `agent-security`, `frontier-ai-gateway` | Modules whose spans this destination accepts. |
| `destinations[].module_spans.ai_edr_disclosure_profile` | 5 | No | `full` | `full`, `curated`, `curated+`, `metadata_only` | How much detail module spans carry from AI-EDR, the `ai_edr` evaluator of `agent-security`. |
| `destinations[].module_spans.ai_edr_drop_content_for_events` | 5 | No | No routes | Up to 128 unique route names of 1 to 128 characters | AI-EDR event routes whose captured content Trajectory drops. |
| `destinations[].module_spans.native_composite_attributes` | 5 | No | Not set | 1 to 64 module IDs from the `modules` list above | Modules whose span attributes keep lists and objects as native values. Spans from other modules carry them as JSON strings. Each module must also be in `security_modules`. |
| `destinations[].event_stream` | 5 | No | Event stream off | An object | The security event stream. |
| `destinations[].event_stream.enabled` | 5 | Yes | - | `true`, `false` | Sends the security event stream. With `true`, `incognito_exempt` must be `true`. |
| `destinations[].event_stream.privacy_profile` | 5 | No | `security` | `security`, `full` | `full` adds private fields. It needs `enabled` `true`. |
| `destinations[].ai_usage` | 5 | No | AI Usage events off | An object | AI Usage events about skill use. |
| `destinations[].ai_usage.enabled` | 5 | Yes | - | `true`, `false` | Sends AI Usage events. It cannot be `true` when `incognito_exempt` is `true`. Send AI Usage events to a separate destination. |
| `destinations[].ai_usage.endpoint` | 5 | No | `https://eudm-intake.<site>/api/v2/<track>` | An HTTPS URL of up to 2048 characters, with no credentials, query, or fragment | Intake URL. It needs `enabled` `true`. |
| `destinations[].ai_usage.track` | 5 | No | `aiusage` | 1 to 64 lowercase letters, digits, or dashes | Event track for AI Usage. It needs `enabled` `true`. |
| `destinations[].ai_usage.subdomain` | 5 | No | `eudm-intake` | 1 to 64 lowercase letters, digits, or dashes | Intake subdomain. It needs `enabled` `true`. |
| `destinations[].backfill_opt_out` | 5 | No | `false` | `true`, `false` | `true` stops backfill to this destination. Backfill sends earlier data with its original timestamps. |

### Organization sync settings

| Setting | Version | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- | --- |
| `organization_sync.config_source` | 3 | Yes | - | An HTTPS URL of up to 2048 characters, with no credentials, query, or fragment | Base address of your hosted files. Computers download the files without a user sign-in. |
| `organization_sync.markers_path` | 3 | Yes | - | A relative path of up to 256 characters, without `..` | Path of `markers.yaml` under `config_source`. A `markers.yaml` entry in `files` must use this path. When `files` is set, computers download markers only if it has a `markers.yaml` entry. |
| `organization_sync.sync_interval_seconds` | 3 | Yes | - | An integer from 60 to 86400 | Time between downloads, in seconds. A profile that changes `config_source` or `files` starts a download at once. |
| `organization_sync.files` | 4 | From version 4 | - | 1 to 8 entries, each with a unique `name` and `path` | Files that computers download. When you remove an entry, computers delete their copy of the file. |
| `organization_sync.files[].name` | 4 | Yes | - | `markers.yaml`, `pricing.yaml`, `provider-pricing.yaml`, `model-equivalence.yaml`, `cohort.yaml`, `RELEASES.json`, `deployment.json`, `config.defaults.yaml` | The file that this entry downloads. |
| `organization_sync.files[].path` | 4 | Yes | - | A relative path of up to 256 letters, digits, `.`, `_`, `/`, or `-`, without `..` | Location of the file under `config_source`. For `config.defaults.yaml`, the path must be `config.defaults.yaml`. |
| `organization_sync.files[].required` | 4 | Yes | - | `true`, `false` | `true` makes setup wait until the file downloads. For `config.defaults.yaml`, the value must be `false`. |

Computers download each file from a `latest/` folder in the folder of its
path. For example, computers download the path `rules/markers.yaml` from
`<config_source>/rules/latest/markers.yaml`.

### Update settings

| Setting | Version | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- | --- |
| `binary_update.authority` | 4 | Yes | - | `mdm`, `trajectory` (macOS only) | `trajectory` lets the Trajectory updater install new releases. `mdm` keeps updates in your MDM. |
| `binary_update.allow_rollback` | 4 | No | `false` | `true`, `false` | Keep `false`. It has no effect with a hosted `RELEASES.json` or with MDM update scripts. |

For how these settings work with `auto_update`, see
[Choose who controls updates](MANAGED-ENDPOINTS.md#choose-who-controls-updates).

To approve each release before computers install it, keep `authority: mdm`
and assign an update script for each release. See
[Update Trajectory](MANAGED-ENDPOINTS.md#update-trajectory).
Under `authority: trajectory`, a hosted `RELEASES.json` in
`organization_sync.files` names the newest release that computers may
install. See
[Approve releases with `RELEASES.json`](MANAGED-ENDPOINTS.md#approve-releases-with-releasesjson).

You set the update ring with `deployment.ring` in the hosted
`config.defaults.yaml`. The allowed values are `stable`, `beta`, and
`bravehearts`. The source settings file and the profile have no ring setting.

```yaml
deployment:
  ring: beta    # stable, beta, or bravehearts
```

A generated hosted settings file selects `stable`. To use another ring,
change the value in the file that you publish. Make the same change each time
that you generate the file again.

The ring selects releases only when `binary_update.authority` is
`trajectory`. Computers use `stable` until they accept a hosted settings file
that sets a ring. A user's own `deployment.ring` has no effect on these
computers.

A profile with schema version 1 to 3 has no hosted settings file. On those
computers, the user's own `deployment.ring` applies.

`trajectory-mdm` rejects a source settings file that sets
`binary_update.ring`. For all ring rules, see
[Update ring](MANAGED-ENDPOINTS.md#update-ring).

### Organization behavior settings

These settings need schema version 5. The hosted settings file can change all
of them.

| Setting | Version | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- | --- |
| `auto_instrument` | 5 | No | Automatic client setup off | An object | Lets Trajectory set up approved clients that users install later. |
| `auto_instrument.enabled` | 5 | Yes | - | `true`, `false` | Turns automatic client setup on. |
| `auto_instrument.apply_enabled` | 5 | Yes | - | `true`, `false` | `true` makes the changes. `false` only reports the changes that setup would make. It needs `enabled` `true`. |
| `auto_instrument.refresh_existing` | 5 | No | `false` | `true`, `false` | `true` also repeats setup for clients that are already set up. It needs `apply_enabled` `true`. |
| `auto_instrument.interval_seconds` | 5 | Yes | - | An integer from 300 to 86400 | Time between setup passes, in seconds. |
| `auto_instrument.allow_clients` | 5 | Yes | - | 1 to 64 client IDs, or `all` alone | Clients that setup can configure. `all` means every supported client that setup detects. `all` does not turn on preview clients. |
| `auto_instrument.deny_clients` | 5 | No | No clients | Up to 64 client IDs | Clients that setup never configures. A client cannot be in both lists. |
| `auto_instrument.mode` | 5 | No | `detected` | `detected` | Setup configures only the clients that it detects on the computer. |
| `features` | 5 | No | Each feature keeps its default | An object | Feature switches that administrators can set. |
| `features.periodic_auto_instrument` | 5 | No | On when `auto_instrument.enabled` is `true` | `true`, `false` | `false` pauses periodic client setup. `true` needs `auto_instrument.enabled` `true`. |
| `features.agent_security_ai_edr_v2` | 5 | No | Off | `true`, `false` | Makes the AI-EDR evaluator available. It does not turn on a module. |
| `features.unified_backfill_workflow` | 5 | No | On | `true`, `false` | Kept so existing settings stay valid. `trajectory backfill` always runs, and `false` no longer stops it. It does not approve backfill to a destination. |
| `features.agent_console_durable_backfill` | 5 | No | On | `true`, `false` | Lets Agent Console reconcile metrics for the last 30 days. `false` stops it. It does not approve backfill to a destination. |
| `features.agent_console_task_backfill` | 5 | No | Off | `true`, `false` | Lets Agent Console reconcile task metrics. It does not approve backfill to a destination. |
| `features.managed_reconcile_backoff` | 5 | No | On | `true`, `false` | Lets the macOS LaunchAgent wait, up to one hour, after repeated identical reconcile failures. `false` restores the retry every minute. |
| `task_segmentation` | 5 | No | Every 10 turns, no segmentation metrics | An object | Automatic task segmentation groups turns into tasks. These settings apply only when automatic segmentation is on. It is off by default, and the source settings file cannot turn it on. |
| `task_segmentation.interval` | 5 | Yes | - | An integer from 1 to 1000 | Number of turns between segmentation passes. |
| `task_segmentation.publish_metrics` | 5 | No | `false` | `true`, `false` | Sends metrics about segmented tasks. |
| `task_segmentation.enabled` | 5 | No | `true` | `true`, `false` | `false` turns task segmentation off on computers where automatic segmentation is on. |
| `client_command_shims` | 5 | No | No launcher wrappers | An object | Launcher wrappers for `claude`, `codex`, and `copilot`. Only for macOS profiles. |
| `client_command_shims.enabled` | 5 | Yes | - | `true`, `false` | `true` installs wrappers for the `cc`, `codex`, and `copilot` clients in `clients`. See [Common Choices](MANAGED-ENDPOINTS.md#common-choices) in the administrator guide. |
| `identity` | 5 | No | No email suffix | An object | How Trajectory builds the user identity. |
| `identity.user_email_suffix` | 5 | Yes | - | A lowercase email domain of 3 to 253 characters, such as `example.com` or `@example.com` | Domain that Trajectory adds to the user's account name to make `trajectory.user`. |
| `publish_trust` | 5 | No | No repository publish files trusted | An object | Which repositories can add publish settings in a `publish.trajectory.yaml` file. |
| `publish_trust.require_committed` | 5 | No | `false` | `true`, `false` | `true` ignores publish files that Git does not track. It must be `true` when you set one of the two lists below. |
| `publish_trust.allowed_origins` | 5 | No | No origins | 1 to 32 unique Git origins: HTTPS URLs without credentials, or patterns such as `github.com/example-org/*` | Repository origins whose committed publish files Trajectory reads. |
| `publish_trust.allowed_sites` | 5 | No | Known public Datadog sites | 1 to 16 unique lowercase DNS names | Datadog sites that repository publish files can use. Do not use URLs, wildcards, or IP addresses. |
| `user_guide_overrides` | 5 | No | Built-in privacy guide | `privacy` | `[privacy]` replaces the `trajectory user-guide privacy` page with `user-guide-privacy.md` from your `config_source`. |

### Security module settings

These settings configure the security modules when Trajectory starts for the
first time. A later change needs a restart, so computers refuse it. To change
modules, deploy a new profile. Then restart Trajectory on each computer.

| Setting | Version | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- | --- |
| `security_modules` | 5 | No | No module settings | 1 to 8 modules, each listed once | First configuration of the Trajectory security modules. |
| `security_modules[].module` | 5 | Yes | - | `agent-security`, `frontier-ai-gateway` | The module that this entry configures. |
| `security_modules[].enabled` | 5 | Yes | - | `true`, `false` | `true` turns the module on. `false` turns it off. |
| `security_modules[].mode` | 5 | No | `observe` | `observe`, `enforce` | `enforce` lets the module block actions. |
| `security_modules[].evaluators` | 5 | No | Each evaluator keeps its defaults | 1 to 8 evaluators, each listed once | Settings for the evaluators of the module. Do not set them when the module's `enabled` is `false`. |
| `security_modules[].evaluators[].evaluator` | 5 | Yes | - | `ai_edr` or `ai_guard` for `agent-security` | The evaluator that this entry configures. |
| `security_modules[].evaluators[].enabled` | 5 | Yes | - | `true`, `false` | Turns the evaluator on. With `false`, set no other fields for this evaluator. |
| `security_modules[].evaluators[].mode` | 5 | No | The evaluator's default | `observe`, `enforce` | Decision mode of this evaluator. |
| `security_modules[].evaluators[].credential_redaction` | 5 | No | The evaluator's default | `true`, `false` | `true` removes raw credentials from the request that the evaluator receives. |
| `security_modules[].evaluators[].timeout_ms` | 5 | No | The evaluator's built-in limit | An integer from 100 to 30000 | Time limit for one evaluation, in milliseconds. |
| `security_modules[].evaluators[].window_turns` | 5 | No | The evaluator's built-in window | An integer from 1 to 200 | Number of recent turns that the evaluator reads. |
| `security_modules[].evaluators[].privacy_mode` | 5 | No | Redacted messages | `coding_agent`, `unredacted` | The message content that AI Guard receives. Use it only for the `ai_guard` evaluator of `agent-security`. |

### Pricing and backfill settings

| Setting | Version | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- | --- |
| `pricing` | 5 | No | The computer's own `pricing.cursor` setting | An object | Managed pricing settings. |
| `pricing.cursor` | 5 | Yes | - | An object | Pricing for Cursor costs. |
| `pricing.cursor.mode` | 5 | Yes | - | `off`, `shadow`, `emit` | `emit` publishes Cursor costs in USD. `shadow` only checks them. `shadow` and `emit` need a `pricing.yaml` entry in `organization_sync.files`. |
| `pricing.cursor.source` | 5 | Yes | - | `org_file` | Trajectory takes the rates from the `pricing.yaml` file that computers download. |
| `historical_replay` | 5 | No | No managed backfill policy | An object | Managed settings for backfill reconciliation. |
| `historical_replay.rolling` | 5 | No | Not set | An object | Settings for rolling reconciliation. |
| `historical_replay.rolling.enabled` | 5 | Yes | - | `true`, `false` | Turns rolling reconciliation on. |
| `historical_replay.rolling.historical_metrics_ingestion_confirmed` | 5 | No | Not set | `true`, `false` | Deprecated. Computers ignore it. Use `destinations[].backfill_opt_out` instead. |
| `historical_replay.rolling.legacy_fidelity_retirement_authority_confirmed` | 5 | No | `false` | `true`, `false` | `true` lets rolling reconciliation replace backfill data that older releases sent. It needs `enabled` `true`. |
| `historical_replay.rolling.window_days` | 5 | No | `0` | `0`, `30` | Number of days to reconcile. `0` uses the backfill window of the computer, which is 30 days by default. |
| `historical_replay.rolling.sources` | 5 | No | No sources | Up to 64 unique values from `claude_code`, `codex`, `cursor`, `pi`, `opencode`, `cline`, `gemini`, `agy`, `goose`, `copilot`, `droid`, `hermes`, `openhands`, `aider`, `continue`, `codebuff`, `amp`, `omp`, `kilo`, `kiro`, `qwen`, `mistral_vibe`, `grok`, `devin`, `qoder`, `zcode`, `kimi`, `warp`, `vscode_copilot`, `windsurf`, `zed`, `gptme`, `codewhale`, `forgecode`, `commandcode`, `muse`, `claude_desktop` | Clients whose sessions Trajectory reconciles. When `enabled` is `true`, the list must not be empty. |
| `historical_replay.rolling.metric_slices` | 5 | No | All metric groups | Up to 8 of `model_consumption`, `spend`, `adoption`, `engineering_output`, `agent_workflow`, `outcomes` | Kept for compatibility. Reconciliation always covers every metric group. |
| `historical_replay.rolling.acknowledge_engineering_output_limitations` | 5 | No | `false` | `true`, `false` | Kept for compatibility. Rolling reconciliation does not use it. |

### Removed settings

| Setting | Version | Required | Default | Allowed values | Description |
| --- | --- | --- | --- | --- | --- |
| `sensitivity_scanning.mode` | 3 | Yes | - | `off`, `balanced`, `near_realtime` | Removed. Computers ignore it. |
| `sensitivity_scanning.near_realtime_interval_minutes` | 3 | Yes | - | An integer from 1 to 10080 | Removed. Computers ignore it. |
| `sensitivity_scanning.monthly_budget_usd` | 3 | Yes | - | A number from 0 to 1000000000 | Removed. Computers ignore it. |
| `sensitivity_scanning.session_end_timeout` | 3 | Yes | - | A positive duration of up to 32 characters, such as `30m` | Removed. Computers ignore it. |

Trajectory no longer has sensitivity scanning. `trajectory-mdm` still accepts
`sensitivity_scanning` and the destination `privacy` object, and computers
ignore them. Leave them out of new settings files. To remove them from
computers that run older releases, follow
[Removed sensitivity settings](MANAGED-ENDPOINTS.md#removed-sensitivity-settings).

<!-- END INTENT SETTINGS -->

## Versions

Each `schema_version` accepts all settings of the lower versions. It also adds
the settings in this table:

| Version | Adds | Also requires |
| --- | --- | --- |
| 1 | Deployment settings and clients only | - |
| 2 | `destinations` | At least one destination |
| 3 | `organization_sync`, `cohort`, `sensitivity_scanning` | At least one destination |
| 4 | `organization_sync.files`, `binary_update` | At least one destination, and `organization_sync` with `files` |
| 5 | Organization behavior settings, security modules, pricing, backfill, and the version 5 destination fields | At least one destination, and `organization_sync` with `files` |

Destinations need API keys, and only Jamf Pro delivers API keys. So use
version 1 with every provider except Jamf Pro on macOS.

## trajectory-mdm Commands

For the help text of one command, run `trajectory-mdm help COMMAND` or
`trajectory-mdm COMMAND --help`. An option takes a value, unless its
description starts with "Switch". Use the helper from the release that you
deploy.

<!-- BEGIN TRAJECTORY-MDM OPTIONS -->

### `trajectory-mdm prepare`

Makes a deployment bundle for one provider and platform. Describe the
deployment in one of these three ways:

- a source settings file, with `--file`,
- options: `--provider`, `--platform`, `--deployment-id`, and `--clients`,
- answers to questions, with `--interactive`.

You cannot use `--file` together with `--provider`, `--platform`,
`--deployment-id`, `--clients`, `--migration-mode`, `--tag`, `--interactive`,
or `--yes`.

Jamf Pro and Intune bundles for macOS need `--release-json` and `--checksums`.

| Option | Default | Description |
| --- | --- | --- |
| `--file` | Not set | Source settings file. `trajectory-mdm` reads it as YAML when the name ends in `.yaml` or `.yml`, and as JSON otherwise. |
| `--output` | `trajectory-PROVIDER-PLATFORM-DEPLOYMENT_ID.zip` | Path of the bundle zip file. |
| `--force` | Off | Switch. Replaces an existing output file. |
| `--format` | `text` | Output format: `text` or `json`. |
| `--release-json` | Not set | The GitHub release record that you saved, `public-release.json`. |
| `--checksums` | Not set | The `checksums.sha256` file of the release. |
| `--architecture` | `universal` | Architecture of the macOS binary: `universal`, `arm64`, or `amd64`. |
| `--operation` | `install` | Operation of the installation script: `install` or `update`. |
| `--profile-revision` | `1` | Revision of the configuration profile, from 1 to 9007199254740991. Increase it for every change. |
| `--personal-sha256` | Not set | SHA-256 of an existing personal binary, from the `checksums.sha256` file of its release. Use it for the first macOS migration. |
| `--provider` | Not set | Policy ID of your MDM product. Use it without `--file`. |
| `--platform` | Not set | `macos` or `windows`. Use it without `--file`. |
| `--deployment-id` | Not set | Deployment ID. Use it without `--file`. |
| `--clients` | Not set | Client IDs, separated by commas. Use it without `--file`. |
| `--tag` | Not set | One `key=value` tag. Use it without `--file`. Repeat the option for more tags. |
| `--migration-mode` | `update-in-place` | `update-in-place`, `clean-reinstall`, or `replace-untrusted`. Use it without `--file`. These are the `migration_mode` values, with dashes instead of underscores. |
| `--interactive` | Off | Switch. Asks for each value that the options do not give. For Jamf Pro on macOS, it writes schema version 5 with a hosted settings file. It also asks for the HTTPS server, the update authority, and the behavior settings. The review lists the settings that it does not ask for. Set those with `--file`. |
| `--behavior-settings` | Off | Switch. Use it only with `--interactive` for Jamf Pro on macOS, which already asks for the behavior settings. Other products refuse it. |
| `--yes` | Off | Switch. Shows the review of a guided run, and does not ask you to confirm. |
| `--legacy-policy-pkg` | Off | Switch. For Jamf Pro and Intune on macOS. Keeps an existing assignment of a policy package instead of the configuration profile. You cannot use it with `--profile-revision`. A guided Jamf Pro run refuses it, because a policy package cannot carry a hosted settings file. |
| `--legacy-application-pkg` | Off | Switch. Keeps an existing assignment of an application package. The bundle then has a configuration profile but no installation script. Datadog does not publish an application package. A guided Jamf Pro run then keeps update authority with your MDM, because the Trajectory updater needs the installation script. |
| `--team-id` | Not set | Optional. Leave it out. The helper already contains the expected value, and it refuses any other value. |
| `--test-build` | Not set | Reserved for Datadog's own installer testing. Leave it unset. |

### `trajectory-mdm validate`

Checks a source settings file. It does not create files. It refuses a URL that
still contains a placeholder in angle brackets, such as `<your-host>`.

| Option | Default | Description |
| --- | --- | --- |
| `--file` | Not set | Required. Source settings file, in JSON or YAML. |
| `--format` | `text` | Output format: `text` or `json`. The JSON output includes `intent_sha256`, the SHA-256 of the file. |

### `trajectory-mdm remote-defaults`

Generates the hosted settings file, `config.defaults.yaml`. The source settings
file must list `config.defaults.yaml` in `organization_sync.files`.

| Option | Default | Description |
| --- | --- | --- |
| `--file` | Not set | Required. Source settings file, in JSON or YAML. |
| `--output` | `config.defaults.yaml` | Path of the generated file. |
| `--force` | Off | Switch. Replaces an existing output file. |
| `--format` | `text` | Output format: `text` or `json`. |
| `--interactive` | Off | Switch. Asks questions to edit the behavior settings: automatic client setup, the task segmentation interval, destination service labels, and the launcher wrappers. Then it writes the file. Change destinations, tags, and other settings in the source settings file. |

### `trajectory-mdm check-remote-defaults`

Checks hosted files before you publish them on your HTTPS server. It runs the
checks that a computer runs before it applies a downloaded file. It compares
each file with the source settings file of the profile on your computers. Use
it for every hosted file, also for a file that `trajectory-mdm` did not
generate.

For each file, the command prints three items:

- whether computers accept the file,
- the SHA-256 of the file,
- where to publish the file.

If computers would reject a file, the command lists each reason and exits with
status 1. See
[Check files before you publish them](MANAGED-ENDPOINTS.md#check-files-before-you-publish-them).

| Option | Default | Description |
| --- | --- | --- |
| `--file` | Not set | Required. Source settings file of the deployed profile, in JSON or YAML. |
| `--defaults` | Not set | Required. The `config.defaults.yaml` file that you plan to publish. |
| `--markers` | Not set | Optional. The `markers.yaml` file that you plan to publish. |
| `--pricing` | Not set | Optional. The `pricing.yaml` file that you plan to publish. |
| `--format` | `text` | Output format: `text` or `json`. |

### `trajectory-mdm verify`

Rebuilds each file in a bundle and reports each file that is different. Use
the helper version that generated the bundle.

| Option | Default | Description |
| --- | --- | --- |
| `--bundle` | Not set | Required. Path of the bundle zip file. |
| `--format` | `text` | Output format: `text` or `json`. |

### `trajectory-mdm build`

Writes the compiled policy and the starter settings to a folder. Use it for
your own automation.

| Option | Default | Description |
| --- | --- | --- |
| `--file` | Not set | Required. Source settings file, in JSON or YAML. |
| `--output-dir` | Not set | Required. Folder for the compiled files. |
| `--format` | `text` | Output format: `text` or `json`. |

### `trajectory-mdm macos-installer`

Generates or checks one installation script for Jamf Pro or Intune. Each
script does one operation. Use this command for update, repair, rollback,
removal, recovery, and verification scripts. See
[Installer operations](MANAGED-ENDPOINTS.md#installer-operations).

| Option | Default | Description |
| --- | --- | --- |
| `--release-json` | Not set | The GitHub release record that you saved. Use it with `--checksums`. |
| `--checksums` | Not set | The `checksums.sha256` file of the release. |
| `--version` | Not set | Required. Target release version, such as `1.2.3`. It must match the helper version. |
| `--architecture` | `universal` | `universal`, `arm64`, or `amd64`. Use the architecture of the installation. |
| `--provider` | Not set | Required. `jamf` or `intune`. |
| `--output-dir` | Not set | Required. A new folder for the script. With `--verify`, the existing folder to check. |
| `--operation` | `install` | `install`, `update`, `repair`, `rollback`, `remove`, `recover`, or `verify`. |
| `--migration-mode` | `update-in-place` | `update-in-place`, `clean-reinstall`, or `replace-untrusted`. It applies when the script first adopts a personal installation. |
| `--personal-sha256` | Not set | SHA-256 of the existing personal binary, from the `checksums.sha256` file of its release. Never compute it from the binary on the computer. |
| `--verify` | Off | Switch. Rebuilds the scripts and compares them with `--output-dir`. It does not write files. |
| `--team-id` | Not set | Optional. Leave it out. The helper already contains the expected value, and it refuses any other value. |
| `--test-build` | Not set | Reserved for Datadog's own installer testing. Leave it unset. |

### `trajectory-mdm providers`

Lists the supported MDM products and their platforms.

| Option | Default | Description |
| --- | --- | --- |
| `--platform` | Not set | Shows only the products for `macos` or `windows`. |
| `--format` | `text` | Output format: `text` or `json`. |

### `trajectory-mdm schema`

Prints the JSON Schema for source settings files, or writes it to a file.

| Option | Default | Description |
| --- | --- | --- |
| `--output` | Not set | Path of the output file. The file name must be `managed-endpoint-intent.schema.json`. Without this option, the command prints the schema to standard output. |

### `trajectory-mdm rollout-decision`

Decides which release one computer gets when your MDM controls updates. It
reads one JSON input and prints the decision with a receipt. The output does
not include the host identity of the computer.

| Option | Default | Description |
| --- | --- | --- |
| `--file` | Not set | Required. The JSON input file, or `-` for standard input. |

### `trajectory-mdm version`

Prints the release version of the helper. It has no options.

<!-- END TRAJECTORY-MDM OPTIONS -->
