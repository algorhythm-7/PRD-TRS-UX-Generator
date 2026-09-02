// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildGenerateSystemPrompt } from "../../vite.config";

// Exercises the guidance-assembly logic shared (identically) by app/vite.config.ts's dev
// implementation and app/server.mjs - see docs/EnhancementToDo3.md §3 task 14. Tested via
// vite.config.ts (not server.mjs) since `buildGenerateSystemPrompt` is a plain, side-effect-free
// top-level function there (server.mjs's production Express dependencies aren't installed in
// this workspace, and adding them solely to enable a test is out of this task's scope).
// `export default defineConfig(fn)` re-exports `fn` unevaluated, so importing this module never
// starts a dev server or reads env vars outside of that (uncalled) callback.

const CLOSING_INSTRUCTION =
  'Use the product title, details, and answers provided. Do not invent section names beyond ' +
  "what is requested. Be specific to the described product - never use generic placeholder " +
  "language when concrete information is available in the inputs. Write clean Markdown for " +
  "each section's body: use blank lines between paragraphs, \"-\" for bullet lists, and \"###\" " +
  'for any sub-headings - the caller already adds a top-level "##" heading for each section, ' +
  "so never repeat that heading inside your own text.";

describe("buildGenerateSystemPrompt", () => {
  it("with only docType supplied, keeps the fixed prefix/suffix and adds no optional guidance block", () => {
    for (const docType of ["PRD", "TRS", "UX"]) {
      const prompt = buildGenerateSystemPrompt(docType);
      expect(prompt.startsWith(`You are a senior product/technical writer generating a ${docType} document`)).toBe(
        true,
      );
      expect(prompt.endsWith(CLOSING_INSTRUCTION)).toBe(true);
      // None of the optional-flag-gated guidance text leaks in when no optional args are passed.
      expect(prompt).not.toContain("Fit Criterion"); // FORMAT_GUIDANCE
      expect(prompt).not.toContain("Ubiquitous"); // EARS_GUIDANCE
      expect(prompt).not.toContain("TRS-<NNN>"); // TRACEABILITY_ID_GUIDANCE
      expect(prompt).not.toContain("Open Issue/Assumption"); // ASSUMPTION_STRATEGY_GUIDANCE.strict
      expect(prompt).not.toContain("ASPICE"); // COMPLIANCE_FRAMING_GUIDANCE
      expect(prompt).not.toContain("maximally exploratory"); // INNOVATION_ASSISTANCE
    }
  });

  it("never leaves stray double spaces when optional guidance blocks are omitted", () => {
    for (const docType of ["PRD", "TRS", "UX"]) {
      expect(buildGenerateSystemPrompt(docType)).not.toMatch(/ {2}/);
    }
  });


  it("adds FORMAT_GUIDANCE text for a named format, omits it for the default standard format", () => {
    const withVolere = buildGenerateSystemPrompt("PRD", "volere");
    const withoutFormat = buildGenerateSystemPrompt("PRD");
    expect(withVolere).toContain("Fit Criterion");
    expect(withoutFormat).not.toContain("Fit Criterion");
  });

  it("adds EARS guidance only when requirementPhrasing is 'ears'", () => {
    const ears = buildGenerateSystemPrompt("TRS", "standard", "ears");
    const prose = buildGenerateSystemPrompt("TRS", "standard", "prose");
    expect(ears).toContain("Ubiquitous");
    expect(prose).not.toContain("Ubiquitous");
  });

  it("adds GENERATION_MODE_GUIDANCE text only when generationMode is given", () => {
    const withMode = buildGenerateSystemPrompt("PRD", "standard", "prose", "executive_summary");
    const withoutMode = buildGenerateSystemPrompt("PRD");
    expect(withMode).toContain("time-constrained executive audience");
    expect(withoutMode).not.toContain("time-constrained executive audience");
  });

  it("adds Requirement Depth/Decomposition guidance only for non-default levels", () => {
    const compliance = buildGenerateSystemPrompt(
      "TRS",
      "standard",
      "prose",
      undefined,
      "compliance_grade",
    );
    const signalInterface = buildGenerateSystemPrompt(
      "TRS",
      "standard",
      "prose",
      undefined,
      "standard_engineering",
      "signal_interface",
    );
    const defaults = buildGenerateSystemPrompt("TRS");
    expect(compliance).toContain("safety-case review");
    expect(signalInterface).toContain("signal/interface level");
    expect(defaults).not.toContain("safety-case review");
    expect(defaults).not.toContain("signal/interface level");
  });

  it("adds Traceability guidance only when generateIds is enabled, gating requirementMapping/verificationReferences on it", () => {
    const noTraceability = buildGenerateSystemPrompt(
      "TRS",
      "standard",
      "prose",
      undefined,
      "standard_engineering",
      "functional_requirement",
      { requirementMapping: true, verificationReferences: true },
    );
    const idsOnly = buildGenerateSystemPrompt(
      "TRS",
      "standard",
      "prose",
      undefined,
      "standard_engineering",
      "functional_requirement",
      { generateIds: true },
    );
    const idsAndMapping = buildGenerateSystemPrompt(
      "TRS",
      "standard",
      "prose",
      undefined,
      "standard_engineering",
      "functional_requirement",
      { generateIds: true, requirementMapping: true, verificationReferences: true },
    );
    // requirementMapping/verificationReferences alone (generateIds false) are no-ops.
    expect(noTraceability).not.toContain("TRS-<NNN>");
    expect(noTraceability).not.toContain("fulfills CRS-PRD-003");
    expect(idsOnly).toContain("TRS-<NNN>");
    expect(idsOnly).not.toContain("fulfills CRS-PRD-003");
    expect(idsAndMapping).toContain("fulfills CRS-PRD-003");
    expect(idsAndMapping).toContain("Test and Validation section, explicitly reference");
  });

  it("adds Assumption Strategy guidance only for non-default strategies", () => {
    const strict = buildGenerateSystemPrompt(
      "PRD",
      "standard",
      "prose",
      undefined,
      "standard_engineering",
      "functional_requirement",
      undefined,
      "strict",
    );
    const balanced = buildGenerateSystemPrompt("PRD");
    expect(strict).toContain("Open Issue/Assumption");
    expect(balanced).not.toContain("Open Issue/Assumption");
  });

  it("adds Compliance Framing guidance per enabled flag", () => {
    const aspice = buildGenerateSystemPrompt(
      "TRS",
      "standard",
      "prose",
      undefined,
      "standard_engineering",
      "functional_requirement",
      undefined,
      "balanced",
      { aspice: true },
    );
    const iso26262 = buildGenerateSystemPrompt(
      "TRS",
      "standard",
      "prose",
      undefined,
      "standard_engineering",
      "functional_requirement",
      undefined,
      "balanced",
      { iso26262: true },
    );
    const neither = buildGenerateSystemPrompt("TRS");
    expect(aspice).toContain("ASPICE work-product-aware");
    expect(iso26262).toContain("ISO 26262 terms");
    expect(neither).not.toContain("ASPICE work-product-aware");
    expect(neither).not.toContain("ISO 26262 terms");
  });

  it("adds Output Structure guidance only for items applicable to the given docType", () => {
    const applicable = buildGenerateSystemPrompt(
      "TRS",
      "standard",
      "prose",
      undefined,
      "standard_engineering",
      "functional_requirement",
      undefined,
      "balanced",
      undefined,
      ["Validation Criteria"],
    );
    const inapplicable = buildGenerateSystemPrompt(
      "UX",
      "standard",
      "prose",
      undefined,
      "standard_engineering",
      "functional_requirement",
      undefined,
      "balanced",
      undefined,
      ["Validation Criteria"],
    );
    expect(applicable).toContain("measurable pass/fail condition");
    expect(inapplicable).not.toContain("measurable pass/fail condition");
  });

  it("adds Innovation Assistance guidance only when a level is given", () => {
    const maxIdeation = buildGenerateSystemPrompt(
      "PRD",
      "standard",
      "prose",
      undefined,
      "standard_engineering",
      "functional_requirement",
      undefined,
      "balanced",
      undefined,
      undefined,
      "maximum_ideation",
    );
    const none = buildGenerateSystemPrompt("PRD");
    expect(maxIdeation).toContain("maximally exploratory");
    expect(none).not.toContain("maximally exploratory");
  });

  it("assembles all guidance blocks in the fixed order specified in docs/Enhancements3.md §8 / docs/Enhancements4.md §7", () => {
    const prompt = buildGenerateSystemPrompt(
      "TRS",
      "formal_srs",
      "ears",
      "verification_oriented",
      "compliance_grade",
      "signal_interface",
      { generateIds: true, requirementMapping: true, verificationReferences: true },
      "strict",
      { aspice: true, iso26262: true },
      ["Validation Criteria"],
      "maximum_ideation",
    );
    const indexOf = (needle: string) => {
      const i = prompt.indexOf(needle);
      expect(i).toBeGreaterThan(-1);
      return i;
    };
    const order = [
      indexOf("IEEE 830"), // FORMAT_GUIDANCE.formal_srs
      indexOf("Ubiquitous"), // EARS_GUIDANCE
      indexOf("verified (test type"), // GENERATION_MODE_GUIDANCE.TRS.verification_oriented
      indexOf("safety-case review"), // REQUIREMENT_DEPTH_GUIDANCE.compliance_grade
      indexOf("signal/interface level"), // REQUIREMENT_DECOMPOSITION_GUIDANCE.signal_interface
      indexOf("TRS-<NNN>"), // TRACEABILITY_ID_GUIDANCE.TRS
      indexOf("fulfills CRS-PRD-003"), // TRACEABILITY_MAPPING_GUIDANCE.TRS
      indexOf("Test and Validation section, explicitly reference"), // TRACEABILITY_VERIFICATION_GUIDANCE.TRS
      indexOf("Open Issue/Assumption"), // ASSUMPTION_STRATEGY_GUIDANCE.strict
      indexOf("ASPICE work-product-aware"), // COMPLIANCE_FRAMING_GUIDANCE.aspice
      indexOf("ISO 26262 terms"), // COMPLIANCE_FRAMING_GUIDANCE.iso26262
      indexOf("For each requirement, state how it would be verified"), // OUTPUT_STRUCTURE_GUIDANCE["Validation Criteria"]
      indexOf("maximally exploratory"), // INNOVATION_ASSISTANCE.maximum_ideation
      indexOf("Do not invent section names"), // closing instruction
    ];
    for (let i = 1; i < order.length; i += 1) {
      expect(order[i]).toBeGreaterThan(order[i - 1]);
    }
  });
});

