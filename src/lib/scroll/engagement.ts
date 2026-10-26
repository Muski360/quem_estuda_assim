import type { ScrollItem, ScrollSession } from "./types.ts";

export function scrollChallenge(session: Pick<ScrollSession, "answered" | "streak" | "mode" | "items">) {
  const closed = session.answered > 0 && session.answered % 5 === 0 && session.items[0]?.status === "answered";
  const block = Math.floor(session.answered / 5) + (closed ? 0 : 1);
  const progress = closed ? 5 : session.answered % 5;
  const review = !["feed", "session"].includes(session.mode);
  return { block, progress, closed, review, nextXp: review ? 0 : session.streak >= 2 ? 15 : 10,
    hint: review ? "Recuperar o que aprendeu · sem repetir XP" : session.streak >= 2 ? "Próximo acerto inédito: 15 XP" : `Mais ${3 - session.streak} acertos para ativar o combo` };
}

export function answerFeedback(item: Pick<ScrollItem, "status" | "correct" | "correctIndex" | "xp">, streak: number) {
  if (item.status !== "answered") return { title: item.status === "expired" ? "O tempo terminou." : "Questão pulada.", detail: "Ela pode voltar em outra sessão." };
  if (!item.correct) return { title: `Resposta correta: ${String.fromCharCode(65 + item.correctIndex!)}`, detail: "Salva para revisar. Uma nova chance à frente." };
  return { title: streak >= 3 ? `Acertou! Combo ${streak}` : "Acertou!", detail: item.xp ? `+${item.xp} XP${item.xp === 15 ? " · seu combo valeu mais" : streak === 2 ? " · próximo acerto inédito: 15 XP" : " · boa leitura"}` : "Revisão certa · sem repetir XP por questão." };
}
