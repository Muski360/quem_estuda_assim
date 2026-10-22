"use client";

import { useId, useState } from "react";
import { Sparkles } from "lucide-react";

export function FormulaReveal({ formula }: { formula: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="formula-reveal">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={id}>
        <Sparkles size={15} aria-hidden="true" />
        {open ? "Ocultar fórmula" : "Mostrar fórmula"}
      </button>
      <div id={id} hidden={!open} className="formula-paper" role="status">
        <span aria-hidden="true">✦</span>
        <p>{formula}</p>
      </div>
    </div>
  );
}
