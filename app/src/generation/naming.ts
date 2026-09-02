import type { DocType, ExportFormat } from "./contract";

/** Pure filename builder for IFACE-NAMING (COMP-NAMING). */
const EXTENSION: Record<ExportFormat, string> = {
  word: "docx",
  pdf: "pdf",
  mockup: "html",
};

export function sanitizeBase(title: string): string {
  const base = (title ?? "")
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return base.length > 0 ? base : "specpilot";
}

export function prefixFilename(
  title: string,
  docType: DocType,
  format: ExportFormat,
): string {
  return `${sanitizeBase(title)}-${docType.toLowerCase()}.${EXTENSION[format]}`;
}
