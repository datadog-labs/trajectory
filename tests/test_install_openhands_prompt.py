"""Guard the AH-189 conditional OpenHands local-datastore verification prompt.

The prompt lives inside `install.sh`. Running the installer end-to-end would
download release binaries, so these checks stay text/subprocess-based: they
read the script, assert the prompt is placed inside the correct conditional,
guarded by all four conditions, and syntactically valid.
"""

from __future__ import annotations

import os
import pathlib
import shutil
import subprocess
import unittest


REPO_ROOT = pathlib.Path(__file__).resolve().parent.parent
INSTALL_SH = REPO_ROOT / "install.sh"

# Distinctive substring the installer emits for the AH-189 prompt. Keep in
# sync with install.sh — if that wording changes, update this constant too.
PROMPT_SUBSTR = "local datastore verification"
OPENHANDS_DETECTED_LINE = "OpenHands detected"
OPENHANDS_IF_LINE = "if command -v openhands >/dev/null 2>&1; then"
OPENHANDS_SECTION_END_MARKER = "# OpenCode plugin"


class InstallOpenHandsPromptTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.text = INSTALL_SH.read_text(encoding="utf-8")

    def test_prompt_substring_present(self) -> None:
        self.assertIn(OPENHANDS_DETECTED_LINE, self.text)
        self.assertIn(
            PROMPT_SUBSTR,
            self.text,
            "AH-189 prompt distinctive substring missing from install.sh",
        )

    def test_prompt_is_inside_openhands_conditional(self) -> None:
        # The OpenHands block runs from the `if command -v openhands` line to
        # the next top-level comment (`# OpenCode plugin`). The prompt must
        # live between the `OpenHands detected` info line and that marker.
        if_idx = self.text.find(OPENHANDS_IF_LINE)
        self.assertGreater(if_idx, 0, "OpenHands conditional opener not found")

        detected_idx = self.text.find(OPENHANDS_DETECTED_LINE, if_idx)
        self.assertGreater(
            detected_idx, if_idx,
            "`OpenHands detected` line is not inside the openhands conditional",
        )

        section_end_idx = self.text.find(OPENHANDS_SECTION_END_MARKER, detected_idx)
        self.assertGreater(
            section_end_idx, detected_idx,
            "could not locate end of OpenHands section (`# OpenCode plugin`)",
        )

        prompt_idx = self.text.find(PROMPT_SUBSTR, detected_idx)
        self.assertGreater(
            prompt_idx, detected_idx,
            "AH-189 prompt must appear AFTER the `OpenHands detected` line",
        )
        self.assertLess(
            prompt_idx, section_end_idx,
            "AH-189 prompt must appear BEFORE the next installer section "
            "(`# OpenCode plugin`), i.e. inside the openhands conditional",
        )

    def test_prompt_guarded_by_all_four_conditions(self) -> None:
        # The guard block should sit just above the prompt text. Scan a
        # bounded window around the distinctive substring for each guard.
        prompt_idx = self.text.find(PROMPT_SUBSTR)
        self.assertGreater(prompt_idx, 0)

        window_start = max(0, prompt_idx - 600)
        window_end = min(len(self.text), prompt_idx + 600)
        window = self.text[window_start:window_end]

        self.assertIn(
            "NON_INTERACTIVE", window,
            "AH-189 prompt is not guarded by NON_INTERACTIVE in the local window",
        )
        self.assertTrue(
            "LOCAL_ONLY" in window or "API_KEY_PROVIDED" in window,
            "AH-189 prompt is not guarded by LOCAL_ONLY or API_KEY_PROVIDED "
            "in the local window",
        )
        self.assertIn(
            "-t 0", window,
            "AH-189 prompt is not guarded by a `[ -t 0 ]` stdin-TTY check "
            "in the local window",
        )

    def test_prompt_read_is_eof_safe(self) -> None:
        # `set -e` is on at the top of install.sh, so `read -r reply` on EOF
        # would otherwise abort the installer. The idiom below neutralises
        # that without disabling errexit.
        self.assertIn("read -r reply || reply=\"\"", self.text)

    def test_installer_prints_verification_command_but_does_not_run_it(self) -> None:
        # On yes, the installer must print the command for the user to run,
        # not execute it: no `trajectory features enable openhands_durable_history`
        # or `trajectory backfill --from-openhands` call outside an `info` string.
        self.assertIn("trajectory features enable openhands_durable_history", self.text)
        self.assertIn("trajectory backfill --from-openhands --dry-run", self.text)
        for line in self.text.splitlines():
            stripped = line.strip()
            if stripped.startswith("#") or stripped.startswith("info "):
                continue
            self.assertNotIn(
                "trajectory features enable openhands_durable_history", stripped,
                "install.sh must not execute `trajectory features enable "
                "openhands_durable_history` itself",
            )
            self.assertNotIn(
                "trajectory backfill --from-openhands", stripped,
                "install.sh must not execute `trajectory backfill --from-openhands` itself",
            )

    def test_install_sh_syntax(self) -> None:
        if shutil.which("bash") is None:
            self.skipTest("bash not available on PATH")
        result = subprocess.run(
            ["bash", "-n", "install.sh"],
            cwd=str(REPO_ROOT),
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        self.assertEqual(
            result.returncode, 0,
            msg=f"bash -n install.sh failed: {result.stderr.decode('utf-8', 'replace')}",
        )


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
