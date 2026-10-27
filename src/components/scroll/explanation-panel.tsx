"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { scrollRequest, ScrollRequestError } from "@/lib/scroll/client";
import type { Explanation, Question } from "@/lib/questions";
import { ImageZoom, QuestionMarkdown } from "./question-content";
import { externalResolution } from "@/lib/scroll/external-resolution";

let externalLinks: Promise<Record<string, string>> | null = null;
function loadExternalLinks() {
  externalLinks ??= fetch("/data/scroll-resolutions.json").then(async response => {
    if (!response.ok) throw new Error("Catálogo indisponível");
    const data = await response.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Catálogo inválido");
    return data as Record<string, string>;
  }).catch(error => { externalLinks = null; throw error; });
  return externalLinks;
}

export function useExternalResolution(question: Question, enabled = true) {
  const [href, setHref] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadExternalLinks().then(data => { if (active) setHref(externalResolution(question, data)); }).catch(() => { if (active) setHref(null); });
    return () => { active = false; };
  }, [question, enabled]);
  return enabled ? href : null;
}

export function ExternalResolutionLink({ href, compact = false }: { href: string; compact?: boolean }) {
  return <a className={`sc-text-button sc-external-link${compact ? " sc-understand" : ""}`} href={href} target="_blank" rel="noopener noreferrer" aria-label="Ver resolução na Plataforma Assaad (nova aba)">{compact ? "Ver resolução" : "Ver resolução na Plataforma Assaad"}<ExternalLink size={15} aria-hidden="true" /><span className="sr-only"> (nova aba)</span></a>;
}

export function ExplanationPanel({ question, selected, correctIndex }: { question: Question; selected: number | null; correctIndex: number | null }) {
  const { client } = useAuth();
  const external = useExternalResolution(question);
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
    {external && <aside className="sc-external-resolution" aria-label="Resolução externa"><span className="sc-eyebrow">CONTINUE ENTENDENDO</span><strong>Outra forma de olhar para esta questão.</strong><p>Leia a resolução original na Plataforma Assaad. O conteúdo abre em outro site; o gabarito oficial continua sendo o do INEP.</p><ExternalResolutionLink href={external} /></aside>}
    {question.hasExplanation ? <details className="learn-explanation" onToggle={e => { if (e.currentTarget.open) void load(); }}><summary>Entender esta questão</summary><div className="learn-explanation-body" aria-busy={loading}>
      <p>Explicação da plataforma · Gabarito oficial: INEP{content && ` · versão ${content.version}`}</p>
      {loading && <p role="status">Carregando a resolução…</p>}
      {error && <div role="alert"><p>{error}</p>{needsLogin ? <Link className="sc-text-button" href="/entrar?next=%2Fscrolla">Entrar novamente</Link> : <button className="sc-text-button" onClick={() => void load()}>Tentar novamente</button>}</div>}
      {loaded && !content && <p>A explicação está em revisão. O gabarito oficial continua disponível.</p>}
      {content && <><QuestionMarkdown onZoom={setZoom}>{content.summary}</QuestionMarkdown><details><summary>Ver resolução em passos</summary><ol>{content.steps.map((step, i) => <li key={i}><QuestionMarkdown onZoom={setZoom}>{step}</QuestionMarkdown></li>)}</ol></details><details><summary>Por que cada alternativa?</summary>{question.alternatives.map((a, i) => <div key={a.letter} className={`learn-explanation-alternative${selected === i ? " selected" : ""}`}><strong>{a.letter}</strong><div>{selected === i && <small>Sua escolha{selected === correctIndex ? " · correta" : ""}</small>}{correctIndex === i && selected !== i && <small>Alternativa correta</small>}<QuestionMarkdown onZoom={setZoom}>{content.alternatives[a.letter]}</QuestionMarkdown></div></div>)}</details></>}
    </div></details> : external === null && <p className="learn-fine">Ainda não há explicação publicada aqui para esta questão. Confira o gabarito e salve nos favoritos para voltar depois.</p>}
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
