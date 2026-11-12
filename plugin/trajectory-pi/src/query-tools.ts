import { spawn, type ChildProcess } from "node:child_process";

const MCP_TIMEOUT_MS = 15_000;
const MCP_MAX_BUFFER = 10 * 1024 * 1024;

export interface MCPToolResult {
	content: Array<{ type: "text"; text: string }>;
	isError?: boolean;
}

interface PendingCall {
	name: string;
	resolve: (result: MCPToolResult) => void;
	reject: (error: Error) => void;
}

type Handle = { ref?: () => void; unref?: () => void };

// TrajectoryMCPSession runs Trajectory tools on one bundled MCP server, so Pi
// gets the same schema, query, search, and session results as every other
// client. The server lives across calls because raw session cursors are signed
// with a per-process key and name in-memory snapshots. It must not start other
// runtimes, and it never keeps Pi running while no call is pending.
export class TrajectoryMCPSession {
	private child?: ChildProcess;
	private key = "";
	private initialized?: Promise<void>;
	private readonly pending = new Map<number, PendingCall>();
	private nextId = 2;
	private buffered = "";
	private readonly timeoutMs: number;

	constructor(timeoutMs = MCP_TIMEOUT_MS) {
		this.timeoutMs = timeoutMs;
	}

	call(name: string, input: object, binary: string, env: NodeJS.ProcessEnv, signal?: AbortSignal): Promise<MCPToolResult> {
		if (signal?.aborted) return Promise.reject(abortError(signal));
		const key = JSON.stringify([binary, env.TRAJECTORY_HOME, env.TRAJECTORY_ROOT, env.TRAJECTORY_CACHE_DB]);
		if (this.child && key !== this.key) void this.stop(new Error("Trajectory MCP restarted"));
		if (!this.child) this.start(binary, env, key);
		const child = this.child!;
		const id = this.nextId++;
		return new Promise<MCPToolResult>((resolve, reject) => {
			const settle = () => {
				clearTimeout(timer);
				signal?.removeEventListener("abort", onAbort);
				this.pending.delete(id);
				this.release();
			};
			// A stuck or canceled call stops the server; the next call starts a new one.
			const timer = setTimeout(() => void this.stop(new Error(`Trajectory MCP ${name} timed out`), child), this.timeoutMs);
			const onAbort = () => void this.stop(abortError(signal!), child);
			signal?.addEventListener("abort", onAbort, { once: true });
			this.pending.set(id, {
				name,
				resolve: (result) => { settle(); resolve(result); },
				reject: (error) => { settle(); reject(error); },
			});
			this.hold();
			this.initialized!.then(
				() => this.send(child, { jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: input } }),
				() => {},
			);
		});
	}

	close(): Promise<void> {
		return this.stop(new Error("Trajectory MCP session closed"));
	}

	private start(binary: string, env: NodeJS.ProcessEnv, key: string): void {
		const child = spawn(binary, ["mcp", "--no-runtime-management"], { env, stdio: ["pipe", "pipe", "ignore"] });
		this.child = child;
		this.key = key;
		this.buffered = "";
		let ready!: () => void;
		let failed!: (error: Error) => void;
		this.initialized = new Promise<void>((resolve, reject) => { ready = resolve; failed = reject; });
		this.initialized.catch(() => {});
		const fail = (error: Error) => { failed(error); void this.stop(error, child); };
		child.once("error", fail);
		child.once("close", () => fail(new Error("Trajectory MCP exited")));
		child.stdin!.on("error", fail);
		child.stdout!.setEncoding("utf8");
		child.stdout!.on("data", (chunk: string) => {
			if (this.child !== child) return;
			this.buffered += chunk;
			if (this.buffered.length > MCP_MAX_BUFFER) { fail(new Error("Trajectory MCP response too large")); return; }
			for (let newline = this.buffered.indexOf("\n"); newline >= 0; newline = this.buffered.indexOf("\n")) {
				const line = this.buffered.slice(0, newline).trim();
				this.buffered = this.buffered.slice(newline + 1);
				if (!line) continue;
				try {
					this.receive(child, JSON.parse(line), ready);
				} catch (err) {
					fail(err instanceof Error ? err : new Error(String(err)));
					return;
				}
			}
		});
		this.send(child, {
			jsonrpc: "2.0", id: 1, method: "initialize",
			params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "trajectory-pi", version: "1" } },
		});
		this.release();
	}

	private receive(child: ChildProcess, message: { id?: number; error?: { message?: string }; result?: MCPToolResult }, ready: () => void): void {
		if (message.id === 1) {
			if (message.error) throw new Error(message.error.message);
			this.send(child, { jsonrpc: "2.0", method: "notifications/initialized" });
			ready();
			return;
		}
		const call = message.id === undefined ? undefined : this.pending.get(message.id);
		if (!call) return;
		if (message.error) { call.reject(new Error(message.error.message)); return; }
		const result = message.result;
		if (!Array.isArray(result?.content) || !result.content.length ||
			!result.content.every((part: { type?: string; text?: string } | null) => part?.type === "text" && typeof part.text === "string")) {
			call.reject(new Error(`Trajectory MCP returned no ${call.name} result`));
			return;
		}
		call.resolve(result);
	}

	private send(child: ChildProcess, message: object): void {
		if (this.child === child) child.stdin!.write(JSON.stringify(message) + "\n");
	}

	// Calls fail only after the server exits, so no stopped process outlives them.
	private stop(error: Error, child = this.child): Promise<void> {
		if (!child || this.child !== child) return Promise.resolve();
		this.child = undefined;
		this.initialized = undefined;
		const calls = [...this.pending.values()];
		this.pending.clear();
		const running = child.pid !== undefined && child.exitCode === null && child.signalCode === null;
		// An idle server is unreferenced; wait for its exit even if nothing else runs.
		for (const handle of handlesOf(child)) handle.ref?.();
		const closed = running ? new Promise<void>((resolve) => child.once("close", () => resolve())) : Promise.resolve();
		try { child.kill("SIGKILL"); } catch { /* It already exited. */ }
		return closed.then(() => { for (const call of calls) call.reject(error); });
	}

	private hold(): void {
		if (this.child) for (const handle of handlesOf(this.child)) handle.ref?.();
	}

	private release(): void {
		if (this.pending.size > 0 || !this.child) return;
		for (const handle of handlesOf(this.child)) handle.unref?.();
	}
}

function handlesOf(child: ChildProcess): Handle[] {
	return [child, child.stdin as Handle, child.stdout as Handle].filter(Boolean);
}

function abortError(signal: AbortSignal): Error {
	return signal.reason instanceof Error ? signal.reason : new DOMException("The operation was aborted", "AbortError");
}
