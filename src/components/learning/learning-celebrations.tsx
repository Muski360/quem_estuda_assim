"use client";

import { useEffect, useRef, useState } from "react";
import { Award } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useStudyProgress } from "@/components/profile/study-progress";
import { useStudySound } from "@/components/study-feedback";
import { scrollRequest } from "@/lib/scroll/client";
import type { LearningOverview } from "@/lib/scroll/types";
import { ACHIEVEMENTS, MISSION_TITLES } from "./learning-panels";

export function LearningCelebrations() {
  const { user, client } = useAuth();
  const { stats } = useStudyProgress();
  const { play } = useStudySound();
  const seen = useRef<{ account: string; ids: Set<string>; level: number } | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!client || !user || !stats) { seen.current = null; return; }
    let active = true;
    scrollRequest<LearningOverview>(client, "view=learning").then(data => {
      if (!active) return;
      const ids = new Set([...data.achievements.map(a => a.id), ...data.missions.filter(m => m.awarded).map(m => `${data.day}:${m.id}`)]);
      const level = Math.floor(stats.total_xp / 100) + 1;
      const previous = seen.current?.account === user.id ? seen.current : null;
      if (previous) {
        const news = [...ids].filter(id => !previous.ids.has(id));
        const parts = news.map(id => {
          const m = data.missions.find(m => `${data.day}:${m.id}` === id);
          return m ? `${MISSION_TITLES[m.id]} · +${m.xp} XP` : ACHIEVEMENTS[id as keyof typeof ACHIEVEMENTS]?.name ?? "Nova conquista";
        });
        if (level > previous.level) parts.push(`Nível ${level}!`);
        if (parts.length) { setNotice(parts.join(" · ")); play("complete"); }
      }
      seen.current = { account: user.id, ids, level };
    }).catch(() => {});
    return () => { active = false; };
  }, [client, user, stats, play]);
  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 4500); return () => clearTimeout(timer); }, [notice]);
  return notice ? <div className="learn-toast" role="status"><Award size={21} aria-hidden="true" /><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Fechar celebração">×</button></div> : null;
}
