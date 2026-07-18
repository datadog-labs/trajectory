import { execFile, type ExecFileException } from "node:child_process";

export const SERVE_ENSURE_SCHEMA_VERSION = 1;
export const SERVE_ENSURE_WAIT = "5s";
export const SERVE_ENSURE_TIMEOUT_MS = 6500;

const ALL_STATUSES = new Set([
  "satisfied_ready",
  "satisfied_external",
  "reserved_and_started",
  "joined_pending_generation",
  "blocked_live_unready",
  "blocked_incompatible_owner",
  "blocked_ambiguous_owner",
  "blocked_ambiguous_legacy_owner",
  "blocked_unsupported_peer",
  "blocked_coordinator_unavailable",
  "blocked_cooldown",
]);

const READY_STATUSES = new Set(["satisfied_ready", "satisfied_external", "reserved_and_started"]);

export type ServeEnsureResponse = {
  schema_version: 1;
  status: string;
  reason_code: string;
  ready: boolean;
  port: number;
  domain?: string;
  generation?: number;
  owner_pid?: number;
};

export type ServeEnsureResult = {
  ok: boolean;
  response: ServeEnsureResponse;
  binary: string;
  diagnostic: string;
};

export type ServeEnsureOptions = {
  binary: string;
  client: string;
  port: number;
  wait?: string;
  timeoutMs?: number;
};

export async function ensureTrajectoryServe(options: ServeEnsureOptions): Promise<ServeEnsureResult> {
  const wait = options.wait ?? SERVE_ENSURE_WAIT;
  const timeoutMs = options.timeoutMs ?? SERVE_ENSURE_TIMEOUT_MS;
  const args = [
    "serve",
    "ensure",
    "--client",
    options.client,
    "--port",
    String(options.port),
    "--wait",
    wait,
    "--format",
    "json",
  ];

  return new Promise((resolve) => {
    execFile(options.binary, args, {
      timeout: timeoutMs,
      killSignal: "SIGKILL",
      maxBuffer: 64 * 1024,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      const parsed = parseServeEnsureResponse(stdout, options.port);
      if (!parsed) {
        resolve(blockedUnsupported(options.binary, summarize(error, stdout, stderr)));
        return;
      }

      const exitCode = processExitCode(error);
      const ok = exitCode === 0 && parsed.ready && READY_STATUSES.has(parsed.status);
      if (exitCode === 0 && !ok) {
        resolve(blockedUnsupported(options.binary, `invalid success result: ${parsed.status}`));
        return;
      }
      if (exitCode !== 0 && exitCode !== 75 && exitCode !== 78) {
        resolve(blockedUnsupported(options.binary, `unsupported exit ${exitCode ?? "signal"}: ${parsed.reason_code}`));
        return;
      }
      resolve({
        ok,
        response: parsed,
        binary: options.binary,
        diagnostic: `${parsed.status}: ${parsed.reason_code}`,
      });
    });
  });
}

export function parseServeEnsureResponse(stdout: string, expectedPort: number): ServeEnsureResponse | undefined {
  const trimmed = stdout.trim();
  if (!trimmed || trimmed.length > 64 * 1024) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    return undefined;
  }
  if (!isRecord(value)) return undefined;
  if (value.schema_version !== SERVE_ENSURE_SCHEMA_VERSION) return undefined;
  if (typeof value.status !== "string" || !ALL_STATUSES.has(value.status)) return undefined;
  if (typeof value.reason_code !== "string" || value.reason_code.length === 0 || value.reason_code.length > 256) return undefined;
  if (typeof value.ready !== "boolean") return undefined;
  if (!Number.isInteger(value.port) || value.port !== expectedPort) return undefined;
  if (value.domain !== undefined && typeof value.domain !== "string") return undefined;
  if (value.generation !== undefined && (!Number.isSafeInteger(value.generation) || Number(value.generation) < 0)) return undefined;
  if (value.owner_pid !== undefined && (!Number.isSafeInteger(value.owner_pid) || Number(value.owner_pid) <= 1)) return undefined;
  return value as ServeEnsureResponse;
}

function blockedUnsupported(binary: string, detail: string): ServeEnsureResult {
  return {
    ok: false,
    binary,
    response: {
      schema_version: 1,
      status: "blocked_unsupported_peer",
      reason_code: "blocked_unsupported_peer",
      ready: false,
      port: 0,
    },
    diagnostic: `blocked_unsupported_peer (${bounded(binary)}): ${bounded(detail)}`,
  };
}

function processExitCode(error: ExecFileException | null): number | undefined {
  if (!error) return 0;
  const code = error.code;
  return typeof code === "number" ? code : undefined;
}

function summarize(error: ExecFileException | null, stdout: string, stderr: string): string {
  if (error?.killed) return "hard timeout";
  return [error?.message, stderr.trim(), stdout.trim()].filter(Boolean).join("; ") || "missing response";
}

function bounded(value: string): string {
  return value.replace(/[\r\n\t]+/g, " ").slice(0, 240);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
