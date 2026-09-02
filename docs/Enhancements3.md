# Enhancements 3 — Generation Profile (Pre-Generation Configuration + Innovation Assistance)

Companion to [`docs/Enhancements2.md`](./Enhancements2.md) (Standardized Templates + Human-in-the-
Loop Feedback) and [`docs/GoodTRSPRDUX2.md`](./GoodTRSPRDUX2.md) (9-format research). This document
fully architects the two pillars a follow-up clarifying round asked to add: **Pillar 1
(Creativity/Temperature Control)** and **Pillar 6 (Pre-Generation Configuration)** — both are
reframed here as one unified **"Generation Profile"** screen, per the user's own detailed design
input. This is a **planning document only** — no code has been written for this round.

## Reconciling the user's own two design passes

The user first asked for a simple Tone/Detail-Level/Granularity control set, then, unprompted,
rejected it as "too simplistic for a requirements engineering platform" and provided a much richer
brainstorm, followed by a final, self-narrowed **"If I Had To Design It"** recommendation. This
document builds the **final, self-narrowed list** as MVP scope, and explicitly notes where a
richer alternative from the earlier brainstorm was available but not chosen for this round (so it
isn't silently lost):

| Control | MVP scope (this document) | Richer alternative seen but deferred |
|---|---|---|
| Generation Mode (replaces "Tone") | Per-`DocType`, 4–5 options each (§2.2) | — (already the richest version offered) |
| Requirement Depth | 4 levels: High Level / Standard Engineering / Detailed Engineering / Compliance Grade | — (already final) |
| Requirement Decomposition | 5 levels: Feature / Functional Requirement / Sub-System / Component / Signal-Interface | — (already final) |
| Innovation Assistance | 5 levels (§3) — the *richer* brainstorm version was kept, since each level has a distinct qualitative behavior, not just an intensity dial | The final recap's simplified 3-level Off/Moderate/High was **not** used — the 5-level version carries more real design meaning |
| Traceability | 3 checkboxes: Generate IDs, Requirement Mapping, Verification References | 2 more from the fuller brainstorm (Requirement Dependencies, Parent/Child Relationships) — noted as future extensions in §4 |
| Target Audience | 4 options: Engineering / Product / Customer / Management | 7-option richer breakdown (Product Manager/System Architect/Software Engineer/Integration Engineer/Test Engineer/Executive Stakeholder/Customer Team) — noted as a future extension in §5 |
| Assumption Strategy | 3 levels: Strict / Balanced / Exploratory | 4-level fuller brainstorm version — collapsed to 3, since the final recap itself collapsed it |
| Standards Selection | Reuses `docs/Enhancements2.md` §3's real, sourced 9-format "Template" selector | The brainstorm's own example list (Org TRS/CRS, ASPICE Compliant, ISO 26262 Oriented) is **not** implemented as literal template names — see §3.4 for why, and how ASPICE/ISO 26262 are still honored as a separate, honestly-scoped flag |
| Context Sources, Output Structure inclusion checkboxes | **Not included this round** | Both were absent from the user's own final "If I Had To Design It" list — deferred to a future round (§6) rather than built speculatively |

---

## 1. Goal

Replace the simple `InputForm.tsx` → `Generate` flow with a two-step flow: `InputForm.tsx` (title,
details, document types — unchanged) → a new **Generation Profile** screen (this document) →
`Generate`. The Generation Profile screen lets a user configure, per selected document type, how
the LLM should approach that document (lens, depth, decomposition, creativity, audience), plus a
few cross-document settings (traceability, assumption handling, compliance framing) — all
optional, all defaulting to today's exact behavior if the screen is skipped/left at defaults.

Desired outcome: same backward-compatibility bar as `docs/Enhancements2.md` — a generation request
that never touches this screen produces byte-identical output to today.

---

## 2. Current State (verified from the repository)

- `App.tsx` renders `InputForm` → on `onGenerate(request)` → calls generation directly (see
  `docs/Enhancements2.md` §2.1 for the full current pipeline trace). There is currently no
  intermediate screen between "fill out the form" and "see generated output."
- `callCalypsoChat` (`app/server.mjs`, mirrored in `app/vite.config.ts`) builds a plain request
  body: `{ model, messages, max_tokens }`, optionally adding `response_format`. Confirmed via
  reading the function directly: adding a `temperature` field is a one-line change (`if
  (temperature !== undefined) body.temperature = temperature;`), since Calypso's endpoint is
  OpenAI-chat-completions-compatible and `temperature` is a standard field in that contract — no
  new Calypso capability is being assumed, only a standard parameter this app hasn't sent yet.
- `docs/Enhancements2.md` §3 already defines `FORMAT_APPLICABILITY`, `sectionNamesFor`, and
  `FORMAT_GUIDANCE` — this document's "Template" control (§2.2) is not a new mechanism, it's the
  same one, just relocated onto this new screen instead of living inline in `InputForm.tsx`.
- `docs/Enhancements2.md` §3.7 already sketches an always-on CRS/TRS-ID prompt instruction — this
  document's Traceability checkboxes (§4) make that instruction **opt-in** instead of always-on.

---

## 3. Proposed Architecture

### 3.1 Screen flow

```text
InputForm (unchanged: title, details, document types, guided questions)
  ↓ "Continue" button (new; replaces the current direct "Generate" button)
Generation Profile screen (new)
  - Per selected DocType, a repeated sub-panel:
      Template          (docs/Enhancements2.md §3's 9-format radio group + custom upload)
      Generation Mode    (§3.2)
      Requirement Depth  (§3.3)
      Requirement Decomposition (§3.3)
      Innovation Assistance     (§3, this section)
      Target Audience    (§5)
  - One shared panel (applies across all selected document types):
      Traceability (checkboxes)   (§4)
      Assumption Strategy          (§3.5)
      Compliance Framing (checkbox) (§3.4)
  ↓ "Generate" button (moved here from InputForm)
Existing generation pipeline (docs/Enhancements2.md §2.1), now reading GenerationProfile fields
```

`InputForm.tsx` keeps its existing "Generate" button behavior **only when `docs/Enhancements2.md`
and this document are both unimplemented** — once built, `InputForm`'s primary action becomes
"Continue" and the Generation Profile screen's action becomes "Generate". A user who accepts every
default on the new screen gets exactly today's request shape (see §7 for the exact default→
no-op mapping).

### 3.2 Generation Mode (per `DocType`, replaces "Tone")

The single biggest lever besides Template — reframes each document's *lens*, independent of its
section skeleton (Template) or its creativity level (Innovation Assistance):

```ts
export const GENERATION_MODES: Record<DocType, readonly string[]> = {
  PRD: ["customer_value", "product_management", "engineering_handoff", "executive_summary"],
  TRS: ["strict_trs", "functional_decomposition", "implementation_oriented", "verification_oriented"],
  UX: ["user_journey", "wireframe_generation", "interaction_design", "accessibility_focus", "research_discovery"],
};
```

Each value maps to one additional prompt-guidance sentence (new `GENERATION_MODE_GUIDANCE[docType][mode]`
lookup, same pattern as `FORMAT_GUIDANCE`), e.g.:

- PRD `executive_summary` → "Write for a time-constrained executive audience: lead with business
  impact and a one-paragraph summary before any detail; minimize technical/implementation
  language."
- TRS `verification_oriented` → "For every requirement, explicitly state how it would be verified
  (test type, measurable pass/fail condition), not just the requirement itself."
- UX `accessibility_focus` → "For every journey phase and mockup, explicitly call out
  accessibility considerations (screen-reader behavior, keyboard navigation, color-contrast-
  sensitive elements)."

Default: `PRD → "product_management"`, `TRS → "strict_trs"`, `UX → "user_journey"` — each is the
option closest to this app's existing Standard-format prompt behavior (`docs/GoodTRSPRDUX.md`),
so a user who never touches this control gets output indistinguishable from today's.

### 3.3 Requirement Depth and Requirement Decomposition (per `DocType`)

```ts
export const REQUIREMENT_DEPTH_LEVELS = [
  "high_level", "standard_engineering", "detailed_engineering", "compliance_grade",
] as const;
export const REQUIREMENT_DECOMPOSITION_LEVELS = [
  "feature", "functional_requirement", "sub_system", "component", "signal_interface",
] as const;
```

Both are prompt-guidance-only axes (no schema change) — `standard_engineering` +
`functional_requirement` are the defaults, matching today's existing Functional Requirements
prompt behavior exactly. Higher Depth levels add explicit instruction to expand rationale/edge
cases/verification notes per requirement; Decomposition levels instruct the model to phrase
requirements at that specific level (e.g., `signal_interface` — "phrase requirements down to
individual signal/interface level where the input supports it," directly relevant to automotive
TRS work).

### 3.4 Compliance Framing (ASPICE / ISO 26262) — separate from Template

Per `docs/GoodTRSPRDUX2.md` §6: ASPICE and ISO 26262 are process/compliance standards, not
document templates, so they are **not** added to the 9-format "Template" list. Instead:

```ts
complianceFraming?: {
  aspice?: boolean;
  iso26262?: boolean;
};
```

When either is `true`, `buildGenerateSystemPrompt` appends one guidance sentence per flag (e.g.,
"Frame requirements using ASPICE work-product-aware language (e.g., distinguish system vs.
software-level requirements) where the input supports it, without claiming this document literally
is an ASPICE work product" / "Explicitly flag any requirement that appears safety-relevant in
ISO 26262 terms (e.g., affects vehicle control, occupant safety) as such"). This keeps the
distinction between "a real, sourced document template" (§2.2's Template control) and "an honestly
-scoped compliance-aware framing request" (this flag) clear and non-misleading, addressing the gap
identified when reconciling the user's own brainstorm (which listed "ASPICE Compliant" and "ISO
26262 Oriented" as if they were selectable templates).

### 3.5 Assumption Strategy (global, applies to the whole generation batch)

```ts
export const ASSUMPTION_STRATEGIES = ["strict", "balanced", "exploratory"] as const;
```

- `strict` — "Do not invent information not present in the input or clarifications. Where
  information is missing, explicitly list it as an Open Issue/Assumption rather than inventing a
  plausible value."
- `balanced` (default) — matches today's implicit behavior: reasonable assumptions are made and
  stated in the Assumptions section, per `docs/GoodTRSPRDUX.md`'s existing guidance.
  `strict`/`exploratory`, so this control causes zero behavior change until a user opts into either
  extreme.
- `exploratory` — "Where information is missing, proactively propose a plausible, clearly-labeled
  option rather than just flagging a gap — favor forward progress over asking more questions."

Applied globally (not per-`DocType`) because it governs a cross-cutting behavior (how gaps in the
*shared* input are handled), not a per-document style choice — distinct from Innovation Assistance
(which is about *how much the model should propose beyond the requirements themselves*, not about
*how it should treat missing input*).

---

## 3 (continued). Innovation Assistance — Pillar 1, reconciled

**Reconciliation note**: the original ask (Conservative/Balanced/Innovative/Experimental, one
global preset) was superseded by the user's own later, richer, per-document-type specification —
this section implements the later version as the actual Pillar 1 design.

```ts
export const INNOVATION_ASSISTANCE_LEVELS = [
  "disabled", "suggest_missing", "challenge_assumptions", "explore_alternatives", "maximum_ideation",
] as const;
export type InnovationAssistance = (typeof INNOVATION_ASSISTANCE_LEVELS)[number];
```

Chosen **per `DocType`** (confirmed in the clarifying round: "separate preset per document type"),
shown as a radio group in each `DocType`'s Generation Profile sub-panel (§2.2). Each level maps to
**both** a `temperature` value sent to Calypso **and** a distinct prompt instruction — the
qualitative instruction is what makes each level meaningfully different from a plain intensity
dial, per the user's own framing ("this is one of your differentiators"):

| Level | `temperature` | Prompt instruction added |
|---|---|---|
| Disabled (default) | 0.2 | "Do not propose anything beyond what is explicitly stated or reasonably implied by the input." |
| Suggest Missing Requirements | 0.4 | "Additionally identify and explicitly propose requirements you believe are missing, clearly labeled as suggestions, not confirmed requirements." |
| Challenge Existing Assumptions | 0.6 | "Where the input states or implies an assumption, explicitly question it and propose an alternative if one seems stronger, clearly labeled as a challenge to the stated assumption." |
| Explore Alternative Designs | 0.8 | "Propose at least one clearly-labeled alternative approach in addition to the primary one described." |
| Maximum Ideation | 1.0 | "Be maximally exploratory: propose novel ideas, alternative designs, and additional requirements liberally, all clearly and consistently labeled as ideation rather than confirmed requirements or the primary recommendation." |

**No "reasoning effort" parameter is introduced** — this session found no evidence Calypso's
OpenAI-compatible endpoint supports a reasoning-effort/thinking-budget field beyond `temperature`
and `max_tokens` (per `app/server.mjs`'s `callCalypsoChat`); inventing one would be adding an
unverified API surface. If Calypso later adds support for such a parameter, `INNOVATION_ASSISTANCE`
levels could additionally set it, but this document does not claim that capability exists today.

`temperature` is threaded through the existing per-request pipeline (no restructuring):
`handleGenerate` reads `innovationAssistance` from the request body → looks up its `temperature` →
passes to `callCalypso(messages, responseFormat, maxTokens, temperature)` → `callCalypsoChat`
includes it in `body` only `if (temperature !== undefined)`, so omitting it (today's callers, and
any future caller that doesn't set it) reproduces exactly today's Calypso request.

---

## 4. Traceability (global checkboxes)

```ts
traceability: {
  generateIds: boolean;          // default false
  requirementMapping: boolean;   // "CRS → TRS Mapping", default false
  verificationReferences: boolean; // default false
};
```

This makes `docs/Enhancements2.md` §3.7's CRS/TRS-ID prompt instruction **opt-in** rather than
always-on (a refinement of that section, not a contradiction — §3.7's note that stable
cross-regeneration IDs are deferred still applies unchanged):

- `generateIds` → appends the `CRS-<NNN>`/`TRS-<NNN>` prefixing instruction from
  `docs/GoodTRSPRDUX2.md` §5 to any PRD/TRS Functional-Requirements-shaped section.
- `requirementMapping` → additionally instructs TRS generation to reference the relevant CRS-ID(s)
  per TRS requirement (`TRS-014 (fulfills CRS-PRD-003)`) — only meaningful if both a PRD and TRS
  are being generated together in the same batch; if TRS is generated without a PRD in the same
  batch, this instruction is simply omitted (nothing to map to) rather than producing a confusing
  reference to a document that doesn't exist in this generation.
- `verificationReferences` → instructs TRS's "Test and Validation" section to explicitly reference
  requirement IDs it verifies, when `generateIds` is also enabled (verification references need
  something to reference).

**Deferred** (per the reconciliation table in the intro): "Requirement Dependencies" and "Parent/
Child Relationships" checkboxes from the fuller brainstorm — both require a more structured,
persisted requirement-graph model to be meaningful (not just a prompt instruction), which is a
natural extension once `docs/Enhancements2.md` §3.7's "stable IDs across regenerations" work is
picked up, not before.

---

## 5. Target Audience (per `DocType`)

```ts
export const TARGET_AUDIENCES = ["engineering", "product", "customer", "management"] as const;
```

Defaults: `PRD → "product"`, `TRS → "engineering"`, `UX → "product"` — each matches that document
type's existing Standard-format assumed audience, so leaving this untouched reproduces today's
tone exactly. Maps to one additional prompt-guidance sentence adjusting vocabulary/depth (e.g.,
`PRD` + `"customer"` → "Write using the customer's own vocabulary, minimizing internal
organizational or technical jargon"; `PRD` + `"management"` → "Lead with business impact and
resourcing implications; keep technical detail to a minimum").

**Deferred** (per the reconciliation table): the fuller 7-option breakdown (System Architect,
Software Engineer, Integration Engineer, Test Engineer, Executive Stakeholder, Customer Team) is
noted as a natural refinement once the 4-option MVP is validated with real usage — the user's own
final recap already narrowed to 4, so this round doesn't second-guess that narrowing.

---

## 6. Explicitly deferred this round (not in the user's final list)

Per the reconciliation table in the intro, these appeared in the fuller brainstorm but were absent
from the user's own final "If I Had To Design It" recap, so they were not designed in detail here.

**Revision note**: both are now fully architected in [`docs/Enhancements4.md`](./Enhancements4.md),
once Pillars 4 and 5 (below) existed to build on:

- **Context Sources** (toggle which context feeds generation: uploaded documents, previous-session
  feedback, this browser's own preferences, a prior generated document as a style example, web
  knowledge) — designed in `docs/Enhancements4.md` §5, on top of that document's Pillar 4
  (Document/Context Ingestion Pipeline, §4) and Pillar 5 (Session Memory, §3).
- **Output Structure inclusion checkboxes** (User Stories, Acceptance Criteria, Risks,
  Dependencies, Open Questions, Wireframe Suggestions, Edge Cases, Validation Criteria) — designed
  in `docs/Enhancements4.md` §6, including an explicit dedup mechanism so a checked item is never
  added when the selected Template already provides an equivalent section.

---

## 7. Data Model Summary

```ts
export interface PerDocTypeProfile {
  format: DocumentFormatId;               // docs/Enhancements2.md §3.1, default "standard"
  customTemplateSections?: string[];      // docs/Enhancements2.md §3.5, only when format === "custom"
  generationMode: string;                 // one of GENERATION_MODES[docType], §3.2
  requirementDepth: RequirementDepth;     // default "standard_engineering", §3.3
  requirementDecomposition: RequirementDecomposition; // default "functional_requirement", §3.3
  innovationAssistance: InnovationAssistance; // default "disabled", §3 (continued)
  targetAudience: TargetAudience;         // per-DocType default, §5
}

export interface GenerationProfile {
  perDocType: Partial<Record<DocType, PerDocTypeProfile>>;
  traceability: { generateIds: boolean; requirementMapping: boolean; verificationReferences: boolean }; // all default false, §4
  assumptionStrategy: AssumptionStrategy; // default "balanced", §3.5
  complianceFraming?: { aspice?: boolean; iso26262?: boolean }; // default both false, §3.4
}
```

`GenerationProfile` is a new, additive, optional field threaded alongside the existing
`GenerationRequest` (client-side) and flows into each per-`DocType` `GenerateRequest` (§8) as the
corresponding `PerDocTypeProfile` plus the shared fields — omitting `GenerationProfile` entirely
(or accepting every default) reproduces today's exact request/prompt/response shape, per this
document's compatibility bar (§1).

---

## 8. API and Prompt Changes

### `POST /_api/generate` (further extended, still backward compatible)

New optional fields on top of `docs/Enhancements2.md` §6's additions:

```ts
generationMode?: string;
requirementDepth?: RequirementDepth;
requirementDecomposition?: RequirementDecomposition;
innovationAssistance?: InnovationAssistance;   // drives both temperature and a prompt instruction
targetAudience?: TargetAudience;
traceability?: { generateIds?: boolean; requirementMapping?: boolean; verificationReferences?: boolean };
assumptionStrategy?: AssumptionStrategy;
complianceFraming?: { aspice?: boolean; iso26262?: boolean };
```

`buildGenerateSystemPrompt` (backend) grows to accept all of the above as optional parameters
(mirroring the pattern already established for `format`/`requirementPhrasing` in
`docs/Enhancements2.md` §3.4) and appends each corresponding guidance sentence in a fixed order:
base instruction → `DOC_TYPE_GUIDANCE` → `FORMAT_GUIDANCE` → EARS (if applicable) →
`GENERATION_MODE_GUIDANCE` → Requirement Depth/Decomposition guidance → Traceability guidance (if
enabled) → Assumption Strategy guidance → Compliance Framing guidance (if enabled) → Innovation
Assistance guidance → existing closing Markdown instruction. `handleGenerate` also extracts
`innovationAssistance`'s mapped `temperature` value and passes it to `callCalypso(...,
temperature)` (§3, continued). All fields default exactly as specified per-control above when
omitted, reproducing today's prompt and request body byte-for-byte.

---

## 9. Error Handling

| Failure | Behavior |
|---|---|
| `requirementMapping` enabled but only TRS (no PRD) is being generated in the batch | Instruction is omitted server-side (nothing to map to) rather than instructing the model to reference a non-existent document — same "degrade to safe default, don't crash or hallucinate" principle as `docs/Enhancements2.md` §7 |
| `verificationReferences` enabled without `generateIds` | Treated as a no-op for that instruction (no IDs exist to reference) rather than an error — client-side UI should visually gray out `verificationReferences` when `generateIds` is unchecked, but the backend does not depend on the client enforcing this |
| Unknown/invalid `generationMode`/`targetAudience` value sent | Falls back to that `DocType`'s default (same "invalid combination degrades to safe default" principle as `docs/Enhancements2.md` §7's `sectionNamesFor` fallback) |
| Calypso unavailable | Unchanged from `docs/Enhancements2.md` — `503 LLM_UNAVAILABLE`, deterministic fallback (which cannot honor any Generation Profile field, same limitation already documented for `priorAttempt` in `docs/Enhancements2.md` §4.6) |

---

## 10. Security and Privacy

- No new persistent storage — `GenerationProfile` lives in React state only, matching the
  client-side-only decision already recorded in `docs/Enhancements2.md` §10.3.
- No new sensitive-data category — all new fields are UI configuration choices (enum selections,
  booleans), not user content; none require different handling than the existing
  `productTitle`/`productDetails` fields already sent to Calypso.
- `temperature` is a standard, publicly-documented OpenAI-chat-completions field — sending it
  introduces no new trust boundary beyond the existing Calypso request path.

---

## 11. Implementation Task Breakdown

Ordered by dependency; depends on `docs/Enhancements2.md` §9's tasks 1–4 being complete first
(Template/format selection must exist before this screen can embed it):

1. **Data model**: add `GenerationProfile` and all enum constants (`GENERATION_MODES`,
   `REQUIREMENT_DEPTH_LEVELS`, `REQUIREMENT_DECOMPOSITION_LEVELS`, `INNOVATION_ASSISTANCE_LEVELS`,
   `TARGET_AUDIENCES`, `ASSUMPTION_STRATEGIES`) to `contract.ts`. *Validates*: unit tests for
   default-value construction (an all-defaults `GenerationProfile` matches the documented no-op
   defaults per control).
2. **Backend prompt guidance**: add `GENERATION_MODE_GUIDANCE`, Requirement Depth/Decomposition
   guidance maps, Traceability/Assumption Strategy/Compliance Framing guidance, and the
   `INNOVATION_ASSISTANCE` → `temperature` map, to `server.mjs`, mirrored into `vite.config.ts`.
   Extend `buildGenerateSystemPrompt` and `handleGenerate`'s `temperature` threading through
   `callCalypso`/`callCalypsoChat`. *Validates*: existing `tests/http/generate.test.ts` continue to
   pass with no new fields supplied (byte-identical request/prompt); new tests per guidance block.
3. **New `GenerationProfileScreen` component** (frontend): renders the per-`DocType` sub-panels
   (embedding `docs/Enhancements2.md` §3.6's Template radio group) plus the shared panel
   (Traceability, Assumption Strategy, Compliance Framing). *Validates*: new component test file;
   default-state test asserting an unmodified screen produces the documented no-op
   `GenerationProfile`.
4. **`App.tsx` flow change**: insert the new screen between `InputForm` and generation; move the
   "Generate" action there; `InputForm`'s button becomes "Continue". *Validates*: extend
   `tests/e2e/acceptance.test.ts` with one new scenario for the two-step flow reaching generation
   with all defaults, asserting output is unchanged from the single-step flow's prior behavior.
5. **`llmGenService.ts`**: thread `GenerationProfile` fields into each per-`DocType`
   `postGenerate` call. *Validates*: a test asserting an all-defaults profile reproduces today's
   exact `postGenerate` payload (the core backward-compatibility guarantee of this document).
6. **Documentation**: add a `docs/EnhancementToDo4.md` tracking checklist (mirrors
   `docs/EnhancementToDo2.md`'s convention) when a builder begins execution.
