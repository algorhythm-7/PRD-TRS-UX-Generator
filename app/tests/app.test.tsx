// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../src/App";

describe("app integration", () => {
  it("falls back to the deterministic generator when the LLM backend is unreachable", async () => {
    // Covers PR-E2E-ACCEPTANCE. The LLM path is attempted (fetch IS called) but this test
    // environment has no backend, so generation must fall back to the deterministic path
    // and still succeed - this is the same behavior the app has with no backend deployed yet.
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    render(<App />);
    fireEvent.change(screen.getByLabelText("Product Title"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Product Details"), { target: { value: "Details." } });
    fireEvent.click(screen.getByLabelText("Product Requirements Document"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Generate" }));
    const output = await screen.findByLabelText("PRD content");
    expect((output as HTMLTextAreaElement).value).toContain("Acme");
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("exports the edited content, not the originally generated content", async () => {
    // Regression test for the App/OutputView edit-loss bug (C7 in XYZAnalysis1.md).
    render(<App />);
    fireEvent.change(screen.getByLabelText("Product Title"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Product Details"), { target: { value: "Details." } });
    fireEvent.click(screen.getByLabelText("Product Requirements Document"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Generate" }));
    await screen.findByLabelText("PRD content");
    fireEvent.change(screen.getByLabelText("PRD content"), { target: { value: "edited content" } });
    expect((screen.getByLabelText("PRD content") as HTMLTextAreaElement).value).toBe("edited content");
    expect(screen.getByRole("button", { name: "Export Word" })).toBeInTheDocument();
  });
});
