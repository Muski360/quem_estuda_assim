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
    const match = logarithm.expression.match(/^log([₂₃₄₅₆₇₈])\((\d+)\)$/)!;
    assert.equal(
      subscript.indexOf(match[1]) ** logarithm.answer,
      Number(match[2]),
    );
  }
});

test("áreas e volumes correspondem às dimensões apresentadas", () => {
  const shapes = new Set<string>();
  for (let index = 0; index < 300; index++) {
    const equation = generateEquation("geometry", "warmup");
    const dimensions = equation.expression.match(/\d+/g)!.map(Number);
    const shape = equation.expression.split(" · ")[0];
    shapes.add(shape);
    const [a, b, c] = dimensions;
    const expected =
      shape === "Quadrado"
        ? a ** 2
        : shape === "Triângulo"
          ? (a * b) / 2
          : shape === "Retângulo"
            ? a * b
            : shape === "Cubo"
              ? a ** 3
              : a * b * c;
    assert.equal(equation.answer, expected, equation.expression);
    const figure = equation.geometry!;
    assert.ok(figure, "Geometria precisa de dados para desenhar a figura");
    assert.equal(figure.shape, ({ Quadrado: "square", Triângulo: "triangle", Retângulo: "rectangle", Cubo: "cube", Bloco: "cuboid" } as Record<string, string>)[shape]);
    assert.equal("answer" in figure, false);
    if (figure.shape === "square" || figure.shape === "cube")
      assert.equal(figure.side, a);
    else if (figure.shape === "cuboid")
      assert.deepEqual([figure.width, figure.height, figure.depth], [a, b, c]);
    else if ("base" in figure) assert.deepEqual([figure.base, figure.height], [a, b]);
  }
  assert.equal(shapes.size, 5);
});

test("sólidos avançados usam coeficientes exatos de π ou √3 só em Difícil/Brutal", () => {
  for (const difficulty of ["hard","brutal"] as const) {
    for (const [index,shape] of [[5,"cylinder"],[6,"cone"],[7,"pyramid"],[8,"frustum"]] as const) {
      const equation=generateEquation("geometry",difficulty,()=> (index+.5)/9);
      const figure=equation.geometry!;
      assert.equal(figure.shape,shape);
      if (figure.shape==="pyramid") {
        assert.equal(equation.factor,"√3");
        assert.equal(equation.answer,figure.baseSide**2*figure.height/12);
      } else if (figure.shape==="cylinder" || figure.shape==="cone") {
        assert.equal(equation.factor,"π");
        assert.equal(equation.answer,figure.radius**2*figure.height/(figure.shape==="cone" ? 3:1));
      } else if (figure.shape==="frustum") {
        assert.equal(equation.factor,"π");
        assert.equal(equation.answer,figure.height/3*(figure.radius**2+figure.radius*figure.topRadius+figure.topRadius**2));
        assert.ok(figure.radius > figure.topRadius);
      }
      assert.match(equation.hint,/coeficiente/);
      assert.equal(Number.isSafeInteger(equation.answer),true);
      assert.equal("answer" in figure,false);
    }
  }
  for (const difficulty of ["warmup","medium"] as const) {
    for (let i=0;i<9;i++) {
      const equation=generateEquation("geometry",difficulty,()=> (i+.5)/9);
      assert.equal(equation.factor,undefined);
      assert.ok(["square","triangle","rectangle","cube","cuboid"].includes(equation.geometry!.shape));
    }
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
  for (const [random, expected] of [[0.7, "cube"], [0.95, "cuboid"]] as const) {
    const equation = generateEquation("geometry", "warmup", () => random);
    assert.equal(equation.geometry?.shape, expected);
  }
  assert.equal(generateEquation("basic", "warmup").geometry, undefined);
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
