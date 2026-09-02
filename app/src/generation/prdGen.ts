import type { GeneratedDocument, GenerationRequest } from "./contract";

/** Deterministic PRD generator for IFACE-PRDGEN (COMP-PRDGEN). */
export const PRD_SECTIONS = [
  "Problem Statement",
  "Business Case",
  "Proposed Solution",
  "Functional Requirements",
  "User Personas and their Journey",
  "Exclusions",
  "Success Criteria",
  "Assumptions",
  "Risks and Dependencies",
] as const;

function sectionBody(section: string, request: GenerationRequest): string {
  const title = request.productTitle.trim();
  const details = request.productDetails.trim();
  switch (section) {
    case "Problem Statement":
      return `${title} addresses the following need: ${details}`;
    case "Business Case":
      return `Delivering ${title} creates measurable value for stakeholders who currently lack this capability.`;
    case "Proposed Solution":
      return `${title} solves the problem by turning the described requirements into a usable product experience.`;
    case "Functional Requirements":
      return `The product shall support the core behaviors implied by: ${details}`;
    case "User Personas and their Journey":
      return `Primary persona: a user who needs ${title}. Journey: discover, try, adopt, and rely on the product.`;
    case "Exclusions":
      return `Out of scope for the first release: capabilities not implied by the provided details.`;
    case "Success Criteria":
      return `${title} succeeds when users complete their goal and report that the product met their need.`;
    case "Assumptions":
      return `The description provided is accurate and representative of the intended product.`;
    case "Risks and Dependencies":
      return `Key risk: scope growth beyond the described need. Dependency: reliable input from stakeholders.`;
    default:
      return details;
  }
}

export function buildPrd(request: GenerationRequest): GeneratedDocument {
  const body = PRD_SECTIONS.map(
    (section, index) => `## ${index + 1}. ${section}\n\n${sectionBody(section, request)}`,
  ).join("\n\n");
  return {
    type: "PRD",
    title: `${request.productTitle.trim()} — Product Requirements Document`,
    content: `# ${request.productTitle.trim()} PRD\n\n${body}\n`,
  };
}
