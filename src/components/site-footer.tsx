import { ArrowUpRight } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <p>
        <span className="footer-dot" /> Quem estuda assim, vai além.
      </p>
      <span>Feito para o seu próximo acerto.</span>
      <a
        href="https://quem-pensa-assim-enem.happydune.chatgpt.site/"
        target="_blank"
        rel="noopener noreferrer"
      >
        Explore o ecossistema <ArrowUpRight size={14} aria-hidden="true" />
        <span className="sr-only"> (abre em nova aba)</span>
      </a>
    </footer>
  );
}
