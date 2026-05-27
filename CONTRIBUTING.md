# Contributing

Thanks for helping improve Trajectory.

This repository contains distribution metadata, documentation, and coding-agent plugin assets. Please keep contributions scoped to the files present here.

## Local Checks

```bash
bash scripts/validate-scaffold.sh
```

The validation script checks JSON metadata, required marketplace files, and guardrails that prevent unrelated files, worktree content, local paths, and credential material from entering this repository.

## Pull Requests

- Keep changes focused on one concern.
- Update docs when install or plugin behavior changes.
- Do not add built binaries to git. Release binaries belong in GitHub Releases.
- Do not add unrelated directories, worktrees, maintainer runbooks, local paths, or credential material.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
