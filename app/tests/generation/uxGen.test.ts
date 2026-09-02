import { describe, expect, it } from "vitest";
import { buildUx, UX_SEGMENTS } from "../../src/generation/uxGen";

describe("UX generator", () => {
  it("emits a journeys segment and a UI mockups segment", () => {
    // Covers COMP-UXGEN, FR-UX-SEGMENTS, AT-UX-SEGMENTS (PR-CORE-UXGEN).
    const doc = buildUx({ productTitle: "Acme", productDetails: "Details.", selectedTypes: ["UX"] });
    expect(doc.content).toContain(UX_SEGMENTS[0]);
    expect(doc.content).toContain(UX_SEGMENTS[1]);
    expect(doc.type).toBe("UX");
  });
});
