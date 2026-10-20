import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const base = (process.argv[2] ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const sessions = [];
let realtime;

async function request(body, session) {
  const response = await fetch(`${base}/api/rooms`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json();
  return { status: response.status, data };
}

async function read(session) {
  const response = await fetch(`${base}/api/rooms?code=${session.room.code}`, {
    signal: AbortSignal.timeout(20000),
    headers: { Authorization: `Bearer ${session.token}` },
  });
  assert.equal(response.status, 200);
  return (await response.json()).room;
}

function solve(expression) {
  const [, left, operation, right] = expression.match(/^(\d+) ([+−×÷]) (\d+)$/);
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

try {
  for (const path of ["/", "/scrolla"]) {
    const response = await fetch(`${base}${path}`, {
      signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200, path);
    assert.match(await response.text(), /Quem Estuda Assim/);
  }
  console.log("PASS páginas públicas");

  const created = await request({
    action: "create",
    name: "QA Host",
    settings: { mode: "basic", difficulty: "warmup", rounds: 5 },
  });
  assert.equal(created.status, 201, created.data.error);
  const host = created.data;
  sessions.push(host);
  const joined = await request({
    action: "join",
    code: host.room.code,
    name: "QA Convidado",
  });
  assert.equal(joined.status, 200, joined.data.error);
  const guest = joined.data;
  sessions.push(guest);
  const code = host.room.code;
  assert.equal((await request({ action: "start", code }, guest)).status, 403);

  const config = host.realtime;
  assert.ok(config?.topic && config.key && config.url);
  realtime = createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  assert.ok(
    (await realtime.from("qe_rooms").select("state")).error,
    "Public key must not read private room state",
  );
  assert.ok(
    (
      await realtime.rpc("qe_commit_room", {
        p_code: code,
        p_version: 0,
        p_state: {},
        p_notify: false,
      })
    ).error,
    "Public key must not write rooms",
  );
  console.log(
    "PASS permissões: estado e pontuação inacessíveis pela chave pública",
  );

  let resolveChange;
  const change = new Promise((resolve) => {
    resolveChange = resolve;
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("Realtime did not subscribe")),
      10000,
    );
    realtime
      .channel(config.topic)
      .on("broadcast", { event: "room_changed" }, () => resolveChange())
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          resolve();
        }
        if (status === "CHANNEL_ERROR") {
          clearTimeout(timeout);
          reject(new Error("Realtime channel error"));
        }
      });
  });
  const started = await request({ action: "start", code }, host);
  assert.equal(started.status, 200, started.data.error);
  let changeTimeout;
  try {
    await Promise.race([
      change,
      new Promise((_, reject) => {
        changeTimeout = setTimeout(
          () => reject(new Error("No Realtime update received")),
          5000,
        );
      }),
    ]);
  } finally {
    clearTimeout(changeTimeout);
  }
  console.log("PASS Realtime: evento de rodada recebido via WebSocket");

  const room = started.data.room;
  assert.equal(room.players.length, 2);
  assert.ok(room.revision > 1);
  assert.equal("answer" in room.equation, false);
  assert.equal(room.reveal, null);
  assert.equal((await read(guest)).equation.id, room.equation.id);
  const answer = {
    action: "answer",
    code,
    equationId: room.equation.id,
    answer: solve(room.equation.expression),
  };
  const results = await Promise.all([
    request(answer, host),
    request(answer, guest),
  ]);
  assert.equal(
    results.filter((result) => result.status === 200 && result.data.correct)
      .length,
    1,
  );
  assert.equal(results.filter((result) => result.status === 409).length, 1);
  const scored = await read(guest);
  assert.equal(
    scored.players.reduce((total, player) => total + player.score, 0),
    1,
  );
  console.log(
    "PASS concorrência: duas respostas simultâneas, um único ponto persistido",
  );
  assert.ok(scored.revision > room.revision);

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const next = await read(host);
  assert.equal(next.round, 2);
  assert.notEqual(next.equation.id, room.equation.id);
  assert.equal((await request(answer, host)).status, 409);
  const wrong = await request(
    {
      action: "answer",
      code,
      equationId: next.equation.id,
      answer: solve(next.equation.expression) + 1,
    },
    guest,
  );
  assert.equal(wrong.status, 200, wrong.data.error);
  assert.equal(wrong.data.correct, false);
  assert.equal(
    wrong.data.room.players.reduce((total, player) => total + player.score, 0),
    1,
  );
  await request({ action: "leave", code }, host);
  const remaining = await read(guest);
  assert.equal(remaining.hostId, guest.playerId);
  assert.equal(remaining.status, "finished");
  console.log("PASS avanço, resposta atrasada, erro e saída do host");
} finally {
  for (const session of sessions)
    await request({ action: "leave", code: session.room.code }, session).catch(
      () => {},
    );
  if (realtime) await realtime.removeAllChannels();
}
