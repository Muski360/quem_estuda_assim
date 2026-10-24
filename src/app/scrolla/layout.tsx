import type { ReactNode } from "react";
import "katex/dist/katex.min.css";
import "@/components/scroll/scroll.css";

export default function ScrollLayout({ children }: { children: ReactNode }) {
  return <div className="scroll-app">{children}</div>;
}
