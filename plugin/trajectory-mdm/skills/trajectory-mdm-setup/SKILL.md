---
name: trajectory-mdm-setup
description: Help an IT administrator set up Trajectory for managed computers with the trajectory-mdm helper. Use to write or change a deployment intent file, check it, prepare and verify the MDM bundle, and say which files go to the MDM, which ones the administrator hosts, and where API keys go.
---

# Set Up a Trajectory MDM Deployment

Use the `trajectory-mdm` helper for every step. When the deployment folder has
an `AGENTS.md` from `trajectory-mdm agent-instructions`, run the helper by the
path that it names. Otherwise run `trajectory-mdm`.

Never ask for, read, print, or write a Datadog API key or any other secret.
`api_key_ref` is the name of a keychain entry, not a key. The administrator
enters each key only in their MDM.

Do not upload, publish, or assign files yourself. Tell the administrator what
goes where.

## Steps

1. Check the helper: `trajectory-mdm version`. It must come from the
   Trajectory release that the administrator deploys.
2. Read the guide that ships with the helper. When it differs from this skill,
   follow the guide.

   ```bash
   trajectory-mdm user-guide setup
   trajectory-mdm user-guide decisions
   trajectory-mdm user-guide what-goes-where
   ```

3. Ask the administrator for each decision in the `decisions` topic. Find the
   policy ID of their MDM product with `trajectory-mdm providers`. Do not guess
   the product, the clients, the destinations, or who installs updates.
4. Write the intent as `trajectory-managed.yaml`, with a comment for each
   choice. For the default Jamf Pro bundle, leave out `provider`, `platform`,
   and `migration_mode`: `trajectory-mdm` fills them in. For editor completion, run
   `trajectory-mdm schema --output managed-endpoint-intent.schema.json`.
5. Check the intent after each change:
   `trajectory-mdm validate --file trajectory-managed.yaml`. Fix each error.
   Explain each `Warning:` line, and change the setting unless the
   administrator keeps it on purpose.
6. Make the bundle:
   `trajectory-mdm prepare --file trajectory-managed.yaml --output trajectory-deployment.zip`.
   The Jamf Pro and Intune scripts on macOS place the release of the helper
   that makes the bundle, where needed. The helper must be from the release to
   deploy.
   They do not read `deployment.ring`. To move Macs to a later release,
   follow the `Updates` section of the `decisions` topic.
   A computer applies its deployment's profile at any revision. Keep one
   Trajectory profile on each computer. Computers on earlier releases need a
   higher revision: each Jamf Pro run gives one. For Intune, add
   `--profile-revision` with a number above every revision deployed before.
7. Check the bundle: `trajectory-mdm verify --bundle trajectory-deployment.zip`.
8. When the intent lists `config.defaults.yaml`, check the hosted settings
   file from the extracted bundle:
   `trajectory-mdm check-remote-defaults --file trajectory-managed.yaml --defaults remote-defaults/config.defaults.yaml`.
9. Tell the administrator what goes where, from the `what-goes-where` topic
   and the next steps that `prepare` printed. Name the bundle files for the
   MDM and each hosted file with its URL. For Jamf Pro, name the script
   parameter for each API key.
10. Ask the administrator to check one test computer, as the `setup` topic
    describes.

Use only the commands and options that `trajectory-mdm help COMMAND` lists.
