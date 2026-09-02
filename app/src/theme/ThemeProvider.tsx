import { useEffect, type ReactNode, type JSX } from "react";
import { tokensCss } from "./tokens";

/** Applies the dark theme by default for COMP-THEME. */
export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);
  // Ensure the attribute is present on first render for tests and SSR-less loads.
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
  return (
    <>
      <style data-testid="theme-tokens">{tokensCss}</style>
      {children}
    </>
  );
}
