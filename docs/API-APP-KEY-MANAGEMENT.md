# API and Application Key Management

Trajectory keeps Datadog credential values out of configuration and session
data. Configuration names a credential by reference; the credential layer
resolves that reference at runtime from an environment variable, an external
provider, or the OS keychain. The resolved value is held only as long as the
active process or its bounded credential cache needs it.

This document describes the Datadog API and application key lifecycle in the
Trajectory binary. Provider credentials such as
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GEMINI_API_KEY` are separate from
the Datadog publish path.

## Key responsibilities

| Credential | What Trajectory uses it for | When it is required |
| --- | --- | --- |
| Datadog API key | LLM Observability, metrics, logs, and AI Usage intake; Datadog API-key validation; optional AI Guard evaluation | Direct `datadog_agentless` publishing, agentless Datadog OTLP forwarding, and the enabled AI Guard evaluator |
| Datadog application key | Datadog Metrics query readback, log-based metric configuration, and optional AI Guard evaluation | Explicit readback, `trajectory publish sync`, and the enabled AI Guard evaluator; not routine capture or publish |
| No Trajectory-managed key | Egress owned by another component | `datadog_agent` destinations and generic `otlp` collectors |

An application key does not replace an API key. Commands that call a Datadog
configuration or query API generally use both: the API key identifies the
organization, and the application key authorizes the operation.

## Security invariants

- YAML contains `api_key_ref`, `app_key_ref`, and command configuration, never
  a credential value.
- The default durable store is the current user's OS keychain under service
  `trajectory`.
- Session JSONL, local-ui data, publish ledgers, and publish outboxes never
  persist API or application keys.
- Runtime logs and validation output report the policy, source, wrapper shape,
  normalized length, and format validity, but never the value.
- A missing credential does not stop local capture. Remote publishing fails
  closed, records a credential-health error, and leaves retryable publish work
  in its normal durable queue where applicable.
- Publish keys are sent only to the destination selected by the effective
  trusted configuration. Datadog requests use `DD-API-KEY`, `dd-api-key`, and,
  only where required, `DD-APPLICATION-KEY` headers over HTTPS.

## End-to-end flow

```text
setup / config / managed provisioning
       |
       +--> config.yaml or config.defaults.yaml: refs and source policy only
       |
       +--> environment, credential provider, or OS keychain: secret value
                              |
                              v
                  credentials.ConfigurePolicy
                              |
                +-------------+--------------+
                |                            |
                v                            v
     credentials.Resolve          ResolveDatadogApplicationKey
        per destination              only for readback/sync
                |                            |
                v                            v
       API key in memory             app key in memory
                |                            |
                +-------------+--------------+
                              v
                publish or Datadog API client
```

`trajectory setup` prompts for a Datadog API key with terminal echo disabled,
validates it against the selected Datadog site, and stores it as `dd_api_key`
in the OS keychain. It does not request an application key because normal
publishing does not need one. Setup snapshots an existing keychain value before
replacement and attempts to restore that value if the write fails.

Keys can also be stored directly:

```bash
trajectory config set-secret dd_api_key
trajectory config set-secret dd_app_key --stdin
trajectory config set-secret dd-payments-api-key
trajectory config secrets
```

Interactive `set-secret` input is hidden. `--stdin` is appropriate for
automation that can provide a protected pipe. Avoid `--value=...` for real
credentials because the value becomes a command-line argument. `config
secrets` reports only whether known keychain entries exist; it does not print
values or enumerate arbitrary custom entries.

## Configuration stores references, not values

A standard multi-destination configuration can name separate credentials:

```yaml
auth:
  credential_source: auto
  key_command: ""

required_destinations:
  - name: primary
    type: datadog_agentless
    site: datadoghq.com
    api_key_ref: dd-primary-api-key
    app_key_ref: dd-primary-app-key
    level: standard
```

`api_key_ref` selects the API credential for all direct Datadog signals on that
destination. `app_key_ref` is consulted only by a command that needs Datadog
readback or configuration access; its presence does not cause the normal
publish engine to resolve or transmit an application key.

Custom intake and forwarder destinations can use `bearer_token_ref` instead of
`api_key_ref` when the default-off `bearer_destination_auth` feature is enabled.
The fields are mutually exclusive. Bearer references use the configured source
policy but resolve only the named environment variable, keychain account, or
destination command; they never fall back to `DD_API_KEY`, `DATADOG_API_KEY`,
or the default Datadog key provider. Trajectory sends the result as
`Authorization: Bearer <token>` across the explicitly configured direct and
OTLP publish requests. Bearer endpoints must use HTTPS; loopback HTTP is
accepted only for local development and tests, and authenticated redirects are
not followed.
Managed direct-Datadog entries use the rollback-safe `type: datadog_bearer`
shape with `level: off` and the active level in `bearer_level`. Project publish
files use `version: 2` for bearer destinations. Bearer configuration must set
explicit intake, OTLP trace, active metrics transport, and logs URLs; enabled
evaluations and AI Usage also require their explicit endpoints.
Managed bearer destinations use only the rollback-safe `datadog_bearer` shape;
project schema version 2 also supports bearer-authenticated `otlp` collectors.

For the implicit `_config_datadog` destination created from `export.*`, the API
key ref defaults to `dd-api-key`. In standard mode, `dd-api-key` and
`dd_api_key` are aliases for the same normalized keychain account. This is why
setup can store `dd_api_key` while the publish layer uses `dd-api-key`.

## API key resolution

For a direct Datadog destination, `auth.credential_source: auto` checks the
following sources in order:

| Order | Source | Behavior |
| --- | --- | --- |
| 1 | Environment | The uppercased `api_key_ref` with hyphens changed to underscores, then `DD_API_KEY`, then `DATADOG_API_KEY` |
| 2 | Default key provider | `auth.key_command`, available only to the default `dd-api-key` / `dd_api_key` ref |
| 3 | OS keychain | Service `trajectory`, account `api_key_ref` with hyphens normalized to underscores |
| 4 | Destination command | The destination's `api_key_command`, if configured |

For example, `api_key_ref: dd-payments-api-key` first checks
`DD_PAYMENTS_API_KEY`, then the two global API-key environment aliases. It
skips the default key provider because it is a non-default ref, then checks the
normalized keychain account `dd_payments_api_key`, and finally its configured
destination command.

Set `auth.credential_source` to `env`, `key_provider`, `keychain`, or
`api_key_command` to select exactly one source. A pinned source fails closed; it
does not continue through the auto chain. A managed `credential_source` value
wins over the user value.

Trajectory normalizes common credential-provider wrappers before use,
including quoted values, `DD_API_KEY=...`, supported JSON objects, and
`go-keyring-base64:` keychain values. Real Datadog endpoints require a final
API key shape of 32 alphanumeric characters. In `auto` mode, a malformed
environment override is diagnosed and a real Datadog destination may continue
to the later sources. A pinned `env` policy rejects the value without fallback.

`datadog_agent` and generic `otlp` destinations bypass this chain because the
Agent or collector owns authentication. Agentless Datadog OTLP is still a
direct Datadog path and uses the resolved API key in a `dd-api-key` header.

## Credential-provider commands and caches

There are two command-backed API-key paths:

- `auth.key_command` is the process-wide default key provider. It supports
  short-lived credentials, refreshes on demand, and is used only for the
  default API-key ref. Its shared `~/.trajectory/.auth-cache` has a 40-minute
  validity window, while lock and failure-sentinel files prevent concurrent
  refreshes and repeated provider prompts across processes.
- A destination `api_key_command` is the last step in the standard auto chain,
  or the only step when `credential_source: api_key_command` is pinned. Its
  configured `ttl` controls reuse and defaults to five minutes. Results from
  recognized credential tools can be shared through
  `~/.trajectory/.credential-command-cache/`; other explicitly allowed
  commands remain process-local.

Destination commands are executed directly, not through a shell, with a
30-second timeout. A bounded allowlist covers recognized credential helpers.
Setting `TRAJECTORY_ALLOW_API_KEY_COMMAND=1` permits a non-allowlisted command
and should be limited to a trusted environment and trusted configuration.

Shared cache files and directories are user-only (`0600` files under `0700`
directories). Cached key material is XOR-obfuscated with a machine/user-derived
mask so the raw key does not appear to pattern-matching scanners. This is
obfuscation, not encryption; file permissions, short validity, and host access
control are the security boundary. Application keys resolved by the shared app
key resolver are not written to these command caches.

## Managed keychain mode

Managed deployments can set:

```yaml
auth:
  mode: managed_keychain

required_destinations:
  - name: primary
    type: datadog_agentless
    api_key_ref: managed-primary-api-key
    app_key_ref: managed-primary-app-key
```

Managed keychain mode is intentionally not an extension of the standard
fallback chain. It:

- requires an explicit `api_key_ref` for each direct Datadog managed
  destination;
- reads the exact keychain account name under service `trajectory` without
  hyphen/underscore aliasing;
- ignores API and application key environment variables;
- skips the default key provider and destination `api_key_command`;
- coalesces concurrent reads, caches successful values in memory, and caches
  failures briefly to avoid repeatedly prompting or hammering the keychain.

Provision exact managed account names with the fleet's keychain tooling or,
for a manual recovery, with:

```bash
trajectory config set-secret managed-primary-api-key --exact-name
trajectory config set-secret managed-primary-app-key --exact-name
```

`--exact-name` is for managed provisioning. Standard `set-secret` deliberately
normalizes hyphens to underscores.

## Application key resolution

The shared publish/CLI application key path is smaller than the API-key path.
It first selects a reference, then reads that secret:

1. An explicit command flag such as `--readback-app-key-ref`.
2. The selected destination's `app_key_ref`.
3. The default `dd_app_key` ref.

In standard mode, the default ref checks these environment aliases in order:
`DD_APP_KEY`, `DD_APPLICATION_KEY`, `DATADOG_APP_KEY`, and
`DATADOG_APPLICATION_KEY`, then the normalized OS keychain account. A custom
application-key ref is keychain-backed; it does not derive a custom environment
variable. Use the default ref for environment-driven automation, or store a
custom ref in the keychain.

In managed keychain mode, the selected ref is always an exact keychain account
and no environment alias is read.

Application-key consumers state the permission they need:

| Consumer | Application-key permission |
| --- | --- |
| `trajectory metrics verify --readback`, metrics audit, and backfill readback | Metrics query (`timeseries_query`) |
| `trajectory publish sync` | Log configuration write |
| Optional `agent-security` AI Guard evaluator | AI Guard API access defined by the service's application-key policy |

Without an application key, routine capture and publish still work.
`trajectory metrics verify` normally falls back to submit-only evidence; an
explicit `--readback` makes missing readback credentials a hard failure.
`trajectory publish validate` validates destination API keys but does not prove
application-key permissions.

The default-disabled AI Guard evaluator is a separate module request path. Its
`auth_headers` configuration maps `DD-API-KEY` and `DD-APPLICATION-KEY` to
environment variable names, defaulting to `DD_API_KEY` and `DD_APP_KEY`. The
module reads those variables directly when building an evaluation request; it
does not use destination `api_key_ref` / `app_key_ref` or the shared publish
credential caches. Rotating those module credentials therefore requires the
same process-environment refresh as any other environment-backed key.

## Long-running processes and rotation

Environment variables are copied into a process when it starts. Exporting or
changing `DD_API_KEY` in a shell does not update an already-running
`trajectory serve`. The background server also disables unbounded generic
keychain reads so macOS cannot block it on an authorization dialog. The default
`dd_api_key` remains available through a bounded key-provider fallback;
non-default background credentials should use a managed exact ref, an external
provider, or an environment supplied when the process starts.

Use this rotation sequence:

1. Create or obtain the replacement credential in the secret authority.
2. Update the environment, provider, or keychain entry without changing the
   configured ref when possible.
3. Reload configuration and restart long-running Trajectory processes through
   the supported process lifecycle when their source is process-bound or
   memory-cached.
4. Run `trajectory publish validate` for API keys. For application keys, run
   the exact readback or sync command that exercises the required permission.
5. Revoke the old credential after the new path is healthy.

Command-backed API keys naturally refresh at their TTL. Environment-backed and
keychain-backed credentials can remain in a long-running process, so process
refresh is part of their rotation procedure. Managed exact-ref successes are
also cached in memory.

## Diagnostics and safe troubleshooting

Use the narrowest command that proves the required path:

```bash
trajectory config secrets
trajectory doctor
trajectory publish status
trajectory publish validate
trajectory metrics verify --destination <name> --readback
trajectory publish sync
```

- `config secrets` confirms known keychain presence without resolving or
  printing values.
- `doctor` reports the effective credential policy and live serve credential
  health.
- `publish status` shows effective destinations and publish modes.
- `publish validate` resolves each destination API key, reports non-secret
  source/shape metadata, and validates real Datadog keys against that site.
- `metrics verify --readback` proves API-key submission plus application-key
  Metrics query access.
- `publish sync` proves the application key has log configuration write access.

Do not print a key to debug it. Check the named keychain account, source policy,
destination ref, site, and non-secret shape diagnostics. If a real value was
printed, committed, attached to a support bundle, or pasted into a ticket,
rotate it rather than trying to redact every copy.
