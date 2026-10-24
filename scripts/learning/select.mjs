import { readFile, mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const bank = JSON.parse(await readFile("output/enem/approved.json", "utf8"));
const visual = ["enem-2021-regular-162", "enem-2011-regular-58", "enem-2013-regular-13", "enem-2023-regular-1-ingles"];
const selected = [];
for (const area of ["mathematics", "nature", "humanities", "languages"]) {
  const rows = bank.filter(q => q.area === area);
  const chosen = rows.filter(q => visual.includes(q.id));
  const candidates = rows.filter(q => !JSON.stringify([q.context, q.prompt, q.alternatives]).includes("__ENEM_ASSETS__") && q.context.length >= 220 && q.context.length < 1100)
    .sort((a, b) => a.context.length + a.prompt.length - b.context.length - b.prompt.length || a.id.localeCompare(b.id));
  for (let round = 0; chosen.length < 25; round++) {
    for (const year of [...new Set(rows.map(q => q.year))].sort()) {
      const next = candidates.filter(q => q.year === year && !chosen.includes(q))[0];
      if (next && chosen.length < 25) chosen.push(next);
    }
    assert.ok(round < 25, `Insufficient questions: ${area}`);
  }
  const replacements = { "enem-2015-regular-150": "enem-2015-regular-159", "enem-2012-regular-157": "enem-2012-regular-136", "enem-2014-regular-13": "enem-2014-regular-11", "enem-2013-regular-6": "enem-2013-regular-10", "enem-2009-regular-46": "enem-2009-regular-47", "enem-2021-regular-98": "enem-2021-regular-129" };
  selected.push(...chosen.map(q => bank.find(next => next.id === (replacements[q.id] ?? q.id))));
}
await mkdir("output/learning", { recursive: true });
// The author solves these files without seeing the official letter.
await writeFile("output/learning/blind.json", JSON.stringify(selected.map(q => Object.fromEntries(Object.entries(q).filter(([key]) => key !== "correct_index"))), null, 2));
await writeFile("output/learning/selection.json", JSON.stringify(selected.map(q => q.id), null, 2));
console.log(JSON.stringify({ total: selected.length, areas: Object.fromEntries(["mathematics", "nature", "humanities", "languages"].map(a => [a, selected.filter(q => q.area === a).length])), years: [...new Set(selected.map(q => q.year))], figures: visual.length }));
