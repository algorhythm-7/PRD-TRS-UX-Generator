import { describe, expect, it } from "vitest";
import { generate, ValidationError } from "../../src/generation/genService";

describe("generation service", () => {
  it("produces only the selected document types", () => {
    // Covers COMP-GENSERVICE, FR-GEN-TRIGGER, AT-GEN-SELECTED (PR-APP-GENSERVICE).
    const response = generate({
      productTitle: "Acme",
      productDetails: "Details.",
      selectedTypes: ["PRD"],
    });
    expect(response.documents).toHaveLength(1);
    expect(response.documents[0].type).toBe("PRD");
  });

  it("throws a validation error for incomplete input", () => {
    // Covers COMP-GENSERVICE, FR-GEN-TRIGGER (PR-APP-GENSERVICE).
    expect(() =>
      generate({ productTitle: "", productDetails: "", selectedTypes: [] }),
    ).toThrow(ValidationError);
  });

  it("replaces output on each call and completes within budget", () => {
    // Covers FR-REGEN-REPLACE, AT-PERF-GEN (PR-APP-GENSERVICE).
    const start = Date.now();
    const first = generate({ productTitle: "A", productDetails: "one", selectedTypes: ["PRD"] });
    const second = generate({ productTitle: "A", productDetails: "two", selectedTypes: ["PRD"] });
    expect(first.documents[0].content).not.toBe(second.documents[0].content);
    expect(Date.now() - start).toBeLessThan(10000);
  });
});
