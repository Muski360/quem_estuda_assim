import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import assert from "node:assert/strict";
import { EXTERNAL_ORIGIN, identifyPost, matchQuestion, robotAllows } from "./external-links.mjs";

const output = "output/external-resolutions", refresh = process.argv.includes("--refresh");
await mkdir(output, { recursive: true });
const bank = JSON.parse(await readFile("output/enem/approved.json", "utf8"));
const questions = new Map(bank.map(q => [q.id, q]));
let robots = "", previousRequest = 0;
async function request(url) {
  assert.equal(new URL(url).origin, EXTERNAL_ORIGIN);
  assert.ok(!robots || robotAllows(robots, url), "Robots restringe este caminho; indexação interrompida.");
  for (let attempt = 0; attempt < 3; attempt++) {
    await new Promise(resolve => setTimeout(resolve, Math.max(0, 600 - (Date.now() - previousRequest))));
    previousRequest = Date.now();
    let response;
    try { response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: "error" }); }
    catch (error) { if (attempt === 2) throw error; await new Promise(resolve => setTimeout(resolve, (attempt + 1) * 1000)); continue; }
    if (response.ok) return response;
    if (![429, 502, 503, 504].includes(response.status)) throw new Error(`HTTP ${response.status}; nenhum bloqueio será contornado.`);
    const delay = Number(response.headers.get("retry-after") ?? attempt + 1);
    if (delay > 30) throw new Error("Servidor pediu uma pausa maior. Retome a indexação depois.");
    await new Promise(resolve => setTimeout(resolve, (Number.isFinite(delay) ? delay : attempt + 1) * 1000));
  }
  throw new Error("Servidor indisponível. Execute novamente para retomar.");
}
async function load(path, fallback) { try { return JSON.parse(await readFile(path, "utf8")); } catch (e) { if (e.code === "ENOENT") return fallback; throw e; } }
async function save(path, value) { await writeFile(path + ".tmp", JSON.stringify(value) + "\n"); await rename(path + ".tmp", path); }
robots = await (await request(EXTERNAL_ORIGIN + "/robots.txt")).text();
await writeFile(output + "/robots.txt", robots);
const metadata = refresh ? { pages: {}, totalPages: 0 } : await load(output + "/metadata.json", { pages: {}, totalPages: 0 });
for (let page = 1; page <= (metadata.totalPages || 1); page++) {
  if (metadata.pages[page]) continue;
  const response = await request(`${EXTERNAL_ORIGIN}/wp-json/wp/v2/posts?per_page=100&page=${page}&search=quest%C3%A3o&_fields=id,link,title`);
  metadata.totalPages = Number(response.headers.get("x-wp-totalpages")); assert.ok(metadata.totalPages > 0 && metadata.totalPages < 1000);
  metadata.pages[page] = await response.json(); await save(output + "/metadata.json", metadata);
  console.log(`Metadados ${page}/${metadata.totalPages}`);
}
const posts = Object.values(metadata.pages).flat().map(identifyPost).filter(p => p && questions.has(p.id));
const verified = refresh ? {} : await load(output + "/verified.json", {});
const pending = posts.filter(p => verified[p.postId]?.checksum !== questions.get(p.id).checksum);
for (let i = 0; i < pending.length; i += 40) {
  const batch = pending.slice(i, i + 40);
  const response = await request(`${EXTERNAL_ORIGIN}/wp-json/wp/v2/posts?per_page=40&include=${batch.map(p => p.postId).join(",")}&_fields=id,content`);
  const bodies = await response.json();
  assert.ok(Array.isArray(bodies));
  for (const post of batch) {
    const body = bodies.find(b => b.id === post.postId); assert.ok(body?.content?.rendered, `Conteúdo indisponível: ${post.postId}`);
    const q = questions.get(post.id), evidence = matchQuestion(q, body.content.rendered);
    verified[post.postId] = { ...post, checksum: q.checksum, ...evidence, checkedAt: new Date().toISOString() };
  }
  // Only metadata and hashes survive the request; never save explanations or question text from the source.
  await save(output + "/verified.json", verified);
  console.log(`Conferência ${Math.min(i + 40, pending.length)}/${pending.length}`);
}
const current = posts.map(p => verified[p.postId]).sort((a, b) => a.url.localeCompare(b.url));
const accepted = current.filter(p => p.approved), links = Object.fromEntries(accepted.map(p => [p.id, new URL(p.url).pathname]));
assert.ok(Object.keys(links).length > 0, "Nenhuma correspondência aprovada. Catálogo anterior preservado.");
const byYear = Object.fromEntries([...new Set(bank.map(q => q.year))].sort().map(y => [y, Object.keys(links).filter(id => id.startsWith(`enem-${y}-`)).length]));
const report = { checkedAt: new Date().toISOString(), source: EXTERNAL_ORIGIN, discovery: "/wp-json/wp/v2/posts", method: "regular-blue-metadata-and-question-text-v1", bank: bank.length, candidates: posts.length, linked: Object.keys(links).length, byYear, unmatched: current.filter(p => !p.approved), missing: bank.filter(q => !links[q.id]).map(q => q.id), verified: accepted };
await mkdir("public/data", { recursive: true });
await save("public/data/scroll-resolutions.json", links);
await save("docs/learning/external-resolutions.json", report);
console.log(JSON.stringify({ linked: report.linked, bank: bank.length, candidates: posts.length, byYear, unmatched: report.unmatched.length }));
