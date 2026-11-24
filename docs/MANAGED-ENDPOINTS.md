# Managed Endpoint Administrator Guide

This guide is for IT and endpoint administrators who deploy Trajectory to
developer computers with an MDM product. It shows how to deploy, configure,
check, update, and remove Trajectory.

## Before You Start

### Supported platforms and MDM products

Trajectory runs on managed macOS and Windows computers. Datadog supports and
tests Trajectory on Apple Silicon Macs. Intel Macs can install the universal
binary, but Datadog does not support or test them.

On macOS, Trajectory needs macOS 12.0 or later. The Jamf Pro and Intune
scripts install the universal binary, which runs on both kinds of Mac.

The deployment method depends on your MDM product:

| MDM product and platform | Application | Settings | Datadog API keys |
| --- | --- | --- | --- |
| Jamf Pro on macOS | Jamf script | Configuration profile | Delivered by Jamf Pro |
| Microsoft Intune on macOS | Intune script | Configuration profile | Not delivered |
| Other products on macOS, and all products on Windows | Not included | Policy package | Not delivered |

Datadog supports installing the application through MDM only with Jamf Pro
and Intune on macOS. Datadog publishes the `trajectory` binaries, the
`trajectory-mdm` helpers, and checksums. It does not publish a PKG or MSI
application package.

Datadog destinations need API keys, so they work only with Jamf Pro on macOS.
With every other product, use intent schema version 1. It sets up the
coding-agent clients only.

Use the policy ID from this table in your intent file:

<!-- BEGIN MANAGED PROVIDER IDS -->
| Provider | Policy ID | macOS | Windows |
| --- | --- | :---: | :---: |
| Addigy | `addigy` | Yes | - |
| Cisco Meraki Systems Manager | `cisco_meraki` | Yes | Yes |
| Fleet | `fleet` | Yes | Yes |
| Hexnode UEM | `hexnode` | Yes | Yes |
| Microsoft Intune | `intune` | Yes | Yes |
| Ivanti Neurons for MDM | `ivanti` | Yes | Yes |
| Jamf Pro | `jamf` | Yes | - |
| JumpCloud | `jumpcloud` | Yes | Yes |
| Kandji | `kandji` | Yes | - |
| IBM Security MaaS360 | `maas360` | Yes | Yes |
| ManageEngine Endpoint Central | `manageengine` | Yes | Yes |
| Mosyle | `mosyle` | Yes | - |
| NinjaOne Endpoint Management | `ninjaone` | Yes | Yes |
| Rippling Device Management | `rippling` | Yes | Yes |
| Scalefusion UEM | `scalefusion` | Yes | Yes |
| SimpleMDM | `simplemdm` | Yes | - |
| SOTI MobiControl | `soti` | Yes | Yes |
| Omnissa Workspace ONE | `workspace_one` | Yes | Yes |
| Other endpoint manager | `other` | Template | Template |
<!-- END MANAGED PROVIDER IDS -->

Use `other` for a product that is not in the table. Its bundle has generic
scripts that you map to your product's features.

### What you need

- An administrator computer with macOS, Linux, or Windows to run the
  `trajectory-mdm` helper.
- The Trajectory release that you want to deploy.
- Network access from each computer to GitHub, where the Jamf Pro and Intune
  scripts download the release. The computers do not need to reach Apple's notarization
  service. For the reason, see
  [Apple notarization checks](#apple-notarization-checks).
- For Jamf Pro destinations: your Datadog site and an API key for each
  destination.
- For remote configuration: an HTTPS server that computers can reach without a
  browser sign-in.
- On macOS, a signed-in standard user (UID 501 or higher) who owns their home
  folder.

## How A Deployment Works

You run the `trajectory-mdm` helper on your administrator computer. Never
install it on employee computers.

1. You write an intent file, such as `trajectory-managed.json`. It names the
   MDM product, the platform, the coding-agent clients, and optional Datadog
   destinations.
2. `trajectory-mdm prepare` turns the intent into a deployment bundle (a zip
   file). For Jamf Pro on macOS, the bundle has a Jamf script and a
   configuration profile. For Intune on macOS, it has the same script, made
   for Intune, and a configuration profile.
3. You assign the script and the profile to the same computers in your MDM.
4. The script keeps a Trajectory binary for root that is signed by Datadog and
   answers the kit's launcher interface. Otherwise it downloads the kit's
   release R, the release of the `trajectory-mdm` that prepared the kit, from
   GitHub. The script reads no release list and no update setting, so the
   update ring does not change this release.
5. Every run of the script calls `trajectory mdm launch` as root. Launch runs
   `mdm user-install` as the signed-in user. It uses that user's own copy at
   `~/.trajectory/bin/trajectory` when it works. Otherwise it uses its own
   binary, which first places itself there. The user's copy applies the
   profile's settings, sets up the clients, and moves itself to newer releases.

The script checks Datadog's Apple signature, the architectures, and the
launcher interface of a binary it downloads. Trajectory's updater also checks the release's checksum.
Each refuses a binary that fails its checks.

## Deploy Trajectory

These steps are for Jamf Pro and Intune on macOS. For other products and for
Windows, see
[Deploy with other products or on Windows](#deploy-with-other-products-or-on-windows).

### Step 1: Get the helper

Download the helper for your administrator computer, and `checksums.sha256`,
from the release that you deploy:

| Administrator computer | Release file |
| --- | --- |
| macOS | `trajectory-mdm-darwin-universal` |
| Linux amd64 | `trajectory-mdm-linux-amd64` |
| Linux arm64 | `trajectory-mdm-linux-arm64` |
| Windows amd64 | `trajectory-mdm-windows-amd64.exe` |

1. Compare the helper's SHA-256 with its line in `checksums.sha256`. Do not use
   a helper that does not match.
2. On macOS or Linux, make the file executable and rename it to
   `trajectory-mdm`.
3. Run `trajectory-mdm version` to confirm the release version.

The helper carries a setup guide for its release. To list its topics, run
`trajectory-mdm user-guide`. It explains each choice in the intent file
and says which files go to your MDM, which ones you host, and where API keys
go. It is written for you and for a coding agent that helps you set up.

To let a coding agent help you, run this command in your deployment folder,
then open the agent there:

```bash
trajectory-mdm agent-instructions --dir .
```

It writes `AGENTS.md` and `CLAUDE.md`. They tell the agent to read the guide,
to check each change with `validate` and `verify`, and never to ask for an API
key. Agents that support plugins can also use the `trajectory-mdm-setup` skill
from the `trajectory-mdm` plugin in the public Trajectory marketplace.

Linux and Windows helpers have no Apple signature, so the checksum is their
only check. Keep a copy of each helper that you deploy.
`trajectory-mdm verify` needs the helper release that generated the bundle.

### Step 2: Write the intent file

The intent file is a JSON or YAML file that your organization owns. Keep it in
source control. This Jamf Pro example sets up Claude Code and Codex and sends
data to one Datadog destination:

<!-- BEGIN INTENT JSON EXAMPLE -->
```json
{
  "schema_version": 2,
  "deployment_id": "engineering-coding-agents",
  "clients": ["cc", "codex"],
  "tags": {"team": "developer-experience"},
  "destinations": [
    {
      "name": "primary",
      "type": "dd_llmobs",
      "site": "datadoghq.com",
      "ml_app": "trajectory",
      "level": "standard",
      "api_key_ref": "dd-primary-api-key"
    }
  ]
}
```
<!-- END INTENT JSON EXAMPLE -->

Keep `deployment_id` the same for every revision. For the Jamf Pro bundle,
`trajectory-mdm` fills in `provider`, `platform`, and `migration_mode` as
`jamf`, `macos`, and `update_in_place`, so the example leaves them out. For
Intune, use `"schema_version": 1`, write `"provider": "intune"` and
`"platform": "macos"`, and leave out `destinations`. `api_key_ref` is the name of the keychain entry that will hold
the API key. Never put a key or other secret in the intent file. See the
[Managed Endpoint Settings Reference](MANAGED-ENDPOINT-SETTINGS.md)
for every setting, its default, and its allowed values.

To set the update ring that a generated `config.defaults.yaml` names, use
`schema_version` 5 and add `"deployment": {"ring": "beta"}`. The Jamf script
does not read it. See [Update ring](#update-ring).

To run the checks of `prepare` without creating a bundle, run
`trajectory-mdm validate --file trajectory-managed.json`. It refuses a URL
that still contains a placeholder in angle brackets, such as `<your-host>`.

Text copied out of a document, an email, or a chat can bring characters you
cannot see. Every command that reads an intent with `--file` refuses one that
contains a zero-width character, a private-use character, or a non-breaking
space in the indentation. The error names the character's code point, line, and column,
for example `line 1, column 1: invisible character U+E907`. Delete the
character and retype the line, or copy the file again from its source. A byte
order mark at the very start of the file is allowed.

You can also answer questions instead of writing JSON. Run
`trajectory-mdm prepare --interactive`. It asks for the MDM product, the
clients, and optional tags. For other MDM products and for Windows, it also
asks how to
[migrate existing installations](#choose-how-to-migrate-existing-installations).
Jamf Pro and Intune bundles keep a working binary of any release, so it does
not ask for them. It shows the whole deployment for review before it creates
the bundle.

For Jamf Pro on macOS, the answers give the same kind of deployment as an
intent file with `schema_version` 5. The helper also asks for these settings:

- The HTTPS server for your hosted settings file, and how often computers
  download from it. See
  [Change behavior without redeploying the profile](#change-behavior-without-redeploying-the-profile).
- Your destinations and their keychain entry names. It never asks for API
  keys.
- Your email domain for user identity, such as `@example.com`. Leave it
  blank to leave `identity` out.
- Automatic setup of clients that users install later, a service label for
  each destination, and the optional launcher wrappers.

It asks nothing about updates: your hosted settings file decides them. See
[Choose how computers update](#choose-how-computers-update).

If you have no HTTPS server, write the intent file instead. The review lists
the settings that the questions leave out, such as `security_modules` and
`publish_trust`. To set them, write an intent file and run `prepare --file`.

#### Write the intent as commented YAML

`trajectory-mdm` also reads the intent from a YAML file named
`trajectory-managed.yaml` or `trajectory-managed.yml`. YAML allows comments, so
one commented file can be the source of truth for a deployment. This file holds
the same intent as the JSON example above:

<!-- BEGIN INTENT YAML EXAMPLE -->
```yaml
# trajectory-managed.yaml: Trajectory deployment intent. Comments are ignored.
schema_version: 2                         # intent contract version
deployment_id: engineering-coding-agents  # keep this ID for every revision
clients: [cc, codex]                      # coding agents to set up
tags:                                     # optional, non-secret telemetry tags
  team: developer-experience
destinations:                             # where Trajectory sends data
  - name: primary
    type: dd_llmobs
    site: datadoghq.com
    ml_app: trajectory
    level: standard
    api_key_ref: dd-primary-api-key       # keychain entry name, never the key
```
<!-- END INTENT YAML EXAMPLE -->

`validate`, `build`, `prepare --file`, and `remote-defaults --file` accept both
formats. The file name selects YAML. YAML follows the same JSON Schema and the
same validation as JSON, and the same settings produce byte-identical bundles.
The bundle always contains the JSON form, `trajectory-managed.json`, and
`verify --bundle` works the same way. Every JSON snippet in this guide can
be written as YAML. YAML also accepts JSON's `[...]` and `{...}` forms, so a
snippet's value can be pasted unchanged.

Some YAML features can change a value without the reader noticing, so the
helper refuses them and names the line and field:

- Quote text that YAML could read as another type. Unquoted `yes`, `no`, `on`,
  `off`, `y`, and `n` are booleans in YAML 1.1 but text in YAML 1.2. So write
  `true` or `false` for a boolean, and quote the text (`"yes"`). Quote IDs and
  tag values that look like numbers or dates, such as `"0420"`, `"2024"`,
  `"1:30"`, or `"2026-10-02"`.
- Write numbers in decimal, such as `3600` or `12.5`. Octal, hexadecimal,
  `1_000`, `+1`, `.inf`, and `.nan` are refused.
- Give every field a value. Intent fields never accept null, so an empty value,
  `~`, or `null` is refused. Remove a field to leave it unset.
- Keep one document per file, without anchors (`&`), aliases (`*`), merge keys
  (`<<`), or tags (`!`).
- Use each key once per mapping, as in JSON.

`validate --format json` reports `intent_sha256` as the digest of the file you
supplied, in either format.

### Step 3: Generate and verify the bundle

Generate the bundle. For Jamf Pro:

```bash
trajectory-mdm prepare --file trajectory-managed.json --output trajectory-deployment.zip
```

For Intune, `--profile-revision` defaults to 1. A Jamf Pro bundle chooses its
own profile revision. Add `--force` to replace an existing output file.

Check the bundle before you upload it:

```text
trajectory-mdm verify --bundle trajectory-deployment.zip
```

The verifier rebuilds every file and reports any file that differs. Use the
same helper version that generated the bundle.

A Jamf Pro bundle has these files to upload:

- `trajectory-jamf.sh`, the Jamf script.
- `trajectory.mobileconfig`, the configuration profile.
- `adapter/`, the extension attribute and detection scripts.
- `README.md` and `provider-notes.md`, the steps for Jamf Pro.

An Intune bundle has these files to upload:

- `trajectory-intune.sh`, the Intune script: the Jamf script, made for Intune.
- `trajectory.mobileconfig`, the configuration profile.
- `adapter/`, the custom attribute and detection scripts.
- `README.md` and `provider-notes.md`, the steps for Intune.

Do not edit generated files. To change the deployment, edit the intent and
generate a new bundle.

After the bundle, `prepare` prints the next steps. They list each file that
you host at `config_source`, with its URL, and say which ones come from the
bundle and which ones you write. For Jamf Pro, the last step names the script
parameter that takes each API key.

#### Warnings

`validate`, `build`, and `prepare` print a warning for a setting that is
accepted but sends less than you might expect. A warning does not stop the
command. With `--format json`, the warnings are in the `warnings` field, each
with a `code` and the `field` it refers to.

| Code | When | What to do |
| --- | --- | --- |
| `markers_not_fetched` | `organization_sync.files` does not list `markers.yaml`, so computers never download `markers_path`. | Add the `markers.yaml` entry, or leave it out if you do not host a markers file. |
| `releases_ignored_under_mdm` | A Windows intent's `files` lists `RELEASES.json`. Your MDM installs each release on Windows, so computers do not use the file. | Remove the entry. |
| `deployment_json_selected` | `files` lists `deployment.json`. Computers still download it, but they no longer use it. The update ring and `deployment.minimum_version` choose the release. | Remove the entry, then stop hosting the file. To approve releases, host [`RELEASES.json`](#approve-releases-with-releasesjson) and list it instead. |
| `level_off` | A destination has `level: off`. It receives metrics but no LLM Observability traces. | For traces, set `level` to `standard`. A destination with Agent Security metrics needs `off`, so add a separate destination for traces. |
| `ring_not_hosted` | A package kit's intent sets `deployment.ring`, but `organization_sync.files` does not list `config.defaults.yaml`. Its computers never read the ring. A Jamf or Intune macOS kit's profile carries the ring. | To have computers follow the ring, list `config.defaults.yaml` and publish the generated file. See [Update ring](#update-ring). |
| `migration_mode_retired` | The intent sets `migration_mode: replace_untrusted`, which earlier releases accepted. The kit uses `update_in_place`: the Jamf Pro and Intune scripts keep a working binary of any release. | Remove `migration_mode` from the intent. |
| `minimum_version_early_releases_refuse` | The intent sets `deployment.minimum_version` and lists `config.defaults.yaml`, so the generated hosted file sets the floor. Releases up to 0.6.3-beta.5 refuse that whole file. | Publish it only once every computer on that configuration source runs a later release. |
| `minimum_version_not_release` | The intent's `deployment.minimum_version` is not a release, such as `latest`. `trajectory-mdm` ignores it, so only `prepare --minimum-version` can give the kit a floor. | Set a release, such as `0.6.5`, or remove `deployment.minimum_version`. |
| `markers_metrics_off` | A destination sets `markers.metrics: false`. It gets no turn, session, cost, or marker metrics. Its only metrics are session start counts and deployment heartbeats. | Set `markers.metrics` to `true`. |
| `api_key_in_intent` | A destination's `api_key_ref` looks like an API key. | Set it to the name of the keychain entry, such as `dd-primary-api-key`. Enter the key itself only in your MDM. |
| `managed_reconcile_backoff_retired` | The intent sets `features.managed_reconcile_backoff`, which no longer changes anything. | Remove it from the intent. |
| `unified_backfill_workflow_retired` | The intent sets `features.unified_backfill_workflow`. `trajectory backfill` always runs on release 0.6.1 and later, so it no longer changes anything there. | Remove it from the intent. |

### Step 4: Assign the bundle in your MDM

Create one MDM item for each script and one for each profile. Assign them to
the same computers. Assign the profiles first, and check that they reach a
computer before a script runs there. Each script starts as root, finds the
signed-in user, and sets up Trajectory as that user. Each run sets up only
that user. On a Mac that several people use, each of them needs a run while
they are signed in. For Jamf Pro, see [Jamf Pro](#jamf-pro) and
[Jamf policy settings](#jamf-policy-settings). For Intune, see
[Microsoft Intune](#microsoft-intune).
[Read a Jamf script run's result](#read-a-jamf-script-runs-result) and
[Script messages and exit codes](#script-messages-and-exit-codes) list every
line the scripts print.

Roll out to a few test computers first, then a small group of users, then
everyone.

#### Jamf Pro

The Jamf Pro bundle has one Jamf script, `trajectory-jamf.sh`. It carries
the download link of one release, the kit's release R. R is the release of
the `trajectory-mdm` that prepared the kit. The bundle's `README.md` describes what the script does and
how it uses a proxy.

The bundle does not choose the release that a Mac runs. After the first
rollout, move Macs to new releases in your hosted `config.defaults.yaml`, with
`deployment.minimum_version`, `auto_update`, and `deployment.ring`. You need
no new bundle. See [New releases on Jamf Macs](#new-releases-on-jamf-macs).

Configure these items, and scope them to the same computers:

1. In **Computers > Configuration Profiles**, upload `trajectory.mobileconfig`.
   Choose **Computer Level**. Keep the payload identifiers and UUIDs.
2. Upload `trajectory-jamf.sh` as a Jamf script.
3. Create the login policy and the daily policy that run it, as
   [Jamf policy settings](#jamf-policy-settings) describes.
4. Add `adapter/configuration-inventory.sh` as an extension attribute of type
   String. It reports which clients are set up. See
   [Check each client](#check-each-client).
5. Use `adapter/package-policy-check.sh` in a recurring check-in policy for
   detection.

We recommend one more computer extension attribute,
`adapter/extension-attribute.sh`, so that Jamf inventory shows each Mac's
setup. It reports Trajectory's own state for the signed-in user, from
`trajectory managed status`, also between runs. Nothing in the script or in
setup depends on it.

Update Inventory is optional on both Jamf policies. See
[Jamf policy settings](#jamf-policy-settings).

Each run of the script runs `trajectory mdm launch` as root, from a binary
that only root can change. Launch sets up the user signed in at the console,
as that user. Root writes nothing in the home folder. With nobody signed in,
the run sets up nobody and exits 0. It installs no LaunchAgent or
LaunchDaemon.

Install takes the signed-in user's home folder from the macOS user
directory. It uses that folder only when it is a real folder that the user
owns, with no link in its path. The directory may name no such folder, or two
different ones. Then every run sets up nobody and says so in its summary line,
until you fix the folder or the user record. A record can differ from the
folder's own name only in case, such as `/Users/ADMIN` for the folder
`/Users/admin`. It still names that folder, and Trajectory spells its paths
with the folder's own name. To check, run
`dscl . -read /Users/<user> NFSHomeDirectory` and `ls -ld` on each folder it
names. A run takes at most 30 minutes. At that limit it stops the step it
reached, reports the limit, and the next run finishes the work.

Root never runs a file that another account can change. When another account
can change a folder above the binary, such as `/Library/Application Support`,
the run stops with `script_error` and runs nothing. The script never deletes a
binary. Launch keeps the user's own binary when it answers the launcher
interface, including one that the user installed before, whatever its release.
Otherwise it copies its own binary over it. After that, Trajectory moves the
user's copy to newer releases. See
[New releases on Jamf Macs](#new-releases-on-jamf-macs).

On a Mac whose network settings set an HTTPS proxy, the script sends its own
requests through it. After an HTTP 407, it tries that request once more
without the proxy. The API key check also uses this proxy, but the rest of
the user's setup does not. On a Mac that reaches the internet only through a
proxy, that setup fails when it needs the network, and the run reports
`install_failed`. The bundle's `README.md` has the details.

If the intent has destinations, deliver the API keys:

1. Open `adapter/credential-parameters.json`. It shows which script parameter
   holds each key, from parameter 4 to parameter 11.
2. Enter each API key in its script parameter, on both policies.

Enter the keys only in Jamf Pro. The script passes them on standard input to
the user's copy. It checks each key's form and asks Datadog's key check about
it before it stores any in the user's login keychain. A missing or invalid
key, or a keychain that cannot take a key, stops the run with exit code 2. The next daily run stores the keys. See
[API keys were not stored](#api-keys-were-not-stored).

See the Jamf Pro documentation on
[computer extension attributes](https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Computer_Extension_Attributes).

#### New releases on Jamf Macs

Neither the Jamf script nor a Jamf policy updates Trajectory, and the
configuration profile has no update settings. Trajectory moves its own
release on every login or daily run of the script, as your hosted
`config.defaults.yaml` says. Each move installs the release that the
[update ring](#update-ring) names, never an older one:

1. **Below the minimum version.** A Mac that runs a release below
   `deployment.minimum_version` is updated, whatever `auto_update` says. See
   [Roll out the version floor](MANAGED-ENDPOINT-SETTINGS.md#roll-out-the-version-floor).
2. **Otherwise, `auto_update` decides:**

| `auto_update` in the hosted file | What happens |
| --- | --- |
| Not set | Each run updates the Mac when the ring names a newer release. |
| `true` | The same, and Trajectory also checks the ring about once an hour while its background service runs. See [Turn on automatic updates](#turn-on-automatic-updates). |
| `false`, as `trajectory-mdm` generates it | The Mac keeps the release that it has. Raise the minimum version to move it. |

To hold Macs at a release without `auto_update: false`, pin the ring's release
with a [hosted `RELEASES.json`](#approve-releases-with-releasesjson).

A new bundle does not move Macs to a new release. To deploy a new bundle,
follow the steps in [Jamf Pro](#jamf-pro). Bundles from
`trajectory-mdm` 0.6.4-beta.3 or earlier call `install --format jamf`, which
later releases removed. Once their Macs update past that release, deploy a new
bundle to them.

#### Jamf policy settings

<!-- BEGIN GENERATED BLOCK jamf-script-policies -->
<!-- Generated shared block jamf-script-policies: edit its source file, then run public-doc-tables.py render. -->

Assign the configuration profile first. Then create two policies that run
`trajectory-jamf.sh`, scoped to the same computers. Give both the same API key
parameters, from parameter 4 to parameter 11:

| Policy | Trigger and execution frequency |
| --- | --- |
| Login | **Login**, **Once per user per computer** |
| Daily | **Recurring Check-in**, **Once every day** |

Both policies run the same script, and every run does the same work.

Why these settings:

- **The login policy sets up each user at sign-in.** Each user gets their own
  binary, keychain items, and settings, and every run sets up only the user
  who is signed in. With **Once per user per computer**, Jamf runs the policy
  once for each user who signs in on the Mac. Jamf runs Login policies only
  when login events are turned on in the computer check-in settings.
- **The daily policy repairs the setup.** It puts back a missing or untrusted
  root copy of the binary, stores the API keys again, and runs
  `mdm user-install` again. A run with nobody signed in sets up nobody and
  exits 0.
- **Update Inventory is optional on both policies.** You set it in a policy's
  **Maintenance** payload. When you use the Trajectory extension attributes,
  turning it on shows their values in Jamf Pro right after the run. Without
  it, their values arrive at the computer's next scheduled inventory update.
- **The script does not update Trajectory.** On each run, `mdm user-install`
  moves the user's copy as your organization's config says. A Mac below
  `deployment.minimum_version` always goes to the ring's release. Otherwise
  each run updates it to the ring's release unless the config sets
  `auto_update: false`. With `auto_update: true`, Trajectory also checks for
  updates about once an hour while its background service runs.
- **A nonzero exit code needs your action.** Exit code 1 means the binary
  could not be placed or cannot do what the script asks. It also means the Mac
  is not set up for the script (`script_error`). Exit code 2 means the API
  keys are missing, invalid, or could not be stored. Exit 0 problems are
  fixed by the next run or by Trajectory itself.
- **After you fix the cause, the next daily run sets the Mac up.** With
  **Once per user per computer**, Jamf does not repeat a failed login run for
  that user. To set the user up sooner, flush that computer's entry in the
  login policy logs.

When you rotate an API key, change it in both policies. The next run stores
the new key. Settings that the configuration profile holds change only with a
new profile, never with a script run.
<!-- END GENERATED BLOCK jamf-script-policies -->

#### Read a Jamf script run's result

<!-- BEGIN GENERATED BLOCK jamf-script-output -->
<!-- Generated shared block jamf-script-output: edit its source file, then run public-doc-tables.py render. -->

Each run of `trajectory-jamf.sh` ends with an exit code, and Jamf keeps the
lines the run prints in the policy log. The script runs
`trajectory mdm launch` from the binary that root runs and exits with launch's
exit code, which it passes on without reading. Launch runs the signed-in
user's own copy of Trajectory, which prints the report.

| Exit code | When | What to do |
| --- | --- | --- |
| `0` | Success, or a problem that the next run or Trajectory itself fixes: a setup that Trajectory does not confirm yet, a failed install, a time limit reached, nobody signed in, a user that launch could not resolve or set up, a user's copy that stopped or gave no result, another run in progress, an unreachable key check, or a refused configuration profile. Launch's one summary line in the policy log says why. | Nothing, unless it repeats. Then read `mdm-script.log`. A refused configuration profile means profiles of two deployments are installed: keep one Trajectory profile on each Mac by scoping. |
| `1` | The script could not place the binary that root runs: the download, trust check, or write failed, or the run reached its 30-minute time limit first. Or a folder the script uses is not one that only root can change. Or the user's copy cannot do what the script asks. | Fix the cause, such as network access to GitHub, or deploy a kit that the binary supports. The next daily run tries again. |
| `2` | The API keys are missing, invalid, or could not be stored: a parameter is empty or in the wrong form, Datadog rejected a key, the user's keychain could not take it, for example because it is locked, or the run reached its time limit before they were stored. | Fix the API key parameters in both policies, or ask the user to unlock the keychain. The next daily run tries again. |

The user's copy prints one `TRAJECTORY_STEP` line for each of its steps, one
`TRAJECTORY_SUMMARY` line, and one `TRAJECTORY_RESULT` line, which is always
last. A run that found no problem prints:

```text
TRAJECTORY_STEP step=api_keys outcome=stored reason=none
TRAJECTORY_STEP step=install outcome=ok reason=none
TRAJECTORY_SUMMARY Trajectory is set up for the signed-in user.
TRAJECTORY_RESULT schema=4 outcome=ok exit_code=0 reason=none api_keys=stored install=ok
```

- A `TRAJECTORY_STEP` line names the step, its outcome, and its reason. The
  steps are `api_keys` and `install`, in the order they run. The user's copy
  stores the keys (`api_keys`) and sets the user up (`install`). `install` is
  `unconfirmed` when the install finished but Trajectory's status check does
  not confirm the setup. It is also `unconfirmed` when the time limit came
  first.
- The `TRAJECTORY_SUMMARY` line is one sentence for you to read. When the
  user's copy gave no report, launch prints only this line, which says what
  happened.
- The `TRAJECTORY_RESULT` line has these `key=value` fields, in this order:
  `schema`, `outcome`, `exit_code`, `reason`, `api_keys`, and `install`. A
  later release adds fields only at the end.

When the script stops before launch, for example because it could not
download the binary, the policy log holds no lines, only the exit code. The
script writes why to
`/Library/Application Support/Trajectory/mdm-script/mdm-script.log`, with what
launch printed on its standard error. Each run starts the file anew, so it
holds only the last run. The script's own metrics report its `binary` step,
the versions, and launch's exit code as a number.
<!-- END GENERATED BLOCK jamf-script-output -->

The [MDM script metrics](metrics/mdm-script-metrics.md) page lists
every outcome and reason, with what each one means, and the metrics that the
script sends to Datadog.
Every metric identifies the Mac only by `trajectory.device_id`, the Mac's
hardware UUID, which Jamf inventory shows as the UDID.

##### Check a Mac's last run

<!-- BEGIN GENERATED BLOCK jamf-script-status -->
<!-- Generated shared block jamf-script-status: edit its source file, then run public-doc-tables.py render. -->

The Jamf policy log for a computer shows each run's report. Between runs,
`adapter/extension-attribute.sh` shows Trajectory's own state for
the signed-in user in Jamf inventory. The script's metrics report each run to
Datadog.

A kit built at 0.6.4-beta.3 or earlier also had a script status extension
attribute. Delete it from Jamf Pro. Nothing writes the file it reads now.
<!-- END GENERATED BLOCK jamf-script-status -->

#### Microsoft Intune

The Intune bundle's script, `trajectory-intune.sh`, is the Jamf script made
for Intune, and it works the same way. Each run keeps or places the binary
that root runs. Then it runs `trajectory mdm launch` as root, which sets up
the signed-in user as that user. The Intune bundle delivers no
API keys, so the script passes none.

1. Under **macOS shell scripts**, upload `trajectory-intune.sh`.
2. Set **Run script as signed-in user** to **No**. Set a **Script frequency**,
   such as every day, and keep a retry limit for nonzero exits.
3. In **Devices > macOS > Configuration > Create**, choose
   **Templates > Custom**.
4. Upload `trajectory.mobileconfig`, and choose the **Device channel**. Keep
   the payload identifiers and UUIDs.
5. Add `adapter/custom-attribute.sh` as a custom attribute.
6. Add `adapter/configuration-inventory.sh` as a second custom attribute of
   type String. It also reports which clients are set up. See
   [Check each client](#check-each-client).

The script adds no background job. With nobody signed in, it changes nothing
and exits 0. It exits 1 only when it cannot place the binary or the binary cannot do
what the script asks. Otherwise it exits 0, so a scheduled run retries.

Each run sets up only the user who is signed in at that time. On Macs that
several people use, the **Script frequency** decides when each user is set
up. A user who is never signed in during a run is not set up. A new run for a
user who is already set up checks that user's setup and changes nothing.
Before you remove Trajectory, remove the script's assignment, so that a
scheduled run does not set it up again.

See the Microsoft documentation on
[macOS shell scripts](https://learn.microsoft.com/en-us/intune/device-management/tools/run-shell-scripts-macos)
and
[custom settings for macOS](https://learn.microsoft.com/en-us/intune/device-configuration/templates/configure-custom-settings-apple).

### Step 5: Verify one computer

On a test computer, run this command as the signed-in user:

```bash
~/.trajectory/bin/trajectory managed status --scope all --format json
```

The deployment works when `overall` is `compliant`. A new computer usually
goes from `pending_policy` to `pending_user` to `compliant`. When
`policy.profile` and `user.applied_profile` show the same revision, the user
has the current settings. `user.client_results` shows whether each client in
the profile is set up. See [Check each client](#check-each-client).
`release` shows the installed release, with the update ring and the version
floor that `trajectory update` follows.

The command can exit with code zero when the computer is not compliant. Read
`overall`, `reason`, and `next_step`. See [Troubleshooting](#troubleshooting).

For a Jamf Pro bundle, also read the run's report in the policy log. See
[Read a Jamf script run's result](#read-a-jamf-script-runs-result).

### Run trajectory in a terminal

User reconciliation links `~/.local/bin/trajectory` to
`~/.trajectory/bin/trajectory` when that name is free. It checks the link on
every run, including runs that find nothing else to change. So a computer that
was already compliant before an update gets the link too. Updates keep the
link working. Setup never replaces another file at that name, never
edits shell startup files, and needs no root access.

A new terminal finds `trajectory` only when `~/.local/bin` is on the user's
`PATH`. macOS does not add it by default, though many developer tools do. Tell
other users to add `~/.local/bin` to their `PATH`, or to run
`~/.trajectory/bin/trajectory`. `~/.trajectory/bin/trajectory doctor` prints
the exact command for the user's shell. Commands in this guide and in support
instructions use `~/.trajectory/bin/trajectory`, which works either way.

If the name is already taken, reconciliation leaves that entry alone and logs a
`Trajectory launcher: left ... unchanged` notice that names it. A user who does
not want the link can run
`~/.trajectory/bin/trajectory config features disable managed_trajectory_link`
and then delete the link.

### Deploy with other products or on Windows

For other MDM products, and for Windows, the bundle does not install the
Trajectory application. It contains the compiled policy, a tool to install the
policy, and scripts for detection, inventory, and user setup. The detection
script reports `install_receipt_missing` until Trajectory is installed with an
application package that writes its install receipt. Datadog does not publish
such a package.

To generate and check the bundle:

1. Write an intent file with `"schema_version": 1`.
2. Run `trajectory-mdm prepare --file trajectory-managed.json --output trajectory-deployment.zip`.
   These bundles need no release files.
3. Run `trajectory-mdm verify --bundle trajectory-deployment.zip`.
4. Read `README.md` and `provider-notes.md` in the bundle. They list each file
   and where it goes in your MDM.

On macOS, `policy-tools/build-policy-pkg.sh` builds the policy package. It
needs the `trajectory` binary from the same release. On Windows,
`policy-tools/install-policy.ps1` installs the policy in system context. If
Trajectory is not installed under Program Files, pass `trajectory.exe` from the
same release with `-TrajectoryBinary`. On Windows,
run the user setup script as the signed-in user. Trajectory refuses user
changes from SYSTEM.

## Common Choices

### Choose coding-agent clients

List only the clients that are approved for the target users. Use the client
ID from this table. The helper turns on any extra feature that a client needs.

<!-- BEGIN MANAGED CLIENT IDS -->
| Client ID | Product | Managed requirement |
| --- | --- | --- |
| `cc` | Claude Code | Standard managed setup; optional launcher wrapper through `client_command_shims` |
| `cline` | Cline CLI | Standard managed setup |
| `cursor` | Cursor Desktop | Standard managed setup |
| `agy` | Antigravity CLI | Standard managed setup |
| `goose` | Goose | Standard managed setup |
| `codex` | Codex CLI | Standard managed setup; optional launcher wrapper through `client_command_shims` |
| `copilot` | GitHub Copilot CLI | Standard managed setup; optional launcher wrapper through `client_command_shims` |
| `droid` | Factory Droid | Standard managed setup |
| `hermes` | Hermes Agent | Standard managed setup |
| `openhands` | OpenHands | Standard managed setup |
| `aider` | Aider | Not accepted in the intent file; see the shim exception below |
| `continue` | Continue CLI | Not accepted in the intent file; see the shim exception below |
| `codebuff` | Codebuff | Not accepted in the intent file; see the shim exception below |
| `amp` | Amp Code | Standard managed setup |
| `pi` | Pi | Standard managed setup |
| `omp` | Oh My Pi | Standard managed setup |
| `opencode` | OpenCode | Standard managed setup |
| `kilo` | Kilo Code | Standard managed setup |
| `kiro` | Kiro CLI | Standard managed setup |
| `qwen` | Qwen Code | Standard managed setup |
| `mistral-vibe` | Mistral Vibe | Not accepted in the intent file; see the shim exception below |
| `grok` | Grok Build | Standard managed setup |
| `devin` | Devin CLI | Standard managed setup |
| `qoder` | Qoder CLI | Standard managed setup |
| `zcode` | ZCode | Standard managed setup |
| `kimi` | Kimi Code CLI | Standard managed setup |
| `vscode-copilot` | VS Code Copilot Chat | Standard managed setup |
| `windsurf` | Windsurf | Standard managed setup |
| `zed` | Zed | Standard managed setup |
| `gptme` | gptme | Standard managed setup |
| `codewhale` | CodeWhale | Standard managed setup |
| `forgecode` | ForgeCode | Standard managed setup |
| `commandcode` | CommandCode | Standard managed setup |
| `dd-harness` | DD Harness | Standard managed setup; preview feature-gated, and capture requires a DD Harness home on the machine |
| `muse` | Muse Code | macOS only; standard managed setup |
| `claude-desktop` | Claude Desktop | macOS only; capture is on unless an administrator turns it off |
<!-- END MANAGED CLIENT IDS -->

For each client's features and limits, run `trajectory user-guide clients`.

List each client once in `clients`, such as `"clients": ["cc", "codex", "agy"]`.
If teams use different tools, create one intent per team. Give each its own
`deployment_id` and MDM group. On a shared computer, list every client that
its users need.

Do not use setup aliases. For example, interactive setup accepts `cb`, but the
intent file accepts only `codebuff`. The values `all` and `detected` are not
accepted in `clients`.

#### Where setup finds client commands

Setup runs some clients' own commands to connect them, such as `claude` and
`codex`. To find those commands, managed setup does not run the user's shell or
its startup files. So it does not see the folders that those files add to
`PATH`. Only the launcher wrapper check, described under "Route ordinary
`claude`, `codex`, and `copilot` commands through Trajectory", asks the user's
login shell for its `PATH`. Setup looks for
each client command in its own `PATH` first. Then it checks these folders in
order and uses the first match. `~` is the signed-in user's home folder, and
`*` matches any installed version. Setup skips a `*` folder that holds more
than 256 entries.

<!-- BEGIN CLIENT COMMAND FOLDERS -->
| Folder | Used by |
| --- | --- |
| `~/.local/bin` | Claude Code native installer, pipx, uv, and other per-user installers |
| `~/.claude/bin` | Claude Code |
| `~/.npm-global/bin` | npm with a per-user global prefix |
| `~/.volta/bin` | Volta |
| `~/.nvm/versions/node/*/bin` | nvm |
| `~/.fnm/node-versions/*/installation/bin` | fnm, older default folder |
| `/opt/homebrew/bin` | Homebrew on Apple Silicon Macs |
| `/usr/local/bin` | Homebrew on Intel Macs, and other system-wide installers |
| `~/.claude/local` | Claude Code local installation |
| `~/.local/share/mise/shims` | mise |
| `~/.local/share/mise/installs/node/*/bin` | npm packages installed with a mise Node.js |
| `~/.asdf/shims` | asdf |
| `~/.asdf/installs/nodejs/*/bin` | npm packages installed with an asdf Node.js |
| `~/go/bin` | Go (`go install`), including asdf 0.16 and later |
| `~/.bun/bin` | Bun |
| `~/Library/pnpm` | pnpm on macOS |
| `~/.local/share/pnpm` | pnpm on Linux |
| `~/.yarn/bin` | Yarn 1 |
| `~/.npm-packages/bin` | npm with a per-user global prefix |
| `~/.config/nvm/versions/node/*/bin` | nvm installed under `~/.config` |
| `~/Library/Application Support/fnm/node-versions/*/installation/bin` | fnm on macOS |
| `~/.local/share/fnm/node-versions/*/installation/bin` | fnm |
| `~/n/bin` | n |
| `~/homebrew/bin` | Homebrew in the user's home folder |
| `~/.homebrew/bin` | Homebrew in the user's home folder |
| `~/.linuxbrew/bin` | Homebrew on Linux in the user's home folder |
| `~/.nix-profile/bin` | Nix |
<!-- END CLIENT COMMAND FOLDERS -->

Setup checks only whether the command file exists in a folder. It does not
run a version manager to find it. If the command it finds is a mise or asdf
shim, setup later runs that shim as the signed-in user, as the user's terminal
would. Setup also puts these folders on the `PATH` it gives client commands,
so a shim can find `asdf` in `~/go/bin`. Codex is the exception. Before setup
checks `/opt/homebrew/bin`, it also asks the user's login shell, npm, pnpm,
Yarn, Volta, asdf, and mise where Codex is installed.

If a client command is in another folder, add a link to it in
`~/.local/bin`. Then run `trajectory managed repair --scope user --yes` as the
user.

#### Clients installed later

Users often install a coding agent after Trajectory. Each time managed setup
runs, it checks the clients in `clients`. On a Jamf Pro or Intune Mac, each
run of the script runs managed setup. If a listed client is installed but not
set up, the next run sets it up. Until then, `trajectory managed status` reports the user layer as
`drifted` with reason `managed_client_not_set_up`. Its text output names the
client, and its JSON output reports it in `user.client_results`.

A client counts as installed when one of these is true:

- Its command is on the PATH, or in one of the folders listed in
  [Where setup finds client commands](#where-setup-finds-client-commands).
- Its settings folder exists, such as `~/.claude` after Claude Code first runs.

Claude Desktop is not checked. Setup writes nothing for it, and it is ready
once the user starts their first local-agent-mode session.

Setup can run and still fail to set the client up. Then managed setup tries
again after 15 minutes, 1 hour, 6 hours, and then every 24 hours. A new profile
revision tries again at once. Status shows the time of the next try, and its
JSON output shows the reason setup gave. To try now, run
`trajectory managed repair --scope user --yes` as the user.

A client's settings folder can exist without its command, for example when
another app of the same vendor made the folder. When setup cannot find a
listed client's command, the client counts as not installed. Status reports it
as `not_installed` with reason `client_not_found`, and it does not fail the
policy. Managed setup tries again on the same schedule. Once the command
appears in one of the folders setup searches, the next run sets the client up.

A listed client can be installed but not set up for another reason. Then
`trajectory managed reconcile` and `trajectory managed repair` report the same
result as status: `drifted` with reason `managed_client_not_set_up`. They exit
1.

If the user removed a listed client with `trajectory uninstrument <client>`,
this check does not set it up again, and status does not report it as drift.
Any later managed setup run, such as a new profile revision or
`managed repair`, sets it up again.

The managed-only `managed_late_client_setup` feature flag is on by default.
Turn it off to stop this check.

#### Retired clients

Trajectory no longer supports Warp/Oz. An intent or remote file that still
names `warp` builds and loads, with a `retired_client` warning. Computers do
not set it up, and managed setup removes the integration it installed earlier.
Remove `warp` from the intent when you next change it.

#### Preview clients

Qoder, Kimi, Zed and VS Code Copilot Chat are off by default for
users who set Trajectory up themselves. Listing one in `clients` turns on its
setting, such as `clients.qoder.enabled`, `clients.kimi.enabled`,
`clients.zed.enabled` or `clients.vscode-copilot.enabled`. Do not ask users to turn these settings on
themselves.

To stop a preview client, remove it from `clients` and from
`auto_instrument.allow_clients`. Do this in the intent and in any remote file.
Then generate the bundle again and replace the profile. The profile then
stops turning on the client's setting. Setup stops changing that client, and its
watcher does not start, unless a user turned the flag on themselves. The
intent has no setting that turns a listed client's flag off. Managed setup
also removes the client's integration if it installed it. See
[Remove a client from the profile](#remove-a-client-from-the-profile).

- Qoder: setup installs and removes the plugin through the Qoder CLI. Do not
  copy files into Qoder's plugin registry.
- Zed: setup changes only Trajectory's MCP and skill entries. Do not copy,
  change or inventory Zed's thread database.
- VS Code Copilot Chat: no installer should change user VS Code settings while
  the feature is off.
- Zed and VS Code Copilot Chat: the Trajectory binary can move, for example
  from a personal install to a managed one. Setup then rewrites its own MCP
  entry with the new path. It still leaves alone a `trajectory` entry that it
  did not write.

#### The shim exception

`aider`, `continue`, `codebuff`, and `mistral-vibe` capture live sessions only
through a command shim. The shim replaces the client's command with a
Trajectory launcher. The intent file has no setting to approve that, so it
does not accept these clients. `client_command_shims` does not cover them.

To capture these clients, choose one approach:

- Leave the client out of the intent. Ask each user to run `trajectory setup`
  with `--install-client-shims`.
- Run that command as the signed-in user through a software workflow that your
  organization approves.
- Use a saved-history mode that the client supports, and accept less capture.

### Allow Trajectory's plugin marketplaces in Codex and Claude Code policies

Setup installs Trajectory's plugins for Codex and Claude Code from two local
folders in each user's Trajectory folder:

| Client | Folder | Source type |
| --- | --- | --- |
| Codex | `~/.trajectory/codex-marketplace` | `local` |
| Claude Code | `~/.trajectory/claude-marketplace` | `directory` |

If your organization's Codex requirements or Claude Code managed settings
allow only listed plugin marketplaces, list these folders too. Otherwise the
client refuses Trajectory's marketplace. Codex then still records sessions
through Trajectory's MCP server and session watcher, but its plugin hooks
don't run, and Claude Code setup fails. See
[Codex or Claude Code refuses Trajectory's plugin](#codex-or-claude-code-refuses-trajectorys-plugin).

**Codex.** Codex matches a local marketplace source by its exact absolute
path. It has no pattern for local folders, so add one entry for each user's
folder. The keys are the same in an OpenAI workspace's managed requirements,
a requirements file, and requirements that an MDM profile delivers. `path`
must be absolute: Codex rejects `~`.

```toml
[marketplaces]
restrict_to_allowed_sources = true

[marketplaces.allowed_sources.trajectory_example]
source = "local"
path = "/Users/example/.trajectory/codex-marketplace"
```

**Claude Code.** In managed settings, `strictKnownMarketplaces` takes a
`directory` entry with an absolute path, or a `pathPattern` entry. A
`pathPattern` is a regular expression that Claude Code matches against the
path of each `file` and `directory` source. This entry covers Trajectory's
Claude Code folder for every user on macOS:

```json
{
  "strictKnownMarketplaces": [
    { "source": "pathPattern", "pathPattern": "^/Users/[^/]+/\\.trajectory/claude-marketplace$" }
  ]
}
```

You may already allow local folders by a pattern, so that teams can test
their own plugins. That pattern covers Trajectory's folder only when it
matches `/Users/<user>/.trajectory/claude-marketplace`. A pattern such as
`^/Users/[^/]+/` does. A pattern that pins another folder, such as
`^/Users/[^/]+/plugins/`, does not, so add the entry above to the list.

If you moved the Trajectory folder, use that folder in place of
`~/.trajectory` in both policies.

### Route ordinary `claude`, `codex`, and `copilot` commands through Trajectory

By default, managed setup runs without `--install-client-shims`. Hooks,
plugins, and MCP registration capture sessions either way.

On macOS, you can also install launcher wrappers for Claude Code, Codex, and
GitHub Copilot CLI. Then an ordinary `claude`, `codex`, or `copilot` command
runs through Trajectory and starts the real CLI. Add this to a schema version 5
intent that lists `cc`, `codex`, or `copilot`:

```json
"client_command_shims": {"enabled": true}
```

| Setting | Result |
| --- | --- |
| Omitted or `{"enabled": false}` | Managed setup installs no wrappers. It leaves alone wrappers that users installed. |
| `{"enabled": true}` | Managed setup installs wrappers and records which ones it installed. It also adds a marked block to the user's shell startup files that puts `~/.trajectory/bin` on `PATH`. |
| Changed from on to off, or profile withdrawn | Managed setup removes only the wrappers that it recorded, and removes the startup file block. Client hooks stay. |

Setup links the wrappers into `~/.trajectory/bin`. Another file or link can
already be at `~/.trajectory/bin/claude`, `codex`, or `copilot`. Setup then
leaves it as it is and keeps the client set up. Its hooks
still capture sessions. Setup names the file and says to move it aside and run
`trajectory managed repair --scope user --yes`. A wrapper works only when
a new terminal finds it before the real CLI on `PATH`. On a typical Mac,
`PATH` does not list `~/.trajectory/bin`. So while the option is on, managed
setup adds this block to the startup files of the user's login shell:

```sh
# >>> Trajectory command shims: managed by your MDM profile; do not edit >>>
case ":${PATH}:" in
  ":$HOME/.trajectory/bin:"*) ;;
  *)
    trajectory_path_rest="${PATH:+${PATH}:}"
    PATH="$HOME/.trajectory/bin"
    while [ -n "$trajectory_path_rest" ]; do
      trajectory_path_entry="${trajectory_path_rest%%:*}"
      trajectory_path_rest="${trajectory_path_rest#*:}"
      [ "$trajectory_path_entry" = "$HOME/.trajectory/bin" ] || PATH="$PATH:$trajectory_path_entry"
    done
    unset trajectory_path_rest trajectory_path_entry
    export PATH
    ;;
esac
# <<< Trajectory command shims: managed by your MDM profile; do not edit <<<
```

| Login shell | Files that get the block |
| --- | --- |
| `zsh` | `~/.zprofile` and `~/.zshrc`. When `~/.zshenv` sets `ZDOTDIR`, the same files in that folder. When a later file such as `.zlogin` moves `ZDOTDIR` again, none. Setup cannot tell which folder `zsh` read, so it says so and adds no block. A login shell can fail to report its `PATH`, as when `~/.zshrc` starts `fish`. Setup then starts `zsh` as a new terminal does, but stops it after its `.zshenv` files. When they leave `ZDOTDIR` unset, setup adds the block to the home's files. Otherwise, or when setup cannot ask the login shell at all, it adds no block to `zsh`'s files. If one startup file sets `ZDOTDIR` and a later one unsets it, setup does not notice, and it can also write an unused block to `~/.zshrc`. |
| `bash` | `~/.bash_profile` and `~/.bashrc`. When `~/.bash_profile` does not exist but `~/.bash_login` or `~/.profile` does, setup uses the first of those instead. A new `~/.bash_profile` would stop `bash` from reading them. |
| `fish` | `~/.config/fish/conf.d/trajectory.fish`, with the same block written for `fish`. When `~/.config/fish` or another folder on the way is a symbolic link, `~/.local/share/fish/vendor_conf.d/trajectory-command-shims.fish` instead, for `fish` 3.5 or later. An older `fish` does not read that folder, so setup reports the link with the `fish_add_path` step. |
| `zsh` or `bash`, and the user also runs `fish` | The files for the login shell, and also `~/.config/fish/conf.d/trajectory.fish`. A terminal app can start `fish` instead of the login shell. Setup treats the user as a `fish` user when `~/.config/fish` exists, which `fish` creates the first time it runs. Setup writes the `fish` file even when it adds no block to the `zsh` files. |
| Any other shell | None. `trajectory managed status` reports `command_shim_path_unknown` for a wrapper a new terminal does not run. |

Setup follows these rules for the block:

- Only managed setup adds the block, and only while the profile enables the
  option. A `trajectory setup` that a user runs never adds it.
- Setup takes the login shell from the user's account record, not from
  `$SHELL`.
- Setup adds the block at the end of the file and never changes a line
  outside it. Running setup again leaves the file unchanged, byte for byte.
  A block that is already in the file stays where it is.
- The block puts `~/.trajectory/bin` first on `PATH`. It adds the folder when
  `PATH` lacks it. When an earlier line put another folder ahead of it, the
  block moves it to the front. It never lists the folder twice. A line that runs after the
  block and puts another folder first still wins. Setup and status name that
  folder, and setup does not move the block. `fish` reads `conf.d` before
  `config.fish`, so a `PATH` line in `config.fish` runs after the block.
- `fish` reads `conf.d` from `$XDG_CONFIG_HOME/fish` when that variable is
  set. Setup writes the block only to `~/.config/fish/conf.d`, so a user whose
  `XDG_CONFIG_HOME` points elsewhere does not get it. When setup can see that
  setting, status reports the wrapper as not on `PATH`, never as active.
- Dotfile managers often link startup files into a repository, and setup never
  edits a link. While another file of the same shell can take the block, setup
  leaves the link alone and names the file that holds the block:
  - `~/.zlogin` when `~/.zshrc` is a link. `zsh` reads `~/.zlogin` after
    `~/.zshrc` in a new terminal.
  - `~/.zprofile` when `~/.zshrc` and `~/.zlogin` are both links.
  - `~/.zshrc` when only `~/.zprofile` is a link.
  - The other `bash` file when `~/.bashrc` or the login file is a link.
  - `fish`'s `vendor_conf.d` file when a folder on the way to `conf.d` is a
    link and `fish` is 3.5 or later. `fish` reads it after every `conf.d`
    file. Setup asks `fish --version`, which reads no configuration.

  The new-terminal check then shows whether a line in a linked file still
  puts another folder first.
- Setup edits startup files as the user, never as root. It changes nothing in
  a file that is a symbolic link, is not a regular file, is read-only or
  unreadable, or belongs to another account. It also skips a file in a folder
  that belongs to another account or that the user cannot open. Setup reports each such file with the step that fixes it.
  It stops repeating that warning once a new terminal runs every wrapper, as
  after the user adds the line by hand.
- Setup writes the new content to a temporary file in the same folder. It
  keeps the file's permissions, owner, and group, and then replaces the file.
- Reconciliation does not watch the block. If the user deletes it, it comes
  back the next time managed setup runs.
- Setup removes the block when the option is turned off, when the profile is
  withdrawn, and when `trajectory uninstall` runs. It also removes the block when the user runs `trajectory uninstrument` and no
  Claude Code, Codex, or Copilot wrapper remains. Each file then holds exactly
  what it held without the block. Setup deletes a file that it created for the
  block when the file holds nothing else.
- A dotfiles manager can replace a startup file that holds the block with a
  link. Setup never edits through the link. It reads the file the link points
  to, and if that file holds no block, setup forgets the startup file. It no
  longer warns about it or waits for it. When that file holds the block, setup
  reports the link with the step that removes the block by hand.

Deployments that already turn the option on get the block the next time
managed setup runs after they update to this release. Setup runs when the
profile, its managed defaults, or its client list change, and after a failed
pass. To add the block at once, run
`trajectory managed repair --scope user --yes` as the user.

The `managed_shell_path_block` feature flag, on by default, turns the block
off. Setup then adds no block, but still removes one it added earlier when the
option is turned off or the profile is withdrawn.

Managed setup runs with the `PATH` that the MDM script sets, not the user's. So after it adds the block, setup asks the user's login
shell which `PATH` it sets:

- Setup starts the user's shell as a new Terminal window does. It runs the
  shell in the user's account record, as the user, as an interactive login
  shell (`-i -l -c`). It therefore reads the user's interactive startup
  files, such as `~/.zshrc`, as well as login ones, such as `~/.zprofile`.
  On Linux, a desktop terminal starts bash as an interactive shell that is
  not a login shell, after the desktop session read the login profile. For bash on
  Linux, setup therefore reads the login profile first, without an
  interactive shell, and then starts an interactive bash, which reads
  `~/.bashrc`. It has no terminal and empty input, so a startup file cannot
  wait for an answer.
  Setup gives up after 5 seconds and then ends everything that shell
  started. When setup runs as root, it switches to the user with
  `launchctl asuser` and `sudo`, as the MDM scripts do, before the shell
  starts. A startup file in that shell might start `trajectory setup`
  or `trajectory managed reconcile`. That command returns at once without
  changing anything. Other commands that need setup's lock fail at once
  instead of waiting for it.
- When the login shell is not `fish` but `~/.config/fish` exists, setup also
  starts `fish` the same way, if `fish` is installed. Setup uses the first
  `fish` that `/etc/shells` lists. Otherwise it looks in `/opt/homebrew/bin`,
  `/usr/local/bin`, `/opt/local/bin`, `/run/current-system/sw/bin`,
  `/usr/bin`, and `/bin`. A wrapper counts as active only when both shells
  find it first. When only the login shell does, setup, status, and
  `trajectory doctor` report it as not on `PATH` in a new `fish` terminal.
  They then give a `fish` step.
- If that `PATH` finds the wrapper first, setup reports the wrapper active.
- Otherwise, if that `PATH` lists a home bin folder such as `~/.local/bin`,
  setup also links the wrapper there. Setup running as root never creates
  that link, because the folder can be a link to a system folder. Setup run
  as the user, as managed reconciliation runs it, does create it.
- A new terminal might still run another `claude`, `codex`, or `copilot`.
  Then setup and `trajectory managed status` name that command and give the
  step that fixes it. When the block is in place, the step names the folder
  that a later line puts first. It says to move that line above the block.
  When setup could not add the block, the step names the file and what to
  change. Without the block, as with the `managed_shell_path_block` flag off,
  the step says to add `~/.trajectory/bin` to the start of `PATH` at the end
  of `~/.zshrc`. When `~/.zshenv` sets `ZDOTDIR`, it names `$ZDOTDIR/.zshrc`
  instead. For bash on Linux, the step names `~/.bashrc`.
  `trajectory doctor` reports the same.
- The shell might fail, take too long, or not be one that setup supports.
  Setup supports `sh`, `bash`, `zsh`, `dash`, `ksh`, `mksh`, and `fish`. In
  those cases setup says that it could not check. It never reports the
  wrapper active then. A user who also runs `fish` still gets the `fish`
  check when the login shell started but reported no `PATH`. When `fish` does
  not find the wrapper first, setup, status, and `trajectory doctor` report
  it as not on `PATH` in a new `fish` terminal.

After the user changes `PATH`, run
`trajectory managed repair --scope user --yes` as the user so that status
checks again. The `client_shim_terminal_path` feature flag is on by default.
Turn it off to stop the login shell check. Setup then checks its own `PATH`, as
earlier releases did.

Setup never replaces an existing command. Apart from the block, it never
edits shell startup files.

The option applies only to the profile's `clients` list. It does not apply to
clients that `auto_instrument` adds later.

### Choose how to migrate existing installations

Jamf Pro and Intune bundles have no migration choice. Their launch keeps the
binary at `~/.trajectory/bin/trajectory`, including one that the user
installed before, when it answers the launcher interface check. Trajectory
then moves it to a newer release. See
[New releases on Jamf Macs](#new-releases-on-jamf-macs). Launch copies its own
binary over one that does not answer, such as a release from before the
launcher. These bundles accept only the `update_in_place` migration mode.

The bundles of other MDM products, on macOS and on Windows, contain
`migration-tools/`. These tools move an existing personal installation to the
system installation that your application package makes. They never run a
personal binary. Set `migration_mode` in the intent, or pass
`--migration-mode` to `prepare`:

| Intent value | What it does |
| --- | --- |
| `update_in_place` (default) | Refreshes the binary and the managed client integrations with the least disruption. Keeps settings, credentials, sessions, caches, and pending uploads. |
| `clean_reinstall` | Resets the application binary and the package's login triggers, then refreshes the managed client integrations. Keeps the same user data. Capture stops during removal and reinstallation. On macOS, `migration-tools/pre-pkg.sh` refuses to run while a Trajectory process runs. |

The flag values use dashes, such as `--migration-mode clean-reinstall`. The
bundle's `README.md` gives the steps for its migration tools.

### Choose how computers update

The configuration profile has no update
settings. Your hosted `config.defaults.yaml` decides them, so you change them
there instead of in your MDM:

| Setting | Key in the hosted `config.defaults.yaml` | When the file leaves it out |
| --- | --- | --- |
| Automatic updates | `auto_update` | Off |
| Version floor | `deployment.minimum_version` | No floor |
| Release ring | `deployment.ring` | `stable` |

A Mac uses the values in the last column until its first download of the
hosted file, and whenever the file leaves a setting out. A user's
`config.yaml` cannot change any of these settings on a managed Mac. An
`auto_update` in the `cohort.yaml` a Mac is assigned replaces the hosted
file's value, in either direction, under the same rule.
`trajectory config show` and `trajectory managed status` print each value and
what set it: `org config` for your hosted file, a cohort, or
`built-in default`.

Automatic updates are serve's hourly check. A Jamf Pro or Intune Mac also
moves on each script run: below the version floor always, and otherwise
unless the hosted file sets `auto_update: false`. See
[New releases on Jamf Macs](#new-releases-on-jamf-macs).

A Mac that runs an earlier release follows the profile that it has. If that
profile delegated updates with `binary_update.authority: trajectory`, the Mac
rejects a hosted file that sets `auto_update: false`. It keeps the last file
that it accepted and goes on updating itself. `trajectory-mdm
check-remote-defaults` cannot see which profile a Mac has. Before you publish
`auto_update: false` to such Macs, assign a configuration profile that the
current `trajectory-mdm` generates. Or keep `auto_update: true` until they run
a release that takes `auto_update` from your hosted file.

On Windows, your MDM installs each release, and automatic updates stay off.

#### Turn on automatic updates

1. In your hosted `config.defaults.yaml`, set `auto_update` to `true`. The
   file that `trajectory-mdm` generates sets it to `false`, unless your source
   settings file sets it to `true`.

   ```yaml
   auto_update: true
   ```

2. Check the file with `trajectory-mdm check-remote-defaults`, then publish it.
   The check lists `auto_update` under `Differs from the deployed profile`:
   computers that run an earlier release reject the file and keep their
   settings. First [raise the version floor](MANAGED-ENDPOINT-SETTINGS.md#roll-out-the-version-floor)
   to a release that reads this setting.
3. Each computer applies it at its next organization sync. On a computer,
   `trajectory managed status` then shows `auto_update: true (org config)`.

To turn automatic updates on for a small share of computers first, stage the
change with a percentage cohort. Set `auto_update: false` in the hosted
`config.defaults.yaml` until the last step:

1. Publish a cohort file at
   `<config_source>/cohorts/latest/automatic-updates.yaml`, with this
   setting:

   ```yaml
   auto_update: true
   ```

2. Add this block to the hosted `config.defaults.yaml`, check the file with
   `trajectory-mdm check-remote-defaults`, and publish it:

   ```yaml
   cohort_rollout:
     cohort: automatic-updates
     percent: 1
   ```

3. On a computer in the cohort, `trajectory managed status` shows
   `auto_update: true (cohort automatic-updates)`. Computers outside it show
   `auto_update: false (org config)`.
4. Publish `percent: 10`, check again, and then publish `percent: 100`.
5. To finish, set `auto_update: true` in the hosted `config.defaults.yaml` and
   remove the `cohort_rollout` block. Publish both changes in the same file.

To roll back, publish a lower `percent`. The computers that leave the cohort
go back to the hosted file's `auto_update: false` at their next organization
sync. For the rules of the block, see
[Roll out a change to a percentage of computers](#roll-out-a-change-to-a-percentage-of-computers).

With automatic updates on, Trajectory checks for a newer release of the
computer's [update ring](#update-ring) about once an hour while its background
service runs. It installs only published releases that pass Datadog's checks. It never
installs a release older than the one installed or below the version floor.
To approve each release yourself, also
[host a `RELEASES.json`](#approve-releases-with-releasesjson). To turn
automatic updates off again, remove the line, and publish the file. A Jamf Pro
or Intune Mac then still moves at each script run. To stop that too, set
`auto_update: false`.

`trajectory update` never replaces a build that reports no release version,
such as a local build. It reports `current` with reason `development_build`.

#### Approve releases with RELEASES.json

A `RELEASES.json` file that you host names the newest release that computers
may install. Computers check the file every hour. A computer installs that
release when it is newer than the release it runs. It never moves to an older
release. The Jamf script does not read it.

Computers no longer use a `deployment.json` to choose a release. If your
profile lists one, remove that entry. `trajectory doctor` warns while the list
has it. Computers still download a listed file, so stop hosting it only after
you remove the entry.

1. Add the file to `organization_sync.files` in the intent:

   ```json
   {"name": "RELEASES.json", "path": "RELEASES.json", "required": false}
   ```

2. Generate the bundle. For a profile that you already deployed, replace the
   profile. If you publish a remote
   `config.defaults.yaml`, also publish the one from the new bundle. Its file
   list must match the profile.
3. Write the file. Set `version` to the release that you approve, and `tag` to
   the same value with a `v`:

   ```json
   {"stable": {"version": "1.2.4", "tag": "v1.2.4"}}
   ```

4. Publish it at `<config_source>/latest/RELEASES.json` before you assign the
   profile.

To approve a later release, change `version` and `tag`, and publish the file
again. You do not need a new profile or script.

- Computers read the entry for their [update ring](#update-ring). The ring is
  `stable` unless your remote `config.defaults.yaml` sets another one. The
  Jamf script reads no entry: it places the kit's release R. Always include
  `stable`. If you set another ring, add an entry for it too.
- The file chooses only the version. Computers still download the release from
  Datadog's public releases and run the same checks.
- If a download fails, computers keep the copy they downloaded before. A
  computer that has no copy yet follows Datadog's public release list. So
  publish the file before you assign the profile.
- `check-remote-defaults` does not check this file. Check that it is valid
  JSON before you publish it.
- A computer that already runs a newer release keeps it.

#### What users see

Users see the managed value. `trajectory config set auto_update false` and
`trajectory config get auto_update` print a note that the value is managed,
and `trajectory doctor --verbose` shows **Automatic updates** with what
decided it. Setting `TRAJECTORY_AUTO_UPDATE=0` in a process environment always
stops background checks for that process, and so does turning off the
`automatic_self_update` feature.

Users can still run `trajectory update` when automatic updates are off. It
installs the ring's release when that release is newer than the installed one
and not below `deployment.minimum_version`. It never installs an older
release. Your hosted `config.defaults.yaml`, or the cohort a computer is
assigned, sets the update ring and the version floor. See
[Update ring](#update-ring).

## Change Settings, Update, And Remove

### Change settings with a new profile revision

1. Edit the intent file. Keep the same `provider` and `deployment_id`.
2. Generate the bundle again.
3. Replace the configuration profile in your MDM.

A Mac applies the new profile at any revision, also when you return to older
settings. Macs on earlier releases of Trajectory need a higher revision for
each change. A Jamf Pro bundle gets one on every run. For Intune, give a higher
`--profile-revision`.
Do not assign two Trajectory settings profiles to one computer. A settings
change needs no new script. Changes to `security_modules` apply after Trajectory restarts on
each computer. Once computers accept a remote settings file, change modules in
that file instead. See
[Security modules in the remote file](#security-modules-in-the-remote-file).

### Remove a client from the profile

To stop capturing a client, remove it from `clients`, and from
`auto_instrument.allow_clients` if it is there. Then generate the bundle again
and replace the profile.

At its next run on each computer, managed setup removes Trajectory's
integration for that client if managed setup installed it. The removal is the
same as `trajectory uninstrument <client>`. It removes Trajectory's hooks,
plugins, MCP entries, skills, commands, command shims, and the client's
incognito command in `~/.trajectory/bin`. It keeps the client's other settings.
Claude Code's plugin stays registered, but its plugin no longer has capture
hooks. Sessions that are already running can keep the hooks they loaded at
startup.

Managed setup records the clients it installed in
`~/.trajectory/state/managed-clients.json` and removes only those:

- A client that the user set up first belongs to the user, and managed setup
  never removes it. This covers a client that was already set up when the
  profile first listed it. It also covers a client that the user set up with
  `trajectory setup` after managed setup removed it.
- A client that managed setup installed before this record existed is not in
  it, so managed setup never removes it. To remove it, run
  `trajectory uninstrument <client>` as the user.
- A client that managed setup installed stays managed even if the user later
  runs `trajectory setup` for it. Removing it from the profile still removes
  it.

The removal also saves the opt-out that `trajectory uninstrument` saves.
`auto_instrument` and the client refresh after an update then leave the client
alone. Any later setup of the client clears the opt-out: either the user runs
`trajectory setup --clients <client>`, or the profile lists the client again.

If a removal fails, `trajectory managed reconcile` reports reason
`managed_client_removal_failed`, and status shows the user layer as `failed`.
Setup for the other clients still runs, and the next run tries the removal
again. Removing Codex, GitHub Copilot CLI, or Factory Droid needs that
client's own CLI on the computer. Only that CLI removes Trajectory's
registration from the client. Until the CLI is available, the removal fails
this way. Removing the whole profile
removes no clients.

### Re-add a removed profile

A Mac applies the profile that its deployment delivers, at any revision. That
includes a profile that you withdrew and assign again, an older revision, and
the same revision with other settings. When you withdraw the profile, the Mac
removes its managed settings once. When you assign a profile again, the Mac
applies it like any other profile change.

A Mac refuses a profile only while profiles of two deployments are installed
together. See [Move a Mac to another deployment](#move-a-mac-to-another-deployment).

Earlier releases of Trajectory record the highest profile revision that a Mac
received. They refuse a profile whose revision is not higher, with reason
`configuration_profile_stale` or `configuration_profile_revision_conflict`.
Their message names the lowest revision that the Mac accepts, for example:

```text
managed reconcile: configuration profile revision 2 was removed from this computer, and a removed revision is never applied again. Generate the profile with --profile-revision 3 or higher and deploy it
```

For a Mac on an earlier release, generate the bundle again with a revision at
or above that number, and replace the profile. A Jamf Pro bundle gets a
revision from the current time in milliseconds, or above the earlier bundles
in the folder where you generate it. Check its `profile_revision` with
`trajectory-mdm prepare --format json`. If it is lower than the number in the
message, add `--profile-revision` with that number. For Intune, give
`--profile-revision`.

`trajectory-mdm prepare` warns when it can see an earlier bundle with a
configuration profile and another deployment ID. A Mac on an earlier release
refuses a profile from another deployment unless its revision is higher. For a Jamf Pro bundle, it warns only when you gave a
`--profile-revision` that is not above that bundle's revision. It checks the
output file that it replaces. It also checks bundles in the same folder that
have the default name for the provider and platform, such as
`trajectory-jamf-macos-<deployment-id>.zip`. The warning names the lowest
`--profile-revision` that a Mac on an earlier release accepts. It reads at most
32 bundles from the folder and says when it skipped more. The bundle is still
created.

### Roll out in stages and run deployments again

You can run a deployment's scripts again on the same Macs. You can also move
Macs from one deployment to another, for example from a beta group to a
stable group and back. A deployment here means one `deployment_id`.

#### Run a deployment again

The Jamf Pro and Intune scripts are safe to run again at any time, also while
the user works:

- Each run checks the binary that root runs and the user's setup. It places a
  binary only when no working one is there.
- After a failed or interrupted run, the next run finishes the work.
- A run that starts while another run is working skips its work and exits 0.
- Trajectory processes that already run, such as the background service and
  coding-agent hooks, keep their release until they restart.

Do not delete `~/.trajectory` to fix a failed run. It does not remove
Trajectory. It deletes the user's sessions and pending uploads, and the
records that managed setup keeps. Run the script again instead, and read its
result. See [Read a Jamf script run's result](#read-a-jamf-script-runs-result).
To remove Trajectory, see [Remove Trajectory](#remove-trajectory).

#### Move a Mac to another deployment

Keep one Trajectory configuration profile on each Mac. Your MDM's scoping
decides which one. A Mac with the profiles of two deployments applies neither.

To move a Mac from deployment A to deployment B:

1. Generate B's bundle.
2. In your MDM, remove the Mac from A's scope in the same change that adds it
   to B. Do this for the configuration profile and the scripts.

Once A's profile is gone, the Mac applies B's profile, whatever its revision.
To move the Mac back to A, do the same with A's bundle. A Mac on an earlier
release of Trajectory also needs the new profile's revision to be above every
revision that it received, in any deployment. A Jamf Pro bundle gets a higher
revision on every run. For Intune, use one counter for all your deployments,
and give `--profile-revision` above every earlier one. A date with a number
works, such as `--profile-revision 2026110301`.

Your MDM can install B's profile before it removes A's. While a Mac has the
profiles of both deployments, it applies neither and keeps the settings that
it applied last:

- `trajectory managed reconcile` fails with reason
  `configuration_profile_source_conflict` and names the deployments.
  `trajectory managed status` reports the policy as `failed` with reason
  `configuration_profile_invalid`.
- When one of the two profiles leaves the Mac's scope, the next run applies
  the other one.

Several profiles of one deployment can also be installed. That happens when
you upload a new profile next to the old one instead of replacing it. The Mac
then
applies the one with the highest revision and prints a warning with reason
`configuration_profiles_overlap`. When two of them share the highest revision
with different settings, the Mac applies neither and fails with reason
`configuration_profiles_conflict`. Replace the profile instead of adding a
second one.

### Change behavior without redeploying the profile

You can publish behavior settings from your own HTTPS server and change them
without a new profile. This needs a Jamf Pro intent with `schema_version` 4 or
later.

1. Add `config.defaults.yaml` to `organization_sync.files` as an optional file:

   ```json
   {"name": "config.defaults.yaml", "path": "config.defaults.yaml", "required": false}
   ```

2. Generate the bundle. It writes the file to publish in
   `remote-defaults/config.defaults.yaml`.
3. [Check the file](#check-files-before-you-publish-them).
4. Publish that file at `<config_source>/latest/config.defaults.yaml`.
5. Deploy the profile as usual.

Computers use starter settings from the profile until the first download.
Computers do not wait for a coding session to download the file. User
reconciliation downloads it when no background service is running, and the
service downloads it while it runs. When the service accepts the first
download, its org sync log says
`org sync: replaced the profile's starter settings with the hosted copy`. The
helper refuses a deployment whose starter settings cannot work alone:

- Every destination needs an `api_key_ref`.
- Starter settings cannot turn on markers. Turn them on in a later remote file.
- You cannot combine `cohort` with remote defaults.

To publish new settings, generate the remote file again from the edited
intent. Then [check it](#check-files-before-you-publish-them) before you
publish it:

```text
trajectory-mdm remote-defaults --file trajectory-managed.json --output config.defaults.yaml --force
trajectory-mdm check-remote-defaults --file trajectory-managed.json --defaults config.defaults.yaml
```

Computers download the new file at their next sync, every
`sync_interval_seconds`. To apply it at once on one computer, run this command
there as the signed-in user:

```text
trajectory config sync
```

The command asks the running background service to download and apply every
selected file now. It waits up to one minute and prints one result for each
file, such as `file=config.defaults.yaml result=updated sha256=...`. The
SHA-256 matches the one that `trajectory managed status` then reports for the
file. If no service runs, the command reports `config.defaults.yaml` as
`not_checked`. It names `trajectory serve ensure`, which starts a
service. Run `trajectory config sync` again after it starts.

Add `--interactive` to edit the behavior settings through questions. It asks
about automatic client setup, destination service labels, and the launcher
wrappers. Change destinations and tags in the
intent file. The file has no secrets. Computers replace their settings with the downloaded file, so a
setting that you remove also goes away on the computers.

Give delegated profiles a source of their own. Do not publish the generated
file, or any `config.defaults.yaml` with `org.files`, at a source that
installations without a configuration profile also sync. From v0.6.0, such an
installation accepts that file once and then refuses every later version.

The remote file controls which files computers download (`org.files`),
`markers_path`, the sync interval, the security modules (`modules`), and the
client list (`setup.clients`). The profile's values for these are starter
values: computers use them until they accept their first remote file.
After that, change these settings in the remote file. A new profile with the
same `config_source` does not change them.

The profile keeps the sync source (`config_source`) and the credential lookup
(`auth`). When a remote file sets either one, computers use the profile's
value and apply the rest of the file. A remote file also cannot change the
cohort explicitly pinned by the profile or the update authority. Remote
defaults decide automatic updates, the version floor, and the update ring.
A rollout can stage a change on a percentage of computers. See
[Roll out a change to a percentage of computers](#roll-out-a-change-to-a-percentage-of-computers).

Computers check the settings that the remote file controls:

- The file list must keep `config.defaults.yaml` and cannot add
  `cohort.yaml`. Otherwise computers keep the file list they use.
- A `markers.yaml` entry must use the `markers_path` value. Otherwise
  computers keep the file list and `markers_path` they use.
- Only the profile can make a file required. A file that only the remote file
  lists is always optional, so a missing file never holds back the next
  version of the remote file.
- The sync interval in effect stays between 60 seconds and 14400 seconds (4
  hours). A computer gets a fix to the remote file only at its next sync, even
  a fix to the interval. Computers use 14400 for a longer interval, and
  `trajectory doctor` warns about it. For a value below 60 or above 86400,
  computers keep the interval they use.
- A setting that the remote file leaves out takes the profile's value.

`trajectory doctor` lists each setting that a computer did not take from the
remote file under `config.downloaded_settings_ignored`.

#### Computers that run an earlier release

A computer that runs an earlier release compares some settings with the
profile. They are `config_source`, the file list, `markers_path`, the sync
interval, `auth`, and `modules`. If one differs, it rejects the whole remote
file. It keeps the
settings it last accepted and tries again at each sync. Change these settings in the remote file only after every
computer runs a release that reads them from it:

1. Keep the remote file repeating the profile's values.
   `trajectory-mdm check-remote-defaults` lists every setting that differs
   under `Differs from the deployed profile`.
2. Once every computer reads `deployment.minimum_version`, set it to that
   release in the remote file. Computers below it update.
3. Check in Datadog that every computer reports that release or later.
4. Change the settings in the remote file.

Computers keep their current settings when they reject a file. The org sync
log line `org sync: config.defaults.yaml: orgsync: reject managed core: ...`
lists the first problem of every failing check. It separates them with `; `,
so one new version can fix all of them.

Managed status reports a rejected file as `failed`, with reason
`organization_file_rejected` and next step
`fix_and_republish_organization_file`. The computer runs without your current
organization settings until it accepts a new version, so it is not compliant.
In the JSON output, `configuration.file_results` reports the file as
`validation_failed` or `syntax_invalid`, and its `rejection_reason` gives the
first failing check on one line. It never shows a URL or a value that looks like
a key: those appear as `<url>` and `<redacted>`. The org sync log keeps the
full message. A file that did not download, for example
during an outage, does not change compliance. It reports `fetch_failed` with the
`configuration_refresh_failed` warning. See
[Rejected and missing files](#rejected-and-missing-files).

#### Security modules in the remote file

Once computers accept a remote file, its `modules` replace the profile's
`security_modules`. Generated remote files repeat the profile's modules. To
change a module, change `modules` in the remote file you publish, and keep
that change when you generate the file again. A remote file that leaves out
`modules` keeps the profile's, and `trajectory doctor` then lists `modules`
under `config.downloaded_settings_ignored`. Until every computer runs a release that reads
modules from the remote file, keep them the same as the profile's. See
[Computers that run an earlier release](#computers-that-run-an-earlier-release).

Coding agents use a change to `agent-security`, whose evaluators run in the
Trajectory hooks, at their next tool call. An evaluator that you turn off
stops at the next call. One that you turn on starts at the next call once the
client has the Trajectory hooks for it. Managed setup adds those hooks at its
next run after the computer accepts the remote file. One session can therefore have tool calls
with and without the module. A blocking evaluator that you turn on can stop a
tool call in the middle of a task. `frontier-ai-gateway` runs in no hook. It
routes only a client launch that asks for an AI Gateway profile, such as
`trajectory claude --gateway <profile>`. A change to it applies at the next
such launch.

To keep the coding-agent model pickers to the Gateway accounts meant for
coding, list those accounts in `provider_slugs`. Other accounts the user can
reach, such as evaluation accounts, then stay out of the pickers. Gateway
routers always stay in. For example, in the profile:

```yaml
security_modules:
  - module: frontier-ai-gateway
    enabled: true
    provider_slugs: [anthropic-coding, openai-coding]
```

and in the remote file:

```yaml
modules:
  frontier-ai-gateway:
    enabled: true
    provider_slugs: [anthropic-coding, openai-coding]
```

The pickers then list `anthropic-coding/claude-sonnet-5-5` but not
`anthropic-eval/claude-sonnet-5-5`. If none of the listed accounts serves a
model the user can use, and the Gateway returns no router, the launch fails
and says so. With the list set, a launch whose Gateway model list cannot load,
for example during a Gateway outage, fails the same way. Neither falls back to
the client's own model list on its own.

The filter sets what the pickers show by default. It does not enforce
anything: the Gateway's access rules still decide which models each user may
call. A user can pass another model by name. A user can also turn off the Gateway
model list for one launch, or keep it off, and use the client's own picker.
Without the managed list, a user can choose accounts for a launch with
`trajectory claude --provider-slugs <slug>,<slug>` or the same flag on
`trajectory codex`. A managed
`provider_slugs` list replaces the user's flag.
The launch error gives the exact command for each.

The background service uses the change when it next starts. Until then the
`CONFIG` column of `trajectory ps` shows `restart_required` for `modules`.
The service applies the settings that need no restart at once, such as
`export.redacted_model_suffixes`, in that remote file and in later ones while it
waits. Coding agents use every change at once. A remote
file can also change another setting that needs a restart, such as
`capture`. It stays installed the same way, and the service uses that setting
when it next starts. Nothing restarts the service for you. It stops
after about 10 minutes without coding-agent activity, but not while periodic
automatic setup (`auto_instrument`) is on, which keeps it running. To restart
it at once, run `trajectory serve restart` as the signed-in user.

#### Client list in the remote file

The remote file can set the clients that managed setup configures, in
`setup.clients`:

```yaml
setup:
  clients:
    - cc
    - codex
```

Once computers accept a remote file that sets it, `setup.clients` replaces the
profile's `clients`. A remote file without it uses the profile's list.
Computers that run 0.6.3 ignore `setup.clients` and keep the profile's list.
Earlier releases reject a remote file that sets it. So
`trajectory-mdm remote-defaults` leaves it out, and `check-remote-defaults`
lists it under `Read only by later releases`. Add it only once the file's
`deployment.minimum_version` is later than 0.6.3.

The list follows the rules of the intent's `clients`: 1 to 64 supported client
IDs, each listed once. Some clients also need a feature that the generated
file turns on. Keep it when you edit the list. For a list it cannot use, such
as an empty list, a computer keeps the list it uses and applies the rest of
the file. `trajectory doctor` then reports `setup.clients` under
`config.downloaded_settings_ignored`.

Managed setup applies a new list at its next run. A client that you add is set
up. A client that you remove is removed only if managed setup installed it, as
[Remove a client from the profile](#remove-a-client-from-the-profile)
describes. To keep every integration while you change the list, add
`managed_dropped_client_removal` to `features.disabled` in the remote file.

#### Audit managed capture in the remote file

A remote file can turn on a managed capture audit with `managed_capture`. An
audit reports whether the selected clients capture and whether each required
destination is configured. It never blocks a change. Add `managed_capture` to
the remote file once the file's `deployment.minimum_version` is later than
0.6.3. `trajectory-mdm remote-defaults` leaves it out, because earlier
releases reject a remote file that sets it. When the intent file sets it,
`trajectory-mdm` warns with `managed_capture_waits_for_floor`. The
configuration profile never carries `managed_capture`, so you change it
without a new profile.

```yaml
managed_capture:
  mode: audit
  client_selection:
    mode: detected
  reconcile_interval_seconds: 300
  serve_active_repair_target_seconds: 300
  required_destination_names:
    - security
```

Each required destination must be in the same remote file, with `level`
`full`, `incognito_exempt`, and an enabled `event_stream`. A later remote file
might change a required destination so that it no longer meets these
conditions. The audit then keeps requiring it and reports that it is not
configured. Write each value exactly as shown, in lowercase. A remote file can set `off`
or `audit` only. For any other mode, a computer keeps the block it uses. For a value it cannot use, it keeps the value it uses. In both cases it
applies the rest of the file. `trajectory doctor` reports the setting under
`config.downloaded_settings_ignored`. Computers that run 0.6.3 ignore
`managed_capture`, and earlier releases reject a remote file that sets it.

#### Update ring

Publish `deployment.ring` in the remote file to move computers between
`stable`, `beta`, and `bravehearts` without a new profile:

```yaml
deployment:
  ring: beta
```

Computers use the ring in the active remote file, after the computer accepts
that file. Otherwise they use `stable`: on first start, offline, while every
download is rejected, and while the active file has no `deployment.ring`. The
profile has no ring field of its own, and a user's `deployment.ring` never
applies. A Jamf or Intune kit's baked `config.defaults.yaml` carries the
intent's ring, which a Mac follows before it accepts a hosted file. A
cohort that the profile assigns can set `deployment.ring` and
`deployment.minimum_version` in its `cohort.yaml`. Its values win over the
ring and the floor that computers use otherwise.

These rules cover profiles that select files with `organization_sync.files`.
A legacy profile uses `schema_version` 1 to 3. It cannot select files, and it
leaves the ring to the user. When managed configuration sets no ring, a
user's `deployment.ring` applies, as before.

Generated remote files select the intent's `deployment.ring`, and no ring
when the intent sets none, so computers use `stable`. To choose the ring, set
`deployment.ring` in an intent with `schema_version` 5, then generate and
publish the file. You can also change `deployment.ring` in the file you
publish. Make the same change in the intent, or the next generated file
selects the intent's ring again. The intent and the remote file reject an
unsupported value, such as `nightly` or `Beta`, with
`deployment.ring "nightly" is not a supported update ring (stable, beta, bravehearts)`.

The Jamf script reads no ring. It places the kit's release R, whatever the
ring, and the user's copy then moves to the ring's release. The updater downloads from the ring of the accepted remote file. A
hand-edited local `config.defaults.yaml` does not change the ring.

`trajectory config get deployment.ring` shows the ring in use. In managed
status, `configuration.defaults_source` shows whether the active settings come
from the remote file (`remote_defaults`) or the profile (`profile_starter`).

#### Roll out a change to a percentage of computers

A `cohort_rollout` block in the remote `config.defaults.yaml` gives a cohort to
a percentage of computers. The cohort's file, `cohorts/<cohort>.yaml`, holds
the change. Raise the percentage over time, and lower it to roll back. A
mistake then reaches only a small share of your computers.

The block works on every computer that downloads the remote file. Computers
download the cohort file from the same `config_source`. The intent and the
profile have no rollout settings. A profile that assigns a cohort with
`cohort` keeps that cohort, and its computers ignore the block.

A cohort file can set any setting that the remote file can set, under the same
rules. Its values take the place of the ones in the remote file. A cohort file
cannot change `org`, `auth`, `setup` or `managed_capture`. Computers take them
from the profile and the remote file. One setting works differently: a client
field the remote file turns off stays off, and the cohort file's `true` for it
has no effect. Turn the client back on in the remote file itself, for every
computer at once. For example, to move 1%, then 10%, then 100% of computers to the `beta`
ring:

1. Publish the cohort file at
   `<config_source>/cohorts/latest/beta-ring.yaml`, with this setting:

   ```yaml
   deployment:
     ring: beta
   ```

2. Add this block to the remote `config.defaults.yaml`, and publish the file:

   ```yaml
   cohort_rollout:
     cohort: beta-ring
     percent: 1
   ```

3. Check the computers in the cohort. In Datadog, group
   `trajectory.ops.update.state` by `cohort` and `ring`.
4. On one computer, run `trajectory doctor --verbose`. It shows whether the
   computer is in the rollout.
5. Publish `percent: 10`. Check again, and then publish `percent: 100`.
6. To finish, set `deployment.ring: beta` in the remote file and remove the
   `cohort_rollout` block. Publish both changes in the same file.

To roll back, publish a lower `percent`. The computers that joined last leave
first, and each one goes back to the value in the remote file. `percent: 0`,
or a file without the block, takes every computer out. Computers apply each
change at their next organization sync. Keep the block when you generate the
remote file again, as for `deployment.ring`.

A raise of the version floor rolls out the same way, with
`deployment.minimum_version` in the cohort file. A cohort file can also set
`auto_update`. Computers in the cohort use its value instead of the remote
file's value.

These rules apply to the block:

- `percent` is a number from 0 to 100, with up to two decimal places.
- Each computer keeps its place from one step to the next. So raising
  `percent` only adds computers.
- Each user account on a computer has its own place.
- A computer with a `~/.trajectory/cohort` file that applies keeps that
  cohort.
- A computer with a leftover cohort file that the profile does not assign
  joins the rollout after managed reconciliation removes that file. See
  [Cohort files the profile does not assign](#cohort-files-the-profile-does-not-assign).
- A block that is not valid assigns no cohort. `trajectory doctor` warns
  about it, and computers apply the rest of the file.
- Under delegation, cohort settings that require a restart, including
  `modules`, stay installed and apply when the background service next starts.
- Computers check a cohort file together with the remote file and the
  profile. A cohort file can break a rule, for example by turning off a feature
  that a profile client needs. Computers in the cohort then keep their current
  settings, also for a new profile revision. Fix the cohort file. The next
  sync applies it, and reconciliation then applies the profile revision.
- `config.defaults.yaml` can declare one rollout.
- Trajectory never sends a computer's place or the ID it comes from.

The
[configuration guide](CONFIGURATION.md#how-a-machine-gets-a-cohort)
describes every field of the block.

#### Check files before you publish them

A computer that rejects a remote file keeps its current settings, and its
managed status reports `failed` until you publish a version it accepts. Check
every file before you publish it, including a file that `trajectory-mdm` did
not generate:

```text
trajectory-mdm check-remote-defaults --file trajectory-managed.json --defaults config.defaults.yaml
```

Use the intent of the profile that your computers have. The command runs the
same checks a computer runs before it applies a downloaded file, for the
intent's platform. If the intent lists `markers.yaml`, `pricing.yaml`, or
`custom-pricing.yaml` in `organization_sync.files`, add
`--markers markers.yaml`, `--pricing pricing.yaml`, or
`--custom-pricing custom-pricing.yaml` to check them too.

For each file it checks, the command prints whether computers would accept
it, its SHA-256, and where to publish it. If a computer would reject a file,
the command lists each reason and exits with status 1. Fix the file and check
it again. The command also lists the other files the intent selects, such as
`RELEASES.json`, as not checked. Add `--format json` for automation.

### Update Trajectory

Neither Jamf nor Intune updates a Mac with the script of a Jamf Pro or Intune
bundle. Trajectory moves its own release. See
[New releases on Jamf Macs](#new-releases-on-jamf-macs), which applies to the
Intune script too.

Each run of the script has the user's copy move the Mac to the release that
its ring names, unless your hosted `config.defaults.yaml` sets `auto_update: false`. With
`auto_update: false`, raise the version floor to move Macs. See
[Roll out the version floor](MANAGED-ENDPOINT-SETTINGS.md#roll-out-the-version-floor).
A running Trajectory process can use the old release until it restarts. See
[The background service runs an older release](#the-background-service-runs-an-older-release).

### Remove Trajectory

Remove Trajectory from a Mac that the Jamf Pro or Intune script set up in this
order:

1. Stop the script. Turn off both Jamf script policies, or remove the Intune
   script's assignment. Otherwise a later run sets Trajectory up again.
2. Withdraw the configuration profile. While a profile requires capture,
   `trajectory uninstall` changes nothing and reports
   `managed_capture_required`.
3. As each user, run the commands in
   [Clean up coding agents](#clean-up-coding-agents) that come before
   `trajectory uninstall`.
4. Run `~/.trajectory/bin/trajectory uninstall --format json` as each user,
   never as root.
5. As each user, run the commands in Clean up coding agents that come after
   it.
6. Delete what stays, as [What removal leaves](#what-removal-leaves) lists.

`trajectory uninstall` removes Trajectory from one user account. It stops the
user's capture service. It removes what setup installed in each coding agent:
hooks, plugins, MCP entries, command shims, and the client commands in
`~/.trajectory/bin`, such as `cursor-incognito`. It keeps client settings that
Trajectory did not write. Then it removes `~/.trajectory/bin` and the rest of
`~/.trajectory`. It keeps only the publish records that stop a later
installation from sending that user's history to Datadog again. To list them,
run `trajectory user-guide install`. The command changes nothing outside the
user's account.

Exit code 0 means that the account holds nothing of Trajectory but the kept
files. Exit code 1 means that something stays: the result's `left` field names
the files, and `clients_left` names the coding agents. Fix what it names and
run the command again. A run after a finished one reports `already_removed`
and changes nothing. When the command cannot stop serve or remove a coding
agent's integration, it keeps the binary for that retry. If a file cannot be
removed after the binary is gone, `left` names it. Delete it as the user, or
run `trajectory uninstall` again from another Trajectory binary. A missing
binary alone does not show that the command finished.

To see what the command would remove and keep, add `--dry-run`. To remove the
kept records too, add `--purge`. A later installation then sends the user's
history again.

The cleanup uninstalls Trajectory's Claude Code plugin with the user's own
`claude` CLI, so Claude Code no longer lists or enables it. It then deletes
the plugin's cached copies. A Claude Code session can still be open on an
older plugin version. For that session, the cleanup leaves only stub scripts
that do nothing. So the session shows no errors until it restarts. A project
install of the plugin stays. The cleanup changes Claude's settings only
through that CLI.

If the cleanup cannot run the `claude` CLI, it prints a warning and continues.
Claude Code then keeps the plugin, pointed at a version with no hooks, MCP
server, commands, or skills, so it reports no Trajectory errors. To remove the
plugin, run `claude plugin uninstall trajectory@trajectory --scope user` as the
user.

If the user set up Agent Security, the cleanup removes it too. It uninstalls
the `trajectory-security` plugin with the user's own `claude`, `codex`, and
`copilot` CLIs, and deletes the copies Claude Code and Codex cached. It also
removes Agent Security's hooks from Cursor. A project install of the plugin
stays. If the cleanup cannot run a client's CLI, it prints a warning that
names the command to run. `trajectory uninstall` then keeps the binary and
names the client in `clients_left`. Make that CLI work for the user, then run
`trajectory uninstall` again. The warning names one of these commands:

- Claude Code: `claude plugin uninstall trajectory-security@trajectory --scope user`
- Codex: `codex plugin remove trajectory-security@trajectory`
- GitHub Copilot CLI: `copilot plugin uninstall trajectory-security@trajectory`

Setup records the client folders it took from environment variables, such as
`CODEX_HOME`. The cleanup cleans those folders, the default folders, and the
folders that its own environment names. Setup in earlier releases did not
record them. If a user ran such a setup with a custom client folder, ask them
to run `trajectory uninstall` from a shell that sets that folder.

Setup records up to 8 sets of these variables. When a user's terminals and
apps bring a ninth set and every recorded folder still exists, setup stops
recording the oldest set. Its output then gives the command that still
cleans those folders, such as
`env -u ... QWEN_HOME='/Users/example/qwen' trajectory uninstrument all`. The
command unsets the other client folder variables, so the user's shell cannot
point the cleanup elsewhere. `trajectory uninstrument all` leaves Agent
Security. If that set moved a folder where Agent Security is set up, the output
gives two commands with the same variables. The first is
`trajectory plugins security disable --clients <client> --remove-hooks`, and
`trajectory uninstrument all` follows it. Keep that order, because the second
command deletes a record the first can need to find the client. The first
command turns Agent Security off for every client on the computer, so set it up
again for the clients that keep it. Ask the user to run these commands from
their own shell before `trajectory uninstall`.

For bundles of other MDM products, and on Windows, remove the policy with the
uninstaller in the bundle. Run
`policy-tools/uninstall-trajectory.sh --remove-policy` on macOS or
`policy-tools/uninstall-policy.ps1` on Windows. If Trajectory is no longer
installed, pass the binary from the same release with `--trajectory-binary` or
`-TrajectoryBinary`.

#### What removal leaves

`trajectory uninstall` removes everything in `~/.trajectory` but the publish
records. It changes nothing outside the user's account. So the items in this
table stay. Run each command as the user, after `trajectory uninstall` has
finished, unless the table says otherwise.

| What stays | Where | Delete it with |
| --- | --- | --- |
| The publish records that stop a later installation from sending the same history to Datadog again. `trajectory user-guide install` lists them. | `~/.trajectory/` | `rm -rf ~/.trajectory`, or `trajectory uninstall --purge` in place of `trajectory uninstall`. A later installation then sends that history again. |
| API keys that `trajectory install` stored. Each one is a login keychain item with service `trajectory` and the credential reference as its account. | The user's login keychain | `security delete-generic-password -s trajectory -a <ref>`, in Terminal, for each reference in `adapter/credential-parameters.json` |
| Setup's `trajectory` link, which points to the deleted binary. | `~/.local/bin`, `~/bin`, or `~/.bin` | `rm ~/.local/bin/trajectory`, after `readlink ~/.local/bin/trajectory` shows the deleted `~/.trajectory/bin/trajectory`. Check the other two folders the same way. |
| What the cleanup cannot remove from a coding agent: `SKILL.md` hooks, Claude Code's marketplace registration, and settings from older releases. | Each coding agent's settings | The commands in [Clean up coding agents](#clean-up-coding-agents) |
| The script's own files: the binary that root runs and `mdm-script.log`. | `/Library/Application Support/Trajectory/mdm-script/` | `sudo rm -rf "/Library/Application Support/Trajectory/mdm-script"`, as an administrator, after you stop the script |

`trajectory uninstall` also removes the user's profile history in
`~/.trajectory/managed`. A Mac that had a system installation can keep
protected history in `/private/var/db/trajectory/managed`, and setup reads it
when the user's own history is missing. When you deploy Trajectory again, a
Mac applies the new profile at any revision. A Mac on an earlier release needs
a revision higher than any you deployed before. A Jamf Pro bundle that you
generate again gets one. For Intune, give a higher `--profile-revision`.

The macOS uninstaller in the bundles of other MDM products,
`policy-tools/uninstall-trajectory.sh`, runs as root. It removes Trajectory's
machine package: the binary in `/Library/Application Support/Trajectory/bin`,
its LaunchDaemons, and its install receipt. With `--remove-policy`, it also
removes the policy files. It keeps each user's home folder, keychain items,
and coding agent settings, and the history in `/private/var/db/trajectory`.

##### Clean up coding agents

<!-- BEGIN GENERATED BLOCK coding-agent-cleanup -->
<!-- Generated shared block coding-agent-cleanup: edit its source file, then run public-doc-tables.py render. -->

`trajectory uninstall` removes Trajectory's hooks, plugins, MCP entries, and
command shims from each coding agent. These commands clean up what it leaves.
Run them as each user after you withdraw the configuration profile. While the
profile is installed, managed setup can add the integrations back.

Before you run `trajectory uninstall`, while the binary still exists:

1. If you turned on `claude_skill_file_hooks`, close the user's Claude Code
   sessions. Then run `~/.trajectory/bin/trajectory claude skills restore --all`.
   It removes the hooks that Trajectory added to `SKILL.md` files. If its
   output shows `blocked` or `conflicts` above 0, fix those files first.
   `trajectory uninstall` deletes the copies that it restores from.
2. Check each of Codex, GitHub Copilot CLI, and Factory Droid that the user
   set up. Its command, `codex`, `copilot`, or `droid`, must work for the
   user. For example, run `codex --version`. `trajectory uninstall` needs it
   to remove that client's plugin. Without it, `trajectory uninstall` keeps
   the binary, names the client in `clients_left`, and exits 1.

After `trajectory uninstall` finishes:

1. If it warns that Claude Code still lists the `trajectory@trajectory`
   plugin, run `claude plugin uninstall trajectory@trajectory --scope user`.
   This happens when it cannot run the user's `claude` CLI.
2. Run `claude plugin marketplace remove trajectory`. Claude Code keeps
   `~/.trajectory/claude-marketplace` registered as its `trajectory` plugin
   marketplace, although `trajectory uninstall` deleted that folder.
3. If `~/.claude.json` has a user-level `trajectory` MCP server from an older
   release, run `claude mcp remove trajectory --scope user`.
4. If `~/.claude/settings.json` still has the telemetry settings that older
   releases added to its `env` block, remove them and keep the other
   settings. They are the `CLAUDE_CODE_ENABLE_TELEMETRY`,
   `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`, `OTEL_LOG_TOOL_DETAILS`,
   `OTEL_*_EXPORTER`, `OTEL_EXPORTER_OTLP_*_PROTOCOL`, and
   `OTEL_EXPORTER_OTLP_*_ENDPOINT` keys, with endpoints on `localhost`.
   Setup warns about them but never changes them, and Claude Code keeps
   sending telemetry to them after removal.
<!-- END GENERATED BLOCK coding-agent-cleanup -->

## Troubleshooting

### Check a computer

| Task | Command |
| --- | --- |
| Full status, as the signed-in user | `trajectory managed status --scope all --format json` |
| Device status, as an administrator | `trajectory managed status --scope system --format json` |
| Preview the user's managed changes | `trajectory managed reconcile --scope user --dry-run --format json` |
| Apply managed settings now, as the user | `trajectory managed reconcile --scope user --yes --format json` |
| Run client setup again | `trajectory managed repair --scope user --yes --format json` |
| Check whether the user's keychain can take API keys, without a prompt | `trajectory managed credentials check --refs <ref>,<ref>` |
| Show the version, and whether your MDM or Trajectory updates it | `trajectory --version` |
| Check whether this build can read named API keys, without a prompt | `trajectory config secrets <ref> <ref>` |
| General health checks | `trajectory doctor` |

Each result has a state, a `reason`, and a `next_step`.

| State | Meaning | What to do |
| --- | --- | --- |
| `compliant` | Installed, and the user has the current profile. | Nothing. |
| `pending_policy` | No profile, or the profile was withdrawn. | Assign the profile. |
| `pending_user` | No user has applied the profile yet. | Wait for a sign-in, or run `managed reconcile` as the user. |
| `drifted` | The user's setup differs from the profile. | Run `managed reconcile` or `managed repair` as the user. |
| `blocked` or `failed` | Something stopped setup. | Follow `reason` and `next_step`. |

Common reasons:

| Reason | What to do |
| --- | --- |
| `managed_reconciliation_feature_disabled` | An administrator paused managed setup. Do not reinstall the application because of it. |
| `configuration_refresh_failed` | A remote file did not download, or the computer rejected it. The computer keeps its last good settings and retries. If status reports `organization_file_rejected`, fix the file. Otherwise check that the computer can reach your HTTPS server. |
| `organization_file_rejected` | The computer downloaded a file that the profile selects and rejected it. `configuration.file_results` names the file, and its `rejection_reason` gives the first failing check. Fix the file, [check it](#check-files-before-you-publish-them), and publish it again. |
| `required_configuration_unverified` | A required remote file is missing or changed. Publish it at the expected URL. |
| `client_command_shim_repair_failed` | Setup could not restore a launcher wrapper that a new terminal reached before. Run `managed repair`. A file or link of the user's at `~/.trajectory/bin/claude`, `codex`, or `copilot` does not cause this reason. Setup leaves it, names it, and says to move it aside, then run `managed repair`. |
| `managed_client_not_set_up` | A listed client is installed but not set up. Managed setup sets it up at its next run, or at the retry time that `managed status` shows. To try now, run `managed repair` as the user. A client whose command setup cannot find never causes this; status reports it as `not_installed`. See [Clients installed later](#clients-installed-later). |
| `configuration_profile_invalid` | The computer refused the profile. Status reports every refused profile this way. Run `managed reconcile --scope user --dry-run` as the user to see why. |
| `configuration_profile_source_conflict` | Profiles of two deployments are installed. The computer applies neither and keeps its last settings. Keep one Trajectory profile on each Mac by scoping. See [Move a Mac to another deployment](#move-a-mac-to-another-deployment). |
| `configuration_profile_stale`, `configuration_profile_revision_conflict` | Only earlier releases of Trajectory report these: the profile revision is not higher than one the computer already received. See [Re-add a removed profile](#re-add-a-removed-profile). |
| `profile_runtime_not_applied` | The background service still uses the previous settings. See [Settings wait for open sessions](#settings-wait-for-open-sessions). |
| `profile_runtime_restart_pending` | Nothing. Reconcile wrote the settings, but the running background service could not reload them. It uses them when it restarts. See [Settings wait for a service restart](#settings-wait-for-a-service-restart). |
| `runtime_not_started` | Nothing. The user layer is `compliant`. No background service is running, and the next one to start uses the current settings. See [No background service is running](#no-background-service-is-running). |
| `keychain_locked`, `session_locked`, `no_user_session`, `keychain_missing`, `keychain_search_list_missing`, `interaction_not_allowed`, `credential_store_failed`, `credential_parameter_invalid` | API keys were not stored, or setup could not read them. See [API keys were not stored](#api-keys-were-not-stored). |

`trajectory --version` prints a `self_update` line. It reads the update
authority that `managed status` reports:

- `managed (update authority: mdm)`: your MDM delivers updates, and Trajectory
  does not update itself. Windows deployments show this.
- `enabled (update authority: trajectory)`: Trajectory updates itself, as
  your hosted settings file says. Mac deployments show this. See
  [Choose how computers update](#choose-how-computers-update).
- `unknown (managed policy unavailable)`: Trajectory could not read the managed
  policy, or this computer rejected the configuration profile. Run
  `trajectory managed status` to see why.

On a personal install, the line shows `enabled` or `disabled`, as before.

### Rejected and missing files

Managed status treats a rejected file and a missing file differently:

| What happened | File result | Status | What to do |
| --- | --- | --- | --- |
| The computer downloaded the file and a check rejected it | `validation_failed` or `syntax_invalid`, with `rejection_reason` | `failed`, reason `organization_file_rejected` | Fix the file and publish it again. |
| The download failed: no network, a timeout, a TLS error, or an HTTP error such as 404 or 503 | `fetch_failed` | Unchanged, with the `configuration_refresh_failed` warning | Check that the computer can reach your HTTPS server. The computer retries on its sync schedule. |

In both cases the computer keeps its current settings. Status describes the
last sync attempt for each file. If a download fails after a rejection, status
shows the failed download until the next download. A sync that does not
download the file at all keeps the rejection. An example is
`trajectory config sync` on a computer where no background service runs.

A required file that has never verified on the computer keeps reason
`required_configuration_unverified`, because the profile cannot apply without
it.

The status JSON uses `schema_version` 8 or later when a file result carries a
`rejection_reason`. Version 8 also allows `user.client_results`. Status of the
`user` or `all` scope uses version 11, which adds `release`. Other status
keeps its earlier version. The inventory
scripts, such as `extension-attribute.sh`, report the `failed` state. The
detection scripts check only the installation and the profile, so a rejected
file does not make your MDM reinstall Trajectory. `managed reconcile` still
applies the profile and reports `configuration_refresh_failed`.

### Cohort files the profile does not assign

An earlier installation without a configuration profile can leave cohort
files on a computer. They are `~/.trajectory/cohort`, `~/.trajectory/cohort.yaml`,
and temporary copies named `.cohort-overlay-backup.*` or `.cohort.*` in the same
folder. When the profile lists files in `organization_sync.files`, Trajectory
applies a cohort only if the profile assigns it with a `cohort.yaml` entry at
`cohorts/<cohort>.yaml`.

If the profile assigns no cohort, managed reconciliation removes these files
as the signed-in user. Reconciliation runs at each run of the Jamf Pro or
Intune script. Until then, Trajectory ignores the files and applies the
profile's settings. Trajectory never removes a cohort that the profile
assigns. It leaves a file in place if it is a symbolic link or has unexpected
contents. Computers that Trajectory manages without a configuration profile
keep their files.

`trajectory managed status` lists each removed file, with the reason
`profile_does_not_assign_cohort` and the time of the removal:

```text
  removed cohort file: /Users/<user>/.trajectory/cohort (profile_does_not_assign_cohort, 2026-10-13T18:00:00Z)
  removed cohort file: /Users/<user>/.trajectory/cohort.yaml (profile_does_not_assign_cohort, 2026-10-13T18:00:00Z)
```

A file that is still on the computer is listed as `ignored cohort file` with
the same reason. `trajectory doctor --verbose` names the same files in its
Installation check. Neither command shows the cohort name or the settings in
the files. You do not need to do anything. If a file stays listed as ignored,
check that the user can write to `~/.trajectory`. A profile can assign a cohort
with `cohort` and its `cohort.yaml` entry. It can do this only when it does not
use a hosted `config.defaults.yaml`. That cohort cannot add destinations. It
can set the update ring and the version floor. To give a cohort to a
percentage of computers from the remote file instead, see
[Roll out a change to a percentage of computers](#roll-out-a-change-to-a-percentage-of-computers).

### Check each client

`trajectory managed status --format json` lists each client in the profile
under `user.client_results`. The list appears while the user layer is
`compliant`, or `drifted` with reason `managed_client_not_set_up`. Status JSON
that has the list uses `schema_version` 6. It uses 8 when a file is also
rejected. The list is absent while the
`managed_late_client_setup` feature flag is off.

```json
"client_results": [
  {
    "client": "cc",
    "state": "failed",
    "reason": "node_runtime_missing",
    "last_attempt_at": "2026-10-06T12:00:00Z",
    "next_attempt_at": "2026-10-06T12:15:00Z"
  },
  {
    "client": "codex",
    "state": "set_up",
    "reason": "none",
    "last_attempt_at": "2026-10-06T12:00:00Z"
  }
]
```

`last_attempt_at` is the managed setup run that last tried the client.
`next_attempt_at` is when managed setup tries a failed client, or a client
whose command it could not find, again.

| State | Meaning | What to do |
| --- | --- | --- |
| `set_up` | Setup finds the client set up. With reason `command_shim_not_on_path`, its launcher wrapper is installed, but when setup last checked, a new terminal ran another command or found none. For a user who also runs `fish`, that terminal can be a new `fish` terminal. With reason `command_shim_path_unknown`, setup could not read a new terminal's `PATH`. With reason `plugin_hooks_fallback`, Codex runs in fallback mode: Trajectory's MCP server and session watcher record its sessions, and its plugin hooks are off. `trajectory managed status` prints why. With reason `client_plugin_disabled`, the user or a Claude Code policy turned Trajectory's plugin off in the client, so its sessions are not captured. Managed setup keeps that choice. | Nothing for capture: hooks still capture sessions. To route the ordinary command through the wrapper, follow the step that `trajectory managed status` prints. See "Route ordinary `claude`, `codex`, and `copilot` commands through Trajectory". For `client_plugin_disabled`, the user runs the command that `trajectory managed status` prints, such as `claude plugin enable trajectory@trajectory --scope user`. |
| `not_installed` | The client is not installed on this computer. With reason `client_not_found`, setup found the client's settings folder but not its command. It does not fail the policy, and the next run after the command appears sets the client up. | Nothing. If the user has the client, see `client_not_found` below. |
| `pending` | The user installed the client after managed setup last ran. With reason `client_first_session_pending`, Claude Desktop has not run its first local agent mode session. | Wait for the next run, or run `managed repair` as the user. For Claude Desktop, the user starts a local agent mode session. |
| `failed` | Managed setup ran but could not set the client up. | Fix the cause that `reason` names, then run `managed repair` as the user. |
| `opted_out` | The user removed the client with `trajectory uninstrument`. | To set it up again, run `managed repair` as the user. |

When Claude Code has Trajectory's plugin installed but its user settings no
longer list it, Claude Code loads none of its hooks. A failed setup in an
earlier release could leave a Mac this way. Managed setup counts Claude Code
as not set up and turns the plugin back on at user scope. A plugin that the
user or a policy turned off stays off, and `trajectory managed status` prints
`client not capturing: cc` with the command to turn it on.

Reasons for `not_installed`:

| Reason | Meaning |
| --- | --- |
| `client_not_installed` | Setup finds neither the client's command nor its settings folder. |
| `client_not_found` | Setup finds the client's settings folder but cannot find its command. Setup searches the PATH and the locations listed in [Where setup finds client commands](#where-setup-finds-client-commands). If the user has the client, install its command in one of those locations. |

Reasons for `failed`:

| Reason | Meaning |
| --- | --- |
| `node_runtime_missing` | The client needs Node.js, and its command cannot find it. |
| `launcher_missing_binary` | The client's launcher cannot find the program it starts. |
| `timeout` | The client's command did not finish in time. |
| `process_killed` | The client's command was stopped before it finished. |
| `permission_denied` | Setup cannot write the client's files. |
| `plugin_marketplace_failed` | The client could not add the Trajectory plugin. |
| `mcp_registration_failed` | The client could not register the Trajectory MCP server. |
| `registration_failed` | The client's command reported another error. |
| `client_not_set_up` | Setup reported no error, but the client is still not set up. |

For details, run `trajectory doctor` as the user.

The configuration inventory attribute, `adapter/configuration-inventory.sh`,
ends with one `client.<client>=<state>` entry for each installed client in the
profile. A failed client's entry also has its reason:

```text
profile_revision=3;sync=succeeded;...;client.cc=failed:node_runtime_missing;client.codex=set_up
```

Clients that are not installed are left out. The attribute is never longer
than 2,048 characters. If the line would be longer, the reasons are left out
first, and then the client entries.

To find the computers where a client failed, match its entry. For example, a
Jamf Pro smart group with the criterion `like client.cc=failed` finds the
computers where Claude Code setup failed.

### Linked log and Pi folders

Some users link a folder to another volume or into a dotfiles folder.

| Folder | What setup does | What to do |
| --- | --- | --- |
| `~/.trajectory/logs` | Never follows the link. The Agent Security session start prints `refusing to use the linked folder <folder>`. | Move the folder the link points to into its place, then start a new session. |
| `~/.pi`, `~/.pi/agent`, `~/.pi/agent/extensions` or `~/.pi/agent/extensions/trajectory` | Never follows the link. Pi setup stops with `refusing to set up Pi through the linked folder <folder>`. | Move the folder the link points to into its place, then run `managed repair` as the user. |

### Codex or Claude Code refuses Trajectory's plugin

| What you see | Cause | What to do |
| --- | --- | --- |
| Setup and `trajectory doctor` say `Codex plugin hooks are off` because your Codex requirements allow only listed plugin marketplaces, and name a folder such as `/Users/example/.trajectory/codex-marketplace`. | Your OpenAI workspace's Codex requirements, or requirements from a file or an MDM profile, restrict plugin marketplaces, and Trajectory's folder is not listed. Codex still records sessions through Trajectory's MCP server and session watcher. Plugin hooks don't run. | Add the folder the message names as a `local` source, as [Allow Trajectory's plugin marketplaces in Codex and Claude Code policies](#allow-trajectorys-plugin-marketplaces-in-codex-and-claude-code-policies) shows. Then run `trajectory managed repair --scope user --yes` as the user. Background reconciliation does not retry it, because Codex still counts as set up. |
| Claude Code setup fails with `is blocked by enterprise policy`, and the message lists `Allowed sources`. | Claude Code's `strictKnownMarketplaces` managed setting does not match `~/.trajectory/claude-marketplace`. | Add a `directory` or `pathPattern` entry that matches the folder, as the same section shows. Then run `trajectory managed repair --scope user --yes` as the user. |

### Settings wait for open sessions

`managed status` reports `blocked` with reason `profile_runtime_not_applied`
while the background service still uses the previous settings. This is usually
temporary. The service does not reload its settings while a coding session is
open, so that the open session keeps recording.

When the service has the new settings and is waiting for sessions to end,
`next_step` is `wait_for_open_sessions`. The text output also gives the number
of open sessions:

```text
  reason:  profile_runtime_not_applied
  next:    wait_for_open_sessions
  waiting: 2 open sessions. The background service reloads the new settings when they end. To reload now, run `trajectory config reload --force`.
```

The state clears by itself. When the last open session ends, the service
reloads, and the next `managed status` reports `compliant`. A session that
stays open with no activity stops counting after about 10 minutes. No one needs
to run `managed reconcile` again.

While the service waits, `managed reconcile` also reports `blocked` with next
step `wait_for_open_sessions`, and it exits with code `0`. Reconciliation has
done its part, so an MDM policy that runs it once per computer does not record
a failure. For a new profile revision, reconcile records it as applied at that
point. So `user.applied_profile` already shows the new revision, and status
goes straight to `compliant` after the reload. A removed profile is recorded as
removed, and status shows the same wait until the reload. Other reconcile
failures still exit with a nonzero code.

To apply the settings sooner, do one of these as the signed-in user:

- End or close the open coding sessions.
- Run `trajectory config reload --force`. It reloads the service now, while
  the sessions are open.

If `next_step` is `reload_runtime_configuration` instead, the service did not
accept the new settings. Run `trajectory config reload --yes` as the user, and
then check `trajectory doctor`.

### Settings wait for a service restart

Some settings take effect only when the background service restarts. A service
from an older release may also be unable to reload settings. In both cases the
running service keeps recording with its previous settings. It stops after
about 10 minutes without activity, and the next service to start uses the new
settings.

`managed reconcile` still writes the settings and records the profile revision
as applied. It reports `blocked` with reason `profile_runtime_restart_pending`
and next step `wait_for_service_restart`, and it exits with code `0`. Do not
rerun or reset the policy for this state. Until the service restarts, `managed status` reports
`blocked` with reason `profile_runtime_not_applied`.

These cases still fail with reason `profile_runtime_apply_failed` and a
nonzero exit code:

- The settings do not load, so a restart could not apply them either.
- Trajectory cannot read the running service's records or process, so it
  cannot tell what the service runs.
- The profile was removed. Reconcile records the removal only after the
  service drops the removed settings, so status never reports it early.

A service that runs an older release than the installed one keeps that
release until it restarts too. See
[The background service runs an older release](#the-background-service-runs-an-older-release).

To apply the settings now, run `trajectory serve restart` as the signed-in
user. It stops every Trajectory process of that user, then starts the
background service again.

### Claude Code settings changes

Setup registers the Trajectory plugin through Claude Code's own plugin
manager. Before each plugin manager command, setup copies `~/.claude.json`
and the `settings.json` and `settings.local.json` files in `~/.claude`, and
in `CLAUDE_CONFIG_DIR` when it is set. After the command, setup compares
each file.

| What setup finds | What setup does | What to do |
| --- | --- | --- |
| Every setting the file had is still there. Values may have changed. | Keeps the change and prints a warning that names the file and each changed key. | Nothing. |
| The file was empty before. | Keeps the settings Claude Code wrote and prints a warning that names the file. | Nothing. |
| A setting the file had is gone. | Puts that file back byte for byte, and Claude Code setup fails with a message that names the file and the removed key. The other files keep their changes. | If the same message appears on every run, contact Datadog support and include the setup output. |
| The file had comments or trailing commas, and the command rewrote it. | Puts the file back, because setup cannot tell what the rewrite kept. Claude Code setup fails. | Ask the user to make the file plain JSON, then run `managed repair` as the user. |
| Setup cannot copy the file, for example a link to a missing file. | Leaves the file alone, runs the command, and prints a warning that names the file. | Ask the user to fix or remove the file. |

When the Trajectory folder moved, setup removes the old Trajectory
marketplace and adds the new one. Removing the marketplace's entry and the
`trajectory@trajectory` plugin entry is part of that step, so it does not
fail setup.

### Client files linked by a dotfile manager

Dotfile managers such as GNU Stow, chezmoi and Home Manager can replace a
client's configuration file with a link into a dotfiles folder. Setup
handles a linked file by what the file holds.

| File | What setup does |
| --- | --- |
| A client's MCP server settings, such as ForgeCode's `.mcp.json` | Follows the link and edits the file it points to. Removal does the same and keeps the link. |
| Muse Code's `~/.config/muse/settings.json` and Antigravity's `~/.gemini/config/import_manifest.json` | Follows the link only to a regular file that the user owns inside their home folder, and only when setup runs as the user. Otherwise setup stops with `refusing to write through the link <file> because <reason>`. |
| A file or folder that Trajectory writes whole, such as a skill, a command, a hook file or a plugin folder | Never follows the link. Setup stops with `refusing to write symlinked setup target <file>` or a similar message. |

When setup stops, ask the user to replace the link with a copy of the file
it points to. For a configuration file, a link to a regular file in their
home folder also works. Then run `managed repair` as the user.

### The Trajectory folder was deleted

Use this section when someone deleted `~/.trajectory` on a Mac. Deleting it
does not remove Trajectory. The coding agents keep Trajectory's hooks, which
call the deleted binary. The next run of the Jamf Pro or Intune script puts
the user's binary back and sets up the clients again. To remove Trajectory,
see [Remove Trajectory](#remove-trajectory).

What the deletion lost stays lost:

- The user's sessions and pending uploads.
- The record of the highest profile revision. The Mac accepts any revision
  again, including one it refused before.
- The record of the clients that managed setup installed. Managed setup treats
  them as clients the user set up, so it no longer removes them when you take
  them out of the profile. To remove one, run `trajectory uninstrument <client>`
  as the user.

A Trajectory process that started before the deletion, such as the
background service, keeps running until it exits. Ask the user to quit their
coding agents, or restart the Mac.

### No background service is running

A coding agent starts the background service, and the service stops after
about 10 minutes without activity. On a new computer, and on any computer where
no coding agent ran recently, no service is running when the profile arrives.

The profile still applies right away. User reconciliation writes the settings
and, when the profile delegates `config.defaults.yaml`, downloads and applies
the remote file itself. No process uses older settings, and the next service
to start reads the current ones.

`managed status` then reports the user layer `compliant` with reason
`runtime_not_started` and next step `none`. The overall status stays
`compliant`. The text output adds this line:

```text
  service: no background service is running. The next one to start, usually with a coding-agent session, uses these settings.
```

No one needs to do anything. `managed reconcile` reports the same result and
exits with code `0`. It records the profile as applied, so
`user.applied_profile` shows the new revision.

While no service runs, user reconciliation also downloads the remote
`config.defaults.yaml` and the other selected files on the sync schedule. If
any file fails, it tries again after 1 minute, and waits twice as long after
each further failure, up to the sync interval. A file that fails or is rejected
shows in `configuration` as usual. See
[Rejected and missing files](#rejected-and-missing-files). While a service
runs, the service downloads the files instead.

When the profile is removed, reconciliation deletes its settings right away. It
records the removal only after a background service starts with the remaining
settings. Until then, the user layer reports `pending_policy` with reason
`configuration_profile_removed`, and reconcile exits with code `0`.

### The background service runs an older release

`trajectory install` starts the background service when none runs. When the
running service has another release, it stops that service and starts the
installed release. Each run of the Jamf Pro or Intune script runs
`trajectory install`. `trajectory update` restarts the service in the same way
after it installs a release.

Until then, the old service keeps recording sessions. It also stops after
about 10 minutes without activity, or when the Mac restarts. The next
coding-agent session then starts the installed release.

To move the service to the installed release now, run
`trajectory update repair --apply --yes` as the signed-in user. It restarts the
service from the installed binary, and leaves a service that already runs the
installed release alone.

`trajectory ps` shows the version that each service runs. `managed status`
checks only the installed binary, and `release` names its release. So status
can report `compliant` while an older service still runs.

A background service that an earlier installation started can keep the
capture port after that installation is gone. Deleting `~/.trajectory` and
installing again can leave it. Releases before the serve
coordinator never register their service, so the new installation cannot
restart it. Coding-agent setup then reports that capture did not become ready
in time. As the user, `trajectory doctor` reports
`A background service this installation did not start holds the capture port`
and names the service's process ID and version. Ask the user to quit every
coding-agent session and then sign out of macOS and back in, or restart the
Mac. The next coding-agent session starts the installed release.

### macOS asks to let trajectory access a folder

macOS protects some folders, such as Documents, Desktop, and Downloads. When a
user works in one of them, macOS can ask whether "trajectory" may access files
there. The background service reads each session's folder to tag the session
with its Git repository.

- If the user clicks Allow, nothing else changes.
- If the user clicks Don't Allow, the service stops reading that folder until
  it restarts, so macOS does not ask again. Sessions there are still captured
  and sent. Their `repo` tag names the folder instead of the repository, and
  they record no pull request evidence.

The "Project folder access" check in `trajectory doctor` lists the refused
folders. To allow access later, turn on `trajectory` under System Settings >
Privacy & Security > Files and Folders. Then run `trajectory serve restart`.
Your MDM can grant the same access with a privacy preferences (PPPC) profile.

### The background service runs but sends nothing

The background service can capture sessions and answer as ready while Datadog
accepts nothing it sends. Readiness only means its listener answers. Each
running service reports its delivery separately: `publish_delivery` in its
health record and in `/health`, and the "Datadog delivery" check in
`trajectory doctor`. The check fails when Datadog has accepted no metric or
heartbeat for 15 minutes or longer while sends were due. The service sends its
own metrics at least once a minute to a destination with marker metrics. A short
network or intake outage does not trip the check.

| `publish_delivery.status` | `reason` | What to do |
| --- | --- | --- |
| `publishing` | | Nothing. Datadog accepted a send in the last 15 minutes. |
| `starting` | | Nothing. The service started less than 15 minutes ago and has not had a send accepted yet. An in-place update counts as a start: a send accepted before it does not count for the new build. When the proxy refuses a send, the service reports `not_publishing` at once. When sends fail at least three times in a row over two minutes, because this build may not read the key's keychain item or because of a rejection such as HTTP 403, it reports `not_publishing` without waiting. A locked keychain, a key that is not stored yet, or refused metric data (HTTP 400, 413 or 422) can recover on its own, so the service waits out the 15 minutes. |
| `no_destination` | | Nothing, unless you expect data. No destination is set to receive metrics, for example because metrics are off. |
| `idle` | | Nothing. The destination receives only session and operational metrics, not the service's own every-minute metrics, and nothing was due to it in the last 15 minutes. |
| `not_publishing` | `config_load_degraded` | The configuration did not load when the service started, so it runs on built-in defaults. Run `trajectory doctor`, fix the configuration problem it names, then run `trajectory serve restart`. |
| `not_publishing` | `no_accepted_send` | Sends were due, and Datadog accepted none. When the check names the Datadog credentials as the cause, fix the key first; see [API keys were not stored](#api-keys-were-not-stored). |
| `not_publishing` | `proxy_unreachable` | A send failed because the proxy it goes through refused the connection, and Datadog accepted nothing since. `cause` names the proxy, for example `proxy unreachable 127.0.0.1:50200`, and `egress_proxy` says whether the service may go around it. The proxy comes from `HTTPS_PROXY`, `HTTP_PROXY` or `ALL_PROXY` in the environment the service started in. Start that proxy, or restart the service from an environment without it. See `inherited_proxy_direct_fallback` in [Feature Flags](CONFIGURATION.md). |
| `not_publishing` | `keychain_authorization` | A keychain item holds the API key, but this build may not read it without a macOS prompt. As the signed-in user, run the `trajectory config set-secret` command that `trajectory doctor` prints in Terminal, and enter the key. It names the keychain account the service reads. |
| `not_publishing` | `keychain_locked` | The keychain that holds the API key is locked. Unlock it by running `trajectory config secrets` in an interactive terminal as the signed-in user. |
| `not_publishing` | `keychain_missing` | The API key's keychain item, or the user's keychain, is missing. Store the key with the `trajectory config set-secret` command that `trajectory doctor` prints. |
| `not_publishing` | `credentials_unavailable` | The API key could not be read for another reason, such as a failed key command. Fix the key source that the "Datadog credentials" check in `trajectory doctor` names. |
| `not_publishing` | `network` | Sends got no answer from the Datadog intake. Check that the machine reaches the intake that `trajectory ps --json` shows for each destination. |
| `not_publishing` | `intake_rejected` | Datadog answered without accepting the data. `last_failure.http_status` gives the answer. For 401 or 403, check the destination's API key and site. For 400, 413 or 422, Datadog refused the metric data itself, so a new key does not help. The service sets those rows aside. |
| `not_publishing` | `no_send_attempted` | A destination is set, but the service sent nothing. Run `trajectory doctor logs --grep "publish delivery"`, then `trajectory serve restart`. |

`publish_delivery.destinations` has one entry for each Datadog destination
that a send was due for. Each entry names the destination and how its sends
travel:

- `network_path` is `direct`, `proxy` or `local`. With `proxy`, `proxy` gives
  the proxy's host and port. `local` means a loopback address, such as a local
  Agent. While the service goes around a refused proxy (`egress_proxy.state`
  is `direct_fallback`), the path is `direct`.
- `last_accepted_at` is the newest send that Datadog accepted.
- `last_failure` is the newest send that failed. Its `error_class` is
  `credentials_unavailable`, `proxy_unreachable`, `network` or
  `intake_rejected`.
- `http_status` gives the intake's answer. `consecutive` counts the sends in a
  row that failed since the last accepted one.
- For `credentials_unavailable`, `detail` is the key's state as
  `trajectory config secrets` prints it, such as `keychain_locked`.

`publish_delivery.last_failure` repeats the newest failure across all
destinations, with its `destination`.

When a failed send says why the service is not publishing, `reason` names
that cause instead of `no_accepted_send`, such as `keychain_locked`,
`network` or `intake_rejected`. The managed endpoint contract lists every
reason in its runtime delivery table. The same verdict and reason appear in
four places:

- `trajectory ps --json` gives each service a `delivery` object.
- `trajectory status` prints a `Datadog delivery:` line, and its JSON has a
  `delivery` object.
- The "Datadog delivery" check in `trajectory doctor` starts its headline with
  "Not publishing:" and puts the reason in its `reason` field.
- `trajectory managed status` reports `runtime.delivery`.

Each service also writes this state to `state/delivery/serve-<pid>.json` in
its Trajectory home, `~/.trajectory` by default. The file stays after the
service stops. An in-place update keeps it too. So the last accepted send and
the last failure can still be read. `exec_accepted_at` is the newest send
that Datadog accepted from the build running now. An in-place update starts it
empty, so it never shows the previous build's send. `previous_execs` lists the
builds the process ran before an in-place update. When a service starts, it removes the
files that were last written more than 14 days ago.

### API keys were not stored

When the Jamf script cannot store a key, its run exits 2. The next daily run
stores the key once the keychain can take it. See
[Read a Jamf script run's result](#read-a-jamf-script-runs-result).

Trajectory never shows a keychain prompt, never asks for a password, and never
unlocks a keychain when it stores a delivered key. Each reason in the table
below says why a delivered key was not stored, or why the user's keychain
cannot take keys now. A later delivery stores the key, or the signed-in user
runs `trajectory config set-secret <ref> --exact-name --replace-unreadable`
and enters the key.

| Reason | State | Next step | What to do |
| --- | --- | --- | --- |
| `keychain_locked` | `blocked` | `wait_for_user_unlock` | The user's login keychain is locked, for example after sleep, or after a password change that did not update the keychain. Ask the user to unlock the Mac or the keychain. |
| `session_locked` | `blocked` | `wait_for_user_unlock` | The keychain could not be used while the screen is locked. Wait until the user unlocks the Mac. |
| `no_user_session` | `blocked` | `wait_for_user_sign_in` | The delivery did not run in the user's graphical login session, for example because the user logged out during the run. Deliver the keys again while the user is signed in. |
| `keychain_missing` | `blocked` | `repair_login_keychain` | The user has no usable default keychain for a new key. Ask the user to repair or reset the login keychain in Keychain Access. |
| `keychain_search_list_missing` | `blocked` | `repair_keychain_search_list` | The user's default keychain is not in their keychain search list, so Trajectory cannot find or create keys in it. Ask the user to add the login keychain back to the search list. `security list-keychains -d user` shows the list. |
| `interaction_not_allowed` | `blocked` | `approve_keychain_access` | The keychain entry exists, but Trajectory cannot read it without a macOS prompt, and an MDM run cannot show one. Deliver the keys again. Or, as the user, run `trajectory config set-secret <ref> --exact-name --replace-unreadable` in Terminal and enter the key. Trajectory then replaces the entry with one it reads without a prompt. If a copy still cannot be deleted without a prompt, delete the entry in Keychain Access, then deliver the keys again. |
| `credential_store_failed` | `failed` | `retry_credential_delivery` | The write failed for another reason. Read the `set-secret` error in the delivery log, then deliver the keys again. |
| `credential_parameter_invalid` | `failed` | `set_credential_parameter` | The parameter for the key is empty, or names a file or keychain entry instead of the key. Enter the key itself. |

Managed reconciliation reads the keys too. When client setup fails only
because of the keychain, `managed reconcile` reports `keychain_locked`,
`interaction_not_allowed`, `keychain_missing`, or
`keychain_search_list_missing` instead of `setup_failed`, and `managed status`
reports `blocked`. It clears by itself once the user fixes the keychain and
the next reconcile succeeds.

To see what the delivery would find, run this as the signed-in user. It reads
lock and session state, and whether this build can read each key. A key whose
entry exists but cannot be read without a prompt reports `needs_authorization`
instead of `compliant`. The delivery still stores that key and replaces the
entry:

```text
trajectory managed credentials check --refs <ref>,<ref>
```

### Reconcile could not use an API key

Client setup checks the API key of every required destination before it
stops, so one run names every key that needs fixing. For each key it could
not use, `managed reconcile` prints a line like this to standard error, which
MDM scripts keep in the policy log. `managed repair` prints the same line
starting with `managed repair:`.

```text
managed reconcile: API key destination=security ref=dd-security-api-key: reason=interaction_not_allowed next_step=approve_keychain_access
```

The reconcile result keeps the first failing key's reason. While the last
reconcile is the one that failed on these keys, `trajectory managed status`
lists every one of them. The JSON output of both commands does not include
this list.

After a reconcile that succeeded, `managed status` and `managed reconcile`
read each key again with the no-prompt reader that `trajectory config secrets`
uses. A key can stop being readable later, for example after an update to a
build that the keychain entry does not trust. Status then reports the reason
from the table below, such as `interaction_not_allowed`, instead of
`compliant`.

Status text lists each key with the state that `config secrets` prints, such
as `needs_authorization`. `managed reconcile` reports the same reason and key
lines and exits 1, instead of reporting `already_compliant`. It does not run
client setup for this, so clients a user removed stay removed. A dry run
reports `reconciliation_plan_ready`.

Status ignores a keychain that is locked only in its own session, such as an
SSH session. The background service reads keys in the user's login session.

To check each key the way reconcile reads it, run this as the signed-in user:

```text
trajectory config secrets <ref> <ref>
```

It prints one line per key, such as `dd-security-api-key: needs_authorization`,
and never shows a prompt. It exits 0 only when every key is readable. See
[Check managed refs from a script](CONFIGURATION.md#check-managed-refs-from-a-script)
for every state and the `--json` output.

| Reason | State | Next step | What to do |
| --- | --- | --- | --- |
| `keychain_locked` | `blocked` | `wait_for_user_unlock` | Ask the user to unlock the Mac or the keychain. |
| `interaction_not_allowed` | `blocked` | `approve_keychain_access` | Deliver the keys again. Or, as the user, run `trajectory config set-secret <ref> --exact-name --replace-unreadable` in Terminal and enter the key. |
| `keychain_missing` | `blocked` | `repair_login_keychain` | Ask the user to repair or reset the login keychain in Keychain Access. |
| `keychain_search_list_missing` | `blocked` | `repair_keychain_search_list` | Ask the user to add the login keychain back to the search list. |
| `credential_missing` | `failed` | `store_credential` | No keychain entry exists under the reference, or it is empty. Deliver the key again, or as the user run `trajectory config set-secret <ref> --exact-name`. |
| `credential_validation_failed` | `failed` | `check_api_key` | Datadog rejected the key, or could not be reached to check it. Check that the key is correct and active for the destination's site, then deliver it again. |
| `credential_read_failed` | `failed` | `repair_user_reconciliation` | Reading the key failed for another reason. Read the reconcile error in the policy log. |

### Script messages and exit codes

For the Jamf Pro and Intune script, see
[Read a Jamf script run's result](#read-a-jamf-script-runs-result). This table
covers the adapter scripts in the Jamf Pro and Intune bundles.

<!-- BEGIN SCRIPT MESSAGES -->
<!-- A contract test checks every result token the bundle's scripts print, and the exit code after it, against this table. -->

Each detection script run prints one result line, and that line decides the
exit code. Jamf Pro and Intune record exit code 0 as a success and any other
code as a failure. A line with `-` in the **Exit** column is information that
a run prints along the way.

| Message | Script | Exit | Meaning and what to do |
| --- | --- | --- | --- |
| `Trajectory reconciliation requires the resolved user or MDM context` | every `adapter/` script | - | The script ran as an account other than root or the signed-in user. Run it as root. |
| `TrajectoryManaged=compliant` | `package-policy-check.sh`, `detect.sh` | 0 | The installation and the profile are compliant. |
| `TrajectoryManaged=paused` | `package-policy-check.sh`, `detect.sh` | 0 | An administrator paused managed setup. |
| `TrajectoryManaged=pending_user` | `package-policy-check.sh`, `detect.sh` | 1 | Nobody is signed in, or macOS did not return the signed-in user's account, so the script cannot check the installation. |
| `TrajectoryManaged=noncompliant` | `package-policy-check.sh`, `detect.sh` | 1 | The installation or the profile is not compliant. Run `trajectory managed status --scope all` as the user. |
| `TrajectoryManaged=noncompliant account=unsupported` | `package-policy-check.sh`, `detect.sh` | 1 | The signed-in account is a system account, or has a name that Trajectory refuses. Trajectory never sets it up. |

The inventory scripts (`extension-attribute.sh`, `custom-attribute.sh` and
`configuration-inventory.sh`) print one state
and always exit 0. For a signed-in system account or an account name that
Trajectory refuses, `extension-attribute.sh` and `custom-attribute.sh` print
`blocked`.
<!-- END SCRIPT MESSAGES -->

### Apple notarization checks

Datadog confirms with Apple that each published macOS binary is notarized
before it publishes the release. The release's checksum file names that
binary's SHA-256.

The Jamf Pro or Intune script checks a downloaded binary before it places it.
It checks Datadog's Developer ID signature: Datadog's Team ID, the hardened
runtime and a secure timestamp. It then checks that the binary answers the kit's
interface check. If a check fails, the script installs nothing and exits with
code 1. Trajectory's updater checks the release's checksum and the same
signature before it installs a new release, and keeps the current release if
a check fails.

The signature ties the binary to Datadog, which checked it with Apple before
it published the release. So neither the script nor the updater asks Apple's
notarization service from the Mac. You do not need to allow Apple's notarization host or exempt it from
HTTPS inspection, and Gatekeeper's setting does not affect installation or
updates.

### Metrics stay on the computer

Trajectory keeps each session's metrics in a local queue until a destination
accepts them. Each queued row names one destination. Rows for a destination
that is gone, or that no longer takes metrics, never send on their own. Age
does not remove them. Only a queue larger than 20 GiB drops pending rows, and
only those older than 30 days.

To see where rows wait, run these commands as the signed-in user. They change
nothing and print no key.

```bash
trajectory publish status
trajectory publish metrics outbox status --status pending --limit 50
```

Compare each row's `destination=` with the destinations that
`publish status` lists. To find the oldest waiting point for each
destination without changing anything, run:

```bash
sqlite3 "file:$HOME/.trajectory/state/metric-publish-outbox.sqlite?mode=ro" \
  "SELECT destination_key, COUNT(*), date(MIN(point_timestamp), 'unixepoch')
   FROM metric_publish_outbox WHERE status = 'pending' GROUP BY 1;"
```

| What you see | Cause | What to do |
| --- | --- | --- |
| Rows name a destination that `publish status` does not list. | The destination was renamed or removed, for example by a move to a new profile. | Run `trajectory publish history --since YYYY-MM-DD` with a date on or before the oldest of those rows, and read its `Stranded rows` line. Then run the same command with `--yes`. It retires the stranded rows in that window and sends the same points to the current destinations. Rows older than the window stay queued. For a date before what the current destinations already received, the command warns that points whose tags changed can appear twice. |
| Rows show `error_class=credentials_unavailable`. | Trajectory cannot read the destination's key from the keychain. | Fix keychain access for that key. The rows send at the next retry, at most an hour later. |
| `trajectory doctor` says Datadog is rejecting the metrics API key, or rows show `error_class=credentials_rejected`. | Datadog answered 401 or 403 three times in a row, for example because the key was revoked or lacks access to the site. Metric delivery to that destination is paused; queued metrics are kept. | Check or rotate the key. A new key is used at once; for the same key, run `trajectory publish queue retry --kind metrics`. Otherwise Trajectory retries on its own, at least every 15 minutes. |
| The destination shows `metrics disabled`, and its rows show `attempts=0`. | Metrics are off for that destination. | Turn metrics on for it, or [clean up the rows](PUBLISH.md#clean-up-rows-for-a-destination-that-cannot-accept-them). |
| `Metrics: disabled for all resolved destinations`. | No destination takes metrics. A destination with `incognito_exempt: true` never does. | Set `export.metrics: true` in the organization defaults. |

### Remote configuration

Computers download remote files over HTTPS without a user sign-in. Normal
certificate checks apply. If a download fails, the computer retries after one
minute. The wait doubles after each failure, up to the sync interval. On a new
computer, every required file must download before setup runs.

## Reference

### Intent file fields

The [Managed Endpoint Settings Reference](MANAGED-ENDPOINT-SETTINGS.md)
lists every setting with its default and allowed values. It also explains
which settings the profile owns and which a remote `config.defaults.yaml` can
change. To get the full JSON Schema with every limit, run
`trajectory-mdm schema --output managed-endpoint-intent.schema.json`. Add
`"$schema": "managed-endpoint-intent.schema.json"` to the intent for editor
completion.

| Field | From version | Description |
| --- | --- | --- |
| `schema_version` | 1 | Required. 1 to 5. A higher version allows more fields. |
| `deployment_id` | 1 | Required. A stable name of up to 64 letters, digits, dots, dashes, or underscores. |
| `provider` | 1 | Required, except for Jamf Pro, where `trajectory-mdm` fills in `jamf`. A policy ID from the provider table. |
| `platform` | 1 | Required, except for Jamf Pro, where `trajectory-mdm` fills in `macos`. `macos` or `windows`. |
| `clients` | 1 | Required. Client IDs from the client table. |
| `migration_mode` | 1 | `update_in_place` or `clean_reinstall`, for the migration tools in the bundles of other MDM products. Jamf Pro and Intune bundles take only `update_in_place`. See [Choose how to migrate existing installations](#choose-how-to-migrate-existing-installations). |
| `tags` | 1 | Up to 64 tags that Trajectory adds to managed telemetry. Never put secrets in tags. |
| `destinations` | 2 | Required from version 2. Jamf Pro on macOS only. |
| `organization_sync` | 3 | Your remote configuration source. Required from version 4. With a remote `config.defaults.yaml`, its file list, `markers_path`, and interval are starter values. |
| `cohort` | 3 | A cohort name for these users. Needs `organization_sync`. |
| `sensitivity_scanning` | 3 | Removed. Accepted and ignored. See [Removed sensitivity settings](#removed-sensitivity-settings). |
| `client_command_shims` | 5 | Launcher wrappers for `claude`, `codex`, and `copilot`. |
| `auto_instrument`, `features` | 5 | See [Organization settings](#organization-settings-schema-version-5). |
| `task_segmentation` | 5 | Read only by releases older than 0.6.1, such as `enabled: false` to turn their segmentation off. Current releases ignore it. |
| `security_modules` | 5 | First configuration of security modules. |
| `identity` | 5 | `user_email_suffix`, your email domain for user identity. |
| `publish_trust`, `pricing`, `historical_replay`, `user_guide_overrides` | 5 | Advanced settings. See the [settings reference](MANAGED-ENDPOINT-SETTINGS.md#settings). |

`claude-desktop` and `muse` work only on macOS.

### Destination fields

| Field | Description |
| --- | --- |
| `name`, `ml_app` | Required. The destination name and the LLM Observability application name. |
| `type` | Required. `dd_llmobs`. |
| `site` | Required. `datadoghq.com`, `us3.datadoghq.com`, `us5.datadoghq.com`, `datadoghq.eu`, `ap1.datadoghq.com`, `ap2.datadoghq.com`, or `ddog-gov.com`. |
| `level` | Required. `off`, `minimal`, `standard`, or `full`. |
| `api_key_ref` | Required. The keychain entry name that holds the API key. |
| `incognito_exempt` | `true` lets the destination receive data in incognito mode. Needs `level` `full` and markers off. |
| `markers`, `operational_logs`, `tags` | Marker, log, and tag settings. See the JSON Schema. |
| `privacy` | Removed. Accepted and ignored. See [Removed sensitivity settings](#removed-sensitivity-settings). |
| `service`, `module_spans` | Version 5. Service name and module spans. |
| `segmentation` | Version 5. Read only by releases older than 0.6.1. Current releases ignore it. |
| `agent_security` | Version 5. `metrics`, `findings`, and `disclosure_profile`. |
| `event_stream` | Version 5. `enabled` and `privacy_profile` (`security` or `full`). Needs `incognito_exempt`. |
| `ai_usage` | Version 5. `enabled` and an optional HTTPS `endpoint`. Not allowed with `incognito_exempt`. |
| `backfill_opt_out` | Version 5. `true` stops backfill to this destination. Backfill is on by default. |

Put AI Usage on a separate destination from Agent Security findings and the
event stream. The `full` event stream profile includes private fields.

#### What the destination settings send

| Setting | What it controls on this destination |
| --- | --- |
| `level` | LLM Observability spans. `off` sends no spans. |
| `markers.enabled` and `markers.metrics` | Marker metrics. |
| `markers.enabled` and `markers.logs` | Marker event logs. |
| `markers.metrics: false` | Also stops turn and session metrics. `trajectory publish status` then shows `metrics disabled` for the destination. Session start counts and deployment heartbeats still go. |
| `agent_security` | Agent Security metrics and findings. |
| `operational_logs` | Operational log events. |
| `tags` | Tags added to this destination's spans and metrics. |

The operational dashboard counts a computer from its deployment heartbeats,
`trajectory.ops.binary.heartbeat` and `trajectory.ops.update.state`.
No marker setting controls them. Each computer sends them once an hour to every
Datadog destination that takes metrics. A destination receives them while
`export.metrics` is on, which is the default, or while its marker metrics are
on. Incognito mode stops them.
Heartbeats carry the intent's `tags` and the destination's `tags`, so a
dashboard filtered by those tags includes them.

When no destination can take a heartbeat, the computer retries every 10
minutes. Its serve log says `deployment heartbeat: not sent` at most once an
hour.

### Removed sensitivity settings

Sensitivity scanning was removed. An intent that still has
`sensitivity_scanning` or a destination `privacy` block is accepted and
compiles as before, so deployed profiles keep working. Endpoints ignore those
settings: every session publishes at the destination's `level`. Leave them out
of new intents.

A release that still has sensitivity scanning checks every managed document
that it downloads. It rejects a document in which the scanning block is on
without the rest, with one of these errors:

- "non-off sensitivity scanning requires a sensitivity_classifier destination"
- "enabled sensitivity scanning requires its feature gate"
- "sensitivity enabled must match its scanning mode"

After a rejection, that endpoint keeps its previous remote configuration. A
release without sensitivity scanning accepts all of these documents. Until
every endpoint runs such a release, remove the settings in this order:

1. Turn the scanning block off first, or remove the whole block. To turn it
   off, set `sensitivity_scanning.mode: "off"` in the intent. This compiles
   `export.sensitivity.enabled: false` and `scanning_mode: "off"`.
2. Then remove the destination `privacy` keys and the `sensitivity_scanning`
   feature, in either order.

You can also remove the block, the feature, and the destination keys in one
document. Once every endpoint runs a release without sensitivity scanning, any
order works.

Remove each object whole. In an intent, `sensitivity_scanning` and a
destination's `privacy` object are each optional. When one is present, it
needs all of its fields:

- `sensitivity_scanning` needs `mode`, `near_realtime_interval_minutes`,
  `monthly_budget_usd`, and `session_end_timeout`.
- `privacy` needs `sensitivity_classifier`, `sensitivity_exempt`, and
  `sensitive_policy`.

In remote `config.defaults.yaml`, a release without sensitivity scanning also
accepts an `export.sensitivity` block with missing fields or with values that
disagree. An older release does not.

### Organization sync

```json
"organization_sync": {
  "config_source": "https://config.example.com/trajectory",
  "markers_path": "rules/markers.yaml",
  "sync_interval_seconds": 3600,
  "files": [
    {"name": "markers.yaml", "path": "rules/markers.yaml", "required": true},
    {"name": "RELEASES.json", "path": "RELEASES.json", "required": false}
  ]
}
```

`config_source` must use HTTPS. `sync_interval_seconds` is 60 to 86400.
Computers sync at least once every 14400 seconds, and `validate` warns about a
longer interval. From
version 4, `files` lists up to 9 files to sync. Supported names are
`markers.yaml`, `pricing.yaml`, `provider-pricing.yaml`,
`model-equivalence.yaml`, `cohort.yaml`, `RELEASES.json`,
`config.defaults.yaml`, and `custom-pricing.yaml`. To approve releases with
`RELEASES.json`, see
[Approve releases with `RELEASES.json`](#approve-releases-with-releasesjson).
Computers still accept a `deployment.json` entry and download the file, but
they no longer use it, and `trajectory doctor` warns about the entry. Remove
the entry before you stop hosting the file.

`custom-pricing.yaml` is your organization's custom rate card: prices for your
organization that apply on top of the default rate card. Computers download it
only when `files` names it. They check the whole file before they install it.

Computers download each file from a `latest/` folder next to its path. For
example, `rules/markers.yaml` comes from
`<config_source>/rules/latest/markers.yaml`.

- Paths cannot be absolute, contain `..`, repeat, or name `config.yaml`.
- A `markers.yaml` entry must use the `markers_path` value.
- A `cohort` needs a required `cohort.yaml` entry at `cohorts/<cohort>.yaml`.

Computers download only the files in `files`. `markers_path` is required, but
it has no effect unless `files` has a `markers.yaml` entry. To download
markers, add this entry with your `markers_path` value:

```json
{"name": "markers.yaml", "path": "markers.yaml", "required": false}
```

Without that entry, `validate`, `build`, and `prepare` print a warning and
still succeed. With `--format json`, the warning is in the `warnings` field
instead.
If you do not host a markers file, you can leave the entry out.

When you remove a file from the list, computers delete their copy.

Computers download the files every `sync_interval_seconds`. When a new profile
changes `config_source` or `files`, computers do not wait for the interval.
The background service downloads from the new source or file list when it
applies the profile, or when it next starts. If a download fails, it tries
again after 1 minute. The wait then doubles after each failure, up to the
interval in effect. To download the files at once on one computer, run
`trajectory config sync` there.

When `files` lists `config.defaults.yaml`, the remote file's `files`,
`markers_path`, and sync interval replace the profile's once a computer
accepts it. Computers download the files that a newly accepted file adds, and
delete the ones it drops, in the same sync. See
[Change behavior without redeploying the profile](#change-behavior-without-redeploying-the-profile).

### Organization settings (schema version 5)

These settings can also come from the remote `config.defaults.yaml`.

| Field | Description |
| --- | --- |
| `auto_instrument.enabled` | Lets the background service set up approved clients that users install later. Managed setup already does this for the clients in `clients`; see [Clients installed later](#clients-installed-later). |
| `auto_instrument.apply_enabled` | `true` applies changes. `false` only reports them. |
| `auto_instrument.interval_seconds` | Seconds between setup passes, 300 to 86400. |
| `auto_instrument.allow_clients` | Client IDs to set up, or `all`. |
| `auto_instrument.deny_clients` | Client IDs never to set up. |
| `features.periodic_auto_instrument` | `false` pauses periodic client setup. |
| `features.agent_security_ai_edr_v2` | Makes the AI-EDR evaluator available. It turns on no module. |
| `features.agent_security_skill_scanner` | Makes Skill Scanner available while AI Guard or AI-EDR is enabled. It turns on no module. `false` stops it on every computer. |

Before publishing `features.agent_security_skill_scanner` as `true` or `false`,
upgrade every targeted endpoint to a release that supports this flag. Earlier
endpoints reject the entire hosted settings document when it contains an unknown
feature flag. They then miss unrelated settings changes too.

Withdrawing `auto_instrument` stops later client changes. It does not remove
integrations. For Jamf Pro, `prepare --interactive` asks for these settings,
except `auto_instrument.deny_clients`, `features.agent_security_ai_edr_v2` and
`features.agent_security_skill_scanner`.

### Install owner of a managed Mac

The Jamf Pro and Intune scripts write no install-owner record. While MDM has
the Trajectory configuration profile installed, managed setup treats the
signed-in user's `~/.trajectory/bin/trajectory` as managed, with install owner
`mdm` from source `profile`. Managed setup means automatic client setup, the organization-sync
health check, and doctor's install config path check. Only a root-owned
`/Library/Managed Preferences/com.datadoghq.trajectory.plist` with a Trajectory
profile key and no extended ACL counts. `~/.trajectory/selfupdate.conf` and
environment variables cannot turn this off, and a managed owner they name, such
as `jamf`, is still shown. The profile does not change updates: it neither
turns them on nor off. If the profile file cannot be checked, managed setup
treats the owner as unknown. Removing the profile ends managed setup. Earlier
releases count an installation as managed only when `selfupdate.conf` names a
managed owner.

### Other helper commands

`trajectory-mdm providers` lists MDM products, and `trajectory-mdm build` writes
the compiled policy for your own automation. Run `trajectory-mdm help COMMAND`
for any command.
