import { test } from "node:test";
import assert from "node:assert/strict";
import { READING_CATALOG, READING_VERSIONS, applicationById, itemId } from "./catalog.ts";

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

test("edição 2: 44 conceitos e 264 atividades, contrastes disponíveis", () => {
  assert.equal(READING_CATALOG.version, 2);
  assert.equal(READING_CATALOG.concepts.length, 44);
  assert.equal(READING_CATALOG.concepts.reduce((n, c) => n + c.examples.length + c.applications.length, 0), 264);
  for (const c of READING_CATALOG.concepts) assert.ok(c.contrasts.every(id => READING_CATALOG.concepts.some(other => other.id === id)), c.id);
});

test("figuras: recorte de 14 conceitos, 84 atividades autorais e contrastes da mesma trilha", () => {
  const figures = READING_CATALOG.concepts.filter(c => c.track === "figures");
  assert.deepEqual(figures.map(c => c.id), ["metafora", "comparacao", "metonimia", "personificacao", "sinestesia", "hiperbole", "eufemismo", "ironia", "antitese", "paradoxo", "anafora", "pleonasmo", "aliteracao", "assonancia"]);
  assert.equal(figures.reduce((n, c) => n + c.examples.length + c.applications.length, 0), 84);
  for (const c of figures) {
    assert.ok(c.contrasts.every(id => figures.some(other => other.id === id) && id !== c.id), c.id);
    assert.ok(c.examples.concat(c.applications).every(item => !item.source && !item.image));
    assert.ok(c.description.length > 90 && c.confusion.length > 100, c.id);
  }
});

test("edição 1 preserva os 30 conceitos, IDs e conteúdo usados no histórico", () => {
  const previous = READING_VERSIONS[1];
  assert.equal(previous.version, 1);
  assert.equal(previous.concepts.length, 30);
  assert.deepEqual(READING_CATALOG.concepts.slice(0, 30), previous.concepts);
  assert.equal(applicationById("le-metafora-a1", 1), null);
  assert.equal(applicationById("le-metafora-a1", 2)?.concept.id, "metafora");
  assert.deepEqual(applicationById("le-poetica-a1", 2), applicationById("le-poetica-a1", 1));
});
