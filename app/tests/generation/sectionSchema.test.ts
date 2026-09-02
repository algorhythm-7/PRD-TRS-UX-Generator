import { describe, expect, it } from "vitest";
import {
  sectionNamesFor,
  buildGeneratedDocument,
  VOLERE_SECTIONS,
  PR_FAQ_SECTIONS,
  SHAPE_UP_SECTIONS,
  FORMAL_SRS_SECTIONS,
  C4_MODEL_TRS_SECTIONS,
  SERVICE_BLUEPRINT_SECTIONS,
  JTBD_SECTIONS,
  ATOMIC_DESIGN_SECTIONS,
} from "../../src/generation/sectionSchema";
import { PRD_SECTIONS } from "../../src/generation/prdGen";
import { TRS_SECTIONS } from "../../src/generation/trsGen";
import { UX_SEGMENTS } from "../../src/generation/uxGen";

describe("sectionNamesFor", () => {
  it("returns the exact section/segment tuples for each DocType", () => {
    // Regression guard: this is the single source of truth the LLM path's schema is built from.
    expect(sectionNamesFor("PRD")).toEqual(PRD_SECTIONS);
    expect(sectionNamesFor("TRS")).toEqual(TRS_SECTIONS);
    expect(sectionNamesFor("UX")).toEqual(UX_SEGMENTS);
  });

  it("defaults to standard sections when format is omitted or explicit", () => {
    expect(sectionNamesFor("PRD", "standard")).toEqual(PRD_SECTIONS);
    expect(sectionNamesFor("TRS", "standard")).toEqual(TRS_SECTIONS);
  });

  it("returns each PRD format's own section list", () => {
    expect(sectionNamesFor("PRD", "volere")).toEqual(VOLERE_SECTIONS);
    expect(sectionNamesFor("PRD", "pr_faq")).toEqual(PR_FAQ_SECTIONS);
    expect(sectionNamesFor("PRD", "shape_up")).toEqual(SHAPE_UP_SECTIONS);
  });

  it("returns each TRS format's own section list (EARS is a phrasing overlay, not a skeleton)", () => {
    expect(sectionNamesFor("TRS", "ears")).toEqual(TRS_SECTIONS);
    expect(sectionNamesFor("TRS", "formal_srs")).toEqual(FORMAL_SRS_SECTIONS);
    expect(sectionNamesFor("TRS", "c4_model")).toEqual(C4_MODEL_TRS_SECTIONS);
  });

  it("C4 model keeps Summary/Problem-Statement/NFR-shaped sections, replaces only architecture ones", () => {
    expect(C4_MODEL_TRS_SECTIONS).toContain("Summary");
    expect(C4_MODEL_TRS_SECTIONS).toContain("Problem Statement and Proposed Solution");
    expect(C4_MODEL_TRS_SECTIONS).toContain("System Context");
    expect(C4_MODEL_TRS_SECTIONS).not.toContain("High Level Architecture");
    expect(C4_MODEL_TRS_SECTIONS).not.toContain("System Boundaries");
    expect(C4_MODEL_TRS_SECTIONS).toContain("Non-Functional Requirements");
    expect(C4_MODEL_TRS_SECTIONS).toContain("AI Usage and Implications");
    // "Deployments" must appear exactly once, from the C4 architecture list, not duplicated.
    expect(C4_MODEL_TRS_SECTIONS.filter((n) => n === "Deployments")).toHaveLength(1);
  });

  it("returns each UX format's list with the reused Standard segment appended/prepended", () => {
    expect(sectionNamesFor("UX", "service_blueprint")).toEqual([
      ...SERVICE_BLUEPRINT_SECTIONS,
      UX_SEGMENTS[1],
    ]);
    expect(sectionNamesFor("UX", "jtbd")).toEqual([...JTBD_SECTIONS, UX_SEGMENTS[1]]);
    expect(sectionNamesFor("UX", "atomic_design")).toEqual([
      UX_SEGMENTS[0],
      ...ATOMIC_DESIGN_SECTIONS,
    ]);
  });

  it("uses customSections for the custom format, falling back to Standard if none supplied", () => {
    expect(sectionNamesFor("PRD", "custom", ["A", "B"])).toEqual(["A", "B"]);
    expect(sectionNamesFor("PRD", "custom")).toEqual(PRD_SECTIONS);
  });

  it("appends additionalSections, de-duplicating against the resolved base list", () => {
    expect(sectionNamesFor("PRD", "standard", undefined, ["User Stories"])).toEqual([
      ...PRD_SECTIONS,
      "User Stories",
    ]);
    // "Risks and Dependencies" is already in PRD_SECTIONS - must not be duplicated.
    expect(sectionNamesFor("PRD", "standard", undefined, ["Risks and Dependencies"])).toEqual(
      PRD_SECTIONS,
    );
  });
});

describe("buildGeneratedDocument", () => {
  it("numbers PRD/TRS headings and orders them per PRD_SECTIONS/TRS_SECTIONS", () => {
    const sections = Object.fromEntries(PRD_SECTIONS.map((name) => [name, `Body for ${name}.`]));
    const doc = buildGeneratedDocument("Acme", "PRD", sections);
    expect(doc.type).toBe("PRD");
    expect(doc.title).toBe("Acme — Product Requirements Document");
    expect(doc.content).toContain("# Acme PRD");
    let lastIndex = -1;
    PRD_SECTIONS.forEach((name, index) => {
      const heading = `## ${index + 1}. ${name}`;
      const at = doc.content.indexOf(heading);
      expect(at).toBeGreaterThan(lastIndex);
      lastIndex = at;
    });
  });

  it("reconstructs a non-Standard format's headings using the matching format param", () => {
    // Regression guard for the bug this task caught: without threading `format` through,
    // buildGeneratedDocument would silently render Standard PRD_SECTIONS headings even when the
    // LLM was actually asked for (and returned) Volere's section names.
    const sections = Object.fromEntries(VOLERE_SECTIONS.map((name) => [name, `Body for ${name}.`]));
    const doc = buildGeneratedDocument("Acme", "PRD", sections, "volere");
    VOLERE_SECTIONS.forEach((name, index) => {
      expect(doc.content).toContain(`## ${index + 1}. ${name}`);
    });
    expect(doc.content).not.toContain(PRD_SECTIONS[0]);
  });

  it("does not number UX headings but preserves segment order", () => {
    const sections = Object.fromEntries(UX_SEGMENTS.map((name) => [name, `Body for ${name}.`]));
    const doc = buildGeneratedDocument("Acme", "UX", sections);
    expect(doc.type).toBe("UX");
    expect(doc.title).toBe("Acme — UX Design Mockups");
    expect(doc.content).toContain("# Acme UX Design Mockups");
    expect(doc.content).not.toContain("## 1.");
    let lastIndex = -1;
    UX_SEGMENTS.forEach((name) => {
      const at = doc.content.indexOf(`## ${name}`);
      expect(at).toBeGreaterThan(lastIndex);
      lastIndex = at;
    });
  });
});
