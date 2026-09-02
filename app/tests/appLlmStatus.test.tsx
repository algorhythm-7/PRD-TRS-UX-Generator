// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import * as llmClient from "../src/api/llmClient";
import { App } from "../src/App";

// Mocked wholesale (not just global fetch) so the warm-up status/poll behavior can be
// controlled precisely, independent of the gap-analysis/generate network calls tested
// elsewhere (tests/app.test.tsx, tests/generation/llmGenService.test.ts).
vi.mock("../src/api/llmClient", () => ({
  postGapAnalysis: vi.fn(),
  postGenerate: vi.fn(),
  getLlmStatus: vi.fn(),
  triggerLlmWarmup: vi.fn(),
}));

describe("LLM warm-up status banner", () => {
  beforeEach(() => {
    vi.mocked(llmClient.postGapAnalysis).mockReset().mockResolvedValue({ questions: [] });
    vi.mocked(llmClient.postGenerate).mockReset().mockRejectedValue(new Error("LLM_UNAVAILABLE"));
    vi.mocked(llmClient.getLlmStatus).mockReset();
    vi.mocked(llmClient.triggerLlmWarmup).mockReset().mockResolvedValue(undefined);
  });

  it("shows the warm-up notice immediately, before the first status check resolves", () => {
    vi.mocked(llmClient.getLlmStatus).mockResolvedValue({
      ready: false,
      primary: { app: "gemini", state: "MISCONFIGURED" },
    });

    render(<App />);

    // Initial state is "not ready" synchronously, before any async status check completes -
    // the banner must never wait on a network round-trip to appear.
    expect(screen.getByRole("status")).toHaveTextContent(/warming up/i);
    expect(llmClient.triggerLlmWarmup).toHaveBeenCalledTimes(1);
  });

  it("hides the warm-up notice once a status check reports ready", async () => {
    vi.mocked(llmClient.getLlmStatus).mockResolvedValue({
      ready: true,
      primary: { app: "gemini", state: "ONLINE" },
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("still generates immediately (via the deterministic fallback) regardless of warm-up state", async () => {
    vi.mocked(llmClient.getLlmStatus).mockResolvedValue({
      ready: false,
      primary: { app: "gemini", state: "MISCONFIGURED" },
    });

    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent(/warming up/i);

    fireEvent.change(screen.getByLabelText("Product Title"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Product Details"), { target: { value: "Details." } });
    fireEvent.click(screen.getByLabelText("Product Requirements Document"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Generate" }));

    const output = await screen.findByLabelText("PRD content");
    expect((output as HTMLTextAreaElement).value).toContain("Acme");
  });
});


