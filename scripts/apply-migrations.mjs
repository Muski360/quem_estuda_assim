import { execFile } from "node:child_process";
import { readFile, readdir, writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import assert from "node:assert/strict";

const exec = promisify(execFile);
const cli = resolve("node_modules/supabase/dist/supabase.js");
const literal = (value) => `'${value.replaceAll("'", "''")}'`;

async function query(sql) {
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    const project = (
      await readFile("supabase/.temp/project-ref", "utf8")
    ).trim();
    assert.match(project, /^[a-z]{20}$/);
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${project}/database/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: sql }),
        signal: AbortSignal.timeout(30000),
      },
    );
    const data = await response.json();
    if (!response.ok)
      throw new Error(
        `Supabase migration failed (${response.status}): ${data.message ?? "Unknown error"}`,
      );
    return data;
  }
  const file = join(tmpdir(), `qe-migration-${crypto.randomUUID()}.sql`);
  try {
    await writeFile(file, sql, { mode: 0o600 });
    const { stdout } = await exec(
      process.execPath,
      [
        cli,
        "db",
        "query",
        "--linked",
        "--agent",
        "yes",
        "--file",
        file,
        "--output",
        "json",
      ],
      { maxBuffer: 2 ** 20, timeout: 30000 },
    );
    return JSON.parse(stdout).rows;
  } finally {
    await unlink(file).catch(() => {});
  }
}

await query(`create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`);
const applied = new Set(
  (
    await query("select version from supabase_migrations.schema_migrations")
  ).map((row) => row.version),
);
for (const file of (await readdir("supabase/migrations")).sort()) {
  const match = file.match(/^(\d+)_([a-zA-Z0-9_]+)\.sql$/);
  assert.ok(match, `Invalid migration filename: ${file}`);
  const [, version, name] = match;
  if (applied.has(version)) {
    console.log(`Already applied: ${file}`);
    continue;
  }
  const sql = await readFile(join("supabase/migrations", file), "utf8");
  await query(
    `begin;\n${sql}\ninsert into supabase_migrations.schema_migrations (version, name, statements) values (${literal(version)}, ${literal(name)}, array[${literal(sql)}]);\ncommit;`,
  );
  console.log(`Applied: ${file}`);
}
