const DEFAULT_CAPTURE_PORT = 19222;

function resolveCapturePort(): number {
    const rawPort = (
        globalThis as typeof globalThis & {
            process?: { env?: Record<string, string | undefined> };
        }
    ).process?.env?.TRAJECTORY_PORT;
    if (typeof rawPort !== "string" || !/^\d+$/.test(rawPort)) return DEFAULT_CAPTURE_PORT;

    const port = Number(rawPort);
    return Number.isSafeInteger(port) && port >= 1 && port <= 65535 ? port : DEFAULT_CAPTURE_PORT;
}

const CAPTURE_URL = "http://localhost:" + resolveCapturePort() + "/capture/kilo";
const POST_TIMEOUT_MS = 5000;
const MAX_TRACKED_SESSIONS = 128;
const MAX_RETAINED_SESSIONS = 512;
const MAX_PENDING_STOP_TURN_SNAPSHOTS = 8;
const MAX_COALESCED_STOP_PLACEHOLDERS = 128;
const MAX_TRACKED_MESSAGES_PER_TURN = 128;
const MAX_BUFFERED_TEXT_PARTS_PER_TURN = 64;
const MAX_BUFFERED_TEXT_CHARS_PER_TURN = 1024 * 1024;
const MAX_AGENT_MESSAGE_CHARS = 256 * 1024;
const PLUGIN_PROVENANCE = {
    plugin: {
        id: "trajectory-kilo",
        version: "3.0.0",
        source_scope: "trajectory_plugin",
    },
};

interface KiloPayload extends Record<string, unknown> {
    sessionID?: unknown;
    sessionId?: unknown;
    session_id?: unknown;
    session?: KiloPayload;
    event?: KiloPayload;
    properties?: KiloPayload;
    part?: KiloPayload;
    info?: KiloPayload;
    message?: KiloPayload;
    model?: KiloPayload;
    metadata?: KiloPayload;
    time?: KiloPayload;
    client?: { session?: { messages?: (options: unknown) => unknown } };
    parts?: unknown[];
    directory?: string;
    worktree?: string;
}

interface AssistantMessageMeta {
    model?: unknown;
    provider?: unknown;
    timestamp?: string;
    usage?: Record<string, number>;
}

interface BufferedAssistantPart {
    messageID: string;
    partID: string;
    text: string;
    originalLength: number;
}

interface SessionRuntimeState {
    started: boolean;
    creationObserved: boolean;
    parentSessionID?: string;
    model?: string;
    launchedTaskCalls: Set<string>;
    pendingTaskCalls: Set<string>;
    subagentLink?: SubagentLink;
    activeTurn?: TurnRuntimeState;
    pendingStopTurns: TurnRuntimeState[];
    coalescedStopCount: number;
    stopInFlight?: Promise<void>;
}

interface TurnRuntimeState {
    model?: string;
    nativeAgentMessageSeen: boolean;
    assistantMessages: Map<string, AssistantMessageMeta>;
    bufferedTextParts: Map<string, BufferedAssistantPart>;
    bufferedTextChars: number;
    sentAgentMessages: Set<string>;
    sentUsageMessages: Set<string>;
}

interface SubagentLink {
    parentSessionID: string;
    childSessionID: string;
    toolUseID: string;
}

function payload(value: unknown): KiloPayload {
    return (value ?? {}) as KiloPayload;
}

function isTextPart(value: unknown): value is KiloPayload & { text: string } {
    const part = payload(value);
    return part.type === "text" && typeof part.text === "string";
}

function mergePluginProvenance(provenance: KiloPayload): KiloPayload {
    const plugin = provenance?.plugin;
    if (plugin && typeof plugin === "object" && !Array.isArray(plugin)) {
        const pluginPayload = payload(plugin);
        if (typeof pluginPayload.id === "string" && pluginPayload.id !== "" && pluginPayload.id !== PLUGIN_PROVENANCE.plugin.id) {
            return pluginPayload;
        }
        return {
            ...PLUGIN_PROVENANCE.plugin,
            ...pluginPayload,
        };
    }
    return {
        ...PLUGIN_PROVENANCE.plugin,
    };
}

function withPluginProvenance(data: unknown): KiloPayload {
    const body = payload(data);
    const provenance = payload(body.provenance);
    return {
        ...body,
        provenance: {
            ...PLUGIN_PROVENANCE,
            ...provenance,
            plugin: mergePluginProvenance(provenance),
        },
    };
}

async function postEvent(eventName: string, data: unknown): Promise<void> {
    try {
        await fetch(CAPTURE_URL + "/" + eventName, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(withPluginProvenance(data)),
            signal: AbortSignal.timeout(POST_TIMEOUT_MS),
        });
    } catch {
        // fire-and-forget
    }
}

function normalizeSessionID(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const sessionID = value.trim();
    if (!sessionID || sessionID === "unknown" || sessionID === "global") return undefined;
    return sessionID;
}

function resolveSessionID(...values: unknown[]): string | undefined {
    for (const rawValue of values) {
        const value = payload(rawValue);
        const direct = normalizeSessionID(value?.sessionID ?? value?.sessionId ?? value?.session_id);
        if (direct) return direct;

        const nested = normalizeSessionID(
            value?.session?.id ??
                value?.event?.sessionID ??
                value?.event?.sessionId ??
                value?.event?.session_id ??
                value?.properties?.sessionID ??
                value?.properties?.sessionId ??
                value?.properties?.session_id ??
                value?.properties?.part?.sessionID ??
                value?.properties?.info?.sessionID ??
                value?.properties?.info?.id ??
                value?.message?.sessionID ??
                value?.info?.sessionID,
        );
        if (nested) return nested;
    }
    return undefined;
}

function isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function extractTextFromParts(parts: unknown): string {
    if (!Array.isArray(parts)) return "";
    const text = parts
        .filter(isTextPart)
        .filter((part) => !part?.synthetic)
        .map((part) => part.text)
        .filter((text) => text.trim().length > 0)
        .join("\n");
    return text.trim();
}

function normalizeTimestamp(value: unknown): string | undefined {
    if (typeof value === "number" && Number.isFinite(value)) {
        const millis = value < 1_000_000_000_000 ? value * 1000 : value;
        const date = new Date(millis);
        return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }
    if (isNonEmptyString(value)) return value;
    return undefined;
}

function stringifyError(value: unknown): string | undefined {
    if (value == null) return undefined;
    if (typeof value === "string") return value;
    const message = payload(value).message;
    if (typeof message === "string") return message;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function firstString(...values: unknown[]): string | undefined {
    for (const value of values) {
        if (isNonEmptyString(value)) return value.trim();
    }
    return undefined;
}

function firstValue(...values: unknown[]): unknown {
    for (const value of values) {
        if (value != null) return value;
    }
    return undefined;
}

function nonNegativeNumber(value: unknown): number | undefined {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function nativeMessageUsage(rawInfo: unknown): Record<string, number> | undefined {
    const info = payload(rawInfo);
    const tokens = payload(info.tokens);
    const cache = payload(tokens.cache);
    const usage = {
        input: nonNegativeNumber(tokens.input) ?? 0,
        output: nonNegativeNumber(tokens.output) ?? 0,
        reasoning: nonNegativeNumber(tokens.reasoning) ?? 0,
        cacheRead: nonNegativeNumber(cache.read) ?? 0,
        cacheWrite: nonNegativeNumber(cache.write) ?? 0,
        cost: nonNegativeNumber(info.cost) ?? 0,
    };
    if (
        usage.input === 0 &&
        usage.output === 0 &&
        usage.reasoning === 0 &&
        usage.cacheRead === 0 &&
        usage.cacheWrite === 0 &&
        usage.cost === 0
    ) {
        return undefined;
    }
    return usage;
}

function normalizePermissionDecision(value: unknown): string | undefined {
    if (!isNonEmptyString(value)) return undefined;
    switch (value.trim().toLowerCase()) {
        case "allow":
        case "allowed":
        case "approve":
        case "approved":
        case "accept":
        case "accepted":
        case "once":
        case "always":
            return "allow";
        case "deny":
        case "denied":
        case "reject":
        case "rejected":
        case "decline":
        case "declined":
        case "cancel":
        case "canceled":
        case "cancelled":
            return "deny";
        default:
            return undefined;
    }
}

function permissionPayload(properties: KiloPayload, event?: KiloPayload): KiloPayload {
    const details = payload(firstValue(properties?.permission, properties?.request, properties?.tool, properties?.input, event?.properties, properties));
    const rawTool = payload(firstValue(properties?.tool, details?.tool));
    const args = firstValue(properties?.args, properties?.input, details?.args, rawTool?.args, details?.input);
    return {
        permission_id: firstString(
            properties?.permissionID,
            properties?.permissionId,
            properties?.permission_id,
            properties?.id,
            details?.permissionID,
            details?.permissionId,
            details?.id,
        ),
        tool_name: firstString(properties?.toolName, properties?.tool_name, properties?.tool, rawTool?.name, rawTool?.id, details?.toolName, details?.name),
        tool_use_id: firstString(properties?.callID, properties?.callId, properties?.call_id, details?.callID, details?.callId),
        tool_input: args,
        permission_mode: firstString(properties?.permission, properties?.mode, properties?.permissionMode, details?.permission, details?.mode),
        raw_permission: properties,
    };
}

export const server = async (input: KiloPayload) => {
    const sessionStates = new Map<string, SessionRuntimeState>();
    let lastSessionID: string | undefined;

    function createSessionState(): SessionRuntimeState {
        return {
            started: false,
            creationObserved: false,
            launchedTaskCalls: new Set(),
            pendingTaskCalls: new Set(),
            pendingStopTurns: [],
            coalescedStopCount: 0,
        };
    }

    function createTurnState(model: string | undefined): TurnRuntimeState {
        return {
            model,
            nativeAgentMessageSeen: false,
            assistantMessages: new Map(),
            bufferedTextParts: new Map(),
            bufferedTextChars: 0,
            sentAgentMessages: new Set(),
            sentUsageMessages: new Set(),
        };
    }

    function isProtectedSessionState(state: SessionRuntimeState): boolean {
        return (
            state.activeTurn !== undefined ||
            state.stopInFlight !== undefined ||
            state.subagentLink !== undefined ||
            state.pendingTaskCalls.size > 0 ||
            state.launchedTaskCalls.size > 0 ||
            state.parentSessionID !== undefined
        );
    }

    function evictDormantSession(): boolean {
        for (const [sessionID, state] of sessionStates) {
            if (isProtectedSessionState(state)) continue;
            sessionStates.delete(sessionID);
            return true;
        }
        return false;
    }

    function evictOldestSession(): void {
        const oldest = sessionStates.keys().next().value;
        if (typeof oldest === "string") sessionStates.delete(oldest);
    }

    function sessionState(sessionID: string): SessionRuntimeState {
        const existing = sessionStates.get(sessionID);
        if (existing) {
            sessionStates.delete(sessionID);
            sessionStates.set(sessionID, existing);
            return existing;
        }
        while (sessionStates.size >= MAX_TRACKED_SESSIONS) {
            if (!evictDormantSession()) break;
        }
        if (sessionStates.size >= MAX_RETAINED_SESSIONS) evictOldestSession();
        const created = createSessionState();
        sessionStates.set(sessionID, created);
        return created;
    }

    function recordSessionModel(sessionID: string, model: unknown): void {
        if (!isNonEmptyString(model)) return;
        const state = sessionState(sessionID);
        state.model = model;
        if (state.activeTurn) state.activeTurn.model = model;
    }

    function markTurnOpen(sessionID: string): TurnRuntimeState {
        const state = sessionState(sessionID);
        if (!state.activeTurn) state.activeTurn = createTurnState(state.model);
        return state.activeTurn;
    }

    function rememberBounded(set: Set<string>, value: string): void {
        if (set.has(value)) set.delete(value);
        set.add(value);
        while (set.size > MAX_TRACKED_MESSAGES_PER_TURN) {
            const oldest = set.values().next().value;
            if (typeof oldest !== "string") break;
            set.delete(oldest);
        }
    }

    function recordMessageInfo(sessionID: string, rawInfo: unknown): void {
        const info = payload(rawInfo);
        const messageID = firstString(info.id, info.messageID, info.message_id);
        if (!messageID) return;
        if (info.role === "user") {
            markTurnOpen(sessionID);
            return;
        }
        if (info.role !== "assistant") return;
        const turn = markTurnOpen(sessionID);
        turn.assistantMessages.delete(messageID);
        turn.assistantMessages.set(messageID, {
            model: info.modelID ?? info.model?.modelID,
            provider: info.providerID ?? info.model?.providerID,
            timestamp: normalizeTimestamp(info.time?.completed ?? info.time?.created),
            usage: nativeMessageUsage(info),
        });
        while (turn.assistantMessages.size > MAX_TRACKED_MESSAGES_PER_TURN) {
            const oldest = turn.assistantMessages.keys().next().value;
            if (typeof oldest !== "string") break;
            turn.assistantMessages.delete(oldest);
        }
    }

    function bufferMessagePart(sessionID: string, rawPart: unknown): void {
        const part = payload(rawPart);
        if (!isTextPart(part) || part.synthetic) return;
        const messageID = firstString(part.messageID, part.message_id);
        const partID = firstString(part.id, part.partID, part.part_id);
        if (!messageID || !partID) return;
        const turn = markTurnOpen(sessionID);
        const key = messageID + ":" + partID;
        const existing = turn.bufferedTextParts.get(key);
        if (existing) {
            turn.bufferedTextChars -= existing.text.length;
            turn.bufferedTextParts.delete(key);
        }
        const normalized = part.text.trim();
        const text = normalized.slice(0, MAX_AGENT_MESSAGE_CHARS);
        if (text.length === 0) return;
        while (
            turn.bufferedTextParts.size > 0 &&
            (turn.bufferedTextParts.size >= MAX_BUFFERED_TEXT_PARTS_PER_TURN ||
                turn.bufferedTextChars + text.length > MAX_BUFFERED_TEXT_CHARS_PER_TURN)
        ) {
            const oldestKey = turn.bufferedTextParts.keys().next().value;
            if (typeof oldestKey !== "string") break;
            const removed = turn.bufferedTextParts.get(oldestKey);
            if (removed) turn.bufferedTextChars -= removed.text.length;
            turn.bufferedTextParts.delete(oldestKey);
        }
        turn.bufferedTextParts.set(key, { messageID, partID, text, originalLength: normalized.length });
        turn.bufferedTextChars += text.length;
    }

    async function emitAgentMessage(
        sessionID: string,
        turn: TurnRuntimeState,
        text: unknown,
        meta: Record<string, unknown> = {},
    ): Promise<void> {
        if (!isNonEmptyString(text)) return;
        const normalized = text.trim();
        const boundedText = normalized.slice(0, MAX_AGENT_MESSAGE_CHARS);
        const originalLength = typeof meta?.message_original_length === "number" && Number.isFinite(meta.message_original_length)
            ? Math.max(normalized.length, meta.message_original_length)
            : normalized.length;
        const messageID = meta?.messageID ?? meta?.message_id;
        const partID = meta?.partID ?? meta?.part_id;
        const key = isNonEmptyString(partID)
            ? sessionID + ":part:" + partID
            : isNonEmptyString(messageID)
              ? sessionID + ":message:" + messageID
              : sessionID + ":text:" + normalized.length + ":" + boundedText.slice(0, 1024);
        if (turn.sentAgentMessages.has(key)) return;
        rememberBounded(turn.sentAgentMessages, key);
        turn.nativeAgentMessageSeen = true;

        await postEvent("AgentMessage", {
            session_id: sessionID,
            text: boundedText,
            message_truncated: boundedText.length !== originalLength,
            message_original_length: originalLength,
            model: meta?.model ?? turn.model,
            provider: meta?.provider,
            message_index: meta?.message_index,
            message_timestamp: meta?.message_timestamp,
            tool_use_ids: meta?.tool_use_ids,
            agent: meta?.agent,
            usage: meta?.usage,
        });
        if (isNonEmptyString(messageID) && meta?.usage) rememberBounded(turn.sentUsageMessages, messageID);
    }

    async function flushAssistantMessages(sessionID: string, turn: TurnRuntimeState): Promise<void> {
        if (turn.nativeAgentMessageSeen) return;
        let index = 0;
        for (const part of turn.bufferedTextParts.values()) {
            const meta = turn.assistantMessages.get(part.messageID);
            if (!meta) continue;
            await emitAgentMessage(sessionID, turn, part.text, {
                messageID: part.messageID,
                partID: part.partID,
                model: meta.model,
                provider: meta.provider,
                message_index: index,
                message_timestamp: meta.timestamp,
                message_original_length: part.originalLength,
                usage: meta.usage,
            });
            index++;
        }
    }

    async function flushAssistantUsage(sessionID: string, turn: TurnRuntimeState): Promise<void> {
        for (const [messageID, meta] of turn.assistantMessages) {
            if (!meta.usage || turn.sentUsageMessages.has(messageID)) continue;
            rememberBounded(turn.sentUsageMessages, messageID);
            await postEvent("AgentUsage", {
                session_id: sessionID,
                message_id: messageID,
                model: meta.model ?? turn.model,
                provider: meta.provider,
                timestamp: meta.timestamp,
                usage: meta.usage,
            });
        }
    }

    function recordSessionParent(sessionID: string, parentSessionID: string | undefined): SessionRuntimeState {
        const state = sessionState(sessionID);
        if (parentSessionID && parentSessionID !== sessionID && !state.parentSessionID) {
            state.parentSessionID = parentSessionID;
        }
        return state;
    }

    async function ensureSessionStarted(sessionID: string): Promise<void> {
        const state = sessionState(sessionID);
        if (state.started) return;
        state.started = true;
        lastSessionID = sessionID;
        await postEvent("SessionStart", {
            session_id: sessionID,
            cwd: input.directory,
            project_dir: input.worktree || input.directory,
            client_source: "kilo",
            parent_session_id: state.parentSessionID,
        });
    }

    async function resolveAndStartSession(...values: unknown[]): Promise<string | undefined> {
        const sessionID = resolveSessionID(...values);
        if (!sessionID) return undefined;
        await ensureSessionStarted(sessionID);
        return sessionID;
    }

    async function drainStops(sessionID: string, state: SessionRuntimeState): Promise<void> {
        while (true) {
            const turn = state.pendingStopTurns.shift();
            if (turn) {
                await flushAssistantMessages(sessionID, turn);
                await flushAssistantUsage(sessionID, turn);
                await postEvent("Stop", { session_id: sessionID });
                continue;
            }
            if (state.coalescedStopCount > 0) {
                state.coalescedStopCount--;
                await postEvent("Stop", { session_id: sessionID, turn_snapshot_dropped: true });
                continue;
            }
            state.stopInFlight = undefined;
            return;
        }
    }

    function enqueueStop(sessionID: string, state: SessionRuntimeState, turn: TurnRuntimeState): Promise<void> {
        if (state.pendingStopTurns.length < MAX_PENDING_STOP_TURN_SNAPSHOTS) {
            state.pendingStopTurns.push(turn);
        } else {
            state.coalescedStopCount = Math.min(state.coalescedStopCount + 1, MAX_COALESCED_STOP_PLACEHOLDERS);
        }
        if (!state.stopInFlight) state.stopInFlight = drainStops(sessionID, state);
        return state.stopInFlight;
    }

    async function ensureSessionStopped(sessionID: string): Promise<void> {
        const state = sessionState(sessionID);
        const turn = state.activeTurn;
        let drain = state.stopInFlight;
        if (turn) {
            state.activeTurn = undefined;
            drain = enqueueStop(sessionID, state, turn);
        }
        if (drain) await drain;
    }

    async function endSession(sessionID: string): Promise<void> {
        const state = sessionStates.get(sessionID);
        if (!state?.started) return;
        state.started = false;
        await ensureSessionStopped(sessionID);
        await postEvent("SessionEnd", { session_id: sessionID });
        sessionStates.delete(sessionID);
        if (lastSessionID === sessionID) lastSessionID = undefined;
    }

    async function completeSubagent(childSessionID: string): Promise<void> {
        const state = sessionStates.get(childSessionID);
        const link = state?.subagentLink;
        if (!link) return;
        state.subagentLink = undefined;
        await postEvent("SubagentStop", {
            session_id: link.parentSessionID,
            parent_session_id: link.parentSessionID,
            agent_id: link.childSessionID,
            child_session_id: link.childSessionID,
            tool_use_id: link.toolUseID,
            agent_type: "task",
        });
    }

    async function startSubagent(parentSessionID: string, childSessionID: string, toolUseID: string): Promise<boolean> {
        if (parentSessionID === childSessionID) return false;
        const parentState = sessionState(parentSessionID);
        if (parentState.launchedTaskCalls.has(toolUseID)) return false;
        const state = sessionState(childSessionID);
        if (state.subagentLink) return false;
        rememberBounded(parentState.launchedTaskCalls, toolUseID);
        state.subagentLink = { parentSessionID, childSessionID, toolUseID };
        await postEvent("SubagentStart", {
            session_id: parentSessionID,
            parent_session_id: parentSessionID,
            agent_id: childSessionID,
            child_session_id: childSessionID,
            tool_use_id: toolUseID,
            agent_type: "task",
        });
        return true;
    }

    function resumedTaskSessionID(inp: KiloPayload, out: KiloPayload): string | undefined {
        const args = payload(firstValue(out?.args, inp?.args));
        return normalizeSessionID(args?.task_id);
    }

    function isIdleSessionEvent(type: unknown, properties: KiloPayload | undefined): boolean {
        if (type === "session.idle") return true;
        if (type !== "session.status") return false;
        const statusType = payload(properties?.status).type;
        return typeof statusType === "string" && statusType.trim().toLowerCase() === "idle";
    }

    return {
        async event(ev: KiloPayload) {
            const event = ev?.event;
            if (!event) return;
            const type = event?.type;
            const properties = event?.properties;
            if (type === "server.instance.disposed" || type === "session.deleted") {
                const sessionID = resolveSessionID(ev, event, properties) || lastSessionID;
                if (sessionID) {
                    await completeSubagent(sessionID);
                    await endSession(sessionID);
                }
                return;
            }
            if (type === "session.created") {
                const info = payload(properties?.info);
                const childSessionID = normalizeSessionID(info?.id);
                const parentSessionID = normalizeSessionID(info?.parentID ?? info?.parentId ?? info?.parent_id);
                if (childSessionID) {
                    const childState = recordSessionParent(childSessionID, parentSessionID);
                    if (!childState.creationObserved) {
                        childState.creationObserved = true;
                        const parentState = parentSessionID ? sessionStates.get(parentSessionID) : undefined;
                        const candidates = parentState?.pendingTaskCalls;
                        if (parentSessionID && childSessionID !== parentSessionID && candidates?.size === 1) {
                            const toolUseID = candidates.values().next().value;
                            if (typeof toolUseID === "string" && (await startSubagent(parentSessionID, childSessionID, toolUseID))) {
                                candidates.delete(toolUseID);
                            }
                        }
                    }
                }
            }
            if (isIdleSessionEvent(type, properties)) {
                const sessionID = (await resolveAndStartSession(ev, event, properties)) || lastSessionID;
                if (sessionID) {
                    await ensureSessionStopped(sessionID);
                    await completeSubagent(sessionID);
                }
                return;
            }
            const sessionID = (await resolveAndStartSession(ev, event, properties)) || lastSessionID;
            if (!sessionID) return;

            if (type === "message.updated") {
                recordMessageInfo(sessionID, properties?.info);
            }

            if (type === "message.part.updated") {
                bufferMessagePart(sessionID, properties?.part);
            }

            if (type === "session.next.text.ended") {
                if (isNonEmptyString(properties?.text)) {
                    const turn = markTurnOpen(sessionID);
                    await emitAgentMessage(sessionID, turn, properties.text, {
                        messageID: properties?.messageID,
                        partID: properties?.partID,
                        model: properties?.modelID ?? properties?.model?.modelID,
                        provider: properties?.providerID ?? properties?.model?.providerID,
                        message_timestamp: normalizeTimestamp(properties?.time?.completed ?? properties?.time?.created),
                    });
                }
            }

            if (type === "permission.asked") {
                markTurnOpen(sessionID);
                await postEvent("PermissionRequest", {
                    session_id: sessionID,
                    ...permissionPayload(payload(properties), event),
                });
            }

            if (type === "permission.replied") {
                markTurnOpen(sessionID);
                await postEvent("PermissionResult", {
                    session_id: sessionID,
                    decision: normalizePermissionDecision(
                        properties?.decision ?? properties?.status ?? properties?.result ?? properties?.response ?? properties?.action ?? properties?.choice,
                    ),
                    reason: firstString(properties?.reason, properties?.message, properties?.error),
                    ...permissionPayload(payload(properties), event),
                });
            }

        },

        async dispose() {
            const sessionIDs = [...sessionStates.keys()];
            for (const sessionID of sessionIDs) {
                await completeSubagent(sessionID);
            }
            for (const sessionID of sessionIDs) {
                await endSession(sessionID);
            }
            sessionStates.clear();
            lastSessionID = undefined;
        },

        async "chat.message"(inp: KiloPayload, out: KiloPayload) {
            const sessionID = await resolveAndStartSession(inp, out);
            if (!sessionID) return;
            recordSessionModel(sessionID, inp?.model?.modelID ?? out?.message?.model?.modelID);
            markTurnOpen(sessionID);
            await postEvent("UserPromptSubmit", {
                session_id: sessionID,
                prompt: extractTextFromParts(out?.parts) || out?.message?.content || "",
                agent: inp?.agent,
                model: inp?.model?.modelID,
                message_id: inp?.messageID ?? out?.message?.id,
            });
        },

        async "tool.execute.before"(inp: KiloPayload, out: KiloPayload) {
            const sessionID = await resolveAndStartSession(inp);
            if (!sessionID) return;
            markTurnOpen(sessionID);
            if (typeof inp?.tool === "string" && inp.tool.trim().toLowerCase() === "task" && isNonEmptyString(inp?.callID)) {
                const toolUseID = inp.callID.trim();
                const resumedChildSessionID = resumedTaskSessionID(inp, out);
                if (resumedChildSessionID) {
                    sessionState(sessionID).pendingTaskCalls.delete(toolUseID);
                    await startSubagent(sessionID, resumedChildSessionID, toolUseID);
                } else {
                    rememberBounded(sessionState(sessionID).pendingTaskCalls, toolUseID);
                }
            }
            await postEvent("PreToolUse", {
                session_id: sessionID,
                tool_name: inp?.tool,
                tool_use_id: inp?.callID,
                tool_input: out?.args ?? inp?.args,
                agent: inp?.agent,
            });
        },

        async "tool.execute.after"(inp: KiloPayload, out: KiloPayload) {
            const sessionID = await resolveAndStartSession(inp, out);
            if (!sessionID) return;
            const toolError = stringifyError(out?.error ?? out?.metadata?.error);
            markTurnOpen(sessionID);
            if (typeof inp?.tool === "string" && inp.tool.trim().toLowerCase() === "task" && isNonEmptyString(inp?.callID)) {
                sessionStates.get(sessionID)?.pendingTaskCalls.delete(inp.callID.trim());
            }
            await postEvent("PostToolUse", {
                session_id: sessionID,
                tool_name: inp?.tool,
                tool_use_id: inp?.callID,
                tool_input: inp?.args,
                tool_response: out?.output,
                is_error: Boolean(toolError ?? out?.isError ?? out?.metadata?.isError),
                tool_error: toolError,
                agent: inp?.agent,
            });
        },

        async "experimental.text.complete"(inp: KiloPayload, out: KiloPayload) {
            const sessionID = await resolveAndStartSession(inp, out);
            if (!sessionID) return;
            if (!isNonEmptyString(out?.text)) return;
            const turn = markTurnOpen(sessionID);
            await emitAgentMessage(sessionID, turn, out.text, {
                messageID: inp?.messageID,
                partID: inp?.partID,
            });
        },
    };
};
