// @vitest-environment node
import { describe, expect, it } from "vitest";
import { applyContextExtractBudget, templateExtractSchema } from "../../vite.config";

// Contract tests for the two new endpoints added in docs/EnhancementToDo3.md §4 (task 3):
// POST /_api/template-extract and POST /_api/context-extract (Phase 1). Both server.mjs and
// vite.config.ts implement these identically; tested via vite.config.ts for the same reasons
// documented in tests/server/buildGenerateSystemPrompt.test.ts (server.mjs's Express dependencies
// aren't installed in this workspace).

describe("templateExtractSchema (POST /_api/template-extract response contract)", () => {
  it("requires a top-level 'sections' array of strings, matching docs/Enhancements2.md §3.5", () => {
    const schema = templateExtractSchema();
    expect(schema.json_schema.strict).toBe(true);
    expect(schema.json_schema.schema.required).toEqual(["sections"]);
    expect(schema.json_schema.schema.additionalProperties).toBe(false);
    expect(schema.json_schema.schema.properties.sections).toEqual({
      type: "array",
      items: { type: "string" },
    });
  });
});

describe("applyContextExtractBudget (POST /_api/context-extract response contract)", () => {
  it("returns the text unchanged and truncated:false when under the limit", () => {
    expect(applyContextExtractBudget("short text", 8000)).toEqual({
      extractedText: "short text",
      truncated: false,
    });
  });

  it("returns the text unchanged and truncated:false when exactly at the limit", () => {
    const text = "a".repeat(8000);
    expect(applyContextExtractBudget(text, 8000)).toEqual({ extractedText: text, truncated: false });
  });

  it("truncates to the limit and reports truncated:true when over the limit", () => {
    const text = "a".repeat(8001);
    const result = applyContextExtractBudget(text, 8000);
    expect(result.truncated).toBe(true);
    expect(result.extractedText).toHaveLength(8000);
    expect(result.extractedText).toBe("a".repeat(8000));
  });

  it("handles empty input", () => {
    expect(applyContextExtractBudget("", 8000)).toEqual({ extractedText: "", truncated: false });
  });
});
