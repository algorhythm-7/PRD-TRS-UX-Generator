import { describe, expect, it, vi, beforeEach } from "vitest";
import * as llmClient from "../../src/api/llmClient";
import { regenerateWithFeedback, runGapAnalysis, runGeneration } from "../../src/generation/llmGenService";
import { PRD_SECTIONS } from "../../src/generation/prdGen";

vi.mock("../../src/api/llmClient", () => ({
  postGapAnalysis: vi.fn(),
  postGenerate: vi.fn(),
}));

const baseInput = { productTitle: "Acme", productDetails: "Details." };

describe("runGapAnalysis", () => {
  beforeEach(() => {
    vi.mocked(llmClient.postGapAnalysis).mockReset();
  });

  it("returns the questions on success", async () => {
    vi.mocked(llmClient.postGapAnalysis).mockResolvedValue({
      questions: [{ id: "q1", question: "Should this support SSO?" }],
    });
    const questions = await runGapAnalysis({ ...baseInput, selectedTypes: ["PRD"] });
    expect(questions).toHaveLength(1);
  });

  it("fails open (returns []) on any error, never throwing", async () => {
    vi.mocked(llmClient.postGapAnalysis).mockRejectedValue(new Error("network error"));
    const questions = await runGapAnalysis({ ...baseInput, selectedTypes: ["PRD"] });
    expect(questions).toEqual([]);
  });
});

describe("runGeneration", () => {
  beforeEach(() => {
    vi.mocked(llmClient.postGenerate).mockReset();
  });

  it('uses LLM content and tags source "llm" on success', async () => {
    vi.mocked(llmClient.postGenerate).mockResolvedValue({
      sections: Object.fromEntries(PRD_SECTIONS.map((name) => [name, `LLM body for ${name}.`])),
    });
    const [doc] = await runGeneration({ ...baseInput, selectedTypes: ["PRD"] });
    expect(doc.source).toBe("llm");
    expect(doc.content).toContain("LLM body for Problem Statement.");
  });

  it('falls back to the deterministic generator and tags source "fallback" on failure', async () => {
    vi.mocked(llmClient.postGenerate).mockRejectedValue(new Error("LLM_UNAVAILABLE"));
    const [doc] = await runGeneration({ ...baseInput, selectedTypes: ["PRD"] });
    expect(doc.source).toBe("fallback");
    expect(doc.content).toContain("Acme addresses the following need: Details.");
  });

  it("generates each DocType independently - one failing does not affect another", async () => {
    vi.mocked(llmClient.postGenerate).mockImplementation(async (request) => {
      if (request.docType === "PRD") {
        return { sections: Object.fromEntries(PRD_SECTIONS.map((n) => [n, `LLM ${n}`])) };
      }
      throw new Error("LLM_UNAVAILABLE");
    });
    const docs = await runGeneration({ ...baseInput, selectedTypes: ["PRD", "TRS"] });
    const prd = docs.find((d) => d.type === "PRD");
    const trs = docs.find((d) => d.type === "TRS");
    expect(prd?.source).toBe("llm");
    expect(trs?.source).toBe("fallback");
  });

  it("an all-defaults input (no profile/outputStructureItems/referenceContent) reproduces today's exact postGenerate payload", async () => {
    vi.mocked(llmClient.postGenerate).mockResolvedValue({
      sections: Object.fromEntries(PRD_SECTIONS.map((name) => [name, `LLM body for ${name}.`])),
    });
    await runGeneration({ ...baseInput, selectedTypes: ["PRD"] });
    expect(llmClient.postGenerate).toHaveBeenCalledWith({
      docType: "PRD",
      productTitle: "Acme",
      productDetails: "Details.",
      answers: undefined,
      clarifications: undefined,
      sections: [...PRD_SECTIONS],
      format: undefined,
      requirementPhrasing: undefined,
      generationMode: undefined,
      requirementDepth: undefined,
      requirementDecomposition: undefined,
      innovationAssistance: undefined,
      targetAudience: undefined,
      traceability: undefined,
      assumptionStrategy: undefined,
      complianceFraming: undefined,
      referenceContent: undefined,
      priorAttempt: undefined,
    });
  });
});

describe("regenerateWithFeedback", () => {
  beforeEach(() => {
    vi.mocked(llmClient.postGenerate).mockReset();
  });

  const priorAttempt = { originalContent: "Old.", editedContent: "New and improved." };

  it('uses LLM content and tags source "llm" on success, passing priorAttempt through', async () => {
    vi.mocked(llmClient.postGenerate).mockResolvedValue({
      sections: Object.fromEntries(PRD_SECTIONS.map((name) => [name, `LLM body for ${name}.`])),
    });
    const doc = await regenerateWithFeedback("PRD", { ...baseInput, selectedTypes: ["PRD"] }, priorAttempt);
    expect(doc.source).toBe("llm");
    expect(llmClient.postGenerate).toHaveBeenCalledWith(expect.objectContaining({ priorAttempt }));
  });

  it('falls back to the deterministic generator and tags source "fallback" on failure', async () => {
    vi.mocked(llmClient.postGenerate).mockRejectedValue(new Error("LLM_UNAVAILABLE"));
    const doc = await regenerateWithFeedback("PRD", { ...baseInput, selectedTypes: ["PRD"] }, priorAttempt);
    expect(doc.source).toBe("fallback");
    expect(doc.content).toContain("Acme addresses the following need: Details.");
  });
});
