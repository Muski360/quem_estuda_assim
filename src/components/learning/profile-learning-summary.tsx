"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Award, RotateCcw } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useStudyProgress } from "@/components/profile/study-progress";
import { scrollRequest } from "@/lib/scroll/client";
import type { LearningOverview } from "@/lib/scroll/types";

export function ProfileLearningSummary() {
  const { user, client } = useAuth();
  const { stats } = useStudyProgress();
  const [result, setResult] = useState<{ account: string; data: LearningOverview } | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user || !client) return;
    let active = true;
    scrollRequest<LearningOverview>(client, "view=learning").then(data => { if (active) { setResult({ account: user.id, data }); setError(false); } }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [user, client, stats?.total_xp, attempt]);
  if (!user) return null;
  const data = result?.account === user.id ? result.data : null;
  return <div className="learn-profile-summary">{error ? <button className="learn-retry" onClick={() => setAttempt(a => a + 1)}>Carregar revisões e conquistas<RotateCcw size={15} aria-hidden="true" /></button> : <><Link href="/scrolla?mode=due"><RotateCcw size={16} aria-hidden="true" /><strong>{data?.due ?? "…"}</strong> revisões pendentes</Link><Link href="/scrolla/progresso#learn-achievements-title"><Award size={17} aria-hidden="true" /><strong>{data?.achievements.length ?? "…"}/5</strong> conquistas</Link><span>Nível {Math.floor((stats?.total_xp ?? 0) / 100) + 1}</span></>}</div>;
}
