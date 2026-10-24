"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";
import { scrollRequest, ScrollRequestError } from "@/lib/scroll/client";
import type { Explanation, Question } from "@/lib/questions";
import { ImageZoom, QuestionMarkdown } from "./question-content";

export function ExplanationPanel({ question, selected, correctIndex }: { question: Question; selected: number | null; correctIndex: number | null }) {
  const { client } = useAuth();
  const [content, setContent] = useState<Explanation | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const load = async () => {
    if (!client || loading || loaded) return;
    setLoading(true); setError(""); setNeedsLogin(false);
    try { setContent(await scrollRequest<Explanation | null>(client, `view=explanation&questionId=${question.id}`)); setLoaded(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar a resolução."); setNeedsLogin(e instanceof ScrollRequestError && e.status === 401); }
    finally { setLoading(false); }
  };
  return <>
    {question.hasExplanation ? <details className="learn-explanation" onToggle={e => { if (e.currentTarget.open) void load(); }}><summary>Entender esta questão</summary><div className="learn-explanation-body" aria-busy={loading}>
      <p>Explicação da plataforma · Gabarito oficial: INEP{content && ` · versão ${content.version}`}</p>
      {loading && <p role="status">Carregando a resolução…</p>}
      {error && <div role="alert"><p>{error}</p>{needsLogin ? <Link className="sc-text-button" href="/entrar?next=%2Fscrolla">Entrar novamente</Link> : <button className="sc-text-button" onClick={() => void load()}>Tentar novamente</button>}</div>}
      {loaded && !content && <p>A explicação está em revisão. O gabarito oficial continua disponível.</p>}
      {content && <><QuestionMarkdown onZoom={setZoom}>{content.summary}</QuestionMarkdown><details><summary>Ver resolução em passos</summary><ol>{content.steps.map((step, i) => <li key={i}><QuestionMarkdown onZoom={setZoom}>{step}</QuestionMarkdown></li>)}</ol></details><details><summary>Por que cada alternativa?</summary>{question.alternatives.map((a, i) => <div key={a.letter} className={`learn-explanation-alternative${selected === i ? " selected" : ""}`}><strong>{a.letter}</strong><div>{selected === i && <small>Sua escolha{selected === correctIndex ? " · correta" : ""}</small>}{correctIndex === i && selected !== i && <small>Alternativa correta</small>}<QuestionMarkdown onZoom={setZoom}>{content.alternatives[a.letter]}</QuestionMarkdown></div></div>)}</details></>}
    </div></details> : <p className="learn-fine">Explicação em preparação. Confira a alternativa correta e volte a praticar depois.</p>}
    <ContentReport questionId={question.id} version={content?.version ?? null} />
    <ImageZoom src={zoom} onClose={() => setZoom(null)} />
  </>;
}

function ContentReport({ questionId, version }: { questionId: string; version: number | null }) {
  const { client } = useAuth();
  const [category, setCategory] = useState("explanation");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  return <details className="learn-report"><summary>Reportar problema</summary>{sent ? <p role="status">Relato recebido. Obrigado por ajudar a melhorar o conteúdo.</p> : <form onSubmit={async e => {
    e.preventDefault(); if (!client || busy) return;
    setBusy(true); setError("");
    try { await scrollRequest(client, { action: "report", questionId, version, category, message: text }); setSent(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível enviar. Seu texto foi mantido."); }
    finally { setBusy(false); }
  }}><label>Onde está o problema?<select value={category} onChange={e => setCategory(e.target.value)} disabled={busy}><option value="explanation">Explicação</option><option value="answer">Gabarito</option><option value="image">Imagem</option><option value="other">Outro</option></select></label><label>Descreva o que encontrou<textarea minLength={10} maxLength={1000} required value={text} onChange={e => setText(e.target.value)} disabled={busy} /></label>{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? "Enviando…" : "Enviar relato"}</button></form>}</details>;
}
