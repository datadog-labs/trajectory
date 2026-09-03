#!/usr/bin/env python3
"""Publish exact qualified assets into the public GitHub repository."""

from __future__ import annotations

import argparse
import base64
import hashlib
import http.client
import json
import os
import re
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path
from typing import Any


REQUEST_KIND = "trajectory-public-release-mirror-request"
MANIFEST_KIND = "trajectory-release-asset-manifest"
PUBLICATION_RECEIPT_KIND = "trajectory-publication-receipt"
SOURCE_PUBLICATION_RECEIPT_KIND = "trajectory.public_release_publication.receipt"
TARGET_RECEIPT_KIND = "trajectory-public-release-receipt"
SOURCE_REQUEST_FILENAME = "public-release-request.json"
SOURCE_RECEIPT_FILENAME = "public-release-publication-receipt.json"
OCTO_STS_DOMAIN = "webhooks.build.datadoghq.com"
OCTO_STS_AUDIENCE = "dd-octo-sts"
OCTO_STS_POOL_NAME = "dd-octo-sts"
VERSION_RE = re.compile(
    r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-beta)?$"
)
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SOURCE_SHA_RE = re.compile(r"^[0-9a-f]{40}$")
TIMESTAMP_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
PUBLIC_DOWNLOAD_SUFFIXES = (
    ".actions.githubusercontent.com",
    ".blob.core.windows.net",
    ".githubusercontent.com",
)
CHUNK_SIZE = 1024 * 1024
OIDC_DIAGNOSTIC_CLAIMS = (
    "sub",
    "repository",
    "ref",
    "event_name",
    "environment",
    "workflow_ref",
    "job_workflow_ref",
)


class MirrorError(RuntimeError):
    """The source evidence or public release violates the publication contract."""


class GitHubAPIError(MirrorError):
    def __init__(self, method: str, path: str, status: int, detail: str) -> None:
        super().__init__(f"GitHub API {method} {path} failed: HTTP {status}: {detail}")
        self.status = status


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> None:
        return None


class SafePublicRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> urllib.request.Request | None:
        validate_public_download_url(newurl)
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None:
            redirected.remove_header("Authorization")
        return redirected


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode()


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise MirrorError(f"cannot read JSON from {path}: {error}") from error
    if not isinstance(value, dict):
        raise MirrorError(f"{path} must contain a JSON object")
    return value


def exact_keys(value: Any, expected: set[str], label: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise MirrorError(f"{label} must be an object")
    actual = set(value)
    if actual != expected:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise MirrorError(f"{label} keys do not match contract; missing={missing}, extra={extra}")
    return value


def require_string(value: Any, label: str, *, nonempty: bool = True) -> str:
    if not isinstance(value, str) or (nonempty and not value):
        raise MirrorError(f"{label} must be a non-empty string")
    if "\x00" in value:
        raise MirrorError(f"{label} must not contain NUL")
    return value


def require_positive_int(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value <= 0:
        raise MirrorError(f"{label} must be a positive integer")
    return value


def require_nonnegative_int(value: Any, label: str) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise MirrorError(f"{label} must be a non-negative integer")
    return value


def release_mode_for_version(version: str) -> str:
    if not VERSION_RE.fullmatch(version):
        raise MirrorError("version must be canonical X.Y.Z or X.Y.Z-beta")
    return "beta" if version.endswith("-beta") else "full"


def release_policy(contract: dict[str, Any], mode: str) -> dict[str, bool]:
    modes = contract.get("release_modes")
    if not isinstance(modes, dict) or mode not in modes:
        raise MirrorError(f"contract has no release policy for mode {mode}")
    return modes[mode]


def validate_contract(contract: dict[str, Any]) -> None:
    exact_keys(
        contract,
        {
            "schema_version",
            "kind",
            "source_identity",
            "target",
            "accepted_release_modes",
            "required_assets",
            "release_modes",
            "limits",
        },
        "contract",
    )
    if contract["schema_version"] != 1:
        raise MirrorError("contract.schema_version must be 1")
    if contract["kind"] != "trajectory-public-release-mirror-contract":
        raise MirrorError("contract.kind is not supported")

    source = exact_keys(
        contract["source_identity"],
        {
            "repository",
            "workflow_path",
            "default_branch",
            "environment",
            "event_name",
            "read_policy",
            "publication_artifact_prefix",
        },
        "contract.source_identity",
    )
    for field in source:
        require_string(source[field], f"contract.source_identity.{field}")
    if source["workflow_path"] != ".github/workflows/public-release-publication.yml":
        raise MirrorError("contract.source_identity.workflow_path is not supported")
    if source["default_branch"] != "main":
        raise MirrorError("contract.source_identity.default_branch must be main")

    target = exact_keys(contract["target"], {"repository", "environment", "ref"}, "contract.target")
    for field in target:
        require_string(target[field], f"contract.target.{field}")

    if contract["accepted_release_modes"] != ["full", "beta"]:
        raise MirrorError("contract must accept full and beta releases")
    assets = contract["required_assets"]
    if not isinstance(assets, list) or len(assets) < 2 or len(set(assets)) != len(assets):
        raise MirrorError("contract.required_assets must contain unique binary names and a checksum")
    for name in assets:
        require_string(name, "contract.required_assets entry")
        if Path(name).name != name:
            raise MirrorError(f"asset name must be a basename: {name}")
    if assets[-1] != "checksums.sha256":
        raise MirrorError("checksums.sha256 must be the final required asset")

    release_modes = exact_keys(
        contract["release_modes"], {"full", "beta"}, "contract.release_modes"
    )
    expected_release_modes = {
        "full": {"prerelease": False, "make_latest": True},
        "beta": {"prerelease": True, "make_latest": False},
    }
    for mode, expected in expected_release_modes.items():
        release = exact_keys(
            release_modes[mode],
            {"prerelease", "make_latest"},
            f"contract.release_modes.{mode}",
        )
        if release != expected:
            raise MirrorError(f"contract.release_modes.{mode} is invalid")

    limits = exact_keys(
        contract["limits"],
        {
            "max_request_bytes",
            "max_source_receipt_bytes",
            "max_asset_bytes",
            "max_total_asset_bytes",
        },
        "contract.limits",
    )
    for field, value in limits.items():
        require_positive_int(value, f"contract.limits.{field}")
    if limits["max_request_bytes"] > 65536:
        raise MirrorError("contract.limits.max_request_bytes exceeds workflow input safety bound")
    if limits["max_source_receipt_bytes"] > 65536:
        raise MirrorError("contract.limits.max_source_receipt_bytes exceeds safety bound")
    if limits["max_asset_bytes"] > limits["max_total_asset_bytes"]:
        raise MirrorError("contract asset size limit exceeds total size limit")


def validate_asset_records(
    records: Any,
    required_names: list[str],
    limits: dict[str, int],
    label: str,
) -> list[dict[str, Any]]:
    if not isinstance(records, list) or len(records) != len(required_names):
        raise MirrorError(f"{label} must contain exactly {len(required_names)} assets")
    normalized: list[dict[str, Any]] = []
    total_size = 0
    for index, record_value in enumerate(records):
        record = exact_keys(record_value, {"name", "size", "sha256"}, f"{label}[{index}]")
        name = require_string(record["name"], f"{label}[{index}].name")
        if name != required_names[index]:
            raise MirrorError(f"{label} must use canonical asset order")
        size = require_positive_int(record["size"], f"{label}[{index}].size")
        if size > limits["max_asset_bytes"]:
            raise MirrorError(f"{label}[{index}].size exceeds the per-asset limit")
        total_size += size
        digest = require_string(record["sha256"], f"{label}[{index}].sha256")
        if not SHA256_RE.fullmatch(digest):
            raise MirrorError(f"{label}[{index}].sha256 must be lowercase SHA256")
        normalized.append({"name": name, "size": size, "sha256": digest})
    if total_size > limits["max_total_asset_bytes"]:
        raise MirrorError(f"{label} exceeds the total asset size limit")
    return normalized


def validate_pilot_binding(
    value: Any,
    label: str,
    *,
    prefixed_digests: bool = False,
) -> dict[str, Any]:
    pilot = exact_keys(
        value,
        {
            "status",
            "aggregate_sha256",
            "artifact_sha256",
            "issued_at",
            "expires_at",
            "waiver_sha256",
        },
        label,
    )
    status = require_string(pilot["status"], f"{label}.status")
    if status not in {"pass", "waived"}:
        raise MirrorError(f"{label}.status must be pass or waived")

    def validate_digest(field: str, raw: Any) -> str:
        digest = require_string(raw, f"{label}.{field}")
        if prefixed_digests:
            if not re.fullmatch(r"sha256:[0-9a-f]{64}", digest):
                raise MirrorError(
                    f"{label}.{field} must be canonical sha256:<64 lowercase hex>"
                )
            return digest.removeprefix("sha256:")
        if not SHA256_RE.fullmatch(digest):
            raise MirrorError(f"{label}.{field} must be lowercase SHA256")
        return digest

    normalized = {
        "status": status,
        "aggregate_sha256": validate_digest(
            "aggregate_sha256",
            pilot["aggregate_sha256"],
        ),
        "artifact_sha256": validate_digest(
            "artifact_sha256",
            pilot["artifact_sha256"],
        ),
        "issued_at": require_string(pilot["issued_at"], f"{label}.issued_at"),
        "expires_at": require_string(pilot["expires_at"], f"{label}.expires_at"),
        "waiver_sha256": None,
    }
    for field in ("issued_at", "expires_at"):
        if not TIMESTAMP_RE.fullmatch(normalized[field]):
            raise MirrorError(f"{label}.{field} must be a UTC timestamp")

    waiver = pilot["waiver_sha256"]
    if status == "pass":
        if waiver is not None:
            raise MirrorError(
                f"{label}.waiver_sha256 is forbidden when status is pass"
            )
    else:
        if waiver is None:
            raise MirrorError(f"{label}.waiver_sha256 is required when status is waived")
        normalized["waiver_sha256"] = validate_digest("waiver_sha256", waiver)
    return normalized


def validate_request(
    request: dict[str, Any],
    contract: dict[str, Any],
    *,
    source_run_id: int,
    expected_source_workflow_sha: str,
    expected_repository: str,
    expected_target_sha: str,
) -> dict[str, Any]:
    validate_contract(contract)
    exact_keys(
        request,
        {
            "schema_version",
            "kind",
            "release_mode",
            "version",
            "tag",
            "source",
            "target",
            "release",
            "pilot",
            "asset_manifest",
            "asset_manifest_sha256",
            "publication_receipt",
            "publication_receipt_sha256",
        },
        "request",
    )
    if request["schema_version"] != 1 or request["kind"] != REQUEST_KIND:
        raise MirrorError("request schema or kind is not supported")
    mode = require_string(request["release_mode"], "request.release_mode")
    if mode not in contract["accepted_release_modes"]:
        raise MirrorError("only full and beta releases may be published publicly")

    version = require_string(request["version"], "request.version")
    if not VERSION_RE.fullmatch(version):
        raise MirrorError("request.version must be canonical X.Y.Z or X.Y.Z-beta")
    if release_mode_for_version(version) != mode:
        raise MirrorError("request.release_mode does not match request.version")
    tag = require_string(request["tag"], "request.tag")
    if tag != f"v{version}":
        raise MirrorError("request.tag must be v followed by request.version")

    source = exact_keys(
        request["source"],
        {
            "repository",
            "workflow_ref",
            "environment",
            "event_name",
            "ref",
            "sha",
            "candidate_sha",
            "run_id",
        },
        "request.source",
    )
    for field in ("repository", "environment", "event_name"):
        if source[field] != contract["source_identity"][field]:
            raise MirrorError(f"request.source.{field} does not match the trusted source")
    source_workflow_sha = require_string(source["sha"], "request.source.sha")
    if not SOURCE_SHA_RE.fullmatch(source_workflow_sha):
        raise MirrorError("request.source.sha must be a lowercase 40-character Git SHA")
    if source_workflow_sha != expected_source_workflow_sha:
        raise MirrorError("request.source.sha does not match the authenticated source run head SHA")
    candidate_source_sha = require_string(
        source["candidate_sha"],
        "request.source.candidate_sha",
    )
    if not SOURCE_SHA_RE.fullmatch(candidate_source_sha):
        raise MirrorError(
            "request.source.candidate_sha must be a lowercase 40-character Git SHA"
        )
    validation_tag = f"release-ci-v{version}-{candidate_source_sha[:9]}"
    expected_ref = f"refs/tags/{validation_tag}"
    expected_workflow_ref = (
        f"{contract['source_identity']['repository']}/"
        f"{contract['source_identity']['workflow_path']}@{expected_ref}"
    )
    if (
        source_workflow_sha != candidate_source_sha
        or source["ref"] != expected_ref
        or source["workflow_ref"] != expected_workflow_ref
    ):
        raise MirrorError(
            "request source must be the exact immutable release validation tag"
        )
    if require_positive_int(source["run_id"], "request.source.run_id") != source_run_id:
        raise MirrorError("request.source.run_id does not match the authenticated source run")

    target = exact_keys(request["target"], {"repository", "ref", "sha"}, "request.target")
    if target["repository"] != contract["target"]["repository"] or target["repository"] != expected_repository:
        raise MirrorError("request.target.repository does not match this repository")
    if target["ref"] != contract["target"]["ref"]:
        raise MirrorError("request.target.ref must be the protected main ref")
    if target["sha"] != expected_target_sha or not SOURCE_SHA_RE.fullmatch(str(target["sha"])):
        raise MirrorError("request.target.sha must match the workflow checkout")

    release = exact_keys(
        request["release"],
        {
            "source_release_id",
            "name",
            "body",
            "target_commitish",
            "prerelease",
            "make_latest",
        },
        "request.release",
    )
    require_positive_int(release["source_release_id"], "request.release.source_release_id")
    require_string(release["name"], "request.release.name")
    require_string(release["body"], "request.release.body", nonempty=False)
    if release["target_commitish"] != expected_target_sha:
        raise MirrorError("request.release.target_commitish must match the workflow checkout")
    policy = release_policy(contract, mode)
    if {
        "prerelease": release["prerelease"],
        "make_latest": release["make_latest"],
    } != policy:
        raise MirrorError("request release metadata does not match its release mode")

    pilot = validate_pilot_binding(request["pilot"], "request.pilot")

    manifest = exact_keys(
        request["asset_manifest"],
        {"schema_version", "kind", "version", "tag", "source_sha", "assets"},
        "request.asset_manifest",
    )
    if manifest["schema_version"] != 1 or manifest["kind"] != MANIFEST_KIND:
        raise MirrorError("request.asset_manifest schema or kind is not supported")
    if (
        manifest["version"] != version
        or manifest["tag"] != tag
        or manifest["source_sha"] != candidate_source_sha
    ):
        raise MirrorError("request.asset_manifest identity does not match the request")
    assets = validate_asset_records(
        manifest["assets"],
        contract["required_assets"],
        contract["limits"],
        "request.asset_manifest.assets",
    )
    manifest_sha = require_string(request["asset_manifest_sha256"], "request.asset_manifest_sha256")
    if not SHA256_RE.fullmatch(manifest_sha) or sha256_bytes(canonical_json(manifest)) != manifest_sha:
        raise MirrorError("request.asset_manifest_sha256 does not match the canonical manifest")

    receipt = exact_keys(
        request["publication_receipt"],
        {
            "schema_version",
            "kind",
            "status",
            "release_mode",
            "version",
            "tag",
            "source_sha",
            "source_run_id",
            "published_at",
            "asset_manifest_sha256",
            "assets",
            "pilot",
            "release_metadata",
        },
        "request.publication_receipt",
    )
    if receipt["schema_version"] != 1 or receipt["kind"] != PUBLICATION_RECEIPT_KIND:
        raise MirrorError("request.publication_receipt schema or kind is not supported")
    if receipt["status"] != "published" or receipt["release_mode"] != mode:
        raise MirrorError(
            "request.publication_receipt must prove the requested publication mode"
        )
    expected_identity = (
        version,
        tag,
        candidate_source_sha,
        source_run_id,
        manifest_sha,
    )
    actual_identity = (
        receipt["version"],
        receipt["tag"],
        receipt["source_sha"],
        receipt["source_run_id"],
        receipt["asset_manifest_sha256"],
    )
    if actual_identity != expected_identity:
        raise MirrorError("request.publication_receipt identity does not match the request")
    if not TIMESTAMP_RE.fullmatch(str(receipt["published_at"])):
        raise MirrorError("request.publication_receipt.published_at must be a UTC timestamp")
    receipt_assets = validate_asset_records(
        receipt["assets"],
        contract["required_assets"],
        contract["limits"],
        "request.publication_receipt.assets",
    )
    if receipt_assets != assets:
        raise MirrorError("request.publication_receipt assets do not match the manifest")

    receipt_pilot = validate_pilot_binding(
        receipt["pilot"],
        "request.publication_receipt.pilot",
    )
    if receipt_pilot != pilot:
        raise MirrorError("request pilot copies do not match")

    release_metadata = exact_keys(
        receipt["release_metadata"],
        {"name_sha256", "body_sha256"},
        "request.publication_receipt.release_metadata",
    )
    expected_metadata = {
        "name_sha256": sha256_bytes(release["name"].encode()),
        "body_sha256": sha256_bytes(release["body"].encode()),
    }
    if release_metadata != expected_metadata:
        raise MirrorError("request.publication_receipt release metadata does not match the request")

    receipt_sha = require_string(request["publication_receipt_sha256"], "request.publication_receipt_sha256")
    if not SHA256_RE.fullmatch(receipt_sha) or sha256_bytes(canonical_json(receipt)) != receipt_sha:
        raise MirrorError("request.publication_receipt_sha256 does not match the canonical receipt")
    return request


def validate_source_publication_receipt(
    receipt: dict[str, Any],
    request: dict[str, Any],
    contract: dict[str, Any],
    source_run: dict[str, Any],
) -> None:
    mode = request["release_mode"]
    receipt_keys = {
        "schema_version",
        "kind",
        "terminal_status",
        "mode",
        "binding",
        "publication",
        "guarantees",
        "lifecycle",
        "blockers",
        "outcome",
        "mutation_summary",
    }
    if mode == "full":
        receipt_keys.add("candidate_publication_receipt_sha256")
    exact_keys(
        receipt,
        receipt_keys,
        "source publication receipt",
    )
    if (
        receipt["schema_version"] != 1
        or receipt["kind"] != SOURCE_PUBLICATION_RECEIPT_KIND
        or receipt["terminal_status"] != "success"
        or receipt["mode"] != mode
        or receipt["blockers"] != []
    ):
        raise MirrorError(
            "source publication receipt must prove the requested successful publication"
        )

    binding = exact_keys(
        receipt["binding"],
        {
            "repository",
            "source_sha",
            "version",
            "workflow",
            "readiness",
            "candidate_build",
            "public_mirror",
            "pilot",
            "signed_tag",
            "candidate_publication",
        },
        "source publication receipt.binding",
    )
    for field in ("readiness", "candidate_build", "pilot", "signed_tag"):
        if not isinstance(binding[field], dict):
            raise MirrorError(f"source publication receipt.binding.{field} must be an object")
    candidate_publication = binding["candidate_publication"]
    if mode == "full" and not isinstance(candidate_publication, dict):
        raise MirrorError(
            "source publication receipt.binding.candidate_publication must be an object"
        )
    if mode == "beta" and candidate_publication is not None:
        raise MirrorError(
            "beta publication must not claim an intermediate candidate publication"
        )
    public_mirror = exact_keys(
        binding["public_mirror"],
        {"repository", "target_sha"},
        "source publication receipt.binding.public_mirror",
    )
    if public_mirror != {
        "repository": request["target"]["repository"],
        "target_sha": request["target"]["sha"],
    }:
        raise MirrorError(
            "source publication receipt public mirror binding does not match"
        )
    if (
        binding["repository"] != contract["source_identity"]["repository"]
        or binding["repository"] != request["source"]["repository"]
        or binding["source_sha"] != request["source"]["candidate_sha"]
        or binding["version"] != request["version"]
    ):
        raise MirrorError("source publication receipt release identity does not match the request")

    workflow = exact_keys(
        binding["workflow"],
        {
            "name",
            "ref",
            "sha",
            "default_branch",
            "dispatch_ref",
            "dispatch_sha",
            "run_id",
            "run_attempt",
        },
        "source publication receipt.binding.workflow",
    )
    expected_branch = contract["source_identity"]["default_branch"]
    expected_workflow = {
        "name": source_run["name"],
        "ref": request["source"]["workflow_ref"],
        "sha": request["source"]["sha"],
        "default_branch": expected_branch,
        "dispatch_ref": request["source"]["ref"],
        "dispatch_sha": request["source"]["sha"],
        "run_id": source_run["id"],
        "run_attempt": source_run["run_attempt"],
    }
    if workflow != expected_workflow:
        raise MirrorError("source publication receipt workflow identity does not match the run")

    source_pilot = validate_pilot_binding(
        binding["pilot"],
        "source publication receipt.binding.pilot",
        prefixed_digests=True,
    )
    if source_pilot != request["pilot"]:
        raise MirrorError("source publication receipt pilot does not match the request")

    publication = exact_keys(
        receipt["publication"],
        {
            "tag",
            "tag_target",
            "tag_object_sha",
            "tag_object_sha256",
            "tag_signature_verified",
            "tag_signer_identity",
            "tag_signer_fingerprint",
            "tag_trust_sha256",
            "release_id",
            "title",
            "body",
            "body_sha256",
            "changelog_path",
            "prerelease",
            "latest",
            "assets",
            "url",
            "release_branch",
        },
        "source publication receipt.publication",
    )
    release = request["release"]
    policy = release_policy(contract, mode)
    if (
        publication["tag"] != request["tag"]
        or publication["tag_target"] != request["source"]["candidate_sha"]
        or publication["release_id"] != release["source_release_id"]
        or publication["title"] != release["name"]
        or publication["body"] != release["body"]
        or publication["body_sha256"]
        != f"sha256:{sha256_bytes(release['body'].encode())}"
        or publication["prerelease"] is not policy["prerelease"]
        or publication["latest"] is not policy["make_latest"]
        or publication["tag_signature_verified"] is not True
    ):
        raise MirrorError("source publication receipt release metadata does not match")
    for field in (
        "tag_object_sha",
        "tag_object_sha256",
        "tag_signer_identity",
        "tag_signer_fingerprint",
        "tag_trust_sha256",
        "changelog_path",
        "url",
    ):
        require_string(publication[field], f"source publication receipt.publication.{field}")
    require_positive_int(publication["release_id"], "source publication receipt.publication.release_id")
    release_branch = exact_keys(
        publication["release_branch"],
        {"final", "final_target", "prep", "prep_removed"},
        "source publication receipt.publication.release_branch",
    )
    expected_branch = {
        "final": f"release/v{request['version']}",
        "final_target": request["source"]["candidate_sha"],
        "prep": f"release/v{request['version']}-prep",
        "prep_removed": True,
    }
    if release_branch != expected_branch:
        raise MirrorError("source publication receipt release branch does not match")

    raw_assets = publication["assets"]
    required_names = contract["required_assets"]
    if not isinstance(raw_assets, list) or len(raw_assets) != len(required_names):
        raise MirrorError("source publication receipt must contain the exact contract assets")
    assets_by_name: dict[str, dict[str, Any]] = {}
    for index, value in enumerate(raw_assets):
        asset = exact_keys(
            value,
            {"name", "sha256", "size_bytes"},
            f"source publication receipt.publication.assets[{index}]",
        )
        name = require_string(
            asset["name"],
            f"source publication receipt.publication.assets[{index}].name",
        )
        if name in assets_by_name:
            raise MirrorError(f"source publication receipt contains duplicate asset: {name}")
        source_digest = require_string(
            asset["sha256"],
            f"source publication receipt.publication.assets[{index}].sha256",
        )
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", source_digest):
            raise MirrorError("source publication receipt asset digest is not canonical")
        assets_by_name[name] = {
            "name": name,
            "size": require_positive_int(
                asset["size_bytes"],
                f"source publication receipt.publication.assets[{index}].size_bytes",
            ),
            "sha256": source_digest.removeprefix("sha256:"),
        }
    if set(assets_by_name) != set(required_names):
        raise MirrorError("source publication receipt does not contain the canonical assets")
    normalized_assets = [assets_by_name[name] for name in required_names]
    if normalized_assets != request["asset_manifest"]["assets"]:
        raise MirrorError("source publication receipt assets do not match the request manifest")

    guarantees = exact_keys(
        receipt["guarantees"],
        {
            "rebuild_performed",
            "asset_uploads",
            "asset_reuploads",
            "metadata_only_promotion",
        },
        "source publication receipt.guarantees",
    )
    if guarantees["rebuild_performed"] is not False:
        raise MirrorError("source publication receipt must prove no rebuild")
    if guarantees["asset_reuploads"] != []:
        raise MirrorError("source publication receipt must prove no asset reuploads")
    uploads = guarantees["asset_uploads"]
    if not isinstance(uploads, list) or len(set(uploads)) != len(uploads):
        raise MirrorError("source publication receipt asset uploads are malformed")
    if not set(uploads).issubset(set(contract["required_assets"])):
        raise MirrorError("source publication receipt contains an unexpected asset upload")
    if mode == "full":
        if uploads or guarantees["metadata_only_promotion"] is not True:
            raise MirrorError(
                "source publication receipt does not prove metadata-only full promotion"
            )
    elif guarantees["metadata_only_promotion"] is not False:
        raise MirrorError("beta publication cannot claim metadata-only promotion")

    lifecycle = exact_keys(
        receipt["lifecycle"],
        {"issued_at", "expires_at"},
        "source publication receipt.lifecycle",
    )
    for field in lifecycle:
        if not TIMESTAMP_RE.fullmatch(str(lifecycle[field])):
            raise MirrorError(f"source publication receipt.lifecycle.{field} must be a UTC timestamp")
    if lifecycle["issued_at"] != request["publication_receipt"]["published_at"]:
        raise MirrorError("source publication receipt timestamp does not match the request")

    if mode == "full":
        candidate_receipt_sha = require_string(
            receipt["candidate_publication_receipt_sha256"],
            "source publication receipt.candidate_publication_receipt_sha256",
        )
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", candidate_receipt_sha):
            raise MirrorError("source publication receipt candidate digest is not canonical")
        if receipt["outcome"] not in ("promoted", "idempotent"):
            raise MirrorError(
                "source publication receipt outcome is not a successful full outcome"
            )
    elif receipt["outcome"] not in ("published", "idempotent"):
        raise MirrorError("source publication receipt outcome is not a successful beta outcome")
    mutation = exact_keys(
        receipt["mutation_summary"],
        {"count", "metadata_updates"},
        "source publication receipt.mutation_summary",
    )
    require_nonnegative_int(mutation["count"], "source publication receipt.mutation_summary.count")
    require_nonnegative_int(
        mutation["metadata_updates"],
        "source publication receipt.mutation_summary.metadata_updates",
    )


def validate_repository_metadata(metadata: dict[str, Any], request: dict[str, Any]) -> None:
    mode = request["release_mode"]
    ring = "beta" if mode == "beta" else "stable"
    record = metadata.get(ring)
    if not isinstance(record, dict):
        raise MirrorError(f"RELEASES.json must contain {ring} metadata")
    expected = {
        "version": request["version"],
        "tag": request["tag"],
        "released_at": request["publication_receipt"]["published_at"],
    }
    if record != expected:
        raise MirrorError(
            f"RELEASES.json {ring} metadata does not match the publication receipt"
        )


def validate_public_download_url(url: str) -> None:
    parsed = urllib.parse.urlparse(url)
    hostname = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or parsed.username or parsed.password:
        raise MirrorError("GitHub download redirect must use credential-free HTTPS")
    if parsed.port not in (None, 443):
        raise MirrorError("GitHub download redirect must use the default HTTPS port")
    if not any(hostname.endswith(suffix) for suffix in PUBLIC_DOWNLOAD_SUFFIXES):
        raise MirrorError(f"GitHub download redirect uses an unapproved host: {hostname}")


def copy_bounded(response: Any, destination: Path, max_bytes: int) -> None:
    written = 0
    with destination.open("wb") as handle:
        while True:
            chunk = response.read(min(CHUNK_SIZE, max_bytes + 1 - written))
            if not chunk:
                break
            written += len(chunk)
            if written > max_bytes:
                raise MirrorError(f"download exceeds the {max_bytes}-byte bound")
            handle.write(chunk)


class GitHubClient:
    def __init__(self, repository: str, token: str, api_url: str = "https://api.github.com") -> None:
        if api_url.rstrip("/") != "https://api.github.com":
            raise MirrorError("public release automation requires the canonical GitHub API")
        self.repository = repository
        self.token = token
        self.api_url = api_url.rstrip("/")
        self.no_redirect = urllib.request.build_opener(NoRedirect())
        self.public_download = urllib.request.build_opener(SafePublicRedirect())

    def _request(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        accept: str = "application/vnd.github+json",
    ) -> Any:
        data = canonical_json(payload) if payload is not None else None
        request = urllib.request.Request(
            f"{self.api_url}{path}",
            data=data,
            method=method,
            headers={
                "Accept": accept,
                "Authorization": f"Bearer {self.token}",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "trajectory-public-release-publication",
                **({"Content-Type": "application/json"} if data is not None else {}),
            },
        )
        try:
            return self.no_redirect.open(request, timeout=60)
        except urllib.error.HTTPError as error:
            detail = error.read(4096).decode("utf-8", errors="replace")
            raise GitHubAPIError(method, path, error.code, detail) from error
        except urllib.error.URLError as error:
            raise MirrorError(f"GitHub API {method} {path} failed: {error.reason}") from error

    def _json(
        self,
        method: str,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        with self._request(method, path, payload=payload) as response:
            value = json.load(response)
        if not isinstance(value, dict):
            raise MirrorError(f"GitHub API {method} {path} returned a non-object")
        return value

    def _download(self, path: str, destination: Path, max_bytes: int) -> None:
        request = urllib.request.Request(
            f"{self.api_url}{path}",
            method="GET",
            headers={
                "Accept": "application/octet-stream",
                "Authorization": f"Bearer {self.token}",
                "X-GitHub-Api-Version": "2022-11-28",
                "User-Agent": "trajectory-public-release-publication",
            },
        )
        try:
            response = self.no_redirect.open(request, timeout=60)
        except urllib.error.HTTPError as error:
            if error.code not in (301, 302, 303, 307, 308):
                detail = error.read(4096).decode("utf-8", errors="replace")
                raise GitHubAPIError("GET", path, error.code, detail) from error
            location = error.headers.get("Location")
            if not location:
                raise MirrorError("GitHub download redirect omitted Location") from error
            validate_public_download_url(location)
            public_request = urllib.request.Request(
                location,
                method="GET",
                headers={"User-Agent": "trajectory-public-release-publication"},
            )
            try:
                response = self.public_download.open(public_request, timeout=60)
            except (urllib.error.HTTPError, urllib.error.URLError) as public_error:
                raise MirrorError(f"GitHub public download failed: {public_error}") from public_error
        except urllib.error.URLError as error:
            raise MirrorError(f"GitHub API GET {path} failed: {error.reason}") from error
        with response:
            copy_bounded(response, destination, max_bytes)

    def get_workflow_run(self, run_id: int) -> dict[str, Any]:
        return self._json("GET", f"/repos/{self.repository}/actions/runs/{run_id}")

    def list_run_artifacts(self, run_id: int) -> list[dict[str, Any]]:
        value = self._json(
            "GET",
            f"/repos/{self.repository}/actions/runs/{run_id}/artifacts?per_page=100",
        )
        artifacts = value.get("artifacts")
        if not isinstance(artifacts, list):
            raise MirrorError("source workflow artifacts response is malformed")
        return artifacts

    def download_artifact(self, artifact_id: int, destination: Path, max_bytes: int) -> None:
        self._download(
            f"/repos/{self.repository}/actions/artifacts/{artifact_id}/zip",
            destination,
            max_bytes,
        )

    def get_release(self, release_id: int) -> dict[str, Any]:
        return self._json("GET", f"/repos/{self.repository}/releases/{release_id}")

    def get_release_by_tag(self, tag: str) -> dict[str, Any] | None:
        path = f"/repos/{self.repository}/releases/tags/{urllib.parse.quote(tag, safe='')}"
        try:
            return self._json("GET", path)
        except GitHubAPIError as error:
            if error.status == 404:
                return None
            raise

    def get_latest_release(self) -> dict[str, Any]:
        return self._json("GET", f"/repos/{self.repository}/releases/latest")

    def download_asset(self, asset_id: int, destination: Path, max_bytes: int) -> None:
        self._download(
            f"/repos/{self.repository}/releases/assets/{asset_id}",
            destination,
            max_bytes,
        )

    def create_draft_release(self, request: dict[str, Any]) -> dict[str, Any]:
        return self._json(
            "POST",
            f"/repos/{self.repository}/releases",
            payload={
                "tag_name": request["tag"],
                "target_commitish": request["release"]["target_commitish"],
                "name": request["release"]["name"],
                "body": request["release"]["body"],
                "draft": True,
                "prerelease": request["release"]["prerelease"],
                "generate_release_notes": False,
            },
        )

    def upload_asset(self, release_id: int, name: str, source: Path) -> dict[str, Any]:
        connection = http.client.HTTPSConnection("uploads.github.com", timeout=120)
        path = (
            f"/repos/{self.repository}/releases/{release_id}/assets?"
            + urllib.parse.urlencode({"name": name})
        )
        content_type = (
            "application/vnd.microsoft.portable-executable"
            if name.endswith(".exe")
            else "application/octet-stream"
        )
        try:
            connection.putrequest("POST", path)
            connection.putheader("Accept", "application/vnd.github+json")
            connection.putheader("Authorization", f"Bearer {self.token}")
            connection.putheader("Content-Type", content_type)
            connection.putheader("Content-Length", str(source.stat().st_size))
            connection.putheader("X-GitHub-Api-Version", "2022-11-28")
            connection.putheader("User-Agent", "trajectory-public-release-publication")
            connection.endheaders()
            with source.open("rb") as handle:
                for chunk in iter(lambda: handle.read(CHUNK_SIZE), b""):
                    connection.send(chunk)
            response = connection.getresponse()
            body = response.read()
        finally:
            connection.close()
        if response.status != 201:
            detail = body[:4096].decode("utf-8", errors="replace")
            raise GitHubAPIError("POST", path, response.status, detail)
        try:
            value = json.loads(body)
        except json.JSONDecodeError as error:
            raise MirrorError("GitHub asset upload returned invalid JSON") from error
        if not isinstance(value, dict):
            raise MirrorError("GitHub asset upload returned a non-object")
        return value

    def publish_release(
        self, release_id: int, *, prerelease: bool, make_latest: bool
    ) -> dict[str, Any]:
        return self._json(
            "PATCH",
            f"/repos/{self.repository}/releases/{release_id}",
            payload={
                "draft": False,
                "prerelease": prerelease,
                "make_latest": "true" if make_latest else "false",
            },
        )


def request_json_url(url: str, headers: dict[str, str]) -> dict[str, Any]:
    request = urllib.request.Request(url, method="GET", headers=headers)
    opener = urllib.request.build_opener(NoRedirect())
    try:
        with opener.open(request, timeout=60) as response:
            value = json.load(response)
    except urllib.error.HTTPError as error:
        detail = error.read(4096).decode("utf-8", errors="replace")
        raise MirrorError(f"token exchange request failed: HTTP {error.code}: {detail}") from error
    except (urllib.error.URLError, json.JSONDecodeError) as error:
        raise MirrorError(f"token exchange request failed: {error}") from error
    if not isinstance(value, dict):
        raise MirrorError("token exchange returned a non-object")
    return value


def oidc_claim_diagnostics(token: str) -> str:
    """Return only non-secret identity claims needed to diagnose STS policy mismatches."""
    try:
        encoded_payload = token.split(".")[1]
        padded_payload = encoded_payload + "=" * (-len(encoded_payload) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded_payload))
    except (IndexError, ValueError, json.JSONDecodeError):
        return "unavailable"
    if not isinstance(payload, dict):
        return "unavailable"
    return json.dumps(
        {key: payload[key] for key in OIDC_DIAGNOSTIC_CLAIMS if key in payload},
        sort_keys=True,
    )


def exchange_source_token(contract: dict[str, Any]) -> str:
    oidc_url = require_string(
        os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL"),
        "ACTIONS_ID_TOKEN_REQUEST_URL",
    )
    oidc_request_token = require_string(
        os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN"),
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
    )
    parsed_oidc = urllib.parse.urlparse(oidc_url)
    if parsed_oidc.scheme != "https" or not (parsed_oidc.hostname or "").endswith(
        ".actions.githubusercontent.com"
    ):
        raise MirrorError("GitHub OIDC request URL is not trusted")
    query = urllib.parse.parse_qsl(parsed_oidc.query, keep_blank_values=True)
    query.append(("audience", OCTO_STS_AUDIENCE))
    oidc_request_url = urllib.parse.urlunparse(
        parsed_oidc._replace(query=urllib.parse.urlencode(query))
    )
    oidc = request_json_url(
        oidc_request_url,
        {"Authorization": f"Bearer {oidc_request_token}"},
    )
    oidc_token = require_string(oidc.get("value"), "GitHub OIDC token")
    source_repository = require_string(
        contract["source_identity"]["repository"], "source repository"
    )
    source_parts = source_repository.split("/")
    if len(source_parts) != 2 or not all(source_parts):
        raise MirrorError("source repository must be an owner/repository pair")
    source_owner, source_name = source_parts
    exchange_url = (
        f"https://{OCTO_STS_DOMAIN}/sts/pool/exchange?"
        + urllib.parse.urlencode(
            {
                "policy": contract["source_identity"]["read_policy"],
                "pool_name": OCTO_STS_POOL_NAME,
                "scope_repository.organization": source_owner,
                "scope_repository.repository": source_name,
            }
        )
    )
    try:
        exchanged = request_json_url(
            exchange_url,
            {"Authorization": f"Bearer {oidc_token}"},
        )
    except MirrorError as error:
        raise MirrorError(
            f"{error}; GitHub OIDC claims: {oidc_claim_diagnostics(oidc_token)}"
        ) from error
    return require_string(exchanged.get("token"), "Octo STS source token")


def validate_source_run(
    source_client: Any,
    contract: dict[str, Any],
    source_run_id: int,
) -> dict[str, Any]:
    run: dict[str, Any] | None = None
    for attempt in range(13):
        run = source_client.get_workflow_run(source_run_id)
        if run.get("status") == "completed":
            break
        if attempt == 12:
            raise MirrorError("source publication workflow did not reach a terminal state")
        time.sleep(5)
    assert run is not None
    source = contract["source_identity"]
    repository = run.get("repository")
    if not isinstance(repository, dict) or repository.get("full_name") != source["repository"]:
        raise MirrorError("source workflow run repository does not match the trusted source")
    expected_path = source["workflow_path"]
    expected = {
        "id": source_run_id,
        "event": source["event_name"],
        "path": expected_path,
        "status": "completed",
        "conclusion": "success",
    }
    for field, value in expected.items():
        if run.get(field) != value:
            raise MirrorError(f"source workflow run {field} does not match the trusted source")
    head_sha = run.get("head_sha")
    if not isinstance(head_sha, str) or not SOURCE_SHA_RE.fullmatch(head_sha):
        raise MirrorError("source workflow run head SHA is invalid")
    head_branch = run.get("head_branch")
    branch_match = re.fullmatch(
        r"release-ci-v(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\."
        r"(?:0|[1-9][0-9]*)(?:-beta)?-([0-9a-f]{9})",
        str(head_branch or ""),
    )
    if branch_match is None or branch_match.group(1) != head_sha[:9]:
        raise MirrorError(
            "source workflow run must use its exact immutable release validation tag"
        )
    require_string(run.get("name"), "source workflow run name")
    require_positive_int(run.get("run_attempt"), "source workflow run attempt")
    return run


def load_authenticated_source_evidence(
    source_client: Any,
    contract: dict[str, Any],
    *,
    source_run_id: int,
    request_sha256: str,
    scratch: Path,
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    if not SHA256_RE.fullmatch(request_sha256):
        raise MirrorError("request SHA256 must be 64 lowercase hex characters")
    run = validate_source_run(source_client, contract, source_run_id)
    expected_name = (
        contract["source_identity"]["publication_artifact_prefix"]
        + f"{source_run_id}-{run['run_attempt']}"
    )
    matches = [
        artifact
        for artifact in source_client.list_run_artifacts(source_run_id)
        if isinstance(artifact, dict) and artifact.get("name") == expected_name
    ]
    if len(matches) != 1:
        raise MirrorError("source run must contain exactly one matching publication artifact")
    artifact = matches[0]
    if artifact.get("expired") is not False:
        raise MirrorError("source publication artifact is expired")
    artifact_id = require_positive_int(artifact.get("id"), "source publication artifact ID")
    archive = scratch / "source-publication.zip"
    maximum_bundle_bytes = (
        contract["limits"]["max_request_bytes"]
        + contract["limits"]["max_source_receipt_bytes"]
    )
    source_client.download_artifact(
        artifact_id,
        archive,
        max(maximum_bundle_bytes * 4, CHUNK_SIZE),
    )
    try:
        with zipfile.ZipFile(archive) as bundle:
            entries = [entry for entry in bundle.infolist() if not entry.is_dir()]
            expected_entries = {SOURCE_REQUEST_FILENAME, SOURCE_RECEIPT_FILENAME}
            if len(entries) != 2 or {entry.filename for entry in entries} != expected_entries:
                raise MirrorError(
                    "source publication artifact must contain exactly the request and receipt JSON files"
                )
            entries_by_name = {entry.filename: entry for entry in entries}
            request_entry = entries_by_name[SOURCE_REQUEST_FILENAME]
            receipt_entry = entries_by_name[SOURCE_RECEIPT_FILENAME]
            if request_entry.file_size > contract["limits"]["max_request_bytes"]:
                raise MirrorError("source request exceeds the request size limit")
            if receipt_entry.file_size > contract["limits"]["max_source_receipt_bytes"]:
                raise MirrorError("source publication receipt exceeds the receipt size limit")
            with bundle.open(request_entry) as handle:
                raw_request = handle.read(contract["limits"]["max_request_bytes"] + 1)
            with bundle.open(receipt_entry) as handle:
                raw_receipt = handle.read(
                    contract["limits"]["max_source_receipt_bytes"] + 1
                )
    except (OSError, zipfile.BadZipFile) as error:
        raise MirrorError(f"source publication artifact is not a valid zip: {error}") from error
    if len(raw_request) > contract["limits"]["max_request_bytes"]:
        raise MirrorError("source request exceeds the request size limit")
    if len(raw_receipt) > contract["limits"]["max_source_receipt_bytes"]:
        raise MirrorError("source publication receipt exceeds the receipt size limit")
    if sha256_bytes(raw_request) != request_sha256:
        raise MirrorError("source request artifact SHA256 does not match workflow input")
    try:
        request = json.loads(raw_request)
    except json.JSONDecodeError as error:
        raise MirrorError(f"source request is not valid JSON: {error}") from error
    try:
        source_receipt = json.loads(raw_receipt)
    except json.JSONDecodeError as error:
        raise MirrorError(f"source publication receipt is not valid JSON: {error}") from error
    if not isinstance(request, dict):
        raise MirrorError("source request must be a JSON object")
    if not isinstance(source_receipt, dict):
        raise MirrorError("source publication receipt must be a JSON object")
    return request, source_receipt, run


def validate_release_metadata(
    release: dict[str, Any],
    request: dict[str, Any],
) -> None:
    expected = {
        "tag_name": request["tag"],
        "name": request["release"]["name"],
        "body": request["release"]["body"],
        "prerelease": request["release"]["prerelease"],
        "target_commitish": request["release"]["target_commitish"],
    }
    for field, value in expected.items():
        if release.get(field) != value:
            raise MirrorError(f"GitHub release {field} does not match the request")
    if release.get("draft") not in (True, False):
        raise MirrorError("GitHub release draft state is invalid")


def release_assets_by_name(release: dict[str, Any]) -> dict[str, dict[str, Any]]:
    assets = release.get("assets")
    if not isinstance(assets, list):
        raise MirrorError("GitHub release assets are missing")
    by_name: dict[str, dict[str, Any]] = {}
    for asset in assets:
        if not isinstance(asset, dict) or not isinstance(asset.get("name"), str):
            raise MirrorError("GitHub release contains malformed asset metadata")
        if asset["name"] in by_name:
            raise MirrorError(f"GitHub release contains duplicate asset: {asset['name']}")
        by_name[asset["name"]] = asset
    return by_name


def validate_remote_asset(
    client: Any,
    asset: dict[str, Any],
    expected: dict[str, Any],
    scratch: Path,
) -> tuple[int, str, int, str]:
    if asset.get("state") != "uploaded":
        raise MirrorError(f"GitHub release asset is not uploaded: {expected['name']}")
    if asset.get("size") != expected["size"]:
        raise MirrorError(f"GitHub release asset size mismatch: {expected['name']}")
    asset_id = require_positive_int(asset.get("id"), f"GitHub asset ID for {expected['name']}")
    api_digest = asset.get("digest")
    if api_digest not in (None, f"sha256:{expected['sha256']}"):
        raise MirrorError(f"GitHub release asset API digest mismatch: {expected['name']}")
    if api_digest is None:
        destination = scratch / f"verify-{asset_id}-{expected['name']}"
        client.download_asset(asset_id, destination, expected["size"])
        if destination.stat().st_size != expected["size"] or sha256_file(destination) != expected["sha256"]:
            raise MirrorError(f"downloaded asset mismatch: {expected['name']}")
    return (asset_id, expected["name"], expected["size"], expected["sha256"])


def materialize_source_assets(
    source_client: Any,
    request: dict[str, Any],
    contract: dict[str, Any],
    scratch: Path,
) -> dict[str, Path]:
    release = source_client.get_release(request["release"]["source_release_id"])
    if release.get("id") != request["release"]["source_release_id"]:
        raise MirrorError("source release ID does not match the request")
    if release.get("tag_name") != request["tag"]:
        raise MirrorError("source release tag does not match the request")
    if (
        release.get("draft") is not False
        or release.get("prerelease") is not request["release"]["prerelease"]
    ):
        raise MirrorError("source release state does not match the requested release mode")
    by_name = release_assets_by_name(release)
    required_names = contract["required_assets"]
    if set(by_name) != set(required_names):
        raise MirrorError("source release does not contain exactly the canonical assets")
    paths: dict[str, Path] = {}
    for expected in request["asset_manifest"]["assets"]:
        validate_remote_asset(source_client, by_name[expected["name"]], expected, scratch)
        destination = scratch / f"source-{expected['name']}"
        source_client.download_asset(by_name[expected["name"]]["id"], destination, expected["size"])
        if destination.stat().st_size != expected["size"] or sha256_file(destination) != expected["sha256"]:
            raise MirrorError(f"source release asset bytes do not match: {expected['name']}")
        paths[expected["name"]] = destination
    checksum_lines = paths["checksums.sha256"].read_text(encoding="ascii").splitlines()
    binary_assets = request["asset_manifest"]["assets"][:-1]
    expected_lines = [f"{asset['sha256']}  {asset['name']}" for asset in binary_assets]
    if checksum_lines != expected_lines:
        raise MirrorError("checksums.sha256 does not exactly describe the canonical binaries")
    return paths


def ensure_target_assets(
    target_client: Any,
    release: dict[str, Any],
    request: dict[str, Any],
    contract: dict[str, Any],
    source_paths: dict[str, Path],
    scratch: Path,
) -> tuple[dict[str, Any], tuple[tuple[int, str, int, str], ...]]:
    by_name = release_assets_by_name(release)
    required_names = contract["required_assets"]
    if not set(by_name).issubset(set(required_names)):
        raise MirrorError("target release contains an unexpected asset")
    if release["draft"] is False and set(by_name) != set(required_names):
        raise MirrorError("published target release is missing a canonical asset")

    expected_by_name = {
        asset["name"]: asset for asset in request["asset_manifest"]["assets"]
    }
    for name, asset in by_name.items():
        validate_remote_asset(target_client, asset, expected_by_name[name], scratch)
    if release["draft"]:
        for name in required_names:
            if name not in by_name:
                target_client.upload_asset(release["id"], name, source_paths[name])

    refreshed = target_client.get_release(release["id"])
    validate_release_metadata(refreshed, request)
    refreshed_assets = release_assets_by_name(refreshed)
    if set(refreshed_assets) != set(required_names):
        raise MirrorError("target draft does not contain exactly the canonical assets")
    fingerprint = tuple(
        validate_remote_asset(
            target_client,
            refreshed_assets[expected["name"]],
            expected,
            scratch,
        )
        for expected in request["asset_manifest"]["assets"]
    )
    return refreshed, fingerprint


def publish_target_release(
    target_client: Any,
    request: dict[str, Any],
    contract: dict[str, Any],
    source_paths: dict[str, Path],
    scratch: Path,
) -> tuple[dict[str, Any], str]:
    release = target_client.get_release_by_tag(request["tag"])
    action = "verified"
    if release is None:
        release = target_client.create_draft_release(request)
        action = "published"
    validate_release_metadata(release, request)
    release, before_assets = ensure_target_assets(
        target_client,
        release,
        request,
        contract,
        source_paths,
        scratch,
    )
    if release["draft"]:
        target_client.publish_release(
            release["id"],
            prerelease=request["release"]["prerelease"],
            make_latest=request["release"]["make_latest"],
        )
        action = "published"
    latest = target_client.get_latest_release()
    expects_latest = request["release"]["make_latest"]
    is_latest = latest.get("id") == release["id"] and latest.get("tag_name") == request["tag"]
    if expects_latest and not is_latest:
        target_client.publish_release(
            release["id"], prerelease=False, make_latest=True
        )
        latest = target_client.get_latest_release()
        is_latest = (
            latest.get("id") == release["id"]
            and latest.get("tag_name") == request["tag"]
        )
    if is_latest is not expects_latest:
        state = "latest" if expects_latest else "non-latest"
        raise MirrorError(f"published release is not GitHub {state}")

    final = target_client.get_release(release["id"])
    validate_release_metadata(final, request)
    if (
        final.get("draft") is not False
        or final.get("prerelease") is not request["release"]["prerelease"]
    ):
        raise MirrorError("published release state does not match its release mode")
    final_assets = release_assets_by_name(final)
    if set(final_assets) != set(contract["required_assets"]):
        raise MirrorError("published release asset set changed during publication")
    after_assets = tuple(
        validate_remote_asset(
            target_client,
            final_assets[expected["name"]],
            expected,
            scratch,
        )
        for expected in request["asset_manifest"]["assets"]
    )
    if after_assets != before_assets:
        raise MirrorError("published release assets changed during publication")
    return final, action


def apply_release(
    *,
    contract: dict[str, Any],
    metadata: dict[str, Any],
    source_run_id: int,
    request_sha256: str,
    expected_repository: str,
    expected_target_sha: str,
    workflow_run_id: int,
    source_client: Any,
    target_client: Any,
    receipt_out: Path,
) -> dict[str, Any]:
    validate_contract(contract)
    with tempfile.TemporaryDirectory(prefix="trajectory-public-release-") as directory:
        scratch = Path(directory)
        request, source_receipt, source_run = load_authenticated_source_evidence(
            source_client,
            contract,
            source_run_id=source_run_id,
            request_sha256=request_sha256,
            scratch=scratch,
        )
        validate_request(
            request,
            contract,
            source_run_id=source_run_id,
            expected_source_workflow_sha=source_run["head_sha"],
            expected_repository=expected_repository,
            expected_target_sha=expected_target_sha,
        )
        validate_source_publication_receipt(
            source_receipt,
            request,
            contract,
            source_run,
        )
        validate_repository_metadata(metadata, request)
        source_paths = materialize_source_assets(source_client, request, contract, scratch)
        target_release, action = publish_target_release(
            target_client,
            request,
            contract,
            source_paths,
            scratch,
        )

    receipt = {
        "schema_version": 1,
        "kind": TARGET_RECEIPT_KIND,
        "status": action,
        "version": request["version"],
        "tag": request["tag"],
        "candidate_source_sha": request["source"]["candidate_sha"],
        "source_workflow_sha": request["source"]["sha"],
        "source_run_id": source_run_id,
        "source_run_attempt": source_run["run_attempt"],
        "target_sha": expected_target_sha,
        "target_release_id": target_release["id"],
        "workflow_run_id": workflow_run_id,
        "request_sha256": request_sha256,
        "asset_manifest_sha256": request["asset_manifest_sha256"],
        "publication_receipt_sha256": request["publication_receipt_sha256"],
        "assets": request["asset_manifest"]["assets"],
        "latest": request["release"]["make_latest"],
    }
    receipt_out.parent.mkdir(parents=True, exist_ok=True)
    receipt_out.write_bytes(canonical_json(receipt) + b"\n")
    return receipt


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    validate = subparsers.add_parser("validate-contract")
    validate.add_argument("--contract", required=True, type=Path)

    apply = subparsers.add_parser("apply")
    apply.add_argument("--contract", required=True, type=Path)
    apply.add_argument("--source-run-id", required=True, type=int)
    apply.add_argument("--request-sha256", required=True)
    apply.add_argument("--metadata", required=True, type=Path)
    apply.add_argument("--expected-repository", required=True)
    apply.add_argument("--expected-target-sha", required=True)
    apply.add_argument("--workflow-run-id", required=True, type=int)
    apply.add_argument("--receipt-out", required=True, type=Path)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        contract = load_json(args.contract)
        validate_contract(contract)
        if args.command == "validate-contract":
            return 0

        target_token = os.environ.get("GITHUB_TOKEN")
        if not target_token:
            raise MirrorError("GITHUB_TOKEN is required")
        source_token = exchange_source_token(contract)
        source_client = GitHubClient(contract["source_identity"]["repository"], source_token)
        target_client = GitHubClient(args.expected_repository, target_token)
        receipt = apply_release(
            contract=contract,
            metadata=load_json(args.metadata),
            source_run_id=args.source_run_id,
            request_sha256=args.request_sha256,
            expected_repository=args.expected_repository,
            expected_target_sha=args.expected_target_sha,
            workflow_run_id=args.workflow_run_id,
            source_client=source_client,
            target_client=target_client,
            receipt_out=args.receipt_out,
        )
        print(f"Public GitHub release {receipt['tag']} {receipt['status']} with exact assets")
        return 0
    except MirrorError as error:
        print(f"public release publication failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
