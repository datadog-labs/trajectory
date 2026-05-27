// Unless explicitly stated otherwise all files in this repository are licensed under the Apache-2.0 License.
// This product includes software developed at Datadog (https://www.datadoghq.com/) Copyright 2026 Datadog, Inc.

const CAPTURE_URL = "http://localhost:19222/capture/opencode";
const POST_TIMEOUT_MS = 5000;
const PLUGIN_PROVENANCE = {
    plugin: {
        id: "trajectory-opencode",
        version: "3.0.0",
        source_scope: "trajectory_plugin",
    },
};

function mergePluginProvenance(provenance: any): any {
    const plugin = provenance?.plugin;
    if (plugin && typeof plugin === "object" && !Array.isArray(plugin)) {
        if (typeof plugin.id === "string" && plugin.id !== "" && plugin.id !== PLUGIN_PROVENANCE.plugin.id) {
            return plugin;
        }
        return {
            ...PLUGIN_PROVENANCE.plugin,
            ...plugin,
        };
    }
    return {
        ...PLUGIN_PROVENANCE.plugin,
    };
}

function withPluginProvenance(data: any): any {
    const payload = data ?? {};
    const provenance = payload.provenance ?? {};
    return {
        ...payload,
        provenance: {
            ...PLUGIN_PROVENANCE,
            ...provenance,
            plugin: mergePluginProvenance(provenance),
        },
    };
}

async function postEvent(eventName: string, data: any): Promise<void> {
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

function normalizeSessionID(value: any): string | undefined {
    if (typeof value !== "string") return undefined;
    const sessionID = value.trim();
    if (!sessionID || sessionID === "unknown" || sessionID === "global") return undefined;
    return sessionID;
}

function resolveSessionID(...values: any[]): string | undefined {
    for (const value of values) {
        const direct = normalizeSessionID(value?.sessionID ?? value?.sessionId ?? value?.session_id);
        if (direct) return direct;

        const nested = normalizeSessionID(value?.session?.id ?? value?.event?.sessionID ?? value?.event?.sessionId ?? value?.event?.session_id);
        if (nested) return nested;
    }
    return undefined;
}

export const server = async (input: any) => {
    const startedSessions = new Set<string>();
    const stoppedSessions = new Set<string>();
    let lastSessionID: string | undefined;

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

    async function resolveAndStartSession(...values: any[]): Promise<string | undefined> {
        const sessionID = resolveSessionID(...values);
        if (!sessionID) return undefined;
        await ensureSessionStarted(sessionID);
        return sessionID;
    }

    async function ensureSessionStopped(sessionID: string): Promise<void> {
        if (stoppedSessions.has(sessionID)) return;
        stoppedSessions.add(sessionID);
        await postEvent("Stop", { session_id: sessionID });
    }

    return {
        async event(ev: any) {
            const event = ev?.event;
            if (!event) return;
            const type = event?.type;
            const sessionID = await resolveAndStartSession(ev, event) || lastSessionID;
            if (!sessionID) return;
            // session.idle = agent finished responding = turn end
            if (type === "session.idle") {
                await ensureSessionStopped(sessionID);
            }
            // server shutdown = session end
            if (type === "server.instance.disposed" || type === "session.deleted") {
                await ensureSessionStopped(sessionID);
                await postEvent("SessionEnd", { session_id: sessionID });
            }
        },

        async "chat.message"(inp: any, out: any) {
            const sessionID = await resolveAndStartSession(inp, out);
            if (!sessionID) return;
            await postEvent("UserPromptSubmit", {
                session_id: sessionID,
                prompt: out?.message?.content || "",
                agent: inp?.agent,
                model: inp?.model?.modelID,
            });
        },

        async "tool.execute.before"(inp: any) {
            const sessionID = await resolveAndStartSession(inp);
            if (!sessionID) return;
            await postEvent("PreToolUse", {
                session_id: sessionID,
                tool_name: inp?.tool,
                tool_use_id: inp?.callID,
                agent: inp?.agent,
            });
        },

        async "tool.execute.after"(inp: any, out: any) {
            const sessionID = await resolveAndStartSession(inp, out);
            if (!sessionID) return;
            await postEvent("PostToolUse", {
                session_id: sessionID,
                tool_name: inp?.tool,
                tool_use_id: inp?.callID,
                output: out?.output,
                agent: inp?.agent,
            });
        },
    };
};
