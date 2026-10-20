"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CSSProperties, ReactNode } from "react";
import { Check, Flame, Volume2, VolumeX, Zap } from "lucide-react";
import { usePathname } from "next/navigation";
import type { Momentum } from "@/lib/momentum";
import { MAX_ROUND_XP } from "@/lib/momentum";

type Cue = "correct" | "combo" | "incorrect" | "next" | "complete" | "tick";
const NOTES: Record<Cue, number[]> = {
  correct: [659, 880, 1109],
  combo: [659, 880, 1109, 1319],
  incorrect: [220, 165],
  next: [440, 554],
  complete: [523, 659, 784, 1047],
  tick: [440],
};

const SoundContext = createContext<{
  enabled: boolean;
  unavailable: boolean;
  toggle: () => void;
  play: (cue: Cue) => void;
} | null>(null);

export function StudyFeedbackProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const audio = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const sources = useRef(new Set<OscillatorNode>());
  const pathname = usePathname();

  const stop = useCallback(() => {
    for (const source of sources.current) source.stop();
    sources.current.clear();
  }, []);

  const play = useCallback((cue: Cue) => {
    const engine = audio.current;
    if (!engine || !engine.gain.gain.value || document.hidden) return;
    if (engine.context.state !== "running") {
      void engine.context.resume().catch(() => {});
      return;
    }
    const start = engine.context.currentTime;
    NOTES[cue].forEach((frequency, index) => {
      const oscillator = engine.context.createOscillator();
      const envelope = engine.context.createGain();
      const time = start + index * (cue === "next" ? 0.04 : 0.075);
      oscillator.frequency.value = frequency;
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(cue === "tick" ? 0.35 : 1, time + 0.008);
      envelope.gain.exponentialRampToValueAtTime(0.001, time + (cue === "tick" ? 0.06 : 0.16));
      oscillator.connect(envelope);
      envelope.connect(engine.gain);
      sources.current.add(oscillator);
      oscillator.onended = () => {
        sources.current.delete(oscillator);
        oscillator.disconnect();
        envelope.disconnect();
      };
      oscillator.start(time);
      oscillator.stop(time + (cue === "tick" ? 0.08 : 0.18));
    });
  }, []);

  async function toggle() {
    if (enabled) {
      if (audio.current) audio.current.gain.gain.value = 0;
      stop();
      setEnabled(false);
      return;
    }
    try {
      if (!audio.current) {
        const context = new AudioContext();
        const gain = context.createGain();
        gain.gain.value = 0;
        gain.connect(context.destination);
        audio.current = { context, gain };
      }
      await audio.current.context.resume();
      audio.current.gain.gain.value = 0.045;
      setEnabled(true);
      play("next");
    } catch {
      setUnavailable(true);
    }
  }

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) stop();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [stop]);

  useEffect(() => stop(), [pathname, stop]);
  useEffect(() => {
    return () => {
      stop();
      void audio.current?.context.close();
    };
  }, [stop]);

  return (
    <SoundContext.Provider value={{ enabled, unavailable, toggle, play }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useStudySound() {
  const sound = useContext(SoundContext);
  if (!sound) throw new Error("StudyFeedbackProvider ausente.");
  return sound;
}

export function SoundToggle() {
  const { enabled, unavailable, toggle } = useStudySound();
  const label = unavailable
    ? "Som indisponível neste navegador"
    : enabled ? "Desativar sons" : "Ativar sons";
  return (
    <button
      type="button"
      className={`icon-button sound-toggle${enabled ? " sound-on" : ""}`}
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={enabled}
      disabled={unavailable}
    >
      {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
    </button>
  );
}

export function MomentumStrip({ momentum }: { momentum: Momentum }) {
  return (
    <div className={`momentum-strip${momentum.streak >= 3 ? " is-combo" : ""}`}>
      <span className="momentum-streak">
        <Flame size={17} aria-hidden="true" />
        <strong key={momentum.streak}>{momentum.streak}</strong>
        <span>{momentum.streak >= 3 ? "COMBO" : "em sequência"}</span>
        <span className="combo-pips" aria-hidden="true">
          {[1, 2, 3].map((pip) => (
            <i key={pip} className={momentum.streak >= pip ? "filled" : ""} />
          ))}
        </span>
      </span>
      <span className="momentum-xp" title="XP acumulado nesta sessão.">
        <Zap size={13} aria-hidden="true" />
        <strong key={momentum.xp}>{momentum.xp}</strong> XP <span>na sessão</span>
      </span>
    </div>
  );
}

export function XpCountdown({ available, active, maximum = MAX_ROUND_XP }: { available: number; active: boolean; maximum?: number }) {
  const { play } = useStudySound();
  useEffect(() => {
    if (active && available > 0 && available <= 5) play("tick");
  }, [available, active, play]);

  const ratio = available / maximum;
  const energy = ratio >= .7 ? "high" : ratio >= .35 ? "medium" : "low";
  return (
    <div className="xp-race" data-energy={energy} data-active={active}>
      <div className="xp-race-heading">
        <span><Zap size={14} aria-hidden="true" />{active ? "XP VALENDO AGORA" : "XP DESTA RODADA"}</span>
        <span>{active ? `Até ${maximum} XP · cai a cada segundo` : "Rodada encerrada"}</span>
      </div>
      <div className="xp-race-score">
        <strong key={available} aria-label={`${available} XP ${active ? "disponíveis" : "conquistados"}`}>
          {String(available).padStart(2, "0")}<small>XP</small>
        </strong>
        <span>{!active ? "RODADA ENCERRADA" : ratio >= .7 ? "PENSE RÁPIDO" : available > 0 ? "CADA SEGUNDO CONTA" : "VALE O APRENDIZADO"}</span>
      </div>
      <div className="xp-energy" aria-hidden="true">
        {Array.from({ length: MAX_ROUND_XP }, (_, index) => (
          <i key={index} className={index / MAX_ROUND_XP < ratio ? "charged" : ""} />
        ))}
      </div>
    </div>
  );
}

export function AnswerCelebration({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  return (
    <div className="answer-celebration" aria-hidden="true">
      <span className="celebration-ring" />
      {Array.from({ length: 12 }, (_, index) => (
        <i
          key={index}
          className="celebration-particle"
          style={{
            "--angle": `${index * 30}deg`,
            "--travel": `${65 + (index % 3) * 18}px`,
          } as CSSProperties}
        />
      ))}
      <span className="celebration-label">
        <Check size={16} />{label}
      </span>
      <small>{detail}</small>
    </div>
  );
}
