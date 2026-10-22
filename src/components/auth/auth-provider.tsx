"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getAuthClient } from "@/lib/auth/client";

type AuthState = { client: SupabaseClient | null; user: User | null; loading: boolean; error: string };
const AuthContext = createContext<AuthState>({ client: null, user: null, loading: true, error: "" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ client: null, user: null, loading: true, error: "" });
  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;
    getAuthClient().then(async (client) => {
      if (!active) return;
      const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
        if (active) setState({ client, user: session?.user ?? null, loading: false, error: "" });
      });
      unsubscribe = () => listener.subscription.unsubscribe();
      const { data, error } = await client.auth.getSession();
      if (active) setState({ client, user: data.session?.user ?? null, loading: false, error: error ? "Seu acesso expirou. Entre novamente." : "" });
    }).catch(() => {
      if (active) setState({ client: null, user: null, loading: false, error: "O login está temporariamente indisponível. Você pode estudar sem entrar." });
    });
    return () => { active = false; unsubscribe?.(); };
  }, []);
  return <AuthContext value={state}>{children}</AuthContext>;
}

export const useAuth = () => useContext(AuthContext);
