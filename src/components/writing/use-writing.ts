"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useStudyProgress } from "@/components/profile/study-progress";
import { documentSummary, emptyLocal, emptyProgress, projectEvents } from "@/lib/writing/engine";
import { isDocument, readLocal, uuid } from "@/lib/writing/validation";
import { writingRequest, WritingRequestError } from "@/lib/writing/client";
import type { WritingResponse } from "@/lib/writing/client";
import type { LocalWritingDocument, WritingDocument, WritingDocumentRecord, WritingEvent, WritingLocal, WritingSummary, WritingWorkspace } from "@/lib/writing/types";

export const WRITING_GUEST_PREFIX = "qe:writing:guest:";
type SummaryRow = { id: string; revision: number; deleted: boolean; summary: WritingSummary | null };
function restoreDocuments(prefix: string, onInvalid?: () => void): Record<string, LocalWritingDocument> {
  const result: Record<string, LocalWritingDocument> = {};
  for (const key of Object.keys(localStorage).filter(k => k.startsWith(prefix + "doc:"))) {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "null");
      if (v && uuid(v.id) && key === prefix + "doc:" + v.id && Number.isInteger(v.revision) && v.revision >= 0 && typeof v.pending === "boolean" && uuid(v.requestId) && typeof v.deleted === "boolean" && (v.deleted && v.value === null || !v.deleted && isDocument(v.value) && v.id === v.value.id)) result[v.id] = v;
      else onInvalid?.();
    } catch { onInvalid?.(); }
  }
  return result;
}
export function useWriting() {
  const { user, client } = useAuth(), userId = user?.id ?? null;
  const { refresh } = useStudyProgress();
  const prefix = userId ? `qe:writing:${userId}:` : WRITING_GUEST_PREFIX;
  const [local, setLocal] = useState<WritingLocal>(emptyLocal), [base, setBase] = useState(emptyProgress);
  const [documents, setDocuments] = useState<Record<string, LocalWritingDocument>>({}), [remote, setRemote] = useState<Record<string, SummaryRow>>({});
  const [ready, setReady] = useState(false), [saving, setSaving] = useState(false), [error, setError] = useState(""), [storageError, setStorageError] = useState(""), [notice, setNotice] = useState("");
  const [guest, setGuest] = useState(false);
  const localRef = useRef(local), documentsRef = useRef(documents), alive = useRef(true), initialized = useRef(false), busy = useRef(false), generation = useRef(0);
  const saveLocal = useCallback((next: WritingLocal) => {
    localRef.current = next; setLocal(next);
    try { localStorage.setItem(prefix + "study", JSON.stringify(next)); } catch { setStorageError("O navegador não conseguiu guardar seu estudo. Não feche esta aba antes de exportar ou sincronizar."); }
  }, [prefix]);
  const persist = useCallback((next: LocalWritingDocument) => {
    documentsRef.current = { ...documentsRef.current, [next.id]: next }; setDocuments(documentsRef.current);
    try { localStorage.setItem(prefix + "doc:" + next.id, JSON.stringify(next)); } catch { setStorageError("Não foi possível guardar este texto no navegador. Exporte uma cópia antes de fechar esta aba."); }
  }, [prefix]);
  const updateWorkspace = useCallback((workspace: WritingWorkspace, events: WritingEvent[] = []) => {
    generation.current++; setError("");
    saveLocal({ ...localRef.current, workspace, events: [...localRef.current.events, ...events], workspacePending: !!userId });
  }, [saveLocal, userId]);
  const saveDocument = useCallback((value: WritingDocument) => {
    const previous = documentsRef.current[value.id];
    persist({ id: value.id, value: { ...value, updatedAt: new Date().toISOString() }, revision: previous?.revision ?? 0, deleted: false, pending: !!userId, requestId: crypto.randomUUID(), baseRequestId: previous?.requestId ?? null, ...(previous?.conflictOf ? { conflictOf: previous.conflictOf } : {}) }); setError("");
  }, [persist, userId]);
  const deleteDocument = useCallback((id: string) => {
    const old = documentsRef.current[id];
    persist({ id, value: null, revision: old?.revision ?? remote[id]?.revision ?? 0, deleted: true, pending: !!userId, requestId: crypto.randomUUID() });
    setRemote(rows => ({ ...rows, [id]: { id, revision: old?.revision ?? 0, deleted: true, summary: null } }));
    if (localRef.current.workspace.activeDocument === id) updateWorkspace({ ...localRef.current.workspace, activeDocument: null });
    setError("");
  }, [persist, remote, updateWorkspace, userId]);
  const loadDocument = useCallback(async (id: string): Promise<WritingDocument | null> => {
    const cached = documentsRef.current[id];
    if (cached?.pending || !userId || !client) return cached?.value ?? null;
    try {
      const row = await writingRequest<WritingDocumentRecord>(client, userId, `view=document&id=${id}`);
      if (!alive.current) return null;
      if (documentsRef.current[id]?.pending) return documentsRef.current[id].value;
      persist({ ...row, pending: false, requestId: crypto.randomUUID() }); return row.value;
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Não foi possível abrir o caderno."); return cached?.value ?? null; }
  }, [client, userId, persist]);
  const loadSummaries = useCallback(async () => {
    if (!client || !userId) return;
    const rows: Record<string, SummaryRow> = {}; let offset: number | null = 0;
    while (offset !== null) {
      const result: { items: SummaryRow[]; next: number | null } = await writingRequest(client, userId, `view=documents&offset=${offset}`);
      if (!alive.current) return;
      for (const row of result.items) rows[row.id] = row;
      offset = result.next;
    }
    setRemote(rows);
    for (const row of Object.values(rows)) if (row.deleted && documentsRef.current[row.id]?.value && !documentsRef.current[row.id].pending) persist({ id: row.id, revision: row.revision, deleted: true, value: null, pending: false, requestId: crypto.randomUUID() });
    const active = localRef.current.workspace.activeDocument;
    if (active && rows[active] && !documentsRef.current[active]?.pending && rows[active].revision > (documentsRef.current[active]?.revision ?? -1)) await loadDocument(active);
  }, [client, userId, loadDocument, persist]);
  const sync = useCallback(async () => {
    if (!client || !userId || busy.current || !initialized.current || !alive.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      if (!localRef.current.events.length && !localRef.current.workspacePending) {
        const result = await writingRequest(client, userId); if (!alive.current) return;
        setBase(result.progress);
        saveLocal({ ...localRef.current, serverRevision: result.revision, ...(!localRef.current.workspacePending ? { workspace: result.workspace } : {}) });
      }
      while (localRef.current.events.length || localRef.current.workspacePending) {
        const current = localRef.current, sent = generation.current, events = current.events.slice(0, 100); let result: WritingResponse;
        try { result = await writingRequest(client, userId, { action: "sync", revision: current.serverRevision, events, ...(current.workspacePending ? { workspace: current.workspace } : {}) }); }
        catch (e) {
          if (!(e instanceof WritingRequestError) || e.status !== 409) throw e;
          result = await writingRequest(client, userId, { action: "sync", revision: current.serverRevision, events });
          if (!alive.current) return;
          setBase(result.progress); saveLocal({ ...localRef.current, events: localRef.current.events.filter(e => !result.accepted?.includes(e.id)), serverRevision: result.revision, workspace: result.workspace, workspacePending: false });
          setNotice("O treino mais recente da conta foi retomado. Suas respostas foram preservadas."); break;
        }
        if (!alive.current) return;
        setBase(result.progress); saveLocal({ ...localRef.current, serverRevision: result.revision, events: localRef.current.events.filter(e => !result.accepted?.includes(e.id)), ...(generation.current === sent ? { workspace: result.workspace, workspacePending: false } : {}) });
      }
      for (const queued of Object.values(documentsRef.current).filter(d => d.pending)) {
        const current = documentsRef.current[queued.id];
        if (!current.deleted && !isDocument(current.value)) { setError("Confira os campos e as notas do caderno antes de sincronizar. Sua cópia local foi mantida."); continue; }
        try {
          const result = await writingRequest<WritingDocumentRecord>(client, userId, { action: current.deleted ? "delete-document" : "document", id: current.id, revision: current.revision, requestId: current.requestId, value: current.value });
          if (!alive.current) return;
          const latest = documentsRef.current[current.id];
          persist(latest.requestId === current.requestId ? { ...result, requestId: current.requestId, pending: false } : { ...latest, revision: result.revision });
        } catch (e) {
          if (!(e instanceof WritingRequestError) || e.status !== 409) throw e;
          const latest = documentsRef.current[current.id];
          const cloud = await writingRequest<WritingDocumentRecord>(client, userId, `view=document&id=${current.id}`);
          if (!alive.current) return;
          if (latest.value) {
            const copy = { ...latest.value, id: crypto.randomUUID(), title: latest.value.title.slice(0, 135) + " · cópia preservada", updatedAt: new Date().toISOString() };
            persist({ id: copy.id, value: copy, revision: 0, pending: true, deleted: false, requestId: crypto.randomUUID(), conflictOf: current.id });
            if (localRef.current.workspace.activeDocument === current.id) updateWorkspace({ ...localRef.current.workspace, activeDocument: copy.id });
          }
          persist({ ...cloud, pending: false, requestId: crypto.randomUUID() });
          setNotice(latest.value ? "Duas edições encontradas. Sua escrita ficou em uma cópia preservada; a versão da outra aba também continua disponível." : "A exclusão não foi feita porque o caderno mudou em outro dispositivo. Confira a versão mais recente antes de excluir.");
        }
      }
      await loadSummaries(); if (alive.current) void refresh();
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "Não foi possível sincronizar. Sua cópia local foi mantida."); }
    finally { busy.current = false; if (alive.current) setSaving(false); }
  }, [client, userId, saveLocal, persist, updateWorkspace, loadSummaries, refresh]);
  const dismissGuest = useCallback(() => { setGuest(false); try { localStorage.setItem(prefix + "import-dismissed", "1"); } catch { /* An unavailable preference store does not block study. */ } }, [prefix]);
  const importGuest = useCallback(async () => {
    if (!client || !userId || busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      const study = readLocal(localStorage.getItem(WRITING_GUEST_PREFIX + "study")), docs = restoreDocuments(WRITING_GUEST_PREFIX);
      for (let i = 0; i < study.events.length; i += 100) {
        const result = await writingRequest(client, userId, { action: "import", revision: localRef.current.serverRevision, events: study.events.slice(i, i + 100) });
        if (!alive.current) return;
        setBase(result.progress); saveLocal({ ...localRef.current, serverRevision: result.revision });
      }
      for (const record of Object.values(docs).filter(d => d.value && !d.deleted)) {
        const result = await writingRequest<WritingDocumentRecord>(client, userId, { action: "import-document", id: record.id, revision: 0, requestId: crypto.randomUUID(), value: record.value });
        if (!alive.current) return;
        if (!documentsRef.current[result.id]?.pending) persist({ ...result, requestId: crypto.randomUUID(), pending: false });
      }
      if (!localRef.current.workspace.quiz && !localRef.current.workspace.activeDocument) {
        const activeDocument = study.workspace.activeDocument && documentsRef.current[study.workspace.activeDocument]?.value ? study.workspace.activeDocument : null;
        updateWorkspace({ ...study.workspace, activeDocument, diagnosticDone: localRef.current.workspace.diagnosticDone || study.workspace.diagnosticDone });
      }
      dismissGuest(); setNotice("Textos, histórico e revisões trazidos. Sem XP retroativo; cadernos já existentes na conta foram preservados."); await loadSummaries();
    } catch (e) { if (alive.current) setError(e instanceof Error ? e.message : "A importação não terminou. Você pode tentar novamente sem duplicar o estudo."); }
    finally { busy.current = false; if (alive.current) setSaving(false); }
  }, [client, userId, saveLocal, persist, dismissGuest, loadSummaries, updateWorkspace]);
  useEffect(() => {
    alive.current = true;
    void Promise.resolve().then(async () => {
      try {
        saveLocal(readLocal(localStorage.getItem(prefix + "study")));
        const docs = restoreDocuments(prefix, () => setStorageError("Um registro local não pôde ser aberto. Os outros cadernos foram recuperados; o registro original foi mantido no navegador.")); documentsRef.current = docs; setDocuments(docs);
        if (userId && localStorage.getItem(prefix + "import-dismissed") !== "1") setGuest(readLocal(localStorage.getItem(WRITING_GUEST_PREFIX + "study")).events.length > 0 || Object.values(restoreDocuments(WRITING_GUEST_PREFIX)).some(d => !d.deleted));
      } catch { setStorageError("O armazenamento está indisponível ou contém um registro inválido. O estudo continua nesta aba; exporte seus textos antes de fechar."); }
      if (!alive.current) return;
      initialized.current = true; setReady(true); await sync();
    });
    const online = () => { if (!document.hidden) void sync(); };
    const storage = (e: StorageEvent) => {
      if (!e.key?.startsWith(prefix + "doc:") || !e.newValue) return;
      try {
        const incoming = JSON.parse(e.newValue) as LocalWritingDocument;
        if (!uuid(incoming.id) || !(incoming.deleted && incoming.value === null || isDocument(incoming.value))) return;
        const current = documentsRef.current[incoming.id];
        if (current?.requestId === incoming.requestId) return;
        if (current?.value && incoming.baseRequestId !== current.requestId && (current.pending || localRef.current.workspace.activeDocument === current.id) && JSON.stringify(current.value) !== JSON.stringify(incoming.value)) {
          const copy = { ...current.value, id: crypto.randomUUID(), title: current.value.title.slice(0, 135) + " · cópia preservada" };
          persist({ id: copy.id, revision: 0, value: copy, pending: !!userId, deleted: false, requestId: crypto.randomUUID(), conflictOf: current.id });
          if (localRef.current.workspace.activeDocument === current.id) updateWorkspace({ ...localRef.current.workspace, activeDocument: copy.id });
          setNotice("Esta aba preservou sua edição em outro caderno porque houve uma alteração simultânea.");
        }
        documentsRef.current = { ...documentsRef.current, [incoming.id]: incoming }; setDocuments(documentsRef.current);
      } catch { setNotice("Não foi possível ler a alteração da outra aba. Sua cópia atual continua disponível."); }
    };
    window.addEventListener("online", online); window.addEventListener("focus", online); window.addEventListener("storage", storage);
    return () => { alive.current = false; window.removeEventListener("online", online); window.removeEventListener("focus", online); window.removeEventListener("storage", storage); };
  }, [prefix, userId, saveLocal, persist, updateWorkspace, sync]);
  useEffect(() => {
    if (!ready || !userId || saving || error || !local.events.length && !local.workspacePending && !Object.values(documents).some(d => d.pending)) return;
    const timer = setTimeout(() => void sync(), 1000); return () => clearTimeout(timer);
  }, [ready, userId, saving, error, local, documents, sync]);
  const projected = useMemo(() => projectEvents(local.events, userId ? base : emptyProgress(), !!userId), [local.events, base, userId]);
  const summaries = useMemo(() => {
    const rows = { ...remote };
    for (const record of Object.values(documents)) if (record.pending || !rows[record.id] || record.revision >= rows[record.id].revision) rows[record.id] = { id: record.id, revision: record.revision, deleted: record.deleted, summary: record.value ? documentSummary(record.value) : null };
    return Object.values(rows).filter(r => !r.deleted && r.summary).map(r => r.summary!).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [documents, remote]);
  return { local, progress: projected.progress, attempts: projected.attempts, documents, summaries, ready, saving, error, storageError, notice, guest, updateWorkspace, saveDocument, deleteDocument, loadDocument, sync, importGuest, dismissGuest };
}
