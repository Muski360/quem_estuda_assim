"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, Download, RotateCcw, Timer } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useWriting } from "@/components/writing/use-writing";
import { WritingEditor } from "@/components/writing/writing-editor";
import { CODES, COMPETENCIES } from "@/lib/writing/catalog";
import { makeDocument } from "@/lib/writing/engine";
import { SPRINT_ANALYSES, SPRINT_DAYS, SPRINT_FINAL_TOPIC, SPRINT_ID, SPRINT_QUESTIONS, wordsForDay } from "@/lib/sprint/catalog";
import { dayProgress, emptySprint, errorsForDay, finalDone, hasReflection, productionDone, readingDone, responseDone, sprintStats } from "@/lib/sprint/engine";
import type { SprintState } from "@/lib/sprint/types";
import type { WritingDocument } from "@/lib/writing/types";
import { SprintReader } from "./essay-reader";
import { ReflectionField, SprintPractice } from "./activities";

type View = "dashboard" | "day" | "review" | "final";
type Stage = "reading" | "practice" | "vocabulary" | "review";

export function Sprint() {
  const { user, loading } = useAuth();
  if (loading) return <main id="conteudo" className="sp-shell"><p className="sp-loading" role="status">Abrindo seu sprint…</p></main>;
  return <SprintWorkspace key={user?.id ?? "guest"} />;
}

function SprintWorkspace() {
  const { user } = useAuth(), writing = useWriting();
  const [requestedId, setRequestedId] = useState(() => typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("caderno"));
  const [view, setView] = useState<View>("dashboard"), [stage, setStage] = useState<Stage>("reading"), [reviewId, setReviewId] = useState<string | undefined>();
  const focus = useRef<HTMLDivElement>(null);
  const notebooks = writing.summaries.filter(d => d.kind === "sprint");
  const summary = notebooks.find(d => d.id === requestedId) ?? notebooks.find(d => d.id === writing.local.workspace.activeDocument) ?? notebooks[0];
  const summaryId = summary?.id, summaryUpdatedAt = summary?.updatedAt, { ready, loadDocument } = writing;
  const document = summary ? writing.documents[summary.id]?.value ?? null : null;
  const state = document?.sprint ?? emptySprint(), day = SPRINT_DAYS[state.day - 1];
  useEffect(() => { if (ready && summaryId) void loadDocument(summaryId); }, [ready, summaryId, summaryUpdatedAt, loadDocument]);
  useEffect(() => { focus.current?.focus(); }, [view, stage, state.day]);
  function save(next: SprintState) { if (document) writing.saveDocument({ ...document, sprint: next }); }
  function begin() {
    if (summary && !document) return;
    const next = document ?? { ...makeDocument("sprint", SPRINT_ID), title: "Sprint ENEM · 02 a 07/11/2026", sprint: emptySprint() };
    if (!document) writing.saveDocument(next);
    writing.updateWorkspace({ ...writing.local.workspace, activeDocument: next.id }); setRequestedId(null); setView("day"); setStage("reading");
  }
  function openDay(id: number, next: Stage = "reading") {
    if (!document) return;
    save({ ...state, day: id }); writing.updateWorkspace({ ...writing.local.workspace, activeDocument: document.id }); setRequestedId(null); setView("day"); setStage(next); setReviewId(undefined);
  }
  function reviewQuestion(id: string) {
    const q = SPRINT_QUESTIONS.find(q => q.id === id)!; openDay(q.day, "practice"); setReviewId(id);
  }
  function exportNotebook() {
    if (!document) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(document, null, 2)], { type: "application/json;charset=utf-8" })), a = window.document.createElement("a");
    a.href = url; a.download = `sprint-enem-2026-${document.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const status = !user ? "Salvo neste navegador" : writing.saving ? "Sincronizando…" : document && writing.documents[document.id]?.pending ? "Neste navegador · aguardando envio" : writing.error ? "Cópia local · envio não confirmado" : "Sincronizado com sua conta";
  const completed = SPRINT_DAYS.filter(d => dayProgress(state, d.id, document ?? undefined).complete).length;
  if (!writing.ready) return <main id="conteudo" className="sp-shell"><p className="sp-loading" role="status">Retomando suas leituras e rascunhos…</p></main>;
  return <main id="conteudo" className="sp-shell"><div className="sp-top"><Link href="/escreve" className="sp-text-button"><ArrowLeft size={15} aria-hidden="true" />Quem escreve assim?</Link><span className="sp-kicker"><Timer size={16} aria-hidden="true" />QUEM SPRINTA ASSIM?</span><span className="sp-save" role="status">{status}</span></div>
    {(writing.error || writing.storageError) && <div className="sp-notice" role="status"><p>{writing.error || writing.storageError}</p><div className="sp-actions">{user && <><button className="sp-text-button" disabled={writing.saving} onClick={() => void writing.sync()}>Tentar sincronizar</button><Link href="/entrar?next=%2Fsprinta">Entrar novamente</Link></>}{document && <button className="sp-text-button" onClick={exportNotebook}>Baixar minha cópia</button>}</div></div>}
    {writing.notice && <p className="sp-notice" role="status">{writing.notice}</p>}
    {writing.guest && user && <div className="sp-notice"><p>Há cadernos do Escreve e do Sprint neste navegador. Você pode trazê-los para esta conta; as cópias já existentes serão preservadas.</p><div className="sp-actions"><button className="button sp-outline" disabled={writing.saving} onClick={() => void writing.importGuest()}>Trazer meus cadernos</button><button className="sp-text-button" onClick={writing.dismissGuest}>Agora não</button></div></div>}
    <div className="sp-work-nav"><nav aria-label="Seu sprint"><button aria-current={view === "dashboard" ? "page" : undefined} onClick={() => setView("dashboard")}>Os seis dias</button>{document && <><button aria-current={view === "day" ? "page" : undefined} onClick={() => setView("day")}>Dia {day.id} · estudo</button><button aria-current={view === "review" ? "page" : undefined} onClick={() => setView("review")}>Revisão e diagnóstico</button></>}</nav>{document && <button className="sp-text-button" aria-label="Baixar caderno" onClick={exportNotebook}><Download size={14} aria-hidden="true" /><span>Baixar caderno</span></button>}</div>
    {notebooks.length > 1 && <label className="sp-notebook-picker">Caderno do sprint<select aria-label="Caderno do sprint" value={summary?.id ?? ""} onChange={e => { setRequestedId(e.target.value); setView("dashboard"); }}>{notebooks.map(d => <option key={d.id} value={d.id}>{d.title} · {new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(d.updatedAt))}</option>)}</select></label>}
    <div ref={focus} tabIndex={-1} className="sp-view" aria-label="Área de estudo do sprint">
      {view === "dashboard" && <><section className="sp-hero"><div><p className="sp-kicker">REDAÇÃO ENEM 2026 · 02—07 NOVEMBRO</p><h1>Quem sprinta<br /><em>assim?</em></h1><p>Seis dias para ler com atenção,<br />argumentar com precisão e escrever.</p><button className="button button-primary" disabled={!!summary && !document || !!user && writing.saving && !summary} onClick={begin}>{summary && !document ? "Abrindo seu caderno…" : document ? `Continuar o dia ${day.id}` : "Começar meu sprint"}<ArrowRight size={18} aria-hidden="true" /></button><small>12 redações reais nota 1000 · estudo aberto sem login</small></div><div className="sp-hero-number" aria-label={`${completed} de 6 dias concluídos`}><span>SEU PERCURSO</span><strong>06<span>dias</span></strong><div className="sp-six-marks" aria-hidden="true">{SPRINT_DAYS.map(d => <span key={d.id} className={dayProgress(state, d.id, document ?? undefined).complete ? "complete" : ""} />)}</div><p>{completed}/6 dias com prática e reflexão concluídas</p></div></section>
        <section className="sp-dashboard" aria-labelledby="sp-days-title"><div className="sp-section-title"><div><p className="sp-kicker">UM FOCO POR DIA</p><h2 id="sp-days-title">Da introdução ao texto inteiro.</h2></div><span>Datas sugeridas · você organiza o ritmo</span></div><div className="sp-days">{SPRINT_DAYS.map(d => { const p = dayProgress(state, d.id, document ?? undefined); return <button key={d.id} className={document && state.day === d.id ? "is-current" : ""} disabled={!document} onClick={() => openDay(d.id)}><span className="sp-day-number">{String(d.id).padStart(2, "0")}</span><span className="sp-day-copy"><small>{String(d.id + 1).padStart(2, "0")}/11 · {d.minutes} min estimados</small><strong>{d.title}</strong><span>{d.focus}</span></span><span className="sp-day-progress"><span>{p.complete ? <><Check size={14} aria-hidden="true" />Concluído</> : p.done ? `${p.done}/${p.total} etapas` : "Para começar"}</span><progress value={p.done} max={p.total} aria-label={`Progresso do dia ${d.id}`} /></span><ArrowRight className="sp-day-arrow" size={20} aria-hidden="true" /></button>; })}</div>{!document && <p className="sp-muted">Comece o sprint para criar seu caderno e abrir qualquer dia. Os textos ficam guardados neste navegador; ao entrar, você pode trazê-los para sua conta.</p>}</section>
        <section className="sp-method"><div><BookOpen size={24} aria-hidden="true" /><h3>Ler, explicar, aplicar.</h3><p>Os originais completos têm autor, página e nota identificados. Registre sua hipótese, explore os trechos e compare duas estratégias.</p></div><div><RotateCcw size={24} aria-hidden="true" /><h3>Voltar ao que ficou difícil.</h3><p>Trinta desafios com justificativas, onze produções curtas, vocabulário em retomadas e uma redação completa com autoavaliação.</p></div></section><Diagnostics state={state} />
      </>}
      {view === "day" && document && <><header className="sp-day-heading"><span className="sp-kicker">DIA {day.id} · {String(day.id + 1).padStart(2, "0")}/11/2026 · CERCA DE {day.minutes} MIN</span><h1>{day.title}</h1><p>{day.focus}</p></header><nav className="sp-stages" aria-label="Etapas do dia">{([['reading', 'Ler e comparar'], ['practice', 'Praticar'], ['vocabulary', 'Vocabulário'], ['review', 'Retomar']] as const).map(([id, label]) => <button key={id} aria-current={stage === id ? "step" : undefined} onClick={() => { setStage(id); setReviewId(undefined); }}>{label}</button>)}{day.id === 6 && <button onClick={() => setView("final")}>Simulado final<ArrowRight size={14} aria-hidden="true" /></button>}</nav>
        {stage === "reading" && <SprintReader key={day.id} day={day} state={state} onSave={save} />}
        {stage === "practice" && <SprintPractice key={`${day.id}:${reviewId ?? "practice"}`} day={day} state={state} onSave={save} initialId={reviewId} onFinal={() => setView("final")} />}
        {stage === "vocabulary" && <Vocabulary key={day.id} day={day.id} state={state} onSave={save} />}
        {stage === "review" && <><section className="sp-retrieval"><p className="sp-kicker">RECUPERAR ANTES DE RELER</p><h2>{day.id === 1 ? "Qual é seu ponto de partida?" : "O que ficou dos dias anteriores?"}</h2><p>{day.retrieval}</p><ReflectionField label="Minha recuperação sem consulta" value={state.retrievals[String(day.id)] ?? ""} onChange={value => save({ ...state, retrievals: { ...state.retrievals, [String(day.id)]: value } })} />{hasReflection(state.retrievals[String(day.id)] ?? "") && <p className="sp-done"><Check size={16} aria-hidden="true" />Retomada registrada. Agora confira as leituras anteriores.</p>}</section><Review state={state} day={day.id} onQuestion={reviewQuestion} /></>}
        <DayChecklist document={document} onStage={setStage} onFinal={() => setView("final")} /><div className="sp-day-footer"><button className="sp-text-button" onClick={() => setView("dashboard")}><ArrowLeft size={15} aria-hidden="true" />Os seis dias</button>{day.id < 6 ? <button className="button sp-outline" onClick={() => openDay(day.id + 1)}>Abrir dia {day.id + 1}<ArrowRight size={16} aria-hidden="true" /></button> : <button className="button button-primary" onClick={() => setView("final")}>Escrever o simulado<ArrowRight size={16} aria-hidden="true" /></button>}</div>
      </>}
      {view === "review" && document && <><header className="sp-day-heading"><p className="sp-kicker">ACERTOS, ERROS E ESTRATÉGIAS</p><h1>Seu raciocínio em revisão.</h1><p>Primeiras respostas e consolidação são indicadores deste conjunto de atividades.</p></header><Diagnostics state={state} /><Review state={state} day={6} onQuestion={reviewQuestion} /></>}
      {view === "final" && document && <><header className="sp-day-heading"><span className="sp-kicker">SIMULADO FINAL · 90 MINUTOS SUGERIDOS</span><h1>Agora, um texto inteiro.</h1><p>{SPRINT_FINAL_TOPIC.title}</p></header><div className="sp-final-instructions"><p>Planeje, escreva e use <strong>Concluir versão e revisar</strong>. Na revisão de C1 a C5, indique um trecho e uma próxima ação; você pode marcar “Não sei avaliar”. Registre a reflexão final e conclua sua revisão.</p><p>Para registrar a produção integral, a versão deve ter ao menos 800 caracteres, 120 palavras e três parágrafos separados por uma linha em branco. São critérios de participação neste treino, sem estimativa de nota. O texto da tela não equivale às linhas manuscritas do ENEM.</p>{finalDone(document) && <p className="sp-done"><Check size={17} aria-hidden="true" />Simulado e autoavaliação registrados.</p>}</div><WritingEditor key={document.id} document={document} status={status} onSave={writing.saveDocument} onClose={() => { setView("day"); setStage("practice"); }} onDelete={() => { writing.deleteDocument(document.id); setRequestedId(null); setView("dashboard"); }} onTransfer={() => {}} /></>}
    </div>
  </main>;
}

function Diagnostics({ state }: { state: SprintState }) {
  return <section className="sp-diagnostics"><div className="sp-section-title"><div><p className="sp-kicker">CINCO COMPETÊNCIAS</p><h2>O que as suas escolhas mostram.</h2></div><span>Sem nota automática para texto livre</span></div><div>{CODES.map(c => { const s = sprintStats(state, c); return <article key={c}><span>{c}</span><h3>{COMPETENCIES[c].title}</h3><strong>{s.answered ? `${s.first}/${s.answered}` : "—"}</strong><small>acertos na primeira resposta</small><progress value={s.first} max={s.total} aria-label={`${c}: ${s.first} de ${s.total} primeiras respostas corretas`} /><p>{s.current}/{s.total} desafios consolidados, incluindo revisões</p></article>; })}</div><p className="sp-muted">A amostra tem seis desafios por competência. As justificativas escritas registram sua reflexão e não são corrigidas automaticamente. Acertos não se convertem em pontuação de 0 a 200 nem comprovam domínio de uma redação inteira.</p></section>;
}

function Vocabulary({ day, state, onSave }: { day: number; state: SprintState; onSave: (s: SprintState) => void }) {
  const words = wordsForDay(day);
  const [id, setId] = useState(words.find(w => !state.vocabulary[w.id]?.reviewed.includes(day))?.id ?? words[0].id);
  const word = words.find(w => w.id === id) ?? words[0];
  const v = state.vocabulary[word.id] ?? { recalls: {}, application: "", reviewed: [] }, revealed = v.reviewed.includes(day);
  function update(patch: Partial<typeof v>) { onSave({ ...state, vocabulary: { ...state.vocabulary, [word.id]: { ...v, ...patch } } }); }
  return <section className="sp-vocabulary"><div className="sp-section-title"><div><p className="sp-kicker">PRECISÃO, SEM PALAVRAS DE ENFEITE</p><h2>Recuperar. Conferir. Usar.</h2></div><span>{words.filter(w => state.vocabulary[w.id]?.reviewed.includes(day) && hasReflection(state.vocabulary[w.id].recalls[String(day)] ?? "") && hasReflection(state.vocabulary[w.id].application)).length}/{words.length} registros do dia</span></div><p className="sp-muted">Quatro expressões novas por dia, com retomadas no dia seguinte e três dias depois. A lembrança é registrada de novo antes de revelar o sentido; sua aplicação pode ser revisada a qualquer momento.</p><label className="sp-word-picker">Expressão para estudar<select aria-label="Expressão para estudar" value={word.id} onChange={e => setId(e.target.value)}>{words.map(w => <option key={w.id} value={w.id}>{w.day === day ? "Nova" : `Retomada do dia ${w.day}`} · {w.term}</option>)}</select></label><article className="sp-word"><span className="sp-kicker">{word.day === day ? "NOVA EXPRESSÃO" : `RECUPERAÇÃO · ESTUDADA NO DIA ${word.day}`}</span><h3>{word.term}</h3><ReflectionField label="Sem consultar: explique o sentido, uma alternativa e uma situação em que usaria a expressão." value={v.recalls[String(day)] ?? ""} maxLength={1200} onChange={value => update({ recalls: { ...v.recalls, [String(day)]: value } })} />{!revealed && <button className="button button-primary" disabled={!hasReflection(v.recalls[String(day)] ?? "")} onClick={() => update({ reviewed: [...v.reviewed, day] })}>Conferir o sentido<ArrowRight size={16} aria-hidden="true" /></button>}
      {revealed && <div className="sp-word-meaning"><dl><div><dt>No contexto</dt><dd>{word.meaning}</dd></div><div><dt>Efeito argumentativo</dt><dd>{word.effect}</dd></div><div><dt>Alternativas adequadas</dt><dd>{word.alternatives}</dd></div><div><dt>Quando evitar</dt><dd>{word.avoid}</dd></div></dl><p><strong>Aplique em outro contexto:</strong> {word.task}</p><ReflectionField label="Minha aplicação, com contexto suficiente para mostrar o sentido" value={v.application} maxLength={2000} onChange={application => update({ application })} /><details><summary>Comparar com uma possibilidade</summary><p>{word.example}</p><p className="sp-muted">Confira sentido, naturalidade e relação com a ideia. A comparação é uma autoavaliação.</p></details></div>}
    </article><div className="sp-actions"><button className="sp-text-button" onClick={() => setId(words[(words.indexOf(word) + 1) % words.length].id)}>Próxima expressão<ArrowRight size={16} aria-hidden="true" /></button></div></section>;
}

function Review({ state, day, onQuestion }: { state: SprintState; day: number; onQuestion: (id: string) => void }) {
  const errors = errorsForDay(state, day), [limit, setLimit] = useState(5);
  const strategies = SPRINT_ANALYSES.filter(a => readingDone(state, a.essayId)).slice(-5);
  return <section className="sp-review"><div className="sp-section-title"><div><p className="sp-kicker">REVISAR A DISTINÇÃO QUE FALTOU</p><h2>{errors.length ? `${errors.length} desafios para retomar.` : "Suas próximas revisões."}</h2></div><span>Até o dia {day}</span></div>{!errors.length ? <p className="sp-empty">Nenhum erro pendente entre os desafios respondidos até aqui. Itens ainda não respondidos continuam na prática de cada dia.</p> : <div className="sp-errors">{errors.slice(0, limit).map(q => <article key={q.id}><span className="sp-kicker">DIA {q.day} · {q.competency}</span><h3>{q.skill}</h3><p>{q.repair}</p><details><summary>Rever minha primeira justificativa</summary><p>{state.responses[q.id].attempts[0].reasoning}</p><p>{q.explanation}</p></details><button className="sp-text-button" onClick={() => onQuestion(q.id)}>Refazer com essa distinção<ArrowRight size={16} aria-hidden="true" /></button></article>)}{errors.length > limit && <button className="sp-text-button" onClick={() => setLimit(limit + 5)}>Mostrar mais cinco</button>}</div>}
    <div className="sp-section-title"><div><p className="sp-kicker">ESTRATÉGIAS RECENTES</p><h2>O que você já pode experimentar.</h2></div></div>{strategies.length ? strategies.map(a => <details key={a.essayId} className="sp-knowledge"><summary>{a.transfer}</summary><p><strong>Minha reflexão:</strong> {state.readings[a.essayId].reflection}</p><p className="sp-muted">Você pode reencontrar a análise completa no dia correspondente.</p></details>) : <p className="sp-empty">Ao concluir uma leitura e registrar a transferência, sua estratégia aparecerá aqui.</p>}
  </section>;
}

function DayChecklist({ document, onStage, onFinal }: { document: WritingDocument; onStage: (s: Stage) => void; onFinal: () => void }) {
  const s = document.sprint!, d = SPRINT_DAYS[s.day - 1], p = dayProgress(s, d.id, document);
  const readings = d.essays.filter(id => readingDone(s, id)).length, questions = SPRINT_QUESTIONS.filter(q => q.day === d.id && responseDone(q, s.responses[q.id])).length;
  const words = wordsForDay(d.id).filter(w => { const v = s.vocabulary[w.id]; return v?.reviewed.includes(d.id) && hasReflection(v.recalls[String(d.id)] ?? "") && hasReflection(v.application); }).length;
  const productions = d.productions.filter(task => productionDone(s, task)).length;
  return <section className="sp-checklist"><div><p className="sp-kicker">SEU DIA {d.id}</p><h3>{p.complete ? "Prática e reflexão concluídas." : `${p.done} de ${p.total} etapas registradas.`}</h3><progress value={p.done} max={p.total} aria-label={`Etapas concluídas do dia ${d.id}`} /></div><div><button onClick={() => onStage("reading")}>Leituras {readings}/2 · comparação {hasReflection(s.comparisons[String(d.id)]?.prediction ?? "") && hasReflection(s.comparisons[String(d.id)]?.reflection ?? "") ? "registrada" : "pendente"}</button><button onClick={() => onStage("practice")}>Desafios {questions}/5 · produções {productions}/{d.productions.length}</button><button onClick={() => onStage("vocabulary")}>Vocabulário {words}/{wordsForDay(d.id).length}</button><button onClick={() => onStage("review")}>Recuperação {hasReflection(s.retrievals[String(d.id)] ?? "") ? "registrada" : "pendente"}</button>{d.id === 6 && <button onClick={onFinal}>Simulado e rubrica {finalDone(document) ? "registrados" : "pendentes"}</button>}</div></section>;
}
