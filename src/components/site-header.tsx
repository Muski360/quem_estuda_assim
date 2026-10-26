"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, BookOpen, Calculator, GalleryVerticalEnd, PenLine } from "lucide-react";
import { AccountButton } from "@/components/auth/account-button";

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
  const pathname = usePathname();
  const scrolling = pathname === "/scrolla";
  return (
    <header className="site-header">
      <div className="header-inner">
        <Brand />
        <nav className="module-nav" aria-label="Ferramentas de estudo">
          <Link
            href="/#calculator-title"
            className={pathname === "/" ? "nav-link active" : "nav-link"}
            aria-current={pathname === "/" ? "page" : undefined}
          >
            <Calculator size={17} aria-hidden="true" />
            <span className="nav-full">Quem calcula assim?</span><span className="nav-short">Calcula</span>
          </Link>
          <Link
            href="/scrolla"
            className={scrolling ? "nav-link active" : "nav-link"}
            aria-current={scrolling ? "page" : undefined}
          >
            <GalleryVerticalEnd size={17} aria-hidden="true" />
            <span className="nav-full">Quem scrolla assim?</span><span className="nav-short">Scrolla</span>
          </Link>
          <Link href="/le" className={pathname === "/le" ? "nav-link active" : "nav-link"} aria-current={pathname === "/le" ? "page" : undefined} aria-label="Quem lê assim?">
            <BookOpen size={17} aria-hidden="true" /><span className="nav-full">Quem lê assim?</span><span className="nav-short">Lê</span>
          </Link>
          <Link href="/escreve" className={pathname === "/escreve" ? "nav-link active" : "nav-link"} aria-current={pathname === "/escreve" ? "page" : undefined} aria-label="Quem escreve assim?">
            <PenLine size={17} aria-hidden="true" /><span className="nav-full">Quem escreve assim?</span><span className="nav-short">Escreve</span>
          </Link>
        </nav>
        <div className="header-actions"><a
          className="external-link"
          href="https://quem-pensa-assim-enem.happydune.chatgpt.site/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Quem pensa assim? (abre em nova aba)"
        >
          <span>Quem pensa assim?</span>
          <ArrowUpRight size={17} aria-hidden="true" />
          <span className="sr-only"> (abre em nova aba)</span>
        </a><AccountButton /></div>
      </div>
    </header>
  );
}
