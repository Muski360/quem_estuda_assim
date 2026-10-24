"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, Mail } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { authErrorMessage } from "@/lib/auth/errors";
import { useAuth } from "./auth-provider";
import { authReturnTo, safeReturnTo } from "@/lib/auth/return-to";

const subscribeToLocation = (listener: () => void) => {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
};
const getReturnTo = () => safeReturnTo(new URLSearchParams(window.location.search).get("next"));

type Mode = "login" | "signup" | "recover" | "update";
const COPY = {
  login: { title: "Bom ter você de volta.", description: "Entre com sua conta para continuar.", action: "Entrar" },
  signup: { title: "Seu próximo passo começa aqui.", description: "Crie sua conta com e-mail ou Google.", action: "Criar minha conta" },
  recover: { title: "Vamos recuperar seu acesso.", description: "Enviaremos um link para você escolher uma nova senha.", action: "Enviar link de recuperação" },
  update: { title: "Uma nova senha. Tudo certo.", description: "Escolha uma senha com pelo menos 8 caracteres.", action: "Salvar nova senha" },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const { client, user, loading, error: connectionError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const returnTo = useSyncExternalStore(subscribeToLocation, getReturnTo, () => "/");
  const passwordMode = mode !== "recover";
  const newPassword = mode === "signup" || mode === "update";
  const disabled = loading || busy || !client;
  const callback = () => `${window.location.origin}/auth/callback`;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    authReturnTo();
    if (!client || disabled) return;
    setError("");
    setMessage("");
    if (newPassword && password !== confirmation) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        router.replace(authReturnTo());
      } else if (mode === "signup") {
        const { data, error } = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: callback() } });
        if (error) throw error;
        if (data.session) router.replace(authReturnTo());
        else {
          setMessage("Confira seu e-mail e abra o link de confirmação neste navegador. Se você já tem uma conta, entre com sua senha.");
          setPassword("");
          setConfirmation("");
        }
      } else if (mode === "recover") {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${callback()}?recovery=1` });
        if (error) throw error;
        setMessage("Se este e-mail tiver uma conta, você receberá um link de recuperação. Abra o link neste navegador e confira também o spam.");
      } else {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        setPassword("");
        setConfirmation("");
        setMessage("Senha atualizada. Você já pode continuar estudando.");
      }
    } catch (error) { setError(authErrorMessage(error)); }
    finally { setBusy(false); }
  }

  async function google() {
    authReturnTo();
    if (!client || disabled) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await client.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback() } });
      if (error) throw error;
    } catch (error) { setError(authErrorMessage(error)); }
    finally { setBusy(false); }
  }

  return (
    <main id="conteudo" className="auth-shell">
      <section className="auth-intro">
        <Link href="/" className="auth-back"><ArrowLeft size={16} aria-hidden="true" />Voltar ao treino</Link>
        <p className="eyebrow">QUEM ESTUDA ASSIM?</p>
        <h1>Menos decoreba.<br /><em>Mais você.</em></h1>
        <p>Um espaço para praticar, errar e entender. No seu ritmo.</p>
        <span className="auth-optional">O treino de cálculo é livre. No Scroll, sua conta guarda respostas, favoritos e evolução.</span>
      </section>
      <section className="auth-panel" aria-labelledby="auth-title">
        <span className="auth-mark" aria-hidden="true">✳</span>
        <h2 id="auth-title">{COPY[mode].title}</h2>
        <p>{COPY[mode].description}</p>
        {user && (mode === "login" || mode === "signup") ? (
          <div className="auth-signed-in"><p>Você entrou como <strong>{user.email}</strong>.</p><Link href={returnTo} className="button button-primary">Continuar estudando<ArrowRight size={17} aria-hidden="true" /></Link></div>
        ) : mode === "update" && !loading && !user ? (
          <div className="auth-signed-in"><p>Solicite um link de recuperação para redefinir sua senha.</p><Link href="/recuperar-senha" className="button button-primary">Recuperar acesso<ArrowRight size={17} aria-hidden="true" /></Link></div>
        ) : (
          <>
            {(mode === "login" || mode === "signup") && <>
              <button type="button" className="auth-google" onClick={google} disabled={disabled}><span aria-hidden="true" className="google-mark">G</span>Continuar com Google</button>
              <div className="auth-divider"><span>ou com e-mail</span></div>
            </>}
            <form className="auth-form" onSubmit={submit} aria-busy={busy}>
              {mode !== "update" && <label htmlFor="auth-email">E-mail<input id="auth-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={254} placeholder="voce@exemplo.com" value={email} onChange={(event) => setEmail(event.target.value)} disabled={disabled} /></label>}
              {passwordMode && <div className="auth-password-field"><label htmlFor="auth-password">{mode === "update" ? "Nova senha" : "Senha"}</label><span className="auth-password-wrap"><input id="auth-password" name="password" type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"} minLength={newPassword ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={disabled} aria-describedby={newPassword ? "password-help" : undefined} /><button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} disabled={disabled}>{visible ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></div>}
              {newPassword && <><span id="password-help" className="auth-help">Use pelo menos 8 caracteres.</span><label htmlFor="auth-confirm">Confirmar senha<input id="auth-confirm" name="confirmation" type={visible ? "text" : "password"} autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={disabled} /></label></>}
              {mode === "login" && <Link className="auth-forgot" href="/recuperar-senha">Esqueci minha senha</Link>}
              <p className="auth-error" role="alert">{error || connectionError}</p>
              {message && <p className="auth-success" role="status"><Mail size={18} aria-hidden="true" />{message}</p>}
              <button className="button button-primary" disabled={disabled}>{busy ? <LoaderCircle size={18} className="spin" aria-hidden="true" /> : COPY[mode].action}{!busy && <ArrowRight size={18} aria-hidden="true" />}</button>
            </form>
          </>
        )}
        <p className="auth-switch">{mode === "login" ? <>Primeira vez aqui? <Link href={`/cadastro?next=${encodeURIComponent(returnTo)}`}>Criar uma conta</Link></> : <Link href={`/entrar?next=${encodeURIComponent(returnTo)}`}>Voltar para o login</Link>}</p>
        <Link className="auth-guest" href="/">Continuar sem entrar<ArrowRight size={15} aria-hidden="true" /></Link>
      </section>
    </main>
  );
}
