// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ExportControls } from "../../src/features/export/ExportControls";

describe("export controls", () => {
  it("exports to Word and PDF with a title-prefixed filename, with no network calls", async () => {
    // Covers COMP-EXPORTUI, FR-EXPORT-WORD, FR-EXPORT-PDF, AT-EXPORT-WORDPDF (PR-WEB-EXPORTUI).
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const onDownload = vi.fn();
    render(<ExportControls productTitle="Acme" docType="PRD" content="body" onDownload={onDownload} />);
    fireEvent.click(screen.getByRole("button", { name: "Export Word" }));
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await waitFor(() => expect(onDownload).toHaveBeenCalledTimes(2));
    // Word (real docx Packer.toBlob) and PDF resolve independently, so call order isn't guaranteed.
    const filenames = onDownload.mock.calls.map((call) => call[0]);
    expect(filenames).toContain("acme-prd.docx");
    expect(filenames).toContain("acme-prd.pdf");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("downloads UX mockups for a UX document", async () => {
    // Covers FR-EXPORT-UXDOWNLOAD, AT-EXPORT-UX (PR-WEB-EXPORTUI).
    const onDownload = vi.fn();
    render(<ExportControls productTitle="Acme" docType="UX" content="body" onDownload={onDownload} />);
    fireEvent.click(screen.getByRole("button", { name: "Download UX" }));
    await waitFor(() => expect(onDownload).toHaveBeenCalledTimes(1));
    expect(onDownload.mock.calls[0][0]).toBe("acme-ux.html");
  });
});
