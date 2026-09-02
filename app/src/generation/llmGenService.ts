import type {
  ClarificationQuestion,
  DocType,
  GeneratedDocument,
  GenerationProfile,
  GenerationRequest,
} from "./contract";
import type { PriorAttempt, ReferenceContent } from "../api/llmClient";
import { postGapAnalysis, postGenerate } from "../api/llmClient";
import { buildGeneratedDocument, sectionNamesFor } from "./sectionSchema";
import { buildPrd } from "./prdGen";
import { buildTrs } from "./trsGen";
import { buildUx } from "./uxGen";

export interface LlmRequestInput {
  productTitle: string;
  productDetails: string;
  selectedTypes: DocType[];
  answers?: Record<string, string>;
  clarifications?: Record<string, string>;
  /** Generation Profile screen output (docs/Enhancements3.md §7) - undefined until that screen
   * (docs/EnhancementToDo3.md §8/§9) exists, in which case every derived field below is also
   * undefined and this reproduces today's exact request/section list. */
  profile?: GenerationProfile;
  /** docs/Enhancements4.md §6 - enabled Output Structure items per DocType, already deduped
   * against the selected format's own sections by the caller. */
  outputStructureItems?: Partial<Record<DocType, string[]>>;
  /** docs/Enhancements4.md §5 - uploaded reference documents + style example, already resolved
   * to text by the caller. */
  referenceContent?: ReferenceContent;
}

/** Gap analysis is a nice-to-have: any failure means "no questions", never blocks generation. */
export async function runGapAnalysis(input: LlmRequestInput): Promise<ClarificationQuestion[]> {
  try {
    const response = await postGapAnalysis({
      productTitle: input.productTitle,
      productDetails: input.productDetails,
      selectedTypes: input.selectedTypes,
      answers: input.answers,
    });
    return response.questions;
  } catch {
    return [];
  }
}

function buildDeterministic(docType: DocType, input: LlmRequestInput): GeneratedDocument {
  const request: GenerationRequest = {
    productTitle: input.productTitle,
    productDetails: input.productDetails,
    selectedTypes: input.selectedTypes,
  };
  if (docType === "PRD") return buildPrd(request);
  if (docType === "TRS") return buildTrs(request);
  return buildUx(request);
}

async function generateOne(
  docType: DocType,
  input: LlmRequestInput,
  priorAttempt?: PriorAttempt,
): Promise<GeneratedDocument> {
  const perDocType = input.profile?.perDocType[docType];
  const format = perDocType?.format;
  const customSections = perDocType?.customTemplateSections;
  const additionalSections = input.outputStructureItems?.[docType];
  const sections = [...sectionNamesFor(docType, format, customSections, additionalSections)];
  try {
    const response = await postGenerate({
      docType,
      productTitle: input.productTitle,
      productDetails: input.productDetails,
      answers: input.answers,
      clarifications: input.clarifications,
      sections,
      format,
      // EARS is a sentence-phrasing overlay, not a distinct section skeleton (sectionNamesFor
      // treats it like "standard") - the backend needs it as a separate flag to apply
      // EARS_GUIDANCE (docs/GoodTRSPRDUX2.md §5's TRS Format 1).
      requirementPhrasing: format === "ears" ? "ears" : undefined,
      generationMode: perDocType?.generationMode,
      requirementDepth: perDocType?.requirementDepth,
      requirementDecomposition: perDocType?.requirementDecomposition,
      innovationAssistance: perDocType?.innovationAssistance,
      targetAudience: perDocType?.targetAudience,
      traceability: input.profile?.traceability,
      assumptionStrategy: input.profile?.assumptionStrategy,
      complianceFraming: input.profile?.complianceFraming,
      referenceContent: input.referenceContent,
      priorAttempt,
    });
    const doc = buildGeneratedDocument(
      input.productTitle,
      docType,
      response.sections,
      format,
      customSections,
      additionalSections,
    );
    return { ...doc, source: "llm" };
  } catch {
    return { ...buildDeterministic(docType, input), source: "fallback" };
  }
}

/** Generates each selected DocType independently - one type falling back never affects another. */
export function runGeneration(input: LlmRequestInput): Promise<GeneratedDocument[]> {
  return Promise.all(input.selectedTypes.map((docType) => generateOne(docType, input)));
}

/** docs/Enhancements2.md §4.3 - same postGenerate call as generateOne, extended with the user's
 * prior edits/comment; deterministic fallback obviously can't incorporate feedback, but still
 * returns something rather than leaving the UI without a result. */
export function regenerateWithFeedback(
  docType: DocType,
  input: LlmRequestInput,
  priorAttempt: PriorAttempt,
): Promise<GeneratedDocument> {
  return generateOne(docType, input, priorAttempt);
}
