# Contributing

Thanks for helping improve Trajectory.

This repository holds the Trajectory installer, documentation, coding-agent
plugins, marketplace metadata, and release metadata. Release binaries are
attached to GitHub Releases.

Datadog generates most files here from its source repository. If you propose
a change to a document, plugin, or installer, Datadog makes the change at the
source. The change then appears here in a later update.

## Local Checks

```bash
python3 -m json.tool RELEASES.json >/dev/null
ruby -e 'require "yaml"; ARGV.each { |path| YAML.parse_file(path) }' \
  .github/workflows/*.yml .github/chainguard/*.yaml
bash -n install.sh uninstall.sh
```

These checks parse the release metadata, the workflow and policy files, and the
shell scripts.

## Pull Requests

- Keep each change to one concern.
- Update the docs when install or plugin behavior changes.
- Do not add built binaries to Git. Release binaries belong in GitHub Releases.
- Do not add local paths, credentials, or files unrelated to the change.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).
