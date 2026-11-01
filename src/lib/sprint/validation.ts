import { SPRINT_DAYS, SPRINT_ESSAYS, SPRINT_PRODUCTIONS, SPRINT_QUESTIONS, SPRINT_WORDS } from "./catalog.ts";
import { hasReflection, validSelection } from "./engine.ts";
import type { SprintQuestion, SprintState } from "./types.ts";

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
const days = SPRINT_DAYS.map(d => String(d.id));
const day = (v: unknown) => Number.isInteger(v) && Number(v) >= 1 && Number(v) <= 6;
const indices = (v: unknown, max: number) => Array.isArray(v) && v.length <= max && new Set(v).size === v.length && v.every(n => Number.isInteger(n) && n >= 0 && n < max);
function entries(v: unknown, keys: string[], check: (value: unknown, key: string) => boolean) {
  return object(v) && Object.keys(v).length <= keys.length && Object.entries(v).every(([key, value]) => keys.includes(key) && check(value, key));
}
function response(v: unknown, q: SprintQuestion) {
  return object(v) && Array.isArray(v.selection) && v.selection.length <= (q.kind === "choice" ? 1 : q.answer.length) && v.selection.every(n => Number.isInteger(n) && n >= -1 && n < q.options.length) && new Set(v.selection.filter(n => n >= 0)).size === v.selection.filter(n => n >= 0).length && text(v.reasoning, 1200) && text(v.correction, 2000) && Array.isArray(v.attempts) && v.attempts.length <= 10 && v.attempts.every(a => object(a) && Array.isArray(a.selection) && validSelection(q, a.selection) && text(a.reasoning, 1200) && hasReflection(a.reasoning as string) && typeof a.at === "string" && a.at.length <= 30 && Number.isFinite(Date.parse(a.at)));
}
export function isSprintState(v: unknown): v is SprintState {
  return object(v) && v.edition === 1 && day(v.day)
    && entries(v.readings, SPRINT_ESSAYS.map(e => e.id), r => object(r) && text(r.prediction, 2000) && text(r.reflection, 3000) && indices(r.opened, 4))
    && entries(v.responses, SPRINT_QUESTIONS.map(q => q.id), (r, id) => response(r, SPRINT_QUESTIONS.find(q => q.id === id)!))
    && entries(v.productions, SPRINT_PRODUCTIONS.map(p => p.id), (r, id) => object(r) && text(r.text, 6000) && text(r.reflection, 2000) && typeof r.revealed === "boolean" && Array.isArray(r.checks) && r.checks.length <= SPRINT_PRODUCTIONS.find(p => p.id === id)!.criteria.length && r.checks.every(c => typeof c === "boolean"))
    && entries(v.vocabulary, SPRINT_WORDS.map(w => w.id), (r, id) => object(r) && entries(r.recalls, days, t => text(t, 1200)) && text(r.application, 2000) && Array.isArray(r.reviewed) && r.reviewed.length <= 6 && new Set(r.reviewed).size === r.reviewed.length && r.reviewed.every(n => day(n) && n >= SPRINT_WORDS.find(w => w.id === id)!.day))
    && entries(v.comparisons, days, r => object(r) && text(r.prediction, 3000) && text(r.reflection, 3000))
    && entries(v.retrievals, days, r => text(r, 3000));
}
