"use client";

import { useId, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, RotateCcw } from "lucide-react";
import { COMPETENCIES } from "@/lib/writing/catalog";
import { SPRINT_QUESTIONS } from "@/lib/sprint/catalog";
import { hasReflection, productionDone, responseDone, sameSelection, submitResponse, validSelection } from "@/lib/sprint/engine";
import type { SprintDay, SprintProduction, SprintQuestion, SprintResponse, SprintState } from "@/lib/sprint/types";
import { WritingProblemReport } from "@/components/writing/problem-report";

export function ReflectionField({ label, value, onChange, minimum = 80, maxLength = 3000 }: { label: string; value: string; onChange: (value: string) => void; minimum?: number; maxLength?: number }) {
  const id = useId(), [notice, setNotice] = useState("");
  return <div className="sp-field"><label htmlFor={id}>{label}</label><textarea id={id} value={value} maxLength={maxLength} spellCheck aria-describedby={`${id}-help`} onChange={e => { onChange(e.target.value); setNotice(""); }} onPaste={e => {
    if (value.length - (e.currentTarget.selectionEnd - e.currentTarget.selectionStart) + e.clipboardData.getData("text").length > maxLength) { e.preventDefault(); setNotice("Esse trecho ultrapassa o limite do campo. Divida o material antes de colar; seu texto foi mantido."); }
  }} /><small id={`${id}-help`}>{value.trim().length}/{minimum} caracteres mínimos · pelo menos 12 palavras. O tamanho registra participação; não avalia a qualidade.</small>{notice && <p role="status">{notice}</p>}</div>;
}

const blankResponse = (): SprintResponse => ({ selection: [], reasoning: "", attempts: [], correction: "" });
export function SprintPractice({ day, state, onSave, initialId, onFinal }: { day: SprintDay; state: SprintState; onSave: (state: SprintState) => void; initialId?: string; onFinal: () => void }) {
  const questions = SPRINT_QUESTIONS.filter(q => q.day === day.id);
  const [id, setId] = useState(initialId ?? questions.find(q => !responseDone(q, state.responses[q.id]))?.id ?? questions[0].id);
  const question = questions.find(q => q.id === id) ?? questions[0];
  return <section className="sp-practice"><div className="sp-section-title"><div><p className="sp-kicker">ANALISAR · DECIDIR · JUSTIFICAR</p><h2>O que sustenta sua escolha?</h2></div><span>{questions.filter(q => responseDone(q, state.responses[q.id])).length}/5 desafios consolidados</span></div>
    <nav className="sp-question-nav" aria-label="Desafios do dia">{questions.map((q, i) => <button key={q.id} aria-current={q.id === question.id ? "step" : undefined} onClick={() => setId(q.id)}><span>{responseDone(q, state.responses[q.id]) ? <Check size={16} aria-hidden="true" /> : String(i + 1).padStart(2, "0")}</span><span>{q.competency}<small>{q.kind === "choice" ? "Escolha" : q.kind === "order" ? "Ordenação" : "Associação"}</small></span></button>)}</nav>
    <Question key={question.id} question={question} response={state.responses[question.id] ?? blankResponse()} onSave={r => onSave({ ...state, responses: { ...state.responses, [question.id]: r } })} onNext={() => setId(questions[(questions.indexOf(question) + 1) % questions.length].id)} />
    <div className="sp-section-title"><div><p className="sp-kicker">AGORA O TEXTO É SEU</p><h2>Escrever para transferir.</h2></div><span>Produção e autoavaliação</span></div>
    {day.productions.map(task => <Production key={task.id} task={task} state={state} onSave={onSave} />)}
    {day.id === 6 && <div className="sp-final-call"><span className="sp-kicker">PRODUÇÃO INTEGRAL</span><h3>Seu simulado final.</h3><p>O último exercício é uma redação completa em outro tema. Preserve uma versão e revise as cinco competências com evidências do seu texto.</p><button className="button button-primary" onClick={onFinal}>Abrir o simulado<ArrowRight size={17} aria-hidden="true" /></button></div>}
  </section>;
}

function Question({ question: q, response: r, onSave, onNext }: { question: SprintQuestion; response: SprintResponse; onSave: (r: SprintResponse) => void; onNext: () => void }) {
  const feedback = useRef<HTMLHeadingElement>(null);
  const selection = q.kind === "order" && !r.selection.length ? q.options.map((_, i) => i) : r.selection;
  const last = r.attempts.at(-1), confirmed = !!last && sameSelection(last.selection, selection) && last.reasoning === r.reasoning.trim();
  const correct = !!last && sameSelection(last.selection, q.answer);
  function move(from: number, to: number) {
    const next = [...selection]; [next[from], next[to]] = [next[to], next[from]]; onSave({ ...r, selection: next });
  }
  return <article className="sp-question"><p className="sp-kicker">{q.competency} · {COMPETENCIES[q.competency].title}</p><h3>{q.skill}</h3><p className="sp-passage">{q.passage}</p><p className="sp-prompt">{q.prompt}</p><small className="sp-muted">Trecho e situação didáticos autorais.</small>
    <fieldset disabled={confirmed}><legend className="sr-only">{q.kind === "choice" ? "Escolha uma alternativa" : q.kind === "order" ? "Ordene os trechos" : "Associe os trechos"}</legend>
      {q.kind === "choice" && <div className="sp-options">{q.options.map((option, i) => <label key={i} className={selection[0] === i ? "selected" : ""}><input type="radio" name={q.id} value={i} checked={selection[0] === i} onChange={() => onSave({ ...r, selection: [i] })} /><span className="sp-letter" aria-hidden="true">{String.fromCharCode(65 + i)}</span><span>{option}</span></label>)}</div>}
      {q.kind === "order" && <ol className="sp-order">{selection.map((n, i) => <li key={n}><span className="sp-letter">{i + 1}</span><p>{q.options[n]}</p><div><button type="button" disabled={confirmed || i === 0} aria-label={`Mover trecho ${n + 1} para cima`} onClick={() => move(i, i - 1)}><ArrowUp size={16} aria-hidden="true" /></button><button type="button" disabled={confirmed || i === selection.length - 1} aria-label={`Mover trecho ${n + 1} para baixo`} onClick={() => move(i, i + 1)}><ArrowDown size={16} aria-hidden="true" /></button></div></li>)}</ol>}
      {q.kind === "match" && <div className="sp-match">{q.pairs!.map((pair, i) => <label key={i}><span><b>{i + 1}.</b> {pair}</span><select aria-label={`Associação ${i + 1}`} value={selection[i] ?? -1} onChange={e => { const next = Array.from({ length: q.pairs!.length }, (_, n) => selection[n] ?? -1); next[i] = Number(e.target.value); onSave({ ...r, selection: next }); }}><option value={-1}>Escolha a relação</option>{q.options.map((option, n) => <option key={n} value={n} disabled={selection.some((v, index) => index !== i && v === n)}>{option}</option>)}</select></label>)}</div>}
    </fieldset>
    {!confirmed && <><ReflectionField label="Que evidência torna sua resposta superior às outras?" value={r.reasoning} maxLength={1200} onChange={reasoning => onSave({ ...r, reasoning })} /><div className="sp-actions"><button className="button button-primary" disabled={!validSelection(q, selection) || !hasReflection(r.reasoning)} onClick={() => { onSave(submitResponse(q, { ...r, selection })); requestAnimationFrame(() => feedback.current?.focus()); }}>Conferir meu raciocínio<ArrowRight size={16} aria-hidden="true" /></button><small>Escolha e justificativa ficam guardadas antes do gabarito.</small></div></>}
    {confirmed && <section className={`sp-feedback ${correct ? "is-correct" : "needs-review"}`}><h4 ref={feedback} tabIndex={-1}>{correct ? "Sua escolha atende ao recorte." : "Há uma distinção para revisar."}</h4><p>{q.explanation}</p><div className="sp-feedback-options">{q.kind === "choice" ? q.options.map((option, i) => <div key={i}><strong>{String.fromCharCode(65 + i)} · {i === q.answer[0] ? "Resposta superior" : "Distrator"}{last!.selection[0] === i ? " · sua escolha" : ""}</strong><p>{q.feedback[i]}</p></div>) : q.kind === "order" ? q.answer.map((n, i) => <div key={n}><strong>{i + 1}. {q.options[n]}</strong><p>{q.feedback[n]}</p></div>) : q.pairs!.map((pair, i) => <div key={i}><strong>{pair}</strong><p>{q.options[q.answer[i]]}</p><small>{q.feedback[i]}</small></div>)}</div>
      {!sameSelection(r.attempts[0].selection, q.answer) && <><p className="sp-repair"><strong>Para essa dificuldade:</strong> {q.repair}</p><ReflectionField label="O que confundiu você e qual regra usará na próxima tentativa?" value={r.correction} maxLength={2000} onChange={correction => onSave({ ...r, correction })} /></>}
      <div className="sp-actions">{(!correct || !responseDone(q, r)) && <button className="button sp-outline" onClick={() => onSave({ ...r, selection: [], reasoning: "" })}><RotateCcw size={16} aria-hidden="true" />Responder novamente</button>}<button className="sp-text-button" onClick={onNext}>Próximo desafio<ArrowRight size={16} aria-hidden="true" /></button></div><p className="sp-muted">{responseDone(q, r) ? "Desafio consolidado neste treino. Isso não equivale a uma nota de redação." : "Para consolidar, registre o que mudou na sua compreensão e faça uma nova tentativa correta."}</p>
    </section>}
    <WritingProblemReport contentId={q.id} />
  </article>;
}

function Production({ task, state, onSave }: { task: SprintProduction; state: SprintState; onSave: (s: SprintState) => void }) {
  const p = state.productions[task.id] ?? { text: "", reflection: "", checks: task.criteria.map(() => false), revealed: false };
  function update(next: Partial<typeof p>) { onSave({ ...state, productions: { ...state.productions, [task.id]: { ...p, ...next } } }); }
  const ready = p.text.trim().length >= task.minimum && hasReflection(p.text);
  return <article className="sp-production"><div className="sp-section-title"><h3>{task.title}</h3>{productionDone(state, task) && <span><Check size={15} aria-hidden="true" />Autoavaliação registrada</span>}</div><p>{task.task}</p><ReflectionField label="Minha produção" value={p.text} minimum={task.minimum} maxLength={6000} onChange={text => update({ text })} />
    <button className="sp-text-button" disabled={!ready} onClick={() => update({ revealed: !p.revealed })}>{p.revealed ? "Recolher exemplo comentado" : "Comparar com uma possibilidade de resposta"}<ArrowRight size={15} aria-hidden="true" /></button>
    {p.revealed && <div className="sp-model"><p className="sp-kicker">EXEMPLO DIDÁTICO AUTORAL · OUTRAS SOLUÇÕES SÃO POSSÍVEIS</p><blockquote>{task.model}</blockquote><p>{task.commentary}</p></div>}
    <fieldset className="sp-checks"><legend>Autoavaliação · marque só o que pode sustentar no seu texto</legend>{task.criteria.map((criterion, i) => <label key={criterion}><input type="checkbox" checked={p.checks[i] ?? false} onChange={e => update({ checks: task.criteria.map((_, n) => n === i ? e.target.checked : p.checks[n] ?? false) })} /><span>{criterion}</span></label>)}</fieldset><ReflectionField label="Mostre um trecho que atende aos critérios e explique uma mudança para a próxima versão." value={p.reflection} maxLength={2000} onChange={reflection => update({ reflection })} /><p className="sp-muted">Registro de autoavaliação. A plataforma não atribui nota nem certifica a qualidade do texto livre.</p>
  </article>;
}
