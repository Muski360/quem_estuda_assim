import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { WRITING_CATALOG, CODES } from "../../src/lib/writing/catalog.ts";
import { validate } from "./validate.mjs";

test("escrita editorial: 100 desafios, dez oficinas, cinco propostas e cinco leituras verificadas", () => {
  const c = WRITING_CATALOG;
  validate(c.activities, c.workshops, c.topics, c.readings);
  assert.equal(c.activities.length, 100); assert.equal(c.workshops.length, 10); assert.equal(c.topics.length, 5); assert.equal(c.readings.length, 5);
  for (const code of CODES) { assert.equal(c.activities.filter(a => a.competency === code).length, 20); assert.equal(c.workshops.filter(w => w.competency === code).length, 2); }
  assert.equal(createHash("sha256").update(JSON.stringify(c)).digest("hex"), JSON.parse(readFileSync("docs/writing/release.json", "utf8")).sha256);
});
test("escrita editorial rejeita duplicação, evidência incompleta e ordenação inválida", () => {
  const c = WRITING_CATALOG, good = c.activities[0];
  for (const bad of [[good, good], [{ ...good, evidence: ["única"] }], [{ ...good, kind: "order", options: ["só uma"] }]]) assert.throws(() => validate(bad, [], [], []));
});
