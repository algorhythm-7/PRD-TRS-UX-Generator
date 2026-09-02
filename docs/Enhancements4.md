# Enhancements 4 — Document Ingestion, Session Memory & Context Sources

Companion to [`docs/Enhancements2.md`](./Enhancements2.md) and [`docs/Enhancements3.md`](./Enhancements3.md).
This document fully architects the two items `docs/Enhancements2.md` §10 left as short deferred
notes — **Pillar 4 (Document/Context Ingestion Pipeline)** and **Pillar 5 (Session Memory &
Preference Learning)** — plus the two items `docs/Enhancements3.md` §6 explicitly deferred because
they depend on these two pillars existing first: **Context Sources** and **Output Structure
inclusion checkboxes**. This is a **planning document only** — no code has been written for this
round.

## Answers from the clarifying round (binding decisions for this document)

| Question | Decision |
|---|---|
| Auto-apply learned preferences, or suggest-and-confirm? | **Auto-apply silently** as pre-filled Generation Profile defaults (§3.6) |
| "Team preferences" (shared across a team) vs. per-browser only? | **Per-browser only** — dropped/rescoped as "My Preferences"; no backend storage added, the client-side-only decision from `docs/Enhancements2.md` §10.3 stands (§2, §5.1) |
| Design "Web Knowledge" as a context source now, or defer? | **Design it now** — see §5.4, which is written with explicit UNKNOWN flags where this session cannot verify Org-specific facts (approved vendor, XYZ outbound network policy) |
| Preference/session history retention | **Bounded to the last 20 sessions**, with an explicit "Clear my learned preferences" control (§3.7) |

---

## 1. Goal

1. **Pillar 4** — let a user attach reference/background material (existing docs, notes, prior
   specs) whose *content* informs generation, distinct from `docs/Enhancements2.md` §3.5's
   template upload (which only extracts *section structure*, never content).
2. **Pillar 5** — remember, per browser (no accounts, no backend), what choices and feedback a
   user tends to give across generation sessions, and use that to pre-fill
   `docs/Enhancements3.md`'s Generation Profile screen automatically.
3. **Context Sources** — the toggle UI that lets a user turn each input source (uploaded
   documents, this browser's own history/preferences, a prior generated document as a style
   example, web search) on or off per generation.
4. **Output Structure checkboxes** — let a user add optional extra sections (User Stories,
   Acceptance Criteria, Risks, Dependencies, Open Questions, Wireframe Suggestions, Edge Cases,
   Validation Criteria) on top of whichever Template (`docs/Enhancements2.md` §3) is selected,
   without duplicating a section the chosen Template already provides.

Desired outcome: same compatibility bar as the prior two documents — every field here is optional,
every default reproduces today's exact behavior, and no new backend/persistent storage is
introduced except where explicitly flagged as needing further review (§5.4 only).

---

## 2. Current State (verified from the repository)

- No `localStorage`/`sessionStorage`/`IndexedDB` usage exists anywhere in `app/src/` today
  (confirmed via a workspace-wide search) — pillar 5 is greenfield, not an extension of existing
  client-side storage.
- `app/src/generation/sectionSchema.ts`'s `sectionNamesFor` was extended in
  `docs/Enhancements2.md` §3.2 to take a `format` parameter; this document extends its signature
  once more (§6.4) to append optional additive sections.
- `app/package.json` has `docx` (for **writing** `.docx` exports in `exportService.ts` via
  `Document`/`Packer`) — this is a write-only API; it does not parse/read existing `.docx` files,
  so Pillar 4's `.docx` ingestion (§3.1 Phase 2) still needs a different, new dependency.
- `docs/Enhancements2.md` §3.5 already establishes the "Phase 1 = `.txt`/`.md` via `File.text()`,
  zero new dependencies" pattern and the "Phase 2/3 = reuse Calypso's multimodal model / OCR
  service" pattern — Pillar 4 reuses both patterns rather than inventing new ones.
- `docs/Enhancements2.md` §4 (human-in-the-loop editing/feedback) and `docs/Enhancements3.md`
  (Generation Profile fields) are the two sources of signal Pillar 5 consolidates into learned
  preferences (§3.2).

---

## 3. Pillar 5 — Session Memory & Preference Learning

(Ordered before Pillar 4 in this document because Context Sources, §5, references both, and
Pillar 5's data model is simpler to establish first.)

### 3.1 Storage

A single namespaced `localStorage` key, versioned for forward compatibility:

```ts
const SESSION_MEMORY_KEY = "prd-gen:session-memory:v1";

interface SessionMemoryStore {
  version: 1;
  sessions: SessionRecord[]; // bounded to the last 20 (§3.7)
}
```

Per-browser only (confirmed decision) — no server sync, no cross-device/cross-team sharing. A
user on a different machine, or after clearing browser storage, starts with no learned
preferences and today's hard-coded defaults, same as a first-time user.

### 3.2 What's recorded per session

```ts
interface SessionRecord {
  id: string;            // uuid
  timestamp: string;     // ISO 8601
  productTitle: string;  // for the timeline UI (§3.8) only — never sent anywhere new
  perDocType: Partial<Record<DocType, {
    format: DocumentFormatId;                     // docs/Enhancements2.md §3.1
    generationMode: string;                        // docs/Enhancements3.md §3.2
    requirementDepth: RequirementDepth;             // docs/Enhancements3.md §3.3
    requirementDecomposition: RequirementDecomposition; // docs/Enhancements3.md §3.3
    innovationAssistance: InnovationAssistance;     // docs/Enhancements3.md §3 (continued)
    targetAudience: TargetAudience;                 // docs/Enhancements3.md §5
    editedSectionCount: number;                     // count only, from docs/Enhancements2.md §4 — not edit content
    thumbsDownSectionCount: number;                  // count only, from docs/Enhancements2.md §4.5
  }>>;
  assumptionStrategy: AssumptionStrategy;           // docs/Enhancements3.md §3.5
  traceability: { generateIds: boolean; requirementMapping: boolean; verificationReferences: boolean };
}
```

**Deliberate scoping limit**: only *structured configuration choices* and *feedback counts* are
recorded — never free-text comments (`docs/Enhancements2.md` §4.4/§4.5) and never edited document
content itself. This is a client-side-only system with no LLM call available to it (adding one
would mean sending session history to Calypso, a bigger, separate capability not designed here);
without an LLM, free text can't be reliably interpreted into a structured preference signal, so
recording it here would either be misleading (implying it's used) or require building fragile
client-side text heuristics. Free text remains fully visible per-session in the timeline (§3.8)
for the user's own reference — it just doesn't feed the consolidation math below.

### 3.3 Consolidation: recency-weighted frequency

For each `PerDocTypeProfile` field (format, generationMode, requirementDepth,
requirementDecomposition, innovationAssistance, targetAudience) and the two global fields
(assumptionStrategy, and each traceability checkbox independently), compute a weighted vote across
`sessions`:

```text
weight(session_i) = decay ^ (N - 1 - i)     // i = 0 is oldest kept session, N = sessions.length, decay = 0.9
score(value) = sum of weight(session_i) for every session where that field == value
confidence(value) = score(value) / sum(score(v) for all v)
```

The highest-`score` value becomes the consolidated preference for that field; its `confidence` is
carried alongside it (§3.4). With `decay = 0.9`, the most recent session counts roughly 2.5x a
session from 10 generations ago — recent behavior dominates without completely discarding older
signal, and a single one-off unusual choice doesn't overwrite an otherwise-consistent pattern.

### 3.4 Conflict detection

A field is flagged as a **conflict** (not blocking, per the "auto-apply silently" decision — still
applies the highest-scoring value) when either:

- `confidence(topValue) < 0.6`, or
- the top two values' `confidence` are within `0.15` of each other (a near-tie).

Conflicts are surfaced as a small, non-blocking inline indicator next to that specific field on
the Generation Profile screen ("Your past choices for this were mixed — showing our best guess"),
not a blocking dialog — consistent with "auto-apply silently," this only adds a transparency cue,
it never stops generation or forces a decision.

### 3.5 Feedback-type taxonomy

| Type | Example | Feeds consolidation (§3.3)? |
|---|---|---|
| Explicit configuration choice | Format/Generation Mode/Depth/etc. picked on the Generation Profile screen | Yes — primary signal |
| Human-in-the-loop edit (`docs/Enhancements2.md` §4) | User edits generated content | Count only, shown in the timeline (§3.8) as a per-format/per-mode "tends to need editing" indicator — does **not** silently change a specific field, since an edit can't be reliably attributed to *which* setting caused it |
| Thumbs down (`docs/Enhancements2.md` §4.5) | Per-section 👎 | Same as edits — count only, timeline-visible, not auto-applied to a field |
| Free-text comment (`docs/Enhancements2.md` §4.4/§4.5) | "More detail on security please" | **Not** used in consolidation (§3.2's scoping limit) — visible in the timeline only |

### 3.6 Integration with the Generation Profile screen

Per the clarifying-round decision, `docs/Enhancements3.md`'s Generation Profile screen reads
`SessionMemoryStore`, computes consolidated preferences (§3.3) once per selected `DocType`, and
uses them as the screen's initial field values **instead of** the hard-coded defaults documented
in `docs/Enhancements3.md` (e.g., `innovationAssistance` defaulting to `"disabled"`) — but only
for fields where at least one prior session exists for that `DocType`; a first-time browser (no
`sessions`) falls back to exactly today's hard-coded defaults, so this is purely additive. The
user can always change any pre-filled value before generating, same as any other default.

### 3.7 Retention and user control

- `sessions` is capped at the most recent **20** records — appending a 21st evicts the oldest
  (simple FIFO), keeping `localStorage` usage bounded and keeping recency-weighting (§3.3)
  meaningful (very old sessions are irrelevant to current preferences anyway).
- A visible **"Clear my learned preferences"** control (e.g., in a small "Your generation history"
  panel — §3.8) deletes the `prd-gen:session-memory:v1` key entirely. This is a real, user-facing
  privacy control, not just a technical nicety — surfaced because product descriptions, even
  stored only client-side, can be sensitive, and per this repo's instruction not to introduce data
  retention without explicit consideration.

### 3.8 Session timeline (traceability)

A small, collapsible "Your generation history" panel (new, e.g. accessible from `AppShell`) lists
`sessions` newest-first: date, product title, and per-`DocType` chips showing format + generation
mode; expanding a row shows the full recorded profile plus edit/thumbs-down counts and any
free-text comments from that session (read-only, for the user's own reference — this is local
history, not sent anywhere). This satisfies the "session timeline/traceability" concept from the
original notes without conflating it with the CRS/TRS requirement-ID traceability convention in
`docs/GoodTRSPRDUX2.md` §5 (a different, unrelated use of the word "traceability").

---

## 4. Pillar 4 — Document/Context Ingestion Pipeline

### 4.1 Phased approach (recap and complete "Option C")

`docs/Enhancements2.md` §10.2 already recommended native per-filetype extraction ("Option C" —
rejecting convert-to-PDF and convert-to-images as unnecessary indirection) reusing Calypso's
already-available `vllm-qwen36-35b-a3b` (multimodal-tagged) and `middlewareai-mineru` (OCR)
apps. This section completes that into a concrete phased plan:

| Phase | File types | Mechanism | New dependency? |
|---|---|---|---|
| 1 (this round, buildable now) | `.txt`, `.md` | Client reads via `File.text()`, sends raw text to a new endpoint | None |
| 2 | `.docx` | New client-side parsing dependency (e.g., `mammoth` — converts `.docx` to plain text; small, focused, widely used) — chosen over routing through Calypso for simple structured Office files, since `.docx` is a well-defined format a dedicated parser handles cheaply and locally, without spending LLM tokens or a network round-trip just to extract already-structured text. **Note**: this app's existing `docx` npm dependency is *write-only* (used for exporting, via `Document`/`Packer`) — it does not parse existing files, so this is a genuinely new capability, not a reuse of an existing one. | Yes — one small, justified addition |
| 3 | `.pdf`, scanned/image-based documents | Server-side, routed to Calypso's `middlewareai-mineru` OCR service (for scanned/layout-heavy documents) or `vllm-qwen36-35b-a3b` (for straightforward digital PDFs a multimodal model can read directly) — mirrors `docs/Enhancements2.md` §3.5's Phase 2 reasoning exactly | None (reuses Calypso) |

### 4.2 New endpoint: `POST /_api/context-extract`

Distinct from `docs/Enhancements2.md` §3.5's `/_api/template-extract` — that endpoint extracts
only a *section-name list*; this one extracts *usable reference content*.

- **Request** (Phase 1): `{ filename: string, rawText: string }`
- **Response**: `{ extractedText: string, truncated: boolean }`
- **Behavior**: Phase 1 needs no LLM call at all — `rawText` is already plain text, so the server
  only needs to **budget** it (see §4.3), not extract anything from it; the endpoint mostly exists
  so Phase 2/3 can share one client-side upload flow and response contract regardless of which
  phase's mechanism handled a given file type. Phase 2 (`.docx`, parsed client-side by `mammoth`
  before the call) also just budgets already-plain text server-side. Phase 3 (`.pdf`/images) is
  the only phase where this endpoint actually calls Calypso (OCR/multimodal) to produce
  `extractedText` from non-text input.
- **Failure behavior**: `503 { error: "LLM_UNAVAILABLE" }` only applies to Phase 3 (the only phase
  that calls Calypso); Phase 1/2 failures are client-side validation errors (unsupported file
  type, unreadable file), surfaced inline, same `alert alert--error` pattern as elsewhere.

### 4.3 Context budget (token management)

Reference content is appended to the generate prompt (§5.3) alongside everything else
(`docs/Enhancements2.md` and `docs/Enhancements3.md`'s guidance blocks, the product
title/details, clarifications) — all sharing `CALYPSO_GENERATE_MAX_TOKENS` (8192, per
`docs/EnhancementBuildPlan2.md`'s existing constant). To avoid silently truncating a document
mid-Calypso-call:

- Each uploaded reference document is capped at **8,000 characters** client-side before being sent
  to `/_api/context-extract`; anything beyond that is dropped with `truncated: true` in the
  response, surfaced to the user ("Only the first 8,000 characters of `report.docx` were used").
- Up to **3 reference documents** per generation, with a **combined cap of 12,000 characters**
  across all of them (proportionally trimmed if 3 full-length documents would exceed it) — chosen
  conservatively so reference material can't crowd out the actual generation instructions within
  the shared token budget.

### 4.4 UI

A new "Reference Documents" upload control lives inside the Generation Profile screen's Context
Sources panel (§5.2), gated behind the "Use uploaded reference documents" checkbox — not shown at
all unless that checkbox is enabled, keeping the screen uncluttered for users who don't need this.

---

## 5. Context Sources (the toggle UI tying Pillars 4 and 5 together)

### 5.1 The four sources (rescoped from the original five)

| Source | Status |
|---|---|
| Uploaded reference documents | Designed in full (§4) |
| My prior preferences (this browser) | Designed in full (§3) — renamed from "Team preferences" per the clarifying-round decision to drop cross-team sharing |
| A prior generated document as a style example | Designed in full (§5.3) — reuses §3.8's session timeline (pick a past generation) or §4's upload pipeline (upload an external example) |
| Web search results | Designed in §5.4, with explicit open items flagged — chosen to design now per the clarifying round, but this session cannot verify all Org-specific facts needed to consider it implementation-ready |

"Existing TRS Examples" from the original notes is generalized here to "a prior generated document
as a style example," applicable to any `DocType` (a PRD or UX example is just as valid a style
reference as a TRS one), rather than being TRS-specific.

### 5.2 UI: Context Sources panel

A new checkbox group on the Generation Profile screen's shared panel (`docs/Enhancements3.md` §3.1
already reserves a "shared panel" area for cross-document settings):

```text
Context Sources
☐ Use uploaded reference documents        → reveals §4.4's upload control
☑ Use my prior preferences (this browser) → default ON; unchecking reverts every field on this
                                             screen to today's hard-coded defaults instead of
                                             learned ones (an explicit escape hatch)
☐ Use a prior generated document as a style example → reveals a picker: "From your history" (§3.8)
                                             or "Upload an example" (§4)
☐ Include web search results              → OFF by default; reveals a warning message (§5.4)
                                             when checked
```

"Use my prior preferences" defaults to **on** (matching the "auto-apply silently" decision — §3.6
already happens by default); the other three default to **off**, since each has a real cost
(upload effort, extra tokens, or — for web search — a genuinely new trust boundary) that shouldn't
be silently opted into.

### 5.3 Prior generated document as a style example

```ts
styleReference?: { source: "history"; sessionId: string; docType: DocType } | { source: "upload"; extractedText: string };
```

Feeds into the generate prompt as: *"The following is an example of a previously generated
document of the same type, provided only as a style/structure reference — do not copy its
specific content, only its tone and level of detail: `<content>`"* — explicitly instructed as
style-only to avoid the model treating it as authoritative content to reproduce (the same
"reference material, not literal output" framing already used for `docs/Enhancements2.md` §4.4's
`priorAttempt` and `docs/Enhancements2.md` §3.5's schema-vs-output distinction).

### 5.4 Web search results — designed now, with open items flagged

**What this session can respons­ibly design**: the data flow, the security-relevant constraints,
and the UI. **What this session cannot confirm** (flagged per this repo's instruction to state
uncertainty rather than guess): which web-search provider, if any, is already approved for use at
Org, and whether the deployed XYZ runtime (as opposed to a developer's local machine) has
unrestricted outbound internet access or is itself behind a network boundary requiring an approved
egress path. Both are **UNKNOWN** from this repository alone and need confirmation from
whoever owns XYZ's network policy before this is implemented.

**Design**:

- New optional server-side integration point: `webSearch(query: string): Promise<{ title: string;
  url: string; snippet: string }[]>`, calling **an org-approved search API** (not specified here —
  a placeholder for whichever provider passes security review, e.g., a Bing/Azure Search resource
  if Org already has an Azure tenant relationship, or an internal search index if one
  exists — this document does not assume either is already available).
- **Minimal-exposure query construction**: the query sent externally is derived from
  `productTitle` plus a short, generic topic phrase — **never** the full `productDetails` text,
  which may contain confidential product information. This is the one meaningfully new trust
  boundary this app would introduce (every other network call in this app stays within Org's
  internal VPC, per `AGENTS.md`/prior session notes on Calypso) — treated as a **Risk**, not a
  routine feature, in §8.
- Top 3–5 results' `title`/`snippet` (not full page content — no new content-fetching/crawling
  capability) are appended to the generate prompt as: *"The following are public web search
  results that may provide relevant background — verify before relying on them, and do not
  present them as confirmed facts about this specific product: `<results>`"*.
- **UI**: checking "Include web search results" reveals a non-dismissible warning: *"This sends a
  short, generic search phrase (not your full product description) to an external search
  provider. Only enable this for non-confidential projects."* — an explicit, informed-consent
  pattern, not a quiet default.
- **Explicitly not built here**: any agentic/multi-step search loop, page-content fetching/
  crawling, or result re-ranking — a single search call with title/snippet results only, kept as
  simple and low-risk as this capability can be while still being useful.

---

## 6. Output Structure Inclusion Checkboxes

### 6.1 Reconciling with Template selection (avoiding duplicate sections)

Several of the 8 requested checkboxes already have an equivalent section in one or more of
`docs/Enhancements2.md`'s Templates. Adding a second, differently-named section with overlapping
content would confuse the generated document, so each checkbox is checked against a static
equivalence map before being added:

```ts
const OUTPUT_STRUCTURE_EQUIVALENTS: Record<string, string[]> = {
  "User Stories": [],
  "Acceptance Criteria": [],
  "Risks": ["Risks and Dependencies", "Risks"],
  "Dependencies": ["Risks and Dependencies"],
  "Open Questions": ["Open Issues"],
  "Wireframe Suggestions": ["UI Design Mockups", "Pages"],
  "Edge Cases": [],
  "Validation Criteria": ["Test and Validation"],
};
```

If the currently-selected Template for a `DocType` (`sectionNamesFor(docType, format, ...)`,
`docs/Enhancements2.md` §3.2) already contains any of a checkbox's equivalents, that checkbox is
**disabled** in the UI with a tooltip ("Already included as '<section name>' in the selected
Template") rather than silently adding a redundant section or silently doing nothing when checked
— disabling (not hiding) keeps the option visibly explained rather than mysteriously absent.

### 6.2 The 8 items and per-`DocType` applicability

| Item | Applicable to | Prompt guidance added when enabled |
|---|---|---|
| User Stories | PRD, UX | Phrase as "As a `<role>`, I want `<goal>`, so that `<benefit>`" |
| Acceptance Criteria | PRD, TRS | Given/When/Then or a testable checklist per requirement |
| Risks | PRD, TRS, UX | Same bar as `docs/GoodTRSPRDUX.md`'s existing Risks guidance |
| Dependencies | PRD, TRS | Concrete external systems/teams relied on |
| Open Questions | PRD, TRS | Unresolved items blocking further design, distinct from Risks |
| Wireframe Suggestions | PRD, TRS | A lightweight, PRD/TRS-appropriate sketch of relevant UI, without a full UX document — only offered where the Template doesn't already produce full mockups |
| Edge Cases | TRS, PRD | Explicit boundary/failure conditions not already covered by the main requirements |
| Validation Criteria | TRS | Same bar as `docs/GoodTRSPRDUX.md`'s Test and Validation guidance |

Not applicable combinations (e.g., "Validation Criteria" for UX) simply don't render that
checkbox for that `DocType`, mirroring `docs/Enhancements2.md` §3.1's `FORMAT_APPLICABILITY`
pattern.

### 6.3 Data model and wiring

```ts
outputStructure?: Partial<Record<DocType, string[]>>; // enabled, non-duplicate item names only
```

`sectionNamesFor` (`docs/Enhancements2.md` §3.2) gains one more optional parameter:

```ts
export function sectionNamesFor(
  docType: DocType,
  format: DocumentFormatId = "standard",
  customSections?: readonly string[],
  additionalSections?: readonly string[], // new: appended after dedup (§6.1), this document
): readonly string[]
```

`additionalSections` is computed client-side (dedup applied against the already-resolved base
list) and appended at the end — `generateSchema`/`buildGeneratedDocument`
(`docs/Enhancements2.md` §2.2) need **no further change**, since both already operate on an
arbitrary ordered section-name list.

---

## 7. Data Flow (full picture, incorporating Enhancements 2/3/4)

```text
InputForm (title, details, document types)
  ↓ "Continue"
Generation Profile screen (docs/Enhancements3.md), now also showing:
  - Per-DocType fields pre-filled from Pillar 5's consolidated preferences (§3.6), if any exist
  - Context Sources panel (§5.2): reference documents, prior-preferences toggle, style example, web search
  - Output Structure checkboxes (§6), disabled where redundant with the selected Template
  ↓ "Generate"
For each selected DocType:
  sections = sectionNamesFor(docType, format, customSections, additionalSections)  // §6.3
  referenceContent = uploaded docs (§4) + style example (§5.3) + web search results (§5.4), if enabled
  postGenerate({ ...docs/Enhancements2.md + docs/Enhancements3.md fields, sections, referenceContent })
  ↓
POST /_api/generate — prompt assembly order extends docs/Enhancements3.md §8's list:
  base → DOC_TYPE_GUIDANCE → FORMAT_GUIDANCE → EARS → GENERATION_MODE_GUIDANCE →
  Depth/Decomposition → Traceability → Assumption Strategy → Compliance Framing →
  Output Structure guidance (this document, §6.2) → reference content block (this document, §4/§5.3/§5.4) →
  Innovation Assistance → closing Markdown instruction
  ↓
On successful generation: append a new SessionRecord (§3.2) to SessionMemoryStore (client-side, after response received)
```

---

## 8. Security and Privacy

| Concern | Handling |
|---|---|
| Session memory contents | Client-side `localStorage` only; only structured config + counts (§3.2), never free text or document content — bounded retention + explicit clear control (§3.7) |
| Uploaded reference documents | Same trust boundary as existing template uploads (`docs/Enhancements2.md` §8) — content stays within the existing Calypso VPC boundary for Phase 3; Phases 1–2 never leave the browser/server pair already in the trust boundary |
| **Web search (§5.4)** | **The one genuinely new external trust boundary this app would introduce.** Minimal-exposure query design (title + generic topic only, never full `productDetails`); explicit opt-in with a non-dismissible warning; **requires organizational security review before implementation** — this document does not treat it as approved, only designed |
| Style-reference/reference-document content | Explicitly framed to the LLM as "reference, not literal output to copy" (§5.3), reducing the risk of unintentionally reproducing another product's or another team's confidential content verbatim in a new document |

---

## 9. Error Handling

| Failure | Behavior |
|---|---|
| Reference document exceeds the character budget (§4.3) | Truncated, `truncated: true` surfaced to the user — never silently dropped without indication |
| `.docx` parsing fails client-side (Phase 2) | Inline error, same `alert alert--error` pattern; file simply isn't included, generation proceeds without it if the user continues |
| Calypso unavailable during Phase 3 OCR/multimodal extraction | `503 LLM_UNAVAILABLE`; that document is excluded from `referenceContent` with an inline notice, generation still proceeds for the rest of the request |
| Web search provider unavailable or not yet configured | Treated as a soft failure — omit web results from the prompt, surface a small inline notice, never block generation on it |
| `localStorage` unavailable or quota exceeded (e.g., private browsing) | Session memory silently no-ops (no consolidated preferences, no history) — generation is entirely unaffected, since every consumer of `SessionMemoryStore` already treats "no sessions" as a valid, expected state (§3.6) |
| An Output Structure checkbox is checked for a redundant section despite the UI normally disabling it (defensive) | Dedup logic (§6.1) re-checks server-side-computed `sections` before rendering, not just client-side, so a stale/tampered request still can't produce a duplicate section |

---

## 10. Implementation Task Breakdown

Depends on `docs/Enhancements2.md` §9 and `docs/Enhancements3.md` §11 being complete first.

1. **Session memory module** (`app/src/generation/sessionMemory.ts`, new): `SessionMemoryStore`
   read/write, consolidation (§3.3), conflict detection (§3.4), retention/eviction (§3.7). *Pure,
   dependency-free logic* — highly unit-testable in isolation (feed synthetic session arrays,
   assert consolidated output).
2. **Generation Profile pre-fill integration**: wire §3.6 into the screen built in
   `docs/Enhancements3.md` §11 task 3.
3. **"Your generation history" panel**: new component reading `SessionMemoryStore` (§3.8), with
   the clear-preferences control (§3.7).
4. **`/_api/context-extract` endpoint** (Phase 1 first: `.txt`/`.md` only) + `.docx` parsing via
   `mammoth` (Phase 2) + Calypso OCR/multimodal routing (Phase 3, can ship later independently).
5. **Context Sources panel** on the Generation Profile screen, gating reference-document upload,
   prior-preferences toggle, style-example picker, and the web-search checkbox + warning.
6. **Output Structure checkboxes**: `OUTPUT_STRUCTURE_EQUIVALENTS` dedup logic, `sectionNamesFor`
   signature extension, per-item prompt guidance.
7. **Web search integration** — explicitly gated: do not implement until an org-approved provider
   and XYZ's outbound network policy are confirmed (§5.4); track as a separate, reviewable task
   rather than bundling it with tasks 1–6, which have no such external dependency.
8. **Documentation**: `docs/EnhancementToDo5.md` tracking checklist when a builder begins
   execution.
