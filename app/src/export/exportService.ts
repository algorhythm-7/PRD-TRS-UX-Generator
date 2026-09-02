import { Document, Packer, Paragraph } from "docx";
import type { ExportFormat, DocType } from "../generation/contract";
import { prefixFilename } from "../generation/naming";

/** File builders for IFACE-EXPORTSVC (COMP-EXPORTSVC). */
export interface ExportedFile {
  filename: string;
  contentType: string;
  blob: Blob;
}

export async function buildWord(
  content: string,
  title: string,
  docType: DocType,
): Promise<ExportedFile> {
  const paragraphs = content.split("\n").map((line) => new Paragraph({ text: line }));
  const doc = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(doc);
  return {
    filename: prefixFilename(title, docType, "word"),
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    blob,
  };
}

function escapePdfText(text: string): string {
  return text.replace(/([\\()])/g, "\\$1");
}

/** Minimal, dependency-free single-flow PDF containing the document text. */
export function buildPdf(content: string, title: string, docType: DocType): ExportedFile {
  const lines = content.split("\n").slice(0, 50);
  const textOps = lines
    .map((line, index) => {
      const y = 780 - index * 14;
      return `BT /F1 10 Tf 40 ${y} Td (${escapePdfText(line)}) Tj ET`;
    })
    .join("\n");
  const stream = textOps;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${offset.toString().padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return {
    filename: prefixFilename(title, docType, "pdf"),
    contentType: "application/pdf",
    blob: new Blob([pdf], { type: "application/pdf" }),
  };
}

export function buildMockup(
  content: string,
  title: string,
  docType: DocType,
): ExportedFile {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><pre>${content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")}</pre></body></html>`;
  return {
    filename: prefixFilename(title, docType, "mockup"),
    contentType: "text/html",
    blob: new Blob([html], { type: "text/html" }),
  };
}

export async function buildExport(
  format: ExportFormat,
  content: string,
  title: string,
  docType: DocType,
): Promise<ExportedFile> {
  if (format === "word") return buildWord(content, title, docType);
  if (format === "pdf") return buildPdf(content, title, docType);
  return buildMockup(content, title, docType);
}
