# Send Data to an OpenTelemetry Collector

Trajectory can send traces, metrics, and logs to any OpenTelemetry collector
that accepts OTLP over HTTP. This works alongside Datadog or on its own. To send
to Datadog, see `trajectory user-guide config`.

## Add a collector

1. Add the collector to `~/.trajectory/config.yaml`:

   ```yaml
   destinations:
     - name: my-collector
       type: otlp
       endpoint: http://localhost:4318
       level: minimal
       trace_shape: conventions
   ```

   Set `endpoint` without a signal path. Trajectory adds `/v1/traces`,
   `/v1/metrics`, and `/v1/logs`.

2. Apply the change to running processes:

   ```bash
   trajectory config reload --yes
   ```

3. Check what each destination receives:

   ```bash
   trajectory publish status
   ```

   The `Output plan` section names the collector, where the setting came from,
   and what it receives. Warnings below it list anything in your config that
   does nothing, such as a misspelled key or a skipped destination.

4. Run a normal task in a coding agent. The collector receives the turn's
   metrics and traces.

## Choose what it receives

| Setting | Values | Meaning |
|---|---|---|
| `name` | Any name not starting with `_` | Identifies the destination in status output |
| `type` | `otlp` | The only type this list takes |
| `endpoint` | An `http` or `https` URL | The collector's base URL. It cannot contain a password or a query string. |
| `level` | `off`, `minimal`, `standard`, `full` | How much trace detail it receives. The default is `minimal`. `off` sends no traces. |
| `trace_shape` | `conventions`, `datadog` | `conventions` follows the OpenTelemetry GenAI semantic conventions. Use it for a generic collector. |
| `compression` | `zstd`, `gzip`, `none` | Takes effect only while the `otlp_zstd_compression` feature is on |
| `bearer_token_ref` | A secret name | See [Authenticate to the collector](#authenticate-to-the-collector) |
| `markers` | `enabled`, `metrics`, `logs` | Sends marker metrics and marker event logs. See `trajectory user-guide markers`. |
| `ml_app`, `service`, `tags` | Text | Labels on what it sends |

Without `trace_shape`, a collector receives the `datadog` shape unless the
`otlp_conventions_trace_shape` feature is on.

`level` sets trace detail only. It does not turn metrics on or off. A collector
without `markers` receives session starts and the cost, token, and turn metrics
while `export.metrics` is on, which is the default. Set `markers.enabled: false`
to stop the cost, token, and turn metrics.

## Authenticate to the collector

A collector that requires a token takes it as `Authorization: Bearer <token>`.
Trajectory reads the token from your keychain, never from `config.yaml`.

1. Store the token. The command asks for the value without showing it:

   ```bash
   trajectory config set-secret otel-token --exact-name
   ```

2. Name the secret on the destination:

   ```yaml
   destinations:
     - name: my-collector
       type: otlp
       endpoint: https://otel.security.example.com
       bearer_token_ref: otel-token
   ```

3. Check the token:

   ```bash
   trajectory publish validate
   ```

   If you have not set a Datadog API key, this notes that the setup does not
   need one and still passes.

With a token, the endpoint must use HTTPS. Plain HTTP is allowed only on
loopback addresses. Trajectory does not follow redirects on these requests.

To refuse tokens on a machine or across an org, disable the
`bearer_destination_auth` feature. This also stops a token on this list from
being sent.

## If you also add Datadog later

Without a Datadog API key, a setup that names a collector sends only to that
collector. Trajectory does not hold data back for Datadog in case you add a key
later, and it removes queued metrics from before this behavior began.

Trajectory knows that no key is set when your keychain answers that it holds
none, or when the machine has no keychain at all. A Linux container has no
keychain when it has no D-Bus session bus and runs neither systemd nor a
system bus. Trajectory leaves the Datadog destination out there.

A keychain that exists but cannot be read says nothing about the key. Examples
are a locked keychain, and a Linux server or desktop whose session bus or
secret service is not running yet. Trajectory keeps the Datadog destination on
such a machine. `trajectory publish validate` then reports that the Datadog key
is unavailable, and each session end logs it. The collector still receives
every turn and every session end. To remove the Datadog destination there, set
`export.site: ""` in `config.yaml`.

When you save a key, new activity goes to Datadog as well. Earlier sessions do
not go on their own. To preview sending them, and then send them, run:

```bash
trajectory publish history
trajectory publish history --yes
```

This covers up to the last 30 days. The daily backfill check does not cover it,
because that check sends only to managed destinations.

## Try a collector for one process

To try a collector without editing a file, set an environment variable:

```bash
TRAJECTORY_OTLP_ENDPOINT=http://localhost:4318 trajectory publish status
```

The variable applies only to processes that have it, so `trajectory serve` must
start with it set. It takes no token. Status output shows it as `_env_otlp`.

## What you cannot change here

- **Managed destinations.** Your organization's `required_destinations` keep
  applying. An entry with the same name as a managed destination sends nothing.
- **Incognito.** A collector in this list follows incognito and publish opt-out
  like any other destination that is not exempt.
- **Managed-only outputs.** The event stream, Agent Security, module spans, and
  AI Usage events cannot be turned on from this list.
- **History.** `trajectory publish history` does not send to these collectors.
  They receive sessions from the time you add them.

A repository's `publish.trajectory.yaml` can lower a collector's trace level. It
cannot change the collector's endpoint or add a collector of its own. To lower
the level, the file names the collector and sets `level`.

To change what a repository sends, see `trajectory user-guide publish`.
