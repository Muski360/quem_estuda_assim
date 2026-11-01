import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { SPRINT_ANALYSES, SPRINT_DAYS, SPRINT_ESSAYS, SPRINT_ID, SPRINT_QUESTIONS, SPRINT_WORDS, wordsForDay } from "./catalog.ts";
import { dayProgress, emptySprint, errorsForDay, finalDone, hasReflection, responseDone, sameSelection, sprintStats, submitResponse, validSelection } from "./engine.ts";
import { isSprintState } from "./validation.ts";
import { completeVersion, makeDocument } from "../writing/engine.ts";
import { isDocument, preservesVersions } from "../writing/validation.ts";
import type { SprintResponse } from "./types.ts";

const reflection = "Eu preciso distinguir o alcance da informação e explicar o mecanismo que liga a condição descrita ao resultado, sem transformar uma hipótese em comprovação.";
const response = (selection: number[] = []): SprintResponse => ({ selection, reasoning: reflection, attempts: [], correction: "" });
const document = () => ({ ...makeDocument("sprint", SPRINT_ID), title: "Meu sprint", sprint: emptySprint() });

test("sprint editorial: 12 originais identificados, 48 parágrafos e recibos de fonte", () => {
  const release = JSON.parse(readFileSync("docs/sprint/release.json", "utf8"));
  assert.equal(release.edition, 1);
  assert.deepEqual(Object.keys(release.files).sort(), ["analyses.ts", "context.ts", "days.ts", "essays.ts", "questions.ts"]);
  for (const [name, hash] of Object.entries(release.files)) assert.equal(createHash("sha256").update(readFileSync(`src/data/sprint/${name}`, "utf8").replace(/\r\n/gu, "\n")).digest("hex"), hash, name);
  const sources = JSON.parse(readFileSync("docs/sprint/sources.json", "utf8"));
  assert.equal(SPRINT_ESSAYS.length, 12);
  assert.equal(new Set(SPRINT_ESSAYS.map(e => e.id)).size, 12);
  assert.deepEqual([...new Set(SPRINT_ESSAYS.map(e => e.year))].sort(), [2022, 2023]);
  for (const e of SPRINT_ESSAYS) {
    const receipt = sources.essays.find((r: { id: string }) => r.id === e.id);
    assert.ok(receipt); assert.equal(e.score, 1000); assert.equal(e.pdfPage, e.page + 2);
    assert.equal(receipt.author, e.author); assert.equal(receipt.source, e.source); assert.equal(receipt.item, e.item); assert.equal(receipt.pdfPage, e.pdfPage);
    assert.equal(e.paragraphs.length, 4);
    assert.ok(e.paragraphs.every(p => p.length > 200 && !/[\u0000-\u001f\ufffd]/u.test(p)));
    assert.equal(createHash("sha256").update(JSON.stringify(e.paragraphs)).digest("hex"), receipt.sha256);
    assert.ok(!e.paragraphs.join(" ").includes("COMENTÁRIO"));
  }
  assert.equal(sources.sources.length, 2);
  assert.ok(sources.sources.every((s: { rightsPdfPage: number; sha256: string }) => s.rightsPdfPage === 4 && /^[a-f0-9]{64}$/u.test(s.sha256)));
});

test("sprint editorial: análise individual, diversidade de tarefas e equilíbrio de C1 a C5", () => {
  assert.equal(SPRINT_DAYS.length, 6); assert.equal(SPRINT_ANALYSES.length, 12); assert.equal(SPRINT_WORDS.length, 24);
  assert.equal(SPRINT_QUESTIONS.length, 30);
  assert.equal(SPRINT_DAYS.flatMap(d => d.productions).length, 11);
  assert.equal(new Set(SPRINT_DAYS.flatMap(d => d.essays)).size, 12);
  for (const d of SPRINT_DAYS) {
    assert.equal(d.date, `2026-11-${String(d.id + 1).padStart(2, "0")}`);
    assert.equal(new Set(SPRINT_QUESTIONS.filter(q => q.day === d.id).map(q => q.competency)).size, 5);
    assert.ok(d.comparison.length > 350 && d.comparisonTask.length > 80);
  }
  for (const c of ["C1", "C2", "C3", "C4", "C5"]) assert.equal(SPRINT_QUESTIONS.filter(q => q.competency === c).length, 6);
  for (const a of SPRINT_ANALYSES) {
    assert.ok(SPRINT_ESSAYS.some(e => e.id === a.essayId)); assert.equal(a.sections.length, 4);
    assert.ok(a.sections.every(s => s.analysis.length > 240 && s.question.length > 40));
    assert.equal(Object.keys(a.competencies).length, 5);
    assert.ok(Object.values(a.competencies).every(s => s.length > 100));
    assert.ok(a.vocabulary.every(w => Object.values(w).every(s => s.length > 5)));
    const original = SPRINT_ESSAYS.find(e => e.id === a.essayId)!.paragraphs.join(" ").toLocaleLowerCase("pt-BR");
    assert.ok(a.vocabulary.every(w => original.includes(w.term.toLocaleLowerCase("pt-BR"))), a.essayId);
  }
  const prompts = new Set<string>();
  for (const q of SPRINT_QUESTIONS) {
    assert.ok(!prompts.has(q.prompt)); prompts.add(q.prompt);
    assert.ok(validSelection(q, q.answer), q.id); assert.equal(new Set(q.options).size, q.options.length);
    assert.ok(q.feedback.every(f => f.length > 40), q.id);
    assert.ok(q.explanation.length > 150 && q.repair.length > 90, q.id);
    if (q.kind === "choice") { assert.equal(q.options.length, 5); assert.equal(q.feedback.length, 5); }
    if (q.kind === "order") { assert.equal(q.feedback.length, q.options.length); assert.ok(!sameSelection(q.answer, q.options.map((_, i) => i)), q.id); }
    if (q.kind === "match") { assert.equal(q.pairs?.length, 5); assert.equal(q.options.length, 5); assert.equal(q.feedback.length, 5); }
  }
  assert.equal(new Set(SPRINT_QUESTIONS.filter(q => q.kind === "choice").map(q => q.answer[0])).size, 5);
});

test("sprint: resposta exige seleção completa e reflexão; duplicação não cria tentativa", () => {
  const q = SPRINT_QUESTIONS[0];
  for (const r of [response(), { ...response(q.answer), reasoning: "Escolhi esta." }, response([99]), response([0, 1])]) assert.equal(submitResponse(q, r), r);
  const submitted = submitResponse(q, response(q.answer));
  assert.equal(submitted.attempts.length, 1); assert.ok(responseDone(q, submitted));
  assert.equal(submitResponse(q, submitted), submitted);
  assert.equal(hasReflection("a".repeat(100)), false, "Contagem de caracteres sozinha não conclui reflexão");
  assert.equal(dayProgress(emptySprint(), 1).done, 0);
});

test("sprint: erro exige nova tentativa e explicação; primeira precisão é preservada", () => {
  const q = SPRINT_QUESTIONS[0], state = emptySprint();
  let r = submitResponse(q, response([0])); state.responses[q.id] = r;
  assert.equal(errorsForDay(state, 1).length, 1); assert.equal(responseDone(q, r), false);
  r = submitResponse(q, { ...r, selection: q.answer, reasoning: reflection + " Agora mantenho o recorte do tema." });
  assert.equal(responseDone(q, r), false, "Acerto posterior sozinho não apaga a revisão do erro");
  r.correction = reflection; state.responses[q.id] = r;
  assert.equal(responseDone(q, r), true); assert.equal(errorsForDay(state, 1).length, 0);
  assert.deepEqual(sprintStats(state, "C2"), { answered: 1, total: 6, first: 0, current: 1 });
  for (let i = 0; i < 20; i++) r = submitResponse(q, { ...r, reasoning: `${reflection} Tentativa ${i}.` });
  assert.equal(r.attempts.length, 10); assert.deepEqual(r.attempts[0].selection, [0]);
});

test("sprint: associação incompleta e ordenação retomam sem aceitar gabarito inválido", () => {
  const state = emptySprint(), match = SPRINT_QUESTIONS.find(q => q.kind === "match")!, order = SPRINT_QUESTIONS.find(q => q.kind === "order")!;
  state.responses[match.id] = response([2, -1, -1, -1, -1]);
  state.responses[order.id] = { ...response([2, 0, 3, 1]), reasoning: "Rascunho ainda em construção." };
  assert.ok(isSprintState(state)); assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  assert.equal(validSelection(match, state.responses[match.id].selection), false);
  assert.equal(validSelection(order, [0, 0, 1, 2]), false);
  assert.equal(isSprintState({ ...state, responses: { [match.id]: response([2, 2]) } }), false);
  state.responses[match.id] = submitResponse(match, response(match.answer));
  assert.ok(responseDone(match, state.responses[match.id])); assert.ok(isSprintState(state));
});

test("sprint: calendário de vocabulário e recuperação independente em cada dia", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(d => wordsForDay(d).length), [4, 8, 8, 12, 12, 12]);
  const state = emptySprint(), word = SPRINT_WORDS[0];
  state.vocabulary[word.id] = { recalls: { "1": reflection }, application: reflection, reviewed: [1] };
  assert.ok(isSprintState(state)); assert.equal(dayProgress(state, 1).done, 1); assert.equal(dayProgress(state, 2).done, 0);
  state.vocabulary[word.id].recalls["2"] = reflection; state.vocabulary[word.id].reviewed.push(2);
  assert.equal(dayProgress(state, 2).done, 1);
});

test("sprint: páginas exploradas e marcações sem texto não concluem um dia", () => {
  const s = emptySprint(), d = SPRINT_DAYS[0];
  for (const id of d.essays) s.readings[id] = { prediction: "", opened: [0, 1, 2, 3], reflection: "" };
  for (const p of d.productions) s.productions[p.id] = { text: "", reflection: "", checks: p.criteria.map(() => true), revealed: true };
  assert.equal(dayProgress(s, 1).complete, false); assert.equal(dayProgress(s, 1).done, 0);
  for (const id of d.essays) s.readings[id] = { prediction: reflection, opened: [0, 1, 2, 3], reflection };
  s.comparisons["1"] = { prediction: reflection, reflection }; s.retrievals["1"] = reflection;
  for (const q of SPRINT_QUESTIONS.filter(q => q.day === 1)) s.responses[q.id] = submitResponse(q, response(q.answer));
  for (const p of d.productions) s.productions[p.id] = { text: reflection.repeat(3), reflection, checks: p.criteria.map(() => true), revealed: true };
  for (const w of wordsForDay(1)) s.vocabulary[w.id] = { recalls: { "1": reflection }, application: reflection, reviewed: [1] };
  assert.ok(isSprintState(s)); assert.equal(dayProgress(s, 1).complete, true);
});

test("sprint: caderno compatível com o Escreve, simulado sem nota e versões preservadas", () => {
  let d = document(); assert.ok(isDocument(d));
  d = { ...completeVersion({ ...d, text: "Um rascunho curto." }), sprint: d.sprint };
  assert.equal(finalDone(d), false);
  const prose = Array.from({ length: 4 }, () => reflection.repeat(3)).join("\n\n");
  const next = completeVersion({ ...d, text: prose });
  const v = next.versions.at(-1)!; v.reflection = reflection; v.reviewedAt = new Date().toISOString();
  for (const c of ["C1", "C2", "C3", "C4", "C5"] as const) v.review[c] = { status: "unknown", excerpt: "Um trecho para conferir.", problem: "Não tenho certeza.", action: "Verificar com um professor antes de afirmar que atendi." };
  assert.ok(isDocument(next)); assert.ok(finalDone(next), "Incerteza honesta com evidência e próxima ação pode concluir a autoavaliação");
  assert.ok(preservesVersions(d, next)); assert.equal(next.assessments.length, 0);
  assert.equal(isDocument({ ...next, contentId: "inventado" }), false);
  assert.equal(isDocument({ ...makeDocument("essay", "tema-leitura"), sprint: emptySprint() }), false);
});

test("sprint: validação rejeita adulteração sem perder rascunhos incompletos válidos", () => {
  const d = document(); d.sprint.readings.amanda = { prediction: "Parcial", reflection: "", opened: [] };
  assert.ok(isDocument(d)); assert.ok(isDocument(JSON.parse(JSON.stringify(d))));
  for (const patch of [{ edition: 2 }, { day: "1" }, { day: 0 }, { day: 7 }, { readings: { intruso: d.sprint.readings.amanda } }, { readings: { amanda: { ...d.sprint.readings.amanda, opened: [0, 0] } } }, { retrievals: { "1": "x".repeat(3001) } }, { responses: { intruso: response() } }]) assert.equal(isSprintState({ ...emptySprint(), ...patch }), false);
  const word = SPRINT_WORDS.find(w => w.day === 3)!;
  assert.equal(isSprintState({ ...emptySprint(), vocabulary: { [word.id]: { recalls: {}, application: "", reviewed: [1] } } }), false);
});
