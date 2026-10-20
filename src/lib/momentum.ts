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

export function advanceMomentum(previous: Momentum, correct: boolean): Momentum {
  const streak = correct ? previous.streak + 1 : 0;
  const lastGain = correct ? (streak >= 3 ? 15 : 10) : 0;
  return {
    streak,
    best: Math.max(previous.best, streak),
    xp: previous.xp + lastGain,
    lastGain,
  };
}
