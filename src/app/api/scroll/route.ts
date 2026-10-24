import { createClient } from "@supabase/supabase-js";
import { isScrollSettings, isUuid } from "../../../lib/scroll/validation.ts";

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
class ScrollError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
async function database(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new ScrollError("Entre na sua conta para estudar e salvar seu progresso.", 401);
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new ScrollError("O banco de questões está temporariamente indisponível.", 503);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) throw new ScrollError("Seu acesso expirou. Entre novamente para continuar.", 401);
  return db;
}
async function execute(request: Request, action: string, input: Record<string, unknown>) {
  const db = await database(request);
  const { data, error } = action === "stats" ? await db.rpc("qe_scroll_stats")
    : action === "learning" ? await db.rpc("qe_learning_overview")
    : action === "explanation" ? await db.rpc("qe_question_explanation", { p_question_id: input.questionId })
    : action === "report" ? await db.rpc("qe_report_content", { p_question_id: input.questionId, p_category: input.category, p_message: input.message, p_version: input.version ?? null })
    : await db.rpc("qe_scroll_command", { p_action: action, p_data: input });
  if (error) {
    if (error.code === "P0002") throw new ScrollError("Esta questão ou sessão não está disponível. Comece outra sessão.", 404);
    if (error.code === "22023" || error.code === "22P02") throw new ScrollError(error.message.includes("PAUSED") ? "Retome a sessão antes de responder." : "Confira as opções e tente novamente.", 400);
    if (error.code === "42501") throw new ScrollError(error.message.includes("ANSWER_REQUIRED") ? "Responda à questão para acessar a resolução." : "Entre novamente para continuar.", error.message.includes("ANSWER_REQUIRED") ? 403 : 401);
    console.error("Scroll database:", error.code);
    throw new ScrollError("Não foi possível acessar seu estudo. Tente novamente.", 503);
  }
  return json(data);
}
function failure(error: unknown) {
  if (error instanceof ScrollError) return json({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return json({ error: "Requisição inválida." }, 400);
  console.error("Scroll API failed:", error instanceof Error ? error.name : "unknown");
  return json({ error: "Não foi possível salvar. Sua seleção foi mantida; tente novamente." }, 503);
}
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const view = params.get("view") ?? "stats";
    if (view === "stats") return await execute(request, "stats", {});
    if (view === "learning") return await execute(request, "learning", {});
    if (view === "explanation" && isQuestionId(params.get("questionId"))) return await execute(request, "explanation", { questionId: params.get("questionId") });
    if (view === "session" && isUuid(params.get("sessionId"))) return await execute(request, "read", { sessionId: params.get("sessionId") });
    const offset = Number(params.get("offset") ?? 0), filter = params.get("filter") ?? "all";
    if (view === "history" && ["all", "errors", "favorites"].includes(filter) && Number.isInteger(offset) && offset >= 0 && offset <= 100000) return await execute(request, "history", { filter, offset });
    return json({ error: "Consulta inválida." }, 400);
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 8192) return json({ error: "Requisição muito grande." }, 413);
    const text = await request.text();
    if (text.length > 8192) return json({ error: "Requisição muito grande." }, 413);
    const body: unknown = JSON.parse(text);
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Requisição inválida." }, 400);
    const data = body as Record<string, unknown>, action = data.action;
    const valid = action === "report" ? isQuestionId(data.questionId) && ["explanation", "answer", "image", "other"].includes(String(data.category)) && typeof data.message === "string" && data.message.trim().length >= 10 && data.message.length <= 1000 && (data.version == null || Number.isInteger(data.version) && Number(data.version) >= 0 && Number(data.version) <= 1000000)
      : (action === "start" || action === "settings") ? isScrollSettings(data.settings)
      : action === "favorite" ? typeof data.questionId === "string" && /^enem-\d{4}-regular-\d{1,3}(?:-(?:ingles|espanhol))?$/.test(data.questionId) && typeof data.favorite === "boolean"
      : action === "next" ? isUuid(data.sessionId)
      : action === "finish" ? isUuid(data.sessionId) && Number.isInteger(data.activeMs) && Number(data.activeMs) >= 0 && Number(data.activeMs) <= 7200000
      : action === "pause" ? isUuid(data.sessionId) && isUuid(data.itemId) && typeof data.paused === "boolean"
      : (action === "answer" || action === "skip") ? isUuid(data.sessionId) && isUuid(data.itemId) && Number.isInteger(data.activeMs) && Number(data.activeMs) >= 0 && Number(data.activeMs) <= 7200000 && (action === "skip" || Number.isInteger(data.choice) && Number(data.choice) >= 0 && Number(data.choice) <= 4)
      : false;
    if (!valid || typeof action !== "string") return json({ error: "Requisição inválida." }, 400);
    return await execute(request, action, data);
  } catch (error) { return failure(error); }
}
function isQuestionId(value: unknown): value is string { return typeof value === "string" && /^enem-\d{4}-regular-\d{1,3}(?:-(?:ingles|espanhol))?$/.test(value); }
