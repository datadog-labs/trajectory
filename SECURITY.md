# Security Policy

## Reporting a Vulnerability

Do not report security vulnerabilities in public GitHub issues.

Use Datadog's coordinated disclosure process:

- https://www.datadoghq.com/security/

Include enough detail to reproduce the issue. Give the affected Trajectory
version, operating system, and client integration. Say whether the issue
involves local capture, plugin installation, credential handling, or Datadog
export.

## Sensitive Data

Trajectory can capture coding-agent session metadata and tool activity. Use
incognito mode for sensitive work. In your coding agent, type:

```text
/incognito
```

In Claude Code, the command is `/trajectory:incognito`.

Incognito mode stops sending the session's trace and log content to Datadog
destinations, except exempt ones. Trajectory still records the session in local
JSONL files and still sends accounting and activity metrics.
