import { describe, expect, it } from "vitest";
import { buildPrd, PRD_SECTIONS } from "../../src/generation/prdGen";

const request = {
  productTitle: "Acme",
  productDetails: "A tool for teams.",
  selectedTypes: ["PRD"] as const,
};

describe("PRD generator", () => {
  it("emits the nine PRD sections in order", () => {
    // Covers COMP-PRDGEN, FR-PRD-SECTIONS, AT-PRD-SECTIONS (PR-CORE-PRDGEN).
    const doc = buildPrd({ ...request, selectedTypes: ["PRD"] });
    let lastIndex = -1;
    for (const section of PRD_SECTIONS) {
      const at = doc.content.indexOf(section);
      expect(at).toBeGreaterThan(lastIndex);
      lastIndex = at;
    }
    expect(PRD_SECTIONS).toHaveLength(9);
  });

  it("includes the product title in the document", () => {
    // Covers COMP-PRDGEN, FR-PRD-SECTIONS (PR-CORE-PRDGEN).
    const doc = buildPrd({ ...request, selectedTypes: ["PRD"] });
    expect(doc.type).toBe("PRD");
    expect(doc.content).toContain("Acme");
  });
});
