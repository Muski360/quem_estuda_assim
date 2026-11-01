import { SPRINT_DAYS, SPRINT_QUESTIONS, wordsForDay } from "./catalog.ts";
import type { SprintAttempt, SprintQuestion, SprintResponse, SprintState } from "./types.ts";
import type { Competency, WritingDocument } from "../writing/types.ts";

export const emptySprint = (): SprintState => ({ edition: 1, day: 1, readings: {}, responses: {}, productions: {}, vocabulary: {}, comparisons: {}, retrievals: {} });
export const hasReflection = (text: string) => text.trim().length >= 80 && text.trim().split(/\s+/u).length >= 12;
export const sameSelection = (a: number[], b: number[]) => a.length === b.length && a.every((n, i) => n === b[i]);
export function validSelection(q: SprintQuestion, selection: number[]) {
  return Array.isArray(selection) && selection.length === (q.kind === "choice" ? 1 : q.answer.length) && selection.every(n => Number.isInteger(n) && n >= 0 && n < q.options.length) && new Set(selection).size === selection.length;
}
export function submitResponse(q: SprintQuestion, response: SprintResponse, at = new Date().toISOString()): SprintResponse {
  if (!validSelection(q, response.selection) || !hasReflection(response.reasoning)) return response;
  const attempt: SprintAttempt = { selection: [...response.selection], reasoning: response.reasoning.trim(), at };
  if (response.attempts.at(-1) && sameSelection(response.attempts.at(-1)!.selection, attempt.selection) && response.attempts.at(-1)!.reasoning === attempt.reasoning) return response;
  // shortcut: guarda a primeira e as últimas nove tentativas; ampliar se houver necessidade de histórico integral.
  const attempts = [...response.attempts, attempt];
  return { ...response, attempts: attempts.length > 10 ? [attempts[0], ...attempts.slice(-9)] : attempts };
}
export function responseDone(q: SprintQuestion, r?: SprintResponse) {
  const latest = r?.attempts.at(-1);
  return !!latest && sameSelection(latest.selection, q.answer) && hasReflection(latest.reasoning) && (sameSelection(r!.attempts[0].selection, q.answer) || hasReflection(r!.correction));
}
export function readingDone(s: SprintState, essayId: string) {
  const r = s.readings[essayId];
  return !!r && hasReflection(r.prediction) && r.opened.length === 4 && hasReflection(r.reflection);
}
export function productionDone(s: SprintState, task: typeof SPRINT_DAYS[number]["productions"][number]) {
  const p = s.productions[task.id];
  return !!p && hasReflection(p.text) && p.text.trim().length >= task.minimum && hasReflection(p.reflection) && p.checks.length === task.criteria.length && p.checks.every(Boolean);
}
export function finalDone(d: WritingDocument) {
  return d.versions.some(v => v.text.trim().length >= 800 && v.text.trim().split(/\s+/u).length >= 120 && v.text.trim().split(/\n\s*\n/u).length >= 3 && !!v.reviewedAt && hasReflection(v.reflection) && Object.values(v.review).every(r => r.excerpt.trim().length > 0 && r.action.trim().length > 0));
}
export function dayProgress(s: SprintState, day: number, document?: WritingDocument) {
  const d = SPRINT_DAYS[day - 1], comparison = s.comparisons[String(day)];
  const items = [
    ...d.essays.map(id => readingDone(s, id)),
    hasReflection(comparison?.prediction ?? "") && hasReflection(comparison?.reflection ?? ""),
    ...SPRINT_QUESTIONS.filter(q => q.day === day).map(q => responseDone(q, s.responses[q.id])),
    ...d.productions.map(p => productionDone(s, p)),
    ...wordsForDay(day).map(w => { const v = s.vocabulary[w.id]; return !!v && v.reviewed.includes(day) && hasReflection(v.recalls[String(day)] ?? "") && hasReflection(v.application); }),
    hasReflection(s.retrievals[String(day)] ?? ""),
    ...(day === 6 ? [!!document && finalDone(document)] : []),
  ];
  return { done: items.filter(Boolean).length, total: items.length, complete: items.every(Boolean) };
}
export function sprintStats(s: SprintState, c: Competency) {
  const items = SPRINT_QUESTIONS.filter(q => q.competency === c);
  const answered = items.filter(q => s.responses[q.id]?.attempts.length);
  return { answered: answered.length, total: items.length, first: answered.filter(q => sameSelection(s.responses[q.id].attempts[0].selection, q.answer)).length, current: answered.filter(q => responseDone(q, s.responses[q.id])).length };
}
export const errorsForDay = (s: SprintState, day: number) => SPRINT_QUESTIONS.filter(q => q.day <= day && s.responses[q.id]?.attempts.length && !responseDone(q, s.responses[q.id]));
