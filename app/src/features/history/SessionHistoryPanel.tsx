import { useState, type JSX } from "react";
import {
  clearLearnedPreferences,
  loadSessionMemoryStore,
  type SessionRecord,
} from "../../generation/sessionMemory";

/** "pr_faq" -> "Pr Faq" - matches GenerationProfileScreen's display convention. */
function humanize(value: string): string {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function SessionRow({ session }: { session: SessionRecord }): JSX.Element {
  const docTypes = Object.keys(session.perDocType);
  return (
    <details className="session-history__row">
      <summary className="session-history__row-summary">
        <span>{new Date(session.timestamp).toLocaleString()}</span>
        <span>{session.productTitle}</span>
        {docTypes.map((docType) => {
          const fields = session.perDocType[docType as keyof typeof session.perDocType];
          return (
            <span className="checkbox" key={docType}>
              {docType}: {fields ? humanize(fields.format) : ""}
            </span>
          );
        })}
      </summary>
      <dl className="session-history__detail">
        {docTypes.map((docType) => {
          const fields = session.perDocType[docType as keyof typeof session.perDocType];
          if (!fields) return null;
          return (
            <div key={docType}>
              <dt>{docType}</dt>
              <dd>
                Template: {humanize(fields.format)} · Mode: {humanize(fields.generationMode)} · Depth:{" "}
                {humanize(fields.requirementDepth)} · Decomposition: {humanize(fields.requirementDecomposition)} ·
                Innovation: {humanize(fields.innovationAssistance)} · Audience: {humanize(fields.targetAudience)} ·
                Edited sections: {fields.editedSectionCount} · Thumbs down: {fields.thumbsDownSectionCount}
              </dd>
            </div>
          );
        })}
        <div>
          <dt>Assumption Strategy</dt>
          <dd>{humanize(session.assumptionStrategy)}</dd>
        </div>
      </dl>
    </details>
  );
}

/** "Your generation history" panel (docs/Enhancements4.md §3.8, docs/EnhancementToDo3.md §11
 * task 3) - read-only, local-only; includes the "Clear my learned preferences" control (§3.7). */
export function SessionHistoryPanel(): JSX.Element {
  const [store, setStore] = useState(() => loadSessionMemoryStore());

  const refresh = () => setStore(loadSessionMemoryStore());

  const onClear = () => {
    clearLearnedPreferences();
    refresh();
  };

  const sessions = [...store.sessions].reverse();

  return (
    <details className="session-history" data-testid="session-history-panel" onToggle={refresh}>
      <summary className="session-history__toggle">Your generation history</summary>
      <div className="session-history__body">
        {sessions.length === 0 ? (
          <p>No generations recorded yet.</p>
        ) : (
          <ul className="session-history__list">
            {sessions.map((session) => (
              <li key={session.id}>
                <SessionRow session={session} />
              </li>
            ))}
          </ul>
        )}
        <button className="btn btn--ghost" type="button" onClick={onClear}>
          Clear my learned preferences
        </button>
      </div>
    </details>
  );
}
