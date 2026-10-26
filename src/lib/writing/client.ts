import type { SupabaseClient } from "@supabase/supabase-js";
import type { WritingProgress, WritingWorkspace } from "./types.ts";
export type WritingResponse = { revision: number; progress: WritingProgress; workspace: WritingWorkspace; accepted?: string[] };
export class WritingRequestError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function writingRequest<T = WritingResponse>(client: SupabaseClient, userId: string, input: string | Record<string, unknown> = "view=progress"): Promise<T> {
  const { data } = await client.auth.getSession();
  if (!data.session || data.session.user.id !== userId) throw new WritingRequestError("Seu acesso mudou. Entre novamente; o trabalho pendente continua vinculado à conta original.", 401);
  const response = await fetch(`/api/escreve${typeof input === "string" ? `?${input}` : ""}`, { method: typeof input === "string" ? "GET" : "POST", headers: { Authorization: `Bearer ${data.session.access_token}`, ...(typeof input === "string" ? {} : { "Content-Type": "application/json" }) }, body: typeof input === "string" ? undefined : JSON.stringify(input) }).catch(() => { throw new WritingRequestError("Sem conexão para sincronizar. Seu texto continua neste navegador; você pode exportar uma cópia.", 0); });
  const body = await response.json().catch(() => { throw new WritingRequestError("Não foi possível ler a resposta. Tente novamente sem fechar seu texto.", response.status); });
  if (!response.ok) throw new WritingRequestError(body.error ?? "Não foi possível sincronizar. Sua cópia local foi mantida.", response.status);
  return body as T;
}
