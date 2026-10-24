"use client";

import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { ArrowRight, Bookmark, Check, ExternalLink, Maximize2, X } from "lucide-react";
import { AREAS } from "@/lib/questions";
import type { ScrollItem } from "@/lib/scroll/types";
import { ImageZoom, QuestionMarkdown, StudyImage } from "./question-content";
import { ExplanationPanel } from "./explanation-panel";

export function QuestionCard({ item, busy, activeTimeRef, onAnswer, onNext, onSkip, onFavorite }: {
  item: ScrollItem; busy: boolean; activeTimeRef: RefObject<number>;
  onAnswer: (choice: number) => void; onNext: () => void; onSkip: () => void; onFavorite: () => void;
}) {
  const { question } = item;
  const storageKey = `qe:scroll-draft:${item.id}`;
  const timeKey = `qe:scroll-time:${item.id}`;
  const [selected, setSelected] = useState<number | null>(() => {
    try { const draft = sessionStorage.getItem(storageKey); return draft !== null && /^[0-4]$/.test(draft) ? Number(draft) : null; } catch { return null; }
  });
  const [zoom, setZoom] = useState<string | null>(null);
  const result = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const explanation = useRef<HTMLDivElement>(null);
  const locked = item.status !== "pending";
  const paused = !!item.pausedAt;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, []);
  useEffect(() => {
    try { const saved = Number(sessionStorage.getItem(timeKey)); activeTimeRef.current = Number.isFinite(saved) ? Math.max(0, Math.min(7200000, saved)) : 0; }
    catch { activeTimeRef.current = 0; }
  }, [activeTimeRef, timeKey]);
  useEffect(() => {
    let last = Date.now(), interaction = last;
    const touch = () => { interaction = Date.now(); };
    const visibility = () => { last = Date.now(); if (!document.hidden) interaction = last; };
    document.addEventListener("pointerdown", touch, { passive: true });
    document.addEventListener("keydown", touch);
    document.addEventListener("scroll", touch, { passive: true, capture: true });
    document.addEventListener("visibilitychange", visibility);
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (!locked && !paused && !busy && !document.hidden && now - interaction < 60000) {
        activeTimeRef.current = Math.min(7200000, activeTimeRef.current + Math.min(1500, now - last));
        try { sessionStorage.setItem(timeKey, String(activeTimeRef.current)); } catch { /* Time still accumulates in memory. */ }
      }
      last = now;
    }, 1000);
    return () => { clearInterval(timer); document.removeEventListener("pointerdown", touch); document.removeEventListener("keydown", touch); document.removeEventListener("scroll", touch, true); document.removeEventListener("visibilitychange", visibility); };
  }, [activeTimeRef, locked, paused, busy, timeKey]);
  useEffect(() => {
    try {
      if (locked) { sessionStorage.removeItem(storageKey); sessionStorage.removeItem(timeKey); }
      else if (selected !== null) sessionStorage.setItem(storageKey, String(selected));
    } catch { /* The selected answer remains in memory. */ }
  }, [selected, locked, storageKey, timeKey]);
  useEffect(() => { if (locked) result.current?.focus({ preventScroll: true }); }, [locked]);
  const choice = locked ? item.selected : selected;

  return <section className="sc-question-stage" aria-labelledby="sc-question-title">
    <div className="sc-question-meta"><span>{AREAS[question.area].label}</span><button className={`sc-bookmark${item.favorite ? " saved" : ""}`} onClick={onFavorite} disabled={busy} aria-pressed={item.favorite} aria-label={item.favorite ? "Remover dos favoritos" : "Salvar nos favoritos"}><Bookmark size={18} fill={item.favorite ? "currentColor" : "none"} aria-hidden="true" /><span>{item.favorite ? "Salva" : "Salvar"}</span></button></div>
    <div className="sc-reader" aria-label="Enunciado e alternativas" tabIndex={0} inert={paused || undefined}>
      <div className="sc-question-heading"><span className="sc-eyebrow">ENEM {question.year} · {question.source.application}{question.language && ` · ${question.language === "ingles" ? "Inglês" : "Espanhol"}`}</span><h1 id="sc-question-title" ref={heading} tabIndex={-1}>Questão {question.number}<span> / {question.source.booklet}</span></h1></div>
      {question.context && <QuestionMarkdown onZoom={setZoom}>{question.context}</QuestionMarkdown>}
      <div className="sc-question-prompt"><QuestionMarkdown onZoom={setZoom}>{question.prompt}</QuestionMarkdown></div>
      <div className="sc-alternatives" role="radiogroup" aria-label="Escolha uma alternativa" onKeyDown={event => {
        if (locked || paused || busy || !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
        event.preventDefault();
        const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
        const next = ((selected ?? 0) + direction + 5) % 5;
        setSelected(next);
        event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')[next]?.focus();
      }}>
        {question.alternatives.map((alternative, index) => <div className="sc-option-row" key={alternative.letter}>
          <button type="button" role="radio" aria-checked={choice === index} tabIndex={index === (choice ?? 0) ? 0 : -1} disabled={locked || paused || busy}
            className={`sc-option${choice === index ? " selected" : ""}${item.correctIndex === index ? " correct" : locked && choice === index && item.correct === false ? " incorrect" : ""}`}
            onClick={() => setSelected(index)}>
            <span className="sc-option-letter">{alternative.letter}</span><span className="sc-option-content">{alternative.text && <QuestionMarkdown>{alternative.text}</QuestionMarkdown>}{alternative.image && <StudyImage src={alternative.image} alt={`Figura da alternativa ${alternative.letter}`} />}</span>
            {item.correctIndex === index ? <Check size={20} aria-label="Alternativa correta" /> : locked && choice === index && item.correct === false ? <X size={20} aria-label="Sua alternativa está incorreta" /> : null}
          </button>
          {alternative.image && <button className="sc-option-zoom" aria-label={`Ampliar figura da alternativa ${alternative.letter}`} onClick={() => setZoom(alternative.image)}><Maximize2 size={16} aria-hidden="true" /></button>}
        </div>)}
      </div>
      <a className="sc-source" href={question.source.page} target="_blank" rel="noopener noreferrer">Questão oficial · INEP<ExternalLink size={12} aria-hidden="true" /><span className="sr-only"> (abre em nova aba)</span></a>
      {item.status === "answered" && <div ref={explanation}><ExplanationPanel question={question} selected={item.selected} correctIndex={item.correctIndex} /></div>}
    </div>
    <div className={`sc-answerbar${locked ? " has-result" : ""}`}>
      {locked ? <><div className="sc-answer-result" ref={result} tabIndex={-1} role="status"><strong>{item.status === "answered" ? item.correct ? "Acertou!" : `Resposta correta: ${String.fromCharCode(65 + item.correctIndex!)}` : item.status === "expired" ? "O tempo terminou." : "Questão pulada."}</strong><span>{item.xp ? `+${item.xp} XP · mais um passo` : item.status === "answered" ? "Resposta salva no seu histórico." : "Ela pode voltar em outra sessão."}</span></div>{item.status === "answered" && question.hasExplanation && <button className="sc-text-button sc-understand" onClick={() => { const panel = explanation.current?.querySelector("details"); if (panel) { panel.open = true; panel.scrollIntoView({ block: "start" }); panel.querySelector("summary")?.focus({ preventScroll: true }); } }}>Entender</button>}<button className="sc-primary" onClick={onNext} disabled={busy}>Próxima<ArrowRight size={18} aria-hidden="true" /></button></>
        : <><button className="sc-text-button sc-skip" onClick={onSkip} disabled={busy || paused}>Pular</button><span className="sc-selection-note">{selected === null ? "Escolha uma alternativa" : `Alternativa ${String.fromCharCode(65 + selected)} selecionada`}</span><button className="sc-primary" onClick={() => selected !== null && onAnswer(selected)} disabled={selected === null || busy || paused}>{busy ? "Salvando…" : "Responder"}<ArrowRight size={18} aria-hidden="true" /></button></>}
    </div>
    <ImageZoom src={zoom} onClose={() => setZoom(null)} />
  </section>;
}
