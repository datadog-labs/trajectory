# API and Application Key Management

This page explains how Trajectory stores, finds, and uses the Datadog API key
and application key. Use it to set up keys, rotate them, or debug a key
problem.

Trajectory keeps Datadog key values out of configuration and session data.
The configuration names each key with a reference. At runtime, Trajectory
looks up the value for that reference. It reads the value from an environment
variable, an external provider, or the OS keychain. It keeps the value only
while the running process or its short-lived key cache needs it.

Provider keys such as `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and
`GEMINI_API_KEY` are separate. Trajectory does not use them to publish to
Datadog.

## Key responsibilities

| Key | What Trajectory uses it for | When it is required |
| --- | --- | --- |
| Datadog API key | LLM Observability, metrics, logs, and AI Usage intake. Datadog API key validation. Optional AI Guard evaluation. | Direct `datadog_agentless` publishing, agentless Datadog OTLP forwarding, and the AI Guard evaluator when it is on. |
| Datadog application key | Datadog Metrics queries that read metrics back, log-based metric configuration, and optional AI Guard evaluation. | Commands that read metrics back, `trajectory publish sync`, and the AI Guard evaluator when it is on. Routine capture and publishing do not need it. |
| No key managed by Trajectory | Traffic that another component sends out. | `datadog_agent` destinations and generic `otlp` collectors. |

An application key always needs an API key too. Commands that call a Datadog
configuration or query API usually use both keys. The API key identifies the
organization. The application key authorizes the operation.

## Security rules

- YAML holds `api_key_ref`, `app_key_ref`, and command settings. It never
  holds a key value.
- By default, Trajectory saves keys in the current user's OS keychain under
  the service `trajectory`.
- Session JSONL, local-ui data, publish ledgers, and publish outboxes never
  store API or application keys.
- Runtime logs and validation output can show the policy, the source, the
  wrapper format, the length, and whether the format is valid. They never show
  the value.
- A missing key does not stop local capture. Remote publishing stops and
  records a key error. Publish work that can be retried stays in its normal
  queue on disk.
- Trajectory sends publish keys only to the destination that the trusted
  configuration selects. Datadog requests send the keys over HTTPS in the
  `DD-API-KEY` and `dd-api-key` headers. They add the `DD-APPLICATION-KEY`
  header only where the request needs it.

## End-to-end flow

```text
setup / config / managed provisioning
       |
       +--> config.yaml or config.defaults.yaml: refs and source policy only
       |
       +--> environment, credential provider, or OS keychain: secret value
                              |
                              v
      credentials.PlanCredentials (managed settings win)
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

`trajectory setup` asks for a Datadog API key and hides what you type. It
checks the key against the selected Datadog site. Then it saves the key as
`dd_api_key` in the OS keychain. Setup does not ask for an application key,
because normal publishing does not need one. Setup runs `auth.key_command`
only if `config.yaml` or managed defaults set one. It never writes
`auth.key_command`.

## Add a Datadog API key

If `trajectory doctor` reports that it found no Datadog API key, add one in
one of these ways:

1. Save it in the OS keychain: `trajectory config set-secret dd_api_key`.
2. Set `auth.key_command` to a command that prints the key. The command can
   print the key alone on one line, or as a `DD_API_KEY=<key>` line.
3. Set `DD_API_KEY` in the environment of every app that starts Trajectory.

If you use `DD_API_KEY`, note how the background service finds its key. The
service reads the key from its own process environment. A service that is
already running keeps the environment it started with. So a key that you
export in one shell often does not reach it.

Trajectory has no built-in key command. A key command runs only when the user
config or managed defaults set `auth.key_command`.

Before setup replaces a keychain value, it saves a copy. If the write fails,
setup tries to restore that copy. On macOS, when you create or rotate a key,
macOS can also ask you to let Trajectory read the saved item. Before setup
reports success, it reads the value back with the same reader that publishing
uses, which never prompts. It checks that the value matches. If you deny
access, or the check fails, setup returns an error. A successful write alone
is not enough.

You can also save keys directly:

```bash
trajectory config set-secret dd_api_key
trajectory config set-secret dd_app_key --stdin
trajectory config set-secret dd-payments-api-key
trajectory config secrets
```

Interactive `set-secret` hides what you type. For automation, use `--stdin` to
send the key through a protected pipe. Do not use `--value=...` for real keys,
because the value becomes a command-line argument.

`config secrets` reports each known account as set, not set, unknown, or not
checked:

- A failed lookup shows as unknown, and the command exits with status 1.
- A disabled lookup shows as not checked.

After a temporary failure, run the command again. If access is still denied,
save the affected key again. The command never prints values or raw lookup
errors. It does not list custom entries that it does not know. To check custom
entries, pass their names, as
[Check managed refs from a script](#check-managed-refs-from-a-script)
describes.

`config secrets` is also the only command that unlocks a locked macOS keychain
for Trajectory. Its lookups never show a prompt. A lookup can find a locked
keychain while both standard input and standard error are terminals. Then the
command does these steps:

1. It runs `/usr/bin/security unlock-keychain` once on that keychain.
   `security` reads the password from the terminal, so Trajectory never sees
   it.
2. It repeats the lookups, again without a prompt.

The keychain then follows its own lock settings. While it stays unlocked,
later background reads work without prompts, if the item already trusts the
reader. Unlocking does not change the item's access controls. If the input is
piped, or you cancel, the command reports `unknown (OS keychain locked)` and
exits with status 1.

## Configuration stores references, not values

A standard configuration with several destinations can name a separate key
for each one:

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

`api_key_ref` selects the API key for all direct Datadog signals on that
destination. Only a command that reads data back from Datadog, or changes
Datadog configuration, uses `app_key_ref`. Even with `app_key_ref` set, the
normal publish engine does not look up or send an application key.

The `bearer_destination_auth` feature is off by default. When it is on, custom
intake and forwarder destinations can use `bearer_token_ref` in place of
`api_key_ref`. A destination can set only one of the two fields. Bearer
references follow the configured source policy. But they read only the named
environment variable, keychain account, or destination command. They never
fall back to `DD_API_KEY`, `DATADOG_API_KEY`, or the default Datadog key
provider. Trajectory sends the token as `Authorization: Bearer <token>`. It
sends it only on the direct and OTLP publish requests that you configure.

Bearer destinations follow these rules:

- Bearer endpoints must use HTTPS. Trajectory accepts loopback HTTP only for
  local development and tests. It does not follow redirects on authenticated
  requests.
- Managed direct Datadog entries use the `type: datadog_bearer` format. This
  format is safe to roll back. It sets `level: off` and puts the active level
  in `bearer_level`. Managed bearer destinations use only this format.
- Project publish files use `version: 2` for bearer destinations. Project
  schema version 2 also supports `otlp` collectors with bearer authentication.
- Bearer configuration must set the URLs for intake, OTLP traces, the active
  metrics transport, and logs. If evaluations or AI Usage are on, they also
  need their own endpoints.

Trajectory creates the `_config_datadog` destination from the `export.*`
settings. Its API key ref defaults to `dd-api-key`. In standard mode,
`dd-api-key` and `dd_api_key` name the same keychain account. So setup can
save `dd_api_key` while the publish layer reads `dd-api-key`.

## API key resolution

For a direct Datadog destination, `auth.credential_source: auto` checks these
sources in order:

| Order | Source | Behavior |
| --- | --- | --- |
| 1 | Environment | The `api_key_ref` in uppercase with hyphens changed to underscores. Then `DD_API_KEY`, then `DATADOG_API_KEY`. |
| 2 | Default key provider | The configured `auth.key_command`. Only the default `dd-api-key` or `dd_api_key` ref uses it. Nothing runs when it is not set. |
| 3 | OS keychain | Service `trajectory`, account `api_key_ref` with hyphens changed to underscores. |
| 4 | Destination command | The destination's `api_key_command`, if set. |

For example, `api_key_ref: dd-payments-api-key` checks these sources in order:

1. `DD_PAYMENTS_API_KEY`
2. the two global API key variables, `DD_API_KEY` and `DATADOG_API_KEY`
3. the keychain account `dd_payments_api_key`
4. its destination command

It skips the default key provider, because it is not the default ref.

To use only one source, set `auth.credential_source` to `env`,
`key_provider`, `keychain`, or `api_key_command`. If that source fails, the
lookup stops. It does not try the other sources.

Managed defaults (`config.defaults.yaml`) take priority over `config.yaml`,
field by field:

- `auth.mode: managed_keychain` in either file turns on managed keychain mode.
- A managed `auth.credential_source` or `auth.key_command` replaces the user's
  value.
- If the managed file leaves a field unset, the user's value stays.

Every command and `trajectory serve` follow the same rule. Org sync cannot set
`auth.key_command`, because remote defaults reject settings that hold a
command.

A managed `export.site` also replaces the user's site. The key and the site
then come from the same file. So Trajectory never sends a managed key to a
site that the user chose. Such a site could belong to another organization or
region, or reject the key. A user's site applies only when managed config sets
none. `trajectory serve` still applies `DD_SITE` from its environment over
both.

Before Trajectory uses a value, it removes common wrappers that key providers
add. Examples are quoted values, `DD_API_KEY=...`, supported JSON objects, and
`go-keyring-base64:` keychain values. For a real Datadog endpoint, the final
API key must be 32 letters and digits. In `auto` mode, Trajectory reports a
malformed environment value. A real Datadog destination can then go on to the
later sources. With the source set to `env`, Trajectory rejects the value and
does not try other sources.

`datadog_agent` and generic `otlp` destinations skip these steps, because the
Agent or collector handles authentication. Agentless Datadog OTLP is still a
direct Datadog path. It sends the API key in a `dd-api-key` header.

## Credential-provider commands and caches

Trajectory can get an API key from a command in two ways: the default key
provider and a destination command.

**Default key provider (`auth.key_command`).** This provider serves the whole
process. It supports short-lived keys and refreshes them when needed.
Trajectory uses it only for the default API key ref. If `auth.key_command` is
not set, no command runs. The provider then reads `DD_API_KEY`, then
`DATADOG_API_KEY`, then the `dd_api_key` keychain item, with a time limit. The
command must print the key in one of these forms: `env` output with a
`DD_API_KEY=` line, a JSON object, or a single line.

Trajectory shares the results through `~/.trajectory/.credential-command-cache/`.
A result is valid for 40 minutes. One process runs the command. Other
processes wait on its lock for up to 90 seconds, then read its result. If the
command fails, Trajectory retries it once. Background callers then wait about
2 minutes after the first failure and 4 minutes after the second. After three
failures in a row, they wait 8 hours between attempts. Commands that a person
runs, such as `trajectory publish validate`, can retry sooner.

Earlier releases cached the key in `~/.trajectory/.auth-cache` and counted
failures in `.auth-sentinel`. Trajectory still reads those files when
`auth.key_command` is the command that earlier releases ran. It stops when the
new cache entry exists. It never writes them.

The command can be interactive. For example, it can open a browser sign-in
when it has no cached key. If `TRAJECTORY_DISABLE_KEY_COMMAND=1` is set,
Trajectory runs neither `auth.key_command` nor a destination
`api_key_command`. It goes on to the next source.

**Destination command (`api_key_command`).** This command is the last source
in the standard `auto` order. If you set `credential_source: api_key_command`,
it is the only source. Its `ttl` setting controls how long Trajectory reuses a
result. The default is five minutes. Results from known key tools are shared
through the same cache directory. Results from other allowed commands stay
inside the process. After a failure, other processes wait 2 minutes before
they try again. The wait doubles after each failure, up to 8 hours.

Both kinds of command run directly, without a shell or quoting. Trajectory
splits the command line on white space. It stops the command's process group
after 30 seconds. Both kinds use one built-in list of allowed commands. The
list includes macOS `security`, `pass`, `op`, `vault`, `aws secretsmanager`,
and `gcloud secrets`. `TRAJECTORY_ALLOW_API_KEY_COMMAND=1` allows a command
that is not on the list. Set it only in a trusted environment with a trusted
configuration.

The shared lock is an advisory file lock. The kernel releases it when its
holder exits, so a held lock is never stale. Trajectory never deletes a lock
file to break it. Earlier releases deleted a held lock file older than 90
seconds. That could let two processes run the key command at once.

Only the user can read the shared cache files and directories: `0600` files
in `0700` directories. Trajectory XORs cached keys with a mask built from the
machine and the user. So tools that scan for key patterns do not find the raw
key. The mask only hides the key. It does not encrypt it. The file
permissions, the short validity, and access control on the host protect it.
The shared application key reader does not write application keys to these
command caches.

## Managed keychain mode

In managed keychain mode, your fleet tools save keychain accounts with fixed
names. Trajectory reads only those accounts. Managed deployments can set:

```yaml
auth:
  mode: managed_keychain

required_destinations:
  - name: primary
    type: datadog_agentless
    api_key_ref: managed-primary-api-key
    app_key_ref: managed-primary-app-key
```

Managed keychain mode does not use the standard source order. In this mode,
Trajectory does these things:

- It requires an `api_key_ref` on each direct Datadog managed destination.
- It reads the keychain account under service `trajectory` with exactly that
  name. It does not treat hyphens and underscores as the same.
- It ignores API key and application key environment variables.
- It skips the default key provider and the destination `api_key_command`.
- It joins reads that happen at the same time into one read.
- It caches values it reads in memory. It also caches failures for a short
  time, so it does not read the keychain too often.

Use your fleet's keychain tools to save the managed accounts with their exact
names. To recover by hand, run:

```bash
trajectory config set-secret managed-primary-api-key --exact-name
trajectory config set-secret managed-primary-app-key --exact-name
```

`--exact-name` is for managed provisioning. Standard `set-secret` changes
hyphens to underscores on purpose.

### Check managed refs from a script

To check whether this Trajectory binary can read named keychain entries
without a prompt, run `config secrets` with their names. Run it as the
signed-in user:

```bash
trajectory config secrets managed-primary-api-key managed-primary-app-key
```

The command reads each name as you typed it. It uses the same reader as
managed setup and publishing. It does not change hyphens to underscores, and
it does not read environment variables. It never shows a keychain prompt,
never unlocks a keychain, and never prints a value. It also never changes the
installation. It skips the startup step that restores a failed update. So it
always checks the binary that you ran.

Named checks run on macOS and Windows. On Linux, the keychain reader unlocks
the Secret Service collection before it reads, which can show a prompt. So on
Linux the command reads nothing and reports `not_checked`.

For each name, the command prints one `<ref>: <state>` line on standard
output. Add `--json` to print one JSON object instead:

```json
{
  "schema_version": 1,
  "refs": [
    {"ref": "managed-primary-api-key", "state": "readable"},
    {"ref": "managed-primary-app-key", "state": "needs_authorization"}
  ]
}
```

| State | Meaning |
| --- | --- |
| `readable` | Trajectory read a value without a prompt. |
| `missing` | No entry exists under the name, or the entry is empty. |
| `needs_authorization` | The entry exists, but this binary cannot read it without a macOS prompt. Another app or an earlier Trajectory build created or last changed it. |
| `keychain_locked` | A keychain that the read must search is locked. |
| `keychain_missing` | The user has no usable default keychain. |
| `keychain_search_list_missing` | The user's default keychain is not in their keychain search list. |
| `unknown` | The read failed for another reason, such as a timeout. The entry might still exist. |
| `not_checked` | The command read nothing, because `TRAJECTORY_DISABLE_KEYCHAIN=1` is set or the platform's reader can show a prompt. |

For `unknown` and `not_checked`, the JSON output adds a `detail` field that
says why.

The exit status covers only the names you pass. It is 0 when every name is
`readable`, 1 when any name is not, and 2 for a usage error. For each name
that is not readable, the command writes the fix to standard error.

Use this check in a script that recreates keychain entries for a new
Trajectory build. The script can then recreate an entry only when the build
cannot read it. Releases without this check ignore the names and list the
well-known secrets instead. So match the `<ref>: readable` line, or parse the
`--json` output. Do not rely on the exit status alone.

### Write deadlines and retries

When you create or rotate a key, three steps share one 30-second deadline:

1. Save a copy of the previous value.
2. Replace the value.
3. Roll back, if needed.

If the system refuses the copy for a temporary reason, Trajectory tries the
read at most three times. Replacing the value, restoring it, and removing a
new key share three write attempts. When all three are used, rollback reports
a failure and starts no other operation.

The Jamf wrapper uses this budget once. It keeps the error output, with
secrets removed, for provisioning diagnostics. When rollback deletes a new
account, each delete call also has a three-second limit inside that deadline.

On Linux and Windows, a native write that timed out might still be running.
It holds its slot until it completes. So no other write or rollback delete in
the process can run at the same time. If an operation started, Trajectory
reports its outcome as unconfirmed. Only a refusal before the operation starts
shows that the previous value did not change.

### Validating managed refs from an agent sandbox

Inside a coding-agent sandbox, `publish validate`, `doctor`, or a live publish
can fail even though the managed key is present. To check the key:

1. Run `trajectory doctor` outside the sandbox, through the path your
   organization approves.
2. In the output, find the eligible user keychains.
3. In each eligible keychain, check the configured account name.

Always pass the keychain path. Without it, the lookup can find a system or
common-domain item that Trajectory does not use.

```bash
keychain_file='<eligible-user-keychain-path-from-doctor>'
account='<api_key_ref>'
security find-generic-password -s trajectory -a "$account" "$keychain_file"
set -o pipefail
security find-generic-password -w -s trajectory -a "$account" "$keychain_file" | wc -c
```

The last command shows only the byte count.

If the sandbox cannot reach the keychain, run the same Trajectory check
outside the sandbox. Do this before you change config or key lookup code. In
`managed_keychain` mode, Trajectory ignores environment variables on purpose.
The configured ref must exist with its exact name.

### macOS keychain reads

On macOS, Trajectory reads keys without showing keychain dialogs:

- It searches only the user keychains in your keychain search list, in order.
  It never reads the System keychain or other system and common-domain
  keychains, even if you add them to the user search list.
- If it reaches a locked keychain before it finds the account, the read stops
  with a locked error. It does not check later keychains, because one of them
  could hold a different value. Run `trajectory config secrets` to unlock the
  keychain.
- New items go to your default user keychain. If no eligible user keychains
  remain in the search list, Trajectory uses the default keychain. If other
  eligible user keychains are listed but the default is not, creation fails
  before it changes anything. Add the default keychain to the user search list
  in Keychain Access, then try again.
- After a failed or unclear delete, Trajectory keeps its record that it owns
  the item, because it cannot confirm that the item is gone. Check the
  keychain to see whether the item is still there.
- A read that needs authorization, hits a locked keychain, finds no item,
  finds a malformed value, or times out returns no key. Managed mode does not
  try another source.
- Keys never appear in process arguments, the inherited environment, or logs.

`config secrets` names a locked keychain. It tells apart these failures: a
request for authorization, a reader that is not available, a timeout, and an
OS error. `setup` and `config set-secret` include the locked keychain path in
write errors. `doctor` lists the keychains in the search list. For each one,
it shows whether it is unlocked, readable, writable, and eligible, and whether
each account is present. It reads only item metadata, never secret values.

Background reads never prompt, add readers to an item's access list, or repair
a keychain. When you create or rotate a key with Trajectory, the item trusts
the current Trajectory binary. It also keeps `/usr/bin/security` and the other
readers it already trusted. If Trajectory can already read an item, only the
value changes. An item that trusted only `/usr/bin/security` must be saved
again. Only a signed release can add Trajectory as a new trusted reader. A
locally built, ad-hoc-signed binary refuses the change with an error that
explains what to do.

After a write, Trajectory reads the item back without a prompt. If that read
needs approval, the provisioning command can ask macOS to approve access to
that one item. The approval request lasts at most 20 seconds, inside the
30-second write deadline. Trajectory never unlocks a keychain or approves
another item. A final read without a prompt must return the saved value. So a
one-time approval cannot report a false success.

The Trajectory binary can be replaced while a process is running. The running
process then keeps reading keys with a matching copy of its own binary. If no
matching copy exists, reads fail with an error that can be retried. This error
is different from a missing key. In standard mode, keys from the environment
still take priority.

## Application key resolution

Trajectory uses fewer steps to find an application key than an API key.
First it picks a reference. These choices are in priority order:

1. A command flag such as `--readback-app-key-ref`.
2. The `app_key_ref` of the selected destination.
3. The default `dd_app_key` ref.

Then it reads that secret. In standard mode, the default ref checks these
environment variables in order: `DD_APP_KEY`, `DD_APPLICATION_KEY`,
`DATADOG_APP_KEY`, and `DATADOG_APPLICATION_KEY`. Then it checks the OS
keychain account, with hyphens changed to underscores. A custom application
key ref reads only from the keychain. Trajectory does not build an environment
variable name from it. For automation that uses environment variables, use the
default ref. Otherwise, save the custom ref in the keychain.

In managed keychain mode, the selected ref is always a keychain account with
that exact name. Trajectory reads no environment variable.

Each use of an application key needs a specific permission:

| Command or feature | Application key permission |
| --- | --- |
| `trajectory doctor metrics canary --publish --readback`, metrics audit, and backfill readback | Metrics query (`timeseries_query`) |
| `trajectory publish sync` | Log configuration write |
| Optional `agent-security` AI Guard evaluator | AI Guard API access, as the service's application key policy defines it |

Without an application key, routine capture and publishing still work.
`trajectory doctor metrics canary --publish` then only sends the metrics. It
does not read them back. If you pass `--readback` and the keys for reading back
are missing, the command fails. `trajectory publish validate` checks
destination API keys. It does not check application key permissions.

The AI Guard evaluator is off by default. It sends its own requests. Its
`auth_headers` setting maps `DD-API-KEY` and `DD-APPLICATION-KEY` to
references. The defaults are `dd_api_key` and `dd_app_key`. For each
evaluation, the evaluator first checks the matching environment variables of
the process. If they are not set, it uses the secret reader that Trajectory
passes to it. In managed keychain mode, that reader reads the keychain account
with that exact name. The evaluator does not use destination `api_key_ref` or
`app_key_ref`, or the shared publish key caches.

That secret reader is the one the next section describes. The evaluator looks
up both keys on every evaluation. But the reader reads each reference from the
keychain at most once in each hook process. To rotate an evaluator key that
comes from the environment, you must still update the process environment.

## Credential reads inside a process

Hooks, modules, and other short-lived processes look up each secret reference
through one shared reader. The reader works like this:

- It reads each secret reference from its source at most once in each process.
  It keeps the value in memory.
- It joins lookups for the same reference that happen at the same time into
  one read.
- It keeps only successful reads. So it retries a temporary failure next time.
- It never logs secret values.

So the OS keychain shows at most one authorization dialog for each reference
in each process. This matters most for Agent Security. AI Guard looks up both
`DD-API-KEY` and `DD-APPLICATION-KEY` on every evaluation. Each coding-agent
hook event also runs in its own process. An ad-hoc-signed binary cannot keep
an "Always Allow" grant. Without this cache, each read would show a new prompt.

Processes that read managed keychain secrets by exact name also read each
reference once and keep it in memory. This includes the long-running `serve`
process. A configuration reload clears that cache, so a reload that rotates a
reference takes effect. `serve` turns off the other keychain reads at startup,
so it never prompts for them. The default key provider keeps its key in memory
and in a shared file cache.

Secrets stay in memory only for the life of the process that reads them.

## Long-running processes and rotation

A process gets a copy of the environment variables when it starts. So
exporting or changing `DD_API_KEY` in a shell does not update a running
`trajectory serve`. The background server also turns off general keychain
reads that have no time limit. So a macOS authorization dialog cannot block
it. The default `dd_api_key` is still available through the key provider,
which reads with a time limit. Other background keys should use a managed
exact-name ref, an external provider, or an environment set when the process
starts.

To rotate a key, do these steps:

1. Create or get the new key from the system that issues your secrets.
2. Update the environment, provider, or keychain entry. If you can, keep the
   configured ref the same.
3. If the key source is tied to the process or cached in memory, reload the
   configuration. Then restart long-running Trajectory processes in the
   supported way.
4. For an API key, run `trajectory publish validate`. For an application key,
   run the command that needs its permission: the metrics read-back command or
   `trajectory publish sync`.
5. After the new key works, revoke the old one.

API keys from a command refresh when their TTL ends. Keys from the
environment or the keychain can stay in a long-running process. So rotating
them includes a process restart or reload. Trajectory also caches managed
exact-name keys in memory after a successful read.

### Failure-driven refresh (managed serve paths)

After a successful read, Trajectory caches a managed exact-name key with no
TTL. A TTL would make Trajectory read the OS keychain again on a fixed
schedule. With an ad-hoc-signed binary, each of those reads would show a
prompt, even while the cached key is still valid. So Trajectory refreshes the
cache only when a request shows that the key is no longer valid:

1. A command or feature looks up the managed application key and uses it in a
   Datadog request.
2. The endpoint can return its definite authentication rejection. Then only
   that one cached reference is cleared. Trajectory reads it again through the
   shared cache, with one keychain read, and retries the request once.
3. If the retry also fails, Trajectory returns the error. It does not retry a
   second time. So a key that stays invalid cannot cause a loop of keychain
   reads.

Only the endpoint's documented authentication or authorization failure counts
as a rejection. A general error does not count. For the application key
endpoints, the rejection is **403 Forbidden**. The endpoints are:

- `/api/v2/logs/config/metrics` for log-based metric sync
- `/api/v2/query/scalar` for reading metrics back

The application key code already treats this status as a missing permission.
Trajectory does **not** treat `401`, `429`, `5xx`, network errors, or timeouts
as signs of an old key. An outage must never cause a keychain read. So it must
never cause a new 1Password prompt either.

Several requests can reject the same reference at the same time. Trajectory
then refreshes it only once. Before it drops a cached entry, Trajectory checks
that the entry still holds the rejected value. So if another request already
rotated the reference, the new value stays. The reader also joins the reads
that happen at the same time into one keychain read.

Trajectory refreshes only managed exact-name keys this way. Standard-mode keys
come from environment variables, or from the keychain behind the disable
switch. Trajectory already reads them again on each call. So it does not clear
or retry them. The Agent Security custody key is a local AES key. It does no
network authentication, so no authentication failure can show that it is old.
Only the reset on reload, described next, refreshes it.

A config reload applies the key policy again. It clears **both** the managed
exact-name cache and the managed API key cache. So Trajectory picks up a
reload that rotates a managed reference without waiting for a request to fail.

Log-based metric sync uses failure-driven refresh. Metric submission and
metric read-back do not yet. They keep one key until a configuration reload
clears it.

## Diagnostics and safe troubleshooting

Use the smallest command that checks the path you need:

```bash
trajectory config secrets
trajectory doctor
trajectory publish status
trajectory publish validate
trajectory doctor metrics canary --destination <name> --publish --readback
trajectory publish sync
```

- `config secrets` reports which known keychain accounts are present. It shows
  a failed or disabled lookup differently from a missing key. It does not
  print values or raw errors. `config secrets <ref>...` checks only the named
  accounts, exactly as typed, without a prompt.
- `doctor` reports one Datadog credentials check. It uses the keys each
  running service found. It falls back to this shell only when no service is
  running. Its fix names each secret to save.
- `publish status` shows the active destinations and publish modes.
- `publish validate` looks up each destination API key. It reports the key's
  source and format, without the secret. It checks real Datadog keys against
  the destination site. It also reports the keys each running service found.
  It fails if a service has none. The service reads keys from its own
  environment, so a key exported only in your shell does not reach it.
- `doctor metrics canary --publish --readback` checks that the API key can
  send metrics and that the application key can query Metrics.
- `publish sync` checks that the application key can write log configuration.

Do not print a key to debug it. Check the keychain account name, the source
policy, the destination ref, the site, and the format diagnostics. None of
these contain the secret. If a real value was printed, committed, attached to
a support bundle, or pasted into a ticket, rotate the key. Do not try to
remove every copy.
