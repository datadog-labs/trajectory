from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import os
import re
import tempfile
import unittest
import urllib.request
import zipfile
from pathlib import Path
from typing import Any
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / ".github" / "scripts" / "public_release_mirror.py"
CONTRACT_PATH = ROOT / "contracts" / "public-release-mirror-v1.json"
SPEC = importlib.util.spec_from_file_location("public_release_mirror", SCRIPT)
assert SPEC and SPEC.loader
MIRROR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MIRROR)

SOURCE_WORKFLOW_SHA = "a" * 40
CANDIDATE_SOURCE_SHA = "c" * 40
TARGET_SHA = "b" * 40
SOURCE_RUN_ID = 9001
SOURCE_RUN_ATTEMPT = 3


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def canonical_digest(value: Any) -> str:
    return digest(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def build_fixture(
    *,
    release_mode: str = "full",
    prerelease: bool = False,
    valid_checksum_manifest: bool = True,
) -> tuple[dict[str, Any], dict[int, bytes], bytes]:
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    binary_names = contract["required_assets"][:-1]
    contents: dict[str, bytes] = {
        name: f"fixture bytes for {name}\n".encode() for name in binary_names
    }
    checksum_lines = [f"{digest(contents[name])}  {name}" for name in binary_names]
    if not valid_checksum_manifest:
        checksum_lines[0] = f"{'0' * 64}  {binary_names[0]}"
    contents["checksums.sha256"] = ("\n".join(checksum_lines) + "\n").encode()

    assets = [
        {"name": name, "size": len(contents[name]), "sha256": digest(contents[name])}
        for name in contract["required_assets"]
    ]
    manifest = {
        "schema_version": 1,
        "kind": "trajectory-release-asset-manifest",
        "version": "0.5.28",
        "tag": "v0.5.28",
        "source_sha": CANDIDATE_SOURCE_SHA,
        "assets": assets,
    }
    manifest_sha = canonical_digest(manifest)
    release = {
        "source_release_id": 6001,
        "name": "Trajectory 0.5.28",
        "body": "Trajectory 0.5.28 public binary release.",
        "target_commitish": TARGET_SHA,
        "prerelease": prerelease,
        "make_latest": True,
    }
    publication_receipt = {
        "schema_version": 1,
        "kind": "trajectory-publication-receipt",
        "status": "published",
        "release_mode": release_mode,
        "version": "0.5.28",
        "tag": "v0.5.28",
        "source_sha": CANDIDATE_SOURCE_SHA,
        "source_run_id": SOURCE_RUN_ID,
        "published_at": "2026-07-25T12:34:56Z",
        "asset_manifest_sha256": manifest_sha,
        "assets": copy.deepcopy(assets),
        "release_metadata": {
            "name_sha256": digest(release["name"].encode()),
            "body_sha256": digest(release["body"].encode()),
        },
    }
    request = {
        "schema_version": 1,
        "kind": "trajectory-public-release-mirror-request",
        "release_mode": release_mode,
        "version": "0.5.28",
        "tag": "v0.5.28",
        "source": {
            "repository": "DataDog/trajectory",
            "workflow_ref": (
                "DataDog/trajectory/.github/workflows/"
                "public-release-publication.yml@refs/heads/main"
            ),
            "environment": "public-release-publication",
            "event_name": "workflow_dispatch",
            "ref": "refs/heads/main",
            "sha": SOURCE_WORKFLOW_SHA,
            "candidate_sha": CANDIDATE_SOURCE_SHA,
            "run_id": SOURCE_RUN_ID,
        },
        "target": {
            "repository": "datadog-labs/trajectory",
            "ref": "refs/heads/main",
            "sha": TARGET_SHA,
        },
        "release": release,
        "asset_manifest": manifest,
        "asset_manifest_sha256": manifest_sha,
        "publication_receipt": publication_receipt,
        "publication_receipt_sha256": canonical_digest(publication_receipt),
    }
    payloads = {index + 1: contents[name] for index, name in enumerate(contract["required_assets"])}
    raw = json.dumps(request, sort_keys=True, separators=(",", ":")).encode()
    return request, payloads, raw


def metadata_for(request: dict[str, Any]) -> dict[str, Any]:
    return {
        "stable": {
            "version": request["version"],
            "tag": request["tag"],
            "released_at": request["publication_receipt"]["published_at"],
        },
        "beta": {
            "version": "0.5.27",
            "tag": "v0.5.27",
            "released_at": "2026-07-24T19:23:32Z",
        },
    }


def release_assets(request: dict[str, Any]) -> list[dict[str, Any]]:
    return [
        {
            "id": index + 1,
            "name": asset["name"],
            "size": asset["size"],
            "digest": f"sha256:{asset['sha256']}",
            "state": "uploaded",
        }
        for index, asset in enumerate(request["asset_manifest"]["assets"])
    ]


def source_publication_receipt(request: dict[str, Any]) -> dict[str, Any]:
    publication_receipt = request["publication_receipt"]
    return {
        "schema_version": 1,
        "kind": "trajectory.public_release_publication.receipt",
        "terminal_status": "success",
        "mode": "full",
        "binding": {
            "repository": request["source"]["repository"],
            "source_sha": request["source"]["candidate_sha"],
            "version": request["version"],
            "workflow": {
                "name": "Public Release Publication",
                "ref": request["source"]["workflow_ref"],
                "sha": request["source"]["sha"],
                "default_branch": "main",
                "dispatch_ref": request["source"]["ref"],
                "dispatch_sha": request["source"]["sha"],
                "run_id": SOURCE_RUN_ID,
                "run_attempt": SOURCE_RUN_ATTEMPT,
            },
            "readiness": {
                "run_id": "7001",
                "run_attempt": "1",
                "receipt_sha256": "sha256:" + "1" * 64,
                "validation_tag": "release-ci-v0.5.28-ccccccccc",
            },
            "candidate_build": {
                "run_id": 7000,
                "run_attempt": 1,
                "receipt_sha256": "sha256:" + "2" * 64,
                "validation_tag": "release-ci-v0.5.28-ccccccccc",
            },
            "pilot": {
                "aggregate_sha256": "sha256:" + "3" * 64,
                "artifact_sha256": "sha256:" + "4" * 64,
                "issued_at": "2026-07-25T12:00:00Z",
                "expires_at": "2026-07-25T13:00:00Z",
            },
            "signed_tag": {
                "object_sha": "d" * 40,
                "object_sha256": "sha256:" + "5" * 64,
                "target": request["source"]["candidate_sha"],
                "signer_identity": "release-signer",
                "trust_sha256": "sha256:" + "6" * 64,
            },
            "candidate_publication": {
                "run_id": 8001,
                "run_attempt": 1,
                "receipt_sha256": "sha256:" + "7" * 64,
            },
        },
        "publication": {
            "tag": request["tag"],
            "tag_target": request["source"]["candidate_sha"],
            "tag_object_sha": "d" * 40,
            "tag_object_sha256": "sha256:" + "5" * 64,
            "tag_signature_verified": True,
            "tag_signer_identity": "release-signer",
            "tag_signer_fingerprint": "SHA256:fixture",
            "tag_trust_sha256": "sha256:" + "6" * 64,
            "release_id": request["release"]["source_release_id"],
            "title": request["release"]["name"],
            "body": request["release"]["body"],
            "body_sha256": "sha256:" + digest(request["release"]["body"].encode()),
            "changelog_path": "docs/changelog/v0.5.28.md",
            "prerelease": False,
            "latest": True,
            "assets": sorted(
                [
                    {
                        "name": asset["name"],
                        "sha256": f"sha256:{asset['sha256']}",
                        "size_bytes": asset["size"],
                    }
                    for asset in request["asset_manifest"]["assets"]
                ],
                key=lambda asset: asset["name"],
            ),
            "url": "https://github.com/DataDog/trajectory/releases/tag/v0.5.28",
        },
        "guarantees": {
            "rebuild_performed": False,
            "asset_uploads": [],
            "asset_reuploads": [],
            "metadata_only_promotion": True,
        },
        "lifecycle": {
            "issued_at": publication_receipt["published_at"],
            "expires_at": "2026-07-26T12:34:56Z",
        },
        "blockers": [],
        "outcome": "promoted",
        "candidate_publication_receipt_sha256": "sha256:" + "7" * 64,
        "mutation_summary": {"count": 1, "metadata_updates": 1},
    }


class FakeSource:
    def __init__(
        self,
        request: dict[str, Any],
        payloads: dict[int, bytes],
        raw_request: bytes,
        *,
        source_receipt: dict[str, Any] | None = None,
    ) -> None:
        self.request = request
        self.payloads = payloads
        self.raw_request = raw_request
        self.request_sha256 = digest(raw_request)
        self.run = {
            "id": SOURCE_RUN_ID,
            "repository": {"full_name": "DataDog/trajectory"},
            "event": "workflow_dispatch",
            "name": "Public Release Publication",
            "path": ".github/workflows/public-release-publication.yml",
            "head_branch": "main",
            "head_sha": SOURCE_WORKFLOW_SHA,
            "run_attempt": SOURCE_RUN_ATTEMPT,
            "status": "completed",
            "conclusion": "success",
        }
        self.release = {
            "id": request["release"]["source_release_id"],
            "tag_name": request["tag"],
            "name": request["release"]["name"],
            "body": request["release"]["body"],
            "target_commitish": CANDIDATE_SOURCE_SHA,
            "draft": False,
            "prerelease": False,
            "assets": release_assets(request),
        }
        self.artifact_name = (
            f"public-release-publication-{SOURCE_RUN_ID}-{SOURCE_RUN_ATTEMPT}"
        )
        self.archive_entries = {
            "public-release-request.json": raw_request,
            "public-release-publication-receipt.json": json.dumps(
                source_receipt or source_publication_receipt(request),
                sort_keys=True,
            ).encode(),
        }

    def get_workflow_run(self, run_id: int) -> dict[str, Any]:
        assert run_id == SOURCE_RUN_ID
        return copy.deepcopy(self.run)

    def list_run_artifacts(self, run_id: int) -> list[dict[str, Any]]:
        assert run_id == SOURCE_RUN_ID
        return [{"id": 5001, "name": self.artifact_name, "expired": False}]

    def download_artifact(self, artifact_id: int, destination: Path, max_bytes: int) -> None:
        assert artifact_id == 5001
        with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
            for name, content in self.archive_entries.items():
                archive.writestr(name, content)
        if destination.stat().st_size > max_bytes:
            raise MIRROR.MirrorError("fixture archive exceeded bound")

    def get_release(self, release_id: int) -> dict[str, Any]:
        assert release_id == self.release["id"]
        return copy.deepcopy(self.release)

    def download_asset(self, asset_id: int, destination: Path, max_bytes: int) -> None:
        content = self.payloads[asset_id]
        if len(content) > max_bytes:
            raise MIRROR.MirrorError("fixture asset exceeded bound")
        destination.write_bytes(content)


class FakeTarget:
    def __init__(
        self,
        request: dict[str, Any],
        payloads: dict[int, bytes],
        *,
        state: str,
        latest: bool = False,
    ) -> None:
        self.request = request
        self.payloads: dict[int, bytes] = {}
        self.next_asset_id = 101
        self.create_calls = 0
        self.publish_calls = 0
        self.upload_calls: list[str] = []
        self.mutate_after_publish: str | None = None
        if state == "absent":
            self.release: dict[str, Any] | None = None
        else:
            self.release = self._release(draft=state == "draft")
            for index, source_asset in enumerate(request["asset_manifest"]["assets"]):
                target_id = self.release["assets"][index]["id"]
                self.payloads[target_id] = payloads[index + 1]
        self.latest = (
            copy.deepcopy(self.release)
            if latest and self.release is not None
            else {"id": 1, "tag_name": "v0.5.27"}
        )

    def _release(self, *, draft: bool) -> dict[str, Any]:
        return {
            "id": 7001,
            "tag_name": self.request["tag"],
            "name": self.request["release"]["name"],
            "body": self.request["release"]["body"],
            "target_commitish": TARGET_SHA,
            "draft": draft,
            "prerelease": False,
            "assets": [
                {
                    **asset,
                    "id": 100 + index,
                }
                for index, asset in enumerate(release_assets(self.request), start=1)
            ],
        }

    def get_release_by_tag(self, tag: str) -> dict[str, Any] | None:
        assert tag == self.request["tag"]
        return copy.deepcopy(self.release)

    def create_draft_release(self, request: dict[str, Any]) -> dict[str, Any]:
        assert self.release is None
        self.create_calls += 1
        self.release = {
            "id": 7001,
            "tag_name": request["tag"],
            "name": request["release"]["name"],
            "body": request["release"]["body"],
            "target_commitish": request["release"]["target_commitish"],
            "draft": True,
            "prerelease": False,
            "assets": [],
        }
        return copy.deepcopy(self.release)

    def upload_asset(self, release_id: int, name: str, source: Path) -> dict[str, Any]:
        assert self.release is not None and release_id == self.release["id"]
        expected = next(
            asset for asset in self.request["asset_manifest"]["assets"] if asset["name"] == name
        )
        content = source.read_bytes()
        assert len(content) == expected["size"] and digest(content) == expected["sha256"]
        asset = {
            "id": self.next_asset_id,
            "name": name,
            "size": len(content),
            "digest": f"sha256:{digest(content)}",
            "state": "uploaded",
        }
        self.next_asset_id += 1
        self.release["assets"].append(asset)
        self.payloads[asset["id"]] = content
        self.upload_calls.append(name)
        return copy.deepcopy(asset)

    def get_release(self, release_id: int) -> dict[str, Any]:
        assert self.release is not None and release_id == self.release["id"]
        return copy.deepcopy(self.release)

    def publish_release(self, release_id: int) -> dict[str, Any]:
        assert self.release is not None and release_id == self.release["id"]
        self.publish_calls += 1
        self.release["draft"] = False
        self.release["prerelease"] = False
        if self.mutate_after_publish == "asset":
            self.release["assets"][0]["id"] += 1000
        elif self.mutate_after_publish == "metadata":
            self.release["body"] = "changed after validation"
        self.latest = copy.deepcopy(self.release)
        return copy.deepcopy(self.release)

    def get_latest_release(self) -> dict[str, Any]:
        return copy.deepcopy(self.latest)

    def download_asset(self, asset_id: int, destination: Path, max_bytes: int) -> None:
        content = self.payloads[asset_id]
        if len(content) > max_bytes:
            raise MIRROR.MirrorError("fixture asset exceeded bound")
        destination.write_bytes(content)


class PublicReleaseMirrorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))

    def apply(
        self,
        request: dict[str, Any],
        payloads: dict[int, bytes],
        raw: bytes,
        target: FakeTarget,
        *,
        source: FakeSource | None = None,
        metadata: dict[str, Any] | None = None,
        request_sha256: str | None = None,
    ) -> dict[str, Any]:
        source = source or FakeSource(request, payloads, raw)
        with tempfile.TemporaryDirectory() as directory:
            return MIRROR.apply_release(
                contract=self.contract,
                metadata=metadata if metadata is not None else metadata_for(request),
                source_run_id=SOURCE_RUN_ID,
                request_sha256=request_sha256 or digest(raw),
                expected_repository="datadog-labs/trajectory",
                expected_target_sha=TARGET_SHA,
                workflow_run_id=8001,
                source_client=source,
                target_client=target,
                receipt_out=Path(directory) / "receipt.json",
            )

    def test_contract_accepts_only_full_and_exactly_seven_bounded_assets(self) -> None:
        MIRROR.validate_contract(self.contract)
        self.assertEqual(self.contract["accepted_release_modes"], ["full"])
        self.assertEqual(len(self.contract["required_assets"]), 7)
        self.assertLessEqual(self.contract["limits"]["max_request_bytes"], 65536)
        self.assertLessEqual(
            self.contract["limits"]["max_source_receipt_bytes"],
            65536,
        )
        self.assertEqual(
            self.contract["source_identity"]["publication_artifact_prefix"],
            "public-release-publication-",
        )

    def test_candidate_and_prerelease_requests_fail_before_target_mutation(self) -> None:
        cases = (
            build_fixture(release_mode="candidate"),
            build_fixture(prerelease=True),
        )
        for request, payloads, raw in cases:
            with self.subTest(mode=request["release_mode"], prerelease=request["release"]["prerelease"]):
                target = FakeTarget(request, payloads, state="absent")
                with self.assertRaises(MIRROR.MirrorError):
                    self.apply(request, payloads, raw, target)
                self.assertEqual(target.create_calls, 0)
                self.assertEqual(target.publish_calls, 0)

    def test_request_must_come_from_exact_authenticated_source_run_artifact(self) -> None:
        request, payloads, raw = build_fixture()
        source = FakeSource(request, payloads, raw)
        target = FakeTarget(request, payloads, state="absent")
        source.run["path"] = ".github/workflows/other.yml"
        with self.assertRaisesRegex(MIRROR.MirrorError, "run path"):
            self.apply(request, payloads, raw, target, source=source)
        self.assertEqual(target.create_calls, 0)

        forged = copy.deepcopy(request)
        forged["source"]["sha"] = "f" * 40
        forged_raw = json.dumps(forged, sort_keys=True, separators=(",", ":")).encode()
        source = FakeSource(request, payloads, raw)
        with self.assertRaisesRegex(MIRROR.MirrorError, "SHA256"):
            self.apply(
                forged,
                payloads,
                forged_raw,
                target,
                source=source,
                request_sha256=digest(forged_raw),
            )
        self.assertEqual(target.create_calls, 0)

    def test_source_artifact_name_is_derived_from_authenticated_run_attempt(self) -> None:
        request, payloads, raw = build_fixture()
        target = FakeTarget(request, payloads, state="absent")
        for case in ("legacy_name", "different_attempt"):
            source = FakeSource(request, payloads, raw)
            if case == "legacy_name":
                source.artifact_name = f"public-release-request-{source.request_sha256}"
            else:
                source.run["run_attempt"] = SOURCE_RUN_ATTEMPT + 1
            with self.subTest(case=case), self.assertRaisesRegex(
                MIRROR.MirrorError,
                "exactly one matching publication artifact",
            ):
                self.apply(request, payloads, raw, target, source=source)
            self.assertEqual(target.create_calls, 0)

    def test_source_artifact_requires_exact_request_and_receipt_files(self) -> None:
        request, payloads, raw = build_fixture()
        cases = ("missing_receipt", "renamed_receipt", "extra_file")
        for case in cases:
            source = FakeSource(request, payloads, raw)
            receipt_bytes = source.archive_entries.pop(
                "public-release-publication-receipt.json"
            )
            if case == "renamed_receipt":
                source.archive_entries["receipt.json"] = receipt_bytes
            elif case == "extra_file":
                source.archive_entries[
                    "public-release-publication-receipt.json"
                ] = receipt_bytes
                source.archive_entries["unexpected.json"] = b"{}"
            target = FakeTarget(request, payloads, state="absent")
            with self.subTest(case=case), self.assertRaisesRegex(
                MIRROR.MirrorError,
                "exactly the request and receipt JSON files",
            ):
                self.apply(request, payloads, raw, target, source=source)
            self.assertEqual(target.create_calls, 0)

    def test_source_publication_receipt_is_size_bounded(self) -> None:
        request, payloads, raw = build_fixture()
        source = FakeSource(request, payloads, raw)
        source.archive_entries["public-release-publication-receipt.json"] = b" " * (
            self.contract["limits"]["max_source_receipt_bytes"] + 1
        )
        target = FakeTarget(request, payloads, state="absent")
        with self.assertRaisesRegex(MIRROR.MirrorError, "receipt size limit"):
            self.apply(request, payloads, raw, target, source=source)
        self.assertEqual(target.create_calls, 0)

    def test_terminal_source_receipt_binds_full_publication_request(self) -> None:
        cases = (
            "terminal_status",
            "mode",
            "workflow_sha",
            "workflow_run_id",
            "workflow_run_attempt",
            "candidate_sha",
            "version",
            "tag",
            "tag_target",
            "release_id",
            "title",
            "body",
            "prerelease",
            "latest",
            "published_at",
            "asset",
            "asset_count",
            "asset_schema",
            "guarantees",
        )
        for case in cases:
            request, payloads, raw = build_fixture()
            receipt = source_publication_receipt(request)
            if case == "terminal_status":
                receipt["terminal_status"] = "blocked"
            elif case == "mode":
                receipt["mode"] = "candidate"
            elif case == "workflow_sha":
                receipt["binding"]["workflow"]["sha"] = "f" * 40
            elif case == "workflow_run_id":
                receipt["binding"]["workflow"]["run_id"] = SOURCE_RUN_ID + 1
            elif case == "workflow_run_attempt":
                receipt["binding"]["workflow"]["run_attempt"] = SOURCE_RUN_ATTEMPT + 1
            elif case == "candidate_sha":
                receipt["binding"]["source_sha"] = "f" * 40
            elif case == "version":
                receipt["binding"]["version"] = "0.5.29"
            elif case == "tag":
                receipt["publication"]["tag"] = "v0.5.29"
            elif case == "tag_target":
                receipt["publication"]["tag_target"] = "f" * 40
            elif case == "release_id":
                receipt["publication"]["release_id"] += 1
            elif case == "title":
                receipt["publication"]["title"] = "Different release"
            elif case == "body":
                receipt["publication"]["body"] = "Different body"
            elif case == "prerelease":
                receipt["publication"]["prerelease"] = True
            elif case == "latest":
                receipt["publication"]["latest"] = False
            elif case == "published_at":
                receipt["lifecycle"]["issued_at"] = "2026-07-25T12:34:57Z"
            elif case == "asset":
                receipt["publication"]["assets"][0]["sha256"] = "sha256:" + "f" * 64
            elif case == "asset_count":
                receipt["publication"]["assets"].pop()
            elif case == "asset_schema":
                receipt["publication"]["assets"][0]["size"] = receipt["publication"][
                    "assets"
                ][0]["size_bytes"]
            else:
                receipt["guarantees"]["asset_uploads"] = ["trajectory-linux-amd64"]
            source = FakeSource(
                request,
                payloads,
                raw,
                source_receipt=receipt,
            )
            target = FakeTarget(request, payloads, state="absent")
            with self.subTest(case=case), self.assertRaises(MIRROR.MirrorError):
                self.apply(request, payloads, raw, target, source=source)
            self.assertEqual(target.create_calls, 0)

    def test_terminal_source_receipt_uses_exact_schema(self) -> None:
        for case in ("missing", "extra"):
            request, payloads, raw = build_fixture()
            receipt = source_publication_receipt(request)
            if case == "missing":
                del receipt["mutation_summary"]
            else:
                receipt["unexpected"] = True
            source = FakeSource(
                request,
                payloads,
                raw,
                source_receipt=receipt,
            )
            target = FakeTarget(request, payloads, state="absent")
            with self.subTest(case=case), self.assertRaisesRegex(
                MIRROR.MirrorError,
                "source publication receipt keys do not match contract",
            ):
                self.apply(request, payloads, raw, target, source=source)
            self.assertEqual(target.create_calls, 0)

    def test_source_workflow_sha_is_bound_to_authenticated_source_run(self) -> None:
        request, payloads, _ = build_fixture()
        request["source"]["sha"] = "f" * 40
        raw = json.dumps(request, sort_keys=True, separators=(",", ":")).encode()
        target = FakeTarget(request, payloads, state="absent")
        with self.assertRaisesRegex(MIRROR.MirrorError, "authenticated source run head SHA"):
            self.apply(request, payloads, raw, target)
        self.assertEqual(target.create_calls, 0)

    def test_candidate_source_sha_requires_exact_full_sha_schema(self) -> None:
        cases = {
            "missing": None,
            "renamed": CANDIDATE_SOURCE_SHA,
            "short": "c" * 39,
            "uppercase": "C" * 40,
        }
        for case, value in cases.items():
            request, payloads, _ = build_fixture()
            source_receipt = source_publication_receipt(request)
            if case == "missing":
                del request["source"]["candidate_sha"]
            elif case == "renamed":
                request["source"]["candidate_source_sha"] = value
            else:
                request["source"]["candidate_sha"] = value
            raw = json.dumps(request, sort_keys=True, separators=(",", ":")).encode()
            source = FakeSource(
                request,
                payloads,
                raw,
                source_receipt=source_receipt,
            )
            target = FakeTarget(request, payloads, state="absent")
            with self.subTest(case=case), self.assertRaises(MIRROR.MirrorError):
                self.apply(request, payloads, raw, target, source=source)
            self.assertEqual(target.create_calls, 0)

    def test_manifest_and_publication_receipt_bind_candidate_source_sha(self) -> None:
        for record in ("manifest", "publication_receipt"):
            request, payloads, _ = build_fixture()
            if record == "manifest":
                request["asset_manifest"]["source_sha"] = "f" * 40
                request["asset_manifest_sha256"] = canonical_digest(
                    request["asset_manifest"]
                )
                request["publication_receipt"]["asset_manifest_sha256"] = request[
                    "asset_manifest_sha256"
                ]
            else:
                request["publication_receipt"]["source_sha"] = "f" * 40
            request["publication_receipt_sha256"] = canonical_digest(
                request["publication_receipt"]
            )
            raw = json.dumps(request, sort_keys=True, separators=(",", ":")).encode()
            target = FakeTarget(request, payloads, state="absent")
            with self.subTest(record=record), self.assertRaisesRegex(
                MIRROR.MirrorError,
                f"{record} identity",
            ):
                self.apply(request, payloads, raw, target)
            self.assertEqual(target.create_calls, 0)

    def test_candidate_source_identity_changes_require_fresh_canonical_digests(self) -> None:
        cases = {
            "manifest": "canonical manifest",
            "publication_receipt": "canonical receipt",
        }
        for record, error in cases.items():
            request, payloads, _ = build_fixture()
            request["source"]["candidate_sha"] = "f" * 40
            request["asset_manifest"]["source_sha"] = "f" * 40
            request["publication_receipt"]["source_sha"] = "f" * 40
            if record == "publication_receipt":
                request["asset_manifest_sha256"] = canonical_digest(
                    request["asset_manifest"]
                )
                request["publication_receipt"]["asset_manifest_sha256"] = request[
                    "asset_manifest_sha256"
                ]
            raw = json.dumps(request, sort_keys=True, separators=(",", ":")).encode()
            target = FakeTarget(request, payloads, state="absent")
            with self.subTest(record=record), self.assertRaisesRegex(
                MIRROR.MirrorError,
                error,
            ):
                self.apply(request, payloads, raw, target)
            self.assertEqual(target.create_calls, 0)

    def test_absent_target_release_is_created_uploaded_and_published(self) -> None:
        request, payloads, raw = build_fixture()
        target = FakeTarget(request, payloads, state="absent")
        receipt = self.apply(request, payloads, raw, target)
        self.assertEqual(receipt["status"], "published")
        self.assertEqual(
            set(receipt),
            {
                "schema_version",
                "kind",
                "status",
                "version",
                "tag",
                "candidate_source_sha",
                "source_workflow_sha",
                "source_run_id",
                "source_run_attempt",
                "target_sha",
                "target_release_id",
                "workflow_run_id",
                "request_sha256",
                "asset_manifest_sha256",
                "publication_receipt_sha256",
                "assets",
                "latest",
            },
        )
        self.assertEqual(receipt["candidate_source_sha"], CANDIDATE_SOURCE_SHA)
        self.assertEqual(receipt["source_workflow_sha"], SOURCE_WORKFLOW_SHA)
        self.assertEqual(receipt["source_run_attempt"], SOURCE_RUN_ATTEMPT)
        self.assertEqual(target.create_calls, 1)
        self.assertEqual(target.upload_calls, self.contract["required_assets"])
        self.assertEqual(target.publish_calls, 1)

    def test_target_receipt_binds_exact_correlated_workflow_run(self) -> None:
        request, payloads, raw = build_fixture()
        target = FakeTarget(request, payloads, state="absent")
        receipt = self.apply(request, payloads, raw, target)

        self.assertEqual(receipt["source_run_id"], SOURCE_RUN_ID)
        self.assertEqual(receipt["request_sha256"], digest(raw))
        self.assertEqual(receipt["workflow_run_id"], 8001)

    def test_existing_published_latest_release_is_idempotently_verified(self) -> None:
        request, payloads, raw = build_fixture()
        target = FakeTarget(request, payloads, state="published", latest=True)
        receipt = self.apply(request, payloads, raw, target)
        self.assertEqual(receipt["status"], "verified")
        self.assertEqual(target.create_calls, 0)
        self.assertEqual(target.upload_calls, [])
        self.assertEqual(target.publish_calls, 0)

    def test_partial_draft_resumes_without_overwriting_existing_assets(self) -> None:
        request, payloads, raw = build_fixture()
        target = FakeTarget(request, payloads, state="draft")
        assert target.release is not None
        kept = target.release["assets"][:2]
        kept_ids = {asset["id"] for asset in kept}
        target.release["assets"] = kept
        target.payloads = {
            asset_id: content
            for asset_id, content in target.payloads.items()
            if asset_id in kept_ids
        }
        self.apply(request, payloads, raw, target)
        self.assertEqual(target.upload_calls, self.contract["required_assets"][2:])
        self.assertEqual(target.publish_calls, 1)

    def test_existing_release_mismatch_never_overwrites(self) -> None:
        cases = ("metadata", "extra", "digest", "size")
        for case in cases:
            request, payloads, raw = build_fixture()
            target = FakeTarget(request, payloads, state="draft")
            assert target.release is not None
            if case == "metadata":
                target.release["name"] = "Different title"
            elif case == "extra":
                target.release["assets"].append(
                    {
                        "id": 999,
                        "name": "unexpected",
                        "size": 1,
                        "digest": f"sha256:{'0' * 64}",
                        "state": "uploaded",
                    }
                )
            elif case == "digest":
                target.release["assets"][0]["digest"] = f"sha256:{'0' * 64}"
            else:
                target.release["assets"][0]["size"] += 1
            with self.subTest(case=case), self.assertRaises(MIRROR.MirrorError):
                self.apply(request, payloads, raw, target)
            self.assertEqual(target.upload_calls, [])
            self.assertEqual(target.publish_calls, 0)

    def test_post_publish_asset_or_metadata_race_fails_receipt(self) -> None:
        for mutation in ("asset", "metadata"):
            request, payloads, raw = build_fixture()
            target = FakeTarget(request, payloads, state="draft")
            target.mutate_after_publish = mutation
            with self.subTest(mutation=mutation), self.assertRaises(MIRROR.MirrorError):
                self.apply(request, payloads, raw, target)

    def test_source_release_and_checksum_bytes_must_match_manifest(self) -> None:
        request, payloads, raw = build_fixture()
        source = FakeSource(request, payloads, raw)
        source.payloads[1] = b"different bytes"
        target = FakeTarget(request, payloads, state="absent")
        with self.assertRaisesRegex(MIRROR.MirrorError, "source release asset bytes"):
            self.apply(request, payloads, raw, target, source=source)
        self.assertEqual(target.create_calls, 0)

        request, payloads, raw = build_fixture(valid_checksum_manifest=False)
        target = FakeTarget(request, payloads, state="absent")
        with self.assertRaisesRegex(MIRROR.MirrorError, "checksums.sha256"):
            self.apply(request, payloads, raw, target)
        self.assertEqual(target.create_calls, 0)

    def test_public_metadata_comes_from_authenticated_receipt_not_source_release_copy(self) -> None:
        request, payloads, raw = build_fixture()
        source = FakeSource(request, payloads, raw)
        source.release["name"] = "Source publication"
        source.release["body"] = "Source-side release record"
        target = FakeTarget(request, payloads, state="absent")
        self.apply(request, payloads, raw, target, source=source)
        assert target.release is not None
        self.assertEqual(target.release["name"], request["release"]["name"])
        self.assertEqual(target.release["body"], request["release"]["body"])

    def test_repository_metadata_must_match_stable_receipt(self) -> None:
        request, payloads, raw = build_fixture()
        target = FakeTarget(request, payloads, state="absent")
        metadata = metadata_for(request)
        metadata["stable"]["version"] = "0.5.27"
        with self.assertRaisesRegex(MIRROR.MirrorError, "stable metadata"):
            self.apply(request, payloads, raw, target, metadata=metadata)
        self.assertEqual(target.create_calls, 0)

    def test_redirects_strip_authorization_and_reject_untrusted_hosts(self) -> None:
        request = urllib.request.Request(
            "https://api.github.com/repos/example/release/assets/1",
            headers={"Authorization": "Bearer sentinel"},
        )
        handler = MIRROR.SafePublicRedirect()
        redirected = handler.redirect_request(
            request,
            None,
            302,
            "Found",
            {},
            "https://release-assets.githubusercontent.com/object",
        )
        assert redirected is not None
        self.assertIsNone(redirected.get_header("Authorization"))
        with self.assertRaises(MIRROR.MirrorError):
            handler.redirect_request(
                request,
                None,
                302,
                "Found",
                {},
                "https://example.invalid/object",
            )
        self.assertIsNone(
            MIRROR.NoRedirect().redirect_request(
                request,
                None,
                302,
                "Found",
                {},
                "https://release-assets.githubusercontent.com/object",
            )
        )

    def test_source_token_exchange_requests_only_contract_read_policy(self) -> None:
        calls: list[tuple[str, dict[str, str]]] = []

        def fake_request(url: str, headers: dict[str, str]) -> dict[str, str]:
            calls.append((url, headers))
            return {"value": "oidc-token"} if len(calls) == 1 else {"token": "source-token"}

        environment = {
            "ACTIONS_ID_TOKEN_REQUEST_URL": (
                "https://pipelines.actions.githubusercontent.com/token?api-version=2.0"
            ),
            "ACTIONS_ID_TOKEN_REQUEST_TOKEN": "runner-token",
        }
        with mock.patch.dict(os.environ, environment, clear=False), mock.patch.object(
            MIRROR,
            "request_json_url",
            side_effect=fake_request,
        ):
            self.assertEqual(MIRROR.exchange_source_token(self.contract), "source-token")

        self.assertEqual(len(calls), 2)
        self.assertIn("audience=dd-octo-sts", calls[0][0])
        self.assertEqual(calls[0][1]["Authorization"], "Bearer runner-token")
        self.assertTrue(
            calls[1][0].startswith(
                "https://webhooks.build.datadoghq.com/sts/exchange?"
            )
        )
        self.assertIn("scope=DataDog%2Ftrajectory", calls[1][0])
        self.assertIn("identity=trajectory-labs.public-release-read", calls[1][0])
        self.assertEqual(calls[1][1]["Authorization"], "Bearer oidc-token")

    def test_github_client_creates_draft_and_sets_latest_only_on_publish(self) -> None:
        request, _, _ = build_fixture()
        client = MIRROR.GitHubClient("datadog-labs/trajectory", "target-token")
        calls: list[tuple[str, str, dict[str, Any] | None]] = []

        def fake_json(
            method: str,
            path: str,
            *,
            payload: dict[str, Any] | None = None,
        ) -> dict[str, Any]:
            calls.append((method, path, payload))
            return {"id": 7001}

        with mock.patch.object(client, "_json", side_effect=fake_json):
            client.create_draft_release(request)
            client.publish_release(7001)

        self.assertEqual(calls[0][0:2], ("POST", "/repos/datadog-labs/trajectory/releases"))
        self.assertEqual(
            calls[0][2],
            {
                "tag_name": "v0.5.28",
                "target_commitish": TARGET_SHA,
                "name": "Trajectory 0.5.28",
                "body": "Trajectory 0.5.28 public binary release.",
                "draft": True,
                "prerelease": False,
                "generate_release_notes": False,
            },
        )
        self.assertEqual(
            calls[1],
            (
                "PATCH",
                "/repos/datadog-labs/trajectory/releases/7001",
                {"draft": False, "prerelease": False, "make_latest": "true"},
            ),
        )

    def test_asset_upload_streams_only_to_github_upload_host(self) -> None:
        class FakeResponse:
            status = 201

            def read(self) -> bytes:
                return b'{"id": 123}'

        class FakeConnection:
            instances: list["FakeConnection"] = []

            def __init__(self, host: str, timeout: int) -> None:
                self.host = host
                self.timeout = timeout
                self.path = ""
                self.headers: dict[str, str] = {}
                self.body = bytearray()
                self.instances.append(self)

            def putrequest(self, method: str, path: str) -> None:
                self.method = method
                self.path = path

            def putheader(self, name: str, value: str) -> None:
                self.headers[name] = value

            def endheaders(self) -> None:
                return None

            def send(self, chunk: bytes) -> None:
                self.body.extend(chunk)

            def getresponse(self) -> FakeResponse:
                return FakeResponse()

            def close(self) -> None:
                return None

        client = MIRROR.GitHubClient("datadog-labs/trajectory", "target-token")
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "trajectory-linux-amd64"
            source.write_bytes(b"release bytes")
            with mock.patch.object(
                MIRROR.http.client,
                "HTTPSConnection",
                FakeConnection,
            ):
                client.upload_asset(7001, source.name, source)

        connection = FakeConnection.instances[0]
        self.assertEqual(connection.host, "uploads.github.com")
        self.assertEqual(connection.method, "POST")
        self.assertIn("name=trajectory-linux-amd64", connection.path)
        self.assertEqual(connection.headers["Authorization"], "Bearer target-token")
        self.assertEqual(bytes(connection.body), b"release bytes")

    def test_workflow_and_sts_policy_are_narrow_and_pinned(self) -> None:
        workflow = (ROOT / ".github/workflows/public-release-mirror.yml").read_text()
        dispatch_policy = (
            ROOT / ".github/chainguard/trajectory.public-release-publication.sts.yaml"
        ).read_text()
        read_policy = (
            ROOT / ".github/chainguard/release-controller-read.sts.yaml"
        ).read_text()
        self.assertIn("workflow_dispatch:", workflow)
        self.assertIn("environment: public-release-mirror", workflow)
        self.assertIn("id-token: write", workflow)
        self.assertIn(
            "run-name: public-release-${{ inputs.source_run_id }}-"
            "${{ inputs.request_sha256 }}",
            workflow,
        )
        self.assertIn(
            "name: public-release-receipt-${{ inputs.request_sha256 }}",
            workflow,
        )
        self.assertNotIn("OCTO_STS_DOMAIN", workflow)
        self.assertNotIn("OCTO_STS_AUDIENCE", workflow)
        self.assertNotIn("pull_request:", workflow)
        self.assertNotIn("\n  push:", workflow)
        uses = re.findall(r"uses:\s+(\S+)", workflow)
        self.assertTrue(uses)
        for action in uses:
            self.assertRegex(action, r"@[0-9a-f]{40}$")

        self.assertIn(
            "subject: repo:DataDog/trajectory:environment:public-release-publication",
            dispatch_policy,
        )
        self.assertIn("event_name: workflow_dispatch", dispatch_policy)
        self.assertIn("ref: refs/heads/main", dispatch_policy)
        self.assertIn("repository: DataDog/trajectory", dispatch_policy)
        self.assertIn(
            r"job_workflow_ref: DataDog/trajectory/\.github/workflows/"
            r"public-release-publication\.yml@refs/heads/main",
            dispatch_policy,
        )
        dispatch_permissions = dispatch_policy.split("permissions:", 1)[1]
        self.assertIn("actions: write", dispatch_permissions)
        self.assertNotIn("contents:", dispatch_permissions)

        expected_read_policy = """\
# Grants one protected release pipeline a short-lived token to correlate the
# exact target workflow run and read its retained receipt. It cannot mutate
# repository contents, releases, actions, or workflow state.
issuer: https://gitlab.ddbuild.io

subject_pattern: "project_path:DataDog/.*:.*"

claim_pattern:
  project_id: "10409"
  ref_type: "branch"
  ref: "private-release-execution/[A-Za-z0-9._:+-]+"
  ref_path: "refs/heads/private-release-execution/[A-Za-z0-9._:+-]+"
  ref_protected: "true"
  pipeline_source: "push"
  ci_config_ref_uri: "gitlab.ddbuild.io/DataDog/[^/]+//.gitlab-ci.yml@refs/heads/private-release-execution/[A-Za-z0-9._:+-]+"

permissions:
  actions: read
  contents: read
"""
        self.assertEqual(read_policy, expected_read_policy)
        self.assertNotIn("actions: write", read_policy)
        self.assertNotIn("contents: write", read_policy)

    def test_publication_surface_contains_no_credentials_or_unexpected_urls(self) -> None:
        paths = (
            ROOT / ".github/workflows/public-release-mirror.yml",
            ROOT / ".github/chainguard/release-controller-read.sts.yaml",
            ROOT / ".github/chainguard/trajectory.public-release-publication.sts.yaml",
            ROOT / ".github/scripts/public_release_mirror.py",
            ROOT / "contracts/public-release-mirror-v1.json",
            ROOT / "docs/PUBLIC-RELEASE-AUTOMATION.md",
        )
        text = "\n".join(path.read_text(encoding="utf-8").lower() for path in paths)
        for forbidden in (
            "github_pat_",
            "ghp_",
            "dd_api_key",
            "dd_app_key",
            "secrets.",
        ):
            self.assertNotIn(forbidden, text)
        for url in re.findall(r"https?://[a-z0-9.-]+", text):
            self.assertRegex(
                url,
                r"^https://(?:api\.github\.com|github\.com|gitlab\.ddbuild\.io|"
                r"token\.actions\.githubusercontent\.com)$",
            )


if __name__ == "__main__":
    unittest.main()
