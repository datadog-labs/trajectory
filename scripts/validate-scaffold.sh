#!/usr/bin/env bash
# Unless explicitly stated otherwise all files in this repository are licensed under the Apache-2.0 License.
# This product includes software developed at Datadog (https://www.datadoghq.com/) Copyright 2026 Datadog, Inc.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

required_paths=(
  ".github/CODEOWNERS"
  ".github/ISSUE_TEMPLATE/bug_report.md"
  ".github/ISSUE_TEMPLATE/config.yml"
  ".github/PULL_REQUEST_TEMPLATE.md"
  ".github/dependabot.yml"
  "LICENSE-3rdparty.csv"
  "NOTICE"
  ".agents/plugins/marketplace.json"
  ".claude-plugin/marketplace.json"
  "RELEASES.json"
  "install.sh"
  "gemini-extension.json"
  "docs/CLIENT-INSTRUMENTATION.md"
  "docs/METRICS-REFERENCE.md"
  "docs/PRIVACY.md"
  "plugin/trajectory/.claude-plugin/plugin.json"
  "plugin/trajectory-codex/.codex-plugin/plugin.json"
  "plugin/trajectory-codex/hooks.json"
  "plugin/trajectory-pi/package.json"
  "plugin/trajectory-opencode/package.json"
  "skills/incognito/SKILL.md"
  "commands/incognito.toml"
)

for path in "${required_paths[@]}"; do
  if [[ ! -e "$ROOT/$path" ]]; then
    echo "missing required path: $path" >&2
    exit 1
  fi
done

blocked_paths=(
  ".worktrees"
  ".claude/worktrees"
  "trajectory"
  "mcp-servers"
  "tests"
  "plugin/trajectory/hooks/trajectory-stop-shim.sh"
)

for path in "${blocked_paths[@]}"; do
  if [[ -e "$ROOT/$path" ]]; then
    echo "blocked path present: $path" >&2
    exit 1
  fi
done

python3 - "$ROOT" <<'PY'
import json
import pathlib
import sys

root = pathlib.Path(sys.argv[1])
json_paths = [
    ".agents/plugins/marketplace.json",
    ".claude-plugin/marketplace.json",
    "RELEASES.json",
    "gemini-extension.json",
    "plugin/trajectory/.claude-plugin/plugin.json",
    "plugin/trajectory/.claude-plugin/.mcp.json",
    "plugin/trajectory/.mcp.json",
    "plugin/trajectory-codex/.codex-plugin/plugin.json",
    "plugin/trajectory-codex/.mcp.json",
    "plugin/trajectory-codex/hooks.json",
    "plugin/trajectory-pi/package.json",
    "plugin/trajectory-pi/tsconfig.json",
    "plugin/trajectory-opencode/package.json",
]

for rel in json_paths:
    with (root / rel).open(encoding="utf-8") as handle:
        json.load(handle)

releases = json.loads((root / "RELEASES.json").read_text(encoding="utf-8"))
unexpected = set(releases) - {"stable", "beta"}
if unexpected:
    raise SystemExit(f"unexpected release channels: {sorted(unexpected)}")
PY

python3 - "$ROOT" <<'PY'
import csv
import pathlib
import sys

path = pathlib.Path(sys.argv[1]) / "LICENSE-3rdparty.csv"
with path.open(encoding="utf-8", newline="") as handle:
    reader = csv.DictReader(handle)
    if reader.fieldnames != ["Component", "Origin", "License", "Copyright"]:
        raise SystemExit("LICENSE-3rdparty.csv has unexpected header")
PY

blocked_patterns=(
  "https://github.com/DataDog/trajectory.git"
  "https://raw.githubusercontent.com/DataDog/trajectory/"
  "github.com/DataDog/trajectory-spec"
  "\"https://github.com/DataDog/trajectory\""
  "gemini extensions install DataDog/trajectory"
  "plugin/trajectory-copilot"
  "plugin/trajectory-droid"
  "plugin/trajectory-openclaw"
  "bravehearts"
  "source_sha"
  "trajectory-dev"
  "/Users/matthew"
  ".worktrees"
  ".claude/worktrees"
  "dd-auth"
  "vault"
  "mechanize"
  "Learnings synthesis"
  "design-partner"
  "design partner"
  "partner-facing"
  "upstream source repository"
  "source migration is approved"
  "Partner installer"
  "not yet contain"
  "instrumentation source"
  "Go instrumentation"
  "added separately"
  "Datadog-maintained builds"
  "\\u2014"
  "—"
  "bazel"
)

for pattern in "${blocked_patterns[@]}"; do
  if grep -R -F -n --exclude-dir=.git --exclude=validate-scaffold.sh -- "$pattern" "$ROOT" >/tmp/trajectory-scaffold-grep.txt; then
    echo "blocked pattern found: $pattern" >&2
    cat /tmp/trajectory-scaffold-grep.txt >&2
    exit 1
  fi
done

echo "scaffold validation passed"
