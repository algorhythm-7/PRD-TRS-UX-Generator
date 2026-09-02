// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionHistoryPanel } from "../../src/features/history/SessionHistoryPanel";
import { SESSION_MEMORY_KEY, type SessionRecord } from "../../src/generation/sessionMemory";

const session: SessionRecord = {
  id: "s1",
  timestamp: "2026-01-01T00:00:00.000Z",
  productTitle: "Acme Widget",
  perDocType: {
    PRD: {
      format: "volere",
      generationMode: "executive_summary",
      requirementDepth: "detailed_engineering",
      requirementDecomposition: "feature",
      innovationAssistance: "suggest_missing",
      targetAudience: "customer",
      editedSectionCount: 2,
      thumbsDownSectionCount: 1,
    },
  },
  assumptionStrategy: "strict",
  traceability: { generateIds: true, requirementMapping: false, verificationReferences: false },
};

beforeEach(() => {
  localStorage.clear();
});

describe("SessionHistoryPanel", () => {
  it("shows an empty-state message when no sessions have been recorded", () => {
    render(<SessionHistoryPanel />);
    expect(screen.getByText("No generations recorded yet.")).toBeInTheDocument();
  });

  it("lists a seeded session with its product title and per-DocType chip", () => {
    localStorage.setItem(SESSION_MEMORY_KEY, JSON.stringify({ version: 1, sessions: [session] }));
    render(<SessionHistoryPanel />);
    expect(screen.getByText("Acme Widget")).toBeInTheDocument();
    expect(screen.getByText("PRD: Volere")).toBeInTheDocument();
  });

  it("expanding a row shows the full recorded profile and counts", () => {
    localStorage.setItem(SESSION_MEMORY_KEY, JSON.stringify({ version: 1, sessions: [session] }));
    render(<SessionHistoryPanel />);
    expect(screen.getByText(/Edited sections: 2/)).toBeInTheDocument();
    expect(screen.getByText(/Thumbs down: 1/)).toBeInTheDocument();
    expect(screen.getByText("Strict")).toBeInTheDocument();
  });

  it("'Clear my learned preferences' empties the store and the list", () => {
    localStorage.setItem(SESSION_MEMORY_KEY, JSON.stringify({ version: 1, sessions: [session] }));
    render(<SessionHistoryPanel />);
    fireEvent.click(screen.getByRole("button", { name: "Clear my learned preferences" }));
    expect(localStorage.getItem(SESSION_MEMORY_KEY)).toBeNull();
    expect(screen.getByText("No generations recorded yet.")).toBeInTheDocument();
  });
});
