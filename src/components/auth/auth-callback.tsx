"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { getAuthClient } from "@/lib/auth/client";
import { authErrorMessage } from "@/lib/auth/errors";

export function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    async function finish() {
      const params = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      if (params.has("error") || hash.has("error")) {
        if (active) setError("O acesso não foi concluído. Tente entrar novamente ou solicite um novo link.");
        return;
      }
      try {
        // The shared PKCE client exchanges the callback code during initialization.
        const client = await getAuthClient();
        const initialized = await client.auth.initialize();
        if (initialized.error) throw initialized.error;
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        if (!data.session) {
          if (active) setError(authErrorMessage({ code: "flow_state_not_found" }));
          return;
        }
        if (active) router.replace(params.get("recovery") === "1" ? "/redefinir-senha" : "/");
      } catch (error) {
        if (active) setError(authErrorMessage(error));
      }
    }
    void finish();
    return () => { active = false; };
  }, [router]);
  return <main id="conteudo" className="auth-callback" aria-busy={!error}>
    {error ? <><h1>Vamos tentar de novo.</h1><p role="alert">{error}</p><Link className="button button-primary" href="/entrar">Voltar para o login</Link><Link href="/">Continuar sem entrar</Link></> : <><LoaderCircle size={28} className="spin" aria-hidden="true" /><h1>Concluindo seu acesso…</h1><p role="status">Só mais um instante.</p></>}
  </main>;
}
