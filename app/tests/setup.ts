import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Neutralize the background warm-up status/poll calls for every test by default, so App's
// useEffect doesn't make real, uncontrolled /_api/llm-status /_api/llm-warmup network calls in
// tests that aren't specifically exercising that feature (see tests/appLlmStatus.test.tsx,
// which declares its own vi.mock for this module and takes precedence for that file).
// postGapAnalysis/postGenerate are left as their real implementations - existing tests
// deliberately exercise the real fetch-then-fallback behavior for those two.
vi.mock("../src/api/llmClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/api/llmClient")>();
  return {
    ...actual,
    getLlmStatus: vi.fn().mockResolvedValue({ ready: true, primary: { app: null, state: "ONLINE" } }),
    triggerLlmWarmup: vi.fn().mockResolvedValue(undefined),
  };
});
