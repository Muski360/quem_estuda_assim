"use client";

import { useRef, useState } from "react";
import { Maximize2, X } from "lucide-react";

export function ReadingImage({ src, alt }: { src: string; alt: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  if (!/^\/reading\/(marc-weasels|gris-checkerboard)\.jpg$/.test(src)) return <p role="status">Figura indisponível.</p>;
  if (failed) return <p className="le-image-error" role="status">Não foi possível carregar a figura. <button onClick={() => { setFailed(false); setAttempt(n => n + 1); }}>Tentar novamente</button></p>;
  return <><button type="button" className="le-image" onClick={() => dialog.current?.showModal()} aria-label="Ampliar figura">
    {/* Museum images are served locally at their varied intrinsic proportions. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img key={attempt} src={src} alt={alt} onError={() => setFailed(true)} /><span><Maximize2 size={15} aria-hidden="true" />Ampliar figura</span>
  </button><dialog ref={dialog} className="le-image-dialog" aria-label="Obra ampliada"><button className="le-dialog-close" aria-label="Fechar figura ampliada" autoFocus onClick={() => dialog.current?.close()}><X size={24} aria-hidden="true" /></button>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={src} alt={alt} /><p>Use o zoom do navegador para ver mais detalhes.</p>
  </dialog></>;
}
