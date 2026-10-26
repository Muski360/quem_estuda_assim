import { CODES, WRITING_CATALOG, activityById } from "./catalog.ts";
import { addDays, nextInterval, shuffle } from "../reading/engine.ts";
import { studyDay } from "../scroll/validation.ts";
import type { Competency, WritingAnswer, WritingAssessment, WritingAttempt, WritingDocument, WritingEvent, WritingLocal, WritingProgress, WritingQuiz, WritingReview, WritingSummary, WritingWorkspace } from "./types.ts";

export const blankAnswer = (): WritingAnswer => ({ choice: null, evidence: null, order: [] });
export const emptyProgress = (): WritingProgress => ({ first: {}, reviews: {}, reviewStats: { C1: { answered: 0, correct: 0 }, C2: { answered: 0, correct: 0 }, C3: { answered: 0, correct: 0 }, C4: { answered: 0, correct: 0 }, C5: { answered: 0, correct: 0 } }, answered: 0, correct: 0, xp: 0 });
export const emptyWorkspace = (): WritingWorkspace => ({ competency: "mixed", quiz: null, activeDocument: null, diagnosticDone: false });
export const emptyLocal = (): WritingLocal => ({ schema: 1, events: [], workspace: emptyWorkspace(), workspacePending: false, serverRevision: 0 });
export const blankReview = (): Record<Competency, WritingReview> => Object.fromEntries(CODES.map(c => [c, { status: "unknown", excerpt: "", problem: "", action: "" }])) as Record<Competency, WritingReview>;
export function grade(event: WritingEvent): boolean {
  const a = activityById(event.activityId, event.edition);
  return !!a && event.kind === "answer" && (a.kind === "choice" ? event.answer.choice === 0 && event.answer.evidence === 0 : event.answer.order.length === a.options.length && event.answer.order.every((n, i) => n === i));
}
export function applyAttempt(previous: WritingProgress, event: WritingEvent, options: { account?: boolean; imported?: boolean; now?: Date } = {}): { progress: WritingProgress; attempt: WritingAttempt } {
  const a = activityById(event.activityId, event.edition)!;
  const correct = grade(event), first = !Object.hasOwn(previous.first, event.activityId);
  const progress = { ...previous, first: { ...previous.first }, reviews: { ...previous.reviews }, reviewStats: { ...emptyProgress().reviewStats, ...previous.reviewStats } };
  let xp = 0;
  if (event.kind === "answer") {
    if (event.review || !first) { const old = progress.reviewStats[a.competency]; progress.reviewStats[a.competency] = { answered: old.answered + 1, correct: old.correct + Number(correct) }; }
    if (first) { progress.first[event.activityId] = { correct, assisted: event.assisted, imported: !!options.imported }; progress.answered++; if (correct) progress.correct++; }
    if (first && correct && !event.assisted && !event.review && options.account && !options.imported) { xp = 10; progress.xp += xp; }
    const now = options.now ?? new Date(event.occurredAt), day = studyDay(now), prior = previous.reviews[event.activityId];
    if (!(options.imported && prior)) {
      const due = !prior || prior.due <= day;
      const interval = !correct || event.assisted ? 1 : !prior ? 3 : due ? nextInterval(prior.interval) : prior.interval;
      progress.reviews[event.activityId] = { due: !correct || event.assisted || due ? addDays(day, interval) : prior.due, interval, at: now.toISOString(), correct };
    }
  }
  return { progress, attempt: { ...event, correct, xp, imported: !!options.imported, competency: a.competency } };
}
export function projectEvents(events: WritingEvent[], base = emptyProgress(), account = false) {
  const seen = new Set<string>(); let progress = base;
  const attempts: WritingAttempt[] = [];
  for (const e of events) if (!seen.has(e.id)) { seen.add(e.id); const next = applyAttempt(progress, e, { account }); progress = next.progress; attempts.push(next.attempt); }
  return { progress, attempts };
}
export const dueActivities = (progress: WritingProgress, now = new Date()) => Object.entries(progress.reviews).filter(([, r]) => r.due <= studyDay(now) && studyDay(new Date(r.at)) < studyDay(now)).map(([id]) => id);
export function createQuiz(progress: WritingProgress, mode: WritingQuiz["mode"], competency: Competency | "mixed" = "mixed"): WritingQuiz {
  const pool = WRITING_CATALOG.activities.filter(a => competency === "mixed" || a.competency === competency);
  const due = dueActivities(progress);
  const chosen = mode === "diagnostic" ? shuffle(CODES.flatMap(c => WRITING_CATALOG.activities.filter(a => a.competency === c).slice(0, 2))) : shuffle(pool).filter(a => mode !== "review" || due.includes(a.id)).sort((a, b) => Number(!!progress.first[a.id]) - Number(!!progress.first[b.id])).slice(0, 5);
  return { id: crypto.randomUUID(), mode, edition: 1, items: chosen.map(a => a.id), position: 0, answers: [], draft: blankAnswer(), assisted: false, pendingActiveMs: 0 };
}
export function makeDocument(kind: WritingDocument["kind"], contentId: string, parentId: string | null = null): WritingDocument {
  const t = WRITING_CATALOG.topics.find(t => t.id === contentId), w = WRITING_CATALOG.workshops.find(w => w.id === contentId), r = WRITING_CATALOG.readings.find(r => r.id === contentId);
  return { id: crypto.randomUUID(), edition: 1, kind, contentId, parentId, title: t?.title ?? w?.title ?? r?.focus ?? "Minha escrita", text: "", plan: "", draftBasedOn: null, versions: [], assessments: [], updatedAt: new Date().toISOString() };
}
export function completeVersion(document: WritingDocument): WritingDocument {
  if (!document.text.trim() || document.versions.at(-1)?.text === document.text) return document;
  const version = { id: crypto.randomUUID(), text: document.text, createdAt: new Date().toISOString(), basedOn: document.draftBasedOn ?? document.versions.at(-1)?.id ?? null, review: blankReview(), reflection: "", reviewedAt: null };
  return { ...document, draftBasedOn: version.id, versions: [...document.versions, version], updatedAt: version.createdAt };
}
export function assessmentTotal(assessment: WritingAssessment): number | null {
  return CODES.every(c => assessment.scores[c] !== undefined) ? CODES.reduce((n, c) => n + assessment.scores[c]!, 0) : assessment.total;
}
export function competencyStats(progress: WritingProgress, c: Competency) {
  const items = Object.entries(progress.first).filter(([id]) => activityById(id)?.competency === c);
  return { answered: items.length, correct: items.filter(([, a]) => a.correct).length };
}
export function recommendedCompetency(progress: WritingProgress, documents: Pick<WritingDocument, "assessments">[]): Competency {
  const assessments = documents.flatMap(d => d.assessments).filter(a => CODES.some(c => a.scores[c] !== undefined)).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  if (assessments[0]) return [...CODES].filter(c => assessments[0].scores[c] !== undefined).sort((a, b) => assessments[0].scores[a]! - assessments[0].scores[b]!)[0];
  return [...CODES].sort((a, b) => { const x = competencyStats(progress, a), y = competencyStats(progress, b); return (x.answered ? x.correct / x.answered : -1) - (y.answered ? y.correct / y.answered : -1) || x.answered - y.answered; })[0];
}
export const documentCounts = (text: string) => ({ words: text.trim() ? text.trim().split(/\s+/u).length : 0, paragraphs: text.trim() ? text.trim().split(/\n\s*\n/u).filter(Boolean).length : 0 });
export function documentSummary(d: WritingDocument): WritingSummary {
  return { id: d.id, title: d.title, kind: d.kind, contentId: d.contentId, updatedAt: d.updatedAt, assessments: d.assessments, versions: d.versions.map(v => ({ id: v.id, createdAt: v.createdAt, basedOn: v.basedOn, reviewed: !!v.reviewedAt })), hasDraft: !!d.text.trim() && d.versions.at(-1)?.text !== d.text };
}
