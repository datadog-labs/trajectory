export interface EvidenceBus {
	on(name: string, handler: (value: unknown) => void): unknown;
}

// Extensions emit only accepted launches. Coverage is a separate explicit
// attestation for one parent turn; registering this listener proves nothing.
export function registerSubagentEvidence(
	bus: EvidenceBus | undefined,
	session: () => string,
	capture: (body: Record<string, unknown>) => void,
): void {
	bus?.on("trajectory:subagent", (value) => {
		if (!value || typeof value !== "object") return;
		const event = value as Record<string, unknown>;
		if (event.contract_version !== 1 || event.parent_session_id !== session() || !session()) return;
		if (!Number.isSafeInteger(event.parent_turn_id) || Number(event.parent_turn_id) <= 0) return;
		if (!Number.isSafeInteger(event.timestamp) || Number(event.timestamp) <= 0) return;
		const body: Record<string, unknown> = {
			contract_version: 1, session_id: session(), parent_session_id: session(),
			parent_turn_id: event.parent_turn_id, timestamp: event.timestamp,
		};
		if (event.kind === "coverage") {
			if (!["complete", "incomplete", "unsupported"].includes(String(event.status))) return;
			body.kind = "coverage";
		body.status = event.status;
		} else {
			const child = typeof event.child_session_id === "string" ? event.child_session_id.trim() : "";
			const tool = typeof event.tool_use_id === "string" ? event.tool_use_id.trim() : "";
			if (event.accepted !== true || !child || !tool || child === session()) return;
			body.accepted = true;
		body.child_session_id = child;
		body.tool_use_id = tool;
		}
		capture(body);
	});
}
