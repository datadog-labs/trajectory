---
name: trajectory-security
description: Manage Datadog AI Guard and AI-EDR security controls for coding agents. Use for Trajectory Security status, enable, disable, enforcement, hook setup, destination configuration, or agent-security scan-result readback.
---

# Trajectory Security

Use the installed Trajectory binary for every operation. Do not duplicate security policy in the plugin.

- Status: run `trajectory security status`.
- Enable the security plugin hooks for the current client: run `trajectory security setup --marketplace --clients <cc|codex|cursor>`.
- Enable enforcement only after explicit confirmation: run `trajectory security enable --mode enforce --clients <client> --yes`.
- Disable evaluation: run `trajectory security disable`.
- Configure result publishing: collect the existing destination name and an app-key secret reference, then run `trajectory security destination add --destination <name> --app-key-ref <ref>`.

Never request or display an application-key value. If validation reports that the reference is missing, tell the user to store it with `trajectory config set-secret <ref> --stdin` or use `dd_app_key` with `DD_APP_KEY`.
