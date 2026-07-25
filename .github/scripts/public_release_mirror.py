#!/usr/bin/env python3
"""Publish exact qualified assets into the public GitHub repository."""

from __future__ import annotations

import argparse
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
TARGET_RECEIPT_KIND = "trajectory-public-release-receipt"
VERSION_RE = re.compile(r"^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$")
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SOURCE_SHA_RE = re.compile(r"^[0-9a-f]{40}$")
TIMESTAMP_RE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$")
HOST_RE = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$")
PUBLIC_DOWNLOAD_SUFFIXES = (
    ".actions.githubusercontent.com",
    ".blob.core.windows.net",
    ".githubusercontent.com",
)
CHUNK_SIZE = 1024 * 1024


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
            "release",
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
            "workflow_ref",
            "environment",
            "event_name",
            "ref",
            "read_policy",
            "request_artifact_prefix",
        },
        "contract.source_identity",
    )
    for field in source:
        require_string(source[field], f"contract.source_identity.{field}")

    target = exact_keys(contract["target"], {"repository", "environment", "ref"}, "contract.target")
    for field in target:
        require_string(target[field], f"contract.target.{field}")

    if contract["accepted_release_modes"] != ["full"]:
        raise MirrorError("contract must accept only full releases")
    assets = contract["required_assets"]
    if not isinstance(assets, list) or len(assets) != 7 or len(set(assets)) != 7:
        raise MirrorError("contract.required_assets must contain seven unique names")
    for name in assets:
        require_string(name, "contract.required_assets entry")
        if Path(name).name != name:
            raise MirrorError(f"asset name must be a basename: {name}")
    if assets[-1] != "checksums.sha256":
        raise MirrorError("checksums.sha256 must be the final required asset")

    release = exact_keys(contract["release"], {"prerelease", "make_latest"}, "contract.release")
    if release != {"prerelease": False, "make_latest": True}:
        raise MirrorError("contract.release must require non-prerelease and latest")

    limits = exact_keys(
        contract["limits"],
        {"max_request_bytes", "max_asset_bytes", "max_total_asset_bytes"},
        "contract.limits",
    )
    for field, value in limits.items():
        require_positive_int(value, f"contract.limits.{field}")
    if limits["max_request_bytes"] > 65536:
        raise MirrorError("contract.limits.max_request_bytes exceeds workflow input safety bound")
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


def validate_request(
    request: dict[str, Any],
    contract: dict[str, Any],
    *,
    source_run_id: int,
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
            "asset_manifest",
            "asset_manifest_sha256",
            "publication_receipt",
            "publication_receipt_sha256",
        },
        "request",
    )
    if request["schema_version"] != 1 or request["kind"] != REQUEST_KIND:
        raise MirrorError("request schema or kind is not supported")
    if request["release_mode"] not in contract["accepted_release_modes"]:
        raise MirrorError("only full releases may be published publicly")

    version = require_string(request["version"], "request.version")
    if not VERSION_RE.fullmatch(version):
        raise MirrorError("request.version must be X.Y.Z without a prerelease suffix")
    tag = require_string(request["tag"], "request.tag")
    if tag != f"v{version}":
        raise MirrorError("request.tag must be v followed by request.version")

    source = exact_keys(
        request["source"],
        {"repository", "workflow_ref", "environment", "event_name", "ref", "sha", "run_id"},
        "request.source",
    )
    for field in ("repository", "workflow_ref", "environment", "event_name", "ref"):
        if source[field] != contract["source_identity"][field]:
            raise MirrorError(f"request.source.{field} does not match the trusted source")
    source_sha = require_string(source["sha"], "request.source.sha")
    if not SOURCE_SHA_RE.fullmatch(source_sha):
        raise MirrorError("request.source.sha must be a lowercase 40-character Git SHA")
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
    if release["prerelease"] is not False:
        raise MirrorError("prerelease requests must not publish publicly")
    if release["make_latest"] is not True:
        raise MirrorError("full public releases must set latest")

    manifest = exact_keys(
        request["asset_manifest"],
        {"schema_version", "kind", "version", "tag", "source_sha", "assets"},
        "request.asset_manifest",
    )
    if manifest["schema_version"] != 1 or manifest["kind"] != MANIFEST_KIND:
        raise MirrorError("request.asset_manifest schema or kind is not supported")
    if manifest["version"] != version or manifest["tag"] != tag or manifest["source_sha"] != source_sha:
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
            "release_metadata",
        },
        "request.publication_receipt",
    )
    if receipt["schema_version"] != 1 or receipt["kind"] != PUBLICATION_RECEIPT_KIND:
        raise MirrorError("request.publication_receipt schema or kind is not supported")
    if receipt["status"] != "published" or receipt["release_mode"] != "full":
        raise MirrorError("request.publication_receipt must prove a completed full publication")
    expected_identity = (version, tag, source_sha, source_run_id, manifest_sha)
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


def validate_repository_metadata(metadata: dict[str, Any], request: dict[str, Any]) -> None:
    stable = metadata.get("stable")
    if not isinstance(stable, dict):
        raise MirrorError("RELEASES.json must contain stable metadata")
    expected = {
        "version": request["version"],
        "tag": request["tag"],
        "released_at": request["publication_receipt"]["published_at"],
    }
    if stable != expected:
        raise MirrorError("RELEASES.json stable metadata does not match the publication receipt")


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
                "prerelease": False,
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

    def publish_release(self, release_id: int) -> dict[str, Any]:
        return self._json(
            "PATCH",
            f"/repos/{self.repository}/releases/{release_id}",
            payload={"draft": False, "prerelease": False, "make_latest": "true"},
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


def exchange_source_token(contract: dict[str, Any]) -> str:
    domain = require_string(os.environ.get("OCTO_STS_DOMAIN"), "OCTO_STS_DOMAIN")
    audience = require_string(os.environ.get("OCTO_STS_AUDIENCE"), "OCTO_STS_AUDIENCE")
    oidc_url = require_string(
        os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL"),
        "ACTIONS_ID_TOKEN_REQUEST_URL",
    )
    oidc_request_token = require_string(
        os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN"),
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
    )
    if not HOST_RE.fullmatch(domain) or "/" in domain:
        raise MirrorError("OCTO_STS_DOMAIN must be a hostname without a URL scheme")
    parsed_oidc = urllib.parse.urlparse(oidc_url)
    if parsed_oidc.scheme != "https" or not (parsed_oidc.hostname or "").endswith(
        ".actions.githubusercontent.com"
    ):
        raise MirrorError("GitHub OIDC request URL is not trusted")
    query = urllib.parse.parse_qsl(parsed_oidc.query, keep_blank_values=True)
    query.append(("audience", audience))
    oidc_request_url = urllib.parse.urlunparse(
        parsed_oidc._replace(query=urllib.parse.urlencode(query))
    )
    oidc = request_json_url(
        oidc_request_url,
        {"Authorization": f"Bearer {oidc_request_token}"},
    )
    oidc_token = require_string(oidc.get("value"), "GitHub OIDC token")
    exchange_url = (
        f"https://{domain}/sts/exchange?"
        + urllib.parse.urlencode(
            {
                "scope": contract["source_identity"]["repository"],
                "identity": contract["source_identity"]["read_policy"],
            }
        )
    )
    exchanged = request_json_url(
        exchange_url,
        {"Authorization": f"Bearer {oidc_token}"},
    )
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
    expected_path = source["workflow_ref"].split("@", 1)[0].split(source["repository"] + "/", 1)[1]
    expected_branch = source["ref"].removeprefix("refs/heads/")
    expected = {
        "event": source["event_name"],
        "path": expected_path,
        "head_branch": expected_branch,
        "status": "completed",
        "conclusion": "success",
    }
    for field, value in expected.items():
        if run.get(field) != value:
            raise MirrorError(f"source workflow run {field} does not match the trusted source")
    head_sha = run.get("head_sha")
    if not isinstance(head_sha, str) or not SOURCE_SHA_RE.fullmatch(head_sha):
        raise MirrorError("source workflow run head SHA is invalid")
    return run


def load_authenticated_request(
    source_client: Any,
    contract: dict[str, Any],
    *,
    source_run_id: int,
    request_sha256: str,
    scratch: Path,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if not SHA256_RE.fullmatch(request_sha256):
        raise MirrorError("request SHA256 must be 64 lowercase hex characters")
    run = validate_source_run(source_client, contract, source_run_id)
    expected_name = contract["source_identity"]["request_artifact_prefix"] + request_sha256
    matches = [
        artifact
        for artifact in source_client.list_run_artifacts(source_run_id)
        if isinstance(artifact, dict) and artifact.get("name") == expected_name
    ]
    if len(matches) != 1:
        raise MirrorError("source run must contain exactly one matching request artifact")
    artifact = matches[0]
    if artifact.get("expired") is not False:
        raise MirrorError("source request artifact is expired")
    artifact_id = require_positive_int(artifact.get("id"), "source request artifact ID")
    archive = scratch / "source-request.zip"
    source_client.download_artifact(
        artifact_id,
        archive,
        max(contract["limits"]["max_request_bytes"] * 4, CHUNK_SIZE),
    )
    try:
        with zipfile.ZipFile(archive) as bundle:
            entries = [entry for entry in bundle.infolist() if not entry.is_dir()]
            if len(entries) != 1 or entries[0].filename != "public-release-request.json":
                raise MirrorError("source request artifact must contain only public-release-request.json")
            entry = entries[0]
            if entry.file_size > contract["limits"]["max_request_bytes"]:
                raise MirrorError("source request exceeds the request size limit")
            with bundle.open(entry) as handle:
                raw = handle.read(contract["limits"]["max_request_bytes"] + 1)
    except (OSError, zipfile.BadZipFile) as error:
        raise MirrorError(f"source request artifact is not a valid zip: {error}") from error
    if len(raw) > contract["limits"]["max_request_bytes"]:
        raise MirrorError("source request exceeds the request size limit")
    if sha256_bytes(raw) != request_sha256:
        raise MirrorError("source request artifact SHA256 does not match workflow input")
    try:
        request = json.loads(raw)
    except json.JSONDecodeError as error:
        raise MirrorError(f"source request is not valid JSON: {error}") from error
    if not isinstance(request, dict):
        raise MirrorError("source request must be a JSON object")
    return request, run


def validate_release_metadata(
    release: dict[str, Any],
    request: dict[str, Any],
) -> None:
    expected = {
        "tag_name": request["tag"],
        "name": request["release"]["name"],
        "body": request["release"]["body"],
        "prerelease": False,
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
    if release.get("draft") is not False or release.get("prerelease") is not False:
        raise MirrorError("source release must already be a published full release")
    by_name = release_assets_by_name(release)
    required_names = contract["required_assets"]
    if set(by_name) != set(required_names):
        raise MirrorError("source release does not contain exactly the seven canonical assets")
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
        raise MirrorError("checksums.sha256 does not exactly describe the six canonical binaries")
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
        raise MirrorError("target draft does not contain exactly the seven canonical assets")
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
        target_client.publish_release(release["id"])
        action = "published"
    latest = target_client.get_latest_release()
    if latest.get("id") != release["id"] or latest.get("tag_name") != request["tag"]:
        target_client.publish_release(release["id"])
        latest = target_client.get_latest_release()
    if latest.get("id") != release["id"] or latest.get("tag_name") != request["tag"]:
        raise MirrorError("published release is not GitHub latest")

    final = target_client.get_release(release["id"])
    validate_release_metadata(final, request)
    if final.get("draft") is not False or final.get("prerelease") is not False:
        raise MirrorError("published release state is not a full public release")
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
        request, source_run = load_authenticated_request(
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
            expected_repository=expected_repository,
            expected_target_sha=expected_target_sha,
        )
        if request["source"]["sha"] != source_run["head_sha"]:
            raise MirrorError("request source SHA does not match the authenticated source run")
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
        "source_sha": request["source"]["sha"],
        "source_run_id": source_run_id,
        "target_sha": expected_target_sha,
        "target_release_id": target_release["id"],
        "workflow_run_id": workflow_run_id,
        "request_sha256": request_sha256,
        "asset_manifest_sha256": request["asset_manifest_sha256"],
        "publication_receipt_sha256": request["publication_receipt_sha256"],
        "assets": request["asset_manifest"]["assets"],
        "latest": True,
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
