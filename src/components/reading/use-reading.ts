"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useStudyProgress } from "@/components/profile/study-progress";
import { applyEvent, emptyLocal, emptySnapshot, projectLocal, readLocal } from "@/lib/reading/engine";
import { readingRequest, ReadingRequestError } from "@/lib/reading/client";
import type { ReadingResponse } from "@/lib/reading/client";
import type { ReadingEvent, ReadingLocal, ReadingSnapshot } from "@/lib/reading/types";

export const GUEST_READING_KEY = "qe:reading:guest:v1";
export function useReading() {
  const { user, client } = useAuth();
  const userId = user?.id ?? null;
  const { refresh } = useStudyProgress();
  const [local, setLocal] = useState<ReadingLocal>(emptyLocal);
  const [base, setBase] = useState<ReadingSnapshot>(emptySnapshot);
  const [ready, setReady] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [storageError, setStorageError] = useState("");
  const [guest, setGuest] = useState<ReadingLocal | null>(null);
  const localRef = useRef(local), revision = useRef(0);
  const busy = useRef(false), alive = useRef(true), initialized = useRef(false);
  const generation = useRef(0), timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = userId ? `qe:reading:${userId}:v1` : GUEST_READING_KEY;

  const save = useCallback((next: ReadingLocal) => {
    const persisted = { ...next, serverRevision: revision.current };
    localRef.current = persisted; setLocal(persisted);
    try { localStorage.setItem(key, JSON.stringify(persisted)); }
    catch { setStorageError("Este navegador não conseguiu guardar o estudo. Ele continua nesta aba; não a feche antes de sincronizar."); }
  }, [key]);
  const update = useCallback((next: ReadingLocal, events: ReadingEvent[] = []) => {
    generation.current++;
    save({ ...next, events: events.length ? [...localRef.current.events, ...events] : localRef.current.events, sessionPending: !!userId });
  }, [save, userId]);
  const receive = useCallback((response: ReadingResponse) => {
    revision.current = response.revision;
    setBase(response.snapshot);
  }, []);

  const sync = useCallback(async () => {
    if (!client || !userId || busy.current || !initialized.current || !alive.current) return;
    busy.current = true; setSaving(true);
    let conflicted = false;
    try {
      if (!localRef.current.events.length && !localRef.current.sessionPending) {
        const response = await readingRequest(client);
        if (!alive.current) return;
        receive(response);
        if (!localRef.current.events.length && !localRef.current.sessionPending) save({ ...localRef.current, session: response.session, ...response.preferences });
      }
      if (localRef.current.events.length || localRef.current.sessionPending) {
        do {
          const current = localRef.current, sentGeneration = generation.current;
          const events = current.events.slice(0, 100);
          let response: ReadingResponse;
          try {
            response = await readingRequest(client, { action: "sync", revision: revision.current, events, ...(current.sessionPending ? { session: current.session } : {}), preferences: { track: current.track, tutorial: current.tutorial } });
          } catch (failure) {
            if (!(failure instanceof ReadingRequestError) || failure.status !== 409) throw failure;
            // Merge answers before adopting the newer remote session; a stale tab never discards pending work.
            response = await readingRequest(client, { action: "sync", revision: revision.current, events });
            if (!alive.current) return;
            receive(response);
            save({ ...localRef.current, events: localRef.current.events.filter(e => !response.accepted?.includes(e.id)), session: response.session, ...response.preferences, sessionPending: false });
            setError("Retomamos o estudo mais recente da sua conta. As respostas desta aba foram preservadas.");
            conflicted = true;
            break;
          }
          if (!alive.current) return;
          receive(response);
          save({ ...localRef.current, events: localRef.current.events.filter(e => !response.accepted?.includes(e.id)), ...(generation.current === sentGeneration ? { session: response.session, sessionPending: false } : {}) });
        } while (localRef.current.events.length || localRef.current.sessionPending);
      }
      if (alive.current) { if (!conflicted) setError(""); void refresh(); }
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Não foi possível sincronizar."); }
    finally { busy.current = false; if (alive.current) setSaving(false); }
  }, [client, userId, receive, save, refresh]);

  useEffect(() => {
    alive.current = true;
    void Promise.resolve().then(async () => {
      if (!alive.current) return;
      try {
        const restored = readLocal(localStorage.getItem(key));
        revision.current = Number.isInteger(restored.serverRevision) && (restored.serverRevision ?? 0) >= 0 ? restored.serverRevision! : 0;
        save(restored);
        if (userId) {
          const candidate = readLocal(localStorage.getItem(GUEST_READING_KEY));
          if (candidate.events.length && localStorage.getItem(`qe:reading:import-dismissed:${userId}`) !== "1") setGuest(candidate);
        }
      } catch { setStorageError("O armazenamento do navegador está indisponível. Você pode estudar nesta aba."); }
      initialized.current = true; setReady(true);
      await sync();
    });
    const online = () => { if (!document.hidden) void sync(); };
    window.addEventListener("online", online); window.addEventListener("focus", online);
    const storage = (e: StorageEvent) => { if (e.key === key && !busy.current && !localRef.current.events.length && !localRef.current.sessionPending) { if (userId) void sync(); else save(readLocal(e.newValue)); } };
    window.addEventListener("storage", storage);
    return () => { alive.current = false; if (timer.current) clearTimeout(timer.current); window.removeEventListener("online", online); window.removeEventListener("focus", online); window.removeEventListener("storage", storage); };
  }, [key, userId, save, sync]);
  useEffect(() => {
    if (!ready || !userId || !local.events.length && !local.sessionPending || busy.current) return;
    timer.current = setTimeout(() => { void sync(); }, 600);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [local, ready, userId, sync]);

  async function importGuest() {
    if (!client || !guest || busy.current) return;
    busy.current = true; setSaving(true);
    let completed = false;
    try {
      for (let n = 0; n < guest.events.length; n += 100) {
        const response = await readingRequest(client, { action: "import", revision: revision.current, events: guest.events.slice(n, n + 100) });
        if (!alive.current) return;
        receive(response);
      }
      setGuest(null); setError("");
      try { localStorage.setItem(`qe:reading:import-dismissed:${userId}`, "1"); } catch { /* Reimport is idempotent in the database. */ }
      completed = true;
      void refresh();
    } catch (failure) { if (alive.current) setError(failure instanceof Error ? failure.message : "Não foi possível importar. Seu estudo de visitante foi mantido."); }
    finally { busy.current = false; if (alive.current) { setSaving(false); if (completed && (localRef.current.events.length || localRef.current.sessionPending)) void sync(); } }
  }
  function dismissGuest() {
    setGuest(null);
    try { localStorage.setItem(`qe:reading:import-dismissed:${userId}`, "1"); } catch { /* This preference is optional. */ }
  }
  const snapshot = useMemo(() => userId ? local.events.reduce((state, event) => applyEvent(state, event, { account: true, now: new Date() }), base) : projectLocal({ events: local.events }), [userId, local.events, base]);
  return { local, snapshot, ready, saving, error, storageError, guest, update, sync, importGuest, dismissGuest };
}
