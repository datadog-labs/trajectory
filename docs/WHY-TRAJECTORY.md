# Why Trajectory

Trajectory provides observability for AI coding agents.

Coding agents work across local CLIs, IDEs, desktop applications,
repositories, and model providers. Much of that activity sits outside
traditional application telemetry, making it difficult to understand how
agents are being used or whether they are producing useful results.

Trajectory instruments supported agent clients and normalizes their activity
into a consistent view in Datadog. It connects agent usage to the people,
repositories, tools, and engineering work behind it.

## What You Can Answer

- Which agents are being used, by whom, and in which repositories?
- What kinds of work are agents doing?
- What does that work cost, and is it producing useful results?
- Where are agents failing, retrying, stalling, or creating rework?
- How do adoption and effectiveness compare across teams and tools?

Trajectory captures sessions and turns, tool activity, token usage, cost, local
development context, and work outcomes. Where a client exposes the signal,
this includes commands, file changes, tests, permission requests, commits, pull
requests, interruptions, compaction, and subagent activity.

Markers turn that activity into organization-specific measurements. Reports
summarize usage, delivery evidence, work mix, cost, complexity, and
evidence-backed deliverables.

## Install

You need a Datadog site and API key, a supported coding agent, and permission to
install a user-level binary:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/datadog-labs/trajectory/main/install.sh)
```

The installer detects local coding agents, walks through Datadog export setup,
and registers the appropriate integrations. Then run:

```bash
trajectory onboard
trajectory status
trajectory publish validate
```

See the [installation guide](../README.md#install), [configuration
guide](CONFIGURATION.md), and [supported-client matrix](SUPPORTED-CLIENTS.md)
for details.

## Local First, Configurable Export

One binary supports multiple coding-agent clients through their native hooks,
plugins, OTel signals, or session sources. Capture is local first. Datadog
export is configurable, and incognito and durable capture controls are
available. Developers keep using their existing tools and workflows.

## How It Fits

Trajectory complements the telemetry you already collect:

- **APM, logs, infrastructure, and security monitoring** cover the applications
  and environments around the developer.
- **AI Gateway** covers model requests, including routing, latency, tokens,
  cost, errors, retries, and policy.
- **Trajectory** covers agent-side work: sessions, tools, repositories,
  developer interactions, and outcomes.
- **Agent Console** brings these signals together into an organization-level
  view of AI-assisted development.

Trajectory provides useful client-level visibility on its own. When AI Gateway
coverage is also present, Trajectory explains the work while the gateway
explains the model traffic behind it.

See [Reports and Work Insights](REPORTS.md) for the local reporting surface and
[Markers](MARKERS.md) for behavior measurement.
