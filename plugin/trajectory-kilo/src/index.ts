import { spawn, type ChildProcess } from "node:child_process";
import { types } from "node:util";
import { CaptureLossReporter, CaptureQueue, MAX_CAPTURE_PAYLOAD_NODES, snapshotCapturePayload, type CaptureLossMarker, type CaptureLossCounts } from "./capture-queue.ts";
import { CaptureStateBudget } from "./capture-state.ts";
import { isAbsolute, join, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_CAPTURE_PORT = 19222;
const MAX_TRAJECTORY_HOME_POINTER_BYTES = 4096;
const HOME_SELECTION_RETRY_MS = 30_000;
const PLUGIN_ROOT = fileURLToPath(new URL("..", import.meta.url));
const TRAJECTORY_HOME_POINTER = "trajectory-home";
// Setup writes the binary the MCP entry runs. A missing pointer selects the
// binary in the capture home.
const TRAJECTORY_BINARY_POINTER = "trajectory-bin";
const SERVER_START_WAIT = "5s";
const SERVER_START_TIMEOUT_MS = 6500;
const HOME_WORKER_TIMEOUT_MS = 1500;
const MAX_HOME_WORKER_BYTES = 32768;
let activeHomeWorker: ChildProcess | undefined;

// A referenced deadline is armed before filesystem work. A blocked OS read
// must stay in this owned process, rather than holding the native client open.
const HOME_WORKER_SOURCE = `
    setTimeout(() => process.kill(process.pid, "SIGKILL"), ${HOME_WORKER_TIMEOUT_MS});
    const { open } = await import("node:fs/promises");
    const { constants } = await import("node:fs");
    const { isAbsolute } = await import("node:path");
    let request = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) {
        request += chunk;
        if (Buffer.byteLength(request) > ${MAX_HOME_WORKER_BYTES}) process.exit(1);
    }
    const { pointer } = JSON.parse(request);
    if (typeof pointer !== "string" || pointer.length > 4096) process.exit(1);
    let response;
    try {
        const handle = await open(pointer, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0) | (constants.O_NOFOLLOW ?? 0));
        try {
            const info = await handle.stat();
            if (!info.isFile() || info.size < 1 || info.size > ${MAX_TRAJECTORY_HOME_POINTER_BYTES}) throw new Error();
            const buffer = Buffer.alloc(${MAX_TRAJECTORY_HOME_POINTER_BYTES} + 1);
            let total = 0;
            while (total < buffer.length) {
                const { bytesRead } = await handle.read(buffer, total, buffer.length - total, total);
                if (bytesRead === 0) break;
                total += bytesRead;
            }
            if (total !== info.size || total > ${MAX_TRAJECTORY_HOME_POINTER_BYTES}) throw new Error();
            const home = new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, total)).trim();
            if (!home || /[\\n\\r\\0]/.test(home) || !isAbsolute(home)) throw new Error();
            response = { home };
        } finally { await handle.close(); }
    } catch (error) {
        response = error?.code === "ENOENT" ? { missing: true } : { invalid: true };
    }
    const output = JSON.stringify(response);
    if (Buffer.byteLength(output) > ${MAX_HOME_WORKER_BYTES}) process.exit(1);
    process.stdout.write(output, () => process.exit(0));
`;

function launchHomeWorker(source: string): ChildProcess {
    const bun = process.versions.bun;
    // Compiled Bun executables need the documented raw-runtime entrypoint.
    // Older runtimes must decline optional capture, never re-enter the app.
    if (bun) {
        const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(bun);
        if (!match || !(Number(match[1]) > 1 || Number(match[1]) === 1 &&
            (Number(match[2]) > 2 || Number(match[2]) === 2 && Number(match[3]) >= 16))) {
            throw new Error("capture home worker runtime unavailable");
        }
    }
    const env: NodeJS.ProcessEnv = {};
    for (const key of ["SYSTEMROOT", "WINDIR", "TEMP", "TMP", "TMPDIR"]) {
        if (process.env[key]) env[key] = process.env[key];
    }
    if (bun) env.BUN_BE_BUN = "1";
    // Bun preloads run before the worker's deadline. Neither project config
    // nor inherited HOME/XDG configuration may execute in this helper.
    const args = ["--input-type=module", "--eval", source];
    if (bun) args.unshift("--config=" + (process.platform === "win32" ? "NUL" : "/dev/null"));
    return spawn(process.execPath, args,
        { cwd: parse(process.execPath).root, stdio: ["pipe", "pipe", "ignore"], windowsHide: true, env });
}

class CaptureHomeWorkerBusyError extends Error {
    constructor() { super("capture home worker unavailable: busy"); }
}

class CaptureHomeReader {
    private stop?: () => void;
    private closed = false;
    private readonly launch: (source: string) => ChildProcess;

    constructor(launch: (source: string) => ChildProcess = launchHomeWorker) { this.launch = launch; }

    read(pointer: string): Promise<string | undefined> {
        if (this.closed || pointer.length > 4096) return Promise.reject(new Error("capture home worker unavailable"));
        if (activeHomeWorker) return Promise.reject(new CaptureHomeWorkerBusyError());
        return new Promise((resolveHome, reject) => {
            let child: ChildProcess;
            try { child = this.launch(HOME_WORKER_SOURCE); }
            catch { reject(new Error("capture home worker unavailable")); return; }
            activeHomeWorker = child;
            let bytes = 0;
            const chunks: Buffer[] = [];
            let settled = false;
            const finish = (error?: Error, home?: string) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                this.stop = undefined;
                child.stdin?.destroy();
                child.stdout?.destroy();
                if (error) {
                    try { child.kill("SIGKILL"); } catch { /* Permit remains held until close. */ }
                    reject(error);
                } else resolveHome(home);
            };
            const timer = setTimeout(() => finish(new Error("capture home worker deadline")), HOME_WORKER_TIMEOUT_MS);
            timer.unref();
            this.stop = () => finish(new Error("capture home worker stopped"));
            child.once("error", () => finish(new Error("capture home worker unavailable")));
            child.once("close", (code) => {
                if (activeHomeWorker === child) activeHomeWorker = undefined;
                if (settled) return;
                try {
                    if (code !== 0) throw new Error();
                    const response = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes))) as { missing?: unknown; home?: unknown };
                    if (response?.missing === true && response.home === undefined) { finish(); return; }
                    const home = response?.home;
                    if (typeof home !== "string" || !home || home.length > MAX_TRAJECTORY_HOME_POINTER_BYTES || /[\n\r\0]/.test(home) || !isAbsolute(home)) throw new Error();
                    finish(undefined, home);
                } catch { finish(new Error("invalid capture home pointer")); }
            });
            child.stdout?.on("data", (chunk: Buffer) => {
                if (settled) return;
                bytes += chunk.length;
                if (bytes > MAX_HOME_WORKER_BYTES) { finish(new Error("capture home worker response too large")); return; }
                chunks.push(chunk);
            });
            child.stdout?.once("error", () => finish(new Error("capture home worker response failed")));
            child.stdin?.once("error", () => finish(new Error("capture home worker request failed")));
            if (!child.stdin || !child.stdout) { finish(new Error("capture home worker pipes unavailable")); return; }
            child.stdin.end(JSON.stringify({ pointer }));
            (child.stdin as typeof child.stdin & { unref?: () => void }).unref?.();
            (child.stdout as typeof child.stdout & { unref?: () => void }).unref?.();
            child.unref();
        });
    }

    close(): void { this.closed = true; this.stop?.(); }
}

async function resolveTrajectoryHome(environment: Record<string, string | undefined>, reader = new CaptureHomeReader(), fallbackUnavailable = false): Promise<string | undefined> {
    const configured = environment.TRAJECTORY_HOME?.trim();
    if (configured) {
        if (configured.length > 4096) throw new Error("capture home too large");
        return resolve(configured);
    }
    const pointer = join(PLUGIN_ROOT, TRAJECTORY_HOME_POINTER);
    const installed = await reader.read(pointer);
    if (installed) return installed;
    if (fallbackUnavailable) throw new Error("capture fallback home environment unavailable");
    const userHome = environment.HOME?.trim() || environment.USERPROFILE?.trim();
    if (userHome && userHome.length > 4096) throw new Error("capture home too large");
    return userHome ? join(userHome, ".trajectory") : undefined;
}

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

const CAPTURE_PATH = "/capture/kilo";
const CAPTURE_CLIENT = CAPTURE_PATH.slice(CAPTURE_PATH.lastIndexOf("/") + 1);
const CAPTURE_URL = "http://localhost:" + resolveCapturePort() + CAPTURE_PATH;

// Runs `trajectory serve ensure`, the request every client uses to start the
// shared capture server. Coordination keeps one server for each port: the
// command joins a server that is already running or starting. The child owns
// no pipe, so it never holds the host open. Its deadline or an abort ends it,
// and a later request takes over a start it left unfinished.
function requestCaptureServer(binary: string, home: string, signal: AbortSignal): Promise<boolean> {
    return new Promise((resolveStart) => {
        let child: ChildProcess | undefined;
        let settled = false;
        const finish = (ready: boolean) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            signal.removeEventListener("abort", stop);
            resolveStart(ready);
        };
        const stop = () => {
            try { child?.kill("SIGKILL"); } catch { /* The child already exited. */ }
            finish(false);
        };
        const timer = setTimeout(stop, SERVER_START_TIMEOUT_MS);
        timer.unref?.();
        if (signal.aborted) { finish(false); return; }
        signal.addEventListener("abort", stop, { once: true });
        try {
            child = spawn(binary, ["serve", "ensure", "--client", CAPTURE_CLIENT, "--port", String(resolveCapturePort()), "--wait", SERVER_START_WAIT, "--format", "json"],
                { stdio: "ignore", windowsHide: true, env: { ...process.env, TRAJECTORY_HOME: home } });
        } catch { finish(false); return; }
        child.once("error", () => finish(false));
        child.once("exit", (code) => finish(code === 0));
        child.unref();
    });
}
const MAX_TRACKED_SESSIONS = 128;
const MAX_RETAINED_SESSIONS = 512;
const MAX_PENDING_STOP_TURN_SNAPSHOTS = 8;
const MAX_COALESCED_STOP_PLACEHOLDERS = 128;
const MAX_TRACKED_MESSAGES_PER_TURN = 128;
const MAX_SETTLED_REQUESTS_PER_TURN = 32;
const MAX_BUFFERED_TEXT_PARTS_PER_TURN = 64;
const MAX_BUFFERED_TEXT_CHARS_PER_TURN = 1024 * 1024;
const MAX_AGENT_MESSAGE_CHARS = 256 * 1024;
const MAX_RETAINED_IDENTIFIER_CHARS = 512;
const MAX_SERVICE_TIER_CHARS = 64;
const PLUGIN_PROVENANCE = {
    plugin: {
        id: "trajectory-kilo",
        version: "3.0.4",
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
    client?: {
        app?: { log?: (parameters: unknown, options?: unknown) => Promise<unknown> };
        session?: { messages?: (options: unknown) => unknown };
    };
    parts?: unknown[];
    directory?: string;
    worktree?: string;
}

interface AssistantMessageMeta {
    model?: unknown;
    provider?: unknown;
    reasoningEffort?: unknown;
    timestamp?: string;
    usage?: Record<string, unknown>;
    text?: string;
    thinkingText?: string;
    toolUseIDs?: string[];
}

interface BufferedAssistantPart {
    messageID: string;
    partID: string;
    text: string;
    originalLength: number;
}

interface SessionRuntimeState {
    // The prompt message the session last saw. OpenCode 1.x updates it after the
    // session goes idle, when it adds the summary, and that isn't a new prompt.
    lastUserMessageID?: string;
    started: boolean;
    creationObserved: boolean;
    // When OpenCode created the session. Forking replays the parent's messages into
    // the new session under new IDs and with their old times, so anything older is a
    // copy: it already ran in the parent, and isn't this session's work.
    createdAt?: number;
    // The copy whose parts come next: a fork replays a message, then that message's
    // parts. A part with a start time needs no ID: compaction can update a copied tool
    // part long after the replay, and it keeps its old time.
    forkCopyID?: string;
    parentSessionID?: string;
    nativeChildActive?: boolean;
    model?: string;
    pendingCaptureLoss: CaptureLossMarker;
    launchedTaskCalls: Set<string>;
    pendingTaskCalls: Set<string>;
    pendingTaskIdentityLost?: boolean;
    activeChildren: { count: number };
    subagentLink?: SubagentLink;
    activeTurn?: TurnRuntimeState;
    pendingStopTurns: TurnRuntimeState[];
    coalescedStopCount: number;
    stopInFlight?: Promise<void>;
    pendingTerminal?: "session.idle" | "session.deleted";
}

interface TurnRuntimeState {
    captureLoss: CaptureLossMarker;
    model?: string;
    nativeAgentMessageSeen: boolean;
    assistantMessages: Map<string, AssistantMessageMeta>;
    bufferedTextParts: Map<string, BufferedAssistantPart>;
    bufferedTextChars: number;
    sentAgentMessages: Set<string>;
    sentUsageMessages: Set<string>;
    // Usage of responses that left assistantMessages, one total per model,
    // tier and cost kind, charged to the retained-state budget like the rest.
    settledRequests: Map<string, Record<string, unknown>>;
    // OpenCode's error name when session.error ended this turn.
    failureType?: string;
}

interface SubagentLink {
    parentSessionID: string;
    childSessionID: string;
    toolUseID: string;
    parentChildren: { count: number };
}

type SessionStartResolution =
    | { kind: "missing" }
    | { kind: "invalid" }
    | { kind: "rejected" }
    | { kind: "started"; sessionID: string };

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


function normalizeSessionID(value: unknown): string | undefined {
    if (typeof value !== "string" || value.length > 512) return undefined;
    const sessionID = value.trim();
    if (!sessionID || sessionID.length > MAX_RETAINED_IDENTIFIER_CHARS || sessionID === "unknown" || sessionID === "global") return undefined;
    return Buffer.from(sessionID, "utf16le").toString("utf16le");
}

function ownCaptureField(value: unknown, name: string): unknown {
    if (value === null || typeof value !== "object" || types.isProxy(value)) return undefined;
    const field = Object.getOwnPropertyDescriptor(value, name);
    return field && "value" in field ? field.value : undefined;
}

function sessionIDCandidate(value: unknown): unknown {
    const field = (name: string): unknown => ownCaptureField(value, name);
    const event = field("event");
    const properties = field("properties");
    const info = ownCaptureField(properties, "info");
    const message = field("message");
    return field("sessionID") ?? field("sessionId") ?? field("session_id") ??
        ownCaptureField(field("session"), "id") ??
        ownCaptureField(event, "sessionID") ?? ownCaptureField(event, "sessionId") ?? ownCaptureField(event, "session_id") ??
        ownCaptureField(properties, "sessionID") ?? ownCaptureField(properties, "sessionId") ?? ownCaptureField(properties, "session_id") ??
        ownCaptureField(ownCaptureField(properties, "part"), "sessionID") ??
        ownCaptureField(info, "sessionID") ?? ownCaptureField(info, "id") ??
        ownCaptureField(message, "sessionID") ?? ownCaptureField(message, "sessionId") ?? ownCaptureField(message, "session_id") ??
        ownCaptureField(field("info"), "sessionID");
}

function resolveSessionID(...values: unknown[]): { kind: "missing" | "invalid" } | { kind: "resolved"; sessionID: string } {
    for (const value of values) {
        const candidate = sessionIDCandidate(value);
        if (candidate === undefined || candidate === null) continue;
        const sessionID = normalizeSessionID(candidate);
        return sessionID ? { kind: "resolved", sessionID } : { kind: "invalid" };
    }
    return { kind: "missing" };
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

// UserPromptSubmit collects text and identifiers, not attachment bytes. Select
// that supported data before the bounded copy so a healthy pasted image does
// not make the accompanying text exceed the capture budget.
function promptCaptureOutput(value: unknown): unknown {
    const field = (object: unknown, key: string): unknown => {
        if (object == null || typeof object !== "object") return undefined;
        if (types.isProxy(object)) throw new Error("capture prompt is a proxy");
        const prototype = Object.getPrototypeOf(object);
        if (prototype !== Object.prototype && prototype !== Array.prototype && prototype !== null) throw new Error("capture prompt is not plain JSON");
        const descriptor = Object.getOwnPropertyDescriptor(object, key);
        if (descriptor && !("value" in descriptor)) throw new Error("capture prompt has an accessor");
        return descriptor?.value;
    };
    const fields = (object: unknown, keys: string[]): Record<string, unknown> => {
        const selected: Record<string, unknown> = Object.create(null);
        for (const key of keys) {
            const item = field(object, key);
            if (item !== undefined) {
                if (item !== null && (typeof item === "object" || typeof item === "function")) throw new Error("capture prompt metadata is not scalar");
                selected[key] = item;
            }
        }
        return selected;
    };
    const sessionKeys = ["sessionID", "sessionId", "session_id"];
    const output = fields(value, sessionKeys);
    output.session = fields(field(value, "session"), ["id"]);
    output.event = fields(field(value, "event"), sessionKeys);
    output.info = fields(field(value, "info"), ["sessionID"]);
    const properties = field(value, "properties");
    const selectedProperties = fields(properties, sessionKeys);
    selectedProperties.part = fields(field(properties, "part"), ["sessionID"]);
    selectedProperties.info = fields(field(properties, "info"), ["sessionID", "id"]);
    output.properties = selectedProperties;
    const message = field(value, "message");
    const selectedMessage = fields(message, [...sessionKeys, "id", "content"]);
    selectedMessage.model = fields(field(message, "model"), ["modelID"]);
    output.message = selectedMessage;
    const parts = field(value, "parts");
    if (Array.isArray(parts)) {
        if (types.isProxy(parts) || parts.length > MAX_CAPTURE_PAYLOAD_NODES) throw new Error("capture prompt has too many parts");
        const textParts = [];
        for (let index = 0; index < parts.length; index++) {
            const part = field(parts, String(index));
            const type = field(part, "type");
            if (type === "text" && !field(part, "synthetic")) textParts.push({ type, text: field(part, "text") });
        }
        output.parts = textParts;
    }
    return output;
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
        if (isNonEmptyString(value)) return Buffer.from(value.trim(), "utf16le").toString("utf16le");
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

// OpenCode records the tier a Responses-route provider applied (OpenAI, and
// xAI on that route) in the message's step-level native data. Older releases
// and other providers record none, and the call is priced as one that states
// no tier.
function nativeServiceTier(info: KiloPayload): string | undefined {
    const tier = firstString(ownCaptureField(ownCaptureField(info, "native"), "serviceTier"));
    return tier !== undefined && tier.length <= MAX_SERVICE_TIER_CHARS ? tier : undefined;
}

function nativeMessageUsage(rawInfo: unknown): Record<string, unknown> | undefined {
    const info = payload(rawInfo);
    const tokens = payload(info.tokens);
    const cache = payload(tokens.cache);
    const cost = nonNegativeNumber(info.cost);
    const serviceTier = nativeServiceTier(info);
    const observed =
        nonNegativeNumber(tokens.input) !== undefined ||
        nonNegativeNumber(tokens.output) !== undefined ||
        nonNegativeNumber(tokens.reasoning) !== undefined ||
        nonNegativeNumber(cache.read) !== undefined ||
        nonNegativeNumber(cache.write) !== undefined ||
        cost !== undefined;
    if (!observed) return undefined;
    return {
        input: nonNegativeNumber(tokens.input) ?? 0,
        output: nonNegativeNumber(tokens.output) ?? 0,
        reasoning: nonNegativeNumber(tokens.reasoning) ?? 0,
        cacheRead: nonNegativeNumber(cache.read) ?? 0,
        cacheWrite: nonNegativeNumber(cache.write) ?? 0,
        cost: cost ?? 0,
        cost_observed: cost !== undefined && cost > 0,
        ...(serviceTier !== undefined ? { service_tier: serviceTier } : {}),
    };
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

// sessionErrorType returns the bounded error name of a session.error event,
// or undefined when the user aborted the turn.
function sessionErrorType(error: unknown): string | undefined {
    const name = payload(error).name;
    if (typeof name !== "string" || !/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/.test(name)) return "UnknownError";
    return name === "MessageAbortedError" ? undefined : name;
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
            properties?.requestID,
            properties?.requestId,
            properties?.request_id,
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

function nativeCaptureLogger(input: KiloPayload): ((counts: CaptureLossCounts, signal: AbortSignal) => Promise<unknown>) | undefined {
    try {
        if (types.isProxy(input)) return undefined;
        const client = Object.getOwnPropertyDescriptor(input, "client")?.value as KiloPayload["client"];
        const app = client?.app;
        const log = app?.log;
        if (typeof log !== "function") return undefined;
        // Keep only the native log transport; never retain the plugin input or
        // provider events. No console, toast, or notification fallback.
        return async (counts, signal) => {
            const body = {
                service: "trajectory-capture", level: "info",
                message: "Trajectory optional capture diagnostics",
                extra: { schema_version: 1, client_source: "kilo", ...counts },
            };
            // The original SDK accepts body in its first options argument;
            // SDK v2 accepts the named fields and a second transport argument.
            await log.call(app, { ...body, body, signal, throwOnError: true }, { signal, throwOnError: true });
        };
    } catch { return undefined; }
}

class CaptureSessionCapacityError extends Error {}

export const server = async (input: KiloPayload) => {
    const diagnostics = new CaptureLossReporter(nativeCaptureLogger(input));
    const retained = new CaptureStateBudget(() => diagnostics.record("state_declined"));
    const pendingSnapshotLoss = new Set<string>();
    let snapshotLossUnassigned = false;
    const pendingCallbacks = new Map<string, Promise<void>>();
    const preparedSnapshots = new Map<string, unknown[]>();
    const prepared = new CaptureStateBudget();
    const maxPendingCallbacks = 64;
    let disposed = false;
    function recordCallbackLoss(sessionID?: string, turn?: TurnRuntimeState, taskIdentityLost = false, cause?: unknown): void {
        if (!(cause instanceof CaptureSessionCapacityError)) capture.preparationFailed();
        const state = sessionID ? sessionStates.get(sessionID) : undefined;
        if (taskIdentityLost && state) state.pendingTaskIdentityLost = true;
        markSnapshotDropped(sessionID, turn);
    }
    function markSnapshotDropped(sessionID?: string, turn?: TurnRuntimeState): void {
        const state = sessionID ? sessionStates.get(sessionID) : undefined;
        if (turn) turn.captureLoss.dropped = true;
        else if (state?.activeTurn) state.activeTurn.captureLoss.dropped = true;
        else if (state) state.pendingCaptureLoss.dropped = true;
        else if (sessionID) {
            const replacing = !pendingSnapshotLoss.has(sessionID) && pendingSnapshotLoss.size >= MAX_RETAINED_SESSIONS;
            if (!retained.add(pendingSnapshotLoss, sessionID, MAX_RETAINED_SESSIONS) || replacing) snapshotLossUnassigned = true;
        } else snapshotLossUnassigned = true;
    }
    const workspace: { directory?: string; worktree?: string } = {};
    try {
        if (types.isProxy(input)) throw new Error("optional capture workspace unavailable");
        for (const field of ["directory", "worktree"] as const) {
            const value = Object.getOwnPropertyDescriptor(input, field)?.value;
            if (typeof value === "string" && value.length <= 4096) workspace[field] = snapshotCapturePayload(value) as string;
            else if (value !== undefined) retained.recordDrop();
        }
    } catch { retained.recordDrop(); }
    // Retain owned workspace data and the selected native log transport.
    input = Object.create(null);
    const environment: Record<string, string | undefined> = {};
    let homeEnvironmentUnavailable = false;
    let fallbackHomeUnavailable = false;
    for (const name of ["TRAJECTORY_HOME", "HOME", "USERPROFILE"]) {
        const value = process.env[name];
        if (value === undefined) continue;
        if (value.length > 4096) {
            if (name === "TRAJECTORY_HOME") { homeEnvironmentUnavailable = true; retained.recordDrop(); }
            else fallbackHomeUnavailable = true;
            break;
        }
        environment[name] = snapshotCapturePayload(value) as string;
        if (value.trim()) break;
    }
    const homeReader = new CaptureHomeReader();
    let homeSelection: Promise<string | undefined> | undefined;
    let retryHomeAfter = 0;
    const capture = new CaptureQueue(CAPTURE_URL, async (): Promise<Record<string, string>> => {
        if (homeEnvironmentUnavailable) throw new Error("capture home environment unavailable");
        if (!homeSelection || (retryHomeAfter > 0 && performance.now() >= retryHomeAfter)) {
            retryHomeAfter = 0;
            homeSelection = resolveTrajectoryHome(environment, homeReader, fallbackHomeUnavailable);
        }
        const selection = homeSelection;
        try {
            const selectedHome = await selection;
            if (!selectedHome) throw new Error("capture home selection unavailable");
            return { "X-Trajectory-Home": selectedHome };
        } catch (error) {
            if (homeSelection === selection) {
                // Contention created no helper; other failures keep their original retry deadline.
                if (error instanceof CaptureHomeWorkerBusyError) homeSelection = undefined;
                else if (retryHomeAfter === 0) retryHomeAfter = performance.now() + HOME_SELECTION_RETRY_MS;
            }
            throw error;
        }
    }, (reason) => diagnostics.record(reason), () => homeReader.close(), async (headers, signal) => {
        const home = headers["X-Trajectory-Home"];
        if (!home) return false;
        // An unreadable pointer declines the start. Only a missing one selects
        // the binary in the capture home.
        const binary = await homeReader.read(join(PLUGIN_ROOT, TRAJECTORY_BINARY_POINTER)) ?? join(home, "bin", "trajectory");
        return requestCaptureServer(binary, home, signal);
    });
    async function postEvent(event: string, data: unknown, turn?: TurnRuntimeState): Promise<void> {
        let admitted = false;
        const sessionID = firstString(payload(data)?.session_id);
        const state = sessionID ? sessionStates.get(sessionID) : undefined;
        const loss = turn?.captureLoss ?? state?.activeTurn?.captureLoss ?? state?.pendingCaptureLoss;
        try { admitted = capture.enqueue(event, withPluginProvenance(data), loss); } catch { capture.preparationFailed(); }
        if (capture.hasUnassignedLoss()) snapshotLossUnassigned = true;
        if (!admitted) markSnapshotDropped(sessionID, turn);
    }
    const sessionStates = new Map<string, SessionRuntimeState>();
    const endedSessionIDs = new Set<string>();
    let lastSessionID: string | undefined;

    function createSessionState(): SessionRuntimeState {
        return {
            started: false,
            pendingCaptureLoss: { dropped: false },
            creationObserved: false,
            launchedTaskCalls: new Set(),
            pendingTaskCalls: new Set(),
            activeChildren: { count: 0 },
            pendingStopTurns: [],
            coalescedStopCount: 0,
        };
    }

    function createTurnState(model: string | undefined, captureLoss: CaptureLossMarker): TurnRuntimeState {
        return {
            model,
            captureLoss,
            nativeAgentMessageSeen: false,
            assistantMessages: new Map(),
            bufferedTextParts: new Map(),
            bufferedTextChars: 0,
            sentAgentMessages: new Set(),
            sentUsageMessages: new Set(),
            settledRequests: new Map(),
        };
    }

    function isProtectedSessionState(state: SessionRuntimeState): boolean {
        return (
            state.activeTurn !== undefined ||
            state.stopInFlight !== undefined ||
            state.pendingTerminal !== undefined ||
            state.subagentLink !== undefined ||
            state.nativeChildActive === true ||
            state.pendingTaskCalls.size > 0 ||
            state.activeChildren.count > 0
        );
    }

    function releaseTurn(turn: TurnRuntimeState): void {
        retained.clear(turn.assistantMessages);
        retained.clear(turn.bufferedTextParts);
        retained.clear(turn.sentAgentMessages);
        retained.clear(turn.sentUsageMessages);
        retained.clear(turn.settledRequests);
        turn.bufferedTextChars = 0;
    }

    function removeSessionState(sessionID: string, state: SessionRuntimeState): void {
        retained.clear(state.launchedTaskCalls);
        retained.clear(state.pendingTaskCalls);
        if (state.activeTurn) releaseTurn(state.activeTurn);
        for (const turn of state.pendingStopTurns) releaseTurn(turn);
        if (sessionStates.get(sessionID) === state) sessionStates.delete(sessionID);
    }

    function evictDormantSession(): boolean {
        for (const [sessionID, state] of sessionStates) {
            if (isProtectedSessionState(state)) continue;
            removeSessionState(sessionID, state);
            // Carry between-turn loss into the existing bounded identity set.
            if (state.pendingCaptureLoss.dropped) markSnapshotDropped(sessionID);
            return true;
        }
        return false;
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
        if (sessionStates.size >= MAX_RETAINED_SESSIONS) {
            retained.recordDrop();
            throw new CaptureSessionCapacityError("capture session capacity full");
        }
        const created = createSessionState();
        sessionStates.set(sessionID, created);
        return created;
    }

    function recordSessionModel(sessionID: string, model: unknown): void {
        if (!isNonEmptyString(model)) return;
        const state = sessionState(sessionID);
        if (model.length > MAX_RETAINED_IDENTIFIER_CHARS) {
            state.model = undefined;
            if (state.activeTurn) { state.activeTurn.model = undefined; state.activeTurn.captureLoss.dropped = true; }
            else state.pendingCaptureLoss.dropped = true;
            retained.recordDrop();
            return;
        }
        state.model = model;
        if (state.activeTurn) state.activeTurn.model = model;
    }

    function markTurnOpen(sessionID: string): TurnRuntimeState {
        const state = sessionState(sessionID);
        if (!state.activeTurn) {
            state.activeTurn = createTurnState(state.model, state.pendingCaptureLoss);
            // An evicted loss identity cannot be assigned safely again in this
            // host instance; keep later completeness claims conservative.
            state.activeTurn.captureLoss.dropped = state.pendingCaptureLoss.dropped || pendingSnapshotLoss.has(sessionID) || snapshotLossUnassigned;
            retained.delete(pendingSnapshotLoss, sessionID);
            state.pendingCaptureLoss = { dropped: false };
        }
        return state.activeTurn;
    }

    function rememberBounded(set: Set<string>, value: string, turn?: TurnRuntimeState): boolean {
        const replacing = !set.has(value) && set.size >= MAX_TRACKED_MESSAGES_PER_TURN;
        const admitted = retained.add(set, value, MAX_TRACKED_MESSAGES_PER_TURN);
        if (!admitted || replacing) { if (turn) turn.captureLoss.dropped = true; }
        return admitted;
    }

    function rememberEndedSession(sessionID: string): void {
        if (endedSessionIDs.has(sessionID)) endedSessionIDs.delete(sessionID);
        endedSessionIDs.add(sessionID);
        while (endedSessionIDs.size > MAX_RETAINED_SESSIONS) {
            const oldest = endedSessionIDs.values().next().value;
            if (typeof oldest !== "string") break;
            endedSessionIDs.delete(oldest);
        }
    }

    function rememberAssistantMessage(sessionID: string, turn: TurnRuntimeState, messageID: string, meta: AssistantMessageMeta): void {
        const replacing = !turn.assistantMessages.has(messageID) && turn.assistantMessages.size >= MAX_TRACKED_MESSAGES_PER_TURN;
        const evictedID = replacing ? turn.assistantMessages.keys().next().value : undefined;
        const evicted = evictedID === undefined ? undefined : turn.assistantMessages.get(evictedID);
        if (!retained.set(turn.assistantMessages, messageID, meta, MAX_TRACKED_MESSAGES_PER_TURN) || replacing) turn.captureLoss.dropped = true;
        if (evictedID !== undefined && turn.assistantMessages.has(messageID)) settleEvictedMessage(sessionID, turn, evictedID, evicted);
    }

    // A turn can outlast the tracking limit. The oldest response leaves with its
    // text and tool IDs, so the turn stays marked as partial, but its usage is
    // written now and counted in the turn's total: tokens and cost stay exact.
    function settleEvictedMessage(sessionID: string, turn: TurnRuntimeState, messageID: string, meta: AssistantMessageMeta | undefined): void {
        const usage = meta?.usage;
        if (!usage) return;
        if (!turn.sentUsageMessages.has(messageID)) {
            void postEvent("AgentUsage", {
                session_id: sessionID,
                message_id: messageID,
                model: meta.model ?? turn.model,
                provider: meta.provider,
                timestamp: meta.timestamp,
                usage,
            }, turn);
        }
        const key = JSON.stringify([meta.model ?? turn.model, meta.provider, meta.reasoningEffort, usage.service_tier, usage.cost_observed]);
        const settled = turn.settledRequests.get(key);
        if (!settled && turn.settledRequests.size >= MAX_SETTLED_REQUESTS_PER_TURN) {
            retained.recordDrop();
            return;
        }
        const total: Record<string, unknown> = { ...(settled?.usage as Record<string, unknown> | undefined ?? usage) };
        if (settled) {
            for (const field of ["input", "output", "reasoning", "cacheRead", "cacheWrite", "cost"]) {
                total[field] = (nonNegativeNumber(total[field]) ?? 0) + (nonNegativeNumber(usage[field]) ?? 0);
            }
        }
        retained.set(turn.settledRequests, key, {
            model: meta.model ?? turn.model,
            provider: meta.provider,
            reasoning_effort: meta.reasoningEffort,
            timestamp: meta.timestamp ?? settled?.timestamp,
            usage: total,
        }, MAX_SETTLED_REQUESTS_PER_TURN);
    }

    function recordMessageInfo(sessionID: string, rawInfo: unknown): void {
        const info = payload(rawInfo);
        const messageID = firstString(info.id, info.messageID, info.message_id);
        if (!messageID) return;
        const owner = sessionState(sessionID);
        const created = nonNegativeNumber(info.time?.created);
        if (owner.createdAt !== undefined && created !== undefined && created < owner.createdAt) {
            owner.forkCopyID = messageID.length <= MAX_RETAINED_IDENTIFIER_CHARS ? messageID : undefined;
            return;
        }
        if (info.role === "user") {
            const state = sessionState(sessionID);
            if (state.lastUserMessageID === messageID && !state.activeTurn) return;
            state.lastUserMessageID = messageID.length <= MAX_RETAINED_IDENTIFIER_CHARS ? messageID : undefined;
            markTurnOpen(sessionID);
            return;
        }
        if (info.role !== "assistant") return;
        const turn = markTurnOpen(sessionID);
        const existing = turn.assistantMessages.get(messageID);
        rememberAssistantMessage(sessionID, turn, messageID, {
            model: info.modelID ?? info.model?.modelID ?? existing?.model,
            provider: info.providerID ?? info.model?.providerID ?? existing?.provider,
            reasoningEffort: info.variant ?? info.reasoningEffort ?? info.reasoning_effort ?? info.effort ?? existing?.reasoningEffort,
            timestamp: normalizeTimestamp(info.time?.completed ?? info.time?.created) ?? existing?.timestamp,
            usage: nativeMessageUsage(info) ?? existing?.usage,
            text: existing?.text,
            thinkingText: existing?.thinkingText,
            toolUseIDs: existing?.toolUseIDs,
        });
    }

    function bufferMessagePart(sessionID: string, rawPart: unknown): void {
        const part = payload(rawPart);
        const messageID = firstString(part.messageID, part.message_id);
        const partID = firstString(part.id, part.partID, part.part_id);
        if (!messageID || !partID) return;
        const owner = sessionState(sessionID);
        const started = nonNegativeNumber(payload(part.state).time?.start ?? part.time?.start);
        if (owner.forkCopyID === messageID || (owner.createdAt !== undefined && started !== undefined && started < owner.createdAt)) return;
        const turn = markTurnOpen(sessionID);
        let meta = turn.assistantMessages.get(messageID);
        if ((part.type === "tool" || part.type === "reasoning") && !meta) {
            meta = {};
            rememberAssistantMessage(sessionID, turn, messageID, meta);
        }
        if (part.type === "tool" && meta) {
            const toolUseID = firstString(part.callID, part.callId, part.call_id, part.id);
            if (toolUseID && !meta.toolUseIDs?.includes(toolUseID)) {
                if ((meta.toolUseIDs?.length ?? 0) >= MAX_TRACKED_MESSAGES_PER_TURN) { turn.captureLoss.dropped = true; retained.recordDrop(); return; }
                rememberAssistantMessage(sessionID, turn, messageID, { ...meta, toolUseIDs: [...(meta.toolUseIDs ?? []), toolUseID] });
            }
            return;
        }
        if (part.type === "reasoning" && isNonEmptyString(part.text) && meta) {
            rememberAssistantMessage(sessionID, turn, messageID, { ...meta, thinkingText: ((meta.thinkingText ? meta.thinkingText + "\n" : "") + part.text.trim()).slice(0, MAX_AGENT_MESSAGE_CHARS) });
            return;
        }
        if (!isTextPart(part) || part.synthetic) return;
        const key = messageID + ":" + partID;
        const existing = turn.bufferedTextParts.get(key);
        const normalized = part.text.trim();
        const text = normalized.slice(0, MAX_AGENT_MESSAGE_CHARS);
        if (text.length === 0) {
            if (existing) {
                turn.bufferedTextChars -= existing.text.length;
                retained.delete(turn.bufferedTextParts, key);
            }
            return;
        }
        const victimKey = !existing && turn.bufferedTextParts.size >= MAX_BUFFERED_TEXT_PARTS_PER_TURN ? turn.bufferedTextParts.keys().next().value : undefined;
        const victim = victimKey === undefined ? undefined : turn.bufferedTextParts.get(victimKey);
        if (!retained.set(turn.bufferedTextParts, key, { messageID, partID, text, originalLength: normalized.length }, MAX_BUFFERED_TEXT_PARTS_PER_TURN)) { turn.captureLoss.dropped = true; return; }
        turn.bufferedTextChars += text.length - (existing?.text.length ?? 0) - (victim?.text.length ?? 0);
        if (victim) turn.captureLoss.dropped = true;
        while (turn.bufferedTextChars > MAX_BUFFERED_TEXT_CHARS_PER_TURN) {
            const oldestKey = turn.bufferedTextParts.keys().next().value;
            if (oldestKey === undefined) break;
            turn.bufferedTextChars -= turn.bufferedTextParts.get(oldestKey)!.text.length;
            retained.delete(turn.bufferedTextParts, oldestKey);
            turn.captureLoss.dropped = true;
            retained.recordDrop();
        }
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
        if (!rememberBounded(turn.sentAgentMessages, key, turn)) return;
        turn.nativeAgentMessageSeen = true;

        if (isNonEmptyString(messageID)) {
            const stored = turn.assistantMessages.get(messageID);
            if (stored) {
                const ids = Array.isArray(meta?.tool_use_ids) ? meta.tool_use_ids.filter(isNonEmptyString) : [];
                if (ids.length > MAX_TRACKED_MESSAGES_PER_TURN) { turn.captureLoss.dropped = true; retained.recordDrop(); }
                rememberAssistantMessage(sessionID, turn, messageID, {
                    ...stored,
                    text: ((stored.text ? stored.text + "\n" : "") + boundedText).slice(0, MAX_AGENT_MESSAGE_CHARS),
                    toolUseIDs: ids.length > 0 ? ids.slice(0, MAX_TRACKED_MESSAGES_PER_TURN) : stored.toolUseIDs,
                });
            }
        }

        await postEvent("AgentMessage", {
            session_id: sessionID,
            text: boundedText,
            message_truncated: boundedText.length !== originalLength,
            message_original_length: originalLength,
            model: meta?.model ?? turn.model,
            provider: meta?.provider,
            reasoning_effort: meta?.reasoningEffort,
            message_index: meta?.message_index,
            message_timestamp: meta?.message_timestamp,
            tool_use_ids: meta?.tool_use_ids,
            agent: meta?.agent,
            usage: isNonEmptyString(messageID) && meta?.usage && !turn.sentUsageMessages.has(messageID) &&
                rememberBounded(turn.sentUsageMessages, messageID, turn) ? meta.usage : undefined,
        }, turn);
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
                reasoningEffort: meta.reasoningEffort,
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
            if (!rememberBounded(turn.sentUsageMessages, messageID, turn)) continue;
            await postEvent("AgentUsage", {
                session_id: sessionID,
                message_id: messageID,
                model: meta.model ?? turn.model,
                provider: meta.provider,
                timestamp: meta.timestamp,
                usage: meta.usage,
            }, turn);
        }
    }

    function nativeRequests(turn: TurnRuntimeState): Record<string, unknown>[] {
        return [...turn.settledRequests.values(), ...[...turn.assistantMessages.values()]
            .filter((meta) => meta.usage !== undefined)
            .map((meta) => ({
                model: meta.model ?? turn.model,
                provider: meta.provider,
                reasoning_effort: meta.reasoningEffort,
                timestamp: meta.timestamp,
                text: meta.text,
                thinking_text: meta.thinkingText,
                tool_use_ids: meta.toolUseIDs,
                usage: meta.usage,
            }))];
    }

    function recordSessionParent(sessionID: string, parentSessionID: string | undefined): SessionRuntimeState {
        const state = sessionState(sessionID);
        if (parentSessionID && parentSessionID !== sessionID && !state.parentSessionID) {
            state.parentSessionID = parentSessionID;
        }
        return state;
    }

    async function ensureSessionStarted(sessionID: string): Promise<boolean> {
        if (endedSessionIDs.has(sessionID)) return false;
        const state = sessionState(sessionID);
        if (state.started) return true;
        state.started = true;
        lastSessionID = sessionID;
        await postEvent("SessionStart", {
            session_id: sessionID,
            cwd: workspace.directory,
            // OpenCode's global project, which holds every folder outside a Git repository, reports worktree "/".
            project_dir: workspace.worktree && workspace.worktree !== "/" ? workspace.worktree : workspace.directory,
            client_source: "kilo",
            parent_session_id: state.parentSessionID,
        });
        return true;
    }

    async function resolveAndStartSession(...values: unknown[]): Promise<SessionStartResolution> {
        const resolved = resolveSessionID(...values);
        if (resolved.kind !== "resolved") return { kind: resolved.kind };
        const sessionID = resolved.sessionID;
        if (!(await ensureSessionStarted(sessionID))) return { kind: "rejected" };
        return { kind: "started", sessionID };
    }

    function eventSessionID(resolution: SessionStartResolution): string | undefined {
        if (resolution.kind === "rejected" || resolution.kind === "invalid") return undefined;
        return resolution.kind === "started" ? resolution.sessionID : lastSessionID;
    }

    async function drainStops(sessionID: string, state: SessionRuntimeState): Promise<void> {
        while (true) {
            const turn = state.pendingStopTurns.shift();
            if (turn) {
                try {
                    await flushAssistantMessages(sessionID, turn);
                    await flushAssistantUsage(sessionID, turn);
                    await postEvent("Stop", { session_id: sessionID, native_requests: nativeRequests(turn), turn_snapshot_dropped: turn.captureLoss.dropped || undefined, failure_type: turn.failureType }, turn);
                } finally { releaseTurn(turn); }
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
            releaseTurn(turn);
            retained.recordDrop();
            state.coalescedStopCount = Math.min(state.coalescedStopCount + 1, MAX_COALESCED_STOP_PLACEHOLDERS);
        }
        if (!state.stopInFlight) state.stopInFlight = drainStops(sessionID, state);
        return state.stopInFlight;
    }

    async function ensureSessionStopped(sessionID: string): Promise<void> {
        const state = sessionState(sessionID);
        state.nativeChildActive = false;
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
        // Fence callbacks that were already queued when the terminal event was
        // observed. A provider-owned session.created event explicitly clears
        // this bounded tombstone before the same ID may start again.
        rememberEndedSession(sessionID);
        await ensureSessionStopped(sessionID);
        await postEvent("SessionEnd", { session_id: sessionID });
        removeSessionState(sessionID, state);
        if (lastSessionID === sessionID) lastSessionID = undefined;
    }

    async function completeSubagent(childSessionID: string): Promise<void> {
        const state = sessionStates.get(childSessionID);
        const link = state?.subagentLink;
        if (!link) return;
        state.subagentLink = undefined;
        link.parentChildren.count--;
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
        if (toolUseID.length > MAX_RETAINED_IDENTIFIER_CHARS) { retained.recordDrop(); return false; }
        const parentState = sessionState(parentSessionID);
        if (parentState.launchedTaskCalls.has(toolUseID)) return false;
        const state = sessionState(childSessionID);
        if (state.subagentLink) return false;
        if (!rememberBounded(parentState.launchedTaskCalls, toolUseID, parentState.activeTurn)) return false;
        // Share only the counter: a deleted/recreated parent must have a new
        // incarnation, and a live child must not retain its old turn payloads.
        state.subagentLink = { parentSessionID, childSessionID, toolUseID, parentChildren: parentState.activeChildren };
        parentState.activeChildren.count++;
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
        return isIdleStatusType(payload(properties?.status).type);
    }

    function isIdleStatusType(value: unknown): boolean {
        return typeof value === "string" && value.length <= 64 && value.trim().toLowerCase() === "idle";
    }

    // Completion retires the pending Task identity even when its result cannot
    // be captured. Read only bounded own data fields; never evaluate a native
    // accessor or traverse the rejected result to perform this cleanup.
    function clearCompletedTask(input: unknown): void {
        if (input === null || typeof input !== "object" || types.isProxy(input)) return;
        const tool = ownCaptureField(input, "tool");
        if (typeof tool !== "string" || tool.length > 64 || tool.trim().toLowerCase() !== "task") return;
        const resolved = resolveSessionID(input);
        const call = ownCaptureField(input, "callID");
        if (resolved.kind !== "resolved" || typeof call !== "string" || call.length > 512) return;
        const state = sessionStates.get(resolved.sessionID);
        if (state) retained.delete(state.pendingTaskCalls, call.trim());
    }

    function callbackSessionID(name: string, args: unknown[]): string | undefined {
        const event = name === "event" ? ownCaptureField(args[0], "event") : undefined;
        const values = name === "event" ? [args[0], event, ownCaptureField(event, "properties")] :
            name === "tool.execute.before" ? [args[0]] : [args[0], args[1]];
        for (const value of values) {
            const candidate = sessionIDCandidate(value);
            if (candidate !== undefined && candidate !== null) return typeof candidate === "string" && candidate.length <= 512 ? normalizeSessionID(candidate) : undefined;
        }
        return terminalCallbackType(args) === "session.deleted" ? lastSessionID : undefined;
    }

    let terminalCleanup: Promise<void> | undefined;
    // Terminal callbacks need only a bounded identity. Under preparation pressure,
    // keep one intent on the existing session and join the 64 admitted callbacks
    // before releasing its turn. Later callbacks cannot recreate the old state.
    function deferTerminalCleanup(sessionID: string, type: "session.idle" | "session.deleted"): void {
        const state = sessionStates.get(sessionID);
        if (!state) return;
        if (state.pendingTerminal !== "session.deleted") state.pendingTerminal = type;
        if (terminalCleanup) return;
        terminalCleanup = (async () => {
            try {
                await Promise.allSettled([...pendingCallbacks.values()]);
                for (;;) {
                    let next: [string, SessionRuntimeState] | undefined;
                    for (const entry of sessionStates) { if (entry[1].pendingTerminal) { next = entry; break; } }
                    if (!next) return;
                    const [id, candidate] = next;
                    const terminal = candidate.pendingTerminal!;
                    try { await handlers.event({ event: { type: terminal, properties: { sessionID: id } } }); }
                    catch (cause) { recordCallbackLoss(id, undefined, false, cause); }
                    finally { if (candidate.pendingTerminal === terminal) candidate.pendingTerminal = undefined; }
                }
            } finally { terminalCleanup = undefined; }
        })();
    }

    function terminalCallbackType(args: unknown[]): "session.idle" | "session.deleted" | undefined {
        const event = ownCaptureField(args[0], "event");
        const type = ownCaptureField(event, "type");
        if (type === "session.deleted" || type === "server.instance.disposed") return "session.deleted";
        if (type === "session.idle") return "session.idle";
        if (type === "session.status" && isIdleStatusType(ownCaptureField(ownCaptureField(ownCaptureField(event, "properties"), "status"), "type"))) return "session.idle";
        return undefined;
    }

    function createdCallbackParent(args: unknown[]): string | undefined {
        const event = ownCaptureField(args[0], "event");
        if (ownCaptureField(event, "type") !== "session.created") return undefined;
        const info = ownCaptureField(ownCaptureField(event, "properties"), "info");
        const parent = ownCaptureField(info, "parentID") ?? ownCaptureField(info, "parentId") ?? ownCaptureField(info, "parent_id");
        return typeof parent === "string" && parent.length <= 512 ? normalizeSessionID(parent) : undefined;
    }

    const handlers = {
        async event(ev: KiloPayload) {
            const event = ev?.event;
            if (!event) return;
            const type = event?.type;
            const properties = event?.properties;
            if (type === "server.instance.disposed" || type === "session.deleted") {
                const resolved = resolveSessionID(ev, event, properties);
                if (resolved.kind === "invalid") return;
                const sessionID = resolved.kind === "resolved" ? resolved.sessionID : lastSessionID;
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
                    endedSessionIDs.delete(childSessionID);
                    const childState = recordSessionParent(childSessionID, parentSessionID);
                    childState.createdAt ??= nonNegativeNumber(info?.time?.created);
                    if (!childState.creationObserved) {
                        childState.creationObserved = true;
                        childState.nativeChildActive = parentSessionID !== undefined && parentSessionID !== childSessionID;
                        const parentState = parentSessionID ? sessionStates.get(parentSessionID) : undefined;
                        const candidates = parentState?.pendingTaskCalls;
                        if (parentSessionID && parentState?.pendingTaskIdentityLost) recordCallbackLoss(parentSessionID);
                        if (parentSessionID && childSessionID !== parentSessionID && candidates?.size === 1 && !parentState?.pendingTaskIdentityLost) {
                            const toolUseID = candidates.values().next().value;
                            if (typeof toolUseID === "string" && (await startSubagent(parentSessionID, childSessionID, toolUseID))) {
                                retained.delete(candidates, toolUseID);
                            }
                        }
                    }
                }
            }
            if (isIdleSessionEvent(type, properties)) {
                const sessionID = eventSessionID(await resolveAndStartSession(ev, event, properties));
                if (sessionID) {
                    await ensureSessionStopped(sessionID);
                    await completeSubagent(sessionID);
                }
                return;
            }
            const sessionID = eventSessionID(await resolveAndStartSession(ev, event, properties));
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

            if (type === "session.error") {
                // OpenCode reports a final provider failure here, then reports
                // the session idle. The idle Stop carries the failure. A user
                // abort is not a failure.
                const failureType = sessionErrorType(properties?.error);
                const turn = sessionStates.get(sessionID)?.activeTurn;
                if (failureType && turn) turn.failureType = failureType;
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
                        properties?.decision ?? properties?.reply ?? properties?.status ?? properties?.result ?? properties?.response ?? properties?.action ?? properties?.choice,
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
            for (const [sessionID, state] of sessionStates) removeSessionState(sessionID, state);
            retained.clear(pendingSnapshotLoss);
            lastSessionID = undefined;
        },

        async "chat.message"(inp: KiloPayload, out: KiloPayload) {
            const resolution = await resolveAndStartSession(inp, out);
            if (resolution.kind !== "started") return;
            const sessionID = resolution.sessionID;
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
            const resolution = await resolveAndStartSession(inp);
            if (resolution.kind !== "started") return;
            const sessionID = resolution.sessionID;
            markTurnOpen(sessionID);
            if (typeof inp?.tool === "string" && inp.tool.trim().toLowerCase() === "task" && isNonEmptyString(inp?.callID)) {
                const toolUseID = inp.callID.trim();
                if (toolUseID.length > MAX_RETAINED_IDENTIFIER_CHARS) {
                    recordCallbackLoss(sessionID, undefined, true);
                } else {
                    const resumedChildSessionID = resumedTaskSessionID(inp, out);
                    if (resumedChildSessionID) {
                        retained.delete(sessionState(sessionID).pendingTaskCalls, toolUseID);
                        await startSubagent(sessionID, resumedChildSessionID, toolUseID);
                    } else {
                        const state = sessionState(sessionID);
                        const replaced = !state.pendingTaskCalls.has(toolUseID) && state.pendingTaskCalls.size >= MAX_TRACKED_MESSAGES_PER_TURN;
                        if (!rememberBounded(state.pendingTaskCalls, toolUseID, state.activeTurn) || replaced) state.pendingTaskIdentityLost = true;
                    }
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
            const resolution = await resolveAndStartSession(inp, out);
            if (resolution.kind !== "started") return;
            const sessionID = resolution.sessionID;
            const toolError = stringifyError(out?.error ?? out?.metadata?.error);
            markTurnOpen(sessionID);
            if (typeof inp?.tool === "string" && inp.tool.trim().toLowerCase() === "task" && isNonEmptyString(inp?.callID)) {
                const state = sessionStates.get(sessionID);
                if (state) retained.delete(state.pendingTaskCalls, inp.callID.trim());
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
            const resolution = await resolveAndStartSession(inp, out);
            if (resolution.kind !== "started") return;
            const sessionID = resolution.sessionID;
            if (!isNonEmptyString(out?.text)) return;
            const turn = markTurnOpen(sessionID);
            await emitAgentMessage(sessionID, turn, out.text, {
                messageID: inp?.messageID,
                partID: inp?.partID,
            });
        },
    };
    // Optional instrumentation must never reject a provider callback. Snapshot
    // inputs first so preparation cannot retain/mutate client-owned payloads.
    return Object.fromEntries(Object.entries(handlers).map(([name, handler]) => [name, (...args: unknown[]): Promise<void> => {
        if (disposed) return Promise.resolve();
        const sessionID = callbackSessionID(name, args);
        const parentSessionID = name === "event" ? createdCallbackParent(args) : undefined;
        const lossSessionID = parentSessionID ?? sessionID;
        const turn = lossSessionID ? sessionStates.get(lossSessionID)?.activeTurn : undefined;
        const tool = ownCaptureField(args[0], "tool");
        const taskIdentityLost = parentSessionID !== undefined || (name === "tool.execute.before" && typeof tool === "string" && tool.length <= 64 && tool.trim().toLowerCase() === "task");
        const failed = (cause?: unknown) => recordCallbackLoss(lossSessionID, turn, taskIdentityLost, cause);
        const terminal = name === "event" ? terminalCallbackType(args) : undefined;
        const deferTerminal = () => { if (terminal && sessionID) deferTerminalCleanup(sessionID, terminal); };
        if (name === "tool.execute.after") {
            try { clearCompletedTask(args[0]); } catch (cause) { failed(cause); }
        }
        if (name === "dispose") {
            disposed = true;
            return (async () => {
                try {
                    await Promise.allSettled(pendingCallbacks.values());
                    if (terminalCleanup) await terminalCleanup;
                    await (handler as () => Promise<void>)();
                } catch (cause) { failed(cause); }
                // Hosts may exit as soon as disposal settles. Wait for queued
                // delivery, bounded by the queue's 500 ms shutdown deadline.
                finally { await capture.close(); }
            })();
        }
        if (pendingCallbacks.size >= maxPendingCallbacks || (sessionID && sessionStates.get(sessionID)?.pendingTerminal)) {
            failed();
            deferTerminal();
            return Promise.resolve();
        }
        // A fixed slot identifier cannot grow with the host's lifetime.
        let slot = "";
        for (let index = 0; index < maxPendingCallbacks; index++) {
            if (!pendingCallbacks.has(String(index))) { slot = String(index); break; }
        }
        const work = (async () => {
            try {
                if (args.length > 2) throw new Error("optional capture argument count exceeded");
                let snapshots = args.map((value, index) => snapshotCapturePayload(name === "chat.message" && index === 1 ? promptCaptureOutput(value) : value));
                args = [];
                if (!prepared.set(preparedSnapshots, slot, snapshots, maxPendingCallbacks)) throw new Error("optional capture preparation full");
                snapshots = [];
                await (handler as (...values: unknown[]) => Promise<void>)(...preparedSnapshots.get(slot)!);
            } catch (cause) { failed(cause); deferTerminal(); }
            finally { args = []; prepared.delete(preparedSnapshots, slot); }
        })();
        pendingCallbacks.set(slot, work);
        void work.then(() => { pendingCallbacks.delete(slot); });
        return work;
    }]));
};
