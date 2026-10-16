# Why Trajectory

Trajectory shows how people in your organization use AI coding agents and what
that work produces.

Coding agents run in local CLIs, IDEs, and desktop apps. They work across many
repositories and model providers. Most of this activity does not appear in
normal application telemetry. As a result, it is hard to see how people use
agents and whether the agents produce useful results.

Trajectory instruments supported clients (coding agents) and converts their
activity into one consistent format in Datadog. It links agent use to the
people, repositories, tools, and engineering work involved.

## What do I need to do to install it?

For a pilot, you need these things:

- A Datadog site and API key.
- A supported coding agent.
- Permission to install a user-level binary on the developer's computer.

You do not need to send model traffic through an AI Gateway. If your
organization wants to choose models centrally, you can configure Trajectory's
Claude and Codex launch wrappers to route through your gateway. Capture works
with or without this routing.

```bash
git clone --depth=1 https://github.com/datadog-labs/trajectory.git /tmp/traj && bash /tmp/traj/install.sh
```

The installer finds the coding agents on the computer, asks for the Datadog
export settings, and registers the integrations. Then do these steps:

1. Run `trajectory setup check`.
2. Complete one normal task in the coding agent.
3. Run `trajectory status` and `trajectory publish validate` to verify it.

For larger rollouts, a managed deployment path is in progress. Your existing
MDM or UEM tool deploys the Trajectory binaries and a policy that
administrators own. A per-user reconciliation job then applies the policy for
each user. Administrators choose the approved clients, and MDM stays
responsible for application updates. No MDM provider has validated this path
yet, so treat it as a pilot for now.

For details, see the [installation guide](../README.md#install). For the
onboarding guide, run `trajectory user-guide onboarding`.

## What Trajectory tells you

With Trajectory, you can answer these questions:

- Which agents do people use, who uses them, and in which repositories?
- What kinds of work do people use them for?
- What does that work cost, and does it produce useful results?
- Where do agents fail, retry, stall, or create rework?
- How do adoption and effectiveness compare across teams and tools?

Trajectory captures agent sessions and turns, tool activity, token usage, cost,
local development context, and work outcomes. If the client exposes them,
Trajectory also captures commands, file changes, tests, permission requests,
commits, pull requests, interruptions, compaction, and subagent activity.

One local binary supports many clients through their own hooks, plugins, or
session files. Trajectory captures data on the computer first. You can
configure what it publishes to Datadog. Users can turn on incognito mode, which
stops session content from going to ordinary Datadog destinations. Destinations
that an organization approves for security or audit use can still receive
events. Users can also turn off capture. Developers keep their existing tools
and workflows.

## How it fits into your monitoring ecosystem

Trajectory adds to the telemetry that you already collect:

- **APM, logs, infrastructure, and security monitoring** cover the applications
  and environments around the developer.
- **AI Gateway** covers model requests, including providers, routing, latency,
  tokens, cost, errors, retries, and policy.
- **Trajectory** covers the work on the agent side: sessions, tools,
  repositories, developer interactions, and outcomes.
- **Agent Console** combines these signals into one view of AI-assisted
  development for the whole organization.

Trajectory gives you client-level visibility today without AI Gateway. As more
of your model traffic goes through AI Gateway, the two sources work together. Trajectory explains the
work, and the gateway explains the model traffic behind it.
