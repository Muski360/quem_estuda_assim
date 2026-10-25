"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Flame, Layers, Pause, Play, RotateCcw, Sparkles, Target, X, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { SoundToggle, useStudySound } from "@/components/study-feedback";
import { ReadingImage } from "./reading-image";
import { READING_CATALOG, TRACKS, applicationById, conceptById, itemId } from "@/lib/reading/catalog";
import { applicationChoices, applicationPosition, applicationPrompt, conceptState, createSession, currentApplication, dueConcepts, flipCard, nextStage, stableShuffle, stageKind } from "@/lib/reading/engine";
import { readingRequest } from "@/lib/reading/client";
import type { ReadingAttempt, ReadingConcept, ReadingEvent, ReadingExample, ReadingSession, ReadingTrack } from "@/lib/reading/types";
import { useReading } from "./use-reading";

type View = "home" | "play" | "progress" | "guide";
export function ReadingGame() {
  const { user } = useAuth();
  return <ReadingWorkspace key={user?.id ?? "guest"} />;
}

function Source({ example }: { example: ReadingExample }) {
  const source = READING_CATALOG.sources[example.source ?? "autoral"];
  return <div className="le-source"><span>{source.author} · {source.title}</span>{example.source && <><a href={source.url} target="_blank" rel="noopener noreferrer">Ver fonte<span className="sr-only"> (abre em nova aba)</span><ChevronRight size={13} aria-hidden="true" /></a><details><summary>Créditos e uso</summary><p>{source.rights}. {source.note}</p></details></>}</div>;
}
function ConceptGuide({ concept, onRead }: { concept: ReadingConcept; onRead: () => void }) {
  return <details className="le-guide-item" onToggle={event => { if (event.currentTarget.open) onRead(); }}><summary><span><small>{concept.period}</small><strong>{concept.label}</strong></span><BookOpen size={19} aria-hidden="true" /></summary><div className="le-guide-body"><p>{concept.description}</p>{concept.aliases.length > 0 && <p className="le-muted">Também: {concept.aliases.join(" · ")}</p>}<h3>Onde olhar</h3><ul>{concept.clues.map(clue => <li key={clue}>{clue}</li>)}</ul><blockquote>{concept.examples[0].text}</blockquote><p>{concept.examples[0].reason}</p><Source example={concept.examples[0]} /><h3>Para não confundir</h3><p>{concept.confusion}</p></div></details>;
}

function ReadingWorkspace() {
  const { user, client } = useAuth();
  const reading = useReading();
  const { local, snapshot, ready, update } = reading;
  const [view, setView] = useState<View>("home"), [focus, setFocus] = useState<string | undefined>();
  const [guideId, setGuideId] = useState<string | null>(null), [notice, setNotice] = useState("");
  const [history, setHistory] = useState<ReadingAttempt[]>([]), [historyNext, setHistoryNext] = useState<number | null>(0), [historyError, setHistoryError] = useState("");
  const [historyBusy, setHistoryBusy] = useState(false);
  const [guestHistoryLimit, setGuestHistoryLimit] = useState(40);
  const { play } = useStudySound();
  const heading = useRef<HTMLHeadingElement>(null), guidePanel = useRef<HTMLDivElement>(null), activeMs = useRef(0), lastInteraction = useRef(0), lastTick = useRef(0);
  const session = local.session, kind = session ? stageKind(session) : "done";
  const due = dueConcepts(snapshot);
  const available = READING_CATALOG.concepts.filter(c => local.track === "mixed" || c.track === local.track);
  const current = session && kind === "application" ? currentApplication(session) : null;
  const answered = session && current ? session.answers.find(a => a.itemId === session.applications[applicationPosition(session)]) : null;
  const finished = !!session && kind === "done";

  useEffect(() => {
    if (ready && new URLSearchParams(window.location.search).get("view") === "progress") void Promise.resolve().then(() => setView("progress"));
  }, [ready]);
  useEffect(() => {
    if (view !== "progress" || !client) return;
    let active = true;
    readingRequest<{ items: ReadingAttempt[]; next: number | null }>(client, "view=history&offset=0").then(result => {
      if (active) { setHistory(result.items); setHistoryNext(result.next); setHistoryError(""); }
    }).catch(error => { if (active) setHistoryError(error instanceof Error ? error.message : "Não foi possível abrir o histórico."); });
    return () => { active = false; };
  }, [view, client]);
  useEffect(() => {
    if (view === "play") heading.current?.focus();
  }, [view, session?.stage, session?.id]);
  useEffect(() => {
    if (!guideId) return;
    guidePanel.current?.focus();
    return () => { document.querySelector<HTMLButtonElement>(".le-application-actions > button")?.focus(); };
  }, [guideId]);
  useEffect(() => {
    const activity = () => { lastInteraction.current = performance.now(); };
    const visibility = () => { lastTick.current = performance.now(); if (!document.hidden) activity(); };
    lastTick.current = performance.now(); activity();
    window.addEventListener("pointerdown", activity); window.addEventListener("keydown", activity); window.addEventListener("scroll", activity, { passive: true }); document.addEventListener("visibilitychange", visibility);
    const timer = setInterval(() => {
      const now = performance.now();
      if (!document.hidden && view === "play" && kind === "application" && !answered && !guideId) activeMs.current += Math.max(0, Math.min(now, lastInteraction.current + 60000) - lastTick.current);
      lastTick.current = now;
    }, 1000);
    return () => { clearInterval(timer); window.removeEventListener("pointerdown", activity); window.removeEventListener("keydown", activity); window.removeEventListener("scroll", activity); document.removeEventListener("visibilitychange", visibility); };
  }, [view, kind, answered, guideId]);
  useEffect(() => {
    const target = window as Window & { render_game_to_text?: () => string; advanceTime?: (ms: number) => void };
    target.render_game_to_text = () => JSON.stringify({ interface: "semantic DOM, origin top-left", view, mode: session?.mode, stage: session?.stage, kind, currentItem: current ? session?.applications[applicationPosition(session!)] : null, selected: session?.draft, matched: session?.matched, flipped: session?.flipped, feedback: session?.result ?? (answered ? answered.correct ? "correct" : "incorrect" : null), combo: session?.combo ?? 0, pairs: session?.pairs ?? 0, answered: session?.answers.length ?? 0, pending: local.events.length, xp: snapshot.xp });
    // This turn-based game has no simulation clock or automatic transitions.
    target.advanceTime = () => {};
    return () => { delete target.render_game_to_text; delete target.advanceTime; };
  }, [view, session, kind, current, answered, local.events.length, snapshot.xp]);
  useEffect(() => {
    if (view !== "play" || kind !== "application" || answered || !session) return;
    const persistTime = () => {
      const pendingActiveMs = Math.min(7200000, (session.pendingActiveMs ?? 0) + Math.round(activeMs.current));
      update({ ...local, session: { ...session, pendingActiveMs } }); activeMs.current = 0;
    };
    window.addEventListener("pagehide", persistTime);
    return () => window.removeEventListener("pagehide", persistTime);
  }, [view, kind, answered, session, local, update]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 3500); return () => clearTimeout(timer);
  }, [notice]);

  const saveSession = (next: ReadingSession, events: ReadingEvent[] = []) => update({ ...local, session: next }, events);
  function event(kind: ReadingEvent["kind"], conceptId: string, id: string): ReadingEvent {
    return { id: crypto.randomUUID(), kind, conceptId, itemId: id, version: READING_CATALOG.version, occurredAt: new Date().toISOString(), assisted: !!session?.assisted.includes(conceptId), review: session?.mode === "review", activeMs: kind === "exposure" ? 0 : Math.min(7200000, (session?.pendingActiveMs ?? 0) + Math.round(activeMs.current)) };
  }
  function start(review = false, selectedFocus = focus) {
    activeMs.current = 0; setGuideId(null);
    const next = createSession(snapshot, review ? "mixed" : local.track, review ? undefined : selectedFocus, review);
    update({ ...local, session: next }); setView("play"); play("next");
  }
  function advance() {
    if (!session) return;
    activeMs.current = 0; setGuideId(null);
    const next = nextStage(session); saveSession(next); play(stageKind(next) === "done" ? "complete" : "next");
    if (stageKind(next) === "done") setNotice("Mais uma leitura que ficou com você.");
  }
  function flip(group: 0 | 1, id: string) {
    if (!session) return;
    const next = flipCard(session, group, id); if (next === session) return;
    const index = session.conceptIds.indexOf(id), round = session.stage === 0 ? 0 : 1;
    saveSession(next, group === 1 ? [event("exposure", id, itemId(id, "p", session.exampleIndexes[round][index]))] : []);
    if (next.result) play(next.result === "match" ? next.combo >= 3 ? "combo" : "correct" : "incorrect");
  }
  function continueMemory() {
    if (!session) return;
    if (session.matched.length === 3) { advance(); return; }
    saveSession({ ...session, flipped: [null, null], result: null });
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".le-card:not(:disabled)")?.focus());
  }
  function answer(skip = false) {
    if (!session || !current || answered || !skip && (!session.draft.choice || session.draft.evidence === null)) return;
    const id = session.applications[applicationPosition(session)];
    const e = { ...event(skip ? "skip" : "answer", current.concept.id, id), choice: session.draft.choice ?? undefined, evidence: session.draft.evidence ?? undefined };
    const conceptCorrect = !skip && e.choice === current.concept.id, evidenceCorrect = !skip && e.evidence === 0, correct = conceptCorrect && evidenceCorrect;
    const xp = user && correct && !e.assisted && !e.review && !snapshot.first[id] ? 10 : 0;
    const combo = correct ? session.combo + 1 : 0;
    const next = { ...session, applications: [...session.applications], pendingActiveMs: 0, combo, bestCombo: Math.max(combo, session.bestCombo), answers: [...session.answers, { eventId: e.id, itemId: id, correct, conceptCorrect, evidenceCorrect, xp, skipped: skip, assisted: e.assisted }] };
    // The fourth application revisits a weak concept while the first three cover all selected concepts.
    if (next.answers.length <= 2 && !correct) {
      const replacement = current.concept.applications.map((_, n) => itemId(current.concept.id, "a", n)).find(candidate => !next.applications.slice(0, 3).includes(candidate));
      if (replacement) next.applications[3] = replacement;
    }
    saveSession(next, [e]); activeMs.current = 0;
    play(skip ? "next" : correct ? "correct" : "incorrect");
  }
  function readGuide(id: string) {
    const e = { ...event("exposure", id, `guide:${id}`), assisted: true };
    const activeConcept = session && stageKind(session) === "application" ? currentApplication(session)?.concept.id : undefined;
    update({ ...local, session: session ? { ...session, assisted: [...new Set([...session.assisted, id, ...(activeConcept ? [activeConcept] : [])])] } : null }, [e]);
  }
  async function loadHistory(reset = false) {
    if (!client || historyBusy || !reset && historyNext === null) return;
    setHistoryBusy(true);
    try {
      const result = await readingRequest<{ items: ReadingAttempt[]; next: number | null }>(client, `view=history&offset=${reset ? 0 : historyNext ?? 0}`);
      setHistory(previous => reset ? result.items : [...previous, ...result.items]); setHistoryNext(result.next); setHistoryError("");
    } catch (error) { setHistoryError(error instanceof Error ? error.message : "Não foi possível abrir o histórico."); }
    finally { setHistoryBusy(false); }
  }
  function navigate(next: View) {
    if (view === "play" && kind === "application" && !answered && session) {
      saveSession({ ...session, pendingActiveMs: Math.min(7200000, (session.pendingActiveMs ?? 0) + Math.round(activeMs.current)) }); activeMs.current = 0;
    }
    setGuideId(null); setView(next);
  }

  if (!ready) return <main id="conteudo" className="le-shell"><p className="le-loading" role="status">Preparando seu treino de leitura…</p></main>;
  return <main id="conteudo" className={`le-shell ${view === "play" ? "le-playing" : ""}`}>
    <div className="le-top"><Link href="/" className="le-back"><ArrowLeft size={15} aria-hidden="true" />Início</Link><span className="le-module"><BookOpen size={16} aria-hidden="true" />Quem lê assim?</span><SoundToggle /></div>
    <nav className="le-tabs" aria-label="Quem Lê Assim"><button aria-current={view === "home" || view === "play" ? "page" : undefined} onClick={() => navigate("home")}>Jogar</button><button aria-current={view === "progress" ? "page" : undefined} onClick={() => navigate("progress")}>Meu progresso</button><button aria-current={view === "guide" ? "page" : undefined} onClick={() => navigate("guide")}>Guia de leitura</button><span className="le-save-status" role="status">{user ? reading.saving ? "Sincronizando…" : local.events.length || local.sessionPending ? "Guardado neste navegador" : "Na sua conta" : "Neste navegador"}</span></nav>
    {(reading.error || reading.storageError) && <div className="le-sync" role="status"><p>{reading.error || reading.storageError}</p>{user && <><button onClick={() => void reading.sync()} disabled={reading.saving}><RotateCcw size={15} aria-hidden="true" />Sincronizar</button><Link href="/entrar?next=%2Fle">Entrar novamente</Link></>}</div>}
    {reading.guest && user && <div className="le-import"><div><strong>Seu estudo de visitante também pode vir.</strong><p>Trazer histórico e revisões deste navegador. Sem XP retroativo.</p></div><button className="button button-primary" disabled={reading.saving} onClick={() => void reading.importGuest()}>Trazer meu estudo</button><button className="le-text-button" onClick={reading.dismissGuest}>Agora não</button></div>}

    {view === "home" && <>
      <section className="le-hero" aria-labelledby="le-title"><div><p className="le-kicker">MEMÓRIA, TEXTO E DESCOBERTA</p><h1 id="le-title">Uma pista.<br />Uma conexão.<br /><em>Agora faz sentido.</em></h1><p className="le-intro">Vire as cartas, reconheça o estilo e descubra o porquê em um texto novo.</p><div className="le-hero-actions">{session && !finished ? <button className="button button-primary" onClick={() => setView("play")}><Play size={18} aria-hidden="true" />Continuar minha partida</button> : <button className="button button-primary" onClick={() => start()}><Play size={18} aria-hidden="true" />Começar meu treino</button>}<span>4–6 min · no seu ritmo</span></div><p className="le-access-note">Aberto para todo mundo. {user ? "Seu progresso acompanha sua conta." : "Seu estudo fica salvo neste navegador."}</p></div><div className="le-hero-art" aria-hidden="true"><div className="le-print-card"><span>01 / O CONCEITO</span><BookOpen size={29} /><strong>Repertório<span>Uma pista muda<br />o jeito de ler.</span></strong><i>linguagem em construção</i></div><div className="le-quote-card"><span>02 / A PISTA</span><p>“Entre uma linha<br />e outra,<br /><em>o mundo cabe.</em>”</p><div><span className="le-art-check">✓</span> Uma imagem. Outro sentido.</div></div><span className="le-art-note">Encontrar o par é o começo.</span></div></section>
      <section className="le-start" aria-labelledby="le-track-title"><div className="le-section-heading"><div><p className="le-kicker">ESCOLHA POR ONDE COMEÇAR</p><h2 id="le-track-title">O que você quer reconhecer?</h2></div><span>30 conceitos · 180 atividades</span></div><div className="le-track-options" role="group" aria-label="Trilha de estudo">{Object.entries(TRACKS).map(([id, label]) => <button key={id} className={local.track === id ? "selected" : ""} aria-pressed={local.track === id} onClick={() => { update({ ...local, track: id as ReadingTrack | "mixed" }); setFocus(undefined); }}><span>{id === "functions" ? "01" : id === "literature" ? "02" : id === "avant-garde" ? "03" : "+"}</span><strong>{label}</strong><small>{id === "functions" ? "O efeito de cada mensagem" : id === "literature" ? "Vozes, épocas e escolhas" : id === "avant-garde" ? "Outros modos de ver" : "Conexões entre os temas"}</small></button>)}</div><div className="le-focus-row"><label htmlFor="le-focus">Concentrar em um conceito</label><select id="le-focus" value={focus ?? ""} onChange={e => setFocus(e.target.value || undefined)}><option value="">Deixe o jogo escolher</option>{available.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select><button className="button button-primary" onClick={() => start()}>Nova partida<ArrowRight size={17} aria-hidden="true" /></button></div>{focus && <p className="le-muted le-focus-note">Você vai comparar {conceptById(focus)?.label} com {conceptById(focus)?.contrasts.slice(0, 2).map(id => conceptById(id)?.label).join(" e ")}. A comparação ajuda a perceber a diferença.</p>}</section>
      <div className="le-home-bottom"><div><RotateCcw size={23} aria-hidden="true" /><div><h2>{due.length ? `${due.length} conceitos para rever` : "A memória ganha outra chance."}</h2><p>{due.length ? "Comece pela interpretação, antes de rever as pistas." : "As revisões voltam no tempo certo, com exemplos diferentes."}</p></div><button className="le-text-button" onClick={() => due.length ? start(true, undefined) : navigate("progress")}>{due.length ? "Fazer revisão" : "Ver meu progresso"}<ArrowRight size={16} aria-hidden="true" /></button></div><p><Layers size={18} aria-hidden="true" />Dois tabuleiros de três pares.<br />Quatro interpretações para testar o que ficou.</p></div>
      {local.tutorial && <details className="le-tutorial"><summary>É minha primeira partida. Como funciona?</summary><p>Abra um conceito e um exemplo. Ao encontrar os três pares, use o que aprendeu em textos novos: escolha o conceito e a pista que explica sua leitura. Você pode trocar as escolhas antes de responder e consultar o guia quando precisar.</p><button className="le-text-button" onClick={() => update({ ...local, tutorial: false })}>Entendi, vamos jogar<Check size={16} aria-hidden="true" /></button></details>}
    </>}

    {view === "play" && session && <section className="le-session" aria-labelledby="le-stage-title">
      <div className="le-session-top"><div><span className="le-kicker">{session.mode === "review" ? "REVISÃO · SEM XP POR QUESTÃO" : "SUA PARTIDA"}</span><div className="le-path">{session.conceptIds.map(id => <span key={id}>{conceptById(id)?.label}</span>)}</div></div><div className="le-session-controls"><button className="le-text-button" onClick={() => navigate("home")}><Pause size={16} aria-hidden="true" />Pausar</button>{!finished && <button className="le-text-button" onClick={() => { saveSession({ ...session, finishedAt: new Date().toISOString() }); play("complete"); }}>Encerrar</button>}</div></div>
      {!finished && <><div className="le-hud"><span><Flame size={16} aria-hidden="true" /><strong>{session.combo}</strong> em sequência</span><progress aria-label="Etapas da partida" value={session.stage} max={session.mode === "review" ? 4 : 6} /><span><Zap size={15} aria-hidden="true" /><strong>{session.answers.reduce((n, a) => n + a.xp, 0)}</strong> XP {user && reading.saving ? "a sincronizar" : "na partida"}</span></div>
      <div className="le-stage-heading"><p className="le-kicker">{kind === "memory" ? `${session.stage === 0 ? "01" : "02"} / ENCONTRE AS CONEXÕES` : `${applicationPosition(session) + 1} DE 4 / AGORA, EM OUTRO EXEMPLO`}</p><h1 id="le-stage-title" ref={heading} tabIndex={-1}>{kind === "memory" ? "Qual ideia mora neste exemplo?" : "O que o texto deixa como pista?"}</h1><p>{kind === "memory" ? "Abra um conceito e um exemplo. Forme os três pares." : "Escolha o conceito e a evidência que sustenta sua leitura."}</p></div>
      {kind === "memory" && <div className="le-memory-stage" key={`board:${session.id}:${session.stage}`}><div className="le-board">{([0, 1] as const).map(group => <div key={group} className="le-card-column"><h2>{group === 0 ? "Conceitos" : "Exemplos"}<span>{group === 0 ? "O que você reconhece" : "Onde você reconhece"}</span></h2>{stableShuffle(session.conceptIds, `${session.id}:${session.stage}:${group}`).map((id, n) => {
        const concept = conceptById(id)!, selected = session.flipped[group] === id, matched = session.matched.includes(id), open = selected || matched;
        const index = session.conceptIds.indexOf(id), example = concept.examples[session.exampleIndexes[session.stage === 0 ? 0 : 1][index]];
        return <button key={`${group}:${id}`} className={`le-card ${group === 0 ? "le-concept-card" : "le-example-card"} ${open ? "is-open" : ""} ${matched ? "is-matched" : ""}`} aria-label={open ? `${group === 0 ? concept.label : example.text}${matched ? ", par encontrado" : ""}` : `${group === 0 ? "Conceito" : "Exemplo"} ${n + 1}, virar carta`} aria-pressed={open} disabled={matched || !!session.result} onClick={() => flip(group, id)}><span className="le-card-meta">{String(n + 1).padStart(2, "0")} {matched && <Check size={18} aria-hidden="true" />}</span>{open ? group === 0 ? <><strong>{concept.label}</strong>{concept.aliases.length > 0 && <small>{concept.aliases.join(" · ")}</small>}</> : <>{example.image && <Image src={example.image} alt={example.alt ?? example.text} width={800} height={800} unoptimized className="le-card-image" />}<span className="le-card-excerpt">{example.text}</span></> : <><span className="le-card-symbol" aria-hidden="true">{group === 0 ? "Aa" : "“ ”"}</span><span className="le-card-back-copy">{group === 0 ? "Uma ideia" : "Uma pista"}</span></>}</button>;
      })}</div>)}</div>
      {session.flipped[1] && (() => { const id = session.flipped[1]!, c = conceptById(id)!, ex = c.examples[session.exampleIndexes[session.stage === 0 ? 0 : 1][session.conceptIds.indexOf(id)]]; return <div className="le-memory-zoom">{ex.image && <ReadingImage src={ex.image} alt={ex.alt ?? ex.text} />}<Source example={ex} /></div>; })()}
      <div className={`le-memory-feedback ${session.result ?? ""}`} aria-live="polite">{session.result === "match" ? <><div><Check size={22} aria-hidden="true" /><strong>Conexão encontrada.</strong><p>{conceptById(session.flipped[0]!)?.examples[session.exampleIndexes[session.stage === 0 ? 0 : 1][session.conceptIds.indexOf(session.flipped[0]!)]].reason}</p></div><button className="button button-primary" onClick={continueMemory}>{session.matched.length === 3 ? "Aplicar em outro texto" : "Buscar o próximo par"}<ArrowRight size={17} aria-hidden="true" /></button></> : session.result === "miss" ? <><div><X size={20} aria-hidden="true" /><strong>Essa conexão ainda não fechou.</strong><p>Compare o que leu e tente outra associação.</p></div><button className="button button-primary" onClick={continueMemory}>Tentar outro par<RotateCcw size={16} aria-hidden="true" /></button></> : <p>{session.matched.length} de 3 conexões encontradas. O texto fica aberto pelo tempo que você precisar.</p>}</div></div>}
      {kind === "application" && current && <div className="le-application" key={`application:${session.id}:${session.stage}`}><div className="le-reading-paper"><p className="le-kicker">LEIA COM ATENÇÃO</p>{current.application.image && <ReadingImage src={current.application.image} alt={current.application.alt ?? current.application.text} />}<blockquote>{current.application.text}</blockquote><Source example={current.application} /></div><fieldset className="le-choices" disabled={!!answered}><legend><span>01</span> {applicationPrompt(current.concept)}</legend>{stableShuffle(applicationChoices(session, current.concept), `${session.id}:${session.stage}:concepts`).map(id => <label key={id} className={`${session.draft.choice === id ? "selected" : ""} ${answered && id === current.concept.id ? "correct" : ""}`}><input type="radio" name="le-concept" checked={session.draft.choice === id} onChange={() => saveSession({ ...session, draft: { ...session.draft, choice: id } })} /><span>{conceptById(id)?.label}</span>{answered && id === current.concept.id && <Check size={17} aria-label="Conceito correto" />}</label>)}</fieldset><fieldset className="le-choices" disabled={!!answered}><legend><span>02</span> O que sustenta essa leitura?</legend>{stableShuffle([0, 1, 2], `${session.id}:${session.stage}:evidence`).map(n => <label key={n} className={`${session.draft.evidence === n ? "selected" : ""} ${answered && n === 0 ? "correct" : ""}`}><input type="radio" name="le-evidence" checked={session.draft.evidence === n} onChange={() => saveSession({ ...session, draft: { ...session.draft, evidence: n } })} /><span>{n === 0 ? current.application.evidence : current.application.distractors[n - 1].text}</span>{answered && n === 0 && <Check size={17} aria-label="Evidência correta" />}</label>)}</fieldset>
      {answered && <div className={`le-answer-feedback ${answered.correct ? "correct" : ""}`} role="status"><div>{answered.correct ? <Check size={24} aria-hidden="true" /> : <Target size={24} aria-hidden="true" />}<h2>{answered.skipped ? "Uma pista para a próxima leitura." : answered.correct ? "Você encontrou o conceito e a pista." : answered.conceptCorrect ? "O conceito veio. Vamos afinar a pista." : answered.evidenceCorrect ? "Você viu a pista. Agora conecte o conceito." : "Agora dá para enxergar a conexão."}</h2></div><p><strong>{current.concept.label}.</strong> {current.application.reason}</p>{!answered.skipped && session.draft.evidence !== null && session.draft.evidence > 0 && <p><strong>Sobre a pista que você escolheu:</strong> {current.application.distractors[session.draft.evidence - 1].why}</p>}{!answered.skipped && !answered.conceptCorrect && <p>{current.concept.confusion}</p>}<p className="le-reward-note">{answered.assisted ? "Treino com guia: vale aprendizado, sem XP." : session.mode === "review" ? "Revisão: seu calendário é atualizado, sem XP por questão." : answered.xp ? `+${answered.xp} XP${local.events.some(e => e.id === answered.eventId) ? " a sincronizar" : ""}.` : !user ? "Estudo salvo neste navegador. O XP do perfil começa com a conta." : "Esta aplicação não gerou XP. Só a primeira resposta completa, sem ajuda, vale pontos."}</p><details><summary>Compare as outras pistas</summary>{current.application.distractors.map(d => <p key={d.text}><strong>{d.text}</strong><br />{d.why}</p>)}</details></div>}
      <div className="le-application-actions"><button className="le-text-button" onClick={() => { readGuide(current.concept.id); setGuideId(current.concept.id); }}><BookOpen size={17} aria-hidden="true" />{answered ? "Rever conceito" : "Consultar guia · sem XP"}</button>{answered ? <button className="button button-primary" onClick={advance}>{applicationPosition(session) === 3 ? "Ver meu resultado" : "Continuar"}<ArrowRight size={18} aria-hidden="true" /></button> : <div><button className="le-text-button" onClick={() => answer(true)}>Pular</button><button className="button button-primary" disabled={!session.draft.choice || session.draft.evidence === null} onClick={() => answer()}>Responder<ArrowRight size={18} aria-hidden="true" /></button></div>}</div></div>}
      </>}
      {finished && <div className="le-result"><span className="le-result-mark"><Sparkles size={35} aria-hidden="true" /></span><p className="le-kicker">LEITURA QUE VIRA REPERTÓRIO</p><h1 id="le-stage-title" ref={heading} tabIndex={-1}>{session.answers.some(a => a.correct) ? "Agora você tem\nmais onde olhar." : "Toda conexão\ncomeça com uma pista."}</h1><p>Você encontrou {session.pairs} pares e concluiu {session.answers.filter(a => !a.skipped).length} aplicações.</p><dl className="le-result-stats"><div><dt>Conceitos reconhecidos</dt><dd>{session.answers.filter(a => a.conceptCorrect).length}<small>/{session.answers.length}</small></dd></div><div><dt>Leituras completas</dt><dd>{session.answers.filter(a => a.correct).length}<small>/{session.answers.length}</small></dd></div><div><dt>XP da partida</dt><dd>{session.answers.reduce((n, a) => n + a.xp, 0)}<Zap size={18} aria-hidden="true" /></dd></div></dl><div className="le-result-topics">{session.conceptIds.map(id => <div key={id}><span>{conceptById(id)?.label}</span><strong>{conceptState(snapshot.concepts[id])}</strong></div>)}</div>{session.answers.some(a => !a.correct) && <p className="le-result-next">Sua próxima leitura pode começar pelo que ainda ficou confuso.</p>}<div className="le-result-actions">{session.answers.some(a => !a.correct) && <button className="button button-primary" onClick={() => { const weak = session.answers.find(a => !a.correct); start(false, weak ? currentConceptId(weak.itemId) : undefined); }}>Revisar minha dificuldade<RotateCcw size={17} aria-hidden="true" /></button>}<button className={`button ${session.answers.some(a => !a.correct) ? "le-secondary" : "button-primary"}`} onClick={() => start(false, undefined)}>Outra partida<ArrowRight size={17} aria-hidden="true" /></button></div><Link href="/scrolla" className="le-scroll-link">Praticar questões oficiais no Scroll<BookOpen size={17} aria-hidden="true" /></Link>{!user && <p className="le-access-note">O Scroll pede login. Você pode continuar jogando aqui sem conta.</p>}<button className="le-text-button" onClick={() => navigate("progress")}>Ver meu progresso<ArrowRight size={16} aria-hidden="true" /></button></div>}
    </section>}

    {view === "progress" && <section className="le-progress" aria-labelledby="le-progress-title"><div className="le-section-heading"><div><p className="le-kicker">O QUE ESTÁ FICANDO COM VOCÊ</p><h1 id="le-progress-title">Meu repertório.</h1></div>{due.length > 0 && <button className="button button-primary" onClick={() => start(true, undefined)}><RotateCcw size={17} aria-hidden="true" />Rever {due.length} conceitos</button>}</div><dl className="le-progress-numbers"><div><dt>Aplicações respondidas</dt><dd>{snapshot.answered}</dd></div><div><dt>Precisão na primeira resposta</dt><dd>{snapshot.answered ? Math.round(snapshot.correct / snapshot.answered * 100) : 0}<small>%</small></dd></div><div><dt>Conceitos retidos</dt><dd>{Object.values(snapshot.concepts).filter(c => c.retained).length}<small>/30</small></dd></div><div><dt>XP do Lê</dt><dd>{snapshot.xp}</dd></div></dl><p className="le-progress-explanation">Visto: você estudou. Aplicado: conceito e pista corretos em dois exemplos distintos, sem ajuda. Retido: também acertou uma revisão devida depois de sete dias sem exposição. Errar depois reabre o treino.</p><div className="le-album">{Object.entries(TRACKS).filter(([id]) => id !== "mixed").map(([id, label]) => <section key={id}><div className="le-section-heading"><h2>{label}</h2><span>{READING_CATALOG.concepts.filter(c => c.track === id && snapshot.concepts[c.id]?.seen).length}/{READING_CATALOG.concepts.filter(c => c.track === id).length} vistos</span></div><div className="le-album-grid">{READING_CATALOG.concepts.filter(c => c.track === id).map(c => { const p = snapshot.concepts[c.id]; return <div key={c.id} className={`le-album-item ${p?.seen ? "discovered" : ""}`}><span className="le-kicker">{conceptState(p)}</span><h3>{c.label}</h3><div className="le-album-dots" aria-label={`${p?.applied.length ?? 0} aplicações distintas completas`}>{[0, 1, 2].map(n => <i key={n} className={(p?.applied.length ?? 0) > n ? "filled" : ""} />)}</div><p>{p?.due ? `${due.includes(c.id) ? "Revisão disponível" : "Próxima revisão"} · ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(`${p.due}T12:00:00Z`))}` : "Um novo jeito de ler para descobrir."}</p><button className="le-text-button" onClick={() => { setFocus(c.id); update({ ...local, track: c.track }); setView("home"); heading.current?.focus(); }}>Comparar estilos<ArrowRight size={15} aria-hidden="true" /></button></div>; })}</div></section>)}</div><section className="le-history"><div className="le-section-heading"><h2>Seu caminho de leitura</h2>{user && <button className="le-text-button" disabled={historyBusy} onClick={() => void loadHistory(true)}>Atualizar histórico<RotateCcw size={15} aria-hidden="true" /></button>}</div>{historyError && <p role="status">{historyError}</p>}{(user ? history : snapshot.events.filter(e => e.kind === "answer").reverse().slice(0, guestHistoryLimit)).length === 0 ? <p className="le-muted">Suas aplicações confirmadas vão aparecer aqui.</p> : (user ? history : snapshot.events.filter(e => e.kind === "answer").reverse().slice(0, guestHistoryLimit)).map(e => <details key={e.id} className="le-history-item"><summary><span>{e.correct ? <Check size={17} aria-hidden="true" /> : <Target size={17} aria-hidden="true" />}{conceptById(e.conceptId)?.label}<small>{e.imported ? "Importado de visitante" : e.assisted ? "Com guia" : e.review ? "Revisão" : "Aplicação"}</small></span><time dateTime={e.occurredAt}>{new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit" }).format(new Date(e.occurredAt))}</time></summary><div><p>{currentText(e.itemId, e.version)}</p><p><strong>Sua leitura:</strong> {conceptById(e.choice ?? "")?.label ?? "—"}<br /><strong>Sua pista:</strong> {historyEvidence(e)}</p><p><strong>{e.correct ? "Conceito e pista corretos." : e.conceptCorrect ? "Conceito correto; reveja a evidência." : e.evidenceCorrect ? "Pista correta; reveja o conceito." : "Uma conexão para rever."}</strong> {currentReason(e.itemId, e.version)}</p></div></details>)}{(user ? historyNext !== null : snapshot.events.filter(e => e.kind === "answer").length > guestHistoryLimit) && <button className="le-text-button" disabled={historyBusy} onClick={() => user ? void loadHistory() : setGuestHistoryLimit(n => n + 40)}>{historyBusy ? "Carregando…" : "Carregar histórico"}<ArrowRight size={15} aria-hidden="true" /></button>}</section></section>}

    {view === "guide" && <section className="le-guide" aria-labelledby="le-guide-title"><p className="le-kicker">TENHA ONDE VOLTAR</p><h1 id="le-guide-title">Uma lente para cada leitura.</h1><p>Observe os procedimentos e o contexto. Uma palavra isolada raramente conta a história inteira.</p>{Object.entries(TRACKS).filter(([id]) => id !== "mixed").map(([id, label]) => <section key={id}><h2>{label}</h2>{READING_CATALOG.concepts.filter(c => c.track === id).map(c => <ConceptGuide key={c.id} concept={c} onRead={() => readGuide(c.id)} />)}</section>)}</section>}
    {guideId && <div className="le-inline-guide" ref={guidePanel} tabIndex={-1}><button className="le-text-button" onClick={() => setGuideId(null)}><X size={17} aria-hidden="true" />Fechar guia e voltar à leitura</button><h2>{conceptById(guideId)?.label}</h2><p>{conceptById(guideId)?.description}</p><ul>{conceptById(guideId)?.clues.map(clue => <li key={clue}>{clue}</li>)}</ul><p>{conceptById(guideId)?.confusion}</p></div>}
    {notice && <div className="le-toast" role="status"><Sparkles size={18} aria-hidden="true" />{notice}<button aria-label="Fechar celebração" onClick={() => setNotice("")}><X size={16} aria-hidden="true" /></button></div>}
  </main>;
}

function currentConceptId(id: string) { return applicationById(id)?.concept.id; }
function currentText(id: string, version: number) { return applicationById(id, version)?.application.text; }
function currentReason(id: string, version: number) { return applicationById(id, version)?.application.reason; }
function historyEvidence(attempt: ReadingAttempt) {
  const application = applicationById(attempt.itemId, attempt.version)?.application;
  return attempt.evidence === 0 ? application?.evidence : application?.distractors[(attempt.evidence ?? 1) - 1]?.text;
}
