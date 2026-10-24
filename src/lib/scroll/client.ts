import type { SupabaseClient } from "@supabase/supabase-js";

export class ScrollRequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function scrollRequest<T>(client: SupabaseClient, request: string | Record<string, unknown> = "view=stats"): Promise<T> {
  const { data } = await client.auth.getSession();
  if (!data.session) throw new ScrollRequestError("Seu acesso expirou. Entre novamente para continuar.", 401);
  const query = typeof request === "string" ? `?${request}` : "";
  const response = await fetch(`/api/scroll${query}`, {
    method: typeof request === "string" ? "GET" : "POST",
    headers: { Authorization: `Bearer ${data.session.access_token}`, ...(typeof request === "string" ? {} : { "Content-Type": "application/json" }) },
    body: typeof request === "string" ? undefined : JSON.stringify(request),
  }).catch(() => { throw new ScrollRequestError("Não foi possível conectar. Sua escolha foi mantida; tente novamente.", 0); });
  const result = await response.json().catch(() => { throw new ScrollRequestError("O servidor não respondeu como esperado. Tente novamente.", response.status); });
  if (!response.ok) throw new ScrollRequestError(result.error ?? "Não foi possível salvar. Tente novamente.", response.status);
  return result as T;
}
