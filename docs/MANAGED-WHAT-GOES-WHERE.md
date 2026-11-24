# What Goes Where

A deployment puts files in up to three places:

- **Your MDM** gets the files from the deployment bundle that `prepare` makes.
- **Your HTTPS server** at `organization_sync.config_source` hosts the files
  that `organization_sync.files` lists.
- **API keys** go only into your MDM, as the section for your product says.

The intent file and the `trajectory-mdm` helper stay on your administrator
computer. Do not upload them to your MDM, and do not host them.

## Find your product

Find your product and platform. The link goes to the section that says what
goes where.

| Product | Policy ID | macOS | Windows |
| --- | --- | --- | --- |
| Addigy | `addigy` | [Other products](#other-products-on-macos) | - |
| Cisco Meraki Systems Manager | `cisco_meraki` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| Fleet | `fleet` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| Hexnode UEM | `hexnode` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| IBM Security MaaS360 | `maas360` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| Ivanti Neurons for MDM | `ivanti` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| Jamf Pro | `jamf` | [Jamf Pro](#jamf-pro-on-macos) | - |
| JumpCloud | `jumpcloud` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| Kandji | `kandji` | [Other products](#other-products-on-macos) | - |
| ManageEngine Endpoint Central | `manageengine` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| Microsoft Intune | `intune` | [Intune](#microsoft-intune-on-macos) | [Windows](#windows) |
| Mosyle | `mosyle` | [Other products](#other-products-on-macos) | - |
| NinjaOne Endpoint Management | `ninjaone` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| Omnissa Workspace ONE | `workspace_one` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| Other endpoint manager | `other` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| Rippling Device Management | `rippling` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| SOTI MobiControl | `soti` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| Scalefusion UEM | `scalefusion` | [Other products](#other-products-on-macos) | [Windows](#windows) |
| SimpleMDM | `simplemdm` | [Other products](#other-products-on-macos) | - |

`trajectory-mdm providers` prints the same list for the helper that you run.

## Jamf Pro on macOS

The Jamf script carries the kit's release R, the release of the
`trajectory-mdm` that prepared the kit. On a new Mac, the first run downloads
that release. The script reads no release list and no update setting. See
[Updates](MANAGED-SETUP-DECISIONS.md#updates).

Upload these bundle files to Jamf Pro:

| File | Where it goes |
| --- | --- |
| `trajectory-jamf.sh` | A Jamf script. Two policies run it: one at Login, once per user per computer, and one at Recurring Check-in, once every day |
| `trajectory.mobileconfig` | A configuration profile at **Computer Level** |
| `adapter/extension-attribute.sh` | A computer extension attribute |
| `adapter/configuration-inventory.sh` | A second extension attribute, of type String |
| `adapter/package-policy-check.sh` | A recurring check-in policy for detection |

Read the other files, but do not upload them. `README.md` and
`provider-notes.md` give the steps for Jamf Pro. `managed-policy/` shows the
compiled settings for review. `adapter/credential-parameters.json` maps each
API key to its script parameter.

Host the files in [Hosted files](#hosted-files). The bundle has
`config.defaults.yaml` in `remote-defaults/` when the intent lists it.

Enter each API key in Jamf Pro, in the parameter that
`adapter/credential-parameters.json` names, on both policies that run
`trajectory-jamf.sh`. Parameters start at 4. See [API keys](#api-keys).

## Microsoft Intune on macOS

The Intune script is the Jamf script, made for Intune. Its release R is the
release of the `trajectory-mdm` that prepared the kit.

Upload these bundle files to Intune:

| File | Where it goes |
| --- | --- |
| `trajectory-intune.sh` | A macOS shell script, with **Run script as signed-in user** set to **No** and a **Script frequency**, such as every day |
| `trajectory.mobileconfig` | A custom configuration profile on the **Device channel** |
| `adapter/custom-attribute.sh` | A custom attribute |
| `adapter/configuration-inventory.sh` | A second custom attribute, of type String |
| `adapter/detect.sh` | Optional: a detection script in device context |

`README.md` and `provider-notes.md` give the steps. Do not upload them.

Intune deployments use `schema_version` 1, so you host nothing. Intune
delivers no API keys, so the intent has no destinations.

## Other products on macOS

The bundle does not install the Trajectory application. Datadog does not
publish an application package for these products. The bundle has:

- the compiled settings in `managed-policy/`. Build a policy package from them
  with `policy-tools/build-policy-pkg.sh`. It needs the `trajectory` binary
  from the same release.
- detection, inventory, and user setup scripts in `adapter/`.

`README.md` names each file's role, and `provider-notes.md` says where it goes
in your product. Use `schema_version` 1, so you host nothing. These products
deliver no API keys, so the intent has no destinations.

## Windows

The bundle does not install the Trajectory application. It has:

- the compiled settings in `managed-policy/`. Install them with
  `policy-tools/install-policy.ps1` in system context.
- detection, inventory, and user setup scripts in `adapter/`. Run the user
  setup script as the signed-in user, never as SYSTEM.

`README.md` and `provider-notes.md` say where each file goes in your product.
Use `schema_version` 1, so you host nothing. Windows deployments deliver no API
keys, so the intent has no destinations.

## Hosted files

Publish each file that `organization_sync.files` lists. Computers download
each one from a `latest/` folder next to its `path`. For example, the path
`rules/markers.yaml` downloads from
`<config_source>/rules/latest/markers.yaml`. `prepare` prints each URL.

| File | Who writes it | What it does |
| --- | --- | --- |
| `config.defaults.yaml` | The bundle, in `remote-defaults/`, or `trajectory-mdm remote-defaults` | Behavior settings that you can change without a new profile. Its `path` must be `config.defaults.yaml`. |
| `RELEASES.json` | You | Names the newest release that Macs may install. Windows computers do not use it. |
| `markers.yaml` | You | Your marker rules. Its `path` must equal `organization_sync.markers_path`. |
| `cohort.yaml` | You | Settings for the cohort that `cohort` names. Its `path` must be `cohorts/<cohort>.yaml`. |
| `pricing.yaml` | You | A pricing catalog. |
| `provider-pricing.yaml` | You | A provider rate card. |
| `model-equivalence.yaml` | You | A mapping between model names. |
| `custom-pricing.yaml` | You | Your organization's custom rate card. |
| `deployment.json` | Nobody | Retired. Computers still download a listed file, but they no longer use it. Remove its entry from `organization_sync.files`, then stop hosting it. The helper warns with `deployment_json_selected`, and `trajectory doctor` warns too. |

When the intent lists `config.defaults.yaml`, check it before you publish it
with `trajectory-mdm check-remote-defaults`. The command can also check your
markers and pricing files. Run `trajectory-mdm check-remote-defaults --help`
for its options.

Never host the intent file, the bundle, or an API key.

## API keys

Only Jamf Pro on macOS delivers Datadog API keys. Each destination's
`api_key_ref` is the name of a keychain entry, such as `dd-primary-api-key`.
It is never the key.

1. In Jamf Pro, create the two policies that run `trajectory-jamf.sh`.
2. Open `adapter/credential-parameters.json`. It names the script parameter
   for each `api_key_ref`, from parameter 4 to parameter 11.
3. Enter each API key in its parameter, on both policies.

The script passes the keys to `trajectory install` on its standard input.
Install checks each key with Datadog, then, as the signed-in user, stores it
in that user's login keychain under its `api_key_ref` name. A key that is missing, invalid,
or cannot be stored makes the run exit 2.

Never put an API key in the intent file, the bundle, a profile, a hosted file,
or a tag. The helper never asks for one.
