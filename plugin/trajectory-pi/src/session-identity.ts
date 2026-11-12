import { spawn, type ChildProcess } from "node:child_process";
import type { ExtensionInfo } from "./extension-inventory.ts";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { open } from "node:fs/promises";

const MAX_SESSION_HEADER_BYTES = 64 * 1024;

export interface PiSessionStartEventLike {
	reason?: "startup" | "reload" | "new" | "resume" | "fork";
	previousSessionFile?: string;
}

export interface PiSessionManagerIdentityLike {
	getSessionId(): string;
	getHeader?(): { parentSession?: string } | null;
}

export interface PiSessionIdentityFields {
	session_id: string;
	raw_session_id: string;
	provider_session_id: string;
	source?: string;
	parent_session_id?: string;
	provider_parent_session_id?: string;
	session_relationship?: string;
}

export interface PiSubagentEnvironmentLike {
	PI_SUBAGENT_CHILD?: string;
	PI_SUBAGENT_PARENT_SESSION?: string;
	TRAJECTORY_PI_PARENT_SESSION?: string;
}

/**
 * The Trajectory extension exports its active provider session ID under this
 * name so a Pi child process that inherits the environment can link itself to
 * the session that launched it, even when the spawner sets no Pi-specific
 * subagent variables.
 */
export const TRAJECTORY_PI_PARENT_SESSION_ENV = "TRAJECTORY_PI_PARENT_SESSION";

export interface PiRunModeLike {
	mode?: string;
	hasUI?: boolean;
}

/**
 * Subagent spawners launch headless print or JSON runs. TUI and RPC hosts can
 * be long-lived frontends whose environment was inherited from an unrelated Pi
 * session, so they never consume an inherited parent. Pi versions without
 * `mode` report print and JSON runs as the only runs without UI.
 */
export function isHeadlessPiRun(context: PiRunModeLike): boolean {
	if (context.mode !== undefined) return context.mode === "print" || context.mode === "json";
	return context.hasUI === false;
}

/**
 * Derive the identity fields for Pi's supported session_start contract.
 *
 * Current Pi emits fork/new transitions as session_start with the previously
 * active file, and persists that same file in the new header's parentSession.
 * Requiring the new header to confirm the event reference, then using the
 * exact ID read from that provider-owned file, avoids inferring parentage from
 * extension-instance state that Pi replaces during session transitions.
 */
export function piSessionIdentityFields(
	event: PiSessionStartEventLike,
	manager: PiSessionManagerIdentityLike,
	parentProviderSessionId = "",
	subagentEnvironment: PiSubagentEnvironmentLike = {},
): PiSessionIdentityFields {
	const rawSessionId = manager.getSessionId();
	const sessionId = canonicalPiSessionId("pi", rawSessionId);
	const fields: PiSessionIdentityFields = {
		session_id: sessionId,
		raw_session_id: rawSessionId,
		provider_session_id: `pi:${rawSessionId}`,
	};
	if (event.reason) fields.source = event.reason;

	const launchParentProviderSessionId =
		subagentEnvironment.PI_SUBAGENT_CHILD === "1"
			? subagentEnvironment.PI_SUBAGENT_PARENT_SESSION?.trim()
			: undefined;
	if (launchParentProviderSessionId && launchParentProviderSessionId !== rawSessionId) {
		fields.parent_session_id = canonicalPiSessionId("pi", launchParentProviderSessionId);
		fields.provider_parent_session_id = `pi:${launchParentProviderSessionId}`;
		fields.session_relationship = "subagent";
		return fields;
	}

	const inheritedParentProviderSessionId = subagentEnvironment.TRAJECTORY_PI_PARENT_SESSION?.trim();
	if (event.reason === "startup" && inheritedParentProviderSessionId && inheritedParentProviderSessionId !== rawSessionId) {
		fields.parent_session_id = canonicalPiSessionId("pi", inheritedParentProviderSessionId);
		fields.provider_parent_session_id = `pi:${inheritedParentProviderSessionId}`;
		fields.session_relationship = "subagent";
		return fields;
	}

	const parentRef = manager.getHeader?.()?.parentSession;
	const transitionCanCreateChild = event.reason === "fork" || event.reason === "new";
	if (
		transitionCanCreateChild &&
		parentProviderSessionId &&
		event.previousSessionFile &&
		parentRef === event.previousSessionFile
	) {
		fields.parent_session_id = canonicalPiSessionId("pi", parentProviderSessionId);
		fields.provider_parent_session_id = `pi:${parentProviderSessionId}`;
		fields.session_relationship = event.reason;
	}

	return fields;
}

export function canonicalPiSessionId(provider: string, providerSessionId: string): string {
	if (!providerSessionId) return "";
	if (/^[a-zA-Z0-9_-]{1,128}$/.test(providerSessionId)) return providerSessionId;
	const digest = createHash("sha256")
		.update(provider)
		.update("\0")
		.update(providerSessionId)
		.digest("hex")
		.slice(0, 32);
	return `${provider}-${digest}`;
}

/**
 * Read the exact provider ID from Pi's first-line session header without
 * loading an unbounded transcript. Pi owns previousSessionFile; failures are
 * intentionally non-fatal so backfill can reconstruct the relationship later.
 */
export async function readPiSessionHeaderId(filePath?: string): Promise<string> {
	if (!filePath) return "";
	let file: Awaited<ReturnType<typeof open>> | undefined;
	try {
		file = await open(filePath, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0));
		if (!(await file.stat()).isFile()) return "";
		const buffer = new Uint8Array(MAX_SESSION_HEADER_BYTES);
		let total = 0;
		let lineEnd = -1;
		for (let reads = 0; reads < 128 && total < buffer.length; reads++) {
			const { bytesRead } = await file.read(buffer, total, buffer.length - total, total);
			if (bytesRead === 0) break;
			const previousTotal = total;
			total += bytesRead;
			const relativeEnd = buffer.subarray(previousTotal, total).indexOf(0x0a);
			if (relativeEnd >= 0) { lineEnd = previousTotal + relativeEnd; break; }
		}
		if (lineEnd < 0) return "";
		if (lineEnd > 0 && buffer[lineEnd - 1] === 0x0d) lineEnd--;
		const header = JSON.parse(new TextDecoder().decode(buffer.subarray(0, lineEnd))) as {
			type?: unknown;
			id?: unknown;
		};
		return header.type === "session" && typeof header.id === "string" ? header.id : "";
	} catch {
		return "";
	} finally {
		await file?.close().catch(() => undefined);
	}
}


export interface PiSessionMetadata {
	parentID: string;
	extensions: ExtensionInfo[];
}

const MAX_METADATA_BYTES = 64 * 1024;
const METADATA_TIMEOUT_MS = 1500;
// This permit is shared across extension instances and is released only after
// the owned process closes, never merely because its caller timed out.
let activeMetadataWorker: ChildProcess | undefined;

/** Optional filesystem enrichment lives outside Pi's process. A stalled OS
 * read cannot retain a native-host filesystem request across client shutdown. */
export class PiSessionMetadataReader {
	private child?: ChildProcess;
	private stop?: () => void;
	private closed = false;

	private readonly launch: (source: string) => ChildProcess;

	constructor(launch: (source: string) => ChildProcess = (source) => spawn(process.execPath,
		["--experimental-strip-types", "--input-type=module", "--eval", source],
		{ stdio: ["pipe", "pipe", "ignore"], windowsHide: true })) { this.launch = launch; }

	async read(previousFile: string | undefined, home: string): Promise<PiSessionMetadata> {
		if (this.closed || activeMetadataWorker) throw new Error("metadata worker unavailable");
		if ((previousFile?.length ?? 0) > 4096 || home.length > 4096) throw new Error("metadata request too large");
		const request = JSON.stringify({ previousFile, home });
		if (Buffer.byteLength(request) > 16384) throw new Error("metadata request too large");
		// Import the shipped readers, preserving their filesystem and identity
		// policy. Provider paths travel through stdin, never process arguments.
		const source = `
			setTimeout(() => process.kill(process.pid, "SIGKILL"), ${METADATA_TIMEOUT_MS});
			const { readPiSessionHeaderId } = await import(${JSON.stringify(import.meta.url)});
			const { listInstalledExtensions } = await import(${JSON.stringify(new URL("./extension-inventory.ts", import.meta.url).href)});
			let request = "";
			process.stdin.setEncoding("utf8");
			for await (const chunk of process.stdin) {
				request += chunk;
				if (Buffer.byteLength(request) > 16384) process.exit(1);
			}
			const { previousFile, home } = JSON.parse(request);
			const parentID = await readPiSessionHeaderId(previousFile);
			const extensions = await listInstalledExtensions(home);
			const response = JSON.stringify({ parentID, extensions });
			if (Buffer.byteLength(response) > 65536) process.exit(1);
			process.stdout.write(response, () => process.exit(0));
		`;
		return new Promise((resolve, reject) => {
			let child: ChildProcess;
			try { child = this.launch(source); } catch { reject(new Error("metadata worker unavailable")); return; }
			activeMetadataWorker = child;
			this.child = child;
			let bytes = 0;
			const chunks: Buffer[] = [];
			let settled = false;
			const finish = (error?: Error, metadata?: PiSessionMetadata) => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				this.stop = undefined;
				child.stdin?.destroy();
				child.stdout?.destroy();
				if (error) {
					try { child.kill("SIGKILL"); } catch { /* Retain its permit until close. */ }
					reject(error);
				} else resolve(metadata!);
			};
			const timer = setTimeout(() => finish(new Error("metadata worker deadline")), METADATA_TIMEOUT_MS);
			timer.unref();
			this.stop = () => finish(new Error("metadata worker stopped"));
			child.once("error", () => finish(new Error("metadata worker unavailable")));
			child.once("close", (code) => {
				if (activeMetadataWorker === child) activeMetadataWorker = undefined;
				if (this.child === child) this.child = undefined;
				if (settled) return;
				try {
					if (code !== 0) throw new Error("metadata worker failed");
					const metadata = JSON.parse(Buffer.concat(chunks, bytes).toString("utf8")) as PiSessionMetadata;
					if (typeof metadata.parentID !== "string" || metadata.parentID.length > 4096 || !Array.isArray(metadata.extensions) || metadata.extensions.length > 128 ||
						metadata.extensions.some((entry) => !entry || typeof entry.name !== "string" || entry.name.length > 256 || typeof entry.version !== "string" || entry.version.length > 128)) throw new Error("invalid metadata response");
					finish(undefined, metadata);
				} catch { finish(new Error("metadata worker failed")); }
			});
			child.stdout?.on("data", (chunk: Buffer) => {
				if (settled) return;
				bytes += chunk.length;
				if (bytes > MAX_METADATA_BYTES) { finish(new Error("metadata response too large")); return; }
				chunks.push(chunk);
			});
			child.stdout?.once("error", () => finish(new Error("metadata response failed")));
			child.stdin?.once("error", () => finish(new Error("metadata request failed")));
			if (!child.stdin || !child.stdout) { finish(new Error("metadata worker pipes unavailable")); return; }
			child.stdin.end(request);
			// Optional enrichment must not own the native process lifetime, even
			// if the host exits without dispatching its shutdown callback.
			(child.stdin as typeof child.stdin & { unref?: () => void }).unref?.();
			(child.stdout as typeof child.stdout & { unref?: () => void }).unref?.();
			child.unref();
		});
	}

	close(): void {
		this.closed = true;
		this.stop?.();
	}
}
