import { useEffect, useMemo, useState, type JSX } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";
import type { GeneratedDocument, DocType } from "../../generation/contract";
import type { PriorAttempt } from "../../api/llmClient";

/** Naive split on level-2 ("## ") heading lines - only ever used to attach a soft regeneration
 * hint, never a correctness-critical decision, so this fragility is an acceptable trade-off
 * (docs/Enhancements2.md §4.5) instead of a structural per-section data model. */
function parseSectionNames(content: string): string[] {
  const matches = content.match(/^## (.+)$/gm) ?? [];
  return matches.map((line) => line.replace(/^## /, "").trim());
}

/** Segmented output view with inline editing for COMP-OUTPUTVIEW. */
export interface OutputViewProps {
  documents: GeneratedDocument[];
  onContentChange?: (type: DocType, content: string) => void;
  onActiveChange?: (type: DocType) => void;
  /** docs/Enhancements2.md §4 - "Regenerate with my edits", confirmed via the two-step flow
   * below. This component only reports the user's intent; the caller wires it to
   * `llmGenService.regenerateWithFeedback`. */
  onRegenerate?: (type: DocType, priorAttempt: PriorAttempt) => void;
  pending?: boolean;
  /** docs/Enhancements2.md §4.6 - set by the caller when the *last regeneration* for this
   * DocType fell back to the deterministic builder, so this component can show a message
   * distinguishing that from a normal initial-generation fallback. */
  regenerateFallbackFor?: DocType | null;
  /** docs/Enhancements4.md §3.2/§11 task 2 - fired only when a section transitions to newly
   * marked "rewrite" (a thumbs-down), for the caller's session-memory feedback count - never on
   * a "keep" click or on un-marking a prior "rewrite". */
  onSectionThumbsDown?: (type: DocType, sectionName: string) => void;
}

export function OutputView({
  documents,
  onContentChange,
  onActiveChange,
  onRegenerate,
  pending,
  regenerateFallbackFor,
  onSectionThumbsDown,
}: OutputViewProps): JSX.Element {
  const [active, setActive] = useState<DocType | null>(documents[0]?.type ?? null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const [regenerateComment, setRegenerateComment] = useState("");
  const [sectionSignals, setSectionSignals] = useState<Record<string, "keep" | "rewrite">>({});

  // Regeneration replaces prior output: reset edits and active tab when docs change.
  useEffect(() => {
    setEdits({});
    setConfirmingRegenerate(false);
    setRegenerateComment("");
    setSectionSignals({});
    const firstType = documents[0]?.type ?? null;
    setActive(firstType);
    if (firstType) onActiveChange?.(firstType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents]);

  const activeDoc = documents.find((d) => d.type === active) ?? documents[0];
  const value = activeDoc ? (edits[activeDoc.type] ?? activeDoc.content) : "";

  // marked's synchronous parse() always returns a string here (no async extensions are used);
  // DOMPurify sanitizes the result before it's ever rendered, since this content can come from
  // an LLM response or direct user editing, not just this app's own trusted templates. Hooks
  // must run unconditionally, so this is computed even for the empty-documents case (value is
  // just "" then, and the result is discarded by the early return below).
  const previewHtml = useMemo(
    () => DOMPurify.sanitize(marked.parse(value, { async: false }) as string),
    [value],
  );

  if (!activeDoc) {
    return (
      <p className="output-view__empty" data-testid="empty-output">
        No documents generated yet.
      </p>
    );
  }

  const onEdit = (content: string) => {
    setEdits((current) => ({ ...current, [activeDoc.type]: content }));
    onContentChange?.(activeDoc.type, content);
  };

  const selectTab = (type: DocType) => {
    setActive(type);
    setConfirmingRegenerate(false);
    setRegenerateComment("");
    setSectionSignals({});
    onActiveChange?.(type);
  };

  const hasEdit = value !== activeDoc.content;
  const sectionNames = parseSectionNames(value);

  const toggleSectionSignal = (name: string, signal: "keep" | "rewrite") => {
    setSectionSignals((current) => {
      const next = { ...current };
      const wasAlreadyThisSignal = next[name] === signal;
      if (wasAlreadyThisSignal) delete next[name];
      else next[name] = signal;
      if (!wasAlreadyThisSignal && signal === "rewrite") {
        onSectionThumbsDown?.(activeDoc.type, name);
      }
      return next;
    });
  };

  const confirmRegenerate = () => {
    onRegenerate?.(activeDoc.type, {
      originalContent: activeDoc.content,
      editedContent: value,
      comment: regenerateComment.trim() || undefined,
      sectionSignals: Object.keys(sectionSignals).length > 0 ? sectionSignals : undefined,
    });
    setConfirmingRegenerate(false);
    setRegenerateComment("");
    setSectionSignals({});
  };

  return (
    <section className="card" aria-label="Generated output">
      <div className="tabs" role="tablist" aria-label="Document segments">
        {documents.map((doc) => (
          <button
            key={doc.type}
            className="tabs__tab"
            role="tab"
            aria-selected={doc.type === activeDoc.type}
            onClick={() => selectTab(doc.type)}
          >
            {doc.type}
          </button>
        ))}
      </div>
      {hasEdit && (
        <div className="output-view__regenerate">
          {regenerateFallbackFor === activeDoc.type && (
            <p className="alert alert--info" role="status">
              Regeneration with feedback wasn't available - showing the standard fallback instead.
            </p>
          )}
          {!confirmingRegenerate && (
            <button
              className="btn btn--secondary"
              type="button"
              onClick={() => setConfirmingRegenerate(true)}
              disabled={pending}
            >
              Regenerate with my edits
            </button>
          )}
          {confirmingRegenerate && (
            <div className="output-view__regenerate-confirm">
              <label className="field">
                What would you like different? (optional)
                <textarea
                  className="field__control"
                  aria-label="What would you like different?"
                  value={regenerateComment}
                  onChange={(e) => setRegenerateComment(e.target.value)}
                />
              </label>
              {sectionNames.length > 0 && (
                <fieldset className="field-group" aria-label="Section feedback">
                  <legend className="field-group__legend">Section feedback (optional)</legend>
                  <div className="output-view__section-signals">
                    {sectionNames.map((name) => (
                      <div className="output-view__section-signal" key={name}>
                        <span>{name}</span>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          aria-label={`Keep ${name} as-is`}
                          aria-pressed={sectionSignals[name] === "keep"}
                          onClick={() => toggleSectionSignal(name, "keep")}
                        >
                          👍
                        </button>
                        <button
                          type="button"
                          className="btn btn--ghost"
                          aria-label={`Rewrite ${name} from scratch`}
                          aria-pressed={sectionSignals[name] === "rewrite"}
                          onClick={() => toggleSectionSignal(name, "rewrite")}
                        >
                          👎
                        </button>
                      </div>
                    ))}
                  </div>
                </fieldset>
              )}
              <div className="output-view__regenerate-actions">
                <button className="btn btn--primary" type="button" onClick={confirmRegenerate} disabled={pending}>
                  {pending ? "Regenerating…" : "Confirm regenerate"}
                </button>
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => setConfirmingRegenerate(false)}
                  disabled={pending}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div className="output-view__panes">
        <div className="output-view__pane">
          <p className="output-view__pane-label">Edit</p>
          <textarea
            className="output-view__editor"
            aria-label={`${activeDoc.type} content`}
            value={value}
            onChange={(e) => onEdit(e.target.value)}
            rows={16}
          />
        </div>
        <div className="output-view__pane">
          <p className="output-view__pane-label">Preview</p>
          <div
            className="output-view__preview"
            aria-label={`${activeDoc.type} preview`}
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
        </div>
      </div>
    </section>
  );
}

