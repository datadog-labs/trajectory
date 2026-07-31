# Managed Endpoint Deployment

Trajectory 0.5.29 includes a provider-neutral `trajectory-mdm` administrator
helper for preparing and verifying managed endpoint policy bundles. Keep this
helper on an administrator workstation or deployment automation runner; it is
not the Trajectory runtime installed for end users.

## Download The Helper

Choose the helper for the administrator workstation:

| Platform | Release asset |
| --- | --- |
| macOS Intel | `trajectory-mdm-darwin-amd64` |
| macOS Apple silicon | `trajectory-mdm-darwin-arm64` |
| macOS universal | `trajectory-mdm-darwin-universal` |
| Linux amd64 | `trajectory-mdm-linux-amd64` |
| Linux arm64 | `trajectory-mdm-linux-arm64` |
| Windows amd64 | `trajectory-mdm-windows-amd64.exe` |

Verify the downloaded file against `checksums.sha256`. On macOS or Linux,
mark it executable and optionally rename it to `trajectory-mdm`.

```bash
trajectory-mdm version
trajectory-mdm prepare --interactive
```

The interactive workflow asks for the endpoint-management provider, target
platform, deployment ID, approved coding-agent clients, and optional telemetry
tags. It selects no coding agents by default and displays the complete plan
before writing a bundle.

## Source-Controlled Intent

For repeatable deployments, define the administrator-owned intent as JSON:

```json
{
  "schema_version": 1,
  "deployment_id": "engineering-coding-agents",
  "provider": "intune",
  "platform": "windows",
  "clients": ["cc", "codex"],
  "tags": {
    "environment": "production",
    "team": "developer-experience"
  }
}
```

The intent contains bounded identifiers, not credentials or credential
references. Prepare and verify the resulting bundle with the helper from the
same Trajectory release:

```bash
trajectory-mdm prepare \
  --file ./trajectory-managed.json \
  --output ./trajectory-managed.zip

trajectory-mdm verify --bundle ./trajectory-managed.zip
```

Do not hand-edit generated policy files. Change the intent and prepare a new
bundle instead.

## Verify An Endpoint

Check machine-level state from an administrator context:

```bash
trajectory managed status --scope system --format json
```

Check and reconcile user integrations from the signed-in user's context:

```bash
trajectory managed status --scope all --format json
trajectory managed reconcile --scope user --dry-run --format json
trajectory managed reconcile --scope user --yes --format json
trajectory managed repair --scope user --yes --format json
```

User reconciliation must run as the signed-in user rather than root or Windows
SYSTEM. Treat `blocked`, `drifted`, or `failed` as non-compliant and use the
reported `reason` and `next_step` fields for remediation.

Provider-neutral bundles are not by themselves proof that every provider and
platform combination has been certified in a live tenant. Validate the chosen
provider, platform, package, detection, inventory, and user-reconciliation
workflow before broad deployment.
