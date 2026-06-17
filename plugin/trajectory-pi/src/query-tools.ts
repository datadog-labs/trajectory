import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";

const DEFAULT_DB_RELATIVE_PATH = [".trajectory", "trajectories", "cache", "trajectory.db"];
const DEFAULT_QUERY_LIMIT = 100;
const MAX_QUERY_LIMIT = 1000;
const SQLITE_TIMEOUT_MS = 5000;
const SQLITE_MAX_BUFFER = 10 * 1024 * 1024;

export type QueryParams = Record<string, string | number | boolean | null>;

export interface QueryToolInput {
	query: string;
	params?: QueryParams;
	limit?: number;
	row_limit?: number;
}

export interface QueryResult {
	ok: boolean;
	db_path: string;
	query: string;
	rows: Array<Record<string, unknown>>;
	meta: {
		allowed_keyword: string;
		limit: number;
		returned: number;
		truncated: boolean;
		duration_ms: number;
	};
	error?: string;
	generated_at: string;
}

export interface SchemaResult {
	ok: boolean;
	db_path: string;
	generated_at: string;
	schema_hash?: string;
	tables: Array<{
		name: string;
		columns: Array<Record<string, unknown>>;
		row_count?: number;
	}>;
	indexes: Array<Record<string, unknown>>;
	error?: string;
}

export function resolveTrajectoryDbPath(env: Record<string, string | undefined> = process.env): string {
	if (env.TRAJECTORY_CACHE_DB?.trim()) return env.TRAJECTORY_CACHE_DB.trim();
	return join(homedir(), ...DEFAULT_DB_RELATIVE_PATH);
}

export function buildTrajectorySchema(
	includeRowCounts = false,
	env: Record<string, string | undefined> = process.env,
): SchemaResult {
	const dbPath = resolveTrajectoryDbPath(env);
	const result: SchemaResult = {
		ok: false,
		db_path: dbPath,
		generated_at: new Date().toISOString(),
		tables: [],
		indexes: [],
	};

	try {
		assertReadableDb(dbPath);
		const tableRows = runSQLiteJSON<{ name: string }>(
			dbPath,
			"SELECT name FROM sqlite_schema WHERE type IN ('table', 'view') AND name NOT LIKE 'sqlite_%' ORDER BY name",
		);
		const tables = tableRows.map((row) => {
			const columns = runSQLiteJSON<Record<string, unknown>>(dbPath, `PRAGMA table_xinfo(${quoteSQLiteString(row.name)})`);
			const table: SchemaResult["tables"][number] = {
				name: row.name,
				columns: columns.map((column) => ({
					name: column.name,
					type: column.type,
					notnull: Boolean(column.notnull),
					default_value: column.dflt_value ?? null,
					pk: Number(column.pk ?? 0),
					hidden: Number(column.hidden ?? 0),
				})),
			};
			if (includeRowCounts) {
				const countRows = runSQLiteJSON<{ count: number }>(
					dbPath,
					`SELECT COUNT(*) AS count FROM ${quoteSQLiteIdentifier(row.name)}`,
				);
				table.row_count = Number(countRows[0]?.count ?? 0);
			}
			return table;
		});

		const indexes = runSQLiteJSON<Record<string, unknown>>(
			dbPath,
			"SELECT name, tbl_name AS 'table', sql FROM sqlite_schema WHERE type = 'index' ORDER BY tbl_name, name",
		);
		result.ok = true;
		result.tables = tables;
		result.indexes = indexes;
		result.schema_hash = createHash("sha256").update(JSON.stringify({ tables, indexes })).digest("hex");
	} catch (err) {
		result.error = err instanceof Error ? err.message : String(err);
	}

	return result;
}

export function runTrajectoryQuery(
	input: QueryToolInput,
	env: Record<string, string | undefined> = process.env,
): QueryResult {
	const dbPath = resolveTrajectoryDbPath(env);
	const query = String(input.query ?? "").trim();
	const limit = clampQueryLimit(input.limit ?? input.row_limit);
	const startedAt = Date.now();
	const baseMeta = {
		allowed_keyword: "",
		limit,
		returned: 0,
		truncated: false,
		duration_ms: 0,
	};

	try {
		assertReadableDb(dbPath);
		const keyword = firstSQLKeyword(query);
		baseMeta.allowed_keyword = keyword;
		if (!isAllowedKeyword(keyword)) {
			throw new Error(`SQL keyword ${JSON.stringify(keyword)} is not allowed; use SELECT, WITH, or PRAGMA`);
		}
		assertSingleStatement(query);

		const substituted = substituteNamedParams(stripTrailingSemicolon(query), input.params ?? {});
		const bounded = keyword === "SELECT" || keyword === "WITH"
			? `SELECT * FROM (${substituted}) LIMIT ${limit + 1}`
			: substituted;
		const rawRows = runSQLiteJSON<Record<string, unknown>>(dbPath, bounded);
		const rows = rawRows.slice(0, limit);
		const truncated = rawRows.length > limit;
		return {
			ok: true,
			db_path: dbPath,
			query,
			rows,
			meta: {
				allowed_keyword: keyword,
				limit,
				returned: rows.length,
				truncated,
				duration_ms: Date.now() - startedAt,
			},
			generated_at: new Date().toISOString(),
		};
	} catch (err) {
		return {
			ok: false,
			db_path: dbPath,
			query,
			rows: [],
			meta: {
				...baseMeta,
				duration_ms: Date.now() - startedAt,
			},
			error: err instanceof Error ? err.message : String(err),
			generated_at: new Date().toISOString(),
		};
	}
}

export function firstSQLKeyword(query: string): string {
	const stripped = stripSQLLeadingComments(query).trim();
	if (!stripped) throw new Error("query is empty");
	const match = /^[A-Za-z]+/.exec(stripped);
	if (!match) throw new Error("query must start with a SQL keyword");
	return match[0].toUpperCase();
}

function isAllowedKeyword(keyword: string): boolean {
	return keyword === "SELECT" || keyword === "WITH" || keyword === "PRAGMA";
}

function assertReadableDb(dbPath: string): void {
	if (!dbPath.trim()) throw new Error("database path is empty");
	if (!existsSync(dbPath)) throw new Error(`database not found: ${dbPath}`);
}

function runSQLiteJSON<T>(dbPath: string, sql: string): T[] {
	const stdout = execFileSync("sqlite3", ["-readonly", "-json", dbPath], {
		input: `PRAGMA query_only=ON;\n${sql};\n`,
		encoding: "utf8",
		timeout: SQLITE_TIMEOUT_MS,
		maxBuffer: SQLITE_MAX_BUFFER,
	});
	const trimmed = stdout.trim();
	if (!trimmed) return [];
	return JSON.parse(trimmed) as T[];
}

function stripSQLLeadingComments(query: string): string {
	let s = query.trimStart();
	for (;;) {
		if (s.startsWith("--")) {
			const newline = s.indexOf("\n");
			if (newline < 0) return "";
			s = s.slice(newline + 1).trimStart();
			continue;
		}
		if (s.startsWith("/*")) {
			const end = s.indexOf("*/", 2);
			if (end < 0) throw new Error("unterminated block comment before SQL keyword");
			s = s.slice(end + 2).trimStart();
			continue;
		}
		return s;
	}
}

function assertSingleStatement(query: string): void {
	const stripped = stripTrailingSemicolon(query);
	if (stripped.includes(";")) {
		throw new Error("multiple SQL statements are not allowed");
	}
}

function stripTrailingSemicolon(query: string): string {
	let stripped = query.trim();
	if (stripped.endsWith(";")) stripped = stripped.slice(0, -1).trimEnd();
	return stripped;
}

function substituteNamedParams(query: string, params: QueryParams): string {
	let out = query;
	for (const [key, value] of Object.entries(params)) {
		if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
			throw new Error(`invalid SQL parameter name: ${key}`);
		}
		const pattern = new RegExp(`:${key}\\b`, "g");
		out = out.replace(pattern, sqlLiteral(value));
	}
	if (/:([A-Za-z_][A-Za-z0-9_]*)\b/.test(out)) {
		throw new Error("query contains an unbound named parameter");
	}
	return out;
}

function sqlLiteral(value: string | number | boolean | null): string {
	if (value === null) return "NULL";
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error("numeric SQL parameters must be finite");
		return String(value);
	}
	if (typeof value === "boolean") return value ? "1" : "0";
	return quoteSQLiteString(value);
}

function clampQueryLimit(raw: unknown): number {
	const value = Number(raw ?? DEFAULT_QUERY_LIMIT);
	if (!Number.isFinite(value) || value <= 0) return DEFAULT_QUERY_LIMIT;
	return Math.min(Math.floor(value), MAX_QUERY_LIMIT);
}

function quoteSQLiteString(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function quoteSQLiteIdentifier(value: string): string {
	return `"${value.replaceAll('"', '""')}"`;
}
