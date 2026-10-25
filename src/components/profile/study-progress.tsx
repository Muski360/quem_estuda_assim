"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useAuth } from "@/components/auth/auth-provider";
import { EMPTY_STATS, isStudyActivity, newerStats, parsePendingActivities } from "@/lib/profile/activity";
import type { StudyActivity, StudyStats } from "@/lib/profile/activity";

type ProgressState = {
  stats: StudyStats | null;
  loading: boolean;
  error: string;
  pending: number;
  recordActivity: (activity: StudyActivity) => void;
  refresh: () => Promise<void>;
};
const ProgressContext = createContext<ProgressState>({ stats: null, loading: false, error: "", pending: 0, recordActivity: () => {}, refresh: async () => {} });

export function StudyProgressProvider({ children }: { children: ReactNode }) {
  const { user, client } = useAuth();
  return <AccountProgress key={user?.id ?? "guest"} userId={user?.id ?? null} client={client}>{children}</AccountProgress>;
}

function AccountProgress({ children, userId, client }: { children: ReactNode; userId: string | null; client: SupabaseClient | null }) {
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [loading, setLoading] = useState(!!userId);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(0);
  const queue = useRef<StudyActivity[]>([]);
  const inFlight = useRef<Promise<void> | null>(null);
  const storageKey = `qe:study-activity:${userId}:`;

  const flush = useCallback(async () => {
    if (!client || !userId || queue.current.length === 0) return;
    if (inFlight.current) return inFlight.current;
    inFlight.current = (async () => {
      try {
        const { data: auth } = await client.auth.getSession();
        if (auth.session?.user.id !== userId) return;
        const token = auth.session.access_token;
        while (queue.current.length) {
          const activity = queue.current[0];
          // shortcut: personal solo/feed XP comes from the browser; verify answers server-side before adding competitive rankings.
          const { data, error } = await client.rpc("qe_record_calculator", {
            p_event_id: activity.id, p_xp: activity.xp, p_mode: activity.mode ?? null,
            p_correct: activity.correct ?? null, p_occurred_at: activity.occurredAt ?? null,
          }).setHeader("Authorization", `Bearer ${token}`).single();
          if (error) throw error;
          queue.current = queue.current.filter(({ id }) => id !== activity.id);
          try { localStorage.removeItem(storageKey + activity.id); } catch { /* Replayed events remain idempotent in the database. */ }
          setPending(queue.current.length);
          setStats((current) => newerStats(current, data as StudyStats));
        }
        setError("");
      } catch {
        setError("Há progresso pendente. Vamos sincronizar quando a conexão voltar.");
      } finally {
        inFlight.current = null;
        setLoading(false);
      }
    })();
    return inFlight.current;
  }, [client, userId, storageKey]);

  const refresh = useCallback(async () => {
    if (!client || !userId) return;
    await flush();
    try {
      const { data, error } = await client.from("qe_study_stats")
        .select("scroll_questions,calculator_rounds,reading_answers,total_xp").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      setStats((current) => newerStats(current, data ?? EMPTY_STATS));
      if (queue.current.length === 0) setError("");
    } catch { setError("Não foi possível carregar suas estatísticas. Tente novamente."); }
    finally { setLoading(false); }
  }, [client, userId, flush]);

  const recordActivity = useCallback((activity: StudyActivity) => {
    if (!client || !userId || !isStudyActivity(activity) || activity.module !== "calculator") return;
    if (!queue.current.some(({ id }) => id === activity.id)) queue.current.push(activity);
    try { localStorage.setItem(storageKey + activity.id, JSON.stringify(activity)); }
    catch { setError("O navegador não conseguiu guardar o progresso pendente. Mantenha esta aba aberta até sincronizar."); }
    setPending(queue.current.length);
    void flush();
  }, [client, userId, storageKey, flush]);

  useEffect(() => {
    if (!client || !userId) return;
    // Legacy demo feed events stay in storage; official Scroll answers are now committed by the server.
    try { queue.current = Object.keys(localStorage).filter((key) => key.startsWith(storageKey)).flatMap((key) => parsePendingActivities(localStorage.getItem(key))).filter(activity => activity.module === "calculator"); }
    catch { /* Recording still works in memory when storage is unavailable. */ }
    const update = () => { void refresh(); };
    update();
    window.addEventListener("online", update);
    window.addEventListener("focus", update);
    const timer = window.setInterval(() => { if (queue.current.length) void flush(); }, 15000);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("focus", update);
      window.clearInterval(timer);
    };
  }, [client, userId, storageKey, refresh, flush]);

  return <ProgressContext value={{ stats, loading, error, pending, recordActivity, refresh }}>{children}</ProgressContext>;
}

export const useStudyProgress = () => useContext(ProgressContext);
