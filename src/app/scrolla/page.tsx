import type { Metadata } from "next";
import { PageIntro } from "@/components/page-intro";
import { ScrollFeed } from "@/components/scroll/scroll-feed";

export const metadata: Metadata = { title: "Quem Scrolla Assim?" };

export default function ScrollPage() {
  return (
    <main id="conteudo" className="main-shell">
      <PageIntro scroll />
      <ScrollFeed />
    </main>
  );
}
