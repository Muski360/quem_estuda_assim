import assert from "node:assert/strict";
import test from "node:test";
import { advanceMomentum, INITIAL_MOMENTUM } from "./momentum.ts";

test("combo começa no terceiro acerto e um erro preserva XP e melhor sequência", () => {
  let momentum = INITIAL_MOMENTUM;
  for (let count = 0; count < 4; count++)
    momentum = advanceMomentum(momentum, true);
  assert.deepEqual(momentum, { streak: 4, best: 4, xp: 50, lastGain: 15 });
  momentum = advanceMomentum(momentum, false);
  assert.deepEqual(momentum, { streak: 0, best: 4, xp: 50, lastGain: 0 });
  momentum = advanceMomentum(momentum, true);
  assert.deepEqual(momentum, { streak: 1, best: 4, xp: 60, lastGain: 10 });
  assert.equal(INITIAL_MOMENTUM.xp, 0);
});
