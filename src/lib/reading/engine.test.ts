import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEvent, createSession, emptySnapshot, flipCard, isReadingEvent, isReadingSession, readLocal, stableShuffle, dueConcepts, nextInterval, applicationChoices, applicationPrompt, projectLocal } from "./engine.ts";
import { READING_CATALOG, conceptById } from "./catalog.ts";
import type { ReadingEvent } from "./types.ts";

const event = (patch: Partial<ReadingEvent> = {}): ReadingEvent => ({ id: crypto.randomUUID(), kind: "answer", conceptId: "poetica", itemId: "le-poetica-a1", version: 1, occurredAt: "2026-10-25T12:00:00Z", choice: "poetica", evidence: 0, assisted: false, review: false, activeMs: 1000, ...patch });
test("XP: só primeira resposta completa, sem ajuda, conta e sem revisão", () => {
  const e = event(); let s = applyEvent(emptySnapshot(), e, { account: true });
  assert.equal(s.xp, 10); assert.equal(s.answered, 1);
  s = applyEvent(s, e, { account: true }); assert.equal(s.xp, 10);
  s = applyEvent(s, event(), { account: true }); assert.equal(s.xp, 10); assert.equal(s.answered, 1);
  for (const patch of [{ assisted: true }, { evidence: 1 }, { choice: "referencial" }, { review: true }]) assert.equal(applyEvent(emptySnapshot(), event(patch), { account: true }).xp, 0);
  assert.equal(applyEvent(emptySnapshot(), e).xp, 0);
  assert.equal(applyEvent(emptySnapshot(), e, { account: true, imported: true }).xp, 0);
});
test("calendário, revisões antecipadas e retenção exigem sete dias sem exposição", () => {
  let s = applyEvent(emptySnapshot(), event()); assert.equal(s.concepts.poetica.due, "2026-10-28");
  s = applyEvent(s, event({ itemId: "le-poetica-a2", occurredAt: "2026-10-26T12:00:00Z" }));
  assert.equal(s.concepts.poetica.due, "2026-10-28"); assert.equal(s.concepts.poetica.retained, false);
  s = applyEvent(s, event({ review: true, itemId: "le-poetica-a3", occurredAt: "2026-11-03T12:00:00Z" }));
  assert.equal(s.concepts.poetica.retained, true); assert.equal(s.concepts.poetica.interval, 7);
  s = applyEvent(s, event({ evidence: 2, occurredAt: "2026-11-04T12:00:00Z" }));
  assert.equal(s.concepts.poetica.retained, false); assert.equal(s.concepts.poetica.interval, 1); assert.equal(s.concepts.poetica.due, "2026-11-05");
});
test("ajuda, exposição recente e importação não comprovam retenção", () => {
  for (const mode of ["exposure", "skip", "assisted", "imported"]) {
    let s = applyEvent(emptySnapshot(), event());
    s = applyEvent(s, event({ itemId: "le-poetica-a2", occurredAt: "2026-10-26T12:00:00Z" }));
    if (mode === "exposure") s = applyEvent(s, event({ kind: "exposure", itemId: "guide:poetica", occurredAt: "2026-11-02T12:00:00Z" }));
    if (mode === "skip") s = applyEvent(s, event({ kind: "skip", occurredAt: "2026-11-02T12:00:00Z" }));
    s = applyEvent(s, event({ itemId: "le-poetica-a3", occurredAt: "2026-11-03T12:00:00Z", assisted: mode === "assisted" }), { imported: mode === "imported" });
    assert.equal(s.concepts.poetica.retained, false);
  }
});
test("pulos não consomem primeira resposta; virada do dia usa São Paulo", () => {
  let s = applyEvent(emptySnapshot(), event({ kind: "skip" })); assert.equal(s.answered, 0); assert.equal(s.concepts.poetica.due, null);
  s = applyEvent(s, event({ occurredAt: "2026-10-26T02:59:59Z", evidence: 1 }));
  assert.equal(s.concepts.poetica.due, "2026-10-26");
  assert.deepEqual(dueConcepts(s, new Date("2026-10-26T03:00:01Z")), ["poetica"]);
});
test("sessão: três conceitos, quatro aplicações, dois exemplos diferentes e cliques seguros", () => {
  const session = createSession(emptySnapshot(), "mixed"); assert.ok(isReadingSession(session));
  assert.equal(new Set(session.applications).size, 4);
  assert.ok(session.exampleIndexes[0].every((n, i) => n !== session.exampleIndexes[1][i]));
  let s = flipCard(session, 0, session.conceptIds[0]); s = flipCard(s, 1, session.conceptIds[0]);
  assert.equal(s.pairs, 1); assert.equal(flipCard(s, 1, session.conceptIds[1]), s);
  assert.equal(createSession(emptySnapshot(), "mixed", undefined, true).mode, "review");
  assert.equal(isReadingEvent(event({ evidence: 3 })), false);
  assert.deepEqual(readLocal("{broken").events, []);
  assert.deepEqual(stableShuffle([1, 2, 3], "same"), stableShuffle([1, 2, 3], "same"));
});

test("intervalos 3/7/14/30, erro original preservado e importação sem recompensa", () => {
  assert.deepEqual([1, 3, 7, 14, 30].map(nextInterval), [3, 7, 14, 30, 30]);
  let s = applyEvent(emptySnapshot(), event({ evidence: 1 }), { account: true });
  s = applyEvent(s, event({ occurredAt: "2026-10-26T12:00:00Z" }), { account: true });
  assert.equal(s.correct, 0); assert.equal(s.answered, 1); assert.equal(s.xp, 0);
  const imported = event({ itemId: "le-poetica-a2" });
  s = applyEvent(s, imported, { account: true, imported: true });
  s = applyEvent(s, { ...imported, id: crypto.randomUUID() }, { account: true });
  assert.equal(s.xp, 0);
  const exposure = applyEvent(emptySnapshot(), event({ kind: "exposure", itemId: "le-poetica-p1" }));
  assert.equal(exposure.answered, 0); assert.equal(exposure.concepts.poetica.applied.length, 0); assert.equal(exposure.concepts.poetica.retained, false);
});

test("mistura de trilhas mantém alternativas comparáveis e delimita o foco poético", () => {
  const session = createSession(emptySnapshot(), "mixed");
  session.conceptIds = ["poetica", "realismo", "cubismo"];
  for (const concept of READING_CATALOG.concepts) {
    const choices = applicationChoices(session, concept);
    assert.equal(choices.length, 3); assert.equal(new Set(choices).size, 3);
    assert.ok(choices.includes(concept.id)); assert.ok(choices.every(id => conceptById(id)?.track === concept.track));
  }
  assert.match(applicationPrompt(conceptById("poetica")!), /forma da mensagem/);
});

test("histórico extenso mantém projeção, imutabilidade e deduplicação", () => {
  const events = Array.from({ length: 250 }, (_, n) => event({ itemId: `le-poetica-a${n % 3 + 1}`, evidence: n % 2 }));
  const initial = emptySnapshot();
  const sequential = events.reduce((s, e) => applyEvent(s, e), initial);
  assert.deepEqual(initial, emptySnapshot());
  assert.deepEqual(projectLocal({ events: [...events, events[0]] }), sequential);
});
