"use client";

import { Check, Lightbulb, X } from "lucide-react";
import { AREAS } from "@/lib/questions";
import type { Question } from "@/lib/questions";

export function QuestionCard({
  question,
  index,
  cycle,
  selected,
  expired,
  onAnswer,
}: {
  question: Question;
  index: number;
  cycle: number;
  selected?: number;
  expired: boolean;
  onAnswer: (answer: number) => void;
}) {
  const answered = selected !== undefined;
  const locked = answered || expired;
  const area = AREAS[question.area];
  return (
    <article
      className={`question-card ${area.color}`}
      data-index={index}
      aria-labelledby={`question-title-${index}`}
    >
      <div className="question-meta">
        <span className="area-tag">
          <span />
          {area.label}
        </span>
        <span className="question-number">
          {cycle > 0 ? `REVISÃO ${cycle + 1}` : "PRÁTICA ENEM"}{" "}
          <span> / {String(index + 1).padStart(2, "0")}</span>
        </span>
      </div>
      <div
        className="question-scroll"
        tabIndex={0}
        role="region"
        aria-label={`Enunciado e alternativas da questão ${index + 1}`}
      >
        <p className="question-topic">{question.topic}</p>
        <h3 id={`question-title-${index}`}>{question.title}</h3>
        <blockquote className="question-support">{question.support}</blockquote>
        <p className="question-prompt">{question.prompt}</p>
        <div className="alternatives" role="group" aria-label="Alternativas">
          {question.alternatives.map((alternative, option) => {
            const correct = locked && option === question.correctIndex;
            const incorrect =
              answered &&
              option === selected &&
              option !== question.correctIndex;
            return (
              <button
                key={option}
                className={`alternative${correct ? " answer-correct" : incorrect ? " answer-incorrect" : ""}`}
                onClick={() => onAnswer(option)}
                disabled={locked}
                aria-pressed={selected === option}
              >
                <span className="alternative-letter">
                  {String.fromCharCode(65 + option)}
                </span>
                <span>{alternative}</span>
                {correct ? (
                  <Check size={17} aria-label="Alternativa correta" />
                ) : incorrect ? (
                  <X size={17} aria-label="Sua resposta está incorreta" />
                ) : null}
              </button>
            );
          })}
        </div>
        {locked && (
          <div
            className={`question-explanation${selected === question.correctIndex ? " success" : ""}`}
            role="status"
          >
            <span>
              <Lightbulb size={17} aria-hidden="true" />
              <strong>
                {expired
                  ? "O tempo passou. O aprendizado fica."
                  : selected === question.correctIndex
                    ? "É isso. Mais um acerto!"
                    : "Faz parte. Vamos entender?"}
              </strong>
            </span>
            <p>{question.explanation}</p>
          </div>
        )}
        <p className="question-source">
          Questão autoral de demonstração · Estilo ENEM
        </p>
      </div>
      <div className="question-bottom">
        <span>
          {locked
            ? "Leia a explicação. Depois, avance."
            : "Role a questão para ler todas as alternativas."}
        </span>
        <span className="question-bottom-mark" aria-hidden="true">
          q.
        </span>
      </div>
    </article>
  );
}
