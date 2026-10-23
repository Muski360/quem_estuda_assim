import type { Equation } from "@/lib/math/generator";

export function EquationHint({ equation }: {
  equation: Pick<Equation, "hint" | "mode" | "measurement" | "geometry" | "factor"> | null;
}) {
  if (equation?.mode !== "geometry" || !equation.measurement) {
    return <p className="equation-hint">{equation?.hint ?? "Preparando seu treino…"}</p>;
  }

  const { measurement, geometry, factor } = equation;
  const target = {
    area: "a área",
    volume: "o volume",
    perimeter: "o perímetro",
    basePerimeter: geometry?.shape === "frustum" ? "o perímetro da base maior" : "o perímetro da base",
  }[measurement];
  const unit = measurement === "area" ? "cm²" : measurement === "volume" ? "cm³" : "cm";

  return (
    <p className="equation-hint geometry-prompt">
      <strong>Calcule {target}</strong>
      <span>Resposta em {unit}.{factor && ` Digite apenas o coeficiente de ${factor}.`}</span>
    </p>
  );
}
