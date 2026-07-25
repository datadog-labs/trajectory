# Contributing

Thanks for helping improve Trajectory.

This repository contains distribution metadata, documentation, and coding-agent plugin assets. Please keep contributions scoped to the files present here.

## Local Checks

```bash
python3 -m json.tool RELEASES.json >/dev/null
python3 .github/scripts/public_release_mirror.py validate-contract \
  --contract contracts/public-release-mirror-v1.json
python3 -m unittest discover -s tests -p 'test_*.py' -v
ruby -e 'require "yaml"; ARGV.each { |path| YAML.parse_file(path) }' \
  .github/workflows/*.yml .github/chainguard/*.yaml
bash -n install.sh
```

These checks validate release metadata, protected publication contracts,
workflow and policy syntax, and shell syntax for the installer.

## Pull Requests

- Keep changes focused on one concern.
- Update docs when install or plugin behavior changes.
- Do not add built binaries to git. Release binaries belong in GitHub Releases.
- Do not add unrelated directories, worktrees, maintainer runbooks, local paths, or credential material.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
