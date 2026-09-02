// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { HelpPanel } from "../../src/app/HelpPanel";

describe("in-app help", () => {
  it("documents the three document types and export actions", () => {
    // Covers NFR-DOC-USERHELP (PR-DOCS-USERGUIDE).
    render(<HelpPanel />);
    const panel = screen.getByTestId("help-panel");
    expect(panel.textContent).toContain("Product Requirements Document");
    expect(panel.textContent).toContain("Technical Requirements Specification");
    expect(panel.textContent).toContain("UX Design Mockups");
    expect(panel.textContent).toContain("Word or PDF");
  });
});
