import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GenerateRequest,
  postContextExtract,
  postGenerate,
  postTemplateExtract,
  LlmClientError,
} from "../../src/api/llmClient";

// docs/EnhancementToDo3.md §5 task 4 - unit tests for the two new client functions, plus a
// backward-compatibility test proving a pre-existing-fields-only GenerateRequest produces the
// exact same request body as before the new optional fields were added.

function mockFetchOnce(response: { ok: boolean; status?: number; json?: () => Promise<unknown> }) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: response.json ?? (() => Promise.resolve({})),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("postTemplateExtract", () => {
  it("posts { docType, rawText } to /_api/template-extract and returns the parsed response", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: () => Promise.resolve({ sections: ["Executive Summary", "Goals"] }),
    });
    const result = await postTemplateExtract("PRD", "1. Executive Summary\n2. Goals");
    expect(fetchMock).toHaveBeenCalledWith(
      "/_api/template-extract",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ docType: "PRD", rawText: "1. Executive Summary\n2. Goals" }),
      }),
    );
    expect(result).toEqual({ sections: ["Executive Summary", "Goals"] });
  });

  it("throws LlmClientError on a non-2xx response", async () => {
    mockFetchOnce({ ok: false, status: 503 });
    await expect(postTemplateExtract("PRD", "text")).rejects.toBeInstanceOf(LlmClientError);
  });
});

describe("postContextExtract", () => {
  it("posts { filename, rawText } to /_api/context-extract and returns the parsed response", async () => {
    const fetchMock = mockFetchOnce({
      ok: true,
      json: () => Promise.resolve({ extractedText: "hello", truncated: false }),
    });
    const result = await postContextExtract("notes.txt", "hello");
    expect(fetchMock).toHaveBeenCalledWith(
      "/_api/context-extract",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ filename: "notes.txt", rawText: "hello" }),
      }),
    );
    expect(result).toEqual({ extractedText: "hello", truncated: false });
  });
});

describe("GenerateRequest backward compatibility", () => {
  it("a request with only pre-existing fields produces the exact same request body as before the new optional fields existed", async () => {
    const fetchMock = mockFetchOnce({ ok: true, json: () => Promise.resolve({ sections: {} }) });
    const request: GenerateRequest = {
      docType: "PRD",
      productTitle: "Acme",
      productDetails: "A widget",
      answers: { a: "b" },
      clarifications: { c: "d" },
      sections: ["Summary"],
    };
    await postGenerate(request);
    expect(fetchMock).toHaveBeenCalledWith(
      "/_api/generate",
      expect.objectContaining({
        body: JSON.stringify({
          docType: "PRD",
          productTitle: "Acme",
          productDetails: "A widget",
          answers: { a: "b" },
          clarifications: { c: "d" },
          sections: ["Summary"],
        }),
      }),
    );
  });
});
