import { describe, expect, it } from "vitest";
import { buildTrs, TRS_SECTIONS } from "../../src/generation/trsGen";

describe("TRS generator", () => {
  it("emits the twelve TRS sections in order", () => {
    // Covers COMP-TRSGEN, FR-TRS-SECTIONS, AT-TRS-SECTIONS (PR-CORE-TRSGEN).
    const doc = buildTrs({ productTitle: "Acme", productDetails: "Details.", selectedTypes: ["TRS"] });
    let lastIndex = -1;
    for (const section of TRS_SECTIONS) {
      const at = doc.content.indexOf(section);
      expect(at).toBeGreaterThan(lastIndex);
      lastIndex = at;
    }
    expect(TRS_SECTIONS).toHaveLength(12);
  });
});
