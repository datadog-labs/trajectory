/**
 * Trajectory Capture Extension for Pi
 *
 * Subscribes to Pi lifecycle events and forwards them through trajectory's
 * receipt-backed capture-hook helper. Capture runs through bounded background queues so Pi
 * callbacks never wait on trajectory being slow or unavailable.
 *
 * Install: copy to ~/.pi/agent/extensions/trajectory/
 * Or symlink: ln -s /path/to/plugin/trajectory-pi ~/.pi/agent/extensions/trajectory
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { execFile, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { Socket } from "node:net";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { lstat, mkdir, open, rename, rm } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registerSubagentEvidence } from "./subagent-evidence.ts";
import { BoundedSerialQueue } from "./async-queue.ts";
import { aggregatePiAgentRun, PiAgentRunTracker, summarizePiAgentRunRequests } from "./agent-run.ts";
import { TrajectoryMCPSession } from "./query-tools.ts";
import {
	isHeadlessPiRun,
	piSessionIdentityFields,
	PiSessionMetadataReader,
	TRAJECTORY_PI_PARENT_SESSION_ENV,
	type readPiSessionHeaderId,
} from "./session-identity.ts";
import type { ExtensionInfo } from "./extension-inventory.ts";
import { ensureTrajectoryServe as requestTrajectoryServe } from "./serve-ensure.ts";
import { classifyPiModelPricing, PiPricingSnapshots, readPiModelsConfig } from "./model-pricing.ts";

const DEFAULT_PORT = 19222;
const POST_TIMEOUT_MS = 500;
const CAPTURE_HELPER_TIMEOUT_MS = 1500;
const CAPTURE_QUEUE_CAPACITY = 256;
// Pi awaits session_shutdown callbacks before exiting. Give an already-idle
// queue one brief chance to finish, then hand the remaining ordered work to a
// detached batch worker instead of waiting for capture-helper timeouts.
const SHUTDOWN_DRAIN_MS = 100;
const CAPTURE_BATCH_HANDOFF_TIMEOUT_MS = 100;
const INCOGNITO_FALLBACK_TIMEOUT_MS = 5000;
const INCOGNITO_OFF_REFUSAL = "This tool cannot turn incognito off; only the user can. Ask the user to type /incognito off in Pi for this session, or /incognito off all for every session.";
const MAX_TRAJECTORY_HOME_POINTER_BYTES = 4096;
const PI_EXTENSION_ROOT = fileURLToPath(new URL("..", import.meta.url));
const PI_TRAJECTORY_HOME_POINTER = "trajectory-home";
const PLUGIN_PROVENANCE = {
	plugin: {
		id: "trajectory-pi",
		version: "3.2.16",
		source_scope: "trajectory_plugin",
	},
};
export interface TrajectoryExtensionRuntime {
	captureQueue?: BoundedSerialQueue;
	captureHook?: (eventType: string, body: Record<string, unknown>, deliveryId: string) => Promise<void>;
	captureHookBatch?: (captures: CaptureHookBatchItem[]) => Promise<boolean>;
	ensureServe?: () => Promise<boolean>;
	shutdownDrainMs?: number;
	readSessionHeader?: typeof readPiSessionHeaderId;
	listExtensions?: () => Promise<ExtensionInfo[]>;
	readModelsConfig?: () => Promise<unknown>;
}

export interface CaptureHookBatchItem {
	event_type: string;
	body: Record<string, unknown>;
	delivery_id: string;
}

export function resolvePiTrajectoryHome(
	extensionRoot = PI_EXTENSION_ROOT,
	environment: NodeJS.ProcessEnv = process.env,
): string | undefined {
	const configured = environment.TRAJECTORY_HOME?.trim();
	if (configured) return resolve(configured);

	const pointer = join(extensionRoot, PI_TRAJECTORY_HOME_POINTER);
	try {
		const info = lstatSync(pointer);
		if (info.isFile() && info.size > 0 && info.size <= MAX_TRAJECTORY_HOME_POINTER_BYTES) {
			const installed = readFileSync(pointer, "utf8").trim();
			if (installed && !installed.includes("\n") && !installed.includes("\r") && isAbsolute(installed)) return installed;
		}
	} catch {
		// Manual plugin installs have no setup-owned home pointer.
	}

	const userHome = environment.HOME?.trim();
	return userHome ? join(userHome, ".trajectory") : undefined;
}

export function piTrajectoryChildEnvironment(
	extensionRoot = PI_EXTENSION_ROOT,
	environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	const home = resolvePiTrajectoryHome(extensionRoot, environment);
	return childEnvironmentForHome(home, environment);
}

function childEnvironmentForHome(
	home: string | undefined,
	environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
	return home ? { ...environment, TRAJECTORY_HOME: home } : { ...environment };
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
	const captureQueue = runtime.captureQueue ?? new BoundedSerialQueue(CAPTURE_QUEUE_CAPACITY);
	const pendingCaptures = new Map<CaptureHookBatchItem, () => Promise<void>>();
	const metadataReader = new PiSessionMetadataReader();
	const handedOffCaptures = new WeakSet<CaptureHookBatchItem>();
	const frozenCaptures = new WeakSet<CaptureHookBatchItem>();
	const pendingHandoffs = new WeakMap<CaptureHookBatchItem, Promise<boolean>>();
	// Read before this process exports its own session, so the value names the
	// Pi session that launched this process.
	const inheritedParentSession = process.env[TRAJECTORY_PI_PARENT_SESSION_ENV];

	function captureCallback<Args extends unknown[]>(handler: (...args: Args) => Promise<void>): (...args: Args) => Promise<void> {
		return async (...args) => {
			try { await handler(...args); } catch { captureQueue.recordFailure(); }
		};
	}

	let sessionId = "";
	const agentRuns = new PiAgentRunTracker();
	let unsettledMessages: unknown[] = [];
	// Pi releases before agent_settled accept the handler but never call it.
	// Once this Pi has called it, TurnEnd arrives when Pi settles each prompt.
	let agentSettledSeen = false;
	const toolErrors = new Map<string, string>();
	registerSubagentEvidence(pi.events, () => sessionId, (body) => captureLifecycle("SubagentEvidence", body));
	let modelsConfig: unknown;
	let pricingEvidence = new PiPricingSnapshots();
	// Setup can prune this generation while Pi still runs it. Reading the home
	// again would then fall back to ~/.trajectory, so keep the first result.
	// Generations never change in place, so a later read cannot see a newer
	// setup choice. Pi loads the new generation, and its home, on restart.
	let rememberedHome = resolvePiTrajectoryHome();
	const trajectoryHome = () => (rememberedHome ??= resolvePiTrajectoryHome());

	// ── Receipt-backed binary delivery ───────────────────────────────

	// Look up the binary on each call. After a prune, the generation's copy is
	// gone and the binary in the remembered home takes over.
	function findTrajectoryBinary(home: string | undefined): string | undefined {
		const candidates = [
			process.env.TRAJECTORY_BINARY?.trim(),
			join(PI_EXTENSION_ROOT, "bin", "trajectory"),
			home ? join(home, "bin", "trajectory") : undefined,
			process.env.HOME?.trim() ? join(process.env.HOME, "bin", "trajectory") : undefined,
		];
		for (const p of candidates) {
			if (p && existsSync(p)) return p;
		}
		// Let execFile search PATH as the final compatibility fallback.
		return "trajectory";
	}

	async function ensureTrajectoryServe(): Promise<boolean> {
		const home = trajectoryHome();
		const binPath = findTrajectoryBinary(home);
		if (!binPath) return false;
		const result = await requestTrajectoryServe({
			binary: binPath,
			client: "pi",
			port,
			env: childEnvironmentForHome(home),
		});
		if (!result.ok) {
			throw new Error(`Trajectory serve is not ready: ${result.diagnostic}`);
		}
		return result.ok;
	}

	async function enableIncognitoWithLocalFallback(cause: unknown, signal?: AbortSignal) {
		if (signal?.aborted) throw cause;
		const home = trajectoryHome();
		if (!home) {
			throw new Error("local incognito fallback cannot resolve the Trajectory home", { cause });
		}
		const stateDir = join(home, "state");
		const sentinel = join(stateDir, `incognito-${sessionId}`);
		await mkdir(stateDir, { recursive: true, mode: 0o700 });
		const stateInfo = await lstat(stateDir);
		if (!stateInfo.isDirectory() || stateInfo.isSymbolicLink()) {
			throw new Error("local incognito fallback found an unsafe state directory", { cause });
		}
		const temporary = join(stateDir, `.incognito-${sessionId}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);
		let handle: Awaited<ReturnType<typeof open>> | undefined;
		try {
			handle = await open(temporary, "wx", 0o600);
			await handle.writeFile(`${sessionId}\n`, "utf8");
			await handle.sync();
			await handle.close();
			handle = undefined;
			await rename(temporary, sentinel);
		} finally {
			await handle?.close().catch(() => undefined);
			await rm(temporary, { force: true }).catch(() => undefined);
		}
		const sentinelInfo = await lstat(sentinel);
		if (!sentinelInfo.isFile() || sentinelInfo.isSymbolicLink()) {
			throw new Error("local incognito fallback could not verify the incognito marker file", { cause });
		}
		const causeDetail = cause instanceof Error ? cause.message : String(cause);
		return {
			content: [{
				type: "text" as const,
				text: `Incognito enabled for session ${sessionId} with a local marker file because Trajectory serve could not be reached (${causeDetail}). Trace and log content is not sent to Datadog destinations, except exempt ones. Trajectory still records events locally to JSONL and still sends accounting and activity metrics, without model and repository names by default.`,
			}],
			details: { fallback: "local_sentinel" },
		};
	}

	async function setPersistentIncognitoWithLocalFallback(enable: boolean, cause: unknown, signal?: AbortSignal) {
		if (signal?.aborted) throw cause;
		const home = trajectoryHome();
		const binary = findTrajectoryBinary(home);
		if (!home || !binary) {
			throw new Error("persistent incognito fallback cannot resolve the Trajectory installation", { cause });
		}
		const action = enable ? "opt-out" : "opt-in";
		const output = await new Promise<string>((done, reject) => {
			execFile(binary, ["config", "publish", action, "--json"], {
				timeout: INCOGNITO_FALLBACK_TIMEOUT_MS,
				killSignal: "SIGKILL",
				maxBuffer: 64 * 1024,
				signal,
				env: childEnvironmentForHome(home),
			}, (error, stdout, stderr) => {
				if (error) {
					reject(new Error(stderr.trim() || error.message, { cause: error }));
					return;
				}
				done(stdout.trim());
			});
		});
		const state = JSON.parse(output) as { opted_out?: unknown };
		if (state.opted_out !== enable) {
			throw new Error("persistent incognito fallback returned an unexpected state", { cause });
		}
		return {
			content: [{
				type: "text" as const,
				text: `Persistent incognito ${enable ? "enabled" : "disabled"} for this user through the local Trajectory binary.`,
			}],
			details: { fallback: "local_binary", persistent: true },
		};
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

	// Serve logs the source of every switch and refuses a switch-off from the
	// model's tool. Only the user's /incognito command may turn it off.
	type IncognitoSource = "pi_tool" | "pi_command";

	async function setIncognito(enable: boolean, persistent: boolean, source: IncognitoSource, signal?: AbortSignal) {
		if (!persistent && !sessionId) {
			throw new Error("No active Pi session is registered yet.");
		}
		try {
			if (!(await ensureServeTask())) {
				throw new Error("Trajectory serve is not ready");
			}
			const query = persistent
				? `scope=user&enable=${enable}&source=${source}`
				: `session_id=${encodeURIComponent(sessionId)}&enable=${enable}&source=${source}`;
			const res = await fetch(
				`${baseUrl}/session/incognito?${query}`,
				{
					method: "POST",
					signal: signal ?? AbortSignal.timeout(POST_TIMEOUT_MS),
				},
			);
			if (!res.ok) {
				const body = await res.text();
				throw new Error(`${res.status} ${body}`.trim());
			}
			if (persistent) {
				return {
					content: [{ type: "text" as const, text: `Persistent incognito ${enable ? "enabled" : "disabled"} for this user.` }],
					details: { fallback: "serve", persistent: true },
				};
			}
			const state = enable ? "enabled" : "disabled";
			const detail = enable
				? "trace and log content is not sent to Datadog destinations, except exempt ones. Trajectory still records events locally to JSONL and still sends accounting and activity metrics, without model and repository names by default"
				: "Trajectory resumes sending trace and log content to Datadog destinations";
			return {
				content: [{ type: "text" as const, text: `Incognito ${state} for session ${sessionId}; ${detail}.` }],
				details: { fallback: "serve" },
			};
		} catch (err) {
			if (persistent && !signal?.aborted) {
				try {
					return await setPersistentIncognitoWithLocalFallback(enable, err, signal);
				} catch (fallbackErr) {
					const primary = err instanceof Error ? err.message : String(err);
					const fallback = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
					throw new Error(`Incognito toggle failed: ${primary}; ${fallback}`, { cause: fallbackErr });
				}
			}
			if (enable && !signal?.aborted) {
				try {
					return await enableIncognitoWithLocalFallback(err, signal);
				} catch (fallbackErr) {
					const primary = err instanceof Error ? err.message : String(err);
					const fallback = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
					throw new Error(`Incognito toggle failed: ${primary}; ${fallback}`, { cause: fallbackErr });
				}
			}
			const detail = err instanceof Error ? err.message : String(err);
			throw new Error(`Incognito toggle failed: ${detail}`, { cause: err });
		}
	}

	pi.registerTool({
		name: "trajectory_incognito",
		label: "Trajectory Incognito",
		description: "Turns incognito on for the current Pi session, or saves it for all of this user's sessions. This tool cannot turn incognito off: only the user can, with /incognito off (add `all` for every session). While incognito is on, Trajectory still records events locally to JSONL and still sends accounting and activity metrics. By default, those metrics leave out model and repository names. Trace and log content is not sent to Datadog destinations, except exempt ones.",
		parameters: Type.Object({
			enable: Type.Boolean({ description: "true to enable incognito. false is refused: only the user can turn incognito off" }),
			persistent: Type.Optional(Type.Boolean({ description: "Apply the preference to all current and future sessions for this user" })),
			client: Type.Optional(Type.String({ description: "Optional compatibility hint; Pi uses its active native session" })),
			project_dir: Type.Optional(Type.String({ description: "Optional compatibility hint; Pi uses its active native session" })),
		}),
		async execute(_toolCallId, params, signal) {
			const input = params as { enable?: boolean; persistent?: boolean };
			if (!input.enable) {
				return {
					content: [{ type: "text", text: INCOGNITO_OFF_REFUSAL }],
					details: { fallback: "refused" },
					isError: true,
				};
			}
			return await setIncognito(true, Boolean(input.persistent), "pi_tool", signal);
		},
	});

	// The peer dependency accepts any Pi version, so an older Pi without
	// extension commands still loads the extension.
	if (typeof pi.registerCommand === "function") pi.registerCommand("incognito", {
		description: "Turn Trajectory incognito on or off: /incognito [on|off] [all]",
		async handler(args, ctx) {
			const words = args.trim().toLowerCase().split(/\s+/).filter(Boolean);
			const persistent = words.includes("all");
			const enable = !words.includes("off");
			try {
				const result = await setIncognito(enable, persistent, "pi_command");
				ctx.ui.notify(result.content.map((part) => part.text).join("\n"), "info");
			} catch (err) {
				ctx.ui.notify(err instanceof Error ? err.message : String(err), "error");
			}
		},
	});

	const mcpSession = new TrajectoryMCPSession();

	async function runMCPTool(name: string, params: object, signal?: AbortSignal) {
		const home = trajectoryHome();
		const result = await mcpSession.call(name, params, findTrajectoryBinary(home)!, childEnvironmentForHome(home), signal);
		return { ...result, details: { result } };
	}

	pi.registerTool({
		name: "trajectory_schema",
		label: "Trajectory Schema",
		description: "Introspects the local Trajectory SQLite cache schema. Call this before trajectory_query so SQL matches the live cache.",
		parameters: Type.Object({
			include_row_counts: Type.Optional(Type.Boolean({ description: "Include SELECT COUNT(*) per table. Defaults to false." })),
		}),
		async execute(_toolCallId, params, signal) {
			return runMCPTool("trajectory_schema", params, signal);
		},
	});

	pi.registerTool({
		name: "trajectory_query",
		label: "Trajectory Query",
		description: "Runs a guarded read-only SQL query against the local Trajectory SQLite cache. Call trajectory_schema first unless the schema was already fetched. SELECT, WITH, and a bounded allowlist of metadata-only PRAGMAs are accepted after stripping comments.",
		parameters: Type.Object({
			query: Type.String({ description: "SQL query. First keyword after comments must be SELECT, WITH, or PRAGMA; PRAGMA is restricted to bounded metadata reads." }),
			params: Type.Optional(Type.Record(Type.String(), Type.Any(), { description: "Optional named SQL parameters. Use placeholders such as :session_id." })),
			limit: Type.Optional(Type.Number({ description: "Maximum rows to return. Defaults to 100, max 1000." })),
			row_limit: Type.Optional(Type.Number({ description: "Alias for limit." })),
		}),
		async execute(_toolCallId, params, signal) {
			return runMCPTool("trajectory_query", params, signal);
		},
	});

	pi.registerTool({
		name: "trajectory_search",
		label: "Trajectory Search",
		description: "Full-text search over historical Trajectory tool calls and turns using the existing SQLite FTS5 indexes. Use tool_calls (default) for literal substrings such as paths, IDs, SHAs, and URLs (at least 3 characters). Use turns for prose with word matching and bm25 ranking. Results include snippets, rank (lower is better), and session metadata. The tool-call index is built on demand; retry if the result says it is being built.",
		parameters: Type.Object({
			query: Type.String({ description: "Search text: a literal substring for tool_calls, or whitespace-separated terms for turns." }),
			target: Type.Optional(Type.Union([Type.Literal("tool_calls"), Type.Literal("turns")], { description: "Index to search. Defaults to tool_calls." })),
			tool_name: Type.Optional(Type.String({ description: "Restrict to a tool name. Only valid with target=tool_calls." })),
			session_id: Type.Optional(Type.String({ description: "Restrict to a session ID." })),
			start_date: Type.Optional(Type.String({ description: "Inclusive lower bound on started_at (ISO8601 timestamp or date)." })),
			end_date: Type.Optional(Type.String({ description: "Inclusive upper bound on started_at (ISO8601 timestamp or date)." })),
			limit: Type.Optional(Type.Number({ description: "Maximum rows to return. Defaults to 20, max 100." })),
		}),
		async execute(_toolCallId, params, signal) {
			return runMCPTool("trajectory_search", params, signal);
		},
	});

	pi.registerTool({
		name: "get_session_trajectory",
		label: "Session Trajectory",
		description: "Pull trajectory data for a session. For large sessions, use max_turns and offset to paginate detailed results. Raw results use max_events and the opaque pagination.next_cursor value.",
		parameters: Type.Object({
			session_id: Type.String({ description: "The session ID to query" }),
			depth: Type.Optional(Type.Union([Type.Literal("summary"), Type.Literal("detailed"), Type.Literal("raw")], { description: "Level of detail: 'summary' (default), 'detailed', or 'raw'" })),
			max_turns: Type.Optional(Type.Number({ description: "Max turns to return for detailed depth (default 50)" })),
			offset: Type.Optional(Type.Number({ description: "Skip first N turns for detailed pagination (default 0); raw pagination uses cursor" })),
			max_events: Type.Optional(Type.Number({ description: "Max events to return for raw depth (default 200)" })),
			cursor: Type.Optional(Type.String({ description: "Opaque pagination.next_cursor returned by the previous raw page" })),
		}),
		async execute(_toolCallId, params, signal) {
			return runMCPTool("get_session_trajectory", params, signal);
		},
	});

	// ── CLI fallback for session lifecycle events ───────────────────
	// Session lifecycle events (start/end) use CLI fallback to write directly
	// to JSONL, independent of serve availability. Matches CC plugin pattern.

	async function captureHookCLI(eventType: string, body: Record<string, unknown>, deliveryId: string): Promise<void> {
		const home = trajectoryHome();
		const binPath = findTrajectoryBinary(home);
		if (!binPath) return;
		await new Promise<void>((resolve) => {
			let child: ReturnType<typeof spawn>;
			try {
				// --client pi keeps the helper's notify on the Pi runtime. The helper
				// writes JSONL before notifying serve, so it remains the durable
				// fallback for short-lived `pi --print` sessions.
				child = spawn(binPath, [
					"capture-hook", "--client", "pi", "--wait-notify", "500ms",
					"--capture-delivery-id", deliveryId, eventType,
				], {
					detached: true,
					stdio: ["pipe", "ignore", "ignore"],
					env: childEnvironmentForHome(home),
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
				// This is an owned per-event helper. Force its bounded termination so
				// a wedged notify cannot permanently block TurnEnd and SessionEnd.
				try {
					child.kill("SIGKILL");
				} catch {
					// Best-effort termination; finish still releases the serialized queue.
				}
				finish();
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

	async function captureHookBatchCLI(captures: CaptureHookBatchItem[]): Promise<boolean> {
		const home = trajectoryHome();
		const binPath = findTrajectoryBinary(home);
		if (!binPath || captures.length === 0) return false;
		return await new Promise<boolean>((resolve) => {
			let child: ReturnType<typeof spawn>;
			try {
				child = spawn(binPath, [
					"capture-hook", "--batch", "--background-after-read",
					"--client", "pi", "--wait-notify", "2s",
				], {
					detached: true,
					stdio: ["pipe", "ignore", "ignore"],
					env: childEnvironmentForHome(home),
				});
			} catch { resolve(false); return; }

			let settled = false;
			const finish = (accepted: boolean) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				resolve(accepted);
			};
			const stop = () => { try { child.kill("SIGKILL"); } catch {} };
			// The client's wait and the helper's lifetime are different budgets.
			// Returning an unknown outcome must not kill a valid delayed reader.
			const timer = setTimeout(() => {
				// A pending pipe write is itself referenced even after child.unref().
				// Release that incomplete handoff; the original queue retains it.
				if (!child.stdin?.writableFinished) child.stdin?.destroy();
				finish(false);
			}, CAPTURE_BATCH_HANDOFF_TIMEOUT_MS);
			// Keep the short awaited callback alive until it returns. Unref'ing
			// this timer can exit Pi before later native shutdown callbacks run.
			const killTimer = setTimeout(() => { stop(); finish(false); }, CAPTURE_HELPER_TIMEOUT_MS);
			killTimer.unref();
			child.once("error", () => { clearTimeout(killTimer); finish(false); });
			// Exit zero confirms the helper read and spooled the detached batch.
			// Capture acceptance is established later by each delivery receipt.
			child.once("close", code => { clearTimeout(killTimer); finish(code === 0); });
			child.stdin?.once("error", () => { stop(); finish(false); });
			try {
				child.stdin?.end(JSON.stringify(captures.map((capture) => ({
					...capture,
					body: withPluginProvenance(capture.body),
				}))), () => {
					// A flushed pipe must not keep the native host alive waiting
					// for detached work. The short wait timer owns this callback.
					if (child.stdin instanceof Socket) child.stdin.unref();
				});
			} catch { stop(); finish(false); }
			child.unref();
		});
	}

	const captureHookBatchTask = runtime.captureHookBatch ?? captureHookBatchCLI;

	function captureDeliveryId(): string {
		return `dly_${randomBytes(16).toString("hex")}`;
	}

	function enqueueCapture(eventType: string, body: Record<string, unknown>, lifecycle: boolean, terminal = false, prepare?: () => Promise<Record<string, unknown>>): void {
		if (typeof body.session_id !== "string" || body.session_id === "") {
			captureQueue.recordFailure();
			return;
		}
		const capture: CaptureHookBatchItem = {
			event_type: eventType,
			body,
			delivery_id: captureDeliveryId(),
		};
		const task = async () => {
			try {
				if (prepare) {
					try {
						const prepared = await prepare();
						if (!frozenCaptures.has(capture)) capture.body = prepared;
					} catch {
						// Missing enrichment preserves the admitted provider identity.
						captureQueue.recordFailure();
					}
				}
				const handoff = pendingHandoffs.get(capture);
				if (handoff) await handoff;
				if (!handedOffCaptures.has(capture)) await captureHookTask(eventType, capture.body, capture.delivery_id);
			} finally {
				pendingCaptures.delete(capture);
			}
		};
		pendingCaptures.set(capture, task);
		const onDrop = () => pendingCaptures.delete(capture);
		const admitted = terminal
			? captureQueue.enqueueTerminal(task, onDrop)
			: lifecycle
				? captureQueue.enqueueLifecycle(task, onDrop)
				: captureQueue.enqueue(task, onDrop);
		if (!admitted) pendingCaptures.delete(capture);
	}

	function post(path: string, body: Record<string, unknown>): void {
		enqueueCapture(path, body, false);
	}

	function captureLifecycle(eventType: string, body: Record<string, unknown>): void {
		enqueueCapture(eventType, body, true);
	}

	function captureTerminalLifecycle(eventType: string, body: Record<string, unknown>): void {
		enqueueCapture(eventType, body, true, true);
	}

	function completeAgentRun(sourceDialect: string): boolean {
		if (unsettledMessages.length === 0) return false;
		const sourceEventId = agentRuns.complete();
		if (!sourceEventId) return false;
		const settledMessages = unsettledMessages;
		const aggregate = aggregatePiAgentRun(settledMessages);
		const nativeRequests = summarizePiAgentRunRequests(settledMessages);
		const completedErrors = [...toolErrors.values()];
		toolErrors.clear();
		unsettledMessages = [];
		// A person can steer during a retried run, which settles the earlier run
		// while this one is still answering. Its responses keep their prices.
		for (const message of settledMessages) pricingEvidence.forget(message as Parameters<PiPricingSnapshots["forget"]>[0]);

		const body: Record<string, unknown> = {
			session_id: sessionId,
			source_event_id: sourceEventId,
			source_dialect: sourceDialect,
			native_requests: nativeRequests,
			tool_error_messages: completedErrors,
			usage: aggregate.usage,
			native_request_count: aggregate.requestCount,
			zero_usage_requests: aggregate.zeroUsageRequests,
			usage_model_status: aggregate.modelStatus,
			cost_status: aggregate.costStatus,
			timestamp: Date.now(),
		};
		if (aggregate.model) body.model = aggregate.model;
		if (aggregate.provider) body.provider = aggregate.provider;
		// Pi's final stopReason tells a provider error ("error") from a user
		// cancel ("aborted") or a normal finish. A retried error is not final.
		const stopReason = finalStopReason(settledMessages);
		if (stopReason) body.stop_reason = stopReason;
		captureLifecycle("TurnEnd", body);
		return true;
	}

	function finalStopReason(messages: readonly unknown[]): string | undefined {
		for (let index = messages.length - 1; index >= 0; index--) {
			const message = messages[index] as { role?: unknown; stopReason?: unknown } | null | undefined;
			if (message?.role !== "assistant") continue;
			return typeof message.stopReason === "string" && message.stopReason ? message.stopReason : undefined;
		}
		return undefined;
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

	pi.on("session_start", captureCallback(async (event, ctx) => {
		// A failed provider lookup must not leave the previous session's identity
		// or turn state attached to subsequent callbacks.
		sessionId = "";
		toolErrors.clear();
		agentRuns.reset("");
		unsettledMessages = [];
		pricingEvidence = new PiPricingSnapshots();
		delete process.env[TRAJECTORY_PI_PARENT_SESSION_ENV];
		const eventSnapshot = { reason: event.reason, previousSessionFile: event.previousSessionFile };
		const rawID = ctx.sessionManager.getSessionId();
		if (rawID) process.env[TRAJECTORY_PI_PARENT_SESSION_ENV] = rawID;
		let parentSession: string | undefined;
		try { parentSession = ctx.sessionManager.getHeader?.()?.parentSession; } catch { captureQueue.recordFailure(); }
		const managerSnapshot = { getSessionId: () => rawID, getHeader: () => ({ parentSession }) };
		const environment = {
			PI_SUBAGENT_CHILD: process.env.PI_SUBAGENT_CHILD,
			PI_SUBAGENT_PARENT_SESSION: process.env.PI_SUBAGENT_PARENT_SESSION,
			TRAJECTORY_PI_PARENT_SESSION: isHeadlessPiRun(ctx) ? inheritedParentSession : undefined,
		};
		const inventoryHome = process.env.HOME || process.env.USERPROFILE || "";
		const identity = piSessionIdentityFields(eventSnapshot, managerSnapshot, "", environment);
		sessionId = identity.session_id;
		agentRuns.reset(sessionId);

		const transcriptPath = ctx.sessionManager.getSessionFile?.();
		const body = {
			...identity,
			cwd: ctx.cwd,
			model: ctx.model?.id,
			provider: ctx.model?.provider,
			timestamp: Date.now(),
			session_start_reason: event.reason,
			// Where Pi writes this session. Trajectory counts its usage from that
			// file, once per response. A run with no file sends none.
			...(transcriptPath ? { transcript_path: transcriptPath } : {}),
			// Pi's run mode (tui, rpc, json or print) tells Trajectory whether
			// a person is at the prompt. Older Pi has no mode and sends none.
			...(typeof ctx.mode === "string" ? { pi_mode: ctx.mode } : {}),
		};

		enqueueCapture("SessionStart", body, true, false, async () => {
			const defaults = runtime.readSessionHeader && runtime.listExtensions
				? undefined
				: await metadataReader.read(eventSnapshot.previousSessionFile, inventoryHome);
			const parentID = runtime.readSessionHeader
				? await runtime.readSessionHeader(eventSnapshot.previousSessionFile)
				: defaults?.parentID ?? "";
			const extensions = runtime.listExtensions
				? await runtime.listExtensions()
				: defaults?.extensions ?? [];
			return { ...body, ...piSessionIdentityFields(eventSnapshot, managerSnapshot, parentID, environment), extensions };
		});

		// Serve recovery is independent of ordered local capture. A short Pi
		// session must still drain TurnEnd and SessionEnd when ensure takes
		// longer than the shutdown budget.
		void Promise.resolve()
			.then(() => ensureServeTask())
			.catch(() => {});
	}));

	pi.on("agent_start", captureCallback(async () => {
		agentRuns.start();
		modelsConfig = await (runtime.readModelsConfig ?? readPiModelsConfig)();
	}));

	pi.on("message_start", captureCallback(async (event, ctx) => {
		const message = event.message;
		if (message.role !== "assistant") return;
		const effective = ctx.model?.id === message.model && ctx.model?.provider === message.provider ? ctx.model : undefined;
		const pricing = classifyPiModelPricing(effective, modelsConfig);
		pricing.model = message.model;
		pricing.provider = message.provider;
		const timestamp = new Date(message.timestamp);
		if (!Number.isFinite(timestamp.getTime())) return;
		pricingEvidence.set(message, { model_pricing: pricing, observed_at: timestamp.toISOString() });
	}));

	pi.on("message_end", captureCallback(async (event, ctx) => {

		const msg = event.message;

		if (msg.role === "user") {
			// Pi releases before agent_settled do not expose that lifecycle event.
			// When the next user message arrives, the previous agent_end is an
			// unambiguous completed interaction. Finalize it before admitting the
			// new prompt, then establish the run that the current prompt belongs to.
			if (unsettledMessages.length > 0 && completeAgentRun("pi-agent-end-next-user")) {
				agentRuns.start();
			}
			const prompt =
				typeof msg.content === "string"
					? msg.content
					: msg.content
							.filter((b: any): b is { type: "text"; text: string } => b.type === "text")
							.map((b: { type: "text"; text: string }) => b.text)
							.join("\n");

			post("UserPromptSubmit", {
				session_id: sessionId,
				prompt,
				timestamp: Date.now(),
			});
		} else if (msg.role === "assistant") {
			const effective = ctx.model?.id === msg.model && ctx.model?.provider === msg.provider ? ctx.model : undefined;
			const savedPricing = pricingEvidence.get(msg);
			const pricing = savedPricing?.model_pricing ?? classifyPiModelPricing(effective, modelsConfig);
			pricing.model = msg.model;
			pricing.provider = msg.provider;
			const timestamp = new Date(msg.timestamp);
			const observedAt = savedPricing?.observed_at ?? (Number.isFinite(timestamp.getTime()) ? timestamp.toISOString() : new Date().toISOString());
			pricingEvidence.set(msg, { model_pricing: pricing, observed_at: observedAt });
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

			const body: Record<string, unknown> = {
				session_id: sessionId,
				text: textParts.join("\n"),
				has_thinking: hasThinking,
				thinking_text: thinkingParts.join("\n"),
				tool_use_ids: toolCallIds,
				model: msg.model,
				provider: msg.provider,
				api: msg.api,
				usage: pricing.status === "configured" ? msg.usage : { ...msg.usage, cost: undefined },
				model_pricing: pricing,
				observed_at: observedAt,
				content_blocks: contentBlockTypes(msg.content),
				timestamp: Date.now(),
			};
			// Serve settles activity at TurnEnd only for a marked message. An
			// unmarked final message settles it, because older Pi sends TurnEnd
			// only at the next prompt or at shutdown.
			if (agentSettledSeen) body.settles_on_agent_settled = true;
			// A provider error tells serve that this message ends the work in an
			// error when no settled TurnEnd follows. Other stop reasons are not
			// sent, so the request keeps its derived stop reason.
			if (msg.stopReason === "error") body.stop_reason = "error";
			post("AgentMessage", body);
		}
	}));

	pi.on("tool_call", captureCallback(async (event, _ctx) => {
		post("PreToolUse", {
			session_id: sessionId,
			tool_use_id: event.toolCallId,
			tool_name: event.toolName,
			input: event.input,
			timestamp: Date.now(),
		});
	}));

	pi.on("tool_result", captureCallback(async (event, _ctx) => {


		const output = event.content
			.filter((b): b is { type: "text"; text: string } => b.type === "text")
			.map((b) => b.text)
			.join("\n");

		if (event.isError) toolErrors.set(event.toolCallId, output.slice(0, 4096));
		post("PostToolUse", {
			session_id: sessionId,
			tool_use_id: event.toolCallId,
			tool_name: event.toolName,
			output,
			is_error: event.isError,
			timestamp: Date.now(),
		});
	}));

	pi.on("agent_end", captureCallback(async (event, _ctx) => {
		if (Array.isArray(event.messages)) unsettledMessages.push(...event.messages.map((message) => {
			if (message.role !== "assistant") return message;
			const evidence = pricingEvidence.get(message) ?? {
				model_pricing: { schema_version: 1, model: message.model, provider: message.provider, status: "unavailable" },
			};
			return { ...message, ...evidence };
		}));
	}));

	pi.on("agent_settled", captureCallback(async (_event, _ctx) => {
		agentSettledSeen = true;
		completeAgentRun("pi-agent-settled");
	}));

	pi.on("session_compact", captureCallback(async (event, _ctx) => {


		post("PostCompact", {
			session_id: sessionId,
			summary: event.compactionEntry.summary,
			tokens_before: event.compactionEntry.tokensBefore,
			timestamp: Date.now(),
		});
	}));

	pi.on("session_shutdown", captureCallback(async (_event, _ctx) => {
		// Legacy Pi has agent_end but no agent_settled. The terminal boundary is
		// the final unambiguous chance to preserve its last interaction.
		if (unsettledMessages.length > 0) completeAgentRun("pi-agent-end-session-shutdown");
		const body: Record<string, unknown> = {
			session_id: sessionId,
			timestamp: Date.now(),
		};

		// CLI writes directly to JSONL (always works, even if serve is dead)
		captureTerminalLifecycle("SessionEnd", body);

		// Preserve the fast path when the queue is already close to idle. If a
		// helper is slow, move every incomplete admitted event into one detached
		// batch with stable delivery IDs. Spooling and receipt acceptance are
		// separate facts; an unknown handoff remains owned by the original queue.
		const drainMs = runtime.shutdownDrainMs ?? SHUTDOWN_DRAIN_MS;
		const drained = await captureQueue.drain(drainMs);
		metadataReader.close();
		void mcpSession.close();
		if (drained) return;
		const captures = Array.from(pendingCaptures.keys());
		if (captures.length === 0) return;
		let resolveHandoff!: (accepted: boolean) => void;
		const handoff = new Promise<boolean>(resolve => { resolveHandoff = resolve; });
		for (const capture of captures) {
			frozenCaptures.add(capture);
			pendingHandoffs.set(capture, handoff);
		}
		let accepted = false;
		try {
			accepted = await captureHookBatchTask(captures);
			if (accepted) {
				const tasks = new Set(captures.map(capture => pendingCaptures.get(capture)!).filter(Boolean));
				for (const capture of captures) {
					handedOffCaptures.add(capture);
					pendingCaptures.delete(capture);
				}
				captureQueue.takePendingForHandoff(tasks);
			}
		} catch { /* The original queue still owns an unconfirmed batch. */ }
		finally {
			if (!accepted) captureQueue.recordFailure();
			resolveHandoff(accepted);
			for (const capture of captures) pendingHandoffs.delete(capture);
		}
	}));

	pi.on("model_select", captureCallback(async (event, _ctx) => {


		post("ModelChange", {
			session_id: sessionId,
			provider: event.model.provider,
			model_id: event.model.id,
			timestamp: Date.now(),
		});
	}));

}

export default function trajectoryExtension(pi: ExtensionAPI): void {
	registerTrajectoryExtension(pi);
}
