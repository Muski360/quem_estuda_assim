import type { SupabaseClient } from "@supabase/supabase-js";
import type { ReadingSession, ReadingSnapshot, ReadingTrack } from "./types.ts";

export type ReadingResponse = { revision: number; snapshot: ReadingSnapshot; session: ReadingSession | null; preferences: { track: ReadingTrack | "mixed"; tutorial: boolean }; accepted?: string[] };
export class ReadingRequestError extends Error { constructor(message: string, public status: number) { super(message); } }
export async function readingRequest<T = ReadingResponse>(client: SupabaseClient, input: string | Record<string, unknown> = "view=progress"): Promise<T> {
  const { data } = await client.auth.getSession();
  if (!data.session) throw new ReadingRequestError("Seu acesso expirou. Entre novamente para sincronizar; seu estudo está guardado.", 401);
  const response = await fetch(`/api/le${typeof input === "string" ? `?${input}` : ""}`, {
    method: typeof input === "string" ? "GET" : "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(typeof input === "string" ? {} : { "Content-Type": "application/json" }) },
    body: typeof input === "string" ? undefined : JSON.stringify(input),
  }).catch(() => { throw new ReadingRequestError("Sem conexão para sincronizar. Seu estudo está guardado neste navegador.", 0); });
  const body = await response.json().catch(() => { throw new ReadingRequestError("Não foi possível ler a resposta. Tente sincronizar novamente.", response.status); });
  if (!response.ok) throw new ReadingRequestError(body.error ?? "Não foi possível sincronizar seu estudo.", response.status);
  return body as T;
}
