# Enhancements 2 — Standardized Templates + Human-in-the-Loop Feedback

Companion to [`docs/GoodTRSPRDUX2.md`](./GoodTRSPRDUX2.md) (format research/content-quality
research) and extends [`docs/GoodTRSPRDUX.md`](./GoodTRSPRDUX.md) (existing Standard-format
research). This is a **planning document only** — no code has been written for this round; see
§9 for the task breakdown a builder should follow.

## Scope of this round

The user's original notes described six pillars: (1) Creativity/temperature control, (2)
Human-in-the-loop feedback + editable output, (3) Standardized output templates, (4)
Document/context ingestion pipeline, (5) Session memory & preference learning, (6) Pre-generation
configuration. A clarifying-question round with the user confirmed this round should **fully
architect only pillars 2 and 3**. Pillars 4 and 5 are covered only as short deferred notes in §10.

**Revision note**: pillars 1 and 6 were originally deferred here too, but a follow-up round asked
for them to be fully architected as well — they are now specified in full in
[`docs/Enhancements3.md`](./Enhancements3.md), which also supersedes this document's §10.1 (pillar
1) note and folds pillar 3's format-selection UI (§3.6) into its "Generation Profile" screen.

---

## 1. Goal

Add two related capabilities to the generator, without changing its existing behavior when
neither is used:

1. **Standardized Output Templates** (pillar 3) — let the user pick, per document type, one of:
   the app's existing Standard section structure (default, unchanged), one of 3 researched named
   formats specific to that document type (9 total — see `docs/GoodTRSPRDUX2.md`), or their own
   uploaded custom template — presented as a radio-button choice with a hover/focus preview of each
   option, per the user's explicit request.
2. **Human-in-the-Loop Feedback + Editable Output** (pillar 2) — let the user edit generated
   content (already possible today) and then explicitly **regenerate using their edits as a
   learning signal**, plus lightweight per-section thumbs up/down, instead of the edit being a
   dead end that's only used for export.

Desired outcome: both features are purely additive to the existing request/response contracts —
every existing test, every existing default code path, and every existing export/preview
behavior continues to work unchanged when a user never touches either feature.

---

## 2. Current State (verified from the repository)

### 2.1 Generation pipeline

- `app/src/generation/contract.ts` defines `GenerationRequest`, `DocType`, `DOC_TYPES`.
- `app/src/generation/sectionSchema.ts` is the single source of truth mapping a `DocType` to its
  ordered section-name list (`sectionNamesFor`) and rendering LLM-returned section content back
  into the same Markdown shape the deterministic generators produce (`buildGeneratedDocument`).
  Section lists today are fixed per `DocType`, sourced from `PRD_SECTIONS` (`prdGen.ts`),
  `TRS_SECTIONS` (`trsGen.ts`), `UX_SEGMENTS` (`uxGen.ts`).
- `app/src/generation/llmGenService.ts`'s `generateOne()` calls `postGenerate({ docType,
  productTitle, productDetails, answers, clarifications, sections: sectionNamesFor(docType) })`,
  falls back to the matching deterministic builder (`buildPrd`/`buildTrs`/`buildUx`) on any
  failure.
- `app/server.mjs` / `app/vite.config.ts` (duplicated, kept in sync — see `AGENTS.md`/prior
  session notes on why `server.mjs` cannot import other files) implement `handleGenerate`:
  reads `{ docType, productTitle, productDetails, answers, clarifications, sections }` from the
  request body, builds a per-`docType` system prompt via `buildGenerateSystemPrompt(docType)`
  (which pulls condensed guidance from the `DOC_TYPE_GUIDANCE` object), calls
  `generateSchema(sections)` to build a JSON-schema `response_format` from the **caller-supplied
  section list** (already fully generic — no schema change needed to support new formats), and
  returns `{ sections: result }`.
- `app/src/features/output/OutputView.tsx` renders `GeneratedDocument.content` (a single joined
  Markdown string) in a two-pane Edit/Preview layout, keeping unsaved edits in local `edits` state
  keyed by `DocType`, reset whenever `documents` prop changes (i.e., on every regeneration).
- `app/src/features/input/InputForm.tsx` collects `productTitle`, `productDetails`,
  `selectedTypes`, and small per-`docType` `GUIDED_QUESTIONS` answers; calls `onGenerate(request)`
  after `validate()` passes.

### 2.2 What's already reusable (per "Existing Code First")

- `generateSchema(sections)` (backend) already takes an arbitrary section-name array — no format
  awareness needed there.
- `sectionNamesFor`/`buildGeneratedDocument` (frontend) already isolate "what sections exist" from
  "how the document is rendered" — the exact seam needed to add new formats.
- `DOC_TYPE_GUIDANCE` + `buildGenerateSystemPrompt` (backend) already isolate "prompt guidance
  text" from "prompt assembly" — the exact seam needed to add per-format guidance blocks.
- The gap-analysis endpoint already demonstrates the "send text to Cluster, get back a small
  structured JSON result via `response_format`" pattern this plan reuses for template-section
  extraction (§3.5) — no new backend pattern is introduced, only a new instance of an existing one.
- `OutputView`'s existing `edits` state (keyed by `DocType`, defaulting to `activeDoc.content`) is
  already exactly "original vs. edited content" — reused directly for feedback capture (§4) instead
  of introducing a new parallel state shape.

### 2.3 Relevant tests

- `tests/shared/contract.test.ts`, `tests/shared/naming.test.ts`, `tests/shared/validate.test.ts`
  cover the shared contract/validation layer that both new features extend.
- `tests/app/genService.test.ts` covers `generate()`/deterministic generation.
- `tests/web/outputView.test.tsx`, `tests/web/inputForm.test.tsx` cover the two UI components both
  features touch.
- `tests/http/generate.test.ts` covers the `/_api/generate` contract (request/response shape).
- `tests/e2e/acceptance.test.ts` is the full-flow acceptance test that must keep passing unchanged
  when neither new feature is used.

---

## 3. Standardized Output Templates (Pillar 3)

### 3.1 Format identity model

**Revision note**: this section originally modeled 5 format values shared loosely across document
types (`standard`/`volere`/`ears`/`pr_faq`/`custom`). Following a clarifying-question round, the
user asked for **9 fully distinct, doc-type-specific standards** (research in
`docs/GoodTRSPRDUX2.md`, revised) — the model below replaces that draft.

```ts
// app/src/generation/contract.ts (extend)
export const DOCUMENT_FORMATS = [
  "standard",
  // PRD-only
  "volere", "pr_faq", "shape_up",
  // TRS-only
  "ears", "formal_srs", "c4_model",
  // UX-only
  "service_blueprint", "jtbd", "atomic_design",
  "custom",
] as const;
export type DocumentFormatId = (typeof DOCUMENT_FORMATS)[number];

export const FORMAT_APPLICABILITY: Record<DocType, readonly DocumentFormatId[]> = {
  PRD: ["standard", "volere", "pr_faq", "shape_up", "custom"],
  TRS: ["standard", "ears", "formal_srs", "c4_model", "custom"],
  UX: ["standard", "service_blueprint", "jtbd", "atomic_design", "custom"],
};
```

`FORMAT_APPLICABILITY` replaces the old ad-hoc per-`DocType` conditionals — one explicit map is the
single source of truth for which radio options render per `DocType` (§3.6) and which format IDs
`sectionNamesFor` accepts per `DocType` (§3.2). No format is shared across document types (per the
user's explicit preference over reusing Volere for both PRD and TRS).

**Per-`DocType` applicability** (see `docs/GoodTRSPRDUX2.md` "Overview" table for full research):

| DocType | Format 1 | Format 2 | Format 3 |
|---|---|---|---|
| PRD | Volere (16 sections) | Amazon PR/FAQ (11 sections) | Shape Up Pitch (5 sections) |
| TRS | EARS (phrasing overlay only) | Formal SRS Outline (9 sections) | C4 Model (6 sections, partial reuse) |
| UX | Service Blueprint (6 sections, partial reuse) | Jobs-to-Be-Done (3 sections, partial reuse) | Atomic Design (6 sections, partial reuse) |

`ears` is the only format that doesn't change the section list at all (`docs/GoodTRSPRDUX2.md`
"TRS Format 1" — EARS is a phrasing overlay, not a skeleton); `c4_model`, `service_blueprint`,
`jtbd`, and `atomic_design` each replace only *part* of their Standard skeleton and reuse the rest
(documented per-format in `docs/GoodTRSPRDUX2.md`), since each of those methods only has something
useful to say about part of the document. `volere`, `pr_faq`, and `shape_up` each fully replace the
PRD section list (they are complete alternative document shapes, not partial overlays).

### 3.2 Section-skeleton source of truth

Extend the existing seam rather than introduce a parallel one:

```ts
// app/src/generation/sectionSchema.ts (extend signature, backward compatible)
export function sectionNamesFor(
  docType: DocType,
  format: DocumentFormatId = "standard",
  customSections?: readonly string[],
): readonly string[] {
  if (format === "custom") return customSections ?? sectionNamesFor(docType); // fallback if none supplied yet

  // Full-replacement PRD formats
  if (format === "volere") return VOLERE_SECTIONS;
  if (format === "pr_faq") return PR_FAQ_SECTIONS;
  if (format === "shape_up") return SHAPE_UP_SECTIONS;

  // TRS formats
  if (format === "formal_srs") return FORMAL_SRS_SECTIONS;
  if (format === "c4_model") return C4_MODEL_TRS_SECTIONS; // architecture sections + reused Standard tail (see below)
  // "ears" falls through — phrasing overlay only, sections unchanged

  // UX formats — each replaces only part of UX_SEGMENTS
  if (format === "service_blueprint") return [...SERVICE_BLUEPRINT_SECTIONS, UX_SEGMENTS[1]]; // + "UI Design Mockups"
  if (format === "jtbd") return [...JTBD_SECTIONS, UX_SEGMENTS[1]];
  if (format === "atomic_design") return [UX_SEGMENTS[0], ...ATOMIC_DESIGN_SECTIONS]; // "User Journeys..." + atomic tiers

  if (docType === "PRD") return PRD_SECTIONS;
  if (docType === "TRS") return TRS_SECTIONS;
  return UX_SEGMENTS;
}
```

`C4_MODEL_TRS_SECTIONS` is `["System Context", "Containers", "Components", "Dynamic Scenarios",
"Deployment", ...TRS_SECTIONS.slice(/* NFR, Data, Integration, UI, Test, Risks, AI Usage */)]` —
the exact reused subset is specified in `docs/GoodTRSPRDUX2.md` "TRS Format 3" §6. All nine new
`_SECTIONS` constants (`VOLERE_SECTIONS`, `PR_FAQ_SECTIONS`, `SHAPE_UP_SECTIONS`,
`FORMAL_SRS_SECTIONS`, `C4_MODEL_TRS_SECTIONS`, `SERVICE_BLUEPRINT_SECTIONS`, `JTBD_SECTIONS`,
`ATOMIC_DESIGN_SECTIONS`) are the exact lists specified per-format in `docs/GoodTRSPRDUX2.md`,
defined as new exported `const` arrays in `sectionSchema.ts`, alongside the existing
`PRD_SECTIONS`/`TRS_SECTIONS`/`UX_SEGMENTS` imports. `buildGeneratedDocument` needs **no change** —
it already renders an arbitrary ordered section list generically (see current-state note in §2.2),
so every format's content renders through the identical numbered-heading Markdown path as Standard
content, keeping `OutputView`, `ExportControls`, and `exportService.ts` completely unaffected.

### 3.3 Request/response contract changes

Additive-only fields on the existing shapes — omitting them entirely reproduces exactly today's
behavior:

```ts
// GenerationRequest (contract.ts) — used by InputForm / App state, not sent directly to the LLM endpoints
formats?: Partial<Record<DocType, DocumentFormatId>>;          // per-docType format choice
customTemplateSections?: Partial<Record<DocType, string[]>>;   // populated after §3.5 extraction

// GenerateRequest (llmClient.ts) — sent to POST /_api/generate
format?: DocumentFormatId;        // defaults to "standard" server-side if omitted
requirementPhrasing?: "prose" | "ears"; // defaults to "prose" server-side if omitted
```

`sections` (already present on `GenerateRequest`) continues to be computed client-side via
`sectionNamesFor(docType, format, customSections)` and sent as today — the backend's
`generateSchema(sections)` needs no change (§2.2).

### 3.4 Prompt changes (backend, `server.mjs` + `vite.config.ts`, kept in sync)

`buildGenerateSystemPrompt` gains two new optional parameters, mirroring the existing
`DOC_TYPE_GUIDANCE` pattern:

```ts
function buildGenerateSystemPrompt(docType, format = "standard", requirementPhrasing = "prose") {
  const guidance = DOC_TYPE_GUIDANCE[docType] ?? "";
  const formatGuidance = FORMAT_GUIDANCE[format] ?? "";       // new object, same shape as DOC_TYPE_GUIDANCE
  const phrasingGuidance = requirementPhrasing === "ears" ? EARS_GUIDANCE : "";
  return `${existing base instruction} ${guidance} ${formatGuidance} ${phrasingGuidance} ${existing closing Markdown instruction}`;
}
```

One `FORMAT_GUIDANCE` entry per named format (9 total), each condensed from the matching section of
`docs/GoodTRSPRDUX2.md`:

- `FORMAT_GUIDANCE.volere` — Fit-Criterion/Rationale guidance and the 16-section quality bar
  ("PRD Format 1").
- `FORMAT_GUIDANCE.pr_faq` — customer-voice, one-page press-release + internal/external FAQ
  guidance ("PRD Format 2").
- `FORMAT_GUIDANCE.shape_up` — appetite-as-fixed-constraint framing, concrete-but-not-full-spec
  Solution, explicit Rabbit Holes/No-gos guidance ("PRD Format 3").
- `FORMAT_GUIDANCE.formal_srs` — instructs the model to individually address all five Software
  System Attributes categories (Reliability, Availability, Security, Maintainability, Portability)
  rather than one generic NFR paragraph ("TRS Format 2").
- `FORMAT_GUIDANCE.c4_model` — instructs System Context/Containers/Components/Dynamic
  Scenarios/Deployment to each stay at their correct C4 zoom level, not collapse into one
  architecture paragraph ("TRS Format 3").
- `FORMAT_GUIDANCE.service_blueprint` — instructs Customer/Frontstage/Backstage Actions and
  Processes to each be distinct, naming concrete systems/roles, not vague restatements ("UX Format
  1").
- `FORMAT_GUIDANCE.jtbd` — instructs Job Stories to literally follow the `When/I want to/so I can`
  sentence form, and Core Jobs to address functional, social, and emotional dimensions ("UX Format
  2").
- `FORMAT_GUIDANCE.atomic_design` — instructs Molecules/Organisms to be composed explicitly from
  the Atoms already named, and Pages to use realistic representative content, not placeholders
  ("UX Format 3").
- `FORMAT_GUIDANCE.custom` — an instruction to follow the exact section list provided, inferring
  appropriate content style from the section names alone (no separate guidance text needed, since
  there's no known template to describe).
- `EARS_GUIDANCE` — the six sentence patterns from `docs/GoodTRSPRDUX2.md` "TRS Format 1", verbatim
  as an LLM instruction, plus "every functional/non-functional requirement sentence must use
  exactly one of these six patterns."
- `handleGenerate` reads `format`/`requirementPhrasing` from the request body (defaulting both if
  absent) and passes them through — a 2-line change to the existing handler, no restructuring.
- A separate, optional **Compliance Framing** flag (`aspiceIso26262Framing?: boolean` on
  `GenerateRequest`) appends a short additional instruction ("frame non-functional and safety-
  relevant requirements using ASPICE/ISO-26262-aware vocabulary where applicable") — kept
  independent of `format`/`FORMAT_GUIDANCE` on purpose, since ASPICE and ISO 26262 are process/
  compliance standards, not document templates (`docs/GoodTRSPRDUX2.md` §6), so conflating them
  with the 9 real format options would misrepresent what they are. Full UI/architecture for this
  flag is specified in `docs/Enhancements3.md` §3.

### 3.5 Custom template upload

**Phase 1 (this round, zero new dependencies)**: accept `.txt`/`.md` files only. The browser reads
the file via the standard `File.text()` API (no library needed), sends the raw text to a new
endpoint.

**Phase 2 (documented, not built this round)**: `.docx` support via Cluster's own existing
capabilities — either the multimodal-tagged `vllm-qwen36-35b-a3b` model or the already-available
`middlewareai-mineru` OCR service — so no new *dependency* is ever needed for this pipeline, only a
different Cluster app target once Phase 2 is prioritized. This deliberately reuses the same
"Cluster already hosts what we need" reasoning as the document-ingestion pillar (§10.2).

**New endpoint**: `POST /_api/template-extract`

- **Request**: `{ docType: DocType, rawText: string }`
- **Response**: `{ sections: string[] }`
- **Auth**: none beyond what already protects `/_api/*` (XYZ-injected Bearer token via the
  existing proxy — no new auth surface).
- **Behavior**: identical pattern to `handleGapAnalysis` — one `callCluster` call with a small,
  purpose-built system prompt ("Extract an ordered list of section/heading names from this
  requirements/product template. Return only section names, no content, no numbering.") and a
  `response_format` JSON schema of `{ type: "object", properties: { sections: { type: "array",
  items: { type: "string" } } }, required: ["sections"] }` (same schema-construction style as
  `gapAnalysisSchema()`).
- **Failure behavior**: on any error, respond `503 { error: "LLM_UNAVAILABLE" }` (same convention
  as `handleGapAnalysis`/`handleGenerate`); the frontend surfaces this as "couldn't read your
  template — try again or use a Standard format" and does **not** silently fall back to a
  deterministic guess at section names (unlike document generation, there is no sensible
  deterministic fallback for "guess the user's template structure").
- **Client function**: `postTemplateExtract(docType, rawText)` in `llmClient.ts`, same
  `postJson` helper already used by `postGapAnalysis`/`postGenerate` — no new client-side pattern.
- **State**: the extracted `sections: string[]` is stored only in React state
  (`customTemplateSections` on the request, per §3.3) for the current session — **not** persisted
  to `localStorage` or any backend store this round, consistent with the session-memory-deferred
  decision in §10.3 (re-using an uploaded template across sessions is a natural extension of that
  future work, not this round's).

### 3.6 UI changes

**Revision note**: a clarifying-question round after this section was first written confirmed
format selection should live on a **new dedicated pre-generation configuration screen** (the
"Generation Profile" screen), not inline in `InputForm.tsx` — full screen design, including how the
radio groups below combine with Requirement Depth/Decomposition/Innovation Assistance/Traceability/
Target Audience controls, is in `docs/Enhancements3.md` §2. What follows here is the format-radio-
specific behavior that screen embeds per `DocType`.

For each selected `DocType`, the Generation Profile screen shows a `role="radiogroup"` labeled
"Template" with the applicable options from `FORMAT_APPLICABILITY[docType]` (§3.1: 3 named formats
+ Standard + "Upload your own template", per `DocType`):

- Each radio option shows its label plus a small **hover/focus preview** — a lightweight,
  dependency-free tooltip (`onMouseEnter`/`onFocus` → show; `onMouseLeave`/`onBlur` → hide) showing
  a condensed preview: for Standard and the 8 non-EARS named formats, the first 4–5 section names
  from `sectionNamesFor`; for EARS, one example sentence per pattern (from `docs/GoodTRSPRDUX2.md`
  "TRS Format 1" table); for Custom, "Upload a .txt or .md file to extract its structure" (no
  preview until a file is uploaded, then show the extracted section list as the preview).
- Must be keyboard-accessible (`onFocus`/`onBlur`, not only mouse events) since this is a form
  control, consistent with the rest of the app's existing accessible-label conventions
  (`aria-label` on every input already).
- Selecting "Upload your own template" reveals a file `<input type="file" accept=".txt,.md">`;
  on change, reads the file text and calls `postTemplateExtract`, storing the result and showing it
  as the live preview once returned; shows a small inline error state (reusing the existing
  `alert alert--error` class already used elsewhere in `InputForm`) on extraction failure.
- Default selection for every `DocType` is `"standard"` — the radio group is never in an
  unselected state, so a user who ignores this feature entirely gets exactly today's behavior.

### 3.7 Traceability IDs (from `GoodTRSPRDUX2.md` §5)

Out of scope to fully implement this round (no stable-across-regeneration ID storage exists yet —
see `GoodTRSPRDUX2.md` §4's note that stable IDs are most valuable once paired with the
human-in-the-loop loop in §4 below, which is itself a first cut this round). What *is* included
this round: `FORMAT_GUIDANCE` text for any format that includes a "Functional Requirements"-shaped
section instructs the LLM to prefix each individual requirement line with a fresh `CRS-<NNN>` (PRD)
or `TRS-<NNN>` (TRS) identifier per the convention in `GoodTRSPRDUX2.md` §4 — this is a **prompt-only**
change (no schema/data-model change), giving immediate value (visible IDs in the generated text)
while deferring the harder "keep IDs stable across edits/regenerations" problem to a later round.

---

## 4. Human-in-the-Loop Feedback + Editable Output (Pillar 2)

### 4.1 What exists today vs. what's added

Today: `OutputView` already lets a user edit generated content in a textarea, with the edit kept
in local `edits` state and visible in the live Markdown preview pane — but an edit is a dead end:
it's only used for export, and is discarded the moment the user regenerates or navigates away.

Added this round: a **"Regenerate with my edits" action** that sends the original LLM output, the
user's edited version, and an optional free-text comment back to Cluster as a learning signal for a
fresh generation — plus a lightweight per-section 👍/👎 control that adjusts how strongly the next
regeneration should preserve vs. rewrite each section.

### 4.2 Design decision: whole-document diff, not per-section diff (this round)

`GeneratedDocument` currently stores one joined `content` string per `DocType`, not a
`Record<sectionName, string>` map. Introducing per-section-granular tracking would require either
(a) a new parallel data shape kept in sync with `content`, or (b) re-deriving section boundaries
from Markdown heading parsing (fragile — headings are LLM-authored text, not a reliable
machine-readable boundary). Both are more invasive than the value justifies for this round.

**Decision**: treat the feedback signal as **whole-document before/after text**, reusing the
`content` vs. `edits[docType]` state `OutputView` already has, with the addition of thumbs-up/down
markers attached to individual `##`-level sections purely as **prompt hints** (see §4.4), not as a
structural data model change. Precise per-section diff tracking is called out as a natural,
larger follow-up once this coarser version proves useful — not built speculatively now (per
"avoid over-engineering").

### 4.3 Data flow

```text
User edits content in OutputView (existing `edits` state)
  ↓
User clicks "Regenerate with my edits" (new button, per-DocType)
  ↓
Optional: user types a short comment ("what would you like different?")
Optional: user has marked some sections 👍 / 👎 (new lightweight per-section control)
  ↓
llmGenService.regenerateWithFeedback(docType, input, {
  originalContent: activeDoc.content,
  editedContent: edits[docType] ?? activeDoc.content,
  comment?: string,
  sectionSignals?: Record<sectionName, "keep" | "rewrite">,
})
  ↓
postGenerate(...) — same endpoint as initial generation, extended request body
  ↓
POST /_api/generate — same handler, extended system/user prompt (§4.4)
  ↓
callCluster(...) — same helper, no change
  ↓
Response replaces `documents[docType]` with fresh `{ ...doc, source: "llm" }`
  (same replace-on-regenerate behavior OutputView already has via its `useEffect` on `documents`)
```

No new endpoint is introduced for regeneration — it reuses `POST /_api/generate` with additional
optional request fields, since the underlying operation (call Cluster, get sections back, wrap as
`{ sections }`) is unchanged; only the **prompt content** differs.

### 4.4 Contract and prompt changes

```ts
// GenerateRequest (llmClient.ts) — additive
priorAttempt?: {
  originalContent: string;
  editedContent: string;
  comment?: string;
  sectionSignals?: Record<string, "keep" | "rewrite">;
};
```

`handleGenerate` (backend): when `priorAttempt` is present, append one additional block to the user
message (not the system prompt — this is per-request context, not a standing instruction,
consistent with how `clarifications` is already appended today):

> "The user previously generated this document and made the following edits. Learn from what they
> changed — preserve the intent and improvements in their edited version, and do not reintroduce
> content they removed or changed, unless it's still necessary to satisfy the requested sections.
> {if comment} Additional instruction from the user: `<comment>`. {if sectionSignals} The user
> marked these sections for expects rewriting from scratch rather than refinement: `<list>`; treat
> all other sections as ones to preserve and only lightly refine.
>
> --- ORIGINAL ---
> `<originalContent>`
> --- USER'S EDITED VERSION ---
> `<editedContent>`"

This reuses the existing single-call `callCluster` request/response shape entirely — no new
Cluster contract, no new timeout/model-selection logic, no new response schema (still
`generateSchema(sections)`).

### 4.5 UI changes

**`OutputView.tsx`**:
- Per-`DocType` tab, add a "Regenerate with my edits" button, enabled only when
  `edits[activeDoc.type]` differs from `activeDoc.content` (i.e., there's actually an edit to learn
  from) — reuses the existing `edits` state, no new state needed for the diff-exists check itself
  (a simple string inequality).
- Clicking it reveals a small optional comment `<textarea aria-label="What would you like
  different?">` and a "Confirm regenerate" button (two-step, so a user doesn't lose their edit to
  an accidental click — regeneration replaces `documents[docType]`, the same destructive-by-design
  behavior regeneration already has today).
- Add a lightweight per-`##`-section 👍/👎 control: parsed from the same Markdown the preview pane
  already renders (splitting `value` on `\n## ` boundaries — cheap, and only used to *attach a
  hint*, never to make a correctness-critical decision, so fragility here is an acceptable, low-risk
  trade-off given §4.2's decision not to build strict per-section tracking).
- No new dependency needed: no diff-rendering library is required, since the LLM receives raw
  before/after text (§4.4) rather than a rendered diff; an optional "show what changed" collapsible
  view (simple line-based highlight, hand-rolled, no library) is a nice-to-have polish item, not a
  functional requirement of the feedback loop itself — noted as optional in §9's task breakdown.

### 4.6 Failure behavior

Identical to today's generation failure behavior: if `callCluster` throws, `handleGenerate`
responds `503 LLM_UNAVAILABLE`, and `generateOne`'s existing `catch` falls back to the
deterministic builder — **except** deterministic fallback obviously cannot honor `priorAttempt`
(it has no LLM to give feedback to). In that case, `generateOne` falls back to the deterministic
document as it does today, and `OutputView` should surface a distinguishable message ("regeneration
with feedback wasn't available — showing the standard fallback instead") rather than silently
presenting fallback content as if it had incorporated the user's edits, to avoid a misleading UX
where the user believes their feedback was applied when it wasn't.

---

## 5. Data Model Summary

No new persistent storage anywhere in this round (matches the confirmed client-side-only decision
in §10.3 — feedback/format state lives only in React component state, cleared on refresh, exactly
like today's `edits` state already is).

| Field | Location | New/Existing |
|---|---|---|
| `formats` | `GenerationRequest` (client) | New, optional |
| `customTemplateSections` | `GenerationRequest` (client) | New, optional |
| `format`, `requirementPhrasing` | `GenerateRequest` (client→server) | New, optional |
| `priorAttempt` | `GenerateRequest` (client→server) | New, optional |
| `sections` | `GenerateRequest` | Existing, reused as-is |
| `VOLERE_SECTIONS`, `PR_FAQ_SECTIONS` | `sectionSchema.ts` | New constants |
| `FORMAT_GUIDANCE`, `EARS_GUIDANCE` | `server.mjs` + `vite.config.ts` | New constants, mirroring `DOC_TYPE_GUIDANCE` |
| `/_api/template-extract` | new route | New endpoint |

---

## 6. API Summary

### `POST /_api/generate` (extended, backward compatible)

- **New optional request fields**: `format?: DocumentFormatId`, `requirementPhrasing?: "prose" |
  "ears"`, `priorAttempt?: {...}` (§4.4).
- **Response**: unchanged (`{ sections: Record<string, string> }`).
- **Backward compatibility**: a request omitting all three new fields produces byte-identical
  behavior to today.
- **Errors**: unchanged (`503 { error: "LLM_UNAVAILABLE" }` on any Cluster failure).

### `POST /_api/template-extract` (new)

- **Request**: `{ docType: DocType, rawText: string }`.
- **Response**: `{ sections: string[] }`.
- **Errors**: `503 { error: "LLM_UNAVAILABLE" }` on failure (no deterministic fallback exists for
  this operation — see §3.5).
- **Auth**: same as all other `/_api/*` routes (XYZ proxy-injected Bearer token).
- **Idempotency**: naturally idempotent (pure function of the input text; no side effects).
- **Versioning**: none needed — additive new route, no existing route path changes.

---

## 7. Error Handling

| Failure | Behavior |
|---|---|
| Cluster unavailable during `template-extract` | `503`; UI shows inline error, keeps "Standard" selected, does not guess |
| Cluster unavailable during generate-with-`priorAttempt` | `503`; `generateOne` falls back to deterministic content; UI explicitly says feedback wasn't incorporated (§4.6) |
| User uploads a non-`.txt`/`.md` file (Phase 1) | Client-side validation rejects before any network call, same `alert alert--error` pattern already used for other `InputForm` validation |
| User selects a format not applicable to a `DocType` (shouldn't be reachable via UI, but defensive) | `sectionNamesFor` falls through to that `DocType`'s Standard sections rather than throwing, so a stray/invalid combination degrades to safe default instead of crashing |
| Extracted custom template returns an empty `sections` array | Treated as an extraction failure (same `503`-style UI message), not silently generating a document with zero sections |

---

## 8. Security and Privacy

- `template-extract` sends user-uploaded **template structure text** (not product/business
  content) to Cluster — same trust boundary as the existing gap-analysis/generate calls, which
  already send `productDetails` to the same internal, VPC-only cluster; no new data-sensitivity
  category is introduced.
- No new persistent storage of any user content (matches §10.3's client-side-only decision) — so no
  new retention/deletion requirements are introduced this round.
- File upload is client-parsed (`File.text()`) before any network call — the raw file itself is
  never uploaded as a binary blob, only extracted text, reducing exposure surface (no arbitrary
  file storage server-side).
- No new authentication/authorization surface — `template-extract` sits behind the same `/_api/*`
  XYZ-proxy Bearer-token boundary as every other route.

---

## 9. Implementation Task Breakdown

Ordered by dependency; each is independently reviewable.

1. **`sectionSchema.ts`**: add `DOCUMENT_FORMATS`/`DocumentFormatId` to `contract.ts`; add
   `VOLERE_SECTIONS`, `PR_FAQ_SECTIONS` constants; extend `sectionNamesFor` signature (backward
   compatible default `"standard"`). *Validates*: existing `tests/shared/*` continue to pass
   unmodified; new unit tests for each format's section list.
2. **Backend prompt guidance**: add `FORMAT_GUIDANCE`, `EARS_GUIDANCE` objects and extend
   `buildGenerateSystemPrompt` signature in `server.mjs`, then mirror into `vite.config.ts`.
   *Validates*: existing `tests/http/generate.test.ts` continue to pass with no `format` field
   supplied; new tests asserting the guidance text changes per format.
3. **`/_api/template-extract` endpoint**: add to both `server.mjs` and `vite.config.ts`, following
   the `handleGapAnalysis` pattern exactly. *Validates*: new contract test for request/response
   shape; manual live-verification against real Cluster (per this session's established pattern of
   live-testing new Cluster-backed endpoints before considering them done).
4. **`llmClient.ts`**: add `postTemplateExtract`, extend `GenerateRequest` with `format`,
   `requirementPhrasing`, `priorAttempt`. *Validates*: `tests/web/client.test.ts`-equivalent unit
   tests for the new function; existing tests unaffected.
5. **`InputForm.tsx`**: add per-`DocType` format radio group with hover/focus preview, file-upload
   control wired to `postTemplateExtract`. *Validates*: extend `tests/web/inputForm.test.tsx` for
   the new controls; default-selection ("standard") regression test to guard backward
   compatibility.
6. **`llmGenService.ts`**: thread `formats`/`customTemplateSections` into `generateOne`'s
   `sectionNamesFor` call and into the `postGenerate` payload; add `regenerateWithFeedback`.
   *Validates*: `tests/app/genService.test.ts` extensions; a test asserting omission of the new
   fields reproduces today's exact `postGenerate` payload.
7. **`OutputView.tsx`**: add "Regenerate with my edits" button + optional comment box + per-section
   👍/👎 control. *Validates*: extend `tests/web/outputView.test.tsx`; a fallback-messaging test per
   §4.6.
8. **`tests/e2e/acceptance.test.ts`**: add one new scenario exercising format selection end-to-end
   (Standard remains the default, unaffected path stays green) — do not modify the existing
   scenario's assertions (per repo instructions to avoid touching unrelated tests).
9. **Documentation**: update `docs/GoodTRSPRDUX2.md` cross-references if any section constants
   change names during implementation; add a `docs/EnhancementToDo3.md` tracking checklist (mirrors
   `docs/EnhancementToDo2.md`'s convention) when a builder begins execution.

---

## 10. Deferred Pillars — Decisions Captured for a Future Round

Not designed in detail this round (per the confirmed scope), but the following decisions were made
during the clarifying-question round and should be treated as settled inputs whenever these
pillars are picked up:

### 10.1 Pillar 1 — Creativity/Temperature Control

**Superseded** — fully architected in [`docs/Enhancements3.md`](./Enhancements3.md) §3
("Innovation Assistance", per-document-type, 5 levels, mapped to Cluster's `temperature` parameter
plus per-level prompt instructions). The original directional recommendation here (a simple
4-preset Conservative/Balanced/Innovative/Experimental control) was superseded by the richer,
user-specified design in that document.

### 10.2 Pillar 4 — Document/Context Ingestion Pipeline

**Superseded** — fully architected in [`docs/Enhancements4.md`](./Enhancements4.md) §4 (a
phased plan: `.txt`/`.md` now, `.docx` via a new `mammoth` dependency next, `.pdf`/scanned
documents via Cluster's OCR/multimodal apps last). The directional recommendation below is the
same one that document builds on, not a contradiction:

Directional recommendation (from earlier analysis in this conversation): native per-filetype
extraction (previously called "Option C" — rejected convert-to-PDF and convert-to-images
alternatives as unnecessary indirection), reusing Cluster's already-available
`vllm-qwen36-35b-a3b` (multimodal-tagged) and `middlewareai-mineru` (OCR) apps — no new external
dependency needed for the OCR/multimodal phase, matching the same reasoning already applied to
custom-template Phase 2 in §3.5.

### 10.3 Pillar 5 — Session Memory & Preference Learning

**Confirmed this round**: client-side only (browser memory/`localStorage`), not backend-persisted.
No new XYZ persistent storage is to be introduced for this. This directly shapes §3.5's and
§4.2's design in this document (both are explicitly scoped to in-session React state, not
persisted storage). **Fully architected in** [`docs/Enhancements4.md`](./Enhancements4.md) §3
(consolidation/weighting model, conflict detection, feedback taxonomy, retention, and the
Generation Profile pre-fill integration) — that document extends these same client-side state
shapes rather than requiring a rearchitecture of them.

### 10.4 Pillar 6 — Pre-Generation Configuration Framework

**Superseded** — fully architected in [`docs/Enhancements3.md`](./Enhancements3.md) §2 as the
"Generation Profile" screen (Template selection reusing §3's 9 formats, Requirement Depth,
Requirement Decomposition, Innovation Assistance, Traceability, Target Audience, Assumption
Strategy). This document's §3.6 format-selection UI is embedded inside that screen rather than
living inline in `InputForm.tsx` as originally drafted here.
