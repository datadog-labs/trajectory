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
	usage?: unknown;
};

function finiteNonNegative(value: unknown): number | undefined {
	return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function nativeCostTotal(cost: unknown): number | undefined {
	if (typeof cost === "number") return finiteNonNegative(cost);
	if (!cost || typeof cost !== "object" || Array.isArray(cost)) return undefined;
	return finiteNonNegative((cost as Record<string, unknown>).total);
}

/**
 * Aggregate the provider requests in one Pi agent loop.
 *
 * Pi's turn_end is request-grain: it fires after every assistant/tool step.
 * agent_end.messages is the native complete list for the outer agent run, so
 * it is the only lifecycle payload suitable for one Trajectory turn total.
 */
export function aggregatePiAgentRun(messages: unknown): PiAgentRunAggregate {
	const result: PiAgentRunAggregate = {
		requestCount: 0,
		zeroUsageRequests: 0,
		modelStatus: "unavailable",
		costStatus: "unavailable",
	};
	if (!Array.isArray(messages)) return result;

	let input = 0;
	let output = 0;
	let cacheRead = 0;
	let cacheWrite = 0;
	let totalTokens = 0;
	let totalCost = 0;
	let costComplete = true;
	const models = new Set<string>();
	const providers = new Set<string>();

	for (const candidate of messages as PiAssistantMessage[]) {
		if (!candidate || candidate.role !== "assistant") continue;
		if (typeof candidate.model === "string" && candidate.model) models.add(candidate.model);
		if (typeof candidate.provider === "string" && candidate.provider) providers.add(candidate.provider);

		const rawUsage = candidate.usage;
		if (!rawUsage || typeof rawUsage !== "object" || Array.isArray(rawUsage)) continue;
		const usage = rawUsage as Record<string, unknown>;
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

/** Stable identity shared by the direct lifecycle write and HTTP POST. */
export class PiAgentRunTracker {
	private sessionId = "";
	private epoch = 0;
	private counter = 0;
	private activeRunId = "";
	private completedRunId = "";

	reset(sessionId: string, epoch = Date.now()): void {
		this.sessionId = sessionId;
		this.epoch = epoch;
		this.counter = 0;
		this.activeRunId = "";
		this.completedRunId = "";
	}

	start(): string {
		this.counter++;
		this.activeRunId = "pi-agent-run:" + this.sessionId + ":" + this.epoch + ":" + this.counter;
		return this.activeRunId;
	}

	complete(): string | undefined {
		if (!this.activeRunId) this.start();
		if (this.activeRunId === this.completedRunId) return undefined;
		this.completedRunId = this.activeRunId;
		return this.activeRunId;
	}
}
