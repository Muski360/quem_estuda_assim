import assert from "node:assert/strict";
import test from "node:test";
import { advanceMomentum, getXpMultiplier, INITIAL_MOMENTUM, roundXp, xpForTime } from "./momentum.ts";
import { DEFAULT_SETTINGS } from "./math/generator.ts";

test("cada segundo completo reduz 1 XP, entre 20 e zero", () => {
  for (const [seconds, expected] of [[-2, 20], [0, 20], [0.999, 20], [1, 19], [1.999, 19], [5, 15], [19.999, 1], [20, 0], [30, 0], [Infinity, 0], [NaN, 0]])
    assert.equal(xpForTime(seconds), expected, `${seconds}s`);
});

test("tempo configurado altera máximo de XP e decai sem saltar entre frações do segundo",()=>{
  assert.equal(getXpMultiplier(30,30),1);
  assert.equal(getXpMultiplier(10,30),3);
  assert.equal(getXpMultiplier(180,30),.25);
  assert.equal(roundXp(0,DEFAULT_SETTINGS),20);
  assert.equal(roundXp(1,DEFAULT_SETTINGS),19);
  assert.equal(roundXp(5,DEFAULT_SETTINGS),15);
  assert.equal(roundXp(20,DEFAULT_SETTINGS),0);
  assert.equal(roundXp(0,{...DEFAULT_SETTINGS,seconds:10}),60);
  assert.equal(roundXp(0,{...DEFAULT_SETTINGS,seconds:60}),10);
  for (const seconds of [5,10,30,60,180]) {
    const settings={...DEFAULT_SETTINGS,seconds};
    let last=roundXp(0,settings);
    for (let elapsed=0;elapsed<=seconds+2;elapsed++) {
      const xp=roundXp(elapsed,settings);
      assert.ok(Number.isInteger(xp) && xp>=0 && xp<=last);
      assert.equal(roundXp(elapsed+.99,settings),xp);
      last=xp;
    }
    assert.equal(roundXp(seconds,settings),0);
  }
  assert.equal(roundXp(Infinity,DEFAULT_SETTINGS),0);
  assert.equal(roundXp(NaN,DEFAULT_SETTINGS),0);
});

test("combos não ultrapassam o XP por tempo; erro não retira o XP conquistado", () => {
  let momentum = INITIAL_MOMENTUM;
  for (let count = 0; count < 4; count++)
    momentum = advanceMomentum(momentum, true, xpForTime(count));
  assert.deepEqual(momentum, { streak: 4, best: 4, xp: 74, lastGain: 17 });
  momentum = advanceMomentum(momentum, false, 20);
  assert.deepEqual(momentum, { streak: 0, best: 4, xp: 74, lastGain: 0 });
  momentum = advanceMomentum(momentum, true, xpForTime(20));
  assert.deepEqual(momentum, { streak: 1, best: 4, xp: 74, lastGain: 0 });
  assert.equal(INITIAL_MOMENTUM.xp, 0);
});
