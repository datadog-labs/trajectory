import { types } from "node:util";

export const MAX_CAPTURE_STATE_BYTES = 16 * 1024 * 1024;
export const MAX_CAPTURE_STATE_ENTRIES = 4096;
// A callback can own two snapshots, each with 4,096 nodes and depth 32.
const MAX_VALUE_NODES = 8194;
const MAX_VALUE_DEPTH = 34;

export interface CaptureStateSnapshot {
    bytes: number;
    entries: number;
    drops: number;
}

// Charge immutable, capture-owned JSON plus fixed entry bookkeeping. This is a
// retained-data budget; allocator overhead and whole-host RSS require native
// resource qualification independently.
function retainedBytes(key: string, value: unknown): number {
    let nodes = 0;
    let bytes = 256 + key.length * 2;
    const ancestors = new Set<object>();
    const visit = (item: unknown, depth: number): void => {
        if (++nodes > MAX_VALUE_NODES || depth > MAX_VALUE_DEPTH) throw new Error("capture state too complex");
        bytes += typeof item === "string" ? item.length * 2 + 32 : 32;
        if (bytes > MAX_CAPTURE_STATE_BYTES) throw new Error("capture state too large");
        if (typeof item === "function" || typeof item === "symbol" || typeof item === "bigint") throw new Error("capture state is not JSON");
        if (item === null || typeof item !== "object") return;
        if (types.isProxy(item)) throw new Error("capture state proxy");
        const prototype = Object.getPrototypeOf(item);
        if (prototype !== (Array.isArray(item) ? Array.prototype : Object.prototype) && prototype !== null) throw new Error("capture state is not JSON");
        if (Array.isArray(item) && item.length > MAX_VALUE_NODES) throw new Error("capture state array too large");
        if (ancestors.has(item)) throw new Error("cyclic capture state");
        ancestors.add(item);
        for (const field in item) {
            const descriptor = Object.getOwnPropertyDescriptor(item, field);
            if (!descriptor) continue;
            bytes += field.length * 2 + 32;
            if (!("value" in descriptor)) throw new Error("capture state accessor");
            visit(descriptor.value, depth + 1);
        }
        ancestors.delete(item);
    };
    visit(value, 0);
    return bytes;
}

function detachString(value: string): string {
    return Buffer.from(value, "utf16le").toString("utf16le");
}

// Admission already checked complexity and descriptors. Detach derived slices
// as well as their keys so a short trimmed value cannot retain a large backing.
function detachValue(value: unknown): unknown {
    if (typeof value === "string") return detachString(value);
    if (value === null || typeof value !== "object") return value;
    const owned = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
    for (const key of Object.keys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        Object.defineProperty(owned, detachString(key), { value: detachValue(descriptor.value), enumerable: true, configurable: true, writable: true });
    }
    if (Array.isArray(value)) owned.length = value.length;
    return owned;
}

type Container = Map<string, unknown> | Set<string>;

/** One admission owner across all retained capture containers in a plugin
 * instance. Callers release containers when their owning turn/session ends. */
export class CaptureStateBudget {
    private readonly charges = new WeakMap<object, Map<string, number>>();
    private bytes = 0;
    private entries = 0;
    private drops = 0;
    private readonly onDrop?: () => void;

    constructor(onDrop?: () => void) { this.onDrop = onDrop; }

    snapshot(): CaptureStateSnapshot {
        return { bytes: this.bytes, entries: this.entries, drops: this.drops };
    }

    recordDrop(): void {
        this.drops = Math.min(Number.MAX_SAFE_INTEGER, this.drops + 1);
        try { this.onDrop?.(); } catch { /* Reporting cannot reject admission. */ }
    }

    set<Value>(container: Map<string, Value>, key: string, value: Value, capacity: number): boolean {
        return this.admit(container as Map<string, unknown>, key, value, capacity);
    }

    add(container: Set<string>, key: string, capacity: number): boolean {
        return this.admit(container, key, undefined, capacity);
    }

    delete(container: Container, key: string): void {
        const ledger = this.charges.get(container);
        const charge = ledger?.get(key);
        if (charge !== undefined) {
            this.bytes -= charge;
            this.entries--;
            ledger!.delete(key);
        }
        container.delete(key);
    }

    clear(container: Container): void {
        const ledger = this.charges.get(container);
        if (ledger) {
            for (const charge of ledger.values()) this.bytes -= charge;
            this.entries -= ledger.size;
            this.charges.delete(container);
        }
        container.clear();
    }

    private admit(container: Container, key: string, value: unknown, capacity: number): boolean {
        if (!Number.isSafeInteger(capacity) || capacity < 1) { this.recordDrop(); return false; }
        let charge: number;
        try { charge = retainedBytes(key, value); } catch { this.recordDrop(); return false; }
        const ledger = this.charges.get(container) ?? new Map<string, number>();
        const previous = ledger.get(key);
        const victim = previous === undefined && container.size >= capacity ? container.keys().next().value : undefined;
        const victimCharge = victim === undefined ? 0 : ledger.get(victim) ?? 0;
        const nextBytes = this.bytes - (previous ?? 0) - victimCharge + charge;
        const nextEntries = this.entries + (previous === undefined ? 1 : 0) - (victim === undefined ? 0 : 1);
        // Rejected replacements leave admitted data and order unchanged.
        if (nextBytes > MAX_CAPTURE_STATE_BYTES || nextEntries > MAX_CAPTURE_STATE_ENTRIES) {
            this.recordDrop();
            return false;
        }
        let ownedKey: string;
        let ownedValue: unknown;
        try { ownedKey = detachString(key); ownedValue = detachValue(value); }
        catch { this.recordDrop(); return false; }
        if (victim !== undefined) { this.delete(container, victim); this.recordDrop(); }
        container.delete(key);
        ledger.delete(key);
        if (container instanceof Map) container.set(ownedKey, ownedValue);
        else container.add(ownedKey);
        ledger.set(ownedKey, charge);
        this.charges.set(container, ledger);
        this.bytes = nextBytes;
        this.entries = nextEntries;
        return true;
    }
}
