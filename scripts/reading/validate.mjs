import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { READING_CATALOG, READING_VERSIONS } from "../../src/lib/reading/catalog.ts";

const digest = value => createHash("sha256").update(value).digest("hex");
const manifestPath = "docs/reading/release.json";
const assets = JSON.parse(await readFile("docs/reading/assets.json", "utf8"));
const quarantine = JSON.parse(await readFile("docs/reading/quarantine.json", "utf8"));
for (const asset of assets) {
  assert.match(asset.path, /^\/reading\/[a-z-]+\.jpg$/);
  const bytes = await readFile(`public${asset.path}`);
  assert.equal(digest(bytes), asset.sha256, `Imagem mudou: ${asset.path}`);
  assert.equal(bytes.length, asset.bytes);
  assert.match(asset.rights, /Public domain/);
}
for (const catalog of Object.values(READING_VERSIONS)) for (const c of catalog.concepts) for (const item of [...c.examples, ...c.applications]) {
  assert.ok(!quarantine.activities.some(q => q.conceptId === c.id), `Conceito em quarentena: ${c.id}`);
  assert.ok(catalog.sources[item.source ?? "autoral"], `Fonte ausente: ${c.id}`);
  if (item.image) { assert.ok(assets.some(a => a.path === item.image), `Imagem não conferida: ${item.image}`); assert.ok(item.alt?.length > 30); }
}
const current = { version: READING_CATALOG.version, sha256: digest(JSON.stringify(READING_CATALOG)), concepts: READING_CATALOG.concepts.length, activities: READING_CATALOG.concepts.reduce((n, c) => n + c.examples.length + c.applications.length, 0), editorial: "AI-assisted platform review; no human specialist review claimed", reviewed: "2026-10-25" };
const manifest = JSON.parse(await readFile(manifestPath, "utf8").catch(error => { if (error.code === "ENOENT") return "{}"; throw error; }));
if (process.argv.includes("--prepare") && !manifest[current.version]) {
  manifest[current.version] = current;
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}
for (const [version, catalog] of Object.entries(READING_VERSIONS)) {
  assert.ok(manifest[version], "Prepare o manifesto com --prepare após conferir o conteúdo.");
  assert.equal(manifest[version].sha256, digest(JSON.stringify(catalog)), `A edição ${version} é imutável. Preserve-a no catálogo de versões e crie uma nova edição.`);
}
console.log(`PASS edição ${current.version}: ${current.concepts} conceitos, ${current.activities} atividades, ${assets.length} imagens próprias; fontes e hashes conferidos.`);
