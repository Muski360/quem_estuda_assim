import { parseFragment } from "parse5";
import { createHash } from "node:crypto";

export const EXTERNAL_ORIGIN = "https://plataformaassaad.com.br";
export const normalize = value => String(value).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const boundary = /^(?:resolucao|materiasnecessarias|gabarito|explicacaoresumida|passo1|encontroualgumerro)/;
export function questionText(html) {
  const parts = []; let stopped = false;
  function walk(node) {
    if (stopped || ["script", "style", "iframe", "noscript"].includes(node.tagName)) return;
    if (node.nodeName === "#text") { if (boundary.test(normalize(node.value))) { stopped = true; return; } parts.push(node.value); }
    for (const child of node.childNodes ?? []) walk(child);
  }
  walk(parseFragment(html));
  return { text: parts.join(" "), stopped };
}
export function identifyPost(post) {
  if (!post || typeof post.link !== "string") return null;
  const title = questionText(post.title?.rendered ?? "").text;
  const clean = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const match = clean.match(/^questao\s+(\d{1,3})\b.*?\bcaderno\s+azul\b.*?\benem\s+(20\d{2})\b(.*)$/);
  if (!match || !Number.isInteger(post.id)) return null;
  let url; try { url = new URL(post.link); } catch { return null; }
  if (url.origin !== EXTERNAL_ORIGIN || url.search || url.hash || !/^\/questao-[a-z0-9-]+\/$/.test(url.pathname)) return null;
  if (/ppl|digital|reaplica|segunda|libras|ledor/.test(clean + " " + url.pathname)) return null;
  const suffix = match[3].replace(/[^a-z0-9]+/g, "");
  if (!["", "dia1", "dia2", "d1", "d2", "1dia", "2dia", "1odia", "2odia", "ingles", "espanhol", "regular"].includes(suffix)) return null;
  const year = Number(match[2]), number = Number(match[1]), language = ["ingles", "espanhol"].includes(suffix) ? suffix : null;
  if (year < 2009 || year > 2023 || number < 1 || number > 180) return null;
  return { id: `enem-${year}-regular-${number}${language ? `-${language}` : ""}`, url: url.href, title, postId: post.id };
}
export function matchQuestion(question, html) {
  const { text, stopped } = questionText(html), body = normalize(text);
  const prompt = normalize(question.prompt);
  const context = normalize(question.context.replace(/!\[[^\]]*\]\([^)]*\)/g, ""));
  const fragments = [context.slice(0, 90), context.slice(90, 180), context.slice(180, 270)].filter(t => t.length >= 70);
  const contextMatches = fragments.filter(t => body.includes(t)).length;
  const alternatives = question.alternatives.filter(a => { const t = normalize(a.text ?? ""); return t.length >= 12 && body.includes(t); }).length;
  const promptMatches = prompt.length >= 25 && body.includes(prompt);
  const approved = stopped && (promptMatches && (alternatives >= 3 || contextMatches >= 2) || contextMatches >= 3 && alternatives >= 2);
  return { approved, promptMatches, contextMatches, alternatives, boundary: stopped, fingerprint: createHash("sha256").update(body).digest("hex") };
}
export function robotAllows(robots, url) {
  let applies = false;
  for (const raw of robots.split(/\r?\n/)) {
    const [key, ...rest] = raw.split(":"); const value = rest.join(":").split("#")[0].trim();
    if (key.trim().toLowerCase() === "user-agent") applies = value === "*";
    if (applies && key.trim().toLowerCase() === "disallow" && value) {
      const pattern = "^" + value.replace(/[.+?^{}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
      const target = new URL(url); if (new RegExp(pattern).test(target.pathname + target.search)) return false;
    }
  }
  return true;
}
