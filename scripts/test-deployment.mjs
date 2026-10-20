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
    settings: { mode: "basic", difficulty: "warmup", rounds: 5, seconds:60 },
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
  const guestRoom=await read(guest);
  assert.notEqual(guestRoom.equation.id,room.equation.id);
  assert.equal(room.endsAt-room.serverTime,60000);
  const answer = {
    action: "answer",
    code,
    equationId: room.equation.id,
    answer: solve(room.equation.expression),
  };
  const results = await Promise.all([
    request(answer, host),
    request(answer, host),
    request({...answer,equationId:guestRoom.equation.id,answer:solve(guestRoom.equation.expression)},guest),
  ]);
  assert.equal(
    results.filter((result) => result.status === 200 && result.data.correct)
      .length,
    2,
  );
  assert.equal(results.filter((result) => result.status === 409).length, 1);
  const scored = await read(guest);
  const earnedXp=results.filter((result)=>result.status===200).reduce((sum,result)=>sum+result.data.room.reveal.xp,0);
  assert.ok(Number.isInteger(earnedXp) && earnedXp >= 0 && earnedXp <= 20);
  assert.equal(scored.players.reduce((total, player) => total + player.xp, 0), earnedXp);
  assert.equal(
    scored.players.reduce((total, player) => total + player.score, 0),
    2,
  );
  console.log(
    "PASS concorrência: pistas independentes; resposta duplicada pontua uma única vez",
  );
  assert.ok(scored.revision > room.revision);

  await new Promise((resolve) => setTimeout(resolve, 2000));
  const next = await read(host);
  assert.equal(next.round, 2);
  assert.notEqual(next.equation.id, room.equation.id);
  assert.equal((await request(answer, host)).status, 409);
  let wrong;
  const nextGuest=await read(guest);
  for(let i=0;i<3;i++) {
    await new Promise((resolve)=>setTimeout(resolve,200));
    wrong=await request({action:"answer",code,equationId:nextGuest.equation.id,answer:solve(nextGuest.equation.expression)+1},guest);
    assert.equal(wrong.status,200,wrong.data.error);
    assert.equal(wrong.data.correct,false);
  }
  assert.equal(wrong.data.room.players.reduce((total,p)=>total+p.score,0),2);
  assert.ok(wrong.data.room.cooldownUntil>wrong.data.room.serverTime);
  const blocked=await request({action:"answer",code,equationId:nextGuest.equation.id,answer:solve(nextGuest.equation.expression)},guest);
  assert.equal(blocked.status,429);
  await new Promise((resolve)=>setTimeout(resolve,200));
  const skipped=await request({action:"skip",code,equationId:nextGuest.equation.id},guest);
  assert.equal(skipped.status,200,skipped.data.error);
  assert.equal(skipped.data.room.cooldownUntil,wrong.data.room.cooldownUntil);
  assert.equal(skipped.data.room.players[1].score,1);
  assert.notEqual(skipped.data.room.equation.id,nextGuest.equation.id);
  assert.equal((await read(host)).equation.id,next.equation.id);
  console.log("PASS cooldown autoritativo, pular sem pontos e adversário independente");

  let racing=await read(host);
  const firstWrong=await request({action:"answer",code,equationId:racing.equation.id,answer:solve(racing.equation.expression)+1},host);
  assert.equal(firstWrong.status,200,firstWrong.data.error);
  await new Promise((resolve)=>setTimeout(resolve,200));
  const between=await request({action:"answer",code,equationId:racing.equation.id,answer:solve(racing.equation.expression)},host);
  assert.equal(between.status,200,between.data.error);
  assert.equal(between.data.correct,true);
  await new Promise((resolve)=>setTimeout(resolve,700));
  racing=await read(host);
  let across;
  for(let i=0;i<2;i++) {
    await new Promise((resolve)=>setTimeout(resolve,200));
    across=await request({action:"answer",code,equationId:racing.equation.id,answer:solve(racing.equation.expression)+1},host);
    assert.equal(across.status,200,across.data.error);
  }
  assert.ok(across.data.room.serverTime-firstWrong.data.room.serverTime<5000,"Rede deve permitir três erros dentro da janela");
  assert.ok(across.data.room.cooldownUntil>across.data.room.serverTime,"Acerto intermediário não apaga a janela de erros");
  assert.equal(across.data.room.players[0].score,2);
  await new Promise((resolve)=>setTimeout(resolve,5050));
  console.log("PASS janela de erros preservada entre acerto e mudança de questão");
  for(let i=2;i<5;i++) {
    const scored=await request({action:"answer",code,equationId:racing.equation.id,answer:solve(racing.equation.expression)},host);
    assert.equal(scored.status,200,scored.data.error);
    if(i<4) {
      await new Promise((resolve)=>setTimeout(resolve,700));
      racing=await read(host);
    } else {
      assert.equal(scored.data.room.status,"finished");
      assert.equal(scored.data.room.winnerId,host.playerId);
      assert.equal(scored.data.room.players[0].score,5);
    }
  }
  console.log("PASS corrida encerra ao atingir a meta de acertos");
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
