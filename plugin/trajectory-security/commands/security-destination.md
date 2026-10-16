---
description: Configure a Datadog destination for Agent Security results
argument-hint: --destination NAME --app-key-ref REF
---

Ask for the existing destination name and app-key secret reference if they were not supplied. Then run `trajectory plugins security destination add --destination <name> --app-key-ref <ref>`. Never ask the user to paste the application key into chat. If the secret does not exist, direct them to `trajectory config set-secret <ref> --stdin`.
