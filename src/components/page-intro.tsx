export function PageIntro({ scroll = false }: { scroll?: boolean }) {
  return (
    <section className="page-intro" aria-labelledby="page-title">
      <div>
        <p className="eyebrow">
          <span className="accent-dot" /> ESTUDAR PODE SER DIFERENTE
        </p>
        <h1 id="page-title">
          {scroll ? "Troque o scroll automático" : "Menos decoreba."}
          <br />
          <em>{scroll ? "por um novo acerto." : "Mais raciocínio."}</em>
        </h1>
      </div>
      <div className="intro-aside">
        <span className="intro-line" />
        <p>
          {scroll
            ? "Uma questão de cada vez. Um novo jeito de transformar sua curiosidade em conhecimento."
            : "Treine sua mente. Desafie seus limites.\nSeu próximo acerto no ENEM\ncomeça com um pouco de prática."}
        </p>
        <span className="intro-signature">No seu ritmo. Do seu jeito.</span>
      </div>
    </section>
  );
}
