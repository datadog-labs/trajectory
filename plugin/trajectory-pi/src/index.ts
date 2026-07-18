/**
 * Trajectory Capture Extension for Pi
 *
 * Subscribes to Pi lifecycle events and forwards them to the trajectory
 * HTTP capture server. Capture runs through bounded background queues so Pi
 * callbacks never wait on trajectory being slow or unavailable.
 *
 * Install: copy to ~/.pi/agent/extensions/trajectory/
 * Or symlink: ln -s /path/to/plugin/trajectory-pi ~/.pi/agent/extensions/trajectory
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { completeSimple, getModel } from "@earendil-works/pi-ai/compat";
import { Type } from "typebox";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { BoundedSerialQueue } from "./async-queue.js";
import { aggregatePiAgentRun, PiAgentRunTracker } from "./agent-run.js";
import { buildTrajectorySchema, runTrajectoryQuery } from "./query-tools.js";
import { piSessionIdentityFields, readPiSessionHeaderId } from "./session-identity.js";
import { ensureTrajectoryServe as requestTrajectoryServe } from "./serve-ensure.js";

const DEFAULT_PORT = 19222;
const POST_TIMEOUT_MS = 2000;
const HEALTH_TIMEOUT_MS = 1000;
/** Timeout for each sensitivity classification LLM call (ms). */
const CLASSIFY_TIMEOUT_MS = 3000;
const CAPTURE_HELPER_TIMEOUT_MS = 5000;
const CAPTURE_QUEUE_CAPACITY = 256;
const LIFECYCLE_QUEUE_CAPACITY = 64;
const SHUTDOWN_DRAIN_MS = 100;
const PLUGIN_PROVENANCE = {
	plugin: {
		id: "trajectory-pi",
		version: "3.2.2",
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

export interface TrajectoryExtensionRuntime {
	captureQueue?: BoundedSerialQueue;
	lifecycleQueue?: BoundedSerialQueue;
	postCapture?: (path: string, body: Record<string, unknown>) => Promise<void>;
	captureHook?: (eventType: string, body: Record<string, unknown>) => Promise<void>;
	ensureServe?: () => Promise<boolean>;
	classifyTurn?: (content: string) => Promise<SensitivityCategory | "">;
	shutdownDrainMs?: number;
}

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

export function registerTrajectoryExtension(pi: ExtensionAPI, runtime: TrajectoryExtensionRuntime = {}) {
	const port = parseInt(process.env.TRAJECTORY_PORT ?? String(DEFAULT_PORT), 10);
	const baseUrl = `http://127.0.0.1:${port}`;
	const captureUrl = `${baseUrl}/capture/pi`;
	const captureQueue = runtime.captureQueue ?? new BoundedSerialQueue(CAPTURE_QUEUE_CAPACITY);
	const lifecycleQueue = runtime.lifecycleQueue ?? new BoundedSerialQueue(LIFECYCLE_QUEUE_CAPACITY);

	let sessionId = "";
	let shuttingDown = false;
	const agentRuns = new PiAgentRunTracker();

	// ── Sensitivity pre-classification state ─────────────────────────
	// Cached per session: the system prompt fetched from serve, and the
	// current best (most-restrictive) verdict seen so far this session.
	let sensitivityPrompt: string | null = null; // null = fetch pending/failed
	let sessionSensitivityCategory = ""; // "" = no verdict yet this session
	// Fire-once flag: classification runs at most once per session (first agent_end
	// only). Trajectory's periodic classifier loop provides refresh over the
	// session lifetime via headless CLI / direct API backends.
	let sensitivityClassified = false;

	// Per-turn accumulators used to build the classifier content summary.
	// Reset at each agent_end.
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
		let timeout: ReturnType<typeof setTimeout> | undefined;
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
				new Promise<never>((_, reject) => {
					timeout = setTimeout(() => reject(new Error("classify timeout")), CLASSIFY_TIMEOUT_MS);
					(timeout as unknown as { unref?: () => void }).unref?.();
				}),
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
		} finally {
			if (timeout !== undefined) clearTimeout(timeout);
		}
		return "";
	}

	// ── HTTP helpers ─────────────────────────────────────────────────

	async function postCapture(path: string, body: Record<string, unknown>): Promise<void> {
		try {
			await fetch(`${captureUrl}/${path}`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
				signal: AbortSignal.timeout(POST_TIMEOUT_MS),
			});
		} catch {
			// Fire-and-forget - trajectory serve being down never blocks Pi
		}
	}

	const postCaptureTask = runtime.postCapture ?? postCapture;

	function post(path: string, body: Record<string, unknown>): void {
		captureQueue.enqueue(() => postCaptureTask(path, withPluginProvenance(body)));
	}

	function postTerminal(path: string, body: Record<string, unknown>): void {
		captureQueue.enqueueTerminal(() => postCaptureTask(path, withPluginProvenance(body)));
	}

	// ── Binary lifecycle ─────────────────────────────────────────────

	function findTrajectoryBinary(): string | undefined {
		const candidates = [
			join(process.env.HOME ?? "", ".trajectory", "bin", "trajectory"),
			join(process.env.HOME ?? "", "bin", "trajectory"),
			// Let PATH resolve it as a fallback (handled by execFile)
		];
		for (const p of candidates) {
			if (existsSync(p)) return p;
		}
		// Fall back to bare name - execFile will search PATH
		return "trajectory";
	}

	async function ensureTrajectoryServe(): Promise<boolean> {
		const binPath = findTrajectoryBinary();
		if (!binPath) return false;
		const result = await requestTrajectoryServe({ binary: binPath, client: "pi", port });
		return result.ok;
	}

	const ensureServeTask = runtime.ensureServe ?? ensureTrajectoryServe;

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

	async function captureHookCLI(eventType: string, body: Record<string, unknown>): Promise<void> {
		const binPath = findTrajectoryBinary();
		if (!binPath) return;
		await new Promise<void>((resolve) => {
			let child: ReturnType<typeof spawn>;
			try {
				// --client pi keeps the helper's notify on the Pi runtime. The helper
				// writes JSONL before notifying serve, so it remains the durable
				// fallback for short-lived `pi --print` sessions.
				child = spawn(binPath, ["capture-hook", "--client", "pi", "--wait-notify", "2s", eventType], {
					detached: true,
					stdio: ["pipe", "ignore", "ignore"],
				});
			} catch {
				resolve();
				return;
			}

			let settled = false;
			const finish = () => {
				if (settled) return;
				settled = true;
				clearTimeout(killTimer);
				resolve();
			};
			const killTimer = setTimeout(() => {
				// Keep the queue occupied until close. If termination fails, one
				// stuck helper cannot turn into unbounded helper process growth.
				try {
					child.kill();
				} catch {
					// Best-effort termination; the queue remains occupied until close.
				}
			}, CAPTURE_HELPER_TIMEOUT_MS);
			(killTimer as unknown as { unref?: () => void }).unref?.();
			child.once("error", finish);
			child.once("close", finish);
			child.stdin?.once("error", () => {});
			child.stdin?.end(JSON.stringify(withPluginProvenance(body)));
			child.unref();
		});
	}

	const captureHookTask = runtime.captureHook ?? captureHookCLI;

	function captureLifecycle(eventType: string, body: Record<string, unknown>): void {
		lifecycleQueue.enqueue(() => captureHookTask(eventType, body));
	}

	function captureTerminalLifecycle(eventType: string, body: Record<string, unknown>): void {
		lifecycleQueue.enqueueTerminal(() => captureHookTask(eventType, body));
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

	pi.on("session_start", async (event, ctx) => {
		const parentProviderSessionId = await readPiSessionHeaderId(event.previousSessionFile);
		const identity = piSessionIdentityFields(event, ctx.sessionManager, parentProviderSessionId);
		sessionId = identity.session_id;
		shuttingDown = false;
		agentRuns.reset(sessionId);

		// Reset sensitivity state for the new session.
		sensitivityPrompt = null;
		sessionSensitivityCategory = "";
		sensitivityClassified = false;

		const body = {
			...identity,
			cwd: ctx.cwd,
			model: ctx.model?.id,
			provider: ctx.model?.provider,
			timestamp: Date.now(),
		};

		captureLifecycle("SessionStart", body);

		// Preserve startup ordering without making Pi wait for serve recovery.
		captureQueue.enqueue(async () => {
			await ensureServeTask();
			await postCaptureTask("SessionStart", withPluginProvenance(body));
			// The classifier prompt fetch is independent of capture ordering.
			void fetchSensitivityPrompt();
		});
	});

	pi.on("agent_start", async () => {
		agentRuns.start();
	});

	pi.on("message_end", async (event, ctx) => {

		const msg = event.message;

		if (msg.role === "user") {
			const prompt =
				typeof msg.content === "string"
					? msg.content
					: msg.content
							.filter((b): b is { type: "text"; text: string } => b.type === "text")
							.map((b) => b.text)
							.join("\n");

			// A Pi agent run may contain queued/steered user messages. Keep them in
			// one summary until agent_end, which is the native outer-run boundary.
			currentTurnUserText = [currentTurnUserText, prompt].filter(Boolean).join("\n");

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

			post("AgentMessage", {
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

	pi.on("agent_end", async (event, _ctx) => {
		const sourceEventId = agentRuns.complete();
		if (!sourceEventId) return;
		const aggregate = aggregatePiAgentRun(event.messages);

		// Classify the turn content using a pinned Haiku model (non-blocking).
		// We capture the user text and tool names before awaiting so they
		// are not affected by concurrent resets.
		const turnUserText = currentTurnUserText;
		const turnToolNames = currentTurnToolNames.slice();
		// Reset accumulators for the next turn.
		currentTurnUserText = "";
		currentTurnToolNames = [];

		// Run classification at most once per session, but never await it from
		// the lifecycle callback. A late verdict is sent as a phantom TurnEnd:
		// the Go handler skips duplicate turn materialization while still applying
		// the most-restrictive sensitivity watermark.
		if (!sensitivityClassified) {
			sensitivityClassified = true;
			const summary = buildTurnSummary(turnUserText, turnToolNames);
			const classifiedSessionId = sessionId;
			const classifiedSourceEventId = sourceEventId;
			if (summary) {
				const timer = setTimeout(() => {
					if (shuttingDown || sessionId !== classifiedSessionId) return;
					void (runtime.classifyTurn ?? classifyTurn)(summary).then((newCategory) => {
						if (!newCategory || sessionId !== classifiedSessionId) return;
						sessionSensitivityCategory = newCategory;
						if (!shuttingDown) {
							post("TurnEnd", {
								session_id: classifiedSessionId,
								source_event_id: classifiedSourceEventId,
								source_dialect: "pi-agent-end",
								sensitivity_category: newCategory,
								timestamp: Date.now(),
							});
						}
					}, () => {});
				}, 0);
				(timer as unknown as { unref?: () => void }).unref?.();
			}
		}

		const body: Record<string, unknown> = {
			session_id: sessionId,
			source_event_id: sourceEventId,
			source_dialect: "pi-agent-end",
			usage: aggregate.usage,
			native_request_count: aggregate.requestCount,
			zero_usage_requests: aggregate.zeroUsageRequests,
			usage_model_status: aggregate.modelStatus,
			cost_status: aggregate.costStatus,
			timestamp: Date.now(),
		};
		if (aggregate.model) body.model = aggregate.model;
		if (aggregate.provider) body.provider = aggregate.provider;

		// Attach v2.1 category when available. The Go handler maps category to
		// a publish-gate label via CategoryToLabel and applies most-restrictive-
		// wins across multiple POSTs.
		if (sessionSensitivityCategory) {
			body.sensitivity_category = sessionSensitivityCategory;
		}

		// CLI writes directly to JSONL (always works, even if pi exits before the
		// async POST completes - e.g. under `pi --print`). JSONL is the source of
		// truth; serve picks it up via fsnotify if the live POST is dropped.
		captureLifecycle("TurnEnd", body);
		post("TurnEnd", body);
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
		shuttingDown = true;
		const body: Record<string, unknown> = {
			session_id: sessionId,
			timestamp: Date.now(),
		};

		// Attach final session sensitivity category if available.
		if (sessionSensitivityCategory) {
			body.sensitivity_category = sessionSensitivityCategory;
		}

		// CLI writes directly to JSONL (always works, even if serve is dead)
		captureTerminalLifecycle("SessionEnd", body);
		postTerminal("SessionEnd", body);

		// Pi permits an async shutdown callback. Give already-admitted work one
		// short, explicit chance to finish without restoring the old multi-second
		// shutdown stall. Detached helpers continue best-effort after this budget.
		const drainMs = runtime.shutdownDrainMs ?? SHUTDOWN_DRAIN_MS;
		await Promise.all([
			lifecycleQueue.drain(drainMs),
			captureQueue.drain(drainMs),
		]);
	});

	pi.on("model_select", async (event, _ctx) => {


		post("ModelChange", {
			session_id: sessionId,
			provider: event.model.provider,
			model_id: event.model.id,
			timestamp: Date.now(),
		});
	});

}

export default function trajectoryExtension(pi: ExtensionAPI): void {
	registerTrajectoryExtension(pi);
}
