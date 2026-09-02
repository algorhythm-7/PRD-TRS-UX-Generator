import type {
  AssumptionStrategy,
  DocType,
  DocumentFormatId,
  InnovationAssistance,
  RequirementDecomposition,
  RequirementDepth,
  TargetAudience,
} from "./contract";

/** docs/Enhancements4.md §3.1 - namespaced, versioned localStorage key for forward compatibility. */
export const SESSION_MEMORY_KEY = "prd-gen:session-memory:v1";

/** docs/Enhancements4.md §3.7 - `sessions` is capped at the most recent 20 records (FIFO). */
export const MAX_SESSIONS = 20;

/** docs/Enhancements4.md §3.3 - most recent session counts ~2.5x a session from 10 generations ago. */
const DECAY = 0.9;
/** docs/Enhancements4.md §3.4 - below this confidence, the top value is flagged as a conflict. */
const LOW_CONFIDENCE_THRESHOLD = 0.6;
/** docs/Enhancements4.md §3.4 - top-two within this margin of each other is also a conflict. */
const NEAR_TIE_MARGIN = 0.15;

/** docs/Enhancements4.md §3.2 - per-DocType fields recorded per session. Counts are feedback
 * signals only (§3.5) - deliberately excluded from consolidation (§3.3's own field list). */
export interface PerDocTypeSessionFields {
  format: DocumentFormatId;
  generationMode: string;
  requirementDepth: RequirementDepth;
  requirementDecomposition: RequirementDecomposition;
  innovationAssistance: InnovationAssistance;
  targetAudience: TargetAudience;
  editedSectionCount: number;
  thumbsDownSectionCount: number;
}

/** docs/Enhancements4.md §3.2 - one completed generation. Deliberately excludes free-text
 * comments and edited content itself (see §3.2's own scoping-limit note) - only structured
 * choices and feedback counts are recorded. */
export interface SessionRecord {
  id: string;
  timestamp: string;
  productTitle: string;
  perDocType: Partial<Record<DocType, PerDocTypeSessionFields>>;
  assumptionStrategy: AssumptionStrategy;
  traceability: {
    generateIds: boolean;
    requirementMapping: boolean;
    verificationReferences: boolean;
  };
}

export interface SessionMemoryStore {
  version: 1;
  sessions: SessionRecord[];
}

const EMPTY_STORE: SessionMemoryStore = { version: 1, sessions: [] };

function isValidStore(value: unknown): value is SessionMemoryStore {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as SessionMemoryStore).version === 1 &&
    Array.isArray((value as SessionMemoryStore).sessions)
  );
}

/** docs/Enhancements4.md §9 - `localStorage` may be unavailable (private browsing) or contain
 * corrupted/foreign data; every caller must be able to treat "no sessions" as fully valid. */
export function loadSessionMemoryStore(): SessionMemoryStore {
  try {
    const raw = localStorage.getItem(SESSION_MEMORY_KEY);
    if (!raw) return EMPTY_STORE;
    const parsed: unknown = JSON.parse(raw);
    return isValidStore(parsed) ? parsed : EMPTY_STORE;
  } catch {
    return EMPTY_STORE;
  }
}

/** Appends a session, evicting the oldest beyond `MAX_SESSIONS` (§3.7). Best-effort: a failed
 * write (quota exceeded, `localStorage` unavailable) is silently swallowed, same as `docs/
 * Enhancements4.md` §9 requires for reads. */
export function appendSessionRecord(record: SessionRecord): void {
  try {
    const { sessions } = loadSessionMemoryStore();
    const next: SessionMemoryStore = { version: 1, sessions: [...sessions, record].slice(-MAX_SESSIONS) };
    localStorage.setItem(SESSION_MEMORY_KEY, JSON.stringify(next));
  } catch {
    // Best-effort only - a failed write is not user-facing (docs/Enhancements4.md §9).
  }
}

/** docs/Enhancements4.md §3.7 - user-facing privacy control; deletes the key entirely. */
export function clearLearnedPreferences(): void {
  try {
    localStorage.removeItem(SESSION_MEMORY_KEY);
  } catch {
    // Best-effort only.
  }
}

/** docs/Enhancements4.md §3.2/§9's counts - updated live as the user edits/thumbs-downs the most
 * recently written session's output, since that write already happened (right after generation
 * completed, per §11 task 1) before any such feedback could exist. Best-effort/no-op if there is
 * no last session or it has no entry for `docType` (e.g. deterministic-fallback-only docType). */
function updateLastSessionPerDocType(
  docType: DocType,
  patch: (fields: PerDocTypeSessionFields) => PerDocTypeSessionFields,
): void {
  try {
    const { sessions } = loadSessionMemoryStore();
    if (sessions.length === 0) return;
    const lastIndex = sessions.length - 1;
    const existing = sessions[lastIndex].perDocType[docType];
    if (!existing) return;
    const next = [...sessions];
    next[lastIndex] = {
      ...next[lastIndex],
      perDocType: { ...next[lastIndex].perDocType, [docType]: patch(existing) },
    };
    localStorage.setItem(SESSION_MEMORY_KEY, JSON.stringify({ version: 1, sessions: next }));
  } catch {
    // Best-effort only.
  }
}

export function setLastSessionEditedSectionCount(docType: DocType, editedSectionCount: number): void {
  updateLastSessionPerDocType(docType, (fields) => ({ ...fields, editedSectionCount }));
}

export function incrementLastSessionThumbsDown(docType: DocType): void {
  updateLastSessionPerDocType(docType, (fields) => ({
    ...fields,
    thumbsDownSectionCount: fields.thumbsDownSectionCount + 1,
  }));
}

export interface ConsolidatedField<T> {
  value: T;
  confidence: number;
  /** docs/Enhancements4.md §3.4 - low confidence or a near-tie; still applied, just flagged. */
  conflict: boolean;
}

/** docs/Enhancements4.md §3.3 - recency-weighted frequency vote. `values` must already be in
 * chronological (oldest-first) order, matching how sessions are appended/stored. */
function weightedVote<T extends string | boolean>(values: T[]): ConsolidatedField<T> | undefined {
  const n = values.length;
  if (n === 0) return undefined;
  const scores = new Map<T, number>();
  values.forEach((value, i) => {
    const weight = DECAY ** (n - 1 - i);
    scores.set(value, (scores.get(value) ?? 0) + weight);
  });
  const total = [...scores.values()].reduce((sum, score) => sum + score, 0);
  const ranked = [...scores.entries()]
    .map(([value, score]) => ({ value, confidence: score / total }))
    .sort((a, b) => b.confidence - a.confidence);
  const [top, runnerUp] = ranked;
  const conflict =
    top.confidence < LOW_CONFIDENCE_THRESHOLD ||
    (runnerUp !== undefined && top.confidence - runnerUp.confidence < NEAR_TIE_MARGIN);
  return { value: top.value, confidence: top.confidence, conflict };
}

/** docs/Enhancements4.md §3.3's per-DocType field list - editedSectionCount/thumbsDownSectionCount
 * are deliberately excluded (feedback counts only, per §3.5's taxonomy table). */
export type ConsolidatablePerDocTypeField =
  | "format"
  | "generationMode"
  | "requirementDepth"
  | "requirementDecomposition"
  | "innovationAssistance"
  | "targetAudience";

export function consolidatePerDocTypeField<K extends ConsolidatablePerDocTypeField>(
  sessions: SessionRecord[],
  docType: DocType,
  field: K,
): ConsolidatedField<PerDocTypeSessionFields[K]> | undefined {
  const values = sessions
    .map((session) => session.perDocType[docType]?.[field])
    .filter((value): value is PerDocTypeSessionFields[K] => value !== undefined);
  return weightedVote(values);
}

export function consolidateAssumptionStrategy(
  sessions: SessionRecord[],
): ConsolidatedField<AssumptionStrategy> | undefined {
  return weightedVote(sessions.map((session) => session.assumptionStrategy));
}

export type TraceabilityFlagName = keyof SessionRecord["traceability"];

export function consolidateTraceabilityFlag(
  sessions: SessionRecord[],
  flag: TraceabilityFlagName,
): ConsolidatedField<boolean> | undefined {
  return weightedVote(sessions.map((session) => session.traceability[flag]));
}
