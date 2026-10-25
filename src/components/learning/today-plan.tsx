"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Flame, RotateCcw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useStudyProgress } from "@/components/profile/study-progress";
import { PageIntro } from "@/components/page-intro";
import { scrollRequest } from "@/lib/scroll/client";
import type { ScrollStats } from "@/lib/scroll/types";
import { Missions } from "./learning-panels";

export function TodayPlan() {
  const { user, loading } = useAuth();
  if (!user) return loading ? <div className="learn-home-loading" role="status">Preparando seu espaço…</div> : <PageIntro />;
  return <AccountToday key={user.id} />;
}

function AccountToday() {
  const { user, client } = useAuth();
  const { stats: totals } = useStudyProgress();
  const [stats, setStats] = useState<ScrollStats | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!client || !user) return;
    const result = await scrollRequest<ScrollStats>(client);
    setStats(result); setError("");
  }, [client, user]);
  useEffect(() => {
    let active = true;
    if (!client || !user) return;
    const sync = () => { if (active && !document.hidden) void load().catch(() => { if (active) setError("Não foi possível carregar seu plano. Seu treino continua disponível."); }); };
    sync(); window.addEventListener("focus", sync);
    return () => { active = false; window.removeEventListener("focus", sync); };
  }, [client, user, load, totals?.total_xp]);
  if (!user) return null;
  const learning = stats?.learning;
  const goal = stats?.settings.goal ?? 5;
  const count = Math.min(stats?.today ?? 0, goal);
  const next = learning?.resume ? `/scrolla?sessionId=${learning.resume.id}` : learning?.due ? "/scrolla?mode=due&start=1" : `/scrolla?mode=session&target=5&start=1${!stats?.answered ? "&explained=1" : ""}`;
  const name = String(user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? "").split(" ")[0];
  return <section className="learn-today" aria-labelledby="learn-today-title">
    <div className="learn-today-main"><div className="learn-today-top"><span className="learn-kicker">PLANO DE HOJE</span><span><Flame size={15} aria-hidden="true" />{stats?.streak ?? 0} dias de estudo</span></div>
      <h1 id="learn-today-title">{name ? `${name}, ` : ""}um pouco hoje.<br /><em>Mais seu amanhã.</em></h1>
      <p>{learning?.resume ? "Seu estudo continua de onde você parou." : learning?.due ? "É hora de testar o que ficou na memória." : "Cinco questões são um bom começo."}</p>
      <div className="learn-today-actions"><Link className="button button-primary" href={next}>{learning?.resume ? "Continuar meu estudo" : learning?.due ? "Fazer minha revisão" : "Começar meu estudo"}<ArrowRight size={18} aria-hidden="true" /></Link><Link href="/scrolla/progresso">Meu progresso<ArrowRight size={16} aria-hidden="true" /></Link><Link href="/le">Treinar minha leitura<ArrowRight size={16} aria-hidden="true" /></Link></div>
      <div className="learn-day-line"><span className="learn-day-number">{count}<small>/{goal}</small></span><div><strong>{count >= goal ? "Sua meta está feita." : "Respostas na meta de hoje"}</strong><progress value={count} max={goal} aria-label={`${count} de ${goal} respostas na meta diária`} /><span>{stats?.totalXp ?? totals?.total_xp ?? 0} XP total · nível {Math.floor((stats?.totalXp ?? totals?.total_xp ?? 0) / 100) + 1}</span></div></div>
    </div>
    <div className="learn-today-side"><div className="learn-section-heading"><h2>Pequenas missões</h2><span>Até +50 XP/dia</span></div>{learning ? <Missions missions={learning.missions} /> : <p className="learn-muted" role="status">{error || "Carregando suas missões…"}</p>}{error && <button className="learn-retry" onClick={() => void load().catch(() => {})}><RotateCcw size={15} aria-hidden="true" />Tentar novamente</button>}<Link className="learn-review-link" href="/scrolla?mode=due"><RotateCcw size={16} aria-hidden="true" /><span>{learning?.due ?? 0} revisões pendentes</span><ArrowRight size={16} aria-hidden="true" /></Link><p className="learn-fine">Questões inéditas, revisão no tempo certo e um treino de raciocínio.</p></div>
  </section>;
}
