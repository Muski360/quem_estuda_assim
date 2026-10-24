import { readFile, writeFile } from "node:fs/promises";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const questions=JSON.parse(await readFile("output/enem/approved.json","utf8"));
const selected=[];
for(const year of [...new Set(questions.map(q=>q.year))].sort())for(const area of ["languages","humanities","nature","mathematics"]){
  const candidates=questions.filter(q=>q.year===year&&q.area===area);
  const sample=candidates.find(q=>q.alternatives.some(a=>a.image))??candidates.find(q=>q.context.includes("__ENEM_ASSETS__"))??candidates[0];
  if(sample)selected.push(sample);
}
const escape=value=>String(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll('"',"&quot;");
const markdown=value=>renderToStaticMarkup(createElement(Markdown,{remarkPlugins:[remarkGfm,remarkMath],rehypePlugins:[rehypeKatex]},value.replaceAll("__ENEM_ASSETS__","./assets")));
const html=`<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Conferência ENEM</title><style>body{font:15px/1.65 Arial;background:#efeee5;color:#202820;margin:0}header{padding:20px}section{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:12px;page-break-after:always}article{background:#fffefa;padding:18px;min-width:0;border-top:4px solid #b54b2d}h2{font:500 21px Georgia;margin:8px 0}small{font-size:11px;color:#555}p{margin:10px 0}img{display:block;max-width:100%;height:auto;max-height:220px;object-fit:contain;margin:12px auto}ol{padding-left:24px}li{padding:8px 0;border-top:1px solid #ddd}li.correct{background:#ebf1e1}a{color:#963b22;font-size:10px}table{width:100%;font-size:11px}td,th{border:1px solid #ccc}article>div{max-height:1100px;overflow:auto} .prompt{font-weight:600}</style><header><h1>Amostra por ano e área · ${selected.length} questões</h1><p>Texto completo, gráficos e alternativas. Comparar com o caderno e o gabarito oficiais.</p></header>${[...new Set(selected.map(q=>q.year))].map(year=>`<section id="year-${year}">${selected.filter(q=>q.year===year).map(q=>`<article data-sample="${q.id}"><small>${q.area} · ${q.source.booklet}</small><h2>ENEM ${q.year} · ${q.number}</h2><div>${markdown(q.context)}<div class="prompt">${markdown(q.prompt)}</div><ol type="A">${q.alternatives.map((a,i)=>`<li class="${i===q.correct_index?"correct":""}">${markdown(a.text)}${a.image?`<img src="${escape(a.image.replace("__ENEM_ASSETS__","./assets"))}" alt="Alternativa ${a.letter}">`:""}</li>`).join("")}</ol></div><a href="${escape(q.source.answerKey)}">Documento oficial</a></article>`).join("")}</section>`).join("")}</html>`;
await writeFile("output/enem/gallery.html",html);
await writeFile("output/enem/visual-samples.json",JSON.stringify(selected.map(q=>({id:q.id,year:q.year,area:q.area})),null,2));
console.log(`Galeria: output/enem/gallery.html (${selected.length} amostras).`);
