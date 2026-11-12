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

Jamf Pro and Microsoft Intune on macOS also need two files from the same
release: the release record and its checksums. The
[administrator guide](https://github.com/datadog-labs/trajectory/blob/main/docs/MANAGED-ENDPOINTS.md#step-2-save-the-release-files)
shows how to download them. This page calls them `public-release.json` and
`checksums.sha256`.

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
trajectory-mdm prepare --interactive \
  --release-json public-release.json --checksums checksums.sha256 \
  --output trajectory-deployment.zip
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

For Jamf Pro and Intune on macOS:

```bash
trajectory-mdm prepare --file trajectory-managed.yaml \
  --release-json public-release.json --checksums checksums.sha256 \
  --output trajectory-deployment.zip
```

For every other product, and for Windows, leave out the release files:

```bash
trajectory-mdm prepare --file trajectory-managed.yaml --output trajectory-deployment.zip
```

`prepare` prints the warnings again, then the next steps. Jamf Pro and Intune
bundles on macOS have a profile revision. Each Jamf Pro run gives the profile
a higher revision than earlier runs. For Intune, when you change a deployment
that computers already have, add `--profile-revision` with a number above every
revision that you deployed. Other bundles have no profile revision.

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
   bundle's `README.md` names.

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
