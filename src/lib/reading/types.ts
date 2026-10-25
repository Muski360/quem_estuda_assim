export type ReadingTrack = "functions" | "figures" | "literature" | "avant-garde";
export type ReadingSource = { title: string; author: string; url: string; rights: string; note?: string };
export type ReadingExample = { text: string; reason: string; source?: string; image?: string; alt?: string };
export type ReadingApplication = ReadingExample & { evidence: string; distractors: { text: string; why: string }[] };
export type ReadingConcept = {
  id: string; label: string; aliases: string[]; track: ReadingTrack; period: string;
  description: string; clues: string[]; contrasts: string[]; confusion: string;
  examples: ReadingExample[]; applications: ReadingApplication[];
};
export type ReadingCatalog = { version: number; sources: Record<string, ReadingSource>; concepts: ReadingConcept[] };
export type ReadingEvent = {
  id: string; kind: "exposure" | "answer" | "skip"; conceptId: string;
  itemId: string; version: number; occurredAt: string; choice?: string; evidence?: number;
  assisted: boolean; review: boolean; activeMs: number;
};
export type ReadingAttempt = ReadingEvent & { correct: boolean; conceptCorrect: boolean; evidenceCorrect: boolean; xp: number; imported?: boolean };
export type ConceptProgress = {
  seen: boolean; applied: string[]; retained: boolean; due: string | null; interval: number;
  exposedAt: string | null; lastCorrect: boolean | null;
};
export type ReadingSnapshot = {
  events: ReadingAttempt[]; concepts: Record<string, ConceptProgress>;
  first: Record<string, { correct: boolean; assisted: boolean; imported: boolean }>;
  xp: number; answered: number; correct: number;
};
export type ReadingSession = {
  id: string; mode: "practice" | "review"; catalogVersion: number; conceptIds: string[]; exampleIndexes: number[][];
  applications: string[]; stage: number; matched: string[]; flipped: [string | null, string | null];
  result: "match" | "miss" | null; combo: number; bestCombo: number; pairs: number;
  answers: { eventId: string; itemId: string; correct: boolean; conceptCorrect: boolean; evidenceCorrect: boolean; xp: number; skipped: boolean; assisted?: boolean }[];
  draft: { choice: string | null; evidence: number | null };
  pendingActiveMs?: number;
  assisted: string[]; startedAt: string; finishedAt: string | null;
};
export type ReadingLocal = { version: 1; events: ReadingEvent[]; session: ReadingSession | null; track: ReadingTrack | "mixed"; tutorial: boolean; sessionPending?: boolean; serverRevision?: number };
