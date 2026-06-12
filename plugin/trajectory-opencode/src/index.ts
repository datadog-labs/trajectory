const CAPTURE_URL = "http://localhost:19222/capture/opencode";
const POST_TIMEOUT_MS = 5000;
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
        await fetch(`${CAPTURE_URL}/${eventName}`, {
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

function extractToolUseIDs(parts: unknown): string[] | undefined {
    if (!Array.isArray(parts)) return undefined;
    const ids: string[] = [];
    for (const part of parts) {
        const item = payload(part);
        if (item.type === "tool" && isNonEmptyString(item.callID)) ids.push(item.callID);
    }
    return ids.length > 0 ? ids : undefined;
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

export const server = async (input: OpenCodePayload) => {
    const startedSessions = new Set<string>();
    const sessionsWithOpenTurn = new Set<string>();
    const sentAgentMessages = new Set<string>();
    const sessionModels = new Map<string, string>();
    let lastSessionID: string | undefined;

    function recordSessionModel(sessionID: string, model: unknown): void {
        if (isNonEmptyString(model)) sessionModels.set(sessionID, model);
    }

    function markTurnOpen(sessionID: string): void {
        sessionsWithOpenTurn.add(sessionID);
    }

    async function emitAgentMessage(sessionID: string, text: unknown, meta: Record<string, unknown> = {}): Promise<void> {
        if (!isNonEmptyString(text)) return;
        const messageID = meta?.messageID ?? meta?.message_id;
        const partID = meta?.partID ?? meta?.part_id;
        const key = isNonEmptyString(partID)
            ? `${sessionID}:part:${partID}`
            : isNonEmptyString(messageID)
              ? `${sessionID}:message:${messageID}`
              : `${sessionID}:text:${text}`;
        if (sentAgentMessages.has(key)) return;
        sentAgentMessages.add(key);
        markTurnOpen(sessionID);

        await postEvent("AgentMessage", {
            session_id: sessionID,
            text: text.trim(),
            model: meta?.model ?? sessionModels.get(sessionID),
            provider: meta?.provider,
            message_index: meta?.message_index,
            message_timestamp: meta?.message_timestamp,
            tool_use_ids: meta?.tool_use_ids,
            agent: meta?.agent,
        });
    }

    async function fetchSessionMessages(sessionID: string): Promise<OpenCodePayload[]> {
        const sessionAPI = input?.client?.session;
        if (typeof sessionAPI?.messages !== "function") return [];

        const attempts = [
            { path: { id: sessionID }, query: { directory: input.directory } },
            { path: { sessionID }, query: { directory: input.directory, workspace: input.worktree } },
        ];

        for (const options of attempts) {
            try {
                const response = await sessionAPI.messages(options);
                const data = Array.isArray(response) ? response : payload(response).data;
                if (Array.isArray(data)) return data as OpenCodePayload[];
            } catch {
                // Try the next SDK shape.
            }
        }
        return [];
    }

    async function flushAssistantMessages(sessionID: string): Promise<void> {
        const messages = await fetchSessionMessages(sessionID);
        for (let index = 0; index < messages.length; index++) {
            const message = messages[index];
            const info = message?.info ?? message?.message ?? message;
            if (info?.role !== "assistant") continue;
            const textParts = Array.isArray(message?.parts)
                ? message.parts.filter(isTextPart)
                : [];
            if (textParts.length === 0) continue;
            recordSessionModel(sessionID, info?.modelID ?? info?.model?.modelID);
            for (let partIndex = 0; partIndex < textParts.length; partIndex++) {
                const part = textParts[partIndex];
                await emitAgentMessage(sessionID, part.text, {
                    messageID: info?.id,
                    partID: part?.id ?? `${info?.id ?? `message-${index}`}:text:${partIndex}`,
                    model: info?.modelID ?? info?.model?.modelID,
                    provider: info?.providerID ?? info?.model?.providerID,
                    message_index: index,
                    message_timestamp: normalizeTimestamp(part?.time?.end ?? info?.time?.completed ?? info?.time?.created),
                    tool_use_ids: extractToolUseIDs(message?.parts),
                });
            }
        }
    }

    async function ensureSessionStarted(sessionID: string): Promise<void> {
        if (startedSessions.has(sessionID)) return;
        startedSessions.add(sessionID);
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
        if (!sessionsWithOpenTurn.has(sessionID)) return;
        await flushAssistantMessages(sessionID);
        sessionsWithOpenTurn.delete(sessionID);
        await postEvent("Stop", { session_id: sessionID });
    }

    return {
        async event(ev: OpenCodePayload) {
            const event = ev?.event;
            if (!event) return;
            const type = event?.type;
            const properties = event?.properties;
            const sessionID = (await resolveAndStartSession(ev, event, properties)) || lastSessionID;
            if (!sessionID) return;

            if (type === "session.next.text.ended") {
                await emitAgentMessage(sessionID, properties?.text, {
                    messageID: properties?.messageID,
                    partID: properties?.partID,
                    model: properties?.modelID ?? properties?.model?.modelID,
                    provider: properties?.providerID ?? properties?.model?.providerID,
                    message_timestamp: normalizeTimestamp(properties?.time?.completed ?? properties?.time?.created),
                });
            }

            if (type === "session.idle") {
                await ensureSessionStopped(sessionID);
            }
            if (type === "server.instance.disposed" || type === "session.deleted") {
                await ensureSessionStopped(sessionID);
                await postEvent("SessionEnd", { session_id: sessionID });
            }
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
