// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutputView } from "../../src/features/output/OutputView";
import type { GeneratedDocument } from "../../src/generation/contract";

const docs: GeneratedDocument[] = [
  { type: "PRD", title: "PRD", content: "prd body" },
  { type: "TRS", title: "TRS", content: "trs body" },
];

describe("output view", () => {
  it("shows a segment only for generated types and switches between them", () => {
    // Covers COMP-OUTPUTVIEW, FR-VIEW-SEGMENTED, FR-VIEW-ONLYSELECTED, AT-VIEW-SWITCH (PR-WEB-OUTPUTVIEW).
    render(<OutputView documents={[docs[0]]} />);
    expect(screen.getByRole("tab", { name: "PRD" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "TRS" })).toBeNull();
  });

  it("retains edits when switching segments", () => {
    // Covers FR-EDIT-UPDATE, FR-EDIT-PERSISTVIEW, AT-EDIT-TEXT (PR-WEB-OUTPUTVIEW).
    render(<OutputView documents={docs} />);
    fireEvent.change(screen.getByLabelText("PRD content"), { target: { value: "edited prd" } });
    fireEvent.click(screen.getByRole("tab", { name: "TRS" }));
    fireEvent.click(screen.getByRole("tab", { name: "PRD" }));
    expect((screen.getByLabelText("PRD content") as HTMLTextAreaElement).value).toBe("edited prd");
  });

  it("replaces prior output when regenerated documents arrive", () => {
    // Covers FR-REGEN-REPLACE, AT-REGEN-UPDATE (PR-WEB-OUTPUTVIEW).
    const { rerender } = render(<OutputView documents={docs} />);
    fireEvent.change(screen.getByLabelText("PRD content"), { target: { value: "edited prd" } });
    rerender(<OutputView documents={[{ type: "PRD", title: "PRD", content: "fresh prd" }]} />);
    expect((screen.getByLabelText("PRD content") as HTMLTextAreaElement).value).toBe("fresh prd");
  });

  it("reports the active tab so a parent can keep export state in sync", () => {
    // Covers FR-VIEW-SEGMENTED (PR-WEB-OUTPUTVIEW) - regression test for the App/OutputView active-tab desync bug.
    const onActiveChange = vi.fn();
    render(<OutputView documents={docs} onActiveChange={onActiveChange} />);
    expect(onActiveChange).toHaveBeenCalledWith("PRD");
    fireEvent.click(screen.getByRole("tab", { name: "TRS" }));
    expect(onActiveChange).toHaveBeenCalledWith("TRS");
  });

  it("only shows 'Regenerate with my edits' once the content has actually been edited", () => {
    render(<OutputView documents={[docs[0]]} />);
    expect(screen.queryByRole("button", { name: "Regenerate with my edits" })).toBeNull();
    fireEvent.change(screen.getByLabelText("PRD content"), { target: { value: "edited prd" } });
    expect(screen.getByRole("button", { name: "Regenerate with my edits" })).toBeInTheDocument();
  });

  it("confirms regeneration with the original/edited content, an optional comment, and section signals", () => {
    const onRegenerate = vi.fn();
    const sectioned: GeneratedDocument = {
      type: "PRD",
      title: "PRD",
      content: "## Summary\nOld summary\n## Risks\nOld risks",
    };
    render(<OutputView documents={[sectioned]} onRegenerate={onRegenerate} />);
    fireEvent.change(screen.getByLabelText("PRD content"), {
      target: { value: "## Summary\nNew summary\n## Risks\nOld risks" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Regenerate with my edits" }));
    fireEvent.change(screen.getByLabelText("What would you like different?"), {
      target: { value: "Make it punchier" },
    });
    fireEvent.click(screen.getByLabelText("Rewrite Summary from scratch"));
    fireEvent.click(screen.getByRole("button", { name: "Confirm regenerate" }));
    expect(onRegenerate).toHaveBeenCalledWith("PRD", {
      originalContent: sectioned.content,
      editedContent: "## Summary\nNew summary\n## Risks\nOld risks",
      comment: "Make it punchier",
      sectionSignals: { Summary: "rewrite" },
    });
  });

  it("shows a distinguishing message when the last regeneration for the active DocType fell back", () => {
    render(<OutputView documents={[docs[0]]} regenerateFallbackFor="PRD" />);
    fireEvent.change(screen.getByLabelText("PRD content"), { target: { value: "edited prd" } });
    expect(
      screen.getByText("Regeneration with feedback wasn't available - showing the standard fallback instead."),
    ).toBeInTheDocument();
  });
});
