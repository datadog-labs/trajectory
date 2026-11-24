# Configuration Guide

This page explains where Trajectory keeps its settings, how to change them,
and what each setting does. The [field reference](#field-reference) lists
every setting with its default. For publish destinations, run
`trajectory user-guide publish`.

If your shell cannot find `trajectory`, read the install guide through the
binary's full path:

```bash
"$HOME/.trajectory/bin/trajectory" user-guide --format md install
```

## Where Settings Live and Which Wins

Your settings live in `~/.trajectory/config.yaml`. `trajectory config path`
prints its location. An administrator can supply managed settings in
`~/.trajectory/config.defaults.yaml`, usually through MDM. The editor and
`trajectory config set` never change that file.

Trajectory merges settings in this order. For most keys, a later layer wins.

1. Built-in defaults.
2. Managed `config.defaults.yaml`.
3. An assigned `cohort.yaml` overlay, if one exists. It can set
   `deployment.ring`, and `trajectory flare` adds it to the support ZIP.
4. Your `config.yaml`.

Environment variables, such as `DD_SITE` or `TRAJECTORY_PORT`, apply last,
and only to the process started with them. When an environment variable or a
protected managed value sets a key, editing `config.yaml` has no effect.

Some managed values are protected:

- A managed `export.site` wins, so a managed API key never goes to a site you
  chose.
- A managed `local_ui.auto_start: false` cannot be turned back on.
  `trajectory local-ui` still opens sessions by hand.
- When managed config sets `org.config_source`, all `org.*` keys come from
  managed config.

The sections below name the other protected keys.

On a managed computer, old releases could save a full copy of every setting
in `config.yaml`. If the file fully matches that format, Trajectory backs it
up in `~/.trajectory/state/config-migrations/` and removes the copied
defaults. If it matches only in part, Trajectory ignores it and leaves it
unchanged. `trajectory doctor` then suggests `trajectory config tidy`. It asks
first, keeps a backup only you can read, clears your overrides, and reloads.

### How a machine gets a cohort
A cohort is a named group of machines that gets extra managed settings from a
`cohort.yaml` overlay. Each Trajectory home gets at most one cohort, in this
order:

1. The cohort named in `~/.trajectory/cohort`. Device management writes this
   file.
2. Otherwise, the cohort in the `cohort_rollout` block of managed
   `config.defaults.yaml`, if this home is in that rollout.

A rollout gives its cohort to a percentage of homes:

```yaml
cohort_rollout:
  cohort: security-pilot
  percent: 10
```

Each home has a place in the rollout from 0 to 100. The home is in the
rollout when its place is below `percent`. If you raise `percent`, homes only
join. If you lower it, the homes that joined last leave first. `percent`
allows up to two decimal places, such as `0.5`. To pick a new set of homes
for the same cohort, set `salt` to a new value.

Organization sync downloads `cohorts/<cohort>.yaml` for a home in the
rollout. When the home leaves, Trajectory stops using the overlay. Each change
takes effect at the next sync.

A cohort can set any setting that a downloaded `config.defaults.yaml` can set.
Its value takes the place of the one in `config.defaults.yaml`, under the same
rules. So a rollout can stage `auto_update`, `deployment.ring`, or
`deployment.minimum_version`. A cohort that an MDM profile assigns cannot
set the blocks the profile owns, such as `auto_update` and `features`.

One setting works differently: `clients`. A client field that
`config.defaults.yaml` turns off stays off, and the overlay's `true` for it
has no effect. Change `config.defaults.yaml` itself to turn the client back
on, for every home at once.

For example, this overlay turns automatic updates on for the homes in the
rollout:

```yaml
auto_update: true
```

Raise `percent` step by step, for example 1, then 10, then 100. To roll back,
lower `percent`. Each home that leaves goes back to the value in
`config.defaults.yaml`.

Organization sync never restarts Trajectory to apply a cohort. If an overlay
changes a setting that needs a restart, such as `modules`, the background
service applies it the next time it starts. The same rule applies to
`config.defaults.yaml`.

The place comes from an installation ID that organization sync creates once,
in `~/.trajectory/state/installation-id`. Trajectory never sends the ID
anywhere. Each user account has its own ID. Until the first sync creates it,
the home is in no rollout. To see the home's place and whether it is in the
rollout, run `trajectory doctor --verbose` or `trajectory config show`.

Some Macs have an MDM configuration profile that selects organization files.
On those Macs, the block comes from the organization's hosted
`config.defaults.yaml`. Organization sync downloads the overlay from the same
source. The overlay cannot change `org`, `auth`, `setup` or
`managed_capture`, which come from the profile and the hosted file. A profile
that names a cohort assigns it, and such a Mac ignores the block.

## View and Change Settings

| Command | What it does |
| --- | --- |
| `trajectory config` | Opens a menu editor for 10 common settings, with the source of each. Protected managed values are read-only. |
| `trajectory config get <key>` | Prints the value in effect. For a managed `auto_update`, it also names what sets it. |
| `trajectory config set <key> <value>` | Changes one key in `config.yaml` and keeps its comments. It prints the value in effect and any managed override. |
| `trajectory config show` | Prints the merged config files as YAML, with pricing and retention notes, the update settings and what set each, and no environment variables. |

`config set` accepts every key in the [field reference](#field-reference)
except the structured ones: `modules`, `publish_tags`, `org.files`, and
`required_destinations`. Edit those in YAML. For a list or map key,
`config set` replaces the whole value. Area commands, such as
`trajectory config features enable`, change one item.

Setting a key to its current default pins it, so a later managed default no
longer applies. There is no unset command. To reset a key:

1. Delete its line in `config.yaml`.
2. Run `trajectory config reload` to preview the change.
3. Run the next step it prints.

## Apply Changes

`trajectory serve` reads config and environment variables when it starts. A
running capture server needs a reload or a restart to pick up a change.

1. Run `trajectory config reload` to preview the change.
2. Run `trajectory config reload --yes` to ask the owner process to apply it.
   `--wait DURATION` sets how long to wait.
3. Run `trajectory ps` to confirm. It lists the running processes with their
   agents, sessions, and publish state.

Changes to `server.port`, `server.otlp_proxy`, `telemetry`, `capture`,
`local_ui`, `modules`, and `identity.host_override` need a restart, and
reload says so. Other settings, such as `export.*`, `tags`, `identity`, `auth`,
`features`, `clients`, `org`, `setup`, and `deployment`, reload in place.
Organization sync keeps a downloaded `config.defaults.yaml` that changes both
kinds. The running service applies the settings that reload in place at once,
and `trajectory ps` shows `restart_required` for the others until it restarts.

- `--details` adds the changed setting names, process IDs, and blockers.
  `--json` prints the full result.
- The owner process does not reload while sessions are open. `reload --yes`
  then exits nonzero, and the process reloads after the last session ends.
- `--force` needs no `--yes`. It skips the owner, session, and publish
  checks, and reloads each running process after checking it. If a change
  needs a restart, it restarts them, unless you add `--no-restart`. Invalid
  config still fails. A very old release needs one normal restart.

After you change `server.port`, run `trajectory update refresh-clients`, then
`trajectory serve restart`.

| Command | What it does |
| --- | --- |
| `trajectory ps --stop PID --force`, `--restart PID --force` | Skips only the active session check. |
| `trajectory ps --reload PID --force` | Force-reloads one checked process. |
| `trajectory serve ensure` | Starts or reuses one shared capture service and waits until it is ready. It cannot replace a healthy process. |
| `trajectory serve retire-stale --yes` | Stops a stale owner of the capture service, then starts a new one unless you add `--no-start-replacement`. `--force` skips only the active session check. |

## Keep Data Local

To capture only on your computer, run:

```bash
trajectory config set export.traces off
trajectory config set export.metrics false
```

Session JSONL still goes to `~/.trajectory/trajectories/`. These settings turn
off only your own Datadog destination. Destinations that managed config
requires still publish. So do collectors in your own `destinations:` list,
destinations in a repository's `publish.trajectory.yaml`, and a collector set
with `TRAJECTORY_OTLP_ENDPOINT`. A managed `export.metrics: true` keeps base
metrics on for them.

## Disk Use and Retention

Three local limits are on by default. Setting one to `0` turns it off.

- `capture.retention_days` (default 60) keeps a session's full data.
- `capture.aggregate_retention_days` (default 365) keeps a session's totals.
- `capture.max_disk_bytes` (default 10 GiB) caps all of Trajectory's data.

A session's JSONL is deleted once all its events are older than
`capture.retention_days`. The local cache then drops its turns, tools,
traces, search entries, pull request evidence, and publish state. With
`capture.retention_days: 0`, full data never ages, and only the disk limit
removes session files the cache no longer holds. A session's totals go once
its last event and last update are older than
`capture.aggregate_retention_days`, and never before its full data.

`trajectory config set capture.retention_days` warns below 30, because pull
request attribution reads 30 days of other sessions. It rejects a
`capture.aggregate_retention_days` below a positive `capture.retention_days`.

A managed `capture.retention_days` is only a default, and your value replaces
it. The managed-only `capture.retention_limit_days` and
`capture.aggregate_retention_limit_days` cap your values. The shorter value
wins, and `0` means forever. `trajectory doctor` flags a value of yours that
a limit overrides.

Other stores, such as pull request evidence, publish queues, module records,
proxy captures, leftover session state, and logs, follow
`capture.retention_days` or their own size limits. Module decisions go to
`~/.trajectory/modules/decisions.jsonl`. At 16 MiB the file starts over, and
the old one stays as `decisions.jsonl.1`. The unused file
`state/live-progress.sqlite` stays. Delete it by hand once no older capture
server shares the home.

### Disk limit

Past `capture.max_disk_bytes`, the service removes a small batch each minute,
in this order:

1. Old session JSONL that the cache no longer holds.
2. Module records of sessions whose delivery is settled.
3. Records of delivered metrics.

It spares the last 30 days, unsent metrics, and running sessions. If only
those remain, `trajectory doctor` says to raise `capture.max_disk_bytes`. The
limit does not shrink `trajectories/cache/trajectory.db`, the local cache that
search, queries, reports, and the local viewer read. `trajectory doctor` says
when the cache keeps you over the limit.

### What reports show for an aged session

A session whose full data aged out keeps its totals: cost, tokens, counts,
models, tools, markers, tags, pull requests, and times. It never keeps
prompts, responses, or titles.

## Stop Capture

`trajectory config capture disable` stops all new capture for your user,
with no restart, until you run `trajectory config capture enable`. Both
accept `--json`. Disable writes `~/.trajectory/capture.disabled`. While that
file exists, running capture servers drop every new hook, watcher, and OTLP
event, including from running watchers and Codex rescue servers. A symbolic
link or a damaged file counts too.

- The file records when capture stopped and which command stopped it.
  `trajectory doctor`, `trajectory status`, and the health endpoint report it,
  and warn after 24 hours.
- `capture enable` saves the off period in
  `~/.trajectory/state/capture-off-windows.json`. Later reads of agent files
  and imports skip that period. Activity after `capture enable` is captured
  again, also in a session that was open during the off period.
- If you delete `capture.disabled` by hand, no off period is recorded, and a
  later import may bring that activity in.
- Disable and enable update the Claude Code plugin, so Claude Code does not
  exit with an `ECONNREFUSED` error. Running sessions keep the old hooks until
  they restart.

`capture enable` always works. `capture disable` needs the
`trajectory_disable_command` flag, which is on by default. It fails if an
administrator turns that flag off.

### Stop capture for one command

`TRAJECTORY_DISABLED=1` stops capture for one process tree, and wins over
`capture enable`. Set it in one command's environment to keep that session
out of Trajectory. The session's first hook under it marks the session in
`~/.trajectory/state/capture-disabled-sessions/`, so the session stays out
when you resume it, for 400 days. A capture server started with it serves
only health and loads no credentials. Unset it and restart the server to
capture again.

- It fully covers Claude Code and Codex, including their history imports.
- For other clients with Trajectory hooks, such as Cursor, Copilot CLI, Pi,
  Antigravity, Droid, and Goose, the hooks honor it. History reads may not.
- It does not work for Amp, Hermes, OpenCode, Kilo, OpenClaw, or Qwen. Use
  `capture disable` and `capture enable` for them.

### Headless sessions

With export configured, headless sessions, such as `claude --print`, publish
by default. To stop it, run
`trajectory config set capture.include_headless_agents false`.

## Identity and Tags

`trajectory.user` is the computer account that ran the agent:
`TRAJECTORY_USER` if set, otherwise the OS user name. `trajectory.user_email`
is the person's work email, and it names the person. Agent Console and
dashboards join a person's data across computers and clients by
`trajectory.user_email`. Set it on every computer the person uses.

Set the email in one of these ways:

- `trajectory setup --user-email <email>`. For example,
  `trajectory setup --clients codex --user-email "$(git config --global user.email)"`
  saves `identity.user_email` from Git.
- `identity.user_email`.
- `identity.user_email_suffix`. If your user name matches the local part of
  your email, `trajectory config set identity.user_email_suffix example.com`
  turns `jdoe` into `jdoe@example.com`.
- `identity.user_email_command`. It runs without a shell.
- `TRAJECTORY_USER_EMAIL`, for one shell.

A valid email from `identity.user_email_command` wins over the suffix. If the
command fails, times out, or prints an invalid email, the suffix applies.
These settings follow the config order first: a `config.yaml` value replaces
a managed value before Trajectory picks a source.

The suffix builds no email for `root`, `nobody`, user ID 0, or a system
account. A system account has a user ID below 1000 on Linux. On macOS it has
a user ID below 500, or a name that starts with `_`. The variable, the email
setting, and the command still apply to these accounts.

The `git.email` and `github.username` tags come from Git. To set them for the
whole computer, run `git config --global user.email <email>` and
`git config --global github.user <username>`. Git never sets
`trajectory.user_email`.

The capture server reads `identity.*` when it starts. After a change, run
`trajectory config reload --yes`. New spans and metrics use the change once
the server reloads or restarts.

### Report one host for short-lived machines

Every metric, span, and log has a `host` tag with the computer's hostname. A
machine that lives for one task, such as a container deleted after one
session, adds new series to every per-machine metric. To make such machines
report one fixed value, run:

```bash
trajectory config set identity.host_override ci-sandbox
```

- `TRAJECTORY_HOST_OVERRIDE` sets the value for processes started with it,
  and wins over the setting.
- `config.yaml` or the managed `config.defaults.yaml` can set it. A file from
  the organization config source cannot. On a machine that syncs from one,
  Trajectory ignores the key in `config.defaults.yaml` too.
- The value has 1 to 64 lowercase letters, digits, dots, underscores, or
  hyphens, and starts with a letter or digit. Trajectory ignores any other
  value, keeps the hostname, and warns in the `trajectory serve` log and
  `trajectory doctor`.
- An empty value means the key is not set. An empty value in `config.yaml`
  does not clear a managed value. To report the hostname, remove the key from
  `config.defaults.yaml`.
- The override changes only `host`. On a Mac, `trajectory.device_id` keeps
  the hardware UUID.

Machines that share one host value still give correct totals for counts,
such as tokens, cost, and turns. Gauges are different. Machines that run at
the same time write the same series. So a gauge such as
`trajectory.ops.agent.present` or `trajectory.ops.binary.heartbeat` no longer
describes one machine. Do not count machines or read per-machine gauges for
hosts that share a value. Each process keeps the host it started with, so run
`trajectory serve restart` after a change.

## Secrets and API Keys

Config names keys only by reference. Values come at run time from an
environment variable, a key provider, or the keychain, never from YAML.
Trajectory saves keys in your OS keychain, under the service `trajectory`. A
missing key never stops local capture. Remote publishing stops with a key
error, and retryable work stays queued.

Trajectory needs a Datadog API key for `datadog_agentless` publishing,
agentless OTLP forwarding, key checks, and AI Guard. `datadog_agent`
destinations and generic `otlp` collectors need no Trajectory key. Agentless
Datadog OTLP still sends `dd-api-key`. Model provider keys, such as
`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, and `GEMINI_API_KEY`, are never used to
publish to Datadog.

### Manage secrets

| Command | What it does |
| --- | --- |
| `trajectory config set-secret <name>` | Saves a secret in the keychain with hidden input. In scripts use `--stdin`, never `--value` or an argument. |
| `trajectory config set-secret dd_app_key --stdin` | Saves the Datadog application key. |
| `trajectory config delete-secret <name>` | Removes a secret. `--exact-name` keeps hyphens, for accounts saved that way. |
| `trajectory config secrets` | Lists well-known and tracked keychain secrets as set, not set, unknown, or not checked. It shows no values, and exits 1 on unknown. |
| `trajectory config secrets <ref>...` | Checks each reference as typed. See [Check managed refs from a script](#check-managed-refs-from-a-script). |

`set-secret` turns hyphens into underscores. Managed installs use
`api_key_ref` names as written, so save those keys with
`set-secret <name> --exact-name`. `dd-api-key` and `dd_api_key` name the same
default key. Setup saves `dd_api_key`, and the `export.*` destination uses
`dd-api-key`.

Setup and `set-secret` back up the old keychain value, and restore it if the
write fails. Backup, replace, and rollback share one 30-second deadline. On
Linux and Windows, a write that times out is unconfirmed. After a delete that
fails or is unclear, Trajectory keeps its ownership record, so check the
keychain.

To check your keys, run `trajectory doctor`. It checks the keys each running
service found, or this shell if none runs, and names each fix.
`trajectory doctor metrics canary --destination NAME --publish --readback`
checks that the API key sends and the application key reads back. A good key
shows `normalized_shape=datadog-api-key` and `valid_format=true`. Otherwise,
run `trajectory config set-secret dd_api_key` again, or fix `DD_API_KEY` or
`api_key_command`.

### How Trajectory finds the API key

In auto mode, Trajectory tries these sources in order:

1. The environment variable named after `api_key_ref`, then `DD_API_KEY`,
   then `DATADOG_API_KEY`.
2. The default key provider.
3. The keychain account.
4. The destination's `api_key_command`.

The default key provider serves only `dd-api-key` and `dd_api_key`. It reads
`DD_API_KEY`, then `DATADOG_API_KEY`, then runs `auth.key_command` if set,
then reads the `dd_api_key` keychain item.

In auto mode, commands you run report a malformed key in an environment
variable and try the next source. A secret manager ID in place of a key counts
as malformed. The capture server warns about it, but cannot fall back while
the variable is set, so unset it. To use only one source and fail on a bad key, pin it:

```bash
trajectory config set auth.credential_source keychain
```

Each destination's `api_key_ref` names the stored key for its direct Datadog
signals. Project config uses it only for metrics-only destinations. Store a
referenced key with `trajectory config set-secret <ref>`. For CI, set its
environment variable, such as `DD_PAYMENTS_API_KEY`.

`DD_API_KEY` or `DATADOG_API_KEY` feeds only processes started after you set
it, which suits CI or a quick test. In `auto` or `env` mode, a key from an
environment variable goes to whatever destination you configured. A shell
export never reaches a capture server that is already
running or that an app started. Save the key with `set-secret` or
`auth.key_command`, then run `trajectory serve restart`.

Trajectory unwraps quotes, `DD_API_KEY=` and `DATADOG_API_KEY=` lines with an
optional `export ` prefix, and `go-keyring-base64` values. It reads JSON with
`DD_API_KEY`, `DATADOG_API_KEY`, `api_key`, `apiKey`, `key`, or
`SecretString`. The key must be 32 letters and digits. If there is no
keychain, as in a Linux container without D-Bus, the key counts as unset.

### Key commands

`auth.key_command` runs only when config sets it, and setup never does. It
prints the key alone, a `DD_API_KEY=<key>` line, or JSON. Organization sync
and `cohort.yaml` cannot set it. `config.yaml`, a device profile default, or a
`config.defaults.yaml` without an organization source can.

- `auth.key_command` and a destination's `api_key_command` run only these
  commands: `security find-generic-password`, `pass show`, `op read`,
  `op get`, `vault read`, `vault kv get`,
  `aws secretsmanager get-secret-value`, and
  `gcloud secrets versions access`. `TRAJECTORY_ALLOW_API_KEY_COMMAND=1`
  allows others that you trust.
- Commands run without a shell, split on white space, and stop after 30
  seconds.
- `auth.key_command` results are shared in
  `~/.trajectory/.credential-command-cache/` for 40 minutes.
  `api_key_command` results last their `ttl`, five minutes by default.
- A failed `auth.key_command` retries once, then waits about 2 and 4 minutes,
  then 8 hours. `trajectory publish validate` in a terminal skips the wait.
- A failed `api_key_command` from the list waits 2 minutes, doubling up to 8
  hours. Other commands share no cache and no wait.
- Command keys refresh when their TTL ends. `trajectory ps` shows each
  process's credential status, never the key.
- Credential caches are readable only by you: `0600` files and `0700`
  folders. Cached keys are masked, not encrypted. Application keys never
  enter command caches.

### Application key resolution

An application key is needed, with an API key, only for metric read-back and
AI Guard, and is sent only for those. Metric read-back needs the Metrics query
(`timeseries_query`) permission.

Trajectory picks the application key reference in this order: a flag such as
`--readback-app-key-ref`, the destination's `app_key_ref`, then `dd_app_key`.
The default reference checks `DD_APP_KEY`, `DD_APPLICATION_KEY`,
`DATADOG_APP_KEY`, and `DATADOG_APPLICATION_KEY`, then the keychain. A custom
reference checks only the keychain. In managed keychain mode, every reference
is a keychain read by exact name. Metric read-back reads the key again on
every run.

### Managed keychain mode

With `auth.mode: managed_keychain`, Trajectory reads only the `api_key_ref`
accounts under the service `trajectory`, exactly as named. It ignores
environment variables, aliases, and key commands. Each direct Datadog managed
destination must set `api_key_ref`. A read that needs approval, fails, or
times out returns no key, and managed mode tries no other source.

- Managed `auth.mode`, `auth.credential_source`, and `auth.key_command`
  override `config.yaml` field by field. Managed fields that are not set keep
  your values.
- A managed `export.site` replaces yours. The capture server's own `DD_SITE`
  still applies.
- Managed exact-name keys stay cached in memory. `config reload`,
  `set-secret`, and `delete-secret` clear the cache, so rotations apply.
- The capture server rereads a rejected managed API key at most once every 30
  seconds. A 401 or 403 on metrics, or a key that is not 32 letters and
  digits, counts as rejected.

To inspect a managed key, use the keychain paths that doctor prints:
`security find-generic-password -s trajectory -a ACCOUNT KEYCHAIN`. Pipe
`-w` to `wc -c` to check the length without printing the key.

### Check managed refs from a script

`trajectory config secrets <ref>...` prints one `<ref>: <state>` line for each
reference. It never prompts, unlocks, reads environment variables, or prints a
value. It exits 0 when every reference is readable, 1 when one is not, and 2
on a usage error. `--json` prints
`{schema_version: 1, refs: [{ref, state, detail}]}`, and sends the fix for
each unreadable reference to standard error. Named checks run on macOS and
Windows. Elsewhere the reader can prompt, so they read nothing.

| State | Meaning |
| --- | --- |
| `readable` | Trajectory can read the item without a prompt. |
| `missing` | No item exists under that account. |
| `needs_authorization` | The item exists, but another app or an earlier Trajectory build last changed it, so reading it would prompt. Run `set-secret <ref> --exact-name --replace-unreadable`. |
| `keychain_locked` | The keychain is locked. Run `trajectory config secrets` in a terminal to unlock it. |
| `keychain_missing` | There is no usable default keychain. |
| `keychain_search_list_missing` | The default keychain is not in the search list. |
| `unknown` | The lookup failed. The item may still exist. Run the check again, and if access stays denied, save the key again. |
| `not_checked` | Nothing was read, because `TRAJECTORY_DISABLE_KEYCHAIN=1` is set or the platform is not macOS or Windows. |

### The macOS keychain

On macOS and Windows, background keychain reads never show a dialog. On
macOS they never add readers to an item's access list or repair a keychain.
They read user keychains in search order, never `System.keychain` or the
common-domain keychains. A locked keychain stops them. The capture server
skips general keychain reads, so a dialog cannot block it. Besides
`dd_api_key`, background keys need exact-name references, a key provider, or
an environment variable. A process keeps each key it read for its lifetime,
and retries failed reads.

- To unlock a locked keychain, run `trajectory config secrets` once from a
  terminal. Trajectory never sees the password or changes access. Background
  reads then work until the keychain locks again, such as on sleep or logout.
- `trajectory doctor` lists every keychain in the search list as unlocked,
  readable, writable, and eligible, with the accounts present. It marks
  system keychains as left out of lookup, and reads only metadata.
- New items go to the default keychain. If the search list lacks it, creation
  fails. Add it in Keychain Access.
- Setup succeeds only if a read without a prompt returns the same key. You
  may need to approve the item, within 20 seconds. If you deny it, setup
  fails.
- Saving a key makes the item trust Trajectory and keeps earlier readers.
  Only a signed release can add Trajectory as a trusted reader. A local build
  with an ad hoc signature refuses and explains.
- Signed builds replace items that only `/usr/bin/security` could read. Items
  that other apps can read, or that sit in several keychains, are left alone.
  After a replacement, `/usr/bin/security` and older releases need approval.
- If an item from an older build or another tool is unreadable, run
  `trajectory config set-secret <name> --exact-name --replace-unreadable`.
  With a build signed with a certificate, it deletes every copy of that name
  without reading it, and saves one owned item.
- `trajectory config secrets` names locked keychains, and separates
  authorization, reader, timeout, and OS errors. `set-secret` errors name the
  locked path.

If setup or `set-secret` reports a keychain problem, run
`trajectory config set-secret dd_api_key` again. Meanwhile, you can set
`DD_API_KEY` and run `trajectory publish validate`.

### Where keys go

- Stored keys go over HTTPS only to Datadog sites, or to hosts that machine
  policy allows and config selects. `trajectory doctor` warns otherwise.
- Stored keys never use plain HTTP, except to a loopback address that machine
  policy allows. Redirects go only to the same host or an allowed host.
- Setup and `trajectory publish destination configure` send a stored key
  only to a Datadog site or a host that machine policy allows. With
  `--non-interactive`, the key comes from `--api-key-stdin`, `DD_API_KEY`, or
  the stored `dd_api_key`.
- A destination that refuses a stored key gets nothing and logs one warning.
  Other destinations keep publishing, and its queue waits until you fix the
  key.

`trajectory doctor`, `trajectory publish validate`, and the capture server
logs show the credential policy, the source in use, and the key's format,
length, and validity, never its value. Keys read from the keychain never pass
through process arguments or the environment. Never print a key to debug it.
Check the account name, source policy, reference, site, and format
diagnostics. Rotate a key that leaked.

### Rotate a key

1. Update the key behind its reference.
2. Reload or restart the processes.
3. Check it with `trajectory publish validate` or metric read-back.
4. Revoke the old key.

## Backfill

Backfill imports the history that agents saved on disk into Trajectory's
storage. It sends nothing. Republish sends history that Trajectory already
holds to your destinations. Run `trajectory user-guide backfill` for the
order of local backfill, the reconciliation metrics, and what is left out.

`trajectory backfill local --apply` converts Claude Code, Codex, Cursor, Pi,
and OpenCode history, newest first, and keeps the event order. Antigravity and
Copilot history import only through `trajectory session import`, which needs
`clients.agy.history_sync` or `clients.copilot.history_import`. A first
`backfill local --apply` into a cache with fewer than 500 sessions indexes up
to 100 sessions from the last day first. Discovery limits can make backfill
miss history. Run it again for Codex files past the limit, added during an
import, or that failed.

### Windows and settings

- `backfill.local.days` sets only the default local window. A full reindex
  still checks every kept session. `backfill.*` settings never delete
  history, and `capture.retention_days` does.
- `republish.days` is the default window for `trajectory publish history`,
  its aliases, and `backfill --apply --republish`. The maximum is 30 days.
  `config set` rejects more, an older window fails and names its start, and
  managed values are capped.
- The default republish window shrinks to `capture.retention_days`. A longer
  explicit window is rejected.
- `--last` replaces both windows. `--since` and `--until` override the
  settings. With only `--until`, each window ends there at its configured
  length.
- `trajectory session import codex` and `trajectory session reindex` take
  `--limit` for the batch size, and every batch runs.
  `trajectory session reindex --continue` resumes an interrupted run.
- `backfill.*` and `republish.*` changes apply at the next command or
  background run. `trajectory backfill status` shows both windows.

`trajectory publish history --last 30d` previews. Add `--yes` to send the
missed cost and session metrics, up to 30 days. `trajectory cost publish` and
`trajectory session publish` are aliases.

### Priority

Backfill, import, reindex, `refresh-local`, and token repair run at
background priority when they change data. That means `nice` 10 and throttled
disk I/O on macOS, and `nice` 10 and disk I/O level 7 on Linux. On Windows it
means below-normal CPU. `--full-priority` turns this off
for one run. Background indexing in the capture server runs at `nice` 19.

On a Mac on battery, background indexing pauses after its batch until power
returns. Commands you run never pause. Other platforms are not checked. The
thread settings set indexing workers, not CPU or publish limits. More than
one worker drops the short pause between sessions.

### What backfill sends

Datadog destinations accept backfill by default. On a managed
`required_destinations` entry, `backfill_opt_out: true`, or the older
`historical_metrics_ingestion_confirmed: false`, blocks backfill and the
publish commands for that destination. Live publishing continues.

- Backfill sends the live metric names with their original timestamps. It
  never sends a delivered point again. Late turn corrections keep the turn's
  time, and with the default `historical` delivery they replace the stored
  value.
- Points more than about one hour old need Datadog Historical Metrics
  Ingestion turned on. Trajectory cannot turn it on or confirm that Datadog
  stored the points.
- A destination's accepted history limits how far back backfill reaches.
- When a source lacks the data a backfilled metric needs, the point is left
  out, not reported as zero.
- A live publish of replayed history leaves out token and cost metrics. The
  republish commands and managed reconciliation send them later.
- Backfill never rebuilds distributions, request size samples, or missing MCP
  wait history. Historical Metrics Ingestion cannot change distribution
  samples.
- Backfill sends the oversight operation count and the additive oversight
  cost again, not the duration distribution.
- Backfill never rebuilds confirmed completion totals. Only stored live
  sessions send them at session end.

On managed computers, rolling reconciliation runs when the capture server
starts, then at most once a day. It reads saved transcripts and local pull
request attribution for up to 30 complete UTC days, ending yesterday. It
sends a fixed list of gauges and counts, including the pull request file-work
indicator while `export.pr_file_work_cost_indicator` is on. It never sends
distributions, operational metrics, or the split of cache writes by duration.

## Feature Flags

Feature flags turn some behavior on or off. Some act as emergency switches.

| Command | What it does |
| --- | --- |
| `trajectory config features list` | Shows each flag's name, state, source, and description. `--json` adds the default and the restrictions. |
| `trajectory config features status <flag>` | Shows one flag. |
| `trajectory config features enable <flag>`, `disable <flag>` | Writes `features.enabled` or `features.disabled` in `config.yaml`. `config get` and `config set` use these lists too. Managed-only flags refuse it. |
| `trajectory config features clear <flag>` | Removes your override and restores the default. |

`TRAJECTORY_ENABLE_FEATURES` and `TRAJECTORY_DISABLE_FEATURES` take
comma-separated names and override flags for one process. A flag in both is
off. Neither the variable nor user config can turn on a flag that a managed
or other config layer turns off. Protected managed-only flags ignore both
variables, and `features list --json` marks them.

The Agent Security client gates `agent_security_agy`,
`agent_security_claude_code`, `agent_security_codex`,
`agent_security_copilot`, `agent_security_cursor`, and
`agent_security_kiro` are managed-only and follow the module. List one in
managed `features.disabled` to leave that client out.

These flags are on by default:

| Flag | What it controls |
| --- | --- |
| `automatic_self_update` | Automatic updates. |
| `file_work_indicators` | Turns off `trajectory.pr.file_work.cost_indicator.usd.additive` even when `export.pr_file_work_cost_indicator` is on. Costs do not change. |
| `goose_durable_history` | Reads Goose's `sessions.db`, read-only, for model, tokens, and compaction. |
| `patterns_analysis_backfill` | Lets confirmed `trajectory patterns analyze` runs write turn and Work Insights labels. |
| `persistent_incognito` | Lets `trajectory config publish opt-out` work. |
| `resource_observation` | Process resource sampling for serve cost health. |
| `trajectory_disable_command` | Lets `trajectory config capture disable` work. |
| `metric_samples_oversight_duration` | `trajectory.oversight.duration_ms.total` samples. |
| `metric_samples_skill_duration` | `trajectory.turn.skill_duration_ms.total` samples. |
| `metric_samples_skill_tool_uses` | `trajectory.turn.skill_tool_uses.total` samples. |
| `metric_samples_skill_distinct_tools` | `trajectory.turn.skill_distinct_tools.total` samples. |

The `metric_samples_*` flags never change additive totals or destinations,
and a managed disable wins. Samples skipped while a flag is off are never sent
later. `metric_samples_session_cost` and `metric_samples_turn_cost` are still
accepted but do nothing, because the metrics they controlled are retired.

### Flags from Datadog Feature Flags
An administrator can let a Datadog Feature Flags environment set the default of
some flags. The managed `datadog_feature_flags` section, with `enabled: true`,
names the environment and the flags. `trajectory serve` downloads the rules every 5 minutes and
evaluates them on this computer. `trajectory config features status <name>`
then shows `source=datadog`. Your own `enable` and `disable` still win over a
Datadog value, except for managed-only flags. If Datadog cannot be reached,
Trajectory keeps the last values it received.

## Updates

`trajectory update` installs the release your ring names.
[Getting started](GETTING-STARTED.md#update) describes a
normal update.

- `--format json` prints one object with `command`, `source`, `outcome`,
  `reason`, `from_version`, `to_version`, `ring`, `floor`, `ring_version`, and
  `duration_ms`. Unknown versions are `none`.
- `--source jamf|agent|timer|manual|floor` only tags the run.
- `--force` stops the processes that hold the update lock, then installs the
  ring's release again, never an older one.
- `--dry-run` changes nothing.

| Outcome | Exit code |
| --- | --- |
| `updated`, `reinstalled`, `current`, `ring_below_floor`, `busy` | 0 |
| `rolled_back`, `failed` (the reason names the step) | 1 |
| Usage error | 2 |

Update reads releases from the first source that is set:

1. `TRAJECTORY_UPDATE_URL`.
2. `deployment.update_url`, which you set in `config.yaml`. An organization
   config source cannot set it.
3. The `RELEASES.json` that organization sync saved in the Trajectory home.
4. Datadog's public list.

Update checks, downloads, and private repositories use `GITHUB_TOKEN` or
`gh auth token`, never Git credential helpers or SSH keys. Update checks the
release checksum, and on macOS Datadog's Developer ID signature, before it
renames the release into place. A macOS update fetches
`trajectory-darwin-arm64` or `trajectory-darwin-amd64` for the running
architecture, not the universal binary. Update waits up to 30 seconds for
another update's lock, then reports `busy` and exits 0, and the other run does
the work.

When the installed release is current but the capture server runs another
release, update restarts the server on the installed binary. This does not
apply to development builds. Every run except `--dry-run` also removes
leftover `trajectory.new`, `.old`, and `.aside` files. A binary installed in
an MDM path or by Homebrew cannot update itself, so update fails with
`self_update_disabled` and exits 1.

### Automatic updates

With `auto_update` on, the capture server runs `trajectory update --source
timer` at most once an hour. A new release restarts the server without
waiting for hooks. The installer writes `auto_update: true` when it creates a
new `~/.trajectory/config.yaml`. Managed Macs default to off.

Automatic updates also need the `automatic_self_update` flag. Your
`features.disabled` entry stops them only while your `config.yaml` applies.
`TRAJECTORY_AUTO_UPDATE=0` turns them off for one process, even under a
managed `auto_update: true`. The capture server reads the update settings
again every 10 minutes. Only `TRAJECTORY_AUTO_UPDATE=0` needs a restart. The
update timer writes results to `logs/update-timer.json` and errors to
`logs/update-timer.log` in the Trajectory home.

### Managed update settings

- Your organization decides automatic updates in its `config.defaults.yaml`,
  which Trajectory downloads. The MDM profile has no update setting. An
  `auto_update` in `config.defaults.yaml` wins over `config.yaml`, `true` or
  `false`. An `auto_update` in the assigned `cohort.yaml` replaces the one in
  `config.defaults.yaml`, in either direction, and wins over `config.yaml`
  the same way.
- On a Mac your organization manages, automatic updates are off when its
  `config.defaults.yaml` sets no `auto_update`, also before the first
  download. Trajectory never reads `auto_update` from `config.yaml` there.
- `auto_update: false` never blocks a `trajectory update` that you run.
- A managed override shows as `config set conflict:` and `note:` lines, as
  notes in `config get` and `status`, and as the deciding source in doctor.
- `trajectory config show` and `trajectory managed status` print
  `auto_update`, `deployment.ring` and `deployment.minimum_version` with what
  set each: `org config`, a cohort, `config.yaml` or `built-in default`.
- `deployment.ring` in managed `config.defaults.yaml` or an assigned
  `cohort.yaml` wins over `config.yaml`. A cohort ring wins over the base
  managed ring.
- With a profile that selects organization files, only their
  `config.defaults.yaml` sets the ring, `stable` by default. Without a
  profile, your ring applies.
- A managed or cohort `deployment.minimum_version` wins. Under a profile,
  your floor is ignored. If nothing sets it, there is no floor.

### Repair and restart

`trajectory update repair` reports whether the capture server runs the
installed release, and changes nothing.

- `--apply --yes` restarts the server from that binary, unless it is
  current.
- `--binary PATH` starts the server from that binary.
- `--reload-config` reloads config and managed credentials. It fails without
  the required destinations.
- `--apply --yes --force` sends TERM, then KILL, to all your `trajectory` and
  `trajectory-*` processes. It ignores sessions and queued work.

`trajectory serve replace --force` does the same forced restart in one
command and waits for a ready server. `trajectory serve retire-stale --yes
--force` stops a stale owner process even with active sessions. A forced
restart needs no session end. The new process catches up from disk, succeeds
only when it is the only one, and never touches other users.

`trajectory update` restarts the capture server without waiting for
sessions. It sends TERM, waits 10 seconds, then sends KILL. Starting the MCP
server never replaces the capture server.

### The update settings file

`selfupdate.conf`, in the Trajectory home, holds `KEY=value` lines for the
installer, the self-update permission, and the update source.
`trajectory update` ignores it. If it cannot be read, Trajectory ignores it
and doctor reports it. Fix the named line, or delete the file and run your
installer again.

## Environment Variables

An environment variable applies only to the process started with it.

| Variable | What it does |
| --- | --- |
| `TRAJECTORY_HOME` | Moves config, machine state, and the session folder, unless `TRAJECTORY_ROOT` is set. The default is `~/.trajectory`. |
| `TRAJECTORY_ROOT` | Moves session JSONL and the cache, not config, credentials, publish records, or watcher state. The default is `${TRAJECTORY_HOME}/trajectories`. |
| `TRAJECTORY_CACHE_DB` | Chooses the cache file. Reports, cost reports, and MCP tools use `--db`, then this, then `${TRAJECTORY_ROOT}/cache/trajectory.db`. |
| `TRAJECTORY_PORT` | Overrides `server.port`. Setup pins the hook port from it, then `server.port`, then 19222. Later refreshes keep Claude Code's hook port. |
| `DD_SITE` | Overrides `export.site`. |
| `TRAJECTORY_DEBUG=1` | Prints detailed logs. |
| `TRAJECTORY_DISABLED=1` | Stops capture. See [Stop capture for one command](#stop-capture-for-one-command). It sends no `auto_instrument_state`. |
| `TRAJECTORY_DISABLE_KEYCHAIN=1` | Skips keychain lookups. |
| `TRAJECTORY_DISABLE_KEY_COMMAND=1` | Stops `auth.key_command` and `api_key_command`. Lookup moves to the next source. |
| `TRAJECTORY_ALLOW_API_KEY_COMMAND=1` | Allows key commands outside the list. |
| `TRAJECTORY_ENABLE_FEATURES`, `TRAJECTORY_DISABLE_FEATURES` | Turn flags on or off. See [Feature flags](#feature-flags). |
| `TRAJECTORY_AUTO_UPDATE=0` | Stops background update checks, even under a managed `auto_update: true`. |
| `TRAJECTORY_UPDATE_URL` | Points `trajectory update` at another `RELEASES.json`. |
| `TRAJECTORY_UPDATE_BASE_URL` | Sets the base URL of the release files that `trajectory update` downloads. |
| `TRAJECTORY_UPDATE_RECONCILE_PROCESSES=0` | Stops the automatic runtime restart after a background update. Its metrics then report `process_status:disabled` and `outcome:skipped`. `trajectory update repair` does not read it. |
| `TRAJECTORY_SERVE_INACTIVITY_TIMEOUT` | Idle time before the capture server exits, from 100ms to 24h, 10 minutes by default. `0` turns it off. It never exits during an active session. |
| `TRAJECTORY_CLAUDE_TURN_SETTLE_DEADLINE` | How long a Claude Code turn waits to settle: 30s by default, at most 5m. |
| `TRAJECTORY_DISABLE_CLIENT_WATCHERS=1` | Stops every saved-history watcher in a capture server you start. Hooks reset it, and clients that managed policy enforces keep their watcher. |
| `TRAJECTORY_DISABLE_<NAME>_WATCHER=1` | At service start, stops one watcher. See the names below. |
| `TRAJECTORY_OTLP_ENDPOINT` | Adds a collector without a token. The capture server needs it. `trajectory publish status` shows it as `_env_otlp`. |
| `TRAJECTORY_OTLP_PROXY_ENABLED`, `_ENDPOINT`, `_API_KEY_REF` | Set the matching `server.otlp_proxy` keys. Datadog intake gets `api_key_ref` as `dd-api-key`. |
| `TRAJECTORY_OTLP_PROXY_HEADERS` | Comma-separated, URL-escaped `key=value` headers for other collectors. |
| `TRAJECTORY_USER_EMAIL` | Sets `trajectory.user_email`. |
| `TRAJECTORY_HOST_OVERRIDE` | Sets `host` instead of the hostname. It wins over `identity.host_override`. |

These are the watcher names:

```text
AIDER_HISTORY    AMP_HISTORY        ANTIGRAVITY_HISTORY  CLAUDE_DESKTOP
CODEWHALE        CODEX              COMMANDCODE          COPILOT_HISTORY
CURSOR_AGENT     DEVIN              FORGECODE            GOOSE_HISTORY
GPTME            GROK_HISTORY       HERMES_HISTORY       KILO
KIMI             KIRO_HISTORY       MISTRAL_VIBE_HISTORY MUSE
OMP_HISTORY      OPENCLAW_HISTORY   OPENCODE             OPENHANDS_HISTORY
QODER            QWEN               VSCODE_COPILOT       WINDSURF
ZCODE            ZED
```

## Field Reference

`trajectory user-guide config` prints this page, with the settable keys, how
layers merge, the environment overrides, and the transport values. The
**Default** column shows the value Trajectory uses when no file sets the key.

### General and updates

| Key | Type | Default | What it controls |
|---|---|---|---|
| `auto_update` | bool | `true` | Automatic background update checks. |
| `deployment.ring` | string | `stable` | Update ring: `stable` or `beta`. |
| `deployment.update_url` | string | `""` | Custom `RELEASES.json` URL. |
| `deployment.minimum_version` | string | `""` | Version floor that updates never go below. Empty sets no floor. |
| `local_ui.auto_start` | bool | `true` | Lets Trajectory start the local UI. |
| `server.port` | int | `19222` | Port of the local capture server. |

### Credentials and identity

| Key | Type | Default | What it controls |
|---|---|---|---|
| `auth.mode` | string | `""` | `managed_keychain` reads only the keychain accounts named in `api_key_ref`. |
| `auth.credential_source` | string | `auto` | API key source: `env`, `key_provider`, `keychain`, or `api_key_command`. `auto` tries them all. |
| `auth.key_command` | string | `""` | Command that prints the default Datadog API key. |
| `identity.user_email` | string | `""` | Email for the `trajectory.user_email` tag. |
| `identity.user_email_command` | string | `""` | Command that prints the `trajectory.user_email` value. |
| `identity.user_email_suffix` | string | `""` | Domain added to `trajectory.user`: `example.com` or `@example.com`. |
| `identity.github_email` | string | `""` | Email for the `git.email` tag. |
| `identity.github_email_command` | string | `""` | Command that prints the `git.email` value. |
| `identity.github_username` | string | `""` | Value of the `github.username` tag. |
| `identity.github_username_command` | string | `""` | Command that prints the `github.username` value. |
| `identity.host_override` | string | `""` | Value for the `host` tag instead of the hostname. A change needs `trajectory serve restart`. |

### Capture and local data

| Key | Type | Default | What it controls |
|---|---|---|---|
| `capture.redact_pii` | bool | `true` | Removes personal data patterns from captured content. |
| `capture.retention_days` | int | `60` | Days a session's full data stays. `0` keeps it forever. |
| `capture.aggregate_retention_days` | int | `365` | Days a session's totals stay. `0` keeps them forever. |
| `capture.max_disk_bytes` | int | `10737418240` (10 GiB) | Disk limit for all of Trajectory's data. `0` turns it off. |
| `capture.include_headless_agents` | bool | `true` | Captures headless sessions that Trajectory did not start. |
| `cross_client_resume.enabled` | bool | `false` | Rebuilds transcripts for other clients. |
| `cross_client_resume.targets` | list | `[]` | Clients that get rebuilt transcripts. |
| `backfill.local.days` | int | `30` | Default local backfill window, 1 to 3650 UTC days. |
| `backfill.local.threads` | int | `8` | Reindex workers, 1 to 64. `--threads` overrides it. |
| `backfill.local.background_threads` | int | `1` | Background indexing workers, 1 to 64. |
| `backfill.local.pause_on_battery` | bool | `true` | Pauses background indexing while a Mac runs on battery. |
| `backfill.background_priority` | bool | `true` | Runs backfill at background priority. |
| `republish.days` | int | `30` | Default republish window, 1 to 30 UTC days. |

### Export to Datadog

| Key | Type | Default | What it controls |
|---|---|---|---|
| `export.site` | string | `datadoghq.com` | Datadog site. |
| `export.ml_app` | string | `""` | LLM Observability ML app. Empty uses `coding-agents`. |
| `export.traces` | string | `off` | Trace level: `off`, `minimal`, `standard`, or `full`. |
| `export.turn_traces` | bool | `true` | Sends each turn's trace and evaluations. |
| `export.metrics` | bool | `true` | Sends cost, token, marker, and operations metrics. |
| `export.incognito_metrics` | string | `redacted` | Metric tags for incognito sessions: `redacted` or `standard`. |
| `export.redacted_model_suffixes` | list | `[]` | Model ID suffixes that are always redacted. A list you set adds to the organization's list. |
| `export.placeholder_llm_span` | bool | `true` | Adds a placeholder LLM child span that carries the turn's cost. |
| `export.index_traces.session` | bool | `false` | Adds a session index span with links only, at session end. |
| `export.subagent_span_mode` | string | `semantic` | How subagents show: `semantic` or `links_only`. |
| `export.oversight_publish_mode` | string | `summary` | Oversight data: `summary`, `full`, or `off`. |
| `export.late_turn_correction_delivery` | string | `historical` | Late turn corrections: `historical` or `gap`. |
| `export.pr_file_work_cost_indicator` | bool | `false` | Sends `trajectory.pr.file_work.cost_indicator.usd.additive`. Its `file_path` tag names repository files, so it stays off until organization config or your config turns it on. |
| `export.local_forward_url` | string | `""` | Local HTTP endpoint that receives each finished session's JSONL. |
| `tags` | map | `{}` | Tags added to spans and metrics. Managed values win. |
| `publish_trust.allowed_origins` | list | `[]` | Git origins whose `publish.trajectory.yaml` loads. |
| `publish_trust.require_committed` | bool | `false` | Loads a repository publish file only when it is committed unchanged. |
| `publish_trust.allowed_sites` | list | `[]` | Sites for repository metrics-only destinations. Empty allows the public Datadog sites. |

### Classifier and pricing

| Key | Type | Default | What it controls |
|---|---|---|---|
| `classifier.standard_fallbacks` | list | `[claude, codex, opencode, cursor]` | Classifier CLIs to try after the session's own client. |
| `pricing.cursor.mode` | string | `emit` | Cursor USD pricing: `off`, `shadow`, or `emit`. |
| `pricing.cursor.source` | string | `org_file` | Cursor rate source: `org_file` or `datadog_reference_table`, which is not built yet and publishes no USD. Empty turns pricing off. |

### Feature flags and automatic setup

| Key | Type | Default | What it controls |
|---|---|---|---|
| `features.enabled` | list | `[]` | Flags you turn on. |
| `features.disabled` | list | `[]` | Flags you turn off. Off wins over on. |
| `setup.auto_instrument.enabled` | bool | `false` | Managed automatic client setup. Needs `true` in managed config, and user config can turn it off. |
| `setup.auto_instrument.apply_enabled` | bool | `false` | Lets automatic setup make changes. Needs `true` in managed config, and user config can turn it off. |
| `setup.auto_instrument.mode` | string | `detected` | Which clients automatic setup considers. |
| `setup.auto_instrument.interval` | duration | `6h` | Time between automatic setup checks. User config can only lengthen it, and the minimum is one minute. |
| `setup.auto_instrument.refresh_existing` | bool | `false` | Also refreshes installed integrations. Needs `true` in managed config, and user config can turn it off. |
| `setup.auto_instrument.allow_clients` | list | `[]` | Clients automatic setup may install. User config can only shorten the managed list. |
| `setup.auto_instrument.deny_clients` | list | `[]` | Clients automatic setup skips. User and managed lists add up. |

### Clients

Each setting is off by default. A `false` in managed config or in your config
wins. [Supported clients](SUPPORTED-CLIENTS.md) says what
each client captures.

| Key | Type | Default | What it controls |
|---|---|---|---|
| `clients.codewhale.enabled` | bool | `false` | CodeWhale preview. |
| `clients.commandcode.enabled` | bool | `false` | CommandCode preview. |
| `clients.devin.enabled` | bool | `false` | Devin CLI preview. |
| `clients.forgecode.enabled` | bool | `false` | ForgeCode preview. |
| `clients.gptme.enabled` | bool | `false` | gptme preview. |
| `clients.grok.enabled` | bool | `false` | Grok Build preview. |
| `clients.kimi.enabled` | bool | `false` | Kimi Code CLI preview. |
| `clients.muse.enabled` | bool | `false` | Muse Code preview. |
| `clients.omp.enabled` | bool | `false` | Oh My Pi preview. |
| `clients.qoder.enabled` | bool | `false` | Qoder CLI preview. |
| `clients.vscode-copilot.enabled` | bool | `false` | VS Code Copilot Chat preview. |
| `clients.windsurf.enabled` | bool | `false` | Windsurf preview. |
| `clients.zcode.enabled` | bool | `false` | ZCode preview. |
| `clients.zed.enabled` | bool | `false` | Zed preview. |
| `clients.aider.history_sync` | bool | `false` | Reads Aider history. |
| `clients.agy.history_sync` | bool | `false` | Reads Antigravity CLI history. |
| `clients.copilot.history_sync` | bool | `false` | Reads GitHub Copilot CLI sessions in the background. |
| `clients.copilot.history_import` | bool | `false` | Allows `trajectory session import copilot`. |
| `clients.cursor.history_sync` | bool | `false` | Reads cursor-agent CLI transcripts that hooks missed. |
| `clients.kiro.history_sync` | bool | `false` | Reads Kiro CLI sessions that hooks missed. |
| `clients.mistral-vibe.history_sync` | bool | `false` | Reads Mistral Vibe session logs. |
| `clients.openclaw.history_sync` | bool | `false` | Reads OpenClaw sessions. |
| `clients.openhands.history_sync` | bool | `false` | Reads OpenHands conversations. |

### Server channels

| Key | Type | Default | What it controls |
|---|---|---|---|
| `server.otlp_proxy.enabled` | bool | `false` | Forwards OTLP logs and metrics upstream. |
| `server.otlp_proxy.endpoint` | string | `""` | Upstream OTLP HTTP URL. Setting it turns on the proxy. |
| `server.otlp_proxy.api_key_ref` | string | `""` | Credential sent as `dd-api-key` to OTLP intake. |
| `server.otlp_proxy.native_ml_app` | string | `<export.ml_app>-claude-native` | ML app for Claude Code's own traces. |

### Self-telemetry

| Key | Type | Default | What it controls |
|---|---|---|---|
| `telemetry.metrics.enabled` | bool | `true` | Sends Trajectory's own health metrics. |
| `telemetry.metrics.resource.window_duration` | duration | `5m` | Length of a resource sampling window, 5m to 1h. |
| `telemetry.metrics.resource.slots_per_window` | int | `20` | Samples in each resource window, 4 to 600. |

### Organization config

| Key | Type | Default | What it controls |
|---|---|---|---|
| `org.config_source` | string | `""` | Main source for remote organization config. It must use `https://`, or `http://` on this computer. |
| `org.markers_repo` | string | `""` | Older HTTP(S) source for organization config or markers. |
| `org.markers_path` | string | `""` | Path inside the organization config source. |
| `org.sync_interval` | int | `3600` | Seconds between organization config syncs, held between 60 and 14400. |

### Modules

| Key | Type | Default | What it controls |
|---|---|---|---|
| `modules.<id>.enabled` | bool | `false` | Turns a module on. |
| `modules.<id>.mode` | string | `observe` | `observe` or `enforce`. |
| `modules.<id>.config` | map | `{}` | Settings for the whole module. |
| `modules.<id>.hooks.observe` | list | `[]` | Hook events installed for observe mode. If both hook lists are empty, every declared hook installs. If either is set, both together list the allowed hooks. |
| `modules.<id>.hooks.enforce` | list | `[]` | Hook events installed for clients that enforce. |
| `modules.<id>.evaluators.<engine>.enabled` | bool | unset | Turns one evaluator on or off. |
| `modules.<id>.evaluators.<engine>.mode` | string | module mode | `observe` or `enforce` for one evaluator. |
| `modules.<id>.evaluators.<engine>.privacy_mode` | string | `""` | Privacy profile for one evaluator. |
| `modules.<id>.evaluators.<engine>.credential_redaction` | bool | `false` | Managed only. Removes credentials from the evaluator's request. |
| `modules.<id>.evaluators.<engine>.timeout_ms` | int | `0` | Evaluator timeout in milliseconds. |
| `modules.<id>.evaluators.<engine>.window_turns` | int | `0` | Turns of context for the evaluator. |
| `modules.<id>.evaluators.<engine>.config` | map | `{}` | Settings for one evaluator. |
| `modules.<id>.launch` | map | unset | Product opt-in for a module, separate from `enabled`. |

### Structured keys

Skill Scanner runs when AI Guard or available AI-EDR is enabled and managed
configuration turns on the `agent_security_skill_scanner` feature flag. The flag
is managed-only: user configuration and environment variables cannot change it.
Its mode is `modules.agent-security.evaluators.skill_scanner.mode`, falling back
to the module mode. It shares AI Guard's configured API-key and application-key
references. Set `modules.agent-security.evaluators.skill_scanner.config.endpoint`
to override the HTTPS scan service URL.

Selected skill files are uploaded without redaction, including credentials they
contain. These service uploads can run during incognito. Reporting to configured
destinations continues to follow their grants and privacy rules. Missing or
pending assessments allow use. Enforce mode blocks a completed malicious
verdict on supported hooks. Observe mode adds no client context.

`trajectory config set` does not accept these keys. Set them in YAML.

| Key | Type | Default | What it controls |
|---|---|---|---|
| `required_destinations` | list | `[]` | Managed destinations that user and repository config cannot remove. |
| `required_destinations[].backfill_opt_out` | bool | `false` | Stops backfill publishing to this destination. |
| `required_destinations[].historical_metrics_ingestion_confirmed` | bool | unset | Older name. `false` works like `backfill_opt_out: true`. |
| `publish_tags` | list | `[]` | Tags picked from a condition or a startup command. |
| `org.files` | list | unset | Organization files to sync, each with `name`, `path`, and `required`. It needs `org.config_source`, holds at most 9 entries, and accepts only known names and safe relative paths. |

## Optional Modules

`trajectory setup --clients` installs only observability and passive module
files. Controls that block need a product command, such as
`trajectory plugins enable datadog-security --setup --clients <list>`. Raw
module config cannot install or run a control. An evaluator with no `enabled`
value stays off. Turning on `datadog-security` sets `enabled: true` for both
`ai_guard` and `ai_edr`. `ai_edr` runs only if organization config makes it
available.

| Command | What it does |
| --- | --- |
| `trajectory plugins list` | Shows the opt-in product plugins and their state. |
| `trajectory plugins show datadog-security` | Shows one plugin. |
| `trajectory plugins install-plan <product-id> --clients <list>` | Previews the hook dispatch changes. |
| `trajectory plugins modules list` | Shows the built-in optional modules, such as `agent-security`, and their status. |
| `trajectory plugins modules capabilities <id>` | Shows a module's hooks, setup steps, evaluators, MCP entries, skills, commands, settings, and keychain names. |
| `trajectory plugins modules enable <id> --mode observe\|enforce` | Writes the module's `enabled` and `mode`. It installs no hooks. |
| `trajectory plugins modules configure <id> --set KEY=VALUE` | Changes `modules.<id>.config` on this computer. |
| `trajectory plugins modules evaluators <id>` | Shows evaluator status. `modules evaluator enable\|configure` changes `modules.<id>.evaluators.<engine>`. |
| `trajectory plugins modules records --module <id>` | Shows the module's foreground evaluator decisions. |

Module hooks log evaluator decisions to `~/.trajectory/modules/decisions.jsonl`.
Security hooks read managed config each time they run, so organization config
sync changes client gates without reinstalling hooks or restarting agents.
