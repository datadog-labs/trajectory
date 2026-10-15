# Managed Endpoint Administrator Guide

This guide is for IT and endpoint administrators who deploy Trajectory to
developer computers with an MDM product. It shows how to deploy, configure,
check, update, and remove Trajectory.

## Before You Start

### Supported platforms and MDM products

Trajectory runs on managed macOS and Windows computers. Datadog supports and
tests Trajectory on Apple Silicon Macs. Intel Macs can install the universal
binary, but Datadog does not support or test them.

On macOS, Trajectory needs macOS 12.0 or later. Before it downloads anything,
the installation script stops on an older Mac. It also stops on a Mac that
cannot run the bundle's `--architecture`. That is `arm64` on an Intel Mac, or
`amd64` on an Apple Silicon Mac without Rosetta. The default, `universal`, runs
on both.

The deployment method depends on your MDM product:

| MDM product and platform | Application | Settings | Datadog API keys |
| --- | --- | --- | --- |
| Jamf Pro on macOS | Installation script | Configuration profile | Delivered by Jamf Pro |
| Microsoft Intune on macOS | Installation script | Configuration profile | Not delivered |
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
- Network access from each computer to GitHub and to Apple. The installer
  downloads the release and checks its notarization online. See
  [Apple notarization checks](#apple-notarization-checks) for the Apple hosts.
- On macOS, Gatekeeper assessments turned on. Trajectory refuses to install
  or update without Apple's notarization check.
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
   file). For Jamf Pro and Intune on macOS, the bundle has an installation
   script and a configuration profile.
3. You assign the script and the profile to the same computers in your MDM.
4. The script downloads the published release from the public
   `datadog-labs/trajectory` GitHub repository. It installs it for the
   signed-in user at `~/.trajectory/bin/trajectory`.
5. A user LaunchAgent applies the profile's settings and sets up the clients.
   It runs at login, when the profile changes, and every minute.

The helper reads only the release record and checksums. The installation
script checks Datadog's Apple signature and notarization on each computer
after it downloads the binary. Trajectory's updater does the same. Both refuse
a binary that fails these checks.

## Deploy Trajectory

These steps are for Jamf Pro and Intune on macOS. For other products and for
Windows, see
[Deploy with other products or on Windows](#deploy-with-other-products-or-on-windows).

> [!WARNING]
> Do not deploy v0.6.0 or its beta releases through MDM. Their Apple check
> rejects every notarized release. A computer with one of them cannot update
> itself. Assign it an `update` script from a later release.

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

Linux and Windows helpers have no Apple signature, so the checksum is their
only check. Keep a copy of each helper that you deploy. You need it later to
generate update, rollback, and removal scripts for that release.

### Step 2: Save the release files

The helper needs two files from the release. Set `VERSION` to the release
version without the `v`, such as `1.2.3`. It must match the helper version.

Save the GitHub release record as `public-release.json`:

```bash
curl -fsSL -o public-release.json \
  "https://api.github.com/repos/datadog-labs/trajectory/releases/tags/v${VERSION}"
```

Save the release checksums as `checksums.sha256`:

```bash
curl -fsSL -o checksums.sha256 \
  "https://github.com/datadog-labs/trajectory/releases/download/v${VERSION}/checksums.sha256"
```

Download them over HTTPS from GitHub as shown. The bundle verifier checks the
bundle, but not these two files. Keep both files unchanged. You need them to
generate the bundle again.

### Step 3: Write the intent file

The intent file is a JSON or YAML file that your organization owns. Keep it in
source control. This Jamf Pro example sets up Claude Code and Codex and sends
data to one Datadog destination:

<!-- BEGIN INTENT JSON EXAMPLE -->
```json
{
  "schema_version": 2,
  "deployment_id": "engineering-coding-agents",
  "provider": "jamf",
  "platform": "macos",
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

For Intune, use `"schema_version": 1` and `"provider": "intune"`, and leave out
`destinations`. `api_key_ref` is the name of the keychain entry that will hold
the API key. Never put a key or other secret in the intent file. See the
[Managed Endpoint Settings Reference](MANAGED-ENDPOINT-SETTINGS.md)
for every setting, its default, and its allowed values.

To check the intent without creating a bundle, run
`trajectory-mdm validate --file trajectory-managed.json`. It refuses a URL
that still contains a placeholder in angle brackets, such as `<your-host>`.

You can also answer questions instead of writing JSON. Run
`trajectory-mdm prepare --interactive` with the release file options from
Step 4. It asks for the MDM product, the clients, and optional tags. It shows
the whole deployment for review before it creates the bundle.

For Jamf Pro on macOS, the answers give the same kind of deployment as an
intent file with `schema_version` 5. The helper also asks for these settings:

- The HTTPS server for your hosted settings file, and how often computers
  download from it. See
  [Change behavior without redeploying the profile](#change-behavior-without-redeploying-the-profile).
- Who installs new releases: your MDM, or the Trajectory updater. With the
  updater, it offers to approve each release in a hosted `RELEASES.json`
  file. See [Choose who controls updates](#choose-who-controls-updates).
- Your destinations and their keychain entry names. It never asks for API
  keys.
- Automatic setup of clients that users install later, the task
  segmentation interval, a service label for each destination, and the
  optional launcher wrappers.

If you have no HTTPS server, write the intent file instead. The review lists
the settings that the questions leave out, such as `security_modules` and
`identity`. To set them, write an intent file and run `prepare --file`.

#### Write the intent as commented YAML

`trajectory-mdm` also reads the intent from a YAML file named
`trajectory-managed.yaml` or `trajectory-managed.yml`. YAML allows comments, so
one commented file can be the source of truth for a deployment. This file holds
the same intent as the JSON example above:

<!-- BEGIN INTENT YAML EXAMPLE -->
```yaml
# trajectory-managed.yaml: Trajectory deployment intent. Comments are ignored.
schema_version: 2                         # intent contract version
deployment_id: engineering-coding-agents  # stable ID; keep it for every revision
provider: jamf                            # policy ID from the provider table
platform: macos                           # macos or windows
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

### Step 4: Generate and verify the bundle

Generate the bundle:

```bash
trajectory-mdm prepare --file trajectory-managed.json \
  --release-json public-release.json --checksums checksums.sha256 \
  --output trajectory-deployment.zip
```

The defaults are `--architecture universal`, `--operation install`, and
`--profile-revision 1`. Add `--force` to replace an existing output file.

Check the bundle before you upload it:

```text
trajectory-mdm verify --bundle trajectory-deployment.zip
```

The verifier rebuilds every file and reports any file that differs. Use the
same helper version that generated the bundle.

The bundle has these files to upload:

- `application/installer.sh`, the installation script.
- `update/installer.sh`, the `update` script for the same release. Assign it
  only to computers where `install` stops with `installed_release_older`.
- `trajectory.mobileconfig`, the configuration profile.
- `trajectory-login-items.mobileconfig`, a second profile that makes
  Trajectory's background jobs [managed login items](#managed-login-items).
- `adapter/`, the scripts for detection, inventory, and on-demand user setup.
- `README.md` and `provider-notes.md`, the steps for your MDM product.

Do not edit generated files. To change the deployment, edit the intent and
generate a new bundle.

### Step 5: Assign the bundle in your MDM

Create one MDM item for the script and one for each profile. Assign them to
the same computers. Assign the profiles first, and check that they reach a
computer before the script runs there. On macOS 13 and later, the script adds
a LaunchAgent. If `trajectory-login-items.mobileconfig` is not installed yet,
the user can see one "Background Items Added" notification. Jamf API key
delivery also needs the settings profile first: it must reach the computer
before `reconcile-current-user.sh` can store keys. The script starts as root,
finds the
signed-in user, and installs Trajectory as that user. Each run sets up only
that user. On a Mac that several people use, each of them needs a run while
they are signed in. MDM script parameters
cannot change the release or the operation. If no user is signed in, the
script changes nothing and exits 1, so that your MDM runs it again. For Jamf,
use the triggers and retries in [Jamf policy settings](#jamf-policy-settings).
For Intune, see [Microsoft Intune](#microsoft-intune).
[Script messages and exit codes](#script-messages-and-exit-codes) lists every
line the scripts print.

Roll out to a few test computers first, then a small group of users, then
everyone.

#### Jamf Pro

1. Upload `application/installer.sh` as a computer policy script that runs as
   root with `/bin/bash`. Set the policy's frequency and retries as
   [Jamf policy settings](#jamf-policy-settings) describes.
2. In **Computers > Configuration Profiles**, upload `trajectory.mobileconfig`.
   Choose **Computer Level**. Keep the payload identifiers and UUIDs.
3. Upload `trajectory-login-items.mobileconfig` as a second configuration
   profile in the same way. See [Managed login items](#managed-login-items).
4. Add `adapter/extension-attribute.sh` as a computer extension attribute.
5. Add `adapter/configuration-inventory.sh` as a second extension attribute
   of type String. It also reports which clients are set up. See
   [Check each client](#check-each-client).
6. Use `adapter/package-policy-check.sh` in a recurring check-in policy for
   detection.

If the intent has destinations, deliver the API keys:

1. Create a policy that runs `adapter/reconcile-current-user.sh`.
2. Open `adapter/credential-parameters.json`. It shows which script parameter
   holds each key, starting at parameter 4.
3. Enter each API key in its script parameter.

Enter the keys only in Jamf Pro. The script writes each key to the user's
keychain and then applies the settings. With no user signed in, or before the
configuration profile reaches the computer, it exits successfully without
writing keys. Jamf Pro counts that as a success, so a recurring policy must run
the script again. See [Jamf policy settings](#jamf-policy-settings).

Before it writes a key, the script checks the user's keychain without showing a
prompt or asking for a password. If the keychain cannot take keys now, for
example because it is locked, the script writes no keys. It prints a
`TRAJECTORY_RECONCILE_BLOCKED:` line with the reason and next step, and exits 1.
See [API keys were not stored](#api-keys-were-not-stored).

See the Jamf Pro documentation on
[package deployment](https://learn.jamf.com/en-US/bundle/jamf-pro-documentation-current/page/Package_Deployment.html)
and
[computer extension attributes](https://learn.jamf.com/r/en-US/jamf-pro-documentation-current/Computer_Extension_Attributes).

#### Jamf policy settings

<!-- BEGIN JAMF POLICY SETTINGS -->
<!-- A contract test keeps this block identical in the Jamf provider notes and the administrator guide. -->

Assign both configuration profiles first. Then create three policies scoped to
the same computers:

| Policy | Scripts | Trigger and execution frequency |
| --- | --- | --- |
| Install | `installer.sh` with priority **Before**, then `reconcile-current-user.sh` with priority **After** and the API keys in its script parameters | **Recurring Check-in** and **Login**, **Once per computer**, with **Automatically re-run policy on failure** turned on |
| Credential refresh | `reconcile-current-user.sh` with the same script parameters | Recurring Check-in, **Once every day** |
| Self Service | `reconcile-current-user.sh` with the same script parameters | Self Service, **Ongoing** |

`adapter/credential-parameters.json` gives the parameter number for each API
key. When you rotate a key, change it in all three policies. Also change it in
the shared-Mac install policy, if you created one. See
**Macs that several people use** below.

Why these settings:

- **Once per computer traps a failed run.** Jamf logs the failed run as done.
  It does not run the policy on that computer again until you flush that
  computer's entry in the policy logs. Automatic re-run retries a nonzero exit
  only up to its retry count. Running `install` again is safe once an
  installer script manages the installation. It checks the installed release
  and restores missing files, whatever release is installed, and never
  replaces it.
- **The installer needs a signed-in user.** At the login window it changes
  nothing, prints `TRAJECTORY_INSTALLER_BLOCKED reason=no_user: no real user signed in; retry at login`
  and exits 1. Jamf counts that as a failure and uses one automatic re-run.
  Recurring Check-in also runs at the login window, so a Mac left there for
  many check-ins, for example overnight, can use up its re-runs. The Login
  trigger also starts the policy when a user signs in. Jamf runs Login
  policies only when login events are turned on in the computer check-in
  settings. Set the retry count as high as Jamf allows. For a Mac that used up
  its re-runs, flush its entry in the install policy logs.
- **Pending lines need no rerun.** `TRAJECTORY_SETUP_PENDING` and
  `TRAJECTORY_RUNTIME_PENDING` mean the release is installed and the run exits
  0. The user LaunchAgent finishes setup and the switch to the new release on
  its own. The one exception is
  `TRAJECTORY_RUNTIME_PENDING: installation verified; rerun the installer to retry runtime convergence`.
  An older release, or a failed retry record, gives this line. Flush the
  computer's entry in the install policy logs so the policy runs again.
  A `TRAJECTORY_SETUP_PENDING reason=<reason>:` line means the Mac refused
  the configuration profile. Deploy the profile revision that the line names.
- **Reconcile exits 0 when it cannot finish yet.** No user may be signed in,
  or the configuration profile may not have reached the Mac. Then the script
  prints a `TRAJECTORY_RECONCILE_PENDING:` line, stores no API keys, and exits
  with code 0. Jamf records a success and does not retry it. The daily
  credential refresh policy runs it again. A repeated run stores the same keys
  and repeats user setup.
- **A key that was not stored fails the run.** The user's keychain can be
  locked, or unable to take a key for another keychain or session reason. Then
  the script prints a `TRAJECTORY_RECONCILE_BLOCKED:` line and exits 1. Any
  other key failure prints `TRAJECTORY_RECONCILE_FAILED:`. Automatic re-run
  then runs the policy at a later check-in, and the daily credential refresh
  policy runs it again. The installation and the profile stay in place.
- **The profile must arrive before reconcile.** Jamf runs **Before** scripts,
  then packages, then **After** scripts, so the installer finishes before
  reconcile starts. The profile is not part of that sequence. MDM delivers it
  separately.
- **Self Service is for a user waiting on the result.** Use it after the
  user's first sign-in, after the user unlocks or repairs the login keychain,
  or after support fixes a failed run. Do not rely on it to deliver keys,
  because users may never open it.

After a failed install, Jamf still runs the After script. Reconcile then finds
one of these:

| What is in `~/.trajectory/bin` | What reconcile prints | Exit |
| --- | --- | --- |
| No binary | `TRAJECTORY_RECONCILE_BLOCKED: the signed-in user has no ~/.trajectory/bin/trajectory` | 1 |
| A release without managed profile support, such as 0.5.38, which prints `--scope must be user` | `TRAJECTORY_RECONCILE_BLOCKED: ~/.trajectory/bin/trajectory rejected 'managed reconcile --scope profile'` | 1 |
| A release with profile support | Its normal output; reconcile runs against that release | 0 or 1 |

A blocked reconcile stops before it passes any API key to the binary. Find the
installer's `TRAJECTORY_INSTALLER_BLOCKED` line in the same policy log, fix
the cause, then flush that computer's entry in the install policy logs. Never
delete installer state or its lock file to force a run.

**Macs that several people use.** Each user gets their own installation,
LaunchAgent, keychain items, and settings. Every script sets up only the user
who is signed in when it runs. With **Once per computer**, a user who first
signs in after the install policy succeeded is never set up. For these Macs:

1. Create a second install policy with the same scripts, script parameters,
   and triggers.
2. Set its execution frequency to **Once per user per computer**.
3. Scope it to these Macs, and exclude them from the first install policy.

Automatic re-run works only with **Once per computer**, so the second policy
does not retry a failed run. To run it again, flush that computer's
entry in its policy logs. A new run for a user who is already set up only
checks that user's installation.

Scripts for `update`, `rollback`, and `remove` also act only for the
signed-in user. On these Macs, give their policies the same frequency. Jamf
then runs each policy once for each user, so a replaced script does not reach
users who already ran the policy. For each new `update` or `rollback`, create
a new policy, or flush the policy logs after you replace its script. A user
with no installation gets
`TRAJECTORY_INSTALLER_BLOCKED reason=wrong_operation: no script-managed installation` from them.
When you update or roll back, also put the `install` script of the new
release in the second install policy. Users who sign in later then get that
release. A `rollback` script cannot fix a later user's installation,
because that user has no earlier release to return to. The daily credential
refresh reaches only the user who is signed in when it runs.
<!-- END JAMF POLICY SETTINGS -->

#### Microsoft Intune

1. Under **macOS shell scripts**, upload `application/installer.sh`.
2. Set **Run script as signed-in user** to **No**. Keep a retry limit for
   nonzero exits.
3. In **Devices > macOS > Configuration > Create**, choose
   **Templates > Custom**.
4. Upload `trajectory.mobileconfig`, and choose the **Device channel**. Keep
   the payload identifiers and UUIDs.
5. Create a second custom profile from `trajectory-login-items.mobileconfig`
   in the same way. See [Managed login items](#managed-login-items).
6. Add `adapter/custom-attribute.sh` as a custom attribute.
7. Add `adapter/configuration-inventory.sh` as a second custom attribute of
   type String. It also reports which clients are set up. See
   [Check each client](#check-each-client).

Intune runs a root script once per device unless you set **Script frequency**.
Each run sets up only the user who is signed in at that time. On Macs that
several people use, set a **Script frequency**, such as every day. The script
then runs again while other users are signed in. A user who is never signed
in during a run is not set up. A new run for a user who is already set up only
checks that user's installation. The `update`, `rollback`, and `remove`
scripts also act only for the signed-in user. Before you remove Trajectory, remove the install script's assignment, so that a scheduled run
does not install it again.

See the Microsoft documentation on
[macOS shell scripts](https://learn.microsoft.com/en-us/intune/device-management/tools/run-shell-scripts-macos)
and
[custom settings for macOS](https://learn.microsoft.com/en-us/intune/device-configuration/templates/configure-custom-settings-apple).

### Step 6: Verify one computer

On a test computer, run this command as the signed-in user:

```bash
~/.trajectory/bin/trajectory managed status --scope all --format json
```

The deployment works when `overall` is `compliant`. A new computer usually
goes from `pending_policy` to `pending_user` to `compliant`. When
`policy.profile` and `user.applied_profile` show the same revision, the user
has the current settings. `user.client_results` shows whether each client in
the profile is set up. See [Check each client](#check-each-client).

The command can exit with code zero when the computer is not compliant. Read
`overall`, `reason`, and `next_step`. See [Troubleshooting](#troubleshooting).

### Run trajectory in a terminal

User reconciliation links `~/.local/bin/trajectory` to
`~/.trajectory/bin/trajectory` when that name is free. It checks the link on
every run, including runs that find nothing else to change. So a computer that
was already compliant before an update gets the link too. Updates and rollbacks
keep the link working. Setup never replaces another file at that name, never
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
| `warp` | Warp/Oz CLI | Standard managed setup |
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
runs, it checks the clients in `clients`. On macOS, the user LaunchAgent runs
it every minute. If a listed client is installed but not set up, the next run
sets it up. Until then, `trajectory managed status` reports the user layer as
`drifted` with reason `managed_client_not_set_up`. Its text output names the
client, and its JSON output reports it in `user.client_results`.

A client counts as installed when one of these is true:

- Its command is on the PATH, or in one of the folders listed in
  [Where setup finds client commands](#where-setup-finds-client-commands).
- Its settings folder exists, such as `~/.claude` after Claude Code first runs.

Claude Desktop is not checked. Setup writes nothing for it, and it is ready
once the user starts their first local-agent-mode session.

Setup can run and still fail to set the client up, for example because it
cannot find the client's command. Then managed setup tries again after 15
minutes, 1 hour, 6 hours, and then every 24 hours. A new profile revision tries
again at once. Status shows the time of the next try, and its JSON output shows
the reason setup gave. To try now, run
`trajectory managed repair --scope user --yes` as the user.

If the user removed a listed client with `trajectory uninstrument <client>`,
this check does not set it up again, and status does not report it as drift.
Any later managed setup run, such as a new profile revision or
`managed repair`, sets it up again.

The managed-only `managed_late_client_setup` feature flag is on by default.
Turn it off to stop this check.

#### Preview clients

Qoder, Kimi, Warp/Oz, Zed and VS Code Copilot Chat are off by default for
users who set Trajectory up themselves. Listing one in `clients` turns on its
feature flag, such as `qoder_cli_instrumentation`, `kimi_cli_instrumentation`,
`warp_oz_instrumentation`, `zed_passive_history` or
`vscode_copilot_instrumentation`. Do not ask users to turn these flags on
themselves.

To stop a preview client, remove it from `clients` and from
`auto_instrument.allow_clients`. Do this in the intent and in any remote file.
Then replace the profile with a higher `--profile-revision`. The profile then
stops turning on the client's flag. Setup stops changing that client, and its
watcher does not start, unless a user turned the flag on themselves. The
intent has no setting that turns a listed client's flag off. Managed setup
also removes the client's integration if it installed it. See
[Remove a client from the profile](#remove-a-client-from-the-profile).

- Qoder: setup installs and removes the plugin through the Qoder CLI. Do not
  copy files into Qoder's plugin registry.
- Zed: setup changes only Trajectory's MCP and skill entries. Do not copy,
  change or inventory Zed's thread database.
- Warp/Oz: the current CLIs are `oz` and `oz-preview`. `warp-cli` is an old,
  deprecated alias. Plan to move those computers to `oz`. Capture
  covers Warp Desktop and local `oz agent run`, not `oz agent run-cloud`.
- VS Code Copilot Chat: no installer should change user VS Code settings while
  the feature is off.

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

Setup links the wrappers into `~/.trajectory/bin`. A wrapper works only when
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
| `zsh` | `~/.zprofile` and `~/.zshrc`. When `~/.zshenv` sets `ZDOTDIR`, the same files in that folder. When a later file such as `.zlogin` moves `ZDOTDIR` again, none. Setup cannot tell which folder `zsh` read, so it says so and adds no block. It also adds none when it cannot ask the login shell. If one startup file sets `ZDOTDIR` and a later one unsets it, setup does not notice, and it can also write an unused block to `~/.zshrc`. |
| `bash` | `~/.bash_profile` and `~/.bashrc`. When `~/.bash_profile` does not exist but `~/.bash_login` or `~/.profile` does, setup uses the first of those instead. A new `~/.bash_profile` would stop `bash` from reading them. |
| `fish` | `~/.config/fish/conf.d/trajectory.fish`, with the same block written for `fish`. |
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
- Setup edits startup files as the user, never as root. It changes nothing in
  a file that is a symbolic link, is not a regular file, is read-only or
  unreadable, or belongs to another account. It also skips a file in a folder
  that belongs to another account or that the user cannot open. Setup reports each such file with the step that fixes it.
- Setup writes the new content to a temporary file in the same folder. It
  keeps the file's permissions, owner, and group, and then replaces the file.
- Reconciliation does not watch the block. If the user deletes it, it comes
  back the next time managed setup runs.
- Setup removes the block when the option is turned off, when the profile is
  withdrawn, and when the installation script's `remove` operation runs. It
  also removes the block when the user runs `trajectory uninstrument` and no
  Claude Code, Codex, or Copilot wrapper remains. Each file then holds exactly
  what it held without the block. Setup deletes a file that it created for the
  block when the file holds nothing else.

Deployments that already turn the option on get the block the next time
managed setup runs after they update to this release. Setup runs when the
profile, its managed defaults, or its client list change, and after a failed
pass. To add the block at once, run
`trajectory managed repair --scope user --yes` as the user.

The `managed_shell_path_block` feature flag, on by default, turns the block
off. Setup then adds no block, but still removes one it added earlier when the
option is turned off or the profile is withdrawn.

Managed setup runs with the `PATH` that the MDM script or the LaunchAgent
sets, not the user's. So after it adds the block, setup asks the user's login
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
  `launchctl asuser` and `sudo`, as the installation script does, before the
  shell starts. A startup file in that shell might start `trajectory setup`
  or `trajectory managed reconcile`. That command returns at once without
  changing anything. Other commands that need setup's lock fail at once
  instead of waiting for it.
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
  wrapper active then.

After the user changes `PATH`, run
`trajectory managed repair --scope user --yes` as the user so that status
checks again. The `client_shim_terminal_path` feature flag is on by default.
Turn it off to stop the login shell check. Setup then checks its own `PATH`, as
earlier releases did.

Setup never replaces an existing command. Apart from the block, it never
edits shell startup files.

The option applies only to the profile's `clients` list. It does not apply to
clients that `auto_instrument` adds later.

> [!WARNING]
> Installer scripts from releases before this option refuse the wrapper
> links. Before you roll back to such a release, or remove Trajectory with its
> script, turn off the option. Then wait for managed setup to remove the
> wrappers.

### Choose how to migrate existing installations

Some computers may already have a personal Trajectory installation. Set
`migration_mode` in the intent, or pass `--migration-mode` to `prepare`:

| Intent value | What it does |
| --- | --- |
| `update_in_place` (default) | Replaces the binary. Keeps settings, credentials, sessions, caches, and pending uploads. |
| `clean_reinstall` | Rebuilds the application files and keeps the same user data. Every `trajectory` process of the user must be stopped first. |
| `replace_untrusted` | macOS scripts only. Replaces a personal binary that fails Datadog's checks. See below. |

With `clean_reinstall`, the script checks once for running `trajectory`
processes, and it does not wait. If one is running, the script stops with
`TRAJECTORY_INSTALLER_BLOCKED` before it removes the old installation. The
assignment fails until the user closes Trajectory. Ask users to close it
first, and let your MDM retry the same script.

The flag values use dashes, such as `--migration-mode clean-reinstall`. The
mode runs once, in the first installation script. Generate that script with
`--operation install`, which is the default.

The script can adopt a personal installation at `~/.trajectory/bin/trajectory`
that passes Datadog's checks. If it is a different release from the one you
deploy, pass `--personal-sha256 OLD_RELEASE_SHA256` to `prepare`. Take that
value from the old release's `checksums.sha256`. Never compute it from the
binary on the computer.

A binary that someone re-signed after release fails the checks. Then
`update_in_place` and `clean_reinstall` stop and change nothing.

#### Check a Mac that already runs Trajectory

<!-- BEGIN EXISTING PERSONAL INSTALLATIONS -->
<!-- A contract test keeps this block identical in the Jamf provider notes and the administrator guide. -->

Pilot developers often already run Trajectory from
`~/.trajectory/bin/trajectory`. A default bundle adopts that binary only when
it is the exact signed release the bundle installs. For any other binary, the
installer prints `TRAJECTORY_INSTALLER_BLOCKED reason=binary_digest_mismatch: binary digest mismatch`, exits
1, and changes nothing. `trajectory-mdm prepare` warns about this when it
builds such a bundle. To see which case applies, run these as the Mac's user:

```bash
ls -l ~/.trajectory/bin/trajectory /usr/local/bin/trajectory
codesign --display --verbose=4 ~/.trajectory/bin/trajectory 2>&1 | grep -E '^(Signature|Authority|TeamIdentifier)='
shasum -a 256 ~/.trajectory/bin/trajectory
lipo -archs ~/.trajectory/bin/trajectory
```

| What you find | Prepare the bundle with | What the installer prints |
| --- | --- | --- |
| No `~/.trajectory/bin/trajectory` | the defaults | `TRAJECTORY_INSTALLER_OK operation=install` |
| A Datadog Developer ID signature (`Authority=` and `TeamIdentifier=` name Datadog), and the SHA-256 is the bundle release's entry in its `checksums.sha256` | the defaults | `TRAJECTORY_INSTALLER_OK operation=install`; the binary is adopted |
| The same signer, and the SHA-256 is another release's entry in that release's `checksums.sha256` | `--personal-sha256` with that entry | `TRAJECTORY_INSTALLER_OK operation=install`; the old release is kept for rollback |
| `Signature=adhoc`, another Team ID, or a SHA-256 in no release's `checksums.sha256`. Installs re-signed by another deployment tool, ad-hoc beta releases and local builds look like this. | `"migration_mode": "replace_untrusted"` (`--migration-mode replace-untrusted`) | `TRAJECTORY_INSTALLER_UNTRUSTED: the personal binary failed adoption (binary digest mismatch); it will be replaced without being run`, a `TRAJECTORY_INSTALLER_QUARANTINED:` line for each moved path, then `TRAJECTORY_INSTALLER_OK operation=install` |

Adoption also needs the binary's architecture to match the bundle's
`--architecture`. `lipo` prints both `x86_64` and `arm64` for `universal`,
`arm64` for `arm64`, and `x86_64` for `amd64`. Take the `--personal-sha256`
entry for the file of that architecture, such as `trajectory-darwin-arm64`.
For any other architecture, the installer prints
`TRAJECTORY_INSTALLER_BLOCKED reason=architecture_mismatch: artifact architecture mismatch` and changes
nothing. Prepare a bundle with the matching `--architecture`, or use
`replace_untrusted`, which replaces the binary instead.

Do not run the binary to learn its version. The installer never runs a binary
it has not verified. To find the release, search the published
`checksums.sha256` files for the local hash. Take the `--personal-sha256` value
from that file, never from `shasum` on the Mac. The local hash only tells you
which entry to look for. One bundle serves every Mac it is assigned to:

- `--personal-sha256` names one release. Macs running any other release still
  stop with `binary digest mismatch`.
- `replace_untrusted` adopts a binary that passes the adoption checks and
  replaces any other, so it suits a mixed pilot group. Combined with
  `--personal-sha256`, it adopts that release and replaces the rest. A replaced
  Mac gets a fresh installation with no older release kept for rollback.

`replace_untrusted` moves the old binary, its `bin/releases` image store and
its runtime selection files into
`~/.trajectory/release-installer/quarantine/replaced-<UTC time>/` without
running them. It keeps settings, credentials, sessions, caches and pending
uploads. For root-owned files that an earlier root-run installation left, see
"Files left by an earlier root-run installation" in the administrator guide.
<!-- END EXISTING PERSONAL INSTALLATIONS -->

#### Replace an untrusted personal installation

`replace_untrusted` never runs or trusts the old binary. It works like
`update_in_place` when the old binary passes Datadog's checks. So you can set
it for a whole fleet. Otherwise:

1. The script downloads and checks the new release. If a check fails, it stops
   before it changes anything.
2. It moves the old binary and its runtime files to a private folder under
   `~/.trajectory/release-installer/quarantine/`.
3. It installs the new release. User settings, credentials, sessions, and
   client configuration stay.
4. If the installation fails, the script moves the old files back and exits
   with an error. After a crash or restart, run the same script again.

Review the quarantine folder, and delete it when you no longer need it. Until
then, keep its user-only owner and permissions, because managed updates check
them.

Assign the script with the profile or before it. Releases older than this mode
reject a profile that uses it.

#### Files left by an earlier root-run installation

A Mac that an earlier deployment set up as root can keep root-owned files after
it moves to the script. Every `install`, `update`, `repair` and `rollback`
handles them like this:

| File | What happens |
| --- | --- |
| `~/.trajectory/selfupdate.conf` | The script removes it when root owns it. First it keeps a copy that only the user can read in `~/.trajectory/managed/retired/<UTC time>/`. If the file named a managed install owner, such as `jamf`, the script writes a new `selfupdate.conf` that the user owns and that holds only that owner, so a rollback to a release that reads the owner from this file stays managed. It then prints a `TRAJECTORY_INSTALLER_RETIRED:` line. The script's installation never reads this file for updates. A file the user owns, a symbolic link, or a file with more than one hard link stays in place. |
| `~/.trajectory/config.defaults.yaml` | Managed reconciliation replaces it. |
| `~/.trajectory/org/markers.yaml` | Organization sync replaces it when the file passes secure-replacement checks. For example, the user must own `org/`, and others must not be able to write to it. |
| `/usr/local/bin/trajectory` | The script reports it. Remove it with the tool that created it. |

On a script-and-profile installation where something remains, `trajectory
doctor` shows a "Legacy install leftovers" notice. It lists what remains,
including a root-owned `/usr/local/bin/trajectory` link to the user's binary,
with how to fix each. A notice is not a warning. `trajectory doctor --verbose`
always shows the line and also lists the copies the script kept. Delete a kept
copy when you no longer need it.

#### System installations

The script refuses a computer that has a system-wide installation, such as one
from a PKG. Remove that installation with the tool that installed it. Keep
`~/.trajectory`. Then assign the script. Never delete Trajectory's recovery or
profile history files to force an installation.

### Choose who controls updates

By default, your MDM controls which release each computer runs. Trajectory's
background updates are off, and users cannot turn them on. To update, you
assign a new script. See [Update Trajectory](#update-trajectory).

To approve each release before computers install it, choose one of these:

- **Keep MDM control.** Assign an update script for each release that you
  approve. You can also roll back to the release before the last update.
- **Delegate updates, and host a `RELEASES.json` file.** The file names the
  newest release that computers may install. Computers only move forward. See
  [Approve releases with `RELEASES.json`](#approve-releases-with-releasesjson).

If you delegate without `RELEASES.json`, computers install each new release of
their update ring.

#### Delegate binary updates to Trajectory

On macOS, you can install Trajectory once and let its updater install later
releases. The updater runs as the user and keeps the binary in the same place.

1. Start from a Jamf Pro intent with `schema_version` 4 or later.
2. Add this object:

   ```json
   "binary_update": {"authority": "trajectory", "allow_rollback": false}
   ```

3. Generate the bundle with a higher `--profile-revision`, and replace the
   profile.

| Field | Values |
| --- | --- |
| `authority` | Required. `trajectory` delegates updates. `mdm` keeps them in your MDM. Windows accepts only `mdm`. |
| `allow_rollback` | `false` (default). Keep `false`. It has no effect with `RELEASES.json` or with MDM scripts. To roll back, give control back to your MDM and use a [rollback script](#roll-back). |

The profile has no ring setting. The remote `config.defaults.yaml` chooses
the release ring. See [Update ring](#update-ring). `trajectory-mdm` rejects an
intent that sets `binary_update.ring` with
`field "binary_update" has unknown field "ring"`.

The updater installs only published releases that pass Datadog's checks and
accept the current profile. By default, it installs each new release of the
computer's [update ring](#update-ring). To approve releases yourself, see
[Approve releases with `RELEASES.json`](#approve-releases-with-releasesjson).

After you delegate, installer scripts for `update` and `rollback` fail. Other
operations still work. To give control back to your MDM, set `authority` to
`mdm` or withdraw the profile.

By then the updater may have installed a newer release than your MDM update
script's. That script then changes nothing, because an update never moves a
Mac back. Generate an update script for the installed release or a newer one,
or move back on purpose with a rollback script. See [Roll back](#roll-back).

#### Approve releases with RELEASES.json

Under delegation, a `RELEASES.json` file that you host names the newest release
that computers may install. Computers check the file every hour. A computer
installs that release when it is newer than the release it runs. It never
moves to an older release.

These steps are for a profile that does not list `deployment.json`. While a
profile lists `deployment.json`, that file decides which release computers
install, and `RELEASES.json` does not cap it. If you remove `deployment.json`
from the list, computers delete their copy when they apply the new profile.
Until then, that copy can stop updates.

1. Add the file to `organization_sync.files` in the intent:

   ```json
   {"name": "RELEASES.json", "path": "RELEASES.json", "required": false}
   ```

2. Generate the bundle. For a profile that you already deployed, use a higher
   `--profile-revision` and replace the profile. If you publish a remote
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
  `stable` unless your remote `config.defaults.yaml` sets another one. Always
  include `stable`. If you set another ring, add an entry for it too.
- The file chooses only the version. Computers still download the release from
  Datadog's public releases and run the same checks.
- If computers cannot download or read the file, they keep the installed
  release and stop updating. They do not fall back to Datadog's release list.
  `check-remote-defaults` does not check this file. Check that it is valid
  JSON before you publish it.
- A computer that already runs a newer release keeps it. To roll back, give
  control back to your MDM and use a [rollback script](#roll-back).

#### Update authority, automatic updates, and release selection

Three settings work separately. The profile owns the first two. The release
ring comes only from remote configuration:

| Setting | Where | Effect |
| --- | --- | --- |
| Update authority | `binary_update.authority` | `trajectory` lets the updater choose releases. `mdm`, or no value, leaves it to your MDM. |
| Background updates | `auto_update` | MDM authority sets `false`, and users cannot change it. Delegation sets `true`, and users cannot change it either once managed setup finishes. |
| Release ring | Remote `deployment.ring`, else `stable` | Overrides a user's `deployment.ring`. See [Update ring](#update-ring). |

**Under delegation, the managed `auto_update` wins.** Background updates stay
on for every user of the profile, and a user's `auto_update: false` has no
effect. To control when updates install, keep MDM authority. The rule starts
when managed setup first finishes on a computer, and it covers only the
`config.defaults.yaml` that the profile applied. Any other
`config.defaults.yaml` is an ordinary default, and a user's `false` applies.
That includes a file in any of these cases:

- you copied it to a computer directly
- a user fetched it from their own organization source
- someone edited it by hand
- it stayed after you withdrew the profile

Users see the managed value. `trajectory config set auto_update false` and
`trajectory config get auto_update` print a note that the value is managed,
and `trajectory doctor` shows **Automatic updates** with the file that decided
it. Setting `TRAJECTORY_AUTO_UPDATE=0` in a process environment always stops
background checks for that process.

Users can still run `trajectory update` when background updates are off.
Remote configuration cannot change update authority or `auto_update`. It can
choose the release ring. See [Update ring](#update-ring).

## Change Settings, Update, And Remove

### Change settings with a new profile revision

1. Edit the intent file. Keep the same `provider` and `deployment_id`.
2. Generate a bundle with a higher `--profile-revision`.
3. Replace the configuration profile in your MDM.

Increase the revision for every change, including a return to older settings.
Do not assign two Trajectory settings profiles to one computer. The
[login items profile](#managed-login-items) does not change with the
settings, so leave it assigned. A settings change needs
no new script. Changes to `security_modules` apply after Trajectory restarts on
each computer.

### Remove a client from the profile

To stop capturing a client, remove it from `clients`, and from
`auto_instrument.allow_clients` if it is there. Then replace the profile with a
higher `--profile-revision`.

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

Each computer records the highest profile revision it has received. It refuses
a profile whose revision is not higher than that record. The record stays when
you withdraw the profile and when you remove Trajectory. This stops an old or
withdrawn profile from bringing back settings that you replaced.

So if you withdraw a profile and assign it again, the computer accepts it only
with a higher revision:

| You assign | Result |
| --- | --- |
| The same revision, with the same or changed settings | Refused. A removed revision is never applied again. |
| An older revision | Refused. |
| A higher revision | Applied like any other profile change. |

A refused profile changes nothing. The computer keeps the withdrawn state, and
managed status reports `failed` with reason `configuration_profile_invalid`.
`policy.profile` shows the refused revision.

`trajectory managed reconcile` names the revision to deploy. For example, after
you withdraw revision 2 and assign it again:

```text
Managed user reconciliation: failed
  reason:  configuration_profile_stale
  next:    repair_configuration_profile
managed reconcile: configuration profile revision 2 was removed from this computer, and a removed revision is never applied again. Generate the profile with --profile-revision 3 or higher and deploy it
```

The scripts in the bundle print the same `managed reconcile:` line. The
installation script then ends with a pending line that names the reason and
repeats the instruction, and exits 0:

```text
TRAJECTORY_SETUP_PENDING reason=configuration_profile_stale: installation verified; configuration profile revision 2 was removed from this computer, and a removed revision is never applied again. Generate the profile with --profile-revision 3 or higher and deploy it
```

`adapter/reconcile-current-user.sh` prints a
`TRAJECTORY_RECONCILE_FAILED: state=failed reason=configuration_profile_stale`
line and exits 1.

To recover:

1. On an affected computer, run
   `trajectory managed reconcile --scope user --dry-run` as the signed-in
   user. The last line names the lowest revision that the computer accepts.
   The dry run changes nothing.
2. Generate the bundle with a revision above every revision that you deployed
   to these computers. Then every computer accepts it.
3. Replace the configuration profile in your MDM.

The same rule applies while a profile is assigned. A computer refuses changed
settings that keep the same revision, with reason
`configuration_profile_revision_conflict`. It refuses a different provider or
`deployment_id` that does not raise the revision, with reason
`configuration_profile_source_conflict`. Both messages name the revision to
deploy. Never delete profile history to reuse a revision.

`trajectory-mdm prepare` warns when it can see an earlier bundle with a
configuration profile and another deployment ID. It checks the output file
that it replaces. It also checks bundles in the same folder that have the
default name for the provider and platform, such as
`trajectory-jamf-macos-<deployment-id>.zip`. The warning names the lowest
`--profile-revision` that a Mac with any of the profiles it read accepts. It
reads at most 32 bundles from the folder and says when it skipped more. The
bundle is still created.

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

Add `--interactive` to edit the behavior settings through questions. It asks
about automatic client setup, the task segmentation interval, destination
service labels, and the launcher wrappers. Change destinations and tags in the
intent file. The file has no secrets. Computers replace their settings with the downloaded file, so a
setting that you remove also goes away on the computers.

Give delegated profiles a source of their own. Do not publish the generated
file, or any `config.defaults.yaml` with `org.files`, at a source that
installations without a configuration profile also sync. From v0.6.0, such an
installation accepts that file once and then refuses every later version.

A remote file cannot change the sync source, the file list, `markers_path`,
the sync interval, or the cohort. It also cannot change update authority,
`auto_update`, the credential lookup mode, or `modules`. To change those, or
the `clients` list, deploy a new profile. To add clients remotely, use `auto_instrument`. A remote file can
choose the update ring.

Computers keep their current settings when they reject a file. The org sync
log line `org sync: config.defaults.yaml: orgsync: reject managed core: ...`
names each profile-owned field that the file changes, such as
`org.files (missing)`. It also lists the first problem of every failing check,
separated by `; `, so one new version can fix all of them.

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
profile has no ring setting, and a user's `deployment.ring` never applies. A
profile cohort cannot set the ring either. Org sync rejects a cohort file with
`deployment.ring` with `profile cohort cannot set deployment.ring: the update
ring comes only from config.defaults.yaml`.

These rules cover profiles that select files with `organization_sync.files`.
A legacy profile uses `schema_version` 1 to 3. It cannot select files, and it
keeps MDM update authority. It leaves the ring to the user. When managed
configuration sets no ring, a user's `deployment.ring` applies, as before.

Generated remote files select `stable`. Change `deployment.ring` in the file
you publish, and keep that change when you generate the file again. An
unsupported value, such as `nightly` or `Beta`, is rejected with
`deployment.ring "nightly" is not a supported update ring (stable, beta, bravehearts)`.
The profile still owns update authority and `auto_update`. Under MDM
authority the ring has no effect on installed binaries. Under delegation, the
updater downloads from the ring of the accepted remote file. A hand-edited
local `config.defaults.yaml` does not change the ring.

`trajectory config get deployment.ring` shows the ring in use. In managed
status, `configuration.defaults_source` shows whether the active settings come
from the remote file (`remote_defaults`) or the profile (`profile_starter`).

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
intent's platform. If the intent lists `markers.yaml` or `pricing.yaml` in
`organization_sync.files`, add `--markers markers.yaml` or
`--pricing pricing.yaml` to check them too.

For each file it checks, the command prints whether computers would accept
it, its SHA-256, and where to publish it. If a computer would reject a file,
the command lists each reason and exits with status 1. Fix the file and check
it again. The command also lists the other files the intent selects, such as
`RELEASES.json`, as not checked. Add `--format json` for automation.

### Update Trajectory

If your MDM controls updates, you approve each release by assigning its update
script. You do not need a new configuration profile.

1. Get the helper and the release files of the new release. See
   [Step 1](#step-1-get-the-helper) and
   [Step 2](#step-2-save-the-release-files).
2. Generate the update script with the new helper. Pass the `--architecture`
   of the installation:

   ```bash
   trajectory-mdm macos-installer \
     --release-json public-release.json --checksums checksums.sha256 \
     --version 1.2.4 --architecture universal \
     --provider jamf --operation update --output-dir update-1.2.4
   ```

3. Run the same command with `--verify` added. It compares every generated
   file.
4. Assign `update-1.2.4/installer.sh` in your MDM. Take the update script of
   the previous release out of scope.
5. Give new computers the same release. Generate an `install` script with the
   same command, `--operation install`, the `--migration-mode` of your bundle,
   and a new `--output-dir`. If your bundle used `--personal-sha256`, pass the
   same value. Use the script in place of the old installation script.

`prepare --operation update` also writes an update script, in a full bundle. A
bundle from `prepare --operation install` carries the update script for its
release as `update/installer.sh`. `prepare --operation update` refuses an intent with `migration_mode` set to `replace_untrusted` or
`clean_reinstall`, because those modes apply only to the first installation.

In Jamf Pro:

- Create a policy for each release, such as **Trajectory update 1.2.4**, for
  the same computers. Add the update script with priority **Before**. Use the
  install policy's trigger and frequency: **Recurring Check-in** and **Login**,
  **Once per computer**, with **Automatically re-run policy on failure** turned
  on. See [Jamf policy settings](#jamf-policy-settings).
- Disable the update policy of the previous release.
- Replace the script of the install policy with the new `install` script.
  Computers that already ran the install policy do not run it again.

A computer that missed earlier releases moves straight to the new release. A
computer that already runs it only checks the installation. A computer without
Trajectory changes nothing and prints
`TRAJECTORY_INSTALLER_BLOCKED reason=wrong_operation: update requires an installation`. The install
policy then installs the new release on it.

The installer keeps the previous release for rollback. A running Trajectory
process can use the old version until it restarts.

If an update stops because the new release does not accept the profile, choose
a release that does. Never delete profile history or lower the profile
revision to get around this.

An update script never moves a Mac to an older release. This protects Macs
from an old update script that is still in scope. If the installed release is
newer than the script's release, the script changes nothing and prints:

```text
TRAJECTORY_INSTALLER_BLOCKED reason=downgrade_refused: update target 1.2.2 is older than installed release 1.2.3; to move back on purpose, use a rollback script
```

An update script for the installed release only checks the installation. To
move back on purpose, see [Roll back](#roll-back). Update scripts from a
`trajectory-mdm` release without this check still install an older release.

### Roll back

A `rollback` script moves a Mac back on purpose. It returns to the release that
the installer kept, which is the release before the last update.

1. Take the newer update script out of scope. Otherwise its next run installs
   the newer release again.
2. If an operation was interrupted, let it finish with a `recover` script.
   Older releases cannot read the records that newer releases write during
   recovery.
3. Generate a `rollback` script with the helper and release files of the
   release that you return to:

   ```bash
   trajectory-mdm macos-installer \
     --release-json public-release.json --checksums checksums.sha256 \
     --version 1.2.2 --architecture universal \
     --provider jamf --operation rollback --output-dir rollback
   ```

4. Verify the script, and assign it in your MDM.

Use the `--architecture` of the installation. The default is `universal`.
`--version` must match the helper version. The script checks the signature
again and restores the previous release. Use a new output folder for each
operation.

A rollback script for any other release stops with `rollback requires the
retained previous pin`. This also happens on a computer that skipped the
release you return to, because it kept the release it ran before that update.
You can also return to a release older than the one the installer kept. Run a
`remove` script for the installed release, then an `install` script for the
older release. See [Remove Trajectory](#remove-trajectory).

When the runtime moves to an older release, `trajectory update converge`
prints a warning such as `installed release 1.2.2 is older than release 1.2.3,
which the runtime selected`. The warning is expected after a rollback.

After a rollback, check which release the background service runs. As the
user, run `trajectory ps`, and compare each service's version with the release
that you returned to. If `trajectory managed status` of that release prints no
`runtime:` line, it checks only the installed binary. Its status, and
`--format state`, can then report `compliant` while a service still runs the
newer release.

The first `install` script that adopts a personal installation does not check
the order of releases. If its `--personal-sha256` names a release newer than
the bundle's, the script installs the bundle's release and keeps the personal
release for rollback.

The previous release keeps each user's local session database as the newer
release left it. It still records, reads, and publishes sessions. The newer
release can remove a feature and delete its stored data. Then that feature has
no history in the previous release, and it can stop working. After a rollback to
0.6.0 or 0.5.39:

- CODEOWNERS attribution adds no owner tags.
- Agent Cost Guidance shows no warnings.
- Personal Cost Guard allows every prompt, and `trajectory cost-guard`
  commands fail.

### Remove Trajectory

1. Stop the install script: remove its assignment in your MDM, or turn off
   every Jamf install policy, including a shared-Mac one. Otherwise a later
   run installs Trajectory again, even without the profile, and a user it
   installs never reaches the state that step 3 waits for.
2. Withdraw the configuration profile.
3. Wait until each user's status shows `pending_policy` with reason
   `configuration_profile_removed`.
4. Run the commands in [Clean up coding agents](#clean-up-coding-agents) as
   each user.
5. Generate a script with `trajectory-mdm macos-installer` and
   `--operation remove`. Use the helper, release files, `--version`, and
   `--architecture` of the installed release, and a new `--output-dir`. If the
   version or architecture differs, the script fails with
   `removal pin differs`.
6. Assign the `remove` script.
7. After the script has run, withdraw the login items profile.

Withdrawing the profile removes the managed settings and destinations. The
`remove` script runs as the signed-in user and works in this order:

1. It removes what Trajectory set up in each coding agent: hooks, plugins, MCP
   entries, command shims, and the client commands in `~/.trajectory/bin`,
   such as `cursor-incognito`. It keeps client settings that Trajectory did not
   write. It prints one line for each client. This step can take up to ten
   minutes.
2. It stops the user's Trajectory service.
3. It deletes the binary, the user LaunchAgent, and the wrapper links. It also
   deletes setup's `trajectory` link in `~/.local/bin`, `~/bin`, or `~/.bin`
   when that link still points to `~/.trajectory/bin/trajectory`, and leaves
   any other entry there.

Credentials, the user's `config.yaml`, user data, and profile history stay.

If the script cannot remove one client's integration, it stops with
`TRAJECTORY_INSTALLER_BLOCKED reason=client_cleanup_failed: client integration cleanup failed`. It keeps the
binary and the LaunchAgent, so the cleanup can run again. Capture stays off on
that computer. The line before names the client. As the user, run
`trajectory doctor`, fix that client's configuration, then run the script
again. Only GitHub Copilot CLI can remove Trajectory's Copilot plugin. If
the line says Copilot's CLI was not found, reinstall it for that user. Then run
the script again.

If the user runs Trajectory 0.6.1-beta or earlier, the script stops before it
changes anything, with
`TRAJECTORY_INSTALLER_BLOCKED reason=update_before_remove`. Those releases
remove client integrations in a way that lets client setup add one back while
removal runs. Run the `update` script for a newer release first. Then generate
the `remove` script for that release and run it. On a Mac where Trajectory's
own updater selects the binary, change the delegated deployment policy instead.
Once Trajectory runs a newer release, run the same `remove` script again.

The cleanup uninstalls Trajectory's Claude Code plugin with the user's own
`claude` CLI, so Claude Code no longer lists or enables it. It then deletes the
plugin's cached copies. A Claude Code session can still be open on an older
plugin version. For that session, the cleanup leaves only stub scripts that do
nothing. So the session shows no errors until it restarts. A project install of
the plugin stays. The cleanup changes Claude's settings only through that CLI.

If the cleanup cannot run the `claude` CLI, it prints a warning and continues.
Claude Code then keeps the plugin, pointed at a version with no hooks, MCP
server, commands, or skills, so it reports no Trajectory errors. To remove the
plugin, run `claude plugin uninstall trajectory@trajectory --scope user` as the
user.

If the user set up Agent Security, the cleanup removes it too. It uninstalls
the `trajectory-security` plugin with the user's own `claude`, `codex`, and
`copilot` CLIs, and deletes the copies Claude Code and Codex cached. It also
removes Agent Security's hooks from Cursor. A project install of the plugin
stays. If the cleanup cannot run a client's CLI, it prints a warning and
continues. The plugin then stays in that client. To remove it, run the command
the warning names as the user:

- Claude Code: `claude plugin uninstall trajectory-security@trajectory --scope user`
- Codex: `codex plugin remove trajectory-security@trajectory`
- GitHub Copilot CLI: `copilot plugin uninstall trajectory-security@datadog-security`

A `trajectory` MCP server in `~/.claude.json` that an older release wrote can
still name the deleted binary. Claude Code reports it as a failed MCP server.
Trajectory never edits that file. As the user, run
`claude mcp remove trajectory --scope user`.

The script runs without the user's shell settings. Setup records the client
folders it took from environment variables, such as `CODEX_HOME`, so the
script cleans those folders too. Setup in earlier releases did not record
them. If a user ran such a setup with a custom client folder, ask them to run
`~/.trajectory/bin/trajectory uninstrument all` from their own shell before
the script runs.

A `remove` script from an earlier release deletes the binary but keeps every
client integration, so those hooks then call a missing binary. If the computer
runs such a release, update it first. Then remove Trajectory with the updated
release's script.

For bundles without an installation script, remove the policy with the
uninstaller in the bundle. Run
`policy-tools/uninstall-trajectory.sh --remove-policy` on macOS or
`policy-tools/uninstall-policy.ps1` on Windows. If Trajectory is no longer
installed, pass the binary from the same release with `--trajectory-binary` or
`-TrajectoryBinary`.

#### What removal leaves

The `remove` script first removes what Trajectory set up in each coding
agent. This includes the client commands, such as `cursor-incognito`, and the
Codex hook runtime in `~/.trajectory/bin`. It then deletes these items:

- `~/.trajectory/bin/trajectory`
- `~/.trajectory/managed/install-receipt.json`
- the user LaunchAgent
- the `claude`, `codex`, and `copilot` links to Trajectory's wrappers
- setup's `trajectory` link in `~/.local/bin`, `~/bin`, or `~/.bin`
- `~/.trajectory/capture.disabled`, and the releases that the installer kept
  for rollback

It keeps everything in this table. Run each command as the user, after the
`remove` script has finished, unless the table says otherwise.

| What stays | Where | Delete it with |
| --- | --- | --- |
| Files that Trajectory's updater wrote next to the binary: release images in `releases/` and update records such as `runtime-selection.json`. `remove` refuses to run while this folder holds anything else. | `~/.trajectory/bin/` | `rm -rf ~/.trajectory/bin` |
| Launcher wrappers for the `claude`, `codex`, and `copilot` commands that the client cleanup left in place. After `remove`, no command links to them. | `~/.trajectory/client-shims/` | `rm -rf ~/.trajectory/client-shims` |
| The plugin marketplace that Claude Code still registers, with the plugin version that has no capture hooks. | `~/.trajectory/claude-marketplace/` | `rm -rf ~/.trajectory/claude-marketplace`, after the Claude Code steps in [Clean up coding agents](#clean-up-coding-agents) |
| The installer's records: the removed release's identity, a lock file, and `quarantine/`. `replace_untrusted` moves a replaced personal installation there without running it. | `~/.trajectory/release-installer/` | `rm -rf ~/.trajectory/release-installer` |
| Profile history and other managed setup records. A computer refuses a profile revision that is not higher than one in its history. | `~/.trajectory/managed/` | `rm -rf ~/.trajectory/managed` |
| The user's `config.yaml`, captured sessions, logs, and caches, and the folders in the rows above. | `~/.trajectory/` | `rm -rf ~/.trajectory` |
| API keys that `reconcile-current-user.sh` stored. Each one is a login keychain item with service `trajectory` and the credential reference as its account. | The user's login keychain | `security delete-generic-password -s trajectory -a <ref>`, in Terminal, for each reference in `adapter/credential-parameters.json` |
| What the client cleanup in `remove` cannot remove: Claude Code's plugin registration, `SKILL.md` hooks, Datadog Security hooks, and settings from older releases. They call `~/.trajectory/bin/trajectory`, so they fail once the binary is gone. | Each coding agent's settings | The commands in [Clean up coding agents](#clean-up-coding-agents), before the `remove` script runs |
| Root-owned files from an older deployment, such as a `/usr/local/bin/trajectory` link. The script names each one in a `TRAJECTORY_INSTALLER_NOTICE: legacy` line. | The path in that line | `sudo rm <path>`, as an administrator, after you check that no other tool uses it |

Delete `~/.trajectory/bin` and `~/.trajectory/release-installer` together.
If `bin` still holds an unfinished update, such as `trajectory.old` or
`trajectory.new`, and the installer's records are gone, a later installation
refuses the home.

Deleting `~/.trajectory/managed` removes the user's profile history. A Mac
that had a system installation can keep protected history in
`/private/var/db/trajectory/managed`, and setup reads it when the user's own
history is missing. When you deploy Trajectory again, use a profile revision
higher than any you deployed before.

##### Clean up coding agents

<!-- BEGIN CODING AGENT CLEANUP -->
<!-- A contract test keeps this block identical in the Jamf and Intune provider notes and the administrator guide. -->

Run these commands as each user when the user's status shows `pending_policy`
with reason `configuration_profile_removed`. Run them before the `remove`
script runs, while the binary still exists. While the profile is installed,
managed setup can add the integrations back.

1. If you turned on `claude_skill_file_hooks`, close the user's Claude Code
   sessions. Then run `~/.trajectory/bin/trajectory claude skills restore --all`.
   It removes the hooks that Trajectory added to `SKILL.md` files. If its
   output shows `blocked` or `conflicts` above 0, fix those files first.
   Deleting `~/.trajectory` also deletes the copies that it restores from.
2. If the user set up Datadog Security, run
   `~/.trajectory/bin/trajectory plugins disable datadog-security --clients <clients> --remove-hooks`.
   Replace `<clients>` with the clients it was set up for, such as `cc,codex`.
   The `remove` script removes only retired product plugins, so it keeps
   these hooks.
3. Check each of Codex, GitHub Copilot CLI, and Factory Droid that the user
   set up. Its command, `codex`, `copilot`, or `droid`, must work for the
   user. For example, run `codex --version`. The `remove` script needs it to
   remove that client's plugin. Without it, the script stops with
   `TRAJECTORY_INSTALLER_BLOCKED reason=client_cleanup_failed: client integration cleanup failed` for
   Codex and Copilot. For Droid, it skips the plugin and still succeeds, so
   run `droid plugin uninstall trajectory@trajectory --scope user` yourself.
4. The `remove` script keeps the Claude Code plugin, whose MCP server calls
   the binary. Run `claude plugin uninstall trajectory@trajectory --scope user`.
5. If `~/.claude.json` has a user-level `trajectory` MCP server from an older
   release, run `claude mcp remove trajectory --scope user`.
6. If `~/.claude/settings.json` still has the telemetry settings that older
   releases added to its `env` block, remove them and keep the other
   settings. They are the `CLAUDE_CODE_ENABLE_TELEMETRY`,
   `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA`, `OTEL_LOG_TOOL_DETAILS`,
   `OTEL_*_EXPORTER`, `OTEL_EXPORTER_OTLP_*_PROTOCOL`, and
   `OTEL_EXPORTER_OTLP_*_ENDPOINT` keys, with endpoints on `localhost`.
   Setup warns about them but never changes them, and Claude Code keeps
   sending telemetry to them after removal.
7. If you will delete `~/.trajectory`, also run
   `claude plugin marketplace remove trajectory`. Claude Code keeps
   `~/.trajectory/claude-marketplace` registered as its `trajectory` plugin
   marketplace, and the `remove` script leaves that registration in place.
<!-- END CODING AGENT CLEANUP -->

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
| `package_update_in_progress` | An installation, update, repair or rollback is replacing Trajectory's files now, so `package` and `runtime` report `blocked` with next step `wait_for_package_update`. Nothing is wrong. Run `managed status` again when the script finishes. |
| `configuration_refresh_failed` | A remote file did not download, or the computer rejected it. The computer keeps its last good settings and retries. If status reports `organization_file_rejected`, fix the file. Otherwise check that the computer can reach your HTTPS server. |
| `organization_file_rejected` | The computer downloaded a file that the profile selects and rejected it. `configuration.file_results` names the file, and its `rejection_reason` gives the first failing check. Fix the file, [check it](#check-files-before-you-publish-them), and publish it again. |
| `required_configuration_unverified` | A required remote file is missing or changed. Publish it at the expected URL. |
| `client_command_shim_repair_failed` | Another file replaced a launcher wrapper. Remove that file, then run `managed repair`. |
| `managed_client_not_set_up` | A listed client is installed but not set up. Managed setup sets it up at its next run, or at the retry time that `managed status` shows. To try now, run `managed repair` as the user. See [Clients installed later](#clients-installed-later). |
| `configuration_profile_invalid` | The computer refused the profile. Status reports every refused profile this way. Run `managed reconcile --scope user --dry-run` as the user to see why. |
| `configuration_profile_stale`, `configuration_profile_revision_conflict`, `configuration_profile_source_conflict` | The profile revision is not higher than one the computer already received. Deploy the revision that the message names. See [Re-add a removed profile](#re-add-a-removed-profile). |
| `profile_runtime_not_applied` | The background service still uses the previous settings. See [Settings wait for open sessions](#settings-wait-for-open-sessions). |
| `profile_runtime_restart_pending` | Nothing. Reconcile wrote the settings, but the running background service could not reload them. It uses them when it restarts. See [Settings wait for a service restart](#settings-wait-for-a-service-restart). |
| `runtime_not_started` | Nothing. The user layer is `compliant`. No background service is running, and the next one to start uses the current settings. See [No background service is running](#no-background-service-is-running). |
| `runtime_service_switching`, `runtime_service_switch_pending`, `runtime_service_waiting_for_sessions`, `runtime_service_waiting_for_credentials`, `runtime_service_not_current`, `runtime_service_unreadable` | The background service still runs an older release. See [The background service runs an older release](#the-background-service-runs-an-older-release). |
| `keychain_locked`, `session_locked`, `no_user_session`, `keychain_missing`, `keychain_search_list_missing`, `interaction_not_allowed`, `credential_store_failed`, `credential_parameter_invalid` | API keys were not stored, or setup could not read them. See [API keys were not stored](#api-keys-were-not-stored). |

`trajectory --version` prints a `self_update` line. It reads the update
authority that `managed status` reports:

- `managed (update authority: mdm)`: your MDM delivers updates, and Trajectory
  does not update itself.
- `enabled (update authority: trajectory)`: your deployment delegates updates
  to Trajectory.
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
download the file at all, such as `trajectory config sync`, keeps the
rejection.

A required file that has never verified on the computer keeps reason
`required_configuration_unverified`, because the profile cannot apply without
it.

The status JSON uses `schema_version` 8 when a file result carries a
`rejection_reason`. Version 8 also allows `user.client_results` and
`user.last_failure`. Other status keeps its earlier version. The inventory
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
as the signed-in user. Reconciliation runs at login, when the profile changes,
and every minute. Until then, Trajectory ignores the files and applies the
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
use a hosted `config.defaults.yaml`. That cohort cannot add destinations.

### Check each client

`trajectory managed status --format json` lists each client in the profile
under `user.client_results`. The list appears while the user layer is
`compliant`, or `drifted` with reason `managed_client_not_set_up`. Status JSON
that has the list uses `schema_version` 6. It uses 7 while a failed
reconciliation is recorded (see
[Background reconciliation failures](#background-reconciliation-failures)). It
uses 8 when a file is also rejected. The list is absent while the
`managed_late_client_setup` feature flag is off.

```json
"client_results": [
  {
    "client": "cc",
    "state": "failed",
    "reason": "client_not_found",
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
`next_attempt_at` is when managed setup tries a failed client again.

| State | Meaning | What to do |
| --- | --- | --- |
| `set_up` | Setup finds the client set up. With reason `command_shim_not_on_path`, its launcher wrapper is installed, but when setup last checked, a new terminal ran another command or found none. With reason `command_shim_path_unknown`, setup could not read a new terminal's `PATH`. | Nothing for capture: hooks still capture sessions. To route the ordinary command through the wrapper, follow the step that `trajectory managed status` prints. See "Route ordinary `claude`, `codex`, and `copilot` commands through Trajectory". |
| `not_installed` | Setup cannot find the client on this computer. | Nothing. If the user has the client, see `client_not_found` below. |
| `pending` | The user installed the client after managed setup last ran. With reason `client_first_session_pending`, Claude Desktop has not run its first local agent mode session. | Wait for the next run, or run `managed repair` as the user. For Claude Desktop, the user starts a local agent mode session. |
| `failed` | Managed setup ran but could not set the client up. | Fix the cause that `reason` names, then run `managed repair` as the user. |
| `opted_out` | The user removed the client with `trajectory uninstrument`. | To set it up again, run `managed repair` as the user. |

Reasons for `failed`:

| Reason | Meaning |
| --- | --- |
| `client_not_found` | Setup cannot find the client's command. Setup searches the PATH and the locations listed in [Clients installed later](#clients-installed-later). |
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
profile_revision=3;sync=succeeded;...;client.cc=failed:client_not_found;client.codex=set_up
```

Clients that are not installed are left out. The attribute is never longer
than 2,048 characters. If the line would be longer, the reasons are left out
first, and then the client entries.

To find the computers where a client failed, match its entry. For example, a
Jamf Pro smart group with the criterion `like client.cc=failed` finds the
computers where Claude Code setup failed.

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
and next step `wait_for_service_restart`, and it exits with code `0`. So the
Jamf `reconcile-current-user.sh` script also exits `0`. Do not rerun or reset
the policy for this state. Until the service restarts, `managed status` reports
`blocked` with reason `profile_runtime_not_applied`.

These cases still fail with reason `profile_runtime_apply_failed` and a
nonzero exit code:

- The settings do not load, so a restart could not apply them either.
- Trajectory cannot read the running service's records or process, so it
  cannot tell what the service runs.
- The profile was removed. Reconcile records the removal only after the
  service drops the removed settings, so status never reports it early.

If the service runs an older version than the one installed, on the default
capture port, reconcile also records the switch to the installed release. The
user LaunchAgent then retries the switch after 2 minutes, as it does when an
installation could not switch the service. You do not need to run the
installer again. The retry cannot replace another build of the installed
version, or a service on another port. For those, reconcile records nothing,
and status keeps reporting `runtime_service_not_current` with next step
`rerun_installer`. See
[The background service runs an older release](#the-background-service-runs-an-older-release).

To apply the settings now, run `trajectory serve restart` as the signed-in
user. It stops every Trajectory process of that user, then starts the
background service again.

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
`user.applied_profile` shows the new revision, and the installer does not print
`TRAJECTORY_SETUP_PENDING`.

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

After an installation, update or rollback, the background service keeps
running the previous release until it switches to the new one. Until every
running background service runs the installed release, `managed status`
reports the runtime layer, and `--format state`, as not compliant.
`trajectory ps` shows the version that each service runs. The text output of
`managed status` names both versions:

```text
  runtime: blocked
  reason:  runtime_service_waiting_for_sessions
  next:    wait_for_open_sessions
  service: the background service runs Trajectory 0.6.0, but Trajectory 0.6.1 is installed. It switches when its 2 open sessions end.
```

If the installation script could not switch the service, its output says
why. The line before `TRAJECTORY_RUNTIME_PENDING` names the service that
still runs and the reason the switch waits:

```text
trajectory update converge: the switch to release 0.6.1 did not finish (reason=active_sessions_deferred): serve owner pid 812 still runs release 0.6.0 (state OWNED, port 19222); the user LaunchAgent retries it
```

| Reason | State | Next step | What to do |
| --- | --- | --- | --- |
| `runtime_service_switching` | `blocked` | `wait_for_runtime_switch` | Nothing. The service is switching to the installed release now. Run `managed status` again in a minute. |
| `runtime_service_switch_pending` | `blocked` | `wait_for_runtime_switch` | Nothing. The user LaunchAgent retries the switch after 2 minutes, then at intervals that double up to one hour. |
| `runtime_service_waiting_for_sessions` | `blocked` | `wait_for_open_sessions` | Nothing. The old service keeps recording its open coding sessions and switches when they end. |
| `runtime_service_waiting_for_credentials` | `blocked` | The `user` layer's next step | The new release cannot read the API keys in the user's keychain yet, so the old service keeps running. Fix the keychain as the `user` reason says. See [API keys were not stored](#api-keys-were-not-stored). The next retry then switches. |
| `runtime_service_not_current` | `drifted` | `rerun_installer` | No switch is under way, and nothing retries it. Run the installation script again, so that it switches the service. In Jamf, flush the computer's entry in the install policy logs. |
| `runtime_service_unreadable` | `failed` | `retry_managed_status` | Status could not read the background service's health records. Run `managed status` again. If it still fails, run `trajectory doctor` as the user. |

Status compares the build that each service runs, not only its version. So
another build of the installed version also counts as not current. The
`service:` line then says "another build". A service from a release that does
not report its build is compared by version. The runtime layer then stays
`compliant` with reason `runtime_service_version_only`.

With no background service running, the runtime layer checks only the
installed binary.

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
| `starting` | | Nothing. The service started less than 15 minutes ago and has not had a send accepted yet. |
| `no_destination` | | Nothing, unless you expect data. No destination is set to receive metrics, for example because metrics are off. |
| `idle` | | Nothing. The destination receives only session and operational metrics, not the service's own every-minute metrics, and nothing was due to it in the last 15 minutes. |
| `not_publishing` | `config_load_degraded` | The configuration did not load when the service started, so it runs on built-in defaults. Run `trajectory doctor`, fix the configuration problem it names, then run `trajectory serve restart`. |
| `not_publishing` | `no_accepted_send` | Sends were due, and Datadog accepted none. When the check names the Datadog credentials as the cause, fix the key first; see [API keys were not stored](#api-keys-were-not-stored). |
| `not_publishing` | `no_send_attempted` | A destination is set, but the service sent nothing. Run `trajectory doctor logs --grep "publish delivery"`, then `trajectory serve restart`. |

### API keys were not stored

A credential delivery, such as the Jamf `reconcile-current-user.sh` script,
stores each API key in the signed-in user's login keychain. Before it writes,
it checks the keychain and the user's login session. The check never shows a
prompt, never asks for a password, and never unlocks a keychain.

If a key was not stored, the delivery records which keys and why. Then
`managed status` reports the user state, `reason`, and `next_step` from the
table below until each key is stored. A later delivery stores it, or the
signed-in user runs
`trajectory config set-secret <ref> --exact-name --replace-unreadable` and
enters the key. The installation and the configuration profile stay in place,
and user setup does not run. The Jamf
script exits 1, so Jamf's automatic re-run and the daily credential refresh
policy run it again.

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

If the Jamf script stored every key but could not clear an earlier record, it
still runs user setup, then prints
`TRAJECTORY_RECONCILE_FAILED: state=failed reason=credential_record_failed`
and exits 1. The next run clears the record.

The background reconcile reads the keys too. When client setup fails only
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
MDM scripts keep in the policy log. `managed repair`, which the Jamf script
runs after it stores keys, prints the same line starting with
`managed repair:`.

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
reports `reconciliation_plan_ready`, so an MDM script still delivers the keys.

Status ignores a keychain that is locked only in its own session, such as an
SSH session. The background service reads keys in the user's login session.

To check each key the way reconcile reads it, run this as the signed-in user:

```text
trajectory config secrets <ref> <ref>
```

It prints one line per key, such as `dd-security-api-key: needs_authorization`,
and never shows a prompt. It exits 0 only when every key is readable. See
[Check managed refs from a script](API-APP-KEY-MANAGEMENT.md#check-managed-refs-from-a-script)
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

<!-- BEGIN SCRIPT MESSAGES -->
<!-- A contract test checks every line the bundle's scripts print against this table. -->

Each script run prints one result line, and that line decides the exit code.
Jamf Pro and Intune record exit code 0 as a success and any other code as a
failure. A line with `-` in the **Exit** column is information that a run
prints along the way. Look for the run's result line, which has 0 or 1.

Every `TRAJECTORY_INSTALLER_BLOCKED` line starts with a reason code that stays the
same across releases, then the text for a person, for example
`TRAJECTORY_INSTALLER_BLOCKED reason=download_failed: download failed on attempt 4 of 4 (HTTP 503); ...`.
Count failures across your fleet by the code. The table gives each code's next
step.

| Message | Script | Exit | Meaning and what to do |
| --- | --- | --- | --- |
| `TRAJECTORY_INSTALLER_OK operation=<operation>` | `installer.sh` | 0 | The operation finished. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=<code>: <text>` | `installer.sh` | 1 | The operation stopped. The rows that follow give each code's next step. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=no_user` | `installer.sh` | 1 | Nobody was signed in, so the script changed nothing. Your MDM retries it; see [Jamf policy settings](#jamf-policy-settings). |
| `TRAJECTORY_INSTALLER_BLOCKED reason=unsupported_account` | `installer.sh` | 1 | The signed-in account is a system account (UID below 501, or 65534), or its name has characters other than letters, digits, `.`, `_` and `-`. The script changed nothing, and it refuses this account on every run. Have a standard user sign in, or leave this Mac out of the policy. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=user_unresolved` | `installer.sh` | 1 | macOS did not return a usable user ID or home folder for the signed-in user, or the script ran as an account other than root or that user. Check the account with `dscl /Search -read /Users/<name> NFSHomeDirectory`, and run the script as root from your MDM. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=home_ambiguous` | `installer.sh` | 1 | The user's home folder is a symbolic link, sits below one, or is not owned by the user. The script refuses it on every run. Give the user a home folder at a real path that they own. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=not_macos` | `installer.sh` | 1 | The script ran on a computer that is not a Mac. Assign the macOS bundle only to Macs. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=macos_too_old` | `installer.sh` | 1 | This Mac runs a macOS release older than Trajectory needs. The line names both versions. The script changed nothing. Update macOS, or leave the Mac out of the assignment. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=system_installation` | `installer.sh` | 1 | An older system-wide Trajectory installation is on this Mac. Remove it with the kit that installed it, then run the script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=legacy_lock` | `installer.sh` | 1 | An older installer kit left a lock file that this script cannot read. Finish or remove that installation with the original kit, then run this script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=lock_busy` | `installer.sh` | 1 | Another installer run, the user LaunchAgent or a Trajectory update held the installation lock or the binary update lock past the wait, or, for `remove` and `recover`, a Trajectory runtime recovery held the runtime recovery lock. The script changed nothing. Let your MDM retry. Never delete the lock file. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=command_timeout` | `installer.sh` | 1 | A command the script runs to check or change the installation did not finish within its time limit, so the script stopped it. The line names the command and its limit. Run the script again. If it stops the same way, check what slows that command on this Mac, such as a busy disk or an unreachable network. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=processes_running` | `installer.sh` | 1 | This user's Trajectory processes or client setup are still running. For `clean_reinstall`, ask the user to quit their coding sessions. Then run the script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=client_cleanup_failed` | `installer.sh` | 1 | `remove` could not remove a client's integration, so it kept the binary and the LaunchAgent and stopped. Capture stays off. The line before names the client. As the user, run `trajectory doctor`, fix that client's configuration, then run the `remove` script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=update_before_remove` | `installer.sh` | 1 | The signed-in user runs Trajectory 0.6.1-beta or earlier, which `remove` cannot remove safely. The script changed nothing. Run the `update` script for a newer release, then the `remove` script for that release. If Trajectory's own updater selects the binary, change the delegated deployment policy instead, then run the same `remove` script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=owned_path_unsafe` | `installer.sh` | 1 | A path the script owns, such as `~/.trajectory` or a file in it, is a symbolic link, belongs to another user, is writable by others, has an access control entry, or is a hard link. The script never changes these itself. Check the path with `ls -lde`, fix its owner, mode or access control entry, then run the script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=owned_path_not_directory` | `installer.sh` | 1 | A folder the script owns, usually `~/.trajectory`, is a file or a link that points nowhere. The script never moves user files. Ask the user to move it aside, for example with `mv ~/.trajectory ~/.trajectory.moved`, then run the script again. If `mv` fails, run `ls -ldO ~/.trajectory`: a `uchg` or `schg` flag makes the file immutable. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=parent_acl_unsafe` | `installer.sh` | 1 | An access control entry on `~/Library` or `~/Library/LaunchAgents` allows more than read access, or macOS did not list it completely. Remove that entry, then run the script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=download_failed` | `installer.sh` | 1 | The Mac could not download the Trajectory binary. The line names the last failure and what to check. The script retries network failures and HTTP 408, 425, 429 and 5xx responses first. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=binary_size` | `installer.sh` | 1 | The downloaded or staged binary is larger than the bundle allows, or its size could not be read. A proxy or captive portal may have answered instead of GitHub. Check the Mac's network, then run the script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=binary_digest_mismatch` | `installer.sh` | 1 | The binary's checksum differs from the one in the bundle. For a download, a proxy may have changed the file. For an existing personal installation, see [Check a Mac that already runs Trajectory](#check-a-mac-that-already-runs-trajectory). The script changed nothing. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=signature_invalid` | `installer.sh` | 1 | The binary failed Apple's code signature checks: Developer ID, Team ID, hardened runtime or secure timestamp. The script installed nothing. Check that the bundle came from a Trajectory release, then generate it again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=notarization_rejected` | `installer.sh` | 1 | Gatekeeper rejected the binary or found no notarization for it. The script installed nothing. Check that the bundle came from a Trajectory release, then generate it again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=notarization_unreachable` | `installer.sh` | 1 | Apple did not answer the notarization check, so the script installed nothing. Allow the Mac to reach `api.apple-cloudkit.com`, then run the script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=gatekeeper_disabled` | `installer.sh` | 1 | Gatekeeper assessments are turned off, so macOS cannot confirm that the binary is notarized. The script installed nothing. Turn Gatekeeper assessments back on, then run the script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=architecture_mismatch` | `installer.sh` | 1 | The binary does not run on this Mac's processor: `arm64` on an Intel Mac, `amd64` on Apple Silicon without Rosetta, or an architecture that could not be read. The script changed nothing. Generate the bundle again with `--architecture universal`, or install Rosetta. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=version_mismatch` | `installer.sh` | 1 | The binary did not report the bundle's version or source commit. The script installed nothing. Generate the bundle again from the same release. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=profile_incompatible` | `installer.sh` | 1 | This release does not support the configuration profile that this Mac already has. Select a release that supports it. Never reset `device-profile-state.json`. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=test_build_invalid` | `installer.sh` | 1 | The bundle points at a binary that is not a published release, and the script cannot use it: the file is missing, has no provenance record, or is at a path or address the script does not accept. Generate the bundle again from a published release. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=personal_installation` | `installer.sh` | 1 | The existing personal installation cannot be adopted or migrated the way the bundle's migration mode asks. See [Check a Mac that already runs Trajectory](#check-a-mac-that-already-runs-trajectory). |
| `TRAJECTORY_INSTALLER_BLOCKED reason=interrupted_operation` | `installer.sh` | 1 | An earlier operation stopped partway. Run the `recover` script for the same release, or rerun the install when the line says so. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=wrong_operation` | `installer.sh` | 1 | The script's operation or release does not match what is installed. For example, installing a different release needs the `update` script. Run the script for the operation and release that this Mac needs. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=downgrade_refused` | `installer.sh` | 1 | The update script's release is older than the installed one, so the script changed nothing. Take that update script out of scope. To move back on purpose, see [Roll back](#roll-back). |
| `TRAJECTORY_INSTALLER_BLOCKED reason=installed_release_older` | `installer.sh` | 1 | The user runs a release older than the `install` script's own. `install` never replaces an installed release, so it left that release in place, restored its missing files, and did not report success. Run the `update` script for the same release, `update/installer.sh` in its bundle. Later runs of the `install` script then succeed. If the line says Trajectory owns binary selection, the `update` script refuses too: change the delegated deployment policy instead. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=installation_incomplete` | `installer.sh` | 1 | Installed files, their modes or the LaunchAgent are missing or changed. Run the `repair` script for the installed release. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=delegated_policy` | `installer.sh` | 1 | Trajectory's own updater selects the binary on this Mac. Change the delegated deployment policy instead of running `update` or `rollback`. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=launchagent_failed` | `installer.sh` | 1 | The script could not check, stop or start the user LaunchAgent, or found an unknown one loaded. Run the script again. If it stops the same way, run `launchctl print gui/$(id -u)/com.datadoghq.trajectory.managed-reconcile` as the user. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=binary_directory_unknown` | `installer.sh` | 1 | `~/.trajectory/bin` holds a file or folder that this script does not know. A script from an older release stops this way after setup writes client commands. Generate the bundle again with a current release. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=codex_hook_runtime_invalid` | `installer.sh` | 1 | Codex setup wrote files under `~/.trajectory/bin/codex-hook` that this script does not recognize. A script from an older release than the installed Trajectory stops this way. Generate the bundle again with a current release. The script never changes these files. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=restore_refused` | `installer.sh` | 1 | Restoring the replaced personal installation stopped because its files changed after they were moved. The script left both copies in place. Compare `~/.trajectory` with `~/.trajectory/release-installer/quarantine/` before you move anything. If the line says `retry`, run the script again. |
| `TRAJECTORY_INSTALLER_BLOCKED reason=state_invalid` | `installer.sh` | 1 | The installer's own records in `~/.trajectory/release-installer` are damaged or were edited. Do not delete them. Run the `recover` script for the installed release. If it stops the same way, send the output of `ls -laR ~/.trajectory/release-installer` to Trajectory support. |
| `TRAJECTORY_SETUP_PENDING: installation verified` | `installer.sh` | - | Installed, but user setup did not finish. The user LaunchAgent retries setup at login and every minute, and less often after repeated identical failures; see [Background reconciliation failures](#background-reconciliation-failures). The run ends with `TRAJECTORY_INSTALLER_OK`. |
| `TRAJECTORY_SETUP_PENDING reason=<reason>: installation verified` | `installer.sh` | - | Installed, but this Mac refused the configuration profile. Its revision is not higher than one the Mac already received. The line ends with the revision to deploy, such as `Generate the profile with --profile-revision 3 or higher and deploy it`. Setup runs when that profile arrives. See [Re-add a removed profile](#re-add-a-removed-profile). The run ends with `TRAJECTORY_INSTALLER_OK`. |
| `TRAJECTORY_RUNTIME_PENDING: installation verified` | `installer.sh` | - | Installed, but the background service still runs the previous release. The user LaunchAgent retries the switch after 2 minutes, then at intervals that double up to one hour, unless managed setup is paused. You do not need to run the script again, unless the line ends with `rerun the installer to retry runtime convergence`. Until the switch, `managed status` reports the runtime layer as not compliant. See [The background service runs an older release](#the-background-service-runs-an-older-release). The run ends with `TRAJECTORY_INSTALLER_OK`. |
| `TRAJECTORY_INSTALLER_NOTICE: <text>` | `installer.sh` | - | Information, such as a download retry, a command stopped at its time limit, a quarantine folder, a root-owned file, or a macOS version that `sw_vers` did not print. |
| `TRAJECTORY_INSTALLER_NOTICE: kept installed release <version>` | `installer.sh` | - | The user already had a newer release. `install` checked it and left it in place. Use an `update` or `rollback` script to change it. |
| `TRAJECTORY_INSTALLER_NOTICE: another trajectory command at <path>` | `installer.sh` | - | A `trajectory` command that is not this installation is in `/opt/homebrew/bin`, `/opt/local/bin`, `~/.local/bin`, `~/bin`, `~/.bin` or `~/go/bin`, usually a manual copy or a source build. A shell that finds it first runs it instead of `~/.trajectory/bin/trajectory`. Managed setup writes `~/.trajectory/bin/trajectory` into the client hooks it manages. Ask the user to remove the other command. The script never runs or removes it. |
| `TRAJECTORY_INSTALLER_RETIRED: <text>` | `installer.sh` | - | The script removed a root-owned `~/.trajectory/selfupdate.conf` that an earlier root-run installation left. The line says where it kept the record and whether it kept the install owner; see [Files left by an earlier root-run installation](#files-left-by-an-earlier-root-run-installation). |
| `TRAJECTORY_INSTALLER_LOCK_WAIT: waited <seconds>s for the <lock>` | `installer.sh` | - | Another installer run or the user LaunchAgent held the installation lock, or a Trajectory update held the binary update lock. |
| `TRAJECTORY_INSTALLER_UNTRUSTED: the personal binary failed adoption` | `installer.sh` | - | With `replace-untrusted`, the existing binary failed the checks. The script replaces it without running it. |
| `TRAJECTORY_INSTALLER_QUARANTINED: <path>` | `installer.sh` | - | The script moved this file to `~/.trajectory/release-installer/quarantine/`. |
| `TRAJECTORY_INSTALLER_RESTORING: replacement stopped before commit` | `installer.sh` | - | The replacement failed after a `TRAJECTORY_INSTALLER_BLOCKED` line. The script moves the old installation back, and the run exits 1. |
| `TRAJECTORY_INSTALLER_RESTORED: the personal installation is back at its original paths` | `installer.sh` | - | The old installation is back at its original paths. |
| `TRAJECTORY_RECONCILE_PENDING: no graphical user is signed in` | `reconcile-current-user.sh` | 0 | Nobody was signed in. Setup did not run, and no API keys were stored. A later run after the user signs in finishes it. |
| `TRAJECTORY_RECONCILE_BLOCKED: the signed-in account is a system account` | `reconcile-current-user.sh` | 1 | The signed-in account has a UID below 501, the UID 65534, or a name the installer refuses, so Trajectory is never installed for it. Setup did not run, and no API keys were stored. Have a standard user sign in, or leave this Mac out of the policy. |
| `TRAJECTORY_RECONCILE_PENDING: the Trajectory configuration profile has not reached this Mac` | `reconcile-current-user.sh` | 0 | The profile has not arrived yet. Setup did not run, and no API keys were stored. Run the script again after the profile is installed. |
| `TRAJECTORY_RECONCILE_BLOCKED: the signed-in user has no ~/.trajectory/bin/trajectory` | `reconcile-current-user.sh` | 1 | Trajectory is not installed for this user. Check the result line of `installer.sh`. |
| `TRAJECTORY_RECONCILE_BLOCKED: ~/.trajectory/bin/trajectory rejected 'managed reconcile --scope profile'` | `reconcile-current-user.sh` | 1 | The installed release is older than the script. Check the result line of `installer.sh`. |
| `TRAJECTORY_RECONCILE_FAILED: state=failed reason=<reason> next_step=<next_step>. This Mac refused the configuration profile` | `reconcile-current-user.sh` | 1 | The profile's revision is not higher than one the Mac already received. Setup did not run, and no API keys were stored. The `managed reconcile:` line from Trajectory names the revision to deploy. See [Re-add a removed profile](#re-add-a-removed-profile). |
| `Managed user reconciliation is administratively paused` | `reconcile-current-user.sh` | 0 | An administrator paused managed setup. Do not reinstall. |
| `Unable to resolve the signed-in user's identity and home` | `reconcile-current-user.sh` | 1 | macOS did not return a usable account or home folder for the signed-in user. |
| `Trajectory managed user status could not be collected` | `reconcile-current-user.sh` | 1 | `trajectory managed status` failed. Run it as the user to see why. |
| `Trajectory managed state requires remediation before user reconciliation` | `reconcile-current-user.sh` | 1 | The installation or profile is not compliant. Run `trajectory managed status --scope all` as the user. |
| `Managed user reconciliation policy could not be evaluated` | `reconcile-current-user.sh` | 1 | The setup preview failed. Run `trajectory managed reconcile --scope user --dry-run` as the user. |
| `Managed user reconciliation policy is not active` | `reconcile-current-user.sh` | 1 | The setup preview reported a state that does not allow setup. Run the same preview as the user. |
| `Generated Jamf credential mapping is invalid` | `reconcile-current-user.sh` (Jamf) | 1 | The script was changed after it was generated. Upload the script from the bundle again. |
| `Jamf script parameter <number> is required for credential reference <ref>` | `reconcile-current-user.sh` (Jamf) | - | The policy has no API key in that parameter. |
| `Jamf script parameter <number> must contain the credential value for credential reference <ref>` | `reconcile-current-user.sh` (Jamf) | - | The parameter holds a reference, not the API key. |
| `The installed Trajectory release cannot replace a keychain entry it cannot read; storing API keys as earlier releases do` | `reconcile-current-user.sh` (Jamf) | - | The installed release is older than the script, so it updates an existing keychain entry in place, as before. If it cannot read that entry without a prompt, the key fails with `interaction_not_allowed`. Update Trajectory, then run the policy again. |
| `Stored credential reference <ref> in the signed-in user's keychain` | `reconcile-current-user.sh` (Jamf) | - | The key was stored. |
| `Failed to store credential reference <ref> in the signed-in user's keychain` | `reconcile-current-user.sh` (Jamf) | - | The key was not stored. The error from `set-secret` comes before this line. |
| `The signed-in user's keychain cannot take API keys now (reason: <reason>); no API keys will be stored` | `reconcile-current-user.sh` (Jamf) | - | The check found a locked or unusable keychain, so the script writes no keys. See [API keys were not stored](#api-keys-were-not-stored). |
| `Could not update the record of API keys that were not stored; managed status may report an earlier delivery` | `reconcile-current-user.sh` (Jamf) | - | `trajectory managed credentials record` failed. Its error comes before this line. |
| `TRAJECTORY_RECONCILE_BLOCKED: state=blocked reason=<reason>` | `reconcile-current-user.sh` (Jamf) | - | Comes just before the `Failed to store ... credential references` line. It names why keys were not stored and the next step; see [API keys were not stored](#api-keys-were-not-stored). |
| `TRAJECTORY_RECONCILE_FAILED: state=failed reason=<reason>` | `reconcile-current-user.sh` (Jamf) | - | Like the line above, for a key that failed for another reason or had an unusable parameter. |
| `Failed to store <failed> of <total> credential references; user reconciliation did not run` | `reconcile-current-user.sh` (Jamf) | 1 | At least one key was not stored, so setup did not run. Fix each failed key, then run the policy again. |
| `TRAJECTORY_RECONCILE_FAILED: state=failed reason=credential_record_failed` | `reconcile-current-user.sh` (Jamf) | 1 | Every key was stored and setup ran, but the record of pending keys could not be cleared, so status may show an earlier delivery. Run the policy again. |
| `Trajectory reconciliation requires the resolved user or MDM context` | every `adapter/` script | - | The script ran as an account other than root or the signed-in user. Run it as root. |
| `TrajectoryManaged=compliant` | `package-policy-check.sh`, `detect.sh` | 0 | The installation and the profile are compliant. |
| `TrajectoryManaged=paused` | `package-policy-check.sh`, `detect.sh` | 0 | An administrator paused managed setup. |
| `TrajectoryManaged=pending_user` | `package-policy-check.sh`, `detect.sh` | 1 | Nobody is signed in, or macOS did not return the signed-in user's account, so the script cannot check the installation. |
| `TrajectoryManaged=noncompliant` | `package-policy-check.sh`, `detect.sh` | 1 | The installation or the profile is not compliant. Run `trajectory managed status --scope all` as the user. |
| `TrajectoryManaged=noncompliant account=unsupported` | `package-policy-check.sh`, `detect.sh` | 1 | The signed-in account is a system account or has a name the installer refuses. Trajectory is never installed for it. |

When `reconcile-current-user.sh` finishes setup, its last line is the JSON
result of `trajectory managed reconcile` or `trajectory managed repair`. Its
exit code is that command's: 0 for success, 1 for a failure. The one exception
is the Jamf `credential_record_failed` line above, which follows that result
and makes the run exit 1. The inventory
scripts (`extension-attribute.sh`, `custom-attribute.sh` and
`configuration-inventory.sh`) print one state and always exit 0. For a signed-in
system account or an account name the installer refuses,
`extension-attribute.sh` and `custom-attribute.sh` print `blocked`.
<!-- END SCRIPT MESSAGES -->

The installer waits up to 120 seconds for the installation lock. The user
LaunchAgent can hold it right after a profile change. Then the installer waits
up to 120 seconds for the binary update lock, which a Trajectory update holds
while it replaces the binary. If either lock is still busy, the script changes
nothing and exits with code 1. Its last line is
`TRAJECTORY_INSTALLER_BLOCKED reason=lock_busy: cannot acquire installation lock` or
`TRAJECTORY_INSTALLER_BLOCKED reason=lock_busy: cannot acquire binary update lock`. Let your MDM
retry, and include both waits in the policy's time limit. Never delete a lock
file or unload the LaunchAgent.

Before `remove` and `recover` take the installation lock, they wait up to
120 seconds for `~/.trajectory/bin/.runtime-recovery-worker.lock`. Trajectory
holds it while it restores an earlier build after a failed update. If that
restore is still running, the script stops with
`TRAJECTORY_INSTALLER_BLOCKED reason=lock_busy: cannot acquire runtime recovery lock`.
The scripts leave that empty file in place, like their other lock files.

After it installs, updates or repairs, the script restarts the user LaunchAgent
and then switches the running Trajectory to the new version. The LaunchAgent's
first run holds the lock for a few seconds, so that switch waits up to 30
seconds for it. If the switch does not finish, the script prints
`TRAJECTORY_RUNTIME_PENDING` and still exits 0. The user LaunchAgent then
retries the switch on its own, first after 2 minutes. The line says
`rerun the installer to retry runtime convergence` instead when nothing
recorded that retry. This happens when the release is older than this retry,
for example the previous release that `rollback` returns to. It also happens
when Trajectory could not write the record. Then run the script again.

The installer tries the Trajectory download up to four times. It waits 10, 20
and 40 seconds between tries. All tries share one 600-second limit, and a retry
starts only if 30 seconds of that limit are left after the wait. The installer
retries only network failures. Examples are a host name that does not resolve,
a refused or dropped connection, a timeout, or a TLS failure. It also retries
HTTP 408, 425, 429 and 5xx responses. Each retry prints a line such as
`TRAJECTORY_INSTALLER_NOTICE: download attempt 1 of 4 failed (curl exit 6, the host name did not resolve); retrying in 10 seconds`.

A retry after a dropped connection asks only for the part of the file that has
not arrived. The server may not be able to send just that part, or the finished
file may fail the checksum. Then the next try downloads the whole file again,
and no later try resumes. Those retries print
`curl exit 33, the server cannot resume the download` or
`the resumed file failed the digest check` as the reason.

When every try fails, the last line names the last failure, for example
`TRAJECTORY_INSTALLER_BLOCKED reason=download_failed: download failed on attempt 4 of 4 (HTTP 503);
check this Mac's network connection, then rerun`. Another failure, such as
HTTP 404, 403 or 409, stops at once with `download failed and was not retried`
and the address the Mac could not download. Check that the Mac can reach that
address, then run the script again. The installer checks the checksum and
Apple signature of the whole file after a download completes. A file that
was downloaded from the start and fails those checks is never downloaded
again.

If the file that arrived is not a Mac program, something other than the
download host answered. Examples are a captive portal sign-in page, a proxy,
or a web filter. The script stops with `TRAJECTORY_INSTALLER_BLOCKED reason=download_failed: download
failed (the file that arrived is not a Mac program)`, the download address,
and `check this Mac's network connection, then rerun`. A Mac program that fails
the checksum still stops with `binary digest mismatch`.

When the Mac's network settings name a secure web (HTTPS) proxy, the installer
downloads through it and prints
`TRAJECTORY_INSTALLER_NOTICE: downloading through the HTTPS proxy http://<host>:<port> from this Mac's network settings`.
It uses only the proxy's host name or address and port, never a user name or
password. It ignores a setting with anything else in it. It does not read proxy
auto-configuration (PAC) files, SOCKS proxies or the proxy exceptions list. A
busy proxy that answers HTTP 408, 425, 429 or 5xx is retried through the proxy,
like a busy server. The proxy can refuse the download, for example because it
asks for a password or does not allow the download address. Then the installer
tries once more without the proxy. It prints a line such as
`TRAJECTORY_INSTALLER_NOTICE: download attempt 1 of 4 failed (HTTP 407 from the HTTPS proxy, which asks for a password the installer never sends); retrying once without the HTTPS proxy http://<host>:<port>`.
Later tries also go without the proxy. If no try is left, the download stops
with the proxy's reason. The checksum and Apple checks are the same with or
without a proxy.

The installer limits how long each command it runs can take:

- 30 seconds for the Trajectory version and compatibility checks, `launchctl`,
  `lipo` and `codesign --display`.
- 60 seconds for `codesign --verify` and `spctl --assess`, and for the wait
  for client setup to finish before a removal.
- 120 seconds for user reconciliation, and 120 seconds for the switch to the
  new version.
- 600 seconds for the client cleanup that removal runs before it deletes the
  binary.

When a command runs past its limit, the installer sends it SIGTERM, then
SIGKILL 5 seconds later. A stopped check ends the script with exit code 1 and
a line that names the command and its limit, for example
`TRAJECTORY_INSTALLER_BLOCKED reason=command_timeout: trajectory version timed
out at its 30-second limit; version probe failed`. A stopped reconciliation or version switch keeps
the verified installation and exits with code 0. Before its usual
`TRAJECTORY_SETUP_PENDING` or `TRAJECTORY_RUNTIME_PENDING` line, the script
prints a line such as `TRAJECTORY_INSTALLER_NOTICE: trajectory managed
reconcile timed out at its 120-second limit`. Include these limits in the
policy's time limit.

If an operation stopped partway, run a `recover` script for the same release.
Turn off conflicting MDM assignments first.

The script also stops if an access control entry on `~/Library` or
`~/Library/LaunchAgents` allows more than read access. Remove that entry, then
run the script again.

The script can print `invalid requirement specification` and then
`TRAJECTORY_INSTALLER_BLOCKED reason=signature_invalid: Developer ID verification failed`.
This means the helper that generated the script passed the Apple signature
requirement to `codesign` in a form macOS cannot read. The script changed
nothing. Generate the bundle again with a release that has the fix.

Setup writes client commands into `~/.trajectory/bin`. Cursor, Goose,
OpenHands, Cline, Amp Code, Kiro CLI, Grok Build, and each
[shim client](#the-shim-exception) get an incognito command. Shim clients also
get launcher wrappers. The script accepts these files only as the user's own
regular files that only the user can write. It never runs or removes them, and
it refuses any other entry there. A script from an older release stops with
`TRAJECTORY_INSTALLER_BLOCKED reason=binary_directory_unknown: unknown binary directory entry` on every run
after setup writes one of these files. The script changed nothing. Generate the
bundle again with a release that has the fix.

### Background reconciliation failures

The user LaunchAgent runs `managed reconcile` at login, every minute, and when
the profile changes. macOS discards the LaunchAgent's output. So Trajectory
keeps the last failure for `managed status`. Run status as the signed-in user:

```text
  last failure: setup_failed at 2026-10-06T15:05:00Z, 4 times in a row since 2026-10-06T15:02:00Z
  message: store dd-api-key: keychain is locked; unlock it and retry
  background retry: after 2026-10-06T15:15:00Z. To retry now, run `trajectory managed reconcile --scope user --yes`.
```

The JSON output has the same values in `user.last_failure`: `reason`,
`next_step`, `message`, `first_failed_at`, `failed_at`,
`consecutive_failures` and, while the LaunchAgent waits, `retry_after`.
Status reports this object with `schema_version` 7, or 8 when a file is also
rejected. The `message` is the
error text on one line, at most 512 bytes. Trajectory removes credentials from
it, shows the user's home directory as `~`, and removes the account name from
any other home directory path. When API keys failed, the message only counts
the destinations, because their keychain references stay out of status JSON.
The text output of `trajectory managed status` lists each one with its reason.
A successful reconcile deletes the record.

After three identical failures in a row, the LaunchAgent stops retrying every
minute. It waits 5 minutes, then 10, 20 and 40, and then once an hour. A run
that waits does nothing, prints the reason `reconciliation_backed_off`, and
exits with code `0`. These always run at once:

- a profile change, including a new revision
- a new Trajectory release
- `managed reconcile` or `managed repair` run by a person, an MDM policy or a
  script.

A different failure starts a new count. To turn the wait off, set
`features.managed_reconcile_backoff` to `false` in the intent file, or add
`managed_reconcile_backoff` to `features.disabled` in your remote
`config.defaults.yaml`. The LaunchAgent then retries every minute again.
Macs wait only after the installation script from a release with this behavior
has installed the LaunchAgent.

### Apple notarization checks

Before the installation script runs a downloaded binary, it asks macOS
Gatekeeper whether Apple notarized it. Trajectory's updater asks the same
question before it switches to a new release. A Trajectory release is a single
file, so it cannot carry its notarization ticket. Gatekeeper gets the ticket
from Apple over the network. If the check fails, the script installs nothing
and exits with code 1, and the updater keeps the current release.

#### Allow the Apple hosts

Allow each Mac to reach the hosts below. Apple lists them in
[Use Apple products on enterprise networks](https://support.apple.com/en-us/101555).
`api.apple-cloudkit.com` serves the notarization ticket. The others serve
certificate validation, which checks that the signing certificate is not
revoked.

| Host | Port | Apple's description |
| --- | --- | --- |
| `api.apple-cloudkit.com` | 443 | App notarization |
| `ocsp.apple.com` | 80 | Certificate validation |
| `ocsp2.apple.com` | 443 | Certificate validation |
| `crl.apple.com` | 80 | Certificate validation |
| `valid.apple.com` | 443 | Certificate validation |
| `certs.apple.com` | 80, 443 | Certificate validation |

If Apple does not answer within 60 seconds, the script prints this line, and
the updater reports `managed update Apple notarization check did not finish
within 60 seconds`. Allow the hosts, then run the script again.

```text
TRAJECTORY_INSTALLER_BLOCKED reason=notarization_unreachable: Apple notarization check did not finish within 60 seconds; allow this Mac to reach api.apple-cloudkit.com, then rerun
```

#### Keep Gatekeeper assessments turned on

When Gatekeeper assessments are turned off, Gatekeeper accepts every binary
without checking it, so it cannot confirm notarization. Trajectory does not
install or update without that check. The script prints this line, and the
updater reports `managed update Gatekeeper assessments are turned off`.

```text
TRAJECTORY_INSTALLER_BLOCKED reason=gatekeeper_disabled: Gatekeeper assessments are turned off, so Apple notarization cannot be checked; turn them back on, then rerun
```

To check the setting, run `spctl --status` on the Mac. It prints
`assessments enabled` or `assessments disabled`. To turn assessments back on:

- If a configuration profile from your MDM turns Gatekeeper off, change or
  remove that setting in the profile.
- Otherwise, open **System Settings > Privacy & Security**. Under **Allow
  applications from**, choose **App Store & Known Developers** (**App Store
  and identified developers** on macOS 14 and earlier).

When `spctl --status` prints `assessments enabled`, run the script again.

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
| `provider` | 1 | Required. A policy ID from the provider table. |
| `platform` | 1 | Required. `macos` or `windows`. |
| `clients` | 1 | Required. Client IDs from the client table. |
| `migration_mode` | 1 | See [Choose how to migrate existing installations](#choose-how-to-migrate-existing-installations). |
| `tags` | 1 | Up to 64 tags that Trajectory adds to managed telemetry. Never put secrets in tags. |
| `destinations` | 2 | Required from version 2. Jamf Pro on macOS only. |
| `organization_sync` | 3 | Your remote configuration source. Required from version 4. |
| `cohort` | 3 | A cohort name for these users. Needs `organization_sync`. |
| `sensitivity_scanning` | 3 | Removed. Accepted and ignored. See [Removed sensitivity settings](#removed-sensitivity-settings). |
| `binary_update` | 4 | See [Choose who controls updates](#choose-who-controls-updates). |
| `client_command_shims` | 5 | Launcher wrappers for `claude`, `codex`, and `copilot`. |
| `auto_instrument`, `task_segmentation`, `features` | 5 | See [Organization settings](#organization-settings-schema-version-5). |
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
| `service`, `segmentation`, `module_spans` | Version 5. Service name, segmentation output, and module spans. |
| `agent_security` | Version 5. `metrics`, `findings`, and `disclosure_profile`. |
| `event_stream` | Version 5. `enabled` and `privacy_profile` (`security` or `full`). Needs `incognito_exempt`. |
| `ai_usage` | Version 5. `enabled` and an optional HTTPS `endpoint`. Not allowed with `incognito_exempt`. |
| `backfill_opt_out` | Version 5. `true` stops backfill to this destination. Backfill is on by default. |

Put AI Usage on a separate destination from Agent Security findings and the
event stream. The `full` event stream profile includes private fields.

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

`config_source` must use HTTPS. `sync_interval_seconds` is 60 to 86400. From
version 4, `files` lists up to 8 files to sync. Supported names are
`markers.yaml`, `pricing.yaml`, `provider-pricing.yaml`,
`model-equivalence.yaml`, `cohort.yaml`, `RELEASES.json`, `deployment.json`,
and `config.defaults.yaml`. To approve releases with `RELEASES.json`, see
[Approve releases with `RELEASES.json`](#approve-releases-with-releasesjson).
This guide does not describe `deployment.json`.

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
again after 1 minute. The wait then doubles after each failure, up to
`sync_interval_seconds`.

### Organization settings (schema version 5)

These settings can also come from the remote `config.defaults.yaml`.

| Field | Description |
| --- | --- |
| `auto_instrument.enabled` | Lets the background service set up approved clients that users install later. Managed setup already does this for the clients in `clients`; see [Clients installed later](#clients-installed-later). |
| `auto_instrument.apply_enabled` | `true` applies changes. `false` only reports them. |
| `auto_instrument.interval_seconds` | Seconds between setup passes, 300 to 86400. |
| `auto_instrument.allow_clients` | Client IDs to set up, or `all`. |
| `auto_instrument.deny_clients` | Client IDs never to set up. |
| `task_segmentation.interval` | Turns between task segmentation passes, 1 to 1000. |
| `features.periodic_auto_instrument` | `false` pauses periodic client setup. |
| `features.agent_security_ai_edr_v2` | Makes the AI-EDR evaluator available. It turns on no module. |

Withdrawing `auto_instrument` stops later client changes. It does not remove
integrations. For Jamf Pro, `prepare --interactive` asks for these settings,
except `auto_instrument.deny_clients` and `features.agent_security_ai_edr_v2`.

### Installer operations

`trajectory-mdm macos-installer` generates one script for one operation. Run
`trajectory-mdm help macos-installer` for its options. For `repair`, `remove`,
`recover`, and `verify`, use the version, architecture, and release files of
the installed release. For `rollback`, use those of the previous release.

| Operation | Use |
| --- | --- |
| `install` | A new computer, or the first move from a personal installation. |
| `update` | Move to a newer release. The previous release is kept for rollback. A script for an older release changes nothing. |
| `repair` | Restore missing files and the user LaunchAgent for the current release. |
| `rollback` | Return to the previous release that the installer kept. |
| `remove` | Remove the application after you withdraw the profile. |
| `recover` | Finish or undo an operation that stopped partway. |
| `verify` | Check the installation without changing it. |

`install` installs its release for a user who has no installation. It adopts
or replaces a personal installation that no installer script manages yet, as
[Choose how to migrate existing installations](#choose-how-to-migrate-existing-installations)
describes. For an installation that an installer script already manages,
`install` checks the installed release and restores missing files. It never
installs its own release over another one. When the installed release is newer
than the script's, it exits 0 and it prints
`TRAJECTORY_INSTALLER_NOTICE: kept installed release <version>`. When the
installed release is older, it exits 1 with
`TRAJECTORY_INSTALLER_BLOCKED reason=installed_release_older`, so your MDM does
not report success. Run the `update` script for the script's release. Where
Trajectory owns binary selection, change the delegated deployment policy
instead. Use `update` or `rollback` to change the installed release.

The script installs `~/.trajectory/bin/trajectory`,
`~/.trajectory/managed/install-receipt.json`, and
`~/Library/LaunchAgents/com.datadoghq.trajectory.managed-reconcile.plist`.

The script does not write an install-owner record. While MDM has the Trajectory
configuration profile installed, managed setup treats the signed-in user's
`~/.trajectory/bin/trajectory` as managed, with install owner `mdm` from source
`profile`. Managed setup means automatic client setup, the organization-sync
health check, and doctor's install config path check. Only a root-owned
`/Library/Managed Preferences/com.datadoghq.trajectory.plist` with a Trajectory
profile key and no extended ACL counts. `~/.trajectory/selfupdate.conf` and
environment variables cannot turn this off, and a managed owner they name, such
as `jamf`, is still shown. The profile does not change updates: it neither
turns them on nor off. If the profile file cannot be checked, managed setup
treats the owner as unknown. Removing the profile ends managed setup. Earlier
releases count an installation as managed only when `selfupdate.conf` names a
managed owner.

Other helper commands: `trajectory-mdm providers` lists MDM products, and
`trajectory-mdm build` writes the compiled policy for your own automation.
Run `trajectory-mdm help COMMAND` for any command.

### Managed login items

On macOS 13 and later, macOS shows users a "Background Items Added"
notification when software adds a LaunchAgent or LaunchDaemon. Users can then
turn the item off in System Settings, under **General > Login Items**
(**Login Items & Extensions** in macOS 15 and later). If a user turns off the
Trajectory LaunchAgent, Trajectory stops applying the profile and setting up
clients in the background.

`trajectory-login-items.mobileconfig` prevents this. It is a device
configuration profile with one managed login items payload
(`com.apple.servicemanagement`). The payload has one Label rule for each
launchd job that Trajectory installs:

| Launchd label | Installed by |
| --- | --- |
| `com.datadoghq.trajectory.managed-reconcile` | The installation script, as a user LaunchAgent. A legacy application package installs a LaunchDaemon with the same label. |
| `com.datadoghq.trajectory.managed-profile` | A legacy application package, as a LaunchDaemon. |

macOS turns these jobs on and allows them. Users get no notification for them
and cannot turn them off. The rules match these labels only. They have no
Team ID rule, so they do not manage other software from the same developer.

The payload needs:

- macOS 13 or later. You can limit the assignment to these computers.
- User-approved MDM enrollment. Automated Device Enrollment is user-approved.
- Delivery by MDM. macOS does not accept this payload in a profile that someone
  installs by hand.
- Installation before the installation script runs. macOS shows the
  notification when the script adds the LaunchAgent. A profile that arrives
  later cannot take back a notification that the user already saw.

The login items profile is separate from `trajectory.mobileconfig`. If a
computer refuses it, the computer still installs the settings profile.
Trajectory works without it, but users see the notification and can turn the
LaunchAgent off.

The login items profile depends only on `provider` and `deployment_id`. It does
not change with your settings or with `--profile-revision`. Upload it once.
Replace it only when a newer helper generates a different file. To add it to an
existing deployment, generate the bundle again with a helper that includes it.
Then upload the new profile. You do not need to replace
`trajectory.mobileconfig`.

To see the background items on one Mac, run `sudo sfltool dumpbtm` and find
the entry for `com.datadoghq.trajectory.managed-reconcile`.
