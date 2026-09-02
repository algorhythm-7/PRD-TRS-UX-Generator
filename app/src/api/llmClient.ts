import type {
  AssumptionStrategy,
  DocType,
  DocumentFormatId,
  GapAnalysisResponse,
  InnovationAssistance,
  RequirementDecomposition,
  RequirementDepth,
  TargetAudience,
} from "../generation/contract";

// Must exceed the backend's own worst-case Calypso wait, bounded by CALYPSO_TOTAL_TIMEOUT_MS
// (default 115s - one candidate's structured-output attempt plus its plain-JSON retry) - large
// internal models can legitimately take longer than a typical commercial API to respond, and a
// client-side abort shorter than the backend's own timeout would discard responses the backend
// was still willing to wait for, forcing an unnecessary fallback.
const DEFAULT_TIMEOUT_MS = 130000;

/** Thrown for any non-2xx or timed-out /_api/llm/* call (IFACE-LLMCLIENT). */
export class LlmClientError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LlmClientError";
  }
}

export interface GapAnalysisRequest {
  productTitle: string;
  productDetails: string;
  selectedTypes: DocType[];
  answers?: Record<string, string>;
}

/** docs/Enhancements4.md §5.1/§5.3 - resolved text, not a reference descriptor: the client
 * resolves "pick from history" vs. "upload" (§5.3) to actual text before this is sent. Web
 * search results are explicitly deferred (docs/Enhancements4.md §5.4, docs/EnhancementToDo3.md
 * §13) - no field is added for them until that capability is actually wired. */
export interface ReferenceContent {
  documents?: string[];
  styleExample?: string;
}

/** docs/Enhancements2.md §4.4 - human-in-the-loop regeneration context (§6's
 * regenerateWithFeedback). Appended to the user message, not the system prompt. */
export interface PriorAttempt {
  originalContent: string;
  editedContent: string;
  comment?: string;
  sectionSignals?: Record<string, "keep" | "rewrite">;
}

export interface GenerateRequest {
  docType: DocType;
  productTitle: string;
  productDetails: string;
  answers?: Record<string, string>;
  clarifications?: Record<string, string>;
  sections: string[];
  format?: DocumentFormatId;
  requirementPhrasing?: "prose" | "ears";
  generationMode?: string;
  requirementDepth?: RequirementDepth;
  requirementDecomposition?: RequirementDecomposition;
  innovationAssistance?: InnovationAssistance;
  targetAudience?: TargetAudience;
  traceability?: {
    generateIds?: boolean;
    requirementMapping?: boolean;
    verificationReferences?: boolean;
  };
  assumptionStrategy?: AssumptionStrategy;
  complianceFraming?: { aspice?: boolean; iso26262?: boolean };
  referenceContent?: ReferenceContent;
  priorAttempt?: PriorAttempt;
}

export interface GenerateResponse {
  sections: Record<string, string>;
}

async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new LlmClientError(`${path} failed with status ${res.status}`);
    }
    return (await res.json()) as TResponse;
  } catch (err) {
    if (err instanceof LlmClientError) throw err;
    throw new LlmClientError(err instanceof Error ? err.message : `${path} failed`);
  } finally {
    clearTimeout(timeout);
  }
}

export function postGapAnalysis(request: GapAnalysisRequest): Promise<GapAnalysisResponse> {
  return postJson<GapAnalysisResponse>("/_api/gap-analysis", request);
}

export function postGenerate(request: GenerateRequest): Promise<GenerateResponse> {
  return postJson<GenerateResponse>("/_api/generate", request);
}

export interface TemplateExtractResponse {
  sections: string[];
}

/** docs/Enhancements2.md §3.5 - extracts an ordered section/heading list from an uploaded
 * .txt/.md template; throws LlmClientError on failure (no deterministic fallback is sensible). */
export function postTemplateExtract(docType: DocType, rawText: string): Promise<TemplateExtractResponse> {
  return postJson<TemplateExtractResponse>("/_api/template-extract", { docType, rawText });
}

export interface ContextExtractResponse {
  extractedText: string;
  truncated: boolean;
}

/** docs/Enhancements4.md §4.2 (Phase 1: .txt/.md, Phase 2: .docx already converted to text
 * client-side) - enforces only the per-document character budget server-side; no LLM call, so
 * failures here are genuine bugs, not LLM_UNAVAILABLE. */
export function postContextExtract(filename: string, rawText: string): Promise<ContextExtractResponse> {
  return postJson<ContextExtractResponse>("/_api/context-extract", { filename, rawText });
}

/** docs/Enhancements4.md §4.2 Phase 3 (.pdf/scanned documents) - routed server-side to Calypso's
 * OCR/multimodal model, so (unlike Phase 1/2) this can genuinely throw LlmClientError when
 * Calypso is unavailable (§4.6's own error-handling row for this phase specifically). */
export function postContextExtractBinary(
  filename: string,
  base64Content: string,
): Promise<ContextExtractResponse> {
  return postJson<ContextExtractResponse>("/_api/context-extract", { filename, base64Content });
}

const STATUS_TIMEOUT_MS = 5000;

export interface LlmStatus {
  ready: boolean;
  primary: { app: string | null; state: string };
}

/** Best-effort status check - never throws; callers should treat any failure as "not ready". */
export async function getLlmStatus(): Promise<LlmStatus> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  try {
    const res = await fetch("/_api/llm-status", { signal: controller.signal });
    if (!res.ok) throw new Error(`llm-status failed with status ${res.status}`);
    return (await res.json()) as LlmStatus;
  } catch {
    return { ready: false, primary: { app: null, state: "UNKNOWN" } };
  } finally {
    clearTimeout(timeout);
  }
}

/** Fire-and-forget warm-up trigger - resolves regardless of outcome, never surfaces an error. */
export async function triggerLlmWarmup(): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS);
  try {
    await fetch("/_api/llm-warmup", { method: "POST", signal: controller.signal });
  } catch {
    // Best-effort only - a failed warm-up trigger is not user-facing.
  } finally {
    clearTimeout(timeout);
  }
}
