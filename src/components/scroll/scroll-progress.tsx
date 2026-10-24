"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Bookmark, Check, ChevronDown, Flame, LoaderCircle, RotateCcw, X } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AREAS } from "@/lib/questions";
import { scrollRequest } from "@/lib/scroll/client";
import type { HistoryItem, HistoryPage, ScrollStats } from "@/lib/scroll/types";
import { ScrollAccess } from "./scroll-access";
import { ImageZoom, QuestionMarkdown, StudyImage } from "./question-content";
import { ExplanationPanel } from "./explanation-panel";
import { Achievements, Missions, TopicMastery } from "@/components/learning/learning-panels";

const format = new Intl.NumberFormat("pt-BR");
const duration = (ms: number) => ms < 60000 ? `${Math.floor(ms / 1000)} s` : `${Math.floor(ms / 60000)} min`;
const percent = (right: number, total: number) => total ? `${Math.round(right / total * 100)}%` : "—";

export function ScrollProgress() { return <ScrollAccess progress><ProgressWorkspace /></ScrollAccess>; }

function ActivityChart({ daily }: { daily: ScrollStats["daily"] }) {
  const [period, setPeriod] = useState(7);
  const [selected, setSelected] = useState<string | null>(null);
  const days = daily.slice(-period);
  const active = days.find(d => d.day === selected) ?? days.at(-1);
  const maximum = Math.max(1, ...days.map(d => d.answered));
  return <section className="sc-activity" aria-labelledby="sc-activity-title"><div className="sc-section-head"><h2 id="sc-activity-title">Seu ritmo de estudo</h2><div className="sc-period" role="group" aria-label="Período do gráfico">{[7, 14, 28].map(n => <button key={n} aria-pressed={n === period} className={n === period ? "selected" : ""} onClick={() => { setPeriod(n); setSelected(null); }}>{n} dias</button>)}</div></div>
    <div className="sc-chart" role="group" aria-label="Respostas por dia">{days.map(day => <button key={day.day} className={`sc-chart-day${active?.day === day.day ? " selected" : ""}`} onClick={() => setSelected(day.day)} aria-pressed={active?.day === day.day} aria-label={`${day.day.split("-").reverse().join("/")}: ${day.answered} respostas, ${day.correct} acertos`}><strong>{day.answered || ""}</strong><span className="sc-chart-track"><span style={{ height: `${Math.max(day.answered ? 5 : 0, day.answered / maximum * 100)}%` }} /></span><small>{day.day.slice(-2)}</small></button>)}</div>
    <p className="sc-chart-detail" aria-live="polite">{active ? <><strong>{active.day.split("-").reverse().join("/")}</strong><span>{active.answered} {active.answered === 1 ? "resposta" : "respostas"} · {active.correct} {active.correct === 1 ? "acerto" : "acertos"} · {duration(active.activeMs)} ativos</span></> : "Seu primeiro dia de estudo aparece aqui."}</p>
  </section>;
}

function HistoryEntry({ item, onFavorite }: { item: HistoryItem; onFavorite: (item: HistoryItem) => void }) {
  const [open, setOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const q = item.question;
  return <article className="sc-history-entry"><div className="sc-history-row"><button className="sc-history-open" aria-expanded={open} onClick={() => setOpen(value => !value)}><span className={`sc-history-result${item.firstCorrect === true ? " correct" : item.firstCorrect === false ? " incorrect" : ""}`}>{item.firstCorrect === null ? <Bookmark size={17} aria-label="Ainda não respondida" /> : item.firstCorrect ? <Check size={18} aria-label="Primeiro acerto" /> : <X size={18} aria-label="Primeira resposta incorreta" />}</span><span><strong>ENEM {q.year} · Questão {q.number}</strong><small>{AREAS[q.area].label}{q.language ? ` · ${q.language === "ingles" ? "Inglês" : "Espanhol"}` : ""}</small></span><span className="sc-history-state">{item.attempts > 1 && item.lastCorrect ? "Revisada ✓" : item.firstCorrect === null ? "Não respondida" : item.firstCorrect ? "Acertou" : "Para revisar"}</span><ChevronDown size={17} aria-hidden="true" /></button><button className="sc-bookmark" aria-pressed={item.favorite} aria-label={item.favorite ? "Remover dos favoritos" : "Salvar nos favoritos"} onClick={() => onFavorite(item)}><Bookmark size={18} fill={item.favorite ? "currentColor" : "none"} aria-hidden="true" /></button></div>
    {open && <div className="sc-history-detail">{q.context && <QuestionMarkdown onZoom={setZoom}>{q.context}</QuestionMarkdown>}<div className="sc-question-prompt"><QuestionMarkdown onZoom={setZoom}>{q.prompt}</QuestionMarkdown></div><ol className="sc-history-options">{q.alternatives.map((a, index) => <li key={a.letter} className={item.correctIndex === index ? "correct" : item.firstChoice === index ? "incorrect" : ""}><strong>{a.letter}</strong><div>{a.text && <QuestionMarkdown onZoom={setZoom}>{a.text}</QuestionMarkdown>}{a.image && <StudyImage src={a.image} alt={`Alternativa ${a.letter}`} onZoom={setZoom} />}</div>{item.correctIndex === index && <Check size={18} aria-label="Correta" />}</li>)}</ol><p className="sc-history-note">{item.firstChoice === null ? "Esta questão ainda não foi respondida." : `Sua primeira resposta: ${String.fromCharCode(65 + item.firstChoice)} · ${item.attempts} ${item.attempts === 1 ? "tentativa" : "tentativas"}`}</p>{item.firstChoice !== null && item.lastChoice !== item.firstChoice && <p className="sc-history-note">Última resposta: {String.fromCharCode(65 + item.lastChoice!)} · {item.lastCorrect ? "correta" : "incorreta"}</p>}{item.answeredAt && <ExplanationPanel question={q} selected={item.lastChoice} correctIndex={item.correctIndex} />}<Link className="sc-text-button" href={`/scrolla?mode=${item.favorite ? "favorites" : "errors"}`}>Ir para revisão<ArrowRight size={15} aria-hidden="true" /></Link></div>}
    <ImageZoom src={zoom} onClose={() => setZoom(null)} />
  </article>;
}

function ProgressWorkspace() {
  const { client } = useAuth();
  const [stats, setStats] = useState<ScrollStats | null>(null);
  const [history, setHistory] = useState<HistoryPage>({ items: [], next: null });
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const load = useCallback(async () => {
    if (!client) return;
    const [summary, rows] = await Promise.all([scrollRequest<ScrollStats>(client), scrollRequest<HistoryPage>(client, `view=history&filter=${filter}`)]);
    return { summary, rows };
  }, [client, filter]);
  useEffect(() => {
    let active = true;
    load().then(result => { if (active && result) { setStats(result.summary); setHistory(result.rows); setError(""); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [load, revision]);
  const favorite = async (item: HistoryItem) => {
    if (!client || more) return;
    setMore(true);
    try { await scrollRequest(client, { action: "favorite", questionId: item.question.id, favorite: !item.favorite }); setRevision(n => n + 1); }
    catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar."); }
    finally { setMore(false); }
  };
  const loadMore = async () => {
    if (!client || history.next === null || more) return;
    setMore(true);
    try {
      const result = await scrollRequest<HistoryPage>(client, `view=history&filter=${filter}&offset=${history.next}`);
      setHistory(current => ({ ...result, items: [...current.items, ...result.items.filter(row => !current.items.some(old => old.question.id === row.question.id))] }));
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar."); }
    finally { setMore(false); }
  };
  return <main id="conteudo" className="sc-progress-page"><header className="sc-topbar"><Link href="/scrolla" className="sc-wordmark">✳ <span>quem scrolla assim?</span></Link><div><Link className="sc-progress-link" href="/scrolla"><ArrowLeft size={16} aria-hidden="true" />Voltar ao estudo</Link><Link className="sc-profile-link" href="/perfil">Meu perfil</Link></div></header>
    <div className="sc-progress-body"><div className="sc-progress-heading"><div><span className="sc-eyebrow">CADA RESPOSTA CONTA</span><h1>Meu progresso<span>.</span></h1><p>Seus primeiros acertos e o que você está aprendendo a acertar.</p></div><button className="sc-text-button" onClick={() => setRevision(n => n + 1)} disabled={loading}><RotateCcw size={15} aria-hidden="true" />Atualizar</button></div>
      {error && <div className="sc-error" role="alert"><span>{error}</span><button onClick={() => setRevision(n => n + 1)}>Tentar novamente</button></div>}
      {loading && !stats ? <div className="sc-empty" aria-busy="true"><LoaderCircle className="spin" aria-hidden="true" /><p role="status">Carregando sua evolução…</p></div> : stats && <>
        <dl className="sc-metrics"><div><dt>Respondidas</dt><dd>{format.format(stats.answered)}<span>questões oficiais</span></dd></div><div><dt>Acertos</dt><dd>{format.format(stats.correct)}<span>na primeira resposta</span></dd></div><div><dt>Precisão</dt><dd>{percent(stats.correct, stats.answered)}<span>na primeira resposta</span></dd></div><div><dt>Tempo ativo</dt><dd>{duration(stats.activeMs)}<span>com o estudo em foco</span></dd></div></dl>
        <div className="sc-progress-context"><span><Flame size={17} aria-hidden="true" /><strong>{stats.streak}</strong> {stats.streak === 1 ? "dia" : "dias"} de estudo</span><span><strong>{stats.xp}</strong> XP no Scroll</span><span><strong>{stats.reviewCorrect}/{stats.reviews}</strong> revisões corretas</span><span>Nível <strong>{Math.floor(stats.totalXp / 100) + 1}</strong> · {stats.totalXp} XP total</span></div>
        <div className="sc-goal-editor"><div><strong>{stats.today >= stats.settings.goal ? "Meta do dia concluída ✓" : "Sua meta de hoje"}</strong><span>{Math.min(stats.today, stats.settings.goal)}/{stats.settings.goal} questões · inéditas e revisões</span></div><label>Meta diária<select value={stats.settings.goal} disabled={more} onChange={async e => {
          if (!client) return;
          setMore(true);
          try { setStats(await scrollRequest<ScrollStats>(client, { action: "settings", settings: { ...stats.settings, goal: Number(e.target.value) } })); }
          catch (e) { setError(e instanceof Error ? e.message : "Não foi possível salvar a meta."); }
          finally { setMore(false); }
        }}>{[5, 10, 20].map(n => <option key={n} value={n}>{n} por dia</option>)}</select></label></div>
        <div className="sc-progress-analysis"><ActivityChart daily={stats.daily} /><section className="sc-area-results" aria-labelledby="sc-area-title"><div className="sc-section-head"><h2 id="sc-area-title">Por área</h2><span>Primeira resposta</span></div>{Object.entries(AREAS).map(([key, area]) => {
          const row = stats.areas.find(a => a.area === key);
          return <div className="sc-area-result" key={key}><div><strong>{area.label}</strong><span>{row?.correct ?? 0}/{row?.answered ?? 0} acertos</span></div><progress max={row?.answered || 1} value={row?.correct ?? 0} aria-label={`Precisão em ${area.label}: ${percent(row?.correct ?? 0, row?.answered ?? 0)}`} /><strong>{percent(row?.correct ?? 0, row?.answered ?? 0)}</strong></div>;
        })}</section></div>
        <section className="learn-progress-missions"><div className="learn-section-heading"><h2>Missões de hoje</h2><span>{stats.learning.bonusXp} XP em bônus acumulados</span></div><Missions missions={stats.learning.missions} /></section>
        <TopicMastery learning={stats.learning} /><Achievements earned={stats.learning.achievements} />
        <div className="learn-calculator-summary"><strong>{stats.learning.calculatorRounds} rodadas no Calcula</strong><span>Treino de raciocínio, separado dos assuntos do ENEM.</span><Link href="/#calculator-title">Voltar ao treino<ArrowRight size={15} aria-hidden="true" /></Link></div>
        <section className="sc-history" aria-labelledby="sc-history-title"><div className="sc-section-head"><h2 id="sc-history-title">Seu caderno</h2>{filter !== "all" && <Link className="sc-text-button" href={`/scrolla?mode=${filter}`}>Começar revisão<ArrowRight size={15} aria-hidden="true" /></Link>}</div><div className="sc-history-tabs" role="group" aria-label="Filtrar seu caderno">{[["all", "Histórico"], ["errors", "Erros para revisar"], ["favorites", "Favoritas"]].map(([key, label]) => <button key={key} disabled={more || loading} className={filter === key ? "selected" : ""} aria-pressed={filter === key} onClick={() => { setLoading(true); setFilter(key); }}>{label}</button>)}</div>
          <div className="sc-history-list" aria-busy={loading}>{history.items.map(item => <HistoryEntry key={item.question.id} item={item} onFavorite={favorite} />)}{!history.items.length && <div className="sc-history-empty"><Bookmark size={24} strokeWidth={1.4} aria-hidden="true" /><p>{filter === "favorites" ? "Salve questões durante o estudo para encontrá-las aqui." : filter === "errors" ? "Nenhum erro pendente de revisão. Continue estudando." : "Seu histórico começa com a primeira resposta."}</p><Link href="/scrolla" className="sc-text-button">Ir para o estudo<ArrowRight size={15} aria-hidden="true" /></Link></div>}</div>{history.next !== null && <button className="sc-load-more" onClick={() => void loadMore()} disabled={more}>{more ? "Carregando…" : "Carregar mais questões"}<ChevronDown size={16} aria-hidden="true" /></button>}
        </section><p className="sc-data-note">Os detalhes acima começam com o banco oficial. Seus totais anteriores permanecem no perfil. Dia de estudo: horário de Brasília.</p>
      </>}
    </div>
  </main>;
}
