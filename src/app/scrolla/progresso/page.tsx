import type { Metadata } from "next";
import { ScrollProgress } from "@/components/scroll/scroll-progress";

export const metadata: Metadata = { title: "Meu progresso no Scroll" };
export default function ScrollProgressPage() { return <ScrollProgress />; }
