import type { DocType, DocumentFormatId, GeneratedDocument } from "./contract";
import { PRD_SECTIONS } from "./prdGen";
import { TRS_SECTIONS } from "./trsGen";
import { UX_SEGMENTS } from "./uxGen";

const LONG_NAME: Record<DocType, string> = {
  PRD: "Product Requirements Document",
  TRS: "Technical Requirements Specification",
  UX: "UX Design Mockups",
};

// --- Format-specific section lists (docs/GoodTRSPRDUX2.md), 3 per DocType, no sharing across ---

/** PRD Format 1 — Volere Requirements Specification Template, adapted 16-section list. */
export const VOLERE_SECTIONS = [
  "Purpose of the Project",
  "Stakeholders",
  "Mandated Constraints",
  "Relevant Facts and Assumptions",
  "Scope of the Work",
  "Scope of the Product",
  "Functional Requirements",
  "Look and Feel Requirements",
  "Usability and Humanity Requirements",
  "Performance Requirements",
  "Operational and Environmental Requirements",
  "Maintainability and Support Requirements",
  "Security Requirements",
  "Compliance Requirements",
  "Risks",
  "Open Issues",
] as const;

/** PRD Format 2 — Amazon "Working Backwards" PR/FAQ, 11-item section list. */
export const PR_FAQ_SECTIONS = [
  "Press Release Heading",
  "Press Release Sub-heading",
  "Summary Paragraph",
  "Problem Paragraph",
  "Solution Paragraph",
  "Leadership Quote",
  "How to Get Started",
  "Customer Quote",
  "Call to Action",
  "Internal FAQ",
  "External FAQ",
] as const;

/** PRD Format 3 — Basecamp "Shape Up" Pitch, 5-item section list. */
export const SHAPE_UP_SECTIONS = [
  "Problem",
  "Appetite",
  "Solution",
  "Rabbit Holes",
  "No-gos",
] as const;

/** TRS Format 2 — Formal SRS Outline (IEEE 830 / ISO-IEC-IEEE 29148), adapted 9-section list. */
export const FORMAL_SRS_SECTIONS = [
  "Purpose and Scope",
  "Overall Description",
  "External Interface Requirements",
  "Functional Requirements",
  "Performance Requirements",
  "Logical Database Requirements",
  "Software System Attributes",
  "Environment Characteristics",
  "Other Requirements",
] as const;

/** TRS Format 3 — C4 Model, architecture-describing sections only; the rest of Standard TRS
 * (everything except the two sections C4 supersedes) is reused, computed below rather than
 * hand-duplicated so it can never drift from TRS_SECTIONS (docs/GoodTRSPRDUX2.md "TRS Format 3"
 * §6 — "only the architecture-describing sections are replaced"; "High Level Architecture" and
 * "System Boundaries" are what C4's own sections supersede, everything else - including Summary
 * and Problem Statement, not just the NFR-shaped tail the plan called out - is kept). */
const C4_ARCHITECTURE_SECTIONS = [
  "System Context",
  "Containers",
  "Components",
  "Dynamic Scenarios",
  "Deployments",
] as const;
const C4_SUPERSEDED_TRS_SECTIONS = new Set(["High Level Architecture", "System Boundaries"]);
export const C4_MODEL_TRS_SECTIONS = [
  ...TRS_SECTIONS.slice(0, 2), // "Summary", "Problem Statement and Proposed Solution"
  ...C4_ARCHITECTURE_SECTIONS,
  ...TRS_SECTIONS.filter(
    (name, index) => index >= 2 && !C4_SUPERSEDED_TRS_SECTIONS.has(name) && name !== "Deployments",
  ),
] as const;

/** UX Format 1 — NN/g Service Blueprint; "UI Design Mockups" appended at the call site below
 * since Service Blueprinting has nothing to say about visual UI structure. */
export const SERVICE_BLUEPRINT_SECTIONS = [
  "Customer Actions",
  "Frontstage Actions",
  "Backstage Actions",
  "Supporting Processes",
  "Evidence (Physical and Digital Touchpoints)",
] as const;

/** UX Format 2 — Jobs-to-Be-Done / Job Stories; "UI Design Mockups" appended at the call site. */
export const JTBD_SECTIONS = ["Core Jobs to Be Done", "Job Stories"] as const;

/** UX Format 3 — Atomic Design; "User Journeys for personas" prepended at the call site, since
 * Atomic Design has nothing to say about journeys/personas. */
export const ATOMIC_DESIGN_SECTIONS = [
  "Atoms (Base UI Elements)",
  "Molecules (Component Groups)",
  "Organisms (Composite Interface Sections)",
  "Templates (Page-Level Layouts)",
  "Pages (Populated Screens)",
] as const;

/** The ordered, authoritative section/segment names for a document type + format
 * (IFACE-SECTIONSCHEMA). `format` defaults to "standard" so every existing caller that omits it
 * reproduces exactly today's PRD_SECTIONS/TRS_SECTIONS/UX_SEGMENTS output. */
export function sectionNamesFor(
  docType: DocType,
  format: DocumentFormatId = "standard",
  customSections?: readonly string[],
  additionalSections?: readonly string[],
): readonly string[] {
  let base: readonly string[];
  if (format === "custom") {
    base = customSections ?? sectionNamesFor(docType);
  } else if (format === "volere") {
    base = VOLERE_SECTIONS;
  } else if (format === "pr_faq") {
    base = PR_FAQ_SECTIONS;
  } else if (format === "shape_up") {
    base = SHAPE_UP_SECTIONS;
  } else if (format === "formal_srs") {
    base = FORMAL_SRS_SECTIONS;
  } else if (format === "c4_model") {
    base = C4_MODEL_TRS_SECTIONS;
  } else if (format === "service_blueprint") {
    base = [...SERVICE_BLUEPRINT_SECTIONS, UX_SEGMENTS[1]];
  } else if (format === "jtbd") {
    base = [...JTBD_SECTIONS, UX_SEGMENTS[1]];
  } else if (format === "atomic_design") {
    base = [UX_SEGMENTS[0], ...ATOMIC_DESIGN_SECTIONS];
  } else if (docType === "PRD") {
    base = PRD_SECTIONS;
  } else if (docType === "TRS") {
    base = TRS_SECTIONS;
  } else {
    base = UX_SEGMENTS;
  }

  if (!additionalSections?.length) return base;
  const existing = new Set(base);
  return [...base, ...additionalSections.filter((name) => !existing.has(name))];
}

/**
 * Builds a GeneratedDocument from LLM-authored section content, reproducing each
 * deterministic generator's exact heading/title convention so LLM and fallback
 * output are shape-identical to OutputView/ExportControls. `format`/`customSections`/
 * `additionalSections` must match whatever was passed to `sectionNamesFor` when building the
 * `sections` request, so the reconstructed heading list matches the LLM's actual response keys.
 */
export function buildGeneratedDocument(
  productTitle: string,
  docType: DocType,
  sections: Record<string, string>,
  format: DocumentFormatId = "standard",
  customSections?: readonly string[],
  additionalSections?: readonly string[],
): GeneratedDocument {
  const title = `${productTitle.trim()} — ${LONG_NAME[docType]}`;
  const names = sectionNamesFor(docType, format, customSections, additionalSections);

  if (docType === "UX") {
    const body = names.map((name) => `## ${name}\n\n${sections[name] ?? ""}`).join("\n\n");
    return {
      type: docType,
      title,
      content: `# ${productTitle.trim()} UX Design Mockups\n\n${body}\n`,
    };
  }

  const body = names
    .map((name, index) => `## ${index + 1}. ${name}\n\n${sections[name] ?? ""}`)
    .join("\n\n");
  return {
    type: docType,
    title,
    content: `# ${productTitle.trim()} ${docType}\n\n${body}\n`,
  };
}

