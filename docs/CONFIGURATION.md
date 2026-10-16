# Configuration Guide
Use this page to view, change, and reset Trajectory settings. The second half
lists every setting with its default value.

Your settings are in `~/.trajectory/config.yaml`. An administrator can also
supply settings in `~/.trajectory/config.defaults.yaml`. For per-repo publish
rules in `publish.trajectory.yaml`, run `trajectory user-guide publish`.

For PATH recovery and help from your coding agent, read `user-guide install`.
If your shell cannot find `trajectory`, use the usual user installation path:

```bash
"$HOME/.trajectory/bin/trajectory" user-guide --format md install
```

If your binary is elsewhere, use the path from the installer or local `AGENTS.md`.
The installation guide explains how to start your agent in your Trajectory home
and use its local debugging instructions.

## View your settings
To see all the settings that Trajectory uses, run this command:

```bash
trajectory config show
```

It prints the merged settings from the built-in defaults and every config
file. It also prints a `# Pricing` status block. It does not show environment
variables, which change only the process that they apply to.

To see one setting, pass its key to `config get`:

```bash
trajectory config get export.traces
```

To find your config file, run this command:

```bash
trajectory config path
```

It prints the path of your `config.yaml`.

To change common settings in a menu, run `trajectory config` with no
arguments. The editor covers 14 keys, such as `capture.retention_days`,
`export.traces`, and `server.port`. Use `trajectory config set` for the other
keys. The editor shows these items:

- The `config.yaml` file that it writes.
- The managed files. The editor does not change them.
- The source of each value that it shows.
- The feature flags that managed config turns on or off.

The editor marks a protected managed value as read-only. You cannot change
that value in the editor. You can still override an ordinary managed default
if the rules for that setting allow it.

## Change a setting
To change one setting, run `trajectory config set` with the key and the value:

```bash
trajectory config set export.traces standard
```

This example sends standard trace content to Datadog. Write the key as a dot path, such as `export.traces`. The command changes only
that key in your `config.yaml`. It keeps your comments, your other values, and
fields that a newer version added. It does not copy managed values or
environment values into your file.

The command prints the value that Trajectory now uses. Managed config can keep
a different value. In that case, the command also prints your stored value,
the source of the value in use, and the order of precedence.

For lists and maps, use the commands for that area, such as
`trajectory config features`. An administrator deploys `required_destinations`
in managed config. Do not set it as a user setting.

## Reset a setting
Trajectory has no `unset` command. To go back to the default value, remove
your value:

1. Run `trajectory config path` to find your `config.yaml`.
2. Delete the line for the key from that file.
3. Run `trajectory config reload` to preview the change.
4. Follow the next step that the command prints. It tells you to reload with
   `--yes` or to restart, for example after a reset of `server.port`.

Do not set a key to its current default with `trajectory config set`. That
keeps the value in your file, so a later managed default does not apply to
you.

Some areas have their own reset command:

- `trajectory config features clear <name>` removes your override for a
  feature flag.
- `trajectory config capture enable` turns capture back on.
- `trajectory config publish opt-in` reverses a publish opt-out.

## Apply changes to running processes
`trajectory serve` reads config and environment variables when it starts.
After you change a setting, run these commands:

1. Run `trajectory config reload` to check the change and see what it affects.
2. Run `trajectory config reload --yes` to apply the change.
3. Run `trajectory ps` to see the running process and its sessions.

Some changes need a process restart. The reload command tells you when. See
[Reload live serve processes](#reload-live-serve-processes) for all options.

## How Trajectory chooses a value
Trajectory merges settings from these files, in this order. For most keys, a
later file wins over an earlier one.

1. Built-in defaults.
2. Managed `config.defaults.yaml`, which an administrator deploys.
3. An assigned `cohort.yaml` overlay, if one exists. Managed fleets use it to
   give a group of machines different settings.
4. Your `config.yaml`.

Then each process applies its own environment variables, such as `DD_SITE` or
`TRAJECTORY_PORT`. See
[Environment variable overrides](#environment-variable-overrides).

For these keys, a managed value wins over your `config.yaml`:

- `deployment.ring`, when managed config sets it, and `stable` on a Mac whose
  MDM profile selects organization files and whose managed config sets no
  ring.
- `auto_update`, when managed config sets `false`. A managed `true` also
  wins on a Mac where MDM lets Trajectory update itself.
- `local_ui.auto_start`, when managed config sets `false`.
- `auth.mode: managed_keychain`, and `auth.credential_source` and
  `auth.key_command` when managed config sets them.
- `export.site`, when managed config sets it. A Datadog API key from managed
  config is then never sent to a site that you chose.
- The whole `pricing.cursor` block, when managed config has one.
- All `org.*` keys, when managed config sets `org.config_source`.
- `tags` keys that both files set.
- Feature flags that managed config turns off.
- `required_destinations`, which user config cannot remove.

> **Note:** If an environment variable or a listed managed value sets a key,
> editing `config.yaml` has no effect on it.

`deployment.ring` is protected when managed `config.defaults.yaml` or the
assigned `cohort.yaml` sets it. An assigned cohort ring wins over the base
managed ring. Either managed value wins over your `config.yaml`. If managed
config does not set the ring, the self-managed user's selection applies.

Some Macs have an MDM configuration profile that selects organization files.
On those Macs, only the organization's `config.defaults.yaml` sets the ring. A
missing ring means `stable`, and a cohort assigned by the profile cannot set
it. Older profiles that select no files keep your ring when managed config
sets none.

### Historical whole-document config migration
Trajectory versions before v0.5.38 could save all merged settings into
`config.yaml`. On a managed machine, those copied values look like your own
choices. They can hide a later change to `config.defaults.yaml` or to a cohort.

Before it loads managed config, Trajectory looks for files in the format that
those versions wrote. If it finds a full match, it does these steps:

1. It backs up the file in `~/.trajectory/state/config-migrations/`. Only your
   user can read the backup.
2. It removes the values that match the old built-in defaults.
3. It keeps your own values, your comments, and fields from newer versions.
4. It records that the migration is done, so later reloads and restarts do
   not run it again.

If the file matches only in part, Trajectory does not change it. On a managed
machine, Trajectory then ignores the whole file, so managed and cohort
settings apply. `trajectory doctor` tells you how to reduce the file to the
values that you chose.

Current setup still writes the same header into a new `config.yaml`. So
Trajectory can match a file that managed setup wrote, even if no old release
saved it. After you reduce the file, its settings apply on the next reload.
`trajectory doctor` can show the warning after that.

Self-managed installs keep using the user file without changes.

The former `fossilized_user_config_migration` flag is removed, and
Trajectory ignores old overrides.

## Send data to Datadog
Trajectory captures sessions locally first. To send data to your own Datadog
organization, do these steps:

1. Run the setup command:

   ```bash
   trajectory publish destination configure
   ```

   It asks for your API key, checks it, and stores it in the OS keychain.
   Then it sets the `export.*` settings in your `config.yaml`. It sets the
   trace level to `standard` unless you pass `--traces`.
2. Apply the change to running processes:

   ```bash
   trajectory config reload --yes
   ```

3. Check the result:

   ```bash
   trajectory publish validate
   ```

   It checks your credentials and the destination that Trajectory builds
   from them.

These commands do not change managed `required_destinations`.

To configure without a prompt, pass the key on standard input. Do not put the
key in a command argument, because other processes can read arguments.

```bash
printf '%s\n' "$DD_API_KEY" | trajectory publish destination configure \
  --non-interactive --api-key-stdin --site us5.datadoghq.com \
  --ml-app coding-agents --traces standard --metrics
```

Trajectory uses `export.site`, `export.ml_app`, `export.traces`, and
`export.metrics` to build one Datadog destination named `_config_datadog`. Do
not add a `type:` field under `export:`.

To send metrics without traces, use these settings:

```yaml
export:
  site: us5.datadoghq.com
  ml_app: coding-agents
  traces: off
  metrics: true
```

With these settings, Trajectory sends metrics. It does not send LLM
Observability trace spans.

### Publish full traces while developing
Trace export is off by default. Turn it on only when you need remote traces,
for example to debug a problem or for an approved destination:

```bash
trajectory config set export.traces full
```

The trace levels are `off`, `minimal`, `standard`, and `full`. If you run
`trajectory setup` again, it keeps a trace level that is not `off`. It prints
the level that it keeps. If the level is `full`, interactive setup asks before
it keeps it. The safe answer is to go back to `off`. Setup without prompts
cannot ask, so it prints a warning when it keeps `full`.

### Check your API key
`trajectory publish validate` shows where each destination gets its key. It
also shows the format of the key, but never the key itself. A good Datadog API
key shows `normalized_shape=datadog-api-key` and `valid_format=true`.

Some credential tools wrap the key, for example as
`go-keyring-base64-wrapper`. Trajectory removes the wrapper before it uses the
key. If you see `valid_format=false`, do one of these steps:

- Run `trajectory config set-secret dd_api_key` and enter the key again.
- Fix the `DD_API_KEY` variable or the `api_key_command` that supplies the key.

## Keep data local
To capture sessions locally without sending anything to Datadog, do these
steps:

1. Turn off trace export:

   ```bash
   trajectory config set export.traces off
   ```

2. Turn off metrics export:

   ```bash
   trajectory config set export.metrics false
   ```

Trajectory still writes JSONL files to `~/.trajectory/trajectories/`.

These settings remove only your own `_config_datadog` destination. Managed
`required_destinations` still receive data. To stop content for destinations
that are not `incognito_exempt`, run `trajectory config publish opt-out`.
Exempt destinations can still receive approved events. To stop all capture,
run `trajectory config capture disable`.

## Stop capture
### Disable capture for this user
To stop all new capture for your user, run this command:

```bash
trajectory config capture disable
```

To start capture again, run this command:

```bash
trajectory config capture enable
```

`capture disable` creates the file `~/.trajectory/capture.disabled`. The file
stays until you run `capture enable`. While it exists, Trajectory discards new
hook, watcher, and OTLP events and writes no JSONL. Running servers check the
file for each event, so you do not need to restart anything. Both commands
accept `--json`.

The `trajectory_disable_command` feature controls `capture disable` and is on
by default. The command fails and creates no file in two cases:

- An administrator turned off the `trajectory_disable_command` feature.
- Managed capture policy requires capture on this machine.

In those cases, use `TRAJECTORY_DISABLED=1` for one process. `capture enable`
always works.

Both commands also update the installed Claude Code plugin. While capture is
off, the plugin has no HTTP `SessionEnd` hook. So Claude does not print a
`SessionEnd hook ... ECONNREFUSED` error when you exit. `capture enable` adds
the hook back for new Claude sessions. A Claude session that is already
running can keep its old hooks until you restart it.

### Disable capture for one launched command
To run one command without capture, set `TRAJECTORY_DISABLED=1` for it:

```bash
TRAJECTORY_DISABLED=1 claude "review this repo without recording"
```

`TRAJECTORY_DISABLED` applies only to the process that you start with it. It
wins over `trajectory config capture enable`. To clear it, unset the variable
and restart the process. A server that starts with this variable still opens
its health endpoint. But it discards capture data and writes no JSONL. The
variable does not change the installed Claude Code hooks.

### Keep capture but stop sending content
For privacy during one agent session, use `/incognito`. Incognito keeps local
JSONL capture, segmentation, semantic analysis, and accounting metrics. It
stops sending trace and log content to Datadog destinations that are not
exempt. By default, its metrics leave out model and repository names.

To apply the same limits to all your sessions, run
`trajectory config publish opt-out` once. The `persistent_incognito` feature
controls this command and is on by default. To reverse it, run
`trajectory config publish opt-in`. Opt-in applies to new sessions. A session
that started during the opt-out stays limited until it ends. Managed
destinations with
`incognito_exempt: true` still receive data. For details, run
`trajectory user-guide privacy`.

## Add global publish tags
Use a top-level `tags:` map to add the same tags to all Datadog data from one
machine. Put it in `~/.trajectory/config.yaml` or in managed
`~/.trajectory/config.defaults.yaml`:

```yaml
tags:
  team: platform
  environment: development
  workspace: cloud
```

Trajectory adds these tags when it publishes. They go on Datadog LLM
Observability spans and on Trajectory metric series. This includes base,
marker, heartbeat, and task metrics.

Trajectory does not add these tags to these places:

- Local JSONL files.
- OTLP exports.
- Claude native OTLP proxy metrics.
- Process health and privacy counters.

Trajectory combines your `tags:` map and the managed one. If both set the same
key, the managed `config.defaults.yaml` value wins. Destination-level `tags:`
apply only to that destination. They can come from a trusted destination or
from `publish.trajectory.yaml`. For a key that both use, Trajectory applies the
managed top-level value again.

Use tags with few, stable values, such as `team`, `environment`,
`deployment`, or `workspace`. Do not put these items in tags:

- Prompts, file paths, or URLs.
- Email addresses, commit SHAs, or random IDs.
- Secrets.

To tag a user, email, or GitHub account, use the `identity.*` settings.

To pick a tag value from a condition or from a command at startup, use
top-level `publish_tags:`. Only trusted user config or managed config can use
a command. The command must use an absolute path and runs without a shell.
You must list its `allowed_values`. It runs in the background with a timeout
of at most one second. For the schema, limits, and kill switch, run
`trajectory user-guide publish`.

## Set user identity tags
Every span and metric has a `trajectory.user` tag. Its value comes from
`TRAJECTORY_USER` or from your system username. Trajectory adds
`trajectory.user_email`, `git.email`, and `github.username` only when it finds
a value.

### Set your email
Trajectory uses the first of these sources that gives an email:

1. `TRAJECTORY_USER_EMAIL`
2. `identity.user_email`
3. `identity.user_email_command`
4. `identity.user_email_suffix` added to `trajectory.user`

Steps 2 to 4 follow the normal config order first. A value in your
`config.yaml` replaces a managed or cohort value before Trajectory picks a
source.

If you set both a command and a suffix, the command wins when it returns a
valid email. If the command fails, times out, or returns no valid email,
Trajectory uses the suffix. Trajectory splits the command on spaces and runs
it without a shell, with a short timeout.

To set the email from Git during setup, run this command:

```bash
trajectory setup --clients codex --user-email "$(git config --global user.email)"
```

To use one email for every session on this machine, set it:

```bash
trajectory config set identity.user_email user@example.com
```

If your Unix username matches the part of your email before the `@`, a suffix
is often enough. This example makes `jdoe` into `jdoe@example.com`:

```bash
trajectory config set identity.user_email_suffix example.com
```

To read the email from Git each time, set a command:

```bash
trajectory config set identity.user_email_command "git config --global user.email"
```

After each of these changes, run `trajectory config reload --yes`.

To set the email for one shell or one process, use the environment variable:

```bash
export TRAJECTORY_USER_EMAIL=user@example.com
```

Running `trajectory serve` processes read the `identity.*` settings. After you
change them, run `trajectory config reload --yes`. Then run `trajectory ps` to
confirm the reload. New spans and metrics use the new tags after the reload or
restart. An environment variable applies only to processes that start with it.

### Set your Git email and GitHub username
Trajectory finds `git.email` and `github.username` separately. For each one,
it uses the first of these sources that gives a value:

1. `TRAJECTORY_GITHUB_EMAIL` or `TRAJECTORY_GITHUB_USERNAME`
2. `identity.github_email` or `identity.github_username`
3. `identity.github_email_command` or `identity.github_username_command`
4. Git config in the repo of the session's `project_dir`
5. Global Git config

For `git.email`, Trajectory reads Git `user.email`. For `github.username`, it
reads `github.user` or `github.username`. If both are set, it uses the one
that comes first in the Git config file. A repo value wins over a
global value, so a repo can use a different identity. A command wins over Git
config when it returns a valid value. If the command fails, times out, or
returns nothing valid, Trajectory uses Git config.

To set a default email for the whole machine, use Git config:

```bash
git config --global user.email user@example.com
```

To set a default GitHub username, set `github.user`:

```bash
git config --global github.user your-github-username
```

## Store secrets and API keys
### See and manage config-related secrets
Keep secrets in the OS keychain. Do not put them in YAML files.

To store your Datadog API key, run this command:

```bash
trajectory config set-secret dd-api-key
```

It asks for the value without showing it, and saves it in the keychain. To
pass the value from a script, add `--stdin`. `dd-api-key` and
`dd_api_key` are two names for the default Datadog API key.

To list the secrets that Trajectory can find, run this command:

```bash
trajectory config secrets
```

It shows which well-known secrets are stored. It never prints values.

To delete a secret, run this command:

```bash
trajectory config delete-secret dd-api-key
```

Managed installs use the keychain account names in `api_key_ref` as
written. To store a key under one of those names, add `--exact-name`:

```bash
trajectory config set-secret dd-primary-api-key --exact-name
```

Without `--exact-name`, Trajectory changes the name to its normal form.

To check whether Trajectory can read named entries without a prompt, pass the
names to `config secrets`:

```bash
trajectory config secrets dd-primary-api-key
```

It reads each name as written and prints one line per name, such as
`dd-primary-api-key: readable`. Other states include `missing` and
`needs_authorization`. The command never prompts or unlocks a keychain. It
exits 0 only when every name is readable. Add `--json` for JSON output. Named
checks run on macOS and Windows. On other platforms the command reads nothing
and reports `not_checked`.

`set-secret` reads the old value first. Then it writes the new value. If the
write fails, it tries to put the old value back. If setup or `set-secret`
reports a keychain problem, do one of these steps:

- Run `trajectory config set-secret dd_api_key` again.
- Set `DD_API_KEY` for now and run `trajectory publish validate`.

### Unlock the keychain on macOS
On macOS, Trajectory background work never shows a keychain dialog. This
includes hooks, `serve`, and publish. If the keychain with your secrets is
locked, those reads fail. The error names `trajectory config secrets`.

To unlock the keychain, run `trajectory config secrets` in a terminal. It asks
once for the keychain password through `/usr/bin/security unlock-keychain`.
Then it checks the secrets again without a prompt. The keychain stays unlocked
until its own settings lock it, for example on sleep or logout. Background
reads work during that time.

The command never prints secret values. It does not ask for a password when
its input is not a terminal.

Trajectory uses your user keychains only. It never asks you to unlock
`System.keychain`. `config secrets` names a locked user keychain and explains
permission, timeout, and read errors. To see each keychain and the accounts
in it, run `trajectory doctor`. It does not show secret values.

### Approve a keychain item Trajectory cannot read
A keychain item can exist, but Trajectory may not be able to read it without
a macOS prompt. This happens, for example, when an earlier Trajectory build or
another tool created it. Background reads report this as authorization
required, not as a missing secret.

Sometimes only `/usr/bin/security` can read the item. Items that older
releases and some MDM install scripts stored are like this. A
certificate-signed Trajectory build fixes this without a prompt.
`trajectory config set-secret`, `trajectory setup --managed-keychain`, and the
Jamf `reconcile-current-user.sh` script replace that item with one Trajectory
owns. The replacement keeps the
value, or uses the new one that `set-secret` was given. If a step fails, the
original item is put back. An item that other applications can read, or that
more than one keychain holds, is left as it is. After the replacement,
`/usr/bin/security` and releases that read through it need approval to read
the item.

When you give `set-secret` the whole value, `--replace-unreadable` also
replaces those items. The Jamf `reconcile-current-user.sh` script passes it.
A certificate-signed build then deletes every copy of the name that it cannot
read without a prompt, or that it did not create. It does not read the old
value first. It saves the new value in one item it owns. If the save fails after the
delete, the command exits nonzero and the name holds no item until you run it
again. An ad-hoc signed build changes nothing.

If the item stays unreadable, run
`trajectory config set-secret <name> --exact-name --replace-unreadable` as the
signed-in user and enter the value. It shows no prompt. An ad-hoc signed build
cannot replace the item.

### Use environment variables for keys
For CI or a short-lived shell, you can set `DD_API_KEY` or `DATADOG_API_KEY`.
For daily use, store the key with `trajectory config set-secret dd_api_key` or
use a key command.

An environment variable applies only to processes that start after you set
it. A `trajectory serve` process that started earlier cannot see it.
Setup-managed Codex hooks run
`trajectory capture-hook --client codex --ensure-serve`, which can check or
start a local capture server. A stored key still works better.

To run setup again with the key in the environment, use this command:

```bash
DD_API_KEY=... trajectory setup --site datadoghq.com --ml-app coding-agents --clients codex --non-interactive
```

To store the key once so that every process can find it, use this command:

```bash
trajectory config set-secret dd_api_key
```

### How Trajectory finds the Datadog API key
A `datadog_agent` destination needs no key, because the Datadog Agent sends
the data. For other destinations, Trajectory checks these sources in order. It
uses the first key that it finds:

1. An environment variable named after `api_key_ref` in capital letters. Then
   `DD_API_KEY`, then `DATADOG_API_KEY`.
2. The key command in `auth.key_command`, if you or managed defaults set one.
   Trajectory uses it only for the default Datadog key. There is no built-in
   key command, and a managed `auth.key_command` wins over yours.
3. The OS keychain account named in `api_key_ref`.
4. The destination's `api_key_command`.

If no source has a key, the lookup fails with an error.

To use only one source and skip the others, set `auth.credential_source`. The
values are `auto`, `env`, `key_provider`, `keychain`, and `api_key_command`.
This example uses only the keychain:

```bash
trajectory config set auth.credential_source keychain
```

To go back to trying every source in order, set the value to `auto`.

`trajectory doctor`, `trajectory publish validate`, and serve logs show the
policy, the source in use, and the key format. In `auto` mode, Trajectory
reports a malformed Datadog environment variable early. Then it tries the next
sources, such as the key command, the keychain, or the destination command.
Set `auth.credential_source` if you want a bad key to fail instead. This finds
cases where a variable holds a secret-manager ID or a wrapper and not the key.

`auth.mode: managed_keychain` works differently. It reads only the keychain
accounts named in `api_key_ref`. It keeps results in memory and shares one
lookup between requests that arrive together. It skips environment variables,
key commands, and destination commands. Managed destinations must name the
keychain account that they expect.

Trajectory accepts common wrapped forms of an API key:

- `DD_API_KEY=...`
- A quoted value.
- A JSON object with `DD_API_KEY` or `SecretString`.
- The macOS `go-keyring-base64:` storage wrapper.

After Trajectory removes the wrapper, the key must be 32 letters and digits.

Datadog application keys come from the destination `app_key_ref` first. Then
Trajectory uses the default `dd_app_key` or `DD_APP_KEY`. Commands that need
an application key say which permission they need. That is Metrics query
permission or log configuration write permission.

For team repos that use `api_key_command` and more than one destination, run
`trajectory user-guide publish`.

## Control Trajectory-owned LLM calls
Most Trajectory work does not call an LLM. This includes capture, metrics,
marker evaluation, and Datadog publish. These features can call an LLM:

- Task segmentation.
- A confirmed `trajectory patterns analyze` run.

More detail on segmentation:

- Task segmentation splits a session into tasks and makes one provider call
  per pass. Automatic segmentation is off by default. It runs only when the
  `automatic_task_segmentation` feature flag is on, and then
  `segmentation.enabled` and the other `segmentation.*` settings apply. Even
  with the flag on, automated calls stay held until a headless CLI has a
  provider hard stop, so new sessions are not segmented. Tasks that are already
  stored can still publish task metrics when `segmentation.publish_metrics` is
  on. See `trajectory user-guide llm-capacity`.
- Work Insights labels come only from a `trajectory patterns analyze` run that
  you confirm.

To turn automatic task segmentation on, run this command:

```bash
trajectory config features enable automatic_task_segmentation
```

While the flag is on, `trajectory config set segmentation.enabled false` turns
it off again.

Each automated feature has a monthly spending limit in US dollars. Trajectory
counts each UTC calendar month separately. Set the limit to `0` to block
automated calls. A `patterns analyze` run that you confirm still runs.

Each segmentation call to a provider has its own four-minute limit. The
13-minute `segmentation.final_pass_timeout` and
`segmentation.recovery_timeout` limits cover the whole sequence. So one slow
segmentation call cannot use up all the time.

For how often each call runs and what it costs, run this command:

```bash
trajectory user-guide llm-capacity
```

Sensitivity scanning was removed, so Trajectory makes no sensitivity
classifier calls. These settings still load, and Trajectory ignores them:

- `export.sensitivity.*`
- the destination keys `privacy.sensitivity_classifier`,
  `privacy.sensitive_policy`, and `privacy.sensitivity_exempt`
- the `sensitivity_scanning` feature

For more detail, run `trajectory user-guide privacy`.

## Tune backfill
Backfill rebuilds local data from client history and publishes older data.
Local work and publishing have separate settings.

To rebuild the last 60 days of local data by default, run this command:

```bash
trajectory config set backfill.local.days 60
```

To use two workers for background indexing, run this command:

```bash
trajectory config set backfill.local.background_threads 2
```

To publish only the last 14 days by default, run this command:

```bash
trajectory config set backfill.publish.days 14
```

All `backfill.*` settings follow the normal config order. Changes apply on
the next command or the next background run. `trajectory backfill status`
shows both windows.

On the command line, `--last` replaces both windows for that run. `--since`
and `--until` also win over the settings. With only `--until`, each window
ends on that date and uses its configured length.

`backfill.local.days` sets the default window for local `trajectory backfill`.
A full `trajectory session reindex` and its background worker still check
every session that Trajectory keeps. These settings do not delete local
history. They do not change which clients Trajectory imports from.
`capture.retention_days` is a separate setting that deletes old files.

The thread settings set the number of indexing workers that run at the same
time. They do not reserve CPU cores or limit total CPU use. A reindex of one
session always runs in order. The background default is one worker with the
normal pause between sessions. More than one worker indexes sessions at the
same time with no pause. These settings do not change publishing or network
retries.

On a Mac, background indexing waits while the Mac runs on battery power. Live
capture keeps running. If the Mac switches to battery during a pass, the pass
stops after its current batch and saves its place. When the Mac is on
external power again, the pass resumes from that place. While work waits,
Trajectory checks the power source once a minute. To see a paused pass, run
`trajectory session import-jobs`.

This pause applies only to background indexing. Commands that you run, such as
`trajectory session reindex` and `trajectory backfill`, run on battery too.
Trajectory does not check the power source on Linux or Windows.

To let background indexing run on battery, run this command:

```bash
trajectory config set backfill.local.pause_on_battery false
```

`backfill.publish.days` sets the default window for these commands:

- `trajectory cost publish`
- `trajectory session publish`
- `trajectory patterns publish`
- `trajectory publish history`
- The publish step of `trajectory backfill --apply --publish`

Publishing never goes back further than `capture.retention_days`. By default,
each destination starts at its oldest delivery record in the metric outbox.
An explicit `--since` can go further back, with a warning.

Managed backfill reconciliation uses `backfill.publish.days` when
`backfill_reconciliation.window_days` is missing or zero. The older name
`historical_replay.rolling.window_days` works the same way. A positive managed
value sets its own window, from 1 to 3650 days. Reconciliation still skips the
most recent complete UTC day. Local config cannot turn on managed replay or
change its sources or destinations. It also cannot override a positive
managed window.

For workflows and publish rules, run `trajectory user-guide backfill`.

## Feature flags
Feature flags turn behavior on or off during a rollout. They also work as
emergency kill switches.

To see every flag and whether it is on, run this command:

```bash
trajectory config features list
```

To see one flag and the source of its state, run `status`:

```bash
trajectory config features status file_work_indicators
```

To turn a flag on for your user, run `enable`:

```bash
trajectory config features enable file_work_indicators
```

To turn a flag off, run `disable` with the flag name. To remove your override
and go back to the default, run `clear`:

```bash
trajectory config features clear file_work_indicators
```

Trajectory saves your flag changes in `~/.trajectory/config.yaml`:

```yaml
features:
  enabled:
    - file_work_indicators
  disabled: []
```

Managed `~/.trajectory/config.defaults.yaml` can turn a flag off. If an
administrator turns a flag off, your config cannot turn it on.

To change flags for one process, set `TRAJECTORY_ENABLE_FEATURES=name_a,name_b`
or `TRAJECTORY_DISABLE_FEATURES=name_a,name_b`. If a flag is in both lists,
Trajectory turns it off.

After you change a flag, run `trajectory config reload --yes`. This applies the
change to a running `trajectory serve` process.

### Agent Security client gates
Agent Security has a separate managed gate for each client: Claude Code,
Codex, GitHub Copilot CLI, and Cursor. Each gate is on by default when the Agent Security module
is on. To turn off one client, an administrator adds it to
`config.defaults.yaml`:

```yaml
features:
  disabled:
    - agent_security_codex
```

The other gates are `agent_security_claude_code`, `agent_security_copilot`,
and `agent_security_cursor`.
Only managed config can set them. Environment variables cannot change them.

Security hooks read the managed config each time they run. So an org config
sync changes a client gate without a hook reinstall or an agent restart. To
turn off Agent Security for all clients, use `modules.agent-security.enabled`.
Normal Trajectory capture does not read these gates.

## Configure Cursor native pricing
Trajectory always publishes Cursor input, output, cache-read, and cache-write
tokens when Cursor reports a complete set. Pricing in US dollars is a
separate setting:

```yaml
pricing:
  cursor:
    mode: emit       # off | shadow | emit
    source: org_file # org_file | datadog_reference_table
```

The default is `mode: emit` with `source: org_file`. With this default,
Trajectory publishes USD only when it has a valid
`~/.trajectory/org/pricing.yaml`. Without that file, Cursor usage has no
price. If `source` is empty, Trajectory turns pricing off.

The modes work like this:

- `off` publishes no Cursor USD.
- `shadow` checks capture and rate lookup but publishes no USD.
- `emit` publishes USD. Use it only after your organization accepts the rate
  card for each model.

If managed config has a `pricing.cursor` block, Trajectory uses the whole
managed block and ignores yours. This includes `mode: off`, so user config
cannot override that kill switch. A managed block must set both `mode` and
`source`. If it sets only `mode`, the source is empty and pricing is off.

The sources work like this:

- `org_file` reads the rate catalog at `~/.trajectory/org/pricing.yaml`.
  Trajectory checks the file and the dates when each rate applies. A full
  `org.config_source` sync can copy it from a repo `pricing.yaml`. The older
  source that syncs only markers does not.
- `datadog_reference_table` is not built yet. If you select it, Trajectory
  reports `pricing_source_unavailable` and publishes no USD.

A separate general price lookup can read `~/.trajectory/pricing.yaml`. A
managed source that you select never falls back to that file or to a public
rate card.

### Provider pricing and model names
A full org config sync also copies two more files:

- `~/.trajectory/org/provider-pricing.yaml` holds public provider prices with
  their dates. Claude Code and other clients share it. It includes rules for
  cache TTL, fast mode, and long context.
- `~/.trajectory/org/model-equivalence.yaml` maps model names as clients
  report them to provider models. It keeps thinking, speed, billing, and
  context modes separate.

Trajectory shows guessed model matches only in diagnostics. It never prices
usage from a guess.

Fast modes keep their own billing unit. Trajectory detects Codex GPT-5.6 fast
mode from its service tier. It reports `speed_mode=fast` and
`billing_mode=fast`. That mode uses 2.5 times the ChatGPT credits. Trajectory
does not turn those credits into API dollars, so the API cost uses the
Standard rate. Model names for the API Priority tier use the provider's
Priority rate, which is two times the Standard rate.

Trajectory does not combine fast and long-context price multipliers unless the
provider documents that combination. GPT-5.6 fast usage above the Priority
context limit has no price. Trajectory reports it as
`fast_tier_long_context_unsupported`.

For the formula, catalog schema, rate sources, and rollout steps, run
`trajectory user-guide cursor-cost`. For Cursor install and capture, run
`trajectory user-guide clients/cursor`.

## AI Gateway launch routing
`trajectory claude` and `trajectory codex` can send model requests through an
AI Gateway adapter. Each launch starts its own adapter on the local loopback
interface. The `--gateway` option works now and needs no feature flag.

To start Claude Code through a gateway profile, run this command:

```bash
trajectory claude --gateway example-openweights
```

To start Codex with one model from the profile, add `--gateway-model`:

```bash
trajectory codex --gateway example-openweights --gateway-model glm-5.2
```

By default, a launch uses the gateway only when you pass `--gateway`. Without
it, both commands connect straight to the provider. The
`ai_gateway_default_routing` feature is off by default. It controls only the
automatic choice from `ai_gateway.defaults`. `--no-gateway` always connects
straight to the provider, even when that feature is on.

An organization can supply this config in `config.defaults.yaml` or in an
assigned `cohort.yaml`. It can also come from an organization config source:

```yaml
ai_gateway:
  defaults:
    claude: example-openweights
    codex: example-openweights
  upstreams:
    example-chat:
      protocol: openai_chat_completions
      base_url: https://ai-gateway.example/v1
      timeout: 10m
      auth:
        type: pup_bearer
        cache_ttl: 4m
      headers:
        X-Organization: example
    anthropic-api:
      protocol: anthropic_messages
      base_url: https://anthropic-gateway.example/v1
      auth:
        type: x_api_key_secret
        secret_ref: anthropic_api_key
  profiles:
    example-openweights:
      display_name: Example Open Models
      default_model: glm-5.2
      models:
        glm-5.2:
          upstream: example-chat
          upstream_model: baseten/glm-5.2
          aliases: [glm-latest]
          claude_alias: claude-glm-5.2
          context_window: 1000000
          max_output_tokens: 131072
          request_max_output_tokens: 65536
```

The upstream protocols are `openai_chat_completions` and
`anthropic_messages`. The auth types are `pup_bearer`, `bearer_secret`,
`x_api_key_secret`, and `none`.

- The secret auth types store only a `secret_ref` name. To supply the value,
  run `trajectory config set-secret <name>` or use the managed keychain.

### Use a Pup session
To use an existing Pup login, set the upstream auth block like this:

```yaml
auth:
  type: pup_bearer
  cache_ttl: 4m # optional; accepts 30s through 15m
```

Before you use it, do these steps:

1. Install Pup v1.18.1 or later on your `PATH`.
2. Log in to Pup with the scopes that your upstream needs.

`pup_bearer` runs `pup auth token` with no other arguments and no shell. The
adapter sends the token to the upstream as `Authorization: Bearer <token>`.
Pup picks the credential from its environment and saved session. Trajectory
does not pick a site, audience, or scope. This auth type accepts only `type`
and `cache_ttl`. It does not turn on Frontier routing or run `pup auth login`.

### Tokens, retries, and limits
The `pup_bearer` auth type keeps a working token in memory for four minutes
by default. Requests that arrive together share one token request. Each command
has a 10-second timeout and a 16 KiB limit for each output stream. The request
fails in these cases:

- The helper command is missing or fails.
- The token is empty or malformed.

Trajectory never uses an expired cached token.

If the upstream returns 401, the adapter drops that token and tries once more.
Then it passes the response on. A late 401 cannot drop a newer cached token.
When Trajectory asks Pup again, Pup can refresh its saved session if needed.
Trajectory does not force Pup to renew a token that is still valid. Other
status codes and errors during a stream do not cause a retry.

If routing or protocol conversion fails, the adapter rejects the request. It
never falls back to your direct provider credentials. The adapter has these
limits:

- It accepts only a random credential that is new for each launch.
- It listens on a temporary `127.0.0.1` port.
- It limits requests and non-streaming responses to 64 MiB.
- It stops when the client process stops.

Anthropic-to-Anthropic routing keeps extra request fields and stream events.
Routing between the two protocols supports text, images, tools, tool results,
stop controls, and usage. If content has no safe match in the other protocol,
the adapter rejects it. It does not drop the content without notice. A capture
failure does not affect the model response.

## Choose publish backend and transport
For a normal setup with one destination, do not set a backend or a transport.
The `export.*` settings create `_config_datadog`. Its traces and metrics use
agentless OTLP by default.

You set the backend only on destination objects. These are in user or managed
`required_destinations`, or in a repo publish file that allows a project
destination for metrics only:

| Backend | Config value | Use it when |
|---|---|---|
| Datadog | `type: datadog_agentless` | Trajectory sends data with a Datadog API key. Traces and metrics use agentless OTLP by default. |
| Datadog Agent | `type: datadog_agent` | A local Datadog Agent handles sending and credentials. |
| OpenTelemetry collector | `type: otlp` | Trajectory sends traces, metrics, and marker logs to an OTLP HTTP collector. |

`dd-agent` is not a valid value. Use `datadog_agent`. Trajectory still accepts
the old names `datadog`, `dd_llmobs`, and `dd_llmobs_via_agent`. Use
`datadog_agentless` and `datadog_agent` in new config.

The trace level is separate from the transport. For `_config_datadog`,
`export.traces` sets the trace level. For other destinations, the destination
`level` sets it. `export.metrics` and the destination metric settings control
metrics.

A `datadog_agentless` destination always sends traces and live metrics over
agentless OTLP. To send traces to another OTLP endpoint, set
`otlp_traces_url`. Older configs that set `traces_transport` to `direct`, `dd`,
`llmo`, or `llmobs` still load. Trajectory logs one warning for each such
destination and sends its traces over OTLP. Remove the setting from your
config. Trajectory also still loads `metrics_transport` and `metrics_url`. They
do not change routing.

`server.otlp_proxy` is a different feature. It forwards OTLP data that clients
send to `trajectory serve`. It does not choose where Trajectory publishes.

## Managed destinations
An administrator deploys `required_destinations` in `config.defaults.yaml`,
usually through MDM. Users do not edit it. User and repo config cannot remove
these destinations.

Each entry sets `type: datadog_agentless`, `type: datadog_agent`, or
`type: otlp`. Your own `export:` block does not use `type`. An OTLP
destination sends traces, metrics, and marker logs to its `endpoint`. It
authenticates at the collector, not with a Datadog API key.

### Bearer tokens
A destination that sends to a custom intake or forwarder can use
`bearer_token_ref` in place of `api_key_ref`. First turn on the
`bearer_destination_auth` feature, which is off by default. Trajectory sends
the named secret as `Authorization: Bearer`. These rules apply:

- A destination cannot set both `bearer_token_ref` and `api_key_ref`.
- A bearer token never falls back to the Datadog API key variables.
- Bearer endpoints must use HTTPS. Loopback HTTP endpoints for development are
  the only exception.
- Trajectory does not follow redirects on authenticated requests.
- Managed bearer OTLP destinations are rejected. A publish config file that
  sets `bearer_token_ref` must use `version: 2`. A repository's
  `publish.trajectory.yaml` cannot add a bearer destination, because project
  destinations are metrics-only.

A managed forwarder that sends straight to Datadog uses
`type: datadog_bearer`. It keeps `level: off` and sets the real level in
`bearer_level`. An older binary that reads these settings rejects them.

The destination `records` block is retired. Trajectory still loads and checks
`records.enabled` and `records.kinds`, but it publishes no records.

### Event streams
A managed Datadog destination can set `event_stream.enabled: true`. This sends
one log for each Trajectory event, for approved security detections.
`event_stream.privacy_profile` accepts these values:

- `security` is the default. It keeps the whole captured event. It adds
  `tool_operation` values that do not depend on the client, and it keeps the
  original tool names.
- `full` also keeps the whole event. The older `include_private_fields: true`
  means the same thing.

Trajectory rejects other values, such as `minimal`, because security event
streams never remove fields.

A repo `publish.trajectory.yaml` cannot turn on or change event streams. For
details, run `trajectory user-guide security-event-stream`.

### Backfill to a destination
Datadog destinations accept backfilled data by default. To stop backfill
publishing to one destination, set `backfill_opt_out: true` on it. This also
stops the publish commands for that destination. The older
`historical_metrics_ingestion_confirmed: false` does the same thing.

## Automatic updates
`auto_update` turns automatic background update checks on or off. The default
is `true`. Automatic updates also need the `automatic_self_update` feature,
which is on by default. When the installer creates a new
`~/.trajectory/config.yaml`, it writes this value:

```yaml
auto_update: true
```

To stop automatic updates on one machine, set `auto_update: false` in your
config. A managed `auto_update: false` in `config.defaults.yaml` wins over
your config. On a Mac where MDM lets Trajectory update itself, a managed
`auto_update: true` wins too. See [Managed Macs](#managed-macs). `auto_update`
does not block a `trajectory update` that you run yourself.

Update checks and downloads use GitHub HTTPS authentication from
`GITHUB_TOKEN` or `gh auth token`. They do not use Git credential helpers or
SSH keys. On macOS, updates download the binary for the running
architecture: `trajectory-darwin-arm64` or `trajectory-darwin-amd64`. They do
not download the larger universal binary.

### When an opt-out takes effect
Where the setting is yours, a running background service applies an opt-out
before its next check after it reloads settings. For example, run `trajectory config reload --yes`. If the
reload fails, the old setting stays.

If you turn updates back on, checks start at the next scheduled check. This
works only if the service started with updates on. If the service started with
updates off, a reload does not start them. They start when the service next
starts, usually after a restart of `trajectory serve`.

### Managed Macs
When your administrator's `config.defaults.yaml` sets `auto_update`, the
managed value can win over yours:

- **Managed `auto_update: false`.** A managed profile sets this when your
  administrator's installer owns updates. Your `auto_update: true` has no
  effect.
- **Managed `auto_update: true`.** A managed profile sets this when MDM lets
  Trajectory update itself. After managed setup finishes on your Mac, your
  `auto_update: false` has no effect, and background updates stay on.

A `config.defaults.yaml` that sets `auto_update: true` but did not come from
such a profile is an ordinary default, and your `auto_update: false` applies.
Examples are a file that IT copied to the Mac directly and a file fetched
from an organization source that you chose.

Trajectory tells you when this happens.
`trajectory config set auto_update false` stores your value and prints the
effective `auto_update = true`. It also prints a `conflict:` line and a
`note:` that says the value is managed and names the managed file that sets
it. `trajectory config get auto_update` prints the effective value and the
same note. `trajectory doctor` shows **Automatic updates** with the effective
value and the file that decided it. `trajectory status` prints a note while
`config.yaml` stores a value that you set and that has no effect.

The managed value covers the `auto_update` setting only.
`TRAJECTORY_AUTO_UPDATE=0` always stops background update checks for the
process that sets it. Your own `features.disabled: [automatic_self_update]`
stops them only when Trajectory is using your `config.yaml`. On a managed
machine it has no effect while the
[historical-config migration](#historical-whole-document-config-migration)
ignores the file. It ignores the file that setup writes only when your site is
`datadoghq.com` and none of `auto_update`, `export.site`, `export.traces`, and
`required_destinations` has changed since setup. Ask your administrator if background updates should be off for everyone on the
profile.

When `config.defaults.yaml` does not set `auto_update`, or there is no managed
config, your value applies.

Your organization's release ring also replaces any `deployment.ring` that you
set. Its remote config selects that ring, and the Mac uses `stable` until that
config arrives or when it selects none. Remote config cannot change
`auto_update`. On a Mac whose profile selects no organization files, your
`deployment.ring` applies when managed config sets none.

### Pending updates
Sometimes an earlier release is still waiting to activate when a newer release
arrives. The updater moves to the newer release only after it checks the
waiting binary. It keeps the last known good release as the fallback. If
another binary update is running, the background check waits for the next
maintenance run.

## Local UI auto-start
`local_ui.auto_start` lets Trajectory start the local UI automatically. The
default is `true`. To stop automatic start on one machine, set it to `false`
in `~/.trajectory/config.yaml`:

```yaml
local_ui:
  auto_start: false
```

To turn off automatic start for a fleet, deploy the same setting in managed
`~/.trajectory/config.defaults.yaml`. A managed `false` wins over user config.
Users cannot turn automatic start back on in their own `config.yaml`. The
`trajectory local-ui` commands still work, so users can open sessions by hand.

## Refresh organization configuration
Trajectory refreshes organization files automatically, every
`org.sync_interval` seconds. When `org.config_source` or `org.files` changes,
it refreshes right away. That happens when `trajectory serve` starts or
reloads its config. Trajectory retries a failed refresh after 1 minute. The
wait doubles after each failure, up to `org.sync_interval`.

To fetch the files now, run this command:

```bash
trajectory config sync
```

The command reads `org.config_source` or the older `org.markers_repo`. It
checks and writes files the same way as the automatic sync. It lists each file
that it updates.

With `org.config_source`, `config.defaults.yaml` is the main managed file. A
good refresh of that file records the same success that `trajectory doctor`
shows. A missing optional catalog or `deployment.json` gives a warning, and
the refresh still succeeds. A missing or invalid `config.defaults.yaml` makes
the command fail.

`config sync` does not signal running processes. It always refreshes now.
`trajectory config sync --force` does the same. The flag states the intent
and changes nothing else. If
`config.defaults.yaml` or the assigned cohort changes, the output shows the
reload command to run next. That is `--yes` after a normal sync and `--force`
after a forced sync.

Managed config can replace a user guide topic with an internal version. If
the local copy is missing, `trajectory user-guide <topic>` fetches it from the
managed source first. Trajectory takes that source only from managed config,
never from user config. If it cannot fetch and check the document, the command
fails. It does not show the public guide in its place.

## Enable optional security markers
To add the optional security markers, run this command:

```bash
trajectory patterns markers enable-security
```

The command writes the security marker catalog to
`~/.trajectory/markers.d/security.yaml`. It does not change the default
markers. Trajectory loads the files in `markers.d/` as add-ons, together with
`~/.trajectory/markers.yaml`.

## Full user config schema
This block shows the main user settings with their defaults. The
[Field reference](#field-reference) lists every key.

```yaml
auto_update: true

auth:
  mode: ""                 # "" or managed_keychain
  credential_source: auto  # auto, env, key_provider, keychain, or api_key_command
  key_command: ""          # optional default key provider command

identity:
  user_email: ""           # optional email for trajectory.user_email
  user_email_command: ""   # optional command that prints an email
  user_email_suffix: ""    # optional suffix added to trajectory.user
  github_email: ""         # optional email for git.email
  github_email_command: "" # optional command that prints a Git email
  github_username: ""      # optional username for github.username
  github_username_command: "" # optional command that prints a GitHub username

tags: {}                   # optional deployment tags for published DD telemetry

pricing:
  cursor:
    mode: emit             # off, shadow, or emit
    source: org_file       # org_file or datadog_reference_table

deployment:
  ring: stable
  update_url: ""

server:
  port: 19222
  otlp_proxy:
    enabled: false
    endpoint: ""           # upstream OTLP HTTP collector base URL
    api_key_ref: ""        # optional keychain/env ref used as dd-api-key
    native_ml_app: ""      # empty uses <export.ml_app>-claude-native

local_ui:
  auto_start: true

backfill:
  local:
    days: 30
    threads: 8
    background_threads: 1
  publish:
    days: 30

capture:
  redact_pii: true
  retention_days: 60
  max_disk_bytes: 0
  include_headless_agents: true

export:
  site: datadoghq.com
  ml_app: ""          # implicit publish destinations use coding-agents
  traces: off
  turn_traces: true   # false suppresses ordinary per-turn trace/eval output
  metrics: true
  incognito_metrics: redacted
  placeholder_llm_span: true
  subagent_span_mode: semantic
  oversight_publish_mode: summary
  late_turn_correction_delivery: historical
  local_forward_url: ""
  index_traces:
    session: false

features:
  enabled: []
  disabled: []

publish_trust:
  allowed_origins: []
  require_committed: false
  allowed_sites: []

classifier:
  standard_fallbacks: [claude, codex, opencode, cursor]

segmentation:
  enabled: true
  interval: 10
  model: ""
  monthly_budget_usd: 10
  publish_metrics: false
  final_pass_timeout: 13m
  recovery_timeout: 13m

cross_client_resume:
  enabled: false
  targets: []

org:
  config_source: ""
  markers_repo: ""
  markers_path: ""
  sync_interval: 3600

required_destinations: []
```

## Field reference
The **Default** column shows the value that Trajectory uses when no config
file sets the key. `trajectory config set` accepts every key in this table
except the `modules`, `ai_gateway`, `publish_tags`, `org.files`, and
`required_destinations` keys.

### General and updates
| Key | Type | Default | What it controls |
|---|---|---|---|
| `auto_update` | bool | `true` | Automatic background update checks. A managed `false` wins. A managed `true` wins where MDM lets Trajectory update itself. |
| `deployment.ring` | string | `stable` | Update ring: `stable` or `beta`. A managed or cohort ring wins. |
| `deployment.update_url` | string | `""` | Custom `RELEASES.json` URL for tests or company rollouts. |
| `local_ui.auto_start` | bool | `true` | Lets Trajectory start the local UI automatically. A managed `false` wins. |
| `server.port` | int | `19222` | Port of the local capture server. |

### Credentials and identity
| Key | Type | Default | What it controls |
|---|---|---|---|
| `auth.mode` | string | `""` | Set `managed_keychain` to read only the keychain accounts named in `api_key_ref`. |
| `auth.credential_source` | string | `auto` | Uses one key source: `env`, `key_provider`, `keychain`, or `api_key_command`. `auto` tries them in order. |
| `auth.key_command` | string | `""` | Command that prints the default Datadog API key. Empty runs no command. A managed value wins. |
| `identity.user_email` | string | `""` | Email for the `trajectory.user_email` tag. |
| `identity.user_email_command` | string | `""` | Command that prints the email for `trajectory.user_email`. |
| `identity.user_email_suffix` | string | `""` | Domain added to `trajectory.user`. Accepts `example.com` or `@example.com`. |
| `identity.github_email` | string | `""` | Email for the `git.email` tag. |
| `identity.github_email_command` | string | `""` | Command that prints the email for `git.email`. |
| `identity.github_username` | string | `""` | Username for the `github.username` tag. |
| `identity.github_username_command` | string | `""` | Command that prints the username for `github.username`. |

### Capture and local data
| Key | Type | Default | What it controls |
|---|---|---|---|
| `capture.redact_pii` | bool | `true` | Removes personal data patterns from captured content. |
| `capture.retention_days` | int | `60` | Deletes local JSONL older than this many days. `0` keeps files forever. |
| `capture.max_disk_bytes` | int | `0` | Total size limit for all local session JSONL. Trajectory deletes the oldest inactive sessions first. `0` turns the limit off. `trajectory doctor` shows use against the limit. |
| `capture.include_headless_agents` | bool | `true` | Captures and publishes headless agent sessions that Trajectory did not start. Segmentation still skips them. |
| `cross_client_resume.enabled` | bool | `false` | Rebuilds transcript files for other clients. |
| `cross_client_resume.targets` | list | `[]` | Limits rebuilt transcripts to these clients. |
| `backfill.local.days` | int | `30` | Default local backfill window in complete UTC days (1-3650). |
| `backfill.local.threads` | int | `8` | Workers for `session reindex` and the reindex step of `backfill local` (1-64). `--threads` overrides it for one run. |
| `backfill.local.background_threads` | int | `1` | Workers for background local cache indexing (1-64). |
| `backfill.local.pause_on_battery` | bool | `true` | Holds background local cache indexing while a Mac runs on battery, and resumes it on external power. Commands that you run are not paused. |
| `backfill.publish.days` | int | `30` | Default publish backfill window in complete UTC days (1-3650). |

### Export to Datadog
| Key | Type | Default | What it controls |
|---|---|---|---|
| `export.site` | string | `datadoghq.com` | Datadog site, such as `datadoghq.com`, `us5.datadoghq.com`, or `datadoghq.eu`. A managed value wins. |
| `export.ml_app` | string | `""` | LLM Observability ML app name. Destinations that Trajectory builds use `coding-agents` when it is empty. |
| `export.traces` | string | `off` | Trace content sent to LLM Observability: `off`, `minimal`, `standard`, or `full`. |
| `export.turn_traces` | bool | `true` | Sends the trace and the later evaluation for each turn. |
| `export.metrics` | bool | `true` | Sends cost, token, marker, and operations metrics when a destination exists. |
| `export.incognito_metrics` | string | `redacted` | Metrics for incognito sessions. `redacted` removes model and repo names. `standard` keeps them. Cost and token metrics always publish. |
| `export.placeholder_llm_span` | bool | `true` | Adds a placeholder LLM child span that carries turn cost. |
| `export.index_traces.session` | bool | `false` | Adds a separate session index span, with links only, at session end. |
| `export.subagent_span_mode` | string | `semantic` | How the parent shows subagents: `semantic` or `links_only`. |
| `export.oversight_publish_mode` | string | `summary` | Automated oversight data. `summary` has no content. `full` adds the reviewer trace. `off` sends no oversight spans or metrics. |
| `export.late_turn_correction_delivery` | string | `historical` | Late token and cost fixes for turns older than the live OTLP window. See the note below the table. |
| `export.local_forward_url` | string | `""` | Local HTTP endpoint that receives the JSONL of each finished session. |
| `tags` | map | `{}` | Tags added to published Datadog spans and Trajectory metrics. Managed values win on shared keys. |
| `publish_trust.allowed_origins` | list | `[]` | Git origins whose repo `publish.trajectory.yaml` files Trajectory loads. |
| `publish_trust.require_committed` | bool | `false` | Requires repo publish files to be tracked by Git. |
| `publish_trust.allowed_sites` | list | `[]` | Sites allowed for repo metrics-only destinations. Empty allows only the known public Datadog sites. |

For `export.late_turn_correction_delivery`, `historical` sends the corrected
total over OTLP through Historical Metrics Ingestion. If the destination opts
out of backfill, Trajectory counts the correction as a gap. `gap` never sends
the correction and counts it as dropped. Trajectory never sends a signed
correction outside the window.

### Segmentation and LLM calls
| Key | Type | Default | What it controls |
|---|---|---|---|
| `segmentation.enabled` | bool | `true` | Turns task segmentation on or off while the `automatic_task_segmentation` flag is on. The flag is off by default, so segmentation does not run unless you turn it on. |
| `segmentation.interval` | int | `10` | Turns between segmentation passes. |
| `segmentation.model` | string | `""` | Model override. Empty uses the default model for each client. See `trajectory user-guide llm-capacity`. |
| `segmentation.monthly_budget_usd` | float | `10` | Monthly limit on automated segmentation spend. `0` blocks automated calls but not a confirmed `patterns analyze` run. |
| `segmentation.publish_metrics` | bool | `false` | Publishes metrics from segmented tasks. |
| `segmentation.publish_traces` | bool | `false` | Old key. Trajectory accepts it and ignores it. |
| `segmentation.final_pass_timeout` | duration | `13m` | Time limit for the whole final segmentation run after a session ends. |
| `segmentation.recovery_timeout` | duration | `13m` | Time limit for each recovery run of segmentation after a session ends. |
| `segmentation.task_insights.publish` | bool | `false` | Old key. Trajectory accepts it and ignores it. |
| `classifier.standard_fallbacks` | list | `[claude, codex, opencode, cursor]` | Headless CLIs to try, in order, after the client's own provider. Managed config can reorder or shorten the list, add `agy`, or set `[]`. Direct API fallback is separate. |

### Pricing
| Key | Type | Default | What it controls |
|---|---|---|---|
| `pricing.cursor.mode` | string | `emit` | Cursor USD pricing: `off`, `shadow` (checks only), or `emit`. A managed value wins. Without `org/pricing.yaml`, usage has no price. |
| `pricing.cursor.source` | string | `org_file` | Rate source: `org_file` or `datadog_reference_table`. The second is not built yet and publishes no USD. Empty turns pricing off. |

### Feature flags and setup
| Key | Type | Default | What it controls |
|---|---|---|---|
| `features.enabled` | list | `[]` | Feature flags that you turn on. Use `trajectory config features`. |
| `features.disabled` | list | `[]` | Feature flags that you turn off. Off wins over on. |
| `setup.auto_instrument.enabled` | bool | `false` | Managed automatic client setup. Works only with managed defaults on a managed install. |
| `setup.auto_instrument.apply_enabled` | bool | `false` | Lets automatic client setup make changes. Without it, it only plans and reports. |
| `setup.auto_instrument.mode` | string | `detected` | Which clients automatic setup considers. |
| `setup.auto_instrument.interval` | duration | `6h` | Time between automatic setup checks. |
| `setup.auto_instrument.refresh_existing` | bool | `false` | Also refreshes client integrations that are already installed. |
| `setup.auto_instrument.allow_clients` | list | `[]` | Clients that automatic setup may install. User config can only shorten the managed list. |
| `setup.auto_instrument.deny_clients` | list | `[]` | Clients that automatic setup skips. |

### Server channels
| Key | Type | Default | What it controls |
|---|---|---|---|
| `server.otlp_proxy.enabled` | bool | `false` | Lets `trajectory serve` forward OTLP `/v1/logs` and `/v1/metrics` data to an upstream OTLP HTTP endpoint. |
| `server.otlp_proxy.endpoint` | string | `""` | Upstream OTLP HTTP base URL. Signal paths come from the base or a `/v1/...` URL. Setting it turns on the proxy unless `enabled` is `false`. |
| `server.otlp_proxy.api_key_ref` | string | `""` | Credential name that Trajectory resolves and sends as `dd-api-key` to Datadog OTLP intake. |
| `server.otlp_proxy.native_ml_app` | string | `<export.ml_app>-claude-native` | ML app for forwarded Claude Code native traces. A value equal to Trajectory's ML app gets the `-claude-native` suffix. |
| `server.reader_v2_remote.enabled` | bool | `false` | Opens one outgoing reader-v2 connection from the capture server. Needs `endpoint` and `credential_ref`. |
| `server.reader_v2_remote.endpoint` | string | `""` | `wss` URL with no credentials, query, or fragment. |
| `server.reader_v2_remote.credential_ref` | string | `""` | `env:<name>` or `keychain:<name>`. Trajectory never stores the value in config. |
| `server.reader_v2_remote.disclosure_scope` | string | `metadata` | Data that the connection can read: `metadata` or `content`. |

### Organization config
| Key | Type | Default | What it controls |
|---|---|---|---|
| `org.config_source` | string | `""` | Main source for remote organization config. A managed value wins. |
| `org.markers_repo` | string | `""` | Older HTTP(S) source for org config or markers. Other URL types are rejected. |
| `org.markers_path` | string | `""` | Path inside the org config source. |
| `org.sync_interval` | int | `3600` | Seconds between org config syncs. |

### Modules
Manage module settings with `trajectory plugins modules`. See
[Module commands](#module-commands).

| Key | Type | Default | What it controls |
|---|---|---|---|
| `modules.<id>.enabled` | bool | `false` | Turns on a built-in optional module, such as `agent-security`. |
| `modules.<id>.mode` | string | `observe` | `observe` or `enforce`. Hooks read it each time they run and log evaluator decisions to `~/.trajectory/modules/decisions.jsonl`. |
| `modules.<id>.config` | map | `{}` | Settings for the whole module, such as pack or profile names, policy names, or switches. |
| `modules.<id>.hooks.observe` | list | `[]` | Hook events to install for observe mode. |
| `modules.<id>.hooks.enforce` | list | `[]` | Hook events to install for clients that can enforce. |
| `modules.<id>.evaluators.<engine>.enabled` | bool | unset | Turns one module evaluator on or off. |
| `modules.<id>.evaluators.<engine>.mode` | string | module mode | `observe` or `enforce` for one evaluator. For example, keep `ai_edr` in observe while `ai_guard` enforces. |
| `modules.<id>.evaluators.<engine>.privacy_mode` | string | `""` | Privacy profile for one evaluator. |
| `modules.<id>.evaluators.<engine>.credential_redaction` | bool | `false` | Managed only. Set `true` to remove credentials from the evaluator's outside request. Captured data and saved module spans always have credentials removed. |
| `modules.<id>.evaluators.<engine>.timeout_ms` | int | `0` | Evaluator timeout in milliseconds. |
| `modules.<id>.evaluators.<engine>.window_turns` | int | `0` | Number of turns of context for the evaluator. |
| `modules.<id>.evaluators.<engine>.config` | map | `{}` | Settings for one evaluator, such as endpoint names, variable names, or policy limits. |
| `modules.<id>.launch` | map | unset | Product opt-in for a module, separate from `enabled`, such as Frontier AI Gateway routing. Setup writes its `receipt`. |

### Managed and structured keys
`trajectory config set` does not accept these keys. Set them in YAML.

| Key | Type | Default | What it controls |
|---|---|---|---|
| `required_destinations` | list | `[]` | Managed destinations that user and repo config cannot remove. See [Managed destinations](#managed-destinations). |
| `required_destinations[].backfill_opt_out` | bool | `false` | Stops backfill publishing to this destination. |
| `required_destinations[].historical_metrics_ingestion_confirmed` | bool | unset | Old name. `false` works like `backfill_opt_out: true`. |
| `publish_tags` | list | `[]` | Tags picked from a condition or a startup command. Run `trajectory user-guide publish`. |
| `ai_gateway` | map | unset | AI Gateway upstreams, profiles, and defaults. See [AI Gateway launch routing](#ai-gateway-launch-routing). |
| `org.files` | list | unset | Org config files to sync. Each entry has `name`, `path`, and `required`. Trajectory accepts only file names that it knows. |

### Module commands
Use these commands to work with modules:

- `trajectory plugins modules capabilities <module-id>` shows the hooks,
  setup steps, evaluators, MCP entries, skills, commands, settings, and keychain
  names that a module declares.
- `trajectory plugins modules install-plan <module-id> --clients ... --json`
  shows the hook commands that setup writes for each client.
- `trajectory plugins modules configure <module-id>` changes
  `modules.<id>.config` on this machine.
- `trajectory plugins modules evaluator enable|configure` changes
  `modules.<id>.evaluators.<engine>` on this machine.

When a hook runs, the evaluator gets one merged settings map. It also gets the
module and evaluator maps separately.

## Environment variable overrides
An environment variable applies only to the process that starts with it.

### Trajectory home, corpus root, and cache
Three variables choose where Trajectory keeps its files:

- `TRAJECTORY_HOME` sets the folder for config and machine-local state. The
  default is `~/.trajectory`. It is the only variable that moves this folder.
  Trajectory no longer reads `DATADOG_DIR`. It warns once when `DATADOG_DIR`
  is set without `TRAJECTORY_HOME`.
- `TRAJECTORY_ROOT` sets the folder for one set of session JSONL files. It
  also holds the files that coordinate that folder, its built output, and its
  default query cache. The default is `${TRAJECTORY_HOME}/trajectories`.
- `TRAJECTORY_CACHE_DB` sets one SQLite cache file. Use it for a copied
  database, a test fixture, or diagnostics.

For commands with `--db`, Trajectory picks the cache in this order:

1. `--db`
2. `TRAJECTORY_CACHE_DB`
3. `${TRAJECTORY_ROOT}/cache/trajectory.db`

Without `TRAJECTORY_ROOT`, the last path is
`${TRAJECTORY_HOME}/trajectories/cache/trajectory.db`.

`TRAJECTORY_ROOT` does not move config, credential names, publish records,
health, or watcher state out of `TRAJECTORY_HOME`. So a project or a test can
use its own session folder without a copy of that machine data.

Codex and Cursor Agent watcher state is in
`${TRAJECTORY_HOME}/state/watchers/`. Trajectory keeps it separate for each
session folder and each provider transcript folder. During the upgrade period,
Trajectory also copies progress to the older `${TRAJECTORY_HOME}/.state/`
files. It also still takes the older leader lock. So older binaries and
rollbacks keep working. `trajectory config reload` tells you when a watcher
needs a new process. It does not move a running watcher.

### Variable reference
| Variable | Config equivalent | Use |
|---|---|---|
| `TRAJECTORY_HOME` | runtime home | Moves config and machine-local state. The session folder moves too, unless `TRAJECTORY_ROOT` is set. |
| `TRAJECTORY_ROOT` | session folder | Chooses the session JSONL folder and its default cache. |
| `TRAJECTORY_CACHE_DB` | cache file | Chooses one SQLite cache file. |
| `TRAJECTORY_PORT` | `server.port` | Changes the capture server port. |
| `TRAJECTORY_OTLP_PROXY_ENABLED` | `server.otlp_proxy.enabled` | Turns the serve OTLP forwarder on or off. |
| `TRAJECTORY_OTLP_PROXY_ENDPOINT` | `server.otlp_proxy.endpoint` | Sets the upstream OTLP HTTP endpoint for logs and metrics. |
| `TRAJECTORY_OTLP_PROXY_API_KEY_REF` | `server.otlp_proxy.api_key_ref` | Adds a Datadog API key without the raw key in config. |
| `TRAJECTORY_OTLP_PROXY_HEADERS` | none | Comma-separated, URL-escaped `key=value` headers for other collectors. For Datadog, use `api_key_ref`. |
| `DD_SITE` | `export.site` | Changes the Datadog site. |
| `TRAJECTORY_SEGMENTATION_DISABLED=1` | `segmentation.enabled=false` | Turns off segmentation. |
| `TRAJECTORY_DEBUG=1` | none | Prints detailed logs. |
| `TRAJECTORY_AUTO_UPDATE=0` | `auto_update: false` | Turns off background update checks for the process, including when a managed `auto_update: true` applies. |
| `TRAJECTORY_UPDATE_REPO` / `TRAJECTORY_SELF_UPDATE_REPO` | selfupdate.conf | GitHub release repo for `trajectory update`, such as `datadog-labs/trajectory`. |
| `TRAJECTORY_UPDATE_URL` / `TRAJECTORY_SELF_UPDATE_URL` | selfupdate.conf | `RELEASES.json` URL for `trajectory update`. |
| `TRAJECTORY_UPDATE_BASE_URL` / `TRAJECTORY_SELF_UPDATE_BINARY_URL` | selfupdate.conf | Base URL of release files for `trajectory update`. |
| `TRAJECTORY_UPDATE_RECONCILE_PROCESSES=false` | none | Turns off the handoff to the new version after an update. Other values that are not empty fail. |
| `TRAJECTORY_DISABLED=1` | `trajectory config capture disable` | Turns off capture for the process. It wins over user settings. |
| `TRAJECTORY_DISABLE_KEYCHAIN=1` | none | Skips keychain lookups in background processes. |
| `TRAJECTORY_ENABLE_FEATURES` / `TRAJECTORY_DISABLE_FEATURES` | `features.enabled` / `features.disabled` | Turns feature flags on or off. |
| `DD_API_KEY` | secret | Datadog API key. |
| `ANTHROPIC_API_KEY` | secret | Anthropic key for Trajectory classifier calls and `trajectory cost budget`. |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | secret | Google key for Trajectory classifier calls and `trajectory cost budget`. |
| `OPENAI_API_KEY` | secret | OpenAI key for Trajectory classifier calls and `trajectory cost budget`. |
| `GITHUB_TOKEN` | secret | Self-update and private repo access. |
| `TRAJECTORY_USER_EMAIL` | `identity.user_email` | Sets `trajectory.user_email`. |
| `TRAJECTORY_GITHUB_EMAIL` | `identity.github_email` | Sets `git.email`. |
| `TRAJECTORY_GITHUB_USERNAME` | `identity.github_username` | Sets `github.username`. |

## Reload live serve processes
`trajectory serve` reads config and environment variables when it starts.
After you change config or export new credentials, reload the running
processes.

To preview a reload, run this command:

```bash
trajectory config reload
```

It checks the merged config and changes nothing. It prints a short summary of
changed settings and processes. If a reload is possible, it prints the
`--yes` command to run.

To see more detail in the preview, add `--details`:

```bash
trajectory config reload --details
```

It adds the changed setting names, process IDs, and what blocks a reload. The
list has a size limit. For the full result as JSON, add `--json`.

To apply the reload, add `--yes`:

```bash
trajectory config reload --yes
```

It asks the process that owns capture to reload. This works only if that
process supports reload. `--wait DURATION` sets how long the command waits
for the process to confirm. After a reload, the command points to
`trajectory ps`. Use it to check the running process, its agents, sessions,
and publish state.

Some changes, such as a new port, need a restart. With `--yes`, the command
only reports these changes. It never starts a new process.

The owner process does not reload while coding sessions are open. If a session
is open, the command says that the process will reload when its open sessions
end, and it exits with a nonzero code. The owner process keeps the request.
When the last session ends, it reloads by itself. You do not need to run the
command again.

If no owner process is available, use `--force`:

```bash
trajectory config reload --force
```

`--force` is its own confirmation, and you cannot use it together with
`--yes`. It skips the checks for the owner process, standalone commands,
active sessions, and publish work. Then it asks each running process that the
OS confirms is Trajectory to reload. Invalid config still fails.

If a changed key needs a restart, `--force` also restarts the Trajectory
processes, as `trajectory serve restart` does, to finish the change. To skip
that restart and leave the change pending, add
`--no-restart`. Processes from releases before forced reload cannot read the
request. They time out and need one normal update or restart first.

## Force an update or process change
> **Warning:** `trajectory update --force` stops every other Trajectory
> process that your user runs. Active sessions and queued publish work do not
> stop it.

To install the latest release and replace every Trajectory process, run this
command:

```bash
trajectory update --force
```

It installs the latest signed release. First it clears stale or broken update
state and any local block on the target version. Then it stops every other
process of your user named `trajectory` or `trajectory-*`.

`--force` means different things for other commands:

| Command | What `--force` does |
|---|---|
| `trajectory update converge --yes --force` | Same process replacement as `update --force`. |
| `trajectory update repair --apply --yes --force` | Same process replacement as `update --force`. |
| `trajectory serve retire-stale --yes --force` | Skips only the check for active sessions. |
| `trajectory ps --stop PID --force` | Skips only the check for active sessions. |
| `trajectory ps --restart PID --force` | Skips only the check for active sessions. |
| `trajectory ps --reload PID --force` | Sends the `config reload --force` request to one checked process. |

Update force sends TERM and then KILL, with a time limit. It does not check
process ownership, active sessions, or queued publish work. It then starts the
new version. It succeeds only when the new version is ready and is the only
Trajectory process for your user. A top-level update starts the new binary
before it stops other processes, so no older supervisor stays running.

Update force still checks the binary signature, checksum, version, managed
deployment rules, and readiness. It never touches another user's processes.
`serve ensure` has no force option. It cannot stop or replace a healthy
process.

Use `trajectory update --force` to get to the latest release even when an
earlier release is still waiting to activate. A valid waiting release passes
its last known good release to the new one. Trajectory sets aside invalid
selector data before the installed binary becomes the new fallback. To clear
the same update state without stopping processes, run
`trajectory update --force-recover`.

### When the update settings file cannot be read
`selfupdate.conf` in the Trajectory home records who installed Trajectory,
whether Trajectory may update itself, and where updates come from. The script
installer writes it. An organization's installer may write it too.

The file holds `KEY=value` lines and `#` comment lines. A byte-order mark at
the start of the file is ignored.

If the file exists and Trajectory cannot read it, updates still run.
Trajectory ignores the whole file and updates as if it were not there.
`trajectory update` prints a warning that names the file, and `trajectory
doctor` reports it. Fix the file so that its settings apply again:

- **A line is not valid.** The warning gives the line number. Fix that line,
  or run the installer again. It writes the file again. `user-guide install`
  has the installer's commands.
- **The file cannot be opened.** Remove the file first. Use administrator
  rights if another account owns it. Then run the installer again. The
  installer cannot replace a file that it cannot open.

If your organization installed Trajectory, ask your administrator to run its
installer instead.

### After an update
After `trajectory update` replaces the binary, the old server keeps running.
The next agent hook switches to the new version. It starts the new version and
checks that one server is ready. Trajectory delivers the hook event before it
stops the old server. A healthy Codex relay also starts this switch when an
update is waiting. Trajectory then continues from the client history, the
local JSONL, and the publish outboxes.

The `automatic_nuclear_update_replacement` feature is on by default. It
controls this automatic switch. To use the older handoff, turn the feature off
in user or managed config. You can also set
`TRAJECTORY_DISABLE_FEATURES=automatic_nuclear_update_replacement`. The
feature does not change `--yes --force`.

To see whether running processes match the installed version, run this
command:

```bash
trajectory update repair
```

It compares each running server with the installed binary and changes
nothing. To retry the handoff to the installed version, add `--apply --yes`:

```bash
trajectory update repair --apply --yes
```

To activate the installed or managed version, use `update converge`.
`trajectory update converge --dry-run` previews the change, and
`trajectory update converge --yes` applies it.

These `update repair --apply --yes` options change what the repair does:

- `--force` replaces every Trajectory process of your user, as
  `update --force` does.
- `--continue-handoff --binary /path/to/trajectory` is for the public Go SDK. It hands work to a binary that
  the SDK owns. Older servers give up their listener for a short time. A server
  that cannot replace itself in place pauses, and the SDK binary runs in the
  same home and port. If that binary exits, the old server resumes. Neither
  path kills an unknown process or starts a second capture home.
- `--reload-config` does a full recovery after a managed installer changes the
  binary, org config, or keychain credentials. It updates the binary owner,
  reloads config, and checks that each managed destination is active. If a
  credential is missing, the command fails and says how to fix it. Without
  this option, `update repair --apply --yes` only hands off the binary.
  Automatic updates never use this option.

The public Go SDK runs the same forced update as
`Client.ForceUpdateReconcile(ctx, ForceUpdateReconcileOptions{...})`. Its
normal `EnsureServe` call does not stop processes.

### Managed installs
A managed installer confirms the binary that it installed with this command:

```bash
trajectory update converge --yes --force --target-version VERSION --source managed-post-install
```

If that version is older than the release the runtime selected, the command
prints a warning and still switches to it. With `--dry-run`, its output
includes `"downgrade": true`.

A full org config source can publish a fixed `deployment.json` to pin one
version. Two managed-only feature flags, off by default, control this pin and
controlled rollback. Normal ring checks never move to an older version. While
a pin is active, `trajectory update` and automatic ring checks fail. Use
`trajectory update converge --yes` in their place. An accepted pin can fix a
binary that is newer or older than the pin. Moving to an older version needs
controlled downgrade.

A downgraded release keeps the local session database that the newer release
upgraded. It still records, reads, and publishes sessions. A newer release can
remove a feature and delete its stored data. If you roll back to a release
that still has that feature, the feature has no history, and it can stop
working. After a rollback to 0.6.0 or 0.5.39:

- CODEOWNERS attribution adds no owner tags.
- Agent Cost Guidance shows no warnings.
- Personal Cost Guard allows every prompt, and `trajectory cost-guard`
  commands fail.

### Automatic handoff
A confirmed `trajectory update repair --apply --yes` changes only the owner
process, and only if that process supports the handoff. New hooks wait in a
queue during the handoff. Active sessions keep running. If something blocks the handoff, the
old process takes over again.

To turn off the automatic handoff, set
`TRAJECTORY_UPDATE_RECONCILE_PROCESSES=false`.

Trajectory leaves a process that it cannot identify in place. That process
keeps running. At startup, Trajectory can clean up a stale owner record when
no process or listener is left. It never signals a process to do this.
