import { open } from "node:fs/promises";
import { constants } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

type Rates = { input: number; output: number; cacheRead: number; cacheWrite: number };
type Model = { id?: string; provider?: string; cost?: unknown };
export type PiModelPricing = {
	schema_version: 1;
	model: string;
	provider: string;
	status: "configured" | "missing" | "unavailable";
	rates?: Rates;
};

type PricingSnapshot = { model_pricing: PiModelPricing; observed_at: string };
type MessageIdentity = { model?: unknown; provider?: unknown; timestamp?: unknown; usage?: unknown };

// agent_end can retain copies of message_end objects. Match only complete
// request identities, never content or array position; conflicting snapshots
// and a full bounded index fail closed.
export class PiPricingSnapshots {
	private objects = new WeakMap<object, PricingSnapshot>();
	private requests = new Map<string, PricingSnapshot | undefined>();
	private key(message: MessageIdentity): string | undefined {
		if (typeof message.timestamp !== "number" || !Number.isFinite(message.timestamp)) return;
		return JSON.stringify([message.provider, message.model, message.timestamp]);
	}
	set(message: MessageIdentity, snapshot: PricingSnapshot): void {
		this.objects.set(message, snapshot);
		const key = this.key(message);
		if (!key) return;
		if (this.requests.has(key)) {
			if (JSON.stringify(this.requests.get(key)) !== JSON.stringify(snapshot)) this.requests.set(key, undefined);
		} else if (this.requests.size < 4096) this.requests.set(key, snapshot);
	}
	get(message: MessageIdentity): PricingSnapshot | undefined {
		const key = this.key(message);
		if (key && this.requests.has(key)) return this.requests.get(key);
		return this.objects.get(message);
	}
	forget(message: MessageIdentity): void {
		const key = this.key(message);
		if (key) this.requests.delete(key);
		this.objects.delete(message);
	}
}

function rates(value: unknown): Rates | undefined {
	if (!value || typeof value !== "object" || Array.isArray(value)) return;
	const source = value as Record<string, unknown>;
	const result: Record<string, number> = {};
	for (const key of ["input", "output", "cacheRead", "cacheWrite"]) {
		const value = source[key];
		if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return;
		result[key] = value;
	}
	return result as Rates;
}

// Pi fills omitted custom model costs with zeros. Only an exact, explicit
// models.json entry distinguishes those defaults from intentionally free rates.
// Never export the config: it can contain credentials and command-based auth.
export function classifyPiModelPricing(model: Model | undefined, config: unknown): PiModelPricing {
	const result: PiModelPricing = {
		schema_version: 1, model: model?.id ?? "", provider: model?.provider ?? "", status: "unavailable",
	};
	if (!result.model || !result.provider) return result;
	const effective = rates(model?.cost);
	if (!effective) return result;
	const providers = (config as { providers?: Record<string, { models?: unknown }> } | undefined)?.providers;
	const models = providers?.[result.provider]?.models;
	const matches = Array.isArray(models) ? models.filter((entry) => entry?.id === result.model) : [];
	if (matches.length === 0 && Object.values(effective).some((value) => value > 0)) {
		return { ...result, status: "configured", rates: effective };
	}
	if (matches.length !== 1) return result;
	const entry = matches[0];
	if (!Object.hasOwn(entry, "cost")) {
		return Object.values(effective).every((value) => value === 0) ? { ...result, status: "missing" } : result;
	}
	const configured = rates(entry.cost);
	if (configured && (Object.keys(configured) as Array<keyof Rates>).every((key) => configured[key] === effective[key])) {
		return { ...result, status: "configured", rates: configured };
	}
	return result;
}

// Called from lifecycle callbacks only. Bound the read even if the file grows
// after stat; directories, oversized files, malformed JSON and errors stay unknown.
export async function readPiModelsConfig(environment = process.env): Promise<unknown> {
	const path = join(environment.PI_CODING_AGENT_DIR || join(environment.HOME || homedir(), ".pi", "agent"), "models.json");
	let file;
	try {
		file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
		const info = await file.stat();
		const limit = 1024 * 1024;
		if (!info.isFile() || info.size > limit) return;
		const buffer = Buffer.alloc(limit + 1);
		const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
		if (bytesRead > limit) return;
		return JSON.parse(buffer.subarray(0, bytesRead).toString("utf8"));
	} catch {
		return;
	} finally {
		await file?.close().catch(() => {});
	}
}
