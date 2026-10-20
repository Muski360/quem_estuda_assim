"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookOpen,
  Check,
  ChevronRight,
  Clock3,
  Infinity as InfinityIcon,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import { AREAS, questions } from "@/lib/questions";
import type { Area, Question } from "@/lib/questions";
import { QuestionCard } from "./question-card";
import { advanceMomentum, getXpMultiplier, INITIAL_MOMENTUM } from "@/lib/momentum";
import { AnswerCelebration, MomentumStrip, SoundToggle, useStudySound } from "@/components/study-feedback";

type FeedSettings = { area: Area | "all"; timed: boolean; minutes: number };

export function ScrollFeed() {
  const [settings, setSettings] = useState<FeedSettings>({
    area: "all",
    timed: false,
    minutes: 3,
  });
  const [session, setSession] = useState(0);
  return (
    <section className="scroll-section" aria-labelledby="scroll-title">
      <div className="section-heading">
        <div className="section-name">
          <span className="section-index">02</span>
          <h2 id="scroll-title">
            Quem scrolla assim<span>?</span>
          </h2>
          <span className="section-label">
            CURIOSIDADE QUE VIRA CONHECIMENTO
          </span>
        </div>
        <span className="section-caption">
          <BookOpen size={15} aria-hidden="true" /> Um feed com propósito.
        </span>
      </div>
      <div className="scroll-layout">
        <aside className="feed-sidebar">
          <div className="panel-title">
            <h3>Encontre seu ritmo.</h3>
            <SlidersHorizontal size={17} aria-hidden="true" />
          </div>
          <div className="field-heading">
            <span>01</span>
            <h4>Qual é a sua área?</h4>
          </div>
          <div
            className="area-options"
            role="group"
            aria-label="Filtrar questões por área"
          >
            <button
              className={settings.area === "all" ? "selected" : ""}
              aria-pressed={settings.area === "all"}
              onClick={() => setSettings({ ...settings, area: "all" })}
            >
              <span className="all-area-symbol">
                <BookOpen size={17} aria-hidden="true" />
              </span>
              <span>Todas as áreas</span>
              <ChevronRight size={15} aria-hidden="true" />
            </button>
            {(Object.entries(AREAS) as [Area, (typeof AREAS)[Area]][]).map(
              ([area, details]) => (
                <button
                  key={area}
                  className={`${settings.area === area ? "selected " : ""}${details.color}`}
                  aria-pressed={settings.area === area}
                  onClick={() => setSettings({ ...settings, area })}
                >
                  <span className="area-initials" aria-hidden="true">
                    {details.short}
                  </span>
                  <span>{details.label}</span>
                  {settings.area === area ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={15} aria-hidden="true" />
                  )}
                </button>
              ),
            )}
          </div>
          <div className="field-heading">
            <span>02</span>
            <h4>Como quer praticar?</h4>
          </div>
          <div
            className="segmented time-mode"
            role="group"
            aria-label="Modo de tempo"
          >
            <button
              className={!settings.timed ? "selected" : ""}
              aria-pressed={!settings.timed}
              onClick={() => setSettings({ ...settings, timed: false })}
            >
              <InfinityIcon size={16} aria-hidden="true" /> Sem tempo
            </button>
            <button
              className={settings.timed ? "selected" : ""}
              aria-pressed={settings.timed}
              onClick={() => setSettings({ ...settings, timed: true })}
            >
              <Clock3 size={15} aria-hidden="true" /> Com tempo
            </button>
          </div>
          {settings.timed ? (
            <div className="minutes-field">
              <label htmlFor="question-minutes">Minutos por questão</label>
              <input
                id="question-minutes"
                type="number"
                min={1}
                max={30}
                value={settings.minutes}
                onChange={(event) => {
                  const minutes = Number(event.target.value);
                  setSettings({
                    ...settings,
                    minutes: Math.max(
                      1,
                      Math.min(30, Math.floor(minutes) || 1),
                    ),
                  });
                }}
              />
            </div>
          ) : (
            <p className="feed-time-note">
              Sem pressa. Leia, pense e responda quando estiver pronto.
            </p>
          )}
          {settings.timed && <p className="feed-time-note">{getXpMultiplier(settings.minutes*60,180)}× XP · referência: 3 minutos por questão.</p>}
          <div className="feed-howto">
            <span className="eyebrow">UM SCROLL, UMA DESCOBERTA</span>
            <p>
              Leia o enunciado.
              <br />
              Escolha uma alternativa.
              <br />
              <strong>Entenda o porquê.</strong>
            </p>
            <span>
              <ArrowDown size={14} aria-hidden="true" /> Role para a próxima
              questão
            </span>
          </div>
          <button
            className="restart-feed"
            onClick={() => setSession((value) => value + 1)}
          >
            <RotateCcw size={14} aria-hidden="true" /> Reiniciar sessão
          </button>
        </aside>
        <FeedSession
          key={`${settings.area}-${settings.timed}-${settings.minutes}-${session}`}
          settings={settings}
        />
      </div>
    </section>
  );
}

function FeedSession({ settings }: { settings: FeedSettings }) {
  const base = useMemo(
    () =>
      questions.filter(
        (question) =>
          settings.area === "all" || question.area === settings.area,
      ),
    [settings.area],
  );
  const [items, setItems] = useState<Question[]>(base);
  const [active, setActive] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [expired, setExpired] = useState<Record<number, boolean>>({});
  const [skipped, setSkipped] = useState<Record<number, boolean>>({});
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(settings.minutes * 60);
  const [momentum, setMomentum] = useState(INITIAL_MOMENTUM);
  const [rewardIndex, setRewardIndex] = useState<number | null>(null);
  const [immersive, setImmersive] = useState(false);
  const immersiveButton = useRef<HTMLButtonElement>(null);
  const { play } = useStudySound();
  const viewport = useRef<HTMLDivElement>(null);
  const activeRef = useRef(0);
  const answersRef = useRef<Record<number, number>>({});
  const expiredRef = useRef<Record<number, boolean>>({});
  const skippedRef = useRef<Record<number, boolean>>({});
  const deadlines = useRef<Record<number, number>>({});
  const pausedAt = useRef(0);
  const duration = settings.minutes * 60;

  useEffect(() => {
    if (!immersive) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setImmersive(false);
        immersiveButton.current?.focus();
      }
    };
    document.addEventListener("keydown", escape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", escape);
    };
  }, [immersive]);

  const goTo = useCallback((index: number) => {
    const container = viewport.current;
    const target = container?.querySelector<HTMLElement>(
      `[data-index="${index}"]`,
    );
    if (container && target) {
      const top = target.offsetTop;
      container.scrollTo({
        top,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }, []);

  useEffect(() => {
    const root = viewport.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.55) continue;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (activeRef.current !== index) play("next");
          activeRef.current = index;
          setActive(index);
          if (settings.timed && !deadlines.current[index])
            deadlines.current[index] = Date.now() + duration * 1000;
          setRemaining(
            Math.max(
              0,
              Math.ceil(
                ((deadlines.current[index] ?? Date.now() + duration * 1000) -
                  Date.now()) /
                  1000,
              ),
            ),
          );
          if (index >= items.length - 2) {
            // shortcut: o mock se repete em revisões; use paginação quando houver banco de questões.
            setItems((previous) => [...previous, ...base]);
          }
        }
      },
      { root, threshold: 0.55 },
    );
    root
      .querySelectorAll("[data-index]")
      .forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [items.length, settings.timed, duration, base, play]);

  useEffect(() => {
    if (!settings.timed || paused) return;
    const timer = window.setInterval(() => {
      const index = activeRef.current;
      if (answersRef.current[index] !== undefined || expiredRef.current[index] || skippedRef.current[index])
        return;
      const deadline = deadlines.current[index];
      if (!deadline) return;
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) {
        expiredRef.current = { ...expiredRef.current, [index]: true };
        setExpired(expiredRef.current);
        setMomentum((previous) => advanceMomentum(previous, false, 0));
        play("incorrect");
        goTo(index + 1);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [settings.timed, paused, goTo, play]);

  const answer = useCallback(
    (index: number, value: number) => {
      if (
        answersRef.current[index] !== undefined ||
        expiredRef.current[index] ||
        skippedRef.current[index] ||
        paused
      )
        return;
      if (
        settings.timed &&
        Date.now() >= (deadlines.current[index] ?? Infinity)
      ) {
        expiredRef.current = { ...expiredRef.current, [index]: true };
        setExpired(expiredRef.current);
        setMomentum((previous) => advanceMomentum(previous, false, 0));
        play("incorrect");
        goTo(index + 1);
        return;
      }
      answersRef.current = { ...answersRef.current, [index]: value };
      setAnswers(answersRef.current);
      const correct = items[index].correctIndex === value;
      const multiplier=settings.timed ? getXpMultiplier(duration,180) : 1;
      setMomentum((previous) => advanceMomentum(previous, correct, Math.round((previous.streak >= 2 ? 15 : 10)*multiplier)));
      if (correct) setRewardIndex(index);
      play(correct ? (momentum.streak >= 2 ? "combo" : "correct") : "incorrect");
    },
    [paused, settings.timed, duration, goTo, items, momentum.streak, play],
  );

  function skip(index: number) {
    if (paused || answersRef.current[index] !== undefined || expiredRef.current[index] || skippedRef.current[index]) return;
    skippedRef.current={...skippedRef.current,[index]:true};
    setSkipped(skippedRef.current);
    setRewardIndex(null);
    setMomentum((previous)=>advanceMomentum(previous,false,0));
    play("next");
    viewport.current?.focus({preventScroll:true});
    goTo(index+1);
  }

  function togglePause() {
    if (!paused) pausedAt.current = Date.now();
    else {
      const elapsed = Date.now() - pausedAt.current;
      for (const key of Object.keys(deadlines.current))
        deadlines.current[Number(key)] += elapsed;
    }
    setPaused(!paused);
  }

  const correct = Object.entries(answers).filter(
    ([index, choice]) => items[Number(index)]?.correctIndex === choice,
  ).length;
  const answered = Object.keys(answers).length;
  const completed = answered + Object.keys(expired).length;
  const hasAnswer = answers[active] !== undefined || expired[active] || skipped[active];

  return (
    <div
      className={`feed-column${immersive ? " is-immersive" : ""}`}
      role={immersive ? "dialog" : undefined}
      aria-modal={immersive ? true : undefined}
      aria-label={immersive ? "Feed em modo imersivo" : undefined}
      onKeyDown={(event) => {
        if (!immersive || event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled), [tabindex='0']")]
          .filter((control) => !control.closest("[inert]") && control.getClientRects().length);
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <div className="feed-toolbar">
        <div>
          <span className="status-dot" />
          <span>PARA VOCÊ <span className="feed-live-label">/ ENEM</span></span>
        </div>
        <div className="feed-clock">
          {settings.timed ? (
            <>
              <Clock3 size={15} aria-hidden="true" />
              <span role="timer" aria-label="Tempo restante da questão">
                {hasAnswer
                  ? "Concluída"
                  : `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`}
              </span>
              <button
                className="icon-button"
                onClick={togglePause}
                aria-label={paused ? "Retomar cronômetro" : "Pausar cronômetro"}
              >
                {paused ? <Play size={15} /> : <Pause size={15} />}
              </button>
            </>
          ) : (
            <>
              <InfinityIcon size={17} aria-hidden="true" />
              <span>No seu tempo</span>
            </>
          )}
          <SoundToggle />
          <button
            ref={immersiveButton}
            className="icon-button"
            onClick={() => setImmersive(!immersive)}
            aria-label={immersive ? "Sair do modo imersivo" : "Ativar modo imersivo"}
            title={immersive ? "Sair do modo imersivo (Esc)" : "Modo imersivo"}
            aria-pressed={immersive}
          >
            {immersive ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
        </div>
      </div>
      <MomentumStrip momentum={momentum} />
      <div className={`feed-session-goal${completed >= 5 ? " goal-complete" : ""}`}>
        <span>{completed >= 5 ? "Meta concluída" : "Meta da sessão"} <strong>{Math.min(5, completed)}/5</strong></span>
        <div role="progressbar" aria-label="Meta de cinco questões concluídas" aria-valuenow={Math.min(5, completed)} aria-valuemin={0} aria-valuemax={5}>
          {[0, 1, 2, 3, 4].map((step) => <span key={step} className={completed > step ? "done" : ""} />)}
        </div>
        {completed >= 5 && <Check size={14} aria-label="Meta concluída" />}
      </div>
      <div className="feed-stage">
        {rewardIndex !== null && (
          <AnswerCelebration
            key={rewardIndex}
            label={momentum.streak >= 3 ? `COMBO ${momentum.streak}` : `+${momentum.lastGain} XP`}
            detail={momentum.streak >= 3 ? "Você está no ritmo" : "Conhecimento desbloqueado"}
          />
        )}
        <div
          ref={viewport}
          inert={paused ? true : undefined}
          className="feed-viewport snap-y snap-mandatory"
          aria-label="Feed vertical de questões"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              goTo(activeRef.current + (event.key === "ArrowDown" ? 1 : -1));
            }
          }}
        >
          {items.map((question, index) => (
            <QuestionCard
              key={`${question.id}-${index}`}
              question={question}
              index={index}
              cycle={Math.floor(index / base.length)}
              selected={answers[index]}
              expired={!!expired[index]}
              skipped={!!skipped[index]}
              active={active === index}
              onAnswer={(value) => answer(index, value)}
              onSkip={() => skip(index)}
              onNext={() => {
                viewport.current?.focus({ preventScroll: true });
                goTo(index + 1);
              }}
            />
          ))}
        </div>
        {paused && (
          <div className="feed-paused">
            <Pause size={28} aria-hidden="true" />
            <h3>
              Um respiro também
              <br />
              faz parte.
            </h3>
            <button className="button button-primary" onClick={togglePause}>
              Retomar
              <Play size={16} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      <div className="feed-controls">
        <div className="feed-score">
          <span>
            <Check size={15} aria-hidden="true" />
            {correct} {correct === 1 ? "acerto" : "acertos"}
          </span>
          <span>
            {answered} {answered === 1 ? "respondida" : "respondidas"}
          </span>
        </div>
        <div className="feed-pagination">
          <button
            onClick={() => goTo(active - 1)}
            disabled={active === 0}
            aria-label="Questão anterior"
          >
            <ArrowUp size={18} />
          </button>
          <span>{String(active + 1).padStart(2, "0")}</span>
          <button onClick={() => goTo(active + 1)} aria-label="Próxima questão">
            <ArrowDown size={18} />
          </button>
        </div>
      </div>
      <p className="feed-disclaimer">
        Questões autorais de demonstração. Ao completar a seleção, você entra em
        revisão.
        <ArrowRight size={13} aria-hidden="true" />
      </p>
    </div>
  );
}
