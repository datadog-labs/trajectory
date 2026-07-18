#!/bin/bash
# Request the shared serve coordinator. Never launch or own serve directly.
set -u

PORT="${TRAJECTORY_PORT:-19222}"
BINARY="${TRAJECTORY_BINARY:-${HOME}/.trajectory/bin/trajectory}"
WAIT="${TRAJECTORY_SERVE_RESTART_WAIT:-5s}"
HARD_TIMEOUT_SECONDS="${TRAJECTORY_SERVE_ENSURE_TIMEOUT_SECONDS:-7}"

case "$HARD_TIMEOUT_SECONDS" in
    ''|*[!0-9]*) HARD_TIMEOUT_SECONDS=7 ;;
esac
if [ "$HARD_TIMEOUT_SECONDS" -lt 1 ]; then
    HARD_TIMEOUT_SECONDS=7
fi

if [ ! -x "$BINARY" ]; then
    echo "[trajectory] serve ensure blocked_unsupported_peer: binary unavailable at $BINARY" >&2
    exit 0
fi

# Claude Code necessarily runs on Node. spawnSync's timeout kills and reaps the
# exact child before returning, so no delayed numeric-PID watchdog can race PID
# reuse. A missing runtime blocks process creation with no raw-launch fallback.
if ! command -v node >/dev/null 2>&1; then
    echo "[trajectory] serve ensure blocked_unsupported_peer: node is required for bounded v1 response validation ($BINARY)" >&2
    exit 0
fi

node - "$BINARY" "$PORT" "$WAIT" "$HARD_TIMEOUT_SECONDS" <<'JS' || true
const { spawnSync } = require("node:child_process");

const [binary, portRaw, wait, timeoutRaw] = process.argv.slice(2);
const port = Number(portRaw);
const timeoutMs = Number(timeoutRaw) * 1000;

function bounded(value) {
  return String(value ?? "").replace(/[\r\n\t]+/g, " ").slice(0, 240);
}

function blocked(detail) {
  process.stderr.write(
    `[trajectory] serve ensure blocked_unsupported_peer (${bounded(binary)}): ${bounded(detail)}\n`,
  );
  process.exit(0);
}

if (!Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(timeoutMs) || timeoutMs < 1000) {
  blocked("invalid adapter configuration");
}

const args = [
  "serve",
  "ensure",
  "--client",
  "claude-code",
  "--port",
  String(port),
  "--wait",
  wait,
  "--format",
  "json",
];
const completed = spawnSync(binary, args, {
  encoding: "utf8",
  input: "",
  timeout: timeoutMs,
  killSignal: "SIGKILL",
  maxBuffer: 64 * 1024,
  windowsHide: true,
});
if (completed.error) {
  blocked(completed.error.code === "ETIMEDOUT" ? "hard timeout" : completed.error.message);
}
const stdout = String(completed.stdout ?? "").trim();
if (!stdout || Buffer.byteLength(stdout, "utf8") > 64 * 1024) {
  blocked(completed.stderr || "missing v1 JSON response");
}
let response;
try {
  response = JSON.parse(stdout);
} catch (error) {
  blocked(`malformed v1 JSON response: ${error.message}`);
}

const statuses = new Set([
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
if (!response || typeof response !== "object" || Array.isArray(response)) blocked("v1 response is not an object");
if (response.schema_version !== 1) blocked("unsupported response schema");
if (!statuses.has(response.status)) blocked("unknown v1 status");
if (typeof response.reason_code !== "string" || response.reason_code.length < 1 || response.reason_code.length > 256) {
  blocked("invalid v1 reason_code");
}
if (typeof response.ready !== "boolean" || response.port !== port) blocked("invalid v1 readiness or port");

const readyStatuses = new Set(["satisfied_ready", "satisfied_external", "reserved_and_started"]);
if (completed.status === 0 && response.ready && readyStatuses.has(response.status)) process.exit(0);
if (completed.status === 0 || (completed.status !== 75 && completed.status !== 78)) {
  blocked(`unsupported exit ${completed.status ?? completed.signal ?? "signal"}: ${response.reason_code}`);
}
process.stderr.write(
  `[trajectory] serve ensure ${response.status} (${bounded(binary)}): ${bounded(response.reason_code)}\n`,
);
process.exit(0);
JS

exit 0
