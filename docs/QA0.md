# QA0 — Pre-Implementation Codebase Audit

> Audit basis: static read-only inspection of the repository as of 2026-08-23.
> Findings are marked **CONFIRMED** (directly observed in code/tests), **INFERRED**
> (reasonable deduction, not literally stated), or **UNKNOWN** (not determinable from
> the repository).

---

## 1. CURRENT APPLICATION OVERVIEW

- **Frontend entry point**: [web/src/main.tsx](../web/src/main.tsx) — `createRoot(...).render(<App/>)`. CONFIRMED.
- **Backend entry point**: [server/src/index.ts](../server/src/index.ts) — reads `PORT` (default `3000`), calls `createApp().listen(port, ...)`. CONFIRMED.
- **Main React components**: `App` ([web/src/App.tsx](../web/src/App.tsx)) composes `ThemeProvider` → `AppShell` ([web/src/app/AppShell.tsx](../web/src/app/AppShell.tsx)) → `InputForm` ([web/src/features/input/InputForm.tsx](../web/src/features/input/InputForm.tsx)), `OutputView` ([web/src/features/output/OutputView.tsx](../web/src/features/output/OutputView.tsx)), `ExportControls` ([web/src/features/export/ExportControls.tsx](../web/src/features/export/ExportControls.tsx)); `AppShell` also renders `HelpPanel` ([web/src/app/HelpPanel.tsx](../web/src/app/HelpPanel.tsx)). CONFIRMED.
- **API endpoints** ([server/src/http/app.ts](../server/src/http/app.ts) `createApp()`): `GET /health`, `POST /api/generate`, `POST /api/export`. CONFIRMED.
- **Generation service**: `generate()` in [server/src/app/genService.ts](../server/src/app/genService.ts) — validates then dispatches to core generators based on `selectedTypes`. CONFIRMED.
- **Core generators**: `buildPrd` ([server/src/core/prdGen.ts](../server/src/core/prdGen.ts)), `buildTrs` ([server/src/core/trsGen.ts](../server/src/core/trsGen.ts)), `buildUx` ([server/src/core/uxGen.ts](../server/src/core/uxGen.ts)). CONFIRMED.
- **Export service**: `buildExport` in [server/src/app/exportService.ts](../server/src/app/exportService.ts) dispatches to `buildWord`, `buildPdf`, `buildMockup`. CONFIRMED.
- **Shared contracts**: [shared/src/contract.ts](../shared/src/contract.ts) — `DOC_TYPES`, `GenerationRequestSchema`, `GeneratedDocument`, `GenerationResponse`, `ExportRequestSchema`, `ApiError`. CONFIRMED.
- **Validation**: pure function `validate()` in [shared/src/validate.ts](../shared/src/validate.ts), used both client-side (`InputForm.submit`) and server-side (`genService.generate`), plus a separate Zod structural gate (`GenerationRequestSchema.safeParse`) in `http/app.ts`. CONFIRMED.
- **State management**: local React `useState` only, in `App.tsx`, `InputForm.tsx`, `OutputView.tsx`. No external state library. CONFIRMED (no store/reducer library in `package.json`).
- **Persistence**: none. No database, no file writes, no `localStorage`/`sessionStorage` calls found anywhere in `web/src` (repo-wide search). `Cache-Control: no-store` is set on every response ([server/src/http/app.ts](../server/src/http/app.ts)). CONFIRMED.
- **External integrations**: none. No LLM/API-key usage; explicitly rejected by [adr/ADR-DETERMINISTIC.md](../adr/ADR-DETERMINISTIC.md). CONFIRMED.

**End-to-end flow** (CONFIRMED, cross-checked against [docs/Flow.md](../docs/Flow.md)):
`InputForm` (client `validate()`) → `POST /api/generate` → Zod schema gate → server `validate()` → `buildPrd`/`buildTrs`/`buildUx` (template string interpolation only) → `GenerationResponse` → `App` sets `documents` state → `OutputView` renders tabs + editable textarea (edits held in local component state only) → `ExportControls.run(format)` → `POST /api/export` with `content` taken from `activeDoc.content` in `App` state (**not** from `OutputView`'s edited value — see §7) → `buildExport` → binary buffer + `Content-Disposition` → browser downloads via `triggerBrowserDownload`.

---

## 2. PRD GENERATOR — EXACT CURRENT BEHAVIOR

Evidence: [server/src/core/prdGen.ts](../server/src/core/prdGen.ts), [server/src/app/genService.ts](../server/src/app/genService.ts), [shared/src/contract.ts](../shared/src/contract.ts), [tests/core/prdGen.test.ts](../tests/core/prdGen.test.ts).

1. **`buildPrd()`**: maps the fixed `PRD_SECTIONS` tuple to `## N. {section}\n\n{sectionBody(section, request)}`, joins with blank lines, wraps in `# {title} PRD`, returns `{ type: "PRD", title, content }`. CONFIRMED.
2. **All 9 sections, in exact order** (from `PRD_SECTIONS` const): Problem Statement; Business Case; Proposed Solution; Functional Requirements; User Personas and their Journey; Exclusions; Success Criteria; Assumptions; Risks and Dependencies. CONFIRMED (also asserted by `tests/core/prdGen.test.ts`, which checks `PRD_SECTIONS.toHaveLength(9)` and strict ordering).
3. **Per-section construction** — all via one `sectionBody(section, request)` `switch` statement; every branch is a single hard-coded template sentence that interpolates only `request.productTitle.trim()` and/or `request.productDetails.trim()` verbatim:
   - Problem Statement → `"{title} addresses the following need: {details}"`
   - Business Case → generic value sentence with `{title}`, no `details`
   - Proposed Solution → generic sentence with `{title}`, no `details`
   - Functional Requirements → `"...core behaviors implied by: {details}"`
   - User Personas and their Journey → fixed persona + fixed 4-step journey text, `{title}` only
   - Exclusions → fully hard-coded, no input used
   - Success Criteria → `{title}` only
   - Assumptions → fully hard-coded, no input used
   - Risks and Dependencies → fully hard-coded, no input used
   All CONFIRMED by direct reading of `sectionBody`.
4. **Template/helper/switch involved**: exactly one — `sectionBody()`. No other helpers. CONFIRMED.
5–14. **Interpretation/inference (requirements, personas, user stories, acceptance criteria, edge cases, risks, dependencies, metrics, architecture)**: **No.** The function performs string interpolation of the two raw input fields into fixed sentences; it does not parse, classify, or reason about `productDetails` in any way. CONFIRMED (no NLP/parsing/heuristics code exists in `prdGen.ts`; corroborated by [adr/ADR-DETERMINISTIC.md](../adr/ADR-DETERMINISTIC.md): "no external language-model provider is called").
15–18. **Tables / diagrams / Mermaid / structured data**: None. Output is a single Markdown-like string (`GeneratedDocument.content: string`). No table syntax, no Mermaid fences, no nested objects. CONFIRMED (grep for "mermaid" across `server/src`/`web/src` returns no matches; `GeneratedDocument` has only `type/title/content: string`).
19–20. **Deterministic; identical requests**: Yes — pure function of `request`; two identical `GenerationRequest`s produce byte-identical `content`. CONFIRMED by ADR title/content and by the absence of `Date.now()`/`Math.random()` in `prdGen.ts`. (Test `tests/app/genService.test.ts` "replaces output on each call" only proves content changes when *input* changes, not that identical input differs — consistent with determinism.)
21. **Hard-coded assumptions**: single persona archetype, fixed 4-step adoption journey, fixed risk ("scope growth") and fixed dependency ("reliable input from stakeholders"), regardless of product domain. CONFIRMED.

---

## 3. TRS GENERATOR

Evidence: [server/src/core/trsGen.ts](../server/src/core/trsGen.ts), [tests/core/trsGen.test.ts](../tests/core/trsGen.test.ts).

1. **`buildTrs()`**: identical pattern to `buildPrd` — maps `TRS_SECTIONS` through a `sectionBody` switch, joins, wraps in `# {title} TRS`. CONFIRMED.
2. **All 12 sections in order**: Summary; Problem Statement and Proposed Solution; High Level Architecture; System Boundaries; Non-Functional Requirements; Data Requirements; Integration Requirements; UI Requirements; Test and Validation; Risks and Dependencies; Deployments; AI Usage and Implications. CONFIRMED (`TRS_SECTIONS`, asserted `toHaveLength(12)` in test).
3. **Generation logic**: one `switch` per section, same shape as PRD. CONFIRMED.
4. **Inputs affecting each section**: only "Summary" interpolates both `{title}` and `{details}`; all other 11 sections interpolate `{title}` only or nothing — the architecture/NFR/data/integration/test/deployment/AI sections are **entirely hard-coded generic sentences**, independent of `productDetails`. CONFIRMED (e.g., "High Level Architecture" always returns "A single-page front-end communicates with a stateless service over HTTPS" regardless of the described product).
5. **Hard-coded content**: 11 of 12 sections are fixed prose describing *SpecPilot's own* architecture/stack (e.g., "packaged as a container image", "Generation is deterministic and template-driven; no external model is invoked") rather than the user's product. CONFIRMED — this is a notable behavior: the TRS partly describes SpecPilot itself, not the generated product.
6. **Inference of architecture/APIs/DB/data models/security/auth/perf/scalability/observability/deployment/integrations/error handling/testing**: **No** for all — every one of these topics is answered by one fixed sentence, not derived from `productDetails`. CONFIRMED.
7–9. **Tables/diagrams/Mermaid**: none. CONFIRMED.
10. **Deterministic**: Yes, same reasoning as PRD. CONFIRMED.

---

## 4. UX GENERATOR

Evidence: [server/src/core/uxGen.ts](../server/src/core/uxGen.ts), [tests/core/uxGen.test.ts](../tests/core/uxGen.test.ts).

1. **`buildUx()`**: builds a fixed-structure string: `# {title} UX Design Mockups`, then `## {UX_SEGMENTS[0]}` + `journeys(request)`, then `## {UX_SEGMENTS[1]}` + `mockups(request)`. CONFIRMED.
2. **Segments** (`UX_SEGMENTS`): `"User Journeys for personas"`, `"UI Design Mockups"` — exactly two. CONFIRMED.
3. **Journey generation logic** (`journeys()`): fixed 4-step numbered list ("Lands on the app…", "Enters the product title and details…", "Selects the desired document types…", "Generates, reviews, edits, and exports…") with only `{title}` interpolated into a heading; content is generic to *SpecPilot's own UI flow*, not the described product. CONFIRMED.
4. **Mockup generation logic** (`mockups()`): a hard-coded ASCII-art box (fenced in a Markdown code block) resembling SpecPilot's own input/output/export UI, with `{title}` truncated/padded into one line. Not a mockup of the user's product. CONFIRMED.
5. **Output format**: single Markdown string (headings + fenced ASCII block), same `GeneratedDocument` shape. CONFIRMED.
6. **Hard-coded content**: nearly all of it — only the title string varies. CONFIRMED.
7. **`productDetails` usage**: **Not used at all** in `uxGen.ts` — neither `journeys()` nor `mockups()` reference `request.productDetails`. CONFIRMED (only `request.productTitle` appears).
8. **Product idea interpretation**: No. CONFIRMED.
9–10. **Diagram/Mermaid support**: None — the "mockup" is literal ASCII art in a code fence, not a diagram language. CONFIRMED.
11. **Structured/editable output vs plain text**: Plain text/Markdown string only; editable only as free text in the frontend textarea (see §7), not as structured/segment-addressable data. CONFIRMED.

---

## 5. GENERATION ORCHESTRATION

Evidence: [server/src/app/genService.ts](../server/src/app/genService.ts), [server/src/http/app.ts](../server/src/http/app.ts), [shared/src/contract.ts](../shared/src/contract.ts), [shared/src/validate.ts](../shared/src/validate.ts).

1. **`GenerationRequest`**: `{ productTitle: string; productDetails: string; selectedTypes: DocType[] }` (Zod-inferred). CONFIRMED.
2. **`GeneratedDocument`**: `{ type: DocType; title: string; content: string }` — plain interface, not Zod-validated. CONFIRMED.
3. **`GenerationResponse`**: `{ documents: GeneratedDocument[] }`. CONFIRMED.
4. **Validation flow**: (a) client mirror in `InputForm.submit()`; (b) Zod structural gate `GenerationRequestSchema.safeParse` in `http/app.ts` (types/enum shape only) → `400 INVALID_REQUEST`; (c) business-rule gate `validate()` inside `genService.generate()` (non-empty fields, ≥1 type) → throws `ValidationError` → route catches → `400 VALIDATION_FAILED` with `err.errors` as `details`. CONFIRMED — two independent, slightly different validation layers exist (structural vs. business-rule), a duplication risk.
5. **Generator selection logic**: three sequential `if (request.selectedTypes.includes("X")) documents.push(buildX(request))` checks, always in PRD→TRS→UX order regardless of the order types were selected in the UI. CONFIRMED.
6. **Error handling**: `ValidationError` (custom `Error` subclass) → `400`; any other thrown error → generic `500 GENERATION_FAILED` (error details swallowed, not logged anywhere observed). CONFIRMED.
7. **Ordering guarantees**: output array order is always PRD, TRS, UX (whichever are selected), never the UI selection order. CONFIRMED.
8. **Synchronous vs asynchronous**: `generate()` itself is fully synchronous (no `await`, no I/O). The Express handler is synchronous too (no `async`). CONFIRMED. (Export path, by contrast, is `async` because `buildWord` awaits `docx`'s `Packer.toBuffer`.)
9. **Retry logic**: none found anywhere in `genService.ts` or `http/app.ts`. CONFIRMED (repo-wide search for retry/backoff patterns in `server/src` found nothing).
10. **Generation state persistence**: none — each call is stateless; nothing is cached or stored between requests. CONFIRMED.

---

## 6. CURRENT DOCUMENT MODEL

1. **Is a document merely a string?** The `content` field is a plain string; `type` and `title` are the only structured metadata. CONFIRMED ([shared/src/contract.ts](../shared/src/contract.ts) `GeneratedDocument`).
2. **Are sections objects?** No — sections exist only as `## N. {name}` Markdown headings inside the single `content` string; the section name arrays (`PRD_SECTIONS`, `TRS_SECTIONS`, `UX_SEGMENTS`) are compile-time constants used to generate that string, not part of the runtime document object. CONFIRMED.
3. **Are requirements objects?** No — requirements are prose sentences inside `content`. CONFIRMED.
4. **Are tables structured?** N/A — no tables exist in generated output. CONFIRMED (§2–4).
5. **Are diagrams structured?** N/A — no diagrams exist. CONFIRMED.
6. **Is metadata present?** Only `type` (`DocType`) and `title` (string). No timestamps, IDs, or authorship. CONFIRMED.
7. **Are section IDs present?** No. CONFIRMED.
8. **Is ordering metadata present?** Only implicit array order in `PRD_SECTIONS`/`TRS_SECTIONS`/`UX_SEGMENTS`; not carried in `GeneratedDocument`. CONFIRMED.
9. **Is versioning present?** No. CONFIRMED.
10. **Is draft/final distinction present?** No. CONFIRMED.
11. **Does a ProductSpec-like model already exist?** No — repo-wide search for `ProductSpec` returns zero matches in source. CONFIRMED.
12. **Smallest existing abstraction that could be extended**: the `GeneratedDocument` interface in [shared/src/contract.ts](../shared/src/contract.ts), plus the parallel `PRD_SECTIONS`/`TRS_SECTIONS`/`UX_SEGMENTS` tuples that already enumerate section names per doc type. (No new model is proposed here, per instructions.)

---

## 7. FRONTEND EDITING

Evidence: [web/src/App.tsx](../web/src/App.tsx), [web/src/features/input/InputForm.tsx](../web/src/features/input/InputForm.tsx), [web/src/features/output/OutputView.tsx](../web/src/features/output/OutputView.tsx), [web/src/features/export/ExportControls.tsx](../web/src/features/export/ExportControls.tsx), [web/src/api/client.ts](../web/src/api/client.ts), [tests/web/outputView.test.tsx](../tests/web/outputView.test.tsx).

1. **How content is displayed**: a single `<textarea>` per active document tab. CONFIRMED.
2. **Textarea or not**: Textarea (`OutputView.tsx`, `rows={16}`, `style={{ width: "100%" }}`). CONFIRMED.
3. **Markdown rendering**: None — raw Markdown-like text is shown unrendered in the textarea (no Markdown renderer library in `package.json`). CONFIRMED.
4. **Section-level editing**: No — editing is whole-document free text per tab; no per-section fields. CONFIRMED.
5. **Local storage of edits**: In-memory React state only (`edits: Record<string, string>` in `OutputView`, keyed by `DocType`). No `localStorage`/`sessionStorage`/cookie use anywhere in `web/src` (repo-wide search). CONFIRMED.
6. **Persistence of edits**: None beyond the component's lifetime; lost on page reload. CONFIRMED.
7. **Refresh behavior**: A `useEffect` in `OutputView` resets `edits` and `active` whenever the `documents` prop array reference changes (i.e., on every regeneration) — so regenerating always discards prior edits for all doc types, even ones not regenerated. CONFIRMED (`tests/web/outputView.test.tsx` "replaces prior output when regenerated documents arrive").
8. **Formatted preview**: None. CONFIRMED.
9. **Split edit/preview**: None — single textarea, no side-by-side preview. CONFIRMED.
10. **Structured editing support**: None. CONFIRMED.
11. **Whether edited content reaches export — CONFIRMED BUG**: `App.tsx` renders `<OutputView documents={documents} onContentChange={() => undefined} />` — the callback that would receive edited text is a no-op that discards its argument. `ExportControls` is given `content={activeDoc.content}`, where `activeDoc` is derived from the original `documents` state (from the last `/api/generate` response), **not** from `OutputView`'s internal `edits` map. Therefore **text edited by the user in the output textarea is never sent to `/api/export`** — only the original generated content is exported. This is evidenced purely by data flow in `App.tsx`; no test in the suite exercises "edit then export" end-to-end (searched `tests/web/app.test.tsx`, `tests/web/exportControls.test.tsx`, `tests/e2e/acceptance.test.ts` — none combine editing with export). CONFIRMED as a synchronization gap; unverified by any existing test, so its user-facing impact is not asserted anywhere in the test suite.
12. Directly follows from #11.
13. **Other UX limitations**: no undo/redo; no per-document dirty indicator; switching tabs after edits keeps in-tab edits (confirmed by test) but they still don't reach export; no confirmation before regeneration discards edits.

---

## 8. EXPORT SYSTEM

Evidence: [server/src/app/exportService.ts](../server/src/app/exportService.ts), [tests/app/exportService.test.ts](../tests/app/exportService.test.ts), [tests/http/export.test.ts](../tests/http/export.test.ts).

1. **Word export** (`buildWord`): uses the `docx` package — splits `content` on `"\n"`, creates one `Paragraph` per line (no heading styles, no Markdown-to-Word structure translation — a `##` heading line becomes a plain paragraph containing the literal `"## 1. Problem Statement"` text), packs via `Packer.toBuffer()`. CONFIRMED.
2. **PDF export** (`buildPdf`): fully hand-rolled, dependency-free single-page-flow PDF writer — manually builds a PDF object graph (`Catalog`/`Pages`/`Page`/`Contents` stream/`Font`) and writes fixed `Tj` text-show operators. CONFIRMED — no `pdfkit` or similar library used, despite `design.md` referencing `pdfkit` as intended (**documentation drift**, noted independently in [docs/AppArch.md](../docs/AppArch.md)).
3. **UX export** (`buildMockup`): wraps HTML-escaped `content` in a `<pre>` tag inside a minimal HTML document, served as `text/html`. CONFIRMED.
4. **Markdown handling**: None of the three exporters interpret Markdown syntax (`#`, `##`, code fences, etc.) — all three treat `content` as literal text/lines. CONFIRMED.
5. **Heading handling**: None — headings are not styled distinctly in Word or PDF output. CONFIRMED.
6. **Table handling**: N/A — no tables are ever generated (§2–4), and no exporter has table logic. CONFIRMED.
7. **Diagram handling**: N/A — no diagrams generated; no exporter has diagram/image logic. CONFIRMED.
8. **PDF pagination**: **None** — `buildPdf` hard-codes a single `Page` object and only takes `lines.slice(0, 50)` of the content; there is no multi-page logic. CONFIRMED.
9. **PDF truncation — CONFIRMED LIMIT**: content beyond the first 50 lines is silently dropped (`const lines = content.split("\n").slice(0, 50);`) with no truncation warning surfaced to the user. CONFIRMED.
10. **HTML limitations**: `buildMockup` escapes `&` and `<` but not `>` or quotes; acceptable for a `<pre>` block but not a general-purpose HTML sanitizer. CONFIRMED (partial escaping only).
11. **Mermaid survivability by export type**: N/A — no Mermaid is ever generated anywhere in the app (§2–4, repo-wide grep), so the question of survivability across Word/PDF/HTML exports does not currently arise.
12. **Export limitations/bugs summarized**: (a) PDF silently truncates at 50 lines; (b) Word/PDF ignore Markdown structure entirely (headings render as plain text lines); (c) exported content is always the *original* generated content, not user edits (§7.11).

---

## 9. TEST COVERAGE

| Area | Test files | What is guaranteed | Important missing coverage |
| --- | --- | --- | --- |
| prdGen | [tests/core/prdGen.test.ts](../tests/core/prdGen.test.ts) | 9 sections present, in order; title appears in content | No test of exact `sectionBody` text per section beyond title inclusion; no test of empty/whitespace-only `productDetails` behavior |
| trsGen | [tests/core/trsGen.test.ts](../tests/core/trsGen.test.ts) | 12 sections present, in order | Same as above; no test that content is architecture-agnostic of `productDetails` |
| uxGen | [tests/core/uxGen.test.ts](../tests/core/uxGen.test.ts) | Both segments present; type is "UX" | No test that `productDetails` is unused (would be a good regression guard before enriching) |
| genService | [tests/app/genService.test.ts](../tests/app/genService.test.ts) | Only selected types produced; invalid input throws `ValidationError`; regeneration changes content when input changes, within 10s | No test of PRD+TRS+UX combined ordering; no test of the `ValidationError` → 500 fallback path for non-`ValidationError` exceptions |
| /api/generate | [tests/http/generate.test.ts](../tests/http/generate.test.ts) | 200 with documents on valid input; 400 + no-store/nosniff headers on invalid input | No test of the Zod-schema-level 400 (`INVALID_REQUEST`) vs. business-rule 400 (`VALIDATION_FAILED`) distinction; no 500 path test |
| validation (shared) | [tests/shared/validate.test.ts](../tests/shared/validate.test.ts), [tests/shared/contract.test.ts](../tests/shared/contract.test.ts) | Accepts complete request; rejects empty title/details/selectedTypes; Zod rejects unknown doc type | No test combining both validation layers together via the HTTP route |
| OutputView / editing | [tests/web/outputView.test.tsx](../tests/web/outputView.test.tsx) | Only generated types shown as tabs; edits persist when switching tabs (in-memory); regeneration replaces content and clears edits | **No test that edited content is (or is not) reflected in export** — the App-level disconnect (§7.11) is untested |
| export (service) | [tests/app/exportService.test.ts](../tests/app/exportService.test.ts) | Word/PDF/mockup buffers built with correct filenames | No test of the 50-line PDF truncation behavior; no test of Word paragraph-per-line mapping fidelity |
| export (HTTP) | [tests/http/export.test.ts](../tests/http/export.test.ts) | 200 + correct `Content-Disposition`/`Content-Type` for each format | No 400/500 path test for `/api/export` |
| export (UI) | [tests/web/exportControls.test.tsx](../tests/web/exportControls.test.tsx) | Word/PDF/UX-mockup download triggered with correct filenames | No test that the exported `content` prop matches edited textarea value (again, §7.11 gap) |
| deployment | [tests/deploy/smoke.test.ts](../tests/deploy/smoke.test.ts) | `/health` returns 200/`ok`; Dockerfile exists on disk | Does not actually run the container or verify static asset serving; does not test `deploy/smoke.sh` itself |
| end-to-end generation | [tests/e2e/acceptance.test.ts](../tests/e2e/acceptance.test.ts) | Full-stack `/api/generate` returns only-selected types, ordered content, within time budget | No end-to-end test through the browser UI including export (that only exists split across `app.test.tsx` and `exportControls.test.tsx` separately) |
| scaffold | [tests/build/scaffold.test.ts](../tests/build/scaffold.test.ts) | `package.json` defines `test`/`test:ci` scripts | Does not verify `build`/`dev` scripts |
| docs/help | [tests/docs/help.test.tsx](../tests/docs/help.test.tsx) | HelpPanel text mentions all 3 doc types and Word/PDF export | — |
| app shell / input form / theme / client | [tests/web/appShell.test.tsx](../tests/web/appShell.test.tsx), [tests/web/inputForm.test.tsx](../tests/web/inputForm.test.tsx), [tests/web/theme.test.tsx](../tests/web/theme.test.tsx), [tests/web/client.test.ts](../tests/web/client.test.ts) | Header/help render; form validation/toggle behavior; dark theme applied; API client success/error/blob paths | Not deeply inspected in this audit (read only where directly relevant per scope); no obvious gaps noted from file names |

1. **Tests likely to change if generation becomes richer**: all of `tests/core/*.test.ts` (section-name assertions), `tests/e2e/acceptance.test.ts` (asserts exact section-name substrings via `PRD_SECTIONS`/`TRS_SECTIONS`/`UX_SEGMENTS`), and possibly `tests/app/exportService.test.ts` if export logic must interpret new structure.
2. **Behaviors that must remain backward compatible** (see §12 for full list): the `GenerationRequest`/`GenerationResponse`/`GeneratedDocument` shapes, the `/api/generate` and `/api/export` contracts, filename format (`prefixFilename`), and the "only selected types are generated, in PRD/TRS/UX order" guarantee.

---

## 10. DOCKER / PRODUCTION

Evidence: [Dockerfile](../Dockerfile), [package.json](../package.json), [vite.config.ts](../vite.config.ts), [server/src/index.ts](../server/src/index.ts), [server/src/http/app.ts](../server/src/http/app.ts), [deploy/README.md](../deploy/README.md), [deploy/smoke.sh](../deploy/smoke.sh), [tests/deploy/smoke.test.ts](../tests/deploy/smoke.test.ts).

1. **Docker build output**: multi-stage build — build stage runs `npm ci` + `npm run build` (Vite build → `dist/`); runtime stage runs `npm ci --omit=dev`, copies `dist/`, `server/`, `shared/` from build/context. CONFIRMED.
2. **Runtime image contents**: `dist/` (built frontend static assets), `server/`, `shared/` source (TypeScript, not compiled — run via `--experimental-strip-types`), plus production `node_modules`. CONFIRMED.
3. **Startup command**: `CMD ["node", "--experimental-strip-types", "server/src/index.ts"]`. CONFIRMED.
4. **Expected port**: `3000` (`EXPOSE 3000`; `server/src/index.ts` defaults `PORT` to `3000`). CONFIRMED.
5. **Production frontend serving — CONFIRMED GAP**: `server/src/http/app.ts::createApp()` registers only `/health`, `/api/generate`, `/api/export` — **no `express.static` call and no catch-all route exist**. The built `dist/` assets are copied into the image but nothing in the server serves them. CONFIRMED by direct reading of `app.ts` (no `express.static`/`sendFile` calls) and corroborated independently by [docs/AppArch.md](../docs/AppArch.md) and [docs/Running.md](../docs/Running.md), which flag the same gap.
6. **`express.static` usage**: None (see #5). CONFIRMED.
7. **Reverse proxy requirement**: Not documented in `deploy/README.md`; given #5, some mechanism to serve `dist/` (reverse proxy, static host, or an unbuilt code path) is **required** in production but is not specified anywhere in the repo. UNKNOWN how the frontend is intended to reach users in production.
8. **Health endpoint**: `GET /health` → `{ status: "ok" }`, used by `deploy/smoke.sh` and Dockerfile `HEALTHCHECK` (`wget -qO- http://localhost:3000/health`). CONFIRMED.
9. **Shutdown behavior**: No `SIGTERM`/`SIGINT` handlers found in `server/src/index.ts` or `http/app.ts`; relies on Node/Express defaults. CONFIRMED absence; graceful-shutdown behavior otherwise UNKNOWN.
10. **Deployment gaps**: (a) frontend not served in production (#5); (b) no documented reverse-proxy/static-hosting step to close that gap; (c) `deploy/smoke.sh` only checks `/health`, not `/api/generate`/`/api/export` or static asset availability.
11. **Issues to address before production** (identification only, no fix proposed): the static-serving gap (#5) is the most consequential — as shipped, the container's `/` route is not defined, so a user pointed only at the container likely cannot load the UI. INFERRED impact (no route exists for `/`, confirmed; actual runtime behavior when hitting `/` was not executed/observed in this audit — marking the precise HTTP response as UNKNOWN without running the container).

---

## 11. ARCHITECTURAL RISKS

- **Generator coupling to prose, not data**: `buildPrd`/`buildTrs`/`buildUx` return only a flat string; any richer PRD requirement (structured requirements, personas as objects, etc.) cannot be layered on without changing the `GeneratedDocument` contract in [shared/src/contract.ts](../shared/src/contract.ts), which is consumed by every layer (`genService`, `exportService`, `OutputView`, `ExportControls`). Evidence: `GeneratedDocument { content: string }` used identically across [server/src/app/genService.ts](../server/src/app/genService.ts), [web/src/App.tsx](../web/src/App.tsx), [web/src/features/output/OutputView.tsx](../web/src/features/output/OutputView.tsx).
- **Document representation has no addressable structure**: section boundaries exist only as Markdown heading text inside one string, so any future feature needing to edit/export/version a single section (rather than the whole document) has no seam to attach to today. Evidence: §6.
- **Frontend edit/export desynchronization**: user edits in `OutputView` never reach `App`'s `documents` state or `ExportControls` (§7.11) — a live correctness bug that any richer editing feature would inherit unless fixed as part of that work.
- **Export fidelity ceiling**: Word/PDF exporters do not parse Markdown (§8.4–8.5), so any generator enhancement that adds real Markdown structure (tables, nested lists) will not visually survive export today without export-layer changes.
- **PDF hard 50-line cap**: `buildPdf`'s `.slice(0, 50)` ([server/src/app/exportService.ts](../server/src/app/exportService.ts)) means any generator producing longer output (a near-certainty for "richer PRD") will silently truncate PDF exports today.
- **Production static-serving gap**: (§10.5) — a deployment risk independent of any redesign, but relevant because future work will be validated against a container that may not serve the UI at all.
- **Dual validation layers with different rule sets**: Zod structural schema (`GenerationRequestSchema`) vs. hand-written `validate()` business rules are two separate code paths ([shared/src/contract.ts](../shared/src/contract.ts) vs. [shared/src/validate.ts](../shared/src/validate.ts)) that must be kept in sync manually; a richer request shape (e.g., new required fields) risks the two diverging.
- **No TypeScript compilation step in production image**: the Dockerfile runs the server directly via `node --experimental-strip-types` against `.ts` source ([Dockerfile](../Dockerfile)), meaning type errors are not caught at build time for the runtime artifact — only `npm run build` (Vite, frontend-only) and the test suite provide TypeScript checking. INFERRED runtime-safety implication from the Dockerfile CMD; not independently executed in this audit.
- **Single npm package, not real workspaces**: `shared/`, `server/`, `web/` are just directories under one `package.json` (no `workspaces` field) — any future package boundary (e.g., publishing `shared` separately) would require restructuring. Evidence: [package.json](../package.json) has no `workspaces` key.

---

## 12. BACKWARD COMPATIBILITY

Evidence basis: [shared/src/contract.ts](../shared/src/contract.ts), [shared/src/naming.ts](../shared/src/naming.ts), route handlers in [server/src/http/app.ts](../server/src/http/app.ts), and the full test suite reviewed in §9.

## Must Not Break

- `GenerationRequest` shape: `{ productTitle: string; productDetails: string; selectedTypes: DocType[] }` and `DOC_TYPES = ["PRD","TRS","UX"]` — asserted by [tests/shared/contract.test.ts](../tests/shared/contract.test.ts), [tests/http/generate.test.ts](../tests/http/generate.test.ts).
- `GeneratedDocument` shape: `{ type, title, content: string }` — consumed by `OutputView`, `ExportControls`, and every core-generator test.
- `GenerationResponse` envelope: `{ data: { documents: [...] } }` on success ([server/src/http/app.ts](../server/src/http/app.ts) `res.json({ data: response })`), `{ error: { code, message, details? } }` on failure — asserted by [tests/http/generate.test.ts](../tests/http/generate.test.ts) and `web/src/api/client.ts`'s error mapping.
- `/api/generate` and `/api/export` request/response contracts and status codes (`200`, `400 INVALID_REQUEST`, `400 VALIDATION_FAILED`, `500 GENERATION_FAILED`/`500 EXPORT_FAILED`).
- Filename convention: `prefixFilename(title, docType, format)` → `{sanitized-title}-{doctype}.{ext}` (e.g., `acme-prd.docx`) — asserted by [tests/shared/naming.test.ts](../tests/shared/naming.test.ts), [tests/app/exportService.test.ts](../tests/app/exportService.test.ts), [tests/web/exportControls.test.tsx](../tests/web/exportControls.test.tsx).
- Export formats and content types: `word` → `.docx` OOXML, `pdf` → `application/pdf`, `mockup` → `text/html` — asserted by [tests/http/export.test.ts](../tests/http/export.test.ts).
- "Only selected document types are generated" and PRD→TRS→UX ordering — asserted by [tests/app/genService.test.ts](../tests/app/genService.test.ts), [tests/e2e/acceptance.test.ts](../tests/e2e/acceptance.test.ts).
- Section-name tuples (`PRD_SECTIONS` = 9 fixed names, `TRS_SECTIONS` = 12 fixed names, `UX_SEGMENTS` = 2 fixed names) and their in-order appearance in `content` — directly asserted by the three core generator tests and `tests/e2e/acceptance.test.ts`.
- `/health` → `{ status: "ok" }` — required by [deploy/smoke.sh](../deploy/smoke.sh) and Docker `HEALTHCHECK`.
- No server-side persistence of user content (`Cache-Control: no-store`, statelessness) — a documented non-goal in [Spec.md](../Spec.md) and [adr/ADR-DETERMINISTIC.md](../adr/ADR-DETERMINISTIC.md).
- Deterministic (non-LLM) generation — explicit ADR decision; any change here is an architectural decision, not an implementation detail.

---

## 13. RICHER PRD READINESS

| Future capability | Classification | Basis |
| --- | --- | --- |
| Executive Summary | GENERATOR ONLY | Can be added as a new fixed section in `PRD_SECTIONS`/`sectionBody`, same pattern as existing sections. |
| Problem Statement | GENERATOR ONLY | Already exists; richer content only needs `sectionBody` logic changes. |
| Goals | GENERATOR ONLY | New section, same string-template pattern. |
| Non-goals | GENERATOR ONLY | Same as Goals. |
| Business Case | GENERATOR ONLY | Already exists; content-only change. |
| Constraints | GENERATOR ONLY | New section, template pattern. |
| Assumptions | GENERATOR ONLY | Already exists; content-only change. |
| Personas | DOCUMENT MODEL CHANGE | Currently a single prose sentence (§2.3); representing multiple structured personas needs `GeneratedDocument` (or a new type) to carry structured data, not just `content: string`. |
| User Journeys | DOCUMENT MODEL CHANGE | Currently fixed prose in UX generator (§4.3); multiple/structured journeys need a structured model. |
| User Stories | DOCUMENT MODEL CHANGE | No story concept exists today (no "as a / I want / so that" structure anywhere in generators). |
| Acceptance Criteria | DOCUMENT MODEL CHANGE | Same — no structured criteria concept exists. |
| Functional Requirements | GENERATOR ONLY (to enrich prose) / DOCUMENT MODEL CHANGE (if structured, itemized requirements are wanted) | Section exists as one paragraph today (§2.3); itemization requires structure. |
| Non-functional Requirements | GENERATOR ONLY / DOCUMENT MODEL CHANGE | Exists only in TRS today as one fixed sentence (§3.4); same duality as above. |
| Edge Cases | DOCUMENT MODEL CHANGE | No concept exists in any generator today. |
| Error States | DOCUMENT MODEL CHANGE | No concept exists today. |
| Business Rules | DOCUMENT MODEL CHANGE | No concept exists today. |
| Success Metrics | GENERATOR ONLY (prose) / DOCUMENT MODEL CHANGE (if structured KPIs) | "Success Criteria" section exists as prose only (§2.3). |
| Analytics | DOCUMENT MODEL CHANGE | No concept exists today. |
| Risks | GENERATOR ONLY | "Risks and Dependencies" exists as prose (§2.3, §3.4); enrichable in place. |
| Dependencies | GENERATOR ONLY | Same section as Risks today. |
| Security Requirements | GENERATOR ONLY (new TRS prose) | TRS has no security-specific section today (closest is "Non-Functional Requirements", §3.2); addable within existing pattern. |
| Architecture | GENERATOR ONLY (content) / MULTIPLE LAYERS (if diagrams wanted) | "High Level Architecture" is fixed prose (§3.4); diagrams would also require export-layer and possibly frontend changes (see Mermaid readiness, §15). |
| API specifications | GENERATOR ONLY (prose) / DOCUMENT MODEL CHANGE (structured) | No API-spec concept exists today. |
| Data models | GENERATOR ONLY (prose) / DOCUMENT MODEL CHANGE (structured) | "Data Requirements" is one fixed sentence today (§3.4). |
| ERDs | MULTIPLE LAYERS | Requires generator (diagram data), document model (diagram metadata), export (diagram rendering), and possibly frontend (diagram display) — none of which exist today (§15). |
| Sequence diagrams | MULTIPLE LAYERS | Same as ERDs. |
| State diagrams | MULTIPLE LAYERS | Same as ERDs. |
| Flow diagrams | MULTIPLE LAYERS | Same as ERDs. |
| Roadmap | GENERATOR ONLY (prose) / DOCUMENT MODEL CHANGE (structured timeline) | No concept exists today. |
| Rollout plan | GENERATOR ONLY (prose) / DOCUMENT MODEL CHANGE (structured) | "Deployments" exists in TRS as one fixed sentence (§3.4). |

(No implementation is proposed here, per instructions — classifications only.)

---

## 14. PRODUCTSPEC READINESS

1. **Does ProductSpec already exist?** No — repo-wide search for "ProductSpec" returns zero matches in any source file. CONFIRMED.
2. **Where would it logically belong?** [shared/src/contract.ts](../shared/src/contract.ts) is the only place today where cross-cutting document/request types live and are consumed by both `server/` and `web/`. (Observation only, not a design proposal.)
3. **Which types/functions would be affected?** `GeneratedDocument`, `GenerationResponse` (contract.ts); `buildPrd`/`buildTrs`/`buildUx` (return type); `generate()` in `genService.ts`; `buildExport`/`buildWord`/`buildPdf`/`buildMockup` (input type, currently `content: string`); `OutputView` and `ExportControls` (props typed on `GeneratedDocument`).
4. **Which components consume `GeneratedDocument`?** `web/src/App.tsx`, `web/src/features/output/OutputView.tsx`, `web/src/features/export/ExportControls.tsx` (via its `content`/`docType`/`productTitle` props derived from a `GeneratedDocument`), and all three core generators (as their return type) — CONFIRMED by direct imports in each file.
5. **Which code assumes content is a string?** `exportService.ts`'s `buildWord`/`buildPdf`/`buildMockup` (all take `content: string` and call `.split("\n")`); `OutputView`'s `<textarea value={...}>`; `ExportControls`'s pass-through `content: string` prop. All CONFIRMED.
6. **Smallest safe integration seam**: the `GeneratedDocument.content` field and the `buildExport(format, content, title, docType)` signature are the two narrowest points where every consumer already agrees on a single `string` type — any structured-model addition would need to interoperate with (or replace) that string at minimum these two points. (Observation only; no design proposed.)
7. **What code should ideally remain unchanged?** `shared/src/naming.ts` (filename logic), `shared/src/validate.ts`'s existing rules for the current fields, and the `/health` contract — none of these are implicated by a document-model change. (Observation only.)

---

## 15. MERMAID READINESS

1. **Where diagram data would currently live**: nowhere — no diagram data structure exists in `GeneratedDocument`, the generators, or any test fixture. CONFIRMED (repo-wide grep for "mermaid"/"diagram" in `server/src`, `web/src`, `shared/src` returns no matches; only `design.md`/`design.html`/`plan.html` — non-application design documents — contain Mermaid, and only as illustrative diagrams of the architecture itself, not generated output).
2. **Whether `GeneratedDocument` supports diagram metadata**: No — it has only `type`, `title`, `content: string`. CONFIRMED.
3. **Whether `OutputView` supports anything beyond text**: No — it renders exactly one `<textarea>` bound to a string; no rendering pipeline for Markdown, HTML, or diagram syntax exists in `web/src/features/output/OutputView.tsx`. CONFIRMED.
4. **Whether exports support diagrams**: No — `buildWord`/`buildPdf`/`buildMockup` operate on raw lines/text only; none has diagram-rendering logic. CONFIRMED (§8).
5. **Which layers require modification for editable Mermaid**: generator layer (to emit diagram source), document model (`GeneratedDocument` needs a way to carry diagram data or fenced Mermaid blocks distinctly), frontend (`OutputView` needs a Mermaid renderer and/or dual edit/preview mode), and export layer (Word/PDF/HTML would each need diagram-to-image or diagram-to-embed logic) — i.e., this spans every layer identified in §1. (Classification only, no design proposed.)
6. **Existing dependencies that may help**: none present in `package.json` — no Mermaid, no diagram-rendering, no Markdown-parsing library is installed today (only `docx`, `express`, `react`, `react-dom`, `zod` as runtime deps). CONFIRMED — per audit scope, no library research was performed beyond confirming absence.

---

## 16. FINAL QA0 SUMMARY

# Executive Summary

1. **What exactly is SpecPilot today?** A stateless, deterministic, template-based document generator: given a product title/details and a selection of PRD/TRS/UX, it string-interpolates those two fields into fixed prose templates (9/12/2 fixed sections respectively), displays the result in an editable-but-unsynced textarea, and exports the *original* (not edited) content to Word, a hand-rolled single-page PDF, or an HTML mockup file. CONFIRMED across §1–8.
2. **Why are PRDs currently shallow?** Because `sectionBody()` in `prdGen.ts` (and the equivalent in `trsGen.ts`/`uxGen.ts`) is a fixed `switch` of one hard-coded sentence per section — most sections use only `productTitle`, several ignore `productDetails` entirely (e.g., Exclusions, Assumptions, Risks and Dependencies in PRD; 11 of 12 TRS sections; both UX segments never reference `productDetails` at all). There is no parsing, classification, or inference of the input text. CONFIRMED §2–4.
3. **Biggest architectural limitation?** The document model is a single opaque string (`GeneratedDocument.content`) with no addressable structure — every consumer (export, frontend display, tests) depends on that string shape, so any structural enrichment (personas as data, tables, diagrams) requires touching the shared contract and every direct consumer of it. CONFIRMED §6, §14.
4. **Strongest architectural foundation?** The layered, acyclic dependency structure (Presentation → Adapter → Application → Core, all optionally depending on Shared) with pure, side-effect-free core generators behind a single `IFACE-GENSVC`-style seam (`genService.generate()`) — this makes generator replacement/extension low-risk without touching HTTP or UI layers, as already anticipated by [adr/ADR-DETERMINISTIC.md](../adr/ADR-DETERMINISTIC.md).
5. **Extend vs. replace generators — tradeoffs only**:
   - *Extend* (keep the `switch`-per-section pattern, add more sections/branches): preserves determinism, existing tests, and the simple mental model; but the pattern does not scale to inference-driven content (personas, stories, risks derived from the actual product description) without becoming a much larger, harder-to-test `switch`.
   - *Replace* (new generation strategy/model): could produce structurally richer, more input-sensitive output; but conflicts with the explicit ADR decision to avoid non-deterministic/external generation, and would require a document-model change regardless, since a string-only `GeneratedDocument` cannot carry the resulting structure.
6. **Can current architecture evolve into a richer PRD system?** Partially — the layering (§ "Strongest architectural foundation") supports evolving the *generators* without touching HTTP/UI. However, several classes of richer output (§13: personas, stories, acceptance criteria, diagrams) require changing the *document model* (`GeneratedDocument`) and, transitively, the export and frontend layers that assume `content: string`. So: yes for prose-only enrichment within existing sections; no, not without a document-model change, for structured/diagram-bearing content.
7. **Biggest risks?** (a) the frontend edit→export desynchronization is a live, untested bug today (§7.11, §11) that any richer editing UX would inherit; (b) the PDF 50-line truncation (§8.9) will silently worsen as content grows; (c) the production static-serving gap (§10.5) is an operational risk independent of any redesign but will affect how richer output is actually delivered to users.
8. **Remaining UNKNOWNs?** How the production container is actually intended to serve the frontend given the confirmed `express.static` gap (§10.5/§10.7); whether graceful shutdown is required/handled (§10.9); the actual runtime HTTP response for `/` in production (not executed in this audit).

# Confirmed Facts
- Generation is fully deterministic, template-based string interpolation with zero external calls ([adr/ADR-DETERMINISTIC.md](../adr/ADR-DETERMINISTIC.md), §2–4).
- `GeneratedDocument` is `{ type, title, content: string }` with no structure beyond that (§6).
- Frontend edits never reach the export request due to a no-op `onContentChange` callback in `App.tsx` (§7.11).
- PDF export truncates content to the first 50 lines (§8.9).
- The production Express app never calls `express.static`, so the built frontend is not served by the server as shipped (§10.5).
- No Mermaid, diagrams, tables, or ProductSpec model exist anywhere in the current codebase (§6, §14, §15).

# Inferred Findings
- The static-serving gap likely means the container's `/` route is undefined in production, though the exact runtime HTTP response was not executed/observed in this audit (§10.5/§10.11).
- Lack of a compiled production build for the server (`--experimental-strip-types` running `.ts` directly) suggests type errors are not caught for the shipped server artifact beyond what tests/lint catch pre-build (§11).

# Unknowns
- The intended production mechanism for serving the built frontend (reverse proxy, separate static host, or a missing code path) is not documented anywhere in the repository (§10.7).
- Graceful shutdown behavior under `SIGTERM`/`SIGINT` is not implemented or tested; actual behavior under container orchestration is unverified (§10.9).
- Whether the `express.static` gap is a known, intentional limitation (e.g., served by an external reverse proxy in the real deployment target) or an unintentional bug — the repository provides no operator documentation resolving this either way.

# Questions for Next Planning Phase
- What is the intended production topology for serving `dist/` — should the Express server serve static assets itself, or is a reverse proxy/CDN assumed to sit in front of it?
- Should the frontend edit→export desynchronization (§7.11) be fixed as a prerequisite for any richer-PRD or ProductSpec work, or is it explicitly out of scope for the next phase?
- Is the current PDF exporter (hand-rolled, 50-line cap) expected to be replaced/extended before richer, longer documents are introduced, or is a different export path planned for those cases?
- Should `productDetails` remain entirely uninterpreted (per the deterministic-only ADR), or is a future phase expected to revisit that ADR to allow structured/derived content (which the current generators do not support)?
- Is npm workspaces (formal package boundaries for `shared`/`server`/`web`) an anticipated need for planned work, or should the current single-package structure be preserved?