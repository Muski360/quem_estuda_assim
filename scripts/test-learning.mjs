import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

const base = process.env.SCROLL_TEST_BASE_URL ?? "http://localhost:3000";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const accounts = [];
const day = (delta = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + delta * 86400000));
async function account() {
  const email = `qe-learning-${crypto.randomUUID()}@example.com`, password = `Qa!${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  assert.equal(created.error, null); accounts.push(created.data.user.id);
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password }); assert.equal(signed.error, null);
  return { id: created.data.user.id, client, token: signed.data.session.access_token };
}
async function request(user, input = "view=stats", status = 200) {
  const response = await fetch(`${base}/api/scroll${typeof input === "string" ? `?${input}` : ""}`, {
    method: typeof input === "string" ? "GET" : "POST", headers: { ...(user ? { Authorization: `Bearer ${user.token}` } : {}), ...(typeof input === "string" ? {} : { "Content-Type": "application/json" }) },
    body: typeof input === "string" ? undefined : JSON.stringify(input),
  });
  const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data;
}
const settings = { area: "all", year: null, language: "ingles", mode: "session", target: 5, timed: false, minutes: 3, goal: 5, explanationOnly: true, subject: "ingles", topic: "leitura-ingles" };
const correctIndex = async id => { const r = await admin.from("qe_enem_questions").select("correct_index").eq("id", id).single(); assert.equal(r.error, null); return r.data.correct_index; };
try {
  const a = await account(), b = await account();
  assert.equal((await b.client.rpc("qe_record_study_activity", { p_event_id: crypto.randomUUID(), p_module: "calculator", p_xp: 0 })).error, null);
  assert.equal((await request(b, "view=learning")).missions.find(m => m.id === "calculator").progress, 0, "Legacy events must not earn mission credit");
  await request(null, "view=learning", 401);
  await request({ token: "invalid" }, "view=learning", 401);
  for (const table of ["qe_explanations", "qe_review_queue", "qe_mission_awards", "qe_content_reports"]) assert.ok((await a.client.from(table).select("*")).error, table);
  assert.ok((await a.client.rpc("qe_learning_sync")).error);
  let stats = await request(a); assert.equal(stats.learning.coverage.explained, 100); assert.equal(stats.learning.coverage.total, 2287);
  let session = await request(a, { action: "start", settings });
  const ids = [];
  for (let n = 0; n < 5; n++) {
    const item = session.items[0]; ids.push(item.question.id);
    assert.equal(item.question.hasExplanation, true); assert.equal(item.question.classification.subject, "ingles");
    assert.equal(item.correctIndex, null); assert.equal(item.question.explanation, undefined);
    await request(a, `view=explanation&questionId=${item.question.id}`, 403);
    const command = { action: "answer", sessionId: session.id, itemId: item.id, choice: await correctIndex(item.question.id), activeMs: 0 };
    const answers = await Promise.all([request(a, command), request(a, command)]); assert.deepEqual(answers[0], answers[1]);
    const explanation = await request(a, `view=explanation&questionId=${item.question.id}`);
    assert.equal(explanation.steps.length >= 3, true); assert.deepEqual(Object.keys(explanation.alternatives).sort(), ["A", "B", "C", "D", "E"]);
    await request(b, `view=explanation&questionId=${item.question.id}`, 403);
    session = await request(a, { action: "next", sessionId: session.id });
  }
  stats = await request(a); assert.equal(stats.answered, 5); assert.equal(stats.correct, 5); assert.equal(stats.xp, 65); assert.equal(stats.totalXp, 85);
  assert.equal(stats.learning.missions.find(m => m.id === "answers").awarded, true);
  assert.equal(stats.learning.topics[0].state, "consolidating");
  assert.ok(stats.learning.achievements.some(a => a.id === "first_goal"));
  const queue = await admin.from("qe_review_queue").select("*").eq("user_id", a.id); assert.equal(queue.error, null);
  for (const row of queue.data) { assert.equal(row.due_day, day(3)); assert.equal(row.interval_days, 3); }
  await request(a, { action: "favorite", questionId: ids[0], favorite: true });
  assert.equal((await admin.from("qe_review_queue").update({ last_answered_at: new Date(Date.now() - 2 * 86400000).toISOString() }).eq("user_id", a.id).eq("question_id", ids[0])).error, null);
  session = await request(a, { action: "start", settings: { ...settings, mode: "favorites" } });
  await request(a, { action: "answer", sessionId: session.id, itemId: session.items[0].id, choice: await correctIndex(ids[0]), activeMs: 0 });
  const early = await admin.from("qe_review_queue").select("due_day,interval_days,last_answered_at").eq("user_id", a.id).eq("question_id", ids[0]).single();
  assert.equal(early.data.due_day, day(3)); assert.equal(early.data.interval_days, 3);
  assert.ok(Date.parse(early.data.last_answered_at) > Date.now() - 60000, "Early exposure did not reset delayed-recall evidence");
  // Move only this temporary account's clock evidence to exercise delayed retrieval immediately.
  let updated = await admin.from("qe_review_queue").update({ due_day: day(-1), last_answered_at: new Date(Date.now() - 8 * 86400000).toISOString() }).eq("user_id", a.id).in("question_id", ids.slice(0, 3)); assert.equal(updated.error, null);
  updated = await admin.from("qe_learning_days").delete().eq("user_id", a.id).eq("day", day()); assert.equal(updated.error, null);
  let learning = await request(a, "view=learning"); assert.equal(learning.due, 3); assert.equal(learning.missions.find(m => m.id === "reviews").target, 3);
  session = await request(a, { action: "start", settings: { ...settings, mode: "due" } });
  for (let n = 0; n < 3; n++) {
    const item = session.items[0]; assert.ok(ids.slice(0, 3).includes(item.question.id));
    session = await request(a, { action: "answer", sessionId: session.id, itemId: item.id, choice: await correctIndex(item.question.id), activeMs: 0 });
    assert.equal(session.items[0].xp, 0);
    session = await request(a, { action: "next", sessionId: session.id });
  }
  stats = await request(a); assert.equal(stats.learning.due, 0); assert.equal(stats.learning.bonusXp, 35); assert.equal(stats.totalXp, 100); assert.equal(stats.answered, 5);
  assert.equal(stats.learning.topics[0].state, "mastered");
  assert.ok(stats.learning.achievements.some(a => a.id === "first_mastery"));
  const advanced = await admin.from("qe_review_queue").select("due_day,interval_days").eq("user_id", a.id).eq("question_id", ids[0]).single();
  assert.equal(advanced.data.due_day, day(7)); assert.equal(advanced.data.interval_days, 7);
  for (let n = 0; n < 5; n++) {
    const event = { p_event_id: crypto.randomUUID(), p_xp: 5, p_mode: "solo", p_correct: true, p_occurred_at: new Date().toISOString() };
    const replay = await Promise.all([a.client.rpc("qe_record_calculator", event), a.client.rpc("qe_record_calculator", event)]);
    replay.forEach(r => assert.equal(r.error, null));
  }
  stats = await request(a); assert.equal(stats.learning.bonusXp, 50); assert.equal(stats.totalXp, 140); assert.equal(stats.learning.calculatorRounds, 5);
  await a.client.rpc("qe_record_study_activity", { p_event_id: crypto.randomUUID(), p_module: "calculator", p_xp: 0 });
  learning = await request(a, "view=learning"); assert.equal(learning.missions.find(m => m.id === "calculator").progress, 5); assert.equal(learning.bonusXp, 50);
  session = await request(a, { action: "start", settings: { ...settings, mode: "favorites" } });
  const item = session.items[0];
  await request(a, { action: "answer", sessionId: session.id, itemId: item.id, choice: ((await correctIndex(item.question.id)) + 1) % 5, activeMs: 0 });
  stats = await request(a); assert.equal(stats.learning.topics[0].state, "consolidating"); assert.equal(stats.correct, 5);
  const report = { action: "report", questionId: ids[0], version: 1, category: "explanation", message: "Relato temporário automatizado de validação." };
  await request(a, report); await request(a, report);
  const reports = await admin.from("qe_content_reports").select("id,version").eq("user_id", a.id); assert.equal(reports.data.length, 1); assert.equal(reports.data[0].version, 1);
  await request(a, { ...report, version: -1 }, 400);
  await request(a, { ...report, message: "short" }, 400);
  for (const [interval, expected] of [[1, 3], [3, 7], [7, 14], [14, 30], [30, 30]]) {
    assert.equal((await admin.from("qe_review_log").delete().eq("user_id", a.id).eq("question_id", ids[0])).error, null);
    assert.equal((await admin.from("qe_review_queue").update({ interval_days: interval, due_day: day(-1), last_answered_at: new Date(Date.now() - 8 * 86400000).toISOString() }).eq("user_id", a.id).eq("question_id", ids[0])).error, null);
    session = await request(a, { action: "start", settings: { ...settings, mode: "favorites" } });
    await request(a, { action: "answer", sessionId: session.id, itemId: session.items[0].id, choice: await correctIndex(ids[0]), activeMs: 0 });
    const row = await admin.from("qe_review_queue").select("interval_days,due_day").eq("user_id", a.id).eq("question_id", ids[0]).single();
    assert.equal(row.data.interval_days, expected); assert.equal(row.data.due_day, day(expected));
  }
  await request(b, { action: "favorite", questionId: "enem-2009-regular-1", favorite: true });
  session = await request(b, { action: "start", settings: { ...settings, mode: "favorites", explanationOnly: false, subject: null, topic: null } });
  assert.equal(session.items[0].question.hasExplanation, false);
  await request(b, { action: "answer", sessionId: session.id, itemId: session.items[0].id, choice: ((await correctIndex("enem-2009-regular-1")) + 1) % 5, activeMs: 0 });
  assert.equal(await request(b, "view=explanation&questionId=enem-2009-regular-1"), null);
  const wrong = await admin.from("qe_review_queue").select("interval_days,due_day").eq("user_id", b.id).eq("question_id", "enem-2009-regular-1").single();
  assert.equal(wrong.data.interval_days, 1); assert.equal(wrong.data.due_day, day(1));
  await request(b, { action: "favorite", questionId: "enem-2009-regular-1", favorite: false });
  const spanish = "enem-2015-regular-91-espanhol";
  await request(b, { action: "favorite", questionId: spanish, favorite: true });
  session = await request(b, { action: "start", settings: { ...settings, language: "espanhol", mode: "favorites", subject: null, topic: null } });
  assert.equal(session.items[0].question.id, spanish);
  await request(b, { action: "answer", sessionId: session.id, itemId: session.items[0].id, choice: await correctIndex(spanish), activeMs: 0 });
  assert.equal((await admin.from("qe_review_queue").update({ due_day: day(-1), last_answered_at: new Date(Date.now() - 8 * 86400000).toISOString() }).eq("user_id", b.id).eq("question_id", spanish)).error, null);
  session = await request(b, { action: "start", settings: { ...settings, language: "ingles", mode: "due", explanationOnly: false, subject: null, topic: null } });
  assert.equal(session.items[0].question.id, spanish, "Changing study language must not hide a due question");
  await request(b, { action: "answer", sessionId: session.id, itemId: session.items[0].id, choice: ((await correctIndex(spanish)) + 1) % 5, activeMs: 0 });
  assert.equal((await admin.from("qe_review_queue").select("interval_days").eq("user_id", b.id).eq("question_id", spanish).single()).data.interval_days, 1);
  assert.equal((await request(b)).totalXp, 0);
  console.log("OK: 100 explanations, private answers, taxonomy, isolation, replay, review intervals, early review, mastery, demotion, missions capped at 50 XP, legacy events and reports.");
} finally {
  for (const id of accounts) { const result = await admin.auth.admin.deleteUser(id); if (result.error) console.error(`QA cleanup failed: ${result.error.code}`); }
}
