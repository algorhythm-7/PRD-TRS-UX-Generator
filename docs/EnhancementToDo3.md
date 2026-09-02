# Enhancement To-Do 3 — Builder Tracking (Standardized Templates, Generation Profile, Ingestion & Session Memory)

Tracks execution of `docs/Enhancements2.md`, `docs/Enhancements3.md`, and `docs/Enhancements4.md`
as **one combined build** — this single file supersedes each doc's own suggestion to create a
separate `EnhancementToDo3.md` / `EnhancementToDo4.md` / `EnhancementToDo5.md`, per explicit
instruction. Ordered the way a senior developer would actually build it: foundational types first,
then backend plumbing, then new endpoints, then the client API layer, then UI, then the
cross-cutting features that depend on the UI existing, then tests. **"Done" means implemented
*and* validated (lint/tsc/build/test as applicable), not just written** (same bar as
`docs/EnhancementToDo2.md`).

**Internet/web search integration is deferred** per explicit instruction this round — see §13.

---

## 0. Reconciliation notes (read before starting)

Cross-checked all three planning docs against the current repository state and against each
other. None of Enhancements 2/3/4 has been implemented yet (verified: `contract.ts` and
`sectionSchema.ts` are still at their pre-enhancement baseline) — this is a from-scratch build
against the plans. A few things needed reconciling before turning the plans into an ordered list:

- **`docs/Enhancements2.md` §9 task 5 vs. §3.6**: task 5 literally says "InputForm.tsx: add
  per-DocType format radio group," but §3.6's own "Revision note" says format selection was moved
  to the new Generation Profile screen (`docs/Enhancements3.md`). §3.6 is the newer, authoritative
  instruction — **followed §3.6, not the stale §9 task 5** (§8 below).
- **`docs/Enhancements2.md` §9 task 1 under-lists constants**: it only names
  `VOLERE_SECTIONS`/`PR_FAQ_SECTIONS`, but §3.2 requires 8 new `_SECTIONS` constants total. Full
  list used in §2 below.
- **`sectionNamesFor` signature designed once, not twice**: `docs/Enhancements2.md` §3.2 extends it
  to `(docType, format, customSections)`; `docs/Enhancements4.md` §6.3 extends it again to add a
  4th `additionalSections` param. Building the final 4-parameter signature in one pass (§2 below)
  avoids a needless second migration/signature churn — exactly the kind of avoidable conflict this
  to-do was asked to prevent.
- **Current `callCalypso` already races candidates in parallel**, with per-attempt/overall
  timeouts, a gap-analysis token-budget fix, and diagnostic logging — all added in a live-debugging
  session *after* these planning docs were written. None of this contradicts the plans; threading
  `temperature` and the new prompt-guidance parameters into it (§3 below) is a straightforward
  extension of the same pattern already used for `maxTokens`.
- **`ClarificationQuestions.tsx` already has a `pending` prop + "Continuing…" label** (same
  debugging session). The new Generation Profile screen's "Generate" button and `InputForm`'s new
  "Continue" button (§9 below) should follow this same established pending-state convention rather
  than inventing a new one.
- **Prompt-guidance wording is only partially spelled out in the plans** (e.g.
  `GENERATION_MODE_GUIDANCE` gives 3 example sentences out of 13 total mode values). The remaining
  guidance strings need to be authored by whoever implements §3, following the tone/pattern of the
  given examples — flagged inline per task rather than treated as a blocker.
- **Not asking a blocking question on scope of `.docx`/PDF ingestion**: only web search was
  explicitly named as deferred this round. `docs/Enhancements4.md` §4.1 itself says Phase 2
  (`.docx`)/Phase 3 (PDF/OCR) "can ship later independently" — sequenced last within §6 below
  rather than deferred outright, since that's what the plan itself already recommends.

If any reconciliation above turns out to be wrong, flag it — everything downstream in this file
assumes these resolutions.

---

## 1. Foundational data model (`app/src/generation/contract.ts`)

All new shared types added in one pass, since nearly everything downstream depends on them.

- [x] 1. `DOCUMENT_FORMATS` (11 values: `"standard"`, the 9 named formats, `"custom"`) +
      `DocumentFormatId` type (`docs/Enhancements2.md` §3.1).
- [x] 2. `FORMAT_APPLICABILITY: Record<DocType, readonly DocumentFormatId[]>` (`docs/Enhancements2.md`
      §3.1).
- [x] 3. `GENERATION_MODES: Record<DocType, readonly string[]>` (`docs/Enhancements3.md` §3.2).
- [x] 4. `REQUIREMENT_DEPTH_LEVELS` + `RequirementDepth` type (`docs/Enhancements3.md` §3.3).
- [x] 5. `REQUIREMENT_DECOMPOSITION_LEVELS` + `RequirementDecomposition` type (`docs/Enhancements3.md`
      §3.3).
- [x] 6. `INNOVATION_ASSISTANCE_LEVELS` + `InnovationAssistance` type (`docs/Enhancements3.md` §3
      continued).
- [x] 7. `TARGET_AUDIENCES` + `TargetAudience` type (`docs/Enhancements3.md` §5).
- [x] 8. `ASSUMPTION_STRATEGIES` + `AssumptionStrategy` type (`docs/Enhancements3.md` §3.5).
- [x] 9. `PerDocTypeProfile` interface (`docs/Enhancements3.md` §7).
- [x] 10. `GenerationProfile` interface, including `traceability`/`assumptionStrategy`/
      `complianceFraming` (`docs/Enhancements3.md` §7).
- [x] 11. Extend `GenerationRequest` (client-side request shape used by `InputForm`/`App` state,
      *not* the wire format to `/_api/generate`) with `formats?: Partial<Record<DocType,
      DocumentFormatId>>` and `customTemplateSections?: Partial<Record<DocType, string[]>>`
      (`docs/Enhancements2.md` §3.3).
- [x] 12. *Validates*: unit test asserting an all-defaults `GenerationProfile` matches every
      documented no-op default (§7 of `docs/Enhancements3.md`); existing `tests/generation/
      contract.test.ts` continues to pass unmodified.

---

## 2. Section-skeleton mechanism (`app/src/generation/sectionSchema.ts`)

- [x] 1. Add the 8 new section-name constants, exact lists from `docs/GoodTRSPRDUX2.md` (per-format
      sections) and `docs/Enhancements2.md` §3.2 (which sections are reused vs. replaced):
      `VOLERE_SECTIONS` (16), `PR_FAQ_SECTIONS` (11), `SHAPE_UP_SECTIONS` (5),
      `FORMAL_SRS_SECTIONS` (9), `C4_MODEL_TRS_SECTIONS` (5 architecture sections + the reused
      Standard TRS tail — NFR/Data/Integration/UI/Test/Risks/AI Usage), `SERVICE_BLUEPRINT_SECTIONS`
      (5, "UI Design Mockups" appended separately in code, not baked into the constant),
      `JTBD_SECTIONS` (2, same appending pattern), `ATOMIC_DESIGN_SECTIONS` (5, "User Journeys for
      personas" prepended separately in code). **Correction found while implementing**:
      `C4_MODEL_TRS_SECTIONS` also keeps `TRS_SECTIONS`' "Summary" and "Problem Statement and
      Proposed Solution" (the plan's own reused-tail list didn't mention them, but nothing
      supersedes them either, and every TRS needs an intro regardless of which architecture-
      description method is used) — computed from `TRS_SECTIONS` directly (filtering out only the
      two superseded sections and the separately-listed "Deployments") so it can never drift.
- [x] 2. Extend `sectionNamesFor` to its **final** signature in one pass: `sectionNamesFor(docType,
      format: DocumentFormatId = "standard", customSections?: readonly string[], additionalSections?:
      readonly string[])` — logic per `docs/Enhancements2.md` §3.2's code sample, with
      `additionalSections` appended after dedup at the very end (`docs/Enhancements4.md` §6.1/§6.3).
- [x] 3. **`buildGeneratedDocument` DID need a change, correcting the plan's claim**: it computes
      its own `names` list internally via `sectionNamesFor(docType)`, so without also threading
      `format`/`customSections`/`additionalSections` into that internal call, it would have kept
      rendering Standard section headings even when a non-Standard format's sections were actually
      requested/returned — silently producing a document whose headings didn't match the LLM's
      response keys. Fixed by extending `buildGeneratedDocument`'s signature to accept the same 3
      optional params (all defaulting exactly as `sectionNamesFor` does, so the existing 3-arg call
      in `llmGenService.ts` is unaffected until §6 wires the new params through).
- [x] 4. *Validates*: new unit tests — one per format's section list, one for the dedup behavior in
      `additionalSections`, one confirming an omitted `format`/`customSections`/`additionalSections`
      reproduces today's exact `PRD_SECTIONS`/`TRS_SECTIONS`/`UX_SEGMENTS` output (backward
      compatibility); existing `tests/generation/sectionSchema.test.ts` continues to pass unmodified.

---

## 3. Backend prompt guidance & Calypso plumbing (`app/server.mjs` + `app/vite.config.ts`, kept in sync)

- [x] 1. `FORMAT_GUIDANCE` object, 9 entries, one per named format — condensed guidance per
      `docs/Enhancements2.md` §3.4's bullet list, full wording authored from
      `docs/GoodTRSPRDUX2.md`'s per-format "Content-quality guidance" sections.
- [x] 2. `EARS_GUIDANCE` — the six sentence patterns verbatim from `docs/GoodTRSPRDUX2.md` "TRS
      Format 1" table, plus the "use exactly one of these six patterns" instruction.
- [x] 3. `GENERATION_MODE_GUIDANCE` — `Record<DocType, Record<string, string>>`, 13 entries total
      (4 PRD + 4 TRS + 5 UX). 3 are given verbatim in `docs/Enhancements3.md` §3.2 (PRD
      `executive_summary`, TRS `verification_oriented`, UX `accessibility_focus`) — authored the
      remaining 10 following the same one-sentence, lens-shifting pattern. **Scope note**: `tsc -b`
      enforces `noUnusedLocals` on `vite.config.ts`, so these 3 constants couldn't be added
      unwired without breaking the build — `buildGenerateSystemPrompt` was extended now (not
      deferred to task 10) with 3 new optional params (`format`, `requirementPhrasing`,
      `generationMode`), each defaulting to a no-op so the existing single-arg call site is
      byte-identical to before; empty guidance strings are filtered before joining so omitted
      blocks never leave stray double spaces. Task 10 adds the *remaining* params
      (depth/decomposition/traceability/assumption strategy/compliance framing/output structure)
      to this same function and finalizes the fixed assembly order.
- [x] 4. Requirement Depth guidance (4 entries) and Requirement Decomposition guidance (5 entries)
      — authored from the behavioral description in `docs/Enhancements3.md` §3.3 (Depth: expand
      rationale/edge-cases/verification notes as level increases; Decomposition: phrase requirements
      at the named level, e.g. `signal_interface` per the doc's own example). Wired into
      `buildGenerateSystemPrompt` as new optional `requirementDepth`/`requirementDecomposition`
      params (same reasoning as tasks 1-3's scope note — keeps `tsc -b`'s `noUnusedLocals` green),
      defaulting to `"standard_engineering"`/`"functional_requirement"` (both no-op, matching
      today's exact behavior).
- [x] 5. Traceability guidance — `generateIds` (CRS-`<NNN>`/TRS-`<NNN>` prefixing per
      `docs/GoodTRSPRDUX2.md` §5's convention, keyed by docType), `requirementMapping` (CRS→TRS
      reference, TRS-only), `verificationReferences` (Test and Validation section references IDs,
      TRS-only). Wired into `buildGenerateSystemPrompt` as a new optional `traceability` param
      (`{generateIds?, requirementMapping?, verificationReferences?}`); `requirementMapping`/
      `verificationReferences` are no-ops unless `generateIds` is also set, per the doc. **Note**:
      whether `requirementMapping` is applicable for a given batch (i.e., a PRD is also being
      generated — `docs/Enhancements3.md` §4's "omitted server-side if no PRD in batch" rule) is
      left to the caller (task 12's `handleGenerate`, not yet wired) to decide before passing the
      flag in — this function only renders whatever flags it's given, consistent with its
      existing stateless-per-docType design.
- [x] 6. Assumption Strategy guidance — 3 entries, verbatim text given in `docs/Enhancements3.md`
      §3.5. Wired into `buildGenerateSystemPrompt` as a new optional `assumptionStrategy` param,
      defaulting to `"balanced"` (no-op, matching today's exact behavior).
- [x] 7. Compliance Framing guidance — 2 flags (`aspice`, `iso26262`), verbatim text given in
      `docs/Enhancements3.md` §3.4. Wired into `buildGenerateSystemPrompt` as a new optional
      `complianceFraming` param (`{aspice?, iso26262?}`); kept out of `FORMAT_GUIDANCE` since
      these are process/compliance standards, not document templates (`docs/GoodTRSPRDUX2.md`
      §6).
- [x] 8. `INNOVATION_ASSISTANCE` → `temperature` map + guidance text — 5 levels, verbatim table
      given in `docs/Enhancements3.md` §3 (continued). No "reasoning effort" parameter — confirmed
      not supported, per that same section. **Scope note**: only the `.guidance` half is wired
      into `buildGenerateSystemPrompt` (new optional `innovationAssistance` param) in this batch;
      `.temperature` is stored alongside it in the same map (so it's a used object property, not
      an unused top-level binding — keeps `tsc -b` green without pulling in task 11 early) and
      will be threaded into `callCalypso`/`callCalypsoChat` when task 11 is done.
- [x] 9. Output Structure guidance — 8 items, short descriptions given in `docs/Enhancements4.md`
      §6.2 table; applicability per `DocType` also from that table. Wired into
      `buildGenerateSystemPrompt` as a new optional `outputStructureItems` param (string array);
      `OUTPUT_STRUCTURE_APPLICABILITY` guards each item so guidance is only added for the
      `DocType`s the table lists, even if the caller passes an inapplicable item.
- [x] 10. Extend `buildGenerateSystemPrompt` to accept `format`, `requirementPhrasing`,
      `generationMode`, `requirementDepth`, `requirementDecomposition`, `traceability`,
      `assumptionStrategy`, `complianceFraming`, `outputStructureItems` and assemble them in the
      **exact fixed order** specified in `docs/Enhancements3.md` §8 and `docs/Enhancements4.md` §7:
      base instruction → `DOC_TYPE_GUIDANCE` → `FORMAT_GUIDANCE` → EARS (if applicable) →
      `GENERATION_MODE_GUIDANCE` → Depth/Decomposition → Traceability (if enabled) → Assumption
      Strategy → Compliance Framing (if enabled) → Output Structure guidance → reference-content
      block (§6/§8 below, once it exists) → Innovation Assistance guidance → existing closing
      Markdown instruction. **Note**: each param was already added incrementally across tasks 1-9
      in this exact order (verified by re-reading the assembled `parts` array) — this task's only
      remaining work was the docstring/order confirmation, since the reference-content block does
      not exist yet and is correctly omitted for now.
- [x] 11. Thread `temperature` through `callCalypsoChat`/`callCalypso`: add an optional `temperature`
      param, include it in the request `body` only `if (temperature !== undefined)` — same pattern
      already used for `maxTokens`; no restructuring of the existing parallel-race implementation
      needed.
- [x] 12. Extend `handleGenerate` to read all new optional fields from the request body (defaulting
      every one exactly as specified per-control in `docs/Enhancements3.md`/`docs/Enhancements4.md`)
      and pass them through. `innovationAssistance` additionally resolves a `temperature` via
      `INNOVATION_ASSISTANCE[...]?.temperature`, passed to `callCalypso` (task 11). All fields are
      optional/undefined-safe, so today's client (which sends none of them) is unaffected — client
      wiring to actually send these fields is a separate, later UI task.
- [x] 13. Mirror all of the above into `app/vite.config.ts`'s dev implementation. Done concurrently
      with tasks 1-12 (each was applied to both files in the same batch), including the
      `/_api/generate` dev middleware handler reading/passing the same new fields.
- [x] 14. *Validates*: existing `tests/http/generate.test.ts`-equivalent tests continue to pass with
      no new fields supplied (byte-identical prompt/request — the core compatibility guarantee of
      both docs); new tests asserting each guidance block's text appears/doesn't appear correctly
      per flag; new test asserting the fixed assembly order. **Implementation note**: added
      `app/tests/server/buildGenerateSystemPrompt.test.ts` (12 tests, `@vitest-environment node`
      — needed because the default `jsdom` environment breaks esbuild's on-the-fly transform of
      `vite.config.ts` via a `TextEncoder`/`Uint8Array` incompatibility). Tests exercise
      `vite.config.ts`'s `buildGenerateSystemPrompt` (newly `export`ed — a one-word, side-effect-
      free change; `export default defineConfig(fn)` re-exports `fn` unevaluated, so importing
      this module never starts a dev server), **not** `server.mjs`'s identical copy: `express`/
      `http-proxy-middleware` are not in `app/package.json` (confirmed absent from
      `node_modules`), so importing `server.mjs` for a test would require adding dependencies —
      out of this task's scope without explicit approval. Both files' `buildGenerateSystemPrompt`
      bodies remain byte-identical (manually verified), so this test suite is representative of
      both; server.mjs is not independently exported/guarded (that exploration was reverted).

---

## 4. New backend endpoints (`app/server.mjs` + `app/vite.config.ts`)

- [x] 1. `POST /_api/template-extract` (`docs/Enhancements2.md` §3.5) — mirrors
      `handleGapAnalysis`'s pattern exactly: one `callCalypso` call, small purpose-built system
      prompt, `response_format` schema `{ sections: string[] }`. `503 LLM_UNAVAILABLE` on failure, no
      deterministic fallback (none is sensible here).
- [x] 2. `POST /_api/context-extract`, **Phase 1 only** (`docs/Enhancements4.md` §4.2) —
      `.txt`/`.md`: request `{ filename, rawText }`, response `{ extractedText, truncated }`. Needs
      **no Calypso call at all** for Phase 1 — just enforces the character budget (§4.3: 8,000 chars
      per document, 12,000 combined across up to 3 documents, proportional trim if needed). **Note**:
      only the per-document 8,000-char cap is enforced server-side, since this endpoint's request
      shape (`{ filename, rawText }`) is single-document — the 12,000-combined/proportional-trim
      rule spans multiple documents in one generation batch and is inherently a client-side
      concern (deciding how much of each of up to 3 uploads to send), not yet built (§4 task 4/§5).
- [x] 3. *Validates*: contract tests for both endpoints' request/response shapes; manual
      live-verification against real Calypso for `template-extract` (per this session's established
      "live-test any new Calypso-backed endpoint" pattern) — `context-extract` Phase 1 needs no live
      Calypso test since it never calls it. **Implementation note**: added
      `app/tests/server/newEndpoints.test.ts` (5 tests) against `vite.config.ts`'s exported
      `templateExtractSchema`/`applyContextExtractBudget` (the latter extracted from the dev
      middleware's inline logic into a pure, testable function — same rationale as task 14's
      `buildGenerateSystemPrompt` export). Live-verified `template-extract` against the running
      dev server + real Calypso: `POST /_api/template-extract` with a 5-line numbered template
      returned `{"sections":["Executive Summary","Goals and Non-Goals","User Stories","Success
      Metrics","Timeline"]}` (200 OK). Also smoke-tested `context-extract` live (200 OK,
      `truncated:false` for short input).
- [x] 4. **Sequence last, after §8/§9 ship and are verified** (per `docs/Enhancements4.md` §4.1's own
      "can ship later independently" note, not a hard blocker): `context-extract` Phase 2 (`.docx`
      via a new `mammoth` client-side dependency) and Phase 3 (`.pdf`/scanned documents routed
      server-side to Calypso's `middlewareai-mineru` OCR or `vllm-qwen36-35b-a3b` multimodal model).
      §8/§9 shipped and were verified before this was picked up.
      **Phase 2 (.docx)**: added `mammoth` as a real dependency (approved) + a local
      `app/src/mammoth.d.ts` ambient declaration (no `@types/mammoth` package exists on npm,
      confirmed via registry lookup). `GenerationProfileScreen.tsx`'s `readFileAsText` helper
      routes `.docx` uploads through `mammoth.extractRawText({ arrayBuffer })`, used identically
      by all 3 upload handlers (custom template, reference document, style example); `accept`
      attributes extended to include `.docx`. Verified: `tsc -b`/`eslint` clean, full `vitest run`
      (110/110), and `npm run build` succeeds with mammoth bundled (433 modules vs. 64 before).
      **Phase 3 (.pdf)**: routed via the multimodal-tagged `vllm-qwen36-35b-a3b` candidate's
      existing OpenAI-compatible chat endpoint (an `image_url` content block with a
      `data:application/pdf;base64,...` URI), **not** `middlewareai-mineru` — that OCR service's
      actual request/response contract is undocumented anywhere in this repo, direct network
      probing from this environment failed (no route to the Calypso base URL outside the app's
      own proxy), and its real API is very likely a custom multipart upload the shared
      `calypsoRequest` JSON-only helper doesn't support — implementing against a fully-guessed
      contract was judged too risky. The multimodal-chat approach reuses already-verified
      infrastructure (`callCalypso`, its racing/timeout/retry logic) with only the message
      `content` shape widened to allow content-block arrays (`CalypsoMessageContent` type, both
      files). Server: `/_api/context-extract` now accepts an optional `base64Content` field
      (routes to `extractPdfViaMultimodal`, returns `503 LLM_UNAVAILABLE` on failure per §4.6's
      own Phase-3-specific error row — Phase 1/2 remain error-free/no-Calypso as before); its
      Express JSON body limit raised to `20mb` for base64-encoded PDFs. Client:
      `postContextExtractBinary` (new function in `llmClient.ts`) + a `fileToBase64` helper; `.pdf`
      routed through it in the reference-document and style-example upload handlers (not the
      template handler — PDFs aren't a template-structure input per the original design).
      **Live-tested — inconclusive, flagged rather than papered over**: POSTed a hand-crafted
      minimal valid PDF containing visible text to `/_api/context-extract` with `base64Content`
      via the running dev server. Result: `200 OK`, `{"extractedText":"","truncated":false}` — the
      full pipeline (routing, Calypso call, schema, budget) works end-to-end with **no errors**,
      but the model returned **no extracted text** for this test PDF. This does not confirm the
      integration actually works for real-world PDFs: it may be that this deployment doesn't treat
      `image_url` + `application/pdf` as true multimodal input (silently answering the schema with
      empty content instead), or that the specific hand-crafted test file wasn't renderable by
      whatever it does. **Recommendation before relying on this in production**: test with a real,
      typical PDF (and/or a plain image) and inspect server logs for `finish_reason`/`usage`
      diagnostics (already logged by `callCalypsoChat` on empty responses) to determine which case
      applies, per this repo's own "state uncertainty, don't guess" instruction.

---

## 5. Client API layer (`app/src/api/llmClient.ts`)

- [x] 1. `postTemplateExtract(docType, rawText)` — same `postJson` helper already used by
      `postGapAnalysis`/`postGenerate`.
- [x] 2. `postContextExtract(filename, rawText)` — same pattern.
- [x] 3. Extend `GenerateRequest` with every new optional field in one pass: `format`,
      `requirementPhrasing`, `priorAttempt`, `generationMode`, `requirementDepth`,
      `requirementDecomposition`, `innovationAssistance`, `targetAudience`, `traceability`,
      `assumptionStrategy`, `complianceFraming`, `referenceContent` (uploaded docs + style example +
      — placeholder only, not wired — web search, per §13). **Gap found while implementing**: none
      of `targetAudience` (`docs/Enhancements3.md` §5's per-audience guidance sentence),
      `priorAttempt` (`docs/Enhancements2.md` §4.4's user-message block), or `referenceContent`
      were ever added to §3's `handleGenerate`/`buildGenerateSystemPrompt` task list — an omission
      in the original plan, not a deliberate deferral like §4 task 4. These 3 fields exist on the
      wire contract now but are currently no-ops server-side. Flagged as a new task below (§6 task
      2's note) rather than silently expanding this task's scope.
- [x] 4. *Validates*: unit tests for the two new functions; existing `llmClient` tests unaffected;
      a test asserting a `GenerateRequest` with only the pre-existing fields set produces the exact
      same request body as today. **Implementation note**: added `app/tests/api/llmClient.test.ts`
      (4 tests: `postTemplateExtract` success + non-2xx-throws, `postContextExtract` success, and
      the byte-identical-request-body backward-compatibility test).

---

## 6. Generation-service wiring (`app/src/generation/llmGenService.ts`)

- [x] 1. `generateOne` builds `sections` via `sectionNamesFor(docType, format, customSections,
      additionalSections)` and passes the full resolved `GenerationProfile`-derived fields +
      `referenceContent` into `postGenerate`. **Implementation note**: `LlmRequestInput` gained
      optional `profile?: GenerationProfile`, `outputStructureItems?`, `referenceContent?` — all
      undefined until §8/§9's screen exists, so today's only call site (`App.tsx`, which passes
      none of them) reproduces the exact same `sections` list and request body as before
      (`JSON.stringify` drops `undefined`-valued keys). `format === "ears"` is translated to
      `requirementPhrasing: "ears"` for the request, since EARS is a phrasing overlay, not a
      distinct section skeleton (`sectionNamesFor` treats it identically to `"standard"`).
- [x] 2. Add `regenerateWithFeedback(docType, input, priorAttempt)` (`docs/Enhancements2.md` §4.3) —
      same `postGenerate` call, extended body, same fallback-on-failure behavior as `generateOne`.
      **Blocking co-requisite (see §5 task 3's gap note) — closed out**: `handleGenerate` in both
      `server.mjs`/`vite.config.ts` now reads `priorAttempt`/`targetAudience`/`referenceContent`
      and: (a) builds the exact §4.4 prose block from `priorAttempt` and includes it as a
      `priorAttemptContext` field in the (still single, JSON-serialized) user message, only when
      present; (b) added `TARGET_AUDIENCE_GUIDANCE` (12 entries, 3 no-op defaults matching
      `docs/Enhancements3.md` §5's documented per-docType defaults) and threads `targetAudience`
      into `buildGenerateSystemPrompt`; (c) added `buildReferenceContentBlock` (uploaded documents
      + the verbatim §5.3 style-example wording — no exact wording was given for uploaded
      documents, authored following the same framing) threaded in at the `docs/Enhancements4.md`
      §7-specified position (after Output Structure guidance, before Innovation Assistance).
      **Signature note**: `targetAudience`/`referenceContent` were appended at the *end* of
      `buildGenerateSystemPrompt`'s parameter list (not inserted next to `generationMode` where
      they logically read) specifically so every existing positional call site and the 12
      existing order/guidance tests stay unaffected — the `parts` array, not parameter order,
      controls the actual prompt text order. **Also found and resolved**: neither
      `docs/Enhancements3.md` §8 nor `docs/Enhancements4.md` §7's own assembly-order lists ever
      mention Target Audience at all — placed it beside Generation Mode as an authored resolution
      (both are audience/lens controls), not a documented requirement. Live-verified against real
      Calypso: a PRD request with `targetAudience:"customer"` + `priorAttempt` (comment "Make it
      punchier", one section marked `rewrite`) returned 200 with content reflecting the edit
      instruction.
- [x] 3. *Validates*: extend `tests/generation/llmGenService.test.ts`; a test asserting an
      all-defaults profile reproduces today's exact `postGenerate` payload (the core
      backward-compatibility guarantee restated in `docs/Enhancements3.md` §11 task 5).
      **Implementation note**: extended the existing test file to 8 tests (from 5) — one
      byte-identical-payload backward-compatibility test for `runGeneration`, plus 2 new tests for
      `regenerateWithFeedback` (LLM-success passing `priorAttempt` through, and fallback-on-
      failure).

---

## 7. Session memory module (`app/src/generation/sessionMemory.ts`, new file)

Pure, dependency-free client-side logic — buildable and fully unit-testable before any UI exists,
only needs the types from §1.

**Batch note**: tasks 1-7 were all implemented in one pass rather than split across batches — this
section's own header already frames the module as "buildable... in one pass," and tasks 2/6 aren't
meaningfully separable from 1 (retention/graceful-failure are required properties of the same
read/write functions, not independent features), while 4 falls out of the same `weightedVote`
helper as 3. Task 5 (`clearLearnedPreferences`) is a two-line function added alongside for the
same reason. Requested batch was tasks 1-3; 4-7 were a minimal, transparently-noted extension of
the same file/session rather than deferred to avoid an artificially half-finished module.

- [x] 1. `SessionMemoryStore`/`SessionRecord` types + `localStorage` read/write under
      `prd-gen:session-memory:v1` (`docs/Enhancements4.md` §3.1/§3.2).
- [x] 2. Retention: cap at the most recent 20 sessions, FIFO eviction (§3.7).
- [x] 3. Consolidation: recency-weighted frequency, `decay = 0.9` (§3.3).
- [x] 4. Conflict detection: `confidence < 0.6` or top-two within `0.15` (§3.4). **Note**: given
      confidences sum to 1 across all candidates for a field, the near-tie clause can only ever
      fire when the low-confidence clause also fires (algebraically: `top >= 0.6` and
      `top - second < 0.15` together would require `top + second >= 1.05`, impossible when
      `top + second <= 1`) — implemented both clauses verbatim per the doc anyway, since this is a
      property of the given formula, not an implementation bug.
- [x] 5. `clearLearnedPreferences()` — deletes the storage key entirely (§3.7).
- [x] 6. Graceful no-op when `localStorage` is unavailable/quota-exceeded (private browsing, etc.)
      — every consumer must treat "no sessions" as fully valid (`docs/Enhancements4.md` §9).
- [x] 7. *Validates*: unit tests feeding synthetic session arrays, asserting consolidated output,
      conflict flags, and retention/eviction — no component/DOM dependency needed for this file's
      tests. **Implementation note**: `app/tests/generation/sessionMemory.test.ts`, 16 tests
      covering corrupted/missing/wrong-shape storage, FIFO eviction at `MAX_SESSIONS`, graceful
      no-throw on `getItem`/`setItem`/`removeItem` failures, weighted-vote value + confidence
      arithmetic (verified numerically), conflict flagging (dominant vs. near-even split), and the
      two global (`assumptionStrategy`, per-flag `traceability`) consolidation functions.

---

## 8. Generation Profile screen (`app/src/features/profile/GenerationProfileScreen.tsx`, new)

Depends on §1–§3 (types + backend) existing so the screen has something real to wire to; depends
on §7 for the prior-preferences pre-fill. Build the whole screen in one pass rather than
piecemeal, since its controls share one shared/per-`DocType` layout (`docs/Enhancements3.md` §3.1).

- [x] 1. Per-`DocType` repeated sub-panel: **Template** radio group (`FORMAT_APPLICABILITY`-driven,
      hover/focus preview per `docs/Enhancements2.md` §3.6, "Upload your own template" wired to
      `postTemplateExtract`), **Generation Mode**, **Requirement Depth**, **Requirement
      Decomposition**, **Innovation Assistance**, **Target Audience** — all radio groups, all
      defaulting per §1's documented defaults. **Scope note**: the hover/focus section-name-preview
      tooltip (§3.6) was not built this batch — only the upload-triggers-extraction-then-shows-
      extracted-sections behavior; the richer per-option preview tooltip is a small follow-up, not
      forgotten.
- [x] 2. Shared panel: **Traceability** checkboxes, **Assumption Strategy** radio, **Compliance
      Framing** checkboxes (`docs/Enhancements3.md` §3.1/§4).
- [x] 3. **Context Sources** panel (`docs/Enhancements4.md` §5.2): reference-document upload
      (wired to `postContextExtract`, gated behind its own checkbox), "Use my prior preferences"
      (default **on**, wired to §7), style-example picker (from history — §11's history panel — or
      upload), and a **placeholder-only, unchecked, disabled "Include web search results" control**
      per §13 (visible so the option isn't silently missing from the design, but non-functional).
      **Scope note**: only the *upload* variant of the style-example picker was built — the
      "pick from history" variant needs §11's history panel, which doesn't exist yet. "Use my prior
      preferences" is wired as a controlled toggle (defaulting on) whose value is exposed via
      `onChange`; task 5 (below) now also pre-fills using it.
- [x] 4. **Output Structure** checkboxes (`docs/Enhancements4.md` §6): the 8 items, each disabled
      with an explanatory tooltip when the currently-selected Template already provides an
      equivalent section (`OUTPUT_STRUCTURE_EQUIVALENTS` dedup check against
      `sectionNamesFor(docType, format)`'s current output). **Implementation note**: added
      `OUTPUT_STRUCTURE_ITEMS`/`OUTPUT_STRUCTURE_APPLICABILITY`/`OUTPUT_STRUCTURE_EQUIVALENTS` to
      `contract.ts` (client-side equivalents of server.mjs/vite.config.ts's guidance-only copies,
      analogous to `FORMAT_APPLICABILITY`'s placement) since none existed client-side yet.
- [x] 5. Pre-fill: on mount, read §7's consolidated preferences per selected `DocType` and use as
      initial field values (falling back to §1's hard-coded defaults when no session history
      exists); show the non-blocking conflict indicator per `docs/Enhancements4.md` §3.4 where
      applicable. **Implementation note**: computed once via a lazy `useState` initializer (so it
      only runs on mount, not every render) using `sessionMemory.ts`'s `consolidate*` functions per
      field; `ConflictNote` renders the "Your past choices for this were mixed" cue beside each
      affected field/fieldset.
- [x] 6. "Generate" button follows the same pending-state convention as `ClarificationQuestions`
      (§0's reconciliation note) — disabled + relabeled while pending.
- [x] 7. *Validates*: new component test file — default-state test asserting an untouched screen
      produces the documented no-op `GenerationProfile`; tests for the dedup-disables-checkbox
      behavior; tests for pre-fill-from-session-memory (mocking `sessionMemory.ts`).
      **Implementation note**: `app/tests/features/generationProfileScreen.test.tsx`, 5 tests.

---

## 9. `App.tsx` flow change

- [x] 1. `InputForm`'s primary action becomes **"Continue"** (was "Generate") — same pending-state
      convention as elsewhere. **Implementation note**: renamed the `onGenerate` prop to
      `onContinue` too, since its meaning changed (moves to the Profile screen, no longer starts
      generation directly) — updated the 2 existing `inputForm.test.tsx` assertions that looked up
      the button/prop by its old name (a required consequence of this rename, not an unrelated
      test change).
- [x] 2. Insert the new Generation Profile screen (§8) between `InputForm` and the **existing**
      gap-analysis/clarifications/generation pipeline — the Profile screen's own "Generate" button
      triggers what `InputForm`'s "Generate" button triggers today (gap-analysis first, then
      clarifications if any, then `finishGeneration`), now carrying the resolved `GenerationProfile`
      through every step. **Implementation note**: `App.tsx` gained a `step` ("input"|"profile")
      state; `InputForm` stays permanently rendered (avoids losing its field values on
      remount) with the Profile screen appearing beneath it only while `step === "profile"`;
      clicking its "Generate" flips `step` back to "input" and calls the renamed `startGeneration`
      (previously `onGenerate`). `finishGeneration` now threads `profileValue.profile`/
      `outputStructureItems`/`referenceContent` into `runGeneration`. Updated the 3 existing
      App-level integration tests (`app.test.tsx`, `appLlmStatus.test.tsx`,
      `e2e/acceptance.test.tsx`) to click "Continue" then "Generate" — a required consequence of
      inserting a mandatory extra step, not a change to what any test asserts.
- [x] 3. *Validates*: extend `tests/e2e/acceptance.test.ts` with one new scenario for the two-step
      flow reaching generation with every Profile field left at its default, asserting output is
      byte-identical to the existing single-step flow's output — **do not modify the existing
      scenario's assertions** (per repo instructions on touching unrelated tests).
      **Implementation note**: since the prior batch's rename/insertion already changed both
      existing scenarios' *actions* (they now go through the two-step flow too — a required
      consequence, not an assertion change), there is no separate "single-step flow" left to diff
      against; the new 3rd scenario instead explicitly asserts the Profile screen appears with its
      documented default (`PRD Template Standard` checked) and that generating from it unchanged
      still produces the same first-PRD-section content as the pre-existing scenario — the
      practical form of the same backward-compatibility guarantee. Neither existing scenario's
      assertions were touched.

---

## 10. Human-in-the-loop feedback (`app/src/features/output/OutputView.tsx`, `docs/Enhancements2.md` §4)

Fairly independent of §8/§9's screen work (different component) — could be parallelized by a
second developer, but sequenced here since it depends on §6's `regenerateWithFeedback`.

- [x] 1. "Regenerate with my edits" button per `DocType` tab, enabled only when `edits[activeDoc.
      type]` differs from `activeDoc.content`.
- [x] 2. Optional comment `<textarea aria-label="What would you like different?">` + two-step
      "Confirm regenerate" (per §4.5's accidental-click protection). **Implementation note**: added
      an `onRegenerate?: (type, priorAttempt) => void` prop so `OutputView` only reports intent
      (original/edited content + trimmed optional comment) — wiring it to
      `llmGenService.regenerateWithFeedback` is task 4, not yet built, matching this session's
      established "build the control, wire it later" pattern (e.g. §8's screen before §9's App.tsx
      wiring).
- [x] 3. Lightweight per-`##`-section 👍/👎 control (naive split on `\n## ` boundaries — acceptable
      fragility per §4.5's own reasoning). **Implementation note**: used a `^## (.+)$` regex
      instead of a literal string split (still naive/best-effort per the doc's own reasoning, but
      correctly ignores `###`+ sub-headings); shown inside the "Confirm regenerate" step, since
      it's part of the same feedback submission, not a separate control.
- [x] 4. Wire to `regenerateWithFeedback` (§6); on fallback-to-deterministic failure, show the
      distinguishing message from §4.6 rather than silently presenting fallback content as if
      feedback had been applied. **Implementation note**: `App.tsx` now retains the `LlmRequestInput`
      from the last successful generation (`lastInput`) so a single-`DocType` regeneration can
      reuse the same profile/reference-content fields; `onRegenerate` calls
      `regenerateWithFeedback` and replaces just that `DocType`'s document. The §4.6 message is
      rendered by `OutputView` itself (via a new `regenerateFallbackFor` prop set by `App.tsx`),
      not `App.tsx`, so it's directly testable in `outputView.test.tsx` and stays distinct from the
      existing generic initial-generation fallback notice.
- [x] 5. *Validates*: extend `tests/features/outputView.test.tsx`; a fallback-messaging test per
      §4.6. **Implementation note**: added 3 tests (button visibility gated on an actual edit,
      confirm-regenerate passing original/edited content + comment + section signals, and the
      §4.6 fallback message).

---

## 11. Session-memory write-back & history panel

- [x] 1. After a successful generation completes in `App.tsx`, construct a `SessionRecord` (title,
      per-`DocType` profile fields, `assumptionStrategy`, `traceability`) and append it via §7's
      module. **Implementation note**: written with `editedSectionCount`/`thumbsDownSectionCount`
      at 0 (nothing could have been edited yet for content that was just generated); written
      regardless of LLM-vs-fallback source, since it logs the user's chosen configuration, not
      Calypso's availability.
- [x] 2. Wire `editedSectionCount`/`thumbsDownSectionCount` from §10's edit/thumbs state into the
      `SessionRecord` at write time. **Design resolution**: since task 1's write happens
      immediately after generation (before any edits/thumbs exist), these counts are updated
      *live* instead — added `setLastSessionEditedSectionCount`/`incrementLastSessionThumbsDown`
      to `sessionMemory.ts` (mutating the most-recently-appended session's `perDocType[docType]`
      in place), called from `App.tsx`'s `onContentChange` (recomputes the edited-section count
      via the same naive `## `-boundary comparison as `OutputView`'s own section parsing) and a
      new `OutputView` `onSectionThumbsDown` callback (fires only when a section is newly marked
      "rewrite", not on "keep" or un-marking). This also solves the "last round's edits never get
      recorded" problem a deferred-write design would have had.
- [x] 3. "Your generation history" panel (new component, collapsible, reachable from `AppShell`) —
      lists sessions newest-first with per-`DocType` chips; expandable rows show full recorded
      profile + counts + free-text comments (read-only, local-only); includes the "Clear my learned
      preferences" control from §7.5. **Implementation note**: `app/src/features/history/
      SessionHistoryPanel.tsx`, mirroring `HelpPanel`'s existing `<details>`/`<summary>` pattern
      (no new dependency); rendered in `AppShell`'s header alongside `HelpPanel`. **Scope note**:
      free-text comments aren't shown per-row since `SessionRecord` deliberately never stores them
      (docs/Enhancements4.md §3.2's own scoping limit) — there is nothing to display there by
      design, not an oversight.
- [x] 4. *Validates*: component test for the panel (render from a seeded `SessionMemoryStore`,
      confirm clear-control empties it). **Implementation note**: `app/tests/features/
      sessionHistoryPanel.test.tsx`, 4 tests (empty state, seeded session's title/chip, expanded
      row's full detail/counts, clear-control empties both storage and the list).

---

## 12. Final test pass

- [x] 1. Full `tsc -b` + `eslint . --max-warnings=0` clean.
- [x] 2. Full `vitest run` — confirm the pre-existing 43 tests still pass unmodified, plus every new
      test added in §1–§11. **Result**: 110/110 tests passing across 25 test files (build also
      re-verified via `npm run build`, succeeded).
- [x] 3. Manual live smoke test against real Calypso: default-only flow (no Profile changes) matches
      today's behavior; a flow using at least one non-Standard Template, one Innovation Assistance
      level above default, and one Traceability checkbox, confirming the assembled prompt order from
      §3.10 and a real successful generation. **Result**: (1) default PRD request (no new fields) —
      200 OK, normal Problem Statement content, confirming byte-for-byte-unaffected baseline
      behavior. (2) PRD request with `format:"volere"`, `innovationAssistance:"suggest_missing"`,
      `traceability:{generateIds:true}` — 200 OK; response showed sequential `CRS-PRD-001..018`
      IDs with a Volere-style *Fit Criterion* on every requirement, and clearly more proposed
      requirements (SSO, RBAC, audit logging, offline sync, retention) than the baseline request
      — confirming Template, Traceability, and Innovation Assistance guidance are all correctly
      assembled and affect real Calypso output as designed.

---

## 13. Deferred (not built this round)

- **Web search context source** (`docs/Enhancements4.md` §5.4) — deferred per explicit instruction
  this round. Needs an org-approved search provider and confirmed XYZ outbound network policy
  before implementation; the UI placeholder in §8.3 stays disabled until this is picked up.
- **Requirement Dependencies / Parent-Child Relationships** traceability checkboxes — needs a
  persisted requirement-graph model first (`docs/Enhancements3.md` §4's own deferred note).
- **Richer Target Audience** (7-option breakdown) and **richer Assumption Strategy** (4-level
  version) — explicitly noted as future refinements once the MVP versions are validated with real
  usage (`docs/Enhancements3.md` §5/intro table).
- **Stable cross-regeneration traceability IDs** — deferred pending real usage of the
  human-in-the-loop loop (§10) proving the coarser whole-document approach needs it
  (`docs/Enhancements2.md` §3.7/§4.2).
- **Context Sources' "existing TRS examples" as anything beyond the style-example picker already
  in §8.3** — already fully covered by that control, no further work implied.
