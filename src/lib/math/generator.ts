export const DIFFICULTIES = {
  warmup: { label: "Aquecimento", max: 12, seconds: 30 },
  medium: { label: "Médio", max: 30, seconds: 25 },
  hard: { label: "Difícil", max: 75, seconds: 20 },
  brutal: { label: "Brutal", max: 150, seconds: 15 },
} as const;

export const MODES = {
  basic: {
    label: "4 operações",
    description: "O básico, cada vez mais rápido",
    symbol: "+ − × ÷",
  },
  powers: {
    label: "Potências e raízes",
    description: "Eleve seu raciocínio",
    symbol: "x² √",
  },
  linear: {
    label: "Função de 1º grau",
    description: "Encontre o valor de x",
    symbol: "ƒ(x)",
  },
  logarithms: {
    label: "Logaritmos",
    description: "Uma nova base para pensar",
    symbol: "log",
  },
  geometry: {
    label: "Geometria",
    description: "Áreas e volumes, sem papel",
    symbol: "△",
  },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;
export type MathMode = keyof typeof MODES;
export type GameSettings = {
  mode: MathMode;
  difficulty: Difficulty;
  rounds: number;
};
export type Equation = {
  id: string;
  expression: string;
  answer: number;
  hint: string;
  explanation: string;
};

export const DEFAULT_SETTINGS: GameSettings = {
  mode: "basic",
  difficulty: "warmup",
  rounds: 10,
};

export function isGameSettings(value: unknown): value is GameSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Record<string, unknown>;
  return (
    typeof settings.mode === "string" &&
    Object.hasOwn(MODES, settings.mode) &&
    typeof settings.difficulty === "string" &&
    Object.hasOwn(DIFFICULTIES, settings.difficulty) &&
    typeof settings.rounds === "number" &&
    [5, 10, 20, 30].includes(settings.rounds)
  );
}

export function parseAnswer(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

export function isCorrectAnswer(value: number, answer: number): boolean {
  return Number.isFinite(value) && Math.abs(value - answer) < 0.005;
}

const superscript = (value: number) =>
  String(value).replace(/\d/g, (digit) => "⁰¹²³⁴⁵⁶⁷⁸⁹"[Number(digit)]);
const subscript = (value: number) =>
  String(value).replace(/\d/g, (digit) => "₀₁₂₃₄₅₆₇₈₉"[Number(digit)]);

export function generateEquation(
  mode: MathMode,
  difficulty: Difficulty,
  random = Math.random,
): Equation {
  const integer = (min: number, max: number) =>
    Math.floor(random() * (max - min + 1)) + min;
  const level = Object.keys(DIFFICULTIES).indexOf(difficulty);
  const max = DIFFICULTIES[difficulty].max;
  const a = integer(2, max);
  const b = integer(2, max);
  let expression: string;
  let answer: number;
  let hint = "Calcule mentalmente. Você consegue.";
  let explanation: string;

  switch (mode) {
    case "basic": {
      const operation = integer(0, 3);
      if (operation === 0) {
        expression = `${a} + ${b}`;
        answer = a + b;
      } else if (operation === 1) {
        expression = `${a} − ${b}`;
        answer = a - b;
      } else if (operation === 2) {
        const factor = integer(2, 9 + level * 5);
        expression = `${a} × ${factor}`;
        answer = a * factor;
      } else {
        expression = `${a * b} ÷ ${b}`;
        answer = a;
      }
      explanation = `${expression} = ${answer}. Separe os números em partes menores para ganhar velocidade.`;
      break;
    }
    case "powers": {
      const base = integer(2, 9 + level * 3);
      const exponent = integer(2, level > 1 ? 3 : 2);
      if (integer(0, 1) === 0) {
        expression = `${base}${superscript(exponent)}`;
        answer = base ** exponent;
        explanation = `${base}${superscript(exponent)} = ${Array(exponent).fill(base).join(" × ")} = ${answer}.`;
      } else {
        expression = `${exponent === 2 ? "√" : "∛"}${base ** exponent}`;
        answer = base;
        explanation = `A raiz é ${base}, pois ${base}${superscript(exponent)} = ${base ** exponent}.`;
      }
      hint = "Potência ou raiz: encontre a operação inversa.";
      break;
    }
    case "linear": {
      const coefficient = integer(2, 5 + level * 4);
      answer = integer(level > 0 ? -max : 1, max);
      const offset = integer(-max, max);
      const result = coefficient * answer + offset;
      expression = `${coefficient}x ${offset < 0 ? "−" : "+"} ${Math.abs(offset)} = ${result}`;
      hint = "Qual é o valor de x?";
      explanation = `Isole x: ${coefficient}x = ${result - offset}. Logo, x = ${result - offset} ÷ ${coefficient} = ${answer}.`;
      break;
    }
    case "logarithms": {
      const base = integer(2, 5 + level);
      answer = integer(1, 2 + level);
      expression = `log${subscript(base)}(${base ** answer})`;
      hint = "A qual expoente a base deve ser elevada?";
      explanation = `log${subscript(base)}(${base ** answer}) = ${answer}, porque ${base}${superscript(answer)} = ${base ** answer}.`;
      break;
    }
    case "geometry": {
      const side = integer(2, 8 + level * 6);
      const height = integer(2, 8 + level * 5);
      const shape = integer(0, level > 0 ? 4 : 2);
      if (shape === 0) {
        expression = `Quadrado · lado ${side} cm`;
        answer = side ** 2;
        explanation = `Área = lado² = ${side} × ${side} = ${answer} cm².`;
      } else if (shape === 1) {
        expression = `Triângulo · b ${side * 2} · h ${height}`;
        answer = side * height;
        explanation = `Área = (base × altura) ÷ 2 = (${side * 2} × ${height}) ÷ 2 = ${answer} cm².`;
      } else if (shape === 2) {
        expression = `Retângulo · ${side} × ${height} cm`;
        answer = side * height;
        explanation = `Área = base × altura = ${side} × ${height} = ${answer} cm².`;
      } else if (shape === 3) {
        expression = `Cubo · aresta ${side} cm`;
        answer = side ** 3;
        explanation = `Volume = aresta³ = ${side}³ = ${answer} cm³.`;
      } else {
        expression = `Bloco · ${side} × ${height} × 2 cm`;
        answer = side * height * 2;
        explanation = `Volume = comprimento × largura × altura = ${side} × ${height} × 2 = ${answer} cm³.`;
      }
      hint = shape < 3 ? "Qual é a área, em cm²?" : "Qual é o volume, em cm³?";
      break;
    }
  }

  return { id: crypto.randomUUID(), expression, answer, hint, explanation };
}
