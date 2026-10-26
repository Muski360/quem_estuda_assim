export type StudyActivity = { id: string; module: "scroll" | "calculator"; xp: number; mode?: "solo" | "multiplayer"; correct?: boolean; occurredAt?: string };
export type StudyStats = { scroll_questions: number; calculator_rounds: number; reading_answers?: number; writing_answers?: number; total_xp: number };
export const EMPTY_STATS: StudyStats = { scroll_questions: 0, calculator_rounds: 0, total_xp: 0 };

export function isStudyActivity(value: unknown): value is StudyActivity {
  if (!value || typeof value !== "object") return false;
  const activity = value as Record<string, unknown>;
  return typeof activity.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(activity.id) &&
    (activity.module === "scroll" || activity.module === "calculator") &&
    typeof activity.xp === "number" && Number.isInteger(activity.xp) && activity.xp >= 0 && activity.xp <= (activity.module === "scroll" ? 45 : 60) &&
    (activity.mode === undefined || (activity.mode === "solo" || activity.mode === "multiplayer") && typeof activity.correct === "boolean" && typeof activity.occurredAt === "string" && Number.isFinite(Date.parse(activity.occurredAt)));
}

export function parsePendingActivities(value: string | null): StudyActivity[] {
  try {
    const parsed: unknown = JSON.parse(value ?? "[]");
    const unique = new Map<string, StudyActivity>();
    for (const activity of Array.isArray(parsed) ? parsed : [parsed]) if (isStudyActivity(activity)) unique.set(activity.id, activity);
    return [...unique.values()];
  } catch { return []; }
}

export function newerStats(current: StudyStats | null, incoming: StudyStats): StudyStats {
  return current && (current.total_xp > incoming.total_xp || current.scroll_questions + current.calculator_rounds + (current.reading_answers ?? 0) + (current.writing_answers ?? 0) > incoming.scroll_questions + incoming.calculator_rounds + (incoming.reading_answers ?? 0) + (incoming.writing_answers ?? 0)) ? current : incoming;
}
