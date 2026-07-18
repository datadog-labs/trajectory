import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { BoundedSerialQueue } from "../src/async-queue.ts";

function deferred(): { promise: Promise<void>; resolve: () => void } {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

test("lifecycle callback returns promptly when the capture helper hangs", async () => {
	const helper = deferred();
	const queue = new BoundedSerialQueue(8);

	const callback = async () => {
		queue.enqueue(() => helper.promise);
	};

	const startedAt = performance.now();
	await callback();
	const elapsedMs = performance.now() - startedAt;
	assert.ok(elapsedMs < 25, `callback took ${elapsedMs.toFixed(1)}ms`);

	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.deepEqual(queue.snapshot(), {
		capacity: 8,
		depth: 1,
		pending: 0,
		running: true,
		dropped: 0,
	});
	helper.resolve();
	assert.equal(await queue.drain(100), true);
});
test("many callback events stay bounded behind one hung helper", async () => {
	const helper = deferred();
	const queue = new BoundedSerialQueue(16);
	let activeHelpers = 0;
	let maxActiveHelpers = 0;

	const callback = () => {
		queue.enqueue(async () => {
			activeHelpers++;
			maxActiveHelpers = Math.max(maxActiveHelpers, activeHelpers);
			await helper.promise;
			activeHelpers--;
		});
	};

	const startedAt = performance.now();
	for (let i = 0; i < 10_000; i++) callback();
	const elapsedMs = performance.now() - startedAt;
	assert.ok(elapsedMs < 100, `10,000 admissions took ${elapsedMs.toFixed(1)}ms`);

	await new Promise((resolve) => setTimeout(resolve, 0));
	const snapshot = queue.snapshot();
	assert.equal(snapshot.depth, 16);
	assert.equal(snapshot.pending, 15);
	assert.equal(snapshot.running, true);
	assert.equal(snapshot.dropped, 9_984);
	assert.equal(maxActiveHelpers, 1);

	const drainStartedAt = performance.now();
	assert.equal(await queue.drain(20), false);
	const drainElapsedMs = performance.now() - drainStartedAt;
	assert.ok(drainElapsedMs < 75, `bounded drain took ${drainElapsedMs.toFixed(1)}ms`);

	helper.resolve();
	assert.equal(await queue.drain(250), true);
	assert.equal(maxActiveHelpers, 1);
});

test("successful work remains serialized and ordered", async () => {
	const queue = new BoundedSerialQueue(8);
	const seen: number[] = [];
	let active = 0;
	let maxActive = 0;

	for (let i = 0; i < 8; i++) {
		assert.equal(queue.enqueue(async () => {
			active++;
			maxActive = Math.max(maxActive, active);
			await Promise.resolve();
			seen.push(i);
			active--;
		}), true);
	}

	assert.equal(await queue.drain(250), true);
	assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7]);
	assert.equal(maxActive, 1);
});

test("terminal work replaces pending work instead of exceeding capacity", async () => {
	const helper = deferred();
	const queue = new BoundedSerialQueue(3);
	const seen: string[] = [];

	queue.enqueue(async () => {
		seen.push("running");
		await helper.promise;
	});
	queue.enqueue(() => { seen.push("older"); });
	queue.enqueue(() => { seen.push("replaced"); });
	await new Promise((resolve) => setTimeout(resolve, 0));

	assert.equal(queue.enqueueTerminal(() => { seen.push("terminal"); }), true);
	assert.equal(queue.snapshot().depth, 3);
	assert.equal(queue.snapshot().dropped, 1);
	helper.resolve();
	assert.equal(await queue.drain(250), true);
	assert.deepEqual(seen, ["running", "older", "terminal"]);
});
