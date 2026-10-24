"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, LoaderCircle } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import type { ReactNode } from "react";

export function ScrollAccess({ children, progress = false }: { children: ReactNode; progress?: boolean }) {
  const { user, loading, error } = useAuth();
  if (loading) return <div className="sc-access" aria-busy="true"><LoaderCircle className="spin" aria-hidden="true" /><p role="status">Abrindo seu espaço de estudo…</p></div>;
  if (user) return <div key={user.id}>{children}</div>;
  const next = progress ? "/scrolla/progresso" : "/scrolla";
  return <main id="conteudo" className="sc-access sc-gate">
    <Link href="/" className="sc-wordmark">✳ <span>quem estuda assim?</span></Link>
    <div className="sc-gate-copy"><span className="sc-eyebrow">QUEM SCROLLA ASSIM?</span><BookOpen size={44} strokeWidth={1.3} aria-hidden="true" />
      <h1>Seu próximo scroll<br /><em>pode ser um acerto.</em></h1>
      <p>Questões oficiais do ENEM. Seus erros, favoritos e evolução, guardados em um só lugar.</p>
      {error && <p role="alert">{error}</p>}
      <Link className="sc-primary" href={`/entrar?next=${encodeURIComponent(next)}`}>Entrar para estudar<ArrowRight size={18} aria-hidden="true" /></Link>
      <Link className="sc-text-button" href={`/cadastro?next=${encodeURIComponent(next)}`}>Criar minha conta</Link>
      <Link className="sc-muted-link" href="/">Ir para o treino de cálculo</Link>
    </div><p className="sc-gate-note">Leia. Escolha. Descubra seu próximo acerto.</p>
  </main>;
}
