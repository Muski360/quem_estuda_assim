import type { Metadata } from "next";
import { WritingGame } from "@/components/writing/writing-game";
import "@/components/writing/writing.css";

export const metadata: Metadata = { title: "Quem Escreve Assim?", description: "Treine as cinco competências da redação do ENEM. Escreva, revise, compare versões e aprenda com redações nota 1000. Aberto sem login." };
export default function WritingPage() { return <WritingGame />; }
