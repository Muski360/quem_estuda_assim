import { test } from "node:test";
import assert from "node:assert/strict";
import { READING_CATALOG, itemId } from "./catalog.ts";

test("catálogo: atividades independentes, fontes, evidências e alternativas válidas", () => {
  const ids = new Set<string>(), texts = new Set<string>();
  for (const concept of READING_CATALOG.concepts) {
    assert.match(concept.id, /^[a-z][a-z0-9-]+$/);
    assert.ok(!ids.has(concept.id)); ids.add(concept.id);
    assert.ok(concept.clues.length >= 3 && concept.contrasts.length >= 2);
    assert.equal(concept.examples.length, 3); assert.equal(concept.applications.length, 3);
    for (const [kind, items] of [["p", concept.examples], ["a", concept.applications]] as const) {
      for (const [n, item] of items.entries()) {
        assert.ok(item.text.length >= 25 && item.reason.length >= 35, itemId(concept.id, kind, n));
        assert.ok(!texts.has(item.text), `Texto repetido: ${concept.id}`); texts.add(item.text);
        assert.ok(READING_CATALOG.sources[item.source ?? "autoral"]);
      }
    }
    for (const item of concept.applications) {
      assert.ok(item.evidence.length >= 25); assert.equal(item.distractors.length, 2);
      assert.equal(new Set([item.evidence, ...item.distractors.map(d => d.text)]).size, 3);
      assert.ok(item.distractors.every(d => d.why.length >= 25));
    }
  }
});

test("piloto: seis conceitos e 36 atividades", () => {
  const pilot = ["poetica", "referencial", "romantismo-1", "realismo", "dadaismo", "surrealismo"];
  const concepts = READING_CATALOG.concepts.filter(c => pilot.includes(c.id));
  assert.equal(concepts.length, 6);
  assert.equal(concepts.reduce((n, c) => n + c.examples.length + c.applications.length, 0), 36);
});

test("lote completo: 30 conceitos e 180 atividades, contrastes disponíveis", () => {
  assert.equal(READING_CATALOG.concepts.length, 30);
  assert.equal(READING_CATALOG.concepts.reduce((n, c) => n + c.examples.length + c.applications.length, 0), 180);
  for (const c of READING_CATALOG.concepts) assert.ok(c.contrasts.every(id => READING_CATALOG.concepts.some(other => other.id === id)), c.id);
});
