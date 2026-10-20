import type { Equation, GameSettings } from "../math/generator.ts";

export type Player = { id: string; name: string; score: number; xp: number };
export type RoomSnapshot = {
  revision: number;
  code: string;
  hostId: string;
  settings: GameSettings;
  players: Player[];
  status: "waiting" | "playing" | "finished";
  round: number;
  equation: Omit<Equation, "answer" | "explanation"> | null;
  endsAt: number;
  nextAt: number | null;
  cooldownUntil: number;
  winnerId: string | null;
  reveal: (Pick<Equation, "answer" | "factor" | "explanation"> & { xp: number; correct: boolean }) | null;
  serverTime: number;
};
export type RoomSession = {
  token: string;
  playerId: string;
  room: RoomSnapshot;
  realtime?: { url: string; key: string; topic: string };
};
export type RoomCommand =
  | { action: "create"; name: string; settings: GameSettings }
  | { action: "join"; code: string; name: string }
  | { action: "start" | "leave"; code: string }
  | { action: "skip"; code: string; equationId: string }
  | { action: "answer"; code: string; equationId: string; answer: number };
