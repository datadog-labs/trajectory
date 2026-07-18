import { createHash } from "node:crypto";
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
): PiSessionIdentityFields {
	const rawSessionId = manager.getSessionId();
	const sessionId = canonicalPiSessionId("pi", rawSessionId);
	const fields: PiSessionIdentityFields = {
		session_id: sessionId,
		raw_session_id: rawSessionId,
		provider_session_id: `pi:${rawSessionId}`,
	};
	if (event.reason) fields.source = event.reason;

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
		file = await open(filePath, "r");
		const buffer = new Uint8Array(MAX_SESSION_HEADER_BYTES);
		const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
		let lineEnd = buffer.subarray(0, bytesRead).indexOf(0x0a);
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
