"use client";

import Link from "next/link";
import { ArrowRight, Award, Check, Clock3, LockKeyhole, RotateCcw, Target, Zap } from "lucide-react";
import type { LearningOverview, Mission } from "@/lib/scroll/types";

export const ACHIEVEMENTS = {
  first_goal: { name: "Primeiro compromisso", detail: "Concluir uma meta diária" },
  streak_3: { name: "Pegando o ritmo", detail: "Estudar por 3 dias seguidos" },
  streak_7: { name: "Uma semana sua", detail: "Estudar por 7 dias seguidos" },
  reviews_10: { name: "Memória em movimento", detail: "Concluir 10 revisões programadas" },
  first_mastery: { name: "Conhecimento que fica", detail: "Consolidar seu primeiro assunto" },
};
export const MISSION_TITLES = { answers: "Responder questões", reviews: "Revisar no tempo certo", calculator: "Acertar no Calcula solo" };
const MISSION_LINKS = { answers: "/scrolla?mode=session&target=5", reviews: "/scrolla?mode=due", calculator: "/#calculator-title" };

export function Missions({ missions }: { missions: Mission[] }) {
  return <div className="learn-missions">{missions.map(m => <Link href={MISSION_LINKS[m.id]} key={m.id} className={`learn-mission${m.awarded ? " complete" : ""}`}>
    <span className="learn-mission-mark">{m.awarded ? <Check size={19} aria-label="Concluída" /> : m.id === "reviews" ? <RotateCcw size={18} aria-hidden="true" /> : m.id === "calculator" ? <Zap size={18} aria-hidden="true" /> : <Target size={18} aria-hidden="true" />}</span>
    <span className="learn-mission-copy"><strong>{MISSION_TITLES[m.id]}</strong><span>{m.progress}/{m.target} · {m.awarded ? "Bônus recebido" : `+${m.xp} XP ao concluir`}</span><progress max={m.target} value={m.progress} aria-label={`${MISSION_TITLES[m.id]}: ${m.progress} de ${m.target}`} /></span>
    <ArrowRight size={17} aria-hidden="true" />
  </Link>)}</div>;
}

export function Achievements({ earned }: { earned: LearningOverview["achievements"] }) {
  return <section className="learn-achievements" aria-labelledby="learn-achievements-title"><div className="learn-section-heading"><div><span className="learn-kicker">SEUS MARCOS</span><h2 id="learn-achievements-title">Conquistas</h2></div><span>{earned.length}/5</span></div>
    <div className="learn-stamps">{Object.entries(ACHIEVEMENTS).map(([id, badge]) => {
      const unlocked = earned.find(e => e.id === id);
      return <div className={`learn-stamp${unlocked ? " unlocked" : ""}`} key={id}><span>{unlocked ? <Award size={25} aria-hidden="true" /> : <LockKeyhole size={21} aria-hidden="true" />}</span><strong>{badge.name}</strong><p>{badge.detail}</p><small>{unlocked ? `Conquistada em ${new Date(unlocked.earnedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Por conquistar"}</small></div>;
    })}</div>
  </section>;
}

export function TopicMastery({ learning }: { learning: LearningOverview }) {
  const subjects = [...new Set(learning.taxonomy.map(t => t.subject))];
  return <section className="learn-topics" aria-labelledby="learn-topics-title"><div className="learn-section-heading"><div><span className="learn-kicker">O QUE ESTÁ FICANDO</span><h2 id="learn-topics-title">Por matéria e assunto</h2></div><Link href="/scrolla?mode=due"><Clock3 size={16} aria-hidden="true" />{learning.due} revisões pendentes</Link></div>
    <p className="learn-muted">{learning.coverage.explained} de {learning.coverage.total} questões têm explicação e classificação aprovadas. O restante continua no estudo geral.</p>
    <details className="learn-method"><summary>Como medimos domínio?</summary><p>Em treino: primeiras experiências. Consolidando: pelo menos 5 questões distintas e 4 acertos nas últimas 5 primeiras respostas. Consolidado: também acertar uma revisão devida após intervalo de pelo menos 7 dias. Um erro posterior em revisão retira esse estado. XP não mede domínio.</p></details>
    {!subjects.length && <p className="learn-muted">A classificação dos primeiros assuntos está em preparação.</p>}
    {subjects.map(subject => <details className="learn-subject" key={subject}><summary>{learning.taxonomy.find(t => t.subject === subject)!.subjectLabel}<span>{learning.taxonomy.filter(t => t.subject === subject).length} {learning.taxonomy.filter(t => t.subject === subject).length === 1 ? "assunto" : "assuntos"}</span></summary><div>{learning.taxonomy.filter(t => t.subject === subject).map(t => {
      const p = learning.topics.find(p => p.subject === subject && p.topic === t.topic);
      const state = p?.state ?? "empty";
      return <div className="learn-topic-row" key={t.topic}><div><strong>{t.topicLabel}</strong><small>{p ? `${p.correct}/${p.answered} acertos na primeira resposta` : "Resolva uma questão para começar"}</small></div><span className={`learn-topic-state ${state}`}>{state === "mastered" ? "Consolidado" : state === "consolidating" ? "Consolidando" : state === "training" ? "Em treino" : "Sem dados"}</span><Link href={`/scrolla?mode=session&subject=${subject}&topic=${t.topic}`} aria-label={`Praticar ${t.topicLabel}`}><ArrowRight size={18} /></Link></div>;
    })}</div></details>)}
  </section>;
}
