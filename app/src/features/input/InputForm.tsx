import { useState, type JSX } from "react";
import {
  DOC_TYPES,
  DOC_TYPE_LABELS,
  type DocType,
  type GenerationRequest,
} from "../../generation/contract";
import { validate, type FieldError } from "../../generation/validate";

interface GuidedQuestion {
  id: string;
  docType: DocType;
  label: string;
}

/** Small, optional per-DocType questions that give the LLM path more context (plan section 7). */
const GUIDED_QUESTIONS: GuidedQuestion[] = [
  { id: "prd_target_users", docType: "PRD", label: "Who are the primary target users of this product?" },
  { id: "prd_constraints", docType: "PRD", label: "Any known constraints or explicit non-goals?" },
  { id: "prd_success_metric", docType: "PRD", label: "How will you know this product succeeded?" },
  { id: "trs_integrations", docType: "TRS", label: "Any known systems/integrations this must work with?" },
  { id: "trs_data_sensitivity", docType: "TRS", label: "Does this handle sensitive or regulated data?" },
  { id: "trs_deployment", docType: "TRS", label: "Where will this be deployed/run (cloud, on-prem, mobile, etc.)?" },
  { id: "ux_journey", docType: "UX", label: "What is the primary user journey or entry point?" },
  { id: "ux_platform", docType: "UX", label: "What platform(s) - web, mobile, desktop?" },
];

/** Input form for COMP-INPUTFORM. */
export interface InputFormProps {
  onContinue: (request: GenerationRequest) => void;
  pending?: boolean;
}

export function InputForm({ onContinue, pending }: InputFormProps): JSX.Element {
  const [productTitle, setProductTitle] = useState("");
  const [productDetails, setProductDetails] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<DocType[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<FieldError[]>([]);

  const toggleType = (type: DocType) => {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((t) => t !== type)
        : [...current, type],
    );
  };

  const setAnswer = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
  };

  const submit = () => {
    const request: GenerationRequest = { productTitle, productDetails, selectedTypes, answers };
    const result = validate(request);
    setErrors(result.errors);
    if (result.ok) onContinue(request);
  };

  const errorFor = (field: string) => errors.find((e) => e.field === field)?.message;
  const visibleQuestions = GUIDED_QUESTIONS.filter((q) => selectedTypes.includes(q.docType));

  return (
    <section className="card" aria-label="Product input">
      <label className="field">
        Product Title
        <input
          className="field__control"
          aria-label="Product Title"
          value={productTitle}
          onChange={(e) => setProductTitle(e.target.value)}
        />
      </label>
      {errorFor("productTitle") && (
        <p className="alert alert--error" role="alert">
          {errorFor("productTitle")}
        </p>
      )}

      <label className="field">
        Product Details
        <textarea
          className="field__control"
          aria-label="Product Details"
          value={productDetails}
          onChange={(e) => setProductDetails(e.target.value)}
        />
      </label>
      {errorFor("productDetails") && (
        <p className="alert alert--error" role="alert">
          {errorFor("productDetails")}
        </p>
      )}

      <fieldset className="field-group">
        <legend className="field-group__legend">Document types</legend>
        <div className="field-group--options">
          {DOC_TYPES.map((type) => (
            <label className="checkbox" key={type}>
              <input
                type="checkbox"
                aria-label={DOC_TYPE_LABELS[type]}
                checked={selectedTypes.includes(type)}
                onChange={() => toggleType(type)}
              />
              {type}
            </label>
          ))}
        </div>
      </fieldset>
      {errorFor("selectedTypes") && (
        <p className="alert alert--error" role="alert">
          {errorFor("selectedTypes")}
        </p>
      )}

      {visibleQuestions.length > 0 && (
        <fieldset className="field-group field-group--guided">
          <legend className="field-group__legend">Optional guided questions</legend>
          {visibleQuestions.map((q) => (
            <label className="field" key={q.id}>
              {q.label}
              <input
                className="field__control"
                aria-label={q.label}
                value={answers[q.id] ?? ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
              />
            </label>
          ))}
        </fieldset>
      )}

      <button className="btn btn--primary" type="button" onClick={submit} disabled={pending}>
        {pending ? "Continuing…" : "Continue"}
      </button>
    </section>
  );
}
