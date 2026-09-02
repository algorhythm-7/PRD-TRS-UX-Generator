import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_SESSIONS,
  SESSION_MEMORY_KEY,
  appendSessionRecord,
  clearLearnedPreferences,
  consolidateAssumptionStrategy,
  consolidatePerDocTypeField,
  consolidateTraceabilityFlag,
  loadSessionMemoryStore,
  type SessionRecord,
} from "../../src/generation/sessionMemory";

function makeSession(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    productTitle: "Acme",
    perDocType: {
      PRD: {
        format: "standard",
        generationMode: "product_management",
        requirementDepth: "standard_engineering",
        requirementDecomposition: "functional_requirement",
        innovationAssistance: "disabled",
        targetAudience: "product",
        editedSectionCount: 0,
        thumbsDownSectionCount: 0,
      },
    },
    assumptionStrategy: "balanced",
    traceability: { generateIds: false, requirementMapping: false, verificationReferences: false },
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("loadSessionMemoryStore", () => {
  it("returns an empty store when nothing is stored", () => {
    expect(loadSessionMemoryStore()).toEqual({ version: 1, sessions: [] });
  });

  it("returns an empty store when the stored value is corrupted JSON", () => {
    localStorage.setItem(SESSION_MEMORY_KEY, "{not valid json");
    expect(loadSessionMemoryStore()).toEqual({ version: 1, sessions: [] });
  });

  it("returns an empty store when the stored value has an unexpected shape", () => {
    localStorage.setItem(SESSION_MEMORY_KEY, JSON.stringify({ foo: "bar" }));
    expect(loadSessionMemoryStore()).toEqual({ version: 1, sessions: [] });
  });

  it("returns an empty store (never throws) when localStorage.getItem throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("private browsing");
    });
    expect(loadSessionMemoryStore()).toEqual({ version: 1, sessions: [] });
    vi.restoreAllMocks();
  });
});

describe("appendSessionRecord", () => {
  it("stores a record, retrievable via loadSessionMemoryStore", () => {
    const record = makeSession();
    appendSessionRecord(record);
    expect(loadSessionMemoryStore().sessions).toEqual([record]);
  });

  it("evicts the oldest record (FIFO) once more than MAX_SESSIONS have been appended", () => {
    for (let i = 0; i < MAX_SESSIONS + 1; i += 1) {
      appendSessionRecord(makeSession({ id: `session-${i}` }));
    }
    const { sessions } = loadSessionMemoryStore();
    expect(sessions).toHaveLength(MAX_SESSIONS);
    expect(sessions[0].id).toBe("session-1");
    expect(sessions[sessions.length - 1].id).toBe(`session-${MAX_SESSIONS}`);
  });

  it("never throws (best-effort only) when localStorage.setItem throws", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    expect(() => appendSessionRecord(makeSession())).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("clearLearnedPreferences", () => {
  it("deletes the storage key entirely", () => {
    appendSessionRecord(makeSession());
    clearLearnedPreferences();
    expect(localStorage.getItem(SESSION_MEMORY_KEY)).toBeNull();
    expect(loadSessionMemoryStore()).toEqual({ version: 1, sessions: [] });
  });

  it("never throws when localStorage.removeItem throws", () => {
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("unavailable");
    });
    expect(() => clearLearnedPreferences()).not.toThrow();
    vi.restoreAllMocks();
  });
});

describe("consolidatePerDocTypeField", () => {
  it("returns undefined when no session has a value for that docType", () => {
    expect(consolidatePerDocTypeField([], "PRD", "format")).toBeUndefined();
    expect(consolidatePerDocTypeField([makeSession({ perDocType: {} })], "PRD", "format")).toBeUndefined();
  });

  it("picks the recency-weighted majority value with the correct confidence", () => {
    // oldest -> newest: standard, standard, volere (decay=0.9, N=3)
    // weights: 0.81, 0.9, 1.0 -> score(standard)=1.71, score(volere)=1.0, total=2.71
    const sessions = [
      makeSession({ perDocType: { PRD: { ...makeSession().perDocType.PRD!, format: "standard" } } }),
      makeSession({ perDocType: { PRD: { ...makeSession().perDocType.PRD!, format: "standard" } } }),
      makeSession({ perDocType: { PRD: { ...makeSession().perDocType.PRD!, format: "volere" } } }),
    ];
    const result = consolidatePerDocTypeField(sessions, "PRD", "format");
    expect(result?.value).toBe("standard");
    expect(result?.confidence).toBeCloseTo(1.71 / 2.71, 5);
    expect(result?.conflict).toBe(false);
  });

  it("flags a conflict when the top value's confidence is low (near-even split)", () => {
    const sessions = [
      makeSession({ perDocType: { PRD: { ...makeSession().perDocType.PRD!, format: "standard" } } }),
      makeSession({ perDocType: { PRD: { ...makeSession().perDocType.PRD!, format: "volere" } } }),
    ];
    const result = consolidatePerDocTypeField(sessions, "PRD", "format");
    expect(result?.confidence).toBeLessThan(0.6);
    expect(result?.conflict).toBe(true);
  });

  it("does not flag a conflict when one value dominates", () => {
    const sessions = Array.from({ length: 5 }, () =>
      makeSession({ perDocType: { PRD: { ...makeSession().perDocType.PRD!, format: "standard" } } }),
    ).concat(makeSession({ perDocType: { PRD: { ...makeSession().perDocType.PRD!, format: "volere" } } }));
    const result = consolidatePerDocTypeField(sessions, "PRD", "format");
    expect(result?.value).toBe("standard");
    expect(result?.conflict).toBe(false);
  });
});

describe("consolidateAssumptionStrategy / consolidateTraceabilityFlag", () => {
  it("consolidates the global assumptionStrategy field across sessions", () => {
    const sessions = [
      makeSession({ assumptionStrategy: "strict" }),
      makeSession({ assumptionStrategy: "strict" }),
    ];
    expect(consolidateAssumptionStrategy(sessions)?.value).toBe("strict");
  });

  it("consolidates each traceability flag independently", () => {
    const sessions = [
      makeSession({ traceability: { generateIds: true, requirementMapping: false, verificationReferences: false } }),
      makeSession({ traceability: { generateIds: true, requirementMapping: true, verificationReferences: false } }),
    ];
    expect(consolidateTraceabilityFlag(sessions, "generateIds")?.value).toBe(true);
    expect(consolidateTraceabilityFlag(sessions, "verificationReferences")?.value).toBe(false);
  });

  it("returns undefined for an empty session list", () => {
    expect(consolidateAssumptionStrategy([])).toBeUndefined();
    expect(consolidateTraceabilityFlag([], "generateIds")).toBeUndefined();
  });
});
