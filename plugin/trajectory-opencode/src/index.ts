const CAPTURE_URL = "http://localhost:19222/capture/opencode";
const POST_TIMEOUT_MS = 5000;
const MAX_TRACKED_SESSIONS = 128;
const MAX_TRACKED_MESSAGES_PER_TURN = 128;
const MAX_BUFFERED_TEXT_PARTS_PER_TURN = 64;
const MAX_BUFFERED_TEXT_CHARS_PER_TURN = 1024 * 1024;
const MAX_AGENT_MESSAGE_CHARS = 256 * 1024;
const PLUGIN_PROVENANCE = {
    plugin: {
        id: "trajectory-opencode",
        version: "3.0.0",
        source_scope: "trajectory_plugin",
    },
};

interface OpenCodePayload extends Record<string, unknown> {
    sessionID?: unknown;
    sessionId?: unknown;
    session_id?: unknown;
    session?: OpenCodePayload;
    event?: OpenCodePayload;
    properties?: OpenCodePayload;
    part?: OpenCodePayload;
    info?: OpenCodePayload;
    message?: OpenCodePayload;
    model?: OpenCodePayload;
    metadata?: OpenCodePayload;
    time?: OpenCodePayload;
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
    turnOpen: boolean;
    nativeAgentMessageSeen: boolean;
    model?: string;
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

function payload(value: unknown): OpenCodePayload {
    return (value ?? {}) as OpenCodePayload;
}

function isTextPart(value: unknown): value is OpenCodePayload & { text: string } {
    const part = payload(value);
    return part.type === "text" && typeof part.text === "string";
}

function mergePluginProvenance(provenance: OpenCodePayload): OpenCodePayload {
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

function withPluginProvenance(data: unknown): OpenCodePayload {
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

function permissionPayload(properties: OpenCodePayload, event?: OpenCodePayload): OpenCodePayload {
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

export const server = async (input: OpenCodePayload) => {
    const sessionStates = new Map<string, SessionRuntimeState>();
    const pendingTaskCalls = new Map<string, Set<string>>();
    const subagentLinks = new Map<string, SubagentLink>();
    let lastSessionID: string | undefined;

    function createSessionState(): SessionRuntimeState {
        return {
            started: false,
            turnOpen: false,
            nativeAgentMessageSeen: false,
            assistantMessages: new Map(),
            bufferedTextParts: new Map(),
            bufferedTextChars: 0,
            sentAgentMessages: new Set(),
            sentUsageMessages: new Set(),
        };
    }

    function sessionState(sessionID: string): SessionRuntimeState {
        const existing = sessionStates.get(sessionID);
        if (existing) {
            sessionStates.delete(sessionID);
            sessionStates.set(sessionID, existing);
            return existing;
        }
        while (sessionStates.size >= MAX_TRACKED_SESSIONS) {
            const oldest = sessionStates.keys().next().value;
            if (typeof oldest !== "string") break;
            sessionStates.delete(oldest);
        }
        const created = createSessionState();
        sessionStates.set(sessionID, created);
        return created;
    }

    function resetTurnState(state: SessionRuntimeState): void {
        state.nativeAgentMessageSeen = false;
        state.assistantMessages.clear();
        state.bufferedTextParts.clear();
        state.bufferedTextChars = 0;
        state.sentAgentMessages.clear();
        state.sentUsageMessages.clear();
    }

    function recordSessionModel(sessionID: string, model: unknown): void {
        if (isNonEmptyString(model)) sessionState(sessionID).model = model;
    }

    function markTurnOpen(sessionID: string): void {
        const state = sessionState(sessionID);
        if (!state.turnOpen) resetTurnState(state);
        state.turnOpen = true;
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
        const state = sessionState(sessionID);
        if (info.role === "user") {
            markTurnOpen(sessionID);
            return;
        }
        if (info.role !== "assistant") return;
        state.assistantMessages.delete(messageID);
        state.assistantMessages.set(messageID, {
            model: info.modelID ?? info.model?.modelID,
            provider: info.providerID ?? info.model?.providerID,
            timestamp: normalizeTimestamp(info.time?.completed ?? info.time?.created),
            usage: nativeMessageUsage(info),
        });
        while (state.assistantMessages.size > MAX_TRACKED_MESSAGES_PER_TURN) {
            const oldest = state.assistantMessages.keys().next().value;
            if (typeof oldest !== "string") break;
            state.assistantMessages.delete(oldest);
        }
    }

    function bufferMessagePart(sessionID: string, rawPart: unknown): void {
        const part = payload(rawPart);
        if (!isTextPart(part) || part.synthetic) return;
        const messageID = firstString(part.messageID, part.message_id);
        const partID = firstString(part.id, part.partID, part.part_id);
        if (!messageID || !partID) return;
        markTurnOpen(sessionID);
        const state = sessionState(sessionID);
        const key = messageID + ":" + partID;
        const existing = state.bufferedTextParts.get(key);
        if (existing) {
            state.bufferedTextChars -= existing.text.length;
            state.bufferedTextParts.delete(key);
        }
        const normalized = part.text.trim();
        const text = normalized.slice(0, MAX_AGENT_MESSAGE_CHARS);
        if (text.length === 0) return;
        while (
            state.bufferedTextParts.size > 0 &&
            (state.bufferedTextParts.size >= MAX_BUFFERED_TEXT_PARTS_PER_TURN ||
                state.bufferedTextChars + text.length > MAX_BUFFERED_TEXT_CHARS_PER_TURN)
        ) {
            const oldestKey = state.bufferedTextParts.keys().next().value;
            if (typeof oldestKey !== "string") break;
            const removed = state.bufferedTextParts.get(oldestKey);
            if (removed) state.bufferedTextChars -= removed.text.length;
            state.bufferedTextParts.delete(oldestKey);
        }
        state.bufferedTextParts.set(key, { messageID, partID, text, originalLength: normalized.length });
        state.bufferedTextChars += text.length;
    }

    async function emitAgentMessage(sessionID: string, text: unknown, meta: Record<string, unknown> = {}): Promise<void> {
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
        markTurnOpen(sessionID);
        const state = sessionState(sessionID);
        if (state.sentAgentMessages.has(key)) return;
        rememberBounded(state.sentAgentMessages, key);
        state.nativeAgentMessageSeen = true;

        await postEvent("AgentMessage", {
            session_id: sessionID,
            text: boundedText,
            message_truncated: boundedText.length !== originalLength,
            message_original_length: originalLength,
            model: meta?.model ?? state.model,
            provider: meta?.provider,
            message_index: meta?.message_index,
            message_timestamp: meta?.message_timestamp,
            tool_use_ids: meta?.tool_use_ids,
            agent: meta?.agent,
            usage: meta?.usage,
        });
        if (isNonEmptyString(messageID) && meta?.usage) rememberBounded(state.sentUsageMessages, messageID);
    }

    async function flushAssistantMessages(sessionID: string): Promise<void> {
        const state = sessionState(sessionID);
        if (state.nativeAgentMessageSeen) return;
        let index = 0;
        for (const part of state.bufferedTextParts.values()) {
            const meta = state.assistantMessages.get(part.messageID);
            if (!meta) continue;
            await emitAgentMessage(sessionID, part.text, {
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

    async function flushAssistantUsage(sessionID: string): Promise<void> {
        const state = sessionState(sessionID);
        for (const [messageID, meta] of state.assistantMessages) {
            if (!meta.usage || state.sentUsageMessages.has(messageID)) continue;
            rememberBounded(state.sentUsageMessages, messageID);
            await postEvent("AgentUsage", {
                session_id: sessionID,
                message_id: messageID,
                model: meta.model ?? state.model,
                provider: meta.provider,
                timestamp: meta.timestamp,
                usage: meta.usage,
            });
        }
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
            client_source: "opencode",
        });
    }

    async function resolveAndStartSession(...values: unknown[]): Promise<string | undefined> {
        const sessionID = resolveSessionID(...values);
        if (!sessionID) return undefined;
        await ensureSessionStarted(sessionID);
        return sessionID;
    }

    async function ensureSessionStopped(sessionID: string): Promise<void> {
        const state = sessionState(sessionID);
        if (!state.turnOpen) return;
        await flushAssistantMessages(sessionID);
        await flushAssistantUsage(sessionID);
        state.turnOpen = false;
        resetTurnState(state);
        await postEvent("Stop", { session_id: sessionID });
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
        const link = subagentLinks.get(childSessionID);
        if (!link) return;
        subagentLinks.delete(childSessionID);
        await postEvent("SubagentStop", {
            session_id: link.parentSessionID,
            parent_session_id: link.parentSessionID,
            agent_id: link.childSessionID,
            child_session_id: link.childSessionID,
            tool_use_id: link.toolUseID,
            agent_type: "task",
        });
    }

    return {
        async event(ev: OpenCodePayload) {
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
                const candidates = parentSessionID ? pendingTaskCalls.get(parentSessionID) : undefined;
                if (childSessionID && parentSessionID && childSessionID !== parentSessionID && candidates?.size === 1) {
                    const toolUseID = candidates.values().next().value;
                    if (typeof toolUseID === "string") {
                        candidates.delete(toolUseID);
                        if (candidates.size === 0) pendingTaskCalls.delete(parentSessionID);
                        subagentLinks.set(childSessionID, { parentSessionID, childSessionID, toolUseID });
                        await postEvent("SubagentStart", {
                            session_id: parentSessionID,
                            parent_session_id: parentSessionID,
                            agent_id: childSessionID,
                            child_session_id: childSessionID,
                            tool_use_id: toolUseID,
                            agent_type: "task",
                        });
                    }
                }
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
                await emitAgentMessage(sessionID, properties?.text, {
                    messageID: properties?.messageID,
                    partID: properties?.partID,
                    model: properties?.modelID ?? properties?.model?.modelID,
                    provider: properties?.providerID ?? properties?.model?.providerID,
                    message_timestamp: normalizeTimestamp(properties?.time?.completed ?? properties?.time?.created),
                });
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

            if (type === "session.idle") {
                await ensureSessionStopped(sessionID);
                await completeSubagent(sessionID);
            }
        },

        async dispose() {
            for (const sessionID of [...sessionStates.keys()]) {
                await endSession(sessionID);
            }
            sessionStates.clear();
            lastSessionID = undefined;
        },

        async "chat.message"(inp: OpenCodePayload, out: OpenCodePayload) {
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

        async "tool.execute.before"(inp: OpenCodePayload, out: OpenCodePayload) {
            const sessionID = await resolveAndStartSession(inp);
            if (!sessionID) return;
            markTurnOpen(sessionID);
            if (typeof inp?.tool === "string" && inp.tool.trim().toLowerCase() === "task" && isNonEmptyString(inp?.callID)) {
                const calls = pendingTaskCalls.get(sessionID) ?? new Set<string>();
                rememberBounded(calls, inp.callID.trim());
                pendingTaskCalls.set(sessionID, calls);
            }
            await postEvent("PreToolUse", {
                session_id: sessionID,
                tool_name: inp?.tool,
                tool_use_id: inp?.callID,
                tool_input: out?.args ?? inp?.args,
                agent: inp?.agent,
            });
        },

        async "tool.execute.after"(inp: OpenCodePayload, out: OpenCodePayload) {
            const sessionID = await resolveAndStartSession(inp, out);
            if (!sessionID) return;
            const toolError = stringifyError(out?.error ?? out?.metadata?.error);
            markTurnOpen(sessionID);
            if (typeof inp?.tool === "string" && inp.tool.trim().toLowerCase() === "task" && isNonEmptyString(inp?.callID)) {
                const calls = pendingTaskCalls.get(sessionID);
                calls?.delete(inp.callID.trim());
                if (calls?.size === 0) pendingTaskCalls.delete(sessionID);
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

        async "experimental.text.complete"(inp: OpenCodePayload, out: OpenCodePayload) {
            const sessionID = await resolveAndStartSession(inp, out);
            if (!sessionID) return;
            await emitAgentMessage(sessionID, out?.text, {
                messageID: inp?.messageID,
                partID: inp?.partID,
            });
        },
    };
};
