import { AREAS } from "../questions.ts";
import type { ScrollSettings } from "./types.ts";

export const isUuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function isScrollSettings(value: unknown): value is ScrollSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const s = value as Record<string, unknown>;
  return (s.area === "all" || typeof s.area === "string" && Object.hasOwn(AREAS, s.area)) &&
    (s.year === null || Number.isInteger(s.year) && Number(s.year) >= 2009 && Number(s.year) <= 2023) &&
    (s.language === "ingles" || s.language === "espanhol") &&
    typeof s.mode === "string" && ["feed", "session", "errors", "favorites", "due"].includes(s.mode) &&
    typeof s.target === "number" && [5, 10, 20].includes(s.target) &&
    typeof s.goal === "number" && [5, 10, 20].includes(s.goal) &&
    typeof s.timed === "boolean" && Number.isInteger(s.minutes) && Number(s.minutes) >= 1 && Number(s.minutes) <= 30 &&
    (s.explanationOnly === undefined || typeof s.explanationOnly === "boolean") &&
    [s.subject, s.topic].every(value => value == null || typeof value === "string" && /^[a-z][a-z0-9-]{0,59}$/.test(value));
}
export function studyDay(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
