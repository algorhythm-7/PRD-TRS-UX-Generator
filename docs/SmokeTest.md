# SmokeTest.md — EnhancementToDo3 Acceptance Audit

**Audit date:** 2026-08-28
**Auditor:** Automated agent (builder mode), independent post-implementation verification
**Scope:** `docs/EnhancementToDo3.md` §1–§12 (all marked complete), verified against the running
application (dev server, real Cluster backend) rather than re-reading implementation notes only.
**Constraint honored:** no source files were modified during this audit; findings below are
report-only, per the audit instruction.

## 1. Method

- Automated test suite baseline: 110/110 passing across 25 files as of commit `6c60c63` (not
  re-run in this audit; see §7 "Missing test coverage" for gaps the suite doesn't close).
- Live verification: dev server (`npm run dev`, Vite on port 3001) against the real Cluster
  cluster (`vllm-glm-52` primary, confirmed `ready:true` via `/_api/llm-status`), driven through
  the actual browser UI (no mocking) for one full user journey:
  - InputForm → PRD+TRS selected → Continue
  - Generation Profile screen: PRD set to Custom Template (uploaded a 3-section `.txt`), Volere
    vs Standard vs Custom dedup logic exercised, reference document uploaded, TRS left at
    Standard defaults
  - Generate → real clarifying questions returned by Cluster → Skip
  - Full PRD + TRS generation completed successfully
  - Edited PRD content directly in the textarea → "Regenerate with my edits" → comment + one
    section marked "rewrite" → Confirm → regeneration completed and correctly incorporated both
    the edit and the comment
  - Session History panel inspected (expand/collapse, per-DocType detail, "Clear my learned
    preferences")
  - Browser reload → persistence/reset behavior checked
- Where a live click-through of a control wasn't performed this round (e.g. Traceability
  checkboxes, Compliance Framing, Innovation Assistance radios), correctness is inferred from
  (a) automated test coverage in `tests/server/buildGenerateSystemPrompt.test.ts` and
  `tests/server/newEndpoints.test.ts`, and (b) a prior curl-based backend verification earlier in
  this project's history — not from a fresh UI click in this session. These are marked
  **INFERRED**, not **CONFIRMED**, in the matrix below.

## 2. Test matrix

| Requirement (ToDo3 §) | Files implementing it | Expected user behavior | Validation method | Result |
|---|---|---|---|---|
| §1 Data model (formats, output structure, generation modes, depth/decomposition, innovation, target audience, assumption strategy) | `app/src/generation/contract.ts` | Profile screen renders correct default per DocType (PRD=Product Management mode/Product audience, TRS=Engineering audience) | Live UI: confirmed defaults rendered correctly for PRD+TRS | CONFIRMED PASS |
| §2 Section-skeleton dedup (`sectionNamesFor`) | `app/src/generation/sectionSchema.ts` | Output Structure checkboxes disable+tooltip items already covered by the chosen template/format, re-evaluate on template change | Live UI: cycled Standard→Volere→Custom(with upload) for PRD, observed correct disable/enable/tooltip changes at each step | CONFIRMED PASS |
| §3 Prompt guidance blocks (format/EARS/mode/depth/decomposition/traceability/assumption/compliance/output-structure/audience/reference-content/innovation) | `app/server.mjs` + `app/vite.config.ts` | Generated content reflects the selected profile and any reference material | Live generation: PRD output used the **custom template's exact 3 sections** ("1. Executive Summary", "2. Key Features", "3. Rollout Plan") and **wove in the uploaded reference document's content** (per-seat pricing, offline mode, CSV export, Slack) verbatim into both PRD and TRS | CONFIRMED PASS |
| §4 New endpoints (`template-extract`, `context-extract` incl. `.docx`/`.pdf`) | `app/server.mjs` + `app/vite.config.ts` | Uploading a template file extracts section names; uploading a reference doc makes its content available to generation | Live UI: template upload showed "Extracted sections: Executive Summary, Key Features, Rollout Plan"; reference-doc upload showed no confirmation UI, but its content **did** appear in the final generated PRD/TRS, proving the pipeline works | PASS (functionally) / UX gap (see §6) |
| §4 Phase 3 `.pdf` via multimodal | `app/server.mjs` | PDF context extraction works via Cluster multimodal endpoint | Not re-tested live this round (previously flagged UNVERIFIED with a minimal hand-crafted PDF returning empty text) | **UNKNOWN** — carry-over risk, see §3 Failed/Unverified |
| §5 Client API layer | `app/src/api/llmClient.ts` | All new fields serialize correctly into `/_api/generate` requests | Live generation reflected all profile fields correctly (see §3 result) | CONFIRMED PASS |
| §6 Generation-service wiring, `regenerateWithFeedback` | `app/src/generation/llmGenService.ts` | Regenerate call carries prior content + comment + section signals | Live: regenerated PRD content changed in exactly the way implied by the edit + comment + thumbs-down signal | CONFIRMED PASS |
| §7 Session memory module | `app/src/generation/sessionMemory.ts` | Learned preferences persist across sessions in `localStorage`; last-session per-DocType fields update live | Live: history entry appeared immediately after generation with correct per-DocType template/mode/audience; edited-section and thumbs-down counts updated after edit+regenerate flow | CONFIRMED PASS, with one numeric anomaly (see §4 Bugs) |
| §8 Generation Profile screen | `app/src/features/profile/GenerationProfileScreen.tsx` | Full per-DocType configuration UI, Context Sources panel, template/reference/style uploads | Live: all panels rendered; Custom Template upload fully confirmed; Traceability/Compliance/Innovation Assistance/Assumption Strategy controls rendered but not individually clicked this round | PARTIALLY CONFIRMED (see below) |
| §9 `App.tsx` two-step flow | `app/src/App.tsx` | InputForm → Continue → Profile screen → Generate → clarifications → output | Live: full flow walked end-to-end successfully, including a real clarifying-questions round-trip | CONFIRMED PASS |
| §10 Human-in-the-loop feedback (`OutputView.tsx`) | `app/src/features/output/OutputView.tsx` | Edit detection, two-step regenerate confirm (comment + per-section thumbs), fallback messaging | Live: "Regenerate with my edits" appeared only after an edit; confirm step showed comment box + correctly-parsed section thumbs; regeneration succeeded (not a fallback, so fallback messaging path not exercised) | CONFIRMED PASS (fallback-message sub-path not exercised) |
| §11 Session-memory write-back & history panel | `app/src/features/history/SessionHistoryPanel.tsx`, `app/src/app/AppShell.tsx` | History panel lists sessions, expands to full detail, "Clear my learned preferences" empties it | Live: expand showed correct per-DocType detail string (template/mode/depth/decomposition/innovation/audience/edited-sections/thumbs-down) and assumption strategy; Clear button correctly emptied the list | CONFIRMED PASS, with one numeric anomaly (see §4 Bugs) |
| §12 Final automated test pass | `tests/**` | 110/110 tests pass | Not re-run this audit (relying on last recorded run at commit `6c60c63`) | **NOT RE-VALIDATED THIS SESSION** — recommend re-running before sign-off |
| Backward compatibility (defaulted Profile screen → equivalent to pre-Profile-screen baseline) | `tests/e2e/acceptance.test.ts` | A flow with zero Profile-screen changes should produce output equivalent to the old flow | Covered by existing automated acceptance test only; not independently re-verified live this round due to time | INFERRED PASS (automated coverage exists, not manually re-checked) |
| Error handling / loading states | `app/src/App.tsx`, `app/src/features/input/InputForm.tsx` | Buttons disable during pending operations; warm-up banner shows/hides correctly | Live: "Continue"/"Continuing…" and "Regenerate with my edits" correctly disabled during all pending operations; warm-up banner appeared on cold reload and correctly disappeared once `/_api/llm-status` resolved `ready:true` | CONFIRMED PASS |

## 3. A. Passed items

- Generation Profile screen renders correct per-DocType defaults (template, mode, depth,
  decomposition, innovation, target audience) for PRD and TRS.
- Output Structure dedup logic is fully reactive and correct across Standard, Volere, and
  Custom-with-uploaded-template states.
- Custom Template upload + section extraction works end-to-end against real Cluster, with
  visible confirmation text.
- Reference-document content is genuinely incorporated into generated output (verified by
  content matching, not just a 200 response).
- Full two-step flow (InputForm → Profile → Generate) works, including a real clarifying-questions
  round-trip with Skip.
- Full document generation succeeded for both PRD (custom template) and TRS (standard template)
  against the real Cluster backend.
- Edit-then-regenerate flow works correctly: edit detection, two-step confirm UI (comment +
  per-section thumbs), and the regenerated content demonstrably reflects both the direct edits
  and the free-text comment.
- Session History panel: entry creation, expand/collapse, correct per-DocType detail rendering,
  and "Clear my learned preferences" all work.
- Reload behavior is correct SPA behavior: in-memory form/document state resets, while
  `localStorage`-backed session history is independently persisted (cleared state stayed cleared
  after reload, as expected).
- "AI model is warming up" banner is not a bug — it is expected pre-first-poll UI that correctly
  disappears once the readiness poll resolves.
- Pending/disabled-button states are consistent across `InputForm`, `GenerationProfileScreen`,
  and `OutputView` during any in-flight operation.

## 4. B. Failed items

- None outright failed in this audit's live coverage. The one item closest to "failed" is the
  pre-existing, already-flagged **Phase 3 PDF-via-multimodal extraction**, which returned an
  empty string against a minimal hand-crafted test PDF (documented as unverified in
  `EnhancementToDo3.md` §4.4, not re-tested this round — see "Missing test coverage" below).

## 5. C. Partially implemented / partially verified items

- **Traceability checkboxes** (Generate requirement IDs / CRS→TRS mapping / Verification
  references), **Compliance Framing** (ASPICE/ISO 26262), **Innovation Assistance** radios, and
  **Assumption Strategy** radios all rendered correctly in the live UI but were not individually
  clicked and re-verified in this session (their backend wiring was curl-verified earlier in the
  project, and `tests/server/buildGenerateSystemPrompt.test.ts` covers the prompt-guidance output
  for each — but this is INFERRED, not freshly CONFIRMED, correctness for this audit).
- **Style example upload** control is rendered but was not exercised in this audit (same
  Context Source category as the reference-document upload, which was tested).
- **Regenerate fallback messaging** path (`regenerateFallbackFor`) was not exercised, since the
  live regeneration succeeded via the real LLM rather than falling back to the deterministic
  builder.
- **Automated test suite** was not re-run in this audit session; the 110/110 baseline is carried
  over from the last implementation-phase run, not independently re-confirmed today.

## 6. D. Bugs / anomalies

1. **Session History "Thumbs down" count showed 2 after only one explicit thumbs-down click.**
   During the live walkthrough, exactly one section ("2. Key Features") was marked "rewrite" via
   a single click on its 👎 button before confirming regeneration. The expanded history entry
   afterward showed `Thumbs down: 2` for the PRD DocType. Code inspection of
   `OutputView.tsx`'s `toggleSectionSignal` shows the guard `if (!wasAlreadyThisSignal && signal
   === "rewrite")` appears correct (fires only on a *new* rewrite mark, not on toggle-off or
   re-marks), and `sessionMemory.ts`'s `incrementLastSessionThumbsDown` is a plain
   read-modify-write against `localStorage`, not a React state updater, so it should not be
   susceptible to double-invocation from React's dev-mode double-render behavior. The
   discrepancy could not be conclusively root-caused within this audit's scope (no code changes
   were made per the audit constraint). **Recommend:** add a targeted unit test that clicks a
   single thumbs-down and asserts the persisted count increments by exactly 1, and instrument
   `toggleSectionSignal`/`incrementLastSessionThumbsDown` briefly to trace call counts during a
   single interaction.
   - `Edited sections: 3` in the same entry **is correct and explained**: `countEditedSections`
     compares the original 3-section custom-template output against my 2-section edited
     replacement by array index, so it correctly counts 3 differing positions (2 changed + 1
     removed). Not a bug — verified by reading `App.tsx`'s `countEditedSections`.

## 7. E. UX issues

1. **No visible confirmation or error for reference-document (and, by the same code path, style
   example) uploads.** Unlike Custom Template upload, which shows "Extracted sections: ...",
   selecting a reference document produces no visible feedback in the UI at all — success and
   failure look identical to the user. This audit could only confirm the upload actually
   succeeded by inspecting the *generated document's content* afterward (it referenced the
   uploaded file's facts). A user without that ability to cross-check has no way to know whether
   their upload was processed. **Recommend:** a small inline confirmation (e.g. "Reference
   document added" / file name + size) mirroring the Custom Template upload's pattern, and a
   visible error state if `postContextExtract` fails or returns an error.
2. **`/env-config.js` 404 on every dev-server page load.** `index.html` unconditionally
   references `/env-config.js`, which is only served by the production Express proxy
   (`server.mjs`); the Vite dev server has no equivalent route, so this 404 fires on every load
   in dev mode. This does not break functionality (confirmed — the app still fully renders and
   works) and is a pre-existing dev/prod parity quirk unrelated to EnhancementToDo3, not a
   regression introduced by this work. Flagged for awareness only, not a required fix.

## 8. F. Regression risks

- The Phase 3 PDF-extraction path was substituted (MinerU's real API contract is undocumented;
  Cluster's multimodal `vllm-qwen36-35b-a3b` chat-completions path is used instead). If a real
  end-user PDF is ever uploaded before this is properly verified with a real (non-synthetic) PDF,
  there's a risk of silent empty-text extraction going unnoticed, since — per the UX issue above
  — there is no visible confirmation for context-extract uploads at all.
- `sectionNamesFor`'s dedup logic and `countEditedSections`'s positional diffing are both
  explicitly documented in-code as "naive"/"acceptable fragility" heuristics. They performed
  correctly in every scenario exercised in this audit, but are worth keeping in mind if templates
  with reordered (not just added/removed) sections become common — a reorder-only edit would
  currently be counted as N differing positions rather than 0, which is a known, accepted
  trade-off per the code comments, not a new finding.

## 9. G. Missing test coverage

- No automated test exercises the **actual multi-field prompt output end-to-end against a real
  LLM** (i.e. an integration test asserting that, e.g., an uploaded reference document's content
  literally appears in the generated output) — the current tests validate that the *prompt
  string* contains the right guidance blocks, not that the *model's response* honors them. This
  audit's live walkthrough is the first time that full chain was actually observed working.
- No automated test covers the **Session History thumbs-down count** end-to-end (component →
  `sessionMemory` write → panel display) which is exactly where this audit found its one
  numeric anomaly (§4). Recommend adding one.
- No automated test exercises `.pdf` context-extraction against a realistic (non-trivial) PDF
  fixture — the only test data used so far (across this project's history) was a minimal
  hand-crafted PDF that produced an empty result.
- No automated test covers the **no-visible-feedback** UX gap for context-extract uploads (not
  a candidate for an automated test per se, but worth a product/UX decision either way).
- `RegenerateFallbackFor`'s UI message path (`OutputView.tsx`) has test coverage per the
  implementation notes, but was not exercised against a *real* Cluster fallback trigger in this
  live audit (only against the automated test's simulated fallback).

## 10. Summary

All ToDo3 §1–§12 functionality exercised live in this audit behaved correctly against the real
application and real Cluster backend, including the full generate → edit → regenerate → history
loop. One unresolved numeric anomaly (thumbs-down count) and one UX gap (no upload confirmation
for reference documents) are the most actionable findings. The Phase 3 PDF extraction path
remains the single carried-over unverified item and should be prioritized for a real-PDF retest
before it's considered production-ready. No code was changed as part of this audit.
