"use client";

import { useRef, useState } from "react";
import { ArrowRight, Check, ExternalLink } from "lucide-react";
import { CODES, COMPETENCIES } from "@/lib/writing/catalog";
import { SPRINT_ANALYSES, SPRINT_CONTEXTS, SPRINT_ESSAYS, SPRINT_RIGHTS, SPRINT_SOURCES } from "@/lib/sprint/catalog";
import { hasReflection, readingDone } from "@/lib/sprint/engine";
import type { SprintDay, SprintEssay, SprintState } from "@/lib/sprint/types";
import { ReflectionField } from "./activities";
import { WritingProblemReport } from "@/components/writing/problem-report";

export function SprintReader({ day, state, onSave }: { day: SprintDay; state: SprintState; onSave: (s: SprintState) => void }) {
  const [essayId, setEssayId] = useState(day.essays.find(id => !readingDone(state, id)) ?? day.essays[0]);
  const essay = SPRINT_ESSAYS.find(e => e.id === essayId)!;
  return <section><div className="sp-section-title"><div><p className="sp-kicker">DUAS REDAÇÕES · DUAS FORMAS DE PENSAR</p><h2>Leia as escolhas do autor.</h2></div><span>Originais completos, com fonte</span></div>
    <nav className="sp-essay-nav" aria-label="Redações do dia">{day.essays.map((id, i) => { const e = SPRINT_ESSAYS.find(e => e.id === id)!; return <button key={id} aria-current={id === essayId ? "page" : undefined} onClick={() => setEssayId(id)}><span>{readingDone(state, id) ? <Check size={17} aria-hidden="true" /> : `0${i + 1}`}</span><span><strong>{e.author}</strong><small>ENEM {e.year} · nota 1000</small></span></button>; })}</nav>
    <Reader key={essayId} essay={essay} state={state} onSave={onSave} />
    <Comparison key={day.id} day={day} state={state} onSave={onSave} />
  </section>;
}

function Reader({ essay: e, state, onSave }: { essay: SprintEssay; state: SprintState; onSave: (s: SprintState) => void }) {
  const analysis = SPRINT_ANALYSES.find(a => a.essayId === e.id)!, source = SPRINT_SOURCES[e.source], context = SPRINT_CONTEXTS[e.theme];
  const r = state.readings[e.id] ?? { prediction: "", opened: [], reflection: "" };
  const [paragraph, setParagraph] = useState(r.opened.at(-1) ?? 0), heading = useRef<HTMLHeadingElement>(null);
  const unlocked = hasReflection(r.prediction), all = r.opened.length === 4;
  function update(patch: Partial<typeof r>) { onSave({ ...state, readings: { ...state.readings, [e.id]: { ...r, ...patch } } }); }
  function open(index: number) {
    setParagraph(index); update({ opened: [...new Set([...r.opened, index])] }); requestAnimationFrame(() => heading.current?.focus());
  }
  return <article className="sp-reader"><header className="sp-reader-heading"><p className="sp-kicker">REDAÇÃO REAL · ENEM {e.year}</p><h3>{e.author}</h3><p>{context.title}</p><div className="sp-reader-source"><span><Check size={15} aria-hidden="true" />1000 · nota verificada na cartilha</span><a href={`${source.url}#page=${e.pdfPage}`} target="_blank" rel="noopener noreferrer">Original e comentário do INEP · p. {e.page}<ExternalLink size={14} aria-hidden="true" /><span className="sr-only"> (nova aba; página {e.pdfPage} do PDF)</span></a></div></header>
    <details className="sp-context"><summary>Interpretar o tema antes do texto</summary><div><section><h4>Recorte e contexto</h4><p>{context.scope}</p><p>{context.history}</p></section><section><h4>Causas e consequências</h4><p>{context.causes}</p><p>{context.consequences}</p></section><section><h4>Perspectivas e repertórios</h4><p>{context.perspectives}</p><p>{context.repertoire}</p></section><section><h4>Da superfície ao mecanismo</h4><p>{context.shallow}</p><p>{context.intervention}</p></section></div></details>
    <div className="sp-reading-layout"><div className="sp-original"><p className="sp-kicker">TEXTO DO PARTICIPANTE · CLIQUE EM ANALISAR APÓS SUA HIPÓTESE</p>{e.paragraphs.map((text, i) => <section key={i} className={r.opened.length && paragraph === i ? "is-active" : ""}><div className="sp-paragraph-meta"><span>{String(i + 1).padStart(2, "0")} · {['Introdução', 'Desenvolvimento 1', 'Desenvolvimento 2', 'Conclusão'][i]}</span><button disabled={!unlocked} onClick={() => open(i)} aria-pressed={!!r.opened.length && paragraph === i}>Analisar {r.opened.includes(i) && <Check size={13} aria-hidden="true" />}</button></div><p>{text}</p></section>)}<p className="sp-source-note">{source.title}. Item {e.item}, página impressa {e.page}, página {e.pdfPage} do PDF. Transcrição com grafia e desvios preservados; espaçamento e tipografia normalizados.</p></div>
      <aside className="sp-inspector" aria-label="Leitura ativa e análise"><p className="sp-kicker">PRIMEIRO, SUA LEITURA</p><h4>O que você percebeu?</h4><p>{analysis.question}</p><ReflectionField label="Minha hipótese antes da análise" value={r.prediction} maxLength={2000} onChange={prediction => update({ prediction })} />{!r.opened.length && <button className="button button-primary" disabled={!unlocked} onClick={() => open(0)}>Registrar e comparar<ArrowRight size={16} aria-hidden="true" /></button>}
        {!!r.opened.length && unlocked && <div className="sp-analysis"><nav aria-label="Trechos da análise">{analysis.sections.map((_, i) => <button key={i} aria-pressed={paragraph === i} onClick={() => open(i)} aria-label={`Analisar ${['introdução', 'desenvolvimento 1', 'desenvolvimento 2', 'conclusão'][i]}`}>{String(i + 1).padStart(2, "0")}{r.opened.includes(i) && <Check size={11} aria-hidden="true" />}</button>)}</nav><span className="sp-kicker">COMENTÁRIO AUTORAL DA PLATAFORMA</span><h4 ref={heading} tabIndex={-1}>{analysis.sections[paragraph].title}</h4><p>{analysis.sections[paragraph].analysis}</p><p className="sp-analysis-question">{analysis.sections[paragraph].question}</p><small>{r.opened.length}/4 trechos explorados</small>{!all && <button className="sp-text-button" onClick={() => open([0, 1, 2, 3].find(n => !r.opened.includes(n))!)}>Explorar o próximo trecho<ArrowRight size={15} aria-hidden="true" /></button>}</div>}
      </aside></div>
    {all && unlocked && <div className="sp-after-reading"><div className="sp-project"><section><p className="sp-kicker">TESE</p><h4>O que está sendo defendido?</h4><p>{analysis.thesis}</p></section><section><p className="sp-kicker">PROJETO DE TEXTO</p><h4>Como o raciocínio se organiza?</h4><p>{analysis.project}</p></section></div><h4>Cinco lentes para reler.</h4><div className="sp-competency-analysis">{CODES.map(c => <details key={c}><summary><b>{c}</b><span>{COMPETENCIES[c].title}</span></summary><p>{analysis.competencies[c]}</p></details>)}</div><section className="sp-transfer"><h4>Levar a estratégia a outro tema</h4><p>{analysis.transfer}</p><ReflectionField label="Que escolha do texto você levaria para outro tema, como aplicaria e qual limite respeitaria?" value={r.reflection} onChange={reflection => update({ reflection })} />{readingDone(state, e.id) && <p className="sp-done" role="status"><Check size={16} aria-hidden="true" />Leitura e reflexão registradas.</p>}</section></div>}
    <details className="sp-credits"><summary>Autenticidade, nota e reprodução</summary><p>{source.proof}</p><p>{SPRINT_RIGHTS}</p><a href={source.catalog} target="_blank" rel="noopener noreferrer">Consultar a referência primária (nova aba)</a></details><WritingProblemReport contentId={e.id} />
  </article>;
}

function Comparison({ day, state, onSave }: { day: SprintDay; state: SprintState; onSave: (s: SprintState) => void }) {
  const c = state.comparisons[String(day.id)] ?? { prediction: "", reflection: "" }, [revealed, setRevealed] = useState(false);
  const ready = day.essays.every(id => readingDone(state, id));
  function update(patch: Partial<typeof c>) { onSave({ ...state, comparisons: { ...state.comparisons, [String(day.id)]: { ...c, ...patch } } }); }
  return <section className="sp-comparison"><p className="sp-kicker">UMA LEITURA AO LADO DA OUTRA</p><h3>Compare as estratégias.</h3><p>{day.comparisonTask}</p>{!ready && <p className="sp-muted">Conclua as duas leituras e suas reflexões para abrir a comparação.</p>}
    {ready && <><ReflectionField label="Minha comparação antes do comentário" value={c.prediction} onChange={prediction => update({ prediction })} /><button className="sp-text-button" disabled={!hasReflection(c.prediction)} onClick={() => setRevealed(!revealed)}>{revealed ? "Recolher comentário" : "Conferir diferenças e possibilidades"}<ArrowRight size={15} aria-hidden="true" /></button></>}
    {ready && (revealed || !!c.reflection) && hasReflection(c.prediction) && <div className="sp-model"><p>{day.comparison}</p><ReflectionField label="O que acrescentou ou mudou na sua comparação? Mostre uma escolha de cada texto." value={c.reflection} onChange={reflection => update({ reflection })} />{hasReflection(c.reflection) && <p className="sp-done"><Check size={15} aria-hidden="true" />Comparação registrada.</p>}</div>}
  </section>;
}
