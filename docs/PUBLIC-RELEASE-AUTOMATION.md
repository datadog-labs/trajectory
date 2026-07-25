# Protected Public Release Publication

Public GitHub Releases are published by
`.github/workflows/public-release-mirror.yml`. The workflow is a protected,
full-release-only gate. It does not build, sign, transform, or rename release
artifacts.

The machine-readable interface is
[`contracts/public-release-mirror-v1.json`](../contracts/public-release-mirror-v1.json).
That contract is authoritative for the trusted caller, protected target,
release mode, and seven canonical assets.

## Publication Sequence

1. The stable entry in `RELEASES.json` lands on `main` with the exact version,
   tag, and source publication timestamp.
2. The trusted source workflow exchanges its protected GitHub OIDC identity
   for a short-lived `actions:write` token under the checked-in Octo STS
   policy. That token can dispatch this workflow but cannot mutate repository
   contents or releases.
3. The source workflow uploads `public-release-request.json` as the immutable
   source-run artifact named `public-release-request-<sha256>`, then dispatches
   the target workflow with only the source run ID and request SHA256.
4. After target-environment approval, the target job uses its own OIDC identity
   to obtain a short-lived, read-only source token. The reciprocal source
   policy grants only `actions:read` and `contents:read` to this exact target
   workflow on `main`.
5. The target job fetches the request artifact and source GitHub Release,
   validates the source run, version, tag, source SHA, publication receipt,
   release title and body, target SHA, exact asset manifest, downloaded asset
   hashes and sizes, and checksum contents.
6. Using only its target-scoped job token, the target job creates or resumes a
   draft release, uploads missing exact assets without overwriting existing
   ones, publishes the normal GitHub Release, marks it latest, and revalidates
   the final metadata and asset identities. Replaying the same request verifies
   the existing release idempotently.

The target environment must allow deployments only from `main`, require
maintainer approval, and provide the Octo STS domain and audience as protected
environment variables. No broker URL or credential is stored in this
repository.

The reciprocal source policy named by the contract must trust only:

```yaml
subject: repo:datadog-labs/trajectory:environment:public-release-mirror
claim_pattern:
  event_name: workflow_dispatch
  ref: refs/heads/main
  repository: datadog-labs/trajectory
  job_workflow_ref: datadog-labs/trajectory/\.github/workflows/public-release-mirror\.yml@refs/heads/main
permissions:
  actions: read
  contents: read
```

The source policy and source request artifact producer must land before this
workflow is activated. The public workflow fails closed when either is absent.

## Fail-Closed Rules

- Only `full` release requests are accepted. Candidate, prerelease, or
  suffixed-version requests stop before any target repository mutation.
- The release must contain exactly the seven contract assets. Missing, extra,
  duplicate, incomplete, renamed, or reordered assets are rejected.
- The request must be an immutable artifact from the exact successful source
  workflow run. Self-asserted source fields or recomputed unkeyed hashes are not
  accepted as source authentication.
- Every downloaded byte must stay within the contract size bounds and match
  the manifest SHA256 and size. The checksum file must contain exactly the six
  binary basenames in canonical order.
- The publication receipt must bind the same source SHA, source run, version,
  tag, manifest, assets, title, and body.
- Existing assets are never overwritten. Matching partial drafts may resume;
  published releases succeed only when their metadata and assets match exactly.
- Download redirects are HTTPS-only, allowlisted, bounded, and never receive a
  GitHub API authorization header.
- Final release metadata and asset identities are checked again after
  publication before a success receipt is written.
- `RELEASES.json` must already contain matching stable metadata. The workflow
  does not commit repository metadata.

Successful runs retain a content-bound publication receipt as a GitHub Actions
artifact for 90 days.
