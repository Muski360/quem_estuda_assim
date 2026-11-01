import { SPRINT_ANALYSES } from "../../data/sprint/analyses.ts";
import { SPRINT_DAYS } from "../../data/sprint/days.ts";
import { SPRINT_ESSAYS } from "../../data/sprint/essays.ts";
import { SPRINT_QUESTIONS } from "../../data/sprint/questions.ts";

export { SPRINT_ANALYSES, SPRINT_DAYS, SPRINT_ESSAYS, SPRINT_QUESTIONS };
export { SPRINT_CONTEXTS, SPRINT_FINAL_TOPIC, SPRINT_ID, SPRINT_RIGHTS, SPRINT_SOURCES } from "../../data/sprint/context.ts";
export const SPRINT_WORDS = SPRINT_ANALYSES.flatMap(a => a.vocabulary.map((word, index) => ({ ...word, id: `${a.essayId}:${index}`, essayId: a.essayId, day: SPRINT_DAYS.find(d => d.essays.includes(a.essayId))!.id })));
export const SPRINT_PRODUCTIONS = SPRINT_DAYS.flatMap(d => d.productions);
export const wordsForDay = (day: number) => SPRINT_WORDS.filter(w => [0, 1, 3].includes(day - w.day));
