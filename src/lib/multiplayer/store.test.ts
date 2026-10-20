import assert from "node:assert/strict";
import { test } from "node:test";
import {
  answerRoom,
  createRoom,
  joinRoom,
  leaveRoom,
  readRoom,
  startRoom,
} from "./store.ts";
import { DEFAULT_SETTINGS } from "../math/generator.ts";

function solve(expression: string) {
  const [, left, operation, right] = expression.match(
    /^(\d+) ([+−×÷]) (\d+)$/,
  )!;
  const a = Number(left),
    b = Number(right);
  return operation === "+"
    ? a + b
    : operation === "−"
      ? a - b
      : operation === "×"
        ? a * b
        : a / b;
}

test("sala autentica jogadores, protege o gabarito e pontua só o primeiro acerto", () => {
  const host = createRoom("Ana", DEFAULT_SETTINGS);
  const guest = joinRoom(host.room.code, "Bruno");
  assert.throws(() => readRoom(host.room.code, "token-inválido"), /sessão/);
  assert.throws(() => startRoom(host.room.code, guest.token), /host/);
  const started = startRoom(host.room.code, host.token);
  assert.equal(started.players.length, 2);
  assert.ok(started.equation);
  assert.equal("answer" in started.equation, false);
  assert.equal(started.reveal, null);
  assert.throws(() => joinRoom(host.room.code, "Carlos"), /já começou/);
  const answer = solve(started.equation.expression);
  const wrong = answerRoom(
    host.room.code,
    guest.token,
    started.equation.id,
    answer + 1,
  );
  assert.equal(wrong.correct, false);
  assert.equal(wrong.room.reveal, null);
  const won = answerRoom(
    host.room.code,
    host.token,
    started.equation.id,
    answer,
  );
  assert.equal(won.correct, true);
  assert.equal(won.room.winnerId, host.playerId);
  assert.equal(
    won.room.players.find((player) => player.id === host.playerId)?.score,
    1,
  );
  assert.throws(
    () => answerRoom(host.room.code, guest.token, started.equation!.id, answer),
    /encerrada/,
  );
  assert.equal(
    readRoom(host.room.code, guest.token).players.reduce(
      (total, player) => total + player.score,
      0,
    ),
    1,
  );
  leaveRoom(host.room.code, host.token);
  const remaining = readRoom(host.room.code, guest.token);
  assert.equal(remaining.hostId, guest.playerId);
  assert.equal(remaining.status, "finished");
  leaveRoom(host.room.code, guest.token);
  assert.throws(() => readRoom(host.room.code, guest.token), /não encontrada/);
});

test("rodadas expiram, avançam e rejeitam respostas atrasadas", () => {
  const realNow = Date.now;
  let now = realNow();
  Date.now = () => now;
  try {
    const host = createRoom("Host", { ...DEFAULT_SETTINGS, rounds: 5 });
    const guest = joinRoom(host.room.code, "Visitante");
    let room = startRoom(host.room.code, host.token);
    const oldId = room.equation!.id;
    now = room.endsAt + 1;
    assert.throws(
      () =>
        answerRoom(
          room.code,
          host.token,
          oldId,
          solve(room.equation!.expression),
        ),
      /encerrada/,
    );
    assert.ok(readRoom(room.code, host.token).reveal);
    now += 1801;
    room = readRoom(room.code, host.token);
    assert.equal(room.round, 2);
    assert.throws(
      () => answerRoom(room.code, host.token, oldId, 0),
      /encerrada/,
    );
    while (room.status === "playing") {
      now = room.endsAt + 1;
      readRoom(room.code, host.token);
      now += 1801;
      room = readRoom(room.code, host.token);
    }
    assert.equal(room.status, "finished");
    assert.equal(room.round, 5);
    assert.equal(
      room.players.every((player) => player.score === 0),
      true,
    );
    leaveRoom(room.code, host.token);
    leaveRoom(room.code, guest.token);
  } finally {
    Date.now = realNow;
  }
});
