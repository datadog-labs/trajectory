from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / ".github" / "scripts"
sys.path.insert(0, str(SCRIPTS))
SCRIPT = SCRIPTS / "public_release_from_source.py"
SPEC = importlib.util.spec_from_file_location("public_release_from_source", SCRIPT)
assert SPEC and SPEC.loader
SOURCE_MIRROR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SOURCE_MIRROR)


class FakeSourceClient:
    def __init__(
        self,
        release: dict[str, object],
        latest: dict[str, object] | None = None,
    ) -> None:
        self.release = release
        self.latest = latest or release

    def get_release_by_tag(self, tag: str) -> dict[str, object] | None:
        return self.release if self.release["tag_name"] == tag else None

    def get_latest_release(self) -> dict[str, object]:
        return self.latest


def release_fixture() -> dict[str, object]:
    assets = [
        {
            "id": index + 1,
            "name": name,
            "size": index + 10,
            "digest": f"sha256:{index + 1:064x}",
            "state": "uploaded",
        }
        for index, name in enumerate(SOURCE_MIRROR.REQUIRED_ASSETS)
    ]
    return {
        "id": 1234,
        "tag_name": "v0.5.37",
        "name": "Trajectory 0.5.37",
        "body": "Release notes\n",
        "published_at": "2026-08-20T23:31:54Z",
        "draft": False,
        "prerelease": False,
        "assets": assets,
    }


def beta_release_fixture() -> dict[str, object]:
    release = release_fixture()
    release.update(
        {
            "tag_name": "v0.6.0-beta",
            "name": "Trajectory 0.6.0-beta",
            "published_at": "2026-09-03T12:34:56Z",
            "prerelease": True,
        }
    )
    return release


class PublicReleaseFromSourceTests(unittest.TestCase):
    def test_build_request_uses_only_public_release_facts(self) -> None:
        release = release_fixture()
        request, observed = SOURCE_MIRROR.build_request(
            FakeSourceClient(release),
            version="0.5.37",
            target_sha="a" * 40,
        )

        self.assertIs(observed, release)
        self.assertEqual(request["tag"], "v0.5.37")
        self.assertEqual(request["published_at"], "2026-08-20T23:31:54Z")
        self.assertEqual(
            [asset["name"] for asset in request["asset_manifest"]["assets"]],
            list(SOURCE_MIRROR.REQUIRED_ASSETS),
        )
        self.assertEqual(request["release"]["target_commitish"], "a" * 40)

    def test_build_request_rejects_non_latest_release(self) -> None:
        release = release_fixture()
        client = FakeSourceClient(release)
        client.get_latest_release = lambda: {"id": 9999, "tag_name": "v0.5.36"}

        with self.assertRaisesRegex(SOURCE_MIRROR.mirror.MirrorError, "GitHub latest"):
            SOURCE_MIRROR.build_request(
                client,
                version="0.5.37",
                target_sha="a" * 40,
            )

    def test_build_request_rejects_asset_set_drift(self) -> None:
        release = release_fixture()
        release["assets"] = release["assets"][:-1]

        with self.assertRaisesRegex(SOURCE_MIRROR.mirror.MirrorError, "canonical asset set"):
            SOURCE_MIRROR.build_request(
                FakeSourceClient(release),
                version="0.5.37",
                target_sha="a" * 40,
            )

    def test_build_request_accepts_beta_prerelease_only_when_nonlatest(self) -> None:
        release = beta_release_fixture()
        request, _ = SOURCE_MIRROR.build_request(
            FakeSourceClient(
                release,
                latest={"id": 9999, "tag_name": "v0.5.37"},
            ),
            version="0.6.0-beta",
            target_sha="a" * 40,
        )

        self.assertEqual(request["release_mode"], "beta")
        self.assertTrue(request["release"]["prerelease"])
        self.assertFalse(request["release"]["make_latest"])
        with self.assertRaisesRegex(SOURCE_MIRROR.mirror.MirrorError, "non-latest"):
            SOURCE_MIRROR.build_request(
                FakeSourceClient(release),
                version="0.6.0-beta",
                target_sha="a" * 40,
            )

    def test_metadata_must_advance_stable_and_beta_together(self) -> None:
        request = {
            "release_mode": "full",
            "version": "0.5.37",
            "tag": "v0.5.37",
            "published_at": "2026-08-20T23:31:54Z",
        }
        expected = {
            "version": "0.5.37",
            "tag": "v0.5.37",
            "released_at": "2026-08-20T23:31:54Z",
        }
        SOURCE_MIRROR.validate_metadata(
            {"stable": expected, "beta": expected.copy()}, request
        )
        with self.assertRaisesRegex(SOURCE_MIRROR.mirror.MirrorError, "RELEASES.json"):
            SOURCE_MIRROR.validate_metadata(
                {"stable": expected, "beta": {**expected, "version": "0.5.36"}},
                request,
            )

    def test_beta_metadata_advances_only_beta_ring(self) -> None:
        request = {
            "release_mode": "beta",
            "version": "0.6.0-beta",
            "tag": "v0.6.0-beta",
            "published_at": "2026-09-03T12:34:56Z",
        }
        stable = {
            "version": "0.5.37",
            "tag": "v0.5.37",
            "released_at": "2026-08-20T23:31:54Z",
        }
        beta = {
            "version": "0.6.0-beta",
            "tag": "v0.6.0-beta",
            "released_at": "2026-09-03T12:34:56Z",
        }

        SOURCE_MIRROR.validate_metadata({"stable": stable, "beta": beta}, request)
        with self.assertRaisesRegex(SOURCE_MIRROR.mirror.MirrorError, "beta metadata"):
            SOURCE_MIRROR.validate_metadata(
                {"stable": stable, "beta": {**beta, "version": "0.5.37"}},
                request,
            )


if __name__ == "__main__":
    unittest.main()
