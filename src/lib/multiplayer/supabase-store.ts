import { createClient } from "@supabase/supabase-js";
import { createRoomEngine, RoomError } from "./store.ts";
import type { Room } from "./store.ts";
import type { GameSettings } from "../math/generator.ts";
import type { RoomCommand, RoomSession, RoomSnapshot } from "./types.ts";

function configuration() {
  const url = process.env.SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !key)
    throw new RoomError(
      "O multiplayer está temporariamente indisponível.",
      503,
    );
  return { url, secret, key };
}

function database() {
  const { url, secret } = configuration();
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function withRealtime(session: RoomSession, room: Room): RoomSession {
  const { url, key } = configuration();
  return { ...session, realtime: { url, key, topic: `qe:${room.channelId}` } };
}

export async function createRoom(
  name: string,
  settings: GameSettings,
): Promise<RoomSession> {
  const db = database();
  for (let attempt = 0; attempt < 5; attempt++) {
    const engine = createRoomEngine();
    const result = engine.createRoom(name, settings);
    const state = engine.exportRoom(result.room.code)!;
    const { data, error } = await db.rpc("qe_commit_room", {
      p_code: state.code,
      p_version: 0,
      p_state: state,
      p_notify: true,
    });
    if (error) {
      if (error.message.includes("ROOM_LIMIT"))
        throw new RoomError(
          "Todas as salas estão ocupadas. Tente mais tarde.",
          503,
        );
      console.error("Room creation failed:", error.code);
      throw new RoomError(
        "Não foi possível criar a sala. Tente novamente.",
        503,
      );
    }
    if (data) {
      result.room.revision = 1;
      return withRealtime(result, state);
    }
  }
  throw new RoomError(
    "Não foi possível reservar um código de sala. Tente novamente.",
    503,
  );
}

type ExistingCommand =
  Exclude<RoomCommand, { action: "create" }> | { action: "read"; code: string };

const transition = (room: Room) => JSON.stringify([room.status, room.players.map((player) => [player.equation?.id, player.nextAt, player.score])]);

export async function runRoomCommand(command: ExistingCommand, token: string) {
  const db = database();
  const code = command.code.toUpperCase();
  for (let attempt = 0; attempt < 12; attempt++) {
    const { data, error } = await db
      .from("qe_rooms")
      .select("state,version")
      .eq("code", code)
      .maybeSingle();
    if (error) {
      console.error("Room read failed:", error.code);
      throw new RoomError(
        "Não foi possível acessar a sala. Tente novamente.",
        503,
      );
    }
    if (!data) throw new RoomError("Sala não encontrada ou expirada.", 404);
    const previous = data.state as Room;
    const before = JSON.stringify(previous);
    const beforeTransition = transition(previous);
    const engine = createRoomEngine(previous);
    let result:
      | RoomSession
      | { room: RoomSnapshot; correct?: boolean }
      | { ok: boolean }
      | undefined;
    let revision = Number(data.version);
    let failure: unknown;
    try {
      switch (command.action) {
        case "read":
          result = { room: engine.readRoom(code, token) };
          break;
        case "join":
          result = engine.joinRoom(code, command.name);
          break;
        case "start":
          result = { room: engine.startRoom(code, token) };
          break;
        case "answer":
          result = engine.answerRoom(
            code,
            token,
            command.equationId,
            command.answer,
          );
          break;
        case "leave":
          engine.leaveRoom(code, token);
          result = { ok: true };
          break;
      }
    } catch (error) {
      failure = error;
    }
    const state = engine.exportRoom(code);
    if (JSON.stringify(state) !== before) {
      const transitioned =
        state &&
        transition(state) !== beforeTransition;
      const { data: saved, error: saveError } = await db.rpc("qe_commit_room", {
        p_code: code,
        p_version: data.version,
        p_state: state,
        p_notify: command.action !== "read" || !!transitioned,
      });
      if (saveError) {
        console.error("Room commit failed:", saveError.code);
        throw new RoomError(
          "Não foi possível salvar a rodada. Tente novamente.",
          503,
        );
      }
      // A competing request won the version; rerun the rules against its committed state.
      if (!saved) continue;
      revision += 1;
    }
    if (failure) throw failure;
    if (!result)
      throw new RoomError("Não foi possível concluir a operação.", 503);
    if ("room" in result) result.room.revision = revision;
    if (command.action === "join" && state)
      return withRealtime(result as RoomSession, state);
    return result;
  }
  throw new RoomError(
    "A sala está recebendo muitas respostas. Tente novamente.",
    429,
  );
}
