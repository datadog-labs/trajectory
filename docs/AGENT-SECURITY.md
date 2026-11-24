# Agent Security

Agent Security, the `agent-security` module, checks what coding agents do.
AI-EDR runs rules on the computer, and AI Guard asks Datadog's AI Guard
service. Observe mode records findings, and enforce mode can block. It covers
Claude Code, Codex, Cursor, GitHub Copilot CLI, Kiro CLI, and Antigravity CLI
(`agy`). Its marketplace plugin, `trajectory-security`, sits next to the core
`trajectory` plugin and needs only the binary at
`~/.trajectory/bin/trajectory`, or at `TRAJECTORY_BINARY`.

## Turn it on or off

- Set `modules.agent-security.enabled: false` to turn off Agent Security for
  every client.
- AI-EDR is off by default. Only managed config can make it available, not
  setup or user `config.yaml`. Without it, only AI Guard checks run.
- Administrators can stop AI-EDR reading Copilot patch files and keep Agent
  Security on for Copilot.

## Commands

Security setup installs the controls for the clients you name. For observe
mode in Claude Code, Codex, and Cursor, run:

```bash
trajectory plugins security setup --mode observe --clients cc,codex,cursor
```

This installs the Claude Code and Codex plugins and syncs Cursor's hooks, and
is safe to rerun. Each client's first session runs
`trajectory plugins security setup --marketplace --clients <client>`, which
turns on observe without the core plugin. It keeps enforce mode and leaves a
disabled module off.

- All clients share one mode. Setup without `--mode` keeps it, and
  per-evaluator modes override it.
- Enforce can block actions, so it needs `--yes`:
  `trajectory plugins security enable --mode enforce --clients <client> --yes`.
  Resuming enforce after a disable also needs `--yes`.
- `trajectory plugins modules evaluator enable agent-security ai_edr --mode enforce|observe`
  sets AI-EDR's mode. Blocking also needs managed AI-EDR enforcement.
- To stop blocking, rerun security setup with `--mode observe` and set AI-EDR
  to observe. Setup never resets an evaluator you set by hand.
- `trajectory plugins security status` shows state, mode, and warnings, and
  changes nothing. It lists Kiro hook files but skips `agy`.
- `trajectory plugins modules records --module agent-security` lists the local
  decisions as hooks run.
- `trajectory plugins security destination add --destination <name> --app-key-ref <ref>`
  sends Agent Security spans to a required destination, so you can read results
  back.
- `trajectory plugins security disable --clients <list> --remove-hooks` turns
  Agent Security off and removes those clients' security hooks or plugins.
  Capture keeps running. Other clients' security hooks stay and allow
  everything. Rerun setup naming your clients, or uninstall
  `trajectory-security`.

Never put a key value in a command or manifest. Store a reference with
`trajectory config set-secret <ref> --stdin`, or use `DD_APP_KEY`. The
`trajectory-security` skill runs the installed binary and holds no policy.

## All clients

- Findings publish only for captured sessions. Security setup installs no
  capture and doctor does not warn. Otherwise decisions stay local.
- A hook crash, timeout, or missing binary never blocks. Only a deliberate
  Copilot or Kiro block exits 2. `agy` hooks exit 0.
- Enforce blocks only when a policy score reaches the block threshold. A lone
  write to `~/.ssh/authorized_keys` is flagged but runs.
- AI-EDR flags files or pages that quote "ignore previous instructions" near
  "credentials", such as prompt injection guides.
- AI-EDR flags, and in enforce mode blocks, shell commands over
  `getconf ARG_MAX` or 1 MiB, whichever is smaller.
- Inputs of several hundred KB can exceed AI-EDR's time limit and are allowed.
  Events over 8 MiB skip the costliest rules.
- No built-in AI-EDR rule checks replies or subagent stops. Custom rules can
  read `event.response`, or raw `last_assistant_message` on Claude Code.
- AI Guard blocks only if its service enables blocking for your organization.
- AI Guard never checks the reply at turn end. It sees it later as captured
  history, and sees subagent replies only in tool results.
- Without turn IDs, as in Copilot without its OTel export, background observe
  checks can run out of order and blame the wrong prompt.
- AI Guard labels requests `coding_agent: kiro` for Kiro and
  `coding_agent: agy` for Antigravity.
- Doctor reports plugin state it cannot read, such as a relative
  `COPILOT_HOME` or a Claude record it cannot parse, as uncertain, never
  healthy.

## Keys and endpoints

AI Guard needs the API key `dd_api_key` and an AI Guard application key
`dd_app_key`. Setup stores neither, so run
`trajectory config set-secret <name> --stdin` for each.

- `auth_headers` maps `DD-API-KEY` and `DD-APPLICATION-KEY` to references,
  `dd_api_key` and `dd_app_key` by default. Existing `DD_API_KEY` and
  `DD_APP_KEY` mappings still work.
- AI Guard checks the environment first and ignores destination key
  references. It reads each keychain reference once per hook process. To
  rotate a key from the environment, change the process environment.
- It ignores a non-Datadog `DD_SITE`. It refuses endpoints outside Datadog and
  machine policy, except loopback with keys from the environment.

## Antigravity CLI

Agent Security only observes `agy`, on macOS and Linux. Enforce mode waits for
checks but blocks nothing.

- Security setup for `agy` installs a separate `trajectory-security` plugin
  in `~/.gemini/config/plugins/`, copying it there when `agy` is missing. The
  installer's `--security` option does not set up `agy`.
- Setup refuses a `trajectory-security` plugin it did not install or cannot
  read. Doctor prints `agy plugin uninstall trajectory-security` to run first.
  Setup also refuses a plugin in both `~/.gemini/config/plugins/` and
  `~/.gemini/antigravity-cli/plugins/`. Remove the unused copy.
- `SessionStart`, `PreInvocation`, `PreToolUse`, `PostToolUse`, and `Stop` map
  to `session.start`, `turn.user_prompt_submit`, `tool.pre_use`,
  `tool.post_use`, and `turn.assistant_response`. Each hook gets 5 seconds,
  except `PreInvocation` (3) and `Stop` (2).
- `agy` checks a prompt only on the turn's first model call
  (`invocationNum` 0), and cannot stop that call. A subagent runs as its own
  session with an empty, unchecked prompt. Its prompt is an `invoke_subagent`
  argument.
- `PreToolUse` runs before approval, so declined calls keep their findings.
  Read them as "`agy` was asked to run this".
- `PostToolUse` findings are records only, because the tool already ran. The
  hook carries no output. Capture reads it for AI Guard's next check, never in
  incognito. AI-EDR never sees results.
- AI Guard reads a tool call's prompt from captured history. Without capture,
  or in incognito, it has none.
- Hooks close together, such as parallel tools or a starting subagent, can
  skip a check, recorded as `admission_unavailable`. In observe mode one
  session's checks run in order, so a slow check delays later ones.
- The AI-EDR rule `tamper.agy_agent_config_write` flags writes to `agy` plugin,
  settings, or import files, any plugin's `hooks.json`, and disabling or
  uninstalling `trajectory*` plugins. It misses relative paths after `cd`,
  globs, variables, `find -delete`, scripts, and commands of about 3.5 KB.
- Doctor warns when `agy`'s `hooks.json` differs from the staged copy.
  Security setup with `--marketplace` rewrites it and keeps modes. If the
  plugin is disabled, doctor, when you run it, prints
  `agy plugin enable trajectory-security`. Security status reports neither.
- If `hooks.json` is gone (`missing_product_surfaces=agent-security`), run
  `agy plugin uninstall trajectory-security`, then setup. Installs older than
  the prompt check lack `PreInvocation`, and status does not report it. Rerun
  security setup for `agy`.
- `disable --clients agy --remove-hooks` runs
  `agy plugin uninstall trajectory-security`. Without `agy` it fails and leaves
  the plugin, which does nothing.

## Claude Code

- Doctor warns when Claude Code does not load the security plugin. Run
  `claude plugin enable trajectory-security@trajectory --scope user`, or
  security setup with `--marketplace --clients cc`.
- Managed plugin policies need their administrator. Claude Code 2.1.232 and
  later reads an empty `allowedMarketplaces`, across all managed settings, as
  `strictKnownMarketplaces`.

## Codex

Codex gives each security hook 3 seconds, and Trajectory keeps 500 ms of it.
AI-EDR and AI Guard run together, and `timeout_ms` cannot extend the limit.
Under overload, a foreground check is not queued. The operation continues, and
Trajectory records the degraded result.

## Copilot CLI

- On macOS and Linux, security setup for `copilot` installs
  `trajectory-security@trajectory` from `~/.trajectory/copilot-marketplace`.
  If you registered the `trajectory` marketplace from another folder, first
  run `copilot plugin marketplace remove trajectory`.
- Doctor warns when the plugin does not load because it is disabled, from
  another folder, or unlisted. Security setup with `--marketplace` repairs it
  and keeps modes.
- Doctor warns when at least 3, and 1 in 5, of an engine's newest 100
  decisions end in a stopping error.
- Older security hooks keep `userPromptSubmitted` or `permissionRequest` and
  can deny on a crash. Doctor flags them. Rerun security setup.
- In enforce mode, `UserPromptSubmit` stops a prompt before the model and says
  why. Observe only records. AI Guard and `rules.d` rules can block prompts.
  No built-in AI-EDR rule matches prompts.
- A blocked prompt exits 1 in headless runs and fails only the subagent it ran
  in. GitHub does not document prompt blocking, so later versions could ignore
  it.
- An external AI-EDR engine needs `external_timeout_ms: 200`, because prompt
  hooks get 250 ms.
- `preToolUse` can deny a call, with the reason in `permissionDecisionReason`.
  If the hook takes over 5 seconds, the tool runs. `postToolUse` gives the
  model a finding in `additionalContext` after the tool ran.
- AI-EDR checks each file a Copilot `apply_patch` changes, up to 3,000. This
  does not apply to Codex's `apply_patch`. Larger patches degrade, and block
  only in enforce mode.
- `sessionStart`, `postToolUseFailure`, and `agentStop` only record. An exit 2
  there is a warning. Stop hooks lack the reply, so Trajectory reads it from
  Copilot's log for `event.response`, waiting up to 150 ms.
- No `permissionRequest` hook is installed, so AI-EDR permission rules do not
  run and permission prompts do not change.
- AI-EDR result checks skip the `sql`, `session_store_sql`, `stop_bash`,
  `list_agents`, and `write_agent` tools. MCP tools are named
  `<server>-<tool>`. Hyphenated names get MCP result checks, but no server
  name is recorded.
- In trusted folders, Copilot also runs the repository's
  `.claude/settings.json` hooks. A trusted folder whose
  `.github/copilot/settings.json` sets `disableAllHooks` runs no hooks, Agent
  Security included. Doctor does not check this.
- In Copilot's sandbox, hooks cannot reach the keychain, so AI Guard allows
  everything with an error. Doctor sees only `sandbox.enabled`.

## Kiro CLI

Agent Security protects Kiro CLI V3 sessions only. It is tested on Kiro CLI
3.0.0, not the IDE. Live runs used Linux, so macOS is untested. Setup refuses
native Windows. V2 sessions are captured but unprotected. A hand-edited V2
dispatcher allows everything silently.

Kiro CLI 3.0.0 starts V2 unless you choose V3, so a default session is
unprotected. Start Kiro with `kiro-cli --v3`, or run
`kiro-cli settings chat.agentEngine v3`. An ACP editor runs Kiro on V2 unless
`acp.agentEngine` is `v3`. Kiro's docs say a `--cloud` session runs in Kiro's
sandbox with the sandbox's hooks. Agent Security does not check it.

- Security setup for `kiro` writes `~/.kiro/hooks/trajectory-security.json`, a
  V3 global hook file for every session and workspace. With Kiro 2.31 or later
  and a custom absolute `KIRO_HOME`, it also writes
  `$KIRO_HOME/hooks/trajectory-security.json`, and status warns if they differ.
- Setup does not replace a hook file it did not write. It writes nothing
  without a Kiro folder, and does not support native Windows.
- The default is observe, which writes nothing to Kiro's output. Add
  `--mode enforce --yes` to block.
- Enforce blocks tool calls in `PreToolUse` and tells the model to refuse
  prompts in `UserPromptSubmit`. `PostToolUse`, `SessionStart`, `Stop`, and
  `SessionEnd` only record. `invoke_sub_agent` maps to a subagent start and
  stop.
- Agent Security cannot pause prompts, block after a tool runs or at session
  start, or answer permission requests. CLI 3.0.0 ignores `PostToolUse`
  output, so post-tool findings are records only.
- A prompt block is an instruction to the model. The prompt still reaches
  Kiro's service and uses credits. So prompt blocks are guardrails and do not
  form a security boundary. The message is
  the same for every block and quotes neither prompt nor reason. Records mark
  it `block_delivery: model_instruction`.
- In enforce mode Kiro waits up to 3 seconds for the prompt hook, and an
  unjudged prompt goes through. Any result except exit 0 with a message on
  standard output lets the prompt through, exit 2 included.
- `trajectory update` does not rewrite the security hook file. After you
  update Trajectory or Kiro, rerun security setup. An older hook file leaves
  prompt blocks without effect.
- Capture and security hooks run in sequence, so a tool call can wait about
  10 seconds. The V3 Stop hook lacks the reply. Trajectory reads it from
  Kiro's store in the background, for up to one second, for `event.response`.
- AI Guard sees Kiro's replies only in captured history. Without Kiro
  capture, AI Guard gets no Kiro replies. To capture, run
  `trajectory setup --clients kiro`.
- Kiro subagents count toward the parent. On 3.0.0 they run hooks with the
  parent's ID and no subagent name or ID. A blocked `invoke_sub_agent` call
  leaves a `subagent.start` without a `subagent.stop`.
- Agent Security checks a subagent's tool calls like the parent's. Capture
  marks them with the subagent's name, but decision records do not. A built-in
  subagent's task arrives through `UserPromptSubmit`, and is checked as a
  prompt.
- Each workflow step runs as its own Kiro session. Its tool calls run the
  hooks, and enforce mode blocks them as in any session. Decision records
  carry the step's session ID.
- CLI 3.0.0 runs no hooks in a folder until you trust it. `--trust-workspace`
  trusts one launch. A session with a broken or missing `--agent` profile runs
  no hooks.
- Kiro sends no `SessionStart` on `--resume-id`. The hook file baseline is
  taken later (`attestation_baseline_taken_without_session_start`) and misses
  earlier changes.
- AI-EDR flags routine work: `git remote add`, `web_fetch` outside built-in
  hosts, writes to `.kiro/hooks`, and config reads after `rm` or `cp`. A read
  with `scp` or a `{install,hooks}` filter also matches.
- A second Kiro rule, `tamper.kiro_agent_config_write_shell`, reads the shell
  command as shell syntax. It flags `find -delete`, `find -exec`, `xargs`,
  `mv -t`, `chmod`, redirections and commands inside `$(...)`, backticks or
  `sh -c`, and it counts a command that both rules match once. It follows
  `cd` and `pushd`, `NAME=value` assignments, `for` variables, the operands of
  `sh -c`, `eval`, and shell input from a here-document, here-string, pipe or
  `<(...)`. It also reads the inline program of `python`, `node`, `perl`,
  `ruby` and `php`. It flags a program that names a protected path and calls
  something that writes. It flags a program with a string that is a shell
  command or an argument list that writes. A copy that reads a protected file
  and writes elsewhere is flagged too.
  A `cd` or assignment in a subshell or a pipeline stage does not carry past
  it. A `cd` that may not run, after `&&` or `||` or in an `if` or loop body,
  keeps both directories in play. So `true && cd /tmp; rm a.json` is a false
  alert from a hook directory.
- The shell rule does not read a variable set by an earlier tool call or the
  environment, so `$VAR ~/.kiro/hooks/a.json` is not flagged. It also misses a
  variable set from a command substitution or `read`, a path an interpreter
  program builds in pieces, aliases, functions, and `PATH` changes. The hook
  file baseline still flags a file those routes change.
- `tamper.agent_config_write_shell` reads shell commands for the files
  `tamper.agent_config_write` guards.
  - Claude Code: `.claude/settings.json` and `settings.local.json`.
  - Codex, Cursor, Windsurf and `.agents`: `hooks.json` in `.codex`, `.cursor`,
    `.windsurf` and `.agents`, and `.codeium/windsurf/hooks.json`.
  - Gemini: `.gemini/settings.json` and `config/hooks.json`.
  - Copilot and GitHub: `.copilot/settings.json`, `.copilot/hooks/*.json`,
    `.github/hooks/*` and `.github/copilot/settings(.local).json`.
  - Any project: `.mcp.json`.

  It counts a command that both rules match once. It covers
  `cd ~/.claude && rm settings.json`, split verbs, variables and nested
  shells. It flags removing a folder that holds only agent config, such as
  `rm -rf ~/.claude`, because that removes the files. It does not flag
  `rm -rf .github`, `.agents` or `.codeium`, which hold other files. It has the
  same limits as the Kiro rule.
- The Kiro tamper rule matches only paths inside a `.kiro` folder. It misses
  changes to hook, agent or MCP files under a `KIRO_HOME` with another name,
  such as `/opt/kiro-home/hooks`.
- `trajectory doctor --verbose` shows a missing security hook file as
  `missing_product_surfaces=agent-security`. Rerun security setup.
- After `disable --remove-hooks`, the security hook file is gone, though status
  still lists it enabled. Capture hooks stay. `trajectory uninstrument kiro`
  removes capture and keeps the security hook file. Uninstalling Trajectory
  removes both.
