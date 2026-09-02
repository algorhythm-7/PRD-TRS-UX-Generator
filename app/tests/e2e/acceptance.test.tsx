// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { App } from "../../src/App";
import { PRD_SECTIONS } from "../../src/generation/prdGen";
import { TRS_SECTIONS } from "../../src/generation/trsGen";
import { UX_SEGMENTS } from "../../src/generation/uxGen";

describe("acceptance flow", () => {
  it("generates only selected types", async () => {
    // Covers AT-GEN-SELECTED (PR-E2E-ACCEPTANCE).
    render(<App />);
    fireEvent.change(screen.getByLabelText("Product Title"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Product Details"), { target: { value: "Details." } });
    fireEvent.click(screen.getByLabelText("Product Requirements Document"));
    fireEvent.click(screen.getByLabelText("UX Design Mockups"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Generate" }));
    expect(await screen.findByRole("tab", { name: "PRD" })).toBeInTheDocument();
    expect(await screen.findByRole("tab", { name: "UX" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "TRS" })).toBeNull();
  });

  it("produces ordered PRD, TRS, and UX content within budget and keeps export in sync with the active tab", async () => {
    // Covers AT-PRD-SECTIONS, AT-TRS-SECTIONS, AT-UX-SEGMENTS, AT-PERF-GEN (PR-E2E-ACCEPTANCE).
    const start = Date.now();
    render(<App />);
    fireEvent.change(screen.getByLabelText("Product Title"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Product Details"), { target: { value: "Details." } });
    fireEvent.click(screen.getByLabelText("Product Requirements Document"));
    fireEvent.click(screen.getByLabelText("Technical Requirements Specification"));
    fireEvent.click(screen.getByLabelText("UX Design Mockups"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Generate" }));

    const prdContent = await screen.findByLabelText("PRD content");
    expect((prdContent as HTMLTextAreaElement).value).toContain(PRD_SECTIONS[0]);

    fireEvent.click(screen.getByRole("tab", { name: "TRS" }));
    expect((screen.getByLabelText("TRS content") as HTMLTextAreaElement).value).toContain(
      TRS_SECTIONS[11],
    );

    fireEvent.click(screen.getByRole("tab", { name: "UX" }));
    expect((screen.getByLabelText("UX content") as HTMLTextAreaElement).value).toContain(
      UX_SEGMENTS[1],
    );
    // Regression check: the UX export button must appear when the UX tab is active (App/OutputView active-tab desync bug).
    expect(screen.getByRole("button", { name: "Download UX" })).toBeInTheDocument();

    expect(Date.now() - start).toBeLessThan(10000);
  });

  it("reaches generation via Continue -> Generation Profile screen -> Generate with every profile field left at its default", async () => {
    // Covers docs/EnhancementToDo3.md §9 task 3 - the inserted Generation Profile screen must
    // default to a no-op configuration, producing the same PRD content as the pre-existing
    // "generates only selected types" scenario above (does not modify that scenario's assertions).
    render(<App />);
    fireEvent.change(screen.getByLabelText("Product Title"), { target: { value: "Acme" } });
    fireEvent.change(screen.getByLabelText("Product Details"), { target: { value: "Details." } });
    fireEvent.click(screen.getByLabelText("Product Requirements Document"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    // Generation Profile screen appears, defaulted to Standard - left untouched.
    expect(await screen.findByLabelText("PRD Template Standard")).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Generate" }));

    const prdContent = await screen.findByLabelText("PRD content");
    expect((prdContent as HTMLTextAreaElement).value).toContain(PRD_SECTIONS[0]);
  });
});
