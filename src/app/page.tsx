import { Calculator } from "@/components/calculator/calculator";
import { TodayPlan } from "@/components/learning/today-plan";

export default function Home() {
  return (
    <main id="conteudo" className="main-shell">
      <TodayPlan />
      <Calculator />
    </main>
  );
}
