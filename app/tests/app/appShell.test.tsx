// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AppShell } from "../../src/app/AppShell";

describe("app shell", () => {
  it("renders the header and help panel", () => {
    // Covers COMP-APPSHELL, NFR-PORT-BROWSER, NFR-DOC-USERHELP (PR-WEB-APPSHELL).
    render(
      <AppShell>
        <p>body content</p>
      </AppShell>,
    );
    expect(screen.getByRole("heading", { name: "SpecPilot" })).toBeInTheDocument();
    expect(screen.getByTestId("help-panel")).toBeInTheDocument();
  });
});
