import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIFFICULTIES,
  generateEquation,
  generateRound,
  formatAnswer,
  getQuestionSeconds,
  getSelectedModes,
  isCorrectAnswer,
  isGameSettings,
  MODES,
  parseAnswer,
} from "./generator.ts";
import type { Difficulty, GameSettings, MathMode } from "./generator.ts";

test("todos os geradores produzem resultados finitos, inteiros e variados", () => {
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (const mode of Object.keys(MODES) as MathMode[]) {
    for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
      const expressions = new Set<string>();
      for (let index = 0; index < 200; index++) {
        const equation = generateEquation(mode, difficulty, random);
        assert.ok(
          Number.isSafeInteger(equation.answer),
          `${mode}/${difficulty}: ${equation.expression}`,
        );
        assert.ok(equation.hint && equation.explanation && equation.id);
        expressions.add(equation.expression);
        if (mode === "basic") {
          const match = equation.expression.match(/^(\d+) ([+−×÷]) (\d+)$/)!;
          const [, left, operation, right] = match;
          const a = Number(left),
            b = Number(right);
          assert.equal(
            equation.answer,
            operation === "+"
              ? a + b
              : operation === "−"
                ? a - b
                : operation === "×"
                  ? a * b
                  : a / b,
          );
        }
        if (mode === "linear") {
          const match = equation.expression.match(
            /^(\d+)x ([+−]) (\d+) = (-?\d+)$/,
          )!;
          assert.equal(
            Number(match[1]) * equation.answer +
              (match[2] === "−" ? -1 : 1) * Number(match[3]),
            Number(match[4]),
          );
        }
      }
      assert.ok(
        expressions.size >= 8,
        `${mode}/${difficulty} precisa variar as equações`,
      );
    }
  }
});

test("potências, raízes e logaritmos mantêm a relação inversa", () => {
  const superscript = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  const subscript = "₀₁₂₃₄₅₆₇₈₉";
  for (let index = 0; index < 100; index++) {
    const power = generateEquation("powers", "brutal");
    if (power.expression.startsWith("√"))
      assert.equal(power.answer ** 2, Number(power.expression.slice(1)));
    else if (power.expression.startsWith("∛"))
      assert.equal(power.answer ** 3, Number(power.expression.slice(1)));
    else {
      const match = power.expression.match(/^(\d+)([²³])$/)!;
      assert.equal(
        power.answer,
        Number(match[1]) ** superscript.indexOf(match[2]),
      );
    }
    const logarithm = generateEquation("logarithms", "brutal");
    const match = logarithm.expression.match(/^log([₀-₉]+)\((\d+|x)\)(?: = (\d+))?$/)!;
    const base = Number([...match[1]].map((digit) => subscript.indexOf(digit)).join(""));
    if (match[2] === "x") assert.equal(logarithm.answer, base ** Number(match[3]));
    else assert.equal(base ** logarithm.answer, Number(match[2]));
  }
});

function geometryAt(shape: number, perimeter: boolean, difficulty: Difficulty = "hard") {
  const sequence = [0.4, 0.4, perimeter ? 0.75 : 0.25, 0.4, 0.4, (shape + 0.5) / (difficulty === "warmup" || difficulty === "medium" ? 8 : 12)];
  return generateEquation("geometry", difficulty, () => sequence.shift() ?? 0.4);
}

test("perímetros, áreas e volumes conferem para todas as figuras e níveis", () => {
  for (const difficulty of Object.keys(DIFFICULTIES) as Difficulty[]) {
    const count = difficulty === "warmup" || difficulty === "medium" ? 8 : 12;
    const shapes = new Set<string>();
    for (let index = 0; index < count; index++) for (const perimeter of [false, true]) {
      const equation = geometryAt(index, perimeter, difficulty);
      const figure = equation.geometry!;
      shapes.add(figure.shape);
      let expected: number;
      switch (figure.shape) {
        case "square": expected = perimeter ? 4 * figure.side : figure.side ** 2; break;
        case "rectangle": expected = perimeter ? 2 * (figure.base + figure.height) : figure.base * figure.height; break;
        case "triangle":
          expected = perimeter ? figure.base + 2 * figure.side! : figure.base * figure.height / 2;
          if (perimeter) assert.equal((figure.base / 2) ** 2 + figure.height ** 2, figure.side! ** 2);
          break;
        case "circle": expected = perimeter ? 2 * figure.radius : figure.radius ** 2; break;
        case "trapezoid":
          expected = perimeter ? figure.base + figure.topBase + 2 * figure.side : (figure.base + figure.topBase) * figure.height / 2;
          assert.equal(((figure.base - figure.topBase) / 2) ** 2 + figure.height ** 2, figure.side ** 2);
          break;
        case "cube": expected = perimeter ? 4 * figure.side : figure.side ** 3; break;
        case "cuboid": expected = perimeter ? 2 * (figure.width + figure.depth) : figure.width * figure.height * figure.depth; break;
        case "prism":
          expected = perimeter ? figure.base + figure.baseHeight + figure.baseSide : figure.base * figure.baseHeight * figure.height / 2;
          assert.equal(figure.base ** 2 + figure.baseHeight ** 2, figure.baseSide ** 2);
          break;
        case "cylinder": expected = perimeter ? 2 * figure.radius : figure.radius ** 2 * figure.height; break;
        case "cone": expected = perimeter ? 2 * figure.radius : figure.radius ** 2 * figure.height / 3; break;
        case "pyramid": expected = perimeter ? 3 * figure.baseSide : figure.baseSide ** 2 * figure.height / 12; break;
        case "frustum": expected = perimeter ? 2 * figure.radius : figure.height / 3 * (figure.radius ** 2 + figure.radius * figure.topRadius + figure.topRadius ** 2); break;
      }
      assert.equal(equation.answer, expected, `${difficulty}/${equation.expression}`);
      assert.ok(Number.isSafeInteger(expected));
      assert.ok(equation.formula);
      assert.equal("answer" in figure, false);
      const pi = ["circle", "cylinder", "cone", "frustum"].includes(figure.shape);
      assert.equal(equation.factor, pi ? "π" : figure.shape === "pyramid" && !perimeter ? "√3" : undefined);
      if (perimeter) {
        assert.ok(["perimeter", "basePerimeter"].includes(equation.measurement!));
        assert.match(equation.hint, /perímetro.*cm\?/);
        assert.doesNotMatch(equation.hint, /cm[²³]/);
      } else assert.ok(["area", "volume"].includes(equation.measurement!));
    }
    assert.equal(shapes.size, count);
  }
  assert.equal(formatAnswer(12,"√3"),"12√3");
  assert.equal(formatAnswer(12,"π"),"12π");
  assert.equal(formatAnswer(-1.5),"-1,5");
});

test("tempo aceita só segundos inteiros entre 5 e 180 e mantém salas antigas",()=>{
  const settings:GameSettings={mode:"basic",difficulty:"hard",rounds:5};
  assert.equal(getQuestionSeconds(settings),20);
  for (const seconds of [5,10,45,180]) {
    assert.equal(isGameSettings({...settings,seconds}),true);
    assert.equal(getQuestionSeconds({...settings,seconds}),seconds);
  }
  for (const seconds of [0,4,181,5.5,NaN,Infinity,"20",null])
    assert.equal(isGameSettings({...settings,seconds}),false);
});

test("aquecimento também inclui cubos e blocos com medidas estruturadas", () => {
  for (const [shape, expected] of [[3, "cube"], [4, "cuboid"]] as const) {
    const equation = geometryAt(shape, false, "warmup");
    assert.equal(equation.geometry?.shape, expected);
  }
  assert.equal(generateEquation("basic", "warmup").geometry, undefined);
});

test("intervalos e formatos ampliam diversidade sem multiplicações maiores no aquecimento", () => {
  let seed = 123;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (const [mode, minimum] of [["basic", 350], ["powers", 22], ["linear", 300], ["logarithms", 32], ["geometry", 280]] as const) {
    const expressions = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      const equation = generateEquation(mode, "warmup", random);
      expressions.add(equation.expression);
      if (mode === "basic" && equation.expression.includes("×")) {
        const [left, right] = equation.expression.split(" × ").map(Number);
        assert.ok(left <= 12 && right <= 9);
      }
    }
    assert.ok(expressions.size >= minimum, `${mode}: apenas ${expressions.size} contas diferentes`);
  }
});

test("histórico evita repetição recente e tentativas têm limite com RNG constante", () => {
  const settings: GameSettings = { mode: "powers", difficulty: "warmup", rounds: 30 };
  let seed = 456;
  const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const recent: string[] = [];
  for (let index = 0; index < 100; index++) {
    const equation = generateRound(settings, index, random, recent);
    assert.ok(!recent.includes(equation.expression));
    recent.push(equation.expression);
    if (recent.length > 12) recent.shift();
  }
  const repeated = generateRound(settings, 0, () => 0.5);
  let calls = 0;
  assert.equal(generateRound(settings, 1, () => { calls++; return 0.5; }, [repeated.expression]).expression, repeated.expression);
  assert.ok(calls <= 24 * 10);
});

test("seleção múltipla aceita apenas conteúdos únicos e não vazios", () => {
  const settings = { mode: ["basic", "geometry", "logarithms"], difficulty: "warmup", rounds: 5 };
  assert.equal(isGameSettings(settings), true);
  assert.equal(isGameSettings({ ...settings, mode: Object.keys(MODES) }), true);
  for (const mode of [[], ["basic", "basic"], ["__proto__"], ["basic", "outro"], [null], "outro", null])
    assert.equal(isGameSettings({ ...settings, mode }), false);
  assert.deepEqual(getSelectedModes("geometry"), ["geometry"]);
});

test("rodadas intercalam só os conteúdos escolhidos, preservando o tipo da questão", () => {
  const settings: GameSettings = { mode: ["basic", "geometry", "linear"], difficulty: "warmup", rounds: 10 };
  const modes: MathMode[] = [];
  for (let index = 0; index < 9; index++) {
    const equation = generateRound(settings, index, () => 0.7);
    modes.push(equation.mode);
    assert.equal(!!equation.geometry, equation.mode === "geometry");
    if (equation.mode === "linear") assert.match(equation.expression, /x/);
    if (equation.mode === "basic") assert.match(equation.expression, /×/);
  }
  assert.deepEqual(modes, ["basic", "geometry", "linear", "basic", "geometry", "linear", "basic", "geometry", "linear"]);
  assert.throws(() => generateRound({ ...settings, mode: [] }, 0), /Selecione/);
  assert.equal(generateRound({ ...settings, mode: "logarithms" }, 3).mode, "logarithms");
});

test("validação aceita vírgula decimal e rejeita entradas ambíguas", () => {
  assert.equal(parseAnswer(" -12,5 "), -12.5);
  assert.equal(parseAnswer("0"), 0);
  for (const value of [
    "",
    "  ",
    "Infinity",
    "NaN",
    "0x10",
    "1e3",
    "1,2,3",
    "12abc",
  ])
    assert.equal(parseAnswer(value), null);
  assert.equal(isCorrectAnswer(2.0001, 2), true);
  assert.equal(isCorrectAnswer(Infinity, 2), false);
  assert.equal(isCorrectAnswer(2.01, 2), false);
  assert.equal(
    isGameSettings({ mode: "basic", difficulty: "warmup", rounds: 10 }),
    true,
  );
  for (const value of [
    null,
    { mode: "__proto__", difficulty: "warmup", rounds: 10 },
    { mode: "basic", difficulty: "warmup", rounds: 999 },
  ])
    assert.equal(isGameSettings(value), false);
});
