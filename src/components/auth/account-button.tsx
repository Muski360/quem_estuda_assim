"use client";

import Link from "next/link";
import { LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./auth-provider";

export function AccountButton() {
  const { user, client, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user) return <Link href="/entrar" className="account-link" aria-busy={loading}><UserRound size={16} aria-hidden="true" />Entrar</Link>;
  return (
    <div className="account-menu">
      <span className="account-name" title={user.email}>{user.email?.split("@")[0] ?? "Minha conta"}</span>
      <button type="button" className="account-link" disabled={busy} onClick={async () => {
        if (!client) return;
        setBusy(true);
        setError("");
        try {
          const { error } = await client.auth.signOut({ scope: "local" });
          if (error) setError("Não foi possível sair. Tente novamente.");
        } catch { setError("Não foi possível sair. Tente novamente."); }
        finally { setBusy(false); }
      }}><LogOut size={16} aria-hidden="true" />{busy ? "Saindo…" : "Sair"}</button>
      {error && <span className="account-error" role="alert">{error}</span>}
    </div>
  );
}
