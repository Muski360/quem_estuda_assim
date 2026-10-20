"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, Calculator, GalleryVerticalEnd } from "lucide-react";

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Quem Estuda Assim? — início">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span>
        quem estuda
        <br />
        assim<span className="brand-question">?</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const scrolling = usePathname() === "/scrolla";
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="module-nav" aria-label="Ferramentas de estudo">
          <Link
            href="/"
            className={!scrolling ? "nav-link active" : "nav-link"}
            aria-current={!scrolling ? "page" : undefined}
          >
            <Calculator size={17} aria-hidden="true" />
            <span>Quem calcula assim?</span>
          </Link>
          <Link
            href="/scrolla"
            className={scrolling ? "nav-link active" : "nav-link"}
            aria-current={scrolling ? "page" : undefined}
          >
            <GalleryVerticalEnd size={17} aria-hidden="true" />
            <span>Quem scrolla assim?</span>
          </Link>
        </nav>
        <a
          className="external-link"
          href="https://quem-pensa-assim-enem.happydune.chatgpt.site/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>Quem pensa assim?</span>
          <ArrowUpRight size={17} aria-hidden="true" />
          <span className="sr-only"> (abre em nova aba)</span>
        </a>
      </div>
    </header>
  );
}
