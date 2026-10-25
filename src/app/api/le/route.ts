import { createClient } from "@supabase/supabase-js";
import { READING_CATALOG, READING_VERSIONS, TRACKS } from "../../../lib/reading/catalog.ts";
import { applyEvent, emptySnapshot, isReadingEvent, isReadingSession } from "../../../lib/reading/engine.ts";
import type { ReadingAttempt, ReadingEvent, ReadingSession, ReadingSnapshot } from "../../../lib/reading/types.ts";

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
class ReadingError extends Error { constructor(message: string, public status: number) { super(message); } }
async function account(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ReadingError("Entre para sincronizar seu estudo. O jogo continua disponível sem login.", 401);
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY, secret = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !secret) throw new ReadingError("A sincronização está indisponível. Seu estudo permanece neste navegador.", 503);
  const auth = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new ReadingError("Seu acesso expirou. Entre novamente para sincronizar; suas escolhas foram mantidas.", 401);
  return { id: data.user.id, db: createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) };
}
function failure(error: unknown) {
  if (error instanceof ReadingError) return json({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return json({ error: "Requisição inválida." }, 400);
  console.error("Reading API:", error instanceof Error ? error.message.slice(0, 120) : "database failure");
  return json({ error: "Não foi possível sincronizar. Suas escolhas estão guardadas; tente novamente." }, 503);
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams, view = params.get("view") ?? "catalog";
    if (view === "catalog") {
      const catalog = params.has("version") ? READING_VERSIONS[Number(params.get("version"))] : READING_CATALOG;
      return catalog ? Response.json(catalog, { headers: { "Cache-Control": "public, max-age=3600" } }) : json({ error: "Esta edição não está disponível." }, 404);
    }
    if (!["progress", "history"].includes(view)) return json({ error: "Consulta inválida." }, 400);
    const { id, db } = await account(request);
    const offset = Number(params.get("offset") ?? 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) return json({ error: "Página inválida." }, 400);
    if (view === "history") {
      const { data, error } = await db.from("qe_reading_events").select("data").eq("user_id", id).eq("data->>kind", "answer").order("received_at", { ascending: false }).order("event_id").range(offset, offset + 39);
      if (error) throw error;
      return json({ items: data.map(r => r.data), next: data.length === 40 ? offset + 40 : null });
    }
    const { data, error } = await db.from("qe_reading_accounts").select("revision,state,session,preferences").eq("user_id", id).maybeSingle();
    if (error) throw error;
    return json({ revision: data?.revision ?? 0, snapshot: { ...emptySnapshot(), ...data?.state }, session: data?.session ?? null, preferences: data?.preferences ?? { track: "functions", tutorial: true } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 120000) return json({ error: "Envie o estudo em lotes menores." }, 413);
    const text = await request.text(); if (text.length > 120000) return json({ error: "Envie o estudo em lotes menores." }, 413);
    const input = JSON.parse(text);
    if (!input || typeof input !== "object" || !["sync", "import"].includes(input.action) || !Array.isArray(input.events) || input.events.length > 100 || !input.events.every(isReadingEvent) || new Set(input.events.map((e: ReadingEvent) => e.id)).size !== input.events.length || !Number.isInteger(input.revision) || input.revision < 0 || input.session !== undefined && input.session !== null && !isReadingSession(input.session) || input.preferences !== undefined && (!input.preferences || !Object.keys(TRACKS).includes(input.preferences.track) || typeof input.preferences.tutorial !== "boolean")) return json({ error: "Confira o estudo enviado e tente novamente." }, 400);
    const { id, db } = await account(request);
    const imported = input.action === "import";
    for (let retry = 0; retry < 5; retry++) {
      const { data: row, error } = await db.from("qe_reading_accounts").select("revision,state,session,preferences").eq("user_id", id).maybeSingle();
      if (error) throw error;
      // A stale session must not replace a newer session from another tab or device.
      const hasSessionChange = Object.hasOwn(input, "session");
      if (hasSessionChange && input.revision !== (row?.revision ?? 0)) return json({ error: "Seu estudo mudou em outra aba ou dispositivo. Atualize para continuar; as respostas pendentes serão preservadas.", conflict: true }, 409);
      let snapshot: ReadingSnapshot = { ...emptySnapshot(), ...row?.state, events: [] };
      const nextSession: ReadingSession | null = hasSessionChange ? input.session : row?.session ?? null;
      const requestedIds = [...new Set([...input.events.map((e: ReadingEvent) => e.id), ...(nextSession?.answers.map(a => a.eventId) ?? [])])];
      const { data: existing, error: idsError } = requestedIds.length ? await db.from("qe_reading_events").select("event_id,data").eq("user_id", id).in("event_id", requestedIds) : { data: [], error: null };
      if (idsError) throw idsError;
      const seen = new Set(existing?.map(e => e.event_id));
      const now = new Date();
      for (const event of input.events as ReadingEvent[]) {
        if (seen.has(event.id)) continue;
        // Account attempts use the server clock; imported history preserves past dates without earning XP.
        const at = imported ? new Date(Math.min(now.getTime(), Date.parse(event.occurredAt))) : now;
        const safe = { ...event, occurredAt: at.toISOString() };
        snapshot = applyEvent(snapshot, safe, { account: !imported, imported, now: at });
      }
      if (imported) {
        for (const [conceptId, previous] of Object.entries((row?.state?.concepts ?? {}) as ReadingSnapshot["concepts"])) {
          if (previous.due) snapshot.concepts[conceptId] = { ...previous, applied: [...new Set([...previous.applied, ...(snapshot.concepts[conceptId]?.applied ?? [])])] };
        }
      }
      const events: ReadingAttempt[] = snapshot.events;
      const { events: _events, ...state } = snapshot;
      void _events;
      if (nextSession) for (const answer of nextSession.answers) {
        const authoritative = events.find(e => e.id === answer.eventId) ?? existing?.find(e => e.event_id === answer.eventId)?.data;
        if (authoritative) Object.assign(answer, { xp: authoritative.xp, correct: authoritative.correct, conceptCorrect: authoritative.conceptCorrect, evidenceCorrect: authoritative.evidenceCorrect, assisted: authoritative.assisted });
      }
      const { data: committed, error: commitError } = await db.rpc("qe_reading_commit", { p_user_id: id, p_revision: row?.revision ?? 0, p_state: state, p_events: events, p_session: nextSession, p_preferences: input.preferences ?? row?.preferences ?? { track: "functions", tutorial: true } });
      if (commitError) throw commitError;
      if (committed) return json({ revision: (row?.revision ?? 0) + 1, snapshot, session: nextSession, preferences: input.preferences ?? row?.preferences ?? { track: "functions", tutorial: true }, accepted: input.events.map((e: ReadingEvent) => e.id) });
    }
    return json({ error: "Outro dispositivo está salvando agora. Tente novamente; seu estudo foi mantido." }, 409);
  } catch (error) { return failure(error); }
}
