import { describe, expect, it } from "vitest";
import { validate } from "../../src/generation/validate";

describe("request validation", () => {
  it("accepts a complete request", () => {
    // Covers COMP-VALIDATE, FR-INPUT-VALIDATE (PR-SHARED-VALIDATE).
    const result = validate({
      productTitle: "Acme",
      productDetails: "Details.",
      selectedTypes: ["PRD"],
    });
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("blocks an empty title, empty details, or no selected type", () => {
    // Covers FR-INPUT-VALIDATE, AT-INPUT-VALIDATE (PR-SHARED-VALIDATE).
    const result = validate({ productTitle: "  ", productDetails: "", selectedTypes: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.map((e) => e.field)).toEqual(
      expect.arrayContaining(["productTitle", "productDetails", "selectedTypes"]),
    );
  });
});
