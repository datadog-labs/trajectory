import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { buildTrajectorySchema, firstSQLKeyword, runTrajectoryQuery } from "../src/query-tools.ts";

test("buildTrajectorySchema returns tables, columns, row counts, and schema hash", () => {
	const dir = mkdtempSync(join(tmpdir(), "trajectory-pi-query-"));
	const dbPath = join(dir, "trajectory.db");
	try {
		createFixtureDb(dbPath);
		const result = buildTrajectorySchema(true, { TRAJECTORY_CACHE_DB: dbPath });

		assert.equal(result.ok, true, result.error);
		assert.equal(result.db_path, dbPath);
		assert.ok(result.schema_hash);
		const sessions = result.tables.find((table) => table.name === "sessions");
		assert.ok(sessions);
		assert.equal(sessions.row_count, 3);
		assert.ok(sessions.columns.some((column) => column.name === "session_id"));
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("runTrajectoryQuery returns bounded rows and supports named params", () => {
	const dir = mkdtempSync(join(tmpdir(), "trajectory-pi-query-"));
	const dbPath = join(dir, "trajectory.db");
	try {
		createFixtureDb(dbPath);
		const result = runTrajectoryQuery(
			{
				query: "SELECT session_id, cost_usd FROM sessions WHERE project_dir = :project_dir ORDER BY cost_usd DESC",
				params: { project_dir: "/workspace/alpha" },
				limit: 1,
			},
			{ TRAJECTORY_CACHE_DB: dbPath },
		);

		assert.equal(result.ok, true, result.error);
		assert.equal(result.meta.allowed_keyword, "SELECT");
		assert.equal(result.meta.returned, 1);
		assert.equal(result.meta.truncated, true);
		assert.deepEqual(result.rows[0], { session_id: "s-alpha-2", cost_usd: 0.4 });
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("runTrajectoryQuery rejects writes and multiple statements", () => {
	const dir = mkdtempSync(join(tmpdir(), "trajectory-pi-query-"));
	const dbPath = join(dir, "trajectory.db");
	try {
		createFixtureDb(dbPath);

		const update = runTrajectoryQuery(
			{ query: "UPDATE sessions SET cost_usd = 0" },
			{ TRAJECTORY_CACHE_DB: dbPath },
		);
		assert.equal(update.ok, false);
		assert.match(update.error ?? "", /not allowed/);

		const multi = runTrajectoryQuery(
			{ query: "SELECT session_id FROM sessions; SELECT cost_usd FROM sessions" },
			{ TRAJECTORY_CACHE_DB: dbPath },
		);
		assert.equal(multi.ok, false);
		assert.match(multi.error ?? "", /multiple SQL statements/);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("firstSQLKeyword strips leading comments", () => {
	assert.equal(firstSQLKeyword("-- comment\nSELECT 1"), "SELECT");
	assert.equal(firstSQLKeyword("/* comment */\nWITH rows AS (SELECT 1) SELECT * FROM rows"), "WITH");
	assert.throws(() => firstSQLKeyword("/* unterminated"), /unterminated/);
});

function createFixtureDb(dbPath: string): void {
	const sql = `
CREATE TABLE sessions (
	session_id TEXT PRIMARY KEY,
	project_dir TEXT,
	cost_usd REAL
);

INSERT INTO sessions (session_id, project_dir, cost_usd) VALUES
	('s-alpha-1', '/workspace/alpha', 0.25),
	('s-alpha-2', '/workspace/alpha', 0.40),
	('s-beta-1', '/workspace/beta', 0.10);
`;
	const result = spawnSync("sqlite3", [dbPath], { input: sql, encoding: "utf8" });
	if (result.error) throw result.error;
	if (result.status !== 0) throw new Error(result.stderr);
}
