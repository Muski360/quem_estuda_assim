export const AREAS = {
  mathematics: { label: "Matemática", short: "MAT", color: "terracotta" },
  nature: { label: "Ciências da Natureza", short: "NAT", color: "sage" },
  humanities: { label: "Ciências Humanas", short: "HUM", color: "ochre" },
  languages: { label: "Linguagens", short: "LIN", color: "lavender" },
} as const;
export type Area = keyof typeof AREAS;
export type Alternative = { letter: string; text: string; image: string | null };
export type Classification = { subject: string; topic: string; subjectLabel: string; topicLabel: string };
export type Explanation = { version: number; summary: string; steps: string[]; alternatives: Record<string, string> };
export type Question = {
  id: string; year: number; number: number; area: Area;
  language: "ingles" | "espanhol" | null;
  context: string; prompt: string; alternatives: Alternative[];
  source: { application: string; booklet: string; page: string; answerKey: string; commit: string };
  explanation?: string | null;
  hasExplanation?: boolean;
  classification?: Classification | null;
};
