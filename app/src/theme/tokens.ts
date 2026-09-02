/** Dark navy-blue design tokens for IFACE-THEME (COMP-THEME). */
export const darkTokens = {
  bgBase: "#0a1120",
  bgSurface: "#111b30",
  bgElevated: "#16213c",
  borderSubtle: "#243350",
  textPrimary: "#eef2f9",
  textSecondary: "#9fb0c9",
  accent: "#4c8dff",
  accentContrast: "#ffffff",
  success: "#3fb950",
  warning: "#d29922",
  danger: "#f85149",
} as const;

export const tokensCss = `
:root[data-theme="dark"] {
  --bg-base: ${darkTokens.bgBase};
  --bg-surface: ${darkTokens.bgSurface};
  --bg-elevated: ${darkTokens.bgElevated};
  --border-subtle: ${darkTokens.borderSubtle};
  --text-primary: ${darkTokens.textPrimary};
  --text-secondary: ${darkTokens.textSecondary};
  --accent: ${darkTokens.accent};
  --accent-contrast: ${darkTokens.accentContrast};
  --success: ${darkTokens.success};
  --warning: ${darkTokens.warning};
  --danger: ${darkTokens.danger};
}
body { margin: 0; background: var(--bg-base); color: var(--text-primary);
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", sans-serif; }
button:focus-visible, a:focus-visible, input:focus-visible, textarea:focus-visible {
  outline: 2px solid var(--accent); outline-offset: 2px;
}
`;

/** Relative luminance of a hex color, per WCAG. */
export function relativeLuminance(hex: string): number {
  const value = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

/** Contrast ratio between two hex colors, per WCAG. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}
