import type { Metadata } from "next";
import { ReadingGame } from "@/components/reading/reading-game";
import "@/components/reading/reading.css";

export const metadata: Metadata = { title: "Quem Lê Assim?", description: "Associe ideias, encontre pistas no texto e revise figuras de linguagem, funções da linguagem, literatura e vanguardas. Jogue sem precisar de conta." };
export default function ReadingPage() { return <ReadingGame />; }
