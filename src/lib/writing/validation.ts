import { CODES, WRITING_CATALOG, activityById } from "./catalog.ts";
import { emptyLocal } from "./engine.ts";
import type { WritingAnswer, WritingDocument, WritingEvent, WritingLocal, WritingQuiz, WritingWorkspace } from "./types.ts";

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const text = (v: unknown, max: number) => typeof v === "string" && v.length <= max;
export const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const date = (v: unknown) => typeof v === "string" && v.length <= 30 && Number.isFinite(Date.parse(v));
export function isAnswer(v: unknown): v is WritingAnswer {
  return object(v) && (v.choice === null || Number.isInteger(v.choice) && Number(v.choice) >= 0 && Number(v.choice) < 3) && (v.evidence === null || Number.isInteger(v.evidence) && Number(v.evidence) >= 0 && Number(v.evidence) < 3) && Array.isArray(v.order) && v.order.length <= 5 && new Set(v.order).size === v.order.length && v.order.every(n => Number.isInteger(n) && n >= 0 && n < 5);
}
export function isWritingEvent(v: unknown): v is WritingEvent {
  if (!object(v) || v.edition !== 1 || typeof v.activityId !== "string") return false;
  const a = activityById(v.activityId);
  return !!a && uuid(v.id) && ["answer", "skip"].includes(String(v.kind)) && isAnswer(v.answer) && typeof v.assisted === "boolean" && typeof v.review === "boolean" && date(v.occurredAt) && Number.isInteger(v.activeMs) && Number(v.activeMs) >= 0 && Number(v.activeMs) <= 7200000 && (v.kind === "skip" || (a.kind === "choice" ? v.answer.choice !== null && v.answer.evidence !== null : v.answer.order.length === a.options.length && v.answer.order.every(n => n < a.options.length)));
}
export function isQuiz(v: unknown): v is WritingQuiz {
  return object(v) && uuid(v.id) && v.edition === 1 && ["diagnostic", "practice", "review"].includes(String(v.mode)) && Array.isArray(v.items) && v.items.length <= 10 && new Set(v.items).size === v.items.length && v.items.every(id => typeof id === "string" && activityById(id)) && Number.isInteger(v.position) && Number(v.position) >= 0 && Number(v.position) <= v.items.length && isAnswer(v.draft) && typeof v.assisted === "boolean" && Number.isInteger(v.pendingActiveMs) && Number(v.pendingActiveMs) >= 0 && Number(v.pendingActiveMs) <= 7200000 && Array.isArray(v.answers) && v.answers.length <= v.items.length && v.answers.every(a => object(a) && uuid(a.eventId) && (v.items as string[]).includes(String(a.activityId)) && typeof a.correct === "boolean" && typeof a.skipped === "boolean" && [0, 10].includes(Number(a.xp)));
}
export function isWorkspace(v: unknown): v is WritingWorkspace {
  return object(v) && [...CODES, "mixed"].includes(String(v.competency)) && (v.quiz === null || isQuiz(v.quiz)) && (v.activeDocument === null || uuid(v.activeDocument)) && typeof v.diagnosticDone === "boolean";
}
export function isDocument(v: unknown): v is WritingDocument {
  if (!object(v) || !uuid(v.id) || v.edition !== 1 || !["essay", "workshop", "transfer"].includes(String(v.kind)) || !text(v.contentId, 100) || !text(v.title, 160) || !text(v.text, 20000) || !text(v.plan, 6000) || !date(v.updatedAt) || !(v.parentId === null || uuid(v.parentId)) || !(v.draftBasedOn === null || uuid(v.draftBasedOn))) return false;
  const known = v.kind === "essay" ? WRITING_CATALOG.topics.some(t => t.id === v.contentId) : WRITING_CATALOG.workshops.some(w => w.id === v.contentId) || v.kind === "transfer" && WRITING_CATALOG.readings.some(r => r.id === v.contentId);
  if (!known || !Array.isArray(v.versions) || !Array.isArray(v.assessments) || new Set(v.versions.map(x => x?.id)).size !== v.versions.length || new Set(v.assessments.map(x => x?.id)).size !== v.assessments.length) return false;
  const ids = new Set<string>();
  for (const version of v.versions) {
    if (!object(version) || !uuid(version.id) || !text(version.text, 20000) || !(version.text as string).trim() || !date(version.createdAt) || !(version.basedOn === null || ids.has(String(version.basedOn))) || !text(version.reflection, 3000) || !object(version.review) || version.reviewedAt !== undefined && version.reviewedAt !== null && !date(version.reviewedAt)) return false;
    for (const c of CODES) {
      const r = version.review[c];
      if (!object(r) || !["unknown", "improve", "partial", "met"].includes(String(r.status)) || !text(r.excerpt, 2000) || !text(r.problem, 2000) || !text(r.action, 2000)) return false;
    }
    ids.add(version.id);
  }
  if (v.draftBasedOn !== null && !ids.has(v.draftBasedOn as string)) return false;
  return v.assessments.every(a => {
    if (!object(a) || !object(a.scores)) return false;
    const scores = a.scores;
    return uuid(a.id) && ids.has(String(a.versionId)) && typeof a.source === "string" && a.source.trim().length > 0 && a.source.length <= 160 && date(a.receivedAt) && date(a.recordedAt) && Object.keys(scores).every(c => CODES.includes(c as typeof CODES[number]) && Number.isInteger(scores[c]) && Number(scores[c]) >= 0 && Number(scores[c]) <= 200) && (a.total === null || Number.isInteger(a.total) && Number(a.total) >= 0 && Number(a.total) <= 1000) && (Object.keys(scores).length > 0 || a.total !== null) && (Object.keys(scores).length !== 5 || a.total === null || a.total === CODES.reduce((n, c) => n + Number(scores[c]), 0)) && text(a.comment, 6000);
  });
}
export function preservesVersions(previous: WritingDocument, next: WritingDocument): boolean {
  return previous.kind === next.kind && previous.contentId === next.contentId && previous.edition === next.edition && previous.parentId === next.parentId && previous.versions.every((v, n) => { const other = next.versions[n]; return other && v.id === other.id && v.text === other.text && v.createdAt === other.createdAt && v.basedOn === other.basedOn; });
}
export function readLocal(value: string | null): WritingLocal {
  try { const v = JSON.parse(value ?? "null"); return object(v) && v.schema === 1 && Array.isArray(v.events) && v.events.every(isWritingEvent) && isWorkspace(v.workspace) && typeof v.workspacePending === "boolean" && Number.isInteger(v.serverRevision) && Number(v.serverRevision) >= 0 ? v as WritingLocal : emptyLocal(); } catch { return emptyLocal(); }
}
