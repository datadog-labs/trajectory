# Contributing

Thanks for helping improve Trajectory.

This repository contains distribution metadata, documentation, and coding-agent plugin assets. Please keep contributions scoped to the files present here.

## Local Checks

```bash
python3 -m json.tool RELEASES.json >/dev/null
bash -n install.sh
```

These checks validate release metadata JSON and shell syntax for the installer.

## Pull Requests

- Keep changes focused on one concern.
- Update docs when install or plugin behavior changes.
- Do not add built binaries to git. Release binaries belong in GitHub Releases.
- Do not add unrelated directories, worktrees, maintainer runbooks, local paths, or credential material.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
