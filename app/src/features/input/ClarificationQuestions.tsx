import { useState, type JSX } from "react";
import type { ClarificationQuestion } from "../../generation/contract";

/** Renders the (up to 5) LLM gap-analysis follow-up questions for COMP-CLARIFICATIONS. */
export interface ClarificationQuestionsProps {
  questions: ClarificationQuestion[];
  onSubmit: (clarifications: Record<string, string>) => void;
  onSkip: () => void;
  pending?: boolean;
}

export function ClarificationQuestions({
  questions,
  onSubmit,
  onSkip,
  pending,
}: ClarificationQuestionsProps): JSX.Element {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const setAnswer = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
  };

  return (
    <section className="card clarifications" aria-label="Clarifying questions">
      <p className="clarifications__intro">
        A few quick clarifications to improve the generated documents:
      </p>
      {questions.map((q) => (
        <label className="field" key={q.id}>
          {q.question}
          <input
            className="field__control"
            aria-label={q.question}
            value={answers[q.id] ?? ""}
            onChange={(e) => setAnswer(q.id, e.target.value)}
          />
        </label>
      ))}
      <div className="clarifications__actions" role="group" aria-label="Clarification actions">
        <button
          className="btn btn--primary"
          type="button"
          onClick={() => onSubmit(answers)}
          disabled={pending}
        >
          {pending ? "Continuing…" : "Continue"}
        </button>
        <button className="btn btn--ghost" type="button" onClick={onSkip} disabled={pending}>
          Skip
        </button>
      </div>
    </section>
  );
}
