"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, Check, Clock3, Flame, LoaderCircle, Pause, Play, Settings2, Target, Trophy, X, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useStudyProgress } from "@/components/profile/study-progress";
import { AnswerCelebration, SoundToggle, useStudySound } from "@/components/study-feedback";
import { AREAS } from "@/lib/questions";
import { scrollRequest, ScrollRequestError } from "@/lib/scroll/client";
import { DEFAULT_SCROLL_SETTINGS } from "@/lib/scroll/types";
import type { ScrollSession, ScrollSettings, ScrollStats } from "@/lib/scroll/types";
import { QuestionCard } from "./question-card";
import { isStudyImage } from "./question-content";
import { ScrollAccess } from "./scroll-access";
import { isUuid } from "@/lib/scroll/validation";
import { scrollChallenge } from "@/lib/scroll/engagement";
import { ScrollMissions, ScrollMomentum } from "./scroll-momentum";

export const MODE_LABELS = { feed: "Feed de inéditas", session: "Sessão curta", due: "Revisão programada", errors: "Revisão de erros", favorites: "Revisão de favoritos" };
const message = (error: unknown) => error instanceof Error ? error.message : "Não foi possível conectar. Tente novamente.";

export function ScrollFeed() { return <ScrollAccess><ScrollWorkspace /></ScrollAccess>; }

function ScrollWorkspace() {
  const { client, user } = useAuth();
  const { refresh: refreshProfile } = useStudyProgress();
  const { play } = useStudySound();
  const [stats, setStats] = useState<ScrollStats | null>(null);
  const [settings, setSettings] = useState<ScrollSettings>(DEFAULT_SCROLL_SETTINGS);
  const [session, setSession] = useState<ScrollSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [notice, setNotice] = useState("");
  const [reward, setReward] = useState<{ id: string; xp: number; streak: number } | null>(null);
  const [seconds, setSeconds] = useState(0);
  const controls = useRef<HTMLDialogElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const mutationVersion = useRef(0);
  const activeTime = useRef(0);
  const expired = useRef("");
  const retry = useRef<{ action: string; extra: Record<string, unknown> } | null>(null);
  const current = session?.items[0];
  const nextQuestion = session?.items[1]?.question;
  const sessionKey = `qe:scroll-session:${user?.id}`;
  useEffect(() => {
    if (!nextQuestion) return;
    const media = JSON.stringify(nextQuestion).match(/https:\/\/[^\s"()]+\/qe-enem-assets\/[a-f0-9]+\.(?:png|jpe?g|webp)/g) ?? [];
    for (const src of new Set(media)) if (isStudyImage(src)) { const image = new Image(); image.src = src; }
  }, [nextQuestion]);
  const refresh = useCallback(async () => {
    if (client) setStats(await scrollRequest<ScrollStats>(client));
  }, [client]);
  useEffect(() => {
    if (!client) return;
    let active = true;
    async function load() {
      try {
        const loaded = await scrollRequest<ScrollStats>(client!);
        if (!active) return;
        setStats(loaded);
        const params = new URLSearchParams(window.location.search);
        const mode = params.get("mode");
        const override = !!mode || params.has("subject") || params.has("topic") || params.has("explained");
        const configured: ScrollSettings = { ...loaded.settings };
        if (mode && Object.hasOwn(MODE_LABELS, mode)) configured.mode = mode as ScrollSettings["mode"];
        if ([5, 10, 20].includes(Number(params.get("target")))) configured.target = Number(params.get("target")) as ScrollSettings["target"];
        if (params.has("explained")) configured.explanationOnly = params.get("explained") === "1";
        for (const key of ["subject", "topic"] as const) if (params.has(key) && /^[a-z][a-z0-9-]{0,59}$/.test(params.get(key)!)) configured[key] = params.get(key);
        if (override) { configured.timed = false; if (params.has("subject")) configured.area = "all"; }
        if (mode === "due") { configured.area = "all"; configured.year = null; configured.subject = null; configured.topic = null; configured.explanationOnly = false; }
        setSettings(configured);
        let saved: string | null = null;
        try { saved = override ? null : sessionStorage.getItem(sessionKey); } catch { /* Sessions still work without browser storage. */ }
        if (isUuid(params.get("sessionId"))) saved = params.get("sessionId");
        if (saved) {
          try {
            const restored = await scrollRequest<ScrollSession>(client!, `view=session&sessionId=${saved}`);
            if (active) { setSession(restored); try { sessionStorage.setItem(sessionKey, restored.id); } catch { /* Server keeps the session. */ } }
          } catch { try { sessionStorage.removeItem(sessionKey); } catch { /* Ignore unavailable storage. */ } }
        }
        if (!saved && params.get("start") === "1") {
          const started = await scrollRequest<ScrollSession>(client!, { action: "start", settings: configured });
          if (active) { setSession(started); try { sessionStorage.setItem(sessionKey, started.id); } catch { /* Server keeps the session. */ } }
          window.history.replaceState(null, "", window.location.pathname);
        }
      } catch (error) { if (active) setError(message(error)); }
      finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [client, sessionKey]);

  const applySession = useCallback((value: ScrollSession) => {
    setSession(value);
    try { sessionStorage.setItem(sessionKey, value.id); } catch { /* Answers are already safe in the account. */ }
  }, [sessionKey]);
  const run = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    if (!client || lock.current) return;
    lock.current = true; mutationVersion.current++; setBusy(true); setError(""); setNeedsLogin(false);
    if (action !== "skip") setNotice("");
    const payload = { action, sessionId: session?.id, itemId: current?.id, activeMs: Math.floor(activeTime.current), ...extra };
    retry.current = { action, extra };
    try {
      let result = await scrollRequest<ScrollSession>(client, payload);
      if (action === "skip") {
        setNotice(result.items[0]?.status === "expired" ? "Tempo esgotado. A questão pode voltar em outra sessão." : "Questão pulada · sem XP. Ela pode voltar em outra sessão.");
        result = await scrollRequest<ScrollSession>(client, { action: "next", sessionId: result.id });
      }
      applySession(result);
      if (action === "start") { controls.current?.close(); setReward(null); window.history.replaceState(null, "", window.location.pathname); }
      else if (action === "answer") {
        const answer = result.items[0];
        if (answer?.correct) { play(scrollChallenge(result).closed ? "complete" : result.streak >= 3 ? "combo" : "correct"); setReward({ id: answer.id, xp: answer.xp, streak: result.streak }); }
        else play("incorrect");
      } else if (action === "next" || action === "skip") { setReward(null); play(result.finished ? "complete" : "next"); }
      void refresh().catch(() => {});
      void refreshProfile();
    } catch (error) {
      setError(message(error));
      setNeedsLogin(error instanceof ScrollRequestError && error.status === 401);
    } finally { lock.current = false; setBusy(false); }
  }, [client, session?.id, current?.id, applySession, play, refresh, refreshProfile]);

  const favorite = async () => {
    if (!client || !current || lock.current) return;
    lock.current = true; mutationVersion.current++; setBusy(true); setError("");
    try {
      const result = await scrollRequest<{ favorite: boolean }>(client, { action: "favorite", questionId: current.question.id, favorite: !current.favorite });
      setSession(value => value && { ...value, items: value.items.map(item => item.question.id === current.question.id ? { ...item, favorite: result.favorite } : item) });
    } catch (error) { setError(message(error)); }
    finally { lock.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (!current?.deadline || current.status !== "pending") return;
    const update = () => {
      const now = current.pausedAt ? Date.parse(current.pausedAt) : Date.now();
      setSeconds(Math.max(0, Math.ceil((Date.parse(current.deadline!) - now) / 1000)));
    };
    update(); const timer = window.setInterval(update, 500);
    return () => clearInterval(timer);
  }, [current?.id, current?.deadline, current?.pausedAt, current?.status]);
  useEffect(() => {
    if (!current?.deadline || current.status !== "pending" || current.pausedAt || busy || seconds > 0 || expired.current === current.id || Date.now() < Date.parse(current.deadline)) return;
    expired.current = current.id;
    void run("skip");
  }, [seconds, current, busy, run]);
  useEffect(() => {
    if (!client || !session?.id) return;
    let active = true;
    const sync = async () => {
      if (document.hidden || lock.current) return;
      const version = mutationVersion.current;
      try {
        const value = await scrollRequest<ScrollSession>(client, `view=session&sessionId=${session.id}`);
        if (active && !lock.current && version === mutationVersion.current) setSession(value);
        if (active) void refresh().catch(() => {});
      } catch { /* A failed background sync must not erase a draft. */ }
    };
    window.addEventListener("focus", sync);
    return () => { active = false; window.removeEventListener("focus", sync); };
  }, [client, session?.id, refresh]);

  const goal = stats?.settings.goal ?? 5;
  const today = Math.min(stats?.today ?? 0, goal);
  const finished = session && (session.finished || session.exhausted);
  const start = () => { void run("start", { settings }); };
  const moreFive = () => { const next: ScrollSettings = { ...settings, mode: "session", target: 5 }; setSettings(next); void run("start", { settings: next }); };
  useEffect(() => { if (finished) summary.current?.focus(); }, [finished, session?.id]);
  useEffect(() => {
    const w = window as Window & { render_game_to_text?: () => string; advanceTime?: (ms: number) => void };
    w.render_game_to_text = () => JSON.stringify({ interface: "semantic DOM, origin top-left", module: "scroll", mode: session?.mode ?? settings.mode, finished: !!finished, question: current ? { id: current.question.id, status: current.status, paused: !!current.pausedAt } : null, answered: session?.answered ?? 0, streak: session?.streak ?? 0, xp: session?.xp ?? 0, block: session ? scrollChallenge(session) : null, today: stats?.today ?? 0, goal });
    // Progress is authoritative on the server; manual reading has no simulation clock.
    w.advanceTime = () => {}; return () => { delete w.render_game_to_text; delete w.advanceTime; };
  }, [session, current, settings.mode, finished, stats?.today, goal]);
  return <main id="conteudo" className="sc-workspace">
    <header className="sc-topbar"><Link href="/" className="sc-wordmark" aria-label="Quem Estuda Assim? — início">✳ <span>quem scrolla assim?</span></Link><div><Link className="sc-progress-link" href="/scrolla/progresso"><BarChart3 size={17} aria-hidden="true" /><span>Meu progresso</span></Link><Link className="sc-profile-link" href="/perfil">Meu perfil</Link><SoundToggle /></div></header>
    <aside className="sc-rail"><div><Link className="sc-back" href="/"><ArrowLeft size={15} aria-hidden="true" />Quem calcula assim?</Link><span className="sc-eyebrow">SEU ESPAÇO DE ESTUDO</span><h2>Um acerto<br /><em>de cada vez.</em></h2><p>Questões reais do ENEM.<br />Um próximo passo sempre à mão.</p></div>
      <div className="sc-daily"><div><Flame size={19} aria-hidden="true" /><strong>{stats?.streak ?? 0}</strong><span>{stats?.streak === 1 ? "dia de estudo" : "dias de estudo"}</span></div><label htmlFor="sc-goal">{today >= goal ? "Meta do dia concluída" : "Sua meta de hoje"}<strong>{today}/{goal}</strong></label><progress id="sc-goal" max={goal} value={today} /><p>Inéditas e revisões contam. Cada questão, uma vez por dia.</p></div>
      <div className="sc-level"><span>NÍVEL {Math.floor((stats?.totalXp ?? 0) / 100) + 1}</span><strong>{stats?.totalXp ?? 0}<small> XP total</small></strong><progress aria-label="Progresso para o próximo nível" max={100} value={(stats?.totalXp ?? 0) % 100} /><p>{100 - (stats?.totalXp ?? 0) % 100} XP para o próximo nível</p></div>
      {stats && <ScrollMissions missions={stats.learning.missions} />}
      <button className="sc-rail-settings" onClick={() => controls.current?.showModal()} disabled={loading || busy}><Settings2 size={17} aria-hidden="true" />Modo e filtros<ArrowRight size={15} aria-hidden="true" /></button><span className="sc-rail-note">2009–2023 · Aplicação regular<br />Gabaritos conferidos com o INEP</span>
    </aside>
    <div className="sc-main">
      {notice && <p className="sc-notice" role="status">{notice}</p>}
      <div className="sc-sessionbar"><div><span className="sc-live-dot" /><strong>{MODE_LABELS[session?.mode ?? settings.mode]}</strong>{session?.target && <span>{Math.min(session.completed + (!finished && current?.status === "pending" ? 1 : 0), session.target)}/{session.target}</span>}</div><div>
        {current?.deadline && !finished && <span className={`sc-clock${seconds <= 30 ? " urgent" : ""}`} role="timer" aria-label="Tempo restante"><Clock3 size={15} aria-hidden="true" />{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>}
        {current && !finished && <><button className="sc-icon" disabled={busy} onClick={() => void run("pause", { paused: !current.pausedAt })} aria-label={current.pausedAt ? "Retomar estudo" : "Pausar estudo"}>{current.pausedAt ? <Play size={17} /> : <Pause size={17} />}</button><button className="sc-icon" disabled={busy} onClick={() => void run("finish")} aria-label="Encerrar sessão"><X size={18} /></button></>}
        <button className="sc-icon" disabled={loading || busy} onClick={() => controls.current?.showModal()} aria-label="Mudar modo e filtros"><Settings2 size={18} /></button>
      </div></div>
      {session && !finished && <ScrollMomentum session={session} />}
      <div className="sc-mobile-goal"><span><Flame size={14} aria-hidden="true" />{stats?.streak ?? 0} {stats?.streak === 1 ? "dia" : "dias"}</span><span>Meta de hoje <strong>{today}/{goal}</strong>{today >= goal && <Check size={14} aria-label="Meta concluída" />}</span><span><Zap size={13} aria-hidden="true" />{stats?.totalXp ?? 0} XP</span></div>
      {error && <div className="sc-error" role="alert"><span>{error}</span>{needsLogin ? <Link href="/entrar?next=%2Fscrolla">Entrar novamente</Link> : <button onClick={() => retry.current ? void run(retry.current.action, retry.current.extra) : void refresh().then(() => setError("")).catch(e => setError(message(e)))} disabled={busy}>Tentar novamente</button>}</div>}
      {loading ? <div className="sc-empty" aria-busy="true"><LoaderCircle className="spin" size={28} aria-hidden="true" /><p role="status">Preparando seu estudo…</p></div>
        : finished ? <div className="sc-empty sc-summary" ref={summary} tabIndex={-1}><span className="sc-summary-mark"><Trophy size={30} aria-hidden="true" /></span><span className="sc-eyebrow">{session.exhausted ? "FIM DESTA SELEÇÃO" : "MAIS UM TREINO NA SUA HISTÓRIA"}</span><h1>{session.exhausted && !session.answered ? <>Mude a rota.<br /><em>Continue aprendendo.</em></> : session.correct === session.answered && session.answered > 0 ? <>Uma sessão<br /><em>cheia de acertos.</em></> : <>Você praticou.<br /><em>Isso já fica.</em></>}</h1><p>{session.exhausted ? "Experimente outros filtros ou recupere o que já estudou." : session.answered ? `${session.correct} ${session.correct === 1 ? "acerto" : "acertos"} em ${session.answered} respostas. ${session.answered - session.correct > 0 ? "Seus erros estão guardados para uma nova tentativa." : "Cada boa leitura abre espaço para a próxima."}` : "Seu estudo foi guardado. Você escolhe quando retomar."}</p><dl className="sc-summary-stats"><div><dt>Respondidas</dt><dd>{session.answered}</dd></div><div><dt>Acertos</dt><dd>{session.correct}</dd></div><div className="sc-summary-xp"><dt>XP nas questões</dt><dd>+{session.xp}</dd></div></dl>{today >= goal && <span className="sc-goal-achieved"><Check size={16} aria-hidden="true" />Meta de hoje concluída · {today}/{goal}</span>}<button className="sc-primary" disabled={busy} onClick={session.exhausted ? () => controls.current?.showModal() : moreFive}>{busy ? "Preparando…" : session.exhausted ? "Explorar outros filtros" : "Mais 5 inéditas"}<ArrowRight size={18} aria-hidden="true" /></button>{session.answered > session.correct && <Link className="sc-text-button" href="/scrolla?mode=errors&start=1">Praticar meus erros<ArrowRight size={15} aria-hidden="true" /></Link>}{(stats?.learning.due ?? 0) > 0 && <Link className="sc-text-button" href="/scrolla?mode=due&start=1">Revisar {stats?.learning.due} questões pendentes</Link>}<div className="sc-summary-links"><button className="sc-text-button" onClick={() => controls.current?.showModal()} disabled={busy}>Escolher outro treino</button><Link className="sc-text-button" href="/scrolla/progresso">Ver meu progresso</Link></div></div>
        : current ? <div className="sc-current-question"><QuestionCard key={current.id} item={current} busy={busy} streak={session!.streak} activeTimeRef={activeTime} onAnswer={choice => void run("answer", { choice })} onNext={() => void run("next")} onSkip={() => void run("skip")} onFavorite={() => void favorite()} />
          {reward && <AnswerCelebration key={`reward:${reward.id}`} label={reward.xp ? `+${reward.xp} XP` : "REVISÃO CERTA"} detail={session && scrollChallenge(session).closed ? `Bloco ${scrollChallenge(session).block} fechado!` : reward.streak >= 3 ? `Combo ${reward.streak} · boa sequência` : "Uma boa leitura. Mais um acerto."} />}
          {current.pausedAt && <div className="sc-pause-overlay"><Pause size={30} aria-hidden="true" /><h2>Um respiro faz parte.</h2><p>Retome quando estiver pronto.</p><button className="sc-primary" disabled={busy} onClick={() => void run("pause", { paused: false })}>Retomar<Play size={17} aria-hidden="true" /></button></div>}
        </div>
          : <div className="sc-empty sc-welcome"><span className="sc-start-mark"><Target size={30} strokeWidth={1.5} aria-hidden="true" /></span><span className="sc-eyebrow">QUESTÕES REAIS. CONQUISTAS SUAS.</span><h1>Cada scroll,<br /><em>um novo acerto.</em></h1><p>{today >= goal ? "Meta do dia concluída. Seu próximo desafio fica por sua conta." : `Faltam ${goal - today} ${goal - today === 1 ? "resposta" : "respostas"} para fechar sua meta de hoje.`}<br />Leia, escolha e veja seu estudo avançar.</p><div className="sc-mode-choices" role="group" aria-label="Modo de estudo">{(["feed", "session", "due"] as const).map(mode => <button key={mode} className={(mode === "due" ? !["feed", "session"].includes(settings.mode) : settings.mode === mode) ? "selected" : ""} aria-pressed={mode === "due" ? !["feed", "session"].includes(settings.mode) : settings.mode === mode} onClick={() => setSettings(s => ({ ...s, mode }))}><strong>{mode === "feed" ? "Feed" : mode === "session" ? "Sessão" : "Revisão"}</strong><span>{mode === "feed" ? "Só inéditas" : mode === "session" ? `${settings.target} questões` : "Recuperar o que ficou"}</span></button>)}</div><button className="sc-primary" onClick={start} disabled={busy || !stats}>{busy ? "Preparando…" : settings.mode === "feed" ? "Buscar meu próximo acerto" : settings.mode === "session" ? `Começar ${settings.target} questões` : "Começar minha revisão"}<ArrowRight size={18} aria-hidden="true" /></button><button className="sc-text-button" onClick={moreFive} disabled={busy || !stats}>Fazer um treino de 5 questões<ArrowRight size={16} aria-hidden="true" /></button>{stats && <div className="sc-welcome-missions"><ScrollMissions missions={stats.learning.missions} /></div>}<button className="sc-text-button sc-welcome-filters" onClick={() => controls.current?.showModal()} disabled={!stats}><Settings2 size={15} aria-hidden="true" />Filtros e meta diária</button><span className="sc-welcome-note">10 XP por acerto inédito · 15 XP a partir do terceiro seguido</span></div>}

    </div>
    <dialog ref={controls} className="sc-controls-dialog" aria-labelledby="sc-controls-title"><form onSubmit={event => { event.preventDefault(); start(); }}><div className="sc-dialog-heading"><div><span className="sc-eyebrow">DO SEU JEITO</span><h2 id="sc-controls-title">Seu próximo estudo.</h2></div><button className="sc-icon" type="button" onClick={() => controls.current?.close()} aria-label="Fechar opções"><X size={22} /></button></div>
      <fieldset><legend>Modo de estudo</legend><div className="sc-mode-tabs">{(["feed", "session", "due", "errors", "favorites"] as const).map(mode => <button key={mode} type="button" className={settings.mode === mode ? "selected" : ""} aria-pressed={settings.mode === mode} onClick={() => setSettings(s => ({ ...s, mode }))}>{MODE_LABELS[mode]}</button>)}</div></fieldset>
      <label>Área<select value={settings.area} onChange={e => setSettings(s => ({ ...s, area: e.target.value as ScrollSettings["area"], subject: null, topic: null }))}><option value="all">Todas as áreas</option>{Object.entries(AREAS).map(([area, details]) => <option key={area} value={area}>{details.label}</option>)}</select></label>
      <div className="sc-form-pair"><label>Ano<select value={settings.year ?? "all"} onChange={e => setSettings(s => ({ ...s, year: e.target.value === "all" ? null : Number(e.target.value) }))}><option value="all">Todos os anos</option>{stats?.years.map(year => <option key={year} value={year}>{year}</option>)}</select></label><label>Língua estrangeira<select value={settings.language} onChange={e => setSettings(s => ({ ...s, language: e.target.value as ScrollSettings["language"] }))}><option value="ingles">Inglês</option><option value="espanhol">Espanhol</option></select></label></div>
      <p className="sc-control-note">O idioma só filtra as questões de língua estrangeira.</p>
      {settings.mode === "session" && <><label>Questões nesta sessão<select value={settings.target} onChange={e => setSettings(s => ({ ...s, target: Number(e.target.value) as ScrollSettings["target"] }))}>{[5, 10, 20].map(n => <option key={n} value={n}>{n} questões</option>)}</select></label><label className="sc-check-label"><input type="checkbox" checked={settings.timed} onChange={e => setSettings(s => ({ ...s, timed: e.target.checked }))} />Usar cronômetro por questão</label>{settings.timed && <label>Minutos por questão<input type="number" min={1} max={30} required value={settings.minutes} onChange={e => setSettings(s => ({ ...s, minutes: Number(e.target.value) }))} /></label>}</>}
      <label className="sc-check-label"><input type="checkbox" checked={!!settings.explanationOnly} onChange={e => setSettings(s => ({ ...s, explanationOnly: e.target.checked }))} />Somente questões com explicação na plataforma</label>
      <label>Matéria<select value={settings.subject ?? "all"} onChange={e => setSettings(s => ({ ...s, subject: e.target.value === "all" ? null : e.target.value, topic: null, area: "all" }))}><option value="all">Todas as matérias</option>{[...new Map(stats?.learning.taxonomy.map(t => [t.subject, t.subjectLabel])).entries()].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Assunto<select value={settings.topic ? `${settings.subject}/${settings.topic}` : "all"} onChange={e => { const [subject, topic] = e.target.value.split("/"); setSettings(s => ({ ...s, subject: e.target.value === "all" ? s.subject : subject, topic: e.target.value === "all" ? null : topic, area: "all" })); }}><option value="all">Todos os assuntos</option>{stats?.learning.taxonomy.filter(t => !settings.subject || t.subject === settings.subject).map(t => <option key={`${t.subject}/${t.topic}`} value={`${t.subject}/${t.topic}`}>{settings.subject ? t.topicLabel : `${t.subjectLabel} · ${t.topicLabel}`}</option>)}</select></label>
      <p className="sc-control-note">{stats?.learning.coverage.explained ?? 0} questões com explicação e classificação. O restante continua no estudo geral.{settings.mode === "due" && " A revisão programada também recupera questões já estudadas no outro idioma."}</p>
      <label>Minha meta diária<select value={settings.goal} onChange={e => setSettings(s => ({ ...s, goal: Number(e.target.value) as ScrollSettings["goal"] }))}>{[5, 10, 20].map(n => <option key={n} value={n}>{n} respostas por dia</option>)}</select></label><p className="sc-control-note">Revisões contam para a meta. XP por questão só nas inéditas; missões dão bônus uma vez por dia.</p>
      <button className="sc-primary" disabled={busy || !stats}>{busy ? "Preparando…" : session && !finished ? "Aplicar e recomeçar" : "Começar com estas opções"}<ArrowRight size={17} aria-hidden="true" /></button>
    </form></dialog>
  </main>;
}
