import { describe, expect, it } from "vitest";
import {
  GenerationRequestSchema,
  DOC_TYPES,
  DOCUMENT_FORMATS,
  FORMAT_APPLICABILITY,
  GENERATION_MODES,
  REQUIREMENT_DEPTH_LEVELS,
  REQUIREMENT_DECOMPOSITION_LEVELS,
  INNOVATION_ASSISTANCE_LEVELS,
  TARGET_AUDIENCES,
  ASSUMPTION_STRATEGIES,
  type PerDocTypeProfile,
  type GenerationProfile,
  type GenerationRequest,
} from "../../src/generation/contract";

describe("generation contract", () => {
  it("parses a valid generation request", () => {
    // Covers COMP-TYPES, FR-GEN-TRIGGER (PR-SHARED-CONTRACT).
    const parsed = GenerationRequestSchema.safeParse({
      productTitle: "Acme",
      productDetails: "A tool for teams.",
      selectedTypes: ["PRD"],
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unknown document type", () => {
    // Covers COMP-TYPES (PR-SHARED-CONTRACT).
    const parsed = GenerationRequestSchema.safeParse({
      productTitle: "Acme",
      productDetails: "A tool.",
      selectedTypes: ["BAD"],
    });
    expect(parsed.success).toBe(false);
    expect(DOC_TYPES).toContain("UX");
  });

  it("defines exactly 3 named formats per DocType, plus standard and custom", () => {
    for (const docType of DOC_TYPES) {
      const applicable = FORMAT_APPLICABILITY[docType];
      expect(applicable).toContain("standard");
      expect(applicable).toContain("custom");
      expect(applicable.length).toBe(5);
      for (const format of applicable) {
        expect(DOCUMENT_FORMATS).toContain(format);
      }
    }
  });

  it("defines at least 4 generation modes per DocType", () => {
    for (const docType of DOC_TYPES) {
      expect(GENERATION_MODES[docType].length).toBeGreaterThanOrEqual(4);
    }
  });

  it("defines the requirement depth, decomposition, and innovation assistance level sets", () => {
    expect(REQUIREMENT_DEPTH_LEVELS).toContain("standard_engineering");
    expect(REQUIREMENT_DECOMPOSITION_LEVELS).toContain("functional_requirement");
    expect(INNOVATION_ASSISTANCE_LEVELS[0]).toBe("disabled");
    expect(INNOVATION_ASSISTANCE_LEVELS).toHaveLength(5);
  });

  it("defines target audiences, assumption strategies, and a valid PerDocTypeProfile shape", () => {
    expect(TARGET_AUDIENCES).toEqual(["engineering", "product", "customer", "management"]);
    expect(ASSUMPTION_STRATEGIES).toEqual(["strict", "balanced", "exploratory"]);
    const profile: PerDocTypeProfile = {
      format: "standard",
      generationMode: "product_management",
      requirementDepth: "standard_engineering",
      requirementDecomposition: "functional_requirement",
      innovationAssistance: "disabled",
      targetAudience: "product",
    };
    expect(profile.format).toBe("standard");
  });

  it("supports the documented no-op GenerationProfile defaults (docs/Enhancements3.md §7)", () => {
    const defaultModeFor: Record<string, string> = {
      PRD: "product_management",
      TRS: "strict_trs",
      UX: "user_journey",
    };
    const defaultAudienceFor: Record<string, string> = {
      PRD: "product",
      TRS: "engineering",
      UX: "product",
    };
    const profile: GenerationProfile = {
      perDocType: Object.fromEntries(
        DOC_TYPES.map((docType) => [
          docType,
          {
            format: "standard",
            generationMode: defaultModeFor[docType],
            requirementDepth: "standard_engineering",
            requirementDecomposition: "functional_requirement",
            innovationAssistance: "disabled",
            targetAudience: defaultAudienceFor[docType],
          },
        ]),
      ) as GenerationProfile["perDocType"],
      traceability: {
        generateIds: false,
        requirementMapping: false,
        verificationReferences: false,
      },
      assumptionStrategy: "balanced",
    };

    for (const docType of DOC_TYPES) {
      const perDoc = profile.perDocType[docType];
      expect(perDoc?.format).toBe("standard");
      expect(GENERATION_MODES[docType]).toContain(perDoc?.generationMode);
      expect(TARGET_AUDIENCES).toContain(perDoc?.targetAudience);
    }
    expect(profile.assumptionStrategy).toBe("balanced");
    expect(Object.values(profile.traceability).every((v) => v === false)).toBe(true);
  });

  it("allows GenerationRequest's client-side-only formats/customTemplateSections to be omitted", () => {
    // docs/Enhancements2.md §3.3 - these never touch the zod wire schema, so omitting them must
    // reproduce exactly today's validated request shape.
    const parsed = GenerationRequestSchema.safeParse({
      productTitle: "Acme",
      productDetails: "A tool for teams.",
      selectedTypes: ["PRD"],
    });
    expect(parsed.success).toBe(true);
    const withFormats: GenerationRequest = {
      ...(parsed.success ? parsed.data : { productTitle: "", productDetails: "", selectedTypes: [] }),
      formats: { PRD: "volere" },
    };
    expect(withFormats.formats?.PRD).toBe("volere");
    expect(withFormats.customTemplateSections).toBeUndefined();
  });
});
