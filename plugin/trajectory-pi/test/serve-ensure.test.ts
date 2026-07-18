import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ensureTrajectoryServe, parseServeEnsureResponse } from "../src/serve-ensure.ts";

const PORT = 19444;

async function fixture(script: string): Promise<{ binary: string; dir: string }> {
  const dir = await mkdtemp(join(tmpdir(), "trajectory-ensure-adapter-"));
  const binary = join(dir, "trajectory");
  await writeFile(binary, `#!/bin/sh\n${script}\n`, { mode: 0o755 });
  await chmod(binary, 0o755);
  return { binary, dir };
}

test("accepts only a ready v1 response and uses exact coordinator argv", async (t) => {
  const { binary, dir } = await fixture(`
printf '%s\\n' "$@" > "${tmpdir()}/trajectory-ensure-adapter-argv"
printf '%s\\n' '{"schema_version":1,"status":"satisfied_ready","reason_code":"owner_ready","ready":true,"port":${PORT}}'
`);
  t.after(() => rm(dir, { recursive: true, force: true }));
  const result = await ensureTrajectoryServe({ binary, client: "pi", port: PORT });
  assert.equal(result.ok, true);
  const argv = (await readFile(join(tmpdir(), "trajectory-ensure-adapter-argv"), "utf8")).trim().split("\n");
  assert.deepEqual(argv, ["serve", "ensure", "--client", "pi", "--port", String(PORT), "--wait", "5s", "--format", "json"]);
});
test("an old binary is blocked and never retried as bare serve", async (t) => {
  const calls = join(tmpdir(), `trajectory-old-binary-calls-${process.pid}`);
  const { binary, dir } = await fixture(`printf '%s\\n' "$*" >> "${calls}"; echo 'unknown command: ensure' >&2; exit 1`);
  t.after(() => Promise.all([rm(dir, { recursive: true, force: true }), rm(calls, { force: true })]));
  const result = await ensureTrajectoryServe({ binary, client: "pi", port: PORT });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, "blocked_unsupported_peer");
  const invocations = (await readFile(calls, "utf8")).trim().split("\n");
  assert.equal(invocations.length, 1);
  assert.match(invocations[0], /^serve ensure /);
});

test("valid exit 75 remains blocked without becoming an unsupported peer", async (t) => {
  const { binary, dir } = await fixture(`printf '%s\\n' '{"schema_version":1,"status":"blocked_live_unready","reason_code":"owner_alive_unready","ready":false,"port":${PORT}}'; exit 75`);
  t.after(() => rm(dir, { recursive: true, force: true }));
  const result = await ensureTrajectoryServe({ binary, client: "pi", port: PORT });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, "blocked_live_unready");
});

test("a generation started by this request is accepted only after ready", async (t) => {
  const { binary, dir } = await fixture(`printf '%s\\n' '{"schema_version":1,"status":"reserved_and_started","reason_code":"started_ready","ready":true,"port":${PORT}}'`);
  t.after(() => rm(dir, { recursive: true, force: true }));
  const result = await ensureTrajectoryServe({ binary, client: "pi", port: PORT });
  assert.equal(result.ok, true);
});

test("malformed, mismatched, and timed-out peers fail closed", async (t) => {
  assert.equal(parseServeEnsureResponse('{"schema_version":0}', PORT), undefined);
  assert.equal(parseServeEnsureResponse('{"schema_version":1,"status":"satisfied_ready","reason_code":"ok","ready":true,"port":1}', PORT), undefined);
  const { binary, dir } = await fixture("sleep 2");
  t.after(() => rm(dir, { recursive: true, force: true }));
  const result = await ensureTrajectoryServe({ binary, client: "pi", port: PORT, timeoutMs: 25 });
  assert.equal(result.ok, false);
  assert.equal(result.response.status, "blocked_unsupported_peer");
  assert.match(result.diagnostic, /timeout|SIGKILL/i);
});
