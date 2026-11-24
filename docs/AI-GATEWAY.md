# AI Gateway Routing

`trajectory claude` and `trajectory codex` can send a coding agent's model
requests through your organization's AI Gateway. The gateway covers the model
requests. Agent Console joins gateway and Trajectory signals into one view of
your organization. Routing is optional, and capture works the same either
way.

## Launch through the gateway

Name a gateway profile when you start the agent:

```bash
trajectory claude --gateway example-openweights
trajectory codex --gateway example-openweights --gateway-model glm-5.2
```

- `--gateway <profile>` sends model requests through a local adapter that
  runs for that launch only.
- `--gateway-model <model>` picks a model from the profile instead of its
  default.
- `--gateway-team <team>` sets the gateway team.
- `--no-gateway` connects straight to the provider.

By default, a launch uses the gateway only when you pass `--gateway`, because
the automatic choice from `ai_gateway.defaults` is off by default.

On macOS, `trajectory claude-desktop` writes a Claude third-party inference
profile and starts Claude Desktop through the gateway.

Gateway launches keep your Claude Code user, project, and local settings, but
ignore the provider and key settings in them. Gateway models appear in the
Claude Code and Codex `/model` pickers for launches without `--provider`.
Launches keep the gateway team and the `x-dd-tag-*` tags from client headers.
Trajectory leaves its own telemetry keys and `otelHeadersHelper` out of the
settings it passes to Claude Code.

## Configure gateways

The `ai_gateway` map has three parts: `defaults`, `upstreams`, and
`profiles`. Set it in YAML in `~/.trajectory/config.yaml`. An administrator
can also place it in `config.defaults.yaml` on a computer with no
organization config source. `trajectory config set` does not accept
`ai_gateway`. Cohorts and downloaded organization files cannot set it.

```yaml
ai_gateway:
  defaults:
    claude: example-openweights
    codex: example-openweights
  upstreams:
    example-chat:
      protocol: openai_chat_completions
      base_url: https://ai-gateway.example/v1
      auth:
        type: bearer_secret
        secret_ref: example_gateway_token
  profiles:
    example-openweights:
      display_name: Example Open Models
      default_model: glm-5.2
      models:
        glm-5.2:
          upstream: example-chat
          upstream_model: baseten/glm-5.2
          context_window: 1000000
          max_output_tokens: 131072
```

An upstream `protocol` is `openai_chat_completions` or `anthropic_messages`.
Its `auth.type` is `pup_bearer`, `bearer_secret`, `x_api_key_secret`, or
`none`. Store a secret with `trajectory config set-secret <name>`.

A module's `modules.<id>.launch` setting is its launch opt-in, separate from
`enabled`. Gateway routing uses it, and setup records it.

## Authentication

`pup_bearer` gets a token from your Datadog command-line login when the agent
starts. Trajectory keeps the token for four minutes. Set `auth.cache_ttl`
between `30s` and `15m` to change that.

If the upstream answers 401, the adapter drops the token and retries once. It
does not retry other errors or a stream that fails partway. It never sends an
expired token.

## Limits

- The adapter listens on a temporary `127.0.0.1` port with a credential for
  that launch. It stops with the client.
- It caps requests and non-streaming responses at 64 MiB.
- It never falls back to direct provider credentials.
- Routing starts no Trajectory model calls. It sends no startup probes and one
  upstream request for each client request. It counts tokens only when Claude
  Code asks.
- Routing between protocols carries text, images, tools, tool results, stop
  controls, and usage. It rejects content that has no safe match.
- A capture failure never changes the response.

## Managed setup

The managed `frontier-ai-gateway` security module runs in no hook. It routes
only launches that ask for a gateway profile. A change applies at the next
such launch.

## Costs and tags

Gateway launches report `trajectory.billing_lane:api` and set
`trajectory.provider`. Codex gateway sessions get `trajectory.provider:openai`.
The gateway can translate a response to the client's format and keep the
upstream service tier and cache-write durations, so pricing uses them.

`trajectory.session.outcome` log events feed the gateway's Smart Routing
readout. Trajectory sends them only to a managed destination that is
authorized for them, and sends none for incognito sessions. The receiving log
index must keep them for the readout's 60-day lookback.
