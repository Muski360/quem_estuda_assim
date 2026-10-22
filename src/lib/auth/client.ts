"use client";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: Promise<SupabaseClient> | undefined;

export function getAuthClient(): Promise<SupabaseClient> {
  client ??= fetch("/api/auth/config", { cache: "no-store" })
    .then(async (response) => {
      const config = await response.json();
      if (!response.ok) throw new Error(config.error);
      return createClient(config.url, config.key, {
        auth: { flowType: "pkce", persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    })
    .catch((error) => {
      client = undefined;
      throw error;
    });
  return client;
}
