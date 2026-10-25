import data from "../../data/reading.json" with { type: "json" };
import { READING_EXPANSION } from "../../data/reading-expansion.ts";
import type { ReadingCatalog, ReadingConcept } from "./types.ts";

export const READING_CATALOG: ReadingCatalog = { ...data, concepts: [...data.concepts, ...READING_EXPANSION] } as ReadingCatalog;
// Published versions stay available for queued attempts and historical explanations.
export const READING_VERSIONS: Record<number, ReadingCatalog> = { 1: READING_CATALOG };
export const TRACKS = { functions: "Funções da linguagem", literature: "Literatura", "avant-garde": "Vanguardas", mixed: "Misturar trilhas" } as const;
export const conceptById = (id: string): ReadingConcept | undefined => READING_CATALOG.concepts.find(c => c.id === id);
export const itemId = (id: string, kind: "p" | "a", index: number) => `le-${id}-${kind}${index + 1}`;
export function applicationById(id: string, version = READING_CATALOG.version) {
  for (const concept of READING_VERSIONS[version]?.concepts ?? []) {
    const index = concept.applications.findIndex((_, n) => itemId(concept.id, "a", n) === id);
    if (index >= 0) return { concept, application: concept.applications[index], index };
  }
  return null;
}
