import type {
  GenerationRequest,
  GenerationResponse,
  GeneratedDocument,
} from "./contract";
import { validate, type FieldError } from "./validate";
import { buildPrd } from "./prdGen";
import { buildTrs } from "./trsGen";
import { buildUx } from "./uxGen";

/** Generation orchestration for IFACE-GENSVC (COMP-GENSERVICE). */
export class ValidationError extends Error {
  constructor(public readonly errors: FieldError[]) {
    super("Validation failed");
    this.name = "ValidationError";
  }
}

export function generate(request: GenerationRequest): GenerationResponse {
  const result = validate(request);
  if (!result.ok) {
    throw new ValidationError(result.errors);
  }
  const documents: GeneratedDocument[] = [];
  // Only selected types are produced; nothing is retained after this call.
  if (request.selectedTypes.includes("PRD")) documents.push(buildPrd(request));
  if (request.selectedTypes.includes("TRS")) documents.push(buildTrs(request));
  if (request.selectedTypes.includes("UX")) documents.push(buildUx(request));
  return { documents };
}
