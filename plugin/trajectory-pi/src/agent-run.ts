import type { PiModelPricing } from "./model-pricing.ts";

export interface PiAgentRunAggregate {
	usage?: Record<string, unknown>;
	requestCount: number;
	zeroUsageRequests: number;
	model?: string;
	provider?: string;
	modelStatus: "single" | "mixed" | "unavailable";
	costStatus: "native_exact" | "unavailable";
}

type PiAssistantMessage = {
	role?: unknown;
	model?: unknown;
	provider?: unknown;
	api?: unknown;
	usage?: unknown;
	model_pricing?: PiModelPricing;
	observed_at?: string;
};

export interface PiAgentRunRequest {
	model?: string;
	provider?: string;
	api?: string;
	usage: Record<string, unknown>;
	model_pricing?: PiModelPricing;
	observed_at?: string;
}

function finiteNonNegative(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function nativeCostTotal(cost: unknown): number | undefined {
	if (typeof cost === "number") return finiteNonNegative(cost);
	if (!cost || typeof cost !== "object" || Array.isArray(cost)) return undefined;
	return finiteNonNegative((cost as Record<string, unknown>).total);
}

/**
 * Aggregate the provider requests in one settled Pi interaction.
 *
 * Pi's turn_end is request-grain: it fires after every assistant/tool step.
 * Each agent_end contains one low-level run, while retries and queued
 * continuations can produce additional runs before agent_settled.
 */
export function aggregatePiAgentRun(messages: unknown): PiAgentRunAggregate {
	const result: PiAgentRunAggregate = {
		requestCount: 0,
		zeroUsageRequests: 0,
		modelStatus: "unavailable",
		costStatus: "unavailable",
	};
	let input = 0;
	let output = 0;
	let cacheRead = 0;
	let cacheWrite = 0;
	let totalTokens = 0;
	let totalCost = 0;
	let costComplete = true;
	const models = new Set<string>();
	const providers = new Set<string>();

	for (const candidate of summarizePiAgentRunRequests(messages)) {
		if (candidate.model) models.add(candidate.model);
		if (candidate.provider) providers.add(candidate.provider);
		const usage = candidate.usage;
		result.requestCount++;

		const requestInput = finiteNonNegative(usage.input) ?? 0;
		const requestOutput = finiteNonNegative(usage.output) ?? 0;
		const requestCacheRead = finiteNonNegative(usage.cacheRead) ?? 0;
		const requestCacheWrite = finiteNonNegative(usage.cacheWrite) ?? 0;
		const requestTotal = finiteNonNegative(usage.totalTokens) ??
			(requestInput + requestOutput + requestCacheRead + requestCacheWrite);
		const requestCost = nativeCostTotal(usage.cost);

		input += requestInput;
		output += requestOutput;
		cacheRead += requestCacheRead;
		cacheWrite += requestCacheWrite;
		totalTokens += requestTotal;
		if (requestCost === undefined) costComplete = false;
		else totalCost += requestCost;

		if (requestTotal === 0 && (requestCost ?? 0) === 0) result.zeroUsageRequests++;
	}

	if (result.requestCount > 0) {
		result.usage = { input, output, cacheRead, cacheWrite, totalTokens };
		if (costComplete) {
			result.usage.cost = { total: totalCost };
			result.costStatus = "native_exact";
		}
	}

	if (models.size === 1) {
		result.model = models.values().next().value;
		result.modelStatus = "single";
	} else if (models.size > 1) {
		result.model = "mixed";
		result.modelStatus = "mixed";
	}
	if (providers.size === 1) result.provider = providers.values().next().value;
	else if (providers.size > 1) result.provider = "mixed";

	return result;
}

// summarizePiAgentRunRequests strips message content before handing request
// evidence to Trajectory. The Go provider mapper owns canonical aggregation;
// aggregatePiAgentRun remains as the backward-compatible payload for older
// Trajectory binaries during rolling plugin refreshes.
export function summarizePiAgentRunRequests(messages: unknown): PiAgentRunRequest[] {
	if (!Array.isArray(messages)) return [];
	const requests: PiAgentRunRequest[] = [];
	for (const candidate of messages as PiAssistantMessage[]) {
		if (!candidate || candidate.role !== "assistant") continue;
		const rawUsage = candidate.usage;
		if (!rawUsage || typeof rawUsage !== "object" || Array.isArray(rawUsage)) continue;
		const sourceUsage = rawUsage as Record<string, unknown>;
		const usage: Record<string, unknown> = {};
		for (const key of ["input", "output", "cacheRead", "cacheWrite", "totalTokens"]) {
			const value = finiteNonNegative(sourceUsage[key]);
			if (value !== undefined) usage[key] = value;
		}
		// Invalid optional counters must remain invalid for Go's pricing owner.
		// Keep only a bounded numeric sentinel, never malformed provider content.
		for (const key of ["reasoning", "reasoningOutput", "reasoningOutputTokens"]) {
			if (Object.hasOwn(sourceUsage, key) && sourceUsage[key] != null) usage[key] = finiteNonNegative(sourceUsage[key]) ?? -1;
		}
		const cost = nativeCostTotal(sourceUsage.cost);
		if (cost !== undefined && (!candidate.model_pricing || candidate.model_pricing.status === "configured")) usage.cost = { total: cost };
		const request: PiAgentRunRequest = { usage };
		if (candidate.model_pricing) request.model_pricing = candidate.model_pricing;
		if (candidate.observed_at) request.observed_at = candidate.observed_at;
		if (typeof candidate.model === "string" && candidate.model) request.model = candidate.model;
		if (typeof candidate.provider === "string" && candidate.provider) request.provider = candidate.provider;
		if (typeof candidate.api === "string" && candidate.api) request.api = candidate.api;
		requests.push(request);
	}
	return requests;
}

/** Stable identity shared by the direct lifecycle write and HTTP POST. */
export class PiAgentRunTracker {
	private sessionId = "";
	private epoch = 0;
	private counter = 0;
	private activeRunId = "";

	reset(sessionId: string, epoch = Date.now()): void {
		this.sessionId = sessionId;
		this.epoch = epoch;
		this.counter = 0;
		this.activeRunId = "";
	}

	start(): string {
		if (this.activeRunId) return this.activeRunId;
		this.counter++;
		this.activeRunId = "pi-agent-run:" + this.sessionId + ":" + this.epoch + ":" + this.counter;
		return this.activeRunId;
	}

	complete(): string | undefined {
		if (!this.activeRunId) return undefined;
		const completed = this.activeRunId;
		this.activeRunId = "";
		return completed;
	}
}
