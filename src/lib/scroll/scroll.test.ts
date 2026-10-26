import assert from "node:assert/strict";
import { test } from "node:test";
import { isScrollSettings, isUuid, studyDay } from "./validation.ts";
import { DEFAULT_SCROLL_SETTINGS } from "./types.ts";
import { safeReturnTo } from "../auth/return-to.ts";
import { GET, POST } from "../../app/api/scroll/route.ts";
import { answerFeedback, scrollChallenge } from "./engagement.ts";
import type { ScrollItem } from "./types.ts";

test("engajamento: cinco respostas fecham o bloco; pular não fecha e próxima abre outro", () => {
  const pending = { status: "pending" } as ScrollItem, answered = { status: "answered" } as ScrollItem;
  const base = { answered: 0, streak: 0, mode: "feed" as const, items: [pending] };
  assert.deepEqual([scrollChallenge(base).block, scrollChallenge(base).progress], [1, 0]);
  assert.equal(scrollChallenge({ ...base, answered: 4 }).closed, false);
  const closed = scrollChallenge({ ...base, answered: 5, items: [answered] });
  assert.deepEqual([closed.block, closed.progress, closed.closed], [1, 5, true]);
  const next = scrollChallenge({ ...base, answered: 5 }); assert.deepEqual([next.block, next.progress, next.closed], [2, 0, false]);
  assert.equal(scrollChallenge({ ...base, answered: 10, items: [answered] }).block, 2);
});
test("engajamento: combo anuncia 15 XP a partir do terceiro e revisão não promete pontos", () => {
  const base = { answered: 0, streak: 0, mode: "session" as const, items: [] };
  for (const streak of [0, 1]) assert.equal(scrollChallenge({ ...base, streak }).nextXp, 10);
  for (const streak of [2, 3, 10]) assert.equal(scrollChallenge({ ...base, streak }).nextXp, 15);
  for (const mode of ["due", "errors", "favorites"] as const) { const c = scrollChallenge({ ...base, mode, streak: 5 }); assert.equal(c.nextXp, 0); assert.match(c.hint, /sem repetir XP/); }
});
test("engajamento: feedback usa o XP confirmado, diferencia revisão e erro", () => {
  const correct = { status: "answered" as const, correct: true, correctIndex: 2, xp: 15 };
  assert.match(answerFeedback(correct, 3).title, /Combo 3/);
  assert.match(answerFeedback(correct, 3).detail, /\+15 XP/);
  assert.doesNotMatch(answerFeedback({ ...correct, xp: 0 }, 3).detail, /\+\d+ XP/);
  const error = answerFeedback({ ...correct, correct: false, xp: 0 }, 0);
  assert.equal(error.title, "Resposta correta: C"); assert.match(error.detail, /revisar/);
  assert.equal(answerFeedback({ ...correct, status: "expired", xp: 0 }, 0).title, "O tempo terminou.");
});

test("filtros e metas aceitam somente opções válidas e tipos corretos", () => {
  assert.equal(isScrollSettings(DEFAULT_SCROLL_SETTINGS), true);
  assert.equal(isScrollSettings({ ...DEFAULT_SCROLL_SETTINGS, mode: "due", explanationOnly: true, subject: "ingles", topic: "leitura-ingles" }), true);
  for (const patch of [{ explanationOnly: "true" }, { subject: "../outro" }, { topic: "<script>" }]) assert.equal(isScrollSettings({ ...DEFAULT_SCROLL_SETTINGS, ...patch }), false);
  for (const patch of [{ minutes: 0 }, { minutes: 31 }, { minutes: 1.5 }, { year: 2024 }, { year: "2023" }, { mode: "admin" }, { area: "physics" }, { goal: "5" }, { target: 8 }, { timed: "false" }, { language: "frances" }]) {
    assert.equal(isScrollSettings({ ...DEFAULT_SCROLL_SETTINGS, ...patch }), false, JSON.stringify(patch));
  }
  assert.equal(isUuid(crypto.randomUUID()), true);
  assert.equal(isUuid("../other-user"), false);
});
test("dia de estudo usa Brasília e retorno do login não aceita redirecionamento externo", () => {
  assert.equal(studyDay(new Date("2026-10-24T02:59:59Z")), "2026-10-23");
  assert.equal(studyDay(new Date("2026-10-24T03:00:00Z")), "2026-10-24");
  assert.equal(safeReturnTo("/scrolla"), "/scrolla");
  assert.equal(safeReturnTo("/scrolla/progresso"), "/scrolla/progresso");
  for (const path of ["https://evil.example", "//evil.example", "/\\evil.example", null]) assert.equal(safeReturnTo(path), "/");
});
test("API não entrega questões ou estatísticas sem autenticação e impede cache público", async () => {
  for (const query of ["view=stats", "view=learning", "view=explanation&questionId=enem-2021-regular-162", "view=history", `view=session&sessionId=${crypto.randomUUID()}`]) {
    const response = await GET(new Request(`http://localhost/api/scroll?${query}`));
    assert.equal(response.status, 401);
    assert.match(response.headers.get("cache-control")!, /private, no-store/);
    assert.doesNotMatch(JSON.stringify(await response.json()), /correctIndex|correct_index/);
  }
});
test("API rejeita escolhas, filtros e corpos inválidos antes de chamar o banco", async () => {
  for (const body of [[], { action: "start", settings: { ...DEFAULT_SCROLL_SETTINGS, goal: 99 } }, { action: "answer", sessionId: crypto.randomUUID(), itemId: crypto.randomUUID(), choice: 5, activeMs: 1000 }, { action: "favorite", questionId: "../../bad", favorite: true }, { action: "finish", sessionId: crypto.randomUUID(), activeMs: "1000" }]) {
    const result = await POST(new Request("http://localhost/api/scroll", { method: "POST", body: JSON.stringify(body) }));
    assert.equal(result.status, 400);
  }
});
