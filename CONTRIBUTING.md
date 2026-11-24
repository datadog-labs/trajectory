# Contributing

This repository holds the Trajectory installer, docs, client plugins,
marketplace metadata, intercept runtime, shared skills, and `RELEASES.json`.
Release binaries are on GitHub Releases.

Datadog generates most files here from its source repository. Datadog makes
an accepted change there, and it reaches this repository in a later sync.

## Local Checks

```bash
python3 -m json.tool RELEASES.json >/dev/null
ruby -e 'require "yaml"; ARGV.each { |path| YAML.parse_file(path) }' \
  .github/workflows/*.yml .github/chainguard/*.yaml
bash -n install.sh uninstall.sh
```

## Pull Requests

- Keep each pull request to one concern.
- Update the docs when install or plugin behavior changes.
- Never add binaries, local paths, credentials, or unrelated files.

## Security

Never report a vulnerability in a public issue. Follow [SECURITY.md](SECURITY.md).
