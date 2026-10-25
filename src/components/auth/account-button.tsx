"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import { useState } from "react";
import { useAuth } from "./auth-provider";
import { profileDetails } from "@/lib/profile/profile";
import { ProfileAvatar } from "@/components/profile/profile-avatar";

export function AccountButton() {
  const pathname = usePathname();
  const { user, client, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!user) return <Link href={pathname === "/le" ? "/entrar?next=%2Fle" : "/entrar"} className="account-link" aria-busy={loading}><UserRound size={16} aria-hidden="true" />Entrar</Link>;
  const profile = profileDetails(user);
  return (
    <div className="account-menu">
      <Link className="account-profile-link" href="/perfil" aria-label={`Meu perfil: ${profile.name}`}><ProfileAvatar name={profile.name} color={profile.color} url={profile.avatarUrl} /><span className="account-name">{profile.name}</span></Link>
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
