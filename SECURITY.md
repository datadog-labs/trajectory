# Security Policy

## Reporting a Vulnerability

Please do not report security vulnerabilities in public GitHub issues.

Use Datadog's coordinated disclosure process:

- https://www.datadoghq.com/security/

Include enough detail to reproduce the issue, the affected Trajectory version, operating system, client integration, and whether the issue involves local capture, plugin installation, credential handling, or Datadog export.

## Sensitive Data

Trajectory can capture coding-agent session metadata and tool activity. Use incognito mode for sensitive work:

```bash
/incognito
```

Incognito mode keeps local JSONL capture but suppresses publish to non-exempt Datadog destinations for the active session.
