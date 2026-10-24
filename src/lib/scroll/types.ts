import type { Area, Question } from "../questions.ts";

export type ScrollMode = "feed" | "session" | "errors" | "favorites" | "due";
export type ScrollSettings = {
  area: Area | "all"; year: number | null; language: "ingles" | "espanhol";
  mode: ScrollMode; target: 5 | 10 | 20; timed: boolean; minutes: number; goal: 5 | 10 | 20;
  explanationOnly?: boolean; subject?: string | null; topic?: string | null;
};
export const DEFAULT_SCROLL_SETTINGS: ScrollSettings = {
  area: "all", year: null, language: "ingles", mode: "feed", target: 10, timed: false, minutes: 3, goal: 5,
};
export type ScrollItem = {
  id: string; position: number; question: Question; favorite: boolean;
  status: "pending" | "answered" | "skipped" | "expired" | "superseded";
  selected: number | null; correct: boolean | null; correctIndex: number | null; xp: number;
  deadline: string | null; pausedAt: string | null; activeMs: number;
};
export type ScrollSession = {
  id: string; mode: ScrollMode; target: number | null; timed: boolean; duration: number;
  completed: number; answered: number; correct: number; xp: number; streak: number;
  activeMs: number; finished: boolean; exhausted: boolean; items: ScrollItem[];
};
export type ScrollStats = {
  answered: number; correct: number; reviews: number; reviewCorrect: number; activeMs: number;
  xp: number; totalXp: number; today: number; streak: number; settings: ScrollSettings; years: number[];
  daily: { day: string; answered: number; correct: number; activeMs: number }[];
  areas: { area: Area; answered: number; correct: number }[];
  learning: LearningOverview;
};
export type Mission = { id: "answers" | "reviews" | "calculator"; target: number; progress: number; xp: number; awarded: boolean };
export type TopicProgress = { subject: string; topic: string; subjectLabel: string; topicLabel: string; answered: number; correct: number; recentCorrect: number; state: "training" | "consolidating" | "mastered" };
export type LearningOverview = {
  day: string; due: number; missions: Mission[]; achievements: { id: string; earnedAt: string }[];
  topics: TopicProgress[]; bonusXp: number; calculatorRounds: number;
  resume: { id: string; mode: ScrollMode; answered: number } | null;
  coverage: { total: number; explained: number };
  taxonomy: { area: Area; subject: string; topic: string; subjectLabel: string; topicLabel: string }[];
};
export type HistoryItem = {
  question: Question; favorite: boolean; firstChoice: number | null; firstCorrect: boolean | null;
  lastChoice: number | null; lastCorrect: boolean | null; correctIndex: number | null;
  answeredAt: string | null; attempts: number;
};
export type HistoryPage = { items: HistoryItem[]; next: number | null };
