import type { Competency } from "../writing/types.ts";

export type SprintEssay = {
  id: string; author: string; year: number; theme: "care" | "communities";
  source: "inep2023" | "inep2024"; item: number; pdfPage: number; page: number;
  score: 1000; paragraphs: string[];
};
export type EssayAnalysis = {
  essayId: string; question: string; thesis: string; project: string;
  sections: { title: string; analysis: string; question: string }[];
  competencies: Record<Competency, string>; transfer: string;
  vocabulary: { term: string; meaning: string; effect: string; alternatives: string; avoid: string; task: string; example: string }[];
};
export type SprintQuestion = {
  id: string; day: number; competency: Competency; skill: string;
  kind: "choice" | "order" | "match";
  prompt: string; passage: string; options: string[]; answer: number[];
  feedback: string[]; explanation: string; repair: string;
  pairs?: string[];
};
export type SprintProduction = {
  id: string; title: string; task: string; minimum: number;
  criteria: string[]; model: string; commentary: string;
};
export type SprintDay = {
  id: number; date: string; title: string; focus: string; minutes: number;
  essays: [string, string]; comparison: string; comparisonTask: string;
  retrieval: string; productions: SprintProduction[];
};
export type SprintAttempt = { selection: number[]; reasoning: string; at: string };
export type SprintResponse = { selection: number[]; reasoning: string; attempts: SprintAttempt[]; correction: string };
export type SprintReading = { prediction: string; opened: number[]; reflection: string };
export type SprintWord = { recalls: Record<string, string>; application: string; reviewed: number[] };
export type SprintState = {
  edition: 1; day: number;
  readings: Record<string, SprintReading>;
  responses: Record<string, SprintResponse>;
  productions: Record<string, { text: string; reflection: string; checks: boolean[]; revealed: boolean }>;
  vocabulary: Record<string, SprintWord>;
  comparisons: Record<string, { prediction: string; reflection: string }>;
  retrievals: Record<string, string>;
};
