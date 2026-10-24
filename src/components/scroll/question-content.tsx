"use client";

import { useEffect, useRef, useState } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { LoaderCircle, Maximize2, X } from "lucide-react";

export function isStudyImage(src: string) {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && /^[a-z]{20}\.supabase\.co$/.test(url.hostname) && /^\/storage\/v1\/object\/public\/qe-enem-assets\/[a-f0-9]{64}\.(png|jpe?g|webp)$/.test(url.pathname);
  } catch { return false; }
}
export function StudyImage({ src, alt, onZoom }: { src: string; alt: string; onZoom?: (src: string) => void }) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  if (!isStudyImage(src)) return <span className="sc-image-error">Figura indisponível.</span>;
  if (failed) return <span className="sc-image-error">Não foi possível carregar a figura. {onZoom ? <button type="button" onClick={() => { setFailed(false); setLoaded(false); setAttempt(n => n + 1); }}>Tentar novamente</button> : "Tente abrir a ampliação novamente."}</span>;
  // The imported figures have intrinsic, varied sizes; keep the original pixels readable.
  // eslint-disable-next-line @next/next/no-img-element
  const picture = <img key={attempt} src={src} alt={alt || "Figura do enunciado"} loading="eager" onLoad={() => setLoaded(true)} onError={() => setFailed(true)} />;
  return onZoom ? <button className={`sc-figure${loaded ? "" : " loading"}`} type="button" onClick={() => onZoom(src)} disabled={!loaded} aria-busy={!loaded} aria-label="Ampliar figura">{picture}<span>{loaded ? <><Maximize2 size={14} aria-hidden="true" /> Ampliar</> : <><LoaderCircle size={16} className="spin" aria-hidden="true" />Carregando figura…</>}</span></button> : picture;
}
export function QuestionMarkdown({ children, onZoom }: { children: string; onZoom?: (src: string) => void }) {
  return <div className="sc-markdown"><Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[[rehypeKatex, { strict: false, trust: false }]]} components={{
    img: ({ src, alt }) => <StudyImage src={typeof src === "string" ? src : ""} alt={alt ?? ""} onZoom={onZoom} />,
    a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}<span className="sr-only"> (abre em nova aba)</span></a>,
  }}>{children}</Markdown></div>;
}
export function ImageZoom({ src, onClose }: { src: string | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (src) dialog.current?.showModal();
    else dialog.current?.close();
  }, [src]);
  return <dialog ref={dialog} className="sc-image-dialog" onCancel={onClose} onClose={onClose} aria-label="Figura ampliada">
    <button className="sc-icon" onClick={onClose} autoFocus aria-label="Fechar figura ampliada"><X size={24} /></button>
    {src && <StudyImage src={src} alt="Figura da questão ampliada" />}
    <p>Use o zoom do navegador para ver mais detalhes.</p>
  </dialog>;
}
