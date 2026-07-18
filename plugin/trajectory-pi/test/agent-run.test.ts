import assert from "node:assert/strict";
import test from "node:test";
import { aggregatePiAgentRun, PiAgentRunTracker } from "../src/agent-run.ts";

test("agent run sums every provider request and native cost exactly", () => {
	const aggregate = aggregatePiAgentRun([
		{ role: "user", content: "fix it" },
		{
			role: "assistant",
			model: "claude-sonnet-4-5",
			provider: "anthropic",
			usage: { input: 100, output: 20, cacheRead: 30, cacheWrite: 5, totalTokens: 155, cost: { total: 0.01 } },
		},
		{ role: "toolResult", content: "ok" },
		{
			role: "assistant",
			model: "claude-sonnet-4-5",
			provider: "anthropic",
			usage: { input: 40, output: 10, cacheRead: 200, cacheWrite: 0, totalTokens: 250, cost: 0.02 },
		},
	]);

	assert.deepEqual(aggregate, {
		usage: {
			input: 140,
			output: 30,
			cacheRead: 230,
			cacheWrite: 5,
			totalTokens: 405,
			cost: { total: 0.03 },
		},
		requestCount: 2,
		zeroUsageRequests: 0,
		model: "claude-sonnet-4-5",
		provider: "anthropic",
		modelStatus: "single",
		costStatus: "native_exact",
	});
});
test("billed aborts count, zero-only requests remain explicit", () => {
	const aggregate = aggregatePiAgentRun([
		{
			role: "assistant",
			model: "gpt-5.1",
			provider: "openai",
			stopReason: "aborted",
			usage: { input: 25, output: 0, cacheRead: 0, cacheWrite: 0, cost: { total: 0.004 } },
		},
		{
			role: "assistant",
			model: "gpt-5.1",
			provider: "openai",
			stopReason: "error",
			usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { total: 0 } },
		},
	]);

	assert.equal(aggregate.requestCount, 2);
	assert.equal(aggregate.zeroUsageRequests, 1);
	assert.equal(aggregate.costStatus, "native_exact");
	assert.deepEqual(aggregate.usage, {
		input: 25,
		output: 0,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 25,
		cost: { total: 0.004 },
	});
});

test("mixed models keep the exact total without assigning it to one model", () => {
	const aggregate = aggregatePiAgentRun([
		{ role: "assistant", model: "model-a", provider: "one", usage: { input: 2, output: 1, cost: { total: 0.2 } } },
		{ role: "assistant", model: "model-b", provider: "two", usage: { input: 3, output: 1, cost: { total: 0.3 } } },
	]);

	assert.equal(aggregate.model, "mixed");
	assert.equal(aggregate.provider, "mixed");
	assert.equal(aggregate.modelStatus, "mixed");
	assert.deepEqual(aggregate.usage?.cost, { total: 0.5 });
});

test("missing native request cost never becomes a partial native total", () => {
	const aggregate = aggregatePiAgentRun([
		{ role: "assistant", model: "model-a", usage: { input: 2, output: 1, cost: { total: 0.2 } } },
		{ role: "assistant", model: "model-a", usage: { input: 3, output: 1 } },
	]);

	assert.equal(aggregate.costStatus, "unavailable");
	assert.equal(aggregate.usage?.cost, undefined);
	assert.equal(aggregate.usage?.totalTokens, 7);
});

test("run identity is stable for dual transport and duplicate agent_end", () => {
	const runs = new PiAgentRunTracker();
	runs.reset("session-1", 1234);
	assert.equal(runs.start(), "pi-agent-run:session-1:1234:1");
	assert.equal(runs.complete(), "pi-agent-run:session-1:1234:1");
	assert.equal(runs.complete(), undefined);
	assert.equal(runs.start(), "pi-agent-run:session-1:1234:2");
	assert.equal(runs.complete(), "pi-agent-run:session-1:1234:2");

	runs.reset("session-1", 5678);
	assert.equal(runs.start(), "pi-agent-run:session-1:5678:1");
});
