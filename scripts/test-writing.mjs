import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { completeVersion, createQuiz, emptyProgress, emptyWorkspace, makeDocument } from "../src/lib/writing/engine.ts";

const base = process.env.WRITING_TEST_BASE_URL ?? "http://localhost:3000";
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const accounts = [];
async function account() {
  const email = `qe-writing-${crypto.randomUUID()}@example.com`, password = `Qa!${crypto.randomUUID()}`;
  const created = await db.auth.admin.createUser({ email, password, email_confirm: true }); assert.equal(created.error, null); accounts.push(created.data.user.id);
  const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const signed = await client.auth.signInWithPassword({ email, password }); assert.equal(signed.error, null);
  return { id: created.data.user.id, token: signed.data.session.access_token, client };
}
async function request(user, value = "view=progress", status = 200) {
  const response = await fetch(`${base}/api/escreve${typeof value === "string" ? `?${value}` : ""}`, { method: typeof value === "string" ? "GET" : "POST", headers: { ...(user ? { Authorization: `Bearer ${user.token}` } : {}), ...(typeof value !== "string" ? { "Content-Type": "application/json" } : {}) }, body: typeof value === "string" ? undefined : JSON.stringify(value) });
  const body = await response.json(); if (status !== null) assert.equal(response.status, status, JSON.stringify(body)); return status === null ? { status: response.status, body } : body;
}
const event = patch => ({ id: crypto.randomUUID(), activityId: "es-c1-01", edition: 1, kind: "answer", answer: { choice: 0, evidence: 0, order: [] }, assisted: false, review: false, occurredAt: new Date().toISOString(), activeMs: 1500, ...patch });
const sync = (events, extra = {}) => ({ action: "sync", revision: 0, events, ...extra });
const save = (value, revision = 0, extra = {}) => ({ action: "document", id: value.id, requestId: crypto.randomUUID(), revision, value, ...extra });
try {
  const catalog = await request(null, "view=catalog"); assert.equal(catalog.activities.length, 100); assert.equal(catalog.workshops.length, 10); assert.equal(catalog.topics.length, 5); assert.equal(catalog.readings.length, 5);
  await request(null, "view=catalog&edition=2", 404); await request(null, "view=progress", 401);
  const a = await account(), b = await account();
  for (const table of ["qe_writing_accounts", "qe_writing_events", "qe_writing_documents", "qe_writing_reports", "qe_writing_requests"]) assert.ok((await a.client.from(table).select("*")).error, table);
  assert.ok((await a.client.rpc("qe_writing_commit", { p_user_id: a.id, p_revision: 0, p_progress: {}, p_events: [], p_workspace: {} })).error);
  const first = event(); await Promise.all([request(a, sync([first])), request(a, sync([first]))]);
  await Promise.all([request(a, sync([event()])), request(a, sync([event()]))]);
  let progress = await request(a); assert.equal(progress.progress.xp, 10); assert.equal(progress.progress.answered, 1);
  assert.equal((await request(b)).progress.answered, 0);
  for (const patch of [{ edition: "__proto__" }, { activityId: "missing" }, { answer: { choice: 0, evidence: 8, order: [] } }, { activeMs: -1 }]) await request(a, sync([event(patch)]), 400);
  await request(a, sync([event({ activityId: "es-c1-02", answer: { choice: 1, evidence: 0, order: [] } })]));
  await request(a, sync([event({ activityId: "es-c1-02" })]));
  await request(a, sync([event({ activityId: "es-c1-03", assisted: true })]));
  await request(a, { action: "import", revision: 0, events: [event({ activityId: "es-c2-01" })] });
  await request(a, sync([event({ activityId: "es-c2-01" })]));
  progress = await request(a); assert.equal(progress.progress.xp, 10); assert.equal(progress.progress.correct, 3); assert.equal(progress.progress.answered, 4);
  const quiz = createQuiz(emptyProgress(), "diagnostic"); quiz.draft = { choice: 2, evidence: 1, order: [] }; quiz.pendingActiveMs = 4210;
  const workspace = { ...emptyWorkspace(), quiz };
  const resumed = await request(a, sync([], { revision: progress.revision, workspace })); assert.deepEqual(resumed.workspace.quiz.draft, quiz.draft);
  await request(a, sync([], { revision: 0, workspace }), 409);
  let doc = completeVersion({ ...makeDocument("essay", "tema-leitura"), text: "Tese de teste.\n\nUm argumento com explicação." });
  const firstSave = save(doc), saved = await request(a, firstSave); assert.equal(saved.revision, 1);
  assert.equal((await request(a, firstSave)).revision, 1, "Request replay does not duplicate a revision");
  await request(b, `view=document&id=${doc.id}`, 404); assert.equal((await request(b, "view=documents")).items.length, 0);
  const listings = await request(a, "view=documents"); assert.equal(listings.items.length, 1); assert.equal(listings.items[0].summary.title, doc.title); assert.equal(listings.items[0].value, undefined, "Listing does not deliver all student prose");
  const writes = await Promise.all([request(a, save({ ...doc, text: "Rascunho da aba A" }, 1), null), request(a, save({ ...doc, text: "Rascunho da aba B" }, 1), null)]);
  assert.deepEqual(writes.map(r => r.status).sort(), [200, 409]);
  let cloud = await request(a, `view=document&id=${doc.id}`); assert.equal(cloud.revision, 2);
  await request(a, save({ ...doc, versions: [{ ...doc.versions[0], text: "Alteração em versão concluída" }] }, cloud.revision), 400);
  await request(a, save({ ...doc, text: "a".repeat(20001) }, cloud.revision), 400);
  doc = completeVersion({ ...cloud.value, text: "Uma nova tese.\n\nUm argumento revisto com mais detalhes." });
  doc.assessments = [{ id: crypto.randomUUID(), versionId: doc.versions[0].id, source: "Professor externo · teste", receivedAt: "2026-10-26", recordedAt: "2026-10-26T12:00:00Z", scores: { C1: 160, C2: 200, C3: 120, C4: 160, C5: 200 }, total: null, comment: "Desenvolver o argumento." }];
  const versioned = await request(a, save(doc, cloud.revision)); assert.equal(versioned.value.versions.length, 2); assert.equal(versioned.value.assessments[0].versionId, doc.versions[0].id);
  await request(a, save({ ...doc, assessments: [{ ...doc.assessments[0], versionId: crypto.randomUUID() }] }, versioned.revision), 400);
  const imported = makeDocument("workshop", "of-c1-1"), input = save({ ...imported, text: "Escrita de visitante" }, 0, { action: "import-document" });
  await request(a, input); await request(a, { ...input, requestId: crypto.randomUUID(), value: { ...input.value, text: "Não deve substituir a conta" } });
  assert.equal((await request(a, `view=document&id=${imported.id}`)).value.text, input.value.text);
  assert.equal((await request(a, "view=documents")).items.length, 2);
  const totals = await db.from("qe_study_stats").select("writing_answers,total_xp,reading_answers,scroll_questions,calculator_rounds").eq("user_id", a.id).single(); assert.equal(totals.error, null); assert.equal(totals.data.writing_answers, 4); assert.equal(totals.data.total_xp, 10);
  const calculator = await a.client.rpc("qe_record_calculator", { p_event_id: crypto.randomUUID(), p_xp: 7, p_mode: null, p_correct: null, p_occurred_at: null }).single(); assert.equal(calculator.error, null); assert.equal(calculator.data.writing_answers, 4); assert.equal(calculator.data.total_xp, 17);
  const learning = await a.client.rpc("qe_learning_overview"); assert.equal(learning.error, null); assert.equal(learning.data.bonusXp, 0); assert.ok(learning.data.missions.every(m => m.progress === 0));
  const report = { action: "report", id: crypto.randomUUID(), contentId: "es-c1-01", edition: 1, message: "Rever a justificativa deste exercício de teste." };
  await request(a, report); await request(a, report); const reports = await db.from("qe_writing_reports").select("id").eq("user_id", a.id); assert.equal(reports.error, null); assert.equal(reports.data.length, 1);
  const deletion = { action: "delete-document", id: doc.id, revision: versioned.revision, requestId: crypto.randomUUID() };
  await request(a, deletion); await request(a, deletion);
  cloud = await request(a, `view=document&id=${doc.id}`); assert.equal(cloud.deleted, true); assert.equal(cloud.value, null);
  const tombstone = await db.from("qe_writing_documents").select("value,summary").eq("user_id", a.id).eq("id", doc.id).single(); assert.equal(tombstone.data.value, null); assert.equal(tombstone.data.summary, null);
  await request(a, save(doc, cloud.revision), 409); assert.equal((await request(a, { ...save(doc), action: "import-document" })).deleted, true, "Import cannot resurrect a deleted document");
  await request({ token: "expired.invalid" }, sync([event()]), 401);
  console.log("PASS Escreve: catálogo completo, RLS, isolamento, concorrência, XP único, importação, versões, avaliações, exclusão, histórico, relatos e totais Calc/Scroll/Lê.");
} finally { for (const id of accounts) { const result = await db.auth.admin.deleteUser(id); assert.equal(result.error, null); } console.log("Contas temporárias removidas."); }
