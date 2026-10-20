import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DIFFICULTIES,
  generateEquation,
  isCorrectAnswer,
  isGameSettings,
  MODES,
  parseAnswer,
} from "./generator.ts";
import type { Difficulty, MathMode } from "./generator.ts";

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
    const equation = generateEquation("geometry", "brutal");
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
  }
  assert.equal(shapes.size, 5);
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
