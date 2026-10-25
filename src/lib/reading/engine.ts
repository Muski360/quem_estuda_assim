import { READING_CATALOG, READING_VERSIONS, applicationById, conceptById, itemId } from "./catalog.ts";
import type { ConceptProgress, ReadingConcept, ReadingEvent, ReadingLocal, ReadingSession, ReadingSnapshot, ReadingTrack } from "./types.ts";
import { studyDay } from "../scroll/validation.ts";

export const emptySnapshot = (): ReadingSnapshot => ({ events: [], concepts: {}, first: {}, xp: 0, answered: 0, correct: 0 });
export const emptyLocal = (): ReadingLocal => ({ version: 1, events: [], session: null, track: "functions", tutorial: true });
export const emptyConcept = (): ConceptProgress => ({ seen: false, applied: [], retained: false, due: null, interval: 0, exposedAt: null, lastCorrect: null });
export function shuffle<T>(items: readonly T[], random = Math.random): T[] {
  const result = [...items];
  for (let n = result.length - 1; n > 0; n--) { const j = Math.floor(random() * (n + 1)); [result[n], result[j]] = [result[j], result[n]]; }
  return result;
}
export function stableShuffle<T>(items: readonly T[], seed: string): T[] {
  let state = [...seed].reduce((n, c) => Math.imul(n ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0;
  return shuffle(items, () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; });
}
export function addDays(day: string, n: number): string {
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + n); return date.toISOString().slice(0, 10);
}
export const nextInterval = (n: number) => n < 3 ? 3 : n < 7 ? 7 : n < 14 ? 14 : 30;
export const dueConcepts = (snapshot: ReadingSnapshot, now = new Date()) => Object.entries(snapshot.concepts).filter(([, c]) => c.due && c.due <= studyDay(now) && (!c.exposedAt || studyDay(new Date(c.exposedAt)) < studyDay(now))).map(([id]) => id);
export const conceptState = (c?: ConceptProgress) => c?.retained ? "Retido" : (c?.applied.length ?? 0) >= 2 ? "Aplicado" : c?.seen ? "Visto" : "Para descobrir";

export function applyEvent(snapshot: ReadingSnapshot, event: ReadingEvent, options: { account?: boolean; imported?: boolean; now?: Date } = {}): ReadingSnapshot {
  if (snapshot.events.some(e => e.id === event.id)) return snapshot;
  const now = options.now ?? new Date(event.occurredAt), today = studyDay(now);
  const result = { ...snapshot, concepts: { ...snapshot.concepts }, first: { ...snapshot.first }, events: [...snapshot.events] };
  const previous = result.concepts[event.conceptId] ?? emptyConcept();
  const progress = { ...previous, applied: [...previous.applied], seen: true };
  const item = applicationById(event.itemId, event.version);
  const conceptCorrect = event.kind === "answer" && event.choice === event.conceptId;
  const evidenceCorrect = event.kind === "answer" && event.evidence === 0;
  const correct = conceptCorrect && evidenceCorrect;
  let xp = 0;
  if (event.kind === "answer" && item) {
    const first = !Object.hasOwn(result.first, event.itemId);
    if (first) {
      result.first[event.itemId] = { correct, assisted: event.assisted, imported: !!options.imported };
      result.answered++; if (correct) result.correct++;
    }
    if (correct && !event.assisted && !progress.applied.includes(event.itemId)) progress.applied.push(event.itemId);
    const due = !!previous.due && previous.due <= today;
    const delayed = !!previous.exposedAt && now.getTime() - Date.parse(previous.exposedAt) >= 7 * 86400000;
    if (!correct) progress.retained = false;
    if (correct && !event.assisted && !options.imported && due && delayed && progress.applied.length >= 2) progress.retained = true;
    if (!previous.due || !correct || due && !event.assisted) {
      progress.interval = !correct || event.assisted ? 1 : previous.due ? nextInterval(previous.interval) : 3;
      progress.due = addDays(today, progress.interval);
    }
    progress.lastCorrect = correct;
    if (first && correct && !event.assisted && !event.review && options.account && !options.imported) xp = 10;
  }
  // Every teaching exposure resets evidence of a seven-day gap; it never advances the review calendar.
  progress.exposedAt = now.toISOString();
  result.concepts[event.conceptId] = progress;
  result.xp += xp;
  result.events.push({ ...event, correct, conceptCorrect, evidenceCorrect, xp, ...(options.imported ? { imported: true } : {}) });
  return result;
}

export function projectLocal(local: Pick<ReadingLocal, "events">): ReadingSnapshot {
  let snapshot = emptySnapshot();
  const events: ReadingSnapshot["events"] = [], seen = new Set<string>();
  for (const event of local.events) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    // Keep history outside the reducer to avoid copying the whole history for every event.
    snapshot = applyEvent({ ...snapshot, events: [] }, event);
    events.push(snapshot.events[0]);
  }
  return { ...snapshot, events };
}
export function createSession(snapshot: ReadingSnapshot, track: ReadingTrack | "mixed", focus?: string, review = false, random = Math.random): ReadingSession {
  const focused = focus ? conceptById(focus) : undefined;
  const available = READING_CATALOG.concepts.filter(c => track === "mixed" || c.track === track);
  const due = review ? dueConcepts(snapshot) : [];
  const pool = shuffle(available, random).sort((a, b) => Number(due.includes(b.id)) - Number(due.includes(a.id)) || Number(!!snapshot.concepts[a.id]?.seen) - Number(!!snapshot.concepts[b.id]?.seen));
  const ids = [...new Set([...(focused ? [focused.id, ...focused.contrasts.filter(id => conceptById(id))] : []), ...due, ...pool.map(c => c.id)])].slice(0, 3);
  if (ids.length !== 3) throw new Error("A trilha precisa de três conceitos aprovados.");
  const ordered = [...ids].sort((a, b) => Number(snapshot.concepts[a]?.lastCorrect !== false) - Number(snapshot.concepts[b]?.lastCorrect !== false));
  const pick = (id: string) => {
    const concept = conceptById(id)!;
    return shuffle(concept.applications.map((_, n) => itemId(id, "a", n)), random).sort((a, b) => Number(!!snapshot.first[a]) - Number(!!snapshot.first[b]));
  };
  const selections = Object.fromEntries(ids.map(id => [id, pick(id)]));
  const firstExamples = ids.map(() => Math.floor(random() * 3));
  return {
    id: crypto.randomUUID(), mode: review ? "review" : "practice", catalogVersion: READING_CATALOG.version,
    conceptIds: ids, exampleIndexes: [firstExamples, firstExamples.map(n => (n + 1 + Math.floor(random() * 2)) % 3)],
    applications: [selections[ordered[0]][0], selections[ordered[1]][0], selections[ordered[2]][0], selections[ordered[0]][1]],
    stage: 0, matched: [], flipped: [null, null], result: null, combo: 0, bestCombo: 0, pairs: 0,
    answers: [], draft: { choice: null, evidence: null }, pendingActiveMs: 0, assisted: [], startedAt: new Date().toISOString(), finishedAt: null,
  };
}
export const stageKind = (session: ReadingSession): "memory" | "application" | "done" => session.finishedAt || session.stage >= (session.mode === "review" ? 4 : 6) ? "done" : session.mode === "practice" && [0, 3].includes(session.stage) ? "memory" : "application";
export const applicationPosition = (session: ReadingSession) => session.mode === "review" ? session.stage : session.stage < 3 ? session.stage - 1 : session.stage - 2;
export const currentApplication = (session: ReadingSession) => applicationById(session.applications[applicationPosition(session)]);
export function applicationChoices(session: ReadingSession, concept: ReadingConcept): string[] {
  return [...new Set([concept.id, ...session.conceptIds, ...concept.contrasts])].filter(id => conceptById(id)?.track === concept.track).slice(0, 3);
}
export function applicationPrompt(concept: ReadingConcept): string {
  if (concept.track === "functions") return concept.id === "poetica" ? "Que função se destaca no trabalho com a forma da mensagem?" : "Que função da linguagem explica o foco desta mensagem?";
  return concept.track === "literature" ? "Que movimento ou tendência literária se relaciona ao procedimento descrito?" : "Que vanguarda ajuda a compreender esse procedimento artístico?";
}
export function flipCard(session: ReadingSession, group: 0 | 1, id: string): ReadingSession {
  if (stageKind(session) !== "memory" || session.result || session.matched.includes(id) || !session.conceptIds.includes(id)) return session;
  const next = structuredClone(session); next.flipped[group] = id;
  if (next.flipped[0] && next.flipped[1]) {
    next.result = next.flipped[0] === next.flipped[1] ? "match" : "miss";
    if (next.result === "match") { next.matched.push(id); next.pairs++; next.combo++; next.bestCombo = Math.max(next.bestCombo, next.combo); }
    else next.combo = 0;
  }
  return next;
}
export function nextStage(session: ReadingSession): ReadingSession {
  const next = structuredClone(session);
  next.stage++; next.matched = []; next.flipped = [null, null]; next.result = null; next.draft = { choice: null, evidence: null }; next.pendingActiveMs = 0;
  if (stageKind(next) === "done") next.finishedAt = new Date().toISOString();
  return next;
}

const uuid = (v: unknown) => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function isReadingEvent(input: unknown): input is ReadingEvent {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const e = input as ReadingEvent;
  const c = READING_VERSIONS[e.version]?.concepts.find(c => c.id === e.conceptId);
  if (!uuid(e.id) || !c || !Number.isInteger(e.version) || !["answer", "skip", "exposure"].includes(e.kind) || typeof e.occurredAt !== "string" || !Number.isFinite(Date.parse(e.occurredAt)) || typeof e.assisted !== "boolean" || typeof e.review !== "boolean" || !Number.isInteger(e.activeMs) || e.activeMs < 0 || e.activeMs > 7200000) return false;
  if (e.kind === "exposure") return e.itemId === `guide:${c.id}` || c.examples.some((_, n) => itemId(c.id, "p", n) === e.itemId);
  if (applicationById(e.itemId, e.version)?.concept.id !== c.id) return false;
  return e.kind === "skip" || !!conceptById(String(e.choice)) && Number.isInteger(e.evidence) && Number(e.evidence) >= 0 && Number(e.evidence) < 3;
}
export function isReadingSession(input: unknown): input is ReadingSession {
  if (!input || typeof input !== "object" || Array.isArray(input)) return false;
  const s = input as ReadingSession;
  return uuid(s.id) && ["practice", "review"].includes(s.mode) && s.catalogVersion === READING_CATALOG.version &&
    Array.isArray(s.conceptIds) && s.conceptIds.length === 3 && new Set(s.conceptIds).size === 3 && s.conceptIds.every(id => !!conceptById(id)) &&
    Array.isArray(s.applications) && s.applications.length === 4 && new Set(s.applications).size === 4 && s.applications.every(id => s.conceptIds.includes(applicationById(id)?.concept.id ?? "")) &&
    Array.isArray(s.exampleIndexes) && s.exampleIndexes.length === 2 && s.exampleIndexes.every(row => Array.isArray(row) && row.length === 3 && row.every(n => Number.isInteger(n) && n >= 0 && n < 3)) &&
    Number.isInteger(s.stage) && s.stage >= 0 && s.stage <= 6 && Array.isArray(s.matched) && s.matched.length <= 3 && s.matched.every(id => s.conceptIds.includes(id)) &&
    Array.isArray(s.flipped) && s.flipped.length === 2 && s.flipped.every(id => id === null || s.conceptIds.includes(id)) && [null, "match", "miss"].includes(s.result) &&
    [s.combo, s.bestCombo, s.pairs].every(n => Number.isInteger(n) && n >= 0 && n <= 1000) &&
    Array.isArray(s.assisted) && s.assisted.length <= 30 && s.assisted.every(id => !!conceptById(id)) &&
    Array.isArray(s.answers) && s.answers.length <= 4 && s.answers.every(a => a && uuid(a.eventId) && s.applications.includes(a.itemId) && [a.correct, a.conceptCorrect, a.evidenceCorrect, a.skipped].every(b => typeof b === "boolean") && [0, 10].includes(a.xp)) &&
    !!s.draft && (s.draft.choice === null || !!conceptById(s.draft.choice)) && (s.draft.evidence === null || Number.isInteger(s.draft.evidence) && s.draft.evidence >= 0 && s.draft.evidence < 3) &&
    (s.pendingActiveMs === undefined || Number.isInteger(s.pendingActiveMs) && s.pendingActiveMs >= 0 && s.pendingActiveMs <= 7200000) &&
    typeof s.startedAt === "string" && Number.isFinite(Date.parse(s.startedAt)) && (s.finishedAt === null || typeof s.finishedAt === "string" && Number.isFinite(Date.parse(s.finishedAt)));
}
export function readLocal(text: string | null): ReadingLocal {
  try {
    const value = JSON.parse(text ?? "null") as ReadingLocal | null;
    if (value?.version !== 1 || !Array.isArray(value.events) || !value.events.every(isReadingEvent) || !["functions", "literature", "avant-garde", "mixed"].includes(value.track) || typeof value.tutorial !== "boolean") return emptyLocal();
    return { ...value, session: isReadingSession(value.session) ? value.session : null };
  } catch { return emptyLocal(); }
}
