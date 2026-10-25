import data from "../../data/reading.json" with { type: "json" };
import { READING_EXPANSION } from "../../data/reading-expansion.ts";
import { READING_FIGURES } from "../../data/reading-figures.ts";
import type { ReadingCatalog, ReadingConcept } from "./types.ts";

const catalogV1: ReadingCatalog = { ...data, concepts: [...data.concepts, ...READING_EXPANSION] } as ReadingCatalog;
export const READING_CATALOG: ReadingCatalog = { ...catalogV1, version: 2, concepts: [...catalogV1.concepts, ...READING_FIGURES] };
// Published versions stay available for queued attempts and historical explanations.
export const READING_VERSIONS: Record<number, ReadingCatalog> = { 1: catalogV1, 2: READING_CATALOG };
export const TRACKS = { functions: "Funções da linguagem", figures: "Figuras de linguagem", literature: "Literatura", "avant-garde": "Vanguardas", mixed: "Misturar trilhas" } as const;
export const conceptById = (id: string, version = READING_CATALOG.version): ReadingConcept | undefined => READING_VERSIONS[version]?.concepts.find(c => c.id === id);
export const itemId = (id: string, kind: "p" | "a", index: number) => `le-${id}-${kind}${index + 1}`;
export function applicationById(id: string, version = READING_CATALOG.version) {
  for (const concept of READING_VERSIONS[version]?.concepts ?? []) {
    const index = concept.applications.findIndex((_, n) => itemId(concept.id, "a", n) === id);
    if (index >= 0) return { concept, application: concept.applications[index], index };
  }
  return null;
}
