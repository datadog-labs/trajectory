#!/usr/bin/env python3
"""Mirror an already-published Trajectory release without exposing private evidence."""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import public_release_mirror as mirror


SOURCE_REPOSITORY = "DataDog/trajectory"
SOURCE_READ_POLICY = "trajectory-labs.public-release-read"
TARGET_RECEIPT_KIND = "trajectory-public-source-mirror-receipt"
MAX_TOTAL_ASSET_BYTES = 1_100_000_000
REQUIRED_ASSETS = (
    "trajectory-darwin-amd64",
    "trajectory-darwin-arm64",
    "trajectory-darwin-universal",
    "trajectory-linux-amd64",
    "trajectory-linux-arm64",
    "trajectory-windows-amd64.exe",
    "trajectory-windows-amd64",
    "trajectory-mdm-darwin-amd64",
    "trajectory-mdm-darwin-arm64",
    "trajectory-mdm-darwin-universal",
    "trajectory-mdm-linux-amd64",
    "trajectory-mdm-linux-arm64",
    "trajectory-mdm-windows-amd64.exe",
    "checksums.sha256",
)


def source_contract() -> dict[str, object]:
    return {
        "source_identity": {
            "repository": SOURCE_REPOSITORY,
            "read_policy": SOURCE_READ_POLICY,
        },
        "required_assets": list(REQUIRED_ASSETS),
        "limits": {
            "max_asset_bytes": 300_000_000,
            "max_total_asset_bytes": MAX_TOTAL_ASSET_BYTES,
        },
    }


def build_request(
    source_client: mirror.GitHubClient,
    *,
    version: str,
    target_sha: str,
) -> tuple[dict[str, object], dict[str, object]]:
    if not mirror.VERSION_RE.fullmatch(version):
        raise mirror.MirrorError("version must be canonical X.Y.Z or X.Y.Z-beta")
    release_mode = mirror.release_mode_for_version(version)
    prerelease = release_mode == "beta"
    make_latest = release_mode == "full"
    tag = f"v{version}"
    release = source_client.get_release_by_tag(tag)
    if release is None:
        raise mirror.MirrorError("source release does not exist")
    if (
        release.get("draft") is not False
        or release.get("prerelease") is not prerelease
    ):
        raise mirror.MirrorError("source release state does not match its version channel")
    latest = source_client.get_latest_release()
    is_latest = latest.get("id") == release.get("id") and latest.get("tag_name") == tag
    if is_latest is not make_latest:
        state = "latest" if make_latest else "non-latest"
        raise mirror.MirrorError(f"source release must be GitHub {state}")

    name = mirror.require_string(release.get("name"), "source release name")
    body = mirror.require_string(release.get("body"), "source release body", nonempty=False)
    published_at = mirror.require_string(
        release.get("published_at"), "source release published_at"
    )
    if not mirror.TIMESTAMP_RE.fullmatch(published_at):
        raise mirror.MirrorError("source release published_at must be a UTC timestamp")

    by_name = mirror.release_assets_by_name(release)
    if set(by_name) != set(REQUIRED_ASSETS):
        raise mirror.MirrorError("source release does not contain the canonical asset set")
    assets: list[dict[str, object]] = []
    total_size = 0
    for asset_name in REQUIRED_ASSETS:
        asset = by_name[asset_name]
        size = mirror.require_positive_int(asset.get("size"), f"source asset {asset_name} size")
        digest = mirror.require_string(
            asset.get("digest"), f"source asset {asset_name} digest"
        )
        if not digest.startswith("sha256:") or not mirror.SHA256_RE.fullmatch(digest[7:]):
            raise mirror.MirrorError(f"source asset digest is not canonical: {asset_name}")
        total_size += size
        assets.append({"name": asset_name, "size": size, "sha256": digest[7:]})
    if total_size > MAX_TOTAL_ASSET_BYTES:
        raise mirror.MirrorError("source release exceeds the bounded mirror size")

    request: dict[str, object] = {
        "release_mode": release_mode,
        "version": version,
        "tag": tag,
        "release": {
            "source_release_id": mirror.require_positive_int(
                release.get("id"), "source release id"
            ),
            "name": name,
            "body": body,
            "target_commitish": target_sha,
            "prerelease": prerelease,
            "make_latest": make_latest,
        },
        "asset_manifest": {"assets": assets},
        "published_at": published_at,
    }
    return request, release


def validate_metadata(metadata: dict[str, object], request: dict[str, object]) -> None:
    expected = {
        "version": request["version"],
        "tag": request["tag"],
        "released_at": request["published_at"],
    }
    if request["release_mode"] == "full":
        if metadata.get("stable") != expected or metadata.get("beta") != expected:
            raise mirror.MirrorError(
                "RELEASES.json stable and beta rings must match the stable release"
            )
        return
    stable = metadata.get("stable")
    if not isinstance(stable, dict):
        raise mirror.MirrorError("RELEASES.json must preserve stable metadata")
    stable_version = stable.get("version")
    if (
        not isinstance(stable_version, str)
        or mirror.release_mode_for_version(stable_version) != "full"
        or stable.get("tag") != f"v{stable_version}"
    ):
        raise mirror.MirrorError("RELEASES.json stable metadata must remain stable")
    if metadata.get("beta") != expected:
        raise mirror.MirrorError("RELEASES.json beta metadata must match the beta release")


def apply_release(args: argparse.Namespace) -> dict[str, object]:
    target_token = os.environ.get("GITHUB_TOKEN")
    if not target_token:
        raise mirror.MirrorError("GITHUB_TOKEN is required")
    contract = source_contract()
    source_token = mirror.exchange_source_token(contract)
    source_client = mirror.GitHubClient(SOURCE_REPOSITORY, source_token)
    target_client = mirror.GitHubClient(args.expected_repository, target_token)
    request, source_release = build_request(
        source_client,
        version=args.version,
        target_sha=args.expected_target_sha,
    )
    validate_metadata(mirror.load_json(args.metadata), request)

    with mirror.tempfile.TemporaryDirectory(prefix="trajectory-public-source-mirror-") as directory:
        scratch = Path(directory)
        source_paths = mirror.materialize_source_assets(
            source_client, request, contract, scratch
        )
        target_release, action = mirror.publish_target_release(
            target_client, request, contract, source_paths, scratch
        )

    receipt = {
        "schema_version": 1,
        "kind": TARGET_RECEIPT_KIND,
        "status": action,
        "version": request["version"],
        "tag": request["tag"],
        "source_release_id": source_release["id"],
        "target_release_id": target_release["id"],
        "target_sha": args.expected_target_sha,
        "workflow_run_id": args.workflow_run_id,
        "assets": request["asset_manifest"]["assets"],
        "latest": request["release"]["make_latest"],
    }
    args.receipt_out.parent.mkdir(parents=True, exist_ok=True)
    args.receipt_out.write_bytes(mirror.canonical_json(receipt) + b"\n")
    return receipt


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--version", required=True)
    parser.add_argument("--metadata", required=True, type=Path)
    parser.add_argument("--expected-repository", required=True)
    parser.add_argument("--expected-target-sha", required=True)
    parser.add_argument("--workflow-run-id", required=True, type=int)
    parser.add_argument("--receipt-out", required=True, type=Path)
    args = parser.parse_args()
    try:
        apply_release(args)
    except mirror.MirrorError as error:
        print(f"PUBLIC_SOURCE_MIRROR_ERROR {error}", file=mirror.sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
