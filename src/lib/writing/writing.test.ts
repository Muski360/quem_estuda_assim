import { test } from "node:test";
import assert from "node:assert/strict";
import { CODES, WRITING_CATALOG } from "./catalog.ts";
import { applyAttempt, assessmentTotal, blankAnswer, completeVersion, createQuiz, documentCounts, documentSummary, dueActivities, emptyLocal, emptyProgress, makeDocument, projectEvents, recommendedCompetency } from "./engine.ts";
import { isDocument, isQuiz, isWritingEvent, preservesVersions, readLocal } from "./validation.ts";
import type { WritingAssessment, WritingEvent } from "./types.ts";

const event = (patch: Partial<WritingEvent> = {}): WritingEvent => ({ id: crypto.randomUUID(), activityId: "es-c1-01", edition: 1, kind: "answer", answer: { choice: 0, evidence: 0, order: [] }, assisted: false, review: false, occurredAt: "2026-10-26T12:00:00Z", activeMs: 1200, ...patch });
test("escrita: piloto equilibrado, diagnóstico, sessões e escolhas retomáveis", () => {
  assert.equal(WRITING_CATALOG.activities.filter(a => Number(a.id.slice(-2)) <= 5).length, 25);
  const diagnostic = createQuiz(emptyProgress(), "diagnostic"); assert.ok(isQuiz(diagnostic)); assert.equal(diagnostic.items.length, 10);
  for (const c of CODES) assert.equal(diagnostic.items.filter(id => id.startsWith(`es-${c.toLowerCase()}`)).length, 2);
  for (const c of [...CODES, "mixed"] as const) { const q = createQuiz(emptyProgress(), "practice", c); assert.equal(q.items.length, 5); assert.equal(new Set(q.items).size, 5); }
  diagnostic.draft = { choice: 2, evidence: 1, order: [] }; diagnostic.pendingActiveMs = 3210;
  const local = { ...emptyLocal(), workspace: { ...emptyLocal().workspace, quiz: diagnostic } };
  assert.deepEqual(readLocal(JSON.stringify(local)), local);
  assert.deepEqual(readLocal("oops"), emptyLocal());
});
test("escrita: XP só no primeiro acerto completo, sem ajuda, com conta", () => {
  let p = applyAttempt(emptyProgress(), event(), { account: true }).progress;
  p = applyAttempt(p, event(), { account: true }).progress; assert.equal(p.xp, 10); assert.equal(p.answered, 1);
  for (const e of [event({ assisted: true }), event({ review: true }), event({ answer: { ...blankAnswer(), choice: 0, evidence: 1 } }), event({ kind: "skip" })]) assert.equal(applyAttempt(emptyProgress(), e, { account: true }).progress.xp, 0);
  assert.equal(applyAttempt(emptyProgress(), event()).progress.xp, 0);
  assert.equal(applyAttempt(emptyProgress(), event(), { account: true, imported: true }).progress.xp, 0);
  const wrong = applyAttempt(emptyProgress(), event({ answer: { choice: 1, evidence: 0, order: [] } }), { account: true }).progress;
  const after = applyAttempt(wrong, event(), { account: true }).progress; assert.equal(after.correct, 0); assert.equal(after.xp, 0);
  assert.deepEqual(after.reviewStats.C1, { answered: 1, correct: 1 }, "Review performance stays separate from original accuracy");
  const e = event(); assert.equal(projectEvents([e, e], emptyProgress(), true).attempts.length, 1);
});
test("escrita: ordenação completa e validação sem aceitar índices inválidos", () => {
  const e = event({ activityId: "es-c1-05", answer: { choice: null, evidence: null, order: [0, 1, 2] } });
  assert.ok(isWritingEvent(e)); assert.equal(applyAttempt(emptyProgress(), e).attempt.correct, true);
  assert.equal(applyAttempt(emptyProgress(), { ...e, answer: { ...e.answer, order: [1, 0, 2] } }).attempt.correct, false);
  for (const order of [[0, 0, 2], [0, 1], [0, 1, 9]]) assert.equal(isWritingEvent({ ...e, answer: { ...e.answer, order } }), false);
  for (const edition of ["1", 2, "__proto__", null]) assert.equal(isWritingEvent({ ...e, edition }), false);
});
test("escrita: calendário usa São Paulo, revisão antecipada e importação preservam vencimento", () => {
  let p = applyAttempt(emptyProgress(), event()).progress; assert.equal(p.reviews["es-c1-01"].due, "2026-10-29");
  p = applyAttempt(p, event({ occurredAt: "2026-10-27T12:00:00Z" })).progress; assert.equal(p.reviews["es-c1-01"].due, "2026-10-29");
  p = applyAttempt(p, event({ occurredAt: "2026-10-30T12:00:00Z", review: true })).progress; assert.equal(p.reviews["es-c1-01"].interval, 7);
  const due = p.reviews["es-c1-01"].due;
  p = applyAttempt(p, event({ answer: { choice: 2, evidence: 0, order: [] } }), { imported: true }).progress; assert.equal(p.reviews["es-c1-01"].due, due);
  p = applyAttempt(p, event({ occurredAt: "2026-11-02T02:59:59Z", answer: { choice: 1, evidence: 0, order: [] } })).progress;
  assert.equal(p.reviews["es-c1-01"].due, "2026-11-02"); assert.deepEqual(dueActivities(p, new Date("2026-11-02T03:00:01Z")), ["es-c1-01"]);
  assert.equal(applyAttempt(emptyProgress(), event({ kind: "skip" })).progress.answered, 0);
});
test("caderno: versões imutáveis, revisão, transição e texto simples", () => {
  let doc = makeDocument("essay", "tema-leitura"); assert.ok(isDocument(doc));
  doc = completeVersion({ ...doc, text: "Minha tese.\n\nMeu argumento." }); assert.equal(doc.versions.length, 1); assert.ok(isDocument(doc));
  assert.equal(completeVersion(doc), doc);
  const next = completeVersion({ ...doc, text: doc.text + " Uma explicação." }); assert.equal(next.versions.length, 2); assert.equal(next.versions[1].basedOn, doc.versions[0].id); assert.ok(preservesVersions(doc, next));
  assert.equal(preservesVersions(doc, { ...next, versions: [] }), false);
  assert.equal(preservesVersions(doc, { ...next, versions: [{ ...next.versions[0], text: "Outro texto" }] }), false);
  const revised = structuredClone(doc); revised.versions[0].review.C1 = { status: "partial", excerpt: "Minha tese.", problem: "Revisar construção", action: "Explicar melhor" }; assert.ok(isDocument(revised));
  revised.versions[0].review.C1.excerpt = "Referência a um trecho para conferir"; assert.ok(isDocument(revised), "An incomplete review note must not make the draft disappear on reload");
  assert.equal(isDocument({ ...doc, text: "x".repeat(20001) }), false);
  assert.deepEqual(documentCounts("Um texto.\n\nOutra ideia."), { words: 4, paragraphs: 2 });
  assert.equal(documentSummary(doc).versions[0].reviewed, false);
});
test("avaliação externa: versão correta, valores limitados e total sem inventar competências", () => {
  const doc = completeVersion({ ...makeDocument("essay", "tema-leitura"), text: "Um texto para revisar." });
  const a: WritingAssessment = { id: crypto.randomUUID(), versionId: doc.versions[0].id, source: "Professora fora da plataforma", receivedAt: "2026-10-26", recordedAt: "2026-10-26T12:00:00Z", scores: {}, total: 820, comment: "Desenvolver o segundo argumento." };
  assert.ok(isDocument({ ...doc, assessments: [a] })); assert.equal(assessmentTotal(a), 820); assert.deepEqual(a.scores, {});
  const full = { ...a, scores: { C1: 160, C2: 200, C3: 120, C4: 160, C5: 200 }, total: null };
  assert.equal(assessmentTotal(full), 840); assert.equal(recommendedCompetency(emptyProgress(), [{ assessments: [full] }]), "C3");
  assert.equal(isDocument({ ...doc, assessments: [{ ...full, total: 999 }] }), false);
  assert.equal(isDocument({ ...doc, assessments: [{ ...a, versionId: crypto.randomUUID() }] }), false);
  assert.equal(isDocument({ ...doc, assessments: [{ ...a, scores: { C1: 201 } }] }), false);
  assert.equal(isDocument({ ...doc, assessments: [{ ...a, scores: { C2: -1 } }] }), false);
});
