import { Calculator } from "@/components/calculator/calculator";
import { PageIntro } from "@/components/page-intro";

export default function Home() {
  return (
    <main id="conteudo" className="main-shell">
      <PageIntro />
      <Calculator />
    </main>
  );
}
