"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clock3,
  Pause,
  Play,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import {
  DIFFICULTIES,
  generateEquation,
  isCorrectAnswer,
  MODES,
  parseAnswer,
} from "@/lib/math/generator";
import type { Equation, GameSettings } from "@/lib/math/generator";
import { advanceMomentum, INITIAL_MOMENTUM } from "@/lib/momentum";
import { AnswerCelebration, MomentumStrip, SoundToggle, useStudySound } from "@/components/study-feedback";

type Attempt = { correct: boolean; seconds: number };
type Round = { equation: Equation; startedAt: number; deadline: number };

export function SoloGame({
  settings,
  onExit,
}: {
  settings: GameSettings;
  onExit: () => void;
}) {
  const duration = DIFFICULTIES[settings.difficulty].seconds;
  const [round, setRound] = useState<Round>(() => {
    const now = Date.now();
    return {
      equation: generateEquation(settings.mode, settings.difficulty),
      startedAt: now,
      deadline: now + duration * 1000,
    };
  });
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<{
    correct: boolean;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState(
    DIFFICULTIES[settings.difficulty].seconds as number,
  );
  const [paused, setPaused] = useState(false);
  const pauseStarted = useRef(0);
  const answered = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const { play } = useStudySound();
  const finished = attempts.length >= settings.rounds && feedback === null;
  const score = attempts.filter((attempt) => attempt.correct).length;
  const momentum = attempts.reduce(
    (previous, attempt) => advanceMomentum(previous, attempt.correct),
    INITIAL_MOMENTUM,
  );

  useEffect(() => {
    if (!round || paused || feedback || finished) return;
    input.current?.focus();
    const timer = window.setInterval(() => {
      const left = Math.max(0, (round.deadline - Date.now()) / 1000);
      setRemaining(left);
      if (left === 0 && !answered.current) {
        answered.current = true;
        setAttempts((previous) => [
          ...previous,
          { correct: false, seconds: duration },
        ]);
        setFeedback({
          correct: false,
          message: `Tempo encerrado. A resposta era ${round.equation.answer}.`,
        });
        play("incorrect");
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, [round, paused, feedback, finished, duration, play]);

  useEffect(() => {
    if (finished) play("complete");
  }, [finished, play]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      setFeedback(null);
      if (attempts.length < settings.rounds) {
        const now = Date.now();
        answered.current = false;
        setAnswer("");
        setError("");
        setRemaining(duration);
        setRound({
          equation: generateEquation(settings.mode, settings.difficulty),
          startedAt: now,
          deadline: now + duration * 1000,
        });
      }
    }, 2300);
    return () => window.clearTimeout(timer);
  }, [feedback, attempts.length, settings, duration]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!round || answered.current || paused) return;
    const value = parseAnswer(answer);
    if (value === null) {
      setError("Digite uma resposta numérica válida.");
      return;
    }
    answered.current = true;
    const timedOut = Date.now() >= round.deadline;
    const correct = !timedOut && isCorrectAnswer(value, round.equation.answer);
    play(correct ? (momentum.streak >= 2 ? "combo" : "correct") : "incorrect");
    setAttempts((previous) => [
      ...previous,
      {
        correct,
        seconds: Math.min(duration, (Date.now() - round.startedAt) / 1000),
      },
    ]);
    setFeedback({
      correct,
      message: timedOut
        ? `Tempo encerrado. A resposta era ${round.equation.answer}.`
        : correct
          ? "É isso. Mais um acerto!"
          : `Quase lá. A resposta era ${round.equation.answer}.`,
    });
    setError("");
  }

  function togglePause() {
    if (!round || feedback) return;
    if (!paused) pauseStarted.current = Date.now();
    else {
      const elapsed = Date.now() - pauseStarted.current;
      setRound({
        ...round,
        startedAt: round.startedAt + elapsed,
        deadline: round.deadline + elapsed,
      });
    }
    setPaused(!paused);
  }

  if (finished) {
    const average =
      attempts.reduce((sum, attempt) => sum + attempt.seconds, 0) /
      attempts.length;
    return (
      <div className="arena result-arena">
        <div className="arena-top">
          <span>TREINO CONCLUÍDO</span>
          <div className="arena-actions"><Trophy size={18} aria-hidden="true" /><SoundToggle /></div>
        </div>
        <div className="result-content">
          <span className="result-icon">
            <Check size={28} aria-hidden="true" />
          </span>
          <p className="eyebrow">CADA TENTATIVA CONTA</p>
          <h3>
            Você foi <em>além.</em>
          </h3>
          <p>
            {score === settings.rounds
              ? "Treino perfeito. Que tal subir a intensidade?"
              : "Seu raciocínio agradece. Continue no seu ritmo."}
          </p>
          <p className="result-momentum">{momentum.xp} XP nesta sessão · melhor sequência: {momentum.best}</p>
          <div className="result-stats">
            <div>
              <strong>
                {score}
                <small>/{settings.rounds}</small>
              </strong>
              <span>acertos</span>
            </div>
            <div>
              <strong>
                {Math.round((score / settings.rounds) * 100)}
                <small>%</small>
              </strong>
              <span>precisão</span>
            </div>
            <div>
              <strong>
                {average.toFixed(1).replace(".", ",")}
                <small>s</small>
              </strong>
              <span>tempo médio</span>
            </div>
          </div>
          <button className="button button-light" onClick={onExit}>
            Preparar outro treino
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="arena active-arena" data-feedback={feedback ? (feedback.correct ? "correct" : "incorrect") : undefined}>
      {feedback?.correct && (
        <AnswerCelebration
          key={round.equation.id}
          label={momentum.streak >= 3 ? `COMBO ${momentum.streak}` : `+${momentum.lastGain} XP`}
          detail={momentum.streak >= 3 ? `+${momentum.lastGain} XP · no ritmo!` : attempts.at(-1)!.seconds <= 3 ? "Raciocínio relâmpago" : "Acertou em cheio"}
        />
      )}
      <div className="arena-top">
        <span>
          <span className="status-dot" />{" "}
          {MODES[settings.mode].label.toUpperCase()}
        </span>
        <div className="arena-actions">
          <SoundToggle />
          <button
            onClick={togglePause}
            disabled={!!feedback}
            aria-label={paused ? "Retomar treino" : "Pausar treino"}
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
          <button onClick={onExit} aria-label="Encerrar treino">
            <X size={19} />
          </button>
        </div>
      </div>
      <MomentumStrip momentum={momentum} />
      <div
        className="game-progress"
        role="progressbar"
        aria-label="Progresso do treino"
        aria-valuenow={attempts.length}
        aria-valuemin={0}
        aria-valuemax={settings.rounds}
      >
        <span
          style={{ width: `${(attempts.length / settings.rounds) * 100}%` }}
        />
      </div>
      {paused ? (
        <div className="paused-content">
          <Pause size={32} aria-hidden="true" />
          <h3>
            Uma pausa para <em>respirar.</em>
          </h3>
          <button className="button button-light" onClick={togglePause}>
            Continuar
            <Play size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div className="game-content">
          <div className="round-heading">
            <span>
              RODADA{" "}
              {Math.min(attempts.length + (feedback ? 0 : 1), settings.rounds)}{" "}
              <span>/ {settings.rounds}</span>
            </span>
            <span className={remaining < 5 ? "timer urgent" : "timer"}>
              <Clock3 size={15} aria-hidden="true" />
              {Math.ceil(remaining)}s
            </span>
          </div>
          <div className={`countdown-track${remaining < 5 ? " urgent" : ""}`} aria-hidden="true">
            <span style={{ transform: `scaleX(${remaining / duration})` }} />
          </div>
          <p className="equation-hint">
            {round?.equation.hint ?? "Preparando seu treino…"}
          </p>
          <h3
            key={round.equation.id}
            className={`live-equation equation-enter${settings.mode === "geometry" ? " geometry-equation" : ""}`}
          >
            {round?.equation.expression ?? "…"}
            {settings.mode !== "linear" && settings.mode !== "geometry" && (
              <span> = ?</span>
            )}
          </h3>
          <form onSubmit={submit} className="answer-form">
            <label className="sr-only" htmlFor="solo-answer">
              Sua resposta
            </label>
            <button
              type="button"
              className="answer-sign"
              aria-label="Alternar sinal da resposta"
              disabled={!!feedback}
              onClick={() => {
                setAnswer((value) =>
                  value.startsWith("-") ? value.slice(1) : `-${value}`,
                );
                input.current?.focus();
              }}
            >
              <span aria-hidden="true">±</span>
            </button>
            <input
              ref={input}
              id="solo-answer"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Sua resposta"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              disabled={!!feedback || !round}
              aria-describedby="solo-feedback"
            />
            <button
              type="submit"
              disabled={!!feedback || !round}
              aria-label="Enviar resposta"
            >
              <ArrowRight size={22} />
            </button>
          </form>
          <div
            id="solo-feedback"
            className={`answer-feedback${feedback ? (feedback.correct ? " correct" : " incorrect") : ""}`}
            role="status"
          >
            {error ||
              feedback?.message ||
              "Digite o resultado e pressione Enter."}
          </div>
          {feedback && (
            <p className="solution-explanation">
              {round?.equation.explanation}
            </p>
          )}
        </div>
      )}
      <div className="arena-bottom">
        <span>{DIFFICULTIES[settings.difficulty].label}</span>
        <span>
          {score} {score === 1 ? "acerto" : "acertos"} no treino
        </span>
      </div>
    </div>
  );
}
