import type { JSX } from "react";
import type { DocType, ExportFormat } from "../../generation/contract";
import { buildExport } from "../../export/exportService";

/** Export and download controls for COMP-EXPORTUI. */
export interface ExportControlsProps {
  productTitle: string;
  docType: DocType;
  content: string;
  onDownload?: (filename: string, blob: Blob) => void;
}

function triggerBrowserDownload(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function ExportControls({
  productTitle,
  docType,
  content,
  onDownload,
}: ExportControlsProps): JSX.Element {
  const run = async (format: ExportFormat) => {
    const file = await buildExport(format, content, productTitle, docType);
    if (onDownload) onDownload(file.filename, file.blob);
    else triggerBrowserDownload(file.filename, file.blob);
  };

  return (
    <div className="export-controls" role="group" aria-label="Export actions">
      <button className="btn btn--secondary" type="button" onClick={() => run("word")}>
        Export Word
      </button>
      <button className="btn btn--secondary" type="button" onClick={() => run("pdf")}>
        Export PDF
      </button>
      {docType === "UX" && (
        <button className="btn btn--secondary" type="button" onClick={() => run("mockup")}>
          Download UX
        </button>
      )}
    </div>
  );
}
