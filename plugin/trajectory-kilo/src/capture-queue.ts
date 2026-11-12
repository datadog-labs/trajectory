import { randomBytes } from "node:crypto";
import { types } from "node:util";

export const MAX_CAPTURE_ITEMS = 256;
export const MAX_CAPTURE_BYTES = 8 * 1024 * 1024;
export const MAX_CAPTURE_EVENT_BYTES = 1024 * 1024;
const RESERVED_ITEMS = 16;
const RESERVED_BYTES = MAX_CAPTURE_EVENT_BYTES;
const MAX_PAYLOAD_NODES = 4096;
export const MAX_CAPTURE_PAYLOAD_NODES = MAX_PAYLOAD_NODES;
const MAX_PAYLOAD_DEPTH = 32;
const POST_TIMEOUT_MS = 5000;
const SHUTDOWN_TIMEOUT_MS = 500;
// Reserve room for a loss flag added after admission, including to queued Stops.
const STOP_LOSS_FLAG_BYTES = 32;

// A queue entry shares only this boolean with its turn, never provider objects,
// text buffers, callbacks, or the full turn state. Lifetime is bounded by slots.
export interface CaptureLossMarker { dropped: boolean; }
const MAX_DELIVERY_ATTEMPTS = 3;
const MAX_RECOVERY_MS = 20_000;
const RETRY_DELAYS_MS = [100, 500];
// A capture server that cannot start must not cost a process for every event.
const SERVER_START_RETRY_MS = 30_000;
const DIAGNOSTIC_RETRY_DELAYS_MS = [100, 500];

/** Asks for the capture server when no listener answered a POST. Resolves true
 * once the server is ready, and false on refusal, deadline or abort. */
export type CaptureServerStart = (headers: Record<string, string>, signal: AbortSignal) => Promise<boolean>;

export type CaptureLossReason = "queue_declined" | "preparation_declined" | "state_declined" | "delivery_unconfirmed" | "shutdown_unconfirmed";
export type CaptureLossCounts = Record<CaptureLossReason, number>;

/** Content-free cumulative findings for the native client's structured log.
 * Checkpoints at powers of two bound a host to 55 checkpoints, each with at
 * most three attempts (165 small requests over the plugin's lifetime).
 * A cancelled but unsettled logger retains its physical slot. */
export class CaptureLossReporter {
    private readonly counts: CaptureLossCounts = {
        queue_declined: 0, preparation_declined: 0, state_declined: 0,
        delivery_unconfirmed: 0, shutdown_unconfirmed: 0,
    };
    private generation = 0;
    private nextCheckpoint = 0;
    private active = false;
    private scheduled = false;
    private readonly log?: (counts: CaptureLossCounts, signal: AbortSignal) => Promise<unknown>;

    constructor(log?: (counts: CaptureLossCounts, signal: AbortSignal) => Promise<unknown>) {
        this.log = log;
        this.schedule();
    }

    record(reason: CaptureLossReason): void {
        this.counts[reason] = Math.min(Number.MAX_SAFE_INTEGER, this.counts[reason] + 1);
        this.generation = Math.min(Number.MAX_SAFE_INTEGER, this.generation + 1);
        this.schedule();
    }

    private schedule(): void {
        if (!this.log || this.active || this.scheduled || this.generation < this.nextCheckpoint) return;
        this.scheduled = true;
        queueMicrotask(() => { this.scheduled = false; void this.report(); });
    }

    private async report(): Promise<void> {
        if (!this.log || this.active || this.generation < this.nextCheckpoint) return;
        this.active = true;
        // Exhausting a checkpoint must not create a retry loop. Later findings
        // can trigger another checkpoint, which still includes earlier losses.
        this.nextCheckpoint = this.generation === Number.MAX_SAFE_INTEGER ? Infinity
            : this.generation === 0 ? 1
            : Math.min(Number.MAX_SAFE_INTEGER, 2 ** (Math.floor(Math.log2(this.generation)) + 1));
        try {
            for (let attempt = 0; attempt <= DIAGNOSTIC_RETRY_DELAYS_MS.length; attempt++) {
                if (attempt > 0) await new Promise<void>((resolve) => {
                    const retry = setTimeout(resolve, DIAGNOSTIC_RETRY_DELAYS_MS[attempt - 1]);
                    retry.unref?.();
                });
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), 250);
                timer.unref?.();
                try { await this.log({ ...this.counts }, controller.signal); break; }
                catch { /* Native logging is optional; never use console/UI fallback. */ }
                finally { clearTimeout(timer); controller.abort(); }
            }
        } finally {
            this.active = false;
            this.schedule();
        }
    }
}

interface CaptureEntry {
    event: string;
    body: string;
    bytes: number;
    deliveryID: string;
    priority: number;
    loss?: CaptureLossMarker;
    headers?: Record<string, string>;
}

export interface CaptureSnapshot {
    depth: number;
    bytes: number;
    accepted: number;
    transportFailures: number;
    httpFailures: number;
    preparationFailures: number;
    queueDrops: number;
    shutdownDrops: number;
    unconfirmedDeliveries: number;
}

// Copy native JSON data without invoking getters/toJSON or retaining provider
// objects. Traversal, retained strings, and the subsequent stringify are bounded.
export function snapshotCapturePayload(value: unknown): unknown {
    let nodes = 0;
    let bytes = 0;
    const ancestors = new Set<object>();
    const charge = (size: number) => {
        bytes += size;
        if (bytes > MAX_CAPTURE_EVENT_BYTES) throw new Error("capture payload too large");
    };
    const copy = (item: unknown, depth: number): unknown => {
        if (++nodes > MAX_PAYLOAD_NODES || depth > MAX_PAYLOAD_DEPTH) throw new Error("capture payload too complex");
        charge(8);
        if (typeof item === "string") {
            if (item.length > MAX_CAPTURE_EVENT_BYTES) throw new Error("capture string too large");
            charge(Buffer.byteLength(item, "utf8"));
            // Detach sliced/rope strings from arbitrarily large client-owned
            // backing storage. UTF-16 preserves lone surrogates exactly.
            return Buffer.from(item, "utf16le").toString("utf16le");
        }
        if (item == null || typeof item === "boolean" || typeof item === "number" || item === undefined) return item;
        if (typeof item !== "object") throw new Error("capture payload is not JSON");
        if (types.isProxy(item)) throw new Error("capture payload is a proxy");
        const prototype = Object.getPrototypeOf(item);
        if (prototype !== (Array.isArray(item) ? Array.prototype : Object.prototype) && prototype !== null) throw new Error("capture payload is not plain JSON");
        if (Array.isArray(item) && item.length > MAX_PAYLOAD_NODES) throw new Error("capture array too large");
        if (ancestors.has(item)) throw new Error("cyclic capture payload");
        ancestors.add(item);
        const result: Record<string, unknown> | unknown[] = Array.isArray(item) ? [] : Object.create(null);
        // Enumerate only own keys. for-in also scans shared prototypes even
        // when inherited values are skipped or traversal stops at the first one.
        const keys = Object.keys(item);
        if (keys.length > MAX_PAYLOAD_NODES - nodes) throw new Error("capture payload too complex");
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(item, key);
            if (!descriptor) continue;
            if (!("value" in descriptor)) throw new Error("capture payload has an accessor");
            if (key.length > MAX_CAPTURE_EVENT_BYTES) throw new Error("capture key too large");
            charge(Buffer.byteLength(key, "utf8") + 4);
            const ownedKey = Buffer.from(key, "utf16le").toString("utf16le");
            Object.defineProperty(result, ownedKey, { value: copy(descriptor.value, depth + 1), enumerable: true, configurable: true, writable: true });
        }
        if (Array.isArray(item)) (result as unknown[]).length = item.length;
        ancestors.delete(item);
        return result;
    };
    return copy(value, 0);
}

/** Owns bounded admission, ordered transport, outcome counts, and shutdown for
 * one OpenCode-compatible plugin host. Nothing starts at module import. */
export class CaptureQueue {
    private readonly pending: CaptureEntry[] = [];
    private active?: CaptureEntry;
    private controller?: AbortController;
    private bytes = 0;
    private scheduled = false;
    private closing = false;
    private closed = false;
    private readonly counts = { accepted: 0, transportFailures: 0, httpFailures: 0, preparationFailures: 0, queueDrops: 0, shutdownDrops: 0, unconfirmedDeliveries: 0 };

    private readonly send = globalThis.fetch.bind(globalThis);
    private readonly url: string;
    private readonly headers: () => Promise<Record<string, string>>;
    private readonly onClosed: () => void;
    private readonly startServer?: CaptureServerStart;
    private serverStart?: AbortController;
    private nextServerStart = 0;
    private unreachable = false;
    private lossUnassigned = false;
    private readonly onLoss?: (reason: CaptureLossReason) => void;
    private shutdownTimer?: ReturnType<typeof setTimeout>;
    private wakeRetry?: () => void;
    private resolveClosed: () => void = () => {};
    private readonly closedPromise = new Promise<void>((resolve) => { this.resolveClosed = resolve; });

    constructor(url: string, headers: () => Promise<Record<string, string>>, onLoss?: (reason: CaptureLossReason) => void, onClosed: () => void = () => {}, startServer?: CaptureServerStart) {
        this.url = url;
        this.headers = headers;
        this.onLoss = onLoss;
        this.onClosed = onClosed;
        this.startServer = startServer;
    }

    preparationFailed(): void {
        this.increment("preparationFailures");
        this.recordLoss("preparation_declined");
    }

    enqueue(event: string, data: unknown, loss?: CaptureLossMarker): boolean {
        if (this.closed || this.closing) {
            this.increment("shutdownDrops");
            return false;
        }
        const priority = event === "SessionEnd" ? 2 : ["SessionStart", "Stop", "SubagentStart", "SubagentStop"].includes(event) ? 1 : 0;
        const itemLimit = priority === 0 ? MAX_CAPTURE_ITEMS - RESERVED_ITEMS : MAX_CAPTURE_ITEMS;
        const byteLimit = priority === 0 ? MAX_CAPTURE_BYTES - RESERVED_BYTES : MAX_CAPTURE_BYTES;
        if (priority === 0 && (this.depth() >= itemLimit || this.bytes >= byteLimit)) {
            this.increment("queueDrops");
            return false;
        }
        try {
            const body = JSON.stringify(snapshotCapturePayload(data));
            if (body === undefined) throw new Error("capture payload did not serialize to JSON");
            const bytes = Buffer.byteLength(body, "utf8") + (event === "Stop" ? STOP_LOSS_FLAG_BYTES : 0);
            if (bytes > MAX_CAPTURE_EVENT_BYTES) throw new Error("encoded capture too large");
            // Plan eviction first: a rejected replacement must leave previously
            // admitted work untouched, including its order and delivery IDs.
            const replacements: number[] = [];
            let remainingDepth = this.depth();
            let remainingBytes = this.bytes;
            for (let candidatePriority = 0; candidatePriority < priority; candidatePriority++) {
                for (let index = this.pending.length - 1; index >= 0; index--) {
                    if (remainingDepth < itemLimit && remainingBytes + bytes <= byteLimit) break;
                    if (this.pending[index].priority !== candidatePriority) continue;
                    replacements.push(index);
                    remainingDepth--;
                    remainingBytes -= this.pending[index].bytes;
                }
            }
            if (remainingDepth >= itemLimit || remainingBytes + bytes > byteLimit) {
                this.increment("queueDrops");
                return false;
            }
            const entry = { event, body, bytes, deliveryID: `dly_${randomBytes(16).toString("hex")}`, priority, loss };
            for (const index of replacements.sort((left, right) => right - left)) {
                const [dropped] = this.pending.splice(index, 1);
                this.bytes -= dropped.bytes;
                this.increment("queueDrops");
                if (dropped.loss) dropped.loss.dropped = true;
                else {
                    this.lossUnassigned = true;
                }
            }
            this.pending.push(entry);
            this.bytes += bytes;
            this.schedule();
            return true;
        } catch {
            this.preparationFailed();
            return false;
        }
    }

    hasUnassignedLoss(): boolean { return this.lossUnassigned; }

    snapshot(): CaptureSnapshot {
        return { depth: this.depth(), bytes: this.bytes, ...this.counts };
    }

    /** Resolves when the queue drains or at the shutdown deadline, whichever
     * comes first. `opencode run` exits right after disposal, so the caller
     * awaits this instead of leaving the final Stop and SessionEnd in flight.
     * A blocked transport cannot extend the deadline. */
    close(): Promise<void> {
        if (this.closing || this.closed) return this.closedPromise;
        this.closing = true;
        this.wakeRetry?.();
        if (this.depth() === 0) { this.finishClose(); return this.closedPromise; }
        this.shutdownTimer = setTimeout(() => {
            this.dropPendingForShutdown();
            if (this.active) this.increment("shutdownDrops");
            this.controller?.abort();
            this.serverStart?.abort();
            this.finishClose();
        }, SHUTDOWN_TIMEOUT_MS);
        // Keep this timer referenced: a host awaiting disposal must not exit
        // while home selection, which holds no reference, is still pending.
        // Shutdown keeps the host alive for at most this deadline.
        return this.closedPromise;
    }

    private finishClose(): void {
        if (this.closed) return;
        this.closed = true;
        clearTimeout(this.shutdownTimer);
        this.resolveClosed();
        // Header resources must outlive delivery, but never the queue's bound.
        try { this.onClosed(); } catch { /* Optional cleanup cannot reject the host. */ }
    }

    private dropPendingForShutdown(): void {
        for (const entry of this.pending.splice(0)) {
            this.bytes -= entry.bytes;
            this.increment("shutdownDrops");
        }
    }

    private increment(name: keyof typeof this.counts): void {
        this.counts[name] = Math.min(Number.MAX_SAFE_INTEGER, this.counts[name] + 1);
        if (name === "queueDrops") this.recordLoss("queue_declined");
        else if (name === "shutdownDrops") this.recordLoss("shutdown_unconfirmed");
        else if (name === "unconfirmedDeliveries") this.recordLoss("delivery_unconfirmed");
    }

    private recordLoss(reason: CaptureLossReason): void {
        try { this.onLoss?.(reason); } catch { /* Reporting cannot reject capture. */ }
    }

    private depth(): number { return this.pending.length + (this.active ? 1 : 0); }

    private schedule(): void {
        if (this.active || this.scheduled || this.closed || this.pending.length === 0) return;
        this.scheduled = true;
        queueMicrotask(() => { this.scheduled = false; void this.deliverNext(); });
    }

    private async deliverNext(): Promise<void> {
        if (this.active || this.closed) return;
        const entry = this.pending.shift();
        if (!entry) return;
        this.active = entry;
        const deadline = performance.now() + MAX_RECOVERY_MS;
        let accepted = false;
        try {
            for (let attempt = 0; attempt < MAX_DELIVERY_ATTEMPTS && !this.closed; attempt++) {
                if (attempt > 0 && this.closing) break;
                if (await this.deliverAttempt(entry, Math.min(POST_TIMEOUT_MS, deadline - performance.now()))) {
                    accepted = true;
                    return;
                }
                if (this.closed) return;
                if (this.closing || attempt + 1 === MAX_DELIVERY_ATTEMPTS) break;
                // No listener answered. Later events wait in order behind this
                // one while the server starts, then this one is sent again.
                if (this.unreachable && await this.requestServerStart(entry)) continue;
                if (this.closed) return;
                const delay = RETRY_DELAYS_MS[attempt];
                if (performance.now() + delay >= deadline) break;
                await this.waitBeforeRetry(delay);
            }
            if (!this.closed) this.increment("unconfirmedDeliveries");
        } finally {
            // Healthy delivery may drain within the existing shutdown window.
            // A failed active event ends that drain: pending events have never
            // been sent and must be classified before an idle host exits.
            if (this.closing && !accepted) this.dropPendingForShutdown();
            this.bytes -= entry.bytes;
            this.active = undefined;
            this.controller = undefined;
            if (this.closing && this.depth() === 0) {
                this.finishClose();
            }
            this.schedule();
        }
    }

    private async requestServerStart(entry: CaptureEntry): Promise<boolean> {
        if (!this.startServer || !entry.headers || this.closing || performance.now() < this.nextServerStart) return false;
        this.nextServerStart = performance.now() + SERVER_START_RETRY_MS;
        const controller = new AbortController();
        this.serverStart = controller;
        try { return await this.startServer(entry.headers, controller.signal) && !this.closed; }
        catch { return false; }
        finally { this.serverStart = undefined; }
    }

    private waitBeforeRetry(delay: number): Promise<void> {
        return new Promise((resolve) => {
            const done = () => {
                clearTimeout(timer);
                this.wakeRetry = undefined;
                resolve();
            };
            const timer = setTimeout(done, delay);
            timer.unref?.();
            this.wakeRetry = done;
        });
    }

    private async deliverAttempt(entry: CaptureEntry, timeout: number): Promise<boolean> {
        if (timeout <= 0) return false;
        const controller = new AbortController();
        this.controller = controller;
        let timedOut = false;
        let preparing = true;
        this.unreachable = false;
        const timer = setTimeout(() => {
            if (this.closed) return;
            timedOut = true;
            if (preparing) this.preparationFailed();
            else this.increment("transportFailures");
            controller.abort();
        }, timeout);
        timer.unref?.();
        try {
            let headers: Record<string, string>;
            try { headers = entry.headers ?? await this.headers(); } catch {
                if (!timedOut && !this.closed) this.preparationFailed();
                return false;
            }
            if (controller.signal.aborted) return false;
            // Delivery deduplication requires the selected home. A retry must
            // never replay an unreceipted request into the server's default home.
            if (!headers["X-Trajectory-Home"]?.trim()) {
                this.preparationFailed();
                return false;
            }
            if (!entry.headers) {
                // Freeze the loss flag together with the selected home before
                // the first POST. Retries retain identical content and identity.
                if (entry.event === "Stop" && (entry.loss?.dropped || this.lossUnassigned)) {
                    const snapshot = JSON.parse(entry.body);
                    snapshot.turn_snapshot_dropped = true;
                    entry.body = JSON.stringify(snapshot);
                }
                entry.headers = headers;
            }
            preparing = false;
            const response = await this.send(this.url + "/" + entry.event, {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json", "X-Trajectory-Capture-Delivery-ID": entry.deliveryID },
                body: entry.body,
                signal: controller.signal,
            });
            if (!controller.signal.aborted) this.increment(response.ok ? "accepted" : "httpFailures");
            return !controller.signal.aborted && response.ok;
        } catch {
            if (!timedOut && !this.closed) {
                this.increment("transportFailures");
                // The transport failed by itself, before any deadline.
                this.unreachable = !preparing;
            }
            return false;
        } finally {
            clearTimeout(timer);
            controller.abort();
            this.controller = undefined;
        }
    }
}
