# Good TRS/PRD/UX Formats 2 — Standardized Format Options (9 formats: 3 per document type)

**Extends** [`docs/GoodTRSPRDUX.md`](./GoodTRSPRDUX.md), which remains the content-quality bar for
this app's **default/"Standard"** section structure (`PRD_SECTIONS`, `TRS_SECTIONS`, `UX_SEGMENTS`
in `app/src/generation/{prdGen,trsGen,uxGen}.ts`). This document researches **three additional,
named, industry-recognized formats per document type** (PRD, TRS, UX — 9 total), each selectable
instead of the Standard format, per the format-selection feature planned in
[`docs/Enhancements2.md`](./Enhancements2.md) §3 and the "Template" control in
[`docs/Enhancements3.md`](./Enhancements3.md) §2.

**Revision note**: an earlier draft of this document proposed 3 formats shared loosely across
document types (with Volere reused for both PRD and TRS). Following a clarifying-question round,
the user asked for **9 fully distinct standards, no sharing across document types** — this
revision replaces that draft entirely.

Status legend: **CONFIRMED** = directly verified from a fetched, cited source this session.
**CORROBORATED** = a stable, long-standing, widely-repeated public fact (10+ years, multiple
independent secondary sources) that live fetch attempts in this session could not re-verify
against a primary source due to page-extraction failures (documented per-format below), but which
is not in dispute. No paywalled/copyrighted template text is reproduced verbatim anywhere in this
document — only public, freely-known structural facts are included.

---

## Overview

| Document | Format 1 | Format 2 | Format 3 |
|---|---|---|---|
| **PRD** | Volere Requirements Specification (adapted) | Amazon "Working Backwards" PR/FAQ | Basecamp "Shape Up" Pitch |
| **TRS** | EARS (requirement phrasing) | Formal SRS Outline (IEEE 830 / ISO-IEC-IEEE 29148) | C4 Model (software architecture) |
| **UX** | NN/g Service Blueprint | Jobs-to-Be-Done / Job Stories | Atomic Design |

All 9 are fully distinct (no format is shared across document types), each chosen because it maps
onto a different, legitimate lens on that document type rather than being a generic reshuffle of
the same idea three times. Automotive SPICE (ASPICE) and ISO 26262 were considered and are
**deliberately excluded from this list** — both are *process/compliance* standards, not document
*content* templates (see §6 for how this app still lets a user request ASPICE/ISO 26262-aware
*framing* without misrepresenting either as a selectable "format").

---

## PRD Format 1 — Volere Requirements Specification Template (adapted)

**Source**: James & Suzanne Robertson, Atlantic Systems Guild — free public skeleton confirmed at
[volere.org](https://volere.org). The full ~80–90 page template with worked examples is
commercially licensed (paywalled); only the free section-heading skeleton is referenced here.

### Full 27-section skeleton (as published)

Purpose of the Project · Stakeholders · Mandated Constraints · Naming Conventions and Definitions ·
Relevant Facts and Assumptions · Scope of the Work · Business Data Model · Scope of the Product ·
Functional Requirements · Look and Feel Requirements · Usability and Humanity Requirements ·
Performance Requirements · Operational and Environmental Requirements · Maintainability and
Support Requirements · Security Requirements · Cultural Requirements · Compliance Requirements ·
Open Issues · Off-the-Shelf Solutions · New Problems · Tasks · Migration to the New Product ·
Risks · Costs · User Documentation and Training · Waiting Room · Ideas for Solutions.

### Two Volere concepts worth adopting beyond section names

1. **Fit Criterion** — every requirement should carry a measurable, testable pass/fail condition
   (not "the system shall be fast" but "responds within 2 seconds for 95% of requests") — the same
   idea as ISO/IEC/IEEE 29148's "testable" bar, restated per-requirement.
2. **Rationale** — a short "why this requirement exists" note per requirement, useful for the
   human-in-the-loop regeneration feature in `docs/Enhancements2.md` §4, since preserving *intent*
   across edits is more durable than preserving exact wording.

### Adapted 16-section list (PRD format option)

1. Purpose of the Project
2. Stakeholders
3. Mandated Constraints
4. Relevant Facts and Assumptions
5. Scope of the Work
6. Scope of the Product
7. Functional Requirements
8. Look and Feel Requirements
9. Usability and Humanity Requirements
10. Performance Requirements
11. Operational and Environmental Requirements
12. Maintainability and Support Requirements
13. Security Requirements
14. Compliance Requirements
15. Risks
16. Open Issues

Excluded, with reason: *Naming Conventions and Definitions* (rarely meaningful for a single
generated draft), *Business Data Model* (redundant with TRS's Data Requirements when both are
generated together), *Cultural Requirements* (Volere's own guidance treats this as
optional/low-frequency), *Off-the-Shelf Solutions*, *New Problems*, *Tasks*, *Migration*, *Costs*,
*User Documentation and Training*, *Waiting Room*, *Ideas for Solutions* (process/procurement
oriented, not single-pass draft content).

### Content-quality guidance

- **Purpose of the Project** — one paragraph: why the project exists, in business terms.
- **Stakeholders** — named roles, not just "the user."
- **Mandated Constraints** — anything the solution *must* satisfy regardless of design choice
  (budget, timeline, technology/regulatory mandate) — distinct from a technical NFR.
- **Scope of the Work / Scope of the Product** — Volere's key distinction: *Scope of the Work* is
  the business process being changed; *Scope of the Product* is what the software itself does —
  keep separate, don't collapse into one.
- **Functional Requirements** — each requirement should carry an implicit Fit Criterion.
- **Look and Feel / Usability and Humanity / Performance / Operational and Environmental /
  Maintainability and Support / Security / Compliance** — distinct non-functional categories; do
  not merge into one generic paragraph (the one meaningful structural difference from the Standard
  format's single "Non-Functional Requirements"-shaped sections).
- **Risks / Open Issues** — kept as two separate lists: Risks (things that might go wrong) vs.
  Open Issues (unresolved questions blocking further design).

---

## PRD Format 2 — Amazon "Working Backwards" PR/FAQ

**Sourcing note**: this session made repeated `fetch_webpage` attempts (aboutamazon.com,
workingbackwards.com, two productplan.com pages, a LinkedIn article, review.firstround.com) to
pull a primary citation for this format; all failed (404s or JavaScript-rendered pages returning
only navigation chrome). The structure below is **CORROBORATED**, not freshly confirmed against a
primary source this session — drawn from Colin Bryar & Bill Carr's *Working Backwards: Insights,
Stories, and Secrets from Inside Amazon* (2021, both former long-tenured Amazon executives) and
Amazon executive Ian McAllister's widely-cited 2012 public description of the practice — a
long-standing (10+ year), independently cross-referenced description of a fixed, well-known
template. **If a stricter primary citation is required before this ships as user-facing
documentation, a follow-up fetch against a non-JS-rendered mirror is recommended.**

### Structure

**Press Release** (about one page): (1) Heading — names the product for the intended customer;
(2) Sub-heading — target market and benefit; (3) Summary paragraph; (4) Problem paragraph — the
customer problem; (5) Solution paragraph(s) — how the product solves it, in customer terms; (6)
Leadership quote; (7) How to get started; (8) Customer quote; (9) Call to action / closing.

**FAQ**: (10) External FAQ — questions a real customer/press would ask; (11) Internal FAQ —
questions a reviewer/stakeholder would ask (feasibility, dependencies, cost, risk).

### Content-quality guidance

- **Heading/Sub-heading** — understandable by the actual target customer, not internal jargon.
- **Problem paragraph** — written from the customer's voice, not the business's.
- **Solution paragraph** — readable by a non-technical stakeholder; a customer benefit, not a
  feature list.
- **Internal FAQ** — must surface genuinely hard questions (feasibility, cost, risk), not softballs.
- **External FAQ** — anticipates real objections a skeptical customer/journalist would raise.

### 11-item section list (PRD format option)

Press Release Heading · Press Release Sub-heading · Summary Paragraph · Problem Paragraph ·
Solution Paragraph · Leadership Quote · How to Get Started · Customer Quote · Call to Action ·
Internal FAQ · External FAQ.

---

## PRD Format 3 — Basecamp "Shape Up" Pitch

**Sourcing note**: three separate `fetch_webpage` attempts this session (basecamp.com's two
chapter pages, the `basecamp/shapeup` GitHub mirror, a third-party summary site) all failed to
return usable content (JavaScript-rendered pages, or 404s). The structure below is
**CORROBORATED**: *Shape Up* is written by Ryan Singer and freely published in full by Basecamp
(37signals) at no cost — it is not a paywalled/proprietary source, and its five-part "Pitch"
structure is one of the most widely written-about product-process templates of the last decade,
independently described by many product-management blogs and conference talks, not a single
unverified source. **If a stricter primary citation is required, a follow-up fetch against a
different mirror/cache is recommended.**

### Structure

A "Pitch" is a compact proposal for a scope of work, written *before* committing engineering time:

1. **Problem** — the raw idea, use case, or observation motivating the work.
2. **Appetite** — how much time the team is willing to spend (e.g., "2 weeks" / "6 weeks"), framed
   as a fixed constraint the solution must fit, not an estimate to be derived from the solution.
3. **Solution** — the core elements of the proposed approach, described concretely enough to
   evaluate, without being a full implementation spec.
4. **Rabbit Holes** — specific technical/design details worth calling out in advance to prevent the
   team from getting stuck once work starts.
5. **No-gos** — functionality or use cases explicitly and deliberately excluded, to fit the stated
   appetite or keep the problem tractable.

### Why this fits "PRD"

Shape Up's Pitch is deliberately **not** a comprehensive requirements document (unlike Volere) — it
is a scoping/decision document. Offering it as a PRD format option serves teams that want a
lightweight, appetite-constrained framing before writing a fuller spec, directly matching the
"AI enhancements, products" charter's need for fast-moving, appetite-bounded feature work.

### Content-quality guidance

- **Problem** — same bar as the Standard format's Problem Statement (specific, real pain).
- **Appetite** — must be stated as a fixed time-box, not a vague "as long as it takes."
- **Solution** — concrete enough to evaluate feasibility, but explicitly not a full design spec.
- **Rabbit Holes** — name a specific risk/detail, not a generic "this could be tricky" placeholder.
- **No-gos** — explicit exclusions, mirroring the Standard PRD's Exclusions section's own bar
  (specific deferred capabilities, not a generic disclaimer).

### 5-item section list (PRD format option)

Problem · Appetite · Solution · Rabbit Holes · No-gos.

---

## TRS Format 1 — EARS (Easy Approach to Requirements Syntax)

**Source**: developed by Alistair Mavin (then at Rolls-Royce), published at IEEE RE'09 (2009);
confirmed via Wikipedia's EARS article and [alistairmavin.com](https://alistairmavin.com/ears/).
Adopted by Airbus, Bosch, Dyson, Honeywell, Intel, NASA, Rolls-Royce, Siemens, and is the native
requirements notation for Amazon's "Kiro" AI spec-driven-development IDE (2025), specifically
because EARS's fixed sentence templates reduce ambiguity for LLM-authored/consumed specs.

EARS is **not a section skeleton** — it is a sentence-level requirement-phrasing convention,
layered on top of whichever section list is in use (Standard, by default). Selecting "EARS" as
the TRS format therefore keeps `TRS_SECTIONS` unchanged and only changes how each requirement
sentence is phrased.

### The six patterns

| Pattern | Template |
|---|---|
| Ubiquitous | `THE <system> SHALL <response>` |
| Event-driven | `WHEN <trigger>, THE <system> SHALL <response>` |
| State-driven | `WHILE <precondition>, THE <system> SHALL <response>` |
| Optional feature | `WHERE <feature is present>, THE <system> SHALL <response>` |
| Unwanted behavior | `IF <trigger>, THEN THE <system> SHALL <response>` |
| Complex | Combinations of the above |

### Guidance

Every requirement-bearing sentence (Functional Requirements, Non-Functional Requirements) must use
exactly one of the six patterns; `<system>` should be named concretely; `<response>` must be an
observable, testable action. Do not force non-requirement prose (Summary, System Boundaries
narrative) into EARS syntax.

---

## TRS Format 2 — Formal SRS Outline (IEEE 830 / ISO/IEC/IEEE 29148)

**Source**: CONFIRMED this session via a fresh fetch of Wikipedia's "Software requirements
specification" article, which documents the standard's own recommended structure (citing
Stellman & Greene's *Applied Software Project Management*, O'Reilly, 2005). IEEE 830-1984 was the
original standard; ISO/IEC/IEEE 29148:2018 superseded it in 2011 (current revision 2018) and is
broader (also covering requirement-quality criteria and requirement management processes).

### Confirmed structure (as published)

1. **Purpose** — Definitions, Background, System overview, References
2. **Overall Description** — Product perspective (System/User/Hardware/Software/Communication
   Interfaces, Memory constraints, Operations, Site adaptation requirements), Product functions,
   User characteristics, Constraints/assumptions/dependencies
3. **Specific Requirements** — External interface requirements, Performance requirements, Logical
   database requirements, Software system attributes (**Reliability, Availability, Security,
   Maintainability, Portability**), Functional requirements, Environment characteristics
   (Hardware, Peripherals, Users), Other

The standard also recommends a verification/test section "that mirrors the structure of specific
requirements" — already reflected in this app's existing Standard TRS "Test and Validation"
section (see `docs/GoodTRSPRDUX.md` §2).

### Adapted 9-section list (TRS format option)

Flattened for a single-pass generated document (the confirmed structure above is deeply nested;
this app renders one prose block per top-level section):

1. Purpose and Scope
2. Overall Description
3. External Interface Requirements
4. Functional Requirements
5. Performance Requirements
6. Logical Database Requirements
7. Software System Attributes (Reliability, Availability, Security, Maintainability, Portability)
8. Environment Characteristics
9. Other Requirements

### Content-quality guidance

- **Purpose and Scope** — merges the standard's "Purpose" (definitions, background, system
  overview, references) into one prose section appropriate for a generated draft.
- **Overall Description** — merges "Product perspective," "Product functions," "User
  characteristics," and "Constraints/assumptions" — should still individually address each
  distinct sub-topic within one section.
- **Software System Attributes** — must individually address each of the five named categories
  (Reliability, Availability, Security, Maintainability, Portability) — this is the standard's own
  explicit list, not a paraphrase; do not merge into one vague "quality" statement.
- Same requirement-quality bar as `docs/GoodTRSPRDUX.md` §2 (necessary, unambiguous, testable;
  avoid requirement smells).

---

## TRS Format 3 — C4 Model (Software Architecture)

**Source**: CONFIRMED this session via a fresh fetch of [c4model.com](https://c4model.com/),
created by Simon Brown. Licensed under Creative Commons Attribution 4.0 International — freely
available, not paywalled. A widely-adopted, notation-independent, tooling-independent approach to
describing software architecture at multiple zoom levels.

### Confirmed structure

A set of **hierarchical abstractions**: Software Systems → Containers → Components → Code, and a
matching set of **hierarchical diagrams**: System Context, Containers, Components, Code — plus
supporting diagrams: System Landscape, Dynamic, Deployment.

### Why this fits "TRS"

The C4 model is specifically an architecture-*description* method, filling the same role as this
app's existing "High Level Architecture" and "System Boundaries" TRS sections, but with a more
rigorous, industry-recognized level structure — a strong fit for a *technical* requirements
document, distinct from EARS (phrasing) and the Formal SRS Outline (comprehensive requirements
structure).

### Adapted 6-section list (TRS format option)

C4's "Code" diagram level is intentionally excluded — it's file/class-level detail inappropriate
for a generated requirements-stage document, not a requirements-document concern:

1. System Context (actors, external systems, and the system's boundary — supersedes "System
   Boundaries")
2. Containers (major deployable/runnable units and how they communicate — supersedes "High Level
   Architecture")
3. Components (key components within each container and their responsibilities)
4. Dynamic Scenarios (narrative description of how components collaborate for key use cases — the
   textual equivalent of a C4 "Dynamic" diagram)
5. Deployment (where containers run — infrastructure mapping; reuses this app's existing
   "Deployments" section name)
6. Non-Functional Requirements, Data Requirements, Integration Requirements, UI Requirements, Test
   and Validation, Risks and Dependencies, AI Usage and Implications — **kept from the Standard
   TRS format unchanged**, since C4 has nothing to say about these; only the
   architecture-describing sections are replaced (see `docs/Enhancements2.md` §3.2 for exactly
   which sections are replaced vs. reused).

---

## UX Format 1 — NN/g Service Blueprint

**Source**: CONFIRMED this session via a fresh fetch of Nielsen Norman Group's "Service
Blueprints: Definition" article (Sarah Gibbons, originally published 2017, last reviewed 2026) —
the same trusted source already used for this app's Standard UX journey-mapping guidance in
`docs/GoodTRSPRDUX.md`.

### Confirmed structure

A service blueprint visualizes the relationships between service components tied to a specific
customer journey, organized by three "lines": the **line of interaction** (direct
customer-organization interaction), the **line of visibility** (separates what's visible to the
customer — "frontstage" — from what isn't — "backstage"), and the **line of internal interaction**
(separates contact employees from non-customer-facing roles). Key elements: **Customer Actions**,
**Frontstage Actions** (human-to-human or human-to-computer, directly visible), **Backstage
Actions** (behind the scenes), **Processes** (internal steps supporting the above). Secondary
elements: Evidence (physical/digital props and places), Time, Emotion, Metrics.

### Why this fits "UX"

Service blueprints are explicitly described by NN/g as "part two" of a customer journey map — they
extend this app's existing Standard UX journey-mapping approach (`docs/GoodTRSPRDUX.md` §3) with
the backstage/organizational dimension, valuable for products with meaningful backend/operational
complexity (a strong fit for the "AI enhancements, products" charter, where an AI feature often has
real backstage processing to account for).

### Adapted 6-section list (UX format option)

Replaces the Standard format's "User Journeys for personas" section; "UI Design Mockups" is kept
unchanged from Standard (Service Blueprinting has nothing to say about visual UI structure):

1. Customer Actions
2. Frontstage Actions
3. Backstage Actions
4. Supporting Processes
5. Evidence (Physical and Digital Touchpoints)
6. UI Design Mockups *(kept from Standard, unchanged)*

### Content-quality guidance

- **Customer Actions** — derived from the same persona/journey the Standard format already asks
  for, not a generic restatement.
- **Frontstage Actions** — distinguish human-to-human vs. human-to-computer (self-service)
  actions, per NN/g's own distinction.
- **Backstage Actions** — name specific internal systems/roles, not a vague "the system processes
  this."
- **Evidence** — name the actual physical/digital touchpoints implied by the product (a mobile
  app screen, an email, a physical location) — NN/g's own example uses signage, a website, a
  tutorial video.

---

## UX Format 2 — Jobs-to-Be-Done / Job Stories

**Source**: the underlying theory is CONFIRMED via a fresh fetch of the Clayton Christensen
Institute's "Jobs to Be Done Theory" page (the institute founded by the theory's originator).
The specific "Job Story" sentence template (`When <situation>, I want to <motivation>, so I can
<expected outcome>`) — popularized publicly by Intercom's product team (commonly attributed to
Des Traynor/Intercom's 2016 "replacing the user story with the job story" writing) — is
**CORROBORATED**, not freshly fetched successfully this session (both attempted sources,
jtbd.info and an Intercom blog URL, failed to return page content this session); it is, however, a
widely and consistently described template across many independent product-writing sources.

### Confirmed theory

Jobs to Be Done reframes "why do people buy/adopt this" around the **progress** a person is trying
to make in a specific circumstance, not demographics or product features. Per the Christensen
Institute, every job has three dimensions: **functional**, **social**, and **emotional**.

### Why this fits "UX"

JTBD directly matches the "customer obsessive functions" team charter — like Amazon's PR/FAQ for
PRD, it forces the document to be framed around a real customer circumstance and motivation,
rather than a feature list, but at the UX-journey level rather than the whole-product level.

### Adapted 3-section list (UX format option)

Replaces the Standard format's "User Journeys for personas" section; "UI Design Mockups" is kept
unchanged:

1. Core Jobs to Be Done (for each relevant job: its functional, social, and emotional dimensions,
   per the Christensen Institute's three-part framework)
2. Job Stories (`When <situation>, I want to <motivation>, so I can <expected outcome>` — one per
   key job identified above)
3. UI Design Mockups *(kept from Standard, unchanged)*

### Content-quality guidance

- **Core Jobs to Be Done** — must name a real circumstance driving the "hire," not a generic
  motivation; must address all three dimensions (functional, social, emotional) — a job story
  that's purely functional is incomplete per the theory itself.
- **Job Stories** — must literally follow the `When/I want to/so I can` sentence form; avoid
  restating a persona/goal from the Standard format's journey narrative verbatim in this new
  shape — synthesize, don't reformat.

---

## UX Format 3 — Atomic Design

**Source**: CONFIRMED this session via a fresh fetch of Brad Frost's freely-published online book,
[atomicdesign.bradfrost.com](https://atomicdesign.bradfrost.com/chapter-2/) (2016). Widely adopted
across the UI/design-systems industry.

### Confirmed structure

Five concurrently-related stages: **Atoms** (basic, indivisible UI elements — labels, inputs,
buttons), **Molecules** (simple groups of atoms functioning as a unit — e.g., a labeled search
input + button), **Organisms** (complex components made of molecules/atoms/other organisms forming
a distinct interface section — e.g., a page header), **Templates** (page-level layouts articulating
content structure, not final content), **Pages** (templates populated with real representative
content — the most concrete stage, used to validate the design system holds up).

### Why this fits "UX"

Atomic Design is specifically a method for structuring **UI mockups/design systems** — a direct,
more rigorous alternative to this app's existing free-text ASCII "UI Design Mockups" section,
appropriate for a product/design-systems-minded team.

### Adapted 6-section list (UX format option)

Replaces the Standard format's "UI Design Mockups" section; "User Journeys for personas" is kept
unchanged (Atomic Design has nothing to say about journeys/personas):

1. User Journeys for personas *(kept from Standard, unchanged)*
2. Atoms (Base UI Elements)
3. Molecules (Component Groups)
4. Organisms (Composite Interface Sections)
5. Templates (Page-Level Layouts)
6. Pages (Populated Screens)

### Content-quality guidance

- **Atoms** — name concrete, product-specific elements (not "a button" generically — "the
  'Generate' primary action button").
- **Molecules/Organisms** — must be composed explicitly *from* the atoms/molecules already named,
  not introduced as unrelated new elements (Brad Frost's own point: atoms only "come to life with
  application" inside larger groupings).
- **Templates** — describes content *structure* (what kind of content goes where, e.g., "a heading
  of roughly N characters, followed by a 3-item list"), not final copy.
- **Pages** — populates a named Template with realistic representative content for this specific
  product, demonstrating the design system holds up with real content, per Frost's own guidance.

---

## Applicability Summary

| DocType | Format 1 | Format 2 | Format 3 |
|---|---|---|---|
| PRD | Volere (16 sections) | Amazon PR/FAQ (11 sections) | Shape Up Pitch (5 sections) |
| TRS | EARS (phrasing overlay, sections unchanged) | Formal SRS Outline (9 sections) | C4 Model (6 sections, 5 replaced + rest reused) |
| UX | Service Blueprint (6 sections, journeys replaced) | Jobs-to-Be-Done (3 sections, journeys replaced) | Atomic Design (6 sections, mockups replaced) |

See `docs/Enhancements2.md` §3 for exactly how each maps onto `sectionNamesFor`/
`buildGeneratedDocument` without changing the rendering/export pipeline, and
`docs/Enhancements3.md` §2 for how format selection fits into the broader pre-generation
"Generation Profile" screen.

---

## 5. Traceability ID conventions (CRS → TRS mapping)

Content convention (not a new stored data model — see `docs/Enhancements2.md` §3.7 and
`docs/Enhancements3.md` §4 for where this becomes an explicit, opt-in UI toggle):

- **CRS-ID** (Customer/Product Requirement Statement ID): assigned to each Functional Requirement
  in a PRD-shaped document (any of the 3 PRD formats' requirement-bearing sections). Format:
  `CRS-<DOCTYPE-PREFIX>-<NNN>`, e.g. `CRS-PRD-001`.
- **TRS-ID**: assigned to each technical/non-functional requirement in a TRS-shaped document.
  Format: `TRS-<NNN>`, e.g. `TRS-014`.
- **Traceability mapping**: each TRS-ID references the CRS-ID(s) it fulfills, e.g. `TRS-014
  (fulfills CRS-PRD-003)` — mirrors ISO/IEC/IEEE 29148's traceability concept at the
  individual-requirement level.
- IDs are stable across a **single generation session** only for this round of work — see
  `docs/Enhancements2.md` §3.7 for why stable cross-regeneration IDs are deferred.

---

## 6. Compliance framing (ASPICE, ISO 26262) — why these are not "formats"

Automotive SPICE (capability levels 0–5, work products like SYS.1–SYS.5/SWE.1–SWE.6) and
ISO 26262 (functional safety for road vehicles) are both **process/compliance standards**, not
document-content templates — neither defines a section skeleton or prose style a generated
document could imitate the way Volere, EARS, or the Formal SRS Outline do. Presenting either as a
selectable "format" (an actual document standard/skeleton) would misrepresent what they are.

Instead, `docs/Enhancements3.md` §3 proposes a lightweight, separate **Compliance Framing** flag
(distinct from the "Template" format selector) — when enabled, it adds a *prompt-guidance*
instruction (e.g., "frame non-functional requirements using ASPICE/ISO-26262-relevant vocabulary
and structure where applicable, and call out safety-relevant requirements explicitly") without
claiming the generated document literally *is* an ASPICE or ISO 26262 work product. This keeps the
distinction between "selects a real, sourced document template" (this document's 9 formats) and
"asks the model to use safety/process-aware framing" (a separate, honestly-scoped toggle) clear
and non-misleading.
