/**
 * Trajectory Capture Extension for Pi
 *
 * Subscribes to Pi lifecycle events and forwards them to the trajectory
 * HTTP capture server. Fire-and-forget with 2s timeout - Pi is never
 * blocked by trajectory being slow or unavailable.
 *
 * Install: copy to ~/.pi/agent/extensions/trajectory/
 * Or symlink: ln -s /path/to/plugin/trajectory-pi ~/.pi/agent/extensions/trajectory
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { completeSimple, getModel } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { spawn, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { buildTrajectorySchema, runTrajectoryQuery } from "./query-tools.js";

const DEFAULT_PORT = 19222;
const POST_TIMEOUT_MS = 2000;
const HEALTH_TIMEOUT_MS = 1000;
const SPAWN_WAIT_MS = 5000;
/** Timeout for each sensitivity classification LLM call (ms). */
const CLASSIFY_TIMEOUT_MS = 3000;
const PLUGIN_PROVENANCE = {
	plugin: {
		id: "trajectory-pi",
		version: "3.2.0",
		source_scope: "trajectory_plugin",
	},
};

/**
 * Valid v2.1 sensitivity categories. Searched in descending length order so
 * that longer superset names ("interpersonal", "confidential_business",
 * "not_sensitive", "customer_pii") match before their shorter prefixes.
 */
const V2_CATEGORIES_BY_LENGTH = [
	"confidential_business", // 21
	"interpersonal",         // 13
	"not_sensitive",         // 13
	"customer_pii",          // 12
	"compensation",          // 12
	"personal",              // 8
	"security",              // 8
	"legal",                 // 5
	"hr",                    // 2
] as const;

type SensitivityCategory = typeof V2_CATEGORIES_BY_LENGTH[number];

/** Label ordering for most-restrictive-wins comparison (higher index = more restrictive). */
const LABEL_ORDER: Record<string, number> = {
	public: 0,
	internal: 1,
	confidential: 2,
	restricted: 3,
};

/** Returns the more restrictive of two labels. */
function escalateLabel(current: string, next: string): string {
	if (!current) return next;
	if (!next) return current;
	const a = LABEL_ORDER[current] ?? 0;
	const b = LABEL_ORDER[next] ?? 0;
	return b > a ? next : current;
}

function mergePluginProvenance(provenance: Record<string, unknown>): Record<string, unknown> {
	const plugin = provenance.plugin;
	if (plugin && typeof plugin === "object" && !Array.isArray(plugin)) {
		const pluginRecord = plugin as Record<string, unknown>;
		if (typeof pluginRecord.id === "string" && pluginRecord.id !== "" && pluginRecord.id !== PLUGIN_PROVENANCE.plugin.id) {
			return pluginRecord;
		}
		return {
			...PLUGIN_PROVENANCE.plugin,
			...pluginRecord,
		};
	}
	return {
		...PLUGIN_PROVENANCE.plugin,
	};
}

function withPluginProvenance(body: Record<string, unknown>): Record<string, unknown> {
	const provenance = (body.provenance ?? {}) as Record<string, unknown>;
	return {
		...body,
		provenance: {
			...PLUGIN_PROVENANCE,
			...provenance,
			plugin: mergePluginProvenance(provenance),
		},
	};
}

export default function (pi: ExtensionAPI) {
	const port = parseInt(process.env.TRAJECTORY_PORT ?? String(DEFAULT_PORT), 10);
	const baseUrl = `http://127.0.0.1:${port}`;
	const captureUrl = `${baseUrl}/capture/pi`;

	let sessionId = "";
	let turnCounter = 0;

	// ── Sensitivity pre-classification state ─────────────────────────
	// Cached per session: the system prompt fetched from serve, and the
	// current best (most-restrictive) verdict seen so far this session.
	let sensitivityPrompt: string | null = null; // null = fetch pending/failed
	let sessionSensitivityCategory = ""; // "" = no verdict yet this session
	// Fire-once flag: classification runs at most once per session (first turn_end
	// only). Trajectory's periodic classifier loop provides refresh over the
	// session lifetime via headless CLI / direct API backends.
	let sensitivityClassified = false;

	// Per-turn accumulators used to build the classifier content summary.
	// Reset at each turn_end.
	let currentTurnUserText = "";
	let currentTurnToolNames: string[] = [];


	// ── Sensitivity helpers ──────────────────────────────────────────

	/**
	 * Fetch the sensitivity classifier system prompt from the serve endpoint.
	 * Caches for the session lifetime. Silently skips on failure - classification
	 * is best-effort and must never block capture.
	 */
	async function fetchSensitivityPrompt(): Promise<void> {
		try {
			const res = await fetch(`${baseUrl}/capture/pi/sensitivity_prompt`, {
				signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
			});
			if (res.ok) {
				sensitivityPrompt = await res.text();
			}
		} catch {
			// serve unavailable or timed out - skip classification for this session
		}
	}

	/**
	 * Build a brief content summary from turn content suitable for the
	 * classifier prompt. Keeps only text parts; truncates aggressively to
	 * stay well within max_tokens=10 LLM response budget constraints.
	 */
	function buildTurnSummary(
		userText: string,
		toolNames: string[],
	): string {
		const parts: string[] = [];
		if (userText) {
			const trimmed = userText.length > 500 ? userText.slice(0, 500) + "..." : userText;
			parts.push(`User: ${trimmed}`);
		}
		if (toolNames.length > 0) {
			parts.push(`Tools: ${toolNames.slice(0, 5).join(", ")}`);
		}
		return parts.join("\n");
	}

	/** Pinned classifier model: always Haiku regardless of pi's main coding model. */
	const CLASSIFIER_MODEL = getModel("anthropic", "claude-haiku-4-5-20251001");

	/**
	 * Classify turn content using a pinned Haiku model with a 3s timeout.
	 * Always uses claude-haiku-4-5-20251001 via Anthropic regardless of which
	 * model pi is configured to use for coding work.
	 *
	 * Parses one of the 9 v2.1 sensitivity categories:
	 *   hr | interpersonal | personal | compensation | legal |
	 *   customer_pii | security | confidential_business | not_sensitive
	 *
	 * Returns the raw category string or "" on any error or unrecognized output.
	 * Non-blocking: capture POST proceeds regardless of this result.
	 */
	async function classifyTurn(content: string): Promise<SensitivityCategory | ""> {
		if (!sensitivityPrompt) {
			return "";
		}
		try {
			const msg = await Promise.race([
				completeSimple(
					CLASSIFIER_MODEL,
					{
						systemPrompt: sensitivityPrompt,
						messages: [
							{
								role: "user",
								content: `Session content summary:\n\n${content}`,
								timestamp: Date.now(),
							},
						],
					},
					{ maxTokens: 10 },
				),
				new Promise<never>((_, reject) =>
					setTimeout(() => reject(new Error("classify timeout")), CLASSIFY_TIMEOUT_MS),
				),
			]);
			const raw = msg.content
				.filter((b): b is { type: "text"; text: string } => b.type === "text")
				.map((b) => b.text)
				.join("")
				.trim()
				.toLowerCase();
			// Exact match first.
			for (const cat of V2_CATEGORIES_BY_LENGTH) {
				if (raw === cat) {
					return cat;
				}
			}
			// Substring match in descending-length order so longer names
			// ("interpersonal", "confidential_business") win over shorter prefixes
			// ("personal", "confidential").
			for (const cat of V2_CATEGORIES_BY_LENGTH) {
				if (raw.includes(cat)) {
					return cat;
				}
			}
		} catch {
			// timeout, API error, or any other failure - skip silently
		}
		return "";
	}

	// ── HTTP helpers ─────────────────────────────────────────────────

	async function post(path: string, body: Record<string, unknown>): Promise<void> {
		try {
			await fetch(`${captureUrl}/${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(withPluginProvenance(body)),
				signal: AbortSignal.timeout(POST_TIMEOUT_MS),
			});
		} catch {
			// Fire-and-forget - trajectory serve being down never blocks Pi
		}
	}

	async function healthCheck(): Promise<boolean> {
		try {
			const res = await fetch(`${baseUrl}/health`, {
				signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
			});
			return res.ok;
		} catch {
			return false;
		}
	}

	// ── Binary lifecycle ─────────────────────────────────────────────

	function findTrajectoryBinary(): string | undefined {
		const candidates = [
			join(process.env.HOME ?? "", ".trajectory", "bin", "trajectory"),
			join(process.env.HOME ?? "", "bin", "trajectory"),
			// Let PATH resolve it as a fallback (handled by spawn)
		];
		for (const p of candidates) {
			if (existsSync(p)) return p;
		}
		// Fall back to bare name - spawn will search PATH
		return "trajectory";
	}

	async function ensureTrajectoryServe(): Promise<boolean> {
		if (await healthCheck()) {

			return true;
		}

		const binPath = findTrajectoryBinary();
		if (!binPath) return false;

		try {
			const child = spawn(binPath, ["serve"], {
				detached: true,
				stdio: "ignore",
				env: { ...process.env, TRAJECTORY_PORT: String(port) },
			});
			child.unref();
		} catch {
			return false;
		}

		// Poll for health up to SPAWN_WAIT_MS
		const attempts = Math.floor(SPAWN_WAIT_MS / 100);
		for (let i = 0; i < attempts; i++) {
			await new Promise((r) => setTimeout(r, 100));
			if (await healthCheck()) {

				return true;
			}
		}
		return false;
	}

	// ── Tool registration ────────────────────────────────────────────

	pi.registerTool({
		name: "trajectory_status",
		label: "Trajectory Status",
		description: "Shows the current trajectory capture status including active sessions and event counts",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, signal) {
			try {
				const res = await fetch(`${baseUrl}/health`, {
					signal: signal ?? AbortSignal.timeout(POST_TIMEOUT_MS),
				});
				const data = await res.json();
				return {
					content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
					details: {},
				};
			} catch (err) {
				return {
					content: [{ type: "text", text: `Trajectory serve unreachable: ${err}` }],
					details: {},
					isError: true,
				};
			}
		},
	});

	pi.registerTool({
		name: "trajectory_flush",
		label: "Trajectory Flush",
		description: "Flushes any pending trajectory data to ensure all events are written",
		parameters: Type.Object({}),
		async execute(_toolCallId, _params, signal) {
			try {
				await fetch(`${baseUrl}/flush`, {
					method: "POST",
					signal: signal ?? AbortSignal.timeout(5000),
				});
				return {
					content: [{ type: "text", text: "Trajectory data flushed." }],
					details: {},
				};
			} catch (err) {
				return {
					content: [{ type: "text", text: `Flush failed: ${err}` }],
					details: {},
					isError: true,
				};
			}
		},
	});

	pi.registerTool({
		name: "trajectory_incognito",
		label: "Trajectory Incognito",
		description: "Toggles incognito mode for the current Pi session. Local JSONL capture continues, but publish to non-exempt Datadog destinations is suppressed while enabled.",
		parameters: Type.Object({
			enable: Type.Boolean({ description: "true to enable incognito, false to disable it" }),
		}),
		async execute(_toolCallId, params, signal) {
			if (!sessionId) {
				return {
					content: [{ type: "text", text: "No active Pi session is registered yet." }],
					details: {},
					isError: true,
				};
			}

			const enable = Boolean((params as { enable?: boolean }).enable);
			try {
				await ensureTrajectoryServe();
				const res = await fetch(
					`${baseUrl}/session/incognito?session_id=${encodeURIComponent(sessionId)}&enable=${enable}`,
					{
						method: "POST",
						signal: signal ?? AbortSignal.timeout(POST_TIMEOUT_MS),
					},
				);
				if (!res.ok) {
					const body = await res.text();
					return {
						content: [{ type: "text", text: `Incognito toggle failed: ${res.status} ${body}` }],
						details: {},
						isError: true,
					};
				}
				const state = enable ? "enabled" : "disabled";
				const detail = enable
					? "publish to non-exempt Datadog destinations is suppressed; local JSONL capture continues"
					: "publish to non-exempt Datadog destinations is resumed";
				return {
					content: [{ type: "text", text: `Incognito ${state} for session ${sessionId}; ${detail}.` }],
					details: {},
				};
			} catch (err) {
				return {
					content: [{ type: "text", text: `Incognito toggle failed: ${err}` }],
					details: {},
					isError: true,
				};
			}
		},
	});

	pi.registerTool({
		name: "trajectory_schema",
		label: "Trajectory Schema",
		description: "Introspects the local Trajectory SQLite cache schema. Call this before trajectory_query so SQL matches the live cache.",
		parameters: Type.Object({
			include_row_counts: Type.Optional(Type.Boolean({ description: "Include SELECT COUNT(*) per table. Defaults to false." })),
		}),
		async execute(_toolCallId, params) {
			const result = buildTrajectorySchema(Boolean((params as { include_row_counts?: boolean }).include_row_counts));
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				details: { result },
				isError: !result.ok,
			};
		},
	});

	pi.registerTool({
		name: "trajectory_query",
		label: "Trajectory Query",
		description: "Runs a guarded read-only SQL query against the local Trajectory SQLite cache. Call trajectory_schema first unless the schema was already fetched. Only SELECT, WITH, and PRAGMA are allowed after stripping comments.",
		parameters: Type.Object({
			query: Type.String({ description: "SQL query. First keyword after comments must be SELECT, WITH, or PRAGMA." }),
			params: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "Optional named SQL parameters. Use placeholders such as :session_id." })),
			limit: Type.Optional(Type.Number({ description: "Maximum rows to return. Defaults to 100, max 1000." })),
			row_limit: Type.Optional(Type.Number({ description: "Alias for limit." })),
		}),
		async execute(_toolCallId, params) {
			const result = runTrajectoryQuery(params as {
				query: string;
				params?: Record<string, string | number | boolean | null>;
				limit?: number;
				row_limit?: number;
			});
			return {
				content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
				details: { result },
				isError: !result.ok,
			};
		},
	});

	// ── CLI fallback for session lifecycle events ───────────────────
	// Session lifecycle events (start/end) use CLI fallback to write directly
	// to JSONL, independent of serve availability. Matches CC plugin pattern.

	function captureHookCLI(eventType: string, body: Record<string, unknown>): void {
		const binPath = findTrajectoryBinary();
		if (!binPath) return;
		try {
			// --wait-notify 2s: wait deterministically for the CLI's serve
			// notification to complete (or time out at 2s) before exiting. Pi can
			// exit very quickly under `pi --print`, so the default 100ms grace
			// period that Claude Code relies on is not long enough for the
			// HTTP POST to reach serve. Without this, JSONL is durable but serve
			// never sees the turn_end and publish never fires.
			//
			// --client pi routes the notify to /capture/pi/<EventType> so serve
			// dispatches through processPiEvent (which calls notifyPublishTurnEnd).
			// Without --client, the CLI posts to /capture/<EventType> which serve
			// routes to the CC runtime; CC does not have a "TurnEnd" event and
			// would reject it with 400.
			execFileSync(binPath, ["capture-hook", "--client", "pi", "--wait-notify", "2s", eventType], {
				input: JSON.stringify(withPluginProvenance(body)),
				timeout: 5000,
				stdio: ["pipe", "ignore", "ignore"],
			});
		} catch {
			// Best-effort - don't block Pi
		}
	}

	function toTrajectoryUsage(usage: any): Record<string, unknown> | undefined {
		if (!usage) {
			return undefined;
		}
		const cost = usage.cost;
		const out: Record<string, unknown> = {
			input: usage.input,
			output: usage.output,
			cacheRead: usage.cacheRead,
			cacheWrite: usage.cacheWrite,
			totalTokens: usage.totalTokens,
		};
		if (cost !== undefined && cost !== null) {
			out.cost = typeof cost === "object" ? cost : { total: cost };
		}
		return out;
	}

	function contentBlockTypes(blocks: any): string[] {
		if (!Array.isArray(blocks)) {
			return [];
		}
		const out = new Set<string>();
		for (const block of blocks) {
			if (block?.type === "text") out.add("text");
			else if (block?.type === "thinking") out.add("thinking");
			else if (block?.type === "toolCall") out.add("tool_use");
			else if (typeof block?.type === "string" && block.type) out.add(block.type);
		}
		return Array.from(out);
	}

	// ── Event subscriptions ──────────────────────────────────────────

	pi.on("session_start", async (_event, ctx) => {
		sessionId = ctx.sessionManager.getSessionId();
		turnCounter = 0;

		// Reset sensitivity state for the new session.
		sensitivityPrompt = null;
		sessionSensitivityCategory = "";
		sensitivityClassified = false;

		const body = {
			session_id: sessionId,
			cwd: ctx.cwd,
			model: ctx.model?.id,
			provider: ctx.model?.provider,
			timestamp: Date.now(),
		};

		// CLI writes directly to JSONL (always works)
		captureHookCLI("SessionStart", body);

		// Also start serve for mid-session extension event capture
		await ensureTrajectoryServe();

		// Notify serve of the session start (best-effort)
		post("SessionStart", body);

		// Fetch the sensitivity classifier system prompt from serve (once per
		// session). Runs after ensureTrajectoryServe so serve is likely up.
		// Failure is silent - older extensions without this change still work.
		fetchSensitivityPrompt();
	});

	pi.on("message_end", async (event, ctx) => {

		const msg = event.message;

		if (msg.role === "user") {
			turnCounter++;
			const prompt =
				typeof msg.content === "string"
					? msg.content
					: msg.content
							.filter((b): b is { type: "text"; text: string } => b.type === "text")
							.map((b) => b.text)
							.join("\n");

			// Capture user text for sensitivity summary at turn_end.
			currentTurnUserText = prompt;
			currentTurnToolNames = [];

			post("UserPromptSubmit", {
				session_id: sessionId,
				prompt,
				timestamp: Date.now(),
			});
		} else if (msg.role === "assistant") {
			const textParts: string[] = [];
			const thinkingParts: string[] = [];
			const toolCallIds: string[] = [];
			let hasThinking = false;

			for (const block of msg.content) {
				if (block.type === "text") {
					textParts.push(block.text);
				} else if (block.type === "thinking") {
					hasThinking = true;
					if (!block.redacted) {
						thinkingParts.push(block.thinking);
					}
				} else if (block.type === "toolCall") {
					toolCallIds.push(block.id);
				}
			}

			await post("AgentMessage", {
				session_id: sessionId,
				text: textParts.join("\n"),
				has_thinking: hasThinking,
				thinking_text: thinkingParts.join("\n"),
				tool_use_ids: toolCallIds,
				model: msg.model,
				provider: ctx.model?.provider,
				usage: msg.usage,
				content_blocks: contentBlockTypes(msg.content),
				timestamp: Date.now(),
			});
		}
	});

	pi.on("tool_call", async (event, _ctx) => {
		// Accumulate tool names for sensitivity summary.
		currentTurnToolNames.push(event.toolName);

		post("PreToolUse", {
			session_id: sessionId,
			tool_use_id: event.toolCallId,
			tool_name: event.toolName,
			input: event.input,
			timestamp: Date.now(),
		});
	});

	pi.on("tool_result", async (event, _ctx) => {


		const output = event.content
			.filter((b): b is { type: "text"; text: string } => b.type === "text")
			.map((b) => b.text)
			.join("\n");

		post("PostToolUse", {
			session_id: sessionId,
			tool_use_id: event.toolCallId,
			tool_name: event.toolName,
			output,
			is_error: event.isError,
			timestamp: Date.now(),
		});
	});

	pi.on("turn_end", async (event, _ctx) => {
		// Extract usage from the assistant message in this turn
		const msg = event.message;
		const usage = msg.role === "assistant" ? msg.usage : undefined;

		// Classify the turn content using a pinned Haiku model (non-blocking).
		// We capture the user text and tool names before awaiting so they
		// are not affected by concurrent resets.
		const turnUserText = currentTurnUserText;
		const turnToolNames = currentTurnToolNames.slice();
		// Reset accumulators for the next turn.
		currentTurnUserText = "";
		currentTurnToolNames = [];

		// Run classification at most once per session (first turn_end only).
		// Uses a pinned Haiku model regardless of pi's main coding model.
		// On failure or after the first attempt, skip - trajectory's periodic
		// classifier loop provides refresh via headless CLI / direct API.
		if (!sensitivityClassified) {
			sensitivityClassified = true; // fire-once: mark before await so concurrent turns can't double-fire
			const summary = buildTurnSummary(turnUserText, turnToolNames);
			const newCategory = summary ? await classifyTurn(summary) : "";
			if (newCategory) {
				sessionSensitivityCategory = newCategory;
			}
		}

		const body: Record<string, unknown> = {
			session_id: sessionId,
			turn_id: turnCounter,
			usage: toTrajectoryUsage(usage),
			timestamp: Date.now(),
		};

		// Attach v2.1 category when available. The Go handler maps category to
		// a publish-gate label via CategoryToLabel and applies most-restrictive-
		// wins across multiple POSTs.
		if (sessionSensitivityCategory) {
			body.sensitivity_category = sessionSensitivityCategory;
		}

		// CLI writes directly to JSONL (always works, even if pi exits before the
		// async POST completes - e.g. under `pi --print`). JSONL is the source of
		// truth; serve picks it up via fsnotify if the live POST is dropped.
		captureHookCLI("TurnEnd", body);

		// Also notify serve if still alive (best-effort, mirrors session_shutdown).
		try {
			await fetch(`${captureUrl}/TurnEnd`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(withPluginProvenance(body)),
				signal: AbortSignal.timeout(POST_TIMEOUT_MS),
			});
		} catch {
			// Best-effort
		}
	});

	pi.on("session_compact", async (event, _ctx) => {


		post("PostCompact", {
			session_id: sessionId,
			summary: event.compactionEntry.summary,
			tokens_before: event.compactionEntry.tokensBefore,
			timestamp: Date.now(),
		});
	});

	pi.on("session_shutdown", async (_event, _ctx) => {
		const body: Record<string, unknown> = {
			session_id: sessionId,
			timestamp: Date.now(),
		};

		// Attach final session sensitivity category if available.
		if (sessionSensitivityCategory) {
			body.sensitivity_category = sessionSensitivityCategory;
		}

		// CLI writes directly to JSONL (always works, even if serve is dead)
		captureHookCLI("SessionEnd", body);

		// Also notify serve if still alive (best-effort)
		try {
			await fetch(`${captureUrl}/SessionEnd`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(withPluginProvenance(body)),
				signal: AbortSignal.timeout(POST_TIMEOUT_MS),
			});
		} catch {
			// Best-effort
		}
	});

	pi.on("model_select", async (event, _ctx) => {


		post("ModelChange", {
			session_id: sessionId,
			provider: event.model.provider,
			model_id: event.model.id,
			timestamp: Date.now(),
		});
	});

	(pi.on as any)("session_fork", async (event: any, ctx: any) => {
		post("Fork", {
			session_id: sessionId,
			parent_session_file: event.previousSessionFile,
			timestamp: Date.now(),
		});

		// Update session ID after fork - new session was created
		sessionId = ctx.sessionManager.getSessionId();
	});
}
