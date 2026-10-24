import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import mathematics from "./content/mathematics.mjs";
import nature from "./content/nature.mjs";
import humanities from "./content/humanities.mjs";
import languages from "./content/languages.mjs";

const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
export const digest = value => createHash("sha256").update(typeof value === "string" || Buffer.isBuffer(value) ? value : JSON.stringify(canonical(value))).digest("hex");
export const authored = [...mathematics, ...nature, ...humanities, ...languages];
export const taxonomy = JSON.parse(await readFile(new URL("taxonomy.json", import.meta.url), "utf8"));

export function validateExplanation(row, question) {
  const [id, path, answer, summary, steps, alternatives] = row;
  assert.ok(question && question.id === id, `Question unavailable: ${id}`);
  assert.equal(answer, String.fromCharCode(65 + question.correct_index), `Answer disagreement: ${id}`);
  const [subject, topic] = path.split("/");
  assert.equal(taxonomy[subject]?.area, question.area, `Area disagreement: ${id}`);
  assert.ok(taxonomy[subject].topics[topic], `Unknown topic: ${id}`);
  assert.ok(typeof summary === "string" && summary.length >= 30, `Summary missing: ${id}`);
  assert.ok(Array.isArray(steps) && steps.length >= 3 && steps.length <= 8, `Steps missing: ${id}`);
  assert.equal(alternatives?.length, 5, `Five rationales required: ${id}`);
  for (const text of [summary, ...steps, ...alternatives]) {
    assert.ok(typeof text === "string" && text.length >= 20, `Incomplete explanation: ${id}`);
    assert.ok(!/[\u0000-\u0009\u000b-\u001f]|<\/?[a-z][a-z0-9]*(?:\s[^>]*)?>|javascript:/i.test(text), `Unsafe or damaged text: ${id}`);
  }
  return { question_id: id, subject, topic, subject_label: taxonomy[subject].label, topic_label: taxonomy[subject].topics[topic],
    checksum: question.checksum, content: { summary, steps, alternatives: Object.fromEntries(alternatives.map((text, i) => [String.fromCharCode(65 + i), text])) } };
}

export async function catalog() {
  const bank = JSON.parse(await readFile("output/enem/approved.json", "utf8"));
  assert.equal(new Set(authored.map(row => row[0])).size, authored.length, "Duplicate question");
  const rows = authored.map(row => validateExplanation(row, bank.find(q => q.id === row[0])));
  return { rows, bank, contentDigest: digest(rows) };
}
