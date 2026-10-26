import Link from "next/link";
import { ArrowRight, Check, Flame, RotateCcw, Target, Zap } from "lucide-react";
import { scrollChallenge } from "@/lib/scroll/engagement";
import type { Mission, ScrollSession } from "@/lib/scroll/types";

export function ScrollMomentum({ session }: { session: ScrollSession }) {
  const challenge = scrollChallenge(session);
  return <section className={`sc-momentum${session.streak >= 3 ? " is-combo" : ""}${challenge.closed ? " block-closed" : ""}`} aria-label="Ritmo da sessão">
    <div className="sc-momentum-top"><div className="sc-combo"><span className="sc-combo-icon"><Flame size={21} aria-hidden="true" /></span><div><strong key={session.streak}>{session.streak >= 3 ? `Combo ${session.streak}` : session.streak ? `${session.streak} ${session.streak === 1 ? "acerto seguido" : "acertos seguidos"}` : "Acenda seu combo"}</strong><span>{challenge.hint}</span></div><span className="sc-combo-charges" aria-hidden="true">{[1, 2, 3].map(n => <i key={n} className={session.streak >= n ? "charged" : ""} />)}</span></div><div className="sc-run-xp"><Zap size={15} aria-hidden="true" /><strong key={session.xp}>{session.xp}</strong><span>XP <small>na sessão</small></span></div></div>
    <div className="sc-block"><span>{challenge.closed ? <><Check size={13} aria-hidden="true" />Bloco {challenge.block} fechado!</> : <>Bloco {challenge.block}<small> · cinco respostas de cada vez</small></>}</span><div role="progressbar" aria-label={`Respostas no bloco ${challenge.block}`} aria-valuemin={0} aria-valuemax={5} aria-valuenow={challenge.progress}>{[1, 2, 3, 4, 5].map(n => <i key={n} className={challenge.progress >= n ? "filled" : ""} />)}</div><strong>{challenge.progress}/5</strong></div>
  </section>;
}

export function ScrollMissions({ missions }: { missions: Mission[] }) {
  const relevant = missions.filter(m => m.id !== "calculator");
  if (!relevant.length) return null;
  return <section className="sc-missions" aria-label="Missões de hoje"><div className="sc-missions-heading"><strong>MISSÕES DE HOJE</strong><Link href="/scrolla/progresso" aria-label="Ver missões e progresso"><ArrowRight size={16} /></Link></div>{relevant.map(m => <div key={m.id} className={`sc-mission${m.awarded ? " complete" : ""}`}><span className="sc-mission-icon">{m.awarded ? <Check size={17} aria-label="Concluída" /> : m.id === "reviews" ? <RotateCcw size={17} aria-hidden="true" /> : <Target size={17} aria-hidden="true" />}</span><div><span>{m.id === "answers" ? "Responder questões" : "Revisar no tempo certo"}<b>{Math.min(m.target, m.progress)}/{m.target}</b></span><progress aria-label={m.id === "answers" ? "Missão de respostas" : "Missão de revisões"} value={m.progress} max={m.target} /><small>{m.awarded ? `+${m.xp} XP recebidos` : `+${m.xp} XP ao concluir`}</small></div></div>)}</section>;
}
