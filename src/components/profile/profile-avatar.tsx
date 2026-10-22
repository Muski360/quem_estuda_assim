"use client";

import Image from "next/image";
import { useState } from "react";
import type { CSSProperties } from "react";
import { initials } from "@/lib/profile/profile";

export function ProfileAvatar({ name, color, url, className = "" }: { name: string; color: string; url: string; className?: string }) {
  const [failedUrl, setFailedUrl] = useState("");
  return <span className={`profile-avatar ${className}`} style={{ "--profile-color": color } as CSSProperties}>
    {url && url !== failedUrl
      ? <Image src={url} alt={`Foto de ${name}`} width={320} height={320} unoptimized onError={() => setFailedUrl(url)} />
      : <span aria-label={`Avatar de ${name}`}>{initials(name)}</span>}
  </span>;
}
