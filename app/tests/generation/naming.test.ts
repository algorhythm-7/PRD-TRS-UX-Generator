import { describe, expect, it } from "vitest";
import { prefixFilename, sanitizeBase } from "../../src/generation/naming";

describe("filename prefixing", () => {
  it("prefixes the sanitized product title", () => {
    // Covers COMP-NAMING, FR-NAME-PREFIX (PR-SHARED-NAMING).
    expect(prefixFilename("Acme Analytics!", "PRD", "word")).toBe("acme-analytics-prd.docx");
    expect(prefixFilename("Acme", "TRS", "pdf")).toBe("acme-trs.pdf");
  });

  it("falls back to a default base for an empty title", () => {
    // Covers COMP-NAMING, FR-NAME-PREFIX (PR-SHARED-NAMING).
    expect(sanitizeBase("   ")).toBe("specpilot");
    expect(prefixFilename("", "UX", "mockup")).toBe("specpilot-ux.html");
  });
});
