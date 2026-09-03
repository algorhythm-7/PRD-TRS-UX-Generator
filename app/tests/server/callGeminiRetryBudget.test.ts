// @vitest-environment node
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mocks @google/genai so callGemini's retry loop can be exercised without a real network call.
// Every attempt is made to fail, which is the worst case the retry-budget cap protects against
// (docs/prompts.txt: uncapped retries could fan out to 4 models * 2 attempts = 8 real Gemini calls
// per failing request).
const generateContentMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(() => ({
    models: { generateContent: generateContentMock },
  })),
}));

import { callGemini, type GeminiCallConfig } from "../../vite.config";

// Tested via vite.config.ts (not server.mjs) for the same reason as buildGenerateSystemPrompt.test.ts
// and newEndpoints.test.ts: server.mjs's production Express dependencies aren't installed in this
// workspace. callGemini is identical between the two files (SYNC comment on both).

const config: GeminiCallConfig = {
  apiKey: "test-key",
  defaultModel: "gemini-3.6-flash",
  chatTimeoutMs: 50,
  structuredAttemptTimeoutMs: 50,
};

const jsonSchemaResponseFormat = {
  type: "json_schema",
  json_schema: {
    name: "x",
    strict: true,
    schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
};

describe("callGemini retry budget", () => {
  beforeEach(() => {
    generateContentMock.mockReset();
    generateContentMock.mockRejectedValue(new Error("simulated Gemini failure"));
  });

  it("caps total upstream Gemini calls at 3 when every attempt fails (responseFormat present)", async () => {
    // A modelId distinct from the 3 hardcoded fallbacks yields 4 candidate models - pre-cap this
    // would have produced up to 4 * 2 = 8 calls (2 attempts for the first model, since
    // responseFormat is set, then 1 fallback attempt per subsequent model = up to 4 + 2 = ... the
    // cap must intervene well before all candidates are exhausted).
    await expect(
      callGemini(
        [{ role: "user", content: "hello" }],
        jsonSchemaResponseFormat,
        1024,
        undefined,
        config,
        "gemini-custom-primary",
      ),
    ).rejects.toThrow();

    expect(generateContentMock).toHaveBeenCalledTimes(3);
  });

  it("caps total upstream Gemini calls at 3 when every attempt fails (no responseFormat)", async () => {
    // Without a responseFormat, every attempt is withSchema:false, so pre-cap this would have
    // made one call per candidate model (4 total for a modelId outside the hardcoded fallbacks).
    await expect(
      callGemini([{ role: "user", content: "hello" }], undefined, 1024, undefined, config, "gemini-custom-primary"),
    ).rejects.toThrow();

    expect(generateContentMock).toHaveBeenCalledTimes(3);
  });
});
