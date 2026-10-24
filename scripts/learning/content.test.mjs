import { test } from "node:test";
import assert from "node:assert/strict";
import { authored, validateExplanation, digest } from "./catalog.mjs";

const row = authored[0];
const question = { id: row[0], area: "mathematics", correct_index: row[2].charCodeAt(0) - 65, checksum: "fixed" };
test("editorial validation rejects mismatched answers, areas, incomplete alternatives and unsafe content", () => {
  assert.equal(validateExplanation(row, question).checksum, "fixed");
  assert.throws(() => validateExplanation(row, { ...question, correct_index: 4 }));
  assert.throws(() => validateExplanation(row, { ...question, area: "nature" }));
  const broken = structuredClone(row); broken[5].pop();
  assert.throws(() => validateExplanation(broken, question));
  const html = structuredClone(row); html[3] = "<script>Texto não aprovado para publicação</script>";
  assert.throws(() => validateExplanation(html, question));
  const control = structuredClone(row); control[4][0] += "\tbroken";
  assert.throws(() => validateExplanation(control, question));
});
test("digest is stable across JSONB key ordering and detects changed content", () => {
  assert.equal(digest({ b: [2, 3], a: { y: 1, x: 0 } }), digest({ a: { x: 0, y: 1 }, b: [2, 3] }));
  assert.notEqual(digest({ steps: ["one", "two"] }), digest({ steps: ["two", "one"] }));
});
test("pilot numerical solutions have independently checkable results", () => {
  assert.equal(3800 / (1 - .3 + .2 * .3), 5000);
  assert.equal(Math.round((1 - .8 ** 2) * 100), 36);
  assert.equal(6 * 5 * 3, 90);
  assert.equal(Math.cbrt(28080 * 1000 / (2 * 3.51 * 4)), 100);
  assert.equal(Math.ceil(50 / .95), 53);
  const boxes = [86 ** 3, 85 * 82 * 90, 82 * 95 * 82, 80 * 95 * 85];
  assert.equal(Math.min(...boxes), boxes[1]);
  assert.equal(Math.round(1202 * (4.45 - .11) * 100), 521668);
  let twos = 0; for (let n = 100; n <= 399; n++) twos += [...String(n)].filter(x => x === "2").length;
  assert.equal(twos, 160);
});
