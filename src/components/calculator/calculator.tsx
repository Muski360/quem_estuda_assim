"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Flame,
  Focus,
  GalleryVerticalEnd,
  MoveRight,
  Shuffle,
  UserRound,
  UsersRound,
  Zap,
} from "lucide-react";
import { DEFAULT_SETTINGS, DIFFICULTIES, getSelectedModes, getQuestionSeconds, MODES } from "@/lib/math/generator";
import { getXpMultiplier, roundXp } from "@/lib/momentum";
import type { Difficulty, GameSettings, MathMode } from "@/lib/math/generator";
import { SoloGame } from "./solo-game";
import { MultiplayerGame } from "./multiplayer-game";
import { SoundToggle, useStudySound } from "@/components/study-feedback";
import { GeometryViewer } from "./geometry-viewer";

export function Calculator() {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [multiplayer, setMultiplayer] = useState(false);
  const [session, setSession] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [roomOpen, setRoomOpen] = useState(false);
  const locked = playing || roomOpen;
  const { play } = useStudySound();
  const modes = getSelectedModes(settings.mode);
  const previewMode = modes[0];

  function start() {
    play("next");
    if (multiplayer) setRoomOpen(true);
    else {
      setSession((value) => value + 1);
      setPlaying(true);
    }
  }

  return (
    <>
      <section className="training-section" aria-labelledby="calculator-title">
        <div className="section-heading">
          <div className="section-name">
            <span className="section-index">01</span>
            <h2 id="calculator-title">
              Quem calcula assim<span>?</span>
            </h2>
            <span className="section-label">ACERTO RÁPIDO. XP ALTO.</span>
          </div>
          <span className="section-caption">
            <Zap size={14} aria-hidden="true" /> Pense rápido. Vá além.
          </span>
        </div>
        <div className="training-grid">
          <div className="settings-panel">
            <div className="panel-title">
              <h3>Seu treino, suas regras.</h3>
              <span>01—03</span>
            </div>
            <fieldset className="settings-fields" disabled={locked}>
              <legend className="sr-only">Configurar treino</legend>
              <div
                className="segmented game-type"
                role="group"
                aria-label="Modalidade de jogadores"
              >
                <button
                  type="button"
                  className={!multiplayer ? "selected" : ""}
                  aria-pressed={!multiplayer}
                  onClick={() => setMultiplayer(false)}
                >
                  <UserRound size={15} aria-hidden="true" /> Solo
                </button>
                <button
                  type="button"
                  className={multiplayer ? "selected" : ""}
                  aria-pressed={multiplayer}
                  onClick={() => setMultiplayer(true)}
                >
                  <UsersRound size={16} aria-hidden="true" /> Com amigos
                </button>
              </div>
              <div className="field-heading">
                <span>01</span>
                <h4>O que vamos praticar?</h4>
              </div>
              <div
                className="mode-options"
                role="group"
                aria-label="Conteúdo matemático"
                aria-describedby="mode-selection-help"
              >
                {(
                  Object.entries(MODES) as [
                    MathMode,
                    (typeof MODES)[MathMode],
                  ][]
                ).map(([mode, details]) => (
                  <button
                    type="button"
                    key={mode}
                    className={`mode-option${modes.includes(mode) ? " selected" : ""}`}
                    aria-pressed={modes.includes(mode)}
                    aria-disabled={modes.length === 1 && modes.includes(mode)}
                    onClick={() => {
                      const selected = modes.includes(mode)
                        ? modes.filter((item) => item !== mode)
                        : [...modes, mode];
                      if (selected.length) setSettings({ ...settings, mode: selected });
                    }}
                  >
                    <span className={`math-symbol ${mode}`}>
                      {details.symbol}
                    </span>
                    <span className="mode-copy">
                      <strong>{details.label}</strong>
                      <small>{details.description}</small>
                    </span>
                    <span className="radio-indicator mode-checkbox">
                      {modes.includes(mode) && (
                        <Check size={10} strokeWidth={3} aria-hidden="true" />
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <p id="mode-selection-help" className="mode-selection-help">
                <strong>{modes.length} {modes.length === 1 ? "selecionado" : "selecionados"}</strong>
                Marque um ou mais. As rodadas intercalam os conteúdos.
              </p>
              <div className="field-heading">
                <span>02</span>
                <h4>Escolha a intensidade</h4>
              </div>
              <div
                className="difficulty-options"
                role="group"
                aria-label="Dificuldade"
              >
                {(
                  Object.entries(DIFFICULTIES) as [
                    Difficulty,
                    (typeof DIFFICULTIES)[Difficulty],
                  ][]
                ).map(([difficulty, details], index) => (
                  <button
                    type="button"
                    key={difficulty}
                    className={
                      settings.difficulty === difficulty ? "selected" : ""
                    }
                    aria-pressed={settings.difficulty === difficulty}
                    onClick={() => setSettings({ ...settings, difficulty })}
                  >
                    <span className="level-bars" aria-hidden="true">
                      {[0, 1, 2, 3].map((bar) => (
                        <i key={bar} className={bar <= index ? "filled" : ""} />
                      ))}
                    </span>
                    {details.label}
                  </button>
                ))}
              </div>
              <div className="rounds-field">
                <label htmlFor="rounds">
                  <span className="field-number">03</span> {multiplayer ? "Acertos para vencer" : "Quantas rodadas?"}
                </label>
                <div className="select-wrap">
                  <select
                    id="rounds"
                    value={settings.rounds}
                    onChange={(event) =>
                      setSettings({
                        ...settings,
                        rounds: Number(event.target.value),
                      })
                    }
                  >
                    {[5, 10, 20, 30].map((rounds) => (
                      <option key={rounds} value={rounds}>
                        {rounds} {multiplayer ? "acertos" : "rodadas"}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} aria-hidden="true" />
                </div>
              </div>
              <div className="minutes-field math-timer-field">
                <label htmlFor="question-seconds">Segundos por questão</label>
                <input key={settings.difficulty} id="question-seconds" type="number" min={5} max={180} step={1}
                  defaultValue={getQuestionSeconds(settings)}
                  onChange={(event) => {
                    const seconds=Number(event.target.value);
                    if (Number.isInteger(seconds) && seconds>=5 && seconds<=180) setSettings({...settings,seconds});
                  }}
                  onBlur={(event) => {
                    const seconds=Math.max(5,Math.min(180,Math.floor(Number(event.target.value)) || getQuestionSeconds(settings)));
                    event.target.value=String(seconds);
                    setSettings({...settings,seconds});
                  }} />
              </div>
              <p className="mode-selection-help"><strong>{getXpMultiplier(getQuestionSeconds(settings), DIFFICULTIES[settings.difficulty].seconds)}× XP</strong>Até {roundXp(0,settings)} XP por acerto. Mais tempo reduz o multiplicador.</p>
            </fieldset>
            <button
              className="button button-primary start-button"
              onClick={start}
              disabled={locked}
            >
              {multiplayer ? "Preparar minha sala" : "Começar meu treino"}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <p className="settings-note">
              {locked
                ? "Finalize a sessão para ajustar seu próximo treino."
                : multiplayer
                  ? "Cada um na sua pista. Quem atingir a meta de acertos vence."
                  : "Só você, os números e sua melhor versão."}
            </p>
          </div>
          <div className="arena-column">
            {roomOpen ? (
              <MultiplayerGame
                settings={settings}
                onExit={() => setRoomOpen(false)}
              />
            ) : playing ? (
              <SoloGame
                key={session}
                settings={settings}
                onExit={() => setPlaying(false)}
              />
            ) : (
              <div className="arena arena-preview">
                <div className="arena-top">
                  <span>
                    <span className="status-dot" /> SUA MENTE EM MOVIMENTO
                  </span>
                  <div className="arena-actions"><span className="arena-tag">PRÉVIA DO TREINO</span><SoundToggle /></div>
                </div>
                <div className="preview-content">
                  <span className="orbital-note">{roundXp(0,settings)} XP na largada. Quanto você leva?</span>
                  {modes.length > 1 ? (
                    <div className="mixed-preview">
                      <Shuffle size={26} aria-hidden="true" />
                      <span>TREINO COMBINADO</span>
                      <ul>{modes.map((mode) => <li key={mode}>{MODES[mode].label}</li>)}</ul>
                    </div>
                  ) : previewMode === "geometry" ? (
                    <GeometryViewer figure={{ shape: "cube", side: 4 }} />
                  ) : <div className="equation-orbit" aria-hidden="true">
                    <span className="orbit-point" />
                    <div className="preview-equation">
                      {previewMode === "basic" ? (
                        <>
                          24 <span>×</span> 7
                        </>
                      ) : previewMode === "powers" ? (
                        <>
                          √<span>144</span>
                        </>
                      ) : previewMode === "linear" ? (
                        <>
                          3x + 6 <span>=</span> 21
                        </>
                      ) : (
                        <>
                          log₂<span>(32)</span>
                        </>
                      )}
                    </div>
                    <span className="orbit-equals">= ?</span>
                  </div>}
                  <h3>
                    Seu cérebro gosta
                    <br />
                    de um bom <em>desafio.</em>
                  </h3>
                  <p>
                    O XP diminui a cada segundo.
                    <br />Acerte antes que a energia acabe.
                  </p>
                  <button className="preview-start" onClick={start}>
                    {multiplayer ? "Jogar com amigos" : "Vamos nessa"}
                    <MoveRight size={18} aria-hidden="true" />
                  </button>
                </div>
                <div className="arena-bottom">
                  <span>
                    <span className="keyboard-key">↵</span> responda com Enter
                  </span>
                  <span>
                    {getQuestionSeconds(settings)}s por questão
                  </span>
                </div>
              </div>
            )}
            <div className="training-benefits">
              <div>
                <Shuffle size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  <strong>Sempre diferente</strong>
                  <small>Contas geradas a cada rodada</small>
                </span>
              </div>
              <div>
                <Focus size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  <strong>Foco no raciocínio</strong>
                  <small>Menos papel, mais agilidade</small>
                </span>
              </div>
              <div>
                <Flame size={18} strokeWidth={1.5} aria-hidden="true" />
                <span>
                  <strong>Evolução na prática</strong>
                  <small>Um acerto de cada vez</small>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
      <Link href="/scrolla" className="scroll-promo">
        <div className="promo-icon">
          <GalleryVerticalEnd size={27} strokeWidth={1.4} aria-hidden="true" />
        </div>
        <div className="promo-copy">
          <span className="eyebrow">QUEM SCROLLA ASSIM?</span>
          <h2>
            Seu próximo scroll pode valer <em>um acerto.</em>
          </h2>
          <p>
            Questões, descobertas e aquele “agora entendi”. Tudo em um feed.
          </p>
        </div>
        <span className="promo-cta">
          Explorar o feed <ArrowUpRight size={19} aria-hidden="true" />
        </span>
      </Link>
    </>
  );
}
