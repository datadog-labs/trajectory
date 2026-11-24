import { realpathSync } from "node:fs";
import { types } from "node:util";
import { server, createCaptureRuntime, type OpenCodePayload } from "./src/capture-runtime.ts";
import { MAX_CAPTURE_BYTES, snapshotCapturePayload } from "./src/capture-queue.ts";

interface Registration { dispose(): Promise<void> | void }
interface Context {
    app: { version: string };
    location: { directory: string; project: { directory: string } };
    event: { subscribe(options: { signal: AbortSignal }): AsyncIterable<unknown> };
    // Resolves with the session's public info, whose `location` names only
    // its directory. Rejects when no session has the ID.
    session: { get(input: { sessionID: string }): Promise<unknown> };
    tool: { hook(name: "execute.before" | "execute.after", callback: (event: unknown) => Promise<void>): Promise<Registration> };
}

// Read only selected native fields. In particular, accepted prompts can include
// multi-megabyte attachments that are outside the text capture contract.
function field(value: unknown, name: string): unknown {
    if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if (descriptor && !("value" in descriptor)) throw new Error("capture field is an accessor");
    return descriptor?.value;
}

function identifier(value: unknown): string | undefined {
    if (typeof value !== "string" || !value || value.length > 512) return undefined;
    return value;
}

// The service tier the provider applied, in the runtime's `info.native` shape.
// OpenCode 2.1 names step-level native data `native`; 2.0 called it
// `providerState`. A blank tier names none, so the other field is read.
function native(data: unknown): { serviceTier: string } | undefined {
    for (const name of ["native", "providerState"]) {
        const serviceTier = field(field(data, name), "serviceTier");
        if (typeof serviceTier === "string" && serviceTier.trim() !== "") return { serviceTier };
    }
    return undefined;
}

// The event stream is OpenCode's in-process bus, so a new subscription
// normally works at once. Waits start short and stop growing at the cap; the
// loop then keeps resubscribing at the cap until OpenCode unloads the plugin.
const RESUBSCRIBE_MIN_MS = 100;
const RESUBSCRIBE_MAX_MS = 30_000;

// Tool calls whose start, completion, or name the adapter remembers, per set.
// The oldest entry is dropped first.
const MAX_TRACKED_CALLS = 1024;
// Code Mode calls of one `execute` call that have started and not ended.
const MAX_OPEN_NESTED_CALLS = 64;
// Queued prompts held until OpenCode delivers or cancels them.
const MAX_HELD_PROMPTS = 64;
const MAX_HELD_PROMPT_CHARS = MAX_CAPTURE_BYTES;
// Sessions whose latest agent and model the adapter remembers.
const MAX_TRACKED_SELECTIONS = 1024;
// Directories whose canonical path the adapter remembers.
const MAX_CANONICAL_DIRECTORIES = 64;
const MAX_DIRECTORY_CHARS = 4096;
// Sessions the adapter knows to be in this directory or another one.
const MAX_TRACKED_OWNERS = 1024;
// How long an event waits for OpenCode to name its session's directory.
const SESSION_LOOKUP_TIMEOUT_MS = 5_000;
// The tool name of a call whose native name never arrived. Trajectory's
// OpenCode permission records use the same placeholder.
const UNKNOWN_TOOL_NAME = "unknown";

// A copy that does not keep a larger source string alive.
function own(value: string): string {
    return Buffer.from(value, "utf16le").toString("utf16le");
}

// Tool content parts read per result, and characters kept from a part's mime
// type or name.
const MAX_CONTENT_PARTS = 256;
const MAX_CONTENT_LABEL_CHARS = 128;

// A tool result's content as text. OpenCode 2 gives `{ type: "text", text }`
// and `{ type: "file", uri, mime, name? }` parts; a file's uri can be a
// base64 data URI. Join text parts with a newline and stand in for each file
// with a marker that never carries the uri. A string passes through.
// `partial` says the text stops early: parts were left unread or a text was
// cut at the character cap.
function contentText(content: unknown): { text: unknown; partial: boolean } {
    if (typeof content === "string" || !Array.isArray(content) || types.isProxy(content)) return { text: content, partial: false };
    const parts: string[] = [];
    let chars = 0;
    let partial = false;
    let index = 0;
    for (; index < Math.min(content.length, MAX_CONTENT_PARTS) && chars <= MAX_CAPTURE_BYTES; index++) {
        const descriptor = Object.getOwnPropertyDescriptor(content, String(index));
        const part = descriptor && "value" in descriptor ? descriptor.value : undefined;
        const kind = field(part, "type");
        let text: string | undefined;
        if (kind === "text") {
            const value = field(part, "text");
            if (typeof value === "string") {
                text = value.slice(0, MAX_CAPTURE_BYTES);
                if (text.length < value.length) partial = true;
            }
        } else if (kind === "file") {
            const label = [field(part, "mime"), field(part, "name")]
                .filter((item): item is string => typeof item === "string" && item !== "")
                .map((item) => item.slice(0, MAX_CONTENT_LABEL_CHARS));
            text = `[file${label.length ? `: ${label.join(" ")}` : ""}]`;
        }
        if (text === undefined) continue;
        parts.push(text);
        chars += text.length;
    }
    return { text: own(parts.join("\n")), partial: partial || index < content.length };
}

// A result's text: a string `output` when the tool declared one, else content.
function resultText(result: unknown): { text: unknown; partial: boolean } {
    const output = field(result, "output");
    return typeof output === "string" ? { text: output, partial: false } : contentText(field(result, "content"));
}

function callKey(sessionID: string, id: string): string {
    return own(`${sessionID}\n${id}`);
}

// Add a key, dropping the oldest entries over the limit.
function remember<V>(map: Map<string, V>, key: string, value: V, limit: number): void {
    map.delete(key);
    map.set(key, value);
    while (map.size > limit) map.delete(map.keys().next().value!);
}

function forgetSession(map: Map<string, unknown>, sessionID: string): void {
    const prefix = `${sessionID}\n`;
    for (const key of [...map.keys()]) if (key.startsWith(prefix)) map.delete(key);
}

// The same directory can arrive under two spellings, such as /tmp and
// /private/tmp on macOS. A path that cannot be resolved, for example one
// already removed, is compared as written.
function canonicalDirectory(directory: string): string {
    try { return realpathSync.native(directory); } catch { return directory; }
}

interface HeldPrompt { sessionID: string; inboxID: string; text?: string; lost?: boolean }
// The Code Mode calls of one `execute` call: how many have started, and the
// tool and derived ID of each that has not ended, oldest first.
interface NestedCalls { count: number; open: { tool: string; id: string }[] }
interface Selection { agent?: string; model?: string }

async function setup(ctx: Context) {
    const capture = await createCaptureRuntime({
        directory: ctx.location.directory,
        worktree: ctx.location.project.directory,
        client_version: ctx.app.version,
    }, { closeSessionsOnDispose: false, taskToolName: "subagent", assistantTextMetadata: true });
    const controller = new AbortController();
    const registrations: Registration[] = [];
    let closing = false;
    let handling: Promise<void> | undefined;
    let cleanup: Promise<void> | undefined;
    // Calls whose PreToolUse was posted and that have not completed, with
    // the tool each started as. The stream does not name a hosted call's
    // tool when it has no input event: its name is "".
    const started = new Map<string, string>();
    // In OpenCode 2's Code Mode, the model's `execute` call runs other tools,
    // by default every MCP tool. Their hooks carry the `execute` call's ID,
    // and the event stream reports only the `execute` call. A hook for a
    // tool other than the one its ID started as is such an inner call. It
    // gets the ID `${id}/${n}`, as OpenCode 1 gives its Code Mode calls, so
    // the outer call keeps the bare ID for both sources. Kept by outer call.
    const nested = new Map<string, NestedCalls>();
    // Calls completed by one source, the tool hook or the event stream. The
    // other source finds the call here and posts nothing.
    const completed = new Map<string, true>();
    // Tool names from session.tool.input.started. Stream completions have none.
    const toolNames = new Map<string, string>();
    // The tool a stream-only call posts as. Only session.tool.input.started
    // names a call's tool, and a call can end without it, as a hosted call
    // or an interrupted one can. Trajectory skips a tool record without a name.
    const streamToolName = (key: string): string => toolNames.get(key) || started.get(key) || UNKNOWN_TOOL_NAME;
    // Queued prompts by inbox ID, held until delivery or cancellation.
    const prompts = new Map<string, HeldPrompt>();
    let heldPromptChars = 0;
    const ownDirectory = canonicalDirectory(ctx.location.directory);
    const canonical = new Map<string, string>();
    const isOwnDirectory = (directory: unknown): boolean => {
        if (directory === ctx.location.directory) return true;
        if (typeof directory !== "string" || !directory || directory.length > MAX_DIRECTORY_CHARS) return false;
        let resolved = canonical.get(directory);
        if (resolved === undefined) {
            resolved = canonicalDirectory(directory);
            remember(canonical, own(directory), own(resolved), MAX_CANONICAL_DIRECTORIES);
        }
        return resolved === ownDirectory;
    };
    // OpenCode 2 runs one plugin per open directory, and each plugin's event
    // stream carries every directory's events. Events from process-wide
    // services, such as the inbox and execution events, name no location.
    // Each session is this directory's (true) or another one's (false), as
    // its latest event with a location, its last move, or OpenCode's session
    // record says. A stream gap can hide a move, so a gap clears it.
    const owners = new Map<string, boolean>();
    // OpenCode's record of a session, or undefined when the lookup fails,
    // times out, or the plugin closes.
    const lookupSession = (sessionID: string) => new Promise<unknown>((resolve) => {
        const finish = (found?: unknown) => {
            clearTimeout(timer);
            controller.signal.removeEventListener("abort", abandon);
            resolve(found);
        };
        const abandon = () => finish(undefined);
        const timer = setTimeout(abandon, SESSION_LOOKUP_TIMEOUT_MS);
        timer.unref?.();
        controller.signal.addEventListener("abort", abandon, { once: true });
        if (controller.signal.aborted) { abandon(); return; }
        Promise.resolve().then(() => ctx.session.get({ sessionID })).then(finish, abandon);
    });
    // A session that fails the lookup is treated as another directory's
    // for this event and is looked up again on its next one. Posting
    // another directory's prompt and Stop would record a turn twice, once
    // under the wrong directory. Dropping the event loses part of the
    // turn, so the session's turn is marked partial.
    const isOwnSession = async (sessionID: string): Promise<boolean> => {
        const known = owners.get(sessionID);
        if (known !== undefined) return known;
        let directory: unknown;
        try { directory = field(field(await lookupSession(sessionID), "location"), "directory"); } catch { directory = undefined; }
        if (typeof directory !== "string") {
            await capture.incomplete({ sessionID });
            return false;
        }
        const ours = isOwnDirectory(directory);
        await settleOwner(sessionID, ours);
        return ours;
    };
    // The attempt OpenCode retries each model call under, by message. A retry
    // reuses the call's message ID, so each attempt gets its own request.
    const attempts = new Map<string, number>();
    // The latest agent and model per session. OpenCode 2 sends them on
    // selection events, not with the prompt. A session that existed before
    // the plugin loaded, or that kept its default agent, may never send one;
    // a step's agent and model fill in for later prompts. A step never
    // replaces a selection: a step still running can predate a newer one.
    const selections = new Map<string, Selection>();
    const select = (sessionID: string, agent: unknown, model: unknown, fill = false) => {
        const current = selections.get(sessionID) ?? {};
        const name = fill && current.agent ? undefined : identifier(agent);
        const modelID = fill && current.model ? undefined : identifier(field(model, "id"));
        if (!name && !modelID) return;
        remember(selections, own(sessionID), {
            agent: name ? own(name) : current.agent,
            model: modelID ? own(modelID) : current.model,
        }, MAX_TRACKED_SELECTIONS);
    };
    const releasePrompt = (key: string): HeldPrompt | undefined => {
        const held = prompts.get(key);
        if (!held) return undefined;
        prompts.delete(key);
        heldPromptChars -= held.text?.length ?? 0;
        return held;
    };
    const releaseSession = (sessionID: string) => {
        for (const map of [started, nested, completed, toolNames, attempts]) forgetSession(map, sessionID);
        selections.delete(sessionID);
        const prefix = `${sessionID}\n`;
        for (const key of [...prompts.keys()]) if (key.startsWith(prefix)) releasePrompt(key);
    };
    // Record where a session is. A session that becomes another directory's,
    // by a move or by a refresh after a stream gap, ends its open turn here
    // as partial, along with its subagent link.
    const settleOwner = async (sessionID: string, ours: boolean): Promise<void> => {
        const known = owners.get(sessionID);
        remember(owners, own(sessionID), ours, MAX_TRACKED_OWNERS);
        if (ours || known === false) return;
        releaseSession(sessionID);
        await capture.release({ sessionID });
    };
    const close = (): Promise<void> => cleanup ??= (async () => {
        closing = true;
        controller.abort();
        // Registrations normally belong to the host scope. Dispose them here
        // too so partial setup failure cannot leave capture hooks registered.
        await Promise.allSettled(registrations.map((registration) => Promise.resolve().then(() => registration.dispose())));
        // Finish the event being handled before the runtime closes. Do not
        // wait for the loop itself: a pending native read may never settle.
        await handling;
        for (const map of [started, nested, completed, toolNames, prompts, selections, attempts, canonical, owners]) map.clear();
        heldPromptChars = 0;
        await capture.dispose();
    })();

    // A callback failed. Mark its session's turn partial. Before its session
    // is known, mark only the next turn to open, not every session's turn.
    const markLoss = (sessionID: string | undefined): Promise<void> =>
        sessionID ? capture.incomplete({ sessionID }) : capture.unassignedLoss();

    const tool = (after: boolean) => async (raw: unknown): Promise<void> => {
        if (closing) return;
        let sessionID: string | undefined;
        try {
            sessionID = identifier(field(raw, "sessionID"));
            if (!sessionID) return;
            let callID = field(raw, "id");
            // The event stream can also report this call's start or end.
            // Whichever source is first posts it, and only once.
            const id = identifier(callID);
            if (id) {
                const key = callKey(sessionID, id);
                const name = identifier(field(raw, "tool")) ?? "";
                const calls = nested.get(key);
                if (!after) {
                    const outer = started.get(key);
                    if (outer === undefined) remember(started, key, own(name), MAX_TRACKED_CALLS);
                    else if (outer === name) return;
                    else {
                        const state = calls ?? { count: 0, open: [] };
                        const derived = own(`${id}/${++state.count}`);
                        callID = derived;
                        state.open.push({ tool: own(name), id: derived });
                        if (!calls) remember(nested, key, state, MAX_TRACKED_CALLS);
                        // Over the limit, the oldest open call can no longer
                        // end, so its turn is partial.
                        if (state.open.length > MAX_OPEN_NESTED_CALLS) {
                            state.open.shift();
                            await capture.incomplete({ sessionID });
                        }
                    }
                } else {
                    // An inner call ends the oldest open inner call of its
                    // tool: a hook names no more than the tool and outer ID.
                    const index = calls ? calls.open.findIndex((call) => call.tool === name) : -1;
                    if (calls && index >= 0) {
                        callID = calls.open[index]!.id;
                        calls.open.splice(index, 1);
                    } else {
                        if (completed.delete(key)) return;
                        remember(completed, key, true, MAX_TRACKED_CALLS);
                        started.delete(key);
                        toolNames.delete(key);
                        nested.delete(key);
                        // An inner call still open when its `execute` call
                        // ends can no longer end, so its turn is partial.
                        if (calls?.open.length) await capture.incomplete({ sessionID });
                    }
                }
            }
            const input = {
                sessionID,
                tool: field(raw, "tool"),
                callID,
                agent: field(raw, "agent"),
                args: field(raw, "input"),
            };
            if (!after) {
                await capture.beforeTool(input, { args: input.args });
            } else {
                const result = field(raw, "result");
                // Native failures are Error instances; select their message
                // before the runtime's plain-JSON snapshot admission.
                const failure = field(raw, "error");
                const output = resultText(result);
                await capture.afterTool(input, {
                    output: output.text,
                    metadata: field(result, "metadata"),
                    error: typeof failure === "string" ? failure : failure == null ? undefined : { message: field(failure, "message") },
                    isError: field(raw, "status") === "error",
                });
                if (output.partial) await capture.incomplete({ sessionID });
            }
        } catch { await markLoss(sessionID); }
    };

    const event = async (raw: unknown): Promise<void> => {
        let sessionID: string | undefined;
        try {
            const type = field(raw, "type");
            const data = field(raw, "data");
            sessionID = identifier(field(data, "sessionID"));
            if (!sessionID) return;
            // OpenCode sends a move to the session's old and new directories.
            // Moved away, its later work belongs to the other directory's
            // plugin: end the open turn here as partial.
            if (type === "session.moved") {
                await settleOwner(sessionID, isOwnDirectory(field(field(data, "location"), "directory")));
                return;
            }
            const location = field(raw, "location") ?? (type === "session.created" ? field(data, "location") : undefined);
            const directory = field(location, "directory");
            if (directory !== undefined) {
                const ours = isOwnDirectory(directory);
                await settleOwner(sessionID, ours);
                if (!ours) return;
            } else if (type === "session.deleted") {
                // A deleted session has no record to look up. Forgetting a
                // session this plugin never captured does nothing.
                if (owners.get(sessionID) === false) { owners.delete(sessionID); return; }
            } else if (!await isOwnSession(sessionID)) return;
            const emit = (type: string, properties: OpenCodePayload = {}) => capture.event({ event: { type, properties: { ...properties, sessionID } } });
            const nativeMessageID = identifier(field(data, "assistantMessageID"));
            const attempt = nativeMessageID ? attempts.get(callKey(sessionID, nativeMessageID)) : undefined;
            const messageID = nativeMessageID && attempt ? `${nativeMessageID}#${attempt}` : nativeMessageID;
            const ordinal = field(data, "ordinal");
            const partID = messageID && Number.isSafeInteger(ordinal) && Number(ordinal) >= 0 ? `${messageID}:${ordinal}` : undefined;
            switch (type) {
                case "session.created":
                    select(sessionID, field(data, "agent"), field(data, "model"));
                    await emit("session.created", { info: { id: sessionID, parentID: field(data, "parentID") } });
                    break;
                case "session.agent.selected":
                    select(sessionID, field(data, "agent"), undefined);
                    break;
                case "session.model.selected":
                    select(sessionID, undefined, field(data, "model"));
                    break;
                // This is published after prompt preparation and admission.
                // The prompt hook runs earlier and can still be rejected. A
                // prompt sent while the agent is busy waits in the inbox, so
                // hold its text until OpenCode delivers or cancels it.
                case "session.inbox.enqueued": {
                    const item = field(data, "item");
                    if (field(item, "type") !== "user") break;
                    const inboxID = identifier(field(data, "inboxID"));
                    if (!inboxID) throw new Error("queued prompt has no identity");
                    const key = callKey(sessionID, inboxID);
                    releasePrompt(key);
                    const text = field(field(item, "payload"), "text");
                    let held: HeldPrompt;
                    try {
                        held = { sessionID, inboxID: own(inboxID), text: typeof text === "string" ? snapshotCapturePayload(text) as string : undefined };
                    } catch {
                        // Too large to capture: report the loss when it is delivered.
                        held = { sessionID, inboxID: own(inboxID), lost: true };
                    }
                    prompts.set(key, held);
                    heldPromptChars += held.text?.length ?? 0;
                    // Over the count limit, drop the oldest prompt and mark its session's turn incomplete.
                    while (prompts.size > MAX_HELD_PROMPTS) {
                        const dropped = releasePrompt(prompts.keys().next().value!);
                        if (dropped) await capture.incomplete({ sessionID: dropped.sessionID });
                    }
                    // Over the character limit, drop the oldest held texts but
                    // keep their entries: each reports its loss in the turn it
                    // is delivered in. Prompts of every session share the limit.
                    for (const oldest of prompts.values()) {
                        if (heldPromptChars <= MAX_HELD_PROMPT_CHARS) break;
                        if (oldest.text === undefined) continue;
                        heldPromptChars -= oldest.text.length;
                        oldest.text = undefined;
                        oldest.lost = true;
                    }
                    break;
                }
                case "session.inbox.delivered": {
                    const inboxID = identifier(field(data, "inboxID"));
                    const held = inboxID ? releasePrompt(callKey(sessionID, inboxID)) : undefined;
                    if (!held) break;
                    if (held.lost) { await capture.incomplete({ sessionID }); break; }
                    // The V1 prompt input shape: `agent` and `model.modelID`.
                    const selection = selections.get(sessionID);
                    await capture.prompt({
                        sessionID, messageID: held.inboxID, agent: selection?.agent,
                        model: selection?.model ? { modelID: selection.model } : undefined,
                    }, { parts: [{ type: "text", text: held.text }] });
                    break;
                }
                case "session.inbox.cancelled": {
                    const inboxID = identifier(field(data, "inboxID"));
                    if (inboxID) releasePrompt(callKey(sessionID, inboxID));
                    break;
                }
                // Later events for this message belong to the retry.
                case "session.retry.scheduled": {
                    const next = field(data, "attempt");
                    if (nativeMessageID && Number.isSafeInteger(next) && Number(next) > 0) {
                        remember(attempts, callKey(sessionID, nativeMessageID), Number(next), MAX_TRACKED_CALLS);
                    }
                    break;
                }
                case "session.step.started": {
                    const model = field(data, "model");
                    select(sessionID, field(data, "agent"), model, true);
                    if (!messageID) break;
                    await emit("message.updated", { info: {
                        id: messageID, role: "assistant", modelID: field(model, "id"), providerID: field(model, "providerID"), variant: field(model, "variant"),
                        time: { created: field(data, "started") },
                    } });
                    break;
                }
                // Post each text when it ends, as OpenCode 1's text hook
                // does. The runtime's Stop buffer keeps few parts, so a long
                // turn would lose its first texts. Reasoning joins the
                // message's request at Stop. The runtime adds the step's
                // model, provider and variant; the event's time is when the
                // text ended.
                case "session.text.ended":
                    if (partID) await capture.assistantText({ sessionID, messageID, partID, time: field(raw, "created") }, { text: field(data, "text") });
                    break;
                case "session.reasoning.ended":
                    if (partID) await emit("message.part.updated", { part: {
                        id: partID, messageID, type: "reasoning", text: field(data, "text"),
                    } });
                    break;
                case "session.tool.input.started": {
                    const id = identifier(field(data, "id"));
                    const name = identifier(field(data, "name"));
                    if (id && name) remember(toolNames, callKey(sessionID, id), own(name), MAX_TRACKED_CALLS);
                    break;
                }
                case "session.tool.called": {
                    if (messageID) await emit("message.part.updated", { part: {
                        id: field(data, "id"), messageID, type: "tool", callID: field(data, "id"),
                    } });
                    // The provider runs a hosted tool, so no tool hook reports
                    // it. Its call is its start.
                    const id = identifier(field(data, "id"));
                    if (!id || field(data, "executed") !== true) break;
                    const key = callKey(sessionID, id);
                    if (started.has(key) || completed.has(key)) break;
                    const tool = streamToolName(key);
                    remember(started, key, toolNames.get(key) ?? "", MAX_TRACKED_CALLS);
                    const args = field(data, "input");
                    await capture.beforeTool({ sessionID, tool, callID: id, args }, { args });
                    break;
                }
                // The subagent tool names its child session before prompting
                // it. This links the child even when several subagent calls
                // are pending at once.
                case "session.tool.progress": {
                    const childSessionID = identifier(field(field(data, "metadata"), "sessionID"));
                    const id = identifier(field(data, "id"));
                    if (childSessionID && id) await capture.linkSubagent({ sessionID, callID: id, childSessionID });
                    break;
                }
                // Interrupted, malformed, and hosted calls end here without
                // the tool hook. Post the end the hook did not.
                case "session.tool.success":
                case "session.tool.failed": {
                    const id = identifier(field(data, "id"));
                    if (!id) break;
                    const key = callKey(sessionID, id);
                    const tool = streamToolName(key);
                    toolNames.delete(key);
                    // An inner call still open when its `execute` call ends
                    // was interrupted, and no hook ends it: its turn is partial.
                    const interrupted = nested.get(key)?.open.length;
                    nested.delete(key);
                    if (interrupted) await capture.incomplete({ sessionID });
                    if (completed.delete(key)) break;
                    remember(completed, key, true, MAX_TRACKED_CALLS);
                    const input = { sessionID, tool, callID: id };
                    if (!started.delete(key)) await capture.beforeTool(input, {});
                    const failed = type === "session.tool.failed";
                    const output = resultText(data);
                    await capture.afterTool(input, {
                        output: output.text,
                        metadata: field(data, "metadata"),
                        error: failed ? { message: field(field(data, "error"), "message") } : undefined,
                        isError: failed,
                    });
                    if (output.partial) await capture.incomplete({ sessionID });
                    break;
                }
                case "session.step.ended":
                case "session.step.failed":
                    if (messageID) await emit("message.updated", { info: {
                        id: messageID, role: "assistant", tokens: field(data, "tokens"), cost: field(data, "cost"), native: native(data),
                        time: { completed: field(raw, "created") },
                    } });
                    break;
                // Compaction is a model call with no step events. Its usage
                // arrives only here, so record it as one assistant request.
                // The summary text is context for later requests, not a reply.
                case "session.compaction.ended":
                case "session.compaction.failed": {
                    const tokens = field(data, "tokens");
                    const cost = field(data, "cost");
                    if (tokens === undefined && cost === undefined) break;
                    const id = identifier(field(raw, "id"));
                    if (!id) throw new Error("compaction event has no identity");
                    const model = field(data, "model");
                    const created = field(raw, "created");
                    await emit("message.updated", { info: {
                        id: `compaction:${id}`, role: "assistant", modelID: field(model, "id"), providerID: field(model, "providerID"), variant: field(model, "variant"),
                        tokens, cost, native: native(data), time: { created, completed: created },
                    } });
                    break;
                }
                // A tool's request names its call in `source`, which links the
                // request to that call. Forward only the request's identity
                // and scope: `metadata` can hold whole file contents or tool
                // inputs, which the tool events already carry. The scope,
                // `resources`, is the request's tool input.
                case "permission.asked": {
                    const source = field(data, "source");
                    const fromTool = field(source, "type") === "tool";
                    const callID = fromTool ? identifier(field(source, "id")) : undefined;
                    // A Code Mode call asks under its `execute` call's ID.
                    // With one inner call open, the request is that call's.
                    const open = callID ? nested.get(callKey(sessionID, callID))?.open : undefined;
                    const inner = open?.length === 1 ? open[0] : undefined;
                    const resources = snapshotCapturePayload(field(data, "resources"));
                    await emit(type, {
                        permissionID: field(data, "id"),
                        permission: field(data, "action"),
                        tool_input: resources === undefined ? undefined : { resources },
                        callID: inner?.id ?? callID,
                        messageID: fromTool ? identifier(field(source, "messageID")) : undefined,
                        toolName: inner?.tool || (callID ? toolNames.get(callKey(sessionID, callID)) : undefined),
                    });
                    break;
                }
                case "permission.replied":
                    await emit(type, { permissionID: field(data, "requestID"), decision: field(data, "reply") });
                    break;
                case "session.execution.failed": {
                    // The turn's Stop carries the error type. An aborted
                    // execution is a user stop, not a failure.
                    const errorType = field(field(data, "error"), "type");
                    // The runtime validates the name; an invalid one becomes UnknownError.
                    const name = typeof errorType === "string" && errorType.length <= 64 ? errorType : undefined;
                    if (errorType !== "aborted") await emit("session.error", { error: { name } });
                    await emit("session.idle");
                    break;
                }
                case "session.execution.succeeded":
                    await emit("session.idle");
                    break;
                // An interruption is not a failure. A shutdown keeps the
                // session's work for OpenCode to resume, so it ends nothing:
                // closing the plugin ends the open turn as partial.
                case "session.execution.interrupted":
                    if (field(data, "reason") !== "shutdown") await emit("session.idle");
                    break;
                case "session.deleted":
                    // Removing retained history does not mean the agent ended.
                    releaseSession(sessionID);
                    owners.delete(sessionID);
                    await capture.forget({ sessionID });
                    break;
            }
        } catch { await markLoss(sessionID); }
    };

    // Wait between subscriptions. Closing the plugin ends the wait at once.
    const pause = (ms: number) => new Promise<void>((resolve) => {
        const finish = () => { clearTimeout(timer); controller.signal.removeEventListener("abort", finish); resolve(); };
        const timer = setTimeout(finish, ms);
        timer.unref?.();
        controller.signal.addEventListener("abort", finish, { once: true });
    });

    // Listen until OpenCode unloads the plugin. A stream that fails or ends is
    // resubscribed after a growing, capped wait; it is never abandoned.
    const listen = async (): Promise<void> => {
        let delay = RESUBSCRIBE_MIN_MS;
        let outage = false;
        while (!closing) {
            try {
                for await (const raw of ctx.event.subscribe({ signal: controller.signal })) {
                    if (closing) break;
                    // A delivered event shows the stream works again.
                    outage = false;
                    delay = RESUBSCRIBE_MIN_MS;
                    // A failure in our handler must not end the subscription.
                    handling = event(raw).catch(() => undefined);
                    await handling;
                    handling = undefined;
                }
            } catch { /* Stream errors stay out of the host; resubscribe below. */ }
            if (closing) return;
            // Record the gap once per outage, not once per failed resubscribe.
            if (!outage) {
                outage = true;
                // A session may have moved while events were missed.
                owners.clear();
                await capture.incomplete({}).catch(() => undefined);
            }
            await pause(delay);
            delay = Math.min(delay * 2, RESUBSCRIBE_MAX_MS);
        }
    };

    try {
        registrations.push(await ctx.tool.hook("execute.before", tool(false)));
        registrations.push(await ctx.tool.hook("execute.after", tool(true)));
        void listen();
    } catch (cause) {
        // Report the failed setup to OpenCode, which marks this plugin failed
        // and keeps the host running. Returning normally would leave a plugin
        // that OpenCode lists as active but that captures nothing.
        await close();
        throw cause;
    }
    return close;
}

export default { id: "trajectory-opencode", server, setup };
