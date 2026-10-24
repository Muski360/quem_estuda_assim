"use client";
import { ProfileLearningSummary } from "@/components/learning/profile-learning-summary";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ArrowLeft, ArrowRight, Calculator, Camera, Check, CheckCheck, GalleryVerticalEnd, LoaderCircle, RotateCcw, Save, ShieldCheck, Trash2, Zap } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AVATAR_BUCKET, normalizeDisplayName, PROFILE_COLORS, profileDetails } from "@/lib/profile/profile";
import { prepareAvatar } from "@/lib/profile/avatar";
import { ProfileAvatar } from "./profile-avatar";
import { useStudyProgress } from "./study-progress";

export function ProfilePage() {
  const { user, client, loading } = useAuth();
  if (loading) return <main id="conteudo" className="profile-shell profile-loading" aria-busy="true"><LoaderCircle className="spin" size={24} aria-hidden="true" /><p role="status">Carregando seu perfil…</p></main>;
  if (!user || !client) return <main id="conteudo" className="profile-shell profile-guest">
    <ShieldCheck size={32} aria-hidden="true" /><p className="eyebrow">SEU ESPAÇO DE ESTUDO</p><h1>Seu perfil começa com uma conta.</h1>
    <p>Entre para personalizar seu perfil e acompanhar seu progresso.</p>
    <Link className="button button-primary" href="/entrar">Entrar na minha conta<ArrowRight size={17} aria-hidden="true" /></Link>
    <Link className="auth-back" href="/">Continuar estudando sem entrar</Link>
  </main>;
  return <ProfileEditor key={user.id} user={user} client={client} />;
}

function ProfileEditor({ user, client }: { user: User; client: SupabaseClient }) {
  const saved = profileDetails(user);
  const [draft, setDraft] = useState(saved);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const { stats, loading: statsLoading, error: statsError, pending, refresh } = useStudyProgress();
  const changed = draft.name !== saved.name || draft.color !== saved.color || draft.avatarUrl !== saved.avatarUrl || !!photo;
  const busy = preparing || saving;
  const format = new Intl.NumberFormat("pt-BR");
  const memberSince = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(user.created_at));
  const avatarUrl = photo?.url ?? draft.avatarUrl;

  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  async function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPreparing(true);
    setError("");
    setMessage("");
    try {
      const blob = await prepareAvatar(file);
      setPhoto({ blob, url: URL.createObjectURL(blob) });
    } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível abrir esta foto."); }
    finally { setPreparing(false); event.target.value = ""; }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !changed) return;
    const name = normalizeDisplayName(draft.name);
    if (name.length < 2 || name.length > 60) { setError("Use um nome de 2 a 60 caracteres."); return; }
    if (!PROFILE_COLORS.some(({ value }) => value === draft.color)) { setError("Escolha uma das cores disponíveis."); return; }
    setSaving(true);
    setError("");
    setMessage("");
    let uploadedPath = "";
    try {
      let nextUrl = draft.avatarUrl;
      let nextPath = draft.avatarPath;
      if (photo) {
        uploadedPath = `${user.id}/${crypto.randomUUID()}.webp`;
        const { error } = await client.storage.from(AVATAR_BUCKET).upload(uploadedPath, photo.blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
        if (error) throw new Error("Não foi possível enviar sua foto. Tente novamente.");
        nextPath = uploadedPath;
        nextUrl = client.storage.from(AVATAR_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
      }
      const { data: session } = await client.auth.getSession();
      if (session.session?.user.id !== user.id) throw new Error("Sua sessão mudou. Entre novamente antes de salvar.");
      const { data, error } = await client.auth.updateUser({ data: {
        display_name: name, profile_color: draft.color,
        profile_avatar_url: nextUrl || null, profile_avatar_path: nextPath || null,
      } });
      if (error || !data.user) throw new Error("Não foi possível salvar seu perfil. Tente novamente.");
      setDraft(profileDetails(data.user));
      setPhoto(null);
      setMessage("Perfil atualizado. Tudo salvo na sua conta.");
      if (saved.avatarPath && saved.avatarPath !== nextPath && saved.avatarPath.startsWith(`${user.id}/`)) {
        await client.storage.from(AVATAR_BUCKET).remove([saved.avatarPath]).catch(() => {});
      }
    } catch (error) {
      if (uploadedPath) await client.storage.from(AVATAR_BUCKET).remove([uploadedPath]).catch(() => {});
      setError(error instanceof Error ? error.message : "Não foi possível salvar seu perfil.");
    } finally { setSaving(false); }
  }

  return <main id="conteudo" className="profile-shell" style={{ "--profile-color": draft.color } as CSSProperties}>
    <div className="profile-topline"><Link href="/" className="auth-back"><ArrowLeft size={15} aria-hidden="true" />Voltar ao treino</Link><span><ShieldCheck size={14} aria-hidden="true" />MINHA CONTA</span></div>
    <section className="profile-identity" aria-labelledby="profile-title">
      <div className="profile-portrait">
        <ProfileAvatar name={draft.name || saved.name} color={draft.color} url={avatarUrl} />
        <button type="button" className="profile-camera" onClick={() => fileInput.current?.click()} disabled={busy} aria-label="Alterar foto de perfil"><Camera size={20} aria-hidden="true" /></button>
      </div>
      <div className="profile-identity-copy"><p className="eyebrow">MEU PERFIL</p><h1 id="profile-title">{draft.name || saved.name}<span role="img" aria-label="Conta conectada"><CheckCheck size={20} aria-hidden="true" /></span></h1><p className="profile-email">{user.email}</p><span className="profile-member">Por aqui desde {memberSince}</span></div>
      <a className="profile-edit-link" href="#editar-perfil">Editar perfil<ArrowRight size={16} aria-hidden="true" /></a>
    </section>

    <section className="profile-progress" aria-labelledby="profile-progress-title">
      <div className="profile-section-heading"><div><p className="eyebrow">CADA RESPOSTA CONTA</p><h2 id="profile-progress-title">Seu progresso</h2></div><span>Acumulado da sua conta</span></div>
      <Link className="auth-back" href="/scrolla/progresso">Ver assuntos, revisões e conquistas<ArrowRight size={16} aria-hidden="true" /></Link>
      <ProfileLearningSummary />
      <dl className="profile-stats" aria-busy={statsLoading}>
        <div><dt><GalleryVerticalEnd size={18} aria-hidden="true" />Questões respondidas</dt><dd>{stats ? format.format(stats.scroll_questions) : "—"}</dd><dd className="profile-stat-note">Quem scrolla assim?</dd></div>
        <div><dt><Calculator size={18} aria-hidden="true" />Rodadas concluídas</dt><dd>{stats ? format.format(stats.calculator_rounds) : "—"}</dd><dd className="profile-stat-note">Quem calcula assim?</dd></div>
        <div className="profile-xp"><dt><Zap size={18} aria-hidden="true" />XP total</dt><dd>{stats ? format.format(stats.total_xp) : "—"}<small>XP</small></dd><dd className="profile-stat-note">Somando os dois modos</dd></div>
      </dl>
      {statsError ? <div className="profile-sync" role="status"><p>{statsError}</p><button type="button" onClick={() => void refresh()}><RotateCcw size={14} aria-hidden="true" />Tentar novamente</button></div>
        : <p className="profile-counting-note" role="status">{statsLoading ? "Carregando suas estatísticas…" : pending ? "Salvando suas últimas respostas…" : "Seu progresso é salvo enquanto você estuda com a conta conectada. Pulos não entram na contagem."}</p>}
    </section>

    <section id="editar-perfil" className="profile-edit-section" aria-labelledby="profile-edit-title">
      <div className="profile-editor-intro"><p className="eyebrow">DO SEU JEITO</p><h2 id="profile-edit-title">Deixe com<br /><em>a sua cara.</em></h2><p>Seu nome, sua foto e uma cor para chamar de sua.</p><span><ShieldCheck size={15} aria-hidden="true" />Só você pode editar seu perfil.</span></div>
      <form className="profile-form" onSubmit={save} aria-busy={busy}>
        <div className="profile-photo-field"><div><label htmlFor="profile-photo">Foto de perfil</label><p>JPG, PNG ou WebP. Até 5 MB.</p></div><div className="profile-photo-actions"><button type="button" className="profile-secondary" onClick={() => fileInput.current?.click()} disabled={busy}>{preparing ? <LoaderCircle size={15} className="spin" aria-hidden="true" /> : <Camera size={15} aria-hidden="true" />}{preparing ? "Preparando…" : "Escolher foto"}</button>{avatarUrl && <button type="button" className="profile-remove" disabled={busy} onClick={() => { setPhoto(null); setDraft({ ...draft, avatarUrl: "", avatarPath: "" }); setMessage(""); setError(""); }}><Trash2 size={14} aria-hidden="true" />Remover</button>}</div>
          <input ref={fileInput} id="profile-photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={choosePhoto} disabled={busy} />
        </div>
        <div className="profile-name-field"><label htmlFor="profile-name">Como podemos chamar você?</label><input id="profile-name" name="displayName" type="text" autoComplete="nickname" minLength={2} maxLength={60} required value={draft.name} disabled={busy} onChange={(event) => { setDraft({ ...draft, name: event.target.value }); setMessage(""); }} /><span>Esse nome aparece no seu perfil e no cabeçalho.</span></div>
        <fieldset className="profile-color-field" disabled={busy}><legend>Cor do seu perfil</legend><div className="profile-swatches">{PROFILE_COLORS.map(({ value, label }) => <label key={value} title={label}>
          <input type="radio" name="profileColor" value={value} checked={draft.color === value} onChange={() => { setDraft({ ...draft, color: value }); setMessage(""); }} /><span style={{ backgroundColor: value }}>{draft.color === value && <Check size={17} strokeWidth={2.5} aria-hidden="true" />}</span><span className="sr-only">{label}</span>
        </label>)}</div><p>Escolhida: {PROFILE_COLORS.find(({ value }) => value === draft.color)?.label}</p></fieldset>
        {error && <p className="profile-form-error" role="alert">{error}</p>}
        {message && <p className="profile-form-success" role="status"><Check size={16} aria-hidden="true" />{message}</p>}
        <div className="profile-save-bar"><span>{saving ? "Salvando…" : changed ? "Você tem alterações para salvar." : "Tudo atualizado."}</span><div>{changed && <button type="button" className="profile-discard" disabled={busy} onClick={() => { setDraft(saved); setPhoto(null); setMessage(""); setError(""); }}>Descartar</button>}<button className="button button-primary" disabled={busy || !changed}>{saving ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}Salvar alterações</button></div></div>
      </form>
    </section>
    <div className="profile-return"><span>Seu próximo acerto está esperando.</span><Link href="/">Continuar meu treino<ArrowRight size={16} aria-hidden="true" /></Link></div>
  </main>;
}
