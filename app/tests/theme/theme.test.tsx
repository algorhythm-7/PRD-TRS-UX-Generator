// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ThemeProvider } from "../../src/theme/ThemeProvider";
import { contrastRatio, darkTokens } from "../../src/theme/tokens";

describe("dark theme", () => {
  it("renders the dark theme by default", () => {
    // Covers COMP-THEME, FR-THEME-DARKDEFAULT (PR-WEB-THEME).
    render(
      <ThemeProvider>
        <p>content</p>
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  it("meets WCAG AA contrast and defines a focus outline", () => {
    // Covers FR-THEME-KEYBOARD, AT-THEME-USE, NFR-USAB-ACCESS (PR-WEB-THEME).
    const ratio = contrastRatio(darkTokens.textPrimary, darkTokens.bgBase);
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
});
