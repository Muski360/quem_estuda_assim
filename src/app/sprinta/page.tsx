import type { Metadata } from "next";
import { Sprint } from "@/components/sprint/sprint";
import "@/components/writing/writing.css";
import "@/components/sprint/sprint.css";

export const metadata: Metadata = {
  title: "Quem Sprinta Assim? · Redação ENEM 2026",
  description: "Seis dias, 12 redações reais nota 1000, análises por trecho e prática das cinco competências. De 2 a 7 de novembro de 2026, com revisão e simulado final.",
};

export default function SprintPage() { return <Sprint />; }
