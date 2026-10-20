"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ArrowRight,
  Check,
  Clock3,
  Copy,
  Crown,
  LoaderCircle,
  LogOut,
  Plus,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import { DIFFICULTIES, MODES, parseAnswer } from "@/lib/math/generator";
import type { GameSettings } from "@/lib/math/generator";
import type {
  RoomCommand,
  RoomSession,
  RoomSnapshot,
} from "@/lib/multiplayer/types";
import { AnswerCelebration, SoundToggle, useStudySound } from "@/components/study-feedback";

async function command<T>(body: RoomCommand, token?: string): Promise<T> {
  const response = await fetch("/api/rooms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error ?? "Não foi possível acessar a sala.");
  return data as T;
}

export function MultiplayerGame({
  settings,
  onExit,
}: {
  settings: GameSettings;
  onExit: () => void;
}) {
  const [session, setSession] = useState<RoomSession | null>(null);
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState("");
  const [draft, setDraft] = useState<{ id: string; value: string } | null>(
    null,
  );
  const [wrongAnswer, setWrongAnswer] = useState<{
    id: string;
    message: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(0);
  const offset = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const refresh = useRef<() => void>(() => {});
  const latestRoom = useRef<RoomSnapshot | null>(null);
  const { play } = useStudySound();
  const isHost = room?.hostId === session?.playerId;
  const answer = draft?.id === room?.equation?.id ? (draft?.value ?? "") : "";

  const updateRoom = useCallback((next: RoomSnapshot) => {
    const previous = latestRoom.current;
    if (previous && next.revision < previous.revision) return;
    latestRoom.current = next;
    if (next.status === "finished" && previous?.status !== "finished") play("complete");
    else if (next.reveal && (!previous?.reveal || next.equation?.id !== previous.equation?.id))
      play(next.winnerId === session?.playerId ? "correct" : next.winnerId ? "next" : "incorrect");
    else if (next.status === "playing" && next.equation?.id !== previous?.equation?.id) play("next");
    offset.current = next.serverTime - Date.now();
    setRoom((previous) =>
      !previous || next.revision >= previous.revision ? next : previous,
    );
  }, [play, session?.playerId]);

  useEffect(() => {
    nameInput.current?.focus();
  }, []);

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let client: SupabaseClient | undefined;
    let inFlight = false;
    let queued = false;
    async function poll() {
      if (controller.signal.aborted) return;
      if (inFlight) {
        queued = true;
        return;
      }
      clearTimeout(timer);
      inFlight = true;
      try {
        const response = await fetch(`/api/rooms?code=${session!.room.code}`, {
          headers: { Authorization: `Bearer ${session!.token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setConnection(data.error ?? "Sala indisponível.");
          if ([403, 404].includes(response.status)) {
            controller.abort();
            return;
          }
        } else {
          updateRoom(data.room);
          setConnection("");
        }
      } catch {
        if (controller.signal.aborted) return;
        setConnection("Conexão interrompida. Tentando reconectar…");
      } finally {
        inFlight = false;
      }
      if (!controller.signal.aborted)
        timer = setTimeout(poll, queued ? 100 : 5000);
      queued = false;
    }
    refresh.current = () => {
      void poll();
    };
    if (session.realtime) {
      const config = session.realtime;
      void import("@supabase/supabase-js")
        .then(({ createClient }) => {
          if (controller.signal.aborted) return;
          client = createClient(config.url, config.key, {
            auth: { persistSession: false, autoRefreshToken: false },
          });
          client
            .channel(config.topic)
            .on("broadcast", { event: "room_changed" }, () => {
              void poll();
            })
            .subscribe((status) => {
              if (status === "SUBSCRIBED") void poll();
            });
        })
        .catch(() => {
          /* A sincronização HTTP continua disponível sem WebSocket. */
        });
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
      refresh.current = () => {};
      if (client) void client.removeAllChannels();
    };
  }, [session, updateRoom]);

  const transitionAt =
    room?.status === "playing" ? (room.nextAt ?? room.endsAt) : null;
  useEffect(() => {
    if (transitionAt === null) return;
    const timer = setTimeout(
      () => refresh.current(),
      Math.max(25, transitionAt - Date.now() - offset.current + 50),
    );
    return () => clearTimeout(timer);
  }, [transitionAt]);

  useEffect(() => {
    const timer = window.setInterval(
      () => setNow(Date.now() + offset.current),
      100,
    );
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (room?.status === "playing" && !room.reveal) input.current?.focus();
  }, [room?.equation?.id, room?.status, room?.reveal]);

  async function enter(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await command<RoomSession>(
        joining
          ? { action: "join", code: code.toUpperCase(), name }
          : { action: "create", settings, name },
      );
      setSession(result);
      updateRoom(result.room);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível entrar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    if (!session || !room) return;
    setBusy(true);
    setError("");
    try {
      const data = await command<{ room: RoomSnapshot }>(
        { action: "start", code: room.code },
        session.token,
      );
      updateRoom(data.room);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!session || !room?.equation || busy || room.reveal) return;
    const value = parseAnswer(answer);
    if (value === null) {
      setError("Digite um número válido.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await command<{ room: RoomSnapshot; correct: boolean }>(
        {
          action: "answer",
          code: room.code,
          equationId: room.equation.id,
          answer: value,
        },
        session.token,
      );
      updateRoom(result.room);
      if (!result.correct) {
        play("incorrect");
        setWrongAnswer({
          id: room.equation.id,
          message: "Ainda não. Tente de novo, a rodada continua.",
        });
      }
      setDraft(null);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Não foi possível enviar.",
      );
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  async function leave() {
    if (session && room) {
      try {
        await command({ action: "leave", code: room.code }, session.token);
      } catch {
        /* A saída local continua disponível durante falhas de conexão. */
      }
    }
    onExit();
  }

  async function copyCode() {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room.code);
      setCopied(true);
    } catch {
      setError("Selecione e copie o código da sala abaixo.");
    }
  }

  if (!room || !session)
    return (
      <div className="arena multiplayer-arena">
        <div className="arena-top">
          <span>
            <UsersRound size={15} aria-hidden="true" /> MELHOR COM COMPANHIA
          </span>
          <div className="arena-actions"><SoundToggle /><button
            className="icon-button"
            onClick={onExit}
            aria-label="Fechar multiplayer"
          >
            <X size={19} />
          </button></div>
        </div>
        <div className="room-entry">
          <span className="room-entry-icon">
            <UsersRound size={32} strokeWidth={1.3} aria-hidden="true" />
          </span>
          <h3>
            {joining ? (
              <>
                O desafio está <em>marcado.</em>
              </>
            ) : (
              <>
                Uma sala. Várias <em>mentes.</em>
              </>
            )}
          </h3>
          <p>
            {joining
              ? "Pegue o código com quem criou a sala e entre no jogo."
              : "Chame os amigos. Quem acertar primeiro leva o ponto."}
          </p>
          <form className="room-form" onSubmit={enter}>
            <label htmlFor="player-name">Como podemos chamar você?</label>
            <input
              ref={nameInput}
              id="player-name"
              placeholder="Seu primeiro nome"
              required
              minLength={2}
              maxLength={24}
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="nickname"
            />
            {joining && (
              <>
                <label htmlFor="room-code">Código da sala</label>
                <input
                  id="room-code"
                  className="code-input"
                  placeholder="EX.: A1B2C3"
                  required
                  pattern="[a-fA-F0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(event) =>
                    setCode(event.target.value.toUpperCase())
                  }
                />
              </>
            )}
            <p className="form-error" role="status">
              {error}
            </p>
            <button className="button button-light" disabled={busy}>
              {busy ? (
                <LoaderCircle className="spin" size={17} aria-hidden="true" />
              ) : joining ? (
                "Entrar na sala"
              ) : (
                "Criar minha sala"
              )}
              {!busy &&
                (joining ? (
                  <ArrowRight size={17} aria-hidden="true" />
                ) : (
                  <Plus size={17} aria-hidden="true" />
                ))}
            </button>
          </form>
          <button
            className="text-button"
            onClick={() => {
              setJoining(!joining);
              setError("");
            }}
          >
            {joining ? "Prefiro criar uma sala" : "Já tenho um código de sala"}
            <ArrowRight size={14} aria-hidden="true" />
          </button>
        </div>
        <div className="arena-bottom">
          <span>Até 8 pessoas</span>
          <span>
            {settings.rounds} rodadas ·{" "}
            {DIFFICULTIES[settings.difficulty].label}
          </span>
        </div>
      </div>
    );

  const players = [...room.players].sort((a, b) => b.score - a.score);
  const winners = players.filter(
    (player) => player.score === players[0]?.score,
  );
  const remaining = Math.max(0, Math.ceil((room.endsAt - now) / 1000));
  const winner = room.players.find((player) => player.id === room.winnerId);
  const feedback = room.reveal
    ? winner
      ? `${winner.name} acertou primeiro! +1 ponto.`
      : "Tempo encerrado para esta rodada."
    : wrongAnswer && wrongAnswer.id === room.equation?.id
      ? wrongAnswer.message
      : "O primeiro acerto leva o ponto.";

  return (
    <div className="arena multiplayer-arena" data-feedback={room.reveal && room.winnerId === session.playerId ? "correct" : undefined}>
      {room.reveal && room.winnerId === session.playerId && (
        <AnswerCelebration key={room.equation?.id} label="+1 PONTO" detail="Você chegou primeiro" />
      )}
      <div className="arena-top">
        <button
          className="room-code-button"
          onClick={copyCode}
          aria-label="Copiar código da sala"
        >
          SALA <strong>{room.code}</strong>
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
        <div className="arena-actions"><SoundToggle /><button
          className="icon-button"
          onClick={leave}
          aria-label="Sair da sala"
        >
          <LogOut size={18} />
        </button></div>
      </div>
      {connection && (
        <p className="connection-message" role="status">
          {connection}
        </p>
      )}
      {room.status === "waiting" ? (
        <div className="lobby-content">
          <p className="eyebrow">O PRÓXIMO DESAFIO É EM EQUIPE</p>
          <h3>
            Quem vai mais <em>rápido?</em>
          </h3>
          <p>
            Compartilhe o código{" "}
            <strong className="selectable-code">{room.code}</strong> e espere a
            turma chegar.
          </p>
          <div className="lobby-players">
            {room.players.map((player) => (
              <div key={player.id}>
                <span className="player-avatar">
                  {player.name.charAt(0).toUpperCase()}
                </span>
                <span>
                  {player.name}
                  {player.id === session.playerId ? " (você)" : ""}
                </span>
                {player.id === room.hostId ? (
                  <Crown size={16} aria-label="Host" />
                ) : (
                  <span className="player-ready">pronto</span>
                )}
              </div>
            ))}
          </div>
          <p className="room-summary">
            {MODES[room.settings.mode].label} ·{" "}
            {DIFFICULTIES[room.settings.difficulty].label} ·{" "}
            {room.settings.rounds} rodadas
          </p>
          {isHost ? (
            <button
              className="button button-light"
              onClick={start}
              disabled={busy || room.players.length < 2}
            >
              Começar a partida
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          ) : (
            <p className="waiting-message">
              <LoaderCircle size={15} className="spin" aria-hidden="true" />{" "}
              Aguardando o host iniciar…
            </p>
          )}
          <p className="form-error" role="status">
            {error}
          </p>
        </div>
      ) : room.status === "finished" ? (
        <div className="multiplayer-result">
          <Trophy size={34} aria-hidden="true" />
          <p className="eyebrow">PARTIDA CONCLUÍDA</p>
          <h3>
            {winners.length > 1
              ? "Deu empate."
              : `${winners[0]?.name} levou essa.`}
          </h3>
          <p>O melhor resultado é continuar praticando.</p>
          <div className="leaderboard">
            {players.map((player, index) => (
              <div key={player.id}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>
                  {player.name}
                  {player.id === session.playerId ? " (você)" : ""}
                </strong>
                <b>{player.score} pts</b>
              </div>
            ))}
          </div>
          {isHost && (
            <button
              className="button button-light"
              onClick={start}
              disabled={busy || room.players.length < 2}
            >
              Jogar de novo
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          )}
          <p className="form-error" role="status">
            {error}
          </p>
        </div>
      ) : (
        <div className="game-content">
          <div className="round-heading">
            <span>
              RODADA {room.round} <span>/ {room.settings.rounds}</span>
            </span>
            <span className={remaining < 5 ? "timer urgent" : "timer"}>
              <Clock3 size={15} aria-hidden="true" />
              {Math.min(
                remaining,
                DIFFICULTIES[room.settings.difficulty].seconds,
              )}
              s
            </span>
          </div>
          <div className={`countdown-track${remaining < 5 ? " urgent" : ""}`} aria-hidden="true">
            <span style={{ transform: `scaleX(${Math.min(1, remaining / DIFFICULTIES[room.settings.difficulty].seconds)})` }} />
          </div>
          <p className="equation-hint">{room.equation?.hint}</p>
          <h3
            key={room.equation?.id}
            className={`live-equation equation-enter${room.settings.mode === "geometry" ? " geometry-equation" : ""}`}
          >
            {room.equation?.expression}
          </h3>
          <form onSubmit={submit} className="answer-form">
            <label htmlFor="multiplayer-answer" className="sr-only">
              Sua resposta
            </label>
            <button
              type="button"
              className="answer-sign"
              aria-label="Alternar sinal da resposta"
              disabled={!!room.reveal || busy || !!connection}
              onClick={() => {
                if (!room.equation) return;
                setDraft({
                  id: room.equation.id,
                  value: answer.startsWith("-")
                    ? answer.slice(1)
                    : `-${answer}`,
                });
                input.current?.focus();
              }}
            >
              <span aria-hidden="true">±</span>
            </button>
            <input
              ref={input}
              key={room.equation?.id}
              id="multiplayer-answer"
              inputMode="decimal"
              autoComplete="off"
              placeholder="Sua resposta"
              value={answer}
              onChange={(event) =>
                setDraft({ id: room.equation!.id, value: event.target.value })
              }
              disabled={!!room.reveal || busy || !!connection}
            />
            <button
              type="submit"
              disabled={!!room.reveal || busy || !!connection}
              aria-label="Enviar resposta"
            >
              <ArrowRight size={22} />
            </button>
          </form>
          <p
            className={`answer-feedback${room.reveal ? (winner ? " correct" : " incorrect") : ""}`}
            role="status"
          >
            {error || feedback}
          </p>
          {room.reveal && (
            <p className="solution-explanation">{room.reveal.explanation}</p>
          )}
          <div className="live-scores">
            {players.map((player) => (
              <span key={player.id} className={room.winnerId === player.id ? "round-winner" : ""}>
                {player.name}
                <b key={player.score}>{player.score}</b>
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="arena-bottom">
        <span>
          <span className="status-dot" /> {room.players.length} na sala
        </span>
        <span>{MODES[room.settings.mode].label}</span>
      </div>
    </div>
  );
}
