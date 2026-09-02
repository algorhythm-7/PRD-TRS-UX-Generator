import type { JSX } from "react";
import { DOC_TYPE_LABELS } from "../generation/contract";

/** In-app help panel content for NFR-DOC-USERHELP (COMP-APPSHELL). */
export function HelpPanel(): JSX.Element {
  return (
    <details className="help-panel" data-testid="help-panel">
      <summary className="help-panel__toggle">Help</summary>
      <div className="help-panel__body">
        <p>Enter a product title and details, choose the documents to generate, then export.</p>
        <ul className="help-panel__list">
          <li>{DOC_TYPE_LABELS.PRD}: business-facing requirements.</li>
          <li>{DOC_TYPE_LABELS.TRS}: technical requirements.</li>
          <li>{DOC_TYPE_LABELS.UX}: user journeys and UI mockups.</li>
          <li>Export a document to Word or PDF, or download the UX mockups.</li>
        </ul>
      </div>
    </details>
  );
}
