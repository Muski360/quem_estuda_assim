import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { WRITING_PILOT } from "../../src/data/writing/pilot.ts";
import { WRITING_WORKSHOPS } from "../../src/data/writing/workshops.ts";
import { WRITING_TOPICS } from "../../src/data/writing/topics.ts";
import { WRITING_READINGS } from "../../src/data/writing/readings.ts";

export function validate(activities, workshops, topics, readings) {
  assert.equal(new Set(activities.map(a => a.id)).size, activities.length);
  const texts = new Set();
  for (const a of activities) {
    assert.match(a.id, /^es-c[1-5]-\d{2}$/); assert.match(a.competency, /^C[1-5]$/);
    assert.ok(a.prompt.length > 35 && a.explanation.length > 60);
    assert.ok(!texts.has(a.prompt), a.id); texts.add(a.prompt);
    assert.equal(new Set(a.options).size, a.options.length); assert.ok(a.options.every(s => s.length > 1));
    if (a.kind === "choice") { assert.equal(a.options.length, 3); assert.equal(a.evidence.length, 3); assert.equal(new Set(a.evidence).size, 3); }
    else { assert.equal(a.kind, "order"); assert.ok(a.options.length >= 3 && a.options.length <= 5); }
  }
  for (const w of workshops) { assert.match(w.competency, /^C[1-5]$/); assert.equal(w.checks.length, 3); assert.notEqual(w.task, w.transfer); assert.ok(w.comment.length > 60 && w.model.length > 60); }
  for (const t of topics) assert.ok(t.texts.length >= 2 && t.texts.every(s => s.text.length > 100));
  for (const r of readings) { assert.equal(r.score, 1000); assert.match(r.source, /^https:\/\//); assert.ok(r.proof.length > 50 && r.rights.length > 60); assert.equal(Object.keys(r.analysis).length, 5); }
}
if (process.argv.includes("--pilot")) {
  validate(WRITING_PILOT, WRITING_WORKSHOPS.slice(0, 5), WRITING_TOPICS.slice(0, 1), WRITING_READINGS.slice(0, 1));
  assert.equal(WRITING_PILOT.length, 25);
  for (const c of ["C1", "C2", "C3", "C4", "C5"]) assert.equal(WRITING_PILOT.filter(a => a.competency === c).length, 5);
  console.log("PASS piloto: 25 desafios, cinco oficinas, uma proposta e uma leitura nota 1000; conteúdo e procedência conferidos.");
} else if (process.argv[1]?.endsWith("validate.mjs")) {
  const { WRITING_CATALOG } = await import("../../src/lib/writing/catalog.ts");
  validate(WRITING_CATALOG.activities, WRITING_WORKSHOPS, WRITING_TOPICS, WRITING_READINGS);
  assert.equal(WRITING_CATALOG.activities.length, 100); assert.equal(WRITING_WORKSHOPS.length, 10); assert.equal(WRITING_TOPICS.length, 5); assert.equal(WRITING_READINGS.length, 5);
  for (const c of ["C1", "C2", "C3", "C4", "C5"]) { assert.equal(WRITING_CATALOG.activities.filter(a => a.competency === c).length, 20); assert.equal(WRITING_WORKSHOPS.filter(w => w.competency === c).length, 2); }
  const quarantine = JSON.parse(await readFile("scripts/writing/quarantine.json", "utf8"));
  const publishedIds = [...WRITING_CATALOG.activities, ...WRITING_WORKSHOPS, ...WRITING_TOPICS, ...WRITING_READINGS].map(x => x.id);
  assert.ok(quarantine.every(item => !publishedIds.includes(item.id)), "Um item em quarentena não pode ser publicado.");
  const hash = createHash("sha256").update(JSON.stringify(WRITING_CATALOG)).digest("hex");
  const path = "docs/writing/release.json";
  const existing = await readFile(path, "utf8").catch(error => { if (error.code === "ENOENT") return null; throw error; });
  if (process.argv.includes("--prepare") && !existing) await writeFile(path, JSON.stringify({ edition: 1, sha256: hash, activities: 100, workshops: 10, topics: 5, readings: 5 }, null, 2) + "\n");
  const release = JSON.parse(await readFile(path, "utf8")); assert.equal(release.sha256, hash, "A edição mudou: preserve IDs e prepare uma nova edição para conteúdo publicado.");
  console.log("PASS escrita: 100 desafios, dez oficinas, cinco propostas e cinco leituras; manifesto conferido.");
}
