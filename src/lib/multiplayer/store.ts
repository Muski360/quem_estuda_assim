import { randomBytes } from "node:crypto";
import {
  DIFFICULTIES,
  generateEquation,
  isCorrectAnswer,
} from "../math/generator.ts";
import type { Equation, GameSettings } from "../math/generator.ts";
import type { Player, RoomSession, RoomSnapshot } from "./types.ts";

type Room = {
  code: string;
  hostId: string;
  settings: GameSettings;
  players: (Player & { token: string; lastAnswer: number })[];
  status: RoomSnapshot["status"];
  round: number;
  equation: Equation | null;
  endsAt: number;
  winnerId: string | null;
  nextAt: number | null;
  expiresAt: number;
};

const globalRooms = globalThis as typeof globalThis & {
  studyRooms?: Map<string, Room>;
};
// shortcut: memória de uma instância; use Redis ou Supabase ao distribuir o servidor.
const rooms = (globalRooms.studyRooms ??= new Map<string, Room>());

export class RoomError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function playerName(value: string) {
  const name = value.trim();
  if (name.length < 2 || name.length > 24)
    throw new RoomError("Use um nome de 2 a 24 caracteres.");
  return name;
}

function nextRound(room: Room, now: number) {
  room.round += 1;
  room.equation = generateEquation(
    room.settings.mode,
    room.settings.difficulty,
  );
  room.endsAt = now + DIFFICULTIES[room.settings.difficulty].seconds * 1000;
  room.winnerId = null;
  room.nextAt = null;
}

function tick(room: Room, now: number) {
  if (room.status !== "playing") return;
  if (room.nextAt === null && now >= room.endsAt) room.nextAt = now + 1800;
  if (room.nextAt !== null && now >= room.nextAt) {
    if (room.round >= room.settings.rounds) room.status = "finished";
    else nextRound(room, now);
  }
}

function snapshot(room: Room, now = Date.now()): RoomSnapshot {
  tick(room, now);
  const { equation } = room;
  return {
    code: room.code,
    hostId: room.hostId,
    settings: room.settings,
    players: room.players.map(({ id, name, score }) => ({ id, name, score })),
    status: room.status,
    round: room.round,
    equation: equation
      ? {
          id: equation.id,
          expression: equation.expression,
          hint: equation.hint,
        }
      : null,
    endsAt: room.endsAt,
    winnerId: room.winnerId,
    reveal:
      equation && room.nextAt !== null
        ? { answer: equation.answer, explanation: equation.explanation }
        : null,
    serverTime: now,
  };
}

function authorized(code: string, token: string) {
  const room = rooms.get(code.toUpperCase());
  if (!room || room.expiresAt <= Date.now()) {
    rooms.delete(code.toUpperCase());
    throw new RoomError(
      "Sala não encontrada ou expirada. Crie uma nova sala.",
      404,
    );
  }
  const player = room.players.find((item) => item.token === token);
  if (!player) throw new RoomError("Sua sessão não pertence a esta sala.", 403);
  room.expiresAt = Date.now() + 60 * 60 * 1000;
  tick(room, Date.now());
  return { room, player };
}

export function createRoom(name: string, settings: GameSettings): RoomSession {
  for (const [code, room] of rooms)
    if (room.expiresAt <= Date.now()) rooms.delete(code);
  if (rooms.size >= 200)
    throw new RoomError(
      "Todas as salas estão ocupadas. Tente mais tarde.",
      503,
    );
  let code: string;
  do {
    code = randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));
  const player = {
    id: crypto.randomUUID(),
    token: randomBytes(24).toString("hex"),
    name: playerName(name),
    score: 0,
    lastAnswer: 0,
  };
  const room: Room = {
    code,
    hostId: player.id,
    settings: { ...settings },
    players: [player],
    status: "waiting",
    round: 0,
    equation: null,
    endsAt: 0,
    winnerId: null,
    nextAt: null,
    expiresAt: Date.now() + 60 * 60 * 1000,
  };
  rooms.set(code, room);
  return { token: player.token, playerId: player.id, room: snapshot(room) };
}

export function joinRoom(code: string, name: string): RoomSession {
  const room = rooms.get(code.toUpperCase());
  if (!room || room.expiresAt <= Date.now())
    throw new RoomError("Sala não encontrada ou expirada.", 404);
  if (room.status !== "waiting")
    throw new RoomError("Esta partida já começou.");
  if (room.players.length >= 8)
    throw new RoomError("A sala está cheia (máximo de 8 pessoas).");
  const player = {
    id: crypto.randomUUID(),
    token: randomBytes(24).toString("hex"),
    name: playerName(name),
    score: 0,
    lastAnswer: 0,
  };
  room.players.push(player);
  return { token: player.token, playerId: player.id, room: snapshot(room) };
}

export function readRoom(code: string, token: string) {
  return snapshot(authorized(code, token).room);
}

export function startRoom(code: string, token: string) {
  const { room, player } = authorized(code, token);
  if (player.id !== room.hostId)
    throw new RoomError("Só o host pode começar a partida.", 403);
  if (room.status === "playing") throw new RoomError("A partida já começou.");
  if (room.players.length < 2)
    throw new RoomError("Convide pelo menos mais uma pessoa.");
  room.players.forEach((item) => {
    item.score = 0;
  });
  room.round = 0;
  room.status = "playing";
  nextRound(room, Date.now());
  return snapshot(room);
}

export function answerRoom(
  code: string,
  token: string,
  equationId: string,
  answer: number,
) {
  const { room, player } = authorized(code, token);
  if (
    room.status !== "playing" ||
    room.nextAt !== null ||
    room.equation?.id !== equationId
  ) {
    throw new RoomError("Esta rodada já foi encerrada.", 409);
  }
  if (!Number.isFinite(answer)) throw new RoomError("Digite um número válido.");
  if (Date.now() - player.lastAnswer < 150)
    throw new RoomError("Aguarde um instante entre respostas.", 429);
  player.lastAnswer = Date.now();
  const correct = isCorrectAnswer(answer, room.equation.answer);
  if (correct) {
    player.score += 1;
    room.winnerId = player.id;
    room.nextAt = Date.now() + 1800;
  }
  return { room: snapshot(room), correct };
}

export function leaveRoom(code: string, token: string) {
  const { room, player } = authorized(code, token);
  room.players = room.players.filter((item) => item.id !== player.id);
  if (room.players.length === 0) rooms.delete(room.code);
  else {
    if (room.hostId === player.id) room.hostId = room.players[0].id;
    if (room.status === "playing" && room.players.length < 2)
      room.status = "finished";
  }
}
