import { readFile, writeFile, mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { catalog, digest } from "./catalog.mjs";

const { rows, bank, contentDigest } = await catalog();
const byArea = Object.fromEntries(["mathematics", "nature", "humanities", "languages"].map(area => [area, rows.filter(r => bank.find(q => q.id === r.question_id).area === area).length]));
assert.equal(rows.length, 100);
for (const count of Object.values(byArea)) assert.equal(count, 25);
const assets = new Set();
for (const row of rows) {
  const q = bank.find(q => q.id === row.question_id);
  for (const match of JSON.stringify([q.context, q.prompt, q.alternatives]).matchAll(/__ENEM_ASSETS__\/([a-f0-9]+\.(?:png|jpe?g|webp))/g)) assets.add(match[1]);
}
for (const name of assets) assert.equal(digest(await readFile(`output/enem/assets/${name}`)), name.split(".")[0], `Missing or altered image: ${name}`);
const previousLock = await readFile("docs/learning/pilot-lock.json", "utf8").then(JSON.parse).catch(error => { if (error.code === "ENOENT") return null; throw error; });
const versionArg = process.argv.find(a => a.startsWith("--version="));
const version = versionArg ? Number(versionArg.slice(10)) : previousLock?.version ?? 1;
assert.ok(Number.isInteger(version) && version > 0);
if (process.argv.includes("--prepare") && previousLock && previousLock.digest !== contentDigest) assert.ok(version > previousLock.version, "Changed content needs a higher --version.");
const inventory = { version, sourceCommit: bank[0].source_commit, count: rows.length, byArea, images: assets.size,
  digest: contentDigest, questions: rows.map(r => ({ id: r.question_id, checksum: r.checksum, contentDigest: digest(r.content) })) };
await mkdir("docs/learning", { recursive: true });
if (process.argv.includes("--prepare")) await writeFile("docs/learning/pilot-lock.json", JSON.stringify(inventory, null, 2) + "\n");
const lock = JSON.parse(await readFile("docs/learning/pilot-lock.json", "utf8"));
assert.equal(lock.digest, contentDigest, "Content changed; prepare a new version and review it before publishing.");
for (const row of rows) assert.equal(lock.questions.find(q => q.id === row.question_id)?.checksum, row.checksum, "Source changed; explanations need review.");
console.log(JSON.stringify({ questions: rows.length, byArea, images: assets.size, digest: contentDigest, dryRun: !process.argv.includes("--publish") }));
if (!process.argv.includes("--publish")) process.exit(0);
const review = JSON.parse(await readFile("docs/learning/review.json", "utf8"));
assert.equal(review.status, "approved"); assert.equal(review.digest, contentDigest);
assert.equal(new Set(review.sample).size >= 8, true, "Review samples across areas before publishing.");
for (const area of Object.keys(byArea)) assert.ok(review.sample.some(id => bank.find(q => q.id === id)?.area === area));
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
for (const row of rows) {
  const { data, error } = await db.from("qe_enem_questions").select("checksum").eq("id", row.question_id).single();
  assert.equal(error, null); assert.equal(data.checksum, row.checksum, `Remote source changed: ${row.question_id}`);
}
for (const row of rows) {
  const { data, error } = await db.from("qe_explanations").select("checksum,content,subject,topic,status").eq("question_id", row.question_id).eq("version", lock.version).maybeSingle();
  assert.equal(error, null);
  assert.ok(!data || data.status !== "quarantined", "Withdrawn explanations need a new reviewed version before republication.");
  assert.ok(!data || data.checksum === row.checksum && digest(data.content) === digest(row.content) && data.subject === row.subject && data.topic === row.topic, "Bump the editorial version before replacing published content.");
}
const { error } = await db.from("qe_explanations").upsert(rows.map(row => ({ ...row, version: lock.version, status: "approved" })), { onConflict: "question_id,version" });
assert.equal(error, null);
const activated = await db.from("qe_enem_questions").update({ learning_version: lock.version }).in("id", rows.map(r => r.question_id));
assert.equal(activated.error, null);
console.log(`Published ${rows.length} explanations. Existing attempts and XP preserved.`);
