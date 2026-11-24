# Set Up a Managed Deployment

This page lists the `trajectory-mdm` commands for a new deployment, in the
order you run them. Run the helper on your administrator computer. Never
install it on employee computers.

Each step names the decision it needs. [Setup decisions](MANAGED-SETUP-DECISIONS.md)
explains each choice. [What goes where](MANAGED-WHAT-GOES-WHERE.md) says which files
go to your MDM, which ones you host, and where API keys go. For the full
procedure and troubleshooting, read the
[Managed Endpoint Administrator Guide](https://github.com/datadog-labs/trajectory/blob/main/docs/MANAGED-ENDPOINTS.md).

## Before you start

Use the helper from the Trajectory release that you deploy. Check its version:

```bash
trajectory-mdm version
```

Find the policy ID of your MDM product:

```bash
trajectory-mdm providers --platform macos
```

No bundle needs release files. The macOS script of a Jamf Pro or Intune
bundle places the kit's release R where needed. R is the release of the
`trajectory-mdm` that prepared the kit. The script places it on each computer
whose binary for root is not signed by Datadog or does not answer the kit's
launcher interface. The script reads no release list and no update setting, so
`deployment.ring` does not change it.

Datadog API keys never go in any file that the helper reads or writes. You
enter them only in your MDM. See [API keys](MANAGED-WHAT-GOES-WHERE.md#api-keys).

## 1. Write the intent file

The intent file describes the whole deployment. Write it as JSON, or as
commented YAML in a file named `trajectory-managed.yaml`. Keep it in version
control.

Make each choice in [Setup decisions](MANAGED-SETUP-DECISIONS.md). To get editor completion,
write the JSON Schema next to the intent file:

```bash
trajectory-mdm schema --output managed-endpoint-intent.schema.json
```

For Jamf Pro and Intune on macOS, the helper can ask the questions instead of
you writing the file:

```bash
trajectory-mdm prepare --interactive --output trajectory-deployment.zip
```

It makes the bundle at once, so continue with step 4. The bundle holds the
intent as `trajectory-managed.json`. Extract it and keep it. For a later
change, edit that file and run the steps below with
`--file trajectory-managed.json`.

## 2. Check the intent

```bash
trajectory-mdm validate --file trajectory-managed.yaml
```

Fix every error. Then read every line that starts with `Warning:`. A warning
does not stop the command. It names a setting that the helper accepts but that
may not do what you expect. Change the setting, or keep it on purpose.

Add `--format json` to get the same result as JSON. The warnings are then in
the `warnings` field.

## 3. Make the deployment bundle

```bash
trajectory-mdm prepare --file trajectory-managed.yaml --output trajectory-deployment.zip
```

`prepare` prints the warnings again, then the next steps. Jamf Pro and Intune
bundles on macOS have a profile revision. A computer applies the profile that
its deployment delivers, at any revision. Computers on earlier releases need a
higher revision for each change. Each Jamf Pro run gives the profile a higher
one. For Intune, add `--profile-revision` with a number above every revision
that you deployed. Other bundles have no profile revision.

## 4. Check the bundle

```bash
trajectory-mdm verify --bundle trajectory-deployment.zip
```

The verifier rebuilds every file and reports any file that differs. Use the
same helper that made the bundle.

## 5. Check the hosted settings file

Skip this step when `organization_sync.files` does not list
`config.defaults.yaml`.

Extract the bundle. The file to publish is
`remote-defaults/config.defaults.yaml`. Check it against the intent before you
publish it:

```bash
trajectory-mdm check-remote-defaults --file trajectory-managed.yaml \
  --defaults remote-defaults/config.defaults.yaml
```

To change behavior settings later without a new bundle, generate the file
again from the edited intent:

```bash
trajectory-mdm remote-defaults --file trajectory-managed.yaml --output config.defaults.yaml
```

## 6. Place the files

Follow [What goes where](MANAGED-WHAT-GOES-WHERE.md) for your product. In short:

1. Upload the bundle files that its `README.md` lists to your MDM.
2. Publish each file in `organization_sync.files` at the URL that `prepare`
   printed.
3. For Jamf Pro, enter each API key in the script parameter that the
   bundle's `README.md` names, on both policies that run the Jamf script.

Roll out to a few test computers first.

## 7. Check one computer

On a test computer, run this command as the signed-in user. On macOS:

```bash
~/.trajectory/bin/trajectory managed status --scope all --format json
```

On Windows, in PowerShell:

```powershell
& "$env:ProgramFiles\Trajectory\trajectory.exe" managed status --scope all --format json
```

The deployment works when `overall` is `compliant`. Otherwise read `reason`
and `next_step`, and see
[Troubleshooting](https://github.com/datadog-labs/trajectory/blob/main/docs/MANAGED-ENDPOINTS.md#troubleshooting).

## 8. Find Macs that do not report

This step is for Jamf Pro on macOS. The Intune kit delivers no API key, so
its script sends no metrics.

The metrics name each Mac by its device ID, the `trajectory.device_id` tag.
It is the Mac's hardware UUID, which Jamf Pro shows as the UDID. The Jamf script
tags its `trajectory.ops.mdm_script.*` metrics with it. Trajectory 0.6.4-beta
and later tag their own metrics with it too, such as the hourly
`trajectory.ops.binary.heartbeat`. The script sends its metrics with the API
key in parameter 4. Run the queries below in the Datadog organization of that
key.

### Macs that never ran the script

1. In Jamf Pro, count the computers in the scope of the Trajectory policies.
2. In Datadog, count the device IDs that sent a script run in the last 7
   days. Use this query in a Query Value widget set to the past 7 days:

   ```text
   count_nonzero(sum:trajectory.ops.mdm_script.run.count{*} by {trajectory.device_id}.as_count())
   ```

3. If Datadog counts fewer Macs, list the device IDs with this query. Compare
   them with the UDIDs of the computers in scope.

   ```text
   sum:trajectory.ops.mdm_script.run.count{*} by {trajectory.device_id}.as_count()
   ```

A missing Mac did not run the script, or its run could not send metrics.
Check the policy logs of that computer in Jamf Pro. The device ID `unknown`
means that the script could not read the Mac's hardware UUID.

### Macs where the script failed

List the failed runs of the last 7 days by Mac and reason:

```text
sum:trajectory.ops.mdm_script.run.count{outcome:failed} by {trajectory.device_id,reason}.as_count()
```

A failed run exited with code 1 or 2, and it needs your action. The Reasons
table of the MDM Script Metrics reference says what each `reason` means and
what to fix. The reference is `docs/metrics/mdm-script-metrics.md` in the
`datadog-labs/trajectory` repository on GitHub. A Mac also appears for a
failure that a later run fixed.

A run with the outcome `retrying` needs no action, because the next run tries
again. When every run of a Mac retries, read its `mdm-script.log`.

### Macs that stopped reporting

Get `dashboard.json` and `monitor.json` from the
`docs/managed-mac-reporting` folder of the `datadog-labs/trajectory`
repository on GitHub. Import `dashboard.json` as a new dashboard, and
`monitor.json` as a new monitor.

The dashboard's table lists each Mac with a successful script run in the last
7 days. The **Trajectory heartbeat** column is `0` when the Mac sent no
heartbeat in those 7 days. Trajectory is set up on that Mac, but it does not
report. These Macs come first in the table. Check each one as step 7 says.

The monitor **Trajectory: managed Mac stopped reporting** alerts once for each
managed Mac that sent heartbeats and then sent none for 3 days. A Mac that is
shut down, offline, or retired also alerts. Datadog drops the alert about a
day later, and tracks the Mac again when it reports. The monitor notifies
nobody until you add recipients to its message. It cannot alert for a Mac
that never sent a heartbeat. The table shows those Macs.

A Mac on a release before 0.6.4-beta sends its heartbeat without the device
ID. The table shows `0` for that Mac, and the monitor never alerts for it.
