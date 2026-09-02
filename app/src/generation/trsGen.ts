import type { GeneratedDocument, GenerationRequest } from "./contract";

/** Deterministic TRS generator for IFACE-TRSGEN (COMP-TRSGEN). */
export const TRS_SECTIONS = [
  "Summary",
  "Problem Statement and Proposed Solution",
  "High Level Architecture",
  "System Boundaries",
  "Non-Functional Requirements",
  "Data Requirements",
  "Integration Requirements",
  "UI Requirements",
  "Test and Validation",
  "Risks and Dependencies",
  "Deployments",
  "AI Usage and Implications",
] as const;

function sectionBody(section: string, request: GenerationRequest): string {
  const title = request.productTitle.trim();
  const details = request.productDetails.trim();
  switch (section) {
    case "Summary":
      return `Technical overview of ${title} based on: ${details}`;
    case "Problem Statement and Proposed Solution":
      return `The system solves the stated problem with a layered web architecture.`;
    case "High Level Architecture":
      return `A single-page front-end communicates with a stateless service over HTTPS.`;
    case "System Boundaries":
      return `The system boundary includes the web client and the API service; external providers are out of scope.`;
    case "Non-Functional Requirements":
      return `Performance, reliability, security, scalability, and usability targets apply to ${title}.`;
    case "Data Requirements":
      return `User-entered content is processed in memory and is not persisted server-side.`;
    case "Integration Requirements":
      return `The client integrates with the service through a JSON API.`;
    case "UI Requirements":
      return `A dark, accessible interface presents input, generated output, and export controls.`;
    case "Test and Validation":
      return `Unit, component, contract, integration, and acceptance tests validate the system.`;
    case "Risks and Dependencies":
      return `Risk: export fidelity. Dependency: the browser runtime and the service host.`;
    case "Deployments":
      return `The system is packaged as a container image with static assets and a smoke check.`;
    case "AI Usage and Implications":
      return `Generation is deterministic and template-driven; no external model is invoked.`;
    default:
      return details;
  }
}

export function buildTrs(request: GenerationRequest): GeneratedDocument {
  const body = TRS_SECTIONS.map(
    (section, index) => `## ${index + 1}. ${section}\n\n${sectionBody(section, request)}`,
  ).join("\n\n");
  return {
    type: "TRS",
    title: `${request.productTitle.trim()} — Technical Requirements Specification`,
    content: `# ${request.productTitle.trim()} TRS\n\n${body}\n`,
  };
}
