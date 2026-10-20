import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { parseEnv } from "node:util";
import assert from "node:assert/strict";

const local = parseEnv(await readFile(".dev.vars", "utf8").catch(() => ""));
const values = ["SUPABASE_SECRET_KEY", "SUPABASE_DB_PASSWORD"]
  .map((key) => process.env[key] ?? local[key])
  .filter(Boolean);
assert.ok(
  values.length,
  "Configure the server secrets before scanning the Worker output.",
);

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (entry.isFile()) {
      const contents = await readFile(path);
      assert.equal(
        values.some((value) => contents.includes(Buffer.from(value))),
        false,
        `Secret found in build artifact: ${path}`,
      );
    }
  }
}
await scan(".open-next");
console.log("PASS nenhum segredo de servidor nos arquivos de publicação");
