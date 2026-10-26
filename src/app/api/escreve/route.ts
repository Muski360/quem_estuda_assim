import { createClient } from "@supabase/supabase-js";
import { WRITING_CATALOG, activityById } from "../../../lib/writing/catalog.ts";
import { applyAttempt, documentSummary, emptyProgress, emptyWorkspace } from "../../../lib/writing/engine.ts";
import { isDocument, isWorkspace, isWritingEvent, preservesVersions, uuid } from "../../../lib/writing/validation.ts";
import type { WritingAttempt, WritingDocument, WritingEvent, WritingProgress, WritingWorkspace } from "../../../lib/writing/types.ts";

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });
class WritingError extends Error { constructor(message: string, public status: number) { super(message); } }
async function account(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new WritingError("Entre para sincronizar. Você pode continuar escrevendo neste navegador.", 401);
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY, secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !secret) throw new WritingError("A sincronização está indisponível. Exporte uma cópia e tente novamente.", 503);
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new WritingError("Seu acesso expirou. Entre novamente; seu texto está guardado neste navegador.", 401);
  return { id: data.user.id, db: createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
function failure(error: unknown) {
  if (error instanceof WritingError) return json({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return json({ error: "Requisição inválida." }, 400);
  // Never log student text, database details, or request bodies.
  console.error("Writing API: operation failed");
  return json({ error: "Não foi possível sincronizar. Seu texto permanece neste navegador; tente novamente." }, 503);
}
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams, view = p.get("view") ?? "catalog";
    if (view === "catalog") return !p.has("edition") || p.get("edition") === "1" ? Response.json(WRITING_CATALOG, { headers: { "Cache-Control": "public, max-age=3600" } }) : json({ error: "Edição indisponível." }, 404);
    if (!["progress", "history", "documents", "document"].includes(view)) return json({ error: "Consulta inválida." }, 400);
    const { id, db } = await account(request);
    const offset = Number(p.get("offset") ?? 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) return json({ error: "Página inválida." }, 400);
    if (view === "document") {
      if (!uuid(p.get("id"))) return json({ error: "Caderno inválido." }, 400);
      const { data, error } = await db.from("qe_writing_documents").select("id,revision,deleted,value").eq("user_id", id).eq("id", p.get("id")).maybeSingle();
      if (error) throw error;
      return data ? json(data) : json({ error: "Este caderno não está disponível na sua conta." }, 404);
    }
    if (view === "documents") {
      const { data, error } = await db.from("qe_writing_documents").select("id,revision,deleted,summary").eq("user_id", id).order("updated_at", { ascending: false }).order("id").range(offset, offset + 99);
      if (error) throw error; return json({ items: data, next: data.length === 100 ? offset + 100 : null });
    }
    if (view === "history") {
      const { data, error } = await db.from("qe_writing_events").select("data").eq("user_id", id).order("received_at", { ascending: false }).order("event_id").range(offset, offset + 39);
      if (error) throw error; return json({ items: data.map(e => e.data), next: data.length === 40 ? offset + 40 : null });
    }
    const { data, error } = await db.from("qe_writing_accounts").select("revision,progress,workspace").eq("user_id", id).maybeSingle();
    if (error) throw error;
    return json({ revision: data?.revision ?? 0, progress: data?.progress ?? emptyProgress(), workspace: data?.workspace ?? emptyWorkspace() });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 2500000) return json({ error: "O caderno ficou grande para sincronizar. Exporte uma cópia e divida o estudo em outro caderno." }, 413);
    const body = await request.text(); if (body.length > 2500000) return json({ error: "Envie um caderno por vez." }, 413);
    const input = JSON.parse(body);
    if (!input || typeof input !== "object" || Array.isArray(input)) return json({ error: "Requisição inválida." }, 400);
    if (["document", "import-document", "delete-document"].includes(input.action)) {
      if (!uuid(input.requestId) || !uuid(input.id) || !Number.isInteger(input.revision) || input.revision < 0 || input.action !== "delete-document" && (!isDocument(input.value) || input.id !== input.value.id)) return json({ error: "Confira o caderno, os trechos selecionados e as notas. O texto deve ter até 20 mil caracteres." }, 400);
      const { id, db } = await account(request);
      const row = await db.from("qe_writing_documents").select("id,revision,deleted,value").eq("user_id", id).eq("id", input.id).maybeSingle(); if (row.error) throw row.error;
      const previous = row.data;
      if (input.action === "import-document" && previous) return json({ ...previous, alreadyImported: true });
      const known = await db.from("qe_writing_requests").select("document_id").eq("user_id", id).eq("request_id", input.requestId).maybeSingle(); if (known.error) throw known.error;
      if (known.data) return known.data.document_id === input.id ? json(previous) : json({ error: "Identificador de envio já utilizado." }, 400);
      if (previous?.deleted || (previous?.revision ?? 0) !== input.revision) return json({ error: "Outra aba ou dispositivo alterou este caderno. Suas duas cópias serão preservadas.", conflict: true, remote: previous }, 409);
      if (input.action !== "delete-document" && previous?.value && !preservesVersions(previous.value as WritingDocument, input.value)) return json({ error: "Versões concluídas não podem ser apagadas ou reescritas. Crie uma nova versão." }, 400);
      const deleted = input.action === "delete-document";
      const { data, error } = await db.rpc("qe_writing_save_document", { p_user_id: id, p_id: input.id, p_revision: input.revision, p_request_id: input.requestId, p_value: deleted ? null : input.value, p_summary: deleted ? null : documentSummary(input.value), p_delete: deleted });
      if (error) throw error;
      if (!data) return json({ error: "O caderno mudou durante o envio. Sua cópia foi preservada.", conflict: true }, 409);
      const saved = await db.from("qe_writing_documents").select("id,revision,deleted,value").eq("user_id", id).eq("id", input.id).single(); if (saved.error) throw saved.error;
      return json(saved.data);
    }
    if (input.action === "report") {
      const validContent = activityById(input.contentId) || WRITING_CATALOG.workshops.some(w => w.id === input.contentId) || WRITING_CATALOG.topics.some(t => t.id === input.contentId) || WRITING_CATALOG.readings.some(r => r.id === input.contentId);
      if (!uuid(input.id) || input.edition !== 1 || !validContent || typeof input.message !== "string" || input.message.trim().length < 5 || input.message.length > 1500) return json({ error: "Descreva o problema em 5–1500 caracteres." }, 400);
      const { id, db } = await account(request);
      const { error } = await db.from("qe_writing_reports").upsert({ user_id: id, id: input.id, content_id: input.contentId, edition: 1, message: input.message.trim() }, { onConflict: "user_id,id", ignoreDuplicates: true }); if (error) throw error;
      return json({ received: true });
    }
    if (!["sync", "import"].includes(input.action) || !Array.isArray(input.events) || input.events.length > 100 || !input.events.every(isWritingEvent) || new Set(input.events.map((e: WritingEvent) => e.id)).size !== input.events.length || !Number.isInteger(input.revision) || input.revision < 0 || input.workspace !== undefined && !isWorkspace(input.workspace)) return json({ error: "Confira as atividades enviadas e tente novamente." }, 400);
    const { id, db } = await account(request), imported = input.action === "import";
    for (let retry = 0; retry < 5; retry++) {
      const { data: row, error } = await db.from("qe_writing_accounts").select("revision,progress,workspace").eq("user_id", id).maybeSingle(); if (error) throw error;
      if (input.workspace !== undefined && input.revision !== (row?.revision ?? 0)) return json({ error: "Seu treino mudou em outra aba. As respostas serão preservadas.", conflict: true }, 409);
      const workspace: WritingWorkspace = structuredClone(input.workspace ?? row?.workspace ?? emptyWorkspace());
      const ids = [...new Set([...input.events.map((e: WritingEvent) => e.id), ...(workspace.quiz?.answers.map(a => a.eventId) ?? [])])];
      const existing = ids.length ? await db.from("qe_writing_events").select("event_id,data").eq("user_id", id).in("event_id", ids) : { data: [], error: null }; if (existing.error) throw existing.error;
      const seen = new Set(existing.data?.map(e => e.event_id)), attempts: WritingAttempt[] = [];
      let progress: WritingProgress = row?.progress ?? emptyProgress();
      for (const event of input.events as WritingEvent[]) if (!seen.has(event.id)) {
        const at = imported ? new Date(Math.min(Date.now(), Date.parse(event.occurredAt))) : new Date();
        const result = applyAttempt(progress, { ...event, occurredAt: at.toISOString() }, { account: !imported, imported, now: at }); progress = result.progress; attempts.push(result.attempt);
      }
      for (const answer of workspace.quiz?.answers ?? []) {
        const authoritative = attempts.find(e => e.id === answer.eventId) ?? existing.data?.find(e => e.event_id === answer.eventId)?.data;
        if (authoritative) Object.assign(answer, { correct: authoritative.correct, xp: authoritative.xp });
      }
      const committed = await db.rpc("qe_writing_commit", { p_user_id: id, p_revision: row?.revision ?? 0, p_progress: progress, p_events: attempts, p_workspace: workspace }); if (committed.error) throw committed.error;
      if (committed.data) return json({ revision: (row?.revision ?? 0) + 1, progress, workspace, accepted: input.events.map((e: WritingEvent) => e.id) });
    }
    return json({ error: "Outro dispositivo está salvando. Tente novamente; seu estudo foi mantido." }, 409);
  } catch (error) { return failure(error); }
}
