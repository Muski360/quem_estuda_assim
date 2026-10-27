import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { EXTERNAL_ORIGIN, identifyPost, matchQuestion, questionText, robotAllows } from "./external-links.mjs";

const post = { id: 1, link: EXTERNAL_ORIGIN + "/questao-01-caderno-azul-do-enem-2023/", title: { rendered: "Questão 01, caderno azul do ENEM 2023 – INGLÊS" } };
test("links: aplicação, caderno, idioma e domínio precisam ser inequívocos", () => {
  assert.equal(identifyPost(post).id, "enem-2023-regular-1-ingles");
  assert.equal(identifyPost({ ...post, title: { rendered: "Questão 100, caderno azul do ENEM 2022 D2" } }).id, "enem-2022-regular-100");
  assert.equal(identifyPost({ ...post, title: { rendered: post.title.rendered.replace("INGLÊS", "ESPANHOL") } }).id, "enem-2023-regular-1-espanhol");
  for (const text of ["Questão 06, caderno azul do ENEM 2021 PPL", "Questão 06, caderno azul do ENEM 2021 – reaplicação", "Questão 06, caderno amarelo do ENEM 2021", "Questão 06, caderno azul do ENEM 2021 – digital", "Questão 06, caderno azul do ENEM 2024"]) assert.equal(identifyPost({ ...post, title: { rendered: text } }), null);
  for (const link of ["javascript:alert(1)", "https://outro.test/questao-01/", EXTERNAL_ORIGIN + "/questao-06-enem-2021-ppl/", "//outro.test/", "inválida"]) assert.equal(identifyPost({ ...post, link }), null);
});
test("links: resolução não pode servir como prova de correspondência", () => {
  const q = { prompt: "Qual conclusão é sustentada pelas informações apresentadas?", context: "", alternatives: ["A observação delimita a conclusão.", "O resultado vale para todos os grupos.", "A análise não precisa de evidências.", "Os dados são sempre definitivos.", "O contexto não altera a leitura."].map(text => ({ text })) };
  const body = `<p>${q.prompt}</p>${q.alternatives.map(a => `<p>${a.text}</p>`).join("")}<h2>Resolução em texto</h2><p>COMENTÁRIO QUE NÃO DEVE SER RETIDO</p>`;
  assert.equal(matchQuestion(q, body).approved, true);
  assert.doesNotMatch(questionText(body).text, /COMENTÁRIO/);
  assert.equal(matchQuestion(q, `<p>Outra questão</p><h2>Resolução em texto</h2>${body}`).approved, false);
  assert.equal(matchQuestion(q, body.replace("<h2>Resolução em texto</h2>", "")).approved, false);
  assert.equal(matchQuestion({ ...q, prompt: "Um enunciado diferente exige outra leitura desta observação." }, body).approved, false);
  assert.equal(questionText("<p>A &amp; B: ação</p><strong>Gabarito:</strong><p>A</p>").text.trim(), "A & B: ação");
});
test("links: respeitar as restrições genéricas de robots", () => {
  const robots = "User-agent: *\nDisallow: /*?f_\nDisallow: /*&f_\nDisallow: /privado\n";
  assert.equal(robotAllows(robots, EXTERNAL_ORIGIN + "/wp-json/wp/v2/posts?per_page=100"), true);
  for (const path of ["/blog/?f_x=1", "/blog/?page=2&f_x=1", "/privado/item"]) assert.equal(robotAllows(robots, EXTERNAL_ORIGIN + path), false);
  assert.equal(robotAllows("User-agent: *\nDisallow: /", EXTERNAL_ORIGIN + "/wp-json/"), false);
});
test("links publicados possuem evidência de correspondência e não contêm resoluções", async () => {
  const paths = JSON.parse(await readFile("public/data/scroll-resolutions.json", "utf8"));
  const report = JSON.parse(await readFile("docs/learning/external-resolutions.json", "utf8"));
  assert.equal(Object.keys(paths).length, report.linked); assert.ok(report.linked > 0);
  for (const [id, path] of Object.entries(paths)) {
    assert.match(id, /^enem-20\d{2}-regular-\d{1,3}(?:-(?:ingles|espanhol))?$/);
    assert.match(path, /^\/questao-[a-z0-9-]+\/$/); assert.doesNotMatch(path, /ppl|digital|reaplica/);
    const proof = report.verified.find(p => p.id === id && new URL(p.url).pathname === path);
    assert.ok(proof?.approved && proof.boundary); assert.match(proof.checksum, /^[a-f0-9]{64}$/); assert.match(proof.fingerprint, /^[a-f0-9]{64}$/);
    assert.ok(proof.promptMatches && (proof.alternatives >= 3 || proof.contextMatches >= 2) || proof.contextMatches >= 3 && proof.alternatives >= 2);
    assert.equal(proof.content, undefined); assert.equal(proof.text, undefined);
  }
});
