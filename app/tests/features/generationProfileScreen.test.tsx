// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { GenerationProfileScreen } from "../../src/features/profile/GenerationProfileScreen";
import * as sessionMemory from "../../src/generation/sessionMemory";

// docs/EnhancementToDo3.md §8 task 7.
vi.mock("../../src/generation/sessionMemory", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/generation/sessionMemory")>();
  return { ...actual, loadSessionMemoryStore: vi.fn(actual.loadSessionMemoryStore) };
});

describe("GenerationProfileScreen", () => {
  beforeEach(() => {
    vi.mocked(sessionMemory.loadSessionMemoryStore).mockReset();
    vi.mocked(sessionMemory.loadSessionMemoryStore).mockReturnValue({ version: 1, sessions: [] });
  });

  it("an untouched screen (no prior sessions) produces the documented no-op GenerationProfile", () => {
    const onChange = vi.fn();
    render(<GenerationProfileScreen selectedTypes={["PRD"]} onChange={onChange} onGenerate={vi.fn()} />);
    expect(onChange).toHaveBeenCalledWith({
      profile: {
        perDocType: {
          PRD: {
            format: "standard",
            generationMode: "product_management",
            requirementDepth: "standard_engineering",
            requirementDecomposition: "functional_requirement",
            innovationAssistance: "disabled",
            targetAudience: "product",
          },
        },
        traceability: { generateIds: false, requirementMapping: false, verificationReferences: false },
        assumptionStrategy: "balanced",
        complianceFraming: { aspice: false, iso26262: false },
      },
      outputStructureItems: {},
      referenceContent: undefined,
      usePriorPreferences: true,
    });
  });

  it("disables an Output Structure checkbox (with an explanatory tooltip) when the Template already includes an equivalent section", () => {
    render(<GenerationProfileScreen selectedTypes={["PRD"]} onChange={vi.fn()} onGenerate={vi.fn()} />);
    // Standard PRD sections already include "Risks and Dependencies" - an equivalent of "Risks".
    const risksCheckbox = screen.getByLabelText("PRD Output Structure Risks") as HTMLInputElement;
    expect(risksCheckbox.disabled).toBe(true);
    expect(risksCheckbox.closest("label")).toHaveAttribute(
      "title",
      expect.stringContaining("Risks and Dependencies"),
    );
  });

  it("does not disable an Output Structure item with no equivalent in the selected Template", () => {
    render(<GenerationProfileScreen selectedTypes={["PRD"]} onChange={vi.fn()} onGenerate={vi.fn()} />);
    const userStories = screen.getByLabelText("PRD Output Structure User Stories") as HTMLInputElement;
    expect(userStories.disabled).toBe(false);
  });

  it("pre-fills fields from consolidated session-memory preferences instead of hard-coded defaults", () => {
    vi.mocked(sessionMemory.loadSessionMemoryStore).mockReturnValue({
      version: 1,
      sessions: [
        {
          id: "s1",
          timestamp: new Date().toISOString(),
          productTitle: "Prior",
          perDocType: {
            PRD: {
              format: "volere",
              generationMode: "executive_summary",
              requirementDepth: "detailed_engineering",
              requirementDecomposition: "feature",
              innovationAssistance: "suggest_missing",
              targetAudience: "customer",
              editedSectionCount: 0,
              thumbsDownSectionCount: 0,
            },
          },
          assumptionStrategy: "strict",
          traceability: { generateIds: true, requirementMapping: false, verificationReferences: false },
        },
      ],
    });
    render(<GenerationProfileScreen selectedTypes={["PRD"]} onChange={vi.fn()} onGenerate={vi.fn()} />);
    expect((screen.getByLabelText("PRD Template Volere") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Assumption Strategy Strict") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Generate requirement IDs") as HTMLInputElement).checked).toBe(true);
  });

  it("calls onGenerate and reflects the pending state, matching ClarificationQuestions' convention", () => {
    const onGenerate = vi.fn();
    render(<GenerationProfileScreen selectedTypes={["PRD"]} onChange={vi.fn()} onGenerate={onGenerate} pending />);
    const button = screen.getByRole("button", { name: "Generating…" });
    expect(button).toBeDisabled();
  });
});
