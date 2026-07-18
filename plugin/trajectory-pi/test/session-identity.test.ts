import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { canonicalPiSessionId, piSessionIdentityFields, readPiSessionHeaderId } from "../src/session-identity.ts";

function manager(id: string, parentSession?: string) {
	return {
		getSessionId: () => id,
		getHeader: () => ({ parentSession }),
	};
}

test("fork session_start preserves exact provider and parent identities", () => {
	assert.deepEqual(
		piSessionIdentityFields(
			{ reason: "fork", previousSessionFile: "/home/fixture/.pi/agent/sessions/project/parent.jsonl" },
			manager("019bf-child", "/home/fixture/.pi/agent/sessions/project/parent.jsonl"),
			"019bf-parent",
		),
		{
			session_id: "019bf-child",
			raw_session_id: "019bf-child",
			provider_session_id: "pi:019bf-child",
			source: "fork",
			parent_session_id: "019bf-parent",
			provider_parent_session_id: "pi:019bf-parent",
			session_relationship: "fork",
		},
	);
});
test("new session links only when the provider header confirms the previous file", () => {
	const confirmed = piSessionIdentityFields(
		{ reason: "new", previousSessionFile: "/sessions/parent.jsonl" },
		manager("provider-child", "/sessions/parent.jsonl"),
		"provider-parent",
	);
	assert.equal(confirmed.parent_session_id, "provider-parent");
	assert.equal(confirmed.session_relationship, "new");

	const unconfirmed = piSessionIdentityFields(
		{ reason: "resume", previousSessionFile: "/sessions/active.jsonl" },
		manager("resumed-child", "/sessions/actual-parent.jsonl"),
		"active-but-not-parent",
	);
	assert.equal(unconfirmed.parent_session_id, undefined);
	assert.equal(unconfirmed.provider_parent_session_id, undefined);
});

test("reads the exact parent provider ID from a bounded Pi session header", async (t) => {
	const dir = await mkdtemp(join(tmpdir(), "trajectory-pi-parent-"));
	t.after(() => rm(dir, { recursive: true, force: true }));
	const path = join(dir, "timestamp_provider-id.jsonl");
	await writeFile(path, [
		JSON.stringify({ type: "session", version: 3, id: "exact-provider-parent", cwd: "/fixture" }),
		JSON.stringify({ type: "message", message: { role: "user", content: "fixture" } }),
	].join("\n") + "\n");
	assert.equal(await readPiSessionHeaderId(path), "exact-provider-parent");
});

test("unsafe live provider IDs use the same path-safe canonical identity as backfill", () => {
	assert.equal(
		canonicalPiSessionId("pi", "../provider/session id"),
		"pi-24e0ec4cb533298eed147a2d376a8c25",
	);
	const fields = piSessionIdentityFields(
		{ reason: "startup" },
		manager("../provider/session id"),
	);
	assert.equal(fields.session_id, "pi-24e0ec4cb533298eed147a2d376a8c25");
	assert.equal(fields.raw_session_id, "../provider/session id");
	assert.equal(fields.provider_session_id, "pi:../provider/session id");
});
