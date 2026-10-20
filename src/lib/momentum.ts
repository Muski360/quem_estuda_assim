import { DIFFICULTIES, getQuestionSeconds } from "./math/generator.ts";
import type { GameSettings } from "./math/generator.ts";

export type Momentum = {
  streak: number;
  best: number;
  xp: number;
  lastGain: number;
};

export const INITIAL_MOMENTUM: Momentum = {
  streak: 0,
  best: 0,
  xp: 0,
  lastGain: 0,
};

export const MAX_ROUND_XP = 20;

export function getXpMultiplier(seconds: number, reference: number): number {
  return Math.round(Math.max(0.25, Math.min(3, reference / seconds)) * 100) / 100;
}

export function roundXp(seconds: number, settings: GameSettings): number {
  const duration = getQuestionSeconds(settings);
  const multiplier = getXpMultiplier(duration, DIFFICULTIES[settings.difficulty].seconds);
  if (seconds >= duration) return 0;
  return Math.round(xpForTime(seconds) * multiplier);
}

export function xpForTime(seconds: number): number {
  if (!Number.isFinite(seconds)) return 0;
  return Math.max(0, MAX_ROUND_XP - Math.floor(Math.max(0, seconds)));
}

export function advanceMomentum(previous: Momentum, correct: boolean, earnedXp: number): Momentum {
  const streak = correct ? previous.streak + 1 : 0;
  const lastGain = correct ? earnedXp : 0;
  return {
    streak,
    best: Math.max(previous.best, streak),
    xp: previous.xp + lastGain,
    lastGain,
  };
}
