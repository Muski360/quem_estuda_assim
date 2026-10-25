import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { createSession, emptySnapshot } from "../src/lib/reading/engine.ts";

const base = process.env.READING_TEST_BASE_URL ?? "http://localhost:3000";
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const accounts = [];
const day = (delta = 0) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + delta * 86400000));
async function account() {
  const email = `qe-reading-${crypto.randomUUID()}@example.com`, password = `Qa!${crypto.randomUUID()}`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true }); assert.equal(created.error, null); accounts.push(created.data.user.id);
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password }); assert.equal(signed.error, null);
  return { id: created.data.user.id, token: signed.data.session.access_token, client };
}
async function request(user, input = "view=progress", status = 200) {
  const response = await fetch(`${base}/api/le${typeof input === "string" ? `?${input}` : ""}`, {
    method: typeof input === "string" ? "GET" : "POST", headers: { ...(user ? { Authorization: `Bearer ${user.token}` } : {}), ...(typeof input === "string" ? {} : { "Content-Type": "application/json" }) },
    body: typeof input === "string" ? undefined : JSON.stringify(input),
  });
  const data = await response.json(); assert.equal(response.status, status, JSON.stringify(data)); return data;
}
const event = (patch = {}) => ({ id: crypto.randomUUID(), kind: "answer", conceptId: "poetica", itemId: "le-poetica-a1", version: 1, occurredAt: new Date().toISOString(), choice: "poetica", evidence: 0, assisted: false, review: false, activeMs: 1000, ...patch });
const sync = (events, extra = {}) => ({ action: "sync", revision: 0, events, ...extra });
async function alterConcept(user, patch) {
  const row = await admin.from("qe_reading_accounts").select("state").eq("user_id", user.id).single(); assert.equal(row.error, null);
  Object.assign(row.data.state.concepts.poetica, patch);
  const saved = await admin.from("qe_reading_accounts").update({ state: row.data.state }).eq("user_id", user.id); assert.equal(saved.error, null);
}
try {
  const catalog = await request(null, "view=catalog"); assert.equal(catalog.version, 2); assert.equal(catalog.concepts.length, 44);
  const legacy = await request(null, "view=catalog&version=1"); assert.equal(legacy.version, 1); assert.equal(legacy.concepts.length, 30);
  await request(null, "view=catalog&version=999", 404);
  assert.equal(catalog.concepts.reduce((n, c) => n + c.examples.length + c.applications.length, 0), 264);
  await request(null, "view=progress", 401); await request({ token: "invalid" }, "view=progress", 401);
  const a = await account(), b = await account();
  for (const table of ["qe_reading_accounts", "qe_reading_events"]) assert.ok((await a.client.from(table).select("*")).error, table);
  assert.ok((await a.client.rpc("qe_reading_commit", { p_user_id: b.id, p_revision: 0, p_state: {}, p_events: [], p_session: null, p_preferences: {} })).error, "Browser cannot invoke server commit");
  assert.equal((await request(a)).snapshot.answered, 0);
  const first = event();
  await Promise.all([request(a, sync([first])), request(a, sync([first]))]);
  let progress = await request(a); assert.equal(progress.snapshot.xp, 10); assert.equal(progress.snapshot.answered, 1); assert.equal(progress.snapshot.correct, 1);
  assert.equal(progress.snapshot.concepts.poetica.due, day(3));
  await Promise.all([request(a, sync([event()])), request(a, sync([event()]))]);
  progress = await request(a); assert.equal(progress.snapshot.xp, 10); assert.equal(progress.snapshot.answered, 1);
  assert.equal((await request(b, `view=history&userId=${a.id}`)).items.length, 0);
  assert.equal((await request(b)).snapshot.xp, 0);
  await request(a, sync([event({ evidence: 3 })]), 400);
  await request(a, sync([event({ itemId: "le-realismo-a1" })]), 400);
  await request(a, sync([event({ activeMs: -1 })]), 400);
  await request(a, sync([event({ version: 999 })]), 400);
  await request(a, sync([event({ itemId: "le-poetica-a2", evidence: 1 })]));
  progress = await request(a); assert.equal(progress.snapshot.concepts.poetica.due, day(1)); assert.equal(progress.snapshot.correct, 1);
  await request(a, sync([event({ itemId: "le-poetica-a2" })]));
  progress = await request(a); assert.equal(progress.snapshot.xp, 10); assert.equal(progress.snapshot.correct, 1, "Original accuracy stays unchanged");
  await request(a, sync([event({ itemId: "le-poetica-a3", assisted: true })]));
  progress = await request(a); assert.equal(progress.snapshot.xp, 10);
  for (const [interval, expected] of [[1, 3], [3, 7], [7, 14], [14, 30], [30, 30]]) {
    await alterConcept(a, { interval, due: day(-1), exposedAt: new Date(Date.now() - 8 * 86400000).toISOString(), applied: ["le-poetica-a1", "le-poetica-a2"] });
    await request(a, sync([event({ review: true })]));
    progress = await request(a); assert.equal(progress.snapshot.concepts.poetica.interval, expected); assert.equal(progress.snapshot.concepts.poetica.due, day(expected)); assert.equal(progress.snapshot.concepts.poetica.retained, true); assert.equal(progress.snapshot.xp, 10);
  }
  await request(a, sync([event({ evidence: 2, review: true })]));
  progress = await request(a); assert.equal(progress.snapshot.concepts.poetica.retained, false); assert.equal(progress.snapshot.concepts.poetica.interval, 1);
  await alterConcept(a, { interval: 7, due: day(7), exposedAt: new Date(Date.now() - 8 * 86400000).toISOString() });
  await request(a, sync([event({ review: true })]));
  progress = await request(a); assert.equal(progress.snapshot.concepts.poetica.interval, 7); assert.equal(progress.snapshot.concepts.poetica.due, day(7)); assert.equal(progress.snapshot.concepts.poetica.retained, false, "Early review cannot prove delayed retention");
  await alterConcept(a, { due: day(-1), exposedAt: new Date(Date.now() - 8 * 86400000).toISOString() });
  await request(a, sync([event({ kind: "exposure", itemId: "guide:poetica", assisted: true })]));
  await request(a, sync([event({ review: true })]));
  progress = await request(a); assert.equal(progress.snapshot.concepts.poetica.retained, false, "Recent guide exposure prevents retention");
  const imported = event({ conceptId: "referencial", choice: "referencial", itemId: "le-referencial-a1", occurredAt: new Date(Date.now() - 9 * 86400000).toISOString() });
  const oldDue = progress.snapshot.concepts.poetica.due;
  await request(a, { ...sync([imported, event({ evidence: 1 })]), action: "import" });
  await request(a, { ...sync([imported]), action: "import" });
  progress = await request(a); assert.equal(progress.snapshot.xp, 10); assert.equal(progress.snapshot.concepts.poetica.due, oldDue); assert.equal(progress.snapshot.concepts.referencial.retained, false);
  await request(a, sync([event({ conceptId: "referencial", choice: "referencial", itemId: "le-referencial-a1" })]));
  progress = await request(a); assert.equal(progress.snapshot.xp, 10, "Imported first responses cannot gain retroactive XP");
  const totals = await admin.from("qe_study_stats").select("*").eq("user_id", a.id).single(); assert.equal(totals.error, null);
  assert.equal(totals.data.total_xp, 10); assert.equal(totals.data.reading_answers, progress.snapshot.answered); assert.equal(totals.data.scroll_questions, 0); assert.equal(totals.data.calculator_rounds, 0);
  const calculator = await a.client.rpc("qe_record_calculator", { p_event_id: crypto.randomUUID(), p_xp: 7, p_mode: null, p_correct: null, p_occurred_at: null }).single(); assert.equal(calculator.error, null); assert.equal(calculator.data.total_xp, 17); assert.equal(calculator.data.reading_answers, totals.data.reading_answers);
  const learning = await a.client.rpc("qe_learning_overview"); assert.equal(learning.error, null); assert.equal(learning.data.bonusXp, 0); assert.ok(learning.data.missions.every(m => m.progress === 0), "Reading does not change existing missions");
  const history = await request(a, "view=history"); assert.ok(history.items.some(e => e.imported)); assert.ok(history.items.every(e => e.kind === "answer"));
  const known = history.items.find(e => e.itemId === "le-poetica-a2" && e.correct && !e.assisted);
  const resumed = createSession(emptySnapshot(), "functions", "poetica");
  resumed.catalogVersion = 1;
  resumed.applications = ["le-poetica-a2", "le-emotiva-a1", "le-metalinguistica-a1", "le-poetica-a3"];
  resumed.answers = [{ eventId: known.id, itemId: known.itemId, correct: true, conceptCorrect: true, evidenceCorrect: true, xp: 10, skipped: false }];
  const corrected = await request(a, sync([], { revision: progress.revision, session: resumed }));
  assert.equal(corrected.session.answers[0].xp, 0, "Saving an advanced session keeps authoritative rewards from older event batches");
  assert.equal(corrected.session.catalogVersion, 1, "Existing sessions keep their published edition");
  const repeated = await request(a, sync([event({ version: 2 })]));
  assert.equal(repeated.snapshot.xp, 10, "A new catalog version does not reset first-answer XP");
  const figure = event({ conceptId: "metafora", itemId: "le-metafora-a1", choice: "metafora", version: 2 });
  await request(a, sync([{ ...figure, version: 1 }]), 400);
  const figureSession = createSession(emptySnapshot(), "figures", "metafora");
  figureSession.stage = 1; figureSession.draft = { choice: "metafora", evidence: 0 };
  await request(a, sync([], { revision: repeated.revision, session: figureSession, preferences: { track: "figures", tutorial: false } }));
  await Promise.all([request(a, sync([figure])), request(a, sync([figure]))]);
  const figures = await request(a);
  assert.equal(figures.snapshot.xp, 20); assert.equal(figures.snapshot.answered, repeated.snapshot.answered + 1);
  assert.equal(figures.preferences.track, "figures"); assert.deepEqual(figures.session.draft, figureSession.draft);
  const profile = await admin.from("qe_study_stats").select("total_xp,reading_answers").eq("user_id", a.id).single();
  assert.equal(profile.error, null); assert.equal(profile.data.total_xp, 27); assert.equal(profile.data.reading_answers, figures.snapshot.answered);
  assert.equal((await request(b)).snapshot.answered, 0, "New-track progress stays private");
  await request(a, sync([], { session: null, revision: 0 }), 409);
  await request({ token: "expired.invalid" }, sync([event()]), 401);
  console.log("PASS Lê: catálogo público, RLS, isolamento, concorrência, reenvio, XP, calendário, retenção, ajuda, importação, histórico e totais Calcula/Scroll.");
} finally {
  for (const id of accounts) { const result = await admin.auth.admin.deleteUser(id); assert.equal(result.error, null); }
  console.log("Contas temporárias removidas.");
}
