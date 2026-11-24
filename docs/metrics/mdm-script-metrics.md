# MDM Script Metrics

The Jamf Pro kit's script sends its own metrics to Datadog. The Intune kit
runs the same script, but it delivers no API key, so its runs send none. Use
them to see
which Macs ran the script, what each run did, and which Macs need another
Jamf run. The script sends them with `curl`, so they arrive even when the
Trajectory binary is missing or does not start. The binary's own metrics are
on the other pages of the [metrics reference](../METRICS.md).

Each run reports the script's own `binary` step, which keeps or places the
binary that root runs. It also reports, as a number, the exit code of
`trajectory mdm launch`, which the script runs once, as root. Launch runs the
signed-in user's own copy, which prints the report to the Jamf policy log.
Neither sends these metrics. The script reads nothing
launch prints and gives its exit code no meaning, so these metrics carry
nothing launch printed.

## How the script sends metrics

- The script posts to the Datadog Metrics API endpoint `/api/v2/series` on
  the API host of the Datadog site of the kit's destination, such as
  `api.datadoghq.com`.
- It sends them with the API key in the first API key parameter, parameter
  4, to that key's Datadog site. It does not send them to the other
  destinations. When the bundle has no destinations, or that key is empty or
  not in the API key form, the script sends no metrics.
- The script also sends no metrics when
  `/Library/Application Support/Trajectory` or its `mdm-script` folder is a
  link or is not owned by root. That run stops with `script_error`.
- It writes the key to a temporary file that only root can read, passes that
  file to `curl`, and deletes it after the send. When a run is stopped during
  a send, the next run deletes the file it left. The key never appears in
  command arguments or in the script's output.
- Each send waits at most 2 seconds to connect and 5 seconds in total. A
  failed send does not change the run's outcome or exit code.
- On a Mac whose network settings set an HTTPS proxy, the script sends its
  metrics through that proxy, as it does its other requests. It retries a send
  only once, without the proxy, when the proxy asks for authentication
  (HTTP 407). It never retries a send otherwise.
- A run sends each warning when it happens, at most 10 per run. When the run
  ends, it sends one final batch: one `run.count`, one `step.count` for the
  `binary` step, and one `duration_seconds`. It sends the final batch also when the run
  reached its 30-minute time limit.
- Each series identifies the Mac by its hardware UUID, in the
  `trajectory.device_id` tag, and has no host. `run.count` also has the
  signed-in user, in the `trajectory.user` tag.

Because a send can fail, a missing series does not show that a run did not
happen. Check the Jamf policy log on the Mac.

## Metrics

<!-- BEGIN GENERATED TABLE mdm-script-metrics -->
| Metric | Type | Sent | Tags | Description |
| --- | --- | --- | --- | --- |
| `trajectory.ops.mdm_script.run.count` | count | Once per run, in the final batch | `outcome`, `exit_code`, `reason`, `launch_exit`, `trajectory.user` | One Jamf script run, by outcome, exit code, reason, and launch's raw exit status. |
| `trajectory.ops.mdm_script.step.count` | count | Once per step, in the final batch | `step`, `step_outcome`, `reason` | One step that a Jamf script run performs itself, by step, the step's outcome, and reason. |
| `trajectory.ops.mdm_script.warning.count` | count | When a warning happens, at most 10 per run | `step`, `reason`, `curl_exit`, `http_status_class` | One warning during a Jamf script run, sent as it happens, by step and reason. |
| `trajectory.ops.mdm_script.duration_seconds` | gauge | Once per run, in the final batch | `outcome` | Wall time of one Jamf script run, in whole seconds. |
<!-- END GENERATED TABLE mdm-script-metrics -->

Every series also has the common tags.

## Common tags

| Tag | Values |
| --- | --- |
| `provider` | `jamf`, or `intune` for the same script in the Intune kit. The Intune kit has no API key, so its script sends no metrics. |
| `script_version` | The `trajectory-mdm` release that generated the script, such as `1.2.3`. |
| `version_target` | The kit's release R, which the run places as the binary root runs, also when placing it failed, or `none` when the run kept that binary or stopped before the `binary` step. |
| `version_installed` | The release the `binary` step placed as the binary root runs, or `none` when it kept that binary, whose release the script does not read, or placed none. Trajectory moves the signed-in user's own binary itself, so that binary can be on another release. |
| `trajectory.device_id` | The Mac's hardware UUID in uppercase, as `ioreg` prints `IOPlatformUUID` and Jamf inventory shows the UDID, such as `1A2B3C4D-5E6F-7A8B-9C0D-1E2F3A4B5C6D`. It is `unknown` when the script cannot read it, and a failed read never changes the run's outcome or exit code. It is the only tag that identifies the Mac. Use it to match a Mac's metrics to its Jamf record. |

## Other tags

| Tag | Values |
| --- | --- |
| `outcome` | `ok`, `retrying`, `failed`, or `skipped` for a run that stopped before launch, or `launched`. See [Reasons](#reasons). |
| `exit_code` | The run's exit code: the script's own, `0` or `1`, or launch's for a `launched` run. See [Exit codes](#exit-codes). |
| `reason` | One of the script's own reasons in [Reasons](#reasons): `none`, `run_in_progress`, `run_time_limit`, `run_interrupted`, `script_error`, or a `binary_` reason. `none` means no problem, and a `launched` run has `none`. |
| `launch_exit` | Launch's exit code, from 0 to 255, or `none` for a run that did not reach launch. The script records it without reading it. See [Exit codes](#exit-codes). |
| `step` | `binary`, the script's own step. See [Steps](#steps). |
| `step_outcome` | The `binary` step's outcome: `placed`, `kept`, `failed`, or `skipped`. |
| `curl_exit` | The exit status of the `curl` request behind a warning, from 0 to 255, or `none` when no request ran. |
| `http_status_class` | `2xx`, `3xx`, `4xx`, or `5xx` for the HTTP status the request got, or `none` when it got none. |
| `trajectory.user` | The macOS short name of the signed-in user, such as `jdoe`. It identifies that user. It is `unknown` when nobody is signed in, so `unknown` never names a person. Trajectory's own metrics use the same tag, so you can join a run with that user's other Trajectory data. It is never an email address or a path. Only `run.count` has it. |

## Steps

The script runs the `binary` step, which is the only one its `step.count`
reports. The user's copy runs `api_keys` and `install`, and reports them in
its own lines in the Jamf policy log.

| Step | What it does | Outcomes |
| --- | --- | --- |
| `binary` | The binary that root runs, which the script keeps in `/Library/Application Support/Trajectory/mdm-script/bin`, where only root can write. `kept`: only root can change the binary there, it carries Datadog's Developer ID signature, and it answers the kit's launcher interface, whatever its release. `placed`: otherwise the run placed the kit's release R, after the same signature and interface checks, by rename. | `placed`, `kept`, `failed`, `skipped` |
| `api_keys` | The user's copy checks the form of each API key parameter and asks Datadog to validate it. Then it stores the keys in the signed-in user's login keychain. | `stored`, `unchanged`, `failed`, `skipped` |
| `install` | The user's copy sets the user up, as `trajectory install` does when the user runs it. `unconfirmed` means it finished, but Trajectory's own status, read after it, does not say that the user is set up. | `ok`, `unconfirmed`, `failed`, `skipped` |

## Reasons

Each run has one reason, which sets its outcome and exit code. A reason marked
**Warning** can also send a `warning.count` when it happens. Only the script's
own `binary` step sends warnings. A failed trust check or write sends none.

The script's `run.count` and `step.count` carry only the reasons the script
decides: the reasons of its `binary` step, `run_in_progress`, `script_error`
and `run_time_limit`. A run that reached launch carries reason `none`, outcome
`launched`, and launch's exit status as both `exit_code` and `launch_exit`.
The script gives that status no meaning. `trajectory mdm launch` defines its
codes. The user's copy reports its own
reasons in the Jamf policy log.

| Reason | Outcome | Exit code | Warning | What it means |
| --- | --- | --- | --- | --- |
| `none` | `ok` | `0` | No | No problem. |
| `run_in_progress` | `skipped` | `0` | No | Another run of the script on this Mac is still working. This run changes nothing and runs no launch. The other run reports. |
| `binary_download_failed` | `failed` | `1` | Yes | The kit's release R could not be downloaded from the kit's link, or what came back is not a Mac program. An installed binary stays. |
| `binary_trust_failed` | `failed` | `1` | Yes | The download of R failed its Developer ID signature, architecture, or interface check. The script did not install it. An installed binary stays. |
| `binary_write_failed` | `failed` | `1` | Yes | The verified binary could not be written into place. An installed binary stays. |
| `binary_time_limit` | `failed` | `1` | No | The run reached its 30-minute time limit before the binary was placed. An installed binary stays, and no partial download is left. The steps after it are skipped. The next run places it. |
| `script_error` | `failed` | `1` | No | The Mac is not set up for the script. For example, the script does not run as root, a folder it writes as root is a link or is not root's, or another account can change a folder above the binary that root runs. It skipped the steps it did not reach. Read `mdm-script.log` for the cause. |
| `install_failed` | `retrying` | `0` | No | The user's install failed, for example because it could not download the hosted settings file on a first installation. The next run runs it again. |
| `run_time_limit` | `retrying` | `0` | No | The run reached its 30-minute time limit before launch, or in the user's copy: an `install` that it cut is `failed`, one that it had no time to start is `skipped`, and `install` is `unconfirmed` when its status could not be read. The next run runs it again. |
| `run_interrupted` | `retrying` | `0` | No | A signal (HUP, INT or TERM) stopped the run before launch gave it a status. The next run runs it again. |
| `install_unsupported` | `failed` | `1` | No | The user's copy cannot do what the script asks. Deploy a kit that supports it. Nothing is stored or set up. |
| `api_key_missing` | `failed` | `2` | No | An API key parameter is empty. Fix the policy's parameters and run it again. |
| `api_key_invalid` | `failed` | `2` | No | An API key parameter has the wrong form, or Datadog rejected it. Fix the policy's parameters and run it again. |
| `api_key_check_unreachable` | `retrying` | `0` | No | Trajectory could not reach Datadog to validate the keys. It stored them anyway, and the next run checks them again. |
| `keychain_unavailable` | `failed` | `2` | No | A key could not be stored in the signed-in user's keychain, for example because it is locked. The keys are not in place until a run stores them. Ask the user to unlock the keychain. The next daily run stores them. |
| `keychain_time_limit` | `failed` | `2` | No | The run reached its 30-minute time limit before the API keys were all stored. The steps after it are skipped. The next run stores them. |
| `install_not_confirmed` | `retrying` | `0` | No | The user's install finished, but Trajectory's own status, read after it, does not say that the user is set up, or the capture service does not answer at the installed release. The next run runs it again. |
| `install_busy` | `retrying` | `0` | No | Another `trajectory install` or `trajectory update` of the signed-in user was running. That run does the work, and the next run checks it. |

When several steps report a problem, the run's reason is the first one that
applies:

1. a reason with exit code `2`
2. a reason with exit code `1`
3. the first problem, in step order, of a step that ran
4. the reason that the skipped steps share

## Exit codes

A run that stopped before launch exits with its reason's code, `0` or `1`. A
run that reached launch exits with launch's code, which `run.count` also
carries as `launch_exit`. The script gives it no meaning.
`trajectory mdm launch` defines it.

| Exit code | When | What to do |
| --- | --- | --- |
| `0` | Success, and every problem that a later run retries: a setup that Trajectory does not confirm yet, a failed install, the time limit reached, nobody signed in, another run in progress, an unreachable key check, a refused configuration profile, or a launch that could not run the user's copy or got no result from it. Launch's summary line in the policy log says why. | Nothing. A later run retries. A refused configuration profile means profiles of two deployments are installed. Keep one Trajectory profile on each Mac by scoping. See [Move a Mac to another deployment](../MANAGED-ENDPOINTS.md#move-a-mac-to-another-deployment). |
| `1` | The binary root runs cannot be placed: the download, trust check, or write failed, or the run reached its time limit first. The exit code is still `1` when an older, trusted binary stays installed. It is also `1` for `script_error`, and when the user's copy cannot do what the script asks. | Fix the cause, or deploy a kit that the binary supports. The next daily run tries again. |
| `2` | An API key is missing, invalid, or cannot be stored: empty, in the wrong form, rejected by Datadog, refused by the signed-in user's keychain, or not stored before the run reached its time limit. | Fix the API key parameters, or ask the user to unlock the keychain. The next daily run tries again. |

## Query examples

Runs by outcome:

```text
sum:trajectory.ops.mdm_script.run.count{*} by {outcome}.as_count()
```

Runs that reached launch, by Mac and launch's exit code:

```text
sum:trajectory.ops.mdm_script.run.count{outcome:launched} by {trajectory.device_id,launch_exit}.as_count()
```

Failed runs by Mac and reason. A Mac also appears for a failure that a later
run fixed:

```text
sum:trajectory.ops.mdm_script.run.count{outcome:failed} by {trajectory.device_id,reason}.as_count()
```

Steps that fail:

```text
sum:trajectory.ops.mdm_script.step.count{step_outcome:failed} by {step,reason}.as_count()
```

Warnings by reason and HTTP status:

```text
sum:trajectory.ops.mdm_script.warning.count{*} by {reason,http_status_class}.as_count()
```

Runs by the release of the binary root runs. A Mac counts once for each run:

```text
sum:trajectory.ops.mdm_script.run.count{*} by {version_installed}.as_count()
```

The longest runs:

```text
max:trajectory.ops.mdm_script.duration_seconds{*} by {outcome}
```

## Find Macs that do not report

Trajectory 0.6.4-beta and later tag their own metrics with the same
`trajectory.device_id`, so you can join a Mac's script runs with its
`trajectory.ops.binary.heartbeat`. Import the
[managed Mac dashboard](../managed-mac-reporting/dashboard.json) and the
[managed Mac monitor](../managed-mac-reporting/monitor.json). The dashboard
lists Macs where the script succeeded but Trajectory sends no heartbeat. The
monitor alerts for each managed Mac that stops sending its heartbeat. The
`trajectory-mdm user-guide setup` topic explains how to use them.
