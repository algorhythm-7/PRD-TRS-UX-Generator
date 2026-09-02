// @vitest-environment node
import { describe, expect, it } from "vitest";
import { buildWord, buildPdf, buildMockup } from "../../src/export/exportService";

describe("export service", () => {
  it("builds a Word document blob with a prefixed filename", async () => {
    // Covers COMP-EXPORTSVC, FR-EXPORT-WORD (PR-APP-EXPORTSVC).
    const file = await buildWord("# Acme\n\nBody", "Acme", "PRD");
    expect(file.filename).toBe("acme-prd.docx");
    expect(file.blob).toBeInstanceOf(Blob);
    expect(file.blob.size).toBeGreaterThan(0);
  });

  it("builds a PDF document blob", async () => {
    // Covers COMP-EXPORTSVC, FR-EXPORT-PDF (PR-APP-EXPORTSVC).
    const file = buildPdf("Acme content", "Acme", "TRS");
    expect(file.filename).toBe("acme-trs.pdf");
    const head = await file.blob.slice(0, 5).text();
    expect(head).toBe("%PDF-");
  });

  it("builds a downloadable UX mockup file", async () => {
    // Covers COMP-EXPORTSVC, FR-EXPORT-UXDOWNLOAD (PR-APP-EXPORTSVC).
    const file = buildMockup("<journey>", "Acme", "UX");
    expect(file.filename).toBe("acme-ux.html");
    const text = await file.blob.text();
    expect(text).toContain("<!doctype html>");
  });
});
