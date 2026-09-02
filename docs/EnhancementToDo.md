# Enhancement To-Do - Builder Tracking

> **⚠️ SUPERSEDED by `docs/EnhancementToDo2.md`.** This tracked the OpenRouter-backed design,
> which was scrapped in favor of an internal Calypso-backed design. Kept only as historical
> record - do not resume work from this file.

Tracks execution of `docs/EnhancementBuildPlan.md`. Updated as work progresses. "Done" means
implemented **and** validated (lint/tsc/build/test as applicable), not just written.

## Scope note (read first)

**Architecture pivot (see `docs/EnhancementBuildPlan.md`'s Revision section):** the LLM routes are
now implemented directly in this app's own `server.mjs`/`vite.config.ts` - there is no separate
XYZ service, no OAuth wiring, and nothing left to deploy separately. The only remaining external
steps are picking OpenRouter model candidates and getting the real `OPENROUTER_API_KEY` (both are
the user's own follow-up, tracked as task 10).

Until `OPENROUTER_API_KEY`/`OPENROUTER_MODEL_CANDIDATES` are set on this app's XYZ secrets,
`/_api/gap-analysis` and `/_api/generate` correctly return `503 { "error": "LLM_UNAVAILABLE" }`
(verified) - this is expected and is exactly the condition that exercises the
deterministic-fallback cascade end-to-end.

## Tasks

- [x] 1. Extend `app/src/generation/contract.ts` - additive `answers`/`clarifications` fields,
      `ClarificationQuestion`, `GapAnalysisResponse` types (validated: `tsc -b` clean)
- [x] 2. Create `app/src/generation/sectionSchema.ts` - `sectionNamesFor(docType)`,
      `buildGeneratedDocument(productTitle, docType, sections)` (exact heading/title parity with
      `prdGen.ts`/`trsGen.ts`/`uxGen.ts`) (validated: `tsc -b` clean)
- [x] 3. Create `app/src/api/llmClient.ts` - `postGapAnalysis`, `postGenerate`, timeout via
      `AbortController`, typed errors on non-2xx/timeout (validated: `tsc -b` clean)
- [x] 4. Create `app/src/generation/llmGenService.ts` - `runGapAnalysis` (fail-open),
      `runGeneration` (per-DocType, falls back to local deterministic generator on any failure,
      tags `source: "llm" | "fallback"`) (validated: `tsc -b`, lint, build clean)
- [x] 5. Extend `app/src/features/input/InputForm.tsx` with the guided questions (plan section 7);
      create `app/src/features/input/ClarificationQuestions.tsx` (validated: `tsc -b`, lint, build
      clean)
- [x] 6. Wire `app/src/App.tsx`: gap-analysis -> clarifications (if any) -> generation, fallback
      notice per document (validated: `tsc -b`, lint, build clean; also added `source` field to
      `GeneratedDocument` in `contract.ts` as a small necessary addition, additive/optional)
- [x] 7. Add/extend tests: mock `api/llmClient.ts`, cover gap-analysis failure (fail-open),
      per-DocType fallback, `sectionSchema.ts` heading/order regression. Added
      `tests/generation/sectionSchema.test.ts` (3 tests: tuple parity, PRD/TRS numbered-heading
      order, UX unnumbered-heading order) and `tests/generation/llmGenService.test.ts` (5 tests:
      gap-analysis success/fail-open, per-type LLM success, per-type fallback, independence
      between two DocTypes) - both mock `api/llmClient.ts`, never touch the network
- [x] 8. Run the full gate: `npm run lint`, `tsc -b`, `npm run build`, `npm test` - all green
      (18 test files / 40 tests passing)
- [x] 9. Manual verification in `npm run dev` - confirmed live in a real browser: both
      `/_api/gap-analysis` and `/_api/generate` are attempted and fail (`ECONNREFUSED`, no backend
      running), gap-analysis fails open silently, generation falls back to the deterministic
      generator with byte-correct PRD content, and the `role="status"` fallback notice
      ("Generated using the offline fallback (AI service unavailable).") renders correctly.
      Export buttons remain present and functional
- [x] 10a. **OAuth clarified and skipped:** it's service-to-service (M2M) auth between this app's
       server and a separate backend, not end-user login - moot now that there is no separate
       backend. No code needed either way; the template's own proxy already works with or without
       it configured.
- [x] 10b. **Backend integrated into this same app** (per your direction, superseding the original
       separate-service design): added self-contained LLM logic directly to `app/server.mjs`
       (production - required, since the Dockerfile only copies `server.mjs` into the runtime
       image, not the rest of `app/`) and a matching dev-only Vite plugin in `app/vite.config.ts`
       (duplicated intentionally, not imported, to avoid `server.mjs`'s side-effecting
       `app.listen()` and to respect the same Dockerfile constraint). Both register
       `/_api/gap-analysis` and `/_api/generate` before the generic `/_api` proxy. Validated:
       `tsc -b`, lint, `node --check server.mjs`, and live manual verification in the browser -
       both routes now return a clean `503 { "error": "LLM_UNAVAILABLE" }` (confirmed in server
       logs and the browser network tab) instead of the previous raw proxy `ECONNREFUSED`, and the
       deterministic fallback still renders correctly
- [x] 10c. **Re-validated the full gate after the pivot** (`server.mjs`/`vite.config.ts` changed):
       `npm run lint` clean, `tsc -b` clean, `npm run build` succeeded, `npm test` -> 18 test
       files / 40 tests all passing. Confirmed via `git status`/`git diff --stat` that
       `docker-bake.hcl`, `docker/`, `deployment/`, `app/package.json`, and
       `app/package-lock.json` are untouched - the OpenRouter calls use Node's built-in `fetch`,
       no new dependency was needed
- [ ] 10d. *(Your follow-up, not part of this session)* Pick real OpenRouter model candidates
       (plan section 5) and add `OPENROUTER_API_KEY` (+ optionally `OPENROUTER_MODEL_CANDIDATES`,
       `OPENROUTER_BASE_URL`, `LLM_REQUEST_TIMEOUT_MS`) to **this app's** XYZ Secrets once your
       manager provides the key - no code changes needed for this step; this is the only
       remaining item before the LLM path returns real (non-fallback) content in production
- [ ] 11. *(Deferred until the above ships)* Update `docs/ArchitectureUpdated.md` and
       `docs/FlowUpdated.md`
- [x] 12. **CSS/visual design pass, dark navy-blue theme** for the whole UI (both the LLM path and
       the deterministic-fallback path render through the same components, so one pass covers
       both):
       - `theme/tokens.ts`: retuned the existing dark palette to a navy-blue scheme
         (`bgBase`/`bgSurface`/`bgElevated` now deep navy, `accent` a clean blue `#4c8dff`,
         `accentContrast` white) - same token names/shape, so nothing importing `darkTokens`
         needed to change
       - `index.css`: minimal global reset (box-sizing, margins, selection color)
       - `App.css` (previously empty, never imported): full component stylesheet - cards, buttons
         (`btn--primary`/`secondary`/`ghost`), form fields, pill-style checkboxes, tabs, the
         monospace output editor, and `alert`/`alert--error`/`alert--info` (used for both
         validation errors and the fallback notice, styled distinctly via a colored left border)
       - `main.tsx`: added the two missing `import "./index.css"` / `import "./App.css"` (neither
         file was ever imported before this - the app had zero CSS applied beyond the
         theme-provider's inline token `<style>` block)
       - Added `className`s (no behavior/markup-semantics changes - same elements, same
         aria-labels/roles) to `AppShell.tsx`, `HelpPanel.tsx`, `InputForm.tsx`, `OutputView.tsx`,
         `ExportControls.tsx`, `ClarificationQuestions.tsx`, `App.tsx`
       - Validated: `tsc -b` clean, `npm run lint` clean, `npm test` -> 18 files / 40 tests still
         passing unchanged (dark-theme contrast-ratio test still passes: new palette keeps
         `textPrimary`/`bgBase` contrast far above the 4.5 AA threshold). Manually verified in a
         real browser: input form, pill checkboxes, guided questions, generate ->
         deterministic-fallback content, the blue-accented `status` fallback notice, active-tab
         highlighting, and export buttons all render cleanly with the new theme

## Commit checkpoints

I will tell you explicitly when a checkpoint is validated and a commit makes sense - not before.
