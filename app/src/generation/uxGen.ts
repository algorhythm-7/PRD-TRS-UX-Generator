import type { GeneratedDocument, GenerationRequest } from "./contract";

/** Deterministic UX mockup generator for IFACE-UXGEN (COMP-UXGEN). */
export const UX_SEGMENTS = ["User Journeys for personas", "UI Design Mockups"] as const;

function journeys(request: GenerationRequest): string {
  const title = request.productTitle.trim();
  return [
    `### Persona: New user of ${title}`,
    "1. Lands on the app and reads the purpose.",
    "2. Enters the product title and details.",
    "3. Selects the desired document types.",
    "4. Generates, reviews, edits, and exports the output.",
  ].join("\n");
}

function mockups(request: GenerationRequest): string {
  const title = request.productTitle.trim();
  return [
    "```",
    "+--------------------------------------------------+",
    `| ${title.padEnd(30).slice(0, 30)}      [Generate] |`,
    "+--------------------------------------------------+",
    "| [ Title .......... ]  [ PRD ] [ TRS ] [ UX ]     |",
    "| [ Details ....................................  ] |",
    "+--------------------------------------------------+",
    "| ( PRD ) ( TRS ) ( UX )                           |",
    "| Generated document preview .................. [x]|",
    "| [ Export Word ] [ Export PDF ] [ Download UX ]   |",
    "+--------------------------------------------------+",
    "```",
  ].join("\n");
}

export function buildUx(request: GenerationRequest): GeneratedDocument {
  const content = [
    `# ${request.productTitle.trim()} UX Design Mockups`,
    "",
    `## ${UX_SEGMENTS[0]}`,
    "",
    journeys(request),
    "",
    `## ${UX_SEGMENTS[1]}`,
    "",
    mockups(request),
    "",
  ].join("\n");
  return {
    type: "UX",
    title: `${request.productTitle.trim()} — UX Design Mockups`,
    content,
  };
}
