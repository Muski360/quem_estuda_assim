import { randomBytes } from "node:crypto";
import { generateRound, getQuestionSeconds, getSelectedModes, isCorrectAnswer, isGameSettings } from "../math/generator.ts";
import type { Equation, GameSettings } from "../math/generator.ts";
import type { Player, RoomSession, RoomSnapshot } from "./types.ts";
import { roundXp } from "../momentum.ts";

type Racer = Player & {
  token: string;
  lastAnswer: number;
  questionIndex: number;
  equation: Equation | null;
  startedAt: number;
  endsAt: number;
  nextAt: number | null;
  reveal: RoomSnapshot["reveal"];
  wrongAt: number[];
  cooldownUntil: number;
};
export type Room = {
  version: 2;
  channelId: string;
  code: string;
  hostId: string;
  settings: GameSettings;
  players: Racer[];
  status: RoomSnapshot["status"];
  winnerId: string | null;
  expiresAt: number;
};

export class RoomError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status=status; }
}

function playerName(value: string) {
  const name = value.trim();
  if (name.length < 2 || name.length > 24) throw new RoomError("Use um nome de 2 a 24 caracteres.");
  return name;
}

function racer(name: string): Racer {
  return {
    id: crypto.randomUUID(), token: randomBytes(24).toString("hex"), name: playerName(name),
    score: 0, xp: 0, lastAnswer: 0, questionIndex: -1, equation: null, startedAt: 0,
    endsAt: 0, nextAt: null, reveal: null, wrongAt: [], cooldownUntil: 0,
  };
}

function nextQuestion(room: Room, player: Racer, now: number) {
  player.questionIndex += 1;
  player.equation = generateRound(room.settings, player.questionIndex);
  player.startedAt = now;
  player.endsAt = now + getQuestionSeconds(room.settings) * 1000;
  player.reveal = null;
  player.nextAt = null;
}

// Existing JSON rooms keep their sessions, scores and XP across the race upgrade.
function upgrade(room: Room) {
  if (room.version === 2) return room;
  const legacy = room as Room & { equation?: Equation; endsAt?: number; round?: number };
  for (const player of room.players) {
    Object.assign(player, {
      xp: player.xp ?? 0, questionIndex: Math.max(0, (legacy.round ?? 1) - 1),
      equation: legacy.equation ?? null, startedAt: (legacy.endsAt ?? Date.now()) - getQuestionSeconds(room.settings)*1000,
      endsAt: legacy.endsAt ?? 0, nextAt: null, reveal: null, wrongAt: [], cooldownUntil: 0,
    });
  }
  room.version = 2;
  room.winnerId = room.status === "finished" ? [...room.players].sort((a,b)=>b.score-a.score)[0]?.id ?? null : null;
  return room;
}

function tick(room: Room, now: number) {
  if (room.status !== "playing") return;
  for (const player of room.players) {
    if (player.nextAt !== null && now >= player.nextAt) nextQuestion(room, player, now);
    else if (player.nextAt === null && now >= player.endsAt && player.equation) {
      player.reveal = {answer:player.equation.answer, factor:player.equation.factor, explanation:player.equation.explanation, xp:0, correct:false};
      player.nextAt = now + 1800;
    }
  }
}

function snapshot(room: Room, player: Racer, now = Date.now()): RoomSnapshot {
  const equation = player.equation;
  return {
    revision: 0, code: room.code, hostId: room.hostId, settings: room.settings,
    players: room.players.map(({id,name,score,xp})=>({id,name,score,xp})),
    status: room.status, round: player.questionIndex + 1,
    equation: equation ? {
      id:equation.id, mode:equation.mode ?? getSelectedModes(room.settings.mode)[0],
      expression:equation.expression, hint:equation.hint,
      ...(equation.geometry ? {geometry:equation.geometry} : {}),
      ...(equation.factor ? {factor:equation.factor} : {}),
    } : null,
    endsAt:player.endsAt, nextAt:player.nextAt, cooldownUntil:player.cooldownUntil,
    winnerId:room.winnerId, reveal:player.reveal, serverTime:now,
  };
}

export function createRoomEngine(initial?: Room) {
  const rooms = new Map<string, Room>();
  if (initial) rooms.set(initial.code, upgrade(initial));
  function authorized(code: string, token: string) {
    const room = rooms.get(code.toUpperCase());
    const now = Date.now();
    if (!room || room.expiresAt <= now) {
      rooms.delete(code.toUpperCase());
      throw new RoomError("Sala não encontrada ou expirada. Crie uma nova sala.",404);
    }
    const player = room.players.find((item)=>item.token === token);
    if (!player) throw new RoomError("Sua sessão não pertence a esta sala.",403);
    room.expiresAt = now + 60*60*1000;
    tick(room,now);
    return {room,player,now};
  }

  function createRoom(name: string, settings: GameSettings): RoomSession {
    if (!isGameSettings(settings)) throw new RoomError("Configuração de partida inválida.");
    for (const [code,room] of rooms) if (room.expiresAt <= Date.now()) rooms.delete(code);
    if (rooms.size >= 200) throw new RoomError("Todas as salas estão ocupadas. Tente mais tarde.",503);
    let code: string;
    do { code = randomBytes(3).toString("hex").toUpperCase(); } while (rooms.has(code));
    const player = racer(name);
    const room: Room = {
      version:2, code, channelId:crypto.randomUUID(), hostId:player.id, settings:{...settings},
      players:[player], status:"waiting", winnerId:null, expiresAt:Date.now()+60*60*1000,
    };
    rooms.set(code,room);
    return {token:player.token,playerId:player.id,room:snapshot(room,player)};
  }

  function joinRoom(code: string, name: string): RoomSession {
    const room = rooms.get(code.toUpperCase());
    if (!room || room.expiresAt <= Date.now()) throw new RoomError("Sala não encontrada ou expirada.",404);
    if (room.status !== "waiting") throw new RoomError("Esta partida já começou.");
    if (room.players.length >= 8) throw new RoomError("A sala está cheia (máximo de 8 pessoas).");
    const player = racer(name);
    room.players.push(player);
    return {token:player.token,playerId:player.id,room:snapshot(room,player)};
  }

  function readRoom(code: string, token: string) {
    const {room,player,now}=authorized(code,token);
    return snapshot(room,player,now);
  }

  function startRoom(code: string, token: string) {
    const {room,player,now}=authorized(code,token);
    if (player.id !== room.hostId) throw new RoomError("Só o host pode começar a partida.",403);
    if (room.status === "playing") throw new RoomError("A partida já começou.");
    if (room.players.length < 2) throw new RoomError("Convide pelo menos mais uma pessoa.");
    for (const item of room.players) {
      Object.assign(item,{score:0,xp:0,questionIndex:-1,wrongAt:[],cooldownUntil:0,lastAnswer:0});
      nextQuestion(room,item,now);
    }
    room.status="playing";
    room.winnerId=null;
    return snapshot(room,player,now);
  }

  function active(room: Room, player: Racer, equationId: string, now: number) {
    if (room.status !== "playing" || player.nextAt !== null || now >= player.endsAt || player.equation?.id !== equationId)
      throw new RoomError("Esta questão já foi encerrada.",409);
    return player.equation;
  }

  function answerRoom(code: string, token: string, equationId: string, answer: number) {
    const {room,player,now}=authorized(code,token);
    const equation=active(room,player,equationId,now);
    if (!Number.isFinite(answer)) throw new RoomError("Digite um número válido.");
    if (now < player.cooldownUntil) throw new RoomError("Bloqueio por excesso de erros. Aguarde 5 segundos.",429);
    if (now-player.lastAnswer < 150) throw new RoomError("Aguarde um instante entre respostas.",429);
    player.lastAnswer=now;
    const correct=isCorrectAnswer(answer,equation.answer);
    if (correct) {
      const xp=roundXp((now-player.startedAt)/1000,room.settings);
      player.score+=1;
      player.xp+=xp;
      player.reveal={answer:equation.answer,factor:equation.factor,explanation:equation.explanation,xp,correct:true};
      player.nextAt=now+650;
      if (player.score >= room.settings.rounds) {
        room.status="finished";
        room.winnerId=player.id;
      }
    } else {
      player.wrongAt=player.wrongAt.filter((at)=>now-at < 5000);
      player.wrongAt.push(now);
      if (player.wrongAt.length >= 3) {
        player.cooldownUntil=now+5000;
        player.wrongAt=[];
      }
    }
    return {room:snapshot(room,player,now),correct};
  }

  function skipRoom(code: string, token: string, equationId: string) {
    const {room,player,now}=authorized(code,token);
    active(room,player,equationId,now);
    if (now-player.lastAnswer < 150) throw new RoomError("Aguarde um instante entre tentativas.",429);
    player.lastAnswer=now;
    nextQuestion(room,player,now);
    return snapshot(room,player,now);
  }

  function leaveRoom(code: string, token: string) {
    const {room,player}=authorized(code,token);
    room.players=room.players.filter((item)=>item.id !== player.id);
    if (!room.players.length) rooms.delete(room.code);
    else {
      if (room.hostId === player.id) room.hostId=room.players[0].id;
      if (room.status === "playing" && room.players.length < 2) {
        room.status="finished";
        room.winnerId=room.players[0].id;
      }
    }
  }

  return {createRoom,joinRoom,readRoom,startRoom,answerRoom,skipRoom,leaveRoom,exportRoom:(code:string)=>rooms.get(code) ?? null};
}
