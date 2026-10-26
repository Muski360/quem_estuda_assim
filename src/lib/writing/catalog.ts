import { WRITING_PILOT } from "../../data/writing/pilot.ts";
import { WRITING_EXPANSION } from "../../data/writing/expansion.ts";
import { WRITING_WORKSHOPS } from "../../data/writing/workshops.ts";
import { WRITING_TOPICS } from "../../data/writing/topics.ts";
import { WRITING_READINGS } from "../../data/writing/readings.ts";
import type { Competency } from "./types.ts";

export const COMPETENCIES: Record<Competency, { title: string; guide: string }> = {
  C1: { title: "Escrita formal", guide: "Leia a frase inteira. Confira sujeito e verbo, pontuação, concordância e regência. Revise sem trocar a ideia pretendida; uma ocorrência isolada não define a qualidade de todo o texto." },
  C2: { title: "Tema e repertório", guide: "Identifique o problema, o público e o contexto pedidos. Relacione a referência ao argumento e explique essa relação. Um nome famoso não substitui o desenvolvimento do tema." },
  C3: { title: "Argumentação", guide: "Pergunte o que você defende e por quê. Explique o mecanismo entre o obstáculo e seu efeito. Diferencie informação, hipótese e conclusão; não invente dados para sustentar uma tese." },
  C4: { title: "Coesão", guide: "Identifique a relação entre as ideias antes de escolher o conectivo. Confira o referente de cada retomada. Variar palavras é útil quando mantém a precisão e ajuda o raciocínio a avançar." },
  C5: { title: "Intervenção", guide: "Volte ao problema desenvolvido. Especifique quem faz o quê, como e com qual finalidade; detalhe o que ajuda a entender a execução. A proposta precisa respeitar direitos humanos e ter relação com seu diagnóstico." },
};
export const CODES = Object.keys(COMPETENCIES) as Competency[];
export const WRITING_CATALOG = { edition: 1, activities: [...WRITING_PILOT, ...WRITING_EXPANSION], workshops: WRITING_WORKSHOPS, topics: WRITING_TOPICS, readings: WRITING_READINGS };
export const activityById = (id: string, edition = 1) => edition === 1 ? WRITING_CATALOG.activities.find(a => a.id === id) : undefined;
