import data from "@/data/questions.json";

export const AREAS = {
  mathematics: { label: "Matemática", short: "MAT", color: "terracotta" },
  nature: { label: "Ciências da Natureza", short: "NAT", color: "sage" },
  humanities: { label: "Ciências Humanas", short: "HUM", color: "ochre" },
  languages: { label: "Linguagens", short: "LIN", color: "lavender" },
} as const;
export type Area = keyof typeof AREAS;
export type Question = {
  id: string;
  area: Area;
  topic: string;
  title: string;
  support: string;
  prompt: string;
  alternatives: string[];
  correctIndex: number;
  explanation: string;
};

export const questions: Question[] = data.map((question) => {
  if (
    !Object.hasOwn(AREAS, question.area) ||
    question.alternatives.length !== 5 ||
    !Number.isInteger(question.correctIndex) ||
    question.correctIndex < 0 ||
    question.correctIndex > 4
  ) {
    throw new Error(`Questão inválida: ${question.id}`);
  }
  return { ...question, area: question.area as Area };
});
