import type { Question } from "../questions.ts";

export function externalResolution(question: Question, paths: Record<string, string>): string | null {
  const expected = `enem-${question.year}-regular-${question.number}${question.language ? `-${question.language}` : ""}`;
  if (question.id !== expected || !/^regular$/i.test(question.source.application) || !/\bazul\b/i.test(question.source.booklet)) return null;
  const path = paths[question.id];
  if (typeof path !== "string" || !/^\/questao-[a-z0-9-]+\/$/.test(path) || /ppl|digital|reaplica|libras|ledor/.test(path)) return null;
  return "https://plataformaassaad.com.br" + path;
}
