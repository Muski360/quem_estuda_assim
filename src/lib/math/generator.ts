export const DIFFICULTIES = {
  warmup: { label: "Aquecimento", max: 20, seconds: 30 },
  medium: { label: "Médio", max: 50, seconds: 25 },
  hard: { label: "Difícil", max: 100, seconds: 20 },
  brutal: { label: "Brutal", max: 200, seconds: 15 },
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
    description: "Perímetros, áreas e volumes",
    symbol: "△",
  },
} as const;

export type Difficulty = keyof typeof DIFFICULTIES;
export type MathMode = keyof typeof MODES;
export type GameSettings = {
  mode: MathMode | MathMode[];
  difficulty: Difficulty;
  rounds: number;
  seconds?: number;
};
export type GeometryFigure =
  | { shape: "square"; side: number }
  | { shape: "triangle"; base: number; height: number; side?: number }
  | { shape: "rectangle"; base: number; height: number }
  | { shape: "circle"; radius: number }
  | { shape: "trapezoid"; base: number; topBase: number; height: number; side: number }
  | { shape: "cube"; side: number }
  | { shape: "cuboid"; width: number; height: number; depth: number }
  | { shape: "prism"; base: number; baseHeight: number; baseSide: number; height: number }
  | { shape: "cylinder" | "cone"; radius: number; height: number }
  | { shape: "pyramid"; baseSide: number; height: number }
  | { shape: "frustum"; radius: number; topRadius: number; height: number };

export type AnswerFactor = "√3" | "π";

export type Equation = {
  id: string;
  mode: MathMode;
  expression: string;
  answer: number;
  hint: string;
  explanation: string;
  geometry?: GeometryFigure;
  factor?: AnswerFactor;
  measurement?: "area" | "volume" | "perimeter" | "basePerimeter";
  formula?: string;
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
    (typeof settings.mode === "string"
      ? Object.hasOwn(MODES, settings.mode)
      : Array.isArray(settings.mode) &&
        settings.mode.length >= 1 &&
        settings.mode.length <= Object.keys(MODES).length &&
        new Set(settings.mode).size === settings.mode.length &&
        settings.mode.every((mode) => typeof mode === "string" && Object.hasOwn(MODES, mode))) &&
    typeof settings.difficulty === "string" &&
    Object.hasOwn(DIFFICULTIES, settings.difficulty) &&
    typeof settings.rounds === "number" &&
    [5, 10, 20, 30].includes(settings.rounds) &&
    (settings.seconds === undefined ||
      (typeof settings.seconds === "number" && Number.isInteger(settings.seconds) && settings.seconds >= 5 && settings.seconds <= 180))
  );
}

export function getQuestionSeconds(settings: GameSettings): number {
  return settings.seconds ?? DIFFICULTIES[settings.difficulty].seconds;
}

export function formatAnswer(answer: number, factor?: AnswerFactor): string {
  return `${String(answer).replace(".", ",")}${factor ?? ""}`;
}

export function getSelectedModes(mode: GameSettings["mode"]): MathMode[] {
  return Array.isArray(mode) ? mode : [mode];
}

export function generateRound(settings: GameSettings, index: number, random = Math.random, recent: readonly string[] = []): Equation {
  const modes = getSelectedModes(settings.mode);
  if (modes.length === 0) throw new Error("Selecione pelo menos um conteúdo.");
  let equation: Equation;
  for (let attempt = 0; attempt < 24; attempt++) {
    equation = generateEquation(modes[index % modes.length], settings.difficulty, random);
    if (!recent.includes(equation.expression)) return equation;
  }
  return equation!;
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
  const a = integer(0, max);
  const b = integer(0, max);
  let expression: string;
  let answer: number;
  let hint = "Calcule mentalmente. Você consegue.";
  let explanation: string;
  let geometry: GeometryFigure | undefined;
  let factor: AnswerFactor | undefined;
  let measurement: Equation["measurement"];
  let formula: string | undefined;

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
        const multiplicand = integer(0, [12, 30, 75, 150][level]);
        expression = `${multiplicand} × ${factor}`;
        answer = multiplicand * factor;
      } else {
        const divisor = integer(2, 12 + level * 6);
        expression = `${a * divisor} ÷ ${divisor}`;
        answer = a;
      }
      explanation = `${expression} = ${answer}. Separe os números em partes menores para ganhar velocidade.`;
      break;
    }
    case "powers": {
      const exponent = integer(2, level > 1 ? 3 : 2);
      const base = integer(2, exponent === 3 ? 9 + level * 2 : 12 + level * 3);
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
      const base = integer(2, 9 + level * 2);
      const exponent = integer(1, base > 5 + level ? 2 : 2 + level);
      const argument = base ** exponent;
      if (integer(0, 1) === 0) {
        answer = exponent;
        expression = `log${subscript(base)}(${argument})`;
        hint = "A qual expoente a base deve ser elevada?";
      } else {
        answer = argument;
        expression = `log${subscript(base)}(x) = ${exponent}`;
        hint = "Qual é o valor de x dentro do logaritmo?";
      }
      explanation = `log${subscript(base)}(${argument}) = ${exponent}, porque ${base}${superscript(exponent)} = ${argument}.`;
      break;
    }
    case "geometry": {
      let calculation: string;
      const perimeter = integer(0, 1) === 1;
      const side = integer(2, (perimeter ? 16 : 8) + level * 5);
      const height = integer(2, 8 + level * 4);
      const shape = integer(0, level >= 2 ? 11 : 7);
      measurement = shape === 0 || shape === 1 || shape === 2 || shape === 5 || shape === 6
        ? (perimeter ? "perimeter" : "area") : (perimeter ? "basePerimeter" : "volume");
      if (shape === 0) {
        geometry = { shape: "square", side };
        expression = `Quadrado · lado ${side} cm`;
        answer = perimeter ? side * 4 : side ** 2;
        formula = perimeter ? "P = 4 × lado" : "A = lado²";
        calculation = perimeter ? `4 × ${side}` : `${side}²`;
      } else if (shape === 1) {
        if (perimeter) {
          const scale = integer(1, 4 + level * 2);
          const [halfBase, triangleHeight] = integer(0, 1) ? [3, 4] : [4, 3];
          geometry = { shape: "triangle", base: halfBase * 2 * scale, height: triangleHeight * scale, side: 5 * scale };
          expression = `Triângulo isósceles · base ${geometry.base} cm · lados ${geometry.side} cm`;
          answer = geometry.base + 2 * geometry.side!;
          formula = "P = base + lado + lado";
          calculation = `${geometry.base} + ${geometry.side} + ${geometry.side}`;
        } else {
          geometry = { shape: "triangle", base: side * 2, height };
          expression = `Triângulo · b ${side * 2} cm · h ${height} cm`;
          answer = side * height;
          formula = "A = (base × altura) ÷ 2";
          calculation = `(${side * 2} × ${height}) ÷ 2`;
        }
      } else if (shape === 2) {
        geometry = { shape: "rectangle", base: side, height };
        expression = `Retângulo · ${side} × ${height} cm`;
        answer = perimeter ? 2 * (side + height) : side * height;
        formula = perimeter ? "P = 2 × (base + altura)" : "A = base × altura";
        calculation = perimeter ? `2 × (${side} + ${height})` : `${side} × ${height}`;
      } else if (shape === 3) {
        const edge = perimeter ? side : integer(2, 8 + level * 3);
        geometry = { shape: "cube", side: edge };
        expression = `Cubo · aresta ${edge} cm`;
        answer = perimeter ? edge * 4 : edge ** 3;
        formula = perimeter ? "P da base = 4 × aresta" : "V = aresta³";
        calculation = perimeter ? `4 × ${edge}` : `${edge}³`;
      } else if (shape === 4) {
        const depth = integer(2, 6 + level * 2);
        geometry = { shape: "cuboid", width: side, height, depth };
        expression = `Bloco · comprimento ${side} cm · largura ${depth} cm · altura ${height} cm`;
        answer = perimeter ? 2 * (side + depth) : side * height * depth;
        formula = perimeter ? "P da base = 2 × (comprimento + largura)" : "V = comprimento × largura × altura";
        calculation = perimeter ? `2 × (${side} + ${depth})` : `${side} × ${depth} × ${height}`;
      } else if (shape === 5) {
        geometry = { shape: "circle", radius: side };
        expression = `Círculo · raio ${side} cm`;
        factor = "π";
        answer = perimeter ? 2 * side : side ** 2;
        formula = perimeter ? "P = 2 × π × raio" : "A = π × raio²";
        calculation = perimeter ? `2 × π × ${side}` : `π × ${side}²`;
      } else if (shape === 6) {
        const scale = integer(1, 3 + level);
        const topBase = integer(2, 10 + level * 4);
        geometry = { shape: "trapezoid", base: topBase + 6 * scale, topBase, height: 4 * scale, side: 5 * scale };
        expression = `Trapézio isósceles · bases ${geometry.base} e ${topBase} cm · lados ${geometry.side} cm · h ${geometry.height} cm`;
        answer = perimeter ? geometry.base + topBase + 2 * geometry.side : (geometry.base + topBase) * geometry.height / 2;
        formula = perimeter ? "P = base maior + base menor + lado + lado" : "A = (base maior + base menor) × altura ÷ 2";
        calculation = perimeter ? `${geometry.base} + ${topBase} + ${geometry.side} + ${geometry.side}` : `(${geometry.base} + ${topBase}) × ${geometry.height} ÷ 2`;
      } else if (shape === 7) {
        const scale = integer(1, 3 + level);
        geometry = { shape: "prism", base: 3 * scale, baseHeight: 4 * scale, baseSide: 5 * scale, height };
        expression = `Prisma triangular · base com lados ${geometry.base}, ${geometry.baseHeight} e ${geometry.baseSide} cm · h ${height} cm`;
        answer = perimeter ? 12 * scale : geometry.base * geometry.baseHeight * height / 2;
        formula = perimeter ? "P da base = a + b + c" : "V = (cateto a × cateto b ÷ 2) × altura";
        calculation = perimeter ? `${geometry.base} + ${geometry.baseHeight} + ${geometry.baseSide}` : `(${geometry.base} × ${geometry.baseHeight} ÷ 2) × ${height}`;
      } else {
        const radius = integer(2, level === 3 ? 9 : 6);
        const solidHeight = 3 * integer(2, level === 3 ? 10 : 6);
        factor = perimeter && shape === 10 ? undefined : shape === 10 ? "√3" : "π";
        if (shape === 8) {
          geometry = { shape: "cylinder", radius, height: solidHeight };
          expression = `Cilindro · r ${radius} cm · h ${solidHeight} cm`;
          answer = perimeter ? 2 * radius : radius ** 2 * solidHeight;
          formula = perimeter ? "P da base = 2 × π × raio" : "V = π × raio² × altura";
          calculation = perimeter ? `2 × π × ${radius}` : `π × ${radius}² × ${solidHeight}`;
        } else if (shape === 9) {
          geometry = { shape: "cone", radius, height: solidHeight };
          expression = `Cone · r ${radius} cm · h ${solidHeight} cm`;
          answer = perimeter ? 2 * radius : radius ** 2 * solidHeight / 3;
          formula = perimeter ? "P da base = 2 × π × raio" : "V = π × raio² × altura ÷ 3";
          calculation = perimeter ? `2 × π × ${radius}` : `π × ${radius}² × ${solidHeight} ÷ 3`;
        } else if (shape === 10) {
          const baseSide = radius * 2;
          geometry = { shape: "pyramid", baseSide, height: solidHeight };
          expression = `Pirâmide · base equilátera de lado ${baseSide} cm · h ${solidHeight} cm`;
          answer = perimeter ? 3 * baseSide : radius ** 2 * solidHeight / 3;
          formula = perimeter ? "P da base = 3 × lado" : "V = lado² × altura × √3 ÷ 12";
          calculation = perimeter ? `3 × ${baseSide}` : `${baseSide}² × ${solidHeight} × √3 ÷ 12`;
        } else {
          const largeRadius = radius + integer(2, 5);
          geometry = { shape: "frustum", radius: largeRadius, topRadius: radius, height: solidHeight };
          expression = `Tronco de cone · R ${largeRadius} cm · r ${radius} cm · h ${solidHeight} cm`;
          answer = perimeter ? 2 * largeRadius : solidHeight / 3 * (largeRadius ** 2 + largeRadius * radius + radius ** 2);
          formula = perimeter ? "P da base maior = 2 × π × raio maior" : "V = π × altura × (R² + R × r + r²) ÷ 3";
          calculation = perimeter ? `2 × π × ${largeRadius}` : `π × ${solidHeight} × (${largeRadius}² + ${largeRadius} × ${radius} + ${radius}²) ÷ 3`;
        }
      }
      const unit = perimeter ? "cm" : measurement === "area" ? "cm²" : "cm³";
      const label = measurement === "basePerimeter" ? (shape === 11 ? "perímetro da base maior" : "perímetro da base") : measurement === "perimeter" ? "perímetro" : measurement === "area" ? "área" : "volume";
      hint = `Qual é o ${label === "área" ? "valor da área" : label}, em ${unit}?`;
      if (factor) hint += ` Digite apenas o coeficiente de ${factor}.`;
      explanation = `${formula}. Substituindo: ${calculation} = ${formatAnswer(answer, factor)} ${unit}.`;
      break;
    }
  }

  return { id: crypto.randomUUID(), mode, expression, answer, hint, explanation, ...(geometry ? { geometry, measurement, formula } : {}), ...(factor ? { factor } : {}) };
}
