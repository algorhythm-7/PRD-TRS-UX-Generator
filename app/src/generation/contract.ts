import { z } from "zod";

/** Shared contract for IFACE-CONTRACT (COMP-TYPES). */
export const DOC_TYPES = ["PRD", "TRS", "UX"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  PRD: "Product Requirements Document",
  TRS: "Technical Requirements Specification",
  UX: "UX Design Mockups",
};

/** Standardized document formats selectable per DocType (docs/GoodTRSPRDUX2.md). */
export const DOCUMENT_FORMATS = [
  "standard",
  // PRD-only
  "volere",
  "pr_faq",
  "shape_up",
  // TRS-only
  "ears",
  "formal_srs",
  "c4_model",
  // UX-only
  "service_blueprint",
  "jtbd",
  "atomic_design",
  "custom",
] as const;
export type DocumentFormatId = (typeof DOCUMENT_FORMATS)[number];

/** Which formats are selectable per DocType (docs/Enhancements2.md §3.1). */
export const FORMAT_APPLICABILITY: Record<DocType, readonly DocumentFormatId[]> = {
  PRD: ["standard", "volere", "pr_faq", "shape_up", "custom"],
  TRS: ["standard", "ears", "formal_srs", "c4_model", "custom"],
  UX: ["standard", "service_blueprint", "jtbd", "atomic_design", "custom"],
};

/** Output Structure inclusion checkboxes (docs/Enhancements4.md §6.2). */
export const OUTPUT_STRUCTURE_ITEMS = [
  "User Stories",
  "Acceptance Criteria",
  "Risks",
  "Dependencies",
  "Open Questions",
  "Wireframe Suggestions",
  "Edge Cases",
  "Validation Criteria",
] as const;
export type OutputStructureItem = (typeof OUTPUT_STRUCTURE_ITEMS)[number];

/** Which DocTypes each item applies to (docs/Enhancements4.md §6.2's "Applicable to" column). */
export const OUTPUT_STRUCTURE_APPLICABILITY: Record<OutputStructureItem, readonly DocType[]> = {
  "User Stories": ["PRD", "UX"],
  "Acceptance Criteria": ["PRD", "TRS"],
  Risks: ["PRD", "TRS", "UX"],
  Dependencies: ["PRD", "TRS"],
  "Open Questions": ["PRD", "TRS"],
  "Wireframe Suggestions": ["PRD", "TRS"],
  "Edge Cases": ["PRD", "TRS"],
  "Validation Criteria": ["TRS"],
};

/** Section names that already cover an item, so it isn't offered as a redundant duplicate
 * (docs/Enhancements4.md §6.1). Checked against `sectionNamesFor(docType, format)`'s current
 * output for the currently-selected Template. */
export const OUTPUT_STRUCTURE_EQUIVALENTS: Record<OutputStructureItem, readonly string[]> = {
  "User Stories": [],
  "Acceptance Criteria": [],
  Risks: ["Risks and Dependencies", "Risks"],
  Dependencies: ["Risks and Dependencies"],
  "Open Questions": ["Open Issues"],
  "Wireframe Suggestions": ["UI Design Mockups", "Pages"],
  "Edge Cases": [],
  "Validation Criteria": ["Test and Validation"],
};

/** Per-DocType "lens" options replacing a generic Tone control (docs/Enhancements3.md §3.2). */
export const GENERATION_MODES: Record<DocType, readonly string[]> = {
  PRD: ["customer_value", "product_management", "engineering_handoff", "executive_summary"],
  TRS: [
    "strict_trs",
    "functional_decomposition",
    "implementation_oriented",
    "verification_oriented",
  ],
  UX: [
    "user_journey",
    "wireframe_generation",
    "interaction_design",
    "accessibility_focus",
    "research_discovery",
  ],
};

/** Requirement Depth levels (docs/Enhancements3.md §3.3). */
export const REQUIREMENT_DEPTH_LEVELS = [
  "high_level",
  "standard_engineering",
  "detailed_engineering",
  "compliance_grade",
] as const;
export type RequirementDepth = (typeof REQUIREMENT_DEPTH_LEVELS)[number];

/** Requirement Decomposition levels (docs/Enhancements3.md §3.3). */
export const REQUIREMENT_DECOMPOSITION_LEVELS = [
  "feature",
  "functional_requirement",
  "sub_system",
  "component",
  "signal_interface",
] as const;
export type RequirementDecomposition = (typeof REQUIREMENT_DECOMPOSITION_LEVELS)[number];

/** Innovation Assistance levels, each mapped to a temperature + prompt instruction server-side
 * (docs/Enhancements3.md §3 continued). */
export const INNOVATION_ASSISTANCE_LEVELS = [
  "disabled",
  "suggest_missing",
  "challenge_assumptions",
  "explore_alternatives",
  "maximum_ideation",
] as const;
export type InnovationAssistance = (typeof INNOVATION_ASSISTANCE_LEVELS)[number];

/** Target audience for a generated document's vocabulary/depth (docs/Enhancements3.md §5). */
export const TARGET_AUDIENCES = ["engineering", "product", "customer", "management"] as const;
export type TargetAudience = (typeof TARGET_AUDIENCES)[number];

/** How the model should handle gaps in the shared input (docs/Enhancements3.md §3.5). */
export const ASSUMPTION_STRATEGIES = ["strict", "balanced", "exploratory"] as const;
export type AssumptionStrategy = (typeof ASSUMPTION_STRATEGIES)[number];

/** Per-DocType Generation Profile fields (docs/Enhancements3.md §7). */
export interface PerDocTypeProfile {
  format: DocumentFormatId;
  customTemplateSections?: string[];
  generationMode: string;
  requirementDepth: RequirementDepth;
  requirementDecomposition: RequirementDecomposition;
  innovationAssistance: InnovationAssistance;
  targetAudience: TargetAudience;
}

/** Full pre-generation configuration for a batch (docs/Enhancements3.md §7). */
export interface GenerationProfile {
  perDocType: Partial<Record<DocType, PerDocTypeProfile>>;
  traceability: {
    generateIds: boolean;
    requirementMapping: boolean;
    verificationReferences: boolean;
  };
  assumptionStrategy: AssumptionStrategy;
  complianceFraming?: { aspice?: boolean; iso26262?: boolean };
}

export const GenerationRequestSchema = z.object({
  productTitle: z.string(),
  productDetails: z.string(),
  selectedTypes: z.array(z.enum(DOC_TYPES)),
  answers: z.record(z.string(), z.string()).optional(),
  clarifications: z.record(z.string(), z.string()).optional(),
});
// `formats`/`customTemplateSections` are client-side-only additions (InputForm/App state, per
// docs/Enhancements2.md §3.3) - never sent as-is to /_api/*, so they're kept out of the zod
// schema/wire contract rather than forced through z.record's less precise partial-key inference.
export type GenerationRequest = z.infer<typeof GenerationRequestSchema> & {
  formats?: Partial<Record<DocType, DocumentFormatId>>;
  customTemplateSections?: Partial<Record<DocType, string[]>>;
};

/** Whether a document came from the LLM path or the deterministic fallback (IFACE-LLMGENSVC). */
export type DocumentSource = "llm" | "fallback";

export interface GeneratedDocument {
  type: DocType;
  title: string;
  content: string;
  source?: DocumentSource;
}

export interface GenerationResponse {
  documents: GeneratedDocument[];
}

/** A single follow-up question returned by the LLM gap-analysis step (IFACE-GAPANALYSIS). */
export interface ClarificationQuestion {
  id: string;
  question: string;
  relatedField?: string;
}

export interface GapAnalysisResponse {
  questions: ClarificationQuestion[];
}

export const EXPORT_FORMATS = ["word", "pdf", "mockup"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const ExportRequestSchema = z.object({
  productTitle: z.string(),
  docType: z.enum(DOC_TYPES),
  format: z.enum(EXPORT_FORMATS),
  content: z.string(),
});
export type ExportRequest = z.infer<typeof ExportRequestSchema>;

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
