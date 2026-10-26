"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { writingRequest } from "@/lib/writing/client";

export function WritingProblemReport({ contentId }: { contentId: string }) {
  const { user, client } = useAuth(), id = useRef<string | null>(null);
  const [message, setMessage] = useState(""), [status, setStatus] = useState(""), [busy, setBusy] = useState(false);
  return <details className="wr-report"><summary>Reportar problema neste conteúdo</summary>{!user || !client ? <p><Link href="/entrar?next=%2Fescreve">Entre para enviar um relato.</Link> Seu estudo continua disponível sem conta.</p> : <form onSubmit={async e => {
    e.preventDefault(); if (busy) return; setBusy(true); setStatus(""); id.current ??= crypto.randomUUID();
    try { await writingRequest(client, user.id, { action: "report", id: id.current, contentId, edition: 1, message }); setStatus("Relato recebido. Obrigado por ajudar a melhorar o conteúdo."); setMessage(""); id.current = null; }
    catch (error) { setStatus(error instanceof Error ? error.message : "Não foi possível enviar. Seu relato foi mantido."); }
    finally { setBusy(false); }
  }}><label>O que precisa ser revisto?<textarea required minLength={5} maxLength={1500} value={message} onChange={e => setMessage(e.target.value)} /></label><button className="wr-text-button" disabled={busy}>{busy ? "Enviando…" : "Enviar relato"}</button><p role="status">{status}</p></form>}</details>;
}
