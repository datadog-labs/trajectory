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
3. The source workflow writes `public-release-request.json` beside its terminal
   `public-release-publication-receipt.json` in the existing immutable artifact
   named `public-release-publication-<run_id>-<run_attempt>`, then dispatches the
   target workflow with only the source run ID and request SHA256. This handoff
   does not add another source artifact or source CI job.
4. After target-environment approval, the target job uses its own OIDC identity
   to obtain a short-lived, read-only source token. The reciprocal source
   policy grants only `actions:read` and `contents:read` to this exact target
   workflow on `main`.
5. The target job derives the exact artifact name from the authenticated run ID
   and run attempt, requires exactly the request and terminal receipt files,
   verifies the request bytes against the dispatched SHA256, and fetches the
   source GitHub Release. It validates the source run, version, tag, source
   workflow SHA, candidate source SHA, both publication receipts, release title
   and body, target SHA, exact asset manifest, downloaded asset hashes and
   sizes, and checksum contents.
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

The source policy and source evidence producer must land before this
workflow is activated. The public workflow fails closed when either is absent.

## Source Identity

The request carries two distinct full Git SHAs under its exact-key `source`
object:

- `sha` is the source publication workflow commit. It must equal the
  authenticated source workflow run's `head_sha`.
- `candidate_sha` is the commit from which the candidate binaries were built.
  Both `asset_manifest.source_sha` and `publication_receipt.source_sha` must
  equal this value.

The manifest and publication receipt SHA256 fields cover their canonical JSON
objects after these candidate bindings are populated. The request artifact
SHA256 covers the exact request, including both source identities. The retained
target receipt reports these values separately as `source_workflow_sha` and
`candidate_source_sha`, along with the authenticated source run attempt; it
does not emit an ambiguous `source_sha` field.

The separate terminal source receipt must use the successful `full` schema and
bind the same authenticated run ID, run attempt, workflow SHA, candidate source
SHA, version, tag, publication timestamp, stable release ID/title/body, and
seven manifest assets as the request. It must also prove a metadata-only full
promotion with no rebuild or asset upload.

## Fail-Closed Rules

- Only `full` release requests are accepted. Candidate, prerelease, or
  suffixed-version requests stop before any target repository mutation.
- The release must contain exactly the seven contract assets. Missing, extra,
  duplicate, incomplete, renamed, or reordered assets are rejected.
- Source evidence must come from exactly one non-expired artifact named from
  the authenticated run ID and run attempt. Legacy digest-named artifacts,
  missing or extra archive files, self-asserted source fields, and request bytes
  that do not match the dispatched SHA256 are rejected.
- Every downloaded byte must stay within the contract size bounds and match
  the manifest SHA256 and size. The checksum file must contain exactly the six
  binary basenames in canonical order.
- The compact request receipt and terminal source receipt must bind the same
  candidate source SHA, source run, version, tag, manifest, assets, title, body,
  and source publication timestamp.
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

## Controller Readback

The dispatching release controller can correlate the target run without
polling by time window or branch alone. The workflow display name is exactly
`public-release-<source_run_id>-<request_sha256>`, and the retained artifact is
exactly `public-release-receipt-<request_sha256>`.

The checked-in `release-controller-read` Octo STS policy grants a single
protected GitLab release-pipeline identity only `actions:read` and
`contents:read`. Its trust boundary uses the stable project ID plus protected
push-pipeline, immutable request branch, and branch-bound root CI configuration
claims; it does not encode the controller project path or any publication
endpoint.

After selecting the unique successful target run with the canonical display
name, the controller must download the exact receipt artifact from that run
and require all three bindings to match:

- `source_run_id` equals the dispatched source run.
- `request_sha256` equals the dispatched request digest.
- `workflow_run_id` equals the selected target run.

These bindings make a stale, unrelated, or replayed receipt unusable as
evidence for a different release transaction.
