import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { parseEnv } from "node:util";

await import("./check-worker-secrets.mjs");
const local = parseEnv(await readFile(".dev.vars", "utf8").catch(() => ""));
const secrets = Object.fromEntries(
  ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_PUBLISHABLE_KEY"].map(
    (key) => [key, process.env[key] ?? local[key]],
  ),
);
assert.ok(
  Object.values(secrets).every(Boolean),
  "Configure the three Supabase variables before deploying.",
);
const file = join(tmpdir(), `qe-worker-secrets-${crypto.randomUUID()}.json`);
try {
  await writeFile(file, JSON.stringify(secrets), { mode: 0o600 });
  const exitCode = await new Promise((resolveExit, reject) => {
    const child = spawn(
      process.execPath,
      [
        resolve("node_modules/wrangler/bin/wrangler.js"),
        "deploy",
        "--secrets-file",
        file,
      ],
      {
        stdio: "inherit",
        env: { ...process.env, OPEN_NEXT_DEPLOY: "true" },
      },
    );
    child.on("error", reject);
    child.on("exit", (code) => resolveExit(code ?? 1));
  });
  assert.equal(exitCode, 0, "Cloudflare deployment failed.");
} finally {
  await unlink(file).catch(() => {});
}
